/*
 * Copyright 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.android.sharetest.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.Flow

@Composable
fun InteractiveShareTestComposable(
    chooserWindowTopOffset: Flow<Int>,
    previewCount: Int,
    isChooserRunning: Boolean,
    useRefinement: Boolean,
    modifier: Modifier,
    startCameraApp: () -> Unit,
    launchActivity: () -> Unit,
    launchSelfInSplitScreen: (() -> Unit)?,
    launchDialog: () -> Unit,
    shareText: (String) -> Unit,
    shareImages: (Int) -> Unit,
    updateRefinement: () -> Unit,
    closeChooser: () -> Unit,
    setTargetsEnabled: (Boolean) -> Unit,
) {
    val previewWindowBottom by chooserWindowTopOffset.collectAsStateWithLifecycle(-1)
    val brush = remember { SolidColor(Color.Red) }

    CompositionLocalProvider(
        LocalSpacing provides Spacing(rowSpacing = 5.dp, columnSpacing = 5.dp)
    ) {
        val rowSpacing = LocalSpacing.current.rowSpacing
        Column(
            modifier = modifier,
            verticalArrangement = Arrangement.spacedBy(LocalSpacing.current.columnSpacing),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(rowSpacing)) {
                TextButton(text = "Pick Camera App", onClick = { startCameraApp() })
                TextButton(text = "Launch Activity", onClick = { launchActivity() })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(rowSpacing)) {
                if (launchSelfInSplitScreen != null) {
                    TextButton(
                        text = "Launch Self in Split-Screen",
                        onClick = { launchSelfInSplitScreen() },
                    )
                }
                TextButton(text = "Launch Dialog", onClick = { launchDialog() })
            }
            ShareText(
                initialText = "A text to share",
                shareText = shareText,
                modifier = Modifier.fillMaxWidth().wrapContentHeight(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(rowSpacing)) {
                if (previewCount > 0) {
                    TextButton(text = "Share One Image", onClick = { shareImages(1) })
                    if (previewCount > 1) {
                        TextButton(text = "Share Two Images", onClick = { shareImages(2) })
                    }
                }
            }
            LabeledCheckbox(
                isChecked = useRefinement,
                label = "Use Refinement",
                onCheckedChange = { updateRefinement() },
            )
            if (isChooserRunning) {
                ChooserActions(closeChooser = closeChooser, setTargetsEnabled = setTargetsEnabled)
            }
        }

        var windowTop by remember { mutableFloatStateOf(0f) }
        Spacer(
            modifier =
                Modifier.fillMaxSize()
                    .onGloballyPositioned { coords ->
                        windowTop = coords.localToWindow(Offset.Zero).y
                    }
                    .drawBehind {
                        if (previewWindowBottom >= 0 && isChooserRunning) {
                            val top = previewWindowBottom.toFloat() - windowTop
                            drawLine(
                                brush = brush,
                                start = Offset(0f, top),
                                end = Offset(size.width, top),
                                strokeWidth = 2.dp.toPx(),
                            )
                        }
                    }
        )
    }
}

@Composable
private fun ShareText(initialText: String, shareText: (String) -> Unit, modifier: Modifier) {
    var sharedText by rememberSaveable(Unit) { mutableStateOf(initialText) }
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(LocalSpacing.current.rowSpacing),
    ) {
        TextField(
            value = sharedText,
            modifier = Modifier.weight(1f),
            onValueChange = { sharedText = it },
        )
        TextButton(text = "Share Text", onClick = { shareText(sharedText) })
    }
}

@Composable
private fun ChooserActions(closeChooser: () -> Unit, setTargetsEnabled: (Boolean) -> Unit) {
    var areTargetsEnabled by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(LocalSpacing.current.columnSpacing)) {
        Row(horizontalArrangement = Arrangement.spacedBy(LocalSpacing.current.rowSpacing)) {
            TextButton(text = "Close Chooser", onClick = { closeChooser() })
            TextButton(
                text = if (areTargetsEnabled) "Disable" else "Enable",
                onClick = {
                    areTargetsEnabled = !areTargetsEnabled
                    setTargetsEnabled(areTargetsEnabled)
                },
            )
        }
    }
}

@Composable
private fun LabeledCheckbox(
    isChecked: Boolean,
    label: String,
    onCheckedChange: (Boolean) -> Unit,
    isEnabled: Boolean = true,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(LocalSpacing.current.rowSpacing),
        modifier = if (isEnabled) Modifier.clickable { onCheckedChange(!isChecked) } else Modifier,
    ) {
        Checkbox(
            checked = isChecked,
            onCheckedChange = { onCheckedChange(!isChecked) },
            modifier = Modifier.align(Alignment.CenterVertically),
        )
        Text(text = label, modifier = Modifier.align(Alignment.CenterVertically))
    }
}

@Composable
private fun TextButton(text: String, onClick: () -> Unit, enabled: Boolean = true) {
    Button(onClick = onClick, enabled = enabled) { Text(text = text) }
}

private data class Spacing(val rowSpacing: Dp, val columnSpacing: Dp)

private val LocalSpacing = compositionLocalOf { Spacing(rowSpacing = 5.dp, columnSpacing = 5.dp) }
