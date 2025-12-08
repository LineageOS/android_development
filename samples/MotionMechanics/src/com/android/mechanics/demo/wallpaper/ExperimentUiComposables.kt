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

@file:OptIn(ExperimentalMaterial3Api::class)

package com.android.mechanics.demo.wallpaper

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.carousel.HorizontalMultiBrowseCarousel
import androidx.compose.material3.carousel.rememberCarouselState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.layout.approachLayout
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp

@Composable
fun Carousel(isExpanded: Boolean, modifier: Modifier = Modifier) {
    // FIXME: This is a hacky implementation - do not copy or use outside of this prototype
    Column(
        verticalArrangement = Arrangement.Center,
        modifier =
            modifier
                .height(if (isExpanded) 168.dp else 48.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(MaterialTheme.colorScheme.surfaceContainer),
    ) {
        var targetSize by remember { mutableStateOf(IntSize.Zero) }

        HorizontalMultiBrowseCarousel(
            state = rememberCarouselState { 20 },
            modifier =
                Modifier.fillMaxWidth()
                    .wrapContentHeight()
                    .approachLayout(
                        isMeasurementApproachInProgress = {
                            if (isExpanded) {
                                targetSize = it
                            }

                            true
                        }
                    ) { measurable, constraints ->
                        val progress =
                            ((constraints.maxHeight - 48.dp.toPx()) / (168.dp - 48.dp).toPx())
                                .coerceIn(0f..1f)

                        val c =
                            Constraints.fixed(
                                targetSize.width,
                                height = (progress * targetSize.height).toInt(),
                            )

                        measurable.measure(c).run {
                            layout(width, height) {
                                placeWithLayer(0, 0) { alpha = (progress * 3).coerceIn(0f..1f) }
                            }
                        }
                    }
                    .padding(vertical = 16.dp, horizontal = 8.dp),
            preferredItemWidth = 140.dp,
            itemSpacing = 8.dp,
            contentPadding = PaddingValues(horizontal = 8.dp),
        ) { i ->
            Box(
                modifier =
                    Modifier.size(140.dp, 100.dp)
                        .maskClip(MaterialTheme.shapes.extraLarge)
                        .background(
                            Color.hsl(
                                hue = ((60 * i + 35) % 360).toFloat(),
                                lightness = 0.3f,
                                saturation = 0.9f,
                            )
                        )
            )
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            modifier = Modifier.fillMaxWidth().wrapContentHeight(),
        ) {
            Icon(Icons.Outlined.Image, null)
            Text(text = "Backgrounds")
        }
    }
}

data class OptionRowModel(val label: String)

interface OptionsScope {
    fun Modifier.optionsScrollable(): Modifier
}

@Composable
fun OptionsScope.Options(optionCount: Int, modifier: Modifier = Modifier) {
    // FIXME: This is a hacky implementation - do not copy or use outside of this prototype
    Column(
        verticalArrangement = Arrangement.spacedBy(2.dp),
        modifier = modifier.optionsScrollable(),
    ) {
        val options =
            remember(optionCount) { List(optionCount) { OptionRowModel("Option ${it + 1}") } }
        options.forEachIndexed { index, model ->
            OptionRow(model, index == 0, index == options.lastIndex, Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun OptionRow(
    viewModel: OptionRowModel,
    isFirst: Boolean,
    isLast: Boolean,
    modifier: Modifier = Modifier,
) {
    val backgroundColor = MaterialTheme.colorScheme.surfaceContainer
    val contentColor = MaterialTheme.colorScheme.onSurface

    fun targetRadius(isLarge: Boolean): Dp {
        return if (isLarge) 24.dp else 4.dp
    }

    val topRadius by animateDpAsState(targetRadius(isLarge = isFirst))
    val bottomRadius by animateDpAsState(targetRadius(isLarge = isLast))

    val path = remember { Path() }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier =
            modifier
                .drawWithCache {
                    val topCornerRadius = CornerRadius(topRadius.toPx())
                    val bottomCornerRadius = CornerRadius(bottomRadius.toPx())

                    path.reset()
                    path.addRoundRect(
                        RoundRect(
                            0f,
                            0f,
                            size.width,
                            size.height,
                            topLeftCornerRadius = topCornerRadius,
                            topRightCornerRadius = topCornerRadius,
                            bottomLeftCornerRadius = bottomCornerRadius,
                            bottomRightCornerRadius = bottomCornerRadius,
                        )
                    )

                    onDrawWithContent { clipPath(path) { this@onDrawWithContent.drawContent() } }
                }
                .wrapContentHeight()
                .background(backgroundColor)
                .padding(16.dp),
    ) {
        Text(viewModel.label, color = contentColor, style = MaterialTheme.typography.titleMedium)
        Box(
            modifier =
                Modifier.size(64.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh)
        )
    }
}

@Composable
fun Preview(modifier: Modifier = Modifier) {
    // FIXME: This is a hacky implementation - do not copy or use outside of this prototype

    val aspectRatio = LocalWindowInfo.current.containerSize.let { it.width / it.height.toFloat() }
    Column(modifier = modifier) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally),
            modifier = Modifier.fillMaxSize(),
        ) {
            Box(
                modifier =
                    Modifier.fillMaxSize()
                        .aspectRatio(aspectRatio, matchHeightConstraintsFirst = true)
                        .clip(RoundedCornerShape(24.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainer)
            )
        }
    }
}
