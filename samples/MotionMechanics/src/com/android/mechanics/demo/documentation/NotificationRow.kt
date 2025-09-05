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

package com.android.mechanics.demo.documentation

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

data class NotificationViewModel(val label: String) {
    var isDismissed by mutableStateOf(false)
}

@Composable
fun NotificationRow(
    viewModel: NotificationViewModel,
    isFirstNotification: Boolean = true,
    isLastNotification: Boolean = true,
    modifier: Modifier = Modifier,
) {
    val backgroundColor = MaterialTheme.colorScheme.primaryContainer
    val contentColor = MaterialTheme.colorScheme.onPrimaryContainer

    fun targetRadius(isLarge: Boolean): Dp {
        return if (isLarge) 24.dp else 4.dp
    }

    val topRadius by animateDpAsState(targetRadius(isLarge = isFirstNotification))
    val bottomRadius by animateDpAsState(targetRadius(isLarge = isLastNotification))

    Box(
        contentAlignment = Alignment.TopStart,
        modifier =
            modifier
                .height(64.dp)
                .notificationClip(remember { Path() }, { topRadius }, { bottomRadius })
                .background(backgroundColor),
    ) {
        Text(
            viewModel.label,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(start = 16.dp, top = 16.dp),
        )
    }
}

internal fun Modifier.notificationClip(
    path: Path,
    topRadius: () -> Dp,
    bottomRadius: () -> Dp,
): Modifier {
    return drawWithCache {
        val topCornerRadius = CornerRadius(topRadius().toPx())
        val bottomCornerRadius = CornerRadius(bottomRadius().toPx())

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
}
