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
import {assertDefined} from '@common/assert';
import {makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {Timestamp} from '@common/time/time';
import {setupJspbTesting} from '@compat/test/protobuf';
import {getPerfettoParser} from '@parsers/fixture_utils';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryType} from '@trace_api/custom_query';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

describe('PerfettoParserMotionEvent', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    setupJspbTesting();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (
      await getPerfettoParser(
        TraceType.INPUT_MOTION_EVENT,
        'traces/perfetto/input-events.perfetto-trace',
      )
    ).parser;
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.INPUT_MOTION_EVENT);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('provides timestamps', () => {
    const timestamps = parser.getTimestamps();

    expect(timestamps.length).toBe(6);

    const expected = [
      makeRealTimestamp(1718386903800330430n),
      makeRealTimestamp(1718386903800330430n),
      makeRealTimestamp(1718386903821511338n),
      makeRealTimestamp(1718386903827304592n),
      makeRealTimestamp(1718386903836681382n),
      makeRealTimestamp(1718386903841727281n),
    ];
    expect(timestamps).toEqual(expected);
  });

  it('retrieves all entries', async () => {
    const entries = await parser.getAllEntries();
    expect(entries.length).toBe(6);
    expect(entries.every((entry) => entry !== undefined)).toBeTrue();
  });

  it('retrieves trace entry from timestamp', async () => {
    const entry = await parser.getEntry(1);
    expect(entry.id).toBe('AndroidMotionEvent entry');
  });

  it('retrieves and translates eager property values', async () => {
    const entry = await parser.getEntry(0);

    expect(
      entry.getEagerPropertyByName('eventId')?.getValue()?.toString(),
    ).toEqual('330184796');
    expect(entry.getEagerPropertyByName('action')?.formattedValue()).toBe(
      'ACTION_DOWN',
    );
    expect(entry.getEagerPropertyByName('source')?.formattedValue()).toBe(
      'SOURCE_TOUCHSCREEN',
    );
    expect(entry.getEagerPropertyByName('deviceId')?.formattedValue()).toBe(
      '4',
    );
    expect(entry.getEagerPropertyByName('displayId')?.formattedValue()).toBe(
      '0',
    );
  });

  it('transforms fake motion event proto built from trace processor args', async () => {
    const entry = await parser.getEntry(0);

    const properties = await entry.getAllProperties();
    const motionEvent = assertDefined(properties.getChildByName('event'));

    expect(motionEvent.getChildByName('flags')?.formattedValue()).toBe(
      'FLAG_SUPPORTS_ORIENTATION',
    );
    expect(motionEvent.getChildByName('action')?.formattedValue()).toBe(
      'ACTION_DOWN',
    );
    expect(motionEvent.getChildByName('source')?.formattedValue()).toBe(
      'SOURCE_TOUCHSCREEN',
    );
    expect(motionEvent.getChildByName('deviceId')?.getValue<number>()).toBe(4);
    expect(motionEvent.getChildByName('displayId')?.getValue<number>()).toBe(0);
    expect(motionEvent.getChildByName('classification')?.formattedValue()).toBe(
      'CLASSIFICATION_NONE',
    );
    expect(
      motionEvent.getChildByName('cursorPositionX')?.formattedValue(),
    ).toBe('0');
    expect(
      motionEvent.getChildByName('cursorPositionY')?.formattedValue(),
    ).toBe('0');
    expect(motionEvent.getChildByName('metaState')?.formattedValue()).toBe(
      '0x0',
    );

    const firstPointer = motionEvent
      ?.getChildByName('pointer')
      ?.getChildByName('0');

    expect(firstPointer?.getChildByName('pointerId')?.getValue<number>()).toBe(
      0,
    );

    expect(firstPointer?.getChildByName('toolType')?.formattedValue()).toBe(
      'TOOL_TYPE_FINGER',
    );

    expect(
      firstPointer
        ?.getChildByName('axisValue')
        ?.getChildByName('0')
        ?.getChildByName('axis')
        ?.formattedValue(),
    ).toBe('AXIS_X');

    expect(
      firstPointer
        ?.getChildByName('axisValue')
        ?.getChildByName('0')
        ?.getChildByName('value')
        ?.getValue<number>(),
    ).toBe(431);

    expect(
      firstPointer
        ?.getChildByName('axisValue')
        ?.getChildByName('1')
        ?.getChildByName('axis')
        ?.formattedValue(),
    ).toBe('AXIS_Y');

    expect(
      firstPointer
        ?.getChildByName('axisValue')
        ?.getChildByName('1')
        ?.getChildByName('value')
        ?.getValue<number>(),
    ).toBe(624);
  });

  it('transforms nanosecond fields into timestamps', async () => {
    const entry = await parser.getEntry(0);

    const properties = await entry.getAllProperties();
    const motionEvent = assertDefined(properties.getChildByName('event'));

    expect(
      motionEvent.getChildByName('kernelTime')?.getValue<Timestamp>(),
    ).toEqual(makeRealTimestamp(1718386903791203081n));
    expect(
      motionEvent.getChildByName('downTime')?.getValue<Timestamp>(),
    ).toEqual(makeRealTimestamp(1718386903791203081n));
  });

  it('renames eventTimeNanos to kernelTimeNanos', async () => {
    const entry = await parser.getEntry(0);

    const properties = await entry.getAllProperties();
    const motionEvent = assertDefined(properties.getChildByName('event'));

    expect(motionEvent.getChildByName('eventTimeNanos')).toBeUndefined();
    expect(
      motionEvent.getChildByName('kernelTimeNanos')?.getValue()?.toString(),
    ).toEqual('517481507875000');
  });

  it('merges motion event with all associated dispatch events', async () => {
    const entry = await parser.getEntry(0);
    const properties = await entry.getAllProperties();

    const windowDispatchEvents = assertDefined(
      properties.getChildByName('dispatchEvents'),
    );

    expect(windowDispatchEvents?.getAllChildren().length).toBe(5);
    expect(
      windowDispatchEvents
        ?.getChildByName('0')
        ?.getChildByName('windowId')
        ?.getValue<number>(),
    ).toBe(212);
    expect(
      windowDispatchEvents
        ?.getChildByName('1')
        ?.getChildByName('windowId')
        ?.getValue<number>(),
    ).toBe(64);
    expect(
      windowDispatchEvents
        ?.getChildByName('2')
        ?.getChildByName('windowId')
        ?.getValue<number>(),
    ).toBe(82);
    expect(
      windowDispatchEvents
        ?.getChildByName('3')
        ?.getChildByName('windowId')
        ?.getValue<number>(),
    ).toBe(75);
    expect(
      windowDispatchEvents
        ?.getChildByName('4')
        ?.getChildByName('windowId')
        ?.getValue<number>(),
    ).toBe(0);
  });

  it('supports VSYNCID custom query', async () => {
    const entries = await parser.customQuery(CustomQueryType.VSYNCID, {
      start: 1,
      end: 4,
    });
    expect(entries).toEqual([89110n, 89111n, 89112n]);
  });
});
