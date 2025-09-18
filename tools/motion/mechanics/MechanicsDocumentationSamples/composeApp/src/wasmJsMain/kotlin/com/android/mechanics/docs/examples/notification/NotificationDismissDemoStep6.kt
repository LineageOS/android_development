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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.android.mechanics.debug.DebugMotionValueVisualization
import com.android.mechanics.debug.debugMotionValue
import com.android.mechanics.docs.Demo
import com.android.mechanics.docs.HasMotionValueVisualization
import com.android.mechanics.effects.FixedValue
import com.android.mechanics.effects.MagneticDetach
import com.android.mechanics.rememberDistanceGestureContext
import com.android.mechanics.rememberMotionSpecAsState
import com.android.mechanics.rememberMotionValue
import com.android.mechanics.spec.InputDirection
import com.android.mechanics.spec.MotionSpec
import com.android.mechanics.spec.builder.fixedSpatialValueSpec
import com.android.mechanics.spec.builder.spatialMotionSpec
import kotlin.math.abs
import kotlin.math.sign

object NotificationDismissDemoStep6 : Demo<Unit>, HasMotionValueVisualization {
    override val identifier = "single_notification_dismiss_demo_step6"

    var notificationWidth by mutableFloatStateOf(0f)

    sealed interface State {
        object Idle : State

        object Dragging : State

        data class Dismissed(val directionSign: Float) : State
    }

    @Composable
    override fun BoxScope.DemoUi(config: Unit, modifier: Modifier) {
        var state by remember { mutableStateOf<State>(State.Idle) }
        val gestureContext = rememberDistanceGestureContext()
        val xPosition =
            rememberMotionValue(
                input = { gestureContext.dragOffset },
                spec =
                    rememberMotionSpecAsState {
                        when (val state = state) {
                            State.Idle -> fixedSpatialValueSpec(0f)
                            is State.Dismissed ->
                                fixedSpatialValueSpec(notificationWidth * state.directionSign)
                            State.Dragging ->
                                spatialMotionSpec {
                                    val detachEffect = MagneticDetach(detachPosition = 100.dp)
                                    before(0f, detachEffect)
                                    after(0f, detachEffect)

                                    val dismissPosition = notificationWidth - 90.dp.toPx()
                                    after(dismissPosition, FixedValue(notificationWidth))
                                    before(-dismissPosition, FixedValue(-notificationWidth))
                                }
                        }
                    },
                gestureContext = gestureContext,
                label = "xPosition",
            )

        val density = LocalDensity.current

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
                        onDragStarted = {
                            gestureContext.reset(xPosition.output, InputDirection.Max)
                            state = State.Dragging
                        },
                        onDragStopped = { velocity ->
                            val sideSign = xPosition.outputTarget.sign
                            val isAbort = abs(velocity) > with(density) { AbortVelocity.toPx() }
                            val isFling = abs(velocity) > with(density) { FlingVelocity.toPx() }
                            val isMovingInSameDirection = velocity.sign == sideSign

                            val isDismissed =
                                when (xPosition[MagneticDetach.Defaults.AttachDetachState]) {
                                    MagneticDetach.State.Attached ->
                                        isFling && !isMovingInSameDirection
                                    MagneticDetach.State.Detached ->
                                        !isAbort || isMovingInSameDirection
                                    else -> isFling
                                }

                            state = if (isDismissed) State.Dismissed(sideSign) else State.Idle
                        },
                    ),
        )

        IconButton(onClick = { state = State.Idle }, Modifier.zIndex(-1f)) {
            Icon(Icons.Default.Refresh, "Reset")
        }
    }

    override val visualizationInputRange: ClosedFloatingPointRange<Float>
        get() = -notificationWidth..notificationWidth

    override fun computeOutputRange(spec: MotionSpec, inputRange: ClosedFloatingPointRange<Float>) =
        DebugMotionValueVisualization.inputRange(spec, inputRange)

    @Composable override fun rememberDefaultConfig() = Unit

    val AbortVelocity = 100.dp // dp/s
    val FlingVelocity = 1000.dp // dp/s
}
