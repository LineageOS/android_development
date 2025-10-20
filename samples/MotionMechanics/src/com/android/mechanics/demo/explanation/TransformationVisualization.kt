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

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.inset
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.ObserverModifierNode
import androidx.compose.ui.node.observeReads
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.fastCoerceAtLeast
import androidx.compose.ui.util.fastCoerceAtMost
import androidx.compose.ui.util.fastForEachIndexed
import com.android.mechanics.MotionValueState
import com.android.mechanics.debug.DebugInspector
import com.android.mechanics.debug.FrameData
import com.android.mechanics.debug.debugMotionSpecGraph
import com.android.mechanics.spec.DirectionalMotionSpec
import com.android.mechanics.spec.Guarantee
import com.android.mechanics.spec.InputDirection
import com.android.mechanics.spec.Mapping
import com.android.mechanics.spec.MotionSpec
import com.android.mechanics.spec.SegmentKey
import kotlin.math.ceil
import kotlin.math.min
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun Modifier.visualizationAxis(
    labelColor: Color,
    inputRange: ClosedFloatingPointRange<Float>,
    outputRange: ClosedFloatingPointRange<Float>,
    inputAxis: Axis,
    outputAxis: Axis,
    textMeasurer: TextMeasurer = rememberTextMeasurer(),
) =
    this then
        Modifier.drawBehind {
            val padding = 2.dp.toPx()
            fun drawLabelY(value: Float) {
                val label = textMeasurer.measure(with(outputAxis) { format(value, outputRange) })
                val y = mapPointInOutputToY(value, outputRange)

                val offsetFactor = y / size.height

                drawText(
                    label,
                    labelColor,
                    Offset(size.width + padding, y - (label.size.height * offsetFactor)),
                )
            }

            fun drawLabelX(value: Float) {
                val label = textMeasurer.measure(with(inputAxis) { format(value, inputRange) })
                val x = mapPointInInputToX(value, inputRange, false)
                val offsetFactor = x / size.width

                drawText(
                    label,
                    labelColor,
                    Offset(x - (label.size.width * offsetFactor), size.height + label.size.height),
                )
            }

            drawLabelY(outputRange.start)
            drawLabelY(outputRange.endInclusive)
            drawLabelX(inputRange.start)
            drawLabelX(inputRange.endInclusive)

            val inAxisLabel = textMeasurer.measure(inputAxis.label)
            drawText(
                inAxisLabel,
                labelColor,
                Offset(
                    (size.width - inAxisLabel.size.width) / 2f,
                    size.height + inAxisLabel.size.height,
                ),
            )
        }

/**
 * Draws a full-sized debug visualization of the [motionValue] state.
 *
 * This can be combined with [debugMotionSpecGraph], when [inputRange] and [outputRange] are the
 * same.
 *
 * NOTE: This is a debug tool, do not enable in production.
 *
 * @param color Color for the dots indicating the value
 * @param inputRange The range of the input (x) axis
 * @param outputRange The range of the output (y) axis.
 * @param maxAgeMillis Max age of the elements in the history trail.
 */
@Composable
fun Modifier.transformationVisualization(
    motionValue: MotionValueState,
    colorLight: Color,
    color: Color,
    colorDark: Color,
    labelColor: Color,
    inputAxis: Axis,
    outputAxis: Axis,
    inputRange: ClosedFloatingPointRange<Float>,
    outputRange: ClosedFloatingPointRange<Float>,
    maxAgeMillis: Long = 200L,
): Modifier =
    this then
        DebugMotionValueGraphElement(
            motionValue,
            colorLight,
            color,
            colorDark,
            labelColor,
            inputAxis,
            outputAxis,
            inputRange,
            outputRange,
            maxAgeMillis,
        )

private data class DebugMotionValueGraphElement(
    val motionValue: MotionValueState,
    val colorLight: Color,
    val color: Color,
    val colorDark: Color,
    val labelColor: Color,
    val inputAxis: Axis,
    val outputAxis: Axis,
    val inputRange: ClosedFloatingPointRange<Float>,
    val outputRange: ClosedFloatingPointRange<Float>,
    val maxAgeMillis: Long,
) : ModifierNodeElement<DebugMotionValueGraphNode>() {

    init {
        require(maxAgeMillis > 0)
    }

    override fun create() =
        DebugMotionValueGraphNode(
            motionValue,
            colorLight,
            color,
            colorDark,
            labelColor,
            inputAxis,
            outputAxis,
            inputRange,
            outputRange,
            maxAgeMillis,
        )

    override fun update(node: DebugMotionValueGraphNode) {
        node.motionValue = motionValue
        node.colorLight = colorLight
        node.color = color
        node.colorDark = colorDark
        node.labelColor = labelColor
        node.inputAxis = inputAxis
        node.outputAxis = outputAxis
        node.inputRange = inputRange
        node.outputRange = outputRange
        node.maxAgeMillis = maxAgeMillis
    }

    override fun InspectorInfo.inspectableProperties() {
        // intentionally empty
    }
}

