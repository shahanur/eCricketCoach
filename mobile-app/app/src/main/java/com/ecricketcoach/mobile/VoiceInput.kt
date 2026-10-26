package com.ecricketcoach.mobile

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext

/** Mic icon that dictates speech and appends the recognised text to [current]. */
@Composable
internal fun VoiceMicButton(
    current: String,
    onValueChange: (String) -> Unit,
    prompt: String,
    enabled: Boolean = true,
    singleLine: Boolean = false
) {
    val context = LocalContext.current
    val latest by rememberUpdatedState(current)
    val latestOnChange by rememberUpdatedState(onValueChange)
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode != Activity.RESULT_OK) return@rememberLauncherForActivityResult
        val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
        if (!spoken.isNullOrBlank()) {
            val separator = if (singleLine) " " else "\n"
            latestOnChange(listOf(latest.trim(), spoken).filter(String::isNotBlank).joinToString(separator))
        }
    }
    IconButton(
        enabled = enabled,
        onClick = {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)
            }
            try {
                launcher.launch(intent)
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(context, "Speech recognition is not available on this device.", Toast.LENGTH_SHORT).show()
            }
        }
    ) {
        Icon(Icons.Outlined.Mic, contentDescription = prompt, tint = MaterialTheme.colorScheme.primary)
    }
}
