package com.ecricketcoach.mobile.presentation.session

import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.domain.repository.*
import com.ecricketcoach.mobile.utils.*
import com.ecricketcoach.mobile.presentation.club.*
import com.ecricketcoach.mobile.presentation.assessment.*
import com.ecricketcoach.mobile.presentation.common.*
import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.LinearEasing
import kotlinx.coroutines.launch
import androidx.compose.ui.geometry.Offset
import androidx.compose.material.icons.outlined.SportsCricket
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.EmojiPeople
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.HealthAndSafety
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.outlined.Search
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.List
import androidx.compose.material.icons.outlined.Pause
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import com.ecricketcoach.mobile.presentation.common.theme.LiveSessionColors

private val PreparationChecklist = listOf(
    "plan" to "Review objectives, session plan and drill order",
    "equipment" to "Prepare balls, bats, stumps, cones and nets",
    "safety" to "Check protective equipment and safety requirements",
    "firstAid" to "Confirm first-aid kit and emergency information",
    "facility" to "Confirm facility booking and playing-surface condition",
    "staff" to "Brief assistant coaches and assign groups",
    "weather" to "Check weather and agree an indoor/backup plan"
)


private data class ExecutionDrill(
    val id: String,
    val drillId: String?,
    val title: String,
    val plannedMinutes: Int,
    val actualMinutes: Int,
    val completed: Boolean,
    val notes: String
)

private data class ExecutionIncident(val id: String, val time: String, val category: String, val note: String)

private data class FollowUpPlan(
    val title: String,
    val objective: String,
    val durationMinutes: Int,
    val catalogueDrillIds: List<String>
)

private data class AiEvaluationData(
    val squadSummary: String,
    val identifiedGaps: List<String>,
    val playerFeedback: List<Pair<String, String>>,
    val tailoredRecommendedDrills: List<JSONObject>,
    val progressionReadiness: String,
    val aiCommendation: String,
    val sessionImprovements: List<String>,
    val followUpPlan: FollowUpPlan?,
    val generatedAt: String?
)

private val ReadinessLabels = mapOf(
    "READY_FOR_PROMOTION" to "Ready for promotion",
    "CONSOLIDATE_CURRENT_STAGE" to "Consolidate current stage",
    "REQUIRES_REMEDIATION" to "Requires remediation"
)

private fun JSONObject.toStringList(key: String): List<String> =
    optJSONArray(key)?.let { rows -> (0 until rows.length()).map(rows::getString) } ?: emptyList()

private fun parseAiEvaluation(json: JSONObject?): AiEvaluationData? {
    if (json == null || json.optString("squadSummary").isBlank()) return null
    val followUp = json.optJSONObject("followUpPlan")?.let { plan ->
        FollowUpPlan(
            title = plan.optString("title"),
            objective = plan.optString("objective"),
            durationMinutes = plan.optInt("durationMinutes", 60),
            catalogueDrillIds = plan.toStringList("catalogueDrillIds")
        )
    }
    val feedbackRows = json.optJSONArray("playerFeedback") ?: JSONArray()
    val tailoredRows = json.optJSONArray("tailoredRecommendedDrills") ?: JSONArray()
    return AiEvaluationData(
        squadSummary = json.optString("squadSummary"),
        identifiedGaps = json.toStringList("identifiedGaps"),
        playerFeedback = (0 until feedbackRows.length()).map { index ->
            val row = feedbackRows.getJSONObject(index)
            row.optString("playerName") to row.optString("focus")
        },
        tailoredRecommendedDrills = (0 until tailoredRows.length()).map(tailoredRows::getJSONObject),
        progressionReadiness = json.optString("progressionReadiness"),
        aiCommendation = json.optString("aiCommendation"),
        sessionImprovements = json.toStringList("sessionImprovements"),
        followUpPlan = followUp,
        generatedAt = json.optString("generatedAt").takeIf { it.isNotBlank() && it != "null" }
    )
}

private fun JSONObject.optionalText(key: String): String? =
    optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun initialExecutionDrills(session: ClubTrainingSession, drills: List<Drill>): List<ExecutionDrill> {
    val log = session.executionLog?.optJSONArray("drillLog")
    if (log != null) return (0 until log.length()).mapNotNull { index ->
        val row = log.getJSONObject(index)
        val drillId = row.optString("drillId").takeIf { it.isNotBlank() && it != "null" }
        // Drop the cool-down block that older app versions auto-appended.
        if (drillId == null && row.optString("title") == "Cool-down and debrief") return@mapNotNull null
        ExecutionDrill(
            id = row.optString("id").ifBlank { UUID.randomUUID().toString() },
            drillId = drillId,
            title = row.optString("title", "Session drill"),
            plannedMinutes = row.optInt("plannedMinutes", 15),
            actualMinutes = row.optInt("actualMinutes"),
            completed = row.optBoolean("completed"),
            notes = row.optString("notes")
        )
    }
    return session.drillIds.map { id ->
        val drill = drills.find { it.id == id }
        ExecutionDrill(
            id = UUID.randomUUID().toString(),
            drillId = id,
            title = drill?.title ?: "Planned drill",
            plannedMinutes = drill?.durationMinutes?.coerceAtLeast(1) ?: 15,
            actualMinutes = 0,
            completed = false,
            notes = ""
        )
    }
}

private fun addDaysIso(date: String, days: Long): String =
    runCatching { LocalDate.parse(date).plusDays(days).toString() }.getOrDefault(date)

/** Pre-fills the follow-up session from the AI plan: one week after this session (never in the past). */
private fun buildFollowUpDraft(session: ClubTrainingSession, evaluation: AiEvaluationData): JSONObject {
    val today = LocalDate.now().toString()
    val weekLater = addDaysIso(session.sessionDate, 7)
    val sessionDate = if (weekLater < today) addDaysIso(today, 7) else weekLater
    return JSONObject()
        .put("title", evaluation.followUpPlan?.title?.takeIf(String::isNotBlank) ?: "${session.title} – follow-up")
        .put("sessionDate", sessionDate)
        .put("sessionTime", session.sessionTime.orEmpty())
        .put("durationMinutes", evaluation.followUpPlan?.durationMinutes?.takeIf { it > 0 } ?: session.durationMinutes)
        .put("drillIds", JSONArray(evaluation.followUpPlan?.catalogueDrillIds ?: emptyList<String>()))
        .put("recommendedDrillIndexes", JSONArray(evaluation.tailoredRecommendedDrills.indices.toList()))
}

