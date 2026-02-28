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

package com.android.sharetest.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class MediaState(
    val mediaSelection: MediaSelection,
    val onMediaSelectionChange: (MediaSelection) -> Unit,
    val mediaTypeSelection: String,
    val onMediaTypeSelectionChange: (String) -> Unit,
    val shareouselChecked: Boolean,
    val onShareouselCheckedChange: (Boolean) -> Unit,
    val altIntentChecked: Boolean,
    val onAltIntentCheckedChange: (Boolean) -> Unit,
    val imageSizeMetadataChecked: Boolean,
    val onImageSizeMetadataCheckedChange: (Boolean) -> Unit,
)

data class TextState(
    val textSelection: TextSelection,
    val onTextSelectionChange: (TextSelection) -> Unit,
    val includeTitle: Boolean,
    val onIncludeTitleChange: (Boolean) -> Unit,
    val includeIcon: Boolean,
    val onIncludeIconChange: (Boolean) -> Unit,
    val richText: Boolean,
    val onRichTextChange: (Boolean) -> Unit,
    val albumCheck: Boolean,
    val onAlbumCheckChange: (Boolean) -> Unit,
)

data class ActionState(
    val actionSelection: ActionSelection,
    val onActionSelectionChange: (ActionSelection) -> Unit,
    val includeModifyShare: Boolean,
    val onIncludeModifyShareChange: (Boolean) -> Unit,
)

data class AdvancedOptionsState(
    val imageLatency: Int,
    val onImageLatencyChange: (Int) -> Unit,
    val imageGetTypeLatency: Int,
    val onImageGetTypeLatencyChange: (Int) -> Unit,
    val imageQueryLatency: Int,
    val onImageQueryLatencyChange: (Int) -> Unit,
    val selectionLatency: Int,
    val onSelectionLatencyChange: (Int) -> Unit,
    val imageLoadFailureRate: Float,
    val onImageLoadFailureRateChange: (Float) -> Unit,
    val useRefinement: Boolean,
    val onUseRefinementChange: (Boolean) -> Unit,
    val callerTargetChecked: Boolean,
    val onCallerTargetCheckedChange: (Boolean) -> Unit,
    val excludeSelfChecked: Boolean,
    val onExcludeSelfCheckedChange: (Boolean) -> Unit,
)

@Composable
fun ShareTestScreen(
    mediaState: MediaState,
    textState: TextState,
    actionState: ActionState,
    metadataText: String,
    onMetadataTextChange: (String) -> Unit,
    advancedOptionsState: AdvancedOptionsState,
    onShare: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            MediaSection(mediaState)

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            TextSection(textState)

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            ActionsSection(actionState)

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            MetadataSection(
                metadataText = metadataText,
                onMetadataTextChange = onMetadataTextChange,
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            AdvancedOptionsSection(advancedOptionsState)
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onShare, modifier = Modifier.fillMaxWidth()) {
            Text("Share", fontSize = 28.sp, modifier = Modifier.padding(8.dp))
        }
    }
}

enum class MediaSelection {
    NO_MEDIA,
    ONE_IMAGE,
    MANY_IMAGES,
}

