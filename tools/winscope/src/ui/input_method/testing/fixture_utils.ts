/*
 * Copyright (C) 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {makeConverterNoRteOffsets} from '@common/time/testing/test_helpers';
import {FileReaderInputMethodClients} from '@legacy_file_readers/input_method/file_reader_input_method_clients';
import {FileReaderInputMethodManagerService} from '@legacy_file_readers/input_method/file_reader_input_method_manager_service';
import {FileReaderInputMethodService} from '@legacy_file_readers/input_method/file_reader_input_method_service';
import {FileReaderSurfaceFlinger} from '@legacy_file_readers/surface_flinger/file_reader_surface_flinger';
import {convertToPerfettoTrace, LegacyFileReaderProvider,} from '@legacy_file_readers/testing/fixture_utils';
import {FileReaderWindowManager} from '@legacy_file_readers/window_manager/file_reader_window_manager';
import {getPerfettoParsers, NonPerfettoParserProvider,} from '@parsers/fixture_utils';
import {Parser} from '@trace_api/parser';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

/**
 * @param type The type of the trace to get.
 * @param filename The name of the trace file in the test fixtures.
 * @return The trace.
 */
export async function getTrace<T extends TraceType>(
  type: T,
  filename: string,
): Promise<Trace<T>> {
  const converter = makeConverterNoRteOffsets();
  const nonPerfettoParsers = await new NonPerfettoParserProvider()
    .addFile(filename)
    .setTimestampConverter(converter)
    .getAll();
  expect(nonPerfettoParsers.length).toBeLessThanOrEqual(1);
  if (nonPerfettoParsers.length === 1) {
    expect(nonPerfettoParsers[0].getTraceType()).toEqual(type);
    return new TraceBuilder<T>()
      .setType(type)
      .setParser(nonPerfettoParsers[0] as unknown as Parser<T>)
      .build();
  }

  const {parsers: perfettoParsers} = await getPerfettoParsers(filename);
  expect(perfettoParsers.length).toBe(1);
  expect(perfettoParsers[0].getTraceType()).toEqual(type);
  return new TraceBuilder<T>()
    .setType(type)
    .setParser(perfettoParsers[0] as unknown as Parser<T>)
    .build();
}

/**
 * @return The IME trace entries.
 */
export async function getImeTraceEntries(): Promise<
  [Map<TraceType, HierarchyTreeNode>, Map<TraceType, HierarchyTreeNode>]
> {
  const fileReaders = await new LegacyFileReaderProvider([
    FileReaderSurfaceFlinger.createInstance,
    FileReaderInputMethodService.createInstance,
    FileReaderInputMethodManagerService.createInstance,
    FileReaderInputMethodClients.createInstance,
    FileReaderWindowManager.createInstance,
  ])
    .addFile('traces/ime/SurfaceFlinger_with_IME.pb')
    .addFile('traces/ime/InputMethodService.pb')
    .addFile('traces/ime/InputMethodManagerService.pb')
    .addFile('traces/ime/InputMethodClients.pb')
    .addFile('traces/ime/WindowManager_with_IME.pb')
    .getAll();

  const [
    clientsParser,
    managerServiceParser,
    serviceParser,
    sfParser,
    wmParser,
  ] = await convertToPerfettoTrace(fileReaders, makeConverterNoRteOffsets());

  const surfaceFlingerEntry = await sfParser.getEntry(5);
  const imServiceEntry = await serviceParser.getEntry(0);
  const imManagerServiceEntry = await managerServiceParser.getEntry(0);
  const clientsEntry0 = await clientsParser.getEntry(0);
  const clientsEntry1 = await clientsParser.getEntry(1);
  const windowManagerEntry = await wmParser.getEntry(2);

  const entries = new Map<TraceType, HierarchyTreeNode>();
  entries.set(TraceType.INPUT_METHOD_CLIENTS, clientsEntry0);
  entries.set(TraceType.INPUT_METHOD_MANAGER_SERVICE, imManagerServiceEntry);
  entries.set(TraceType.INPUT_METHOD_SERVICE, imServiceEntry);
  entries.set(TraceType.SURFACE_FLINGER, surfaceFlingerEntry);
  entries.set(TraceType.WINDOW_MANAGER, windowManagerEntry);

  const secondEntries = new Map<TraceType, HierarchyTreeNode>();
  secondEntries.set(TraceType.INPUT_METHOD_CLIENTS, clientsEntry1);
  secondEntries.set(TraceType.SURFACE_FLINGER, surfaceFlingerEntry);
  secondEntries.set(TraceType.WINDOW_MANAGER, windowManagerEntry);

  return [entries, secondEntries];
}
