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

import android.app.Activity;
import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.hardware.HardwareBuffer;
import android.os.Bundle;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private List<byte[]> mJavaAllocations = new ArrayList<>();
    private List<Bitmap> mBitmaps = new ArrayList<>();
    private List<HardwareBuffer> mHardwareBuffers = new ArrayList<>();
    private List<Thread> mThreads = new ArrayList<>();
    private TextView mStatusText;

    private IMyService mRemoteService;

    private BroadcastReceiver mReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if ("com.android.memorylab.ALLOC_JAVA".equals(action)) {
                allocateJava();
            } else if ("com.android.memorylab.CHURN_JAVA".equals(action)) {
                churnJava();
            } else if ("com.android.memorylab.ALLOC_NATIVE".equals(action)) {
                allocateNative();
            } else if ("com.android.memorylab.ALLOC_DMABUF".equals(action)) {
                allocateDmaBuf();
            } else if ("com.android.memorylab.LEAK_ACTIVITY".equals(action)) {
                leakActivity();
            } else if ("com.android.memorylab.LEAK_BINDER".equals(action)) {
                leakBinder();
            } else if ("com.android.memorylab.LEAK_BITMAP".equals(action)) {
                allocateBitmaps();
            } else if ("com.android.memorylab.MMAP".equals(action)) {
                nativeMmap();
            } else if ("com.android.memorylab.CREATE_THREADS".equals(action)) {
                createThreads();
            } else if ("com.android.memorylab.DESTROY_THREADS".equals(action)) {
                destroyThreads();
            }
        }
    };

    private ServiceConnection mConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
            mRemoteService = IMyService.Stub.asInterface(service);
            try {
                mRemoteService.registerCallback(new IMyCallback.Stub() {
                    @Override
                    public void onEvent() throws RemoteException {
                    }
                });
            } catch (RemoteException e) {
                e.printStackTrace();
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            mRemoteService = null;
        }
    };

    static {
        System.loadLibrary("memorylab_jni");
    }

    private native void nativeAllocate(int megabytes);
    private native void nativeFreeAll();
    private native void nativeMmap(int megabytes);
    private native void nativeConsumeStack(int kilobytes);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mStatusText = findViewById(R.id.status_text);

        checkHistoricalOom();
        updateStatus();

        IntentFilter filter = new IntentFilter();
        filter.addAction("com.android.memorylab.ALLOC_JAVA");
        filter.addAction("com.android.memorylab.CHURN_JAVA");
        filter.addAction("com.android.memorylab.ALLOC_NATIVE");
        filter.addAction("com.android.memorylab.ALLOC_DMABUF");
        filter.addAction("com.android.memorylab.LEAK_ACTIVITY");
        filter.addAction("com.android.memorylab.LEAK_BINDER");
        filter.addAction("com.android.memorylab.LEAK_BITMAP");
        filter.addAction("com.android.memorylab.MMAP");
        filter.addAction("com.android.memorylab.CREATE_THREADS");
        filter.addAction("com.android.memorylab.DESTROY_THREADS");
        registerReceiver(mReceiver, filter, Context.RECEIVER_EXPORTED);

        findViewById(R.id.btn_alloc_java).setOnClickListener(v -> allocateJava());
        findViewById(R.id.btn_churn_java).setOnClickListener(v -> churnJava());
        findViewById(R.id.btn_alloc_native).setOnClickListener(v -> allocateNative());
        findViewById(R.id.btn_alloc_dmabuf).setOnClickListener(v -> allocateDmaBuf());
        findViewById(R.id.btn_leak_activity).setOnClickListener(v -> leakActivity());
        findViewById(R.id.btn_leak_binder).setOnClickListener(v -> leakBinder());
        findViewById(R.id.btn_leak_bitmap).setOnClickListener(v -> allocateBitmaps());
        findViewById(R.id.btn_mmap).setOnClickListener(v -> nativeMmap());
        findViewById(R.id.btn_create_threads).setOnClickListener(v -> createThreads());
        findViewById(R.id.btn_destroy_threads).setOnClickListener(v -> destroyThreads());

        findViewById(R.id.btn_free_all).setOnClickListener(v -> freeAll());

        findViewById(R.id.btn_gc).setOnClickListener(v -> {
            System.gc();
            updateStatus();
        });
    }

    private void allocateJava() {
        byte[] allocation = new byte[10 * 1024 * 1024]; // 10MB
        for (int i = 0; i < allocation.length; i += 4096) {
            allocation[i] = (byte) (i % 256);
        }
        mJavaAllocations.add(allocation);
        updateStatus();
    }

    private void churnJava() {
        generateAllocationChurn();
    }

    private void allocateNative() {
        nativeAllocate(500); // 500MB
        updateStatus();
    }

    private void allocateDmaBuf() {
        HardwareBuffer hb = HardwareBuffer.create(2000, 2000, HardwareBuffer.RGBA_8888, 1, HardwareBuffer.USAGE_GPU_SAMPLED_IMAGE);
        mHardwareBuffers.add(hb);
        updateStatus();
    }

    private void leakActivity() {
        startActivity(new Intent(MainActivity.this, LeakedActivity.class));
    }

    private void leakBinder() {
        Intent intent = new Intent(this, RemoteService.class);
        bindService(intent, mConnection, Context.BIND_AUTO_CREATE);
    }

    private void allocateBitmaps() {
        Bitmap bmp1 = Bitmap.createBitmap(1600, 1600, Bitmap.Config.ARGB_8888);
        bmp1.eraseColor(android.graphics.Color.RED);
        mBitmaps.add(bmp1);

        Bitmap bmp2 = Bitmap.createBitmap(1600, 1600, Bitmap.Config.ARGB_8888);
        bmp2.eraseColor(android.graphics.Color.RED);
        mBitmaps.add(bmp2);
        updateStatus();
    }

    private void nativeMmap() {
        nativeMmap(10); // 10MB
        updateStatus();
    }

    private void createThreads() {
        new Thread(() -> {
            for (int i = 0; i < 100; i++) {
                Thread t = new Thread(() -> {
                    nativeConsumeStack(10); // 10 KB
                    while (!Thread.currentThread().isInterrupted()) {
                        try {
                            Thread.sleep(1000);
                        } catch (InterruptedException e) {
                            break;
                        }
                    }
                }, "LeakedThread-" + mThreads.size());
                t.start();
                mThreads.add(t);
            }
            runOnUiThread(() -> updateStatus());
        }, "ThreadCreationThread").start();
    }

    private void destroyThreads() {
        new Thread(() -> {
            for (Thread t : mThreads) {
                t.interrupt();
            }
            for (Thread t : mThreads) {
                try {
                    t.join();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
            mThreads.clear();
            runOnUiThread(() -> updateStatus());
        }, "ThreadDestructionThread").start();
    }

    private void freeAll() {
        mJavaAllocations.clear();
        mBitmaps.clear();
        for (HardwareBuffer hb : mHardwareBuffers) {
            hb.close();
        }
        mHardwareBuffers.clear();

        if (mRemoteService != null) {
            unbindService(mConnection);
            mRemoteService = null;
        }
        nativeFreeAll();
        destroyThreads();
        updateStatus();
    }

    private void checkHistoricalOom() {
        ActivityManager am = getSystemService(ActivityManager.class);
        List<ApplicationExitInfo> exitReasons = am.getHistoricalProcessExitReasons(getPackageName(), 0, 1);
        if (!exitReasons.isEmpty()) {
            ApplicationExitInfo info = exitReasons.get(0);
            if (info.getReason() == ApplicationExitInfo.REASON_LOW_MEMORY) {
                Log.w("MemoryLab", "App was previously killed by LMK!");
            }
        }
    }

    private void updateStatus() {
        mStatusText.setText("PID: " + android.os.Process.myPid() +
            "\nJava Allocations: " + mJavaAllocations.size() +
            "\nBitmaps: " + mBitmaps.size() +
            "\nDMA-BUFs: " + mHardwareBuffers.size() +
            "\nThreads: " + mThreads.size());
    }

    public volatile byte[] mGarbageSink;

    private void generateAllocationChurn() {
        new Thread(() -> {
            for (int i = 0; i < 3000; i++) {
                for (int j = 0; j < 100; j++) {
                    byte[] garbage = new byte[10 * 1024];
                    garbage[0] = (byte) (i % 256);
                    mGarbageSink = garbage;
                }
                try {
                    Thread.sleep(10);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }, "AllocationChurnThread").start();
    }
}
