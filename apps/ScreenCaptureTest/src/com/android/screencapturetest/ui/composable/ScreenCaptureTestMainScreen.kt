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

package com.android.screencapturetest.ui.composable

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.ui.Modifier
import com.android.screencapturetest.domain.model.ScreenCaptureConfig
import com.android.screencapturetest.shared.Frequency

/** Main screen for the app to test Screen Capture. */
@Composable
fun ScreenCaptureTestMainScreen(
    appContentServiceEnabled: State<Boolean>,
    includeIconsInAppContent: State<Frequency>,
    onScreenShareTest: (ScreenCaptureConfig) -> Unit,
    onSetAppContentServiceEnabled: (Boolean) -> Unit,
    onSetIncludeIconsInAppContent: (Frequency) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        ShareScreenTestSection(
            appContentServiceEnabled,
            includeIconsInAppContent,
            onScreenShareTest,
            onSetAppContentServiceEnabled,
            onSetIncludeIconsInAppContent,
        )
    }
}
