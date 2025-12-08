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

package com.android.mechanics.demo.presentation

import android.content.Context
import android.os.VibratorManager
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.DraggableState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.android.mechanics.debug.DebugMotionValueVisualization
import com.android.mechanics.debug.debugMotionValue
import com.android.mechanics.demo.tuneable.Demo
import com.android.mechanics.demo.tuneable.HasMotionValueVisualization
import com.android.mechanics.demo.tuneable.LabelledCheckbox
import com.android.mechanics.effects.MagneticDetach
import com.android.mechanics.haptics.HapticsExperimentalApi
import com.android.mechanics.haptics.SpringTensionHapticPlayer
import com.android.mechanics.rememberDistanceGestureContext
import com.android.mechanics.rememberMotionSpecAsState
import com.android.mechanics.rememberMotionValue
import com.android.mechanics.spec.builder.spatialMotionSpec

@OptIn(HapticsExperimentalApi::class)
object MagneticDetachDemo : Demo<MagneticDetachDemo.Config>, HasMotionValueVisualization {
    var inputRange by mutableStateOf(0f..0f)

    @Composable
    override fun DemoUi(config: Config, modifier: Modifier) {
        val colors = MaterialTheme.colorScheme

        val gestureContext = rememberDistanceGestureContext()
        val density = LocalDensity.current
        val context = LocalContext.current
        val hapticPlayer =
            remember(density, context) {
                val vibratorManager =
                    context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                SpringTensionHapticPlayer(density, vibratorManager)
            }
        val motionValue =
            rememberMotionValue(
                input = { gestureContext.dragOffset },
                gestureContext = gestureContext,
                spec =
                    rememberMotionSpecAsState {
                        spatialMotionSpec {
                            after(
                                50.dp.toPx(),
                                MagneticDetach(enableHaptics = config.enableHaptics),
                            )
                        }
                    },
                hapticPlayer = hapticPlayer,
            )

        Column(
            verticalArrangement = Arrangement.spacedBy(24.dp),
            modifier = modifier.fillMaxWidth().padding(vertical = 24.dp, horizontal = 96.dp),
        ) {

            // Output visualization
            val lineColor = colors.primary
            Box(
                contentAlignment = Alignment.CenterStart,
                modifier =
                    Modifier.fillMaxWidth()
                        .onPlaced { inputRange = 0f..it.size.width.toFloat() }
                        .drawBehind {
                            drawLine(
                                lineColor,
                                start = Offset(x = 0f, y = center.y),
                                end = Offset(x = size.width, y = center.y),
                                pathEffect =
                                    PathEffect.dashPathEffect(
                                        floatArrayOf(4.dp.toPx(), 4.dp.toPx())
                                    ),
                            )
                        },
            ) {
                Box(
                    modifier =
                        Modifier.size(48.dp)
                            .offset {
                                val halfSize = 48.dp.toPx() / 2f
                                val xOffset = (-halfSize + motionValue.output).toInt()
                                IntOffset(x = xOffset, y = 0)
                            }
                            .draggable(
                                remember { DraggableState { gestureContext.dragOffset += it } },
                                Orientation.Horizontal,
                            )
                            .debugMotionValue(motionValue)
                            .clip(remember { RoundedCornerShape(16.dp) })
                            .background(colors.primary)
                )
            }

            // MotionValue visualization
            DebugMotionValueVisualization(
                motionValue,
                inputRange,
                modifier = Modifier.fillMaxWidth().height(64.dp),
            )

            // Input visualization
            Slider(
                value = gestureContext.dragOffset,
                valueRange = inputRange,
                onValueChange = { gestureContext.dragOffset = it },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    @Composable
    override fun rememberDefaultConfig(): Config = remember { Config(enableHaptics = false) }

    override val visualizationInputRange: ClosedFloatingPointRange<Float>
        get() = inputRange

    @Composable
    override fun ColumnScope.ConfigUi(config: Config, onConfigChanged: (Config) -> Unit) {

        LabelledCheckbox(
            "Haptics",
            config.enableHaptics,
            onCheckedChange = { onConfigChanged(config.copy(enableHaptics = it)) },
            modifier = Modifier.fillMaxWidth(),
        )
    }

    override val identifier: String = "MagneticDetach"

    data class Config(val enableHaptics: Boolean)
}
