package com.ecricketcoach.mobile

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.border
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
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.VideoLibrary
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
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
                trailingIcon = { VoiceMicButton(search, { search = it }, "Say a drill to search", singleLine = true, replace = true) },
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
                OutlinedTextField(title, { title = it }, label = { Text("Drill title") }, singleLine = true,
                    trailingIcon = { VoiceMicButton(title, { title = it }, "Say the drill title", singleLine = true, replace = true) })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    DrillSelectField("Discipline", discipline, ExtensionDisciplines, { discipline = it }, Modifier.weight(1f))
                    DrillSelectField("Context", contextType, listOf("INDIVIDUAL", "GROUP"), { contextType = it }, Modifier.weight(1f))
                }
                OutlinedTextField(skillSet, { skillSet = it }, label = { Text("Skill Set Focus") }, singleLine = true,
                    trailingIcon = { VoiceMicButton(skillSet, { skillSet = it }, "Say the skill set focus", singleLine = true, replace = true) })
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("Duration in minutes") }, singleLine = true)
                OutlinedTextField(instructions, { instructions = it }, label = { Text("Setup Instructions") }, minLines = 3,
                    trailingIcon = { VoiceMicButton(instructions, { instructions = it }, "Speak the setup instructions") })
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
                OutlinedTextField(title, { title = it }, label = { Text("Drill title") }, singleLine = true,
                    trailingIcon = { VoiceMicButton(title, { title = it }, "Say the drill title", singleLine = true, replace = true) })
                OutlinedTextField(skillSet, { skillSet = it }, label = { Text("Skill focus") }, singleLine = true,
                    trailingIcon = { VoiceMicButton(skillSet, { skillSet = it }, "Say the skill focus", singleLine = true, replace = true) })
                PickerRow("Discipline: $discipline", ExtensionDisciplines) { discipline = it }
                PickerRow("Context: $context", listOf("INDIVIDUAL", "GROUP")) { context = it }
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("Duration in minutes") }, singleLine = true)
                OutlinedTextField(instructions, { instructions = it }, label = { Text("Setup instructions") }, minLines = 2,
                    trailingIcon = { VoiceMicButton(instructions, { instructions = it }, "Speak the setup instructions") })
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
                OutlinedTextField(notes, { notes = it }, label = { Text("Coach notes") }, minLines = 2,
                    trailingIcon = { VoiceMicButton(notes, { notes = it }, "Speak coach notes") })
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
    driveConnected: Boolean,
    driveEmail: String,
    driveVideos: List<DriveVideoFile>,
    driveError: String,
    onRefreshDrive: () -> Unit,
    onDisconnectDrive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var selectedPlayer by remember { mutableStateOf<ClubMember?>(null) }
    var discipline by remember { mutableStateOf("BATTING") }
    var error by remember { mutableStateOf("") }
    var openAiBusy by remember { mutableStateOf(false) }
    var openAiError by remember { mutableStateOf("") }
    var openAiAnalysis by remember { mutableStateOf<OpenAiBattingAnalysis?>(null) }
    var showOpenAiAnalysis by remember { mutableStateOf(false) }
    var capeJobs by remember { mutableStateOf<List<CapeJobSummary>>(emptyList()) }
    var capeLoading by remember { mutableStateOf(false) }
    var capeError by remember { mutableStateOf("") }
    var viewingCape by remember { mutableStateOf<CapeJobSummary?>(null) }
    var pendingCapeDelete by remember { mutableStateOf<CapeJobSummary?>(null) }
    var deletingCapeJobId by remember { mutableStateOf<String?>(null) }
    var capeDeleteError by remember { mutableStateOf("") }
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
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { selectedUri = it }
    val playerOptions = listOf("" to "Select player") + players.map { it.id to it.name }
    val selectedVideoName = if (source == "DRIVE") selectedDriveVideo?.name else selectedUri?.lastPathSegment
    val canAnalyzeWithOpenAi = discipline == "BATTING" && if (source == "DEVICE") {
        selectedUri != null
    } else {
        driveConnected && selectedDriveVideo != null
    }

    LaunchedEffect(source, selectedUri, selectedDriveVideo?.id, selectedPlayer?.id) {
        openAiAnalysis = null
        openAiError = ""
        showOpenAiAnalysis = false
    }

    fun analyzeWithOpenAi() {
        scope.launch {
            openAiBusy = true
            openAiError = ""
            try {
                openAiAnalysis = api.analyzeOpenAiBattingVideo(
                    context = context,
                    token = token,
                    uri = selectedUri.takeIf { source == "DEVICE" },
                    driveFileId = selectedDriveVideo?.id.takeIf { source == "DRIVE" },
                    player = selectedPlayer
                )
                showOpenAiAnalysis = true
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                openAiError = failure.message ?: "Unable to analyse this batting video with OpenAI."
            } finally {
                openAiBusy = false
            }
        }
    }

    BoxWithConstraints(modifier) {
        val isWide = maxWidth >= 820.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(18.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (isWide) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                VideoAnalysisDropdown(
                                    label = "Discipline",
                                    value = discipline,
                                    options = ExtensionDisciplines.map { it to it },
                                    icon = Icons.Outlined.AutoAwesome,
                                    modifier = Modifier.weight(0.8f),
                                    onSelect = { discipline = it }
                                )
                                VideoAnalysisDropdown(
                                    label = "Player",
                                    value = selectedPlayer?.id.orEmpty(),
                                    options = playerOptions,
                                    displayValue = selectedPlayer?.name ?: "Select player",
                                    icon = Icons.Outlined.Group,
                                    modifier = Modifier.weight(0.8f),
                                    onSelect = { id -> selectedPlayer = players.firstOrNull { it.id == id } }
                                )
                            }
                        } else {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                VideoAnalysisDropdown("Discipline", discipline, ExtensionDisciplines.map { it to it }, Icons.Outlined.AutoAwesome, Modifier.weight(1f)) { discipline = it }
                                VideoAnalysisDropdown("Player", selectedPlayer?.id.orEmpty(), playerOptions, Icons.Outlined.Group, Modifier.weight(1f), selectedPlayer?.name ?: "Select player") { id -> selectedPlayer = players.firstOrNull { it.id == id } }
                            }
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

                        val sourcePanel: @Composable (Modifier) -> Unit = { panelModifier ->
                            Card(
                                modifier = panelModifier,
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background),
                                shape = RoundedCornerShape(14.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
                            ) {
                                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (isWide) {
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                            Text("VIDEO FOOTAGE SOURCE", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                TextButton(onClick = { source = "DEVICE" }) { Text(if (source == "DEVICE") "✓ Device video" else "Upload device video", fontSize = 11.sp) }
                                                TextButton(onClick = { source = "DRIVE"; onRefreshDrive() }) { Text(if (source == "DRIVE") "✓ Google Drive" else "Sync from Drive", fontSize = 11.sp) }
                                            }
                                        }
                                    } else {
                                        Text("VIDEO FOOTAGE SOURCE", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            TextButton(onClick = { source = "DEVICE" }, modifier = Modifier.weight(1f)) { Text(if (source == "DEVICE") "✓ Device video" else "Device video", fontSize = 11.sp) }
                                            TextButton(onClick = { source = "DRIVE"; onRefreshDrive() }, modifier = Modifier.weight(1f)) { Text(if (source == "DRIVE") "✓ Google Drive" else "Google Drive", fontSize = 11.sp) }
                                        }
                                    }
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                        if (source == "DEVICE") {
                                            OutlinedButton(onClick = { videoPicker.launch(arrayOf("video/*")) }, shape = RoundedCornerShape(12.dp), modifier = if (isWide) Modifier else Modifier.weight(1f)) {
                                                Icon(Icons.Outlined.CloudUpload, contentDescription = null, modifier = Modifier.size(18.dp))
                                                Text(if (isWide) "  Choose device video" else "  Choose video", fontSize = 12.sp)
                                            }
                                            if (isWide) Text(selectedVideoName ?: "No video selected", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                        } else {
                                            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                                Icon(Icons.Outlined.Cloud, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                                Column(Modifier.weight(1f).padding(start = 7.dp)) {
                                                    Text("Google Drive Cloud Vault", fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                                    Text(if (driveConnected) driveEmail.ifBlank { "Connected" } else "Connect Google Drive to choose a video", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                }
                                            }
                                            if (!driveConnected) {
                                                OutlinedButton(onClick = {
                                                    try {
                                                        CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(api.googleDriveConnectUrl(token)))
                                                    } catch (failure: Exception) {
                                                        error = failure.message ?: "Unable to open Google Drive authorization."
                                                    }
                                                }, shape = RoundedCornerShape(12.dp)) { Text("Connect", fontSize = 11.sp) }
                                            } else {
                                                Box {
                                                    OutlinedButton(onClick = { driveMenuOpen = true }, enabled = driveVideos.isNotEmpty(), shape = RoundedCornerShape(12.dp)) {
                                                        Text(selectedDriveVideo?.name ?: "Select video", maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 11.sp)
                                                        Icon(Icons.Outlined.ExpandMore, contentDescription = null, modifier = Modifier.size(16.dp))
                                                    }
                                                    DropdownMenu(expanded = driveMenuOpen, onDismissRequest = { driveMenuOpen = false }) {
                                                        driveVideos.forEach { video -> DropdownMenuItem(text = { Text(video.name) }, onClick = { selectedDriveVideo = video; driveMenuOpen = false }) }
                                                    }
                                                }
                                            }
                                            TextButton(onClick = onRefreshDrive) { Text("↻", fontSize = 16.sp) }
                                        }
                                    }
                                    if (source == "DEVICE" && !isWide) {
                                        Text(selectedVideoName ?: "No video selected", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                    if (source == "DRIVE" && driveConnected) {
                                        TextButton(onClick = onDisconnectDrive, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp, vertical = 0.dp)) {
                                            Text("Disconnect Google Drive", fontSize = 10.sp)
                                        }
                                    }
                                    if (source == "DRIVE" && driveError.isNotBlank()) Text(driveError, color = MaterialTheme.colorScheme.error, fontSize = 11.sp)
                                }
                            }
                        }

                        sourcePanel(Modifier.fillMaxWidth())
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                                    Column(Modifier.weight(1f).padding(start = 8.dp)) {
                                        Text("OpenAI Batting Analysis", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        Text("Find a likely contact frame and review visible technique with evidence and uncertainty.", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                                Button(
                                    onClick = { analyzeWithOpenAi() },
                                    enabled = canAnalyzeWithOpenAi && !openAiBusy,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    if (openAiBusy) CircularProgressIndicator(Modifier.size(17.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                                    else Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(17.dp))
                                    Text(if (openAiBusy) "  Analysing batting video…" else "  Analyse batting video", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                if (discipline != "BATTING") Text("OpenAI video analysis currently supports batting.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                                if (openAiError.isNotBlank()) Text(openAiError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                            }
                        }
                        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }
                }
            }
            openAiAnalysis?.let { analysis ->
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
                    ) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("OpenAI batting report", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(
                                    "${analysis.contact.status.replace('_', ' ')} contact" +
                                        (analysis.contact.timestampSeconds?.let { " · ${String.format(Locale.getDefault(), "%.2f", it)}s" } ?: " · time uncertain"),
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            TextButton(onClick = { showOpenAiAnalysis = true }) { Text("View report") }
                        }
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
            if (selectedPlayer != null) {
                item {
                    Row(Modifier.fillMaxWidth().padding(top = 2.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Detailed analyses · ${selectedPlayer?.name}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        TextButton(onClick = { selectedPlayer?.let { player -> scope.launch { capeJobs = api.getPlayerCapeJobs(token, player.id) } } }) { Text("Refresh") }
                    }
                }
                when {
                    capeLoading -> item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                    capeError.isNotBlank() -> item { Text(capeError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                    capeJobs.isEmpty() -> item { Text("No detailed pose analyses for this player yet.", fontSize = 12.sp) }
                }
                items(capeJobs.sortedByDescending { capeJobTimestampMillis(it.createdAt) }, key = { "cape-${it.jobId}" }) { job ->
                    CapeJobCard(
                        job = job,
                        onView = { viewingCape = job },
                        onDelete = { pendingCapeDelete = job; capeDeleteError = "" }
                    )
                }
            }
        }
    }
    viewingCape?.let { job ->
        CapeJobDetailDialog(api, token, job, selectedPlayer?.name) { viewingCape = null }
    }
    pendingCapeDelete?.let { job ->
        AlertDialog(
            onDismissRequest = { if (deletingCapeJobId == null) pendingCapeDelete = null },
            title = { Text("Delete CAPE analysis?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Permanently delete ${capeJobTitle(job)} from the analysis history?")
                    if (capeDeleteError.isNotBlank()) Text(capeDeleteError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
            },
            confirmButton = {
                TextButton(
                    enabled = deletingCapeJobId == null,
                    onClick = {
                        deletingCapeJobId = job.jobId
                        scope.launch {
                            try {
                                api.deleteCapeJob(token, job.jobId)
                                capeJobs = capeJobs.filterNot { it.jobId == job.jobId }
                                if (viewingCape?.jobId == job.jobId) viewingCape = null
                                pendingCapeDelete = null
                            } catch (failure: Exception) {
                                capeDeleteError = failure.message ?: "Unable to delete this CAPE analysis."
                            } finally {
                                deletingCapeJobId = null
                            }
                        }
                    }
                ) { Text(if (deletingCapeJobId == job.jobId) "Deleting…" else "Delete") }
            },
            dismissButton = { TextButton(onClick = { pendingCapeDelete = null }, enabled = deletingCapeJobId == null) { Text("Cancel") } }
        )
    }
    if (showOpenAiAnalysis) {
        openAiAnalysis?.let { analysis ->
            OpenAiBattingAnalysisDialog(analysis) { showOpenAiAnalysis = false }
        }
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

private fun capeJobTimestampMillis(value: String): Long =
    runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(Long.MIN_VALUE)

private fun formatCapeJobTimestamp(value: String): String = runCatching {
    val formatter = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.getDefault())
    Instant.parse(value).atZone(ZoneId.systemDefault()).format(formatter)
}.getOrDefault(value)

@Composable
private fun CapeJobCard(job: CapeJobSummary, onView: () -> Unit, onDelete: () -> Unit) {
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
                        formatCapeJobTimestamp(job.createdAt).ifBlank { null }
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onView, enabled = job.status == "SUCCEEDED") {
                    Icon(Icons.Outlined.Visibility, contentDescription = "View detailed analysis", tint = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = onDelete, enabled = job.status != "QUEUED" && job.status != "RUNNING") {
                    Icon(Icons.Outlined.Delete, contentDescription = "Delete CAPE analysis", tint = MaterialTheme.colorScheme.error)
                }
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
                            listOfNotNull(playerName, formatCapeJobTimestamp(summary.createdAt).ifBlank { null }).joinToString(" · "),
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
private fun VideoAnalysisDropdown(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    displayValue: String = value,
    onSelect: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier) {
        Surface(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(11.dp)),
            shape = RoundedCornerShape(11.dp),
            color = MaterialTheme.colorScheme.background
        ) {
            Column(Modifier.padding(horizontal = 10.dp, vertical = 7.dp)) {
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                    Text(displayValue, color = MaterialTheme.colorScheme.onSurface, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(start = 5.dp))
                    Icon(Icons.Outlined.ExpandMore, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                }
            }

        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (optionValue, optionLabel) ->
                DropdownMenuItem(
                    text = { Text(optionLabel) },
                    onClick = { onSelect(optionValue); expanded = false }
                )
            }
        }
    }
}

@Composable
private fun OpenAiBattingAnalysisDialog(analysis: OpenAiBattingAnalysis, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize()) {
                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("OpenAI Batting Analysis", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Text("${analysis.model} · ${String.format(Locale.getDefault(), "%.1f", analysis.durationSeconds)}s video", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = onDismiss) { Icon(Icons.Outlined.Close, contentDescription = "Close analysis") }
                }
                HorizontalDivider()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(analysis.summary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)), shape = RoundedCornerShape(14.dp)) {
                        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text("Bat-ball contact · ${analysis.contact.status.replace('_', ' ')}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            Text(
                                buildString {
                                    analysis.contact.timestampSeconds?.let { append("${String.format(Locale.getDefault(), "%.3f", it)}s") }
                                    analysis.contact.frameIndex?.let { if (isNotEmpty()) append(" · "); append("frame #$it") }
                                    if (isNotEmpty()) append(" · ")
                                    append("${(analysis.contact.confidence * 100).toInt()}% confidence")
                                },
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (analysis.contact.imageDataUrl != null) {
                                AsyncImage(
                                    model = analysis.contact.imageDataUrl,
                                    contentDescription = "OpenAI selected contact candidate",
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp).clip(RoundedCornerShape(10.dp))
                                )
                            }
                            Text(analysis.contact.evidence, fontSize = 12.sp)
                        }
                    }
                    OpenAiReportSection("Visible technique", analysis.observations.map { "${it.title}: ${it.observation} ${it.coachingImplication} (${it.confidence} confidence)" })
                    OpenAiReportSection("Potential corrections", analysis.errors.map { "${it.title}: ${it.observation} ${it.coachingImplication} (${it.confidence} confidence)" })
                    OpenAiReportSection("Strengths", analysis.strengths)
                    if (analysis.priorityCue.isNotBlank()) OpenAiReportSection("Priority cue", listOf(analysis.priorityCue))
                    if (analysis.drill.title.isNotBlank()) {
                        OpenAiReportSection(
                            analysis.drill.title,
                            analysis.drill.instructions + analysis.drill.rationale.takeIf(String::isNotBlank).orEmpty()
                        )
                    }
                    OpenAiReportSection("Limitations", analysis.limitations)
                }
            }
        }
    }
}

@Composable
private fun OpenAiReportSection(title: String, items: List<String>) {
    if (items.isEmpty()) return
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            items.forEach { Text("• $it", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
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
