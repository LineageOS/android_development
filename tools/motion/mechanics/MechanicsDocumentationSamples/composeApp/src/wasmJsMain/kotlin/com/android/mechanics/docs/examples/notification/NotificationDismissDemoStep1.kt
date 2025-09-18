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

@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package com.android.mechanics.docs.examples.notification

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.android.mechanics.docs.Demo
import kotlin.math.abs
import kotlin.math.sign

object NotificationDismissDemoStep1 : Demo<Unit> {
    override val identifier = "single_notification_dismiss_demo_step1"

    var notificationWidth by mutableFloatStateOf(0f)

    @Composable
    override fun BoxScope.DemoUi(config: Unit, modifier: Modifier) {

        var xPosition by remember { mutableFloatStateOf(0f) }
        val density = LocalDensity.current

        NotificationRow(
            remember { NotificationViewModel("Item 1") },
            modifier =
                modifier
                    .fillMaxWidth()
                    .onPlaced { notificationWidth = it.size.width.toFloat() }
                    .padding(16.dp)
                    .offset { IntOffset(xPosition.toInt(), 0) }
                    .draggable(
                        rememberDraggableState { xPosition += it },
                        Orientation.Horizontal,
                        onDragStopped = { velocity ->
                            val thresholdPx = with(density) { 100.dp.toPx() }
                            val targetX =
                                if (abs(xPosition) < thresholdPx) 0f
                                else notificationWidth * xPosition.sign

                            Animatable(xPosition).animateTo(targetX) { xPosition = value }
                        },
                    ),
        )

        IconButton(onClick = { xPosition = 0f }, Modifier.zIndex(-1f)) {
            Icon(Icons.Default.Refresh, "Reset")
        }
    }

    @Composable override fun rememberDefaultConfig() = Unit
}
