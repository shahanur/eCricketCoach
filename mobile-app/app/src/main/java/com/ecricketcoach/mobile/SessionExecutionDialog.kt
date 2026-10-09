package com.ecricketcoach.mobile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
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
internal fun SessionExecutionDialog(
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
    val today = LocalDate.now().toString()
    val canStart = session.sessionDate <= today

    fun payload(complete: Boolean): JSONObject {
        val log = JSONObject()
            .put("status", if (complete) "COMPLETED" else status)
            .put("startedAt", startedAt ?: JSONObject.NULL)
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

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (readOnly) "Session review" else "Session execution", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("${session.title} · ${session.sessionDate} · ${session.durationMinutes} min")
                LazyColumn(
                    modifier = Modifier.weight(1f, fill = false).heightIn(max = 560.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        Text("Preparation checklist", fontWeight = FontWeight.SemiBold)
                        PreparationChecklist.forEach { (key, label) ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = checklist[key] == true, onCheckedChange = { checklist[key] = it }, enabled = !readOnly)
                                Text(label, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Status: ${status.replace('_', ' ')}")
                            if (status == "PREPARING" && !readOnly) {
                                TextButton(onClick = {
                                    if (canStart) {
                                        status = "IN_PROGRESS"
                                        startedAt = Instant.now().toString()
                                    }
                                }, enabled = canStart) { Text("Start session") }
                            }
                        }
                        if (!canStart) Text("This session can be started on ${session.sessionDate} or later.", color = MaterialTheme.colorScheme.error)
                    }
                    item { Text("Attendance", fontWeight = FontWeight.SemiBold) }
                    items(assignedPlayers, key = { "attendance:${it.id}" }) { player ->
                        Column(Modifier.fillMaxWidth()) {
                            Text(player.name, fontWeight = FontWeight.Medium)
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                listOf("PRESENT", "LATE", "ABSENT").forEach { value ->
                                    TextButton(onClick = { attendance[player.id] = value }, enabled = !readOnly) {
                                        Text(if (attendance[player.id] == value) "[$value]" else value)
                                    }
                                }
                            }
                        }
                    }
                    item { Text("Drill timing and completion", fontWeight = FontWeight.SemiBold) }
                    items(drillRows, key = { "drill:${it.id}" }) { drill ->
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background)) {
                            Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(drill.title, fontWeight = FontWeight.Medium)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(
                                        value = drill.plannedMinutes.toString(),
                                        onValueChange = { value ->
                                            val minutes = value.filter(Char::isDigit).toIntOrNull() ?: 0
                                            drillRows = drillRows.map { if (it.id == drill.id) it.copy(plannedMinutes = minutes) else it }
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
                                            drillRows = drillRows.map { if (it.id == drill.id) it.copy(actualMinutes = minutes) else it }
                                        },
                                        label = { Text("Actual min") },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true,
                                        enabled = !readOnly
                                    )
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(checked = drill.completed, onCheckedChange = { done ->
                                        drillRows = drillRows.map { if (it.id == drill.id) it.copy(completed = done) else it }
                                    }, enabled = !readOnly)
                                    Text("Completed")
                                }
                                OutlinedTextField(
                                    drill.notes,
                                    { note -> drillRows = drillRows.map { if (it.id == drill.id) it.copy(notes = note) else it } },
                                    label = { Text("Drill notes") },
                                    modifier = Modifier.fillMaxWidth(),
                                    minLines = 1,
                                    enabled = !readOnly
                                )
                            }
                        }
                    }
                    item {
                        Text("Incidents", fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                incidentCategory,
                                { incidentCategory = it },
                                label = { Text("Category") },
                                modifier = Modifier.weight(0.75f),
                                singleLine = true,
                                enabled = !readOnly
                            )
                            OutlinedTextField(
                                incidentNote,
                                { incidentNote = it },
                                label = { Text("Incident note") },
                                modifier = Modifier.weight(1.25f),
                                singleLine = true,
                                enabled = !readOnly
                            )
                            TextButton(onClick = {
                                if (incidentNote.isNotBlank()) {
                                    incidents = incidents + ExecutionIncident(
                                        UUID.randomUUID().toString(),
                                        Instant.now().toString(),
                                        incidentCategory.trim().ifBlank { "Other" },
                                        incidentNote.trim()
                                    )
                                    incidentNote = ""
                                }
                            }, enabled = !readOnly) { Text("Add") }
                        }
                        incidents.forEach { incident ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${incident.category}: ${incident.note}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                                if (!readOnly) TextButton(onClick = { incidents = incidents.filterNot { it.id == incident.id } }) { Text("Remove") }
                            }
                        }
                    }
                    item {
                        Text("Player notes", fontWeight = FontWeight.SemiBold)
                        assignedPlayers.forEach { player ->
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
                            { postNotes = it },
                            label = { Text("Session observations") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            enabled = !readOnly
                        )
                    }
                    item {
                        Text("Evaluation", fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("YES", "PARTIAL", "NO").forEach { value ->
                                TextButton(onClick = { objectives = value }, enabled = !readOnly) { Text(if (objectives == value) "[$value]" else value) }
                            }
                        }
                        Text("Engagement: $engagement / 5")
                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                            (1..5).forEach { value ->
                                TextButton(onClick = { engagement = value }, enabled = !readOnly) { Text(if (engagement == value) "[$value]" else value.toString()) }
                            }
                        }
                        OutlinedTextField(wentWell, { wentWell = it }, label = { Text("What went well") }, modifier = Modifier.fillMaxWidth(), minLines = 2, enabled = !readOnly)
                        OutlinedTextField(challenges, { challenges = it }, label = { Text("Challenges") }, modifier = Modifier.fillMaxWidth(), minLines = 2, enabled = !readOnly)
                        OutlinedTextField(nextAdjustments, { nextAdjustments = it }, label = { Text("Next adjustments") }, modifier = Modifier.fillMaxWidth(), minLines = 2, enabled = !readOnly)
                    }
                }
                if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (readOnly) Arrangement.End else Arrangement.SpaceBetween) {
                    TextButton(onClick = onDismiss, enabled = !isSaving) { Text("Close") }
                    if (!readOnly) {
                        TextButton(onClick = { onSave(payload(false), JSONObject().also { notes ->
                            playerNotes.forEach { (id, note) -> if (note.isNotBlank()) notes.put(id, note) }
                        }, postNotes, false) }, enabled = !isSaving) { Text(if (isSaving) "Saving…" else "Save progress") }
                        Button(
                            onClick = { showCompleteConfirm = true },
                            enabled = canStart && status != "PREPARING" && !isSaving
                        ) { Text("Complete session") }
                    }
                }
            }
        }
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
                        status = "IN_PROGRESS"
                        startedAt = Instant.now().toString()
                    }
                    onSave(payload(true), JSONObject().also { notes ->
                        playerNotes.forEach { (id, note) -> if (note.isNotBlank()) notes.put(id, note) }
                    }, postNotes, true)
                }, enabled = !isSaving) { Text(if (isSaving) "Saving…" else "Confirm completion") }
            },
            dismissButton = { TextButton(onClick = { showCompleteConfirm = false }) { Text("Keep editing") } }
        )
    }
}
