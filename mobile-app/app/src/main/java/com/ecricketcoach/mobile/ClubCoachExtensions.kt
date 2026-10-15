package com.ecricketcoach.mobile

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.util.Base64

private val ExtensionDisciplines = listOf("BATTING", "BOWLING", "KEEPING", "FIELDING")
private val PlayerLevels = listOf("FOUNDATION", "DEVELOPING", "INTERMEDIATE", "ADVANCED", "ELITE")

@Composable
internal fun ClubDrillsPanel(
    drills: List<Drill>,
    canCreate: Boolean,
    onCreate: (String, String, String, String, Int, String) -> Unit,
    onClone: (Drill) -> Unit,
    onUpdate: (Drill, String, String, String, String, Int, String, String?) -> Unit,
    onDelete: (Drill) -> Unit,
    modifier: Modifier = Modifier
) {
    var showCreate by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Drill?>(null) }
    var search by remember { mutableStateOf("") }
    var discipline by remember { mutableStateOf("ALL") }
    var context by remember { mutableStateOf("ALL") }
    var source by remember { mutableStateOf("ALL") }
    val filtered = drills.filter { drill ->
        val query = search.trim().lowercase()
        (query.isBlank() || listOf(drill.title, drill.skillSet, drill.instructions).any { it.lowercase().contains(query) }) &&
            (discipline == "ALL" || drill.discipline == discipline) &&
            (context == "ALL" || drill.contextType == context) &&
            (source == "ALL" || drill.source == source)
    }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Available Drill Catalogue", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text("Pre-defined drills can be cloned into your club catalogue.", fontSize = 12.sp)
                }
                if (canCreate) {
                    Button(onClick = { showCreate = true }) {
                        Icon(Icons.Outlined.Add, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Add drill")
                    }
                }
            }
        }
        item {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Search title, focus, setup") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DrillFilter("Discipline", discipline, listOf("ALL") + ExtensionDisciplines) { discipline = it }
                DrillFilter("Context", context, listOf("ALL", "INDIVIDUAL", "GROUP")) { context = it }
                DrillFilter("Source", source, listOf("ALL", "SYSTEM_PREDEFINED", "CLUB_CUSTOM")) { source = it }
            }
        }
        item { Text("Showing ${filtered.size} of ${drills.size} drills", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)) }
        if (filtered.isEmpty()) item { Text("No drills match these filters.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)) }
        items(filtered, key = Drill::id) { drill ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.Top) {
                    if (drill.imageUrl != null) {
                        AsyncImage(
                            model = drillImageSource(drill.imageUrl),
                            contentDescription = "Setup image for ${drill.title}",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(92.dp).clip(RoundedCornerShape(10.dp))
                        )
                        Spacer(Modifier.width(12.dp))
                    }
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(drill.title, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text(if (drill.source == "CLUB_CUSTOM") "Club custom" else "Pre-defined", fontSize = 10.sp, color = MaterialTheme.colorScheme.primary)
                        }
                        Text("${drill.discipline} · ${drill.skillSet} · ${drill.durationMinutes} min · ${drill.contextType}", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                        if (drill.instructions.isNotBlank()) Text(drill.instructions, fontSize = 12.sp, maxLines = 3, modifier = Modifier.padding(top = 5.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 5.dp)) {
                            if (drill.source == "CLUB_CUSTOM") {
                                IconButton(onClick = { editing = drill }) {
                                    Icon(Icons.Outlined.Edit, contentDescription = "Edit ${drill.title}")
                                }
                                IconButton(onClick = { onDelete(drill) }) {
                                    Icon(Icons.Outlined.Delete, contentDescription = "Delete ${drill.title}", tint = MaterialTheme.colorScheme.error)
                                }
                            } else if (canCreate) {
                                Button(onClick = { onClone(drill) }) {
                                    Icon(Icons.Outlined.ContentCopy, contentDescription = null)
                                    Spacer(Modifier.width(4.dp))
                                    Text("Clone")
                                }
                            }
                        }
                    }
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
    editing?.let { drill ->
        EditClubDrillDialog(
            drill = drill,
            onDismiss = { editing = null },
            onSave = { title, disciplineValue, skillSet, contextValue, duration, instructions, imageUrl ->
                editing = null
                onUpdate(drill, title, disciplineValue, skillSet, contextValue, duration, instructions, imageUrl)
            }
        )
    }
}

@Composable
private fun DrillFilter(label: String, value: String, values: List<String>, onSelected: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }) { Text("$label: $value") }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            values.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = { onSelected(option); expanded = false })
            }
        }
    }
}

