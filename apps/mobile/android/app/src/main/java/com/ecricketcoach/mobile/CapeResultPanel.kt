package com.ecricketcoach.mobile

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Base64
import java.util.Locale

private val SHOT_TYPES = listOf("front_foot_drive", "back_foot_drive", "forward_defence", "backward_defence", "pull", "cut", "sweep")
private val BOWLER_TYPES = listOf("pace", "spin")
internal val CORNER_LABELS = listOf("Batter-end left", "Batter-end right", "Bowler-end right", "Bowler-end left")
private val SNAPSHOT_LABELS = mapOf(
    "pre_contact_snapshot" to "Pre-contact",
    "impact_snapshot" to "Point of contact",
    "post_contact_snapshot" to "Post-contact",
    "release_snapshot" to "Release",
    "pitching_point_snapshot" to "Pitching point",
    "pitch_map" to "Pitch map"
)
private val GOOD = Color(0xFF10B981)
private val WARN = Color(0xFFF59E0B)
private val BAD = Color(0xFFEF4444)
private const val POLL_MS = 3_000L
private const val MAX_POLL_MS = 15_000L
private const val MAX_PREVIEW_PX = 1280

private fun pretty(value: String) =
    value.replace('_', ' ').split(' ').joinToString(" ") { it.replaceFirstChar { c -> c.titlecase(Locale.getDefault()) } }

private fun fmt(value: Double?, digits: Int = 1) = value?.let { String.format(Locale.getDefault(), "%.${digits}f", it) } ?: "—"

private fun severityColor(severity: String?) = when (severity) {
    null -> GOOD
    "high" -> BAD
    else -> WARN
}

private fun expectedRange(fault: CapeFault) = when {
    fault.expectedLo != null && fault.expectedHi != null -> "${fmt(fault.expectedLo, 0)}–${fmt(fault.expectedHi, 0)}"
    fault.expectedLo != null -> "≥ ${fmt(fault.expectedLo, 0)}"
    fault.expectedHi != null -> "≤ ${fmt(fault.expectedHi, 0)}"
    else -> "—"
}

/** First frame (downscaled for display) plus the video's native pixel size, which CAPE calibrates against. */
internal class CalibrationFrame(val bitmap: Bitmap, val nativeWidth: Int, val nativeHeight: Int)

internal suspend fun loadFirstFrame(context: Context, uri: Uri): CalibrationFrame = withContext(Dispatchers.IO) {
    val retriever = MediaMetadataRetriever()
    try {
        retriever.setDataSource(context, uri)
        calibrationFrame(retriever)
    } finally {
        retriever.release()
    }
}

internal suspend fun loadFirstFrame(file: File): CalibrationFrame = withContext(Dispatchers.IO) {
    val retriever = MediaMetadataRetriever()
    try {
        retriever.setDataSource(file.absolutePath)
        calibrationFrame(retriever)
    } finally {
        retriever.release()
    }
}

private fun calibrationFrame(retriever: MediaMetadataRetriever): CalibrationFrame {
    val frame = retriever.getFrameAtTime(50_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
        ?: error("The first frame of this video could not be read.")
    val scale = minOf(1f, MAX_PREVIEW_PX.toFloat() / maxOf(frame.width, frame.height))
    val preview = if (scale < 1f) {
        Bitmap.createScaledBitmap(frame, (frame.width * scale).toInt(), (frame.height * scale).toInt(), true).also { frame.recycle() }
    } else frame
    // The retriever returns the frame already rotated, so its unscaled size matches what CAPE decodes.
    return CalibrationFrame(preview, (preview.width / scale).toInt(), (preview.height / scale).toInt())
}

private fun decodeSampled(bytes: ByteArray): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 960) sample *= 2
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
}

