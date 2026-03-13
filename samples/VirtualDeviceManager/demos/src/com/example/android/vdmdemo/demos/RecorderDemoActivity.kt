/*
 * Copyright (C) 2024 The Android Open Source Project
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

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.AudioTrack
import android.media.MediaRecorder.AudioSource
import android.os.Bundle
import android.util.AttributeSet
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import kotlin.concurrent.thread
import kotlin.math.sqrt
import kotlinx.atomicfu.AtomicBoolean
import kotlinx.atomicfu.atomic

/**
 * Demo activity for testing starting and stopping multiple (NUMBER_OF_RECORDERS) recordings. Does
 * not use the data from the AudioRecorder(s). The reading from the AudioRecord(s) is necessary to
 * activate the dynamic policies.
 */
class RecorderDemoActivity :
    AppCompatActivity(), ActivityCompat.OnRequestPermissionsResultCallback {

    private var audioManager: AudioManager? = null

    private data class RecorderUi(
        val button: Button,
        val playButton: Button,
        val status: TextView,
        val progressBar: ProgressBar,
        val histogram: HistogramView,
    )

    private lateinit var recorderUis: List<RecorderUi>

    private val recorders =
        RECORDERS_SETTINGS.indices.map { index ->
            AudioRecorder(RECORDERS_SETTINGS[index]) { level ->
                val color = interpolateColor(level)
                runOnUiThread {
                    with(recorderUis[index]) {
                        button.setBackgroundColor(color)
                        progressBar.progress = level
                        histogram.addSample(level)
                    }
                }
            }
        }

    private val audioRecordingCallback =
        object : AudioManager.AudioRecordingCallback() {
            override fun onRecordingConfigChanged(configs: List<AudioRecordingConfiguration>) {
                super.onRecordingConfigChanged(configs)
                Log.d(TAG, "onRecordingConfigChanged with configs: ${configs.map { toLog(it) }}")

                // recording configuration changed, update UI state for all recorders
                runOnUiThread { updateAllRecordersUi() }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.recorder_demo_activity)

        recorderUis =
            listOf(
                RecorderUi(
                    requireViewById(R.id.first_recorder_button),
                    requireViewById(R.id.first_play_button),
                    requireViewById(R.id.first_recorder_status),
                    requireViewById(R.id.first_recorder_level),
                    requireViewById(R.id.first_recorder_histogram),
                ),
                RecorderUi(
                    requireViewById(R.id.second_recorder_button),
                    requireViewById(R.id.second_play_button),
                    requireViewById(R.id.second_recorder_status),
                    requireViewById(R.id.second_recorder_level),
                    requireViewById(R.id.second_recorder_histogram),
                ),
            )

        audioManager = getSystemService(AudioManager::class.java)
        audioManager?.registerAudioRecordingCallback(audioRecordingCallback, null)
    }

    override fun onDestroy() {
        super.onDestroy()

        recorders.forEach { it.stopRecording() }

        audioManager?.unregisterAudioRecordingCallback(audioRecordingCallback)
    }

    fun onFirstRecordButtonClick(view: View) = onRecordButtonClick(0)

    fun onSecondRecordButtonClick(view: View) = onRecordButtonClick(1)

    fun onFirstPlayButtonClick(view: View) = onPlayButtonClick(0)

    fun onSecondPlayButtonClick(view: View) = onPlayButtonClick(1)

    private fun onRecordButtonClick(index: Int) {
        if (index in recorders.indices) {
            recorders[index].toggleRecording()
        }
    }

    private fun onPlayButtonClick(index: Int) {
        if (index in recorders.indices) {
            recorders[index].playLastRecording()
        }
    }

    private fun updateAllRecordersUi() {
        recorders.indices.forEach { updateRecorderUi(it) }
    }

    private fun updateRecorderUi(index: Int) {
        val recorder = recorders[index]
        val ui = recorderUis[index]
        val isRecording = recorder.isRecording()

        ui.button.setText(if (isRecording) R.string.stop_record else R.string.start_record)
        ui.button.setTextColor(if (isRecording) Color.RED else Color.GRAY)
        ui.playButton.isEnabled = !isRecording && recorder.hasRecording()
        ui.status.text = recorder.getRecorderStatus()
    }

    private fun interpolateColor(level: Int): Int {
        return when {
            level < 33 -> interpolate(Color.BLUE, Color.GREEN, level, 33)
            level < 66 -> interpolate(Color.GREEN, Color.YELLOW, level - 33, 33)
            else -> interpolate(Color.YELLOW, Color.RED, level - 66, 34)
        }
    }

    private fun interpolate(c1: Int, c2: Int, value: Int, max: Int): Int {
        val r = Color.red(c1) + (Color.red(c2) - Color.red(c1)) * value / max
        val g = Color.green(c1) + (Color.green(c2) - Color.green(c1)) * value / max
        val b = Color.blue(c1) + (Color.blue(c2) - Color.blue(c1)) * value / max
        return Color.rgb(r, g, b)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == PERMISSIONS_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.i("TAG", "RECORD_AUDIO permission granted!")
            } else {
                Log.w("TAG", "RECORD_AUDIO permission NOT granted!")
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun toLog(config: AudioRecordingConfiguration) =
        with(config) {
            "AudioRecordingConfiguration: $this has audioSource: ${this.audioSource} audioDevice: ${this.audioDevice} clientAudioSource: ${this.clientAudioSource} clientAudioSessionId: ${this.clientAudioSessionId} clientEffects: ${this.clientEffects} effects: ${this.effects} isClientSilenced: ${this.isClientSilenced} format: ${this.format}"
        }

    /**
     * Utility class managing creation and reading from an AudioRecord. Sends the sound level of the
     * recorded audio data in onDataReceived for UI feedback.
     */
    private inner class AudioRecorder(
        private val settings: RecorderSettings,
        private val onDataReceived: (Int) -> Unit,
    ) {
        private var isRunning: AtomicBoolean = atomic(initial = false)
        private var audioRecord: AudioRecord? = null
        private var recordedData: ByteArray? = null

        private fun createAndReadAudioRecord() {
            createRecorder(settings)?.let { record ->
                audioRecord = record

                if (record.state != AudioRecord.STATE_INITIALIZED) {
                    Log.e(TAG, "Can NOT start recording for UNINITIALIZED AudioRecord.")
                    return
                }

                val bufferSize =
                    (AUDIO_RECORDER_BUFFER_SIZE_MS * record.sampleRate * record.channelCount / 1000)
                val buffer = ByteArray(bufferSize)

                Log.d(TAG, "AudioRecord start recording to memory...")
                val outputStream = ByteArrayOutputStream()

                try {
                    record.startRecording()
                } catch (e: Exception) {
                    Log.e(TAG, "Exception starting AudioRecord.", e)
                    return
                }
                Log.d(TAG, "AudioRecord recording started.")

                isRunning.value = true

                while (isRunning.value) {
                    val ret = record.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                    if (ret < 0) {
                        Log.e(TAG, "Error calling read on AudioRecord, read call returned $ret")
                        break
                    }
                    outputStream.write(buffer, 0, ret)
                    // compute the level of the recorded audio data for some UI representation
                    val level = calculateSoundLevel(buffer, ret)
                    onDataReceived(level)
                }

                // No longer running, recording should stop and be released,
                // it will be recreated when needed
                record.stop()
                record.release()
                audioRecord = null
                recordedData = outputStream.toByteArray()

                Log.d(TAG, "AudioRecord stopped recording.")
                runOnUiThread { updateAllRecordersUi() }
            } ?: Log.e(TAG, "Can NOT start recording for NULL AudioRecord.")
        }

        fun isRecording() = isRunning.value

        fun hasRecording() = recordedData != null

        fun startRecording() {
            Log.d(TAG, "startRecording()")
            thread { createAndReadAudioRecord() }
        }

        fun stopRecording() {
            Log.d(TAG, "stopRecording()")
            isRunning.value = false
        }

        fun toggleRecording() {
            if (isRecording()) {
                stopRecording()
            } else {
                startRecording()
            }
        }

        fun playLastRecording() {
            val data = recordedData
            if (isRecording()) {
                Log.w(TAG, "Cannot play while recording.")
                return
            }
            if (data == null) {
                Log.w(TAG, "No recording found to play.")
                return
            }

            val outChannel =
                if (settings.channels == AudioFormat.CHANNEL_IN_MONO) AudioFormat.CHANNEL_OUT_MONO
                else AudioFormat.CHANNEL_OUT_STEREO

            val bufferSize =
                AudioTrack.getMinBufferSize(settings.sampleRate, outChannel, settings.encoding)

            val audioTrack =
                AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(settings.encoding)
                            .setSampleRate(settings.sampleRate)
                            .setChannelMask(outChannel)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()

            thread {
                try {
                    audioTrack.play()
                    audioTrack.write(data, 0, data.size)
                    audioTrack.stop()
                    audioTrack.release()
                } catch (e: Exception) {
                    Log.e(TAG, "Error playing back recording", e)
                }
            }
        }

        private fun calculateSoundLevel(buffer: ByteArray, bytesRead: Int): Int {
            var sum = 0.0
            for (i in 0 until bytesRead step 2) {
                val sample =
                    ((buffer[i + 1].toInt() shl 8) or (buffer[i].toInt() and 0xFF)).toShort()
                sum += sample.toDouble() * sample.toDouble()
            }
            val rms = if (bytesRead > 0) sqrt(sum / (bytesRead / 2)) else 0.0
            return (rms * 100 / MAX_SOUND_LEVEL).toInt().coerceIn(0, 100)
        }

        fun getRecorderStatus() =
            audioRecord?.let {
                val state =
                    if (it.state == AudioRecord.STATE_INITIALIZED) {
                        if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                            "Recording"
                        } else {
                            "Stopped"
                        }
                    } else {
                        "Uninitialized"
                    }

                "$state source ${friendlyAudioSource(it.audioSource)} device address ${it.routedDevice?.address}"
            } ?: "Recorder not created!"

        @SuppressLint("MissingPermission")
        private fun createRecorder(settings: RecorderSettings): AudioRecord? {
            if (
                ContextCompat.checkSelfPermission(
                    this@RecorderDemoActivity,
                    Manifest.permission.RECORD_AUDIO,
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.i("TAG", "Requesting RECORD_AUDIO permission from the user...")
                ActivityCompat.requestPermissions(
                    this@RecorderDemoActivity,
                    arrayOf(Manifest.permission.RECORD_AUDIO),
                    PERMISSIONS_REQUEST_CODE,
                )
                return null
            } else {
                with(settings) {
                    return AudioRecord(
                        source,
                        sampleRate,
                        channels,
                        encoding,
                        AudioRecord.getMinBufferSize(sampleRate, channels, encoding),
                    )
                }
            }
        }
    }

    private data class RecorderSettings(
        val source: Int,
        val sampleRate: Int,
        val channels: Int,
        val encoding: Int,
    )

    private companion object {
        const val TAG = "RecorderDemoActivity"

        const val PERMISSIONS_REQUEST_CODE = 99
        const val NUMBER_OF_RECORDERS = 2

        const val AUDIO_RECORDER_BUFFER_SIZE_MS = 50
        const val MAX_SOUND_LEVEL = 16384

        // some defaults for easy instantiation of AudioRecorder objects
        const val FIRST_RECORDER_SOURCE = AudioSource.DEFAULT
        const val FIRST_RECORDER_SAMPLE_RATE: Int = 8000
        const val FIRST_RECORDER_CHANNELS: Int = AudioFormat.CHANNEL_IN_MONO
        const val FIRST_RECORDER_AUDIO_ENCODING: Int = AudioFormat.ENCODING_PCM_16BIT

        const val SECOND_RECORDER_SOURCE = AudioSource.MIC
        const val SECOND_RECORDER_SAMPLE_RATE: Int = 48000
        const val SECOND_RECORDER_CHANNELS: Int = AudioFormat.CHANNEL_IN_STEREO
        const val SECOND_RECORDER_AUDIO_ENCODING: Int = AudioFormat.ENCODING_PCM_16BIT

        private val RECORDERS_SETTINGS =
            listOf(
                RecorderSettings(
                    FIRST_RECORDER_SOURCE,
                    FIRST_RECORDER_SAMPLE_RATE,
                    FIRST_RECORDER_CHANNELS,
                    FIRST_RECORDER_AUDIO_ENCODING,
                ),
                RecorderSettings(
                    SECOND_RECORDER_SOURCE,
                    SECOND_RECORDER_SAMPLE_RATE,
                    SECOND_RECORDER_CHANNELS,
                    SECOND_RECORDER_AUDIO_ENCODING,
                ),
            )

        private fun friendlyAudioSource(source: Int) =
            when (source) {
                AudioSource.DEFAULT -> "DEFAULT"
                AudioSource.MIC -> "MIC"
                AudioSource.VOICE_UPLINK -> "VOICE_UPLINK"
                AudioSource.VOICE_DOWNLINK -> "VOICE_DOWNLINK"
                AudioSource.VOICE_CALL -> "VOICE_CALL"
                AudioSource.CAMCORDER -> "CAMCORDER"
                AudioSource.VOICE_RECOGNITION -> "VOICE_RECOGNITION"
                AudioSource.VOICE_COMMUNICATION -> "VOICE_COMMUNICATION"
                AudioSource.REMOTE_SUBMIX -> "REMOTE_SUBMIX"
                AudioSource.UNPROCESSED -> "UNPROCESSED"
                1997 -> "ECHO_REFERENCE" /* AudioSource.ECHO_REFERENCE */
                AudioSource.VOICE_PERFORMANCE -> "VOICE_PERFORMANCE"
                1998 -> "RADIO_TUNER" /* AudioSource.RADIO_TUNER */
                1999 -> "HOTWORD" /* AudioSource.HOTWORD */
                2000 -> "ULTRASOUND" /* AudioSource.ULTRASOUND */
                -1 -> "AUDIO_SOURCE_INVALID" /* AudioSource.AUDIO_SOURCE_INVALID */
                else -> "unknown source $source"
            }
    }
}

/** Custom view to display a histogram of audio levels. */
class HistogramView(context: Context, attrs: AttributeSet?) : View(context, attrs) {
    private val paint =
        Paint().apply {
            color = Color.BLUE
            style = Paint.Style.FILL
        }
    private val samples = IntArray(100)
    private var index = 0

    fun addSample(sample: Int) {
        samples[index] = sample
        index = (index + 1) % samples.size
        postInvalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        val barWidth = w / samples.size

        for (i in samples.indices) {
            val s = samples[(index + i) % samples.size]
            val barHeight = (s.toFloat() / 100f) * h
            canvas.drawRect(i * barWidth, h - barHeight, (i + 1) * barWidth, h, paint)
        }
    }
}
