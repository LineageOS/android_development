/*
 * Copyright 2026 The Android Open Source Project
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

package com.android.screencapturetest.ui.composable

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp

/** Visually grouped section of the UI. */
@Composable
fun Section(
    title: String?,
    textStyle: TextStyle,
    dividerThickness: Dp,
    footer: Boolean = false,
    modifier: Modifier = Modifier.fillMaxWidth(),
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = modifier) {
        SectionHeader(title, textStyle, dividerThickness)
        content()
        if (footer) {
            SectionFooter(dividerThickness)
        }
    }
}

@Composable
private fun SectionHeader(title: String?, textStyle: TextStyle, dividerThickness: Dp) {
    if (title == null) {
        HorizontalDivider(modifier = Modifier.fillMaxWidth(), thickness = dividerThickness)
    } else {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            HorizontalDivider(modifier = Modifier.weight(1f), thickness = dividerThickness)
            Text(text = title, style = textStyle)
            HorizontalDivider(modifier = Modifier.weight(1f), thickness = dividerThickness)
        }
    }
}

@Composable
private fun SectionFooter(dividerThickness: Dp) {
    HorizontalDivider(modifier = Modifier.fillMaxWidth(), thickness = dividerThickness)
}
