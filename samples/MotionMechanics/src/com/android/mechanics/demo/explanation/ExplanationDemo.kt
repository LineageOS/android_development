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

package com.android.mechanics.demo.explanation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.times
import com.android.compose.animation.Easings
import com.android.mechanics.DistanceGestureContext
import com.android.mechanics.MotionValueState
import com.android.mechanics.demo.explanation.ExplanationDemo.TargetState
import com.android.mechanics.demo.tuneable.Demo
import com.android.mechanics.effects.ExpansionToggle
import com.android.mechanics.effects.MagneticDetach
import com.android.mechanics.effects.Toggle
import com.android.mechanics.rememberMotionValue
import com.android.mechanics.spec.InputDirection
import com.android.mechanics.spec.Mapping
import com.android.mechanics.spec.MotionSpec
import com.android.mechanics.spec.SemanticKey
import com.android.mechanics.spec.builder.MotionBuilderContext
import com.android.mechanics.spec.builder.directionalMotionSpec
import com.android.mechanics.spec.builder.fixedSpatialValueSpec
import com.android.mechanics.spec.builder.rememberMotionBuilderContext
import com.android.mechanics.spec.builder.spatialDirectionalMotionSpec
import com.android.mechanics.spec.builder.spatialMotionSpec
import com.android.mechanics.spring.SpringParameters
import kotlin.math.abs
import kotlin.math.nextUp
import kotlin.math.roundToInt
import kotlinx.coroutines.delay

data class ExplanationConfig(val experiment: Experiment)

object ExplanationDemo : Demo<ExplanationConfig> {
    override val identifier: String = "explanation_demo"

    val padding = 4.dp
    val draggableHeight = 80.dp
    val dragLength = 300.dp
    val visualizationHeight = dragLength + (2 * padding) + draggableHeight

    @Composable
    override fun DemoUi(config: ExplanationConfig, modifier: Modifier) {
        var selectedIndex by remember {
            mutableIntStateOf(Experiments.All.indexOf(config.experiment))
        }
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(enabled = selectedIndex > 0, onClick = { selectedIndex-- }) {
                    Icon(Icons.Outlined.ChevronLeft, "previous")
                }

                Text(Experiments.All[selectedIndex].label, modifier = Modifier.width(250.dp))

                IconButton(
                    enabled = selectedIndex < Experiments.All.size - 1,
                    onClick = { selectedIndex++ },
                ) {
                    Icon(Icons.Outlined.ChevronRight, "next")
                }
            }

