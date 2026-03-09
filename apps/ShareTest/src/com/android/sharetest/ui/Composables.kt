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
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp

@Composable
fun LabeledCheckbox(
    isChecked: Boolean,
    label: String,
    onCheckedChange: (Boolean) -> Unit,
    isEnabled: Boolean = true,
    modifier: Modifier = Modifier,
    textSize: TextUnit = TextUnit.Unspecified,
) {
    CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides 0.dp) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(LocalSpacing.current.rowSpacing),
            modifier =
                modifier.then(
                    if (isEnabled) Modifier.clickable { onCheckedChange(!isChecked) } else Modifier
                ),
        ) {
            Checkbox(
                checked = isChecked,
                onCheckedChange = { onCheckedChange(!isChecked) },
                modifier = Modifier.align(Alignment.CenterVertically),
            )
            Text(
                text = label,
                modifier = Modifier.align(Alignment.CenterVertically),
                fontSize = textSize,
            )
        }
    }
}

@Composable
fun LabeledRadioButton(
    selected: Boolean,
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
    textSize: TextUnit = TextUnit.Unspecified,
) {
    CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides 0.dp) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(LocalSpacing.current.rowSpacing),
            modifier = modifier.then(if (enabled) Modifier.clickable { onClick() } else Modifier),
        ) {
            RadioButton(
                selected = selected,
                onClick = onClick,
                modifier = Modifier.align(Alignment.CenterVertically),
                enabled = enabled,
            )
            Text(
                text = label,
                modifier = Modifier.align(Alignment.CenterVertically),
                fontSize = textSize,
            )
        }
    }
}

@Composable
fun TextButton(text: String, onClick: () -> Unit, enabled: Boolean = true) {
    Button(onClick = onClick, enabled = enabled) { Text(text = text) }
}

data class Spacing(val rowSpacing: Dp, val columnSpacing: Dp)

val LocalSpacing = compositionLocalOf { Spacing(rowSpacing = 8.dp, columnSpacing = 8.dp) }
