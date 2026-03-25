/**
 * Copyright (C) 2026 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package com.android.codebloat;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView tv = new TextView(this);
        tv.setText("CodeBloat App running!");

        // Touch ALL generated classes so they are loaded into memory
        new Thread(() -> {
            try {
                for (int i = 0; i < 300; i++) {
                    Class<?> clazz = Class.forName("com.android.codebloat.GeneratedClass" + i);
                    clazz.getMethod("doSomething").invoke(null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();

        setContentView(tv);
    }
}