@Composable
internal fun SessionExecutionScreen(
    session: ClubTrainingSession,
    players: List<ClubMember>,
    drills: List<Drill>,
    readOnly: Boolean,
    isSaving: Boolean,
    saveError: String,
    aiBusy: Boolean = false,
    aiError: String = "",
    followUpBusy: Boolean = false,
    followUpError: String = "",
    createdFollowUp: ClubTrainingSession? = null,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    coachPage: String,
    onCoachPageChange: (String) -> Unit,
    onSave: (JSONObject, JSONObject, String, Boolean) -> Unit,
    onRunAiAnalysis: (JSONObject, JSONObject, String) -> Unit = { _, _, _ -> },
    onCreateFollowUp: (JSONObject) -> Unit = {},
    observations: List<SessionObservation> = emptyList(),
    observationLoadError: String = "",
    onReloadObservations: suspend () -> Unit = {},
    onAddObservation: suspend (SessionObservationDraft) -> SessionObservation = { throw IllegalStateException("Observation service is unavailable.") },
    onAddPlayer: suspend (SessionPlayerDraft) -> SessionPlayerAddition = { throw IllegalStateException("Player registration is unavailable.") }
) {
    val savedLog = remember(session.id) { session.executionLog ?: JSONObject() }
    var status by remember(session.id) { mutableStateOf(savedLog.optString("status", "PREPARING")) }
    var startedAt by remember(session.id) { mutableStateOf(savedLog.optionalText("startedAt")) }
    var sessionPausedAt by remember(session.id) { mutableStateOf(savedLog.optionalText("sessionPausedAt")) }
    var sessionPausedSeconds by remember(session.id) { mutableIntStateOf(savedLog.optInt("sessionPausedSeconds")) }
    var sessionPausedDrillWasRunning by remember(session.id) {
        mutableStateOf(savedLog.optBoolean("sessionPausedDrillWasRunning"))
    }
    var attendanceSaveRequested by remember(session.id) { mutableStateOf(false) }
    var drillNotesDirty by remember(session.id) { mutableStateOf(false) }
    var drillTimeDirty by remember(session.id) { mutableStateOf(false) }
    val checklist = remember(session.id) {
        mutableStateMapOf<String, Boolean>().apply {
            val values = savedLog.optJSONObject("checklist") ?: JSONObject()
            val hasSavedSelection = PreparationChecklist.any { (key, _) -> values.optBoolean(key) }
            PreparationChecklist.forEach { (key, _) -> put(key, if (hasSavedSelection) values.optBoolean(key) else true) }
        }
    }
    val assignedPlayers = remember(session.id, players) {
        val assignedIds = session.assignedPlayerIds.toSet()
        if (assignedIds.isNotEmpty()) players.filter { it.id in assignedIds }
        else players.filter { it.isInSquad(session.squadName) }
    }
    val attendance = remember(session.id) {
        mutableStateMapOf<String, String>().apply {
            val values = savedLog.optJSONObject("attendance") ?: JSONObject()
            assignedPlayers.forEach { player ->
                values.optString(player.id).takeIf { it in setOf("PRESENT", "LATE", "ABSENT") }
                    ?.let { put(player.id, it) }
            }
        }
    }
    val playerNotes = remember(session.id) {
        mutableStateMapOf<String, String>().apply {
            assignedPlayers.forEach { player ->
                session.playerNotes.optString(player.id).takeIf(String::isNotBlank)?.let { put(player.id, it) }
            }
        }
    }
    var drillRows by remember(session.id) { mutableStateOf(initialExecutionDrills(session, drills)) }
    var activeDrillId by remember(session.id) {
        mutableStateOf(savedLog.optionalText("activeDrillId") ?: drillRows.firstOrNull { !it.completed }?.id)
    }
    var activeDrillElapsedSeconds by remember(session.id) { mutableIntStateOf(savedLog.optInt("activeDrillElapsedSeconds")) }
    var activeDrillStartedAt by remember(session.id) { mutableStateOf(savedLog.optionalText("activeDrillStartedAt")) }
    var activeDrillPaused by remember(session.id) { mutableStateOf(savedLog.optBoolean("activeDrillPaused")) }
    var observationScope by remember(session.id) { mutableStateOf("SQUAD") }
    var observationCategory by remember(session.id) { mutableStateOf("TECHNIQUE") }
    var observationPlayerId by remember(session.id) { mutableStateOf<String?>(null) }
    var observationText by remember(session.id) { mutableStateOf("") }
    var observationDraftId by remember(session.id) { mutableStateOf(UUID.randomUUID().toString()) }
    var observationSaving by remember { mutableStateOf(false) }
    var observationError by remember { mutableStateOf("") }
    var observationSavedAt by remember { mutableStateOf("") }
    var observationRetry by remember { mutableIntStateOf(0) }
    var showAddPlayer by remember(session.id) { mutableStateOf(false) }
    var addPlayerBusy by remember { mutableStateOf(false) }
    var addPlayerError by remember { mutableStateOf("") }
    var clockNow by remember(session.id) { mutableLongStateOf(System.currentTimeMillis()) }
    val drillCatalogue = remember(drills) { drills.associateBy { it.id } }
    var infoDrill by remember { mutableStateOf<ExecutionDrill?>(null) }
    val initialIncidents = remember(session.id) {
        val rows = savedLog.optJSONArray("incidents") ?: JSONArray()
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            ExecutionIncident(
                row.optString("id").ifBlank { UUID.randomUUID().toString() },
                row.optString("time"),
                row.optString("category", "Other"),
                row.optString("note")
            )
        }
    }
    var incidents by remember(session.id) { mutableStateOf(initialIncidents) }
    val evaluation = remember(session.id) { savedLog.optJSONObject("evaluation") ?: JSONObject() }
    var objectives by remember(session.id) { mutableStateOf(evaluation.optString("objectivesMet")) }
    var engagement by remember(session.id) { mutableStateOf(evaluation.optInt("engagement")) }
    var wentWell by remember(session.id) { mutableStateOf(evaluation.optString("wentWell")) }
    var disruptions by remember(session.id) {
        mutableStateOf(evaluation.optString("disruptions").ifBlank { evaluation.optString("challenges") })
    }
    var nextAdjustments by remember(session.id) { mutableStateOf(evaluation.optString("nextAdjustments")) }
    var quickNotesDirty by remember(session.id) { mutableStateOf(false) }
    var postNotes by remember(session.id) { mutableStateOf(session.postNotes) }
    var incidentCategory by remember { mutableStateOf("Weather") }
    var incidentNote by remember { mutableStateOf("") }
    var showCompleteConfirm by remember { mutableStateOf(false) }
    var showEarlyStartConfirm by remember { mutableStateOf(false) }
    var showReadyScreen by remember(session.id) { mutableStateOf(false) }
    var startedEarly by remember(session.id) { mutableStateOf(savedLog.optBoolean("startedEarly")) }
    val today = LocalDate.now().toString()
    val onScheduleDate = session.sessionDate <= today
    val checklistComplete = PreparationChecklist.all { (key, _) -> checklist[key] == true }
    val canStart = onScheduleDate || checklistComplete
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val aiEvaluation = remember(session.id, session.aiEvaluation) { parseAiEvaluation(session.aiEvaluation) }
    var followUp by remember(session.id, aiEvaluation) {
        mutableStateOf(aiEvaluation?.let { buildFollowUpDraft(session, it) })
    }
    var reportError by remember { mutableStateOf("") }

    LaunchedEffect(status, coachPage) {
        while (status == "IN_PROGRESS" && coachPage != "PREP") {
            clockNow = System.currentTimeMillis()
            delay(1000)
        }
    }

    LaunchedEffect(coachPage, observationText, observationScope, observationCategory, observationPlayerId, activeDrillId, observationRetry) {
        if (coachPage != "OBSERVATION" || observationText.isBlank()) return@LaunchedEffect
        if (observationScope == "INDIVIDUAL" && observationPlayerId == null) return@LaunchedEffect
        delay(700)
        observationSaving = true
        observationError = ""
        try {
            val created = onAddObservation(
                SessionObservationDraft(
                    id = observationDraftId,
                    playerId = if (observationScope == "INDIVIDUAL") observationPlayerId else null,
                    scope = observationScope,
                    category = observationCategory,
                    text = observationText.trim(),
                    drillId = activeDrillId?.let { id -> drillRows.firstOrNull { it.id == id }?.drillId }
                )
            )
            observationSavedAt = created.createdAt
        } catch (failure: Exception) {
            observationError = failure.message ?: "Unable to save observation. Check your connection and retry."
        } finally {
            observationSaving = false
        }
    }

    fun beginSession(early: Boolean) {
        status = "IN_PROGRESS"
        startedAt = Instant.now().toString()
        sessionPausedAt = null
        sessionPausedSeconds = 0
        sessionPausedDrillWasRunning = false
        startedEarly = early
        activeDrillId = drillRows.firstOrNull { !it.completed }?.id
        activeDrillElapsedSeconds = 0
        activeDrillStartedAt = if (activeDrillId == null) null else Instant.now().toString()
        activeDrillPaused = false
        onCoachPageChange("LIVE")
        showEarlyStartConfirm = false
        showReadyScreen = false
    }

    fun activeDrillElapsed(): Int {
        val runningSeconds = if (!activeDrillPaused && activeDrillStartedAt != null) {
            runCatching {
                ((clockNow - Instant.parse(activeDrillStartedAt).toEpochMilli())
                    .coerceAtLeast(0L) / 1000L)
                    .coerceAtMost(Int.MAX_VALUE.toLong())
                    .toInt()
            }.getOrDefault(0)
        } else 0
        return activeDrillElapsedSeconds + runningSeconds
    }

    fun sessionElapsed(): Int {
        val clockCutoff = sessionPausedAt?.let { value ->
            runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()
        } ?: clockNow
        val totalSeconds = startedAt?.let { value ->
            runCatching { ((clockCutoff - Instant.parse(value).toEpochMilli()).coerceAtLeast(0L) / 1000L).toInt() }
                .getOrDefault(0)
        } ?: 0
        return (totalSeconds - sessionPausedSeconds).coerceAtLeast(0)
    }

    fun payload(complete: Boolean): JSONObject {
        val log = JSONObject()
            .put("status", if (complete) "COMPLETED" else status)
            .put("startedAt", startedAt ?: JSONObject.NULL)
            .put("sessionPausedAt", sessionPausedAt ?: JSONObject.NULL)
            .put("sessionPausedSeconds", sessionPausedSeconds)
            .put("sessionPausedDrillWasRunning", sessionPausedDrillWasRunning)
            .put("startedEarly", startedEarly)
            .put("activeDrillId", activeDrillId ?: JSONObject.NULL)
            .put("activeDrillElapsedSeconds", activeDrillElapsedSeconds)
            .put("activeDrillStartedAt", activeDrillStartedAt ?: JSONObject.NULL)
            .put("activeDrillPaused", activeDrillPaused)
            .put("completedAt", if (complete) Instant.now().toString() else savedLog.optionalText("completedAt") ?: JSONObject.NULL)
            .put("checklist", JSONObject().also { target -> checklist.forEach { (key, value) -> target.put(key, value) } })
            .put("attendance", JSONObject().also { target -> attendance.forEach { (key, value) -> target.put(key, value) } })
            .put("drillLog", JSONArray().also { target ->
                drillRows.forEach { drill ->
                    target.put(
                        JSONObject()
                            .put("id", drill.id)
                            .put("drillId", drill.drillId ?: JSONObject.NULL)
                            .put("title", drill.title)
                            .put("plannedMinutes", drill.plannedMinutes.coerceIn(0, 600))
                            .put("actualMinutes", drill.actualMinutes.coerceIn(0, 600))
                            .put("completed", drill.completed)
                            .put("notes", drill.notes)
                    )
                }
            })
            .put("incidents", JSONArray().also { target ->
                incidents.forEach { incident ->
                    target.put(JSONObject().put("id", incident.id).put("time", incident.time)
                        .put("category", incident.category).put("note", incident.note))
                }
            })
            .put("evaluation", JSONObject()
                .put("objectivesMet", objectives)
                .put("engagement", engagement)
                .put("wentWell", wentWell)
                .put("disruptions", disruptions)
                .put("nextAdjustments", nextAdjustments))
        return log
    }

    fun saveProgress() {
        onSave(payload(false), JSONObject().also { notes ->
            playerNotes.forEach { (id, note) -> if (note.isNotBlank()) notes.put(id, note) }
        }, postNotes, false)
    }

    LaunchedEffect(status, attendanceSaveRequested, attendance.toMap(), checklist.toMap()) {
        if (status != "PREPARING" || !attendanceSaveRequested) return@LaunchedEffect
        delay(350)
        attendanceSaveRequested = false
        saveProgress()
    }

    val saveOnExit by rememberUpdatedState {
        if (!readOnly && status == "PREPARING") saveProgress()
    }
    DisposableEffect(session.id) {
        onDispose { saveOnExit() }
    }

    LaunchedEffect(
        drillNotesDirty,
        activeDrillId,
        drillRows.firstOrNull { it.id == activeDrillId }?.notes
    ) {
        if (!drillNotesDirty) return@LaunchedEffect
        delay(500)
        saveProgress()
        drillNotesDirty = false
    }

    LaunchedEffect(quickNotesDirty, wentWell, disruptions, nextAdjustments, incidents) {
        if (!quickNotesDirty) return@LaunchedEffect
        delay(600)
        saveProgress()
        quickNotesDirty = false
    }

    LaunchedEffect(
        drillTimeDirty,
        activeDrillId,
        drillRows.firstOrNull { it.id == activeDrillId }?.plannedMinutes
    ) {
        if (!drillTimeDirty) return@LaunchedEffect
        delay(350)
        saveProgress()
        drillTimeDirty = false
    }

    fun pauseSession() {
        if (status != "IN_PROGRESS") return
        val now = Instant.now()
        clockNow = now.toEpochMilli()
        sessionPausedAt = now.toString()
        sessionPausedDrillWasRunning = activeDrillId != null && activeDrillStartedAt != null && !activeDrillPaused
        if (sessionPausedDrillWasRunning) {
            activeDrillElapsedSeconds = activeDrillElapsed()
            activeDrillStartedAt = null
            activeDrillPaused = true
        }
        status = "PAUSED"
        saveProgress()
    }

    fun resumeSession() {
        if (status != "PAUSED") return
        val now = Instant.now()
        sessionPausedAt?.let { pausedAt ->
            sessionPausedSeconds += runCatching {
                ((now.toEpochMilli() - Instant.parse(pausedAt).toEpochMilli()).coerceAtLeast(0L) / 1000L).toInt()
            }.getOrDefault(0)
        }
        sessionPausedAt = null
        if (sessionPausedDrillWasRunning && activeDrillId != null) {
            activeDrillStartedAt = now.toString()
            activeDrillPaused = false
        }
        sessionPausedDrillWasRunning = false
        clockNow = now.toEpochMilli()
        status = "IN_PROGRESS"
        saveProgress()
    }

    fun pauseActiveDrill() {
        if (status == "IN_PROGRESS") {
            pauseSession()
            return
        }
        activeDrillElapsedSeconds = activeDrillElapsed()
        activeDrillPaused = true
        activeDrillStartedAt = null
        saveProgress()
    }

    fun resumeActiveDrill() {
        if (status == "PAUSED") {
            sessionPausedDrillWasRunning = true
            resumeSession()
            return
        }
        activeDrillStartedAt = Instant.now().toString()
        activeDrillPaused = false
        saveProgress()
    }

    fun startDrill(drill: ExecutionDrill) {
        if (status == "PAUSED") {
            sessionPausedDrillWasRunning = false
            resumeSession()
        }
        val previousId = activeDrillId
        if (previousId != null && previousId != drill.id) {
            val previousMinutes = (activeDrillElapsed() + 59) / 60
            drillRows = drillRows.map { current ->
                if (current.id == previousId) current.copy(actualMinutes = previousMinutes.coerceIn(0, 600)) else current
            }
        }
        activeDrillId = drill.id
        activeDrillElapsedSeconds = (drill.actualMinutes.coerceIn(0, 600) * 60)
        activeDrillStartedAt = Instant.now().toString()
        activeDrillPaused = false
        onCoachPageChange("DRILL")
        saveProgress()
    }

    fun finishSession() {
        val finalDrillSeconds = activeDrillElapsed()
        activeDrillId?.let { currentId ->
            drillRows = drillRows.map { drill ->
                if (drill.id == currentId) {
                    drill.copy(actualMinutes = ((finalDrillSeconds + 59) / 60).coerceIn(1, 600))
                } else drill
            }
        }
        activeDrillElapsedSeconds = finalDrillSeconds
        activeDrillStartedAt = null
        activeDrillPaused = true
        onSave(payload(true), JSONObject().also { notes ->
            playerNotes.forEach { (id, note) -> if (note.isNotBlank()) notes.put(id, note) }
        }, postNotes, true)
    }

    fun reopenDrill(drill: ExecutionDrill) {
        if (!drill.completed) return
        val reopened = drill.copy(completed = false)
        drillRows = drillRows.map { if (it.id == drill.id) reopened else it }
        startDrill(reopened)
    }

    fun completeActiveDrill() {
        val currentId = activeDrillId ?: return
        val elapsedMinutes = (activeDrillElapsed() + 59) / 60
        drillRows = drillRows.map { drill ->
            if (drill.id == currentId) drill.copy(actualMinutes = elapsedMinutes.coerceIn(1, 600), completed = true) else drill
        }
        val next = drillRows.firstOrNull { !it.completed }
        if (next != null && status == "PAUSED") {
            sessionPausedDrillWasRunning = false
            resumeSession()
        }
        activeDrillId = next?.id
        activeDrillElapsedSeconds = 0
        activeDrillPaused = false
        activeDrillStartedAt = if (next == null) null else Instant.now().toString()
        onCoachPageChange(if (next == null) "LIVE" else "DRILL")
        saveProgress()
    }

    fun adjustActiveDrill(minutes: Int) {
        val currentId = activeDrillId ?: return
        drillRows = drillRows.map { drill ->
            if (drill.id == currentId) drill.copy(plannedMinutes = (drill.plannedMinutes + minutes).coerceIn(1, 600)) else drill
        }
        drillTimeDirty = true
    }

    fun toggleFollowUpDrillId(drillId: String) {
        followUp = followUp?.let { draft ->
            val current = (0 until draft.getJSONArray("drillIds").length()).map { draft.getJSONArray("drillIds").getString(it) }
            val next = if (drillId in current) current - drillId else current + drillId
            JSONObject(draft.toString()).put("drillIds", JSONArray(next))
        }
    }

    fun toggleRecommendedDrillIndex(index: Int) {
        followUp = followUp?.let { draft ->
            val array = draft.getJSONArray("recommendedDrillIndexes")
            val current = (0 until array.length()).map { array.getInt(it) }
            val next = if (index in current) current - index else current + index
            JSONObject(draft.toString()).put("recommendedDrillIndexes", JSONArray(next))
        }
    }

    val followUpMinutes = followUp?.let { draft ->
        val drillIds = (0 until draft.getJSONArray("drillIds").length()).map { draft.getJSONArray("drillIds").getString(it) }
        val recommendedIndexes = (0 until draft.getJSONArray("recommendedDrillIndexes").length()).map { draft.getJSONArray("recommendedDrillIndexes").getInt(it) }
        val catalogueMinutes = drillIds.sumOf { id -> drillCatalogue[id]?.durationMinutes ?: 0 }
        val recommendedMinutes = recommendedIndexes.sumOf { index ->
            aiEvaluation?.tailoredRecommendedDrills?.getOrNull(index)?.optInt("durationMinutes") ?: 0
        }
        catalogueMinutes + recommendedMinutes
    } ?: 0

    fun buildReportFile(): java.io.File {
        val attendanceLabel = { value: String? -> when (value) {
            "PRESENT" -> "Present"
            "LATE" -> "Late"
            "ABSENT" -> "Absent"
            else -> "Not recorded"
        } }
        fun formatTimestamp(iso: String?): String {
            if (iso.isNullOrBlank()) return "-"
            return try {
                java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy, HH:mm:ss")
                    .withZone(java.time.ZoneId.systemDefault())
                    .format(java.time.Instant.parse(iso))
            } catch (_: Exception) {
                iso
            }
        }
        val actualMinutes = drillRows.sumOf { it.actualMinutes }
        val checklistDone = checklist.values.count { it }
        val attendingPlayers = assignedPlayers.count { attendance[it.id] in setOf("PRESENT", "LATE") }
        val completedAt = savedLog.optionalText("completedAt")
        val facts = listOf(
            "Squad" to session.squadName,
            "Lead coach" to (session.coachName ?: "-"),
            "Planned duration" to "${session.durationMinutes} min",
            "Actual drill time" to "$actualMinutes min",
            "Started" to formatTimestamp(startedAt),
            "Started early" to if (startedEarly) "Yes" else "No",
            "Completed" to (completedAt?.let(::formatTimestamp) ?: if (status == "COMPLETED") "Yes" else "-")
        )
        val sections = mutableListOf(
            SessionReportSection(
                "Preparation (${checklistDone}/${PreparationChecklist.size})",
                tableHeaders = listOf("Item", "Done"),
                tableRows = PreparationChecklist.map { (key, label) -> listOf(label, if (checklist[key] == true) "Yes" else "No") },
                columnWeights = listOf(0.82f, 0.18f)
            ),
            SessionReportSection(
                "Attendance ($attendingPlayers/${assignedPlayers.size})",
                tableHeaders = listOf("Player", "Status"),
                tableRows = assignedPlayers.map { player -> listOf(player.name, attendanceLabel(attendance[player.id])) },
                columnWeights = listOf(0.6f, 0.4f)
            ),
            SessionReportSection(
                "Drills",
                tableHeaders = listOf("Drill", "Planned", "Actual", "Completed", "Notes"),
                tableRows = drillRows.map { drill ->
                    listOf(drill.title, "${drill.plannedMinutes} min", "${drill.actualMinutes} min", if (drill.completed) "Yes" else "No", drill.notes)
                },
                columnWeights = listOf(0.26f, 0.12f, 0.12f, 0.14f, 0.36f)
            ),
            SessionReportSection(
                "Disruptions",
                incidents.map { incident -> "${formatTimestamp(incident.time)} [${incident.category}] ${incident.note}" }
            ),
            SessionReportSection(
                "Coach's observations",
                assignedPlayers.flatMap { player ->
                    observations.filter { it.playerId == player.id }.sortedBy { it.createdAt }
                        .map { "${player.name}: ${it.text}" }
                }
            ),
            SessionReportSection(
                "Player's thoughts",
                assignedPlayers.mapNotNull { player ->
                    playerNotes[player.id]?.trim()?.takeIf(String::isNotBlank)?.let { "${player.name}: $it" }
                }
            ),
            SessionReportSection(
                "Session notes",
                listOf(
                    "What went well: ${wentWell.ifBlank { "-" }}",
                    "Disruptions: ${disruptions.ifBlank { "-" }}",
                    "Next adjustments: ${nextAdjustments.ifBlank { "-" }}"
                )
            ),
            SessionReportSection("Session summary", listOf(postNotes.ifBlank { "-" }))
        )
        if (aiEvaluation != null) {
            fun listBlock(single: String, plural: String, items: List<String>): List<ReportLine> = when {
                items.isEmpty() -> emptyList()
                items.size == 1 -> listOf(ReportLine(single, ReportLineStyle.ITALIC_LABEL), ReportLine(items.first()))
                else -> listOf(ReportLine(plural, ReportLineStyle.ITALIC_LABEL)) + items.map { ReportLine(it, ReportLineStyle.BULLET) }
            }
            sections += SessionReportSection(
                "AI session analysis",
                styledLines = listOfNotNull(
                    ReportLine("Diagnosis", ReportLineStyle.ITALIC_LABEL),
                    ReportLine(
                        ReadinessLabels[aiEvaluation.progressionReadiness] ?: aiEvaluation.progressionReadiness,
                        ReportLineStyle.UNDERLINED
                    ),
                    aiEvaluation.squadSummary.takeIf(String::isNotBlank)?.let { ReportLine(it) }
                ) + listBlock("Gap", "Gaps", aiEvaluation.identifiedGaps) +
                    aiEvaluation.playerFeedback.flatMap { (name, focus) ->
                        listOf(ReportLine(name, ReportLineStyle.LABEL), ReportLine(focus))
                    } +
                    listBlock("Improvement", "Improvements", aiEvaluation.sessionImprovements) +
                    aiEvaluation.aiCommendation.takeIf(String::isNotBlank)?.let {
                        listOf(ReportLine("Commendation", ReportLineStyle.ITALIC_LABEL), ReportLine(it))
                    }.orEmpty()
            )
        }
        return exportSessionReportPdf(
            context,
            "Session Report",
            "${session.title} - ${session.sessionDate}",
            facts,
            sections
        )
    }

    if (!readOnly && status == "PREPARING") {
        MaterialTheme(colorScheme = LiveSessionColors) {
            LiveSessionPreStartScreen(
                session = session,
                players = assignedPlayers,
                drills = drillRows,
                checklist = checklist,
                attendance = attendance,
                canStart = canStart,
                ready = showReadyScreen,
                isSaving = isSaving,
                saveError = saveError,
                onBack = if (showReadyScreen) ({ showReadyScreen = false }) else onDismiss,
                onProceed = { showReadyScreen = true },
                onAttendanceChanged = { attendanceSaveRequested = true },
                onAddPlayer = { showAddPlayer = true },
                onStart = {
                    if (onScheduleDate) {
                        beginSession(false)
                        saveProgress()
                    } else showEarlyStartConfirm = true
                }
            )
        }
        if (showAddPlayer) {
            AddSessionPlayerDialog(
                busy = addPlayerBusy,
                error = addPlayerError,
                onDismiss = { if (!addPlayerBusy) showAddPlayer = false },
                onAdd = { draft ->
                    coroutineScope.launch {
                        addPlayerBusy = true
                        addPlayerError = ""
                        try {
                            val addition = onAddPlayer(draft)
                            attendance[addition.member.id] = "PRESENT"
                            saveProgress()
                            showAddPlayer = false
                        } catch (failure: Exception) {
                            addPlayerError = failure.message ?: "Unable to add this player."
                        } finally {
                            addPlayerBusy = false
                        }
                    }
                }
            )
        }
        if (showEarlyStartConfirm) {
            MaterialTheme(colorScheme = LiveSessionColors) {
                AlertDialog(
                    onDismissRequest = { showEarlyStartConfirm = false },
                    title = { Text("Start before scheduled date?") },
                    text = { Text("This session is scheduled for ${session.sessionDate}. Starting now will be recorded as started early.") },
                    confirmButton = {
                        Button(onClick = {
                            beginSession(true)
                            saveProgress()
                        }) {
                            Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Start early")
                        }
                    },
                    dismissButton = { TextButton(onClick = { showEarlyStartConfirm = false }) { Text("Cancel") } }
                )
            }
        }
        return
    }

    if (!readOnly && status in setOf("IN_PROGRESS", "PAUSED")) {
        MaterialTheme(colorScheme = LiveSessionColors) {
            if (coachPage == "PRECHECK") {
                LiveSessionPreCheckScreen(
                    session = session,
                    players = assignedPlayers,
                    drills = drillRows,
                    checklist = checklist,
                    attendance = attendance,
                    isSaving = isSaving,
                    saveError = saveError,
                    onClose = {
                        saveProgress()
                        onCoachPageChange("LIVE")
                    },
                    onChanged = { saveProgress() },
                    onAddPlayer = { showAddPlayer = true }
                )
            } else SessionCoachModeScreen(
                page = coachPage,
                session = session,
                drills = drillRows,
                activeDrillId = activeDrillId,
                activeDrillSeconds = activeDrillElapsed(),
                activeDrillBaseSeconds = activeDrillElapsedSeconds,
                activeDrillStartedAt = activeDrillStartedAt,
                sessionSeconds = sessionElapsed(),
                sessionPaused = status == "PAUSED",
                paused = activeDrillPaused,
                observations = observations,
                observationLoadError = observationLoadError,
                observationScope = observationScope,
                observationCategory = observationCategory,
                observationPlayerId = observationPlayerId,
                observationText = observationText,
                observationSaving = observationSaving,
                observationError = observationError,
                observationSavedAt = observationSavedAt,
                players = assignedPlayers,
                isSaving = isSaving,
                saveError = saveError,
                onBack = { onCoachPageChange("LIVE") },
                onOpenObservation = { scope, category ->
                    observationDraftId = UUID.randomUUID().toString()
                    observationScope = scope
                    observationCategory = category
                    observationPlayerId = null
                    observationText = ""
                    observationSavedAt = ""
                    observationError = ""
                    onCoachPageChange("OBSERVATION")
                },
                onObservationScopeChange = { observationScope = it },
                onObservationCategoryChange = { observationCategory = it },
                onObservationPlayerChange = { observationPlayerId = it },
                onObservationTextChange = {
                    observationText = it
                    observationSavedAt = ""
                },
                onRetryObservation = { observationRetry++ },
                onReloadObservations = { onReloadObservations() },
                onPause = { pauseActiveDrill() },
                onResume = { resumeActiveDrill() },
                onAdjust = { adjustActiveDrill(it) },
                onCompleteDrill = { completeActiveDrill() },
                onSelectDrill = { startDrill(it) },
                onReopenDrill = { reopenDrill(it) },
                onOpenDrillControls = { onCoachPageChange("DRILL") },
                onViewAllObservations = { onCoachPageChange("OBSERVATIONS") },
                onAddPlayer = { showAddPlayer = true },
                onOpenPreCheck = { onCoachPageChange("PRECHECK") },
                onPauseSession = { pauseSession() },
                onResumeSession = { resumeSession() },
                onDrillNotesChange = { notes ->
                    activeDrillId?.let { currentId ->
                        drillRows = drillRows.map { drill ->
                            if (drill.id == currentId) drill.copy(notes = notes) else drill
                        }
                        drillNotesDirty = true
                    }
                },
                onEndSession = { finishSession() },
                quickNoteText = when (coachPage) {
                    "WENT_WELL" -> wentWell
                    "DISRUPTION" -> disruptions
                    "ADJUSTMENT" -> nextAdjustments
                    else -> ""
                },
                quickNoteSaving = isSaving || quickNotesDirty,
                onQuickNoteChange = { text ->
                    when (coachPage) {
                        "WENT_WELL" -> wentWell = text
                        "DISRUPTION" -> disruptions = text
                        "ADJUSTMENT" -> nextAdjustments = text
                    }
                    quickNotesDirty = true
                },
                onOpenQuickNote = { onCoachPageChange(it) },
                incidents = incidents,
                onAddIncident = { category, note ->
                    incidents = incidents + ExecutionIncident(
                        UUID.randomUUID().toString(),
                        Instant.now().toString(),
                        category.trim().ifBlank { "Other" },
                        listOfNotNull(
                            note.trim(),
                            drillRows.firstOrNull { it.id == activeDrillId }?.title?.let { "(during $it)" }
                        ).joinToString(" ")
                    )
                    quickNotesDirty = true
                },
                onRemoveIncident = { incident ->
                    incidents = incidents.filterNot { it.id == incident.id }
                    quickNotesDirty = true
                },
                onFinishSession = { finishSession() },
                onSaveProgress = { saveProgress() }
            )
        }
        if (showAddPlayer) {
            AddSessionPlayerDialog(
                busy = addPlayerBusy,
                error = addPlayerError,
                onDismiss = { if (!addPlayerBusy) showAddPlayer = false },
                onAdd = { draft ->
                    coroutineScope.launch {
                        addPlayerBusy = true
                        addPlayerError = ""
                        try {
                            val addition = onAddPlayer(draft)
                            attendance[addition.member.id] = "PRESENT"
                            saveProgress()
                            showAddPlayer = false
                        } catch (failure: Exception) {
                            addPlayerError = failure.message ?: "Unable to add this player."
                        } finally {
                            addPlayerBusy = false
                        }
                    }
                }
            )
        }
        return
    }

    Surface(modifier = modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val isTablet = maxWidth >= 600.dp
            val downloadReport = {
                reportError = runCatching {
                    openClubExport(context, buildReportFile(), "application/pdf", "Open PDF report")
                }.exceptionOrNull()?.message.orEmpty()
            }
            val shareReport = {
                reportError = runCatching {
                    shareClubExport(context, buildReportFile(), "application/pdf", "Share PDF report")
                }.exceptionOrNull()?.message.orEmpty()
            }
            Column(Modifier.fillMaxSize()) {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 12.dp)
                ) {
                    if (isTablet) {
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                PreparationCard(
                                    checklist = checklist,
                                    status = status,
                                    canStart = canStart,
                                    onScheduleDate = onScheduleDate,
                                    readOnly = readOnly,
                                    sessionDate = session.sessionDate,
                                    onStart = { if (onScheduleDate) beginSession(false) else showEarlyStartConfirm = true },
                                    modifier = Modifier.weight(1f)
                                )
                                AttendanceTable(
                                    players = assignedPlayers,
                                    attendance = attendance,
                                    readOnly = readOnly,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    } else {
                        item {
                            PreparationCard(
                                checklist = checklist,
                                status = status,
                                canStart = canStart,
                                onScheduleDate = onScheduleDate,
                                readOnly = readOnly,
                                sessionDate = session.sessionDate,
                                onStart = { if (onScheduleDate) beginSession(false) else showEarlyStartConfirm = true }
                            )
                        }
                        item {
                            AttendanceTable(players = assignedPlayers, attendance = attendance, readOnly = readOnly)
                        }
                    }
                    item { Text("Drill timing and completion", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold) }
                    if (isTablet) {
                        items(drillRows.chunked(2)) { pair ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                pair.forEach { drill ->
                                    DrillCard(
                                        drill = drill,
                                        readOnly = readOnly,
                                        onChange = { updated -> drillRows = drillRows.map { if (it.id == updated.id) updated else it } },
                                        onInfo = { infoDrill = drill },
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (pair.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    } else {
                        items(drillRows, key = { "drill:${it.id}" }) { drill ->
                            DrillCard(
                                drill = drill,
                                readOnly = readOnly,
                                onChange = { updated -> drillRows = drillRows.map { if (it.id == updated.id) updated else it } },
                                onInfo = { infoDrill = drill },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                    item {
                        ReviewTwoColumns(
                            isTablet = isTablet,
                            left = { m ->
                                PlayerNotesCard(
                                    players = assignedPlayers,
                                    playerNotes = playerNotes,
                                    saving = isSaving,
                                    onSave = { saveProgress() },
                                    modifier = m
                                )
                            },
                            right = { m ->
                                PlayerObservationsCard(players = assignedPlayers, observations = observations, modifier = m)
                            }
                        )
                    }
                    item {
                        ReviewTwoColumns(
                            isTablet = isTablet,
                            left = { m ->
                                IncidentsCard(
                                    incidents = incidents,
                                    category = incidentCategory,
                                    onCategoryChange = { incidentCategory = it },
                                    note = incidentNote,
                                    onNoteChange = { incidentNote = it },
                                    readOnly = readOnly,
                                    onAdd = {
                                        if (incidentNote.isNotBlank()) {
                                            incidents = incidents + ExecutionIncident(
                                                UUID.randomUUID().toString(),
                                                Instant.now().toString(),
                                                incidentCategory.trim().ifBlank { "Other" },
                                                incidentNote.trim()
                                            )
                                            incidentNote = ""
                                        }
                                    },
                                    onRemove = { incident -> incidents = incidents.filterNot { it.id == incident.id } },
                                    modifier = m
                                )
                            },
                            right = { m ->
                                EvaluationCard(
                                    wentWell = wentWell,
                                    onWentWellChange = { wentWell = it },
                                    disruptions = disruptions,
                                    onDisruptionsChange = { disruptions = it },
                                    nextAdjustments = nextAdjustments,
                                    onNextAdjustmentsChange = { nextAdjustments = it },
                                    postNotes = postNotes,
                                    onPostNotesChange = { postNotes = it },
                                    saving = isSaving,
                                    onSave = { saveProgress() },
                                    modifier = m
                                )
                            }
                        )
                    }
                    if (session.isExecuted) {
                        item {
                            AiAnalysisCard(
                                evaluation = aiEvaluation,
                                busy = aiBusy,
                                error = aiError,
                                onRun = {
                                    onRunAiAnalysis(payload(false), JSONObject().also { notes ->
                                        playerNotes.forEach { (id, note) -> if (note.isNotBlank()) notes.put(id, note) }
                                    }, postNotes)
                                },
                                onAddToAdjustments = { items ->
                                    nextAdjustments = (listOf(nextAdjustments) + items.map { "- $it" })
                                        .filter(String::isNotBlank).joinToString("\n")
                                },
                                onDownload = downloadReport,
                                onShare = shareReport,
                                reportError = reportError
                            )
                        }
                        if (aiEvaluation != null) {
                            item {
                                FollowUpCard(
                                    evaluation = aiEvaluation,
                                    draft = followUp,
                                    drillCatalogue = drillCatalogue,
                                    busy = followUpBusy,
                                    error = followUpError,
                                    createdFollowUp = createdFollowUp,
                                    followUpMinutes = followUpMinutes,
                                    onToggleCatalogueDrill = ::toggleFollowUpDrillId,
                                    onToggleRecommended = ::toggleRecommendedDrillIndex,
                                    onDraftChange = { followUp = it },
                                    onCreate = { followUp?.let(onCreateFollowUp) }
                                )
                            }
                        }
                    }
                    if (!session.isExecuted) {
                        item {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                ReportActionButtons(onDownload = downloadReport, onShare = shareReport)
                            }
                        }
                        if (reportError.isNotBlank()) {
                            item { Text(reportError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                        }
                    }
                    if (saveError.isNotBlank()) {
                        item { Text(saveError, color = MaterialTheme.colorScheme.error) }
                    }
                }
                if (!readOnly) Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 3.dp,
                    shadowElevation = 8.dp
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)
                    ) {
                        run {
                            OutlinedButton(onClick = { saveProgress() }, enabled = !isSaving) {
                                Icon(Icons.Outlined.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.padding(horizontal = 3.dp))
                                Text(if (isSaving) "Saving…" else "Save progress")
                            }
                            Button(
                                onClick = { showCompleteConfirm = true },
                                enabled = canStart && status != "PREPARING" && !isSaving
                            ) {
                                Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.padding(horizontal = 3.dp))
                                Text("Complete session")
                            }
                        }
                    }
                }
            }

        }
    }
    infoDrill?.let { execution ->
        DrillInfoDialog(
            execution = execution,
            drill = execution.drillId?.let(drillCatalogue::get),
            onDismiss = { infoDrill = null }
        )
    }
    if (showCompleteConfirm && !readOnly) {
        AlertDialog(
            onDismissRequest = { showCompleteConfirm = false },
            title = { Text("Complete this session?") },
            text = { Text("This explicitly marks the session delivered. You can still review the saved execution, but completion enables the post-session review.") },
            confirmButton = {
                Button(onClick = {
                    showCompleteConfirm = false
                    if (status == "PREPARING") {
                        beginSession(!onScheduleDate)
                    }
                    onSave(payload(true), JSONObject().also { notes ->
                        playerNotes.forEach { (id, note) -> if (note.isNotBlank()) notes.put(id, note) }
                    }, postNotes, true)
                }, enabled = !isSaving) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text(if (isSaving) "Saving…" else "Confirm completion")
                }
            },
            dismissButton = { TextButton(onClick = { showCompleteConfirm = false }) { Text("Keep editing") } }
        )
    }
    if (showEarlyStartConfirm && !readOnly) {
        AlertDialog(
            onDismissRequest = { showEarlyStartConfirm = false },
            title = { Text("Start before scheduled date?") },
            text = { Text("This session is scheduled for ${session.sessionDate}. Starting now will be recorded as started early.") },
            confirmButton = {
                Button(onClick = { beginSession(true) }) {
                    Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text("Start early")
                }
            },
            dismissButton = { TextButton(onClick = { showEarlyStartConfirm = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun LiveSessionPreStartScreen(
    session: ClubTrainingSession,
    players: List<ClubMember>,
    drills: List<ExecutionDrill>,
    checklist: androidx.compose.runtime.snapshots.SnapshotStateMap<String, Boolean>,
    attendance: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>,
    canStart: Boolean,
    ready: Boolean,
    isSaving: Boolean,
    saveError: String,
    onBack: () -> Unit,
    onProceed: () -> Unit,
    onAttendanceChanged: () -> Unit,
    onAddPlayer: () -> Unit,
    onStart: () -> Unit
) {
    val checklistDone = PreparationChecklist.count { (key, _) -> checklist[key] == true }
    val presentCount = players.count { attendance[it.id] in setOf("PRESENT", "LATE") }
    val startLabel = "Start session"

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val isTablet = maxWidth >= 600.dp
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    horizontal = if (isTablet) 20.dp else 14.dp,
                    vertical = 12.dp
                )
                ) {
                    if (saveError.isNotBlank()) {
                        item {
                            Text(
                                saveError,
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 15.sp
                            )
                        }
                    }
                    if (!ready) {
                        item {
                            Text(
                                "Checklist and attendance changes are saved automatically.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 14.sp
                            )
                        }
                    }
                    if (!ready) {
                    if (isTablet) {
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                PreparationChecklistCard(checklist, checklistDone, Modifier.weight(1f), onAttendanceChanged)
                                SquadAttendanceCard(players, attendance, Modifier.weight(1f), onAttendanceChanged, onAddPlayer)
                            }
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                SessionFocusCard(session, Modifier.weight(1f))
                                PlannedDrillsCard(drills, Modifier.weight(1f))
                            }
                        }
                    } else {
                        item { PreparationChecklistCard(checklist, checklistDone, onChanged = onAttendanceChanged) }
                        item { SquadAttendanceCard(players, attendance, onAttendanceChanged = onAttendanceChanged, onAddPlayer = onAddPlayer) }
                        item { SessionFocusCard(session) }
                        item { PlannedDrillsCard(drills) }
                    }
                    item {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = onBack) { Text("Cancel", fontSize = 17.sp) }
                            Button(onClick = onProceed, enabled = canStart) {
                                Text(startLabel, fontSize = 17.sp)
                                Spacer(Modifier.width(6.dp))
                                Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(22.dp))
                            }
                        }
                    }
                } else {
                    item {
                        Column(
                            Modifier.fillMaxWidth()
                                .then(if (isTablet) Modifier.padding(horizontal = 48.dp) else Modifier)
                                .padding(if (isTablet) 24.dp else 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                                Surface(
                                    onClick = onStart,
                                    enabled = canStart,
                                    shape = RoundedCornerShape(50),
                                    color = if (canStart) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                                ) {
                                    Icon(
                                        Icons.Outlined.PlayArrow,
                                        contentDescription = startLabel,
                                        tint = if (canStart) Color.White else MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(18.dp).size(44.dp)
                                    )
                                }
                                Text("Ready to start?", fontSize = 27.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface)
                                if (isTablet) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        PreStartMetric("Players present", "$presentCount/${players.size}", Icons.Outlined.Groups, Modifier.weight(1f))
                                        PreStartMetric("Drills planned", drills.size.toString(), Icons.Outlined.List, Modifier.weight(1f))
                                        PreStartMetric("Duration", "${session.durationMinutes} min", Icons.Outlined.AccessTime, Modifier.weight(1f))
                                        PreStartMetric("First drill", drills.firstOrNull()?.title ?: "No drills", Icons.Outlined.PlayArrow, Modifier.weight(1f))
                                    }
                                } else {
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        PreStartMetric("Players present", "$presentCount/${players.size}", Icons.Outlined.Groups)
                                        PreStartMetric("Drills planned", drills.size.toString(), Icons.Outlined.List)
                                        PreStartMetric("Duration", "${session.durationMinutes} min", Icons.Outlined.AccessTime)
                                        PreStartMetric("First drill", drills.firstOrNull()?.title ?: "No drills", Icons.Outlined.PlayArrow)
                                    }
                                }
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color(0xFFE7F6F0)
                                ) {
                                    Text(
                                        "Session timer will start automatically when you begin.",
                                        modifier = Modifier.padding(14.dp),
                                        color = Color(0xFF267857),
                                        fontSize = 16.sp
                                    )
                                }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LiveSessionPreCheckScreen(
    session: ClubTrainingSession,
    players: List<ClubMember>,
    drills: List<ExecutionDrill>,
    checklist: androidx.compose.runtime.snapshots.SnapshotStateMap<String, Boolean>,
    attendance: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>,
    isSaving: Boolean,
    saveError: String,
    onClose: () -> Unit,
    onChanged: () -> Unit,
    onAddPlayer: () -> Unit
) {
    val checklistDone = PreparationChecklist.count { (key, _) -> checklist[key] == true }
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val isTablet = maxWidth >= 600.dp
            LazyColumn(
                Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    horizontal = if (isTablet) 20.dp else 14.dp,
                    vertical = 12.dp
                )
            ) {
                item {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Pre-check", color = CoachInk, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                            Text("Review preparation and update attendance without leaving the live session.", color = CoachMuted, fontSize = 14.sp)
                        }
                        TextButton(onClick = onClose, enabled = !isSaving) {
                            Icon(Icons.Outlined.Close, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("Close")
                        }
                    }
                    if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
                }
                if (isTablet) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            PreparationChecklistCard(checklist, checklistDone, Modifier.weight(1f), onChanged)
                            SquadAttendanceCard(players, attendance, Modifier.weight(1f), onChanged, onAddPlayer)
                        }
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            SessionFocusCard(session, Modifier.weight(1f))
                            PlannedDrillsCard(drills, Modifier.weight(1f))
                        }
                    }
                } else {
                    item { PreparationChecklistCard(checklist, checklistDone, onChanged = onChanged) }
                    item { SquadAttendanceCard(players, attendance, onAttendanceChanged = onChanged, onAddPlayer = onAddPlayer) }
                    item { SessionFocusCard(session) }
                    item { PlannedDrillsCard(drills) }
                }
            }
        }
    }
}

