package com.ecricketcoach.mobile

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.util.Base64

private val ExtensionDisciplines = listOf("BATTING", "BOWLING", "KEEPING", "FIELDING")
private val PlayerLevels = listOf("FOUNDATION", "DEVELOPING", "INTERMEDIATE", "ADVANCED", "ELITE")

@Composable
internal fun ClubDrillsPanel(
    drills: List<Drill>,
    canCreate: Boolean,
    onCreate: (String, String, String, String, Int, String) -> Unit,
    onDelete: (Drill) -> Unit,
    modifier: Modifier = Modifier
) {
    var showCreate by remember { mutableStateOf(false) }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Club custom drills", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                if (canCreate) Button(onClick = { showCreate = true }) { Text("Add drill") }
            }
        }
        if (drills.isEmpty()) item { Text("No custom club drills yet.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)) }
        items(drills, key = Drill::id) { drill ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(drill.title, fontWeight = FontWeight.SemiBold)
                    Text("${drill.discipline} · ${drill.skillSet} · ${drill.durationMinutes} min", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                    if (drill.instructions.isNotBlank()) Text(drill.instructions, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                    TextButton(onClick = { onDelete(drill) }, modifier = Modifier.align(Alignment.End)) { Text("Delete") }
                }
            }
        }
    }
    if (showCreate) {
        CreateClubDrillDialog(
            onDismiss = { showCreate = false },
            onSave = { title, discipline, skillSet, context, duration, instructions ->
                showCreate = false
                onCreate(title, discipline, skillSet, context, duration, instructions)
            }
        )
    }
}

