package com.ecricketcoach.mobile.presentation.assessment

import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.domain.repository.*
import com.ecricketcoach.mobile.utils.*
import com.ecricketcoach.mobile.presentation.club.*
import com.ecricketcoach.mobile.presentation.session.*
import com.ecricketcoach.mobile.presentation.common.*
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.PhoneAndroid
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
    analysisRepository: AnalysisRepository,
    assessment: PlayerAssessment,
    driveConnected: Boolean,
    driveEmail: String,
    onRefreshDrive: () -> Unit,
    onDisconnectDrive: suspend () -> Unit,
    onNotice: (String) -> Unit,
    modifier: Modifier = Modifier,
    headerContent: (@Composable () -> Unit)? = null,
    showTitle: Boolean = true
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val completed = assessment.status == "COMPLETED"
    var video by remember(assessment.id) { mutableStateOf<AssessmentVideo?>(null) }
    var loading by remember(assessment.id) { mutableStateOf(false) }
    var reviewRunning by remember(assessment.id) { mutableStateOf(false) }
    var error by remember(assessment.id) { mutableStateOf("") }
    var selectedVideoUri by remember(assessment.id) { mutableStateOf<Uri?>(null) }
    var selectedVideoName by remember(assessment.id) { mutableStateOf("") }
    var driveVideos by remember { mutableStateOf<List<DriveVideoFile>>(emptyList()) }
    var driveLoading by remember { mutableStateOf(false) }
    var driveMenuOpen by remember { mutableStateOf(false) }
    var selectedDriveVideo by remember(assessment.id) { mutableStateOf<DriveVideoFile?>(null) }

    suspend fun loadDriveVideos() {
        driveLoading = true
        try {
            val files = analysisRepository.listGoogleDriveVideos()
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
            CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(analysisRepository.googleDriveConnectUrl()))
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
            video = analysisRepository.getAssessmentVideo(assessment.id)
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
        selectedVideoUri = uri
        selectedVideoName = context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0).orEmpty() else "" }
            .orEmpty()
        selectedDriveVideo = null
        error = ""
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
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val storageCaption = when {
                !driveConnected -> "Choose a video from this device or connect Google Drive."
                driveEmail.isNotBlank() -> "Stored in Google Drive · $driveEmail"
                else -> "Stored in Google Drive"
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (showTitle) {
                    Icon(Icons.Outlined.VideoLibrary, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                    Column(Modifier.weight(1f).padding(start = 8.dp)) {
                        Text("Video analysis", fontWeight = FontWeight.Bold)
                        // While a video can still be chosen, the caption sits in the video source panel instead.
                        if (completed) Text(storageCaption, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                headerContent?.invoke()
                if (!showTitle) Spacer(Modifier.weight(1f))
                if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            }

            val sourcePicker: @Composable () -> Unit = {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (driveConnected) Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    run {
                        Box(Modifier.weight(1f)) {
                            OutlinedButton(
                                onClick = { driveMenuOpen = true },
                                enabled = !reviewRunning && driveVideos.isNotEmpty(),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                modifier = Modifier.fillMaxWidth().height(40.dp)
                            ) {
                                Icon(Icons.Outlined.Cloud, contentDescription = null, modifier = Modifier.size(16.dp))
                                Text(
                                    selectedDriveVideo?.name ?: when {
                                        driveLoading -> "Loading Drive videos…"
                                        driveVideos.isEmpty() -> "No Drive videos"
                                        else -> "Google Drive (${driveVideos.size})"
                                    },
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f).padding(start = 6.dp)
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
                                        onClick = {
                                            selectedDriveVideo = file
                                            selectedVideoUri = null
                                            selectedVideoName = ""
                                            driveMenuOpen = false
                                        }
                                    )
                                }
                            }
                        }
                        IconButton(
                            onClick = {
                                onRefreshDrive()
                                scope.launch { error = ""; loadDriveVideos() }
                            },
                            enabled = !driveLoading && !reviewRunning,
                            modifier = Modifier.size(36.dp)
                        ) {
                            if (driveLoading) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            else Icon(Icons.Outlined.Refresh, contentDescription = "Refresh Google Drive videos", modifier = Modifier.size(18.dp))
                        }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val localSelected = selectedVideoName.isNotBlank()
                    OutlinedButton(
                        onClick = { picker.launch(arrayOf("video/*")) },
                        enabled = !reviewRunning,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                        modifier = Modifier.weight(1f).height(40.dp)
                    ) {
                        Icon(Icons.Outlined.PhoneAndroid, contentDescription = null, modifier = Modifier.size(16.dp))
                        Text(
                            if (localSelected) selectedVideoName else "From device",
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(start = 6.dp)
                        )
                    }
                    OutlinedButton(
                        onClick = { if (driveConnected) confirmSwitch = true else launchDriveConnect() },
                        enabled = !reviewRunning && !switching,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                        modifier = Modifier.weight(1f).height(40.dp)
                    ) {
                        Icon(
                            if (driveConnected) Icons.Outlined.SwapHoriz else Icons.Outlined.Cloud,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            if (driveConnected) "Switch account" else "Connect Drive",
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(start = 6.dp)
                        )
                    }
                }
                }
            }
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)

            AssessmentBattingReview(
                analysisRepository = analysisRepository,
                assessment = assessment,
                videoUri = selectedVideoUri,
                driveFileId = selectedDriveVideo?.id,
                canSubmit = !completed,
                onRunningChange = { reviewRunning = it },
                onNotice = onNotice,
                sourcePicker = sourcePicker.takeIf { !completed },
                sourceCaption = storageCaption
            )

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