@Composable
private fun PreparationChecklistCard(
    checklist: androidx.compose.runtime.snapshots.SnapshotStateMap<String, Boolean>,
    checklistDone: Int,
    modifier: Modifier = Modifier,
    onChanged: () -> Unit = {}
) {
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(0.dp)) {
            Text(
                "Preparation checklist  ·  $checklistDone/${PreparationChecklist.size}",
                fontWeight = FontWeight.Bold,
                fontSize = 19.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(Modifier.height(6.dp))
            PreparationChecklist.forEach { (key, label) ->
                val checked = checklist[key] == true
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable {
                            checklist[key] = !checked
                            onChanged()
                        }
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        if (checked) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                        contentDescription = if (checked) "Done" else "Not done",
                        tint = if (checked) Color(0xFF19A66A) else MaterialTheme.colorScheme.outline,
                        modifier = Modifier.size(22.dp)
                    )
                    Text(label, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun SquadAttendanceCard(
    players: List<ClubMember>,
    attendance: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>,
    modifier: Modifier = Modifier,
    onAttendanceChanged: () -> Unit = {},
    onAddPlayer: () -> Unit = {}
) {
    val presentCount = players.count { attendance[it.id] in setOf("PRESENT", "LATE") }
    var query by remember { mutableStateOf("") }
    val visiblePlayers = remember(players, query) {
        val q = query.trim()
        if (q.isEmpty()) players else players.filter { it.name.contains(q, ignoreCase = true) }
    }
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Squad attendance  ·  $presentCount/${players.size} present",
                    modifier = Modifier.weight(1f),
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                TextButton(onClick = onAddPlayer) {
                    Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add player")
                }
            }
            if (players.isEmpty()) {
                Text("No players are assigned to this session.", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
                    if (result.resultCode == Activity.RESULT_OK) {
                        result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
                            ?.takeIf(String::isNotBlank)?.let { query = it }
                    }
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(20.dp))
                        .padding(start = 12.dp, end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Outlined.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                    Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                        if (query.isEmpty()) {
                            Text("Search players", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f))
                        }
                        BasicTextField(
                            value = query,
                            onValueChange = { query = it },
                            singleLine = true,
                            textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface),
                            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Outlined.Close, contentDescription = "Clear search", modifier = Modifier.size(18.dp))
                        }
                    }
                    IconButton(
                        onClick = {
                            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                putExtra(RecognizerIntent.EXTRA_PROMPT, "Say a player name")
                            }
                            try { speechLauncher.launch(intent) } catch (_: ActivityNotFoundException) { }
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(Icons.Outlined.Mic, contentDescription = "Search by voice", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                    }
                }
                val listModifier = if (players.size > 10) {
                    Modifier.fillMaxWidth().heightIn(max = 360.dp).verticalScroll(rememberScrollState())
                } else Modifier.fillMaxWidth()
                Column(listModifier) {
                    if (visiblePlayers.isEmpty()) {
                        Text("No players match \"${query.trim()}\".", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 8.dp))
                    }
                    visiblePlayers.forEachIndexed { index, player ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                player.name,
                                modifier = Modifier.weight(1f),
                                fontSize = 15.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            listOf(
                                Triple("PRESENT", "Present", Color(0xFF19A66A)),
                                Triple("LATE", "Late", Color(0xFFD98A00)),
                                Triple("ABSENT", "Absent", Color(0xFFD64545))
                            ).forEach { (value, label, accent) ->
                                val selected = attendance[player.id] == value
                                Text(
                                    label,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .background(if (selected) accent else Color.Transparent)
                                        .border(1.dp, if (selected) accent else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(50))
                                        .clickable {
                                            attendance[player.id] = value
                                            onAttendanceChanged()
                                        }
                                        .padding(horizontal = 11.dp, vertical = 4.dp),
                                    fontSize = 15.sp,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        if (index < visiblePlayers.lastIndex) {
                            HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AddSessionPlayerDialog(
    busy: Boolean,
    error: String,
    onDismiss: () -> Unit,
    onAdd: (SessionPlayerDraft) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var ageGroup by remember { mutableStateOf("") }
    var ageMenuOpen by remember { mutableStateOf(false) }
    var speechLanguageMenuOpen by remember { mutableStateOf(false) }
    var speechLanguageTag by remember { mutableStateOf("") }
    var speechTarget by remember { mutableStateOf<String?>(null) }
    var speechError by remember { mutableStateOf("") }
    val disciplineOptions = listOf("BATTING", "BOWLING", "KEEPING", "FIELDING")
    val selectedDisciplines = remember {
        mutableStateMapOf<String, Boolean>().apply {
            disciplineOptions.forEach { put(it, it == "BATTING") }
        }
    }
    val ageGroups = listOf("", "U9", "U11", "U13", "U15", "U19", "Senior")
    val speechLanguages = listOf(
        "Device default" to "",
        "English (UK)" to "en-GB",
        "English (US)" to "en-US",
        "বাংলা (বাংলাদেশ)" to "bn-BD",
        "हिन्दी (भारत)" to "hi-IN",
        "اردو (پاکستان)" to "ur-PK"
    )
    val speechLanguageLabel = speechLanguages.first { it.second == speechLanguageTag }.first
    val valid = name.isNotBlank() && email.contains('@') && email.substringAfter('@').contains('.')

    fun spokenEmail(value: String): String = value.trim().lowercase()
        .replace(Regex("\\s+(at|অ্যাট|এট|एट|ऐट|ایٹ|اٹ)\\s+"), "@")
        .replace(Regex("\\s+(dot|ডট|डॉट|ڈاٹ)\\s+"), ".")
        .replace(Regex("\\s+underscore\\s+"), "_")
        .replace(Regex("\\s+(dash|hyphen)\\s+"), "-")
        .replace(Regex("\\s+"), "")

    fun spokenAgeGroup(value: String): String? {
        val normalized = value.lowercase().replace("-", " ").map { character ->
            character.digitToIntOrNull()?.toString() ?: character.toString()
        }.joinToString("").trim()
        if (listOf("senior", "adult", "সিনিয়র", "প্রাপ্তবয়স্ক", "सीनियर", "वयस्क", "سینئر", "بالغ").any { it in normalized }) return "Senior"
        val number = Regex("\\d+").find(normalized)?.value
            ?: mapOf(
                "nine" to "9", "eleven" to "11", "thirteen" to "13",
                "fifteen" to "15", "nineteen" to "19",
                "নয়" to "9", "নয়" to "9", "এগারো" to "11", "তেরো" to "13", "পনেরো" to "15", "উনিশ" to "19",
                "नौ" to "9", "ग्यारह" to "11", "तेरह" to "13", "पंद्रह" to "15", "उन्नीस" to "19",
                "نو" to "9", "گیارہ" to "11", "تیرہ" to "13", "پندرہ" to "15", "انیس" to "19"
            ).entries.firstOrNull { it.key in normalized }?.value
        return number?.let { spoken -> ageGroups.firstOrNull { it.removePrefix("U") == spoken } }
    }

    val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val target = speechTarget
        if (result.resultCode == Activity.RESULT_OK && target != null) {
            val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
            if (spoken.isNullOrBlank()) {
                speechError = "No speech was recognized. Try again."
            } else when (target) {
                "NAME" -> { name = spoken; speechError = "" }
                "EMAIL" -> { email = spokenEmail(spoken); speechError = "" }
                "AGE" -> {
                    val matched = spokenAgeGroup(spoken)
                    if (matched == null) speechError = "Say an age group such as under 15 or senior."
                    else { ageGroup = matched; speechError = "" }
                }
            }
        }
        speechTarget = null
    }

    fun startSpeech(target: String, prompt: String) {
        speechTarget = target
        speechError = ""
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)
            if (speechLanguageTag.isNotBlank()) putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechLanguageTag)
        }
        try {
            speechLauncher.launch(intent)
        } catch (_: ActivityNotFoundException) {
            speechTarget = null
            speechError = "Speech recognition is not available on this device."
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add player to this session") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "The player will be marked present and added to the club roster as provisional until a club admin approves them.",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Voice input language", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Box {
                        OutlinedButton(
                            onClick = { speechLanguageMenuOpen = true },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !busy && speechTarget == null
                        ) {
                            Icon(Icons.Outlined.Mic, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(7.dp))
                            Text(speechLanguageLabel, modifier = Modifier.weight(1f))
                            Icon(Icons.Outlined.ExpandMore, contentDescription = "Change voice input language")
                        }
                        DropdownMenu(
                            expanded = speechLanguageMenuOpen,
                            onDismissRequest = { speechLanguageMenuOpen = false }
                        ) {
                            speechLanguages.forEach { (label, tag) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        speechLanguageTag = tag
                                        speechLanguageMenuOpen = false
                                        speechError = ""
                                    }
                                )
                            }
                        }
                    }
                }
                OutlinedTextField(
                    name,
                    { name = it },
                    label = { Text("Player name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    trailingIcon = {
                        IconButton(onClick = { startSpeech("NAME", "Say the player's name") }) {
                            Icon(Icons.Outlined.Mic, contentDescription = "Speak player name")
                        }
                    }
                )
                OutlinedTextField(
                    email,
                    { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    trailingIcon = {
                        IconButton(onClick = { startSpeech("EMAIL", "Say the player's email address") }) {
                            Icon(Icons.Outlined.Mic, contentDescription = "Speak email address")
                        }
                    }
                )
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Age group (optional)", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Box {
                            OutlinedButton(
                                onClick = { ageMenuOpen = true },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !busy
                            ) {
                                Text(ageGroup.ifBlank { "Not specified" }, modifier = Modifier.weight(1f))
                                Icon(Icons.Outlined.ExpandMore, contentDescription = "Open age groups")
                            }
                            DropdownMenu(expanded = ageMenuOpen, onDismissRequest = { ageMenuOpen = false }) {
                                ageGroups.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option.ifBlank { "Not specified" }) },
                                        onClick = { ageGroup = option; ageMenuOpen = false }
                                    )
                                }
                            }
                        }
                    }
                    IconButton(onClick = { startSpeech("AGE", "Say the player's age group") }, enabled = !busy) {
                        Icon(Icons.Outlined.Mic, contentDescription = "Speak age group")
                    }
                }
                Text("Disciplines (select one or more)", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    disciplineOptions.forEach { option ->
                        val selected = selectedDisciplines[option] == true
                        Text(
                            option.lowercase().replaceFirstChar(Char::uppercase),
                            color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
                            fontSize = 12.sp,
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant)
                                .clickable(enabled = !busy) {
                                    if (!selected || selectedDisciplines.values.count { it } > 1) {
                                        selectedDisciplines[option] = !selected
                                    }
                                }
                                .padding(horizontal = 9.dp, vertical = 6.dp)
                        )
                    }
                }
                if (speechError.isNotBlank()) Text(speechError, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onAdd(SessionPlayerDraft(
                        name.trim(),
                        email.trim(),
                        ageGroup,
                        disciplineOptions.filter { selectedDisciplines[it] == true }
                    ))
                },
                enabled = valid && !busy
            ) { Text(if (busy) "Adding…" else "Add & mark present") }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") } }
    )
}

