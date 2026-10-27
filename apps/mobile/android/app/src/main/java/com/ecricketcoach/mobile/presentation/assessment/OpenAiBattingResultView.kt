package com.ecricketcoach.mobile.presentation.assessment

import com.ecricketcoach.mobile.presentation.common.theme.AppFontSize
import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.domain.repository.*
import com.ecricketcoach.mobile.utils.*
import com.ecricketcoach.mobile.presentation.club.*
import com.ecricketcoach.mobile.presentation.session.*
import com.ecricketcoach.mobile.presentation.common.*
import android.graphics.BitmapFactory
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/** Accent palette mirroring the web review (rose/amber/yellow/emerald/violet/cyan/sky). */
private data class ReviewAccent(val dark: Color, val light: Color)

private val Rose = ReviewAccent(Color(0xFFFDA4AF), Color(0xFFBE123C))
private val Amber = ReviewAccent(Color(0xFFFCD34D), Color(0xFFB45309))
private val Yellow = ReviewAccent(Color(0xFFFEF08A), Color(0xFFA16207))
private val Emerald = ReviewAccent(Color(0xFF6EE7B7), Color(0xFF047857))
private val Violet = ReviewAccent(Color(0xFFDDD6FE), Color(0xFF6D28D9))
private val Cyan = ReviewAccent(Color(0xFFA5F3FC), Color(0xFF0E7490))
private val Sky = ReviewAccent(Color(0xFF7DD3FC), Color(0xFF0369A1))

@Composable
private fun ReviewAccent.tone(): Color = if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) dark else light

private val findingStatuses = listOf(
    "" to "Not reviewed",
    "accepted" to "Accepted",
    "revised" to "Revised",
    "not_applicable" to "Not applicable"
)

private fun contactLabel(status: String) = when (status) {
    "DETECTED" -> "Contact visible"
    "LIKELY" -> "Contact likely"
    "UNCERTAIN" -> "Contact unclear"
    else -> "Contact not visible"
}

private fun formatShotType(value: String) = value.replace('_', ' ').split(' ')
    .joinToString(" ") { word -> word.replaceFirstChar { it.titlecase(Locale.getDefault()) } }

private fun toCapeShotType(value: String?): String? = when (value) {
    "front_foot_drive", "forward_defence" -> value
    "front_foot_defence" -> "forward_defence"
    else -> null
}