/** Saves to Pictures/eCricketCoach (images) or Downloads (ZIP); pre-Android 10 falls back to a shareable cache file. */
internal suspend fun saveCapeDownload(context: Context, bytes: ByteArray, fileName: String): Uri = withContext(Dispatchers.IO) {
    val isZip = fileName.endsWith(".zip", ignoreCase = true)
    val mime = if (isZip) "application/zip" else "image/jpeg"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val resolver = context.contentResolver
        val collection = if (isZip) MediaStore.Downloads.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, if (isZip) Environment.DIRECTORY_DOWNLOADS else "${Environment.DIRECTORY_PICTURES}/eCricketCoach")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = resolver.insert(collection, values) ?: error("Unable to save $fileName.")
        try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("Unable to save $fileName.")
            resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
        } catch (failure: Exception) {
            resolver.delete(uri, null, null)
            throw failure
        }
        uri
    } else {
        val dir = File(context.cacheDir, "club-exports").apply { mkdirs() }
        val file = File(dir, fileName).apply { writeBytes(bytes) }
        FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    }
}

internal fun shareCapeDownload(context: Context, uri: Uri, fileName: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = if (fileName.endsWith(".zip", ignoreCase = true)) "application/zip" else "image/jpeg"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(send, "Share $fileName"))
}

