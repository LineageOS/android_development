/*
 * Copyright (C) 2026 The Android Open Source Project
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

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewConfiguration;
import android.widget.TextView;

/**
 * Demo activity for showing ViewConfiguration values.
 */
public class ViewConfigurationDemoActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.view_configuration_demo_activity);

        ViewConfiguration vc = ViewConfiguration.get(this);

        ((TextView) findViewById(R.id.touch_slop)).setText(
                "Touch Slop (pixels): " + vc.getScaledTouchSlop());
        ((TextView) findViewById(R.id.min_fling_velocity)).setText(
                "Min Fling Velocity (pixels per second): " + vc.getScaledMinimumFlingVelocity());
        ((TextView) findViewById(R.id.max_fling_velocity)).setText(
                "Max Fling Velocity (pixels per second): " + vc.getScaledMaximumFlingVelocity());

        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.BAKLAVA) {
            ((TextView) findViewById(R.id.scroll_friction)).setText(
                    "Scroll Friction: " + vc.getScrollFrictionAmount());
            ((TextView) findViewById(R.id.double_tap_timeout)).setText(
                    "Double Tap Timeout (millis): " + vc.getDoubleTapTimeoutMillis());
            ((TextView) findViewById(R.id.tap_timeout)).setText(
                    "Tap Timeout (millis): " + vc.getTapTimeoutMillis());
            ((TextView) findViewById(R.id.long_press_timeout)).setText(
                    "Long Press Timeout (millis): " + vc.getLongPressTimeoutMillis());
            ((TextView) findViewById(R.id.multi_press_timeout)).setText(
                    "Multi Press Timeout (millis): " + vc.getMultiPressTimeoutMillis());
        }
    }
}
