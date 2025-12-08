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

/** An identifier for a test artifact. */
export declare interface ArtifactIdentifier {
  name: string;
  invocationId: string;
}

/** The request data to be encoded in the URL as a base64 string. */
export declare interface RequestData {
  artifacts: ArtifactIdentifier[];
  testMode?: boolean;
  origin?: string; // For tracking the origin of the request.
  useBetaWinscope?: boolean;
}
