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
import {TraceSearchQueryFailed} from 'messaging/user_warnings';
import {ParserSurfaceFlinger} from 'parsers/surface_flinger/perfetto/parser_surface_flinger';
import {getPerfettoParser} from 'test/unit/fixture_utils';
import {UserNotifierChecker} from 'test/unit/user_notifier_checker';
import {
  getTimestampConverter,
  makeElapsedTimestamp,
  makeZeroTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {CoarseVersion} from 'trace_api/coarse_version';
import {TraceType} from 'trace_api/trace_type';
import {ParserSearch} from './parser_search';

describe('ParserSearch', () => {
  let userNotifierChecker: UserNotifierChecker;
  let parser: ParserSearch;

  beforeAll(() => {
    userNotifierChecker = new UserNotifierChecker();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
  });

  afterEach(() => {
    userNotifierChecker.reset();
  });

  describe('valid query with timestamps', () => {
    beforeAll(async () => {
      parser = await createParser(
        'SELECT * FROM surfaceflinger_layers_snapshot',
      );
    });

    afterEach(() => {
      userNotifierChecker.expectNone();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.SEARCH);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
    });

    it('has expected descriptors', () => {
      expect(parser.getDescriptors()).toEqual([
        'SELECT * FROM surfaceflinger_layers_snapshot',
      ]);
    });

    it('has length entries equal to number of rows', () => {
      expect(parser.getLengthEntries()).toBe(21);
    });

    it('provides timestamps', () => {
      const expected = [
        makeElapsedTimestamp(14500282843n),
        makeElapsedTimestamp(14631249355n),
        makeElapsedTimestamp(15403446377n),
      ];
      const actual = assertDefined(parser.getTimestamps()).slice(0, 3);
      expect(actual).toEqual(expected);
      userNotifierChecker.expectNone();
    });

    it('provides query result', async () => {
      const entry = await parser.getEntry(0);
      expect(entry.numRows()).toBe(21);
      const firstRow = entry.iter({});
      expect(firstRow.get('id')).toBe(0n);
      expect(firstRow.get('ts')).toBe(14500282843n);
    });
  });

  describe('valid query without timestamps', () => {
    beforeAll(async () => {
      parser = await createParser('SELECT * FROM surfaceflinger_layer');
      userNotifierChecker.expectNone();
    });

    afterEach(() => {
      userNotifierChecker.expectNone();
    });

    it('has length entries equal to 1 so query result can be accessed', () => {
      expect(parser.getLengthEntries()).toBe(1);
    });

    it('provides one invalid timestamp so query result can be accessed', () => {
      expect(parser.getTimestamps()).toEqual([makeZeroTimestamp()]);
    });

    it('provides query result', async () => {
      const entry = await parser.getEntry(0);
      expect(entry.numRows()).toBe(1815);
      const firstRow = entry.iter({});
      expect(firstRow.get('id')).toBe(0n);
      expect(firstRow.get('snapshot_id')).toBe(0n);
      expect(firstRow.get('layer_id')).toBe(3n);
    });
  });

  describe('valid query without rows', () => {
    beforeAll(async () => {
      parser = await createParser('SELECT * FROM surfaceflinger_transactions');
    });

    afterEach(() => {
      userNotifierChecker.expectNone();
    });

    it('has length entries equal to 1 so query result can be accessed', () => {
      expect(parser.getLengthEntries()).toBe(1);
    });

    it('provides one invalid timestamp so query result can be accessed', () => {
      expect(parser.getTimestamps()).toEqual([makeZeroTimestamp()]);
    });

    it('provides query result', async () => {
      const entry = await parser.getEntry(0);
      expect(entry.columns()).toEqual([
        'id',
        'ts',
        'arg_set_id',
        'base64_proto_id',
        'vsync_id',
      ]);
      expect(entry.numRows()).toBe(0);
    });
  });

  it('notifies user of parsing error before throwing error', async () => {
    const createFailingParser = () => createParser('SELECT * FROM fake_table');
    await expectAsync(createFailingParser()).toBeRejected();
    userNotifierChecker.reset();
    try {
      parser = await createFailingParser();
    } catch (e) {
      userNotifierChecker.expectNotified([
        new TraceSearchQueryFailed((e as Error).message),
      ]);
    }
  });

  async function createParser(query: string): Promise<ParserSearch> {
    await (
      (await getPerfettoParser(
        TraceType.SURFACE_FLINGER,
        'traces/perfetto/layers_trace.perfetto-trace',
      )) as ParserSurfaceFlinger
    ).parse();
    parser = new ParserSearch(query, getTimestampConverter());
    await parser.parse();
    return parser;
  }
});
