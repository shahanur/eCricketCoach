package com.ecricketcoach.mobile.presentation.assessment

import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.domain.repository.*
import com.ecricketcoach.mobile.utils.*
import com.ecricketcoach.mobile.presentation.club.*
import com.ecricketcoach.mobile.presentation.session.*
import com.ecricketcoach.mobile.presentation.common.*
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.VideoLibrary
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ZoomIn
import androidx.compose.material.icons.outlined.ZoomOut
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.util.Base64

private val StandaloneShotTypes = listOf(
    "front_foot_drive", "back_foot_drive", "forward_defence", "backward_defence", "pull", "cut", "sweep"
)
private val StandaloneBowlerTypes = listOf("pace", "spin")
private val ManualFrameRoles = listOf("pre_contact", "point_of_contact", "post_contact")
private const val MaxManualFramesPerRole = 20
private const val ContactFramePageSize = 40
private const val ContactFramesBeforeCenter = 20

@Composable
internal fun StandaloneCapeAnalysisPanel(
    analysisRepository: AnalysisRepository,
    player: ClubMember?,
    discipline: String,
    videoUri: Uri?,
    driveFileId: String?,
    videoName: String?,
    onJobQueued: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val target = when (discipline) {
        "BATTING" -> "batter"
        "BOWLING" -> "bowler"
        else -> null
    }
    var setupOpen by remember(player?.id, discipline) { mutableStateOf(false) }
    var frame by remember(videoUri, driveFileId) { mutableStateOf<CalibrationFrame?>(null) }
    var cachedDriveVideo by remember(videoUri, driveFileId) { mutableStateOf<File?>(null) }
    var loadingFrame by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var loadingCandidates by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var candidatesError by remember { mutableStateOf("") }
    var job by remember(player?.id, target) { mutableStateOf<CapeJob?>(null) }
    var jobLoading by remember(player?.id, target) { mutableStateOf(false) }
    var handedness by remember(player?.id) { mutableStateOf("right") }
    var shotType by remember(player?.id) { mutableStateOf(StandaloneShotTypes.first()) }
    var bowlerType by remember(player?.id) { mutableStateOf(StandaloneBowlerTypes.first()) }
    var manualMode by remember(player?.id) { mutableStateOf(false) }
    var activeFrameRole by remember(player?.id) { mutableStateOf("point_of_contact") }
    var manualFrames by remember(player?.id) { mutableStateOf(CapeManualFrames()) }
    var contactCandidates by remember(player?.id) { mutableStateOf<CapeContactCandidates?>(null) }
    var previewingContactFrame by remember(player?.id) { mutableStateOf<CapeContactFrame?>(null) }
    val calibrationPoints = remember(player?.id, videoUri, driveFileId) { mutableStateListOf<Pair<Int, Int>>() }
    val sourceLabel = videoName ?: videoUri?.lastPathSegment ?: driveFileId?.let { "Google Drive video" }
    val pendingJobId = job?.takeIf { it.isPending }?.jobId

    DisposableEffect(cachedDriveVideo) {
        onDispose { cachedDriveVideo?.delete() }
    }

    LaunchedEffect(player?.id, target) {
        val currentPlayer = player
        val currentTarget = target
        if (currentPlayer == null || currentTarget == null) {
            job = null
            return@LaunchedEffect
        }
        jobLoading = true
        try {
            job = analysisRepository.getLatestPlayerCapeJob(currentPlayer.id, currentTarget)
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to load the latest detailed analysis."
        } finally {
            jobLoading = false
        }
    }

    LaunchedEffect(pendingJobId) {
        val id = pendingJobId ?: return@LaunchedEffect
        var wait = 3_000L
        while (true) {
            delay(wait)
            try {
                val next = analysisRepository.getCapeJob(id)
                job = next
                if (!next.isPending) {
                    onJobQueued()
                    break
                }
            } catch (failure: CancellationException) {
                throw failure
            } catch (_: Exception) {
                // Keep polling after a transient connection failure.
            }
            wait = minOf(wait * 13 / 10, 15_000L)
        }
    }

    LaunchedEffect(setupOpen, videoUri, driveFileId) {
        if (!setupOpen) return@LaunchedEffect
        calibrationPoints.clear()
        manualFrames = CapeManualFrames()
        contactCandidates = null
        candidatesError = ""
        frame = null
        error = ""
        if (videoUri == null && driveFileId == null) return@LaunchedEffect
        loadingFrame = true
        try {
            frame = if (videoUri != null) {
                loadFirstFrame(context, videoUri)
            } else {
                val cached = analysisRepository.downloadDriveVideoToCache(requireNotNull(driveFileId))
                cachedDriveVideo = cached
                loadFirstFrame(cached)
            }
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to load the first video frame for calibration."
        } finally {
            loadingFrame = false
        }
    }

    fun selectedFrames(role: String, selection: CapeManualFrames = manualFrames): List<Int> = when (role) {
        "pre_contact" -> selection.preContact
        "point_of_contact" -> selection.pointOfContact
        else -> selection.postContact
    }

    fun toggleContactFrame(index: Int) {
        val current = selectedFrames(activeFrameRole)
        if (index in current) {
            val updated = current - index
            manualFrames = when (activeFrameRole) {
                "pre_contact" -> manualFrames.copy(preContact = updated)
                "point_of_contact" -> manualFrames.copy(pointOfContact = updated)
                else -> manualFrames.copy(postContact = updated)
            }
            return
        }
        if (current.size >= MaxManualFramesPerRole) {
            candidatesError = "Choose no more than $MaxManualFramesPerRole frames for each phase."
            return
        }
        val clean = manualFrames.copy(
            preContact = manualFrames.preContact - index,
            pointOfContact = manualFrames.pointOfContact - index,
            postContact = manualFrames.postContact - index
        )
        val updated = (current + index).sorted()
        manualFrames = when (activeFrameRole) {
            "pre_contact" -> clean.copy(preContact = updated)
            "point_of_contact" -> clean.copy(pointOfContact = updated)
            else -> clean.copy(postContact = updated)
        }
        candidatesError = ""
    }

    fun loadCandidatePage(startFrame: Int, frameCount: Int? = null) {
        scope.launch {
            loadingCandidates = true
            candidatesError = ""
            try {
                val start = startFrame.coerceAtLeast(0)
                val before = frameCount?.let { minOf(ContactFramesBeforeCenter, (it - 1 - start).coerceAtLeast(0)) }
                    ?: ContactFramesBeforeCenter
                val after = ContactFramePageSize - 1 - before
                contactCandidates = analysisRepository.getCapeContactCandidates(
                    videoUri,
                    driveFileId,
                    centerFrame = start + before,
                    before = before,
                    after = after
                )
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                candidatesError = failure.message ?: "Unable to load contact frames."
            } finally {
                loadingCandidates = false
            }
        }
    }

    Card(modifier = modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Insights, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(19.dp))
                Text("  Detailed pose, ball & speed analysis", fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                if (job?.isPending != true && player != null && target != null) {
                    Button(onClick = { setupOpen = true; manualFrames = CapeManualFrames(); contactCandidates = null; error = "" }, enabled = !submitting) {
                        Text(if (job == null) "Analyse" else "New analysis")
                    }
                }
            }
            Text("Calibrate the pitch, then queue a detailed CAPE analysis with measured findings and downloadable snapshots.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (player == null) Text("Select an athlete above to run a detailed analysis.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            else if (target == null) Text("Detailed CAPE analysis currently supports batting and bowling.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            else if (sourceLabel == null) Text("Choose a device or Google Drive video above to enable detailed analysis.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)

            if (jobLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (job?.isPending == true) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(if (job?.status == "RUNNING") "Analysing video…" else "Queued for analysis…", fontSize = 12.sp)
            }
            if (job?.status == "FAILED") Text(job?.errorMessage ?: "The detailed analysis failed.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            if (setupOpen && player != null && target != null) {
                HorizontalDivider()
                Text("Video: ${sourceLabel ?: "No video selected"}", fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(if (target == "batter") "Batter hand" else "Bowler hand", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("right", "left").forEach { hand ->
                        FilterChip(selected = handedness == hand, onClick = { handedness = hand }, label = { Text("${hand.replaceFirstChar(Char::uppercase)}-handed", fontSize = 12.sp) })
                    }
                }
                Text(if (target == "batter") "Shot" else "Bowling type", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (target == "batter") {
                        StandaloneShotTypes.forEach { value -> FilterChip(selected = shotType == value, onClick = { shotType = value }, label = { Text(value.replace('_', ' ').replaceFirstChar(Char::uppercase), fontSize = 11.sp) }) }
                    } else {
                        StandaloneBowlerTypes.forEach { value -> FilterChip(selected = bowlerType == value, onClick = { bowlerType = value }, label = { Text(value.replaceFirstChar(Char::uppercase), fontSize = 12.sp) }) }
                    }
                }
                when {
                    loadingFrame -> Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        Text("  Loading the first frame…", fontSize = 12.sp)
                    }
                    frame != null -> {
                        Text(
                            if (calibrationPoints.size < 4) "Tap pitch corner ${calibrationPoints.size + 1}: ${CORNER_LABELS[calibrationPoints.size]} (left/right as seen from the bowler’s end)."
                            else "All four pitch corners marked.",
                            fontSize = 12.sp
                        )
                        CalibrationOverlay(frame!!, calibrationPoints) {
                            if (calibrationPoints.size < 4) calibrationPoints.add(it)
                        }
                        if (calibrationPoints.isNotEmpty()) TextButton(onClick = { calibrationPoints.clear() }) { Text("Reset corners") }
                    }
                    sourceLabel == null -> Text("Choose a video above first.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
                if (target == "batter") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = manualMode, onCheckedChange = {
                            manualMode = it
                            manualFrames = CapeManualFrames()
                            contactCandidates = null
                            candidatesError = ""
                        })
                        Text("Select contact frames manually (for poor-quality video)", fontSize = 12.sp)
                    }
                    if (manualMode) {
                        if (contactCandidates == null) {
                            OutlinedButton(
                                onClick = { loadCandidatePage(0) },
                                enabled = !loadingCandidates && sourceLabel != null
                            ) {
                                if (loadingCandidates) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                                else Icon(Icons.Outlined.VideoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                                Text(if (loadingCandidates) "  Loading frames…" else "  Browse all video frames")
                            }
                        }
                        contactCandidates?.let { data ->
                            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                ManualFrameRoles.forEach { role ->
                                    val count = selectedFrames(role).size
                                    FilterChip(
                                        selected = activeFrameRole == role,
                                        onClick = { activeFrameRole = role },
                                        label = { Text("${role.replace('_', ' ').replaceFirstChar(Char::uppercase)} · $count", fontSize = 10.sp) }
                                    )
                                }
                            }
                            Text("Choose at least one contact frame. Pre/post-contact frames are optional and must be in time order.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            val firstFrame = data.frames.firstOrNull()?.index
                            val lastFrame = data.frames.lastOrNull()?.index
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    if (firstFrame != null && lastFrame != null) "Frames #$firstFrame–#$lastFrame of ${data.frameCount} · browse all frames"
                                    else "No frames available",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Row {
                                    TextButton(
                                        onClick = { if (firstFrame != null) loadCandidatePage((firstFrame - ContactFramePageSize).coerceAtLeast(0), data.frameCount) },
                                        enabled = !loadingCandidates && firstFrame != null && firstFrame > 0
                                    ) { Text("Earlier") }
                                    TextButton(
                                        onClick = { if (lastFrame != null) loadCandidatePage(lastFrame + 1, data.frameCount) },
                                        enabled = !loadingCandidates && lastFrame != null && lastFrame < data.frameCount - 1
                                    ) { Text("Later") }
                                }
                            }
                            if (loadingCandidates) LinearProgressIndicator(Modifier.fillMaxWidth())
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(data.frames, key = CapeContactFrame::index) { candidate ->
                                    val image = remember(candidate.imageBase64) {
                                        runCatching {
                                            val encoded = candidate.imageBase64.substringAfter("base64,", candidate.imageBase64)
                                            val bytes = Base64.getDecoder().decode(encoded)
                                            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                        }.getOrNull()
                                    }
                                    DisposableEffect(image) { onDispose { image?.recycle() } }
                                    val selectedRole = ManualFrameRoles.firstOrNull { candidate.index in selectedFrames(it) }
                                    Column(
                                        Modifier.width(126.dp).padding(bottom = 4.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        if (image != null) {
                                            Image(
                                                image.asImageBitmap(),
                                                contentDescription = "Frame ${candidate.index}",
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxWidth().height(86.dp).clickable { toggleContactFrame(candidate.index) }
                                            )
                                        } else {
                                            Box(Modifier.fillMaxWidth().height(86.dp), contentAlignment = Alignment.Center) {
                                                Text("Preview unavailable", fontSize = 10.sp)
                                            }
                                        }
                                        Text(
                                            "#${candidate.index} · ${String.format(java.util.Locale.getDefault(), "%.2f", candidate.timeSeconds)}s" +
                                                (selectedRole?.let { " · ${it.substringBefore('_').uppercase()}" } ?: ""),
                                            fontSize = 10.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        TextButton(onClick = { previewingContactFrame = candidate }, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 6.dp, vertical = 0.dp)) {
                                            Text("Enlarge", fontSize = 10.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (candidatesError.isNotBlank()) Text(candidatesError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                if (calibrationPoints.size < 4) Text("Mark all four pitch corners to enable analysis.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        enabled = !submitting && frame != null && calibrationPoints.size == 4 &&
                            (videoUri != null || driveFileId != null) && (!manualMode || contactCandidates != null && manualFrames.isValid()),
                        onClick = {
                            val currentPlayer = player ?: return@Button
                            scope.launch {
                                submitting = true
                                error = ""
                                try {
                                    val jobId = analysisRepository.analyzePlayerVideoWithCape(
                                        currentPlayer.id, videoUri, driveFileId,
                                        CapeInput(
                                            target = target,
                                            handedness = handedness,
                                            shotType = shotType.takeIf { target == "batter" },
                                            bowlerType = bowlerType.takeIf { target == "bowler" },
                                            calibrationPoints = calibrationPoints.toList()
                                        ),
                                        manualFrames.takeIf { manualMode }
                                    )
                                    job = CapeJob(jobId, "QUEUED", null, null, null)
                                    setupOpen = false
                                    onJobQueued()
                                } catch (failure: CancellationException) {
                                    throw failure
                                } catch (failure: Exception) {
                                    error = failure.message ?: "Unable to submit this video."
                                } finally {
                                    submitting = false
                                }
                            }
                        }
                    ) {
                        if (submitting) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp) else Text("Analyse")
                    }
                    TextButton(onClick = { setupOpen = false }, enabled = !submitting) { Text("Cancel") }
                }
            }
        }
    }
    previewingContactFrame?.let { selectedFrame ->
        ContactFramePreviewDialog(selectedFrame) { previewingContactFrame = null }
    }
}

@Composable
private fun ContactFramePreviewDialog(frame: CapeContactFrame, onDismiss: () -> Unit) {
    var zoom by remember(frame.index) { mutableStateOf(1f) }
    val zoomState = rememberTransformableState { zoomChange, _, _ ->
        zoom = (zoom * zoomChange).coerceIn(1f, 4f)
    }
    val image = remember(frame.imageBase64) {
        runCatching {
            val encoded = frame.imageBase64.substringAfter("base64,", frame.imageBase64)
            val bytes = Base64.getDecoder().decode(encoded)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }.getOrNull()
    }
    DisposableEffect(image) { onDispose { image?.recycle() } }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize()) {
                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Frame #${frame.index} · ${String.format(java.util.Locale.getDefault(), "%.2f", frame.timeSeconds)}s",
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    IconButton(onClick = { zoom = (zoom / 1.4f).coerceAtLeast(1f) }, enabled = zoom > 1f) {
                        Icon(Icons.Outlined.ZoomOut, contentDescription = "Zoom out")
                    }
                    Text("${(zoom * 100).toInt()}%", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    IconButton(onClick = { zoom = (zoom * 1.4f).coerceAtMost(4f) }, enabled = zoom < 4f) {
                        Icon(Icons.Outlined.ZoomIn, contentDescription = "Zoom in")
                    }
                    TextButton(onClick = onDismiss) {
                        Icon(Icons.Outlined.Close, contentDescription = null, modifier = Modifier.size(17.dp))
                        Text(" Close")
                    }
                }
                HorizontalDivider()
                if (image != null) {
                    Image(
                        bitmap = image.asImageBitmap(),
                        contentDescription = "Enlarged video frame ${frame.index}",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize().padding(12.dp).graphicsLayer(scaleX = zoom, scaleY = zoom).transformable(zoomState)
                    )
                } else {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Frame preview is unavailable.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

