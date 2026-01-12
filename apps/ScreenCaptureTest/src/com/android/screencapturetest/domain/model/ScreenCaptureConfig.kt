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

/** Test config for media projection options to send. */
data class ScreenCaptureConfig(
    /**
     * See [android.media.projection.MediaProjectionConfig.Builder.setSourceEnabled] and
     * [android.media.projection.MediaProjectionConfig.PROJECTION_SOURCE_DISPLAY]
     */
    val allowFullscreen: Boolean = true,
    /**
     * See [android.media.projection.MediaProjectionConfig.Builder.setSourceEnabled] and
     * [android.media.projection.MediaProjectionConfig.PROJECTION_SOURCE_APP]
     */
    val allowApp: Boolean = true,
    /**
     * See [android.media.projection.MediaProjectionConfig.Builder.setSourceEnabled] and
     * [android.media.projection.MediaProjectionConfig.PROJECTION_SOURCE_APP_CONTENT]
     */
    val allowAppContent: Boolean = true,
    /**
     * See [android.media.projection.MediaProjectionConfig.Builder.setSourceEnabled] and
     * [android.media.projection.MediaProjectionConfig.PROJECTION_SOURCE_DISPLAY_REGION]
     */
    val allowRegion: Boolean = true,
    /** See [android.media.projection.MediaProjectionConfig.Builder.setInitiallySelectedSource] */
    val initialSource: MediaProjectionSource = MediaProjectionSource.UNSPECIFIED,
    /** See [android.media.projection.MediaProjectionConfig.Builder.setAudioRequested] */
    val allowAudio: Boolean = true,
    /** See [android.media.projection.MediaProjectionConfig.Builder.setOwnAppContentProvided] */
    val ownAppContentProvided: Boolean = true,
)
