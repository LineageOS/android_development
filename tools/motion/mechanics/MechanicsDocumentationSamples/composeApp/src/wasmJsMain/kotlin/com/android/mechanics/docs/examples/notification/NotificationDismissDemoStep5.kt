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

@file:OptIn(ExperimentalMaterial3ExpressiveApi::class, ExperimentalMaterial3Api::class)

package com.android.mechanics.docs.examples.notification

import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.android.mechanics.debug.DebugMotionValueVisualization
import com.android.mechanics.debug.debugMotionValue
import com.android.mechanics.docs.Demo
import com.android.mechanics.docs.HasConfig
import com.android.mechanics.docs.HasMotionValueVisualization
import com.android.mechanics.effects.MagneticDetach
import com.android.mechanics.rememberDistanceGestureContext
import com.android.mechanics.rememberMotionSpecAsState
import com.android.mechanics.rememberMotionValue
import com.android.mechanics.spec.InputDirection
import com.android.mechanics.spec.MotionSpec
import com.android.mechanics.spec.builder.spatialMotionSpec

object NotificationDismissDemoStep5 : Demo<Dp>, HasMotionValueVisualization, HasConfig<Dp> {
    override val identifier = "notification_demo5"

    var notificationWidth by mutableFloatStateOf(0f)

    @Composable
    override fun BoxScope.DemoUi(config: Dp, modifier: Modifier) {
        val gestureContext = rememberDistanceGestureContext()

        val xPosition =
            rememberMotionValue(
                input = { gestureContext.dragOffset },
                spec =
                    rememberMotionSpecAsState {
                        spatialMotionSpec {
                            after(
                                0f,
                                MagneticDetach(detachPosition = config, attachPosition = config / 2),
                            )
                        }
                    },
                gestureContext = gestureContext,
                label = "xPosition",
            )

        NotificationRow(
            remember { NotificationViewModel("Item 1") },
            modifier =
                modifier
                    .fillMaxWidth()
                    .onPlaced { notificationWidth = it.size.width.toFloat() }
                    .padding(16.dp)
                    .offset { IntOffset(xPosition.output.toInt(), 0) }
                    .debugMotionValue(xPosition)
                    .draggable(
                        rememberDraggableState { gestureContext.dragOffset += it },
                        Orientation.Horizontal,
                        onDragStopped = { velocity ->
                            // TODO
                        },
                    ),
        )

        IconButton(
            onClick = { gestureContext.reset(0f, InputDirection.Max) },
            Modifier.zIndex(-1f),
        ) {
            Icon(Icons.Default.Refresh, "Reset")
        }
    }

    override val visualizationInputRange: ClosedFloatingPointRange<Float>
        get() = -notificationWidth / 4..notificationWidth

    override fun computeOutputRange(spec: MotionSpec, inputRange: ClosedFloatingPointRange<Float>) =
        DebugMotionValueVisualization.inputRange(spec, inputRange)

    @Composable override fun rememberDefaultConfig() = 80.dp

    @Composable
    override fun ColumnScope.ConfigUi(config: Dp, onConfigChanged: (Dp) -> Unit) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Detach Distance: ${config.value.toInt()}dp")
            Slider(
                value = config.value,
                onValueChange = { onConfigChanged(it.dp) },
                valueRange = 10f..300f,
                modifier = Modifier.width(200.dp),
            )
        }
    }
}