const val TYPE_IMAGE = "Image"
const val TYPE_VIDEO = "Video"
const val TYPE_PDF = "PDF Doc"
const val TYPE_IMG_VIDEO = "Image / Video Mix"
const val TYPE_IMG_PDF = "Image / PDF Mix"
const val TYPE_VIDEO_PDF = "Video / PDF Mix"
const val TYPE_ALL = "All Type Mix"

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun MediaSection(state: MediaState) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Media",
            fontSize = 28.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )

        FlowRow(Modifier.fillMaxWidth()) {
            MediaSelection.values().forEach { selection ->
                LabeledRadioButton(
                    selected = (state.mediaSelection == selection),
                    onClick = { state.onMediaSelectionChange(selection) },
                    label =
                        when (selection) {
                            MediaSelection.NO_MEDIA -> "No Media"
                            MediaSelection.ONE_IMAGE -> "One Image"
                            MediaSelection.MANY_IMAGES -> "Many Images"
                        },
                    modifier = Modifier.padding(horizontal = 8.dp).padding(top = 8.dp),
                    textSize = 18.sp,
                )
            }
        }

        if (state.mediaSelection != MediaSelection.NO_MEDIA) {
            Spacer(modifier = Modifier.height(8.dp))

            val options =
                if (state.mediaSelection == MediaSelection.ONE_IMAGE) {
                    listOf(TYPE_IMAGE, TYPE_VIDEO, TYPE_PDF)
                } else {
                    listOf(
                        TYPE_IMAGE,
                        TYPE_VIDEO,
                        TYPE_PDF,
                        TYPE_IMG_VIDEO,
                        TYPE_IMG_PDF,
                        TYPE_VIDEO_PDF,
                        TYPE_ALL,
                    )
                }

            var expanded by remember { mutableStateOf(false) }

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded },
            ) {
                TextField(
                    modifier = Modifier.menuAnchor().fillMaxWidth(),
                    readOnly = true,
                    value = state.mediaTypeSelection,
                    onValueChange = {},
                    label = { Text("Media Type") },
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                    },
                    colors = ExposedDropdownMenuDefaults.textFieldColors(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    options.forEach { selectionOption ->
                        DropdownMenuItem(
                            text = { Text(selectionOption) },
                            onClick = {
                                state.onMediaTypeSelectionChange(selectionOption)
                                expanded = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            LabeledCheckbox(
                isChecked = state.shareouselChecked,
                onCheckedChange = state.onShareouselCheckedChange,
                label = "Shareousel",
                textSize = 18.sp,
                modifier = Modifier.padding(top = 8.dp),
            )
            LabeledCheckbox(
                isChecked = state.altIntentChecked,
                onCheckedChange = state.onAltIntentCheckedChange,
                label = "Add alternate intent",
                textSize = 18.sp,
                modifier = Modifier.padding(top = 8.dp),
            )
            LabeledCheckbox(
                isChecked = state.imageSizeMetadataChecked,
                onCheckedChange = state.onImageSizeMetadataCheckedChange,
                label = "Add image size metadata",
                textSize = 18.sp,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

enum class TextSelection {
    NO_TEXT,
    SHORT_TEXT,
    LONG_TEXT,
    URL_TEXT,
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TextSection(state: TextState) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Text",
            fontSize = 28.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )

        FlowRow(Modifier.fillMaxWidth()) {
            TextSelection.values().forEach { selection ->
                LabeledRadioButton(
                    selected = (state.textSelection == selection),
                    onClick = { state.onTextSelectionChange(selection) },
                    label =
                        when (selection) {
                            TextSelection.NO_TEXT -> "Nothing"
                            TextSelection.SHORT_TEXT -> "Short"
                            TextSelection.LONG_TEXT -> "Long"
                            TextSelection.URL_TEXT -> "URL"
                        },
                    modifier = Modifier.padding(horizontal = 8.dp).padding(top = 8.dp),
                    textSize = 18.sp,
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                LabeledCheckbox(
                    isChecked = state.includeTitle,
                    onCheckedChange = state.onIncludeTitleChange,
                    label = "Include Title",
                    textSize = 18.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
                LabeledCheckbox(
                    isChecked = state.includeIcon,
                    onCheckedChange = state.onIncludeIconChange,
                    label = "Include Icon",
                    textSize = 18.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                LabeledCheckbox(
                    isChecked = state.richText,
                    onCheckedChange = state.onRichTextChange,
                    label = "Use Rich Text",
                    textSize = 18.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
                LabeledCheckbox(
                    isChecked = state.albumCheck,
                    onCheckedChange = state.onAlbumCheckChange,
                    label = "Mark as Album",
                    textSize = 18.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

enum class ActionSelection {
    NO_ACTIONS,
    ONE_ACTION,
    FIVE_ACTIONS,
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ActionsSection(state: ActionState) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Actions",
            fontSize = 28.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )

        FlowRow(Modifier.fillMaxWidth()) {
            ActionSelection.values().forEach { selection ->
                LabeledRadioButton(
                    selected = (state.actionSelection == selection),
                    onClick = { state.onActionSelectionChange(selection) },
                    label =
                        when (selection) {
                            ActionSelection.NO_ACTIONS -> "No Actions"
                            ActionSelection.ONE_ACTION -> "One Action"
                            ActionSelection.FIVE_ACTIONS -> "Five Actions"
                        },
                    modifier = Modifier.padding(horizontal = 8.dp).padding(top = 8.dp),
                    textSize = 18.sp,
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        LabeledCheckbox(
            isChecked = state.includeModifyShare,
            onCheckedChange = state.onIncludeModifyShareChange,
            label = "Include Modify Share",
            textSize = 18.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MetadataSection(metadataText: String, onMetadataTextChange: (String) -> Unit) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Metadata",
            fontSize = 28.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )
        TextField(
            value = metadataText,
            onValueChange = onMetadataTextChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Metadata Text") },
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdvancedOptionsSection(state: AdvancedOptionsState) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Advanced Options",
            fontSize = 28.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )

        LatencyOption(
            title = "Average image loading latency",
            selectedValue = state.imageLatency,
            onValueChange = state.onImageLatencyChange,
        )

        LatencyOption(
            title = "Average image get type latency",
            selectedValue = state.imageGetTypeLatency,
            onValueChange = state.onImageGetTypeLatencyChange,
        )

        LatencyOption(
            title = "Average metadata latency",
            selectedValue = state.imageQueryLatency,
            onValueChange = state.onImageQueryLatencyChange,
        )

        LatencyOption(
            title = "Average selection latency",
            selectedValue = state.selectionLatency,
            onValueChange = state.onSelectionLatencyChange,
        )

        Text(
            text = "Image load failure probability",
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )
        FlowRow(Modifier.fillMaxWidth()) {
            val options = listOf(0f to "None", 0.5f to "50%", 1f to "100%")
            options.forEach { (value, label) ->
                LabeledRadioButton(
                    selected = (state.imageLoadFailureRate == value),
                    onClick = { state.onImageLoadFailureRateChange(value) },
                    label = label,
                    modifier = Modifier.padding(horizontal = 8.dp).padding(top = 8.dp),
                    textSize = 18.sp,
                )
            }
        }

        Text(
            text = "Refinement",
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )
        LabeledCheckbox(
            isChecked = state.useRefinement,
            onCheckedChange = state.onUseRefinementChange,
            label = "Use Refinement",
            textSize = 18.sp,
        )

        Text(
            text = "Caller Target",
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )
        LabeledCheckbox(
            isChecked = state.callerTargetChecked,
            onCheckedChange = state.onCallerTargetCheckedChange,
            label = "Include Caller Direct Target",
            textSize = 18.sp,
        )

        Text(
            text = "Exclude Targets",
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )
        LabeledCheckbox(
            isChecked = state.excludeSelfChecked,
            onCheckedChange = state.onExcludeSelfCheckedChange,
            label =
                "Exclude self from targets (for Shareousel payload change: set for an odd number of items)",
            textSize = 18.sp,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LatencyOption(title: String, selectedValue: Int, onValueChange: (Int) -> Unit) {
    Text(text = title, fontSize = 18.sp, modifier = Modifier.padding(top = 8.dp, bottom = 4.dp))
    FlowRow(Modifier.fillMaxWidth()) {
        val options = listOf(0 to "None", 50 to "50ms", 200 to "200ms", 800 to "800ms")
        options.forEach { (value, label) ->
            LabeledRadioButton(
                selected = (selectedValue == value),
                onClick = { onValueChange(value) },
                label = label,
                modifier = Modifier.padding(horizontal = 8.dp).padding(top = 8.dp),
                textSize = 18.sp,
            )
        }
    }
}