/** Detailed (CAPE) analysis for a batting/bowling assessment: inputs, calibration, progress and results. */
@Composable
internal fun CapeAnalysisSection(api: CoachApi, token: String, assessment: PlayerAssessment, canSubmit: Boolean, onNotice: (String) -> Unit) {
    val target = when (assessment.discipline) {
        "BATTING" -> "batter"
        "BOWLING" -> "bowler"
        else -> return
    }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var job by remember(assessment.id) { mutableStateOf<CapeJob?>(null) }
    var setupOpen by remember(assessment.id) { mutableStateOf(false) }
    var videoUri by remember(assessment.id) { mutableStateOf<Uri?>(null) }
    var frame by remember(assessment.id) { mutableStateOf<CalibrationFrame?>(null) }
    val points = remember(assessment.id) { mutableStateListOf<Pair<Int, Int>>() }
    var handedness by remember(assessment.id) { mutableStateOf("right") }
    var shotType by remember(assessment.id) { mutableStateOf(SHOT_TYPES.first()) }
    var bowlerType by remember(assessment.id) { mutableStateOf(BOWLER_TYPES.first()) }
    var busy by remember(assessment.id) { mutableStateOf(false) }
    var error by remember(assessment.id) { mutableStateOf("") }

    LaunchedEffect(assessment.id) {
        try {
            job = api.getAssessmentCapeJob(token, assessment.id)
        } catch (failure: CancellationException) {
            throw failure
        } catch (_: Exception) {
            // The Gemini card already reports load errors for this route.
        }
    }

    // Polls while queued/running; the coroutine is cancelled when the card leaves composition.
    val pendingJobId = job?.takeIf { it.isPending }?.jobId
    LaunchedEffect(pendingJobId) {
        val id = pendingJobId ?: return@LaunchedEffect
        var wait = POLL_MS
        while (true) {
            delay(wait)
            try {
                val next = api.getCapeJob(token, id)
                job = next
                if (!next.isPending) {
                    if (next.status == "SUCCEEDED") onNotice("Detailed analysis is ready.")
                    break
                }
            } catch (failure: CancellationException) {
                throw failure
            } catch (_: Exception) {
                // Transient network failure: keep polling with a longer delay.
            }
            wait = minOf((wait * 13) / 10, MAX_POLL_MS)
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            error = ""
            points.clear()
            frame = null
            videoUri = uri
            try {
                frame = loadFirstFrame(context, uri)
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                error = failure.message ?: "Unable to read this video."
            }
        }
    }

    Column(
        Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(14.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Insights, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            Text(
                "Detailed ${if (target == "batter") "batting" else "bowling"} analysis",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier.weight(1f).padding(start = 6.dp)
            )
            if (canSubmit && !setupOpen && job?.isPending != true) {
                TextButton(onClick = { setupOpen = true; error = "" }) { Text(if (job == null) "Analyse" else "New", fontSize = 12.sp) }
            }
        }

        if (setupOpen) {
            Text("${if (target == "batter") "Batter" else "Bowler"} hand", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("right", "left").forEach { hand ->
                    FilterChip(selected = handedness == hand, onClick = { handedness = hand }, label = { Text("${pretty(hand)}-handed", fontSize = 12.sp) })
                }
            }
            Text(if (target == "batter") "Shot" else "Bowling type", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (target == "batter") {
                    SHOT_TYPES.forEach { shot -> FilterChip(selected = shotType == shot, onClick = { shotType = shot }, label = { Text(pretty(shot), fontSize = 12.sp) }) }
                } else {
                    BOWLER_TYPES.forEach { type -> FilterChip(selected = bowlerType == type, onClick = { bowlerType = type }, label = { Text(pretty(type), fontSize = 12.sp) }) }
                }
            }
            OutlinedButton(onClick = { picker.launch(arrayOf("video/*")) }, enabled = !busy, shape = RoundedCornerShape(14.dp)) {
                Text(if (videoUri == null) "Choose video" else "Choose a different video")
            }

            frame?.let { current ->
                Text(
                    if (points.size < 4) "Tap corner ${points.size + 1}: ${CORNER_LABELS[points.size]} (left/right as seen from the bowler's end)."
                    else "All four corners marked.",
                    fontSize = 12.sp
                )
                CalibrationOverlay(current, points) { if (points.size < 4) points.add(it) }
                if (points.isNotEmpty()) TextButton(onClick = { points.clear() }) { Text("Reset corners", fontSize = 12.sp) }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        val uri = videoUri ?: return@Button
                        scope.launch {
                            busy = true
                            error = ""
                            try {
                                val jobId = api.analyzeAssessmentVideoWithCape(
                                    context, token, assessment.id, uri, null,
                                    CapeInput(
                                        target = target,
                                        handedness = handedness,
                                        shotType = shotType.takeIf { target == "batter" },
                                        bowlerType = bowlerType.takeIf { target == "bowler" },
                                        calibrationPoints = points.toList()
                                    )
                                )
                                job = CapeJob(jobId, "QUEUED", null, null, null)
                                setupOpen = false
                                videoUri = null
                                frame = null
                                points.clear()
                            } catch (failure: CancellationException) {
                                throw failure
                            } catch (failure: Exception) {
                                error = failure.message ?: "Unable to submit this video."
                            } finally {
                                busy = false
                            }
                        }
                    },
                    enabled = !busy && videoUri != null && points.size == 4,
                    shape = RoundedCornerShape(14.dp)
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp) else Text("Analyse")
                }
                TextButton(onClick = { setupOpen = false; videoUri = null; frame = null; points.clear() }, enabled = !busy) { Text("Cancel") }
            }
        }

        val current = job
        when {
            setupOpen -> Unit
            current == null -> Text(
                if (canSubmit) "Upload a clip for pose, error and recommendation feedback with downloadable images." else "No detailed analysis for this assessment.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            current.isPending -> {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(
                    when {
                        current.status == "RUNNING" -> "Analysing the video…"
                        current.queuePosition != null -> "Queued – position ${current.queuePosition}"
                        else -> "Queued…"
                    } + " You can leave and come back.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            current.status == "FAILED" -> Text(current.errorMessage ?: "The analysis failed.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            current.result != null -> CapeResultPanel(api, token, current.result, current.jobId, assessment.playerName, canAssign = canSubmit)
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
    }
}

