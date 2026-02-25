package com.android.sharetest

import android.content.Intent
import android.os.Bundle
import android.os.ResultReceiver
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable

class RefinementActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val refinementIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)

        val resultReceiver =
            refinementIntent?.getParcelableExtra(
                Intent.EXTRA_RESULT_RECEIVER,
                ResultReceiver::class.java,
            )
        val sharedIntent =
            refinementIntent?.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)

        val message = buildString {
            append("Refinement intent id: ${refinementIntent?.id}")
            append("\nIs modified by payload selection: ${refinementIntent?.isInitial?.not()}")
            append("\nTarget intent action: ${sharedIntent?.action}")
            append("\nItem count: ${sharedIntent?.extraStream?.size}")
            append("\nTarget intent type: ${sharedIntent?.type}")
            append("\n\nComplete the share?")
        }

        setContent {
            RefinementDialog(
                title = "Refinement invoked!",
                message = message,
                onConfirm = {
                    val bundle = Bundle().apply { putParcelable(Intent.EXTRA_INTENT, sharedIntent) }
                    resultReceiver?.send(RESULT_OK, bundle)
                    finish()
                },
                onDismiss = {
                    resultReceiver?.send(RESULT_CANCELED, null)
                    finish()
                },
            )
        }
    }
}

@Composable
fun RefinementDialog(title: String, message: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = { Text(text = message) },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Yes") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("No") } },
    )
}