private class DebugMotionValueGraphNode(
    motionValue: MotionValueState,
    var colorLight: Color,
    var color: Color,
    var colorDark: Color,
    var labelColor: Color,
    var inputAxis: Axis,
    var outputAxis: Axis,
    var inputRange: ClosedFloatingPointRange<Float>,
    var outputRange: ClosedFloatingPointRange<Float>,
    var maxAgeMillis: Long,
) : DrawModifierNode, ObserverModifierNode, Modifier.Node() {

    private var debugInspector by mutableStateOf<DebugInspector?>(null)
    private val history = mutableStateListOf<FrameData>()

    var motionValue = motionValue
        set(value) {
            if (value != field) {
                disposeDebugInspector()
                field = value

                if (isAttached) {
                    acquireDebugInspector()
                }
            }
        }

    override fun onAttach() {
        acquireDebugInspector()

        coroutineScope.launch {
            while (true) {
                if (history.size > 1) {

                    withFrameNanos { thisFrameTime ->
                        while (
                            history.size > 1 &&
                                (thisFrameTime - history.first().frameTimeNanos) >
                                    maxAgeMillis * 1_000_000
                        ) {
                            history.removeFirst()
                        }
                    }
                }

                snapshotFlow { history.size > 1 }.first { it }
            }
        }
    }

    override fun onDetach() {
        disposeDebugInspector()
    }

    private fun acquireDebugInspector() {
        debugInspector = motionValue.debugInspector()
        observeFrameAndAddToHistory()
    }

    private fun disposeDebugInspector() {
        debugInspector?.dispose()
        debugInspector = null
        history.clear()
    }

    var currentSpec by mutableStateOf(MotionSpec.InitiallyUndefined)
    var currentSegmentKey by mutableStateOf(currentSpec.segmentAtInput(0f, InputDirection.Max).key)

    override fun ContentDrawScope.draw() {
        inset(
            left = 24.dp.toPx(),
            top = 24.dp.toPx(),
            right = 32.dp.toPx(),
            bottom = 32.dp.toPx(),
        ) {
            val invert = inputAxis is Axis.Time && currentSegmentKey.direction == InputDirection.Min
            if (currentSpec != MotionSpec.InitiallyUndefined) {
                drawDirectionalSpec(
                    currentSpec[currentSegmentKey.direction],
                    inputRange,
                    outputRange,
                    colorLight,
                    activeSegment = currentSegmentKey,
                    invert,
                )
            }
            drawInputOutputTrail(
                history,
                inputRange,
                outputRange,
                colorLight,
                color,
                colorDark,
                invert,
            )
        }
        drawContent()
    }

    private fun observeFrameAndAddToHistory() {
        var lastFrame: FrameData? = null

        observeReads { lastFrame = debugInspector?.frame }

        lastFrame?.also {
            history.add(it)
            currentSpec = it.spec
            currentSegmentKey = it.segmentKey
        }
    }

    override fun onObservedReadsChanged() {
        observeFrameAndAddToHistory()
    }
}

private val MotionSpec.isUnidirectional: Boolean
    get() = maxDirection == minDirection

private fun DrawScope.mapPointInInputToX(
    input: Float,
    inputRange: ClosedFloatingPointRange<Float>,
    invert: Boolean,
): Float {
    val inputExtent = (inputRange.endInclusive - inputRange.start)
    var scale = ((input - inputRange.start) / (inputExtent))
    if (invert) scale = 1 - scale
    return scale * size.width
}

private fun DrawScope.mapPointInOutputToY(
    output: Float,
    outputRange: ClosedFloatingPointRange<Float>,
): Float {
    val outputExtent = (outputRange.endInclusive - outputRange.start)
    return ((output - outputRange.start) / (outputExtent)) * size.height
}

