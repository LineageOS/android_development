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

package com.example.android.vdmdemo.demos;

import android.content.res.Configuration;
import android.os.Bundle;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

/** Activity showing its UI mode. */
public class UiModeDemoActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.text_demo_activity);
        updateUiMode(getResources().getConfiguration());
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration configuration) {
        super.onConfigurationChanged(configuration);
        updateUiMode(configuration);
    }

    private void updateUiMode(Configuration configuration) {
        String uiMode = uiModeToString(configuration.uiMode & Configuration.UI_MODE_TYPE_MASK);
        String nightMode = configuration.isNightModeActive() ? "Enabled" : "Disabled";

        ((TextView) requireViewById(R.id.text)).setText(
                getString(R.string.ui_mode_text, uiMode, nightMode));
    }

    private static String uiModeToString(int uiMode) {
        return switch (uiMode) {
            case Configuration.UI_MODE_TYPE_UNDEFINED -> "UNDEFINED";
            case Configuration.UI_MODE_TYPE_NORMAL -> "NORMAL";
            case Configuration.UI_MODE_TYPE_DESK -> "DESK";
            case Configuration.UI_MODE_TYPE_CAR -> "CAR";
            case Configuration.UI_MODE_TYPE_TELEVISION -> "TELEVISION";
            case Configuration.UI_MODE_TYPE_APPLIANCE -> "APPLIANCE";
            case Configuration.UI_MODE_TYPE_WATCH -> "WATCH";
            case Configuration.UI_MODE_TYPE_VR_HEADSET -> "VR_HEADSET";
            default -> Integer.toString(uiMode);
        };
    }
}
