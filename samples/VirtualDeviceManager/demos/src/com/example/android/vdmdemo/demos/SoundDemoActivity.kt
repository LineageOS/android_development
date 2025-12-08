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
package com.example.android.vdmdemo.demos

import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity

/**
 * Demo activity for testing sound playback using a SoundPool.
 */
class SoundDemoActivity : AppCompatActivity() {

    private lateinit var soundPool: SoundPool
    private var sound1Id: Int = 0
    private var sound2Id: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.sound_demo_activity)

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(2)
            .setAudioAttributes(audioAttributes)
            .build()

        sound1Id = soundPool.load(this, R.raw.sound1, 1)
        sound2Id = soundPool.load(this, R.raw.sound2, 1)

        findViewById<View>(R.id.sound1_button).setOnClickListener {
            soundPool.play(sound1Id, 1.0f, 1.0f, 1, 0, 1.0f)
        }

        findViewById<View>(R.id.sound2_button).setOnClickListener {
            soundPool.play(sound2Id, 1.0f, 1.0f, 1, 0, 1.0f)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        soundPool.release()
    }
}