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
import {CoarseVersion} from 'trace_api/coarse_version';
import {CustomQueryType} from 'trace_api/custom_query';
import {Parser} from 'trace_api/parser';
import {Trace} from 'trace_api/trace';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('PerfettoParserViewCaptureWindow', () => {
  let parser: Parser<HierarchyTreeNode>;
  let trace: Trace<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (await getPerfettoParser(
      TraceType.VIEW_CAPTURE,
      'traces/perfetto/viewcapture.perfetto-trace',
    )) as Parser<HierarchyTreeNode>;
    trace = Trace.fromParser(parser);
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
    expect(assertDefined(parser.getTimestamps()).length).toBe(36);

    const expected = [
      makeRealTimestamp(1716828479973482553n),
      makeRealTimestamp(1716828479982373666n),
      makeRealTimestamp(1716828479986084197n),
    ];
    expect(assertDefined(parser.getTimestamps()).slice(0, 3)).toEqual(expected);
  });

  it('builds trace entry', async () => {
    const root = await parser.getEntry(1);
    expect(root).toBeInstanceOf(HierarchyTreeNode);
    expect(root.name).toBe('com.android.internal.policy.DecorView@203589466');
    expect(root.getRects()?.length).toBe(1);

    const children = root.getAllChildren();
    expect(children.length).toBe(1);
    expect(children[0].name).toBe('android.widget.LinearLayout@160251275');
    expect(children[0].getRects()?.length).toBe(1);
  });

  it('sets property default values + formatters', async () => {
    const root = await parser.getEntry(1);
    const properties = await root.getAllProperties();
    const defaultProperty = assertDefined(properties.getChildByName('left'));
    expect(defaultProperty.getValue()).toBe(0);
    expect(defaultProperty.formattedValue()).toBe('0');
  });

  it('supports VIEW_CAPTURE_METADATA custom query', async () => {
    const metadata = await trace.customQuery(
      CustomQueryType.VIEW_CAPTURE_METADATA,
    );
    expect(metadata.packageName).toBe('com.google.android.apps.nexuslauncher');
    expect(metadata.windowName).toBe(
      'com.android.internal.policy.PhoneWindow@4f9be60',
    );
  });
});
