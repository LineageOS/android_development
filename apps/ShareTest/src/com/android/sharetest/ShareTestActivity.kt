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

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.BackgroundColorSpan
import android.text.style.BulletSpan
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.text.style.UnderlineSpan
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.annotation.RequiresApi
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import com.android.sharetest.ImageContentProvider.Companion.IMAGE_COUNT
import com.android.sharetest.ImageContentProvider.Companion.makeItemUri
import com.android.sharetest.ui.ActionSelection
import com.android.sharetest.ui.ActionState
import com.android.sharetest.ui.AdvancedOptionsState
import com.android.sharetest.ui.MediaSelection
import com.android.sharetest.ui.MediaState
import com.android.sharetest.ui.ShareTestScreen
import com.android.sharetest.ui.TYPE_ALL
import com.android.sharetest.ui.TYPE_IMG_PDF
import com.android.sharetest.ui.TYPE_IMG_VIDEO
import com.android.sharetest.ui.TYPE_PDF
import com.android.sharetest.ui.TYPE_VIDEO
import com.android.sharetest.ui.TYPE_VIDEO_PDF
import com.android.sharetest.ui.TextSelection
import com.android.sharetest.ui.TextState
import kotlin.random.Random

private const val ADDITIONAL_ITEM_COUNT = 1_000

@RequiresApi(34)
class ShareTestActivity : ComponentActivity() {

    private lateinit var viewModel: ShareTestViewModel

    private lateinit var customActionReceiver: BroadcastReceiver
    private lateinit var refinementReceiver: BroadcastReceiver

    private val customActionFactory = CustomActionFactory(this)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel = ViewModelProvider(this)[ShareTestViewModel::class.java]
        setContent {
            ShareTestScreen(
                mediaState =
                    MediaState(
                        mediaSelection = viewModel.mediaSelection,
                        onMediaSelectionChange = viewModel::updateMediaSelection,
                        mediaTypeSelection = viewModel.mediaTypeSelection,
                        onMediaTypeSelectionChange = { viewModel.mediaTypeSelection = it },
                        shareouselChecked = viewModel.shareouselChecked,
                        onShareouselCheckedChange = { viewModel.shareouselChecked = it },
                        altIntentChecked = viewModel.altIntentChecked,
                        onAltIntentCheckedChange = { viewModel.altIntentChecked = it },
                        imageSizeMetadataChecked = viewModel.imageSizeMetadataChecked,
                        onImageSizeMetadataCheckedChange = {
                            viewModel.imageSizeMetadataChecked = it
                        },
                    ),
                textState =
                    TextState(
                        textSelection = viewModel.textSelection,
                        onTextSelectionChange = { viewModel.textSelection = it },
                        includeTitle = viewModel.includeTitle,
                        onIncludeTitleChange = { viewModel.includeTitle = it },
                        includeIcon = viewModel.includeIcon,
                        onIncludeIconChange = { viewModel.includeIcon = it },
                        richText = viewModel.richText,
                        onRichTextChange = { viewModel.richText = it },
                        albumCheck = viewModel.albumCheck,
                        onAlbumCheckChange = { viewModel.albumCheck = it },
                    ),
                actionState =
                    ActionState(
                        actionSelection = viewModel.actionSelection,
                        onActionSelectionChange = { viewModel.actionSelection = it },
                        includeModifyShare = viewModel.includeModifyShare,
                        onIncludeModifyShareChange = { viewModel.includeModifyShare = it },
                    ),
                metadataText = viewModel.metadataText,
                onMetadataTextChange = { viewModel.metadataText = it },
                advancedOptionsState =
                    AdvancedOptionsState(
                        imageLatency = viewModel.imageLatency,
                        onImageLatencyChange = viewModel::updateImageLatency,
                        imageGetTypeLatency = viewModel.imageGetTypeLatency,
                        onImageGetTypeLatencyChange = viewModel::updateImageGetTypeLatency,
                        imageQueryLatency = viewModel.imageQueryLatency,
                        onImageQueryLatencyChange = viewModel::updateImageQueryLatency,
                        selectionLatency = viewModel.selectionLatency,
                        onSelectionLatencyChange = { viewModel.selectionLatency = it },
                        imageLoadFailureRate = viewModel.imageLoadFailureRate,
                        onImageLoadFailureRateChange = viewModel::updateImageLoadFailureRate,
                        useRefinement = viewModel.useRefinement,
                        onUseRefinementChange = { viewModel.useRefinement = it },
                        callerTargetChecked = viewModel.callerTargetChecked,
                        onCallerTargetCheckedChange = { viewModel.callerTargetChecked = it },
                        excludeSelfChecked = viewModel.excludeSelfChecked,
                        onExcludeSelfCheckedChange = { viewModel.excludeSelfChecked = it },
                    ),
                onShare = { share() },
                modifier =
                    Modifier.fillMaxSize().systemBarsPadding().padding(start = 16.dp, end = 16.dp),
            )
        }

