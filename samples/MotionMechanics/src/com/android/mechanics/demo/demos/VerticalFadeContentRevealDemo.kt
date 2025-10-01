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

package com.android.mechanics.demo.demos

import androidx.compose.animation.core.ExperimentalAnimatableApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AllInclusive
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MaterialTheme.typography
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.android.compose.animation.scene.ElementKey
import com.android.compose.animation.scene.mechanics.rememberGestureContext
import com.android.compose.modifiers.thenIf
import com.android.mechanics.compose.modifier.motionDriver
import com.android.mechanics.compose.modifier.verticalFadeContentReveal
import com.android.mechanics.demo.tuneable.DemoWithConfig
import com.android.mechanics.demo.tuneable.HasMotionValueVisualization
import com.android.mechanics.demo.tuneable.LabelledCheckbox
import com.android.mechanics.demo.util.ExpandableCard
import com.android.mechanics.spec.builder.rememberMotionBuilderContext

object Elements {
    val ExpandableContent = ElementKey("ExpandableContent")
}

object VerticalFadeContentRevealDemo :
    DemoWithConfig<VerticalFadeContentRevealDemo.Config>, HasMotionValueVisualization {

    data class Config(val showItemBackground: Boolean)

    @Composable
    override fun DemoUi(config: Config, modifier: Modifier) {
        val colors = MaterialTheme.colorScheme

        val motionContext = rememberMotionBuilderContext()

        Box(contentAlignment = Alignment.TopCenter, modifier = modifier.fillMaxSize()) {
            ExpandableCard(
                modifier = Modifier,
                header = { Text(text = "Contents", style = typography.titleMedium) },
            ) { isExpanded ->
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier =
                        Modifier.fillMaxWidth()
                            .element(Elements.ExpandableContent)
                            .motionDriver(rememberGestureContext())
                            .verticalScroll(rememberScrollState())
                            .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                ) {
                    if (isExpanded) {
                        Spacer(modifier = Modifier.height(24.dp))
                        repeat(10) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier =
                                    Modifier.noResizeDuringTransitions()
                                        .verticalFadeContentReveal()
                                        .fillMaxWidth()
                                        .thenIf(config.showItemBackground) {
                                            Modifier.background(colors.primary)
                                        },
                            ) {
                                CompositionLocalProvider(
                                    LocalContentColor provides
                                        if (config.showItemBackground) colors.onPrimary
                                        else colors.onSurface
                                ) {
                                    Icon(Icons.Default.AllInclusive, null)
                                    Text(text = "Item ${it + 1}", modifier = Modifier.height(20.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @OptIn(ExperimentalMaterial3ExpressiveApi::class)
    @Composable
    override fun rememberDefaultConfig(): Config {
        return remember() { Config(showItemBackground = false) }
    }

    @Composable
    override fun ColumnScope.ConfigUi(config: Config, onConfigChanged: (Config) -> Unit) {
        LabelledCheckbox(
            "Show item background",
            config.showItemBackground,
            onCheckedChange = { onConfigChanged(config.copy(showItemBackground = it)) },
            modifier = Modifier.fillMaxWidth(),
        )
    }

    override val identifier: String = "vertical_fade_content_reveal"
    override val visualizationInputRange: ClosedFloatingPointRange<Float>
        get() = 0f..1000f
}
