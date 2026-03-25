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
import {assertDefined} from '@common/assert';
import {makeConverterNoRteOffsets, makeElapsedTimestamp, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {PerfettoClockSnapshot} from '@compat/protobuf';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {convertToPerfettoTrace, LegacyFileReaderProvider, parseAndConvertToPerfettoTrace,} from '@legacy_file_readers/testing/fixture_utils';
import {makeWarningDuplicateLayerIds} from '@parsers/helpers/warnings';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {CustomQueryType} from '@trace_api/custom_query';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {makeIdMatchFilter} from '@tree_node/helpers';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {FileReaderSurfaceFlinger} from './file_reader_surface_flinger';

describe('FileReaderSurfaceFlinger', () => {
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(() => {
    setupJspbTesting();
    userNotifierChecker = new UserNotifierChecker();
  });

  afterEach(() => {
    userNotifierChecker.expectNone();
    userNotifierChecker.reset();
  });

  describe('trace with real timestamps', () => {
    let readerRealTs: LegacyFileReader;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      readerRealTs = await new LegacyFileReaderProvider([
        FileReaderSurfaceFlinger.createInstance,
      ])
        .addFile('traces/elapsed_and_real_timestamp/SurfaceFlinger.pb')
        .get();
    });

    it('has expected trace type', () => {
      expect(readerRealTs.getTraceType()).toEqual(TraceType.SURFACE_FLINGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1659107089102062832n),
        makeRealTimestamp(1659107089233029344n),
        makeRealTimestamp(1659107090005226366n),
      ];
      expect(readerRealTs.getTimestamps().slice(0, 3)).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = readerRealTs.convertToPerfettoPackets(10);
      expect(packets.length).toBe(21);
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      expect(
        packets[0]
          .getSurfaceflingerLayersSnapshot()
          ?.getLayers()
          ?.getLayersList()?.length,
      ).toBe(83);
      expect(packets[0].getTimestamp()?.toString()).toEqual('14500282843');
      expect(packets[0].getTimestampClockId()).toEqual(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
    });

    describe('converts to valid perfetto trace', () => {
      let perfettoParser: Parser<HierarchyTreeNode>;

      beforeAll(async () => {
        perfettoParser = (
          await convertToPerfettoTrace(
            [readerRealTs],
            makeConverterNoRteOffsets(),
          )
        )[0];
      });

      it('provides timestamps', () => {
        const expected = [
          makeRealTimestamp(1659107089102062832n),
          makeRealTimestamp(1659107089233029344n),
          makeRealTimestamp(1659107090005226366n),
        ];
        expect(perfettoParser.getTimestamps().slice(0, 3)).toEqual(expected);
      });

      it('decodes layer state flags', async () => {
        const entry = await perfettoParser.getEntry(0);
        const layer = assertDefined(
          entry.findDfs(makeIdMatchFilter('48 Task=4#48')),
        );
        expect(layer.name).toBe('Task=4#48');

        const props = await layer.getAllProperties();
        expect(
          assertDefined(props.getChildByName('flags')).formattedValue(),
        ).toBe('HIDDEN (0x1)');
      });

      it('supports VSYNCID custom query', async () => {
        const entries = await perfettoParser.customQuery(
          CustomQueryType.VSYNCID,
          {start: 0, end: 3},
        );
        expect(entries).toEqual([4891n, 5235n, 5748n]);
      });

      it('supports SF_LAYERS_ID_AND_NAME custom query', async () => {
        const idAndNames = await perfettoParser.customQuery(
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

    describe('handles duplicate ids', () => {
      it('is robust to duplicated layer ids', async () => {
        const parser = await parseAndConvertToPerfettoTrace(
          'traces/elapsed_and_real_timestamp/SurfaceFlinger_with_duplicated_ids.pb',
          [FileReaderSurfaceFlinger.createInstance],
        );
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

  describe('trace with only elapsed timestamps', () => {
    let readerElapsedTs: LegacyFileReader;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      readerElapsedTs = await new LegacyFileReaderProvider([
        FileReaderSurfaceFlinger.createInstance,
      ])
        .addFile('traces/elapsed_timestamp/SurfaceFlinger.pb')
        .get();
    });

    it('has expected trace type', () => {
      expect(readerElapsedTs.getTraceType()).toEqual(TraceType.SURFACE_FLINGER);
    });

    it('provides timestamps', () => {
      expect(readerElapsedTs.getTimestamps()[0]).toEqual(
        makeElapsedTimestamp(850335483446n),
      );
    });

    it('converts to valid perfetto packets, without latest offsets', async () => {
      const packets = readerElapsedTs.convertToPerfettoPackets(10);
      expect(packets.length).toBe(3);
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      expect(
        packets[0]
          .getSurfaceflingerLayersSnapshot()
          ?.getLayers()
          ?.getLayersList()?.length,
      ).toBe(94);
      expect(packets[0].getTimestamp()?.toString()).toEqual('850335483446');
      expect(packets[0].getTimestampClockId()).toEqual(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
    });
  });
});