private fun DrawScope.drawDirectionalSpec(
    spec: DirectionalMotionSpec,
    inputRange: ClosedFloatingPointRange<Float>,
    outputRange: ClosedFloatingPointRange<Float>,
    color: Color,
    activeSegment: SegmentKey?,
    invert: Boolean,
) {

    val startSegment = spec.findBreakpointIndex(inputRange.start)
    val endSegment = spec.findBreakpointIndex(inputRange.endInclusive)

    for (segmentIndex in startSegment..endSegment) {
        val isActiveSegment =
            activeSegment?.let { spec.findSegmentIndex(it) == segmentIndex } ?: false

        val mapping = spec.mappings[segmentIndex]
        val startBreakpoint = spec.breakpoints[segmentIndex]
        val segmentStart = startBreakpoint.position
        val fromInput = segmentStart.fastCoerceAtLeast(inputRange.start)
        val endBreakpoint = spec.breakpoints[segmentIndex + 1]
        val segmentEnd = endBreakpoint.position
        val toInput = segmentEnd.fastCoerceAtMost(inputRange.endInclusive)

        val strokeWidth = 4.dp.toPx()
        val dotSize = 6.dp.toPx()
        val fromY = mapPointInOutputToY(mapping.map(fromInput), outputRange)
        val toY = mapPointInOutputToY(mapping.map(toInput), outputRange)

        val start = Offset(mapPointInInputToX(fromInput, inputRange, invert), fromY)
        val end = Offset(mapPointInInputToX(toInput, inputRange, invert), toY)
        if (mapping is Mapping.Fixed || mapping is Mapping.Identity || mapping is Mapping.Linear) {
            drawLine(color, start, end, strokeWidth = strokeWidth)
        } else {
            val xStart = mapPointInInputToX(fromInput, inputRange, invert = false)
            val xEnd = mapPointInInputToX(toInput, inputRange, invert = false)

            val oneDpInPx = 1.dp.toPx()
            val numberOfLines = ceil((xEnd - xStart) / oneDpInPx).toInt()
            val inputLength = (toInput - fromInput) / numberOfLines

            repeat(numberOfLines) {
                val lineStart = fromInput + inputLength * it
                val lineEnd = lineStart + inputLength

                val partialFromY = mapPointInOutputToY(mapping.map(lineStart), outputRange)
                val partialToY = mapPointInOutputToY(mapping.map(lineEnd), outputRange)

                val partialStart =
                    Offset(mapPointInInputToX(lineStart, inputRange, invert), partialFromY)
                val partialEnd = Offset(mapPointInInputToX(lineEnd, inputRange, invert), partialToY)

                drawLine(color, partialStart, partialEnd, strokeWidth = strokeWidth)
            }
        }

        if (segmentStart == fromInput) {
            drawCircle(color, dotSize, start)
        }

        if (segmentEnd == toInput) {
            drawCircle(color, dotSize, end)
        }

        val guarantee = startBreakpoint.guarantee
        if (guarantee is Guarantee.InputDelta) {
            val guaranteePos = segmentStart + guarantee.delta
            if (guaranteePos > inputRange.start) {

                val guaranteeOffset =
                    Offset(
                        mapPointInInputToX(guaranteePos, inputRange, invert),
                        mapPointInOutputToY(mapping.map(guaranteePos), outputRange),
                    )

                val arrowSize = 4.dp.toPx()

                drawLine(
                    color,
                    guaranteeOffset,
                    guaranteeOffset.plus(Offset(arrowSize, -arrowSize)),
                )
                drawLine(color, guaranteeOffset, guaranteeOffset.plus(Offset(arrowSize, arrowSize)))
            }
        }
    }
}

private fun DrawScope.drawDirectionAndAnimationStatus(currentFrame: FrameData) {
    val indicatorSize = min(this.size.height, 24.dp.toPx())

    this.scale(
        scaleX = if (currentFrame.gestureDirection == InputDirection.Max) 1f else -1f,
        scaleY = 1f,
    ) {
        val color = if (currentFrame.isStable) Color.Green else Color.Red
        val strokeWidth = 1.dp.toPx()
        val d1 = indicatorSize / 2f
        val d2 = indicatorSize / 3f

        translate(left = 2.dp.toPx()) {
            drawLine(
                color,
                Offset(center.x - d2, center.y - d1),
                center,
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round,
            )
            drawLine(
                color,
                Offset(center.x - d2, center.y + d1),
                center,
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round,
            )
        }
        translate(left = -2.dp.toPx()) {
            drawLine(
                color,
                Offset(center.x - d2, center.y - d1),
                center,
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round,
            )
            drawLine(
                color,
                Offset(center.x - d2, center.y + d1),
                center,
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round,
            )
        }
    }
}

private fun DrawScope.drawInputOutputTrail(
    history: List<FrameData>,
    inputRange: ClosedFloatingPointRange<Float>,
    outputRange: ClosedFloatingPointRange<Float>,
    colorLight: Color,
    color: Color,
    colorDark: Color,
    invert: Boolean,
) {
    history.fastForEachIndexed { index, frame ->
        val x = mapPointInInputToX(frame.input, inputRange, invert)
        val y = mapPointInOutputToY(frame.output, outputRange)

        val isCurrent = (index == history.size - 1)

        drawCircle(
            if (isCurrent) colorDark else color,
            6.dp.toPx(),
            Offset(x, y),
            alpha = if (isCurrent) 1f else ((index + 1) / history.size.toFloat()) / 2,
        )

        if (isCurrent) drawCircle(colorLight, 4.dp.toPx(), Offset(x, y))
    }
}

private fun DrawScope.drawAxis(color: Color) {

    drawXAxis(color)
    drawYAxis(color)
}

private fun DrawScope.drawYAxis(color: Color, atX: Float = 0f) {

    val arrowSize = 4.dp.toPx()

    drawLine(color, Offset(atX, size.height), Offset(atX, 0f))
    drawLine(color, Offset(atX, 0f), Offset(atX + arrowSize, arrowSize))
    drawLine(color, Offset(atX, 0f), Offset(atX - arrowSize, arrowSize))
}

private fun DrawScope.drawXAxis(color: Color, atY: Float = size.height) {

    val arrowSize = 4.dp.toPx()

    drawLine(color, Offset(0f, atY), Offset(size.width, atY))
    drawLine(color, Offset(size.width, atY), Offset(size.width - arrowSize, atY + arrowSize))
    drawLine(color, Offset(size.width, atY), Offset(size.width - arrowSize, atY - arrowSize))
}
