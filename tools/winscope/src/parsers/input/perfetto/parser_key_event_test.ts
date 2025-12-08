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
import {assertDefined} from 'common/assert';
import {getPerfettoParser} from 'test/unit/fixture_utils';
import {
  makeRealTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {CoarseVersion} from 'trace_api/coarse_version';
import {CustomQueryType} from 'trace_api/custom_query';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('PerfettoParserKeyEvent', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = await getPerfettoParser(
      TraceType.INPUT_KEY_EVENT,
      'traces/perfetto/input-events.perfetto-trace',
    );
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.INPUT_KEY_EVENT);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('provides timestamps', () => {
    const timestamps = assertDefined(parser.getTimestamps());

    expect(timestamps.length).toBe(2);

    const expected = [
      makeRealTimestamp(1718386905115026232n),
      makeRealTimestamp(1718386905123057319n),
    ];
    expect(timestamps).toEqual(expected);
  });

  it('retrieves all entries', async () => {
    const entries = await parser.getAllEntries();
    expect(entries.length).toBe(2);
    expect(entries.every((entry) => entry !== undefined)).toBeTrue();
  });

  it('retrieves trace entry from timestamp', async () => {
    const entry = await parser.getEntry(1);
    expect(entry.id).toBe('AndroidKeyEvent entry');
  });

  it('retrieves and translates eager property values', async () => {
    const entry = await parser.getEntry(0);

    expect(entry.getEagerPropertyByName('eventId')?.getValue()).toBe(
      759309047n,
    );
    expect(entry.getEagerPropertyByName('action')?.formattedValue()).toBe(
      'ACTION_DOWN',
    );
    expect(entry.getEagerPropertyByName('source')?.formattedValue()).toBe(
      'SOURCE_KEYBOARD',
    );
    expect(entry.getEagerPropertyByName('deviceId')?.formattedValue()).toBe(
      '2',
    );
    expect(entry.getEagerPropertyByName('displayId')?.formattedValue()).toBe(
      '-1',
    );
    expect(entry.getEagerPropertyByName('keyCode')?.formattedValue()).toBe(
      'KEYCODE_VOLUME_UP',
    );
  });

  it('transforms fake key event proto built from trace processor args', async () => {
    const entry = await parser.getEntry(0);

    const properties = await entry.getAllProperties();
    const keyEvent = assertDefined(properties.getChildByName('event'));

    expect(keyEvent.getChildByName('flags')?.formattedValue()).toBe(
      'FLAG_FROM_SYSTEM',
    );
    expect(keyEvent.getChildByName('action')?.formattedValue()).toBe(
      'ACTION_DOWN',
    );
    expect(keyEvent.getChildByName('source')?.formattedValue()).toBe(
      'SOURCE_KEYBOARD',
    );
    expect(keyEvent.getChildByName('deviceId')?.getValue()).toBe(2);
    expect(keyEvent.getChildByName('displayId')?.getValue()).toBe(-1);
    expect(keyEvent.getChildByName('metaState')?.formattedValue()).toBe('0x0');
    expect(keyEvent.getChildByName('keyCode')?.formattedValue()).toBe(
      'KEYCODE_VOLUME_UP',
    );
    expect(keyEvent.getChildByName('scanCode')?.getValue()).toBe(115);
  });

  it('merges key event with all associated dispatch events', async () => {
    const entry = await parser.getEntry(0);
    const properties = await entry.getAllProperties();

    const windowDispatchEvents = assertDefined(
      properties.getChildByName('dispatchEvents'),
    );

    expect(windowDispatchEvents?.getAllChildren().length).toBe(2);
    expect(
      windowDispatchEvents
        ?.getChildByName('0')
        ?.getChildByName('windowId')
        ?.getValue(),
    ).toBe(212n);
    expect(
      windowDispatchEvents
        ?.getChildByName('1')
        ?.getChildByName('windowId')
        ?.getValue(),
    ).toBe(0n);
  });

  it('supports VSYNCID custom query', async () => {
    const trace = new TraceBuilder()
      .setType(TraceType.INPUT_KEY_EVENT)
      .setParser(parser)
      .build();
    const entries = await trace
      .sliceEntries(0, 2)
      .customQuery(CustomQueryType.VSYNCID);
    const values = entries.map((entry) => entry.getValue());
    expect(values).toEqual([89114n, 89115n]);
  });
});
