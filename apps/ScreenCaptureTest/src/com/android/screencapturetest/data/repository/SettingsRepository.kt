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

package com.android.screencapturetest.data.repository

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import com.android.screencapturetest.data.repository.SettingsRepository.Companion.GENERATE_APP_CONTENT_KEY
import com.android.screencapturetest.data.repository.SettingsRepository.Companion.INCLUDE_ICONS_IN_APP_CONTENT_KEY
import com.android.screencapturetest.shared.Frequency
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn

/** Repository for reading and writing app settings. */
interface SettingsRepository {

    /** Whether to generate app content. */
    val generateAppContent: StateFlow<Boolean>
    /** How often to include icons in generated app content. */
    val includeIconsInAppContent: StateFlow<Frequency>

    /** Set whether to generate app content. */
    fun setGenerateAppContent(enabled: Boolean)

    /** Set how often to include icons in generated app content. */
    fun setIncludeIconsInAppContent(frequency: Frequency)

    companion object {
        /** Key for the generate app content setting. */
        const val GENERATE_APP_CONTENT_KEY = "generate_app_content"
        /** Key for the include icons in app content setting. */
        const val INCLUDE_ICONS_IN_APP_CONTENT_KEY = "include_icons_in_app_content"
    }
}

/** Repository for reading and writing app settings using [SharedPreferences]. */
class SettingsRepositoryImpl(scope: CoroutineScope, context: Context) : SettingsRepository {

    private val sharedPreferences = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    private val preferenceChanges: Flow<String?> =
        callbackFlow {
                val listener =
                    SharedPreferences.OnSharedPreferenceChangeListener { _, key -> trySend(key) }

                sharedPreferences.registerOnSharedPreferenceChangeListener(listener)

                awaitClose {
                    sharedPreferences.unregisterOnSharedPreferenceChangeListener(listener)
                }
            }
            .conflate()

    override val generateAppContent: StateFlow<Boolean> =
        preferenceChanges
            .onStart { emit(GENERATE_APP_CONTENT_KEY) }
            .mapNotNull {
                if (it == GENERATE_APP_CONTENT_KEY) {
                    sharedPreferences.getBoolean(GENERATE_APP_CONTENT_KEY, false)
                } else {
                    null
                }
            }
            .stateIn(scope, SharingStarted.WhileSubscribed(), false)

    override val includeIconsInAppContent: StateFlow<Frequency> =
        preferenceChanges
            .onStart { emit(INCLUDE_ICONS_IN_APP_CONTENT_KEY) }
            .mapNotNull {
                if (it == INCLUDE_ICONS_IN_APP_CONTENT_KEY) {
                    val frequency =
                        sharedPreferences.getString(
                            INCLUDE_ICONS_IN_APP_CONTENT_KEY,
                            Frequency.ALWAYS.name,
                        )
                    Frequency.valueOf(frequency!!)
                } else {
                    null
                }
            }
            .stateIn(scope, SharingStarted.WhileSubscribed(), Frequency.ALWAYS)

    override fun setGenerateAppContent(enabled: Boolean) {
        sharedPreferences.edit { putBoolean(GENERATE_APP_CONTENT_KEY, enabled) }
    }

    override fun setIncludeIconsInAppContent(frequency: Frequency) {
        sharedPreferences.edit { putString(INCLUDE_ICONS_IN_APP_CONTENT_KEY, frequency.name) }
    }
}
