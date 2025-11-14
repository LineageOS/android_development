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
package com.example.android.apis.app;

import android.app.Activity;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.OutcomeReceiver;
import android.util.Log;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.android.apis.R;

public class RequestFullscreenMode extends Activity {
    private static final String TAG = "RequestFullscreenMode";

    private final OutcomeReceiver<Void, Throwable> mOutcomeReceiver = new OutcomeReceiver<>() {
        @Override
        public void onResult(Void result) {
            Log.d(TAG, "onResult thread=" + Thread.currentThread());
            runOnUiThread(() ->
                    Toast.makeText(RequestFullscreenMode.this, R.string.callback_success_title,
                            Toast.LENGTH_SHORT).show());
        }

        @Override
        public void onError(@NonNull Throwable error) {
            Log.d(TAG, "onError thread=" + Thread.currentThread()
                    + " message=" + error.getMessage());
            final String errorMessage = getString(
                    R.string.callback_failed_title, error.getMessage());
            runOnUiThread(() ->
                    Toast.makeText(RequestFullscreenMode.this, errorMessage, Toast.LENGTH_SHORT)
                            .show());
        }
    };

    private Button mEnterButton;
    private Button mExitButton;
    private TextView mWindowStateTextView;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.request_fullscreen_mode);

        mEnterButton = findViewById(R.id.enter_button);
        mExitButton = findViewById(R.id.exit_button);
        mWindowStateTextView = findViewById(R.id.window_state_label);

        mEnterButton.setOnClickListener(v -> requestEnter());
        mExitButton.setOnClickListener(v -> requestExit());

        updateWindowStateText();
    }

    @Override
    public void onMultiWindowModeChanged(boolean isInMultiWindowMode, Configuration newConfig) {
        updateWindowStateText();
    }

    private void requestEnter() {
        requestFullscreenMode(Activity.FULLSCREEN_MODE_REQUEST_ENTER, mOutcomeReceiver);
    }

    private void requestExit() {
        requestFullscreenMode(Activity.FULLSCREEN_MODE_REQUEST_EXIT, mOutcomeReceiver);
    }

    private void updateWindowStateText() {
        mWindowStateTextView.setText(isInMultiWindowMode()
                ? R.string.window_state_multi_window : R.string.window_state_fullscreen);
    }
}
