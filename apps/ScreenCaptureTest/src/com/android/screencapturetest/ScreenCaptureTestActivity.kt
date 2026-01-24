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

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.ActivityResult
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.android.screencapturetest.domain.ShareScreenTestContract
import com.android.screencapturetest.domain.interactor.AppContentProjectionInteractor
import com.android.screencapturetest.ui.composable.ScreenCaptureTestMainScreen

/** Main activity for the app to test Screen Capture. */
class ScreenCaptureTestActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val shareScreenTestLauncher =
            registerForActivityResult(
                contract = ShareScreenTestContract(),
                callback = ::onScreenCaptureTestResult,
            )

        setContent {
            Scaffold { innerPadding ->
                Box(modifier = Modifier.padding(innerPadding)) {
                    val scope = rememberCoroutineScope()
                    val appContentProjectionInteractor = remember {
                        AppContentProjectionInteractor(
                            scope = scope,
                            context = this@ScreenCaptureTestActivity,
                        )
                    }

                    ScreenCaptureTestMainScreen(
                        appContentServiceEnabled =
                            appContentProjectionInteractor.appContentProjectionServiceEnabled
                                .collectAsStateWithLifecycle(),
                        includeIconsInAppContent =
                            appContentProjectionInteractor.appContentProjectionServiceIconFrequency
                                .collectAsStateWithLifecycle(),
                        onScreenShareTest = { shareScreenTestLauncher.launch(it) },
                        onSetAppContentServiceEnabled = {
                            appContentProjectionInteractor.setAppContentProjectionServiceEnabled(it)
                        },
                        onSetIncludeIconsInAppContent = {
                            appContentProjectionInteractor
                                .setAppContentProjectionServiceIconFrequency(it)
                        },
                    )
                }
            }
        }
    }

    private fun onScreenCaptureTestResult(result: ActivityResult) {
        val toastMessage = buildString {
            append("Screen capture test result: ")
            when (result.resultCode) {
                RESULT_OK -> append("OK")
                RESULT_CANCELED -> append("CANCELED")
                else -> append("UNKNOWN")
            }
        }
        Toast.makeText(this, toastMessage, Toast.LENGTH_SHORT).show()
    }
}
