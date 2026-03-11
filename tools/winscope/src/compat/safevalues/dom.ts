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
 * windowOpen calls {@link Window.open} on the given {@link Window}, given a
 * target {@link Url}.
 *
 * Used for compatibility only.
 */
export function windowOpen(
  win: Window,
  url: string | undefined,
  target?: string,
  features?: string,
): Window | null {
  if (!url) {
    return null;
  }
  return win.open(url, target, features);
}

/**
 * Sets the Href attribute from the given Url.
 *
 * Used for compatibility only.
 */
export function setAnchorHref(
  anchor: HTMLAnchorElement,
  url: string | undefined,
): void {
  if (url !== undefined) {
    anchor.href = url;
  }
}
