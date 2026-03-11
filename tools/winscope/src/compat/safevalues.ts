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
 *
 * @param url Function to sanitize a URL, does nothing in AOSP.
 *
 * Used for compatibility only.
 *
 * @return the url
 */
export function trySanitizeUrl(url: string): string | undefined {
  if (!url) {
    return undefined;
  }

  return url;
}

/**
 * Creates an object URL from a Blob.
 *
 * Used for compatibility only.
 *
 * @param source The Blob to create an object URL from.
 * @return The object URL.
 */
export function objectUrlFromSafeSource(source: Blob): string {
  return URL.createObjectURL(source);
}

/**
 * Creates a {@link TrustedResourceUrl} from a string.
 *
 * Used for compatibility only.
 */
export function trustedResourceUrl(url: string): string {
  return url;
}
