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

package com.android.mechanics.demo.demos

import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.android.compose.animation.scene.ElementKey
import com.android.compose.animation.scene.MutableSceneTransitionLayoutState
import com.android.compose.animation.scene.OverlayKey
import com.android.compose.animation.scene.SceneKey
import com.android.compose.animation.scene.SceneTransitionLayout
import com.android.compose.animation.scene.Swipe
import com.android.compose.animation.scene.UserActionResult
import com.android.compose.animation.scene.reveal.ContainerRevealHaptics
import com.android.compose.animation.scene.reveal.verticalContainerReveal
import com.android.compose.animation.scene.transitions
import com.android.mechanics.behavior.VerticalExpandContainerSpec
import com.android.mechanics.behavior.verticalExpandContainerBackground
import com.android.mechanics.demo.tuneable.Demo

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
object VerticalContainerRevealDemo : Demo<Unit> {
    override val identifier: String
        get() = "VerticalContainerRevealDemo"

    val TheOverlay = OverlayKey("TheOverlay")
    val TheContainer = ElementKey("TheContainer")
    val TheScene = SceneKey("TheScene")

    val expandSpec = VerticalExpandContainerSpec(isFloating = false)

    val transitions = transitions {
        to(TheOverlay) {
            spec = tween(500)
            verticalContainerReveal(
                TheContainer,
                expandSpec,
                object : ContainerRevealHaptics {
                    override fun onRevealThresholdCrossed(revealed: Boolean) {}
                },
                useMechanics = true,
            )
        }
    }

    @Composable
    override fun DemoUi(config: Unit, modifier: Modifier) {
        val motionScheme = MaterialTheme.motionScheme
        val colorScheme = MaterialTheme.colorScheme

        Box(
            contentAlignment = Alignment.TopCenter,
            modifier =
                modifier
                    .fillMaxSize()
                    .clip(shape = RoundedCornerShape(64.dp))
                    .border(
                        width = 8.dp,
                        color = colorScheme.outline,
                        shape = RoundedCornerShape(64.dp),
                    )
                    .padding(8.dp),
        ) {
            val state =
                remember(motionScheme) {
                    MutableSceneTransitionLayoutState(
                        TheScene,
                        transitions = transitions,
                        motionScheme = motionScheme,
                    )
                }

            SceneTransitionLayout(state = state, modifier = Modifier.fillMaxSize()) {
                scene(TheScene, mapOf(Swipe.Down to UserActionResult.ShowOverlay(TheOverlay))) {
                    Surface(
                        color = colorScheme.surfaceContainerLow,
                        modifier = Modifier.height(300.dp),
                    ) {}
                }
                overlay(
                    TheOverlay,
                    mapOf(Swipe.Up to UserActionResult.HideOverlay(TheOverlay)),
                    alignment = Alignment.TopCenter,
                ) {
                    Box(
                        Modifier.fillMaxWidth()
                            .element(TheContainer)
                            .verticalExpandContainerBackground(
                                backgroundColor = colorScheme.primary,
                                spec = expandSpec,
                            )
                    ) {
                        Column(
                            modifier =
                                Modifier.fillMaxWidth()
                                    .padding(16.dp)
                                    .border(width = Dp.Hairline, color = colorScheme.onPrimary)
                        ) {
                            repeat(20) {
                                Text(
                                    "I'm a proud part of the overlay!",
                                    color = colorScheme.onPrimary,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    @Composable override fun rememberDefaultConfig() = Unit
}
