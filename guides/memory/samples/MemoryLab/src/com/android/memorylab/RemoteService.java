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

package com.android.memorylab;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import java.util.ArrayList;
import java.util.List;

public class RemoteService extends Service {
    // This static list will leak the callbacks provided by other processes.
    private static final List<IMyCallback> sCallbacks = new ArrayList<>();

    private final IMyService.Stub mBinder = new IMyService.Stub() {
        @Override
        public void registerCallback(IMyCallback cb) {
            if (cb != null) {
                sCallbacks.add(cb);
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return mBinder;
    }
}
