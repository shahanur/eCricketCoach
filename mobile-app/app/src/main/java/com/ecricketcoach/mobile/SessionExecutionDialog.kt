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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Save
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

@Composable
internal fun SessionExecutionScreen(
    session: ClubTrainingSession,
    players: List<ClubMember>,
    drills: List<Drill>,
    readOnly: Boolean,
    isSaving: Boolean,
    saveError: String,
    onDismiss: () -> Unit,
    onSave: (JSONObject, JSONObject, String, Boolean) -> Unit
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
                            readOnly = readOnly
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
                            readOnly = readOnly
                        )
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