@Composable
private fun CreateClubDrillDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, Int, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var skillSet by remember { mutableStateOf("") }
    var discipline by remember { mutableStateOf("BATTING") }
    var context by remember { mutableStateOf("GROUP") }
    var duration by remember { mutableStateOf("20") }
    var instructions by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add custom drill") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text("Drill title") }, singleLine = true)
                OutlinedTextField(skillSet, { skillSet = it }, label = { Text("Skill focus") }, singleLine = true)
                PickerRow("Discipline: $discipline", ExtensionDisciplines) { discipline = it }
                PickerRow("Context: $context", listOf("INDIVIDUAL", "GROUP")) { context = it }
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("Duration in minutes") }, singleLine = true)
                OutlinedTextField(instructions, { instructions = it }, label = { Text("Setup instructions") }, minLines = 2)
            }
        },
        confirmButton = {
            val minutes = duration.toIntOrNull() ?: 0
            Button(
                onClick = { onSave(title.trim(), discipline, skillSet.trim(), context, minutes, instructions.trim()) },
                enabled = title.isNotBlank() && skillSet.isNotBlank() && minutes in 5..120
            ) { Text("Save drill") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
internal fun ProgressionPanel(
    certificates: List<ClubCertificate>,
    players: List<ClubMember>,
    onPromote: (ClubMember) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text("Player progression", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Promotions issue a certificate and update the player's current level.", fontSize = 12.sp)
        }
        item { Text("Roster", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp)) }
        if (players.isEmpty()) item { Text("No players are available.", fontSize = 12.sp) }
        items(players, key = { "player:${it.id}" }) { player ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(player.name, fontWeight = FontWeight.SemiBold)
                        Text("${player.currentLevel} · ${player.discipline}", fontSize = 12.sp)
                    }
                    if (player.currentLevel != PlayerLevels.last()) {
                        TextButton(onClick = { onPromote(player) }) { Text("Promote") }
                    } else {
                        Text("Top level", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp)
                    }
                }
            }
        }
        item { Text("Certificates", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 10.dp)) }
        if (certificates.isEmpty()) item { Text("No certificates have been issued yet.", fontSize = 12.sp) }
        items(certificates, key = { "certificate:${it.id}" }) { certificate ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Text(certificate.playerName, fontWeight = FontWeight.SemiBold)
                    Text("${certificate.level} · ${certificate.discipline} · ${certificate.issuedDate}", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                    Text("Certificate ${certificate.number} · Coach ${certificate.coachName}", fontSize = 11.sp)
                    if (certificate.coachNotes.isNotBlank()) Text(certificate.coachNotes, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
internal fun PromotePlayerDialog(
    player: ClubMember,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit
) {
    val nextLevel = PlayerLevels.getOrNull(PlayerLevels.indexOf(player.currentLevel) + 1)
    var selectedLevel by remember(player.id) { mutableStateOf(nextLevel ?: PlayerLevels.last()) }
    var notes by remember(player.id) { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Promote ${player.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Current level: ${player.currentLevel}")
                PickerRow("New level: $selectedLevel", PlayerLevels) { selectedLevel = it }
                OutlinedTextField(notes, { notes = it }, label = { Text("Coach notes") }, minLines = 2)
                Text("A certificate will be issued when the promotion is saved.", fontSize = 12.sp)
            }
        },
        confirmButton = {
            Button(onClick = { onSave(selectedLevel, notes.trim()) }, enabled = nextLevel != null) {
                Text("Promote player")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
internal fun VideoAnalysisPanel(
    api: CoachApi,
    token: String,
    players: List<ClubMember>,
    history: List<VideoAnalysisEntry>,
    driveConnected: Boolean,
    driveEmail: String,
    driveVideos: List<DriveVideoFile>,
    driveError: String,
    onRefreshDrive: () -> Unit,
    onDisconnectDrive: () -> Unit,
    onDriveAnalyzed: suspend (String, String, ClubMember?) -> Unit,
    onAnalyzed: (VideoAnalysisEntry) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var selectedPlayer by remember { mutableStateOf<ClubMember?>(null) }
    var discipline by remember { mutableStateOf("BATTING") }
    var analyzing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var latest by remember { mutableStateOf<VideoAnalysisEntry?>(null) }
    var source by remember { mutableStateOf("DEVICE") }
    var selectedDriveVideo by remember { mutableStateOf<DriveVideoFile?>(null) }
    var driveMenuOpen by remember { mutableStateOf(false) }
    var driveBusy by remember { mutableStateOf(false) }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { selectedUri = it }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text("AI video analysis", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Select a training clip to analyze with the club's video-analysis workflow.", fontSize = 12.sp)
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    PickerRow("Discipline: $discipline", ExtensionDisciplines) { discipline = it }
                    PlayerPicker(players, selectedPlayer) { selectedPlayer = it }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        TextButton(onClick = { source = "DEVICE" }) { Text(if (source == "DEVICE") "[Device video]" else "Device video") }
                        TextButton(onClick = { source = "DRIVE" }) { Text(if (source == "DRIVE") "[Google Drive]" else "Google Drive") }
                    }
                    if (source == "DEVICE") {
                        Text(selectedUri?.lastPathSegment ?: "No video selected", fontSize = 12.sp)
                    } else {
                        Text(
                            if (driveConnected) "Connected${driveEmail.takeIf(String::isNotBlank)?.let { " · $it" }.orEmpty()}"
                            else "Google Drive is not connected.",
                            fontSize = 12.sp
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            Button(onClick = {
                                try {
                                    CustomTabsIntent.Builder().build()
                                        .launchUrl(context, Uri.parse(api.googleDriveConnectUrl(token)))
                                } catch (failure: Exception) {
                                    error = failure.message ?: "Unable to open Google Drive authorization."
                                }
                            }, enabled = !driveConnected) { Text("Connect Drive") }
                            TextButton(onClick = onRefreshDrive, enabled = !driveBusy) { Text("Refresh videos") }
                            if (driveConnected) TextButton(onClick = onDisconnectDrive) { Text("Disconnect") }
                        }
                        Row {
                            TextButton(onClick = { driveMenuOpen = true }, enabled = driveVideos.isNotEmpty()) {
                                Text(selectedDriveVideo?.name ?: "Choose Drive video")
                            }
                            DropdownMenu(expanded = driveMenuOpen, onDismissRequest = { driveMenuOpen = false }) {
                                driveVideos.forEach { video ->
                                    DropdownMenuItem(
                                        text = { Text(video.name) },
                                        onClick = { selectedDriveVideo = video; driveMenuOpen = false }
                                    )
                                }
                            }
                        }
                        if (driveError.isNotBlank()) Text(driveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (source == "DEVICE") {
                            TextButton(onClick = { videoPicker.launch(arrayOf("video/*")) }) { Text("Choose device video") }
                            Button(
                                enabled = selectedUri != null && !analyzing,
                                onClick = {
                                    val uri = selectedUri ?: return@Button
                                    scope.launch {
                                        analyzing = true
                                        error = ""
                                        try {
                                            latest = api.analyzeVideo(context, token, uri, discipline, selectedPlayer)
                                            latest?.let(onAnalyzed)
                                        } catch (failure: Exception) {
                                            error = failure.message ?: "Unable to analyze this video."
                                        } finally {
                                            analyzing = false
                                        }
                                    }
                                }
                            ) { Text(if (analyzing) "Analyzing…" else "Analyze device video") }
                        } else {
                            Button(
                                enabled = driveConnected && selectedDriveVideo != null && !analyzing,
                                onClick = {
                                    val video = selectedDriveVideo ?: return@Button
                                    scope.launch {
                                        driveBusy = true
                                        error = ""
                                        try {
                                            onDriveAnalyzed(video.id, discipline, selectedPlayer)
                                        } catch (failure: Exception) {
                                            error = failure.message ?: "Unable to analyze the selected Drive video."
                                        } finally {
                                            driveBusy = false
                                        }
                                    }
                                }
                            ) { Text(if (driveBusy) "Starting…" else "Analyze Drive video") }
                        }
                    }
                    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
            }
        }
        latest?.let { result ->
            item {
                InfoCard(
                    "Latest result · ${result.score}/100",
                    "${result.discipline} · ${result.playerName ?: "Group session"}",
                    result.detectedIssues.joinToString("\n").ifBlank { "No specific issues were detected." }
                )
            }
        }
        item { Text("Recent analysis", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp)) }
        if (history.isEmpty()) item { Text("No saved video analyses yet.", fontSize = 12.sp) }
        items(history, key = VideoAnalysisEntry::id) { entry ->
            InfoCard(
                entry.playerName ?: "Group analysis",
                "${entry.discipline} · ${entry.score}/100 · ${entry.createdAt.take(10)}",
                entry.detectedIssues.joinToString("\n").ifBlank { "No specific issues were detected." }
            )
        }
    }
}

@Composable
internal fun ClubSettingsPanel(
    logoUrl: String?,
    onSave: (String?) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            busy = true
            error = ""
            try {
                val mimeType = context.contentResolver.getType(uri)
                if (mimeType != "image/png" && mimeType != "image/jpeg") {
                    error = "Choose a PNG or JPEG logo."
                } else {
                    val bytes = readBoundedImage(context, uri)
                    val encoded = Base64.getEncoder().encodeToString(bytes)
                    onSave("data:$mimeType;base64,$encoded")
                }
            } catch (failure: Exception) {
                error = failure.message ?: "Unable to read the selected logo."
            } finally {
                busy = false
            }
        }
    }
    Column(modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Club branding", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("The logo is added to certificates issued from this point forward.", fontSize = 12.sp)
        Text(if (logoUrl == null) "No club logo saved." else "A club logo is currently saved.", color = MaterialTheme.colorScheme.primary)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { imagePicker.launch(arrayOf("image/png", "image/jpeg")) }, enabled = !busy) {
                Text(if (busy) "Reading…" else "Choose logo")
            }
            if (logoUrl != null) TextButton(onClick = { onSave(null) }) { Text("Remove logo") }
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
    }
}

