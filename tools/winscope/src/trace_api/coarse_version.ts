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
 * Represents a coarse version of a trace format.
 *
 * This is used to distinguish between major versions of trace formats
 * that might require different parsing or handling logic.
 */
export enum CoarseVersion {
  /** Represents an older, potentially deprecated, version of the trace format. */
  LEGACY,
  /** Represents the latest supported version of the trace format. */
  LATEST,
  /** Represents a mock version, likely used for testing. */
  MOCK,
}