@Composable
private fun SessionFocusCard(session: ClubTrainingSession, modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Session guidance", fontWeight = FontWeight.Bold, fontSize = 19.sp, color = MaterialTheme.colorScheme.onSurface)
            if (session.safety.isEmpty()) {
                Text("No additional safety guidance provided.", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                session.safety.forEach { Text("• $it", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
    }
}

@Composable
private fun PlannedDrillsCard(drills: List<ExecutionDrill>, modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Planned drills (${drills.size})", fontWeight = FontWeight.Bold, fontSize = 19.sp, color = MaterialTheme.colorScheme.onSurface)
            if (drills.isEmpty()) {
                Text("No drills are planned for this session.", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                drills.forEachIndexed { index, drill ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${index + 1}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                        Column(Modifier.weight(1f)) {
                            Text(drill.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                            Text("${drill.plannedMinutes} min", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PreStartMetric(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier
) {
    Surface(modifier = modifier, shape = RoundedCornerShape(12.dp), color = Color(0xFFF7F8FD)) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
            Column(Modifier.weight(1f)) {
                Text(value, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text(label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            }
        }
    }
}

@Composable
private fun PreparationCard(
    checklist: androidx.compose.runtime.snapshots.SnapshotStateMap<String, Boolean>,
    status: String,
    canStart: Boolean,
    onScheduleDate: Boolean,
    readOnly: Boolean,
    sessionDate: String,
    onStart: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Preparation checklist", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
            Spacer(Modifier.height(4.dp))
            PreparationChecklist.forEach { (key, label) ->
                val checked = checklist[key] == true
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(enabled = !readOnly) { checklist[key] = !checked }
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        if (checked) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                        contentDescription = if (checked) "Done" else "Not done",
                        tint = if (checked) Color(0xFF19A66A) else MaterialTheme.colorScheme.outline,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
                }
            }
            if (status == "PREPARING" && !readOnly) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Status: ${status.replace('_', ' ')}", fontWeight = FontWeight.Medium, fontSize = 15.sp)
                    Button(onClick = onStart, enabled = canStart) {
                        Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.padding(horizontal = 3.dp))
                        Text("Start session")
                    }
                }
                if (!canStart) {
                    Text(
                        "Complete the preparation checklist to start before $sessionDate, or wait until then.",
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 14.sp
                    )
                } else if (!onScheduleDate) {
                    Text(
                        "Checklist complete — starting now will be recorded as earlier than the scheduled date ($sessionDate).",
                        color = MaterialTheme.colorScheme.tertiary,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun AttendanceTable(
    players: List<ClubMember>,
    attendance: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>,
    readOnly: Boolean,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Attendance", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
            Spacer(Modifier.height(4.dp))
            if (players.isEmpty()) {
                Text("No players assigned to this session yet.", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            } else {
                val order = listOf("PRESENT", "LATE", "ABSENT")
                players.forEachIndexed { index, player ->
                    val value = attendance[player.id]
                    val (label, tint) = when (value) {
                        "PRESENT" -> "Present" to Color(0xFF159B72)
                        "LATE" -> "Late" to Color(0xFFE28A18)
                        "ABSENT" -> "Absent" to Color(0xFFE84A54)
                        else -> "Not marked" to Color(0xFF8791A8)
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(player.name, Modifier.weight(1f), fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = tint.copy(alpha = 0.12f),
                            border = BorderStroke(1.dp, tint.copy(alpha = 0.35f)),
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .clickable(enabled = !readOnly) {
                                    attendance[player.id] = order[(order.indexOf(value) + 1) % order.size]
                                }
                        ) {
                            Text(
                                label,
                                color = tint,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 1.dp)
                            )
                        }
                    }
                    if (index < players.lastIndex) {
                        HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    }
                }
            }
        }
    }
}

@Composable
private fun DrillCard(
    drill: ExecutionDrill,
    readOnly: Boolean,
    onChange: (ExecutionDrill) -> Unit,
    onInfo: () -> Unit,
    modifier: Modifier = Modifier
) {
    val (statusLabel, statusTint) = if (drill.completed) "Completed" to Color(0xFF159B72) else "Not completed" to Color(0xFF8791A8)
    val overrun = drill.plannedMinutes > 0 && drill.actualMinutes > drill.plannedMinutes
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    drill.title,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Surface(
                    shape = RoundedCornerShape(50),
                    color = statusTint.copy(alpha = 0.12f),
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .clickable(enabled = !readOnly) { onChange(drill.copy(completed = !drill.completed)) }
                ) {
                    Text(
                        statusLabel,
                        color = statusTint,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                    )
                }
                IconButton(onClick = onInfo, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Outlined.Info, contentDescription = "Drill setup info", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Outlined.Timer, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), modifier = Modifier.size(16.dp))
                Text(
                    "${drill.actualMinutes} of ${drill.plannedMinutes} min",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (overrun) Color(0xFFE28A18) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f)
                )
            }
            if (drill.notes.isNotBlank()) {
                Text(
                    drill.notes,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun DrillInfoDialog(execution: ExecutionDrill, drill: Drill?, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(execution.title, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!drill?.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = drill?.imageUrl,
                        contentDescription = execution.title,
                        modifier = Modifier.fillMaxWidth().height(160.dp),
                        contentScale = ContentScale.Crop
                    )
                }
                Text(
                    drill?.instructions?.takeIf(String::isNotBlank) ?: "No setup instructions recorded for this drill.",
                    style = MaterialTheme.typography.bodyMedium
                )
                if (drill != null) {
                    Text(
                        "${drill.discipline} · ${drill.skillSet} · ${drill.durationMinutes} min",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } }
    )
}

@Composable
private fun ReviewTwoColumns(
    isTablet: Boolean,
    left: @Composable (Modifier) -> Unit,
    right: @Composable (Modifier) -> Unit
) {
    if (isTablet) {
        Row(
            Modifier.fillMaxWidth().height(IntrinsicSize.Min),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            left(Modifier.weight(1f).fillMaxHeight())
            right(Modifier.weight(1f).fillMaxHeight())
        }
    } else {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            left(Modifier.fillMaxWidth())
            right(Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun ReviewPanel(
    title: String,
    modifier: Modifier = Modifier,
    action: @Composable (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(modifier = modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth().heightIn(min = 28.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, modifier = Modifier.weight(1f))
                action?.invoke()
            }
            content()
        }
    }
}

@Composable
private fun ReviewEmptyText(text: String) {
    Text(text, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f))
}

@Composable
private fun ReviewTag(label: String, tint: Color) {
    Surface(shape = RoundedCornerShape(50), color = tint.copy(alpha = 0.12f)) {
        Text(
            label,
            color = tint,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
        )
    }
}

@Composable
private fun ReviewEditAction(editing: Boolean, saving: Boolean, onToggle: () -> Unit) {
    if (editing) {
        TextButton(onClick = onToggle, enabled = !saving, contentPadding = PaddingValues(horizontal = 8.dp)) {
            Text(if (saving) "Saving…" else "Save", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
    } else {
        IconButton(onClick = onToggle, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Outlined.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun IncidentsCard(
    incidents: List<ExecutionIncident>,
    category: String,
    onCategoryChange: (String) -> Unit,
    note: String,
    onNoteChange: (String) -> Unit,
    readOnly: Boolean,
    onAdd: () -> Unit,
    onRemove: (ExecutionIncident) -> Unit,
    modifier: Modifier = Modifier
) {
    ReviewPanel("Incidents", modifier) {
        if (incidents.isEmpty()) ReviewEmptyText("No incidents recorded.")
        incidents.forEachIndexed { index, incident ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ReviewTag(incident.category.ifBlank { "Other" }, Color(0xFFE84A54))
                Column(Modifier.weight(1f)) {
                    Text(incident.note, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface)
                    formatObservationClock(incident.time).takeIf(String::isNotBlank)?.let {
                        Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f))
                    }
                }
                if (!readOnly) {
                    IconButton(onClick = { onRemove(incident) }, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Outlined.Delete, contentDescription = "Remove incident", modifier = Modifier.size(18.dp))
                    }
                }
            }
            if (index < incidents.lastIndex) HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        }
        if (!readOnly) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(category, onCategoryChange, label = { Text("Category") }, modifier = Modifier.weight(0.7f), singleLine = true,
                    trailingIcon = { VoiceMicButton(category, onCategoryChange, "Say the incident category", singleLine = true, replace = true) })
                OutlinedTextField(note, onNoteChange, label = { Text("Incident note") }, modifier = Modifier.weight(1.3f), singleLine = true,
                    trailingIcon = { VoiceMicButton(note, onNoteChange, "Speak the incident note", singleLine = true) })
                IconButton(onClick = onAdd) {
                    Icon(Icons.Outlined.Add, contentDescription = "Add incident", tint = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

@Composable
private fun PlayerObservationsCard(
    players: List<ClubMember>,
    observations: List<SessionObservation>,
    modifier: Modifier = Modifier
) {
    val names = players.associate { it.id to it.name }
    val individual = observations.filter { !it.playerId.isNullOrBlank() }.sortedBy { it.createdAt }
    ReviewPanel("Coach observations", modifier) {
        if (individual.isEmpty()) ReviewEmptyText("No individual player observations recorded.")
        individual.forEachIndexed { index, observation ->
            val name = observation.playerName?.takeIf(String::isNotBlank) ?: names[observation.playerId] ?: "Player"
            val meta = listOfNotNull(
                observation.drillTitle?.takeIf(String::isNotBlank),
                formatObservationClock(observation.createdAt).takeIf(String::isNotBlank)
            ).joinToString(" · ")
            Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f, fill = false))
                    ReviewTag(observation.category.lowercase().replaceFirstChar(Char::uppercase), MaterialTheme.colorScheme.primary)
                }
                Text(observation.text, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f))
                if (meta.isNotBlank()) Text(meta, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f))
            }
            if (index < individual.lastIndex) HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        }
    }
}

@Composable
private fun PlayerNotesCard(
    players: List<ClubMember>,
    playerNotes: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>,
    saving: Boolean,
    onSave: () -> Unit,
    modifier: Modifier = Modifier
) {
    var editing by remember { mutableStateOf(false) }
    var editVersion by remember { mutableStateOf(0) }
    val currentOnSave by rememberUpdatedState(onSave)
    LaunchedEffect(editVersion) {
        if (editVersion == 0) return@LaunchedEffect
        delay(800)
        currentOnSave()
    }
    var speechTarget by remember { mutableStateOf<String?>(null) }
    var speechError by remember { mutableStateOf("") }
    val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val target = speechTarget
        if (result.resultCode == Activity.RESULT_OK && target != null) {
            val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
            if (!spoken.isNullOrBlank()) {
                playerNotes[target] = listOf(playerNotes[target].orEmpty().trim(), spoken).filter(String::isNotBlank).joinToString("\n")
                editVersion++
                speechError = ""
            } else speechError = "No speech was recognized. Try again."
        }
        speechTarget = null
    }
    ReviewPanel(
        "Player notes",
        modifier,
        action = if (players.isEmpty()) null else ({
            if (editing) {
                Text(
                    if (saving) "Saving…" else "Done",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable {
                            currentOnSave()
                            editing = false
                        }
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                )
            } else {
                ReviewEditAction(editing = false, saving = saving) { editing = true }
            }
        })
    ) {
        if (editing) {
            Text(
                if (saving) "Saving…" else "Changes save automatically",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f)
            )
            players.forEach { player ->
                OutlinedTextField(
                    value = playerNotes[player.id].orEmpty(),
                    onValueChange = {
                        playerNotes[player.id] = it
                        editVersion++
                    },
                    label = { Text(player.name) },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp),
                    trailingIcon = {
                        IconButton(onClick = {
                            speechTarget = player.id
                            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak a note for ${player.name}")
                            }
                            try {
                                speechLauncher.launch(intent)
                            } catch (_: ActivityNotFoundException) {
                                speechTarget = null
                                speechError = "Speech recognition is not available on this device."
                            }
                        }) {
                            Icon(Icons.Outlined.Mic, contentDescription = "Speak note for ${player.name}", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                )
            }
            if (speechError.isNotBlank()) Text(speechError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
        } else {
            val withNotes = players.mapNotNull { player ->
                playerNotes[player.id]?.trim()?.takeIf(String::isNotBlank)?.let { player.name to it }
            }
            if (withNotes.isEmpty()) ReviewEmptyText("No player notes yet. Tap edit to add.")
            withNotes.forEachIndexed { index, (name, note) ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Text(name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface)
                    Text(note, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f))
                }
                if (index < withNotes.lastIndex) HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            }
        }
    }
}

@Composable
private fun EvaluationCard(
    wentWell: String,
    onWentWellChange: (String) -> Unit,
    disruptions: String,
    onDisruptionsChange: (String) -> Unit,
    nextAdjustments: String,
    onNextAdjustmentsChange: (String) -> Unit,
    postNotes: String,
    onPostNotesChange: (String) -> Unit,
    saving: Boolean,
    onSave: () -> Unit,
    modifier: Modifier = Modifier
) {
    var editing by remember { mutableStateOf(false) }
    val rows = listOf(
        Triple("Went well", Color(0xFF159B72), wentWell to onWentWellChange),
        Triple("Disruption", Color(0xFFE84A54), disruptions to onDisruptionsChange),
        Triple("Adjustment", Color(0xFFE28A18), nextAdjustments to onNextAdjustmentsChange),
        Triple("Summary", Color(0xFF6C4DF6), postNotes to onPostNotesChange)
    )
    ReviewPanel(
        "Session notes",
        modifier,
        action = {
            ReviewEditAction(editing, saving) {
                if (editing) onSave()
                editing = !editing
            }
        }
    ) {
        if (editing) {
            rows.forEach { (label, _, field) ->
                OutlinedTextField(
                    value = field.first,
                    onValueChange = field.second,
                    label = { Text(label) },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp),
                    trailingIcon = { VoiceMicButton(field.first, field.second, "Speak ${label.lowercase()}") }
                )
            }
        } else {
            val filled = rows.filter { it.third.first.isNotBlank() }
            if (filled.isEmpty()) ReviewEmptyText("No session notes yet. Tap edit to add.")
            filled.forEachIndexed { index, (label, tint, field) ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    ReviewTag(label, tint)
                    Text(field.first.trim(), fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f))
                }
                if (index < filled.lastIndex) HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            }
        }
    }
}

@Composable
private fun ReportActionButtons(onDownload: () -> Unit, onShare: () -> Unit) {
    IconButton(onClick = onDownload) {
        Icon(Icons.Outlined.Download, contentDescription = "Download PDF report", tint = MaterialTheme.colorScheme.primary)
    }
    IconButton(onClick = onShare) {
        Icon(Icons.Outlined.Share, contentDescription = "Share PDF report", tint = MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun AiAnalysisCard(
    evaluation: AiEvaluationData?,
    busy: Boolean,
    error: String,
    onRun: () -> Unit,
    onAddToAdjustments: (List<String>) -> Unit,
    onDownload: () -> Unit,
    onShare: () -> Unit,
    reportError: String
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text("AI session analysis", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = onRun, enabled = !busy) {
                        Icon(if (evaluation != null) Icons.Outlined.Refresh else Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.padding(horizontal = 3.dp))
                        Text(if (busy) "Analysing…" else "Analyse")
                    }
                    Spacer(Modifier.width(4.dp))
                    ReportActionButtons(onDownload = onDownload, onShare = onShare)
                }
            }
            if (reportError.isNotBlank()) Text(reportError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
            Text(
                "Gemini reviews player notes, attendance, drill timings, disruptions and evaluation, then suggests improvements and a follow-up session.",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
            if (evaluation != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Diagnosis", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                    ) {
                        Text(
                            ReadinessLabels[evaluation.progressionReadiness] ?: evaluation.progressionReadiness,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
                Text(evaluation.squadSummary, fontSize = 14.sp)
                if (evaluation.identifiedGaps.isNotEmpty()) {
                    Text("Gaps", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    evaluation.identifiedGaps.forEach { Text("• $it", fontSize = 14.sp) }
                }
                if (evaluation.playerFeedback.isNotEmpty()) {
                    Text("Player focus", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    evaluation.playerFeedback.forEach { (name, focus) -> Text("$name: $focus", fontSize = 14.sp) }
                }
                if (evaluation.sessionImprovements.isNotEmpty()) {
                    Text("Improve the next session", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    evaluation.sessionImprovements.forEach { Text("• $it", fontSize = 14.sp) }
                    TextButton(onClick = { onAddToAdjustments(evaluation.sessionImprovements) }) {
                        Text("Add to adjustments")
                    }
                }
                HorizontalDivider()
                Text("💬 ${evaluation.aiCommendation}", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
                evaluation.generatedAt?.let {
                    Text("Generated $it", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                }
            }
        }
    }
}

@Composable
private fun FollowUpCard(
    evaluation: AiEvaluationData,
    draft: JSONObject?,
    drillCatalogue: Map<String, Drill>,
    busy: Boolean,
    error: String,
    createdFollowUp: ClubTrainingSession?,
    followUpMinutes: Int,
    onToggleCatalogueDrill: (String) -> Unit,
    onToggleRecommended: (Int) -> Unit,
    onDraftChange: (JSONObject) -> Unit,
    onCreate: () -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Follow-up session", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
            if (createdFollowUp != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text(
                        "\"${createdFollowUp.title}\" created for ${createdFollowUp.sessionDate}${createdFollowUp.sessionTime?.let { " at $it" }.orEmpty()} with ${createdFollowUp.drillCount} drill(s).",
                        fontSize = 14.sp
                    )
                }
                Text(
                    "It is saved as a draft for the club to review and publish in the session planner.",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            } else if (draft != null) {
                val detailsColumn: @Composable (Modifier) -> Unit = { columnModifier ->
                    Column(columnModifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        evaluation.followUpPlan?.objective?.takeIf(String::isNotBlank)?.let {
                            Text(it, fontSize = 14.sp)
                        }
                        OutlinedTextField(
                            draft.optString("title"),
                            { onDraftChange(JSONObject(draft.toString()).put("title", it)) },
                            label = { Text("Title") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            trailingIcon = {
                                VoiceMicButton(
                                    draft.optString("title"),
                                    { onDraftChange(JSONObject(draft.toString()).put("title", it)) },
                                    "Say the session title",
                                    singleLine = true,
                                    replace = true
                                )
                            }
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            DateField(
                                draft.optString("sessionDate"),
                                { onDraftChange(JSONObject(draft.toString()).put("sessionDate", it)) },
                                "Date",
                                Modifier.weight(1f)
                            )
                            TimeField(
                                draft.optString("sessionTime"),
                                { onDraftChange(JSONObject(draft.toString()).put("sessionTime", it)) },
                                "Time",
                                Modifier.weight(1f)
                            )
                        }
                        OutlinedTextField(
                            draft.optInt("durationMinutes").toString(),
                            { value -> onDraftChange(JSONObject(draft.toString()).put("durationMinutes", value.toIntOrNull() ?: draft.optInt("durationMinutes"))) },
                            label = { Text("Minutes") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Text("Selected drills: $followUpMinutes min", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                        Button(onClick = onCreate, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.padding(horizontal = 3.dp))
                            Text(if (busy) "Creating…" else "Create follow-up session")
                        }
                    }
                }
                val drillsColumn: @Composable (Modifier) -> Unit = { columnModifier ->
                Column(columnModifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                val catalogueIds = evaluation.followUpPlan?.catalogueDrillIds.orEmpty()
                val selectedCatalogueIds = (0 until draft.getJSONArray("drillIds").length())
                    .map { draft.getJSONArray("drillIds").getString(it) }.toSet()
                if (catalogueIds.isNotEmpty()) {
                    Text("Catalogue drills", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    catalogueIds.forEach { id ->
                        val drill = drillCatalogue[id]
                        if (drill != null) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                val selected = id in selectedCatalogueIds
                                Surface(
                                    onClick = { onToggleCatalogueDrill(id) },
                                    shape = androidx.compose.foundation.shape.CircleShape,
                                    color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            if (selected) Icons.Outlined.Delete else Icons.Outlined.Add,
                                            contentDescription = if (selected) "Remove ${drill.title}" else "Add ${drill.title}",
                                            tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                                Text("${drill.title} · ${drill.discipline} · ${drill.durationMinutes} min", fontSize = 14.sp)
                            }
                        }
                    }
                }
                if (evaluation.tailoredRecommendedDrills.isNotEmpty()) {
                    Text("New AI-recommended drills (saved to the club catalogue)", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    val selectedIndexes = (0 until draft.getJSONArray("recommendedDrillIndexes").length())
                        .map { draft.getJSONArray("recommendedDrillIndexes").getInt(it) }.toSet()
                    evaluation.tailoredRecommendedDrills.forEachIndexed { index, row ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            val selected = index in selectedIndexes
                            Surface(
                                onClick = { onToggleRecommended(index) },
                                shape = androidx.compose.foundation.shape.CircleShape,
                                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        if (selected) Icons.Outlined.Delete else Icons.Outlined.Add,
                                        contentDescription = if (selected) "Remove ${row.optString("title")}" else "Add ${row.optString("title")}",
                                        tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                            Column {
                                Text("${row.optString("title")} · ${row.optString("discipline")} · ${row.optInt("durationMinutes")} min", fontSize = 14.sp)
                                row.optString("reason").takeIf(String::isNotBlank)?.let {
                                    Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                }
                            }
                        }
                    }
                }
                }
                }
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    if (maxWidth >= 600.dp) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            detailsColumn(Modifier.weight(1f))
                            drillsColumn(Modifier.weight(1f))
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            drillsColumn(Modifier.fillMaxWidth())
                            detailsColumn(Modifier.fillMaxWidth())
                        }
                    }
                }
            }
        }
    }
}

@Composable
            private fun SessionCoachModeScreen(
                page: String,
                session: ClubTrainingSession,
                drills: List<ExecutionDrill>,
                activeDrillId: String?,
                activeDrillSeconds: Int,
                activeDrillBaseSeconds: Int,
                activeDrillStartedAt: String?,
                sessionSeconds: Int,
                sessionPaused: Boolean,
                paused: Boolean,
                observations: List<SessionObservation>,
                observationLoadError: String,
                observationScope: String,
                observationCategory: String,
                observationPlayerId: String?,
                observationText: String,
                observationSaving: Boolean,
                observationError: String,
                observationSavedAt: String,
                players: List<ClubMember>,
                isSaving: Boolean,
                saveError: String,
                onBack: () -> Unit,
                onOpenObservation: (String, String) -> Unit,
                onViewAllObservations: () -> Unit,
                onAddPlayer: () -> Unit,
                onOpenPreCheck: () -> Unit,
                onObservationScopeChange: (String) -> Unit,
                onObservationCategoryChange: (String) -> Unit,
                onObservationPlayerChange: (String?) -> Unit,
                onObservationTextChange: (String) -> Unit,
                onRetryObservation: () -> Unit,
                onReloadObservations: suspend () -> Unit,
                onPause: () -> Unit,
                onResume: () -> Unit,
                onAdjust: (Int) -> Unit,
                onCompleteDrill: () -> Unit,
                onSelectDrill: (ExecutionDrill) -> Unit,
                onReopenDrill: (ExecutionDrill) -> Unit,
                onOpenDrillControls: () -> Unit,
                onPauseSession: () -> Unit,
                onResumeSession: () -> Unit,
                onDrillNotesChange: (String) -> Unit,
                quickNoteText: String,
                quickNoteSaving: Boolean,
                onQuickNoteChange: (String) -> Unit,
                onOpenQuickNote: (String) -> Unit,
                incidents: List<ExecutionIncident>,
                onAddIncident: (String, String) -> Unit,
                onRemoveIncident: (ExecutionIncident) -> Unit,
                onEndSession: () -> Unit,
                onFinishSession: () -> Unit,
                onSaveProgress: () -> Unit
            ) {
                val activeDrill = drills.firstOrNull { it.id == activeDrillId }
                val coroutineScope = rememberCoroutineScope()
                if (page == "LIVE") {
                    SessionLiveDashboardLayout(
                        session = session,
                        activeDrill = activeDrill,
                        drillPosition = drills.indexOfFirst { it.id == activeDrillId }.let { if (it >= 0) it + 1 else 0 },
                        drillCount = drills.size,
                        activeDrillSeconds = activeDrillSeconds,
                        sessionSeconds = sessionSeconds,
                        sessionPaused = sessionPaused,
                        observations = observations,
                        observationLoadError = observationLoadError,
                        isSaving = isSaving,
                        saveError = saveError,
                        onPauseSession = onPauseSession,
                        onResumeSession = onResumeSession,
                        onOpenObservation = onOpenObservation,
                        onOpenQuickNote = onOpenQuickNote,
                        onOpenDrillControls = onOpenDrillControls,
                        onEndSession = onEndSession,
                        onAddPlayer = onAddPlayer,
                        onOpenPreCheck = onOpenPreCheck,
                        onViewAllObservations = onViewAllObservations,
                        onReloadObservations = onReloadObservations
                    )
                } else {
                Column(
                    modifier = Modifier.fillMaxSize().background(Color(0xFFF3F5FD))
                ) {
                    LazyColumn(
                        modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(top = 12.dp, bottom = 28.dp)
                    ) {
                    when (page) {
                        "WENT_WELL", "DISRUPTION", "ADJUSTMENT" -> item {
                            QuickNotePanel(
                                kind = page,
                                text = quickNoteText,
                                saving = quickNoteSaving,
                                saveError = saveError,
                                drillTitle = activeDrill?.title,
                                onTextChange = onQuickNoteChange,
                                onClose = onBack
                            )
                        }
                        "INCIDENT" -> item {
                            IncidentEntryPanel(
                                incidents = incidents,
                                saving = quickNoteSaving,
                                saveError = saveError,
                                drillTitle = activeDrill?.title,
                                onAdd = onAddIncident,
                                onRemove = onRemoveIncident,
                                onClose = onBack
                            )
                        }
                        "OBSERVATION" -> item {
                            ObservationEntryPanel(
                                players = players,
                                observationScope = observationScope,
                                observationCategory = observationCategory,
                                observationPlayerId = observationPlayerId,
                                observationText = observationText,
                                observationSaving = observationSaving,
                                observationError = observationError,
                                observationSavedAt = observationSavedAt,
                                activeDrillTitle = activeDrill?.title,
                                onClose = onBack,
                                onScopeChange = onObservationScopeChange,
                                onCategoryChange = onObservationCategoryChange,
                                onPlayerChange = onObservationPlayerChange,
                                onTextChange = onObservationTextChange,
                                onRetry = onRetryObservation
                            )
                        }
                        "DRILL" -> item {
                            DrillControlsTabletCard(
                                activeDrill = activeDrill,
                                activeDrillSeconds = activeDrillSeconds,
                                activeDrillBaseSeconds = activeDrillBaseSeconds,
                                activeDrillStartedAt = activeDrillStartedAt,
                                sessionDrills = drills.mapIndexed { index, drill -> (index + 1) to drill },
                                paused = paused,
                                drillNotes = activeDrill?.notes.orEmpty(),
                                isSaving = isSaving,
                                saveError = saveError,
                                onNotesChange = onDrillNotesChange,
                                onAdjust = onAdjust,
                                onPause = onPause,
                                onResume = onResume,
                                onComplete = onCompleteDrill,
                                onSelectNext = { drill -> onSelectDrill(drill) },
                                onReopen = onReopenDrill,
                                onAddObservation = { onOpenObservation("GROUP", "TECHNIQUE") }
                            )
                        }
                        "END" -> item {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedButton(onClick = onBack) { Text("‹  Continue session") }
                                CoachCard {
                                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Text("End this session?", color = CoachInk, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                                        Text("Session time: ${formatCoachTime(sessionSeconds)}", color = CoachMuted)
                                        Text("Drills completed: ${drills.count { it.completed }} / ${drills.size}", color = CoachMuted)
                                        Text("Observations: ${observations.size}", color = CoachMuted)
                                        Text("Finish “${session.title}” and move to the session review?", color = CoachInk, fontSize = 13.sp)
                                        OutlinedButton(onClick = onSaveProgress, enabled = !isSaving, modifier = Modifier.fillMaxWidth()) {
                                            Text(if (isSaving) "Saving…" else "Save progress")
                                        }
                                        Button(onClick = onFinishSession, enabled = !isSaving, modifier = Modifier.fillMaxWidth()) {
                                            Text("Finish session")
                                        }
                                        if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                        "OBSERVATIONS" -> item {
                            AllSessionObservationsCard(observations, observationLoadError) {
                                coroutineScope.launch { onReloadObservations() }
                            }
                        }
                        else -> {
                            item {
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    CoachCard {
                                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Column(Modifier.weight(1f)) {
                                                    Text("LIVE SESSION", color = Color(0xFF7B6AE5), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                                    Text(if (sessionPaused) "Session paused" else "Session in progress", color = CoachInk, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                                                }
                                                Text(
                                                    if (sessionPaused) "PAUSED" else "● LIVE",
                                                    color = if (sessionPaused) Color(0xFFAF7420) else Color(0xFF21895B),
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                CoachMetric("Elapsed", formatCoachTime(sessionSeconds), Modifier.weight(1f))
                                                CoachMetric("Planned", "${session.durationMinutes} min", Modifier.weight(1f))
                                            }
                                            HorizontalDivider(color = Color(0xFFE5E8F2))
                                            Text("CURRENT DRILL", color = Color(0xFF7B6AE5), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                            Text(activeDrill?.title ?: "No active drill", color = CoachInk, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                            Text(
                                                activeDrill?.let { "${it.plannedMinutes} min planned · ${formatCoachTime(activeDrillSeconds)} elapsed" }
                                                    ?: "Select a planned drill to begin.",
                                                color = CoachMuted,
                                                fontSize = 12.sp
                                            )
                                            if (activeDrill != null) {
                                                OutlinedButton(
                                                    onClick = onOpenDrillControls,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(if (paused || sessionPaused) "Resume drill" else "Drill controls")
                                                }
                                            } else {
                                                Button(
                                                    onClick = onOpenDrillControls,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) { Text("Choose a drill") }
                                            }
                                            OutlinedButton(
                                                onClick = if (sessionPaused) onResumeSession else onPauseSession,
                                                modifier = Modifier.fillMaxWidth(),
                                                enabled = !isSaving
                                            ) {
                                                Text(if (sessionPaused) "Resume session" else "Pause session")
                                            }
                                            Button(onClick = onEndSession, modifier = Modifier.fillMaxWidth()) { Text("End session") }
                                            if (isSaving) Text("Saving session…", color = CoachMuted, fontSize = 11.sp)
                                            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                                        }
                                    }
                                    CoachCard {
                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Text("Quick observation", color = CoachInk, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                            listOf(
                                                "Progress" to "PROGRESS",
                                                "Technique" to "TECHNIQUE",
                                                "Tactical" to "TACTICAL",
                                                "Safety" to "SAFETY"
                                            ).forEach { (label, category) ->
                                                OutlinedButton(
                                                    onClick = { onOpenObservation("SQUAD", category) },
                                                    modifier = Modifier.fillMaxWidth()
                                                ) { Text(label) }
                                            }
                                            OutlinedButton(
                                                onClick = { onOpenObservation("INDIVIDUAL", "TECHNIQUE") },
                                                modifier = Modifier.fillMaxWidth()
                                            ) { Text("Add individual observation") }
                                        }
                                    }
                                }
                            }
                            item {
                                CoachCard {
                                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text("Recent observations", modifier = Modifier.weight(1f), color = CoachInk, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                            TextButton(onClick = { onOpenObservation("SQUAD", "TECHNIQUE") }) { Text("Add") }
                                        }
                                        if (observationLoadError.isNotBlank()) {
                                            Text(observationLoadError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                                            TextButton(onClick = { coroutineScope.launch { onReloadObservations() } }) { Text("Retry") }
                                        } else if (observations.isEmpty()) {
                                            Text("No observations yet. Capture a coaching moment during the session.", color = CoachMuted, fontSize = 12.sp)
                                        } else {
                                            observations.take(4).forEach { observation ->
                                                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                                    Text(
                                                        "${observation.category.lowercase().replaceFirstChar(Char::uppercase)} · ${formatObservationClock(observation.createdAt)}",
                                                        color = Color(0xFF5943D6),
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                    Text(observation.text, color = Color(0xFF303A54), fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                                    Text(
                                                        listOfNotNull(observation.playerName, observation.drillTitle).joinToString(" · ")
                                                            .ifBlank { observation.scope.lowercase().replaceFirstChar(Char::uppercase) },
                                                        color = CoachMuted,
                                                        fontSize = 12.sp
                                                    )
                                                }
                                                if (observation != observations.take(4).last()) HorizontalDivider(color = Color(0xFFE5E8F2))
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
        }

            private val CoachInk = Color(0xFF151B35)
            private val CoachMuted = Color(0xFF69738A)

            @Composable
            private fun CoachCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
                Card(
                    modifier = modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.78f)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), content = { content() })
                }
            }

            @Composable
            private fun CoachMetric(label: String, value: String, modifier: Modifier = Modifier) {
                Surface(modifier, shape = RoundedCornerShape(13.dp), color = Color(0xFFF4F3FD)) {
                    Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(label, color = CoachMuted, fontSize = 12.sp)
                        Text(value, color = Color(0xFF202840), fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1)
                    }
                }
            }

            @Composable
            private fun CoachChip(label: String, selected: Boolean, onClick: () -> Unit) {
                Surface(
                    onClick = onClick,
                    shape = RoundedCornerShape(20.dp),
                    color = if (selected) Color(0xFFECE9FF) else Color(0xFFF6F7FB)
                ) {
                    Text(
                        label,
                        color = if (selected) Color(0xFF5943D6) else Color(0xFF59647A),
                        fontSize = 11.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 11.dp, vertical = 8.dp)
                    )
                }
            }

            private fun formatCoachTime(totalSeconds: Int): String {
                val safeSeconds = totalSeconds.coerceAtLeast(0)
                return "%02d:%02d".format(safeSeconds / 60, safeSeconds % 60)
            }

            private fun formatObservationClock(isoTime: String): String =
                runCatching {
                    java.time.format.DateTimeFormatter.ofPattern("HH:mm")
                        .withZone(java.time.ZoneId.systemDefault())
                        .format(Instant.parse(isoTime))
                }.getOrDefault("")

@Composable
private fun SessionLiveDashboardLayout(
    session: ClubTrainingSession,
    activeDrill: ExecutionDrill?,
    drillPosition: Int,
    drillCount: Int,
    activeDrillSeconds: Int,
    sessionSeconds: Int,
    sessionPaused: Boolean,
    observations: List<SessionObservation>,
    observationLoadError: String,
    isSaving: Boolean,
    saveError: String,
    onPauseSession: () -> Unit,
    onResumeSession: () -> Unit,
    onOpenObservation: (String, String) -> Unit,
    onOpenQuickNote: (String) -> Unit,
    onOpenDrillControls: () -> Unit,
    onEndSession: () -> Unit,
    onAddPlayer: () -> Unit,
    onOpenPreCheck: () -> Unit,
    onViewAllObservations: () -> Unit,
    onReloadObservations: suspend () -> Unit
) {
    val retryScope = rememberCoroutineScope()
    BoxWithConstraints(
        Modifier.fillMaxSize()
            .background(Color(0xFFF2F6FF))
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        val tabletLayout = maxWidth >= 600.dp
        if (tabletLayout) {
            Row(
                Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.Top
            ) {
                SessionLivePrimaryPane(
                    modifier = Modifier.weight(1.08f).fillMaxHeight(),
                    session = session,
                    activeDrill = activeDrill,
                    drillPosition = drillPosition,
                    drillCount = drillCount,
                    activeDrillSeconds = activeDrillSeconds,
                    sessionSeconds = sessionSeconds,
                    sessionPaused = sessionPaused,
                    isSaving = isSaving,
                    saveError = saveError,
                    onPauseSession = onPauseSession,
                    onResumeSession = onResumeSession,
                    onOpenObservation = onOpenObservation,
                    onOpenQuickNote = onOpenQuickNote,
                    onOpenDrillControls = onOpenDrillControls,
                    onEndSession = onEndSession
                )
                RecentObservationsPane(
                    modifier = Modifier.weight(0.92f).fillMaxHeight(),
                    observations = observations,
                    loadError = observationLoadError,
                    alignWithCurrentDrill = true,
                    onAddPlayer = onAddPlayer,
                    onOpenPreCheck = onOpenPreCheck,
                    onViewAll = onViewAllObservations,
                    onReload = { retryScope.launch { onReloadObservations() } }
                )
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 16.dp)
            ) {
                item {
                    SessionLivePrimaryPane(
                        modifier = Modifier.fillMaxWidth(),
                        session = session,
                        activeDrill = activeDrill,
                        drillPosition = drillPosition,
                        drillCount = drillCount,
                        activeDrillSeconds = activeDrillSeconds,
                        sessionSeconds = sessionSeconds,
                        sessionPaused = sessionPaused,
                        isSaving = isSaving,
                        saveError = saveError,
                        onPauseSession = onPauseSession,
                        onResumeSession = onResumeSession,
                        onOpenObservation = onOpenObservation,
                        onOpenQuickNote = onOpenQuickNote,
                        onOpenDrillControls = onOpenDrillControls,
                        onEndSession = onEndSession
                    )
                }
                item {
                    RecentObservationsPane(
                        modifier = Modifier.fillMaxWidth(),
                        observations = observations,
                        loadError = observationLoadError,
                        alignWithCurrentDrill = false,
                        onAddPlayer = onAddPlayer,
                        onOpenPreCheck = onOpenPreCheck,
                        onViewAll = onViewAllObservations,
                        onReload = { retryScope.launch { onReloadObservations() } }
                    )
                }
            }
        }
    }
}

@Composable
private fun SessionLivePrimaryPane(
    modifier: Modifier,
    session: ClubTrainingSession,
    activeDrill: ExecutionDrill?,
    drillPosition: Int,
    drillCount: Int,
    activeDrillSeconds: Int,
    sessionSeconds: Int,
    sessionPaused: Boolean,
    isSaving: Boolean,
    saveError: String,
    onPauseSession: () -> Unit,
    onResumeSession: () -> Unit,
    onOpenObservation: (String, String) -> Unit,
    onOpenQuickNote: (String) -> Unit,
    onOpenDrillControls: () -> Unit,
    onEndSession: () -> Unit
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Surface(
                        modifier = Modifier.size(7.dp),
                        shape = RoundedCornerShape(50),
                        color = if (sessionPaused) Color(0xFFE5A33C) else Color(0xFF23BC82)
                    ) {}
                    Text(
                        if (sessionPaused) "Session paused" else "Session in progress",
                        color = if (sessionPaused) Color(0xFF9D6A18) else Color(0xFF18875F),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(
                        formatElapsedClock(sessionSeconds),
                        color = Color(0xFF111A45),
                        fontSize = 31.sp,
                        lineHeight = 35.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "/ ${session.durationMinutes} min",
                        modifier = Modifier.padding(bottom = 3.dp),
                        color = Color(0xFF64708F),
                        fontSize = 15.sp
                    )
                }
            }
            Surface(
                onClick = if (sessionPaused) onResumeSession else onPauseSession,
                enabled = !isSaving,
                shape = RoundedCornerShape(50),
                color = if (sessionPaused) Color(0xFF19A66A) else Color(0xFF563DE1),
                shadowElevation = 3.dp
            ) {
                Row(
                    Modifier.height(60.dp).padding(horizontal = 26.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        if (sessionPaused) Icons.Outlined.PlayArrow else Icons.Outlined.Pause,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(30.dp)
                    )
                    Text(
                        if (sessionPaused) "Resume" else "Pause",
                        color = Color.White,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        ActiveDrillSummaryCard(
            drill = activeDrill,
            position = drillPosition,
            count = drillCount,
            elapsedSeconds = activeDrillSeconds,
            enabled = true,
            onOpen = onOpenDrillControls
        )

        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                QuickCaptureTile(
                    modifier = Modifier.weight(1f),
                    title = "Observation",
                    subtitle = "Player or group",
                    icon = Icons.Outlined.EditNote,
                    tint = Color(0xFF6848E8),
                    background = Color(0xFFF0ECFF)
                ) { onOpenObservation("GROUP", "TECHNIQUE") }
                QuickCaptureTile(
                    modifier = Modifier.weight(1f),
                    title = "Went well",
                    subtitle = "Quick note",
                    icon = Icons.Outlined.Star,
                    tint = Color(0xFF159B72),
                    background = Color(0xFFE9F8F1)
                ) { onOpenQuickNote("WENT_WELL") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                QuickCaptureTile(
                    modifier = Modifier.weight(1f),
                    title = "Disruption",
                    subtitle = "Quick note",
                    icon = Icons.Outlined.Warning,
                    tint = Color(0xFFE84A54),
                    background = Color(0xFFFFF0F0)
                ) { onOpenQuickNote("DISRUPTION") }
                QuickCaptureTile(
                    modifier = Modifier.weight(1f),
                    title = "Incident",
                    subtitle = "Injury, weather…",
                    icon = Icons.Outlined.HealthAndSafety,
                    tint = Color(0xFFE28A18),
                    background = Color(0xFFFFF6E6)
                ) { onOpenQuickNote("INCIDENT") }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            SessionOutlineAction(
                modifier = Modifier.weight(1f),
                label = "End session",
                icon = Icons.Outlined.Close,
                tint = Color(0xFFEF4854),
                onClick = onEndSession
            )
            SessionOutlineAction(
                modifier = Modifier.weight(1f),
                label = "Drill controls",
                icon = Icons.Outlined.List,
                tint = Color(0xFF644BE5),
                onClick = onOpenDrillControls
            )
        }
        if (isSaving) Text("Saving session…", color = CoachMuted, fontSize = 15.sp)
        if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
    }
}

private val LiveCurrentDrillCardHeight = 72.dp

@Composable
private fun ActiveDrillSummaryCard(
    drill: ExecutionDrill?,
    position: Int,
    count: Int,
    elapsedSeconds: Int,
    enabled: Boolean,
    onOpen: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().height(LiveCurrentDrillCardHeight),
        onClick = onOpen,
        enabled = enabled,
        shape = RoundedCornerShape(13.dp),
        color = Color.White.copy(alpha = 0.86f),
        border = BorderStroke(1.dp, Color(0xFFE2E8F7))
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(shape = RoundedCornerShape(8.dp), color = Color(0xFFF0ECFF)) {
                    Icon(
                        Icons.Outlined.List,
                        contentDescription = null,
                        tint = Color(0xFF6045E2),
                        modifier = Modifier.padding(9.dp).size(23.dp)
                    )
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        if (drill == null) "Current drill" else "Current drill $position / $count",
                        color = Color(0xFF64708F),
                        fontSize = 14.sp
                    )
                    Text(
                        drill?.title ?: "No active drill",
                        color = Color(0xFF17204A),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    drill?.let { "${formatCoachTime(elapsedSeconds)} / ${formatCoachTime(it.plannedMinutes * 60)}" } ?: "Choose",
                    color = Color(0xFF64708F),
                    fontSize = 14.sp
                )
                Icon(Icons.Outlined.PlayArrow, contentDescription = "Drill controls", tint = Color(0xFF3F4D7C), modifier = Modifier.size(22.dp))
            }
            val progress = if (drill == null || drill.plannedMinutes <= 0) 0f
            else (elapsedSeconds.toFloat() / (drill.plannedMinutes * 60)).coerceIn(0f, 1f)
            Box(
                Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(50)).background(Color(0xFFE4E9F5))
            ) {
                Box(Modifier.fillMaxWidth(progress).fillMaxHeight().background(Color(0xFF7E68F1)))
            }
        }
    }
}

@Composable
private fun DrillControlsTabletCard(
    activeDrill: ExecutionDrill?,
    activeDrillSeconds: Int,
    activeDrillBaseSeconds: Int,
    activeDrillStartedAt: String?,
    sessionDrills: List<Pair<Int, ExecutionDrill>>,
    paused: Boolean,
    drillNotes: String,
    isSaving: Boolean,
    saveError: String,
    onNotesChange: (String) -> Unit,
    onAdjust: (Int) -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onComplete: () -> Unit,
    onSelectNext: (ExecutionDrill) -> Unit,
    onReopen: (ExecutionDrill) -> Unit,
    onAddObservation: () -> Unit
) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        if (maxWidth >= 600.dp) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top
            ) {
                CurrentDrillControlPanel(
                    modifier = Modifier.weight(1.1f),
                    activeDrill = activeDrill,
                    activeDrillSeconds = activeDrillSeconds,
                    activeDrillBaseSeconds = activeDrillBaseSeconds,
                    activeDrillStartedAt = activeDrillStartedAt,
                    paused = paused,
                    drillNotes = drillNotes,
                    isSaving = isSaving,
                    saveError = saveError,
                    onNotesChange = onNotesChange,
                    onAdjust = onAdjust,
                    onPause = onPause,
                    onResume = onResume,
                    onComplete = onComplete,
                    onAddObservation = onAddObservation
                )
                NextDrillsPanel(
                    modifier = Modifier.weight(0.9f),
                    drills = sessionDrills,
                    activeDrillId = activeDrill?.id,
                    isSaving = isSaving,
                    onSelectNext = onSelectNext,
                    onReopen = onReopen
                )
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CurrentDrillControlPanel(
                    modifier = Modifier.fillMaxWidth(),
                    activeDrill = activeDrill,
                    activeDrillSeconds = activeDrillSeconds,
                    activeDrillBaseSeconds = activeDrillBaseSeconds,
                    activeDrillStartedAt = activeDrillStartedAt,
                    paused = paused,
                    drillNotes = drillNotes,
                    isSaving = isSaving,
                    saveError = saveError,
                    onNotesChange = onNotesChange,
                    onAdjust = onAdjust,
                    onPause = onPause,
                    onResume = onResume,
                    onComplete = onComplete,
                    onAddObservation = onAddObservation
                )
                NextDrillsPanel(
                    modifier = Modifier.fillMaxWidth(),
                    drills = sessionDrills,
                    activeDrillId = activeDrill?.id,
                    isSaving = isSaving,
                    onSelectNext = onSelectNext,
                    onReopen = onReopen
                )
            }
        }
    }
}

@Composable
private fun CurrentDrillControlPanel(
    modifier: Modifier,
    activeDrill: ExecutionDrill?,
    activeDrillSeconds: Int,
    activeDrillBaseSeconds: Int,
    activeDrillStartedAt: String?,
    paused: Boolean,
    drillNotes: String,
    isSaving: Boolean,
    saveError: String,
    onNotesChange: (String) -> Unit,
    onAdjust: (Int) -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onComplete: () -> Unit,
    onAddObservation: () -> Unit
) {
    val context = LocalContext.current
    var speechError by remember { mutableStateOf("") }
    var addedMinutes by remember(activeDrill?.id) { mutableIntStateOf(0) }
    var drillClockMillis by remember(activeDrill?.id) { mutableLongStateOf(System.currentTimeMillis()) }
    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spokenText = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
                ?.trim()
            if (!spokenText.isNullOrBlank()) {
                val combinedNotes = listOf(drillNotes.trim(), spokenText)
                    .filter(String::isNotBlank)
                    .joinToString(" ")
                onNotesChange(combinedNotes)
                speechError = ""
            } else {
                speechError = "No speech was recognized. Try again."
            }
        }
    }
    LaunchedEffect(activeDrill?.id, activeDrillStartedAt, paused) {
        if (activeDrill == null || activeDrillStartedAt == null || paused) return@LaunchedEffect
        while (true) {
            delay(1000)
            drillClockMillis = System.currentTimeMillis()
        }
    }
    val drillElapsedForDisplay = when {
        activeDrill == null -> 0
        paused || activeDrillStartedAt == null -> activeDrillSeconds
        else -> activeDrillBaseSeconds + runCatching {
            ((drillClockMillis - Instant.parse(activeDrillStartedAt).toEpochMilli())
                .coerceAtLeast(0L) / 1000L)
                .coerceAtMost(Int.MAX_VALUE.toLong())
                .toInt()
        }.getOrDefault(0)
    }
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = Color.Transparent,
        border = BorderStroke(1.dp, Color(0xFFE2E8F7))
    ) {
        Column(
            Modifier.fillMaxWidth().padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    activeDrill?.title ?: "All planned drills complete",
                    modifier = Modifier.weight(1f),
                    color = Color(0xFF17204A),
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (activeDrill != null) {
                    val plannedSeconds = (activeDrill.plannedMinutes * 60).coerceAtLeast(1)
                    val remainingSeconds = (plannedSeconds - drillElapsedForDisplay).coerceAtLeast(0)
                    Column(
                        modifier = Modifier.padding(start = 8.dp),
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(1.dp)
                    ) {
                        Text(
                            formatCoachTime(remainingSeconds),
                            color = Color(0xFF263B75),
                            fontSize = 21.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text("remaining", color = Color(0xFF66728F), fontSize = 15.sp)
                    }
                }
            }
            if (activeDrill != null) {
                val plannedSeconds = (activeDrill.plannedMinutes * 60).coerceAtLeast(1)
                val remainingSeconds = (plannedSeconds - drillElapsedForDisplay).coerceAtLeast(0)
                val progress = remainingSeconds.toFloat() / plannedSeconds
                Box(
                    Modifier.fillMaxWidth().height(4.dp)
                        .clip(RoundedCornerShape(50))
                        .background(Color(0xFFE3E8F5))
                ) {
                    Box(
                        Modifier.fillMaxWidth(progress).fillMaxHeight()
                            .background(Color(0xFF684BFA))
                    )
                }
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DrillTabletAction(
                        modifier = Modifier.weight(1f),
                        label = if (paused) "Resume" else "Pause",
                        icon = if (paused) Icons.Outlined.PlayArrow else Icons.Outlined.Pause,
                        color = Color(0xFFEEEAFE),
                        tint = Color(0xFF644BEA),
                        enabled = !isSaving,
                        onClick = if (paused) onResume else onPause
                    )
                    DrillTabletAction(
                        modifier = Modifier.weight(1f),
                        label = "Complete",
                        icon = Icons.Outlined.CheckCircle,
                        color = Color(0xFFE2F5ED),
                        tint = Color(0xFF159B72),
                        enabled = !isSaving,
                        onClick = onComplete
                    )
                    DrillTabletAction(
                        modifier = Modifier.weight(1f),
                        label = "Observation",
                        icon = Icons.Outlined.Add,
                        color = Color(0xFFEAF1FF),
                        tint = Color(0xFF2F6FE4),
                        enabled = true,
                        onClick = onAddObservation
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Add minutes",
                        modifier = Modifier.weight(1f),
                        color = Color(0xFF27365F),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        if (addedMinutes == 0) "1–20 min" else "+$addedMinutes min",
                        color = Color(0xFF644BEA),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Slider(
                    value = addedMinutes.toFloat(),
                    onValueChange = { rawValue ->
                        val newValue = rawValue.roundToInt().coerceIn(0, 20)
                        val difference = newValue - addedMinutes
                        if (difference != 0) {
                            onAdjust(difference)
                            addedMinutes = newValue
                        }
                    },
                    valueRange = 0f..20f,
                    steps = 19,
                    enabled = !isSaving,
                    modifier = Modifier.fillMaxWidth().height(30.dp)
                )
                OutlinedTextField(
                    value = drillNotes,
                    onValueChange = {
                        speechError = ""
                        onNotesChange(it)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(9.dp),
                    minLines = 1,
                    maxLines = 2,
                    label = { Text("Drill notes", fontSize = 17.sp) },
                    placeholder = { Text("Add notes about this drill", fontSize = 16.sp) },
                    trailingIcon = {
                        IconButton(onClick = {
                            speechError = ""
                            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                putExtra(
                                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                                )
                                putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your drill notes")
                            }
                            try {
                                speechLauncher.launch(intent)
                            } catch (_: ActivityNotFoundException) {
                                speechError = "Speech recognition is not available on this device."
                            }
                        }) {
                            Icon(Icons.Outlined.Mic, contentDescription = "Speak drill notes")
                        }
                    },
                    textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 17.sp)
                )
                if (speechError.isNotBlank()) {
                    Text(speechError, color = MaterialTheme.colorScheme.error, fontSize = 16.sp)
                }
            }
            if (isSaving) Text("Saving…", color = CoachMuted, fontSize = 15.sp)
            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 16.sp)
        }
    }
}

@Composable
private fun NextDrillsPanel(
    modifier: Modifier,
    drills: List<Pair<Int, ExecutionDrill>>,
    activeDrillId: String?,
    isSaving: Boolean,
    onSelectNext: (ExecutionDrill) -> Unit,
    onReopen: (ExecutionDrill) -> Unit
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = Color.Transparent,
        border = BorderStroke(1.dp, Color(0xFFE2E8F7))
    ) {
        Column(
            Modifier.fillMaxWidth().padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("Session drills (${drills.size})", color = Color(0xFF53617F), fontSize = 19.sp, fontWeight = FontWeight.Bold)
            if (drills.isEmpty()) {
                Text("No drills planned for this session", color = Color(0xFF74809A), fontSize = 17.sp)
            } else {
                drills.forEach { (number, drill) ->
                    val isCurrent = drill.id == activeDrillId
                    val canStart = !drill.completed && !isCurrent
                    var holding by remember(drill.id) { mutableStateOf(false) }
                    val currentDrill by rememberUpdatedState(drill)
                    val currentOnReopen by rememberUpdatedState(onReopen)
                    val holdScope = rememberCoroutineScope()
                    val holdProgress by animateFloatAsState(
                        targetValue = if (holding) 1f else 0f,
                        animationSpec = tween(durationMillis = if (holding) ReopenHoldMillis.toInt() else 150, easing = LinearEasing),
                        label = "reopenHold"
                    )
                    val rowModifier = if (drill.completed) {
                        Modifier
                            .clip(RoundedCornerShape(9.dp))
                            .pointerInput(drill.id, isSaving) {
                                if (isSaving) return@pointerInput
                                detectTapGestures(onPress = {
                                    holding = true
                                    val timer = holdScope.launch {
                                        delay(ReopenHoldMillis)
                                        holding = false
                                        currentOnReopen(currentDrill)
                                    }
                                    tryAwaitRelease()
                                    timer.cancel()
                                    holding = false
                                })
                            }
                    } else Modifier
                    val rowContent: @Composable () -> Unit = {
                        Box {
                        if (holdProgress > 0f) {
                            Box(
                                Modifier.matchParentSize().drawBehind {
                                    drawRect(Color(0xFFEDE9FF), size = size.copy(width = size.width * holdProgress))
                                }
                            )
                        }
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            Surface(shape = RoundedCornerShape(50), color = Color(0xFFE8E7FF)) {
                                Box(Modifier.size(26.dp), contentAlignment = Alignment.Center) {
                                    Text("$number", color = Color(0xFF5342D2), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                Text(
                                    drill.title,
                                    color = Color(0xFF26324F),
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                val drillStatus = when {
                                    isCurrent -> "Current drill"
                                    holding -> "Keep holding to reopen…"
                                    drill.completed -> "Completed · hold 3s to reopen"
                                    else -> "${drill.plannedMinutes} min"
                                }
                                Text(
                                    drillStatus,
                                    color = if (drill.completed) Color(0xFF25835D) else Color(0xFF74809A),
                                    fontSize = 15.sp
                                )
                            }
                            when {
                                drill.completed -> Icon(
                                    Icons.Outlined.CheckCircle,
                                    contentDescription = "Completed",
                                    tint = Color(0xFF25835D),
                                    modifier = Modifier.size(20.dp)
                                )
                                isCurrent -> Text("Now", color = Color(0xFF644BEA), fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                else -> Icon(
                                    Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                                    contentDescription = "Start ${drill.title}",
                                    tint = Color(0xFF263B75),
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        }
                    }
                    val rowBorder = BorderStroke(1.dp, if (holding) Color(0xFF644BEA) else Color(0xFFE8ECF6))
                    if (canStart) {
                        Surface(
                            onClick = { onSelectNext(drill) },
                            enabled = !isSaving,
                            shape = RoundedCornerShape(9.dp),
                            color = Color.Transparent,
                            border = rowBorder,
                            content = rowContent
                        )
                    } else {
                        Surface(
                            modifier = rowModifier,
                            shape = RoundedCornerShape(9.dp),
                            color = Color.Transparent,
                            border = rowBorder,
                            content = rowContent
                        )
                    }
                }
            }
        }
    }
}

private const val ReopenHoldMillis = 3000L

@Composable
private fun DrillTabletAction(
    modifier: Modifier,
    label: String,
    color: Color,
    tint: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    height: androidx.compose.ui.unit.Dp = 60.dp,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(height),
        shape = RoundedCornerShape(10.dp),
        color = color
    ) {
        Row(
            Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(7.dp))
            }
            Text(label, color = tint, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun QuickCaptureTile(
    modifier: Modifier,
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: Color,
    background: Color,
    height: androidx.compose.ui.unit.Dp = 68.dp,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier.height(height),
        shape = RoundedCornerShape(14.dp),
        color = background.copy(alpha = 0.92f),
        border = BorderStroke(1.dp, tint.copy(alpha = 0.08f))
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(24.dp))
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(title, color = tint, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(subtitle, color = Color(0xFF72809E), fontSize = 14.sp, maxLines = 1)
            }
        }
    }
}

@Composable
private fun SessionOutlineAction(
    modifier: Modifier,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: Color,
    onClick: () -> Unit,
    enabled: Boolean = true
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, tint.copy(alpha = 0.7f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = tint),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun RecentObservationsPane(
    modifier: Modifier,
    observations: List<SessionObservation>,
    loadError: String,
    alignWithCurrentDrill: Boolean,
    onAddPlayer: () -> Unit,
    onOpenPreCheck: () -> Unit,
    onViewAll: () -> Unit,
    onReload: () -> Unit
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        if (alignWithCurrentDrill) Spacer(Modifier.height(60.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            QuickCaptureTile(
                modifier = Modifier.weight(1f),
                title = "Add player",
                subtitle = "Walk-in participant",
                icon = Icons.Outlined.Groups,
                tint = Color(0xFF6848E8),
                background = Color(0xFFF0ECFF),
                height = LiveCurrentDrillCardHeight,
                onClick = onAddPlayer
            )
            QuickCaptureTile(
                modifier = Modifier.weight(1f),
                title = "Pre-check",
                subtitle = "Checklist & attendance",
                icon = Icons.Outlined.CheckCircle,
                tint = Color(0xFF2589F3),
                background = Color(0xFFEAF3FF),
                height = LiveCurrentDrillCardHeight,
                onClick = onOpenPreCheck
            )
        }
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.86f),
            border = BorderStroke(1.dp, Color(0xFFE2E8F7))
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Recent observations",
                    modifier = Modifier.weight(1f),
                    color = Color(0xFF18204A),
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = onViewAll) {
                    Text("View all ›", color = Color(0xFF6349E8), fontSize = 15.sp)
                }
            }
            if (loadError.isNotBlank()) {
                Text(loadError, color = MaterialTheme.colorScheme.error, fontSize = 16.sp)
                TextButton(onClick = onReload) { Text("Retry", fontSize = 16.sp) }
            } else if (observations.isEmpty()) {
                Text("No observations yet.", color = CoachMuted, fontSize = 16.sp)
            } else {
                observations.take(3).forEachIndexed { index, observation ->
                    ObservationListRow(observation)
                    if (index < minOf(observations.size, 3) - 1) HorizontalDivider(color = Color(0xFFE8ECF6))
                }
            }
        }
    }
}
}

@Composable
private fun AllSessionObservationsCard(
    observations: List<SessionObservation>,
    loadError: String,
    onReload: () -> Unit
) {
    Column(Modifier.padding(horizontal = 4.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("All observations", color = CoachInk, fontSize = 21.sp, fontWeight = FontWeight.Bold)
            if (loadError.isNotBlank()) {
                Text(loadError, color = MaterialTheme.colorScheme.error, fontSize = 15.sp)
                TextButton(onClick = onReload) { Text("Retry") }
            } else if (observations.isEmpty()) {
                Text("No observations recorded for this session.", color = CoachMuted, fontSize = 15.sp)
            } else {
                observations.forEachIndexed { index, observation ->
                    ObservationListRow(observation)
                    if (index < observations.lastIndex) HorizontalDivider(color = Color(0xFFE8ECF6))
                }
            }
        }
    }
}

@Composable
private fun ObservationListRow(observation: SessionObservation) {
    val initials = observation.playerName
        ?.split(Regex("\\s+"))
        ?.filter(String::isNotBlank)
        ?.take(2)
        ?.mapNotNull { it.firstOrNull()?.uppercaseChar() }
        ?.joinToString("")
        ?.ifBlank { null }
        ?: observation.scope.take(2)
    val avatarColor = when (observation.category) {
        "PROGRESS" -> Color(0xFFE1F5E9)
        "PHYSICAL" -> Color(0xFFFFE9D9)
        "SAFETY" -> Color(0xFFFFE2E4)
        else -> Color(0xFFE5EFFF)
    }
    val categoryColor = when (observation.category) {
        "PROGRESS" -> Color(0xFF12885F)
        "PHYSICAL" -> Color(0xFFB76B25)
        "SAFETY" -> Color(0xFFD33E4D)
        else -> Color(0xFF5C47CF)
    }
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(formatObservationClock(observation.createdAt), color = Color(0xFF8791A8), fontSize = 14.sp, modifier = Modifier.padding(top = 5.dp))
        Surface(shape = RoundedCornerShape(50), color = avatarColor, modifier = Modifier.size(30.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Text(initials, color = categoryColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(20.dp), color = categoryColor.copy(alpha = 0.1f)) {
                    Text(
                        observation.category.lowercase().replaceFirstChar(Char::uppercase),
                        color = categoryColor,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                    )
                }
                observation.drillTitle?.takeIf(String::isNotBlank)?.let { drill ->
                    Surface(shape = RoundedCornerShape(20.dp), color = Color(0xFFF1F3F8)) {
                        Text(
                            drill,
                            color = Color(0xFF52607F),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                        )
                    }
                }
            }
            Text(
                observation.text,
                color = Color(0xFF52607F),
                fontSize = 15.sp,
                lineHeight = 19.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
        Icon(Icons.Outlined.MoreVert, contentDescription = "Observation options", tint = Color(0xFF7E89A2), modifier = Modifier.size(18.dp).padding(top = 3.dp))
    }
}

@Composable
private fun QuickNotePanel(
    kind: String,
    text: String,
    saving: Boolean,
    saveError: String,
    drillTitle: String?,
    onTextChange: (String) -> Unit,
    onClose: () -> Unit
) {
    data class NoteStyle(val title: String, val prompt: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val tint: Color, val background: Color)
    val style = when (kind) {
        "DISRUPTION" -> NoteStyle("Disruption", "What disrupted this session?", Icons.Outlined.Warning, Color(0xFFE84A54), Color(0xFFFFF0F0))
        "ADJUSTMENT" -> NoteStyle("Adjustment", "What would you change next time?", Icons.Outlined.Lightbulb, Color(0xFFE28A18), Color(0xFFFFF6E6))
        else -> NoteStyle("Went well", "What worked well in this session?", Icons.Outlined.Star, Color(0xFF159B72), Color(0xFFE9F8F1))
    }
    val currentText by rememberUpdatedState(text)
    var speechError by remember { mutableStateOf("") }
    val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
            if (!spoken.isNullOrBlank()) {
                onTextChange(listOf(currentText.trim(), spoken).filter(String::isNotBlank).joinToString("\n"))
                speechError = ""
            } else speechError = "No speech was recognized. Try again."
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White.copy(alpha = 0.92f),
        border = BorderStroke(1.dp, Color(0xFFE6E9F4))
    ) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Surface(shape = RoundedCornerShape(12.dp), color = style.background) {
                    Icon(style.icon, contentDescription = null, tint = style.tint, modifier = Modifier.padding(10.dp).size(26.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(style.title, color = style.tint, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    Text(
                        drillTitle?.let { "${style.prompt}  ·  $it" } ?: style.prompt,
                        color = CoachMuted,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Outlined.Close, contentDescription = "Close ${style.title} note", tint = CoachInk, modifier = Modifier.size(24.dp))
                }
            }
            OutlinedTextField(
                value = text,
                onValueChange = onTextChange,
                modifier = Modifier.fillMaxWidth(),
                minLines = 6,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp, color = CoachInk),
                placeholder = { Text(style.prompt, fontSize = 17.sp) },
                trailingIcon = {
                    IconButton(onClick = {
                        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your ${style.title.lowercase()} note")
                        }
                        try {
                            speechLauncher.launch(intent)
                        } catch (_: ActivityNotFoundException) {
                            speechError = "Speech recognition is not available on this device."
                        }
                    }) {
                        Icon(Icons.Outlined.Mic, contentDescription = "Speak ${style.title} note", tint = style.tint)
                    }
                }
            )
            if (speechError.isNotBlank()) Text(speechError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
            when {
                saveError.isNotBlank() -> Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
                saving -> Text("Saving…", color = CoachMuted, fontSize = 14.sp)
                text.isNotBlank() -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = Color(0xFF19A66A), modifier = Modifier.size(20.dp))
                    Text("Saved automatically", color = Color(0xFF4F5B78), fontSize = 14.sp)
                }
                else -> Text("Notes save automatically as you type.", color = CoachMuted, fontSize = 14.sp)
            }
        }
    }
}

private val IncidentCategories = listOf("Injury", "Weather", "Equipment", "Behaviour", "Facility", "Other")

@Composable
private fun IncidentEntryPanel(
    incidents: List<ExecutionIncident>,
    saving: Boolean,
    saveError: String,
    drillTitle: String?,
    onAdd: (String, String) -> Unit,
    onRemove: (ExecutionIncident) -> Unit,
    onClose: () -> Unit
) {
    val tint = Color(0xFFE28A18)
    var category by remember { mutableStateOf("Injury") }
    var note by remember { mutableStateOf("") }
    val currentNote by rememberUpdatedState(note)
    var speechError by remember { mutableStateOf("") }
    val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim()
            if (!spoken.isNullOrBlank()) {
                note = listOf(currentNote.trim(), spoken).filter(String::isNotBlank).joinToString(" ")
                speechError = ""
            } else speechError = "No speech was recognized. Try again."
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White.copy(alpha = 0.92f),
        border = BorderStroke(1.dp, Color(0xFFE6E9F4))
    ) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFFFFF6E6)) {
                    Icon(Icons.Outlined.HealthAndSafety, contentDescription = null, tint = tint, modifier = Modifier.padding(10.dp).size(26.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text("Incident", color = tint, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    Text(
                        drillTitle?.let { "What happened?  ·  $it" } ?: "What happened?",
                        color = CoachMuted,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Outlined.Close, contentDescription = "Close incident", tint = CoachInk, modifier = Modifier.size(24.dp))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                IncidentCategories.forEach { option ->
                    val selected = option == category
                    Text(
                        option,
                        color = if (selected) Color.White else CoachInk,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (selected) tint else Color(0xFFF3F5FA))
                            .clickable { category = option }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    )
                }
            }
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp, color = CoachInk),
                placeholder = { Text("Describe the incident", fontSize = 17.sp) },
                trailingIcon = {
                    IconButton(onClick = {
                        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                            putExtra(RecognizerIntent.EXTRA_PROMPT, "Describe the incident")
                        }
                        try {
                            speechLauncher.launch(intent)
                        } catch (_: ActivityNotFoundException) {
                            speechError = "Speech recognition is not available on this device."
                        }
                    }) {
                        Icon(Icons.Outlined.Mic, contentDescription = "Speak incident", tint = tint)
                    }
                }
            )
            if (speechError.isNotBlank()) Text(speechError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    when {
                        saveError.isNotBlank() -> Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
                        saving -> Text("Saving…", color = CoachMuted, fontSize = 14.sp)
                        incidents.isNotEmpty() -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = Color(0xFF19A66A), modifier = Modifier.size(20.dp))
                            Text("Saved automatically", color = Color(0xFF4F5B78), fontSize = 14.sp)
                        }
                    }
                }
                Button(
                    onClick = {
                        onAdd(category, note)
                        note = ""
                    },
                    enabled = note.isNotBlank(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = tint)
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Log incident", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            if (incidents.isNotEmpty()) {
                HorizontalDivider(color = Color(0xFFE8ECF6))
                Text("Logged this session", color = CoachInk, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                incidents.asReversed().forEach { incident ->
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(formatObservationClock(incident.time), color = Color(0xFF8791A8), fontSize = 14.sp, modifier = Modifier.padding(top = 4.dp))
                        Text(
                            incident.category,
                            color = tint,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(tint.copy(alpha = 0.1f))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                        Text(incident.note, color = Color(0xFF52607F), fontSize = 15.sp, modifier = Modifier.weight(1f).padding(top = 3.dp))
                        Icon(
                            Icons.Outlined.Delete,
                            contentDescription = "Remove incident",
                            tint = Color(0xFF7E89A2),
                            modifier = Modifier.size(22.dp).clickable { onRemove(incident) }
                        )
                    }
                }
            }
        }
    }
}

