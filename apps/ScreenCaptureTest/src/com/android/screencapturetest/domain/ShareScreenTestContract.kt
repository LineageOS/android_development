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

package com.android.screencapturetest.domain

import android.content.Context
import android.content.Context.MEDIA_PROJECTION_SERVICE
import android.content.Intent
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.widget.Toast
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContract
import com.android.screencapturetest.domain.model.MediaProjectionSource
import com.android.screencapturetest.domain.model.ScreenCaptureConfig

/** [ActivityResultContract] for sharing the screen. */
class ShareScreenTestContract : ActivityResultContract<ScreenCaptureConfig, ActivityResult>() {

    override fun createIntent(context: Context, input: ScreenCaptureConfig): Intent {
        val mediaProjectionManager =
            context.getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        return mediaProjectionManager.createScreenCaptureIntent(
            MediaProjectionConfig.Builder()
                .setSourceEnabled(MediaProjectionSource.FULLSCREEN.value, input.allowFullscreen)
                .setSourceEnabled(MediaProjectionSource.APP.value, input.allowApp)
                .setSourceEnabled(MediaProjectionSource.APP_CONTENT.value, input.allowAppContent)
                .setSourceEnabled(MediaProjectionSource.REGION.value, input.allowRegion)
                .setAudioRequested(input.allowAudio)
                .setOwnAppContentProvided(input.ownAppContentProvided)
                .apply {
                    if (input.initialSource != MediaProjectionSource.UNSPECIFIED) {
                        try {
                            setInitiallySelectedSource(input.initialSource.value)
                        } catch (_: IllegalArgumentException) {
                            Toast.makeText(context, "Invalid initial source", Toast.LENGTH_SHORT)
                                .show()
                        }
                    }
                }
                .build()
        )
    }

    override fun parseResult(resultCode: Int, intent: Intent?): ActivityResult =
        ActivityResult(resultCode, intent)
}
