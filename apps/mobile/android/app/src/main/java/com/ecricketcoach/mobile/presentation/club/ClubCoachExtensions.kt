package com.ecricketcoach.mobile.presentation.club

import com.ecricketcoach.mobile.presentation.common.theme.AppFontSize
import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.domain.repository.*
import com.ecricketcoach.mobile.utils.*
import com.ecricketcoach.mobile.presentation.session.*
import com.ecricketcoach.mobile.presentation.assessment.*
import com.ecricketcoach.mobile.presentation.common.*
import com.ecricketcoach.mobile.BuildConfig
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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.runtime.CompositionLocalProvider
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
                    Text("Available Drill Catalogue", color = MaterialTheme.colorScheme.primary, fontSize = AppFontSize.TitleLarge, fontWeight = FontWeight.Bold)
                    Text("Pre-defined drills can be cloned into your club catalogue.", fontSize = AppFontSize.Small)
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
            AppSearchField(
                value = search,
                onValueChange = { search = it },
                placeholder = "Search title, focus, setup",
                modifier = Modifier.fillMaxWidth(),
                voicePrompt = "Say a drill to search"
            )
        }
        item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AppFilterDropdown("Discipline", (listOf("ALL") + ExtensionDisciplines).map { it to it }, discipline, { discipline = it }, Modifier.width(200.dp))
                AppFilterDropdown("Context", listOf("ALL", "INDIVIDUAL", "GROUP").map { it to it }, context, { context = it }, Modifier.width(200.dp))
                AppFilterDropdown("Source", listOf("ALL", "SYSTEM_PREDEFINED", "CLUB_CUSTOM").map { it to it }, source, { source = it }, Modifier.width(230.dp))
            }
        }
        item { Text("Showing ${filtered.size} of ${drills.size} drills", fontSize = AppFontSize.Small, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)) }
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
                            Text(if (drill.source == "CLUB_CUSTOM") "Club custom" else "Pre-defined", fontSize = AppFontSize.Micro, color = MaterialTheme.colorScheme.primary)
                        }
                        Text("${drill.discipline} · ${drill.skillSet} · ${drill.durationMinutes} min · ${drill.contextType}", fontSize = AppFontSize.Small, color = MaterialTheme.colorScheme.primary)
                        if (drill.instructions.isNotBlank()) Text(drill.instructions, fontSize = AppFontSize.Small, maxLines = 3, modifier = Modifier.padding(top = 5.dp))
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
                Text("Update this drill's details, setup instructions, and reference image.", fontSize = AppFontSize.Small, fontWeight = FontWeight.Normal)
            }
        },
        text = {
            Column(Modifier.heightIn(max = 560.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HorizontalDivider()
                AppTextField(title, { title = it }, "Drill title", voicePrompt = "Say the drill title")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    AppDropdown("Discipline", ExtensionDisciplines, discipline, { discipline = it }, Modifier.weight(1f))
                    AppDropdown("Context", listOf("INDIVIDUAL", "GROUP"), contextType, { contextType = it }, Modifier.weight(1f))
                }
                AppTextField(skillSet, { skillSet = it }, "Skill Set Focus", voicePrompt = "Say the skill set focus")
                AppNumberField(duration, { duration = it }, "Duration in minutes")
                AppTextField(instructions, { instructions = it }, "Setup Instructions", singleLine = false, minLines = 3,
                    voicePrompt = "Speak the setup instructions")
                Text("Setup Image (optional)", fontSize = AppFontSize.Small, fontWeight = FontWeight.Medium)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { imagePicker.launch(arrayOf("image/png", "image/jpeg")) }) { Text("Choose file") }
                    Text(if (imageUrl == null) "No file chosen" else "Image selected", fontSize = AppFontSize.Small)
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
                if (imageError.isNotBlank()) Text(imageError, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small)
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
                AppTextField(title, { title = it }, "Drill title", voicePrompt = "Say the drill title")
                AppTextField(skillSet, { skillSet = it }, "Skill focus", voicePrompt = "Say the skill focus")
                AppDropdown("Discipline", ExtensionDisciplines, discipline, { discipline = it }, Modifier.fillMaxWidth())
                AppDropdown("Context", listOf("INDIVIDUAL", "GROUP"), context, { context = it }, Modifier.fillMaxWidth())
                AppNumberField(duration, { duration = it }, "Duration in minutes")
                AppTextField(instructions, { instructions = it }, "Setup instructions", singleLine = false, minLines = 2,
                    voicePrompt = "Speak the setup instructions")
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
            Text("Player progression", color = MaterialTheme.colorScheme.primary, fontSize = AppFontSize.TitleLarge, fontWeight = FontWeight.Bold)
            Text("Promotions issue a certificate and update the player's current level.", fontSize = AppFontSize.Small)
        }
        item { Text("Roster", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp)) }
        if (players.isEmpty()) item { Text("No players are available.", fontSize = AppFontSize.Small) }
        items(players, key = { "player:${it.id}" }) { player ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(player.name, fontWeight = FontWeight.SemiBold)
                        Text("${player.currentLevel} · ${player.discipline}", fontSize = AppFontSize.Small)
                    }
                    if (player.currentLevel != PlayerLevels.last()) {
                        TextButton(onClick = { onPromote(player) }) { Text("Promote") }
                    } else {
                        Text("Top level", color = MaterialTheme.colorScheme.primary, fontSize = AppFontSize.Small)
                    }
                }
            }
        }
        item { Text("Certificates", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 10.dp)) }
        if (certificates.isEmpty()) item { Text("No certificates have been issued yet.", fontSize = AppFontSize.Small) }
        items(certificates, key = { "certificate:${it.id}" }) { certificate ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Text(certificate.playerName, fontWeight = FontWeight.SemiBold)
                    Text("${certificate.level} · ${certificate.discipline} · ${certificate.issuedDate}", fontSize = AppFontSize.Small, color = MaterialTheme.colorScheme.primary)
                    Text("Certificate ${certificate.number} · Coach ${certificate.coachName}", fontSize = AppFontSize.Caption)
                    if (certificate.coachNotes.isNotBlank()) Text(certificate.coachNotes, fontSize = AppFontSize.Small)
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
                AppDropdown("New level", PlayerLevels, selectedLevel, { selectedLevel = it }, Modifier.fillMaxWidth())
                AppTextField(notes, { notes = it }, "Coach notes", singleLine = false, minLines = 2, voicePrompt = "Speak coach notes")
                Text("A certificate will be issued when the promotion is saved.", fontSize = AppFontSize.Small)
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

/** Ad-hoc batting review for any player, using the same video card as the assessment page. */
@Composable
internal fun VideoAnalysisPanel(
    analysisRepository: AnalysisRepository,
    players: List<ClubMember>,
    driveConnected: Boolean,
    driveEmail: String,
    onRefreshDrive: () -> Unit,
    onNotice: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedPlayerId by rememberSaveable { mutableStateOf<String?>(null) }
    val selectedPlayer = players.firstOrNull { it.id == selectedPlayerId }
    val playerPicker: @Composable () -> Unit = {
        PlayerSearchPicker(
            players = players,
            selected = selectedPlayer,
            modifier = Modifier.widthIn(min = 190.dp, max = 260.dp),
            onSelect = { selectedPlayerId = it }
        )
    }
    // The shared video card is sized for the dense assessment page; scale its text up to match other full pages.
    val density = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(density.density, density.fontScale * 1.18f)) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            if (selectedPlayer == null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            playerPicker()
                            Spacer(Modifier.weight(1f))
                        }
                        Text(
                            if (players.isEmpty()) "No active players in this club yet." else "Select a player to start a batting video review.",
                            fontSize = AppFontSize.Small,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                val adHocAssessment = remember(selectedPlayer.id, selectedPlayer.name) {
                    PlayerAssessment(
                        id = "",
                        playerId = selectedPlayer.id,
                        playerName = selectedPlayer.name,
                        title = "Ad-hoc video analysis",
                        discipline = "BATTING",
                        scheduledDate = "",
                        status = "IN_PROGRESS",
                        metrics = emptyList(),
                        aiSummary = null,
                        aiRecommendations = emptyList()
                    )
                }
                AssessmentVideoCard(
                    analysisRepository = analysisRepository,
                    assessment = adHocAssessment,
                    driveConnected = driveConnected,
                    driveEmail = driveEmail,
                    onRefreshDrive = onRefreshDrive,
                    onDisconnectDrive = {
                        analysisRepository.disconnectGoogleDrive()
                        onRefreshDrive()
                    },
                    onNotice = onNotice,
                    headerContent = playerPicker,
                    showTitle = false
                )
            }
        }
    }
    }
}