        customActionReceiver =
            object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent) {
                    Toast.makeText(
                            this@ShareTestActivity,
                            "Custom action invoked, isModified: ${!intent.isInitial}",
                            Toast.LENGTH_LONG,
                        )
                        .show()
                }
            }

        refinementReceiver =
            object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent) {
                    // Need to show refinement in another activity because this one is beneath the
                    // sharesheet.
                    val activityIntent =
                        Intent(this@ShareTestActivity, RefinementActivity::class.java)
                    activityIntent.putExtra(Intent.EXTRA_INTENT, intent)
                    startActivity(activityIntent)
                }
            }

        registerReceiver(
            customActionReceiver,
            IntentFilter(CustomActionFactory.BROADCAST_ACTION),
            Context.RECEIVER_EXPORTED,
        )

        registerReceiver(
            refinementReceiver,
            IntentFilter(REFINEMENT_ACTION),
            Context.RECEIVER_EXPORTED,
        )
    }

    private fun share() {
        val share = Intent(Intent.ACTION_SEND)
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        val mimeTypes = getSelectedContentTypes()

        val imageIndex = Random.nextInt(ADDITIONAL_ITEM_COUNT)

        when (viewModel.mediaSelection) {
            MediaSelection.ONE_IMAGE ->
                share.apply {
                    val sharedUri =
                        makeItemUri(
                            imageIndex,
                            mimeTypes[imageIndex % mimeTypes.size],
                            viewModel.imageSizeMetadataChecked,
                        )
                    putExtra(Intent.EXTRA_STREAM, sharedUri)
                    clipData = ClipData("", arrayOf("image/jpg"), ClipData.Item(sharedUri))
                    type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
                }
            MediaSelection.MANY_IMAGES ->
                share.apply {
                    val imageUris =
                        ArrayList(
                            (0 until IMAGE_COUNT).map { idx ->
                                makeItemUri(
                                    idx,
                                    mimeTypes[idx % mimeTypes.size],
                                    viewModel.imageSizeMetadataChecked,
                                )
                            }
                        )
                    action = Intent.ACTION_SEND_MULTIPLE
                    clipData =
                        ClipData("", arrayOf("image/jpg"), ClipData.Item(imageUris[0])).apply {
                            for (i in 1 until IMAGE_COUNT) {
                                addItem(ClipData.Item(imageUris[i]))
                            }
                        }
                    type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, imageUris)
                }
            MediaSelection.NO_MEDIA -> {}
        }

        val url = "https://developer.android.com/training/sharing/send#adding-rich-content-previews"

        when (viewModel.textSelection) {
            TextSelection.SHORT_TEXT -> share.setText(createShortText())
            TextSelection.LONG_TEXT -> share.setText(createLongText())
            TextSelection.URL_TEXT -> share.setText(url)
            else -> {}
        }

        if (viewModel.includeTitle) {
            share.putExtra(Intent.EXTRA_TITLE, createTextTitle())
        }

        if (viewModel.includeIcon) {
            share.clipData =
                ClipData("", arrayOf("image/png"), ClipData.Item(ImageContentProvider.ICON_URI))
            share.data = ImageContentProvider.ICON_URI
        }

        val chosenComponentPendingIntent =
            PendingIntent.getBroadcast(
                this,
                0,
                Intent(this, ChosenComponentBroadcastReceiver::class.java),
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        val chooserIntent =
            Intent.createChooser(share, null, chosenComponentPendingIntent.intentSender)

        val sendingImage = viewModel.mediaSelection != MediaSelection.NO_MEDIA
        if (sendingImage && viewModel.altIntentChecked) {
            chooserIntent.putExtra(
                Intent.EXTRA_ALTERNATE_INTENTS,
                arrayOf(createAlternateIntent(share)),
            )
        }
        if (viewModel.callerTargetChecked) {
            chooserIntent.putExtra(
                Intent.EXTRA_CHOOSER_TARGETS,
                arrayOf(createCallerTarget(this, "Initial Direct Target")),
            )
        }

        if (viewModel.excludeSelfChecked) {
            chooserIntent.putExtra(
                Intent.EXTRA_EXCLUDE_COMPONENTS,
                arrayOf(ComponentName(packageName, CallerDirectTargetActivity::class.java.name)),
            )
        }

        if (viewModel.albumCheck) {
            chooserIntent.putExtra(
                Intent.EXTRA_CHOOSER_CONTENT_TYPE_HINT,
                Intent.CHOOSER_CONTENT_TYPE_ALBUM,
            )
        }

        if (viewModel.includeModifyShare) {
            chooserIntent.setModifyShareAction(this)
        }

        if (viewModel.useRefinement) {
            chooserIntent.putExtra(
                Intent.EXTRA_CHOOSER_REFINEMENT_INTENT_SENDER,
                createRefinementIntentSender(this, true),
            )
        }

        when (viewModel.actionSelection) {
            ActionSelection.ONE_ACTION ->
                chooserIntent.putExtra(
                    Intent.EXTRA_CHOOSER_CUSTOM_ACTIONS,
                    customActionFactory.getCustomActions(1),
                )
            ActionSelection.FIVE_ACTIONS ->
                chooserIntent.putExtra(
                    Intent.EXTRA_CHOOSER_CUSTOM_ACTIONS,
                    customActionFactory.getCustomActions(5),
                )
            else -> {}
        }

        if (viewModel.metadataText.isNotEmpty()) {
            chooserIntent.putExtra(Intent.EXTRA_METADATA_TEXT, viewModel.metadataText)
        }
        if (viewModel.shareouselChecked) {
            val additionalContentUri =
                AdditionalContentProvider.ADDITIONAL_CONTENT_URI.buildUpon()
                    .appendQueryParameter(
                        AdditionalContentProvider.PARAM_COUNT,
                        ADDITIONAL_ITEM_COUNT.toString(),
                    )
                    .appendQueryParameter(
                        AdditionalContentProvider.PARAM_SIZE_META,
                        viewModel.imageSizeMetadataChecked.toString(),
                    )
                    .also { builder ->
                        mimeTypes.forEach {
                            builder.appendQueryParameter(
                                AdditionalContentProvider.PARAM_MIME_TYPE,
                                it,
                            )
                        }
                    }
                    .build()
            chooserIntent.putExtra(
                Intent.EXTRA_CHOOSER_ADDITIONAL_CONTENT_URI,
                additionalContentUri,
            )
            chooserIntent.putExtra(Intent.EXTRA_CHOOSER_FOCUSED_ITEM_POSITION, 0)
            chooserIntent.clipData?.addItem(ClipData.Item(additionalContentUri))
            if (viewModel.mediaSelection == MediaSelection.ONE_IMAGE) {
                chooserIntent.putExtra(AdditionalContentProvider.CURSOR_START_POSITION, imageIndex)
            }
            if (viewModel.selectionLatency > 0) {
                chooserIntent.putExtra(
                    AdditionalContentProvider.EXTRA_SELECTION_LATENCY,
                    viewModel.selectionLatency,
                )
            }
        }

        startActivity(chooserIntent)
    }

    private fun getSelectedContentTypes(): Array<String> =
        when (viewModel.mediaTypeSelection) {
            TYPE_VIDEO -> arrayOf("video/mp4")
            TYPE_PDF -> arrayOf("application/pdf")
            TYPE_IMG_VIDEO -> arrayOf("image/jpeg", "video/mp4")
            TYPE_IMG_PDF -> arrayOf("image/jpeg", "application/pdf")
            TYPE_VIDEO_PDF -> arrayOf("video/mp4", "application/pdf")
            TYPE_ALL -> arrayOf("image/jpeg", "video/mp4", "application/pdf")
            else -> arrayOf("image/jpeg") // Default or TYPE_IMAGE
        }

    private fun createShortText(): CharSequence =
        SpannableStringBuilder()
            .append("This", StyleSpan(Typeface.BOLD), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(" is ", StyleSpan(Typeface.ITALIC), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append("a bit of ")
            .append("text", BackgroundColorSpan(Color.YELLOW), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(" to ")
            .append("share", ForegroundColorSpan(Color.GREEN), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(".")
            .let { if (viewModel.richText) it else it.toString() }

    private fun createLongText(): CharSequence =
        SpannableStringBuilder("Here is a lot more text to share:")
            .apply {
                val colors =
                    arrayOf(
                        Color.RED,
                        Color.GREEN,
                        Color.BLUE,
                        Color.CYAN,
                        Color.MAGENTA,
                        Color.YELLOW,
                        Color.BLACK,
                        Color.DKGRAY,
                        Color.GRAY,
                    )
                for (color in colors) {
                    append("\n")
                    append(
                        createShortText(),
                        BulletSpan(40, color, 20),
                        Spannable.SPAN_INCLUSIVE_EXCLUSIVE,
                    )
                }
            }
            .let { if (viewModel.richText) it else it.toString() }

    private fun createTextTitle(): CharSequence =
        SpannableStringBuilder()
            .append("Here's", UnderlineSpan(), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(" the ", StyleSpan(Typeface.ITALIC), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append("Title", ForegroundColorSpan(Color.RED), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append("!")
            .let { if (viewModel.richText) it else it.toString() }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(customActionReceiver)
        unregisterReceiver(refinementReceiver)
    }
}
