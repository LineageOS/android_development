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

package com.android.screencapturetest.domain.model

import android.media.projection.MediaProjectionConfig

/** Enum for media projection sources. */
enum class MediaProjectionSource(val value: Int, val label: String) {
    /** The value is not specified, no value will be sent. */
    UNSPECIFIED(value = 0, label = "Not specified"),
    /** Single display source. */
    FULLSCREEN(value = MediaProjectionConfig.PROJECTION_SOURCE_DISPLAY, label = "Fullscreen"),
    /** Single app source. */
    APP(value = MediaProjectionConfig.PROJECTION_SOURCE_APP, label = "App"),
    /** App content source. */
    APP_CONTENT(value = MediaProjectionConfig.PROJECTION_SOURCE_APP_CONTENT, label = "App content"),
    /** Single display region source. */
    REGION(
        // Build system isn't able to find MediaProjectionConfig.PROJECTION_SOURCE_REGION, so we
        // manually put the value here. It should be removed when the build system is fixed.
        value = 1 shl 2,
        label = "Region",
    );

    override fun toString(): String = label
}
