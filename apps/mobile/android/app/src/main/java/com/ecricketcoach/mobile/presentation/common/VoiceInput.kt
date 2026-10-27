package com.ecricketcoach.mobile.presentation.common

import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.domain.repository.*
import com.ecricketcoach.mobile.utils.*
import com.ecricketcoach.mobile.presentation.club.*
import com.ecricketcoach.mobile.presentation.session.*
import com.ecricketcoach.mobile.presentation.assessment.*
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
import androidx.compose.ui.Modifier
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext

/** Converts dictated email text such as "john dot smith at gmail dot com" into an address. */
internal fun spokenEmailAddress(value: String): String = value.trim().lowercase()
    .replace(Regex("\\s+at\\s+"), "@")
    .replace(Regex("\\s+dot\\s+"), ".")
    .replace(Regex("\\s+underscore\\s+"), "_")
    .replace(Regex("\\s+(dash|hyphen)\\s+"), "-")
    .replace(Regex("\\s+"), "")

/**
 * Mic icon that dictates speech into a field. By default the recognised text is appended to [current];
 * set [replace] for search/name/email style fields where dictation should overwrite the value.
 */
@Composable
internal fun VoiceMicButton(
    current: String,
    onValueChange: (String) -> Unit,
    prompt: String,
    enabled: Boolean = true,
    singleLine: Boolean = false,
    replace: Boolean = false,
    transform: (String) -> String = { it },
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val latest by rememberUpdatedState(current)
    val latestOnChange by rememberUpdatedState(onValueChange)
    val latestTransform by rememberUpdatedState(transform)
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode != Activity.RESULT_OK) return@rememberLauncherForActivityResult
        val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
            ?.let(latestTransform)
        if (!spoken.isNullOrBlank()) {
            if (replace) {
                latestOnChange(spoken)
            } else {
                val separator = if (singleLine) " " else "\n"
                latestOnChange(listOf(latest.trim(), spoken).filter(String::isNotBlank).joinToString(separator))
            }
        }
    }
    IconButton(
        modifier = modifier,
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
