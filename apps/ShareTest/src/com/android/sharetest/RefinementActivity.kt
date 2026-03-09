package com.android.sharetest

import android.content.Intent
import android.os.Bundle
import android.os.ResultReceiver
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

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

        val alternateIntents =
            refinementIntent?.getParcelableArrayExtra(
                Intent.EXTRA_ALTERNATE_INTENTS,
                Intent::class.java,
            )

        val allIntents =
            listOfNotNull(sharedIntent) + (alternateIntents?.filterNotNull() ?: emptyList())

        val message = buildString {
            append("Refinement intent id: ${refinementIntent?.id}")
            append("\nIs modified by payload selection: ${refinementIntent?.isInitial?.not()}")
            append("\nTarget intent action: ${sharedIntent?.action}")
            append("\nItem count: ${sharedIntent?.extraStream?.size}")
            append("\nTarget intent type: ${sharedIntent?.type}")
            if (allIntents.size <= 1) {
                append("\n\nComplete the share?")
            }
        }

        setContent {
            var selectedIntent by remember { mutableStateOf(sharedIntent) }

            RefinementDialog(
                title = "Refinement invoked!",
                message = message,
                intents = allIntents,
                selectedIntent = selectedIntent,
                onIntentSelected = { selectedIntent = it },
                onConfirm = {
                    val bundle =
                        Bundle().apply { putParcelable(Intent.EXTRA_INTENT, selectedIntent) }
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
fun RefinementDialog(
    title: String,
    message: String,
    intents: List<Intent>,
    selectedIntent: Intent?,
    onIntentSelected: (Intent) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            Column {
                Text(text = message)
                if (intents.size > 1) {
                    Text(
                        text = "\nSelect an intent to send:",
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    val scrollState = rememberScrollState()
                    Column(modifier = Modifier.verticalScroll(scrollState)) {
                        intents.forEach { intent ->
                            Row(
                                Modifier.fillMaxWidth()
                                    .selectable(
                                        selected = (intent == selectedIntent),
                                        onClick = { onIntentSelected(intent) },
                                    )
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(
                                    selected = (intent == selectedIntent),
                                    onClick = { onIntentSelected(intent) },
                                )
                                Text(
                                    text = intent.toString(),
                                    modifier = Modifier.padding(start = 8.dp),
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Yes") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("No") } },
    )
}
