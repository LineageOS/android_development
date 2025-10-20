/*
 * Copyright (C) 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {trySanitizeUrl} from 'compat/safevalues';
import {windowOpen} from 'compat/safevalues/dom';

/**
 * Opens a popup window with the specified URL.
 *
 * @param url The URL to open in the popup window.
 * @return True if the popup was opened successfully, false otherwise.
 */
export function showPopupWindow(url: string): boolean {
  const sanitizedUrl = trySanitizeUrl(url);
  if (sanitizedUrl === undefined) {
    return false;
  }
  const popup = windowOpen(
    window,
    sanitizedUrl,
    '_blank',
    'width=500,height=500,scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no',
  );
  if (popup === null) {
    return false;
  }
  return true;
}

/**
 * Returns the root URL of the current page.
 *
 * @return The root URL.
 */
export function getRootUrl(): string {
  const fullUrl = window.location.href;
  const posLastSlash = fullUrl.lastIndexOf('/');
  return fullUrl.slice(0, posLastSlash + 1);
}