private val ObservationTypes = listOf(
    Triple("TECHNIQUE", "Technique", Icons.Outlined.SportsCricket),
    Triple("TACTICAL", "Tactical", Icons.Outlined.Insights),
    Triple("PHYSICAL", "Physical", Icons.Outlined.FitnessCenter),
    Triple("BEHAVIOUR", "Behaviour", Icons.Outlined.EmojiPeople),
    Triple("PROGRESS", "Progress", Icons.Outlined.TrendingUp),
    Triple("SAFETY", "Safety", Icons.Outlined.HealthAndSafety)
)

private const val ObservationListenSeconds = 30

@Composable
private fun ObservationEntryPanel(
    players: List<ClubMember>,
    observationScope: String,
    observationCategory: String,
    observationPlayerId: String?,
    observationText: String,
    observationSaving: Boolean,
    observationError: String,
    observationSavedAt: String,
    activeDrillTitle: String?,
    onClose: () -> Unit,
    onScopeChange: (String) -> Unit,
    onCategoryChange: (String) -> Unit,
    onPlayerChange: (String?) -> Unit,
    onTextChange: (String) -> Unit,
    onRetry: () -> Unit
) {
    val accent = Color(0xFF5B3FE4)
    val divider = Color(0xFFE6E9F4)
    val fallbackScope = remember { if (observationScope == "INDIVIDUAL") "SQUAD" else observationScope }
    val context = LocalContext.current
    val currentText by rememberUpdatedState(observationText)
    val currentOnTextChange by rememberUpdatedState(onTextChange)
    var listening by remember { mutableStateOf(false) }
    var remainingSeconds by remember { mutableIntStateOf(ObservationListenSeconds) }
    var speechLevel by remember { mutableStateOf(0f) }
    var speechError by remember { mutableStateOf("") }
    var dictationBase by remember { mutableStateOf("") }
    val recognizer = remember {
        if (SpeechRecognizer.isRecognitionAvailable(context)) SpeechRecognizer.createSpeechRecognizer(context) else null
    }
    val recognizerIntent = remember {
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
    }
    fun joinDictation(base: String, spoken: String) =
        listOf(base.trim(), spoken.trim()).filter(String::isNotBlank).joinToString(" ")

    fun startListening() {
        if (recognizer == null) {
            speechError = "Speech recognition is not available on this device."
            return
        }
        speechError = ""
        dictationBase = currentText
        remainingSeconds = ObservationListenSeconds
        listening = true
        recognizer.startListening(recognizerIntent)
    }

    fun stopListening() {
        listening = false
        speechLevel = 0f
        recognizer?.stopListening()
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startListening() else speechError = "Microphone permission is needed for voice notes."
    }

    DisposableEffect(recognizer) {
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {
                speechLevel = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
            }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) {
                if (!listening) return
                val recoverable = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                if (recoverable && remainingSeconds > 0) {
                    recognizer.startListening(recognizerIntent)
                } else {
                    listening = false
                    speechLevel = 0f
                    if (!recoverable) speechError = "Voice input stopped. Tap to try again."
                }
            }
            override fun onResults(results: Bundle?) {
                val spoken = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                dictationBase = joinDictation(dictationBase, spoken)
                currentOnTextChange(dictationBase)
                if (listening && remainingSeconds > 0) recognizer.startListening(recognizerIntent)
                else {
                    listening = false
                    speechLevel = 0f
                }
            }
            override fun onPartialResults(partialResults: Bundle?) {
                val partial = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                if (partial.isNotBlank()) currentOnTextChange(joinDictation(dictationBase, partial))
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        onDispose { recognizer?.destroy() }
    }

    LaunchedEffect(listening) {
        while (listening && remainingSeconds > 0) {
            delay(1000)
            remainingSeconds--
        }
        if (listening) stopListening()
    }

    fun toggleListening() {
        if (listening) {
            stopListening()
        } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startListening()
        } else {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White.copy(alpha = 0.92f),
        border = BorderStroke(1.dp, divider)
    ) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val isTablet = maxWidth >= 600.dp
            val playersList: @Composable (Modifier) -> Unit = { modifier ->
                Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Players", color = CoachInk, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
                    if (players.isEmpty()) {
                        Text("No players are assigned to this session.", color = CoachMuted, fontSize = 14.sp)
                    }
                    players.forEach { player ->
                        val selected = observationScope == "INDIVIDUAL" && observationPlayerId == player.id
                        Surface(
                            onClick = {
                                if (selected) {
                                    onPlayerChange(null)
                                    onScopeChange(fallbackScope)
                                } else {
                                    onScopeChange("INDIVIDUAL")
                                    onPlayerChange(player.id)
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            color = if (selected) Color(0xFFEEEBFF) else Color.Transparent
                        ) {
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                val initials = player.name.split(Regex("\\s+")).filter(String::isNotBlank).take(2)
                                    .mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("")
                                Surface(shape = RoundedCornerShape(50), color = Color(0xFFE5EFFF), modifier = Modifier.size(38.dp)) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(initials, color = Color(0xFF3F5BA8), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    }
                                }
                                Text(
                                    player.name,
                                    color = if (selected) accent else CoachInk,
                                    fontSize = 15.sp,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
            val entryColumn: @Composable (Modifier) -> Unit = { modifier ->
                Column(modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Observation type", modifier = Modifier.weight(1f), color = CoachInk, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        IconButton(onClick = {
                            if (listening) stopListening()
                            onClose()
                        }) {
                            Icon(Icons.Outlined.Close, contentDescription = "Close observation", tint = CoachInk, modifier = Modifier.size(24.dp))
                        }
                    }
                    ObservationTypes.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            row.forEach { (value, label, icon) ->
                                val selected = observationCategory == value
                                Surface(
                                    onClick = { onCategoryChange(value) },
                                    modifier = Modifier.weight(1f).height(48.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (selected) accent else Color.White,
                                    border = BorderStroke(1.dp, if (selected) accent else divider)
                                ) {
                                    Row(
                                        Modifier.fillMaxSize().padding(horizontal = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(icon, contentDescription = null, tint = if (selected) Color.White else Color(0xFF59647A), modifier = Modifier.size(20.dp))
                                        Text(
                                            label,
                                            color = if (selected) Color.White else Color(0xFF3B4560),
                                            fontSize = 15.sp,
                                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Surface(
                        onClick = { toggleListening() },
                        modifier = Modifier.fillMaxWidth().height(150.dp),
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFF4F2FE)
                    ) {
                        Box(Modifier.fillMaxSize()) {
                            Text(
                                "%d:%02d".format(remainingSeconds / 60, remainingSeconds % 60),
                                modifier = Modifier.align(Alignment.TopEnd).padding(12.dp),
                                color = CoachMuted,
                                fontSize = 14.sp
                            )
                            Column(
                                Modifier.align(Alignment.Center),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                if (listening) {
                                    ObservationWaveform(level = speechLevel, color = accent)
                                } else {
                                    Icon(Icons.Outlined.Mic, contentDescription = null, tint = accent, modifier = Modifier.size(40.dp))
                                }
                                Text(
                                    if (listening) "Listening…" else "Tap to speak",
                                    color = accent,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                    if (speechError.isNotBlank()) Text(speechError, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    OutlinedTextField(
                        value = observationText,
                        onValueChange = onTextChange,
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        shape = RoundedCornerShape(12.dp),
                        textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.sp, color = CoachInk),
                        placeholder = { Text("What did you notice?", fontSize = 16.sp) }
                    )
                    when {
                        observationScope == "INDIVIDUAL" && observationPlayerId == null ->
                            Text("Choose a player to save this observation.", color = CoachMuted, fontSize = 14.sp)
                        observationSaving -> Text("Saving…", color = CoachMuted, fontSize = 14.sp)
                        observationError.isNotBlank() -> Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(observationError, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
                            TextButton(onClick = onRetry) { Text("Retry", fontSize = 14.sp) }
                        }
                        observationSavedAt.isNotBlank() -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = Color(0xFF19A66A), modifier = Modifier.size(20.dp))
                            Text(
                                listOfNotNull("Saved", formatObservationClock(observationSavedAt).ifBlank { null }, activeDrillTitle).joinToString("  ·  "),
                                color = Color(0xFF4F5B78),
                                fontSize = 14.sp
                            )
                        }
                        observationText.isNotBlank() -> Text("Saving automatically…", color = CoachMuted, fontSize = 14.sp)
                    }
                }
            }
            if (isTablet) {
                Row(Modifier.fillMaxWidth().padding(vertical = 16.dp)) {
                    playersList(Modifier.weight(0.34f).padding(horizontal = 14.dp))
                    entryColumn(
                        Modifier.weight(0.66f)
                            .drawBehind {
                                drawLine(divider, Offset(0f, 0f), Offset(0f, size.height), strokeWidth = 1.dp.toPx())
                            }
                            .padding(horizontal = 18.dp)
                    )
                }
            } else {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    entryColumn(Modifier.fillMaxWidth())
                    HorizontalDivider(color = divider)
                    playersList(Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun ObservationWaveform(level: Float, color: Color) {
    val pattern = listOf(0.35f, 0.6f, 0.85f, 1f, 0.7f, 0.95f, 0.55f, 0.8f, 0.4f)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        pattern.forEach { factor ->
            Box(
                Modifier
                    .width(5.dp)
                    .height((10f + 34f * factor * (0.35f + 0.65f * level)).dp)
                    .clip(RoundedCornerShape(50))
                    .background(color)
            )
        }
    }
}

private fun formatElapsedClock(totalSeconds: Int): String {
    val safeSeconds = totalSeconds.coerceAtLeast(0)
    val hours = safeSeconds / 3600
    val minutes = (safeSeconds % 3600) / 60
    val seconds = safeSeconds % 60
    return "%02d:%02d:%02d".format(hours, minutes, seconds)
}
