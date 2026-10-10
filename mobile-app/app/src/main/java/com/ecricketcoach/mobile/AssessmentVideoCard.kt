package com.ecricketcoach.mobile

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.VideoLibrary
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
internal fun AssessmentVideoCard(
    api: CoachApi,
    token: String,
    assessment: PlayerAssessment,
    driveConnected: Boolean,
    driveEmail: String,
    onRefreshDrive: () -> Unit,
    onDisconnectDrive: suspend () -> Unit,
    onAssessmentUpdated: (PlayerAssessment) -> Unit,
    onNotice: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val completed = assessment.status == "COMPLETED"
    var video by remember(assessment.id) { mutableStateOf<AssessmentVideo?>(null) }
    var loading by remember(assessment.id) { mutableStateOf(false) }
    var uploading by remember(assessment.id) { mutableStateOf(false) }
    var error by remember(assessment.id) { mutableStateOf("") }
    var driveVideos by remember { mutableStateOf<List<DriveVideoFile>>(emptyList()) }
    var driveLoading by remember { mutableStateOf(false) }
    var driveMenuOpen by remember { mutableStateOf(false) }
    var selectedDriveVideo by remember(assessment.id) { mutableStateOf<DriveVideoFile?>(null) }

    suspend fun loadDriveVideos() {
        driveLoading = true
        try {
            val files = api.listGoogleDriveVideos(token)
            driveVideos = files
            selectedDriveVideo = selectedDriveVideo?.let { current -> files.firstOrNull { it.id == current.id } }
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to load your Google Drive videos."
        } finally {
            driveLoading = false
        }
    }

    var awaitingDriveConnect by remember { mutableStateOf(false) }
    var confirmSwitch by remember { mutableStateOf(false) }
    var switching by remember { mutableStateOf(false) }

    fun launchDriveConnect() {
        try {
            awaitingDriveConnect = true
            CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(api.googleDriveConnectUrl(token)))
        } catch (failure: Exception) {
            awaitingDriveConnect = false
            error = failure.message ?: "Unable to open Google Drive sign-in."
        }
    }

    // Re-check the Drive connection when the coach returns from the Google sign-in tab.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && awaitingDriveConnect) {
                awaitingDriveConnect = false
                onRefreshDrive()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(driveConnected, driveEmail, completed) {
        selectedDriveVideo = null
        if (driveConnected && !completed) loadDriveVideos() else driveVideos = emptyList()
    }

    LaunchedEffect(assessment.id, assessment.videoAnalysisId) {
        if (assessment.videoAnalysisId == null || video?.id == assessment.videoAnalysisId) return@LaunchedEffect
        loading = true
        try {
            video = api.getAssessmentVideo(token, assessment.id)
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to load the assessment video."
        } finally {
            loading = false
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            uploading = true
            error = ""
            try {
                val (updated, result) = api.uploadAssessmentVideo(context, token, assessment.id, uri)
                video = result
                onAssessmentUpdated(updated)
                onNotice("Video saved to Google Drive and analysed.")
                loadDriveVideos()
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                error = failure.message ?: "Unable to upload and analyse this video."
            } finally {
                uploading = false
            }
        }
    }

    if (confirmSwitch) {
        SwitchDriveDialog(
            email = driveEmail,
            onDismiss = { confirmSwitch = false },
            onConfirm = {
                confirmSwitch = false
                scope.launch {
                    switching = true
                    error = ""
                    try {
                        onDisconnectDrive()
                        driveVideos = emptyList()
                        launchDriveConnect()
                    } catch (failure: CancellationException) {
                        throw failure
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to switch Google Drive account."
                    } finally {
                        switching = false
                    }
                }
            }
        )
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.VideoLibrary, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                Column(Modifier.weight(1f).padding(start = 8.dp)) {
                    Text("Video analysis", fontWeight = FontWeight.Bold)
                    Text(
                        when {
                            !driveConnected -> "Connect Google Drive to store assessment videos."
                            driveEmail.isNotBlank() -> "Stored in Google Drive · $driveEmail"
                            else -> "Stored in Google Drive"
                        },
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                if (driveConnected) {
                    TextButton(onClick = { confirmSwitch = true }, enabled = !uploading && !switching) {
                        Icon(Icons.Outlined.SwapHoriz, contentDescription = null, modifier = Modifier.size(16.dp))
                        Text(" Switch", fontSize = 12.sp)
                    }
                }
            }

            video?.let { result -> AssessmentVideoResult(result) }

            if (driveConnected && !completed) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) {
                        OutlinedButton(
                            onClick = { driveMenuOpen = true },
                            enabled = !uploading && driveVideos.isNotEmpty(),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Outlined.Cloud, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text(
                                selectedDriveVideo?.name ?: when {
                                    driveLoading -> "  Loading Drive videos?"
                                    driveVideos.isEmpty() -> "  No videos in Google Drive"
                                    else -> "  Choose from Google Drive (${driveVideos.size})"
                                },
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f).padding(start = 4.dp)
                            )
                            Icon(Icons.Outlined.ArrowDropDown, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                        DropdownMenu(expanded = driveMenuOpen, onDismissRequest = { driveMenuOpen = false }) {
                            driveVideos.forEach { file ->
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text(file.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                            Text(file.modifiedTime.take(10), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    },
                                    onClick = { selectedDriveVideo = file; driveMenuOpen = false }
                                )
                            }
                        }
                    }
                    IconButton(
                        onClick = {
                            onRefreshDrive()
                            scope.launch { error = ""; loadDriveVideos() }
                        },
                        enabled = !driveLoading && !uploading
                    ) {
                        if (driveLoading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Outlined.Refresh, contentDescription = "Refresh Google Drive videos")
                    }
                }
            }

            if (uploading) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(
                    "Analysing the video with AI. Keep this screen open; this can take a few minutes.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)

            if (!completed || video?.driveLink != null) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    video?.driveLink?.let { link ->
                        OutlinedButton(
                            onClick = {
                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link)))
                                } catch (_: ActivityNotFoundException) {
                                    error = "No app is available to open Google Drive."
                                }
                            },
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Outlined.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Open in Drive")
                        }
                    }
                    if (!completed) {
                        if (driveConnected) {
                            selectedDriveVideo?.let { file ->
                                OutlinedButton(
                                    onClick = {
                                        scope.launch {
                                            uploading = true
                                            error = ""
                                            try {
                                                val (updated, result) = api.analyzeAssessmentDriveVideo(token, assessment.id, file.id)
                                                video = result
                                                selectedDriveVideo = null
                                                onAssessmentUpdated(updated)
                                                onNotice("Google Drive video analysed.")
                                            } catch (failure: CancellationException) {
                                                throw failure
                                            } catch (failure: Exception) {
                                                error = failure.message ?: "Unable to analyse this Google Drive video."
                                            } finally {
                                                uploading = false
                                            }
                                        }
                                    },
                                    enabled = !uploading,
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Text("  Analyse Drive video")
                                }
                            }
                            Button(
                                onClick = { picker.launch(arrayOf("video/*")) },
                                enabled = !uploading,
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Icon(Icons.Outlined.CloudUpload, contentDescription = null, modifier = Modifier.size(18.dp))
                                Text(if (video == null) "  Upload video" else "  Replace video")
                            }
                        } else {
                            OutlinedButton(onClick = onRefreshDrive, shape = RoundedCornerShape(14.dp)) {
                                Icon(Icons.Outlined.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                                Text("  Refresh")
                            }
                            Button(
                                onClick = { launchDriveConnect() },
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Text("Connect Google Drive")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SwitchDriveDialog(email: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Outlined.SwapHoriz, contentDescription = null) },
        title = { Text("Switch Google Drive account?") },
        text = {
            Text(
                (if (email.isNotBlank()) "$email will be disconnected. " else "The current account will be disconnected. ") +
                    "You'll then choose the Google account to use for assessment videos. Videos already in Drive are not affected."
            )
        },
        confirmButton = { Button(onClick = onConfirm) { Text("Switch account") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun AssessmentVideoResult(video: AssessmentVideo) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text("${video.overallScore}", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text(" / 100 AI score", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp))
        }
        if (video.detectedIssues.isNotEmpty()) {
            Text("Detected issues", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            video.detectedIssues.forEach { Text("• $it", fontSize = 13.sp) }
        }
        if (video.recommendedDrills.isNotEmpty()) {
            Text("Recommended drills", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
            video.recommendedDrills.forEach { Text("• $it", fontSize = 13.sp) }
        }
        if (video.biomechanics.isNotEmpty()) {
            Text("Biomechanics", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
            video.biomechanics.forEach { (key, value) ->
                Text("${humanizeMetricKey(key)}: $value", fontSize = 13.sp)
            }
        }
    }
}

private fun humanizeMetricKey(key: String): String =
    key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
