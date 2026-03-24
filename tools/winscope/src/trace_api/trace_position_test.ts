/*
 * Copyright (C) 2025 The Android Open Source Project
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
import {Timestamp, TimestampFormatter} from '@common/time/time';
import {TraceBuilder} from '@trace_api/testing/trace_builder';

import {FramesRange} from './index_types';
import {TraceEntry} from './trace';
import {TracePosition} from './trace_position';
import {TraceType} from './trace_type';

class MockTimestampFormatter implements TimestampFormatter {
  format(timestamp: bigint): string {
    return `MockFormat(${timestamp})`;
  }
}

describe('TracePosition', () => {
  const mockFormatter = new MockTimestampFormatter();
  const timestamp1 = new Timestamp(100n, mockFormatter);
  const timestamp2 = new Timestamp(200n, mockFormatter);
  const mockSfTraceTwoEntries = new TraceBuilder<string>()
    .setType(TraceType.SURFACE_FLINGER)
    .setEntries(['entry-0', 'entry-1'])
    .setTimestamps([timestamp1, timestamp1])
    .build();

  it('fromTimestamp creates a TracePosition with only timestamp', () => {
    const position = TracePosition.fromTimestamp(timestamp1);
    expect(position.timestamp).toEqual(timestamp1);
    expect(position.frame).toBeUndefined();
    expect(position.entry).toBeUndefined();
  });

  describe('fromTraceEntry', () => {
    it('creates a TracePosition from an entry without frame info', () => {
      const entry = getMockTraceEntry(0);
      const position = TracePosition.fromTraceEntry(entry);
      expect(position.timestamp).toEqual(timestamp1);
      expect(position.frame).toBeUndefined();
      expect(position.entry).toEqual(entry);
    });

    it('creates a TracePosition from an entry with frame info', () => {
      const entry = getMockTraceEntry(0, {start: 2, end: 3});
      const position = TracePosition.fromTraceEntry(entry);
      expect(position.timestamp).toEqual(timestamp1);
      expect(position.frame).toBe(2);
      expect(position.entry).toEqual(entry);
    });

    it('creates a TracePosition from an entry with frame info but empty range', () => {
      const entry = getMockTraceEntry(1, {start: 2, end: 2});
      const position = TracePosition.fromTraceEntry(entry);
      expect(position.timestamp).toEqual(timestamp1);
      expect(position.frame).toBeUndefined();
      expect(position.entry).toEqual(entry);
    });

    it('uses explicit timestamp if provided', () => {
      const entry = getMockTraceEntry(1, {start: 2, end: 3});
      const position = TracePosition.fromTraceEntry(entry, timestamp2);
      expect(position.timestamp).toEqual(timestamp2);
      expect(position.frame).toBe(2);
      expect(position.entry).toEqual(entry);
    });

    function getMockTraceEntry(
      index: number,
      frames?: FramesRange,
    ): TraceEntry<unknown> {
      const entry = mockSfTraceTwoEntries.getEntry(index);
      if (frames !== undefined) {
        spyOn(mockSfTraceTwoEntries, 'hasFrameInfo').and.returnValue(true);
        spyOn(entry, 'getFramesRange').and.returnValue(frames);
      }
      return entry;
    }
  });

  describe('isEqual', () => {
    const mockWmTraceOneEntry = new TraceBuilder<string>()
      .setType(TraceType.WINDOW_MANAGER)
      .setEntries(['entry-0'])
      .setTimestamps([timestamp1])
      .build();

    it('returns true for positions with the same timestamp, frame, and entry', () => {
      const entry1 = mockWmTraceOneEntry.getEntry(0);
      const position1 = TracePosition.fromTraceEntry(entry1);
      const position2 = TracePosition.fromTraceEntry(entry1);
      expect(position1.isEqual(position2)).toBeTrue();
    });

    it('returns false for positions with different timestamps', () => {
      const position1 = TracePosition.fromTimestamp(timestamp1);
      const position2 = TracePosition.fromTimestamp(timestamp2);
      expect(position1.isEqual(position2)).toBeFalse();
    });

    it('returns false for positions with different frames', () => {
      spyOn(mockSfTraceTwoEntries, 'hasFrameInfo').and.returnValue(true);
      const entry1 = mockSfTraceTwoEntries.getEntry(0);
      spyOn(entry1, 'getFramesRange').and.returnValue({start: 1, end: 2});
      const entry2 = mockSfTraceTwoEntries.getEntry(1);
      spyOn(entry2, 'getIndex').and.returnValue(0);
      spyOn(entry2, 'getFramesRange').and.returnValue({start: 2, end: 3});
      const position1 = TracePosition.fromTraceEntry(entry1);
      const position2 = TracePosition.fromTraceEntry(entry2);
      expect(position1.isEqual(position2)).toBeFalse();
    });

    it('returns false for positions with different trace types', () => {
      const entry1 = mockSfTraceTwoEntries.getEntry(0);
      const entry2 = mockWmTraceOneEntry.getEntry(0);
      const position1 = TracePosition.fromTraceEntry(entry1);
      const position2 = TracePosition.fromTraceEntry(entry2);
      expect(position1.isEqual(position2)).toBeFalse();
    });

    it('returns false for positions with different entry indices', () => {
      const entry1 = mockSfTraceTwoEntries.getEntry(0);
      const entry2 = mockSfTraceTwoEntries.getEntry(1);
      const position1 = TracePosition.fromTraceEntry(entry1);
      const position2 = TracePosition.fromTraceEntry(entry2);
      expect(position1.isEqual(position2)).toBeFalse();
    });

    it('returns false when one position has an entry and the other does not', () => {
      const entry1 = mockWmTraceOneEntry.getEntry(0);
      const position1 = TracePosition.fromTraceEntry(entry1);
      const position2 = TracePosition.fromTimestamp(timestamp1);
      expect(position1.isEqual(position2)).toBeFalse();
      expect(position2.isEqual(position1)).toBeFalse();
    });
  });
});
