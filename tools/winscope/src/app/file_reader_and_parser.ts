/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {FileReader} from '@trace_api/file_reader';
import {Parser} from '@trace_api/parser';

/**
 * Created by non-perfetto and parser factories, to avoid duplication of methods
 * between the two interfaces where possible, as only some classes in the app
 * package need to be aware that the resulting objects provide both file reader
 * and parser functionality.
 */
export type FileReaderAndParser<T = unknown> = FileReader & Parser<T>;
