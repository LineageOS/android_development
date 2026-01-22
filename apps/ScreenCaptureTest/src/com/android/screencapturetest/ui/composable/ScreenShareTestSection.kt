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

import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.android.screencapturetest.domain.model.MediaProjectionSource
import com.android.screencapturetest.domain.model.ScreenCaptureConfig
import com.android.screencapturetest.shared.Frequency

/** Section for testing screen share. */
@Composable
fun ShareScreenTestSection(
    appContentServiceEnabled: State<Boolean>,
    includeIconsInAppContent: State<Frequency>,
    onScreenShareTest: (ScreenCaptureConfig) -> Unit,
    onSetAppContentServiceEnabled: (Boolean) -> Unit,
    onSetIncludeIconsInAppContent: (Frequency) -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
) {
    Section(
        title = "Screen Share Test",
        textStyle = MaterialTheme.typography.titleLarge,
        dividerThickness = 2.dp,
        modifier = modifier,
    ) {
        val config = remember { mutableStateOf(ScreenCaptureConfig()) }

        Section(
            title = "Media Projection Sources",
            textStyle = MaterialTheme.typography.labelSmall,
            dividerThickness = 1.dp,
        ) {
            FlowRow(modifier = Modifier.fillMaxWidth()) {
                CheckboxOption(
                    checked = { config.value.allowFullscreen },
                    onCheckedChange = { config.value = config.value.copy(allowFullscreen = it) },
                    text = "Fullscreen",
                )

                CheckboxOption(
                    checked = { config.value.allowApp },
                    onCheckedChange = { config.value = config.value.copy(allowApp = it) },
                    text = "App",
                )

                CheckboxOption(
                    checked = { config.value.allowAppContent },
                    onCheckedChange = { config.value = config.value.copy(allowAppContent = it) },
                    text = "App content",
                )

                CheckboxOption(
                    checked = { config.value.allowRegion },
                    onCheckedChange = { config.value = config.value.copy(allowRegion = it) },
                    text = "Region",
                )
            }
        }

        Section(
            title = "Additional Media Projection Options,",
            textStyle = MaterialTheme.typography.labelSmall,
            dividerThickness = 1.dp,
        ) {
            CheckboxOption(
                checked = { config.value.allowAudio },
                onCheckedChange = { config.value = config.value.copy(allowAudio = it) },
                text = "Allow audio",
            )

            val initialSource = derivedStateOf { config.value.initialSource }
            DropdownOption(
                label = "Initial source",
                options = MediaProjectionSource.entries,
                state = initialSource,
                onOptionSelected = { config.value = config.value.copy(initialSource = it) },
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Section(
            title = "App Content Options",
            textStyle = MaterialTheme.typography.labelSmall,
            dividerThickness = 1.dp,
        ) {
            SwitchOption(
                checked = appContentServiceEnabled,
                onCheckedChange = onSetAppContentServiceEnabled,
                text = "Generate Test App Content",
                modifier = Modifier.fillMaxWidth(),
            )

            if (appContentServiceEnabled.value) {
                DropdownOption(
                    label = "Include Icons in App Content",
                    options = Frequency.entries,
                    state = includeIconsInAppContent,
                    onOptionSelected = onSetIncludeIconsInAppContent,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        Button(
            onClick = { onScreenShareTest(config.value) },
            modifier = Modifier.align(alignment = Alignment.CenterHorizontally),
        ) {
            Text(text = "Test Screen Share")
        }
    }
}
