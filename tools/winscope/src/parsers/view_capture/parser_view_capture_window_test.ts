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
import {getPerfettoParser} from '@parsers/fixture_utils';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryType} from '@trace_api/custom_query';
import {EntriesRange} from '@trace_api/index_types';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

describe('PerfettoParserViewCaptureWindow', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (
      await getPerfettoParser(
        TraceType.VIEW_CAPTURE,
        'traces/perfetto/viewcapture.perfetto-trace',
      )
    ).parser;
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.VIEW_CAPTURE);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('has expected descriptors', () => {
    expect(parser.getDescriptors()).toEqual([
      'com.android.internal.policy.PhoneWindow@4f9be60',
      'viewcapture.perfetto-trace',
    ]);
  });

  it('provides timestamps', () => {
    const timestamps = parser.getTimestamps();
    expect(timestamps.length).toBe(36);
    const expected = [
      makeRealTimestamp(1716828479973482553n),
      makeRealTimestamp(1716828479982373666n),
      makeRealTimestamp(1716828479986084197n),
    ];
    expect(timestamps.slice(0, 3)).toEqual(expected);
  });

  it('builds trace entry', async () => {
    const root = await parser.getEntry(1);
    expect(root).toBeInstanceOf(HierarchyTreeNode);
    expect(root.id).toBe(
      'com.android.internal.policy.PhoneWindow@4f9be60ViewNode0 com.android.internal.policy.DecorView@203589466',
    );
    expect(root.name).toBe('com.android.internal.policy.DecorView@203589466');
    expect(root.getRects().length).toBe(1);

    const children = root.getAllChildren();
    expect(children.length).toBe(1);
    expect(children[0].name).toBe('android.widget.LinearLayout@160251275');
    expect(children[0].getRects().length).toBe(1);
  });

  it('sets property default values + formatters', async () => {
    const root = await parser.getEntry(1);
    const properties = await root.getAllProperties();
    const defaultProperty = assertDefined(properties.getChildByName('left'));
    expect(defaultProperty.getValue<number>()).toBe(0);
    expect(defaultProperty.formattedValue()).toBe('0');
  });

  it('supports VIEW_CAPTURE_METADATA custom query', async () => {
    const metadata = await parser.customQuery(
      CustomQueryType.VIEW_CAPTURE_METADATA,
      {start: 0, end: parser.getLengthEntries()},
    );
    expect(metadata.packageName).toBe('com.google.android.apps.nexuslauncher');
    expect(metadata.windowName).toBe(
      'com.android.internal.policy.PhoneWindow@4f9be60',
    );
  });

  it('gets a range of entries that excludes the end index', async () => {
    const index = 1;
    const numEntries = 6;
    const range: EntriesRange = {
      start: index,
      end: index + numEntries,
    };
    const entries = await parser.getRangeOfEntries(range);
    expect(entries.length).toEqual(numEntries);
  });

  it('provides eager properties', async () => {
    const entry = await parser.getEntry(0);
    expect(
      entry.getEagerPropertyByName('nodeId')?.getValue()?.toString(),
    ).toEqual('0');
    expect(
      entry.getEagerPropertyByName('className')?.getValue<string>(),
    ).toEqual('com.android.internal.policy.DecorView');
    expect(
      entry.getEagerPropertyByName('hashcode')?.getValue()?.toString(),
    ).toEqual('203589466');
    expect(entry.getEagerPropertyByName('isVisible')?.getValue()).toBeTrue();
    expect(entry.getEagerPropertyByName('viewId')?.getValue<string>()).toEqual(
      'NO_ID',
    );
  });
});
