/*
 * Copyright 2024 The Android Open Source Project
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

package com.android.sharetest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.android.sharetest.ui.ActionSelection
import com.android.sharetest.ui.MediaSelection
import com.android.sharetest.ui.TYPE_IMAGE
import com.android.sharetest.ui.TextSelection

class ShareTestViewModel : ViewModel() {
    // Media Section State
    var mediaSelection by mutableStateOf(MediaSelection.NO_MEDIA)
    var mediaTypeSelection by mutableStateOf(TYPE_IMAGE)
    var shareouselChecked by mutableStateOf(false)
    var altIntentChecked by mutableStateOf(false)
    var imageSizeMetadataChecked by mutableStateOf(true)
    var callerTargetChecked by mutableStateOf(false)
    var excludeSelfChecked by mutableStateOf(false)
    var useRefinement by mutableStateOf(false)

    // Text Section State
    var textSelection by mutableStateOf(TextSelection.SHORT_TEXT)
    var includeTitle by mutableStateOf(false)
    var includeIcon by mutableStateOf(false)
    var richText by mutableStateOf(false)
    var albumCheck by mutableStateOf(false)

    // Actions Section State
    var actionSelection by mutableStateOf(ActionSelection.NO_ACTIONS)
    var includeModifyShare by mutableStateOf(false)

    // Metadata Section State
    var metadataText by mutableStateOf("")

    // Advanced Options Section State
    var selectionLatency by mutableStateOf(0)
    var imageLatency by mutableStateOf(0)
    var imageGetTypeLatency by mutableStateOf(0)
    var imageQueryLatency by mutableStateOf(0)
    var imageLoadFailureRate by mutableStateOf(0f)

    fun updateMediaSelection(selection: MediaSelection) {
        mediaSelection = selection
        mediaTypeSelection = TYPE_IMAGE
        if (selection == MediaSelection.NO_MEDIA && textSelection == TextSelection.NO_TEXT) {
            textSelection = TextSelection.SHORT_TEXT
        }
    }

    fun updateImageLatency(latency: Int) {
        imageLatency = latency
        ImageContentProvider.openLatency = latency.toLong()
    }

    fun updateImageGetTypeLatency(latency: Int) {
        imageGetTypeLatency = latency
        ImageContentProvider.getTypeLatency = latency.toLong()
    }

    fun updateImageQueryLatency(latency: Int) {
        imageQueryLatency = latency
        ImageContentProvider.queryLatency = latency.toLong()
    }

    fun updateImageLoadFailureRate(rate: Float) {
        imageLoadFailureRate = rate
        ImageContentProvider.openFailureRate = rate
    }
}
