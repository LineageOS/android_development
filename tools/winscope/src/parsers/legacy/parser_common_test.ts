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
import {getFixtureFile} from 'test/unit/io_helpers';
import {
  timestampEqualityTester,
  UTC_CONVERTER,
} from 'test/unit/time_test_helpers';
import {TraceFile} from 'trace/trace_file';
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
});
