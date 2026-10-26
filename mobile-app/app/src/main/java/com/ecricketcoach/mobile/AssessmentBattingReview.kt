package com.ecricketcoach.mobile

import android.content.Context
import android.net.Uri
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.util.Locale

private val assessmentReviewPriorities = listOf(
    "footwork" to "Footwork",
    "head_alignment" to "Head alignment",
    "contact" to "Contact",
    "joint_angles" to "Joint angles",
    "bat_path" to "Bat path",
    "extension" to "Extension",
    "follow_through" to "Follow-through"
)

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
internal fun AssessmentBattingReview(
    api: CoachApi,
    token: String,
    assessment: PlayerAssessment,
    videoUri: Uri?,
    driveFileId: String?,
    canSubmit: Boolean,
    onRunningChange: (Boolean) -> Unit,
    onNotice: (String) -> Unit,
    sourcePicker: (@Composable () -> Unit)? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sourceKey = videoUri?.toString() ?: driveFileId.orEmpty()
    var analysis by remember(assessment.id) { mutableStateOf<OpenAiBattingAnalysis?>(null) }
    var isLoadingSaved by remember(assessment.id) { mutableStateOf(false) }
    var savedError by remember(assessment.id) { mutableStateOf("") }
    var isRunning by remember(assessment.id) { mutableStateOf(false) }
    var error by remember(assessment.id) { mutableStateOf("") }
    var shotType by remember(assessment.id) { mutableStateOf("front_foot_drive") }
    var handedness by remember(assessment.id) { mutableStateOf("right") }
    var cameraView by remember(assessment.id) { mutableStateOf("front_on") }
    var playbackSpeed by remember(assessment.id) { mutableStateOf("slow_motion") }
    var captureFps by remember(assessment.id) { mutableStateOf("") }
    var priorities by remember(assessment.id) { mutableStateOf(assessmentReviewPriorities.map { it.first }.toSet()) }
    var manualContact by remember(assessment.id) { mutableStateOf(true) }
    var showMoreOptions by remember(assessment.id) { mutableStateOf(false) }
    var previewLoading by remember(sourceKey) { mutableStateOf(false) }
    var previewError by remember(sourceKey) { mutableStateOf("") }
    var previewCache by remember(sourceKey) { mutableStateOf<File?>(null) }
    var videoPlayer by remember(sourceKey) { mutableStateOf<VideoView?>(null) }
    var videoDuration by remember(sourceKey) { mutableStateOf(0f) }
    var contactSeconds by remember(sourceKey) { mutableStateOf(0f) }
    var startSeconds by remember(sourceKey) { mutableStateOf(0f) }
    var endSeconds by remember(sourceKey) { mutableStateOf(0f) }
    val previewUri = videoUri ?: previewCache?.toUri()
    val fpsValue = captureFps.toDoubleOrNull()
    val fpsIsValid = captureFps.isBlank() || (fpsValue != null && fpsValue in 1.0..1000.0)

    LaunchedEffect(assessment.id, assessment.playerId, assessment.discipline) {
        if (assessment.discipline != "BATTING") return@LaunchedEffect
        isLoadingSaved = true
        savedError = ""
        try {
            analysis = api.getLatestOpenAiBattingAnalysis(token, assessment.playerId, assessment.id)
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            savedError = failure.message ?: "Could not load the saved batting review."
        } finally {
            isLoadingSaved = false
        }
    }

    LaunchedEffect(sourceKey, manualContact) {
        previewError = ""
        videoDuration = 0f
        startSeconds = 0f
        endSeconds = 0f
        contactSeconds = 0f
        if (!manualContact || sourceKey.isBlank() || videoUri != null) return@LaunchedEffect
        previewLoading = true
        try {
            previewCache = api.downloadDriveVideoToCache(context, token, requireNotNull(driveFileId))
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            previewError = failure.message ?: "Could not load this Drive video preview."
        } finally {
            previewLoading = false
        }
    }

    DisposableEffect(previewCache) {
        onDispose { previewCache?.delete() }
    }

    LaunchedEffect(videoPlayer, videoDuration, startSeconds, endSeconds) {
        while (videoDuration > 0f) {
            delay(150)
            val currentPlayer = videoPlayer ?: continue
            if (currentPlayer.isPlaying) {
                val currentSeconds = currentPlayer.currentPosition / 1000f
                if (currentSeconds in startSeconds..endSeconds) contactSeconds = currentSeconds
            }
        }
    }

    if (assessment.discipline != "BATTING") {
        sourcePicker?.invoke()
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                "OpenAI batting video review is available for batting assessments.",
                modifier = Modifier.padding(12.dp),
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        return
    }

    val canReview = !isRunning && sourceKey.isNotBlank() && fpsIsValid &&
        (!manualContact || (videoDuration > 0f && endSeconds > startSeconds && contactSeconds in startSeconds..endSeconds))
    val reviewHint = when {
        sourceKey.isBlank() -> "Choose a video above to start."
        !fpsIsValid -> "Enter a frame rate between 1 and 1000, or leave it blank."
        manualContact && previewError.isNotBlank() -> "Switch to Auto-detect, or choose another video."
        manualContact && videoDuration <= 0f -> "Waiting for the video preview to load…"
        manualContact && endSeconds <= startSeconds -> "The shot end must be after the start."
        else -> ""
    }
    val frameStep = (1.0 / (fpsValue?.takeIf { fpsIsValid } ?: 30.0)).toFloat()

    fun moveContact(seconds: Float) {
        contactSeconds = seconds.coerceIn(startSeconds, endSeconds)
        videoPlayer?.let { player ->
            if (player.isPlaying) player.pause()
            player.seekTo((contactSeconds * 1000).toInt())
        }
    }

    fun runReview() {
        scope.launch {
            isRunning = true
            onRunningChange(true)
            error = ""
            analysis = null
            try {
                analysis = api.analyzeOpenAiBattingVideo(
                    context = context,
                    token = token,
                    uri = videoUri,
                    driveFileId = driveFileId,
                    player = null,
                    playerId = assessment.playerId,
                    assessmentId = assessment.id,
                    shotType = shotType,
                    batterHandedness = handedness,
                    cameraView = cameraView,
                    playbackSpeed = playbackSpeed,
                    captureFps = fpsValue,
                    priorities = assessmentReviewPriorities.map { it.first }.filter { it in priorities },
                    contactTimestampSeconds = contactSeconds.takeIf { manualContact }?.toDouble(),
                    startTimeSeconds = startSeconds.takeIf { manualContact }?.toDouble(),
                    endTimeSeconds = endSeconds.takeIf { manualContact }?.toDouble()
                )
                onNotice("OpenAI batting review complete.")
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                error = failure.message ?: "The batting review could not be completed."
            } finally {
                isRunning = false
                onRunningChange(false)
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (canSubmit) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val shotSettings: @Composable (Modifier) -> Unit = { settingsModifier ->
                    Column(settingsModifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Batting video review", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(
                            "Set the shot details, mark contact, then review.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        ReviewOptionChip(
                            label = "Shot",
                            selected = shotType,
                            options = listOf(
                                "front_foot_drive" to "Front-foot drive",
                                "front_foot_defence" to "Front-foot defence",
                                "unknown" to "Identify if visible"
                            ),
                            enabled = !isRunning,
                            onSelected = { shotType = it }
                        )
                        ReviewOptionChip(
                            label = "Batter",
                            selected = handedness,
                            options = listOf("right" to "Right-handed", "left" to "Left-handed", "unknown" to "Unknown"),
                            enabled = !isRunning,
                            onSelected = { handedness = it }
                        )
                        ReviewOptionChip(
                            label = "Camera",
                            selected = cameraView,
                            options = listOf(
                                "front_on" to "Front-on",
                                "side_on" to "Side-on",
                                "three_quarter" to "Three-quarter",
                                "unknown" to "Unknown"
                            ),
                            enabled = !isRunning,
                            onSelected = { cameraView = it }
                        )
                        ReviewOptionChip(
                            label = "Speed",
                            selected = playbackSpeed,
                            options = listOf(
                                "real_time" to "Real-time",
                                "slow_motion" to "Slow motion",
                                "unknown" to "Unknown"
                            ),
                            enabled = !isRunning,
                            onSelected = { playbackSpeed = it }
                        )
                        AssistChip(
                            onClick = { showMoreOptions = !showMoreOptions },
                            enabled = !isRunning,
                            leadingIcon = { Icon(Icons.Outlined.Tune, contentDescription = null, modifier = Modifier.size(14.dp)) },
                            label = {
                                Text(
                                    buildString {
                                        append("Focus: ")
                                        append(if (priorities.size == assessmentReviewPriorities.size) "all" else "${priorities.size}/${assessmentReviewPriorities.size}")
                                        append(" · ")
                                        append(if (captureFps.isBlank()) "fps auto" else "$captureFps fps")
                                    },
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    color = if (fpsIsValid) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error
                                )
                            },
                            trailingIcon = {
                                Icon(
                                    if (showMoreOptions) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                                    contentDescription = if (showMoreOptions) "Hide coaching focus" else "Show coaching focus",
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        )
                    }
                    }
                    }
                    val videoSource: @Composable (Modifier) -> Unit = { sourceModifier ->
                        Column(sourceModifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Video", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            sourcePicker?.invoke()
                        }
                    }
                    BoxWithConstraints(Modifier.fillMaxWidth()) {
                        if (sourcePicker != null && maxWidth >= 640.dp) {
                            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                videoSource(Modifier.weight(1f))
                                shotSettings(Modifier.weight(1f))
                            }
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                sourcePicker?.invoke()
                                shotSettings(Modifier.fillMaxWidth())
                            }
                        }
                    }

                    AnimatedVisibility(visible = showMoreOptions) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                assessmentReviewPriorities.forEach { (key, label) ->
                                    val checked = key in priorities
                                    FilterChip(
                                        selected = checked,
                                        onClick = { priorities = if (checked) priorities - key else priorities + key },
                                        label = { Text(label, fontSize = 11.sp) },
                                        leadingIcon = if (checked) {
                                            { Icon(Icons.Outlined.Check, contentDescription = null, modifier = Modifier.size(14.dp)) }
                                        } else null,
                                        enabled = !isRunning
                                    )
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                OutlinedTextField(
                                    value = captureFps,
                                    onValueChange = { captureFps = it.filter { char -> char.isDigit() || char == '.' }.take(7) },
                                    modifier = Modifier.width(150.dp),
                                    label = { Text("Frame rate (fps)", fontSize = 11.sp) },
                                    placeholder = { Text("Auto", fontSize = 12.sp) },
                                    textStyle = MaterialTheme.typography.bodySmall,
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    isError = !fpsIsValid,
                                    enabled = !isRunning
                                )
                                Text(
                                    if (fpsIsValid) "Optional. Helps the review time slow-motion clips."
                                    else "Enter a frame rate between 1 and 1000.",
                                    fontSize = 11.sp,
                                    color = if (fpsIsValid) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    val contactHint = when {
                        !manualContact -> "OpenAI estimates contact from the whole clip."
                        previewLoading -> "Loading video preview…"
                        previewError.isNotBlank() -> previewError
                        previewUri == null -> "Choose a video to mark contact."
                        else -> "Mark the moment the bat meets the ball."
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Contact point", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        if (manualContact && previewLoading) CircularProgressIndicator(Modifier.size(12.dp), strokeWidth = 1.5.dp)
                        Text(
                            contactHint,
                            fontSize = 11.sp,
                            color = if (manualContact && previewError.isNotBlank()) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        SingleChoiceSegmentedButtonRow(Modifier.height(34.dp)) {
                            SegmentedButton(
                                selected = manualContact,
                                onClick = { manualContact = true },
                                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                                enabled = !isRunning,
                                icon = {}
                            ) { Text("Mark it", fontSize = 11.sp, maxLines = 1, softWrap = false) }
                            SegmentedButton(
                                selected = !manualContact,
                                onClick = { manualContact = false },
                                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                                enabled = !isRunning,
                                icon = {}
                            ) { Text("Auto-detect", fontSize = 11.sp, maxLines = 1, softWrap = false) }
                        }
                    }

                    if (manualContact && previewUri != null && !previewLoading && previewError.isBlank()) {
                        run {
                            val preview: @Composable (Modifier) -> Unit = { previewModifier ->
                                AndroidView(
                                    modifier = previewModifier.clip(RoundedCornerShape(10.dp)),
                                    factory = { playerContext ->
                                        createReviewVideoView(
                                            playerContext,
                                            previewUri,
                                            sourceKey,
                                            onDuration = { duration ->
                                                videoDuration = duration
                                                startSeconds = 0f
                                                endSeconds = duration
                                                contactSeconds = duration / 2f
                                            },
                                            onError = { previewError = "This video format could not be previewed." }
                                        ).also { videoPlayer = it }
                                    },
                                    update = { view ->
                                        videoPlayer = view
                                        if (view.tag != sourceKey) {
                                            view.tag = sourceKey
                                            view.setVideoURI(previewUri)
                                        }
                                    }
                                )
                            }
                            val timing: @Composable (Modifier) -> Unit = { timingModifier ->
                                Column(timingModifier) {
                                    if (videoDuration <= 0f) {
                                        Text("Preparing preview…", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    } else {
                                        ReviewTimeLabel("Shot range", "${formatReviewTime(startSeconds)} – ${formatReviewTime(endSeconds)}")
                                        RangeSlider(
                                            value = startSeconds..endSeconds,
                                            onValueChange = { range ->
                                                startSeconds = range.start
                                                endSeconds = range.endInclusive
                                                contactSeconds = contactSeconds.coerceIn(range.start, range.endInclusive)
                                            },
                                            valueRange = 0f..videoDuration,
                                            enabled = !isRunning,
                                            modifier = Modifier.height(36.dp)
                                        )
                                        ReviewTimeLabel("Contact", formatReviewTime(contactSeconds))
                                        Slider(
                                            value = contactSeconds.coerceIn(startSeconds, endSeconds),
                                            onValueChange = { moveContact(it) },
                                            valueRange = startSeconds..endSeconds.coerceAtLeast(startSeconds + 0.01f),
                                            enabled = !isRunning,
                                            modifier = Modifier.height(36.dp)
                                        )
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            IconButton(
                                                onClick = { moveContact(contactSeconds - frameStep) },
                                                enabled = !isRunning,
                                                modifier = Modifier.size(32.dp)
                                            ) { Icon(Icons.Outlined.ChevronLeft, contentDescription = "Previous frame") }
                                            IconButton(
                                                onClick = { moveContact(contactSeconds + frameStep) },
                                                enabled = !isRunning,
                                                modifier = Modifier.size(32.dp)
                                            ) { Icon(Icons.Outlined.ChevronRight, contentDescription = "Next frame") }
                                            TextButton(
                                                onClick = { videoPlayer?.let { moveContact(it.currentPosition / 1000f) } },
                                                enabled = !isRunning,
                                                contentPadding = PaddingValues(horizontal = 8.dp)
                                            ) { Text("Use paused frame", fontSize = 11.sp) }
                                        }
                                        Text(
                                            "Play or drag the video, pause on contact, then tap “Use paused frame”.",
                                            fontSize = 10.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                            BoxWithConstraints(Modifier.fillMaxWidth()) {
                                if (maxWidth >= 560.dp) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        preview(Modifier.weight(0.5f).height(200.dp))
                                        timing(Modifier.weight(0.5f))
                                    }
                                } else {
                                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        preview(Modifier.fillMaxWidth().height(180.dp))
                                        timing(Modifier.fillMaxWidth())
                                    }
                                }
                            }
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Column(Modifier.weight(1f)) {
                            if (!isRunning && reviewHint.isNotBlank()) {
                                Text(reviewHint, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Outlined.Info, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(12.dp))
                                Text(
                                    "Ball and bat measurements (CAPE) are temporarily off.",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                        Button(
                            onClick = { runReview() },
                            enabled = canReview,
                            modifier = Modifier.height(40.dp),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 16.dp)
                        ) {
                            if (isRunning) {
                                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                                Text("  Reviewing…", fontSize = 13.sp)
                            } else {
                                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                                Text("  Review batting", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        } else if (isLoadingSaved) {
            Text("Loading this assessment’s latest review…", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else if (analysis == null && savedError.isBlank()) {
            Text("No batting video review was recorded for this assessment.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        if (savedError.isNotBlank()) Text(savedError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        analysis?.let { current ->
            key(current.reportId) {
                OpenAiBattingReviewResult(api, token, current, assessment.playerName) { updated ->
                    if (analysis?.reportId == updated.reportId) analysis = updated
                }
            }
        }
        PastBattingReviews(
            api = api,
            token = token,
            playerId = assessment.playerId,
            playerName = assessment.playerName,
            activeReportId = analysis?.reportId,
            busy = isRunning || isLoadingSaved
        ) { reportId ->
            scope.launch {
                isLoadingSaved = true
                savedError = ""
                try {
                    analysis = api.getLatestOpenAiBattingAnalysis(token, assessment.playerId, reportId = reportId)
                } catch (failure: CancellationException) {
                    throw failure
                } catch (failure: Exception) {
                    savedError = failure.message ?: "Could not load the saved batting review."
                } finally {
                    isLoadingSaved = false
                }
            }
        }
    }
}

@Composable
private fun ReviewOptionChip(
    label: String,
    selected: String,
    options: List<Pair<String, String>>,
    enabled: Boolean,
    onSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        AssistChip(
            onClick = { expanded = true },
            enabled = enabled,
            label = {
                Text("$label: ", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    options.firstOrNull { it.first == selected }?.second ?: selected,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1
                )
            },
            trailingIcon = { Icon(Icons.Outlined.ArrowDropDown, contentDescription = null, modifier = Modifier.size(16.dp)) }
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, title) ->
                DropdownMenuItem(
                    text = { Text(title, fontSize = 12.sp, fontWeight = if (value == selected) FontWeight.SemiBold else null) },
                    leadingIcon = if (value == selected) {
                        { Icon(Icons.Outlined.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    } else null,
                    onClick = { onSelected(value); expanded = false }
                )
            }
        }
    }
}

@Composable
private fun ReviewTimeLabel(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text(value, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
    }
}

private fun createReviewVideoView(
    context: Context,
    uri: Uri,
    sourceKey: String,
    onDuration: (Float) -> Unit,
    onError: () -> Unit
): VideoView = VideoView(context).apply {
    val controller = MediaController(context)
    controller.setAnchorView(this)
    setMediaController(controller)
    setOnPreparedListener { player ->
        onDuration(player.duration / 1000f)
        // Render a still frame instead of an empty black surface before playback starts.
        seekTo(player.duration / 2)
    }
    setOnErrorListener { _, _, _ -> onError(); true }
    tag = sourceKey
    setVideoURI(uri)
}

private fun formatReviewTime(seconds: Float): String {
    val minutes = (seconds / 60).toInt()
    val remainingSeconds = seconds - minutes * 60
    return String.format(Locale.getDefault(), "%d:%05.2f", minutes, remainingSeconds)
}