private fun formatNumber(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else value.toBigDecimal().stripTrailingZeros().toPlainString()

private fun formatRange(min: Double?, max: Double?, suffix: String): String = when {
    min != null && max != null -> "${formatNumber(min)}\u2013${formatNumber(max)}$suffix"
    min != null -> "\u2265 ${formatNumber(min)}$suffix"
    max != null -> "\u2264 ${formatNumber(max)}$suffix"
    else -> "\u2014"
}

private data class PoseMetricRow(
    val label: String,
    val value: Double?,
    val unit: String,
    val expected: String,
    val status: String,
    val severity: String?
)

private fun poseMetricRow(result: PoseOverlayResult, group: String, metric: String, label: String, unit: String): PoseMetricRow {
    val check = result.checks.firstOrNull { it.group == group && it.metric == metric }
    val raw = result.metrics[metric]
    val temporal = result.temporalEstimates[metric]
    val value = raw ?: temporal
    val usedTemporal = raw == null && temporal != null
    val status = when {
        usedTemporal -> "Estimated from nearby frames"
        value == null || check?.status == "unavailable" -> "Unavailable"
        check?.status == "fault" -> check.severity ?: "fault"
        group == "alignment" && check != null -> "Aligned"
        else -> "Measured"
    }
    val suffix = if (unit == "m") " m" else unit
    return PoseMetricRow(
        label = label,
        value = value,
        unit = suffix,
        expected = if (check == null) "Observed" else formatRange(check.expectedMin, check.expectedMax, suffix),
        status = status,
        severity = if (usedTemporal) null else check?.severity
    )
}

private fun faultExpected(fault: PoseRuleFault): String {
    val metric = fault.metric
    val suffix = when {
        metric.endsWith("_degrees") || metric.endsWith("_deg") || metric == "front_knee" -> "\u00B0"
        metric.endsWith("_m") -> " m"
        metric.endsWith("_cm") -> " cm"
        else -> "%"
    }
    return formatRange(fault.expectedMin, fault.expectedMax, suffix)
}

private fun statusAccent(status: String): ReviewAccent? = when (status) {
    "high" -> Rose
    "medium" -> Amber
    "low" -> Yellow
    "Aligned", "Measured" -> Emerald
    else -> null
}

/**
 * Batting review result matching the web layout: coach review, movement and technique,
 * and coaching guidance. Builds and saves the movement overlay for fresh reviews.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun OpenAiBattingReviewResult(
    analysisRepository: AnalysisRepository,
    analysis: OpenAiBattingAnalysis,
    playerName: String,
    onAnalysisChange: (OpenAiBattingAnalysis) -> Unit
) {
    val currentAnalysis by rememberUpdatedState(analysis)
    val currentOnChange by rememberUpdatedState(onAnalysisChange)
    var overlayLoading by remember(analysis.reportId) { mutableStateOf(false) }
    var overlayError by remember(analysis.reportId) { mutableStateOf("") }
    var retryCount by remember(analysis.reportId) { mutableIntStateOf(0) }
    val identifiedHandedness = analysis.poseOverlay?.handedness ?: analysis.batterHandedness
    val shotType = toCapeShotType(analysis.poseOverlay?.shotType)
        ?: toCapeShotType(analysis.requestedShotType)
        ?: toCapeShotType(analysis.identifiedShotType)
        ?: "front_foot_drive"
    // Older saved reports have no stored overlay, so rebuild it from the saved contact crop.
    val showMovement = !analysis.restoredFromReport || analysis.savedPoseOverlayJson != null ||
        analysis.poseOverlay != null || analysis.poseOverlayInput != null

    LaunchedEffect(analysis.reportId, retryCount) {
        val current = currentAnalysis
        if (current.poseOverlay != null || !showMovement) return@LaunchedEffect
        overlayLoading = true
        overlayError = ""
        try {
            val saved = if (current.savedPoseOverlayJson != null) analysisRepository.loadSavedPoseOverlay(current) else null
            if (saved?.overlayImage != null) {
                currentOnChange(currentAnalysis.copy(poseOverlay = saved))
            } else {
                val input = current.poseOverlayInput
                if (input == null) {
                    overlayError = if (current.savedPoseOverlayJson != null) "The saved movement review could not be loaded."
                    else "A usable batter image was not available for the movement review."
                } else {
                    val result = analysisRepository.analyzeOpenAiPoseOverlay(
                        input,
                        if (identifiedHandedness == "left") "left" else "right",
                        shotType
                    )
                    currentOnChange(currentAnalysis.copy(poseOverlay = result))
                    if (current.reportId.isNotBlank()) {
                        try {
                            analysisRepository.saveOpenAiPoseOverlay(current.reportId, result)
                        } catch (failure: CancellationException) {
                            throw failure
                        } catch (failure: Exception) {
                            overlayError = "Overlay ready, but it could not be saved: ${failure.message ?: "unknown error"}"
                        }
                    }
                }
            }
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            overlayError = failure.message ?: "The movement review could not be prepared."
        } finally {
            overlayLoading = false
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, Violet.tone().copy(alpha = 0.35f))
    ) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val wide = maxWidth >= 640.dp
            Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Batting review", fontWeight = FontWeight.Bold, fontSize = AppFontSize.Body)
                        if (playerName.isNotBlank()) {
                            Text(playerName, fontSize = AppFontSize.Caption, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Pill(contactLabel(analysis.contact.status), Violet)
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                if (analysis.reportId.isNotBlank()) {
                    CoachReviewSection(analysisRepository, analysis, wide)
                }
                if (showMovement) {
                    MovementSection(
                        analysis = analysis,
                        handedness = identifiedHandedness,
                        shotType = shotType,
                        loading = overlayLoading,
                        error = overlayError,
                        wide = wide,
                        onRetry = { retryCount++ }
                    )
                }
                CoachingGuidance(analysis)
            }
        }
    }
}

@Composable
private fun Pill(text: String, accent: ReviewAccent, modifier: Modifier = Modifier) {
    val tone = accent.tone()
    Text(
        text,
        modifier = modifier
            .border(1.dp, tone.copy(alpha = 0.4f), RoundedCornerShape(50))
            .background(tone.copy(alpha = 0.12f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 3.dp),
        color = tone,
        fontSize = AppFontSize.Caption,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1
    )
}

@Composable
private fun AccentSection(
    accent: ReviewAccent?,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val tone = accent?.tone()
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = tone?.copy(alpha = 0.06f) ?: MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        border = BorderStroke(1.dp, tone?.copy(alpha = 0.3f) ?: MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
    }
}

@Composable
private fun SectionHeading(text: String, accent: ReviewAccent) {
    Text(text.uppercase(Locale.getDefault()), fontSize = AppFontSize.Caption, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = accent.tone())
}

@Composable
private fun CoachReviewSection(analysisRepository: AnalysisRepository, analysis: OpenAiBattingAnalysis, wide: Boolean) {
    val scope = rememberCoroutineScope()
    val findings = analysis.errors + analysis.observations
    var coachNote by remember(analysis.reportId) { mutableStateOf(analysis.coachReview?.note.orEmpty()) }
    var reviews by remember(analysis.reportId) {
        mutableStateOf(analysis.coachReview?.findings.orEmpty().associate { it.findingIndex to (it.status to it.note) })
    }
    var saving by remember(analysis.reportId) { mutableStateOf(false) }
    var message by remember(analysis.reportId) { mutableStateOf<String?>(null) }

    AccentSection(Emerald) {
        SectionHeading("Coach review", Emerald)
        Text(
            "Mark findings and add your coaching note. Your notes will be added to the report.",
            fontSize = AppFontSize.Caption,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        findings.forEachIndexed { index, finding ->
            val (status, note) = reviews[index] ?: ("" to "")
            FindingCard(
                finding = finding,
                status = status,
                note = note,
                wide = wide,
                onStatus = { reviews = reviews + (index to (it to note)) },
                onNote = { reviews = reviews + (index to (status to it.take(1000))) }
            )
        }
        AppTextField(
            value = coachNote,
            onValueChange = { coachNote = it },
            label = null,
            modifier = Modifier.fillMaxWidth(),
            singleLine = false,
            minLines = 2,
            maxLines = 5,
            maxLength = 3000,
            textStyle = MaterialTheme.typography.bodySmall,
            placeholder = "Overall coach note, context, or next-session focus",
            voicePrompt = "Speak the overall coach note"
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = {
                    scope.launch {
                        saving = true
                        message = null
                        message = try {
                            analysisRepository.saveOpenAiBattingReview(
                                analysis.reportId,
                                coachNote,
                                reviews.filter { it.value.first.isNotBlank() }
                                    .map { (index, value) -> OpenAiFindingReview(index, value.first, value.second) }
                            )
                            "Coach review saved. The downloadable JSON, Markdown, and ZIP were refreshed."
                        } catch (failure: CancellationException) {
                            throw failure
                        } catch (failure: Exception) {
                            failure.message ?: "Could not save coach review."
                        } finally {
                            saving = false
                        }
                    }
                },
                enabled = !saving,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF34D399), contentColor = Color(0xFF020617)),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text(if (saving) "Saving\u2026" else "Save coach review", fontSize = AppFontSize.Small, fontWeight = FontWeight.Bold)
            }
            message?.let { Text(it, fontSize = AppFontSize.Caption, color = Emerald.tone(), modifier = Modifier.weight(1f)) }
        }
    }
}

@Composable
private fun FindingCard(
    finding: OpenAiBattingObservation,
    status: String,
    note: String,
    wide: Boolean,
    onStatus: (String) -> Unit,
    onNote: (String) -> Unit
) {
    var showEvidence by remember(finding) { mutableStateOf(false) }
    val details: @Composable (Modifier) -> Unit = { modifier ->
        Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(finding.title, fontSize = AppFontSize.Small, fontWeight = FontWeight.SemiBold)
            if (finding.coachingImplication.isNotBlank()) Text(finding.coachingImplication, fontSize = AppFontSize.Small)
            if (finding.coachingCue.isNotBlank()) Text("Cue: ${finding.coachingCue}", fontSize = AppFontSize.Small, color = Violet.tone())
            if (finding.drill.isNotBlank()) Text("Drill: ${finding.drill}", fontSize = AppFontSize.Small, color = Emerald.tone())
            Text(
                "Advanced details \u00B7 evidence",
                fontSize = AppFontSize.Micro,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable { showEvidence = !showEvidence }.padding(vertical = 2.dp)
            )
            if (showEvidence) {
                val muted = MaterialTheme.colorScheme.onSurfaceVariant
                if (finding.observation.isNotBlank()) Text(finding.observation, fontSize = AppFontSize.Micro, color = muted)
                if (finding.alternativeExplanation.isNotBlank()) {
                    Text("Alternative explanation: ${finding.alternativeExplanation}", fontSize = AppFontSize.Micro, color = muted)
                }
                Text(
                    "Evidence references: ${finding.frameIndices.joinToString(", ").ifBlank { "not cited" }} \u00B7 ${finding.confidence} confidence",
                    fontSize = AppFontSize.Micro,
                    color = muted
                )
            }
        }
    }
    val controls: @Composable (Modifier) -> Unit = { modifier ->
        Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Review decision", fontSize = AppFontSize.Micro, color = MaterialTheme.colorScheme.onSurfaceVariant)
            AppDropdown(
                label = null,
                options = findingStatuses,
                selectedKey = status,
                onSelected = onStatus,
                modifier = Modifier.fillMaxWidth()
            )
            AppTextField(
                value = note,
                onValueChange = onNote,
                label = null,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
                placeholder = "Coach correction or note",
                voicePrompt = "Speak a coach correction"
            )
        }
    }
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
    ) {
        if (wide) {
            Row(Modifier.fillMaxWidth().padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                details(Modifier.weight(1f))
                controls(Modifier.width(220.dp))
            }
        } else {
            Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                details(Modifier.fillMaxWidth())
                controls(Modifier.fillMaxWidth())
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MovementSection(
    analysis: OpenAiBattingAnalysis,
    handedness: String,
    shotType: String,
    loading: Boolean,
    error: String,
    wide: Boolean,
    onRetry: () -> Unit
) {
    val result = analysis.poseOverlay
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    AccentSection(Cyan) {
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Column {
                Text("Movement and technique", fontSize = AppFontSize.Small, fontWeight = FontWeight.Bold, color = Cyan.tone())
                Text("A clear review of the player\u2019s movement and technique.", fontSize = AppFontSize.Caption, color = muted)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.align(Alignment.CenterVertically)) {
                LabeledValue(
                    "Batter hand",
                    when (handedness) { "left" -> "Left-handed"; "right" -> "Right-handed"; else -> "Unknown" }
                )
                LabeledValue("Shot type", formatShotType(shotType))
            }
        }
        if (loading) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                Text("Preparing movement images and alignment checklist\u2026", fontSize = AppFontSize.Small, color = Cyan.tone())
            }
        }
        if (error.isNotBlank()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(error, fontSize = AppFontSize.Small, color = Rose.tone(), modifier = Modifier.weight(1f))
                if (result == null && (analysis.poseOverlayInput != null || analysis.savedPoseOverlayJson != null)) {
                    TextButton(onClick = onRetry) { Text("Retry overlay", fontSize = AppFontSize.Small) }
                }
            }
        }
        if (result != null) {
            AccentSection(null) {
                Text("TECHNIQUE SUMMARY", fontSize = AppFontSize.Caption, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp, color = Violet.tone())
                Text(result.verdict.ifBlank { "No verdict" }, fontSize = AppFontSize.Small, fontWeight = FontWeight.SemiBold)
                if (result.rulesShotType.isNotBlank()) Text(formatShotType(result.rulesShotType), fontSize = AppFontSize.Caption, color = muted)
            }
            val kinematics = listOf(
                poseMetricRow(result, "shot", "back_knee", "Back knee", "\u00B0"),
                poseMetricRow(result, "shot", "back_elbow", "Back elbow", "\u00B0"),
                poseMetricRow(result, "shot", "front_knee", "Front knee", "\u00B0"),
                poseMetricRow(result, "shot", "front_elbow", "Front elbow", "\u00B0"),
                poseMetricRow(result, "shot", "shoulder_tilt_degrees", "Shoulder tilt", "\u00B0"),
                poseMetricRow(result, "shot", "head_front_knee_offset_pct", "Head front-knee offset", "%"),
                poseMetricRow(result, "shot", "bat_angle_deg", "Bat angle", "\u00B0"),
                poseMetricRow(result, "shot", "stride_m", "Stride", "m")
            )
            val alignment = listOf(
                poseMetricRow(result, "alignment", "chin_front_toe_offset_pct", "Chin over front toe", "%"),
                poseMetricRow(result, "alignment", "front_shoulder_target_angle_deg", "Front shoulder to target", "\u00B0"),
                poseMetricRow(result, "alignment", "back_foot_crease_angle_deg", "Back foot to crease", "\u00B0"),
                poseMetricRow(result, "alignment", "front_elbow_height_pct", "Front elbow height", "%")
            )
            if (wide) {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    PoseMetricTable("Kinematics", kinematics, Modifier.weight(1f))
                    PoseMetricTable("Alignment checklist", alignment, Modifier.weight(1f))
                }
            } else {
                PoseMetricTable("Kinematics", kinematics)
                PoseMetricTable("Alignment checklist", alignment)
            }
            val hasFixes = result.faults.isNotEmpty() || result.strengths.isNotEmpty() || result.unavailable.isNotEmpty()
            if (hasFixes) {
                Collapsible("What to Fix") {
                    if (!result.scoreScope.startsWith("partial")) {
                        Text("Rule-check score: ${formatNumber(result.score)}/100", fontSize = AppFontSize.Small, color = muted)
                    }
                    result.faults.forEach { FaultCard(it) }
                    result.strengths.forEach { Text("\u2022 $it", fontSize = AppFontSize.Small, color = Emerald.tone()) }
                    if (result.unavailable.isNotEmpty()) {
                        Text(
                            "Not assessed: ${result.unavailable.joinToString(", ") { it.replace('_', ' ') }}.",
                            fontSize = AppFontSize.Caption,
                            color = muted
                        )
                    }
                }
            }
            Collapsible("Movement images") {
                val contactImage = analysis.poseOverlayInput?.croppedContactImageDataUrl
                val images = listOfNotNull(
                    contactImage?.let { "Selected contact view" to it.substringAfter("base64,", "") },
                    result.overlayImage?.let { "Movement overlay" to it }
                )
                if (images.isEmpty()) {
                    Text("Movement images are not available for this review.", fontSize = AppFontSize.Caption, color = muted)
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        images.forEach { (caption, data) ->
                            ReviewFigure(caption, data, Modifier.weight(1f), maxHeight = 420)
                        }
                    }
                }
            }
            if (result.sequence.isNotEmpty()) {
                AccentSection(null) {
                    Text("POSE THROUGH CONTACT", fontSize = AppFontSize.Caption, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp, color = Cyan.tone())
                    Text("Key positions before, during, and after contact.", fontSize = AppFontSize.Caption, color = muted)
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        result.sequence.forEach { frame ->
                            val caption = frame.phase.replace('_', ' ')
                            if (frame.status == "success" && frame.image != null) {
                                ReviewFigure(caption, frame.image, Modifier.width(if (wide) 200.dp else 160.dp), maxHeight = 260)
                            } else {
                                Surface(
                                    modifier = Modifier.width(if (wide) 200.dp else 160.dp).heightIn(min = 140.dp),
                                    shape = RoundedCornerShape(8.dp),
                                    color = MaterialTheme.colorScheme.surface,
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
                                ) {
                                    Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.SpaceBetween) {
                                        Text(frame.error ?: "Pose unavailable for this frame.", fontSize = AppFontSize.Caption, color = muted)
                                        Text(caption, fontSize = AppFontSize.Micro)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LabeledValue(label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = AppFontSize.Small, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("  $value", fontSize = AppFontSize.Small)
    }
}

@Composable
private fun PoseMetricTable(title: String, rows: List<PoseMetricRow>, modifier: Modifier = Modifier) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val divider = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
    Column(modifier.fillMaxWidth()) {
        Row(Modifier.padding(vertical = 4.dp)) {
            Text(title, fontSize = AppFontSize.Caption, color = muted, modifier = Modifier.weight(1.4f))
            Text("Measured", fontSize = AppFontSize.Caption, color = muted, modifier = Modifier.weight(0.8f))
            Text("Expected", fontSize = AppFontSize.Caption, color = muted, modifier = Modifier.weight(0.9f))
            Text("Status", fontSize = AppFontSize.Caption, color = muted, modifier = Modifier.weight(1.1f))
        }
        rows.forEach { row ->
            HorizontalDivider(color = divider)
            Row(Modifier.padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(row.label, fontSize = AppFontSize.Small, modifier = Modifier.weight(1.4f))
                Text(
                    row.value?.let { String.format(Locale.getDefault(), "%.1f%s", it, row.unit) } ?: "\u2014",
                    fontSize = AppFontSize.Small,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(0.8f)
                )
                Text(row.expected, fontSize = AppFontSize.Small, color = muted, modifier = Modifier.weight(0.9f))
                Box(Modifier.weight(1.1f)) {
                    val key = row.severity ?: row.status
                    val text = row.severity?.let(::formatShotType) ?: row.status
                    val accent = statusAccent(key)
                    if (accent != null) {
                        Pill(text, accent)
                    } else {
                        Text(
                            text,
                            fontSize = AppFontSize.Caption,
                            color = muted,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier
                                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(50))
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FaultCard(fault: PoseRuleFault) {
    val accent = when (fault.severity) { "high" -> Rose; "medium" -> Amber; else -> Yellow }
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    AccentSection(accent) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                fault.verdict ?: fault.message,
                fontSize = AppFontSize.Small,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
            Pill(fault.severity.uppercase(Locale.getDefault()), accent)
        }
        if (fault.message.isNotBlank()) Text(fault.message, fontSize = AppFontSize.Small)
        Text(
            "${fault.metric.replace('_', ' ')}: ${String.format(Locale.getDefault(), "%.1f", fault.value)} \u00B7 ${faultExpected(fault)}",
            fontSize = AppFontSize.Caption,
            color = muted
        )
        if (fault.recommendation.isNotBlank()) Text(fault.recommendation, fontSize = AppFontSize.Small)
        fault.drill?.let { Text("Drill: $it", fontSize = AppFontSize.Caption, color = Violet.tone()) }
    }
}

@Composable
private fun Collapsible(title: String, content: @Composable () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    AccentSection(null) {
        Row(
            Modifier.fillMaxWidth().clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(" $title", fontSize = AppFontSize.Small, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (expanded) content()
    }
}

/** Decodes a PNG/JPEG off the main thread; [data] is raw bytes or a base64 string. */
@Composable
private fun ReviewFigure(caption: String, data: Any, modifier: Modifier = Modifier, maxHeight: Int) {
    val bitmap by produceState<ImageBitmap?>(null, data) {
        value = withContext(Dispatchers.Default) {
            runCatching {
                val bytes = when (data) {
                    is ByteArray -> data
                    is String -> java.util.Base64.getDecoder().decode(data)
                    else -> null
                } ?: return@runCatching null
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
            }.getOrNull()
        }
    }
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = Color.Black,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column {
            Box(Modifier.fillMaxWidth().heightIn(min = 120.dp, max = maxHeight.dp), contentAlignment = Alignment.Center) {
                bitmap?.let {
                    Image(
                        it,
                        contentDescription = caption,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxWidth().heightIn(max = maxHeight.dp)
                    )
                } ?: CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            }
            Text(
                caption,
                fontSize = AppFontSize.Micro,
                color = Color(0xFFCBD5E1),
                modifier = Modifier.fillMaxWidth().background(Color(0xFF020617)).padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    }
}

@Composable
private fun CoachingGuidance(analysis: OpenAiBattingAnalysis) {
    if (analysis.priorityCue.isBlank() && analysis.drill.title.isBlank() && analysis.strengthItems.isEmpty()) return
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    AccentSection(Violet) {
        SectionHeading("Coaching guidance", Violet)
        if (analysis.priorityCue.isNotBlank()) {
            Text("Priority cue: ${analysis.priorityCue}", fontSize = AppFontSize.Small, fontWeight = FontWeight.SemiBold)
        }
        if (analysis.drill.title.isNotBlank()) {
            AccentSection(null) {
                Text("Drill: ${analysis.drill.title}", fontSize = AppFontSize.Small, fontWeight = FontWeight.Bold, color = Violet.tone())
                if (analysis.drill.rationale.isNotBlank()) Text(analysis.drill.rationale, fontSize = AppFontSize.Small, color = muted)
                analysis.drill.instructions.filter(String::isNotBlank).forEachIndexed { index, step ->
                    Text("${index + 1}. $step", fontSize = AppFontSize.Small, color = muted)
                }
            }
        }
        if (analysis.strengthItems.isNotEmpty()) {
            Text("Strengths", fontSize = AppFontSize.Small, fontWeight = FontWeight.SemiBold, color = Emerald.tone())
            analysis.strengthItems.forEach { strength ->
                Text(
                    if (strength.title.isBlank()) "\u2022 ${strength.observation}" else "\u2022 ${strength.title}: ${strength.observation}",
                    fontSize = AppFontSize.Small,
                    color = muted
                )
            }
        }
    }
}

private fun formatReportDate(value: String): String = runCatching {
    OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.systemDefault())
        .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
}.getOrDefault(value)

/** Saved batting reviews for the player; selecting one opens it in the result above. */
@Composable
internal fun PastBattingReviews(
    analysisRepository: AnalysisRepository,
    playerId: String,
    playerName: String,
    activeReportId: String?,
    busy: Boolean,
    onDeleted: (String) -> Unit = {},
    onOpen: (String) -> Unit
) {
    var reports by remember(playerId) { mutableStateOf<List<OpenAiBattingReportSummary>>(emptyList()) }
    var loading by remember(playerId) { mutableStateOf(false) }
    var error by remember(playerId) { mutableStateOf("") }
    var refresh by remember(playerId) { mutableIntStateOf(0) }
    var showAll by remember(playerId) { mutableStateOf(false) }
    var downloadingId by remember(playerId) { mutableStateOf<String?>(null) }
    var pdfError by remember(playerId) { mutableStateOf("") }
    var pendingDelete by remember(playerId) { mutableStateOf<OpenAiBattingReportSummary?>(null) }
    var deletingId by remember(playerId) { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val deleteReport: (OpenAiBattingReportSummary) -> Unit = { report ->
        deletingId = report.reportId
        pdfError = ""
        scope.launch {
            try {
                analysisRepository.deleteOpenAiBattingReport(report.reportId)
                reports = reports.filterNot { it.reportId == report.reportId }
                onDeleted(report.reportId)
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                pdfError = failure.message ?: "The batting review could not be deleted."
            } finally {
                deletingId = null
                pendingDelete = null
            }
        }
    }
    val downloadPdf: (String) -> Unit = { reportId ->
        downloadingId = reportId
        pdfError = ""
        scope.launch {
            try {
                val file = downloadBattingReviewPdf(context, analysisRepository, reportId, playerName)
                openClubExport(context, file, "application/pdf", "Open batting review PDF")
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                pdfError = failure.message ?: "The PDF report could not be prepared."
            } finally {
                downloadingId = null
            }
        }
    }

    LaunchedEffect(playerId, refresh, activeReportId) {
        loading = true
        error = ""
        try {
            reports = analysisRepository.listOpenAiBattingReports(playerId)
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "The batting review history could not be loaded."
        } finally {
            loading = false
        }
    }

    AccentSection(null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Past AI Video Analyses", fontSize = AppFontSize.Small, fontWeight = FontWeight.SemiBold)
                Text(
                    "Saved batting reviews for $playerName. Select one to open it above.",
                    fontSize = AppFontSize.Caption,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = { refresh++ }, modifier = Modifier.size(32.dp)) {
                if (loading) CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                else Icon(Icons.Outlined.Refresh, contentDescription = "Refresh history", modifier = Modifier.size(16.dp))
            }
        }
        when {
            error.isNotBlank() -> Text(error, fontSize = AppFontSize.Small, color = Rose.tone())
            loading && reports.isEmpty() -> Text("Loading history\u2026", fontSize = AppFontSize.Small, color = MaterialTheme.colorScheme.onSurfaceVariant)
            reports.isEmpty() -> Text(
                "No saved batting reviews yet for this player. Run a review above to build their history.",
                fontSize = AppFontSize.Small,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            else -> BoxWithConstraints(Modifier.fillMaxWidth()) {
                val columns = if (maxWidth >= 560.dp) 2 else 1
                val visible = if (showAll) reports else reports.take(columns * 2)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    visible.chunked(columns).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            row.forEach { report ->
                                PastReviewRow(
                                    report,
                                    report.reportId == activeReportId,
                                    busy,
                                    downloading = downloadingId == report.reportId,
                                    downloadEnabled = downloadingId == null,
                                    onDownload = { downloadPdf(report.reportId) },
                                    deleting = deletingId == report.reportId,
                                    deleteEnabled = deletingId == null && !busy,
                                    onDelete = { pendingDelete = report },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    onOpen(report.reportId)
                                }
                            }
                            repeat(columns - row.size) { Box(Modifier.weight(1f)) }
                        }
                    }
                    if (reports.size > columns * 2) {
                        TextButton(onClick = { showAll = !showAll }) {
                            Text(if (showAll) "Show fewer" else "Show all ${reports.size}", fontSize = AppFontSize.Small)
                        }
                    }
                    if (pdfError.isNotBlank()) Text(pdfError, fontSize = AppFontSize.Small, color = Rose.tone())
                }
            }
        }
    }
    pendingDelete?.let { report ->
        AlertDialog(
            onDismissRequest = { if (deletingId == null) pendingDelete = null },
            title = { Text("Delete this video analysis?") },
            text = {
                Text("${report.sourceName ?: "Untitled video"} from ${formatReportDate(report.createdAt)} and its report images will be permanently removed.")
            },
            confirmButton = {
                Button(
                    onClick = { deleteReport(report) },
                    enabled = deletingId == null,
                    colors = ButtonDefaults.buttonColors(containerColor = DeleteRed, contentColor = Color.White)
                ) { Text(if (deletingId != null) "Deleting\u2026" else "Delete") }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }, enabled = deletingId == null) { Text("Cancel") }
            }
        )
    }
}

