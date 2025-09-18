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

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconToggleButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.android.mechanics.MotionValueState
import com.android.mechanics.debug.DebugMotionValueVisualization
import com.android.mechanics.debug.LocalMotionValueDebugController
import com.android.mechanics.debug.MotionValueDebuggerProvider
import com.android.mechanics.spec.MotionSpec
import kotlin.math.max
import kotlin.math.round

interface Demo<T> {
    val identifier: String

    @Composable fun rememberDefaultConfig(): T

    @Composable fun BoxScope.DemoUi(config: T, modifier: Modifier)

    fun Modifier.demoWidth() = this.then(Modifier.width(300.dp))
}

interface HasConfig<T> {
    @Composable fun ColumnScope.ConfigUi(config: T, onConfigChanged: (T) -> Unit)
}

interface HasReset

interface HasMotionValueVisualization {
    val visualizationInputRange: ClosedFloatingPointRange<Float>

    fun computeOutputRange(spec: MotionSpec, inputRange: ClosedFloatingPointRange<Float>) =
        DebugMotionValueVisualization.default(spec, inputRange)
}

@Composable
fun <T> Demo<T>.ConfigurableDemo(modifier: Modifier = Modifier) {
    val defaultConfig = rememberDefaultConfig()

    var config by remember { mutableStateOf(defaultConfig) }
    var resetIteration by remember { mutableStateOf(0) }
    var showConfig by remember { mutableStateOf(false) }

    MotionValueDebuggerProvider {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier) {
            Row {
                // actual demo
                Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth()) {
                        Surface(
                            tonalElevation = 1.dp,
                            shape = RoundedCornerShape(8.dp),
                            border =
                                BorderStroke(Dp.Hairline, MaterialTheme.colorScheme.outlineVariant),
                            modifier = Modifier.padding(16.dp).demoWidth(),
                        ) {
                            key(resetIteration) {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    DemoUi(config, modifier = Modifier.fillMaxWidth())
                                }
                            }
                        }
                    }
                }
                Column(modifier = Modifier) {
                    // Action buttons
                    if (this@ConfigurableDemo is HasReset) {
                        IconButton(onClick = { resetIteration++ }) {
                            Icon(Icons.Default.Refresh, "Reset")
                        }
                    }

                    if (this@ConfigurableDemo is HasConfig<*>) {
                        IconToggleButton(
                            checked = showConfig,
                            onCheckedChange = { showConfig = it },
                        ) {
                            Icon(Icons.Default.Settings, "Config")
                        }
                    }
                }
            }

            if (this@ConfigurableDemo is HasMotionValueVisualization) {
                // Visualization below
                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier =
                        Modifier.weight(1f, fill = true)
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                ) {
                    val debuggerState = checkNotNull(LocalMotionValueDebugController.current)

                    debuggerState.observed.forEachIndexed { index, motionValue ->
                        key(motionValue) { DebugVisualization(motionValue, DpSize(300.dp, 150.dp)) }
                    }
                }
            }
        }

        if (showConfig) {
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxHeight().verticalScroll(rememberScrollState()),
            ) {
                this@ConfigurableDemo as HasConfig<T>
                ConfigUi(config, { config = it })
            }
        }
    }
}

@Composable
fun HasMotionValueVisualization.DebugVisualization(
    motionValue: MotionValueState,
    size: DpSize,
    modifier: Modifier = Modifier,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = modifier) {
        Text(
            motionValue.label ?: "(no label)",
            style = MaterialTheme.typography.labelSmall,
            modifier =
                Modifier.layout { measurable, constraints ->
                    val placeable = measurable.measure(constraints)
                    this.layout(placeable.height, placeable.width) {
                        placeable.placeWithLayer(
                            x = -(placeable.width / 2 - placeable.height / 2),
                            y = -(placeable.height / 2 - placeable.width / 2),
                        ) {
                            this.rotationZ = -90f
                        }
                    }
                },
        )
        DebugMotionValueVisualization(
            motionValue,
            visualizationInputRange,
            outputRange = ::computeOutputRange,
            modifier = Modifier.size(size),
        )
        val inspector = remember(motionValue) { motionValue.debugInspector() }

        fun formattedFloat(value: Float): String {
            var string = (round(value * 100) / 100f).toString()
            // https://youtrack.jetbrains.com/issue/KT-78497/
            val dotIndex = string.indexOf('.')
            return if (dotIndex >= 0) string.substring(0, dotIndex + 3) else string
        }

        val valuesWithLabels =
            listOf(
                "Input" to formattedFloat(inspector.frame.input),
                "Direction" to (inspector.frame.gestureDirection),
                "Output" to formattedFloat(inspector.frame.output),
                "Target" to formattedFloat(inspector.frame.outputTarget),
                "Stable" to (inspector.frame.isStable.toString()),
                "Semantics" to
                    inspector.frame.semantics.joinToString("\n") {
                        "${it.key.debugLabel}: ${it.value}"
                    },
            )

        Layout(
            content = {
                valuesWithLabels.forEach { (label, value) ->
                    Text(
                        "$label:",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(value.toString(), style = MaterialTheme.typography.bodySmall)
                }
            }
        ) { measurables, constraints ->
            val labels =
                measurables
                    .filterIndexed { index, _ -> index % 2 == 0 }
                    .map { it.measure(constraints) }
            val values =
                measurables
                    .filterIndexed { index, _ -> index % 2 == 1 }
                    .map { it.measure(constraints) }

            val xPadding = 16.dp.roundToPx()
            val xSpacing = 4.dp.roundToPx()

            val labelWidth = labels.maxOf { it.width }
            val valueWith = values.maxOf { it.width }
            val rowHeights =
                labels.zip(values).map { (label, value) -> max(label.height, value.height) }

            val totalHeight = rowHeights.sum()
            layout(labelWidth + valueWith, totalHeight) {
                var y = 0

                for (row in rowHeights.indices) {
                    val label = labels[row]
                    val value = values[row]
                    label.placeRelative(xPadding + labelWidth - label.width, y)
                    value.placeRelative(xPadding + labelWidth + xSpacing, y)
                    y += rowHeights[row]
                }
            }
        }
    }
}
