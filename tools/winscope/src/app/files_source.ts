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
 * The source of the files loaded into Winscope.
 */
export enum FilesSource {
  /**
   * Files loaded from a test.
   */
  TEST = 'test',

  /**
   * Files collected via the "Collect traces" feature.
   */
  COLLECTED = 'collected_traces',

  /**
   * Files uploaded by the user.
   */
  UPLOADED = 'uploaded_traces',

  /**
   * Files loaded from a remote tool (e.g. Buganizer).
   */
  REMOTE_TOOL = 'remote',

  /**
   * Files loaded from the app itself (e.g. legacy traces converted to Perfetto).
   */
  APP = 'app',
}
