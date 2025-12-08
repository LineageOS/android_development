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

@file:OptIn(ExperimentalAnimatableApi::class)

package com.android.mechanics.demo.wallpaper.experiment0

import android.util.Log
import androidx.compose.animation.core.ExperimentalAnimatableApi
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LookaheadScope
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasurePolicy
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.android.compose.gesture.NestedDraggable
import com.android.compose.gesture.effect.rememberOffsetOverscrollEffect
import com.android.compose.gesture.nestedDraggable
import com.android.mechanics.DistanceGestureContext
import com.android.mechanics.MotionValue
import com.android.mechanics.debug.DebugMotionValueVisualization
import com.android.mechanics.debug.debugMotionValue
import com.android.mechanics.demo.tuneable.Demo
import com.android.mechanics.demo.tuneable.DpSlider
import com.android.mechanics.demo.tuneable.HasMotionValueVisualization
import com.android.mechanics.demo.tuneable.SliderWithPreview
import com.android.mechanics.demo.tuneable.SpringParameterSection
import com.android.mechanics.demo.wallpaper.Carousel
import com.android.mechanics.demo.wallpaper.Options
import com.android.mechanics.demo.wallpaper.OptionsScope
import com.android.mechanics.demo.wallpaper.Preview
import com.android.mechanics.effects.ExpansionToggle.IsExpandedKey
import com.android.mechanics.effects.FixedValue
import com.android.mechanics.effects.Toggle
import com.android.mechanics.spec.DirectionalMotionSpec
import com.android.mechanics.spec.InputDirection
import com.android.mechanics.spec.Mapping
import com.android.mechanics.spec.MotionSpec
import com.android.mechanics.spec.SegmentSemanticValues
import com.android.mechanics.spec.builder.MotionBuilderContext
import com.android.mechanics.spec.builder.fixedSpatialValueSpec
import com.android.mechanics.spec.builder.rememberMotionBuilderContext
import com.android.mechanics.spec.builder.spatialMotionSpec
import com.android.mechanics.spec.with
import com.android.mechanics.spring.SpringParameters
import kotlin.coroutines.cancellation.CancellationException
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sign
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch

