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

package com.android.screencapturetest

import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.Icon
import android.media.projection.AppContentProjectionService
import android.media.projection.AppContentProjectionSession
import android.media.projection.AppContentRequest
import android.media.projection.MediaProjectionAppContent
import android.widget.Toast
import com.android.screencapturetest.data.repository.SettingsRepository
import com.android.screencapturetest.shared.Frequency
import java.io.IOException
import java.io.InputStream
import kotlin.random.Random
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/** Service for generating test app content. */
class ScreenCaptureAppContentProjectionService : AppContentProjectionService() {

    private var scope: CoroutineScope? = null
    private lateinit var sharedPreferences: SharedPreferences

    override fun onCreate() {
        super.onCreate()
        showToast("onCreate")
        scope = CoroutineScope(Dispatchers.Main)

        sharedPreferences = getSharedPreferences("settings", MODE_PRIVATE)
    }

    override fun onDestroy() {
        scope?.cancel()
        scope = null
        super.onDestroy()
    }

    override fun onContentRequest(request: AppContentRequest) {
        if (sharedPreferences.getBoolean(SettingsRepository.GENERATE_APP_CONTENT_KEY, false)) {
            showToast("onContentRequest")

            val iconFrequencyName =
                sharedPreferences.getString(
                    SettingsRepository.INCLUDE_ICONS_IN_APP_CONTENT_KEY,
                    Frequency.ALWAYS.name,
                )
            val iconFrequency = Frequency.valueOf(iconFrequencyName!!)

            val content =
                (1..8).mapNotNull { i ->
                    val bitmap = loadBitmapFromAssets("img$i.jpg") ?: return@mapNotNull null
                    val makeIcon = iconFrequency.ratio > Random.nextFloat()
                    val builder =
                        MediaProjectionAppContent.Builder(i)
                            .setTitle("Content$i")
                            .setThumbnail(bitmap)
                    if (makeIcon) {
                        builder.setIcon(Icon.createWithResource(this, R.drawable.launcher_icon))
                    }
                    builder.build()
                }
            request.provideContent(content)
        } else {
            request.provideContent(emptyList())
        }
    }

    override fun onLoopbackProjectionStarted(
        session: AppContentProjectionSession,
        contentId: Int,
    ): Boolean {
        showToast("onLoopbackProjectionStarted")
        return true
    }

    override fun onSessionStopped(session: AppContentProjectionSession) {
        showToast("onSessionStopped")
    }

    override fun onContentRequestCanceled() {
        showToast("onContentRequestCanceled")
    }

    private fun loadBitmapFromAssets(fileName: String): Bitmap? {
        var inputStream: InputStream? = null
        try {
            inputStream = assets.open(fileName)
            return BitmapFactory.decodeStream(inputStream)
        } catch (_: IOException) {
            showToast("Error loading image")
        } finally {
            try {
                inputStream?.close()
            } catch (_: IOException) {
                showToast("Error closing stream")
            }
        }
        return null
    }

    private fun showToast(message: String) {
        scope?.launch {
            Toast.makeText(
                    this@ScreenCaptureAppContentProjectionService,
                    message,
                    Toast.LENGTH_SHORT,
                )
                .show()
        }
    }
}
