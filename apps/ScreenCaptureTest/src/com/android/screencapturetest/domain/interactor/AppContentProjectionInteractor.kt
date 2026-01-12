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

package com.android.screencapturetest.domain.interactor

import android.content.Context
import com.android.screencapturetest.data.repository.SettingsRepository
import com.android.screencapturetest.data.repository.SettingsRepositoryImpl
import com.android.screencapturetest.shared.Frequency
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.StateFlow

/** Interactor for controlling test app content projection service. */
class AppContentProjectionInteractor(private val repository: SettingsRepository) {
    /** Whether to generate app content. */
    val appContentProjectionServiceEnabled: StateFlow<Boolean> = repository.generateAppContent

    /** How often to include icons in generated app content. */
    val appContentProjectionServiceIconFrequency: StateFlow<Frequency> =
        repository.includeIconsInAppContent

    constructor(
        scope: CoroutineScope,
        context: Context,
    ) : this(SettingsRepositoryImpl(scope, context))

    /** Set whether to generate app content. */
    fun setAppContentProjectionServiceEnabled(enabled: Boolean) {
        repository.setGenerateAppContent(enabled)
    }

    /** Set how often to include icons in generated app content. */
    fun setAppContentProjectionServiceIconFrequency(frequency: Frequency) {
        repository.setIncludeIconsInAppContent(frequency)
    }
}
