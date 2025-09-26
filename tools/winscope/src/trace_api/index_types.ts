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

/**
 * Represents an index relative to a specific point in a trace or collection of entries.
 * Useful for operations that need to reference positions without knowing the absolute start.
 */
export type RelativeEntryIndex = number;
/**
 * Represents an absolute index within a trace or collection of entries.
 * Provides a global reference point for individual entries.
 */
export type AbsoluteEntryIndex = number;
/**
 * Represents an absolute index within a collection of frames.
 * Provides a global reference point for individual frames.
 */
export type AbsoluteFrameIndex = number;

/**
 * Defines a range of entries, inclusive of `start` and exclusive of `end`.
 * This is useful for specifying a segment of entries to process or display.
 * The range is represented as [start, end).
 */
export interface EntriesRange {
  start: AbsoluteEntryIndex;
  end: AbsoluteEntryIndex;
}

/**
 * Defines a range of frames, inclusive of `start` and exclusive of `end`.
 * This is useful for specifying a segment of frames to process or display.
 * The range is represented as [start, end).
 */
export interface FramesRange {
  start: AbsoluteFrameIndex;
  end: AbsoluteFrameIndex;
}
