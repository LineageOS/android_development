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

package com.android.mechanics.docs

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.window.ComposeViewport
import com.android.mechanics.docs.examples.notification.NotificationDismissDemoStep1
import com.android.mechanics.docs.examples.notification.NotificationDismissDemoStep2
import com.android.mechanics.docs.examples.notification.NotificationDismissDemoStep3
import com.android.mechanics.docs.examples.notification.NotificationDismissDemoStep4
import com.android.mechanics.docs.examples.notification.NotificationDismissDemoStep5
import com.android.mechanics.docs.examples.notification.NotificationDismissDemoStep6
import kotlinx.browser.document
import kotlinx.browser.window

private val allDemos =
    listOf<Demo<*>>(
        NotificationDismissDemoStep1,
        NotificationDismissDemoStep2,
        NotificationDismissDemoStep3,
        NotificationDismissDemoStep4,
        NotificationDismissDemoStep5,
        NotificationDismissDemoStep6,
    )

@OptIn(ExperimentalComposeUiApi::class)
fun main() {

    ComposeViewport(document.body!!) {
        Box(contentAlignment = Alignment.TopCenter, modifier = Modifier.fillMaxSize()) {
            val selectedDemoId =
                Regex("[&?]demo=([^&]+)").find(window.location.search)?.groups?.get(1)?.value

            val selectedDemo = allDemos.find { it.identifier == selectedDemoId }

            if (selectedDemo != null) {
                selectedDemo.ConfigurableDemo(modifier = Modifier.fillMaxSize())
                return@Box
            }

            Column {
                allDemos.forEach { demo ->
                    Button(onClick = { window.location.search = "?demo=${demo.identifier}" }) {
                        Text(demo.identifier)
                    }
                }
            }
        }
    }
}
