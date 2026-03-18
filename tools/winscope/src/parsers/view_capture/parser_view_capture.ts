/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {assertString, assertTrue} from '@common/assert';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {TraceFile} from '@trace_api/trace_file';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {ParserViewCaptureWindow} from './parser_view_capture_window';

interface WindowAndPackage {
  window: string;
  package: string;
}

/**
 * A parser for Perfetto ViewCapture traces.
 */
export class ParserViewCapture {
  private readonly traceFile: TraceFile;
  private readonly traceProcessor: TraceProcessor;
  private readonly timestampConverter: ParserTimestampConverter;
  protected readonly traceGeometryData: TraceGeometryData;

  private windowParsers: ParserViewCaptureWindow[] = [];

  private static readonly STDLIB_MODULE_NAME = 'android.winscope.viewcapture';

  static async createInstance(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
  ): Promise<Array<AbstractParser<HierarchyTreeNode>>> {
    const parser = new ParserViewCapture(
      traceFile,
      traceProcessor,
      timestampConverter,
      traceGeometryData,
    );
    await parser.parse();
    return parser.getWindowParsers();
  }

  constructor(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
  ) {
    this.traceFile = traceFile;
    this.traceProcessor = traceProcessor;
    this.timestampConverter = timestampConverter;
    this.traceGeometryData = traceGeometryData;
  }

  async parse() {
    await this.traceProcessor.query(
      `INCLUDE PERFETTO MODULE ${ParserViewCapture.STDLIB_MODULE_NAME};`,
    );

    const windowAndPackageNames = await this.queryWindowAndPackageNames();
    assertTrue(
      windowAndPackageNames.length > 0,
      () => 'Perfetto trace has no ViewCapture window entries',
    );

    this.windowParsers = windowAndPackageNames.map(
      (windowAndPackage) =>
        new ParserViewCaptureWindow(
          this.traceFile,
          this.traceProcessor,
          this.timestampConverter,
          this.traceGeometryData,
          windowAndPackage.package,
          windowAndPackage.window,
        ),
    );
    const parsePromises = this.windowParsers.map((parser) => parser.parse());
    await Promise.all(parsePromises);
  }

  getWindowParsers(): ParserViewCaptureWindow[] {
    return this.windowParsers;
  }

  private async queryWindowAndPackageNames(): Promise<WindowAndPackage[]> {
    const sql = `
      SELECT DISTINCT vc.package_name, vc.window_name
        FROM android_viewcapture AS vc
        GROUP BY vc.id;
    `;

    const result = await this.traceProcessor.query(sql);

    const names: WindowAndPackage[] = [];
    for (const it = result.iter({}); it.valid(); it.next()) {
      names.push({
        package: assertString(it.get('package_name')),
        window: assertString(it.get('window_name')),
      });
    }

    return names;
  }
}
