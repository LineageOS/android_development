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

/**
 * Fixtures directory used for compatibility between AOSP and google3.
 *
 * Necessary because AOSP and google3 have different build systems, library
 * versions, code location, etc. and we need to be able to run tests in both
 * environments.
 *
 */

/**
 * Fixtures directory used for compatibility between AOSP and google3.
 *
 * Necessary because AOSP and google3 have different build systems, library
 * versions, code location, etc. and we need to be able to run tests in both
 * environments.
 *
 */
export const FIXTURES_DIR = location.origin + '/src/test/fixtures/';