private fun drillImageSource(url: String): String = when {
    url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") -> url
    else -> BuildConfig.API_BASE_URL.trimEnd('/') + "/" + url.trimStart('/')
}

@Composable
private fun EditClubDrillDialog(drill: Drill, onDismiss: () -> Unit, onSave: (String, String, String, String, Int, String, String?) -> Unit) {
    val appContext = LocalContext.current
    var title by remember(drill.id) { mutableStateOf(drill.title) }
    var skillSet by remember(drill.id) { mutableStateOf(drill.skillSet) }
    var discipline by remember(drill.id) { mutableStateOf(drill.discipline) }
    var contextType by remember(drill.id) { mutableStateOf(drill.contextType) }
    var duration by remember(drill.id) { mutableStateOf(drill.durationMinutes.toString()) }
    var instructions by remember(drill.id) { mutableStateOf(drill.instructions) }
    var imageUrl by remember(drill.id) { mutableStateOf(drill.imageUrl) }
    var imageError by remember(drill.id) { mutableStateOf("") }
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        try {
            val mimeType = appContext.contentResolver.getType(uri)
            require(mimeType == "image/png" || mimeType == "image/jpeg") { "Choose a PNG or JPEG image." }
            val bytes = readBoundedImage(appContext, uri, 10 * 1024 * 1024)
            imageUrl = "data:$mimeType;base64,${Base64.getEncoder().encodeToString(bytes)}"
            imageError = ""
        } catch (failure: Exception) {
            imageError = failure.message ?: "Unable to read the selected image."
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text("Edit Drill", fontWeight = FontWeight.Bold)
                Text("Update this drill's details, setup instructions, and reference image.", fontSize = 13.sp, fontWeight = FontWeight.Normal)
            }
        },
        text = {
            Column(Modifier.heightIn(max = 560.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HorizontalDivider()
                OutlinedTextField(title, { title = it }, label = { Text("Drill title") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    DrillSelectField("Discipline", discipline, ExtensionDisciplines, { discipline = it }, Modifier.weight(1f))
                    DrillSelectField("Context", contextType, listOf("INDIVIDUAL", "GROUP"), { contextType = it }, Modifier.weight(1f))
                }
                OutlinedTextField(skillSet, { skillSet = it }, label = { Text("Skill Set Focus") }, singleLine = true)
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("Duration in minutes") }, singleLine = true)
                OutlinedTextField(instructions, { instructions = it }, label = { Text("Setup Instructions") }, minLines = 3)
                Text("Setup Image (optional)", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { imagePicker.launch(arrayOf("image/png", "image/jpeg")) }) { Text("Choose file") }
                    Text(if (imageUrl == null) "No file chosen" else "Image selected", fontSize = 12.sp)
                }
                if (imageUrl != null) {
                    Box {
                        AsyncImage(
                            model = drillImageSource(imageUrl!!),
                            contentDescription = "Selected setup image",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxWidth().heightIn(max = 190.dp).clip(RoundedCornerShape(10.dp))
                        )
                        IconButton(onClick = { imageUrl = null }, modifier = Modifier.align(Alignment.TopEnd)) {
                            Icon(Icons.Outlined.Close, contentDescription = "Remove setup image", tint = MaterialTheme.colorScheme.error)
                        }
                    }
                }
                if (imageError.isNotBlank()) Text(imageError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            }
        },
        confirmButton = {
            val minutes = duration.toIntOrNull() ?: 0
            Button(onClick = { onSave(title.trim(), discipline, skillSet.trim(), contextType, minutes, instructions.trim(), imageUrl) }, enabled = title.isNotBlank() && skillSet.isNotBlank() && minutes in 5..120) { Text("Save changes") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun DrillSelectField(label: String, value: String, options: List<String>, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Column(horizontalAlignment = Alignment.Start) {
                Text(label, fontSize = 10.sp)
                Text(value, maxLines = 1)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = { onSelect(option); expanded = false })
            }
        }
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
    var viewingAnalysis by remember { mutableStateOf<VideoAnalysisEntry?>(null) }
    var capeJobs by remember { mutableStateOf<List<CapeJobSummary>>(emptyList()) }
    var capeLoading by remember { mutableStateOf(false) }
    var capeError by remember { mutableStateOf("") }
    var viewingCape by remember { mutableStateOf<CapeJobSummary?>(null) }
    val capePlayerId = selectedPlayer?.id
    LaunchedEffect(capePlayerId) {
        capeJobs = emptyList()
        capeError = ""
        val id = capePlayerId ?: return@LaunchedEffect
        capeLoading = true
        try {
            capeJobs = api.getPlayerCapeJobs(token, id)
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            capeError = failure.message ?: "Unable to load the detailed analyses."
        } finally {
            capeLoading = false
        }
    }
    var source by remember { mutableStateOf("DEVICE") }
    var selectedDriveVideo by remember { mutableStateOf<DriveVideoFile?>(null) }
    var driveMenuOpen by remember { mutableStateOf(false) }
    var driveBusy by remember { mutableStateOf(false) }
    var kinematicsBusy by remember { mutableStateOf(false) }
    var latestKinematics by remember { mutableStateOf<KinematicsOverlay?>(null) }
    val overlaySaver = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("image/png")) { uri ->
        val overlay = latestKinematics ?: return@rememberLauncherForActivityResult
        if (uri == null) return@rememberLauncherForActivityResult
        try {
            val bytes = Base64.getDecoder().decode(overlay.imageBase64)
            context.contentResolver.openOutputStream(uri)?.use { output: OutputStream -> output.write(bytes) }
                ?: error("Unable to open the selected save location.")
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to save the overlay image."
        }
    }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { selectedUri = it }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text("Video Analysis", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Run Gemini analysis, inspect kinematics, or queue detailed CAPE pose and ball tracking.", fontSize = 12.sp)
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
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background)) {
                        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Kinematic overlay", fontWeight = FontWeight.SemiBold)
                            Text("Separate AIHub analysis draws pose landmarks and highlights movement risks on a frame.", fontSize = 12.sp)
                            Button(
                                enabled = !kinematicsBusy && (selectedUri != null || (driveConnected && selectedDriveVideo != null)),
                                onClick = {
                                    scope.launch {
                                        kinematicsBusy = true
                                        error = ""
                                        try {
                                            latestKinematics = if (source == "DEVICE") {
                                                api.analyzeKinematicsVideo(context, token, selectedUri!!, discipline)
                                            } else {
                                                api.analyzeKinematicsDriveVideo(token, selectedDriveVideo!!.id, discipline)
                                            }
                                        } catch (failure: Exception) {
                                            error = failure.message ?: "Unable to create the kinematic overlay."
                                        } finally {
                                            kinematicsBusy = false
                                        }
                                    }
                                }
                            ) {
                                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                                Text(if (kinematicsBusy) " Analysing overlay…" else " Analyse and draw overlay")
                            }
                            latestKinematics?.let { overlay ->
                                Text("${overlay.issues.size} findings · ${overlay.timestampMs} ms", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                                overlay.issues.forEach { issue -> Text("• $issue", fontSize = 12.sp) }
                                TextButton(onClick = { overlaySaver.launch("ecricketcoach-kinematics.png") }) {
                                    Icon(Icons.Outlined.CloudUpload, contentDescription = null, modifier = Modifier.size(17.dp))
                                    Text(" Save overlay image")
                                }
                            }
                        }
                    }
                    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
            }
        }
        selectedPlayer?.let { player ->
            item {
                StandaloneCapeAnalysisPanel(
                    api = api,
                    token = token,
                    player = player,
                    discipline = discipline,
                    videoUri = selectedUri.takeIf { source == "DEVICE" },
                    driveFileId = selectedDriveVideo?.id.takeIf { source == "DRIVE" },
                    videoName = if (source == "DRIVE") selectedDriveVideo?.name else selectedUri?.lastPathSegment,
                    onJobQueued = {
                        scope.launch {
                            try {
                                capeJobs = api.getPlayerCapeJobs(token, player.id)
                                capeError = ""
                            } catch (failure: Exception) {
                                capeError = failure.message ?: "Unable to refresh detailed analyses."
                            }
                        }
                    }
                )
            }
        }
        latest?.let { result ->
            item {
                VideoAnalysisCard("Latest result · ${result.score}/100", result) { viewingAnalysis = result }
            }
        }
        selectedPlayer?.let { player ->
            item { Text("Detailed analyses · ${player.name}", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp)) }
            when {
                capeLoading -> item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                capeError.isNotBlank() -> item { Text(capeError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                capeJobs.isEmpty() -> item { Text("No detailed (pose) analyses for this player yet.", fontSize = 12.sp) }
            }
            items(capeJobs, key = { "cape-${it.jobId}" }) { job ->
                CapeJobCard(job) { viewingCape = job }
            }
        }
        item { Text("Recent analysis", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp)) }
        if (history.isEmpty()) item { Text("No saved video analyses yet.", fontSize = 12.sp) }
        items(history, key = VideoAnalysisEntry::id) { entry ->
            VideoAnalysisCard(entry.playerName ?: "Group analysis", entry) { viewingAnalysis = entry }
        }
    }
    viewingAnalysis?.let { entry ->
        VideoAnalysisDetailDialog(entry) { viewingAnalysis = null }
    }
    viewingCape?.let { job ->
        CapeJobDetailDialog(api, token, job, selectedPlayer?.name) { viewingCape = null }
    }
}

