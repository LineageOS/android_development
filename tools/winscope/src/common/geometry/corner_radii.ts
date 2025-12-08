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
 * Represents the corner radii of a rectangle.
 */
export class CornerRadii {
  constructor(
    public tl: number,
    public tr: number,
    public bl: number,
    public br: number,
  ) {}

  isEmpty() {
    return this.tl === 0 && this.tr === 0 && this.bl === 0 && this.br === 0;
  }

  isEqual(other: CornerRadii) {
    return (
      this.tl === other.tl &&
      this.tr === other.tr &&
      this.bl === other.bl &&
      this.br === other.br
    );
  }
}