@Composable
internal fun CalibrationOverlay(frame: CalibrationFrame, points: List<Pair<Int, Int>>, onTap: (Pair<Int, Int>) -> Unit) {
    val accent = GOOD
    Box(Modifier.fillMaxWidth().aspectRatio(frame.bitmap.width.toFloat() / frame.bitmap.height)) {
        Image(frame.bitmap.asImageBitmap(), contentDescription = "First video frame", contentScale = ContentScale.FillBounds, modifier = Modifier.fillMaxSize())
        Canvas(
            Modifier.fillMaxSize().pointerInput(frame) {
                detectTapGestures { offset ->
                    // Map the tap from on-screen size to the video's native pixel grid.
                    onTap((offset.x / size.width * frame.nativeWidth).toInt() to (offset.y / size.height * frame.nativeHeight).toInt())
                }
            }
        ) {
            val sx = size.width / frame.nativeWidth
            val sy = size.height / frame.nativeHeight
            val screen = points.map { (x, y) -> Offset(x * sx, y * sy) }
            if (screen.size > 1) {
                val path = Path().apply {
                    moveTo(screen[0].x, screen[0].y)
                    screen.drop(1).forEach { lineTo(it.x, it.y) }
                    if (screen.size == 4) close()
                }
                drawPath(path, accent, style = Stroke(width = 3.dp.toPx()))
            }
            screen.forEach { drawCircle(accent, radius = 7.dp.toPx(), center = it) }
        }
    }
}

/**
 * Full CAPE result, matching the web view. When [jobId] is given, the drills already assigned from the
 * coaching guidance are loaded; [canAssign] adds an "Assign to [playerName]" button per guidance item.
 */
