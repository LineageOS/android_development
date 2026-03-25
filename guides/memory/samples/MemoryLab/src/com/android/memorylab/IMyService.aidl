package com.android.memorylab;

import com.android.memorylab.IMyCallback;

interface IMyService {
    void registerCallback(IMyCallback cb);
}