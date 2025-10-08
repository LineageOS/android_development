/*
 * Copyright (C) 2024 The Android Open Source Project
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
 * Represents special types of windows within the Window Manager trace.
 * These types are used to categorize windows that are in a particular state
 * or serve a specific purpose, such as starting, exiting, or waiting for a debugger.
 */
export enum WindowType {
  UNKNOWN = 0,
  STARTING = 1,
  EXITING = 2,
  DEBUGGER = 3,
}

/**
 * Provides string prefixes associated with certain WindowType values.
 * These prefixes are useful for identifying or displaying information
 * about windows of a specific type in the Winscope UI.
 */
export enum WindowTypePrefix {
  STARTING = 'Starting ',
  DEBUGGER = 'Waiting For Debugger: ',
}