@Composable
private fun PlayerPicker(
    players: List<ClubMember>,
    selected: ClubMember?,
    onSelect: (ClubMember?) -> Unit
) {
    var open by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(selected?.name ?: "Group analysis", modifier = Modifier.weight(1f))
        TextButton(onClick = { open = true }) { Text("Player") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text("Group analysis") }, onClick = { onSelect(null); open = false })
            players.forEach { player ->
                DropdownMenuItem(text = { Text(player.name) }, onClick = { onSelect(player); open = false })
            }
        }
    }
}

@Composable
private fun PickerRow(label: String, options: List<String>, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f), fontSize = 13.sp)
        TextButton(onClick = { open = true }) { Text("Change") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = { onSelect(option); open = false })
            }
        }
    }
}

private fun readBoundedImage(context: Context, uri: Uri): ByteArray {
    val output = ByteArrayOutputStream()
    context.contentResolver.openInputStream(uri)?.use { input ->
        val buffer = ByteArray(8 * 1024)
        var total = 0
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            require(total <= 1024 * 1024) { "Club logo must be 1 MB or smaller." }
            output.write(buffer, 0, read)
        }
    } ?: error("Unable to open the selected logo.")
    require(output.size() > 0) { "The selected logo file is empty." }
    return output.toByteArray()
}
