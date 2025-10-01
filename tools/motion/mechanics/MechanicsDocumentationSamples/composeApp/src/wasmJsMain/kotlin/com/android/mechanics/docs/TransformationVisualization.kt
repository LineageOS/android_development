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

package com.android.mechanics.docs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.ObserverModifierNode
import androidx.compose.ui.node.observeReads
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Density
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
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

abstract class Axis(val label: String) {

    abstract fun Density.format(value: Float, range: ClosedFloatingPointRange<Float>): String

    class Spatial(label: String) : Axis(label) {

        override fun Density.format(value: Float, range: ClosedFloatingPointRange<Float>): String {
            return "${value.roundToInt()}"
        }
    }

    companion object {
        val Input = Axis.Spatial("Input")
        val Output = Axis.Spatial("Output")
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
                .background(color = colors.surfaceContainer)
                .visualizationAxis(colors.outline, inputRange, inputRange, inputAxis, outputAxis)
                .clipToBounds()
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
fun Modifier.visualizationAxis(
    labelColor: Color,
    inputRange: ClosedFloatingPointRange<Float>,
    outputRange: ClosedFloatingPointRange<Float>,
    inputAxis: Axis,
    outputAxis: Axis,
    textMeasurer: TextMeasurer = rememberTextMeasurer(),
    valueLabelStyle: TextStyle = MaterialTheme.typography.bodySmall,
    axisLabelStyle: TextStyle = MaterialTheme.typography.labelSmallEmphasized,
) =
    this then
        Modifier.drawBehind {
            // Define paddings and constants
            val axisTitlePadding = 32.dp.toPx()
            val tickLabelPadding = 8.dp.toPx()
            val tickLength = 5.dp.toPx()

            // 1. Draw solid axes with arrows
            drawYAxis(color = labelColor, atX = 0f) // Y-Axis on the left edge
            drawXAxis(color = labelColor, atY = size.height) // X-Axis on the bottom edge

            // 2. Draw Ticks and Labels for X-Axis
            val xValues = generateTicks(inputRange)

            xValues.forEachIndexed { index, value ->
                val label =
                    textMeasurer.measure(
                        with(inputAxis) { format(value, inputRange) },
                        style = valueLabelStyle,
                    )
                val x = mapPointInInputToX(value, inputRange)

                // Draw tick
                if (index != xValues.lastIndex) {
                    drawLine(
                        labelColor,
                        Offset(x, size.height),
                        Offset(x, size.height - tickLength),
                    )
                }
                // Draw vertical label on the right side, rotated around its center
                val pivotPoint =
                    Offset(x - label.size.height / 2, size.height + tickLabelPadding / 2)

                //                val labelX = size.width + tickLabelPadding + label.size.height /
                // 2f

                rotate(degrees = -45f, pivot = pivotPoint) {
                    drawText(
                        label,
                        labelColor,
                        topLeft = Offset(pivotPoint.x - label.size.width, pivotPoint.y),
                    )
                }
            }

            // 3. Draw Ticks and Labels for Y-Axis
            val yValues = generateTicks(outputRange)

            yValues.forEachIndexed { index, value ->
                val label =
                    textMeasurer.measure(
                        with(outputAxis) { format(value, outputRange) },
                        style = valueLabelStyle,
                    )
                val y = mapPointInOutputToY(value, outputRange)

                // Draw tick
                if (index != yValues.lastIndex) {
                    drawLine(labelColor, Offset(0f, y), Offset(tickLength, y))
                }
                // Draw vertical label on the right side, rotated around its center
                val pivotPoint = Offset(0f, y - tickLabelPadding)

                rotate(degrees = -45f, pivot = pivotPoint) {
                    drawText(
                        label,
                        labelColor,
                        topLeft =
                            Offset(
                                pivotPoint.x - label.size.width - tickLabelPadding,
                                pivotPoint.y - label.size.height / 2f,
                            ),
                    )
                }
            }

            // 4. Draw dashed lines for origin (0,0) if visible
            val x0 = mapPointInInputToX(0f, inputRange)
            if (x0 > 0 && x0 < size.width) {
                drawLine(
                    labelColor,
                    Offset(x0, 0f),
                    Offset(x0, size.height),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())),
                )
            }
            val y0 = mapPointInOutputToY(0f, outputRange)
            if (y0 > 0 && y0 < size.height) {
                drawLine(
                    labelColor,
                    Offset(0f, y0),
                    Offset(size.width, y0),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())),
                )
            }

            // 5. Draw Axis Titles
            // X-Axis Title at the bottom
            val inAxisLabel = textMeasurer.measure(inputAxis.label, style = axisLabelStyle)
            drawText(
                inAxisLabel,
                labelColor,
                Offset((size.width - inAxisLabel.size.width) / 2f, size.height + axisTitlePadding),
            )

            // Y-Axis Title on the left
            val outAxisLabel = textMeasurer.measure(outputAxis.label, style = axisLabelStyle)
            val outAxisLabelCenter = Offset(-axisTitlePadding, size.height / 2f)
            rotate(degrees = -90f, pivot = outAxisLabelCenter) {
                drawText(
                    outAxisLabel,
                    labelColor,
                    topLeft =
                        outAxisLabelCenter -
                            Offset(outAxisLabel.size.width / 2f, outAxisLabel.size.height / 2f),
                )
            }
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
        if (currentSpec != MotionSpec.InitiallyUndefined) {
            drawDirectionalSpec(
                currentSpec[currentSegmentKey.direction],
                inputRange,
                outputRange,
                color,
                activeSegment = currentSegmentKey,
            )
        }
        drawInputOutputTrail(history, inputRange, outputRange, colorLight, color, colorDark)
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
): Float {
    val inputExtent = (inputRange.endInclusive - inputRange.start)
    var scale = ((input - inputRange.start) / (inputExtent))
    return scale * size.width
}

