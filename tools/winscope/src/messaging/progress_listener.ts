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
 * An interface for listening to progress updates.
 */
export interface ProgressListener {
  /**
   * Called when the progress of an operation has been updated.
   *
   * @param message A message describing the current progress.
   * @param progressPercentage The progress percentage, or undefined if the progress is indeterminate.
   */
  onProgressUpdate(
    message: string,
    progressPercentage: number | undefined,
  ): void;

  /**
   * Called when an operation has finished.
   *
   * @param success True if the operation was successful, false otherwise.
   */
  onOperationFinished(success: boolean): void;
}