            ExperimentUi(Experiments.All[selectedIndex], modifier = Modifier)
        }
    }

    @Composable
    fun ExperimentUi(experiment: Experiment, modifier: Modifier) {
        val colors = MaterialTheme.colorScheme

        val density = LocalDensity.current

        val inputRange =
            remember(density) { mutableStateOf(0f..with(density) { dragLength.toPx() }) }

        var state by remember { mutableStateOf(State.Top) }

        val specBuilderContext = rememberMotionBuilderContext()
        val spec =
            remember(experiment, specBuilderContext) {
                derivedStateOf { experiment.spec(specBuilderContext, inputRange.value, state) }
            }

        val changeDirectionSlop =
            experiment.changeDirectionSlop.takeIf { it.isFinite() }
                ?: LocalViewConfiguration.current.touchSlop
        val input =
            remember { DistanceGestureContext(0f, InputDirection.Max, changeDirectionSlop) }
                .also { it.directionChangeSlop = changeDirectionSlop }

        val primary = rememberMotionValue(input::dragOffset, input, spec::value)

        var isPlaying by remember { mutableStateOf(Playing.Idle) }

        LaunchedEffect(experiment) { isPlaying = Playing.Idle }

        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = modifier.padding(24.dp).fillMaxWidth(),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.Top,
                modifier = Modifier.fillMaxWidth(),
            ) {
                WireframeVisualization(
                    colors.primaryFixed,
                    primary::floatValue,
                    modifier =
                        Modifier.clickable {
                                isPlaying =
                                    when (isPlaying) {
                                        Playing.Opposite1 -> Playing.Opposite2
                                        else -> Playing.Opposite1
                                    }
                            }
                            .draggable(
                                rememberDraggableState {
                                    input.dragOffset =
                                        (input.dragOffset + it).coerceIn(inputRange.value)
                                },
                                orientation = Orientation.Vertical,
                                onDragStarted = { pos ->
                                    if (experiment.resetInputOnDragStart) {
                                        input.reset(
                                            primary.output,
                                            if (pos.y < inputRange.value.endInclusive / 2)
                                                InputDirection.Max
                                            else InputDirection.Min,
                                        )
                                    }
                                    isPlaying = Playing.Idle
                                    state = State.Dragging
                                },
                                onDragStopped = { velocity ->
                                    state =
                                        primary[TargetState]
                                            ?: if (
                                                input.dragOffset < inputRange.value.endInclusive / 2
                                            )
                                                State.Top
                                            else State.Dragging

                                    val abortVelocity = with(density) { 100.dp.toPx() }
                                    if (state == State.Top && velocity > abortVelocity) {
                                        state = State.Bottom
                                    } else if (state == State.Bottom && velocity < -abortVelocity) {
                                        state = State.Top
                                    }
                                },
                            ),
                )

                if (experiment.showGraph) {

                    Spacer(modifier = Modifier.size(16.dp))

                    Box {
                        TransformFunctionVisualization(
                            primary,
                            inputRange.value,
                            experiment.inputAxis,
                            experiment.outputAxis,
                            colors.primaryFixed,
                            colors.primaryFixedDim,
                            colors.onPrimaryFixed,
                        )

                        FloatingActionButton(
                            onClick = {
                                isPlaying =
                                    when (isPlaying) {
                                        Playing.Idle -> Playing.Repeat
                                        else -> Playing.Idle
                                    }
                            },
                            modifier = Modifier.align(Alignment.BottomStart),
                        ) {
                            Icon(
                                if (isPlaying == Playing.Idle) Icons.Filled.PlayArrow
                                else Icons.Filled.Pause,
                                "Play",
                            )
                        }
                    }
                }
            }
        }

        if (experiment.animateChangeDirectionOnly) {
            LaunchedEffect(isPlaying) {
                if (isPlaying == Playing.Idle) return@LaunchedEffect
                do {
                    val prevIn = input.dragOffset
                    input.dragOffset = prevIn.nextUp()
                    withFrameNanos {}
                    input.dragOffset = prevIn.nextUp()
                    withFrameNanos {}
                    input.reset(
                        prevIn,
                        if (input.direction == InputDirection.Max) InputDirection.Min
                        else InputDirection.Max,
                    )

                    while (!primary.isStable) {
                        withFrameNanos {}
                    }
                } while (isPlaying == Playing.Repeat)
                isPlaying = Playing.Idle
            }
        } else {
            LaunchedEffect(isPlaying) {
                while (isPlaying == Playing.Repeat) {
                    delay(250)
                    input.reset(inputRange.value.start, InputDirection.Max)
                    delay(250)
                    Animatable(inputRange.value.start).animateTo(
                        inputRange.value.endInclusive,
                        animationSpec = tween(durationMillis = 1000, easing = Easings.Linear),
                    ) {
                        input.dragOffset = value
                    }
                    delay(250)
                    input.reset(inputRange.value.endInclusive, InputDirection.Min)
                    delay(250)
                    Animatable(inputRange.value.endInclusive).animateTo(
                        inputRange.value.start,
                        animationSpec = tween(durationMillis = 1000, easing = Easings.Linear),
                    ) {
                        input.dragOffset = value
                    }
                }
                if (isPlaying == Playing.Opposite1 || isPlaying == Playing.Opposite2) {
                    input.reset(
                        input.dragOffset,
                        if (input.direction == InputDirection.Max) InputDirection.Min
                        else InputDirection.Max,
                    )

                    val targetValue =
                        if (input.direction == InputDirection.Max) inputRange.value.endInclusive
                        else inputRange.value.start
                    Animatable(input.dragOffset).animateTo(
                        targetValue,
                        animationSpec =
                            tween(
                                durationMillis =
                                    (1000 * abs(input.dragOffset - targetValue) /
                                            inputRange.value.endInclusive)
                                        .toInt(),
                                easing = Easings.Linear,
                            ),
                    ) {
                        input.dragOffset = value
                    }
                    isPlaying = Playing.Idle
                }
            }
        }
    }

    @Composable
    fun TransformFunctionVisualization(
        motionValue: MotionValueState,
        inputRange: ClosedFloatingPointRange<Float>,
        inputAxis: Axis,
        outputAxis: Axis,
        colorLight: Color,
        color: Color,
        colorDark: Color,
        modifier: Modifier = Modifier,
    ) {
        val colors = MaterialTheme.colorScheme

        val inspector = remember(motionValue) { motionValue.debugInspector() }
        DisposableEffect(inspector) { onDispose { inspector.dispose() } }
        Box(
            modifier =
                modifier
                    .size(visualizationHeight)
                    .background(color = colors.surfaceContainer, shape = RoundedCornerShape(16.dp))
                    .visualizationAxis(
                        colors.outlineVariant,
                        inputRange,
                        inputRange,
                        inputAxis,
                        outputAxis,
                    )
                    .clip(shape = RoundedCornerShape(16.dp))
                    .transformationVisualization(
                        motionValue,
                        colorLight,
                        color,
                        colorDark,
                        colors.outlineVariant,
                        inputAxis,
                        outputAxis,
                        inputRange,
                        inputRange,
                    )
        ) {}
    }

    @Composable
    fun WireframeVisualization(color: Color, position: () -> Float, modifier: Modifier = Modifier) {
        val colors = MaterialTheme.colorScheme

        Box(
            modifier =
                modifier
                    .height(visualizationHeight)
                    .aspectRatio(9f / 19.5f)
                    .clip(shape = RoundedCornerShape(16.dp))
                    .background(color = colors.surfaceContainer)
                    .border(width = 2.dp, color = colors.outline, shape = RoundedCornerShape(16.dp))
                    .padding(padding)
        ) {
            Surface(
                color = color,
                modifier =
                    Modifier.fillMaxWidth()
                        .height(80.dp)
                        .align(Alignment.TopCenter)
                        .offset { IntOffset(0, position().toInt()) }
                        .clip(shape = RoundedCornerShape(12.dp)),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Box(
                        modifier =
                            Modifier.size(10.dp)
                                .border(
                                    width = 2.dp,
                                    color = LocalContentColor.current,
                                    shape = CircleShape,
                                )
                    )
                }
            }
        }
    }

    @Composable
    override fun rememberDefaultConfig(): ExplanationConfig {
        return ExplanationConfig(Experiments.Step02Easing)
    }

    @Composable
    override fun ColumnScope.ConfigUi(
        config: ExplanationConfig,
        onConfigChanged: (ExplanationConfig) -> Unit,
    ) {}

    val TargetState: SemanticKey<State> = SemanticKey("TargetState")
}

