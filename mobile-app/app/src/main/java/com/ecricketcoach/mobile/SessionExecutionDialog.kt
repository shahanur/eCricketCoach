package com.ecricketcoach.mobile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    onSave: (JSONObject, JSONObject, String, Boolean) -> Unit,
    onRunAiAnalysis: (JSONObject, JSONObject, String) -> Unit = { _, _, _ -> },
    onCreateFollowUp: (JSONObject) -> Unit = {}
) {
    val savedLog = remember(session.id) { session.executionLog ?: JSONObject() }
    var status by remember(session.id) { mutableStateOf(savedLog.optString("status", "PREPARING")) }
    var startedAt by remember(session.id) { mutableStateOf(savedLog.optionalText("startedAt")) }
    val checklist = remember(session.id) {
        mutableStateMapOf<String, Boolean>().apply {
            val values = savedLog.optJSONObject("checklist") ?: JSONObject()
            PreparationChecklist.forEach { (key, _) -> put(key, values.optBoolean(key)) }
        }
    }
    val assignedPlayers = remember(session.id, players) {
        val assignedIds = session.assignedPlayerIds.toSet()
        if (assignedIds.isNotEmpty()) players.filter { it.id in assignedIds }
        else players.filter { it.squad == session.squadName }
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

    fun beginSession(early: Boolean) {
        status = "IN_PROGRESS"
        startedAt = Instant.now().toString()
        startedEarly = early
        showEarlyStartConfirm = false
    }

    fun payload(complete: Boolean): JSONObject {
        val log = JSONObject()
            .put("status", if (complete) "COMPLETED" else status)
            .put("startedAt", startedAt ?: JSONObject.NULL)
            .put("startedEarly", startedEarly)
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

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
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
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Outlined.Close, contentDescription = "Close")
                        }
                        Column(Modifier.weight(1f)) {
                            Text(
                                if (readOnly) "Session review" else "Session execution",
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "${session.title} · ${session.sessionDate} · ${session.durationMinutes} min" +
                                    if (startedEarly) " · Started early" else "",
                                fontSize = 12.sp,
                                color = if (startedEarly) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                        }
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