private fun capeJobTitle(job: CapeJobSummary): String {
    val kind = when (job.target) {
        "batter" -> "Batting"
        "bowler" -> "Bowling"
        else -> "Pose"
    }
    val detail = (job.shotType ?: job.bowlerType)?.replace('_', ' ')?.replaceFirstChar(Char::uppercase)
    return listOfNotNull("$kind analysis", detail).joinToString(" · ")
}

@Composable
private fun CapeJobCard(job: CapeJobSummary, onView: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(start = 14.dp, top = 6.dp, bottom = 10.dp, end = 4.dp)) {
            Column(Modifier.weight(1f).padding(top = 8.dp)) {
                Text(capeJobTitle(job), fontWeight = FontWeight.SemiBold)
                Text(
                    listOfNotNull(
                        if (job.assessmentId != null) "Assessment" else "Video analysis",
                        when (job.status) {
                            "SUCCEEDED" -> job.score?.let { "$it/100" }
                            "FAILED" -> "Failed"
                            "RUNNING" -> "Analysing…"
                            else -> "Queued"
                        },
                        job.createdAt.take(10).ifBlank { null }
                    ).joinToString(" · "),
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    when (job.status) {
                        "SUCCEEDED" -> listOfNotNull(
                            job.verdict,
                            if (job.faultCount > 0) "${job.faultCount} fault${if (job.faultCount == 1) "" else "s"} to fix" else null
                        ).joinToString(" · ").ifBlank { "Analysis complete." }
                        "FAILED" -> job.errorMessage ?: "The analysis failed."
                        else -> "The analysis is still in progress."
                    },
                    fontSize = 12.sp,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            IconButton(onClick = onView, enabled = job.status == "SUCCEEDED") {
                Icon(Icons.Outlined.Visibility, contentDescription = "View detailed analysis", tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

// Full-screen view of one CAPE job, using the same result panel as assessments.
@Composable
private fun CapeJobDetailDialog(api: CoachApi, token: String, summary: CapeJobSummary, playerName: String?, onDismiss: () -> Unit) {
    var job by remember(summary.jobId) { mutableStateOf<CapeJob?>(null) }
    var error by remember(summary.jobId) { mutableStateOf("") }
    LaunchedEffect(summary.jobId) {
        try {
            job = api.getCapeJob(token, summary.jobId)
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to load the analysis."
        }
    }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize()) {
                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(capeJobTitle(summary), fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Text(
                            listOfNotNull(playerName, summary.createdAt.take(10).ifBlank { null }).joinToString(" · "),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = onDismiss) { Icon(Icons.Outlined.Close, contentDescription = "Close") }
                }
                HorizontalDivider()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                    val current = job
                    val result = current?.result
                    when {
                        error.isNotBlank() -> Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                        current == null -> LinearProgressIndicator(Modifier.fillMaxWidth())
                        result == null -> Text(current.errorMessage ?: "This analysis has no result yet.", fontSize = 12.sp)
                        else -> CapeResultPanel(api, token, result, current.jobId, playerName, canAssign = true)
                    }
                }
            }
        }
    }
}

@Composable
private fun VideoAnalysisCard(title: String, entry: VideoAnalysisEntry, onView: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(start = 14.dp, top = 6.dp, bottom = 10.dp, end = 4.dp)) {
            Column(Modifier.weight(1f).padding(top = 8.dp)) {
                Text(title, fontWeight = FontWeight.SemiBold)
                Text(
                    listOfNotNull(
                        if (title.startsWith("Latest")) entry.playerName ?: "Group session" else null,
                        entry.discipline,
                        if (title.startsWith("Latest")) null else "${entry.score}/100",
                        entry.createdAt.take(10).ifBlank { null }
                    ).joinToString(" · "),
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    entry.detectedIssues.firstOrNull()?.let { first ->
                        if (entry.detectedIssues.size > 1) "$first (+${entry.detectedIssues.size - 1} more)" else first
                    } ?: "No specific issues were detected.",
                    fontSize = 12.sp,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            IconButton(onClick = onView) {
                Icon(Icons.Outlined.Visibility, contentDescription = "View detailed analysis", tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
private fun VideoAnalysisDetailDialog(entry: VideoAnalysisEntry, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(entry.playerName ?: "Group analysis", fontWeight = FontWeight.Bold)
                Text(
                    listOfNotNull(
                        entry.discipline,
                        entry.createdAt.take(10).ifBlank { null },
                        when (entry.sourceType) {
                            "GOOGLE_DRIVE" -> "Google Drive"
                            "LOCAL_UPLOAD", "DEVICE_UPLOAD" -> "Device upload"
                            else -> null
                        }
                    ).joinToString(" · "),
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Overall score: ${entry.score}/100", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                HorizontalDivider()
                Text("Detected issues", fontWeight = FontWeight.SemiBold)
                if (entry.detectedIssues.isEmpty()) {
                    Text("No specific issues were detected.", fontSize = 13.sp)
                } else {
                    entry.detectedIssues.forEach { Text("• $it", fontSize = 13.sp) }
                }
                if (entry.metrics.isNotEmpty()) {
                    HorizontalDivider()
                    Text("Biomechanical metrics", fontWeight = FontWeight.SemiBold)
                    entry.metrics.forEach { (key, value) ->
                        Column {
                            Text(metricLabel(key), fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                            Text(value, fontSize = 13.sp)
                        }
                    }
                }
                if (entry.recommendedDrills.isNotEmpty()) {
                    HorizontalDivider()
                    Text("Recommended drills", fontWeight = FontWeight.SemiBold)
                    entry.recommendedDrills.forEach { drill ->
                        Column {
                            Text(drill.title + if (drill.isNew) " · New" else "", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            Text(
                                listOfNotNull(
                                    drill.discipline.ifBlank { null },
                                    drill.durationMinutes.takeIf { it > 0 }?.let { "$it min" },
                                    drill.context.ifBlank { null }?.lowercase()?.replaceFirstChar(Char::uppercase)
                                ).joinToString(" · "),
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } }
    )
}

private fun metricLabel(key: String): String =
    key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar(Char::uppercase)

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

private fun readBoundedImage(context: Context, uri: Uri, maxBytes: Int = 1024 * 1024): ByteArray {
    val output = ByteArrayOutputStream()
    context.contentResolver.openInputStream(uri)?.use { input ->
        val buffer = ByteArray(8 * 1024)
        var total = 0
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            require(total <= maxBytes) { "Selected image is too large." }
            output.write(buffer, 0, read)
        }
    } ?: error("Unable to open the selected logo.")
    require(output.size() > 0) { "The selected logo file is empty." }
    return output.toByteArray()
}
