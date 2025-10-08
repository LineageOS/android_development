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
 * Represents the different types of transactions that can occur within the system.
 * These transactions describe changes to displays or layers, such as creation,
 * destruction, or property updates. This enum is useful for categorizing and
 * filtering transaction traces in tools like Winscope.
 */
export enum TransactionType {
  DISPLAY_ADDED = 'DISPLAY_ADDED',
  DISPLAY_REMOVED = 'DISPLAY_REMOVED',
  DISPLAY_CHANGED = 'DISPLAY_CHANGED',
  LAYER_ADDED = 'LAYER_ADDED',
  LAYER_DESTROYED = 'LAYER_DESTROYED',
  LAYER_CHANGED = 'LAYER_CHANGED',
  LAYER_HANDLE_DESTROYED = 'LAYER_HANDLE_DESTROYED',
  NO_OP = 'NOOP',
}