enum class State {
    Dragging,
    Top,
    Bottom,
}

data class Experiment(
    val label: String,
    val spec:
        MotionBuilderContext.(
            inputRange: ClosedFloatingPointRange<Float>, state: State,
        ) -> MotionSpec,
    val inputAxis: Axis,
    val outputAxis: Axis,
    val changeDirectionSlop: Float = Float.NaN,
    val animateChangeDirectionOnly: Boolean = false,
    val showGraph: Boolean = true,
    val resetInputOnDragStart: Boolean = false,
)

object Experiments {
    val Step00Setup =
        Experiment(
            "Setup",
            { _, _ -> MotionSpec.Identity },
            inputAxis = Axis.Time("Time", 1000),
            outputAxis = Axis.Spatial("Top"),
            changeDirectionSlop = Float.MAX_VALUE,
            showGraph = false,
        )

    val Step01Interpolator =
        Experiment(
            "Interpolator",
            { _, _ -> MotionSpec.Identity },
            inputAxis = Axis.Time("Time", 1000),
            outputAxis = Axis.Spatial("Top"),
            changeDirectionSlop = Float.MAX_VALUE,
        )

    val Step02Easing =
        Experiment(
            "Easing",
            { inputRange, _ ->
                MotionSpec(
                    maxDirection =
                        directionalMotionSpec(SpringParameters.Snap, Mapping.Zero) {
                            mapping(0f) { value ->
                                Easings.Emphasized.transform(value / inputRange.endInclusive) *
                                    inputRange.endInclusive
                            }
                            fixedValueFromCurrent(inputRange.endInclusive)
                        },
                    minDirection =
                        directionalMotionSpec(SpringParameters.Snap, Mapping.Zero) {
                            mapping(0f) { value ->
                                (1 -
                                    Easings.Emphasized.transform(
                                        1 - (value / inputRange.endInclusive)
                                    )) * inputRange.endInclusive
                            }
                            fixedValueFromCurrent(inputRange.endInclusive)
                        },
                    resetSpring = SpringParameters.Snap,
                )
            },
            inputAxis = Axis.Time("Time", 1000),
            outputAxis = Axis.Spatial("Top"),
            changeDirectionSlop = Float.MAX_VALUE,
        )

    val Step03Interrupt =
        Step02Easing.copy(label = "Interrupting Easings", changeDirectionSlop = 1f)

    val Step04Spring =
        Experiment(
            "Spring",
            { inputRange, _ ->
                MotionSpec(
                    spatialDirectionalMotionSpec(Mapping.Fixed(inputRange.start)) {
                        fixedValueFromCurrent(0f)
                    },
                    spatialDirectionalMotionSpec(Mapping.Fixed(inputRange.endInclusive)) {
                        fixedValueFromCurrent(inputRange.endInclusive)
                    },
                )
            },
            inputAxis = Axis.None("-"),
            outputAxis = Axis.Spatial("Top"),
            changeDirectionSlop = Float.MAX_VALUE,
            animateChangeDirectionOnly = true,
        )

