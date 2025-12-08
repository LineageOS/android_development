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
import {assertDefined} from 'common/assert';
import {getFixtureFile} from 'test/unit/io_helpers';
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {
  makeElapsedTimestamp,
  makeRealTimestamp,
  timestampEqualityTester,
  UTC_CONVERTER,
} from 'test/unit/time_test_helpers';
import {TraceFile} from 'trace/trace_file';
import {Parser} from 'trace_api/parser';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {ParserFactory} from './parser_factory';

describe('Parser', () => {
  beforeAll(() => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
  });

  describe('is robust to', () => {
    it('empty trace file', async () => {
      await checkRobustToFile('invalid_files/empty.pb', true);
    });

    it('trace with no entries', async () => {
      await checkRobustToFile('invalid_files/no_entries_InputMethodClients.pb');
    });

    it('view capture trace with no entries', async () => {
      await checkRobustToFile('invalid_files/no_entries_view_capture.vc');
    });

    async function checkRobustToFile(file: string, unsupported = false) {
      const trace = new TraceFile(await getFixtureFile(file), undefined);
      const processed = await new ParserFactory().processFiles(
        [trace],
        UTC_CONVERTER,
        {},
      );
      expect(processed.parsers.length).toBe(0);
      expect(processed.unsupportedFiles).toEqual(unsupported ? [trace] : []);
    }
  });

  describe('real timestamp', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_and_real_timestamp/WindowManager.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected descriptors', () => {
      expect(parser.getDescriptors()).toEqual(['WindowManager.pb']);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1659107089075566202n),
        makeRealTimestamp(1659107089999048990n),
        makeRealTimestamp(1659107090010194213n),
      ];
      expect(assertDefined(parser.getTimestamps()).slice(0, 3)).toEqual(
        expected,
      );
    });

    it('retrieves trace entries', async () => {
      let entry = await parser.getEntry(0);
      expect(
        assertDefined(entry.getEagerPropertyByName('focusedApp')).getValue(),
      ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');

      entry = await parser.getEntry(parser.getLengthEntries() - 1);
      expect(
        assertDefined(entry.getEagerPropertyByName('focusedApp')).getValue(),
      ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');
    });
  });

  describe('elapsed timestamp', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_timestamp/WindowManager.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('provides timestamps', () => {
      const expected = [
        makeElapsedTimestamp(850254319343n),
        makeElapsedTimestamp(850763506110n),
        makeElapsedTimestamp(850782750048n),
      ];
      expect(parser.getTimestamps()).toEqual(expected);
    });

    it('retrieves trace entries', async () => {
      let entry = await parser.getEntry(0);
      expect(
        assertDefined(entry.getEagerPropertyByName('focusedApp')).getValue(),
      ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');

      entry = await parser.getEntry(parser.getLengthEntries() - 1);
      expect(
        assertDefined(entry.getEagerPropertyByName('focusedApp')).getValue(),
      ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');
    });
  });
});
