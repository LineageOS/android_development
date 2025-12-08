/*
 * Copyright 2024 The Android Open Source Project
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

package com.android.sharetest

import android.app.AlertDialog
import android.app.Dialog
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.Intent.EXTRA_CHOOSER_RESULT_INTENT_SENDER
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Rect
import android.os.Bundle
import android.provider.MediaStore
import android.service.chooser.ChooserManager
import android.service.chooser.ChooserSession
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.android.sharetest.ui.InteractiveShareTestComposable
import com.android.sharetest.ui.theme.ActivityTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.scan
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@AndroidEntryPoint(value = FragmentActivity::class)
class InteractiveShareTestActivity : Hilt_InteractiveShareTestActivity() {
    private val TAG = "ShareTest/$hashId"
    private var chooserWindowTopOffset = MutableStateFlow(-1)
    private val isInMultiWindowMode = MutableStateFlow<Boolean>(false)
    private val viewModel: InteractiveShareTestViewModel by viewModels()
    private lateinit var chooserManager: ChooserManager
    private val chooserSession: MutableStateFlow<ChooserSession?>
        get() = viewModel.chooserSession

    private val useRefinementFlow = MutableStateFlow<Boolean>(false)
    private val refinementReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent) {
                // Need to show refinement in another activity because this one is beneath the
                // sharesheet.
                val activityIntent =
                    Intent(this@InteractiveShareTestActivity, RefinementActivity::class.java)
                activityIntent.putExtras(intent)
                startActivity(activityIntent)
            }
        }

    private val sessionStateListener =
        object : ChooserSession.StateListener {
            override fun onStateChanged(state: Int) {
                if (state == ChooserSession.STATE_STARTED) {
                    Log.d(TAG, "onChooserConnected")
                } else if (state == ChooserSession.STATE_CLOSED) {
                    Log.d(TAG, "onSessionClosed")
                    chooserSession.value = null
                }
            }

            override fun onBoundsChanged(size: Rect) {
                Log.d(TAG, "onSizeChanged")
                chooserWindowTopOffset.value = size.top
            }
        }

    @OptIn(ExperimentalCoroutinesApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val cm = getSystemService(ChooserManager::class.java)
        if (cm == null) {
            Toast.makeText(this, "ChooserManager is not available", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        chooserManager = cm

        isInMultiWindowMode.value = isInMultiWindowMode()

        lifecycleScope.launch {
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                chooserSession
                    .scan<ChooserSession?, ChooserSession?>(null) { prevSession, newSession ->
                        prevSession?.endSession()
                        newSession?.addStateListener(mainExecutor, sessionStateListener)
                        if (newSession == null || !newSession.isActive) {
                            chooserWindowTopOffset.value = -1
                        }
                        newSession
                    }
                    .collect {}
            }
        }

        val previews = buildList {
            for (i in 0..2) {
                val uri = ImageContentProvider.makeItemUri(i, "image/jpg", true)
                add(Preview(uri, uri, isImage = true))
            }
        }

        setContent {
            val padding = 15.dp
            val showLaunchInSplitScreen by
                isInMultiWindowMode.map { !it }.collectAsStateWithLifecycle(true)
            val isChooserRunning by
                chooserSession.map { it?.isActive == true }.collectAsStateWithLifecycle(false)
            val useRefinement by useRefinementFlow.collectAsStateWithLifecycle(false)
            ActivityTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    InteractiveShareTestComposable(
                        chooserWindowTopOffset = chooserWindowTopOffset,
                        previewCount = previews.size,
                        isChooserRunning = isChooserRunning,
                        useRefinement = useRefinement,
                        modifier = Modifier.padding(innerPadding).padding(horizontal = padding),
                        startCameraApp = ::startCameraApp,
                        launchActivity = ::launchActivity,
                        launchSelfInSplitScreen =
                            if (showLaunchInSplitScreen) {
                                ::launchSelfInSplitScreen
                            } else {
                                null
                            },
                        launchDialog = ::launchDialog,
                        shareText = ::shareText,
                        shareImages = { shareImages(previews, it) },
                        updateRefinement = ::updateRefinement,
                        closeChooser = ::closeChooser,
                        setTargetsEnabled = ::setTargetsEnabled,
                    )
                }
            }
        }
    }

    override fun onStart() {
        Log.d(TAG, "onStart")
        super.onStart()
    }

    override fun onResume() {
        Log.d(TAG, "onResume: session state: ${chooserSession.value?.state}")
        super.onResume()
    }

    override fun onPause() {
        Log.d(TAG, "onPause")
        super.onPause()
    }

    override fun onStop() {
        Log.d(TAG, "onStop")
        super.onStop()
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        if (useRefinementFlow.value) {
            unregisterReceiver(refinementReceiver)
        }
        chooserSession.value?.removeStateListener(sessionStateListener)
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        Log.d(TAG, "onConfigurationChanged")
        super.onConfigurationChanged(newConfig)
    }

    private fun updateRefinement() {
        useRefinementFlow.update {
            if (it) {
                unregisterReceiver(refinementReceiver)
            } else {
                registerReceiver(
                    refinementReceiver,
                    IntentFilter(REFINEMENT_ACTION),
                    RECEIVER_EXPORTED,
                )
            }
            !it
        }
    }

    private fun startCameraApp() {
        val targetIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        startOrUpdate(Intent.createChooser(targetIntent, null))
    }

    private fun launchActivity() {
        startActivity(Intent(this, SendTextActivity::class.java))
    }

    private fun launchDialog() {
        val dialog = TestDialog()
        dialog.show(supportFragmentManager, "dialog")
    }

    private fun launchSelfInSplitScreen() {
        startActivity(
            Intent(this, javaClass).apply {
                setFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }

    private fun shareText(text: String) {
        val targetIntent =
            Intent(Intent.ACTION_SEND).apply {
                putExtra(Intent.EXTRA_TEXT, text)
                setType("text/plain")
            }
        val chooserIntent = Intent.createChooser(targetIntent, null)
        startOrUpdate(chooserIntent)
    }

    private fun shareImages(previews: List<Preview>, count: Int) {
        require(count > 0) { "Unexpected count argument value: $count" }
        val targetIntent =
            Intent(if (count == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).apply {
                if (count == 1) {
                    putExtra(Intent.EXTRA_STREAM, previews[0].uri)
                } else {
                    putExtra(
                        Intent.EXTRA_STREAM,
                        ArrayList(previews.take(count).map { it.uri }.toList()),
                    )
                }
                clipData =
                    ClipData("image", arrayOf("image/*"), ClipData.Item(previews[0].uri)).apply {
                        previews.take(count).forEachIndexed { idx, item ->
                            if (idx != 0) {
                                addItem(ClipData.Item(item.uri))
                            }
                        }
                    }
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                setType("image/*")
            }
        val chooserIntent = Intent.createChooser(targetIntent, null)
        startOrUpdate(chooserIntent)
    }

    private fun closeChooser() {
        chooserSession.value = null
    }

    private fun setTargetsEnabled(isEnabled: Boolean) {
        chooserSession.value?.setTargetsEnabled(isEnabled)
    }

    private fun startOrUpdate(chooserIntent: Intent) {
        val session = chooserSession.value?.takeIf { it.isActive }
        if (useRefinementFlow.value) {
            chooserIntent.putExtra(
                Intent.EXTRA_CHOOSER_REFINEMENT_INTENT_SENDER,
                createRefinementIntentSender(this@InteractiveShareTestActivity, true),
            )
        }
        chooserIntent.putExtra(EXTRA_CHOOSER_RESULT_INTENT_SENDER, createResultIntentSender(this))
        if (session == null) {
            chooserManager.startSession(this, chooserIntent).also { chooserSession.value = it }
        } else {
            session.updateIntent(chooserIntent)
        }
    }
}

private val ChooserSession.isActive: Boolean
    get() = state != ChooserSession.STATE_CLOSED

class TestDialog : DialogFragment() {
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        return AlertDialog.Builder(requireContext())
            .setMessage("Just a test dialog")
            .setPositiveButton("Close") { _, _ -> dismiss() }
            .create()
    }
}
