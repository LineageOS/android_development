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

import {UserWarning} from 'messaging/user_warning';

/**
 * A warning for a corrupted archive.
 */
export class CorruptedArchive extends UserWarning {
  constructor(private readonly file: File) {
    super();
  }

  getDescriptor(): string {
    return 'corrupted archive';
  }

  getMessage(): string {
    return `${this.file.name}: corrupted archive`;
  }
}
