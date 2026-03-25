/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {Rect} from '@common/geometry/rect';
import {Region} from '@common/geometry/region';
import {makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {getPerfettoParser} from '@parsers/fixture_utils';
import {makeWarningDuplicateLayerIds} from '@parsers/helpers/warnings';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryType} from '@trace_api/custom_query';
import {EntriesRange} from '@trace_api/index_types';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {makeIdMatchFilter} from '@tree_node/helpers';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

describe('PerfettoParserSurfaceFlinger', () => {
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(() => {
    userNotifierChecker = new UserNotifierChecker();
  });

  afterEach(() => {
    userNotifierChecker.expectNone();
    userNotifierChecker.reset();
  });

  describe('valid trace', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = (
        await getPerfettoParser(
          TraceType.SURFACE_FLINGER,
          'traces/perfetto/layers_trace.perfetto-trace',
        )
      ).parser;
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.SURFACE_FLINGER);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1659107089102062832n),
        makeRealTimestamp(1659107089233029344n),
        makeRealTimestamp(1659107090005226366n),
      ];
      const actual = parser.getTimestamps().slice(0, 3);
      expect(actual).toEqual(expected);
    });

    it('provides correct root entry node', async () => {
      const entry = await parser.getEntry(1);
      expect(entry.id).toBe('LayerTraceEntry root');
      expect(entry.name).toBe('root');
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
      const leaf = assertDefined(
        entry.findDfs(makeIdMatchFilter('27 Leaf:24:25#27')),
      );
      expect(leaf.getEagerPropertyByName('isVisible')?.getValue()).toBeTrue();
      expect(
        leaf.getEagerPropertyByName('isHiddenByPolicy')?.getValue(),
      ).toBeFalse();
      expect(
        leaf.getEagerPropertyByName('isMissingZParent')?.getValue(),
      ).toBeFalse();
      expect(leaf.getParent()?.name).toBe('WindowedMagnification:0:31#4');

      const task = assertDefined(
        entry.findDfs(makeIdMatchFilter('45 Task=1#45')),
      );
      expect(task.getEagerPropertyByName('isVisible')?.getValue()).toBeFalse();
      expect(
        task.getEagerPropertyByName('isHiddenByPolicy')?.getValue(),
      ).toBeTrue();

      const relZParent = assertDefined(
        entry.findDfs(makeIdMatchFilter('11 ImePlaceholder:13:14#11')),
      );
      const relZChild = assertDefined(
        entry.findDfs(makeIdMatchFilter('12 ImeContainer#12')),
      );
      expect(relZParent.getRelativeChildren()).toEqual([relZChild]);
      expect(relZChild.getZParent()).toEqual(relZParent);
      expect(
        relZChild
          .getEagerPropertyByName('zOrderRelativeOf')
          ?.getValue()
          ?.toString(),
      ).toBe('11');
    });

    it('provides rects', async () => {
      const entry = await parser.getEntry(0);
      const displays = entry.getRects();
      expect(displays?.length).toBe(1);
      expect(displays?.[0].isDisplay).toBeTrue();

      const overlay = assertDefined(
        entry.findDfs(makeIdMatchFilter('60 ScreenDecorOverlay#60')),
      );
      const layerRect = assertDefined(overlay.getRects()[0]);
      expect(layerRect.isDisplay).toBeFalse();
      expect(layerRect.w).toBe(1080);
      expect(layerRect.h).toBe(118);
      expect(layerRect.fillRegion).toBeUndefined();

      const inputRect = assertDefined(overlay.getSecondaryRects()[0]);
      expect(inputRect.isDisplay).toBeFalse();
      expect(inputRect.w).toBe(1080);
      expect(inputRect.h).toBe(118);
      expect(inputRect.fillRegion).toEqual(
        new Region([new Rect(492, 0, 124, 118)]),
      );
    });

    it('decodes layer state flags', async () => {
      const entry = await parser.getEntry(0);
      {
        const layer = assertDefined(
          entry.findDfs(makeIdMatchFilter('27 Leaf:24:25#27')),
        );
        expect(layer.name).toBe('Leaf:24:25#27');

        const props = await layer.getAllProperties();
        expect(
          assertDefined(props.getChildByName('flags')).formattedValue(),
        ).toBe('0');
      }
      {
        const layer = assertDefined(
          entry.findDfs(makeIdMatchFilter('48 Task=4#48')),
        );
        expect(layer.name).toBe('Task=4#48');

        const props = await layer.getAllProperties();
        expect(
          assertDefined(props.getChildByName('flags')).formattedValue(),
        ).toBe('HIDDEN (0x1)');
      }
      {
        const layer = assertDefined(
          entry.findDfs(makeIdMatchFilter('77 Wallpaper BBQ wrapper#77')),
        );
        expect(layer.name).toBe('Wallpaper BBQ wrapper#77');

        const props = await layer.getAllProperties();
        expect(
          assertDefined(props.getChildByName('flags')).formattedValue(),
        ).toBe('ENABLE_BACKPRESSURE (0x100)');
      }
    });

    it('supports VSYNCID custom query', async () => {
      const entries = await parser.customQuery(CustomQueryType.VSYNCID, {
        start: 0,
        end: 3,
      });
      expect(entries).toEqual([4891n, 5235n, 5748n]);
    });

    it('supports SF_LAYERS_ID_AND_NAME custom query', async () => {
      const idAndNames = await parser.customQuery(
        CustomQueryType.SF_LAYERS_ID_AND_NAME,
        {start: 0, end: 1},
      );
      expect(idAndNames).toContain({
        id: 4,
        name: 'WindowedMagnification:0:31#4',
      });
      expect(idAndNames).toContain({id: 5, name: 'HideDisplayCutout:0:14#5'});
    });
  });

  describe('invalid traces', () => {
    it('is robust to duplicated layer ids', async () => {
      const parser = (
        await getPerfettoParser(
          TraceType.SURFACE_FLINGER,
          'traces/perfetto/layers_trace_with_duplicated_ids.perfetto-trace',
        )
      ).parser;
      const entry = await parser.getEntry(0);
      expect(entry.getWarnings()).toEqual([
        makeWarningDuplicateLayerIds([-2147483595]),
      ]);

      const layer = assertDefined(
        entry.findDfs(
          makeIdMatchFilter(
            '-2147483595 Input Consumer recents_animation_input_consumer#408(Mirror)',
          ),
        ),
      );
      expect(layer.name).toEqual(
        'Input Consumer recents_animation_input_consumer#408(Mirror)',
      );
      expect(layer.getAllChildren().length).toBe(0);

      const dupLayer = assertDefined(
        entry.findDfs(
          makeIdMatchFilter(
            '-2147483595 Input Consumer recents_animation_input_consumer#408(Mirror) duplicate(1)',
          ),
        ),
      );
      expect(dupLayer.name).toEqual(
        'Input Consumer recents_animation_input_consumer#408(Mirror) duplicate(1)',
      );
      expect(dupLayer.getAllChildren().length).toBe(0);
    });
  });
});
