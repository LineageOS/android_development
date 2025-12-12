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
import {EntriesRange} from 'trace_api/index_types';
import {Parser} from 'trace_api/parser';
import {Trace} from 'trace_api/trace';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('PerfettoParserWindowManager', () => {
  let parser: Parser<HierarchyTreeNode>;
  let trace: Trace<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (await getPerfettoParser(
      TraceType.WINDOW_MANAGER,
      'traces/perfetto/windowmanager.perfetto-trace',
    )) as Parser<HierarchyTreeNode>;
    trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.WINDOW_MANAGER)
      .setParser(parser)
      .build();
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('provides timestamps', () => {
    const expected = [
      makeRealTimestamp(1719409456335086006n),
      makeRealTimestamp(1719409456922787137n),
      makeRealTimestamp(1719409456929933622n),
    ];
    expect(assertDefined(parser.getTimestamps()).slice(0, 3)).toEqual(expected);
  });

  it('retrieves trace entry', async () => {
    const entry = await parser.getEntry(1);
    expect(entry).toBeInstanceOf(HierarchyTreeNode);
    expect(entry.id).toBe('WindowManagerState root');
  });

  it('gets a range of entries that excludes the end index', async () => {
    const index = 1;
    const amountOfTrees = 6;
    const range: EntriesRange = {
      start: index,
      end: index + amountOfTrees,
    };
    const entries = await parser.getRangeOfEntries(range);
    expect(entries.length).toEqual(amountOfTrees);
  });

  it('provides eager properties', async () => {
    const entry = await parser.getEntry(0);
    const title =
      'com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity';
    const state = assertDefined(
      entry.findDfs((node) => node.name.includes(title)),
    );
    expect(state.getEagerPropertyByName('token')?.getValue()).toBe(160447612);
    expect(state.getEagerPropertyByName('title')?.getValue()).toBe(title);
    expect(state.getEagerPropertyByName('containerType')?.getValue()).toBe(
      'WindowState',
    );
    expect(state.getEagerPropertyByName('isVisible')?.getValue()).toBeTrue();
    expect(state.getEagerPropertyByName('parentToken')?.getValue()).toBe(
      193718205,
    );

    const task = assertDefined(
      state
        .getParent()
        ?.getParent()
        ?.getParent()
        ?.getParent()
        ?.getAllChildren()[0],
    );
    expect(task.name).toBe('2');
    expect(task.getEagerPropertyByName('isVisible')?.getValue()).toBeFalse();
    expect(task.getEagerPropertyByName('containerType')?.getValue()).toBe(
      'Task',
    );
  });

  it('provides rects', async () => {
    const entry = await parser.getEntry(0);
    const displays = entry
      .getAllChildren()
      .flatMap((node) => assertDefined(node.getRects()));
    expect(displays.length).toBe(1);
    expect(displays[0].isDisplay).toBeTrue();

    const state = assertDefined(
      entry.findDfs((node) => node.name === 'EdgeBackGestureHandler0'),
    );
    const rect = assertDefined(state.getRects()[0]);
    expect(rect.isDisplay).toBeFalse();
    expect(rect.w).toBe(276);
    expect(rect.h).toBe(704);
    expect(rect.isVisible).toBeFalse();
  });

  it('supports WM_WINDOWS_TOKEN_AND_TITLE custom query', async () => {
    const tokenAndTitles = await trace
      .sliceEntries(0, 1)
      .customQuery(CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE);
    expect(tokenAndTitles.length).toBe(70);
    expect(tokenAndTitles).toContain({token: 141511715, title: 'Leaf:36:36'});
  });
});