private fun DrawScope.mapPointInOutputToY(
    output: Float,
    outputRange: ClosedFloatingPointRange<Float>,
): Float {
    val outputExtent = (outputRange.endInclusive - outputRange.start)
    return (1f - ((output - outputRange.start) / (outputExtent))) * size.height
}

private fun DrawScope.drawDirectionalSpec(
    spec: DirectionalMotionSpec,
    inputRange: ClosedFloatingPointRange<Float>,
    outputRange: ClosedFloatingPointRange<Float>,
    color: Color,
    activeSegment: SegmentKey?,
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

        val strokeWidth = 2.dp.toPx()
        val dotSize = 4.dp.toPx()
        val fromY = mapPointInOutputToY(mapping.map(fromInput), outputRange)
        val toY = mapPointInOutputToY(mapping.map(toInput), outputRange)

        val start = Offset(mapPointInInputToX(fromInput, inputRange), fromY)
        val end = Offset(mapPointInInputToX(toInput, inputRange), toY)
        if (mapping is Mapping.Fixed || mapping is Mapping.Identity || mapping is Mapping.Linear) {
            drawLine(color, start, end, strokeWidth = strokeWidth)
        } else {
            val xStart = mapPointInInputToX(fromInput, inputRange)
            val xEnd = mapPointInInputToX(toInput, inputRange)

            val oneDpInPx = 1.dp.toPx()
            val numberOfLines = ceil((xEnd - xStart) / oneDpInPx).toInt()
            val inputLength = (toInput - fromInput) / numberOfLines

            repeat(numberOfLines) {
                val lineStart = fromInput + inputLength * it
                val lineEnd = lineStart + inputLength

                val partialFromY = mapPointInOutputToY(mapping.map(lineStart), outputRange)
                val partialToY = mapPointInOutputToY(mapping.map(lineEnd), outputRange)

                val partialStart = Offset(mapPointInInputToX(lineStart, inputRange), partialFromY)
                val partialEnd = Offset(mapPointInInputToX(lineEnd, inputRange), partialToY)

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
                        mapPointInInputToX(guaranteePos, inputRange),
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
) {
    history.fastForEachIndexed { index, frame ->
        val x = mapPointInInputToX(frame.input, inputRange)
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

/**
 * Generates a list of "nice" numbers for ticks on a chart axis.
 *
 * @param range The range of the data.
 * @param maxTicks The target number of ticks.
 * @return A sorted list of tick values.
 */
private fun generateTicks(range: ClosedFloatingPointRange<Float>, maxTicks: Int = 6): List<Float> {
    val ticks = mutableSetOf<Float>()

    // 1. Always add min and max
    ticks.add(range.start)
    ticks.add(range.endInclusive)

    // 2. Always add 0 if it's in the range
    if (range.contains(0f)) {
        ticks.add(0f)
    }

    // 3. Add a few round numbers
    val span = range.endInclusive - range.start
    if (span <= 0) {
        return ticks.sorted()
    }

    val roughStep = span / (maxTicks - 1)
    if (roughStep <= 0) return ticks.sorted() // Avoid log10(0) or negative

    val magnitude = 10.0.pow(floor(log10(roughStep.toDouble()))).toFloat()
    val residual = roughStep / magnitude

    val niceStep =
        when {
            residual > 5 -> 10 * magnitude
            residual > 2 -> 5 * magnitude
            residual > 1 -> 2 * magnitude
            else -> magnitude
        }

    if (niceStep <= 0) return ticks.sorted()

    var currentTick = ceil(range.start / niceStep) * niceStep
    while (currentTick < range.endInclusive) {
        if (range.contains(currentTick)) {
            ticks.add(currentTick)
        }
        currentTick += niceStep
    }

    return ticks.sorted()
}
