package com.ecricketcoach.mobile

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
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
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.List
import androidx.compose.material.icons.outlined.Pause
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.EditNote
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

private val PreparationChecklist = listOf(
    "plan" to "Review objectives, session plan and drill order",
    "equipment" to "Prepare balls, bats, stumps, cones and nets",
    "safety" to "Check protective equipment and safety requirements",
    "firstAid" to "Confirm first-aid kit and emergency information",
    "facility" to "Confirm facility booking and playing-surface condition",
    "staff" to "Brief assistant coaches and assign groups",
    "weather" to "Check weather and agree an indoor/backup plan"
)

internal val LiveSessionLightColors = lightColorScheme(
    primary = Color(0xFF5134D8),
    onPrimary = Color.White,
    secondary = Color(0xFF2589F3),
    background = Color(0xFFF3F5FD),
    surface = Color.White.copy(alpha = 0.8f),
    surfaceVariant = Color(0xFFF0EEFF),
    onSurface = Color(0xFF151B35),
    onSurfaceVariant = Color(0xFF5B6782),
    outline = Color(0xFFDDE2F1),
    outlineVariant = Color(0xFFE8EAF3),
    error = Color(0xFFD94A66)
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
    if (log != null) return (0 until log.length()).map { index ->
        val row = log.getJSONObject(index)
        ExecutionDrill(
            id = row.optString("id").ifBlank { UUID.randomUUID().toString() },
            drillId = row.optString("drillId").takeIf { it.isNotBlank() && it != "null" },
            title = row.optString("title", "Session drill"),
            plannedMinutes = row.optInt("plannedMinutes", 15),
            actualMinutes = row.optInt("actualMinutes"),
            completed = row.optBoolean("completed"),
            notes = row.optString("notes")
        )
    }
    val entries = session.drillIds.mapNotNull { id ->
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
    return entries + ExecutionDrill(UUID.randomUUID().toString(), null, "Cool-down and debrief", 5, 0, false, "")
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
    onAddObservation: suspend (SessionObservationDraft) -> SessionObservation = { throw IllegalStateException("Observation service is unavailable.") }
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
            PreparationChecklist.forEach { (key, _) -> put(key, values.optBoolean(key)) }
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
    var challenges by remember(session.id) { mutableStateOf(evaluation.optString("challenges")) }
    var nextAdjustments by remember(session.id) { mutableStateOf(evaluation.optString("nextAdjustments")) }
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
                .put("challenges", challenges)
                .put("nextAdjustments", nextAdjustments))
        return log
    }

    fun saveProgress() {
        onSave(payload(false), JSONObject().also { notes ->
            playerNotes.forEach { (id, note) -> if (note.isNotBlank()) notes.put(id, note) }
        }, postNotes, false)
    }

    LaunchedEffect(status, attendanceSaveRequested, attendance.toMap()) {
        if (status != "PREPARING" || !attendanceSaveRequested) return@LaunchedEffect
        delay(350)
        attendanceSaveRequested = false
        saveProgress()
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
        activeDrillElapsedSeconds = activeDrillElapsed()
        activeDrillPaused = true
        activeDrillStartedAt = null
        saveProgress()
    }

    fun resumeActiveDrill() {
        activeDrillStartedAt = Instant.now().toString()
        activeDrillPaused = false
        saveProgress()
    }

    fun startDrill(drill: ExecutionDrill) {
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

    fun completeActiveDrill() {
        val currentId = activeDrillId ?: return
        val elapsedMinutes = (activeDrillElapsed() + 59) / 60
        drillRows = drillRows.map { drill ->
            if (drill.id == currentId) drill.copy(actualMinutes = elapsedMinutes.coerceIn(1, 600), completed = true) else drill
        }
        val next = drillRows.firstOrNull { !it.completed }
        activeDrillId = next?.id
        activeDrillElapsedSeconds = 0
        activeDrillPaused = false
        activeDrillStartedAt = if (next == null) null else Instant.now().toString()
        onCoachPageChange("LIVE")
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
                "Player progress notes",
                assignedPlayers.mapNotNull { player ->
                    playerNotes[player.id]?.trim()?.takeIf(String::isNotBlank)?.let { "${player.name}: $it" }
                }
            ),
            SessionReportSection(
                "Evaluation",
                listOf(
                    "Objectives met: ${objectives.ifBlank { "-" }}",
                    "Engagement: ${if (engagement > 0) "$engagement/5" else "-"}",
                    "What went well: ${wentWell.ifBlank { "-" }}",
                    "Challenges: ${challenges.ifBlank { "-" }}",
                    "Next adjustments: ${nextAdjustments.ifBlank { "-" }}"
                )
            ),
            SessionReportSection("Session summary", listOf(postNotes.ifBlank { "-" }))
        )
        if (aiEvaluation != null) {
            sections += SessionReportSection(
                "AI session analysis",
                listOfNotNull(
                    "Diagnosis: ${ReadinessLabels[aiEvaluation.progressionReadiness] ?: aiEvaluation.progressionReadiness}",
                    aiEvaluation.squadSummary
                ) + aiEvaluation.identifiedGaps.map { "Gap: $it" } +
                    aiEvaluation.playerFeedback.map { (name, focus) -> "$name: $focus" } +
                    aiEvaluation.sessionImprovements.map { "Improvement: $it" } +
                    listOf("Commendation: ${aiEvaluation.aiCommendation}")
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
        MaterialTheme(colorScheme = LiveSessionLightColors) {
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
                onStart = {
                    if (onScheduleDate) {
                        beginSession(false)
                        saveProgress()
                    } else showEarlyStartConfirm = true
                }
            )
        }
        if (showEarlyStartConfirm) {
            MaterialTheme(colorScheme = LiveSessionLightColors) {
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
        MaterialTheme(colorScheme = LiveSessionLightColors) {
            SessionCoachModeScreen(
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
                onOpenDrillControls = { onCoachPageChange("DRILL") },
                onViewAllObservations = { onCoachPageChange("OBSERVATIONS") },
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
                onEndSession = { onCoachPageChange("END") },
                onFinishSession = {
                    onCoachPageChange("REVIEW")
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
                },
                onSaveProgress = { saveProgress() }
            )
        }
        return
    }

    Surface(modifier = modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val isTablet = maxWidth >= 600.dp
            Column(Modifier.fillMaxSize()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 3.dp,
                    shadowElevation = 4.dp
                ) {
                    Column {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            reportError = runCatching {
                                openClubExport(context, buildReportFile(), "application/pdf", "Open PDF report")
                            }.exceptionOrNull()?.message.orEmpty()
                        }) {
                            Icon(Icons.Outlined.Download, contentDescription = "Download PDF report", tint = MaterialTheme.colorScheme.primary)
                        }
                        IconButton(onClick = {
                            reportError = runCatching {
                                shareClubExport(context, buildReportFile(), "application/pdf", "Share PDF report")
                            }.exceptionOrNull()?.message.orEmpty()
                        }) {
                            Icon(Icons.Outlined.Share, contentDescription = "Share PDF report", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                    if (reportError.isNotBlank()) {
                        Text(reportError, color = MaterialTheme.colorScheme.error, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 14.dp))
                    }
                    }
                }
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
                            onRemove = { incident -> incidents = incidents.filterNot { it.id == incident.id } }
                        )
                    }
                    item {
                        PlayerNotesCard(
                            players = assignedPlayers,
                            playerNotes = playerNotes,
                            postNotes = postNotes,
                            onPostNotesChange = { postNotes = it },
                            readOnly = false
                        )
                    }
                    item {
                        EvaluationCard(
                            objectives = objectives,
                            onObjectivesChange = { objectives = it },
                            engagement = engagement,
                            onEngagementChange = { engagement = it },
                            wentWell = wentWell,
                            onWentWellChange = { wentWell = it },
                            challenges = challenges,
                            onChallengesChange = { challenges = it },
                            nextAdjustments = nextAdjustments,
                            onNextAdjustmentsChange = { nextAdjustments = it },
                            readOnly = false
                        )
                    }
                    if (readOnly) {
                        item {
                            Button(onClick = { saveProgress() }, enabled = !isSaving, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Outlined.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.padding(horizontal = 3.dp))
                                Text(if (isSaving) "Saving…" else "Save evaluation")
                            }
                        }
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
                                }
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
                    if (saveError.isNotBlank()) {
                        item { Text(saveError, color = MaterialTheme.colorScheme.error) }
                    }
                }
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 3.dp,
                    shadowElevation = 8.dp
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = if (readOnly) Arrangement.End else Arrangement.SpaceBetween
                    ) {
                        OutlinedButton(onClick = onDismiss, enabled = !isSaving) {
                            Icon(Icons.Outlined.Close, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.padding(horizontal = 3.dp))
                            Text("Close")
                        }
                        if (!readOnly) {
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
    onStart: () -> Unit
) {
    val checklistDone = PreparationChecklist.count { (key, _) -> checklist[key] == true }
    val presentCount = players.count { attendance[it.id] == "PRESENT" }
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
                    if (isSaving || saveError.isNotBlank()) {
                        item {
                            Text(
                                if (saveError.isNotBlank()) saveError else "Saving preparation and attendance…",
                                color = if (saveError.isNotBlank()) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 12.sp
                            )
                        }
                    }
                    if (!ready) {
                        item {
                            Text(
                                "Attendance changes are saved automatically.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 11.sp
                            )
                        }
                    }
                    if (!ready) {
                    if (isTablet) {
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                PreparationChecklistCard(checklist, checklistDone, Modifier.weight(1f))
                                SquadAttendanceCard(players, attendance, Modifier.weight(1f), onAttendanceChanged)
                            }
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                SessionFocusCard(session, Modifier.weight(1f))
                                PlannedDrillsCard(drills, Modifier.weight(1f))
                            }
                        }
                    } else {
                        item { PreparationChecklistCard(checklist, checklistDone) }
                        item { SquadAttendanceCard(players, attendance, onAttendanceChanged = onAttendanceChanged) }
                        item { SessionFocusCard(session) }
                        item { PlannedDrillsCard(drills) }
                    }
                    item {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = onBack) { Text("Cancel") }
                            Button(onClick = onProceed, enabled = canStart) {
                                Text(startLabel)
                                Spacer(Modifier.width(6.dp))
                                Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                } else {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth().then(if (isTablet) Modifier.padding(horizontal = 48.dp) else Modifier),
                            shape = RoundedCornerShape(22.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                        ) {
                            Column(
                                Modifier.fillMaxWidth().padding(if (isTablet) 24.dp else 16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(50),
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                                ) {
                                    Icon(
                                        Icons.Outlined.PlayArrow,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(12.dp).size(30.dp)
                                    )
                                }
                                Text("Ready to start?", fontSize = 23.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface)
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
                                        modifier = Modifier.padding(12.dp),
                                        color = Color(0xFF267857),
                                        fontSize = 12.sp
                                    )
                                }
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Cancel") }
                                    Button(onClick = onStart, enabled = canStart, modifier = Modifier.weight(1.4f)) {
                                        Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text(startLabel)
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
private fun PreparationChecklistCard(
    checklist: androidx.compose.runtime.snapshots.SnapshotStateMap<String, Boolean>,
    checklistDone: Int,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Preparation checklist  ·  $checklistDone/${PreparationChecklist.size}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            PreparationChecklist.forEach { (key, label) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = checklist[key] == true,
                        onCheckedChange = { checklist[key] = it },
                        colors = CheckboxDefaults.colors(
                            checkedColor = Color(0xFF19A66A),
                            checkmarkColor = Color.White
                        )
                    )
                    Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    onAttendanceChanged: () -> Unit = {}
) {
    val presentCount = players.count { attendance[it.id] == "PRESENT" }
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Squad attendance  ·  $presentCount/${players.size} present", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            if (players.isEmpty()) {
                Text("No players are assigned to this session.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                players.forEach { player ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = attendance[player.id] == "PRESENT",
                            onCheckedChange = { present ->
                                attendance[player.id] = if (present) "PRESENT" else "ABSENT"
                                onAttendanceChanged()
                            }
                        )
                        Text(player.name, modifier = Modifier.weight(1f), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
                        Text(
                            if (attendance[player.id] == "PRESENT") "Present" else "Not marked",
                            fontSize = 11.sp,
                            color = if (attendance[player.id] == "PRESENT") Color(0xFF25835D) else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionFocusCard(session: ClubTrainingSession, modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Session guidance", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            if (session.safety.isEmpty()) {
                Text("No additional safety guidance provided.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                session.safety.forEach { Text("• $it", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
    }
}

@Composable
private fun PlannedDrillsCard(drills: List<ExecutionDrill>, modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Planned drills (${drills.size})", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            if (drills.isEmpty()) {
                Text("No drills are planned for this session.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                drills.forEachIndexed { index, drill ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${index + 1}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                        Column(Modifier.weight(1f)) {
                            Text(drill.title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                            Text("${drill.plannedMinutes} min", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
            Modifier.fillMaxWidth().padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Column(Modifier.weight(1f)) {
                Text(value, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, maxLines = 1)
                Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
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
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Preparation checklist", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            PreparationChecklist.forEach { (key, label) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = checklist[key] == true, onCheckedChange = { checklist[key] = it }, enabled = !readOnly)
                    Text(label, style = MaterialTheme.typography.bodySmall)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Status: ${status.replace('_', ' ')}", fontWeight = FontWeight.Medium)
                if (status == "PREPARING" && !readOnly) {
                    Button(onClick = onStart, enabled = canStart) {
                        Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.padding(horizontal = 3.dp))
                        Text("Start session")
                    }
                }
            }
            if (!canStart) {
                Text(
                    "Complete the preparation checklist to start before $sessionDate, or wait until then.",
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 12.sp
                )
            } else if (!onScheduleDate) {
                Text(
                    "Checklist complete — starting now will be recorded as earlier than the scheduled date ($sessionDate).",
                    color = MaterialTheme.colorScheme.tertiary,
                    fontSize = 12.sp
                )
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
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Attendance", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            if (players.isEmpty()) {
                Text("No players assigned to this session yet.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            } else {
                Row(Modifier.fillMaxWidth()) {
                    Text("Player", Modifier.weight(1.4f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    listOf("Present", "Late", "Absent").forEach { label ->
                        Text(label, Modifier.weight(1f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                }
                HorizontalDivider()
                players.forEach { player ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(player.name, Modifier.weight(1.4f), fontSize = 13.sp)
                        listOf("PRESENT", "LATE", "ABSENT").forEach { value ->
                            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                                val selected = attendance[player.id] == value
                                IconButton(onClick = { attendance[player.id] = value }, enabled = !readOnly) {
                                    Icon(
                                        if (selected) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                                        contentDescription = value,
                                        tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
                                    )
                                }
                            }
                        }
                    }
                    HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
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
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(drill.title, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                IconButton(onClick = onInfo, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Outlined.Info, contentDescription = "Drill setup info", tint = MaterialTheme.colorScheme.primary)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = drill.plannedMinutes.toString(),
                    onValueChange = { value ->
                        val minutes = value.filter(Char::isDigit).toIntOrNull() ?: 0
                        onChange(drill.copy(plannedMinutes = minutes))
                    },
                    label = { Text("Planned min") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    enabled = !readOnly
                )
                OutlinedTextField(
                    value = drill.actualMinutes.toString(),
                    onValueChange = { value ->
                        val minutes = value.filter(Char::isDigit).toIntOrNull() ?: 0
                        onChange(drill.copy(actualMinutes = minutes))
                    },
                    label = { Text("Actual min") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    enabled = !readOnly
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = drill.completed, onCheckedChange = { done -> onChange(drill.copy(completed = done)) }, enabled = !readOnly)
                Text("Completed")
            }
            OutlinedTextField(
                drill.notes,
                { note -> onChange(drill.copy(notes = note)) },
                label = { Text("Drill notes") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 1,
                enabled = !readOnly
            )
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
private fun IncidentsCard(
    incidents: List<ExecutionIncident>,
    category: String,
    onCategoryChange: (String) -> Unit,
    note: String,
    onNoteChange: (String) -> Unit,
    readOnly: Boolean,
    onAdd: () -> Unit,
    onRemove: (ExecutionIncident) -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Incidents", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    category,
                    onCategoryChange,
                    label = { Text("Category") },
                    modifier = Modifier.weight(0.75f),
                    singleLine = true,
                    enabled = !readOnly
                )
                OutlinedTextField(
                    note,
                    onNoteChange,
                    label = { Text("Incident note") },
                    modifier = Modifier.weight(1.25f),
                    singleLine = true,
                    enabled = !readOnly
                )
            }
            if (!readOnly) {
                Button(onClick = onAdd, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text("Add incident")
                }
            }
            incidents.forEach { incident ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${incident.category}: ${incident.note}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                    if (!readOnly) {
                        IconButton(onClick = { onRemove(incident) }, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Outlined.Delete, contentDescription = "Remove incident")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayerNotesCard(
    players: List<ClubMember>,
    playerNotes: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>,
    postNotes: String,
    onPostNotesChange: (String) -> Unit,
    readOnly: Boolean
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Player notes", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            players.forEach { player ->
                OutlinedTextField(
                    value = playerNotes[player.id].orEmpty(),
                    onValueChange = { playerNotes[player.id] = it },
                    label = { Text("${player.name} · individual note") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    enabled = !readOnly
                )
            }
            OutlinedTextField(
                postNotes,
                onPostNotesChange,
                label = { Text("Session observations") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                enabled = !readOnly
            )
        }
    }
}

@Composable
private fun EvaluationCard(
    objectives: String,
    onObjectivesChange: (String) -> Unit,
    engagement: Int,
    onEngagementChange: (Int) -> Unit,
    wentWell: String,
    onWentWellChange: (String) -> Unit,
    challenges: String,
    onChallengesChange: (String) -> Unit,
    nextAdjustments: String,
    onNextAdjustmentsChange: (String) -> Unit,
    readOnly: Boolean
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Evaluation", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            Text("Objectives met", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("YES", "PARTIAL", "NO").forEach { value ->
                    val selected = objectives == value
                    if (selected) {
                        Button(onClick = { onObjectivesChange(value) }, enabled = !readOnly) { Text(value) }
                    } else {
                        OutlinedButton(onClick = { onObjectivesChange(value) }, enabled = !readOnly) { Text(value) }
                    }
                }
            }
            Text("Engagement: $engagement / 5", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                (1..5).forEach { value ->
                    val selected = engagement == value
                    Surface(
                        onClick = { onEngagementChange(value) },
                        enabled = !readOnly,
                        shape = androidx.compose.foundation.shape.CircleShape,
                        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                value.toString(),
                                color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
            OutlinedTextField(wentWell, onWentWellChange, label = { Text("What went well") }, modifier = Modifier.fillMaxWidth(), minLines = 2, enabled = !readOnly)
            OutlinedTextField(challenges, onChallengesChange, label = { Text("Challenges") }, modifier = Modifier.fillMaxWidth(), minLines = 2, enabled = !readOnly)
            OutlinedTextField(nextAdjustments, onNextAdjustmentsChange, label = { Text("Next adjustments") }, modifier = Modifier.fillMaxWidth(), minLines = 2, enabled = !readOnly)
        }
    }
}

@Composable
private fun AiAnalysisCard(
    evaluation: AiEvaluationData?,
    busy: Boolean,
    error: String,
    onRun: () -> Unit,
    onAddToAdjustments: (List<String>) -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text("AI session analysis", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                }
                Button(onClick = onRun, enabled = !busy) {
                    Icon(if (evaluation != null) Icons.Outlined.Refresh else Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text(if (busy) "Analysing…" else if (evaluation != null) "Re-run AI analysis" else "Run AI analysis")
                }
            }
            Text(
                "Gemini reviews player notes, attendance, drill timings, disruptions and evaluation, then suggests improvements and a follow-up session.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            if (evaluation != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Diagnosis", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                    ) {
                        Text(
                            ReadinessLabels[evaluation.progressionReadiness] ?: evaluation.progressionReadiness,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
                Text(evaluation.squadSummary, style = MaterialTheme.typography.bodySmall)
                if (evaluation.identifiedGaps.isNotEmpty()) {
                    Text("Gaps", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    evaluation.identifiedGaps.forEach { Text("• $it", fontSize = 12.sp) }
                }
                if (evaluation.playerFeedback.isNotEmpty()) {
                    Text("Player focus", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    evaluation.playerFeedback.forEach { (name, focus) -> Text("$name: $focus", fontSize = 12.sp) }
                }
                if (evaluation.sessionImprovements.isNotEmpty()) {
                    Text("Improve the next session", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    evaluation.sessionImprovements.forEach { Text("• $it", fontSize = 12.sp) }
                    TextButton(onClick = { onAddToAdjustments(evaluation.sessionImprovements) }) {
                        Text("Add to adjustments")
                    }
                }
                HorizontalDivider()
                Text("💬 ${evaluation.aiCommendation}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
                evaluation.generatedAt?.let {
                    Text("Generated $it", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
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
            Text("Follow-up session", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            if (createdFollowUp != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text(
                        "\"${createdFollowUp.title}\" created for ${createdFollowUp.sessionDate} with ${createdFollowUp.drillCount} drill(s).",
                        fontSize = 12.sp
                    )
                }
                Text(
                    "It is saved as a draft for the club to review and publish in the session planner.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            } else if (draft != null) {
                evaluation.followUpPlan?.objective?.takeIf(String::isNotBlank)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(
                    draft.optString("title"),
                    { onDraftChange(JSONObject(draft.toString()).put("title", it)) },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        draft.optString("sessionDate"),
                        { onDraftChange(JSONObject(draft.toString()).put("sessionDate", it)) },
                        label = { Text("Date (YYYY-MM-DD)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    OutlinedTextField(
                        draft.optInt("durationMinutes").toString(),
                        { value -> onDraftChange(JSONObject(draft.toString()).put("durationMinutes", value.toIntOrNull() ?: draft.optInt("durationMinutes"))) },
                        label = { Text("Minutes") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }
                val catalogueIds = evaluation.followUpPlan?.catalogueDrillIds.orEmpty()
                val selectedCatalogueIds = (0 until draft.getJSONArray("drillIds").length())
                    .map { draft.getJSONArray("drillIds").getString(it) }.toSet()
                if (catalogueIds.isNotEmpty()) {
                    Text("Catalogue drills", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
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
                                Text("${drill.title} · ${drill.discipline} · ${drill.durationMinutes} min", fontSize = 12.sp)
                            }
                        }
                    }
                }
                if (evaluation.tailoredRecommendedDrills.isNotEmpty()) {
                    Text("New AI-recommended drills (saved to the club catalogue)", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
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
                                Text("${row.optString("title")} · ${row.optString("discipline")} · ${row.optInt("durationMinutes")} min", fontSize = 12.sp)
                                row.optString("reason").takeIf(String::isNotBlank)?.let {
                                    Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                }
                            }
                        }
                    }
                }
                Text("Selected drills: $followUpMinutes min", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                Button(onClick = onCreate, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text(if (busy) "Creating…" else "Create follow-up session")
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
                onOpenDrillControls: () -> Unit,
                onPauseSession: () -> Unit,
                onResumeSession: () -> Unit,
                onDrillNotesChange: (String) -> Unit,
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
                        onOpenDrillControls = onOpenDrillControls,
                        onEndSession = onEndSession,
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
                        "OBSERVATION" -> item {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedButton(onClick = onBack) { Text("‹  Back to live session") }
                                CoachCard {
                                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Text("New observation", color = CoachInk, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                                        Text("Notes save automatically as you type.", color = CoachMuted, fontSize = 12.sp)
                                        Text("WHO IS THIS FOR?", color = CoachMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            listOf("INDIVIDUAL", "GROUP", "SQUAD").forEach { option ->
                                                CoachChip(option.lowercase().replaceFirstChar(Char::uppercase), observationScope == option) {
                                                    onObservationScopeChange(option)
                                                }
                                            }
                                        }
                                        if (observationScope == "INDIVIDUAL") {
                                            Text("Choose a player to save this individual observation.", color = CoachMuted, fontSize = 11.sp)
                                            if (players.isEmpty()) {
                                                Text("No players are assigned to this session.", color = MaterialTheme.colorScheme.error)
                                            } else {
                                                players.forEach { player ->
                                                    Surface(
                                                        onClick = { onObservationPlayerChange(player.id) },
                                                        color = if (observationPlayerId == player.id) Color(0xFFECE9FF) else Color(0xFFF7F8FC),
                                                        shape = RoundedCornerShape(12.dp)
                                                    ) {
                                                        Text(player.name, modifier = Modifier.fillMaxWidth().padding(10.dp), color = CoachInk)
                                                    }
                                                }
                                            }
                                        }
                                        Text("CATEGORY", color = CoachMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        listOf("TECHNIQUE", "TACTICAL", "PHYSICAL", "BEHAVIOUR", "PROGRESS", "SAFETY").chunked(3).forEach { row ->
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                row.forEach { option ->
                                                    CoachChip(option.lowercase().replaceFirstChar(Char::uppercase), observationCategory == option) {
                                                        onObservationCategoryChange(option)
                                                    }
                                                }
                                            }
                                        }
                                        activeDrill?.let {
                                            Text("Linked to drill: ${it.title}", color = Color(0xFF5943D6), fontSize = 12.sp)
                                        }
                                        OutlinedTextField(
                                            value = observationText,
                                            onValueChange = onObservationTextChange,
                                            modifier = Modifier.fillMaxWidth(),
                                            minLines = 4,
                                            label = { Text("Observation") },
                                            placeholder = { Text("What did you notice?") }
                                        )
                                        when {
                                            observationSaving -> Text("Saving…", color = CoachMuted, fontSize = 12.sp)
                                            observationError.isNotBlank() -> Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(observationError, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                                                TextButton(onClick = onRetryObservation) { Text("Retry") }
                                            }
                                            observationSavedAt.isNotBlank() -> Text("Saved automatically", color = Color(0xFF25835D), fontSize = 12.sp)
                                            observationText.isNotBlank() -> Text("Saving automatically…", color = CoachMuted, fontSize = 12.sp)
                                        }
                                        Text("No save button needed — your note is saved automatically.", color = CoachMuted, fontSize = 11.sp)
                                    }
                                }
                            }
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
                                onSelectNext = { drill -> onSelectDrill(drill) }
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
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedButton(onClick = onBack) { Text("‹  Back to live session") }
                                AllSessionObservationsCard(observations, observationLoadError) {
                                    coroutineScope.launch { onReloadObservations() }
                                }
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
                                                    enabled = !sessionPaused,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(if (sessionPaused) "Drill controls unavailable while paused" else if (paused) "Resume drill" else "Drill controls")
                                                }
                                            } else {
                                                Button(
                                                    onClick = onOpenDrillControls,
                                                    enabled = !sessionPaused,
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
    onOpenDrillControls: () -> Unit,
    onEndSession: () -> Unit,
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
                    onOpenDrillControls = onOpenDrillControls,
                    onEndSession = onEndSession
                )
                RecentObservationsPane(
                    modifier = Modifier.weight(0.92f).fillMaxHeight(),
                    observations = observations,
                    loadError = observationLoadError,
                    onAdd = { onOpenObservation("SQUAD", "TECHNIQUE") },
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
                        onOpenDrillControls = onOpenDrillControls,
                        onEndSession = onEndSession
                    )
                }
                item {
                    RecentObservationsPane(
                        modifier = Modifier.fillMaxWidth(),
                        observations = observations,
                        loadError = observationLoadError,
                        onAdd = { onOpenObservation("SQUAD", "TECHNIQUE") },
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
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(
                        formatElapsedClock(sessionSeconds),
                        color = Color(0xFF111A45),
                        fontSize = 28.sp,
                        lineHeight = 32.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "/ ${session.durationMinutes} min",
                        modifier = Modifier.padding(bottom = 3.dp),
                        color = Color(0xFF64708F),
                        fontSize = 12.sp
                    )
                }
            }
            Surface(
                onClick = if (sessionPaused) onResumeSession else onPauseSession,
                enabled = !isSaving,
                shape = RoundedCornerShape(12.dp),
                color = Color.White.copy(alpha = 0.9f),
                border = BorderStroke(1.dp, Color(0xFFE1E7F5)),
                shadowElevation = 1.dp
            ) {
                Icon(
                    if (sessionPaused) Icons.Outlined.PlayArrow else Icons.Outlined.Pause,
                    contentDescription = if (sessionPaused) "Resume session" else "Pause session",
                    tint = Color(0xFF563DE1),
                    modifier = Modifier.padding(10.dp).size(20.dp)
                )
            }
        }

        ActiveDrillSummaryCard(
            drill = activeDrill,
            position = drillPosition,
            count = drillCount,
            elapsedSeconds = activeDrillSeconds,
            enabled = !sessionPaused,
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
                ) { onOpenObservation("SQUAD", "PROGRESS") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                QuickCaptureTile(
                    modifier = Modifier.weight(1f),
                    title = "Challenge",
                    subtitle = "Quick note",
                    icon = Icons.Outlined.Warning,
                    tint = Color(0xFFE84A54),
                    background = Color(0xFFFFF0F0)
                ) { onOpenObservation("SQUAD", "BEHAVIOUR") }
                QuickCaptureTile(
                    modifier = Modifier.weight(1f),
                    title = "Adjustment",
                    subtitle = "Quick note",
                    icon = Icons.Outlined.Lightbulb,
                    tint = Color(0xFFE28A18),
                    background = Color(0xFFFFF6E6)
                ) { onOpenObservation("SQUAD", "TACTICAL") }
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
                onClick = onOpenDrillControls,
                enabled = !sessionPaused
            )
        }
        if (isSaving) Text("Saving session…", color = CoachMuted, fontSize = 12.sp)
        if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 11.sp)
    }
}

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
                        modifier = Modifier.padding(8.dp).size(19.dp)
                    )
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        if (drill == null) "Current drill" else "Current drill $position / $count",
                        color = Color(0xFF64708F),
                        fontSize = 11.sp
                    )
                    Text(
                        drill?.title ?: "No active drill",
                        color = Color(0xFF17204A),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    drill?.let { "${formatCoachTime(elapsedSeconds)} / ${formatCoachTime(it.plannedMinutes * 60)}" } ?: "Choose",
                    color = Color(0xFF64708F),
                    fontSize = 11.sp
                )
                Icon(Icons.Outlined.PlayArrow, contentDescription = "Drill controls", tint = Color(0xFF3F4D7C), modifier = Modifier.size(18.dp))
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
    onSelectNext: (ExecutionDrill) -> Unit
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
                    onComplete = onComplete
                )
                NextDrillsPanel(
                    modifier = Modifier.weight(0.9f),
                    drills = sessionDrills,
                    activeDrillId = activeDrill?.id,
                    isSaving = isSaving,
                    onSelectNext = onSelectNext
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
                    onComplete = onComplete
                )
                NextDrillsPanel(
                    modifier = Modifier.fillMaxWidth(),
                    drills = sessionDrills,
                    activeDrillId = activeDrill?.id,
                    isSaving = isSaving,
                    onSelectNext = onSelectNext
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
    onComplete: () -> Unit
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
                    fontSize = 18.sp,
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
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text("remaining", color = Color(0xFF66728F), fontSize = 14.sp)
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
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val actionWidth = minOf(170.dp, (maxWidth - 8.dp) / 2)
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
                    ) {
                        DrillTabletAction(
                            modifier = Modifier.width(actionWidth),
                            label = if (paused) "Resume" else "Pause",
                            icon = if (paused) Icons.Outlined.PlayArrow else Icons.Outlined.Pause,
                            color = Color(0xFFEEEAFE),
                            tint = Color(0xFF644BEA),
                            enabled = !isSaving,
                            onClick = if (paused) onResume else onPause
                        )
                        DrillTabletAction(
                            modifier = Modifier.width(actionWidth),
                            label = "Complete",
                            icon = Icons.Outlined.CheckCircle,
                            color = Color(0xFFE2F5ED),
                            tint = Color(0xFF159B72),
                            enabled = !isSaving,
                            onClick = onComplete
                        )
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Add minutes",
                        modifier = Modifier.weight(1f),
                        color = Color(0xFF27365F),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        if (addedMinutes == 0) "1–20 min" else "+$addedMinutes min",
                        color = Color(0xFF644BEA),
                        fontSize = 16.sp,
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
                    label = { Text("Drill notes", fontSize = 16.sp) },
                    placeholder = { Text("Add notes about this drill", fontSize = 15.sp) },
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
                    textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 16.sp)
                )
                if (speechError.isNotBlank()) {
                    Text(speechError, color = MaterialTheme.colorScheme.error, fontSize = 15.sp)
                }
            }
            if (isSaving) Text("Saving…", color = CoachMuted, fontSize = 14.sp)
            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 15.sp)
        }
    }
}

@Composable
private fun NextDrillsPanel(
    modifier: Modifier,
    drills: List<Pair<Int, ExecutionDrill>>,
    activeDrillId: String?,
    isSaving: Boolean,
    onSelectNext: (ExecutionDrill) -> Unit
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
            Text("Session drills (${drills.size})", color = Color(0xFF53617F), fontSize = 18.sp, fontWeight = FontWeight.Bold)
            if (drills.isEmpty()) {
                Text("No drills planned for this session", color = Color(0xFF74809A), fontSize = 16.sp)
            } else {
                drills.forEach { (number, drill) ->
                    val isCurrent = drill.id == activeDrillId
                    val canStart = !drill.completed && !isCurrent
                    Surface(
                        onClick = { if (canStart) onSelectNext(drill) },
                        enabled = !isSaving && canStart,
                        shape = RoundedCornerShape(9.dp),
                        color = Color.Transparent,
                        border = BorderStroke(1.dp, Color(0xFFE8ECF6))
                    ) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            Surface(shape = RoundedCornerShape(50), color = Color(0xFFE8E7FF)) {
                                Box(Modifier.size(26.dp), contentAlignment = Alignment.Center) {
                                    Text("$number", color = Color(0xFF5342D2), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                Text(
                                    drill.title,
                                    color = Color(0xFF26324F),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                val drillStatus = when {
                                    isCurrent -> "Current drill"
                                    drill.completed -> "Completed"
                                    else -> "${drill.plannedMinutes} min"
                                }
                                Text(
                                    drillStatus,
                                    color = if (drill.completed) Color(0xFF25835D) else Color(0xFF74809A),
                                    fontSize = 14.sp
                                )
                            }
                            when {
                                drill.completed -> Icon(
                                    Icons.Outlined.CheckCircle,
                                    contentDescription = "Completed",
                                    tint = Color(0xFF25835D),
                                    modifier = Modifier.size(20.dp)
                                )
                                isCurrent -> Text("Now", color = Color(0xFF644BEA), fontSize = 14.sp, fontWeight = FontWeight.Bold)
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
            }
        }
    }
}

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
            Text(label, color = tint, fontSize = 16.sp, fontWeight = FontWeight.Bold)
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
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier.height(56.dp),
        shape = RoundedCornerShape(14.dp),
        color = background.copy(alpha = 0.92f),
        border = BorderStroke(1.dp, tint.copy(alpha = 0.08f))
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(9.dp)
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(title, color = tint, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(subtitle, color = Color(0xFF72809E), fontSize = 11.sp, maxLines = 1)
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
        modifier = modifier.height(40.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, tint.copy(alpha = 0.7f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = tint),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun RecentObservationsPane(
    modifier: Modifier,
    observations: List<SessionObservation>,
    loadError: String,
    onAdd: () -> Unit,
    onViewAll: () -> Unit,
    onReload: () -> Unit
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
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
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = onViewAll) {
                    Text("View all ›", color = Color(0xFF6349E8), fontSize = 12.sp)
                }
            }
            if (loadError.isNotBlank()) {
                Text(loadError, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                TextButton(onClick = onReload) { Text("Retry", fontSize = 13.sp) }
            } else if (observations.isEmpty()) {
                Text("No observations yet.", color = CoachMuted, fontSize = 13.sp)
                OutlinedButton(
                    onClick = onAdd,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Add observation", fontSize = 13.sp) }
            } else {
                observations.take(3).forEachIndexed { index, observation ->
                    ObservationListRow(observation)
                    if (index < minOf(observations.size, 3) - 1) HorizontalDivider(color = Color(0xFFE8ECF6))
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
    CoachCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("All observations", color = CoachInk, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            if (loadError.isNotBlank()) {
                Text(loadError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                TextButton(onClick = onReload) { Text("Retry") }
            } else if (observations.isEmpty()) {
                Text("No observations recorded for this session.", color = CoachMuted, fontSize = 12.sp)
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
        Text(formatObservationClock(observation.createdAt), color = Color(0xFF8791A8), fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
        Surface(shape = RoundedCornerShape(50), color = avatarColor, modifier = Modifier.size(30.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Text(initials, color = categoryColor, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Surface(shape = RoundedCornerShape(20.dp), color = categoryColor.copy(alpha = 0.1f), modifier = Modifier.align(Alignment.Start)) {
                Text(
                    observation.category.lowercase().replaceFirstChar(Char::uppercase),
                    color = categoryColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                )
            }
            Text(
                observation.text,
                color = Color(0xFF52607F),
                fontSize = 12.sp,
                lineHeight = 16.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
        Icon(Icons.Outlined.MoreVert, contentDescription = "Observation options", tint = Color(0xFF7E89A2), modifier = Modifier.size(18.dp).padding(top = 3.dp))
    }
}

private fun formatElapsedClock(totalSeconds: Int): String {
    val safeSeconds = totalSeconds.coerceAtLeast(0)
    val hours = safeSeconds / 3600
    val minutes = (safeSeconds % 3600) / 60
    val seconds = safeSeconds % 60
    return "%02d:%02d:%02d".format(hours, minutes, seconds)
}