    val Step05SimpleToggle =
        Experiment(
            "Simple Toggle",
            { inputRange, _ ->
                MotionSpec(
                    spatialDirectionalMotionSpec(Mapping.Fixed(inputRange.start)) {
                        fixedValue(
                            breakpoint = inputRange.endInclusive / 2,
                            value = inputRange.endInclusive,
                        )
                    }
                )
            },
            inputAxis = Axis.Spatial("Drag"),
            outputAxis = Axis.Spatial("Top"),
        )

    val Step06MechanicToggle =
        Experiment(
            "Mechanic Toggle",
            { inputRange, _ ->
                spatialMotionSpec {
                    between(inputRange.start, inputRange.endInclusive, ExpansionToggle.Default)
                }
            },
            inputAxis = Axis.Spatial("Drag"),
            outputAxis = Axis.Spatial("Top"),
        )

    val Step07MechanicComplete =
        Experiment(
            "Mechanic Toggle Complete",
            { inputRange, state ->
                when (state) {
                    State.Top -> fixedSpatialValueSpec(inputRange.start)
                    State.Bottom -> fixedSpatialValueSpec(inputRange.endInclusive)
                    State.Dragging ->
                        spatialMotionSpec {
                            between(
                                inputRange.start,
                                inputRange.endInclusive,
                                Toggle(TargetState, minState = State.Top, maxState = State.Bottom),
                            )
                        }
                }
            },
            inputAxis = Axis.Spatial("Drag"),
            outputAxis = Axis.Spatial("Top"),
            resetInputOnDragStart = true,
        )

    val EffectMagneticDetach =
        Experiment(
            "Effect: Magnetic Detach",
            { inputRange, state ->
                when (state) {
                    State.Top -> fixedSpatialValueSpec(inputRange.start)
                    State.Bottom -> fixedSpatialValueSpec(inputRange.endInclusive)
                    State.Dragging -> spatialMotionSpec { after(0f, MagneticDetach()) }
                }
            },
            inputAxis = Axis.Spatial("Drag Position"),
            outputAxis = Axis.Progress("Position"),
            showGraph = false,
            resetInputOnDragStart = true,
        )

    val EffectToggle =
        Experiment(
            "Effect: Mechanic Toggle",
            { inputRange, state ->
                when (state) {
                    State.Top -> fixedSpatialValueSpec(inputRange.start)
                    State.Bottom -> fixedSpatialValueSpec(inputRange.endInclusive)
                    State.Dragging ->
                        spatialMotionSpec {
                            between(
                                inputRange.start,
                                inputRange.endInclusive,
                                Toggle(TargetState, minState = State.Top, maxState = State.Bottom),
                            )
                        }
                }
            },
            inputAxis = Axis.Spatial("Drag Position"),
            outputAxis = Axis.Progress("Position"),
            showGraph = false,
            resetInputOnDragStart = true,
        )

    val All =
        listOf(
            Step00Setup,
            Step01Interpolator,
            Step02Easing,
            Step03Interrupt,
            Step04Spring,
            Step05SimpleToggle,
            Step06MechanicToggle,
            Step07MechanicComplete,
            EffectMagneticDetach,
            EffectToggle,
        )
}

abstract class Axis(val label: String) {

    abstract fun Density.format(value: Float, range: ClosedFloatingPointRange<Float>): String

    class Spatial(label: String) : Axis(label) {

        override fun Density.format(value: Float, range: ClosedFloatingPointRange<Float>): String {
            return "${value.toDp().value.roundToInt()}dp"
        }
    }

    class Time(label: String, val maxMs: Int) : Axis(label) {

        override fun Density.format(value: Float, range: ClosedFloatingPointRange<Float>): String {
            val progress = (value - range.start) / (range.endInclusive - range.start)
            return "${(maxMs * progress).roundToInt()}ms"
        }
    }

    class Progress(label: String) : Axis(label) {

        override fun Density.format(value: Float, range: ClosedFloatingPointRange<Float>): String {
            val progress = (value - range.start) / (range.endInclusive - range.start)
            return "${( progress).roundToInt()}%"
        }
    }

    class None(label: String) : Axis(label) {

        override fun Density.format(value: Float, range: ClosedFloatingPointRange<Float>): String {
            return ""
        }
    }
}

enum class Playing {
    Idle,
    Repeat,
    Opposite1,
    Opposite2,
}