// Start directly with:
// --es debug_start_destination "customization-mechanics-experiment-0-demo"
object CustomizationMechanicsDemo :
    Demo<CustomizationMechanicsDemo.Config>, HasMotionValueVisualization {

    data class Config(
        val minPreviewHeight: Dp = 200.dp,
        val expandedPreviewHeight: Dp = 500.dp,
        val optionCount: Int = 4,
        val toggleFraction: Float = Toggle.Defaults.ToggleFraction,
        val preToggleScale: Float = Toggle.Defaults.PreToggleScale,
        val postToggleScale: Float = Toggle.Defaults.PostToggleScale,
        val spring: SpringParameters = Toggle.Defaults.Spring,
        val flingVelocity: Dp = 500.dp,
    )

    override val identifier: String = "customization-mechanics-experiment-0-demo"

    @Composable
    override fun DemoUi(config: Config, modifier: Modifier) {
        CustomizationPickerRootContent(config, modifier)
    }

    @Composable
    override fun rememberDefaultConfig(): Config {
        return remember { Config() }
    }

    @Composable
    override fun ColumnScope.ConfigUi(config: Config, onConfigChanged: (Config) -> Unit) {
        Text("Min Preview Height")
        DpSlider(
            config.minPreviewHeight,
            { onConfigChanged(config.copy(minPreviewHeight = it)) },
            valueRange = 48.dp..500.dp,
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Expanded Preview Height")
        DpSlider(
            config.expandedPreviewHeight,
            { onConfigChanged(config.copy(expandedPreviewHeight = it)) },
            valueRange = config.minPreviewHeight..1000.dp,
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Option Count")
        SliderWithPreview(
            config.optionCount.toFloat(),
            { onConfigChanged(config.copy(optionCount = it.toInt())) },
            valueRange = 1f..10f,
            normalize = { it.roundToInt().toFloat() },
            render = { it.toInt().toString() },
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Toggle", style = MaterialTheme.typography.titleMedium)

        Text("Toggle Position")
        SliderWithPreview(
            config.toggleFraction,
            { onConfigChanged(config.copy(toggleFraction = it)) },
            valueRange = 0f..1f,
            render = { "${(it * 100).toInt()}%" },
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Pre-toggle Scale")
        SliderWithPreview(
            config.preToggleScale,
            { onConfigChanged(config.copy(preToggleScale = it)) },
            valueRange = 0f..1f,
            render = { "${(it * 100).toInt()}%" },
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Post-toggle Scale")
        SliderWithPreview(
            config.postToggleScale,
            { onConfigChanged(config.copy(postToggleScale = it)) },
            valueRange = 0f..1f,
            render = { "${(it * 100).toInt()}%" },
            modifier = Modifier.fillMaxWidth(),
        )

        SpringParameterSection(
            "Toggle Spring",
            config.spring,
            { onConfigChanged(config.copy(spring = it)) },
            "spring",
            Modifier.fillMaxWidth(),
        )

        Text("Fling Velocity dp/s")
        DpSlider(
            config.flingVelocity,
            { onConfigChanged(config.copy(flingVelocity = it)) },
            valueRange = 100.dp..5000.dp,
            modifier = Modifier.fillMaxWidth(),
        )
    }

    @Composable
    fun CustomizationPickerRootContent(config: Config, modifier: Modifier = Modifier) {
        // PickerRootLayout contains all the logic for layout and defines the motion.
        // It *does* make assumptions about the contents (that there are exactly three nodes, the
        // preview, carousel, and options, and in exactly this order). The PickerRootLayout is not
        // a "generic" implementation, but here to split / un-nest the logic a bit.

        PickerRootLayout(config, modifier = modifier.fillMaxSize().padding(24.dp)) { isExpanded ->
            Preview()
            Carousel(isExpanded, modifier = Modifier.padding(vertical = 24.dp))
            Options(config.optionCount)
        }
    }

    override var visualizationInputRange by mutableStateOf(0f..1f)

    @Composable
    private fun PickerRootLayout(
        config: Config,
        modifier: Modifier = Modifier,
        contents: @Composable PickerRootLayoutScope.(isExpanded: Boolean) -> Unit,
    ) {

        // We need a LookaheadScope to allow us measuring what the content will look like if we
        // toggle
        // the expand/collapse before we actually show that to the user.
        LookaheadScope {
            val touchSlop = LocalViewConfiguration.current.touchSlop
            val motionBuilderContext = rememberMotionBuilderContext()
            val overscrollEffect = rememberOffsetOverscrollEffect()

            // For readability, I extract a bunch of the logic in a PickerRootLayoutController,
            // instead
            // of keeping this all inline. The layoutController implements a couple interfaces that
            // all
            // work in tandem:
            // - the MeasurePolicy to perform the layout
            // - The NestedDraggable to respond to drags and overscroll
            // - the PickerRootLayoutScope to expose some of the internal to the `contents`
            // - all the internal state and motion value.
            val layoutController =
                remember(touchSlop, motionBuilderContext) {
                        PickerRootLayoutController(config, touchSlop, motionBuilderContext)
                    }
                    .also {
                        // the layoutController is intentionally not re-created should these change.
                        // But we update the controller's state with it.
                        it.config = config
                    }

            LaunchedEffect(layoutController) { layoutController.keepRunning() }
            // This root layout connects everything:
            // - It contains the `content`
            // - layouts the content's nodes
            // - adds the `nestedDraggable` modifier for handling the nested scrolls overscroll, its
            //   own dragging, and the overscroll effect that offsets the complete container if
            // needed.
            Layout(
                modifier =
                    modifier
                        .nestedDraggable(
                            draggable = layoutController,
                            orientation = Orientation.Vertical,
                            overscrollEffect = overscrollEffect,
                        )
                        .debugMotionValue(layoutController.animatedPreviewHeight)
                        .debugMotionValue(layoutController.animatedCarouselHeight),
                content = { with(layoutController) { contents(isExpanded) } },
                measurePolicy = layoutController,
            )

            visualizationInputRange =
                with(layoutController) {
                    if (
                        targetHeightByState.expanded.isSpecified &&
                            targetHeightByState.collapsed.isSpecified
                    ) {
                        targetHeightByState.collapsed.preview..targetHeightByState.expanded.preview
                    } else {
                        0f..1f
                    }
                }
        }
    }
}

interface PickerRootLayoutScope : OptionsScope

// Helper data class to capture the lookahead height of both, the preview and carousel.
data class TargetHeight(val preview: Float, val carousel: Float) {
    val isSpecified
        get() = this != Unspecified

    companion object {
        // Initially, we would not know the size. We mark this with NaN
        val Unspecified = TargetHeight(Float.NaN, Float.NaN)
    }
}

// Helper data class to capture the lookahead height of both, the preview and carousel while
// expanded and collapsed.
// Could be modelled as a `@JvmInline value class`
data class TargetHeightByState(val expanded: TargetHeight, val collapsed: TargetHeight) {

    operator fun get(isExpanded: Boolean): TargetHeight = if (isExpanded) expanded else collapsed

    fun copyWithTargetHeight(isExpanded: Boolean, value: TargetHeight): TargetHeightByState {
        return if (isExpanded) copy(expanded = value) else copy(collapsed = value)
    }

    companion object {
        val Unspecified = TargetHeightByState(TargetHeight.Unspecified, TargetHeight.Unspecified)
    }
}

private class PickerRootLayoutController(
    initialConfig: CustomizationMechanicsDemo.Config,
    touchSlop: Float,
    val motionBuilderContext: MotionBuilderContext,
) : PickerRootLayoutScope, NestedDraggable, NestedDraggable.Controller, MeasurePolicy {

    var config by mutableStateOf(initialConfig)

    val mechanicToggle by derivedStateOf {
        Toggle(
            stateKey = IsExpandedKey,
            minState = false,
            maxState = true,
            toggleFraction = config.toggleFraction,
            preToggleScale = config.preToggleScale,
            postToggleScale = config.postToggleScale,
            spring = config.spring,
        )
    }

    val expandedPreviewHeight
        get() = config.expandedPreviewHeight

    val minPreviewHeight
        get() = config.minPreviewHeight

    // keep track of the target layout state.
    var isExpanded by mutableStateOf(true)
    // keep track of the "lookahead heights" of both, the preview and carousel, in both, the
    // expanded and collapsed state. Since they do not update frequently, and its only a limited
    // number of elements, we keep them in this TargetHeightByState data class.
    var targetHeightByState by mutableStateOf(TargetHeightByState.Unspecified)
    // indicates whether the user is dragging, either by dragging the preview or overscrolling the
    // options scroll.
    var isDragging by mutableStateOf(false)

    // The scroll state for the options scroll. Currently we are not doing anything with it - but we
    // could scroll this here if we want to.
    val scrollState = ScrollState(initial = 0)

    // Keeps track of the drag / overscroll gesture.
    private val gestureContext =
        DistanceGestureContext(0f, InputDirection.Max, directionChangeSlop = touchSlop)

    // IMPORTANT: the MotionValue inputs are the dragged **preview** height. Everything is driven
    // off the preview height, the carousel only follows suit.
    val input = mutableFloatStateOf(0f)

    // produces the actual height of the preview. This drives the layout, except during lookahead
    // passes.
    var previewHeightSpec = mutableStateOf(motionBuilderContext.fixedSpatialValueSpec(0f))
    val animatedPreviewHeight =
        MotionValue(input::floatValue, gestureContext, previewHeightSpec::value)

    // produces the actual height of the carousel. This drives the layout, except during lookahead
    // passes.
    var carouselHeightSpec = mutableStateOf(motionBuilderContext.fixedSpatialValueSpec(0f))

    val animatedCarouselHeight =
        MotionValue(input::floatValue, gestureContext, carouselHeightSpec::value)

    // ---- PickerRootLayoutScope ------------------------------------------------------------------

    override fun Modifier.optionsScrollable(): Modifier =
        this.then(Modifier.verticalScroll(scrollState))

    // ---- NestedDraggable ------------------------------------------------------------------------

    override val autoStopNestedDrags: Boolean
        // keep the nested drags ongoing, unless we can actually scroll. in this case, allow
        // stopping this drag as soon as we do not consume the full drag anymore.
        get() = true

    override fun shouldConsumeNestedPostScroll(sign: Float): Boolean {
        // Always consume overscrolls of the nested optionsScrollable. Even if this cannot consume
        // it, the overscroll needs to be propagated further.
        return true
    }

    override fun shouldConsumeNestedPreScroll(sign: Float): Boolean {
        // This can consume the optionScrollables scroll, even if it can scroll. This is used to
        // collapse the preview if the user tries to scroll the options up while expanded.

        // Hence, this is only applicable when:

        // dragging upwards
        val b =
            sign < 0f &&
                // the preview is not collapsed
                (animatedPreviewHeight[IsExpandedKey] ?: false)

        Log.d("MIKES", "shouldConsumeNestedPreScroll() -> $b")
        return b
    }

    override fun onDragStarted(
        position: Offset,
        sign: Float,
        pointersDown: Int,
        pointerType: PointerType?,
    ): NestedDraggable.Controller {

        // When a drag starts, always and immediately toggle the expansion state. This ensures we'll
        // get a lookahead for the other size. The actual state is not something we care about,
        // since we are transitioning between expanded and collapsed anyways.
        isExpanded = !isExpanded

        // But we do indicate that by setting the isDragging to true.
        isDragging = true

        // We never know what state the last gesture left us in. But since we are starting a drag,
        // we start from the current value (in case an animation is in progress while we start
        // another drag)
        input.floatValue = animatedPreviewHeight.output
        gestureContext.reset(
            input.floatValue,
            // The initial gesture direction can be derived from the direction of the touch slop we
            // passed.
            if (sign < 0) InputDirection.Min else InputDirection.Max,
        )

        return this
    }

    override fun onDrag(delta: Float): Float {
        // On the gestureContext side, we do not coerce the value
        gestureContext.dragOffset += delta

        // While dragging, accumulate and coerce the delta.
        val oldInput = input.floatValue
        input.floatValue =
            (oldInput + delta).coerceIn(
                targetHeightByState.collapsed.preview,
                targetHeightByState.expanded.preview,
            )

        // By coercing, we can easily determine how much we were able to consume.
        return input.floatValue - oldInput
    }

    override suspend fun onDragStopped(velocity: Float, awaitFling: suspend () -> Unit): Float {
        isDragging = false

        val flingVelocity = with(motionBuilderContext) { config.flingVelocity.toPx() } // dp/s

        isExpanded =
            if (abs(velocity) > flingVelocity) {
                velocity.sign > 0
            } else {
                animatedPreviewHeight[IsExpandedKey] ?: !isExpanded
            }

        // TODO: We should figure out how much velocity we consumed. Right now, this produces the
        //  "overscroll" flicker when flinging.
        return velocity / 2f
    }

    // ---- MeasurePolicy --------------------------------------------------------------------------

    override fun MeasureScope.measure(
        measurables: List<Measurable>,
        constraints: Constraints,
    ): MeasureResult {

        val width = constraints.maxWidth
        val height = constraints.maxHeight

        if (isLookingAhead) {
            // During lookahead only, measure the layout irrespectively of animations and gestures.
            return measureLookahead(width, height, measurables)
        }

        // During regular layouts, measure preview and carousel using only the MotionValues output
        val previewPlaceable =
            measurables[0].measure(
                Constraints.fixed(width, animatedPreviewHeight.output.toInt().coerceAtLeast(0))
            )
        val carouselPlaceable =
            measurables[1].measure(
                Constraints.fixed(width, animatedCarouselHeight.output.toInt().coerceAtLeast(0))
            )
        // The options fill the remainder of the space below.
        val optionsPlaceable =
            measurables[2].measure(
                Constraints.fixed(
                    width,
                    (height - previewPlaceable.height - carouselPlaceable.height).coerceAtLeast(0),
                )
            )
        return layout(width, height) {
            previewPlaceable.place(0, 0)
            carouselPlaceable.place(0, previewPlaceable.height)
            optionsPlaceable.place(0, height - optionsPlaceable.height)
        }
    }

    private fun MeasureScope.measureLookahead(
        width: Int,
        height: Int,
        measurables: List<Measurable>,
    ): MeasureResult {
        // The carousel knows its height, just measure it.
        val carouselPlaceable = measurables[1].measure(Constraints.fixedWidth(width))
        val carouselHeight = carouselPlaceable.height

        val previewPlaceable: Placeable
        val optionsPlaceable: Placeable

        if (isExpanded) {
            // When expanded, we know the previews height, we can measure that first..
            previewPlaceable =
                measurables[0].measure(Constraints.fixed(width, expandedPreviewHeight.roundToPx()))
            val previewHeight = previewPlaceable.height

            // then measure the options using the remainder of the vertical space.
            optionsPlaceable =
                measurables[2].measure(
                    Constraints.fixed(
                        width,
                        (height - previewHeight - carouselHeight).coerceAtLeast(0),
                    )
                )
        } else {
            // when collapse, all we know is that the preview should be at least minPreviewHeight.
            // Thus, we measure the options first, limiting its height to leave at least
            // minPreviewHeight for the preview.
            val maxOptionsHeight = height - carouselHeight - minPreviewHeight.roundToPx()
            optionsPlaceable =
                measurables[2].measure(
                    Constraints(minWidth = width, maxWidth = width, maxHeight = maxOptionsHeight)
                )

            // Now the preview can fill the remainder, it is guaranteed to be at least
            // minPreviewHeight, but if the options did not use all the space available, we would
            // know now, and can grow the preview accordingly.
            previewPlaceable =
                measurables[0].measure(
                    Constraints.fixed(
                        width,
                        height =
                            (height - carouselHeight - optionsPlaceable.height).coerceAtLeast(0),
                    )
                )
        }

        // Since this is the lookahead pass, we memoize the lookahead size.
        val targetHeight = TargetHeight(previewPlaceable.height.toFloat(), carouselHeight.toFloat())
        targetHeightByState = targetHeightByState.copyWithTargetHeight(isExpanded, targetHeight)

        return layout(width, height) {
            previewPlaceable.place(0, 0)
            carouselPlaceable.place(0, previewPlaceable.height)
            optionsPlaceable.place(0, height - optionsPlaceable.height)
        }
    }

    suspend fun keepRunning() {
        coroutineScope {
            launch { animatedPreviewHeight.keepRunning() }
            launch { animatedCarouselHeight.keepRunning() }
            launch {
                snapshotFlow { animatedPreviewHeight[IsExpandedKey] }
                    .filter { it == true }
                    .collect {
                        try {
                            scrollState.scrollTo(0)
                        } catch (_: CancellationException) {
                            // Scrolling might be cancelled
                        }
                    }
            }

            launch {
                // TODO: b/428886057 - make this a derivedState instead
                // Right now, `MotionValue.spec` is a mutableState we have to set. I want to make
                // this
                // a getter, so that we can avoid this snapshotFlow.
                snapshotFlow {
                        GestureState(isExpanded, isDragging, targetHeightByState, mechanicToggle)
                    }
                    .filter {
                        // Only generate a spec if we saw the lookahead for the state, or for both,
                        // expanded and collapse, while dragging
                        targetHeightByState[isExpanded].isSpecified &&
                            (!isDragging || targetHeightByState[!isExpanded].isSpecified)
                    }
                    .collect {
                        with(motionBuilderContext) {
                            updateMotionSpecs(
                                it.isExpanded,
                                it.isDragging,
                                it.targetHeightByState,
                                it.toggle,
                            )
                        }
                    }
            }

            awaitCancellation()
        }
    }

    private fun MotionBuilderContext.updateMotionSpecs(
        isExpanded: Boolean,
        isDragging: Boolean,
        targetHeightByState: TargetHeightByState,
        mechanicToggle: Toggle<Boolean>,
    ) {

        val outputRangeHeight =
            targetHeightByState.expanded.takeIf { it.isSpecified } ?: TargetHeight(1f, 1f)

        val previewDebugVisualizationHint =
            listOf(
                DebugMotionValueVisualization.OutputRangeKey with
                    0f..(outputRangeHeight.preview * 1.1f)
            )
        val carouselDebugVisualizationHint =
            listOf(
                DebugMotionValueVisualization.OutputRangeKey with
                    0f..(outputRangeHeight.carousel * 1.1f)
            )

        val previewSpec: MotionSpec
        val carouselSpec: MotionSpec
        // Create the specs. The preview spec is the one driving the layout.
        if (isDragging) {
            // While dragging, we add the mechanic toggle effect
            previewSpec =
                spatialMotionSpec(semantics = previewDebugVisualizationHint) {
                    val expandedPreviewHeight = targetHeightByState.expanded.preview
                    val collapsedPreviewHeight = targetHeightByState.collapsed.preview
                    val toggleEffect =
                        between(collapsedPreviewHeight, expandedPreviewHeight, mechanicToggle)

                    before(toggleEffect, FixedValue(collapsedPreviewHeight))
                    after(toggleEffect, FixedValue(expandedPreviewHeight))
                }

            carouselSpec =
                MotionSpec(
                    toCarouselSpec(previewSpec.maxDirection, targetHeightByState),
                    toCarouselSpec(previewSpec.minDirection, targetHeightByState),
                    semantics = carouselDebugVisualizationHint,
                    segmentHandlers = previewSpec.segmentHandlers,
                )
        } else {
            // while not dragging, we just set the spec to produce the relevant lookahead value.
            previewSpec =
                fixedSpatialValueSpec(
                    targetHeightByState[isExpanded].preview,
                    semantics =
                        listOf(IsExpandedKey with isExpanded) + previewDebugVisualizationHint,
                )
            carouselSpec =
                fixedSpatialValueSpec(
                    targetHeightByState[isExpanded].carousel,
                    semantics = carouselDebugVisualizationHint,
                )
        }

        previewHeightSpec.value = previewSpec
        carouselHeightSpec.value = carouselSpec
        // for the carousel, we derive the spec from the preview spec.
    }
}

private data class GestureState(
    val isExpanded: Boolean,
    val isDragging: Boolean,
    val targetHeightByState: TargetHeightByState,
    val toggle: Toggle<Boolean>,
)

// TODO: b/428886712 - Experimenting with this, never did that before, but it's a somewhat
//  interesting idea to generate a spec for a separate value base on the main values spec. That way,
//  they are automatically in sync, if they share the same input.
fun toCarouselSpec(
    previewSpec: DirectionalMotionSpec,
    targetHeightByState: TargetHeightByState,
): DirectionalMotionSpec {
    // We simply produce the output value based on the IsExpanded semantics.
    @Suppress("UNCHECKED_CAST")
    val expandedSemantics =
        previewSpec.semantics.first { it.key == IsExpandedKey } as SegmentSemanticValues<Boolean>
    val mappings = expandedSemantics.values.map { Mapping.Fixed(targetHeightByState[it].carousel) }
    // We can reuse the same breakpoints, just produce a different output.
    return DirectionalMotionSpec(previewSpec.breakpoints, mappings)
}