/** Compact player picker with an inline search box in its menu. */
@Composable
private fun PlayerSearchPicker(
    players: List<ClubMember>,
    selected: ClubMember?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    val filtered = remember(players, query) {
        val q = query.trim()
        if (q.isEmpty()) players else players.filter { it.name.contains(q, ignoreCase = true) || it.email.contains(q, ignoreCase = true) }
    }
    Box(modifier) {
        Surface(
            onClick = { query = ""; expanded = true },
            modifier = Modifier.fillMaxWidth().height(36.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(10.dp)),
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.background
        ) {
            Row(Modifier.padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Group, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                Text(
                    selected?.name ?: "Select player",
                    color = if (selected == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                    fontSize = AppFontSize.Small,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(start = 6.dp)
                )
                Icon(Icons.Outlined.ExpandMore, contentDescription = "Choose player", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            }
        }
        if (expanded) Dialog(onDismissRequest = { expanded = false }) {
            Surface(
                modifier = Modifier.widthIn(min = 300.dp, max = 420.dp).heightIn(max = 480.dp),
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface
            ) {
                Column(Modifier.padding(vertical = 12.dp)) {
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Select player", fontWeight = FontWeight.Bold, fontSize = AppFontSize.BodyLarge, modifier = Modifier.weight(1f))
                        IconButton(onClick = { expanded = false }) { Icon(Icons.Outlined.Close, contentDescription = "Close") }
                    }
                    AppSearchField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = "Search players",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp).fillMaxWidth(),
                        voicePrompt = "Say a player name"
                    )
                    if (filtered.isEmpty()) {
                        Text(
                            if (players.isEmpty()) "No active players." else "No players match \"${query.trim()}\".",
                            fontSize = AppFontSize.Small,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                        )
                    }
                    LazyColumn(Modifier.fillMaxWidth()) {
                        items(filtered, key = { it.id }) { player ->
                            val isSelected = player.id == selected?.id
                            Surface(
                                onClick = { onSelect(player.id); expanded = false },
                                color = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    player.name,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Previous CAPE-based video analysis panel. Kept for when CAPE is re-enabled; not currently shown. */
@Suppress("unused")
@Composable
private fun CapeVideoAnalysisPanel(
    analysisRepository: AnalysisRepository,
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
            capeJobs = analysisRepository.getPlayerCapeJobs(id)
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
                openAiAnalysis = analysisRepository.analyzeOpenAiBattingVideo(
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
                                AppDropdown(
                                    label = "Discipline",
                                    options = ExtensionDisciplines.map { it to it },
                                    selectedKey = discipline,
                                    onSelected = { discipline = it },
                                    modifier = Modifier.weight(0.8f),
                                    leadingIcon = Icons.Outlined.AutoAwesome
                                )
                                AppDropdown(
                                    label = "Player",
                                    options = playerOptions,
                                    selectedKey = selectedPlayer?.id.orEmpty(),
                                    onSelected = { id -> selectedPlayer = players.firstOrNull { it.id == id } },
                                    modifier = Modifier.weight(0.8f),
                                    placeholder = "Select player",
                                    leadingIcon = Icons.Outlined.Group
                                )
                            }
                        } else {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                AppDropdown("Discipline", ExtensionDisciplines.map { it to it }, discipline, { discipline = it }, Modifier.weight(1f), leadingIcon = Icons.Outlined.AutoAwesome)
                                AppDropdown("Player", playerOptions, selectedPlayer?.id.orEmpty(), { id -> selectedPlayer = players.firstOrNull { it.id == id } }, Modifier.weight(1f), placeholder = "Select player", leadingIcon = Icons.Outlined.Group)
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
                                            Text("VIDEO FOOTAGE SOURCE", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = AppFontSize.Micro, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                TextButton(onClick = { source = "DEVICE" }) { Text(if (source == "DEVICE") "✓ Device video" else "Upload device video", fontSize = AppFontSize.Caption) }
                                                TextButton(onClick = { source = "DRIVE"; onRefreshDrive() }) { Text(if (source == "DRIVE") "✓ Google Drive" else "Sync from Drive", fontSize = AppFontSize.Caption) }
                                            }
                                        }
                                    } else {
                                        Text("VIDEO FOOTAGE SOURCE", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = AppFontSize.Micro, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            TextButton(onClick = { source = "DEVICE" }, modifier = Modifier.weight(1f)) { Text(if (source == "DEVICE") "✓ Device video" else "Device video", fontSize = AppFontSize.Caption) }
                                            TextButton(onClick = { source = "DRIVE"; onRefreshDrive() }, modifier = Modifier.weight(1f)) { Text(if (source == "DRIVE") "✓ Google Drive" else "Google Drive", fontSize = AppFontSize.Caption) }
                                        }
                                    }
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                        if (source == "DEVICE") {
                                            OutlinedButton(onClick = { videoPicker.launch(arrayOf("video/*")) }, shape = RoundedCornerShape(12.dp), modifier = if (isWide) Modifier else Modifier.weight(1f)) {
                                                Icon(Icons.Outlined.CloudUpload, contentDescription = null, modifier = Modifier.size(18.dp))
                                                Text(if (isWide) "  Choose device video" else "  Choose video", fontSize = AppFontSize.Small)
                                            }
                                            if (isWide) Text(selectedVideoName ?: "No video selected", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = AppFontSize.Caption, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                        } else {
                                            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                                Icon(Icons.Outlined.Cloud, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                                Column(Modifier.weight(1f).padding(start = 7.dp)) {
                                                    Text("Google Drive Cloud Vault", fontSize = AppFontSize.Small, fontWeight = FontWeight.Bold, maxLines = 1)
                                                    Text(if (driveConnected) driveEmail.ifBlank { "Connected" } else "Connect Google Drive to choose a video", fontSize = AppFontSize.Micro, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                }
                                            }
                                            if (!driveConnected) {
                                                OutlinedButton(onClick = {
                                                    try {
                                                        CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(analysisRepository.googleDriveConnectUrl()))
                                                    } catch (failure: Exception) {
                                                        error = failure.message ?: "Unable to open Google Drive authorization."
                                                    }
                                                }, shape = RoundedCornerShape(12.dp)) { Text("Connect", fontSize = AppFontSize.Caption) }
                                            } else {
                                                AppDropdown(
                                                    label = null,
                                                    options = driveVideos,
                                                    selected = selectedDriveVideo,
                                                    onSelected = { selectedDriveVideo = it },
                                                    modifier = Modifier.width(180.dp),
                                                    optionLabel = { it.name },
                                                    placeholder = "Select video",
                                                    enabled = driveVideos.isNotEmpty()
                                                )
                                            }
                                            TextButton(onClick = onRefreshDrive) { Text("↻", fontSize = AppFontSize.BodyLarge) }
                                        }
                                    }
                                    if (source == "DEVICE" && !isWide) {
                                        Text(selectedVideoName ?: "No video selected", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = AppFontSize.Micro, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                    if (source == "DRIVE" && driveConnected) {
                                        TextButton(onClick = onDisconnectDrive, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp, vertical = 0.dp)) {
                                            Text("Disconnect Google Drive", fontSize = AppFontSize.Micro)
                                        }
                                    }
                                    if (source == "DRIVE" && driveError.isNotBlank()) Text(driveError, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Caption)
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
                                        Text("OpenAI Batting Analysis", fontWeight = FontWeight.Bold, fontSize = AppFontSize.Small)
                                        Text("Find a likely contact frame and review visible technique with evidence and uncertainty.", fontSize = AppFontSize.Micro, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                                    Text(if (openAiBusy) "  Analysing batting video…" else "  Analyse batting video", fontSize = AppFontSize.Small, fontWeight = FontWeight.Bold)
                                }
                                if (discipline != "BATTING") Text("OpenAI video analysis currently supports batting.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = AppFontSize.Micro)
                                if (openAiError.isNotBlank()) Text(openAiError, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small)
                            }
                        }
                        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small)
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
                                Text("OpenAI batting report", fontWeight = FontWeight.Bold, fontSize = AppFontSize.Small)
                                Text(
                                    "${analysis.contact.status.replace('_', ' ')} contact" +
                                        (analysis.contact.timestampSeconds?.let { " · ${String.format(Locale.getDefault(), "%.2f", it)}s" } ?: " · time uncertain"),
                                    fontSize = AppFontSize.Caption,
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
                        analysisRepository = analysisRepository,
                        player = player,
                        discipline = discipline,
                        videoUri = selectedUri.takeIf { source == "DEVICE" },
                        driveFileId = selectedDriveVideo?.id.takeIf { source == "DRIVE" },
                        videoName = if (source == "DRIVE") selectedDriveVideo?.name else selectedUri?.lastPathSegment,
                        onJobQueued = {
                            scope.launch {
                                try {
                                    capeJobs = analysisRepository.getPlayerCapeJobs(player.id)
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
                        Text("Detailed analyses · ${selectedPlayer?.name}", fontWeight = FontWeight.Bold, fontSize = AppFontSize.Body)
                        TextButton(onClick = { selectedPlayer?.let { player -> scope.launch { capeJobs = analysisRepository.getPlayerCapeJobs(player.id) } } }) { Text("Refresh") }
                    }
                }
                when {
                    capeLoading -> item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                    capeError.isNotBlank() -> item { Text(capeError, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small) }
                    capeJobs.isEmpty() -> item { Text("No detailed pose analyses for this player yet.", fontSize = AppFontSize.Small) }
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
        CapeJobDetailDialog(analysisRepository, job, selectedPlayer?.name) { viewingCape = null }
    }
    pendingCapeDelete?.let { job ->
        AlertDialog(
            onDismissRequest = { if (deletingCapeJobId == null) pendingCapeDelete = null },
            title = { Text("Delete CAPE analysis?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Permanently delete ${capeJobTitle(job)} from the analysis history?")
                    if (capeDeleteError.isNotBlank()) Text(capeDeleteError, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small)
                }
            },
            confirmButton = {
                TextButton(
                    enabled = deletingCapeJobId == null,
                    onClick = {
                        deletingCapeJobId = job.jobId
                        scope.launch {
                            try {
                                analysisRepository.deleteCapeJob(job.jobId)
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
                    fontSize = AppFontSize.Small,
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
                    fontSize = AppFontSize.Small,
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
private fun CapeJobDetailDialog(analysisRepository: AnalysisRepository, summary: CapeJobSummary, playerName: String?, onDismiss: () -> Unit) {
    var job by remember(summary.jobId) { mutableStateOf<CapeJob?>(null) }
    var error by remember(summary.jobId) { mutableStateOf("") }
    LaunchedEffect(summary.jobId) {
        try {
            job = analysisRepository.getCapeJob(summary.jobId)
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
                        Text(capeJobTitle(summary), fontWeight = FontWeight.Bold, fontSize = AppFontSize.BodyLarge)
                        Text(
                            listOfNotNull(playerName, formatCapeJobTimestamp(summary.createdAt).ifBlank { null }).joinToString(" · "),
                            fontSize = AppFontSize.Small,
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
                        error.isNotBlank() -> Text(error, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small)
                        current == null -> LinearProgressIndicator(Modifier.fillMaxWidth())
                        result == null -> Text(current.errorMessage ?: "This analysis has no result yet.", fontSize = AppFontSize.Small)
                        else -> CapeResultPanel(analysisRepository, result, current.jobId, playerName, canAssign = true)
                    }
                }
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
                        Text("OpenAI Batting Analysis", fontWeight = FontWeight.Bold, fontSize = AppFontSize.BodyLarge)
                        Text("${analysis.model} · ${String.format(Locale.getDefault(), "%.1f", analysis.durationSeconds)}s video", fontSize = AppFontSize.Small, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = onDismiss) { Icon(Icons.Outlined.Close, contentDescription = "Close analysis") }
                }
                HorizontalDivider()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(analysis.summary, fontSize = AppFontSize.Body, fontWeight = FontWeight.Medium)
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
                                fontSize = AppFontSize.Caption,
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
                            Text(analysis.contact.evidence, fontSize = AppFontSize.Small)
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
            Text(title, fontWeight = FontWeight.Bold, fontSize = AppFontSize.Small)
            items.forEach { Text("• $it", fontSize = AppFontSize.Small, color = MaterialTheme.colorScheme.onSurfaceVariant) }
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
        Text("Club branding", color = MaterialTheme.colorScheme.primary, fontSize = AppFontSize.TitleLarge, fontWeight = FontWeight.Bold)
        Text("The logo is added to certificates issued from this point forward.", fontSize = AppFontSize.Small)
        Text(if (logoUrl == null) "No club logo saved." else "A club logo is currently saved.", color = MaterialTheme.colorScheme.primary)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { imagePicker.launch(arrayOf("image/png", "image/jpeg")) }, enabled = !busy) {
                Text(if (busy) "Reading…" else "Choose logo")
            }
            if (logoUrl != null) TextButton(onClick = { onSave(null) }) { Text("Remove logo") }
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small)
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