@Composable
internal fun CapeResultPanel(
    api: CoachApi,
    token: String,
    result: CapeResult,
    jobId: String? = null,
    playerName: String? = null,
    canAssign: Boolean = false
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val images = remember(result.sessionId) { mutableStateMapOf<String, Bitmap>() }
    var message by remember(result.sessionId) { mutableStateOf("") }
    val faultByMetric = remember(result) { result.faults.associateBy { it.metric } }
    val assignments = remember(jobId) { mutableStateListOf<CapeDrillAssignment>() }
    var assigningCode by remember(jobId) { mutableStateOf("") }
    var assignError by remember(jobId) { mutableStateOf("") }

    LaunchedEffect(jobId) {
        val id = jobId ?: return@LaunchedEffect
        try {
            assignments.clear()
            assignments.addAll(api.getCapeJobDrills(token, id))
        } catch (failure: CancellationException) {
            throw failure
        } catch (_: Exception) {
            // Assignment history is optional; the assign button still reports errors.
        }
    }

    fun assign(faultCode: String) {
        val id = jobId ?: return
        scope.launch {
            assigningCode = faultCode
            assignError = ""
            try {
                val assignment = api.assignCapeDrill(token, id, faultCode)
                assignments.removeAll { it.id == assignment.id }
                assignments.add(0, assignment)
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                assignError = failure.message ?: "Unable to assign the drill."
            } finally {
                assigningCode = ""
            }
        }
    }

    LaunchedEffect(result.sessionId) {
        result.images.forEach { (key, path) ->
            try {
                val (bytes, _) = api.downloadCapeArtifact(token, path)
                withContext(Dispatchers.Default) { decodeSampled(bytes) }?.let { images[key] = it }
            } catch (failure: CancellationException) {
                throw failure
            } catch (_: Exception) {
                // Leave the placeholder; the download button reports errors.
            }
        }
    }

    fun download(path: String, share: Boolean) {
        scope.launch {
            message = ""
            try {
                val (bytes, fileName) = api.downloadCapeArtifact(token, path)
                val uri = saveCapeDownload(context, bytes, fileName)
                if (share) shareCapeDownload(context, uri, fileName)
                else message = if (fileName.endsWith(".zip")) "Saved $fileName to Downloads." else "Saved $fileName to Pictures/eCricketCoach."
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                message = failure.message ?: "The download failed."
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            val scoreColor = when {
                result.score >= 70 -> GOOD
                result.score >= 40 -> WARN
                else -> BAD
            }
            Box(Modifier.size(44.dp).border(2.dp, scoreColor, CircleShape), contentAlignment = Alignment.Center) {
                Text("${result.score}", fontWeight = FontWeight.Bold, color = scoreColor)
            }
            Column(Modifier.padding(start = 10.dp)) {
                Text(result.verdict, fontWeight = FontWeight.SemiBold)
                Text(
                    "${pretty(result.shotType ?: result.bowlerType ?: result.target)} · ${pretty(result.handedness)}-handed",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (result.contactManual && result.contactFrame != null) {
                    Text(
                        "Contact frame #${result.contactFrame}" +
                            if (result.contactCandidateCount > 1) " chosen from ${result.contactCandidateCount} selected frames" else " selected manually",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        result.delivery?.let { delivery ->
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Badge(delivery.speedKmh?.let { "${fmt(it, 0)} ± ${fmt(delivery.speedToleranceKmh, 0)} km/h" } ?: "Speed —", null)
                Badge("${pretty(delivery.lengthZone)} (${fmt(delivery.lengthM)} m)", null)
                Badge("Line: ${pretty(delivery.lineZone)}", null)
                Badge(if (delivery.isGoodBall) "✓ Good ball" else "✗ Not a good ball", if (delivery.isGoodBall) GOOD else WARN)
            }
        }

        val kinematics = result.jointAngles.map { (metric, value) -> CapeMeasure(metric, pretty(metric), value, "°") } +
            result.contactMetrics.map { it.copy(label = pretty(it.label)) }
        if (kinematics.isNotEmpty()) {
            SectionTitle("Kinematics")
            kinematics.forEach { row ->
                val fault = faultByMetric[row.key]
                MetricRow(
                    name = row.label,
                    value = "${fmt(row.value)}${row.unit}",
                    expected = fault?.let { "exp ${expectedRange(it)}${row.unit}" } ?: "Observed",
                    status = fault?.let { pretty(it.severity) } ?: "Measured",
                    color = severityColor(fault?.severity)
                )
            }
        }

        result.alignment?.let { rows ->
            SectionTitle("Alignment checklist")
            rows.forEach { row ->
                val fault = faultByMetric[row.metric]
                MetricRow(
                    name = row.label,
                    value = row.value?.let { "${fmt(it)}${row.unit}" } ?: "—",
                    expected = row.expected,
                    status = when {
                        row.value == null -> "Unavailable"
                        fault != null -> pretty(fault.severity)
                        else -> "Aligned"
                    },
                    color = if (row.value == null) MaterialTheme.colorScheme.onSurfaceVariant else severityColor(fault?.severity)
                )
            }
            Note("Chin alignment uses the detected face centre as a 2D chin-line proxy.")
        }

        if (result.kinetics.isNotEmpty()) {
            SectionTitle("Kinetics")
            result.kinetics.forEach { row ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(row.label, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Text("${fmt(row.value)}${row.unit}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Note("Momentum and energy use the calibrated 2D track and an assumed 156 g cricket ball.")
        }

        if (result.faults.isNotEmpty()) {
            Text("What to fix", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            result.faults.forEach { fault ->
                val color = severityColor(fault.severity)
                Column(
                    Modifier.fillMaxWidth().border(1.dp, color.copy(alpha = 0.5f), RoundedCornerShape(12.dp)).background(color.copy(alpha = 0.08f), RoundedCornerShape(12.dp)).padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Text("${fault.message} (${pretty(fault.severity)})", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = color)
                    Text("${pretty(fault.metric)}: ${fmt(fault.value)} · expected ${expectedRange(fault)} · ${pretty(fault.milestone)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(fault.recommendation, fontSize = 12.sp)
                    fault.drill?.let { Text("Drill: $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
        }

        result.guidance?.let { guidance ->
            val violet = Color(0xFF8B5CF6)
            val assignedByFault = assignments.associateBy { it.faultCode }
            Column(
                Modifier.fillMaxWidth().border(1.dp, violet.copy(alpha = 0.4f), RoundedCornerShape(12.dp)).background(violet.copy(alpha = 0.08f), RoundedCornerShape(12.dp)).padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = violet, modifier = Modifier.size(16.dp))
                    Text("  Coaching guidance", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = violet)
                }
                if (guidance.summary.isNotBlank()) Text(guidance.summary, fontSize = 12.sp)
                Note("Generated by Gemini from CAPE’s measured findings; Gemini does not change measurements or severity.")
                guidance.items.forEach { item ->
                    Column(
                        Modifier.fillMaxWidth().border(1.dp, violet.copy(alpha = 0.25f), RoundedCornerShape(10.dp)).padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(item.title, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = violet)
                        if (item.whyItMatters.isNotBlank()) Text(item.whyItMatters, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (item.cues.isNotEmpty()) {
                            Text("COACHING CUES", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            item.cues.forEach { Text("• $it", fontSize = 12.sp) }
                        }
                        if (item.drillName.isNotBlank()) Text("Drill: ${item.drillName}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = GOOD)
                        item.drillInstructions.forEachIndexed { index, step -> Text("${index + 1}. $step", fontSize = 11.sp) }
                        if (item.equipment.isNotEmpty()) Note("Equipment: ${item.equipment.joinToString()}")
                        val assigned = assignedByFault[item.faultCode]
                        when {
                            assigned != null -> Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = GOOD, modifier = Modifier.size(14.dp))
                                Text("  Assigned to ${assigned.playerName}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = GOOD)
                            }
                            canAssign && jobId != null -> Button(
                                onClick = { assign(item.faultCode) },
                                enabled = assigningCode.isEmpty(),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                if (assigningCode == item.faultCode) CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                                else Icon(Icons.Outlined.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                                Text("  Assign to ${playerName ?: "player"}", fontSize = 12.sp)
                            }
                        }
                    }
                }
                if (assignError.isNotBlank()) Text(assignError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                if (assignments.isNotEmpty()) {
                    Text("Assigned drills", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    assignments.forEach { a ->
                        Text(
                            "• ${a.title} — ${a.playerName}" + (a.assignedByName?.let { " · by $it" } ?: "") + " · ${a.createdAt.take(10)}",
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }

        if (result.strengths.isNotEmpty()) {
            Text("Strengths", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            result.strengths.forEach { Text("• $it", fontSize = 12.sp) }
        }
        result.summary?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (result.unavailable.isNotEmpty()) {
            Text("Not measured: ${result.unavailable.joinToString { pretty(it) }}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        if (result.images.isNotEmpty()) {
            Text("Images", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            result.images.forEach { (key, path) ->
                Column(Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp)).padding(6.dp)) {
                    val bitmap = images[key]
                    if (bitmap != null) {
                        Image(bitmap.asImageBitmap(), contentDescription = SNAPSHOT_LABELS[key] ?: pretty(key), contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth().aspectRatio(bitmap.width.toFloat() / bitmap.height))
                    } else {
                        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(SNAPSHOT_LABELS[key] ?: pretty(key), fontSize = 12.sp, modifier = Modifier.weight(1f))
                        IconButton(onClick = { download(path, share = false) }) { Icon(Icons.Outlined.Download, contentDescription = "Save image") }
                        IconButton(onClick = { download(path, share = true) }) { Icon(Icons.Outlined.Share, contentDescription = "Share image") }
                    }
                }
            }
            result.zipPath?.let { zip ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { download(zip, share = false) }, shape = RoundedCornerShape(14.dp)) {
                        Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                        Text("  Download all (ZIP)")
                    }
                    IconButton(onClick = { download(zip, share = true) }) { Icon(Icons.Outlined.Share, contentDescription = "Share ZIP") }
                }
            }
        }
        if (message.isNotBlank()) Text(message, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SectionTitle(text: String) = Text(text, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)

@Composable
private fun Note(text: String) = Text(text, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

@Composable
private fun MetricRow(name: String, value: String, expected: String, status: String, color: Color) {
    Column(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(name, fontSize = 12.sp, modifier = Modifier.weight(1f))
            Text(value, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 8.dp))
            Badge(status, color)
        }
        Text(expected, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Badge(text: String, color: Color?) {
    val tint = color ?: MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        Modifier.border(1.dp, tint.copy(alpha = 0.6f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (color == GOOD) Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = tint, modifier = Modifier.size(14.dp).padding(end = 2.dp))
        Text(text, fontSize = 11.sp, color = if (color == null) MaterialTheme.colorScheme.onSurface else tint)
    }
}
