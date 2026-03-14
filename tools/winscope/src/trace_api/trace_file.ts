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

import {removeDirFromFileName} from '@common/io';

/**
 * Represents a trace file loaded into Winscope.
 *
 * This class wraps a standard `File` object, providing additional context
 * such as whether the file was extracted from a larger archive. It's useful
 * for managing and displaying trace files, especially when multiple traces
 * might originate from a single source (e.g., a bug report zip).
 */
export class TraceFile {
  constructor(
    public file: File,
    public parentArchive?: File,
  ) {}

  getDescriptor(): string {
    let descriptor = removeDirFromFileName(this.file.name);
    if (this.parentArchive?.name) {
      descriptor += ` (${this.parentArchive.name})`;
    }
    return descriptor;
  }
}
