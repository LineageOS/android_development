/*
 * Copyright 2026 The Android Open Source Project
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

package com.android.screencapturetest.shared

/** Enum for frequency of events. */
enum class Frequency(val ratio: Float, val label: String) {
    /** Event should always occur. */
    ALWAYS(1f, "Always"),
    /** Event should never occur. */
    NEVER(0f, "Never"),
    /** Event should occur randomly, approximately half of the time. */
    HALF(0.5f, "Random 50%");

    override fun toString(): String = label
}