private val DeleteRed = Color(0xFFED4D5A)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PastReviewRow(
    report: OpenAiBattingReportSummary,
    active: Boolean,
    busy: Boolean,
    downloading: Boolean,
    downloadEnabled: Boolean,
    onDownload: () -> Unit,
    deleting: Boolean,
    deleteEnabled: Boolean,
    onDelete: () -> Unit,
    modifier: Modifier,
    onClick: () -> Unit
) {
    val isDrive = report.sourceType == "GOOGLE_DRIVE"
    val sourceAccent = if (isDrive) Sky else Emerald
    Surface(
        onClick = onClick,
        enabled = !busy,
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = if (active) Violet.tone().copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, if (active) Violet.tone().copy(alpha = 0.6f) else MaterialTheme.colorScheme.outlineVariant)
    ) {
        Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier
                    .size(30.dp)
                    .border(1.dp, sourceAccent.tone().copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                    .background(sourceAccent.tone().copy(alpha = 0.12f), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    if (isDrive) Icons.Outlined.Cloud else Icons.Outlined.Videocam,
                    contentDescription = null,
                    tint = sourceAccent.tone(),
                    modifier = Modifier.size(16.dp)
                )
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(report.sourceName ?: "Untitled video", fontSize = AppFontSize.Small, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    "${formatReportDate(report.createdAt)} \u00B7 ${when (report.sourceType) {
                        "GOOGLE_DRIVE" -> "Google Drive"
                        "LOCAL_UPLOAD" -> "Device upload"
                        else -> "Source not recorded"
                    }}",
                    fontSize = AppFontSize.Micro,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Pill(report.discipline.lowercase(Locale.getDefault()).replaceFirstChar { it.titlecase(Locale.getDefault()) }, Amber)
                    Text(
                        "${if (report.discipline == "BOWLING") "Bowling type" else "Shot"}: ${report.shotType ?: "Not identified"}",
                        fontSize = AppFontSize.Micro,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (active) Pill("Showing", Violet)
                Surface(
                    onClick = onDownload,
                    enabled = downloadEnabled,
                    shape = RoundedCornerShape(6.dp),
                    color = Color.Transparent,
                    border = BorderStroke(1.dp, Violet.tone().copy(alpha = 0.35f))
                ) {
                    Row(
                        Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (downloading) CircularProgressIndicator(Modifier.size(12.dp), strokeWidth = 1.5.dp, color = Violet.tone())
                        else Icon(Icons.Outlined.Download, contentDescription = null, tint = Violet.tone(), modifier = Modifier.size(14.dp))
                        Text(
                            if (downloading) "Preparing" else "PDF",
                            fontSize = AppFontSize.Micro,
                            fontWeight = FontWeight.SemiBold,
                            color = Violet.tone().copy(alpha = if (downloadEnabled || downloading) 1f else 0.5f)
                        )
                    }
                }
                Surface(
                    onClick = onDelete,
                    enabled = deleteEnabled,
                    shape = RoundedCornerShape(6.dp),
                    color = Color.Transparent,
                    border = BorderStroke(1.dp, DeleteRed.copy(alpha = if (deleteEnabled || deleting) 0.6f else 0.3f))
                ) {
                    Row(
                        Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        val tint = DeleteRed.copy(alpha = if (deleteEnabled || deleting) 1f else 0.5f)
                        if (deleting) CircularProgressIndicator(Modifier.size(12.dp), strokeWidth = 1.5.dp, color = DeleteRed)
                        else Icon(Icons.Outlined.Delete, contentDescription = null, tint = tint, modifier = Modifier.size(14.dp))
                        Text(if (deleting) "Deleting" else "Delete", fontSize = AppFontSize.Micro, fontWeight = FontWeight.SemiBold, color = tint)
                    }
                }
            }
        }
    }
}
