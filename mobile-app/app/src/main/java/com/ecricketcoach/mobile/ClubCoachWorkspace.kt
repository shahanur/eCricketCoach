package com.ecricketcoach.mobile

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.rememberDrawerState
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.res.painterResource
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.DirectionsRun
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.LibraryBooks
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Publish
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Sports
import androidx.compose.material.icons.outlined.SportsBaseball
import androidx.compose.material.icons.outlined.SportsCricket
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.io.IOException

private val ClubDisciplines = listOf("BATTING", "BOWLING", "KEEPING", "FIELDING")
private fun disciplineIcon(discipline: String) = when (discipline.uppercase()) {
    "BATTING" -> Icons.Outlined.SportsCricket
    "BOWLING" -> Icons.Outlined.SportsBaseball
    "KEEPING" -> Icons.Outlined.Security
    "FIELDING" -> Icons.Outlined.DirectionsRun
    else -> Icons.Outlined.Sports
}
private fun disciplineColor(discipline: String) = when (discipline.uppercase()) {
    "BATTING" -> Color(0xFF2E7D32)
    "BOWLING" -> Color(0xFFC62828)
    "KEEPING" -> Color(0xFF1565C0)
    "FIELDING" -> Color(0xFFEF6C00)
    else -> Color(0xFF616161)
}

@Composable
private fun DisciplineChip(discipline: String, modifier: Modifier = Modifier) {
    val color = disciplineColor(discipline)
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.12f), modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
            Icon(disciplineIcon(discipline), contentDescription = null, tint = color, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(4.dp))
            Text(discipline, fontSize = 11.sp, color = color, fontWeight = FontWeight.Medium)
        }
    }
}
private fun sessionStatusLabel(session: ClubTrainingSession) = when {
    session.isExecuted -> "Delivered"
    session.isPublished -> "Published"
    else -> "Draft"
}
private fun sessionStatusColor(session: ClubTrainingSession) = when {
    session.isExecuted -> Color(0xFF2E7D32)
    session.isPublished -> Color(0xFF1565C0)
    else -> Color(0xFF757575)
}
private val AssessmentMetricNames = mapOf(
    "BATTING" to listOf("Stance & balance", "Footwork", "Shot selection", "Timing & contact", "Running between wickets"),
    "BOWLING" to listOf("Run-up & rhythm", "Action & alignment", "Release point", "Accuracy", "Follow-through"),
    "KEEPING" to listOf("Stance & readiness", "Footwork", "Glove technique", "Catching & gathering", "Communication"),
    "FIELDING" to listOf("Ready position", "Movement & agility", "Ground fielding", "Throwing accuracy", "Communication")
)

@Composable
internal fun WorkspaceAction(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    enabled: Boolean = true,
    primary: Boolean = false,
    trailingIcon: androidx.compose.ui.graphics.vector.ImageVector? = null
) {
    if (primary) {
        Button(onClick = onClick, enabled = enabled, shape = RoundedCornerShape(14.dp)) {
            Icon(icon, contentDescription = null)
            Spacer(Modifier.padding(horizontal = 3.dp))
            Text(label)
            trailingIcon?.let {
                Spacer(Modifier.padding(horizontal = 3.dp))
                Icon(it, contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
    } else {
        TextButton(onClick = onClick, enabled = enabled) {
            Icon(icon, contentDescription = null)
            Spacer(Modifier.padding(horizontal = 2.dp))
            Text(label)
            trailingIcon?.let {
                Spacer(Modifier.padding(horizontal = 2.dp))
                Icon(it, contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun WorkspaceField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    enabled: Boolean = true
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier,
        singleLine = singleLine,
        enabled = enabled,
        shape = RoundedCornerShape(14.dp),
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
        )
    )
}

/** Read-only field that opens the native Android date picker, matching the "YYYY-MM-DD" format used across the workspace. */
@Composable
internal fun DateField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val context = LocalContext.current
    fun openPicker() {
        val initial = runCatching { LocalDate.parse(value) }.getOrDefault(LocalDate.now())
        android.app.DatePickerDialog(
            context,
            { _, year, month, day -> onValueChange(LocalDate.of(year, month + 1, day).toString()) },
            initial.year, initial.monthValue - 1, initial.dayOfMonth
        ).show()
    }
    Box(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Outlined.CalendarMonth, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
            )
        )
        if (enabled) {
            Box(
                Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { openPicker() }
            )
        }
    }
}

/** Read-only field that opens the native Android time picker, storing the value as "HH:mm". */
@Composable
internal fun TimeField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val context = LocalContext.current
    fun openPicker() {
        val parts = value.split(":").mapNotNull(String::toIntOrNull)
        val initialHour = parts.getOrNull(0) ?: 9
        val initialMinute = parts.getOrNull(1) ?: 0
        android.app.TimePickerDialog(
            context,
            { _, hour, minute -> onValueChange("%02d:%02d".format(hour, minute)) },
            initialHour, initialMinute, true
        ).show()
    }
    Box(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Outlined.AccessTime, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
            )
        )
        if (enabled) {
            Box(
                Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { openPicker() }
            )
        }
    }
}

private data class ClubWorkspaceSnapshot(
    val members: List<ClubMember>,
    val squads: List<ClubSquad>,
    val sessions: List<ClubTrainingSession>,
    val drills: List<Drill>,
    val certificates: List<ClubCertificate>,
    val videoHistory: List<VideoAnalysisEntry>,
    val logo: String?
)

@Composable
internal fun ClubCoachWorkspace(
    api: CoachApi,
    store: AuthStore,
    token: String,
    user: CoachUser,
    drills: List<Drill>,
    templates: List<TrainingTemplate>,
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onSignOut: () -> Unit
) {
    val clubId = user.tenantId.orEmpty()
    val isClubAdmin = user.role == "CLUB_ADMIN"
    val isClubCoach = user.role == "COACH" && user.coachContext == "CLUB"
    var tab by remember { mutableStateOf("Overview") }
    var members by remember { mutableStateOf<List<ClubMember>>(emptyList()) }
    var squads by remember { mutableStateOf<List<ClubSquad>>(emptyList()) }
    var sessions by remember { mutableStateOf<List<ClubTrainingSession>>(emptyList()) }
    var reportMembers by remember { mutableStateOf<List<ClubMember>>(emptyList()) }
    var reportSessions by remember { mutableStateOf<List<ClubTrainingSession>>(emptyList()) }
    var reportError by remember { mutableStateOf("") }
    var assessments by remember { mutableStateOf<List<PlayerAssessment>>(emptyList()) }
    var clubDrills by remember { mutableStateOf(drills.filter { it.id.startsWith("drill-club-") }) }
    var certificates by remember { mutableStateOf<List<ClubCertificate>>(emptyList()) }
    var videoHistory by remember { mutableStateOf<List<VideoAnalysisEntry>>(emptyList()) }
    var driveConnected by remember { mutableStateOf(false) }
    var driveEmail by remember { mutableStateOf("") }
    var driveVideos by remember { mutableStateOf<List<DriveVideoFile>>(emptyList()) }
    var driveError by remember { mutableStateOf("") }
    var clubLogo by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var notice by remember { mutableStateOf("") }
    var showInvite by remember { mutableStateOf(false) }
    var showCreateSquad by remember { mutableStateOf(false) }
    var editingSquad by remember { mutableStateOf<ClubSquad?>(null) }
    var squadEditSaving by remember { mutableStateOf(false) }
    var squadEditError by remember { mutableStateOf("") }
    var scheduleSaving by remember { mutableStateOf(false) }
    var scheduleError by remember { mutableStateOf("") }
    var editingSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var sessionEditSaving by remember { mutableStateOf(false) }
    var sessionEditError by remember { mutableStateOf("") }
    var sessionDrillBusy by remember { mutableStateOf(false) }
    var showScheduleAssessment by remember { mutableStateOf(false) }
    var editingAssessment by remember { mutableStateOf<PlayerAssessment?>(null) }
    var assessmentEditSaving by remember { mutableStateOf(false) }
    var assessmentEditError by remember { mutableStateOf("") }
    var executingSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var activeAssessment by remember { mutableStateOf<PlayerAssessment?>(null) }
    var assessmentRunSaving by remember { mutableStateOf(false) }
    var assessmentInsightsBusy by remember { mutableStateOf(false) }
    var assessmentRunError by remember { mutableStateOf("") }
    var selectedPromotionPlayer by remember { mutableStateOf<ClubMember?>(null) }
    var executionSaving by remember { mutableStateOf(false) }
    var executionError by remember { mutableStateOf("") }
    var aiAnalysisBusy by remember { mutableStateOf(false) }
    var aiAnalysisError by remember { mutableStateOf("") }
    var followUpBusy by remember { mutableStateOf(false) }
    var followUpError by remember { mutableStateOf("") }
    var createdFollowUpSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var queuedMutations by remember { mutableStateOf<List<OfflineMutation>>(emptyList()) }
    var discardMutation by remember { mutableStateOf<OfflineMutation?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun reloadQueue(): Boolean {
        try {
            queuedMutations = store.queuedMutations(user.id, clubId)
            return true
        } catch (failure: Exception) {
            error = "Unable to read the encrypted offline queue: ${failure.message ?: "storage error"}"
            return false
        }
    }

    suspend fun applyQueuedMutation(mutation: OfflineMutation) {
        when (mutation.kind) {
            OfflineMutation.UPDATE_MEMBER_SQUAD -> {
                val membersAtServer = api.getClubMembers(token, clubId)
                val member = membersAtServer.firstOrNull { it.id == mutation.resourceId }
                    ?: throw OfflineMutationConflict("The member no longer belongs to this club. This change was not replayed.")
                val targetSquad = JSONObject(mutation.payload).getString("squad")
                when (member.squad) {
                    targetSquad -> return
                    mutation.baseValue -> api.updateClubMember(
                        token,
                        mutation.resourceId,
                        JSONObject(mutation.payload),
                        operationId = mutation.id
                    )
                    else -> throw OfflineMutationConflict(
                        "Squad assignment changed on the server from '${mutation.baseValue}' to '${member.squad}'. Review the roster before applying this edit."
                    )
                }
            }
            OfflineMutation.SAVE_SESSION_EXECUTION -> {
                val update = JSONObject(mutation.payload)
                val current = api.getCoachSessionExecution(token, mutation.resourceId)
                val targetLog = update.getJSONObject("executionLog")
                val targetNotes = update.optJSONObject("playerNotes") ?: JSONObject()
                val targetPostNotes = update.optString("postNotes")
                val executionAlreadySaved = canonicalJson(current.executionLog?.toString()) == canonicalJson(targetLog.toString()) &&
                    targetNotes.keys().asSequence().all { playerId ->
                        current.playerNotes.optString(playerId) == targetNotes.optString(playerId)
                    } && current.postNotes == targetPostNotes
                if (executionAlreadySaved) return
                if (canonicalJson(current.executionLog?.toString()) != canonicalJson(mutation.baseValue)) {
                    throw OfflineMutationConflict(
                        "Session execution changed on the server while this edit was offline. The queued changes were retained for review and were not applied."
                    )
                }
                api.saveSessionExecution(token, mutation.resourceId, update, operationId = mutation.id)
            }
            else -> throw OfflineMutationConflict("This queued change type is not supported and was not replayed.")
        }
    }

    suspend fun synchronizeQueuedMutations() {
        if (!reloadQueue()) return
        val work = queuedMutations.filter { it.state == "PENDING" }
        for (mutation in work) {
            try {
                applyQueuedMutation(mutation)
                store.updateQueuedMutation(mutation.copy(state = "SYNCED", error = "", attempts = mutation.attempts + 1))
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: OfflineMutationConflict) {
                store.updateQueuedMutation(mutation.copy(state = "FAILED", error = failure.message.orEmpty(), attempts = mutation.attempts + 1))
            } catch (failure: ApiException) {
                store.updateQueuedMutation(mutation.copy(
                    state = "FAILED",
                    error = "Server rejected the queued edit (HTTP ${failure.statusCode}): ${failure.message}",
                    attempts = mutation.attempts + 1
                ))
            } catch (failure: IOException) {
                store.updateQueuedMutation(mutation.copy(
                    error = failure.message ?: "Network unavailable. The edit remains queued.",
                    attempts = mutation.attempts + 1
                ))
                break
            } catch (failure: Exception) {
                store.updateQueuedMutation(mutation.copy(
                    state = "FAILED",
                    error = failure.message ?: "Unable to safely apply this queued edit.",
                    attempts = mutation.attempts + 1
                ))
            }
        }
        reloadQueue()
    }

    suspend fun refresh() {
        if (clubId.isBlank()) {
            error = "This account is not linked to a club."
            return
        }
        loading = true
        error = ""
        try {
            val snapshot = coroutineScope {
                val membersRequest = async { api.getClubMembers(token, clubId) }
                val squadsRequest = async { api.getSquads(token, clubId) }
                val sessionsRequest = async { api.getClubSessions(token, clubId) }
                val drillsRequest = async { api.getClubDrills(token, clubId) }
                val certificatesRequest = async { api.getCertificates(token) }
                val videoHistoryRequest = async { api.getVideoAnalysisHistory(token) }
                val logoRequest = async { api.getClubBranding(token) }
                ClubWorkspaceSnapshot(
                    members = membersRequest.await(),
                    squads = squadsRequest.await(),
                    sessions = sessionsRequest.await(),
                    drills = drillsRequest.await(),
                    certificates = certificatesRequest.await(),
                    videoHistory = videoHistoryRequest.await(),
                    logo = logoRequest.await()
                )
            }
            members = snapshot.members
            squads = snapshot.squads
            sessions = snapshot.sessions
            clubDrills = snapshot.drills
            certificates = snapshot.certificates
            videoHistory = snapshot.videoHistory
            clubLogo = snapshot.logo
            try {
                val (scopedMembers, scopedSessions) = api.getClubSessionReportData(token)
                reportMembers = scopedMembers
                reportSessions = scopedSessions
                reportError = ""
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                reportError = failure.message ?: "Unable to load this club's session report."
            }
            if (isClubAdmin || isClubCoach) {
                assessments = api.getPlayerAssessments(token)
            }
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to synchronize club workspace."
        } finally {
            loading = false
        }
    }

    fun assignMemberToSquad(member: ClubMember, squad: String) {
        scope.launch {
            error = ""
            notice = ""
            if (queuedMutations.any {
                    it.kind == OfflineMutation.UPDATE_MEMBER_SQUAD &&
                        it.resourceId == member.id && it.state == "PENDING"
                }) {
                error = "This member already has a pending offline assignment. Sync it before making another change."
                return@launch
            }
            try {
                api.updateClubMember(token, member.id, JSONObject().put("squad", squad))
                refresh()
                notice = "${member.name} assigned to $squad."
            } catch (failure: IOException) {
                try {
                    store.enqueueMutation(
                        OfflineMutation(
                            userId = user.id,
                            tenantId = clubId,
                            kind = OfflineMutation.UPDATE_MEMBER_SQUAD,
                            resourceId = member.id,
                            payload = JSONObject().put("squad", squad).toString(),
                            baseValue = member.squad
                        )
                    )
                    reloadQueue()
                    notice = "Squad assignment saved on this device and queued for synchronization. It is not yet saved on the server."
                } catch (storageFailure: Exception) {
                    error = "The network is unavailable and this edit could not be safely queued: ${storageFailure.message ?: "encrypted storage error"}"
                }
            } catch (failure: Exception) {
                error = failure.message ?: "Unable to update member assignment."
            }
        }
    }

    LaunchedEffect(token, clubId) {
        reloadQueue()
        synchronizeQueuedMutations()
        refresh()
    }
    DisposableEffect(token, clubId) {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                scope.launch {
                    synchronizeQueuedMutations()
                    refresh()
                }
            }
        }
        manager.registerDefaultNetworkCallback(callback)
        onDispose { manager.unregisterNetworkCallback(callback) }
    }
    LaunchedEffect(token) {
        if (token.isNotBlank()) {
            try {
                val (connected, email) = api.getGoogleDriveStatus(token)
                driveConnected = connected
                driveEmail = email.orEmpty()
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                driveError = failure.message ?: "Unable to check Google Drive connection."
            }
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val isTablet = maxWidth >= 600.dp
        val workspaceTabs = remember(isClubAdmin) {
            buildList {
                add("Overview")
                if (isClubAdmin) add("Roster")
                addAll(listOf("Squads", "Sessions", "Assessments", "Reports", "Certificates", "Drills", "Club drills", "Templates", "Progression", "Video analysis"))
                if (isClubAdmin) add("Settings")
            }
        }
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        val sectionTab = workspaceSectionFor(tab)
        val bottomTabs = listOf("Overview", "Squads", "Sessions", "Assessments")
        ModalNavigationDrawer(
            drawerState = drawerState,
            gesturesEnabled = !isTablet && drawerState.isOpen,
            drawerContent = {
                if (!isTablet) {
                    ModalDrawerSheet(Modifier.widthIn(max = 300.dp)) {
                        Column(Modifier.fillMaxHeight().verticalScroll(rememberScrollState()).padding(vertical = 12.dp)) {
                            Row(Modifier.padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Image(
                                    painterResource(R.drawable.ic_launcher),
                                    contentDescription = null,
                                    modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp))
                                )
                                Spacer(Modifier.width(12.dp))
                                Column {
                                    Text("eCricketCoach", fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = MaterialTheme.colorScheme.primary)
                                    Text(
                                        user.clubName?.takeIf(String::isNotBlank) ?: "Club workspace",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                        maxLines = 1
                                    )
                                }
                            }
                            HorizontalDivider(Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                            workspaceTabs.forEach { item ->
                                NavigationDrawerItem(
                                    label = { Text(item, fontWeight = FontWeight.SemiBold) },
                                    icon = { Icon(workspaceTabIcon(item), contentDescription = null) },
                                    selected = sectionTab == item,
                                    onClick = {
                                        tab = item
                                        scope.launch { drawerState.close() }
                                    },
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 1.dp)
                                )
                            }
                        }
                    }
                }
            }
        ) {
        Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().weight(1f)) {
            if (isTablet) {
                NavigationRail(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                ) {
                    workspaceTabs.forEach { item ->
                        NavigationRailItem(
                            selected = sectionTab == item,
                            onClick = { tab = item },
                            icon = { Icon(workspaceTabIcon(item), contentDescription = item) },
                            label = { Text(item, fontSize = 10.sp, maxLines = 1) },
                            colors = androidx.compose.material3.NavigationRailItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.onPrimary,
                                indicatorColor = MaterialTheme.colorScheme.onPrimary,
                                unselectedIconColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f),
                                unselectedTextColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                            )
                        )
                    }
                }
            }
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .background(Brush.verticalGradient(listOf(MaterialTheme.colorScheme.background, MaterialTheme.colorScheme.surface.copy(alpha = 0.82f))))
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 2.dp, bottom = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (!isTablet) {
                        IconButton(onClick = { scope.launch { drawerState.open() } }, modifier = Modifier.padding(end = 4.dp)) {
                            Icon(Icons.Outlined.Menu, contentDescription = "Open menu", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Welcome, ${user.name}",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                        Text(
                            user.clubName?.takeIf(String::isNotBlank) ?: "Club workspace",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            fontSize = 11.sp,
                            maxLines = 1
                        )
                    }
                    IconButton(onClick = onToggleTheme) {
                        Icon(
                            if (isDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
                            contentDescription = if (isDark) "Switch to light theme" else "Switch to dark theme",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = onSignOut) {
                        Icon(
                            Icons.AutoMirrored.Outlined.Logout,
                            contentDescription = "Sign out",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                if (!isTablet && sectionTab != tab) {
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 8.dp, bottom = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            sectionTab,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable { tab = sectionTab }.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                        Icon(
                            Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(tab, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f), modifier = Modifier.padding(horizontal = 4.dp))
                    }
                }
                Spacer(Modifier.height(if (isTablet) 0.dp else 6.dp))
                if (error.isNotBlank()) {
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(vertical = 6.dp))
        }
        if (notice.isNotBlank()) {
            Text(notice, color = MaterialTheme.colorScheme.primary, fontSize = 13.sp, modifier = Modifier.padding(vertical = 6.dp))
        }
        val pendingCount = queuedMutations.count { it.state == "PENDING" }
        val failedMutations = queuedMutations.filter { it.state == "FAILED" }
        val syncedCount = queuedMutations.count { it.state == "SYNCED" }
        if (queuedMutations.isNotEmpty()) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Offline edits: $pendingCount pending · ${failedMutations.size} failed · $syncedCount synced", fontWeight = FontWeight.SemiBold)
                    failedMutations.take(3).forEach { mutation ->
                        Text("${mutation.kind} · ${mutation.error}", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                        TextButton(onClick = { discardMutation = mutation }) { Text("Discard this failed edit…") }
                    }
                }
            }
        }
        val onExecuteSession: (ClubTrainingSession) -> Unit = { session ->
            scope.launch {
                executionError = ""
                if (queuedMutations.any {
                        it.kind == OfflineMutation.SAVE_SESSION_EXECUTION &&
                            it.resourceId == session.id && it.state == "PENDING"
                    }) {
                    error = "This session already has unsynchronized progress. Sync it before making another execution edit."
                    return@launch
                }
                try {
                    executingSession = api.getCoachSessionExecution(token, session.id)
                } catch (failure: IOException) {
                    executingSession = session
                    notice = "Offline session workspace opened from the last synchronized copy. Saves will remain pending until the assigned coach can sync."
                } catch (failure: Exception) {
                    error = failure.message ?: "Unable to load the assigned session execution."
                }
            }
        }
        when (tab) {
            "Overview" -> OverviewPanel(
                coachName = user.name,
                clubName = user.clubName ?: "Club",
                userId = user.id,
                members = members,
                squads = squads,
                sessions = sessions,
                assessments = assessments,
                loading = loading,
                onOpen = { tab = it },
                onExecute = onExecuteSession,
                modifier = Modifier.weight(1f)
            )
            "Delivered sessions" -> DeliveredSessionsPanel(
                clubName = user.clubName ?: "Club",
                members = members,
                sessions = sessions,
                onBack = { tab = "Overview" },
                modifier = Modifier.weight(1f)
            )
            "Participants" -> ParticipantsPanel(
                members = members,
                onBack = { tab = "Overview" },
                modifier = Modifier.weight(1f)
            )
            "Roster" -> RosterPanel(
                members = members,
                squads = squads,
                canInvite = isClubAdmin,
                onInvite = { showInvite = true },
                onAssignSquad = { member, squad -> assignMemberToSquad(member, squad) },
                modifier = Modifier.weight(1f)
            )
            "Squads" -> SquadPanel(
                squads,
                members = members,
                onCreate = { showCreateSquad = true },
                onEdit = { squad ->
                    squadEditError = ""
                    editingSquad = squad
                    tab = "Edit squad"
                },
                onDelete = { squad ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            api.deleteSquad(token, squad.id)
                            refresh()
                            notice = "Squad deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this squad."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Edit squad" -> editingSquad?.let { originalSquad ->
                val squad = squads.find { it.id == originalSquad.id } ?: originalSquad
                EditSquadPanel(
                    squad = squad,
                    isSaving = squadEditSaving,
                    saveError = squadEditError,
                    onSave = { name, ageGroup, disciplines ->
                        scope.launch {
                            squadEditSaving = true
                            squadEditError = ""
                            try {
                                api.updateSquad(
                                    token,
                                    squad.id,
                                    JSONObject()
                                        .put("name", name)
                                        .put("ageGroup", ageGroup)
                                        .put("discipline", JSONArray(disciplines))
                                )
                                editingSquad = null
                                tab = "Squads"
                                refresh()
                                notice = "Squad changes saved."
                            } catch (failure: Exception) {
                                squadEditError = failure.message ?: "Unable to save squad changes."
                            } finally {
                                squadEditSaving = false
                            }
                        }
                    },
                    onDelete = {
                        scope.launch {
                            squadEditSaving = true
                            squadEditError = ""
                            try {
                                api.deleteSquad(token, squad.id)
                                editingSquad = null
                                tab = "Squads"
                                refresh()
                                notice = "Squad deleted."
                            } catch (failure: Exception) {
                                squadEditError = failure.message ?: "Unable to delete this squad."
                            } finally {
                                squadEditSaving = false
                            }
                        }
                    },
                    onBack = { editingSquad = null; tab = "Squads" },
                    members = members,
                    onToggleMember = { member, inSquad -> assignMemberToSquad(member, if (inSquad) squad.name else "Unassigned") },
                    modifier = Modifier.weight(1f)
                )
            }
            "Sessions" -> SessionsPanel(
                sessions = sessions,
                userId = user.id,
                canDeleteAny = isClubAdmin,
                canSchedule = isClubAdmin || isClubCoach,
                canCoachSessions = isClubCoach,
                allDrills = drills + clubDrills,
                onSchedule = { scheduleError = ""; tab = "Schedule session" },
                onEdit = { session ->
                    sessionEditError = ""
                    if (queuedMutations.any {
                            it.kind == OfflineMutation.SAVE_SESSION_EXECUTION &&
                                it.resourceId == session.id && it.state == "PENDING"
                        }) {
                        error = "Sync this session's pending execution before editing its plan."
                    } else {
                        editingSession = session
                        tab = "Edit session"
                    }
                },
                onDelete = { session ->
                    scope.launch {
                        error = ""
                        try {
                            api.deleteClubSession(token, session.id)
                            sessions = sessions.filterNot { it.id == session.id }
                            refresh()
                            notice = "Scheduled session deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this session."
                        }
                    }
                },
                onPublish = { session ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            api.publishClubSession(token, session.id)
                            refresh()
                            notice = "Session published. Squad members can now see the training plan."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to publish this session."
                        }
                    }
                },
                onExecute = onExecuteSession,

                onReview = { session ->
                    scope.launch {
                        executionError = ""
                        try {
                            executingSession = api.getCoachSessionExecution(token, session.id)
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to load this completed session."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Edit session" -> editingSession?.let { originalSession ->
                val session = sessions.find { it.id == originalSession.id } ?: originalSession
                EditSessionPanel(
                    session = session,
                    squads = squads,
                    coaches = members.filter { it.role == "COACH" && it.invitationStatus == "ACTIVE" },
                    allDrills = drills + clubDrills,
                    isSaving = sessionEditSaving,
                    saveError = sessionEditError,
                    drillBusy = sessionDrillBusy,
                    onSave = { title, date, duration, squad, coach, safety ->
                        scope.launch {
                            sessionEditSaving = true
                            sessionEditError = ""
                            try {
                                val updates = sessionPlanUpdates(session, title, date, duration, squad, safety, coach)
                                val updated = api.updateClubSession(token, session.id, updates)
                                sessions = sessions.map { if (it.id == updated.id) updated else it }
                                editingSession = null
                                tab = "Sessions"
                                refresh()
                                notice = "Session changes saved."
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to save session changes."
                            } finally {
                                sessionEditSaving = false
                            }
                        }
                    },
                    onDelete = {
                        scope.launch {
                            sessionEditSaving = true
                            sessionEditError = ""
                            try {
                                api.deleteClubSession(token, session.id)
                                sessions = sessions.filterNot { it.id == session.id }
                                editingSession = null
                                tab = "Sessions"
                                refresh()
                                notice = "Scheduled session deleted."
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to delete this session."
                            } finally {
                                sessionEditSaving = false
                            }
                        }
                    },
                    onAddDrill = { drill ->
                        scope.launch {
                            sessionDrillBusy = true
                            sessionEditError = ""
                            try {
                                val updated = api.addDrillToSession(token, session.id, drill.id)
                                sessions = sessions.map { if (it.id == updated.id) updated else it }
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to add this drill."
                            } finally {
                                sessionDrillBusy = false
                            }
                        }
                    },
                    onRemoveDrill = { drillId ->
                        scope.launch {
                            sessionDrillBusy = true
                            sessionEditError = ""
                            try {
                                val updated = api.removeDrillFromSession(token, session.id, drillId)
                                sessions = sessions.map { if (it.id == updated.id) updated else it }
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to remove this drill."
                            } finally {
                                sessionDrillBusy = false
                            }
                        }
                    },
                    onBack = { editingSession = null; tab = "Sessions" },
                    modifier = Modifier.weight(1f)
                )
            }
            "Schedule session" -> ScheduleSessionPanel(
                squads = squads,
                players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
                coaches = members.filter { it.role == "COACH" && it.invitationStatus == "ACTIVE" },
                allDrills = drills + clubDrills,
                templates = templates,
                isSaving = scheduleSaving,
                saveError = scheduleError,
                onBack = { tab = "Sessions" },
                onSave = { payload ->
                    scope.launch {
                        scheduleSaving = true
                        scheduleError = ""
                        try {
                            payload.put("clubId", clubId)
                            api.scheduleClubSession(token, payload)
                            tab = "Sessions"
                            refresh()
                            notice = "Training session scheduled."
                        } catch (failure: Exception) {
                            scheduleError = failure.message ?: "Unable to schedule this session."
                        } finally {
                            scheduleSaving = false
                        }
                    }
                }
            )
            "Assessments" -> AssessmentsPanel(
                assessments,
                members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
                onSchedule = { showScheduleAssessment = true },
                onStart = { assessment ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            val started = api.updatePlayerAssessment(token, assessment.id, JSONObject().put("status", "IN_PROGRESS"))
                            assessments = assessments.map { if (it.id == started.id) started else it }
                            assessmentRunError = ""
                            activeAssessment = started
                            tab = "Assessment"
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to start this assessment."
                        }
                    }
                },
                onOpen = { assessment ->
                    assessmentRunError = ""
                    activeAssessment = assessment
                    tab = "Assessment"
                },
                onEdit = { assessment ->
                    assessmentEditError = ""
                    editingAssessment = assessment
                    tab = "Edit assessment"
                },
                onDelete = { assessment ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            api.deleteAssessment(token, assessment.id)
                            assessments = assessments.filterNot { it.id == assessment.id }
                            notice = "Assessment deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this assessment."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Edit assessment" -> editingAssessment?.let { assessment ->
                EditAssessmentPanel(
                    assessment = assessment,
                    isSaving = assessmentEditSaving,
                    saveError = assessmentEditError,
                    onSave = { title, date, time ->
                        scope.launch {
                            assessmentEditSaving = true
                            assessmentEditError = ""
                            try {
                                val body = JSONObject().put("title", title).put("scheduledDate", date)
                                body.put("scheduledTime", time)
                                val updated = api.updatePlayerAssessment(
                                    token,
                                    assessment.id,
                                    body
                                )
                                assessments = assessments.map { if (it.id == updated.id) updated else it }
                                editingAssessment = null
                                tab = "Assessments"
                                notice = "Assessment changes saved."
                            } catch (failure: Exception) {
                                assessmentEditError = failure.message ?: "Unable to save assessment changes."
                            } finally {
                                assessmentEditSaving = false
                            }
                        }
                    },
                    onDelete = {
                        scope.launch {
                            assessmentEditSaving = true
                            assessmentEditError = ""
                            try {
                                api.deleteAssessment(token, assessment.id)
                                assessments = assessments.filterNot { it.id == assessment.id }
                                editingAssessment = null
                                tab = "Assessments"
                                notice = "Assessment deleted."
                            } catch (failure: Exception) {
                                assessmentEditError = failure.message ?: "Unable to delete this assessment."
                            } finally {
                                assessmentEditSaving = false
                            }
                        }
                    },
                    onBack = { editingAssessment = null; tab = "Assessments" },
                    modifier = Modifier.weight(1f)
                )
            }
            "Assessment" -> activeAssessment?.let { assessment ->
                AssessmentRunPanel(
                    assessment = assessment,
                    isSaving = assessmentRunSaving,
                    isGeneratingInsights = assessmentInsightsBusy,
                    error = assessmentRunError,
                    onSave = { metrics, strengths, focusAreas, coachFeedback, playerFeedback, complete ->
                        scope.launch {
                            assessmentRunSaving = true
                            assessmentRunError = ""
                            try {
                                val metricRows = JSONArray()
                                metrics.forEach { metric ->
                                    metricRows.put(
                                        JSONObject()
                                            .put("name", metric.name)
                                            .put("score", metric.score ?: JSONObject.NULL)
                                            .put("note", metric.note)
                                    )
                                }
                                val body = JSONObject()
                                    .put("metrics", metricRows)
                                    .put("strengths", strengths)
                                    .put("focusAreas", focusAreas)
                                    .put("coachFeedback", coachFeedback)
                                    .put("playerFeedback", playerFeedback)
                                if (complete) body.put("status", "COMPLETED")
                                val updated = api.updatePlayerAssessment(token, assessment.id, body)
                                assessments = assessments.map { if (it.id == updated.id) updated else it }
                                activeAssessment = updated
                                notice = if (complete) "Assessment completed for ${updated.playerName}." else "Assessment progress saved."
                            } catch (failure: Exception) {
                                assessmentRunError = failure.message ?: "Unable to save this assessment."
                            } finally {
                                assessmentRunSaving = false
                            }
                        }
                    },
                    onGenerateInsights = {
                        scope.launch {
                            assessmentInsightsBusy = true
                            assessmentRunError = ""
                            try {
                                val updated = api.generateAssessmentInsights(token, assessment.id)
                                assessments = assessments.map { if (it.id == updated.id) updated else it }
                                activeAssessment = updated
                                notice = "Assessment insights generated."
                            } catch (failure: Exception) {
                                assessmentRunError = failure.message ?: "Unable to generate assessment insights."
                            } finally {
                                assessmentInsightsBusy = false
                            }
                        }
                    },
                    onDownloadReport = {
                        assessmentRunError = runCatching {
                            openClubExport(context, exportAssessmentReportPdf(context, assessment), "application/pdf", "Open assessment report")
                        }.exceptionOrNull()?.message.orEmpty()
                    },
                    onShareReport = {
                        assessmentRunError = runCatching {
                            shareClubExport(context, exportAssessmentReportPdf(context, assessment), "application/pdf", "Share assessment report")
                        }.exceptionOrNull()?.message.orEmpty()
                    },
                    onBack = { activeAssessment = null; tab = "Assessments" },
                    modifier = Modifier.weight(1f)
                )
            }
            "Reports" -> ClubReportsPanel(
                clubName = user.clubName ?: "Club",
                members = reportMembers,
                sessions = reportSessions,
                loadError = reportError,
                modifier = Modifier.weight(1f)
            )
            "Certificates" -> CertificatesPanel(
                certificates = certificates,
                canDelete = isClubAdmin,
                onDelete = { certificate ->
                    scope.launch {
                        error = ""
                        try {
                            api.deleteCertificate(token, certificate.id)
                            certificates = certificates.filterNot { it.id == certificate.id }
                            notice = "Certificate deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this certificate."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Club drills" -> ClubDrillsPanel(
                drills = clubDrills,
                canCreate = isClubCoach || isClubAdmin,
                onCreate = { title, discipline, skillSet, context, duration, instructions ->
                    scope.launch {
                        error = ""
                        try {
                            api.addClubDrill(
                                token,
                                JSONObject()
                                    .put("title", title)
                                    .put("discipline", discipline)
                                    .put("skillSet", skillSet)
                                    .put("contextType", context)
                                    .put("durationMinutes", duration)
                                    .put("instructions", instructions)
                                    .put("clubId", clubId)
                                    .put("clubName", user.clubName)
                            )
                            clubDrills = api.getClubDrills(token, clubId)
                            notice = "Club drill added to the catalogue."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to add this drill."
                        }
                    }
                },
                onDelete = { drill ->
                    scope.launch {
                        error = ""
                        try {
                            api.deleteDrill(token, drill.id)
                            clubDrills = api.getClubDrills(token, clubId)
                            notice = "Club drill deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this drill."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Progression" -> ProgressionPanel(
                certificates = certificates,
                players = members.filter { it.role == "PLAYER" },
                onPromote = { selectedPromotionPlayer = it },
                modifier = Modifier.weight(1f)
            )
            "Video analysis" -> VideoAnalysisPanel(
                api = api,
                token = token,
                players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
                history = videoHistory,
                onRefreshDrive = {
                    scope.launch {
                        try {
                            val (connected, email) = api.getGoogleDriveStatus(token)
                            driveConnected = connected
                            driveEmail = email.orEmpty()
                            driveVideos = if (connected) api.listGoogleDriveVideos(token) else emptyList()
                            driveError = ""
                        } catch (failure: Exception) {
                            driveError = failure.message ?: "Unable to refresh Google Drive status."
                        }
                    }
                },
                driveConnected = driveConnected,
                driveEmail = driveEmail,
                driveVideos = driveVideos,
                driveError = driveError,
                onDisconnectDrive = {
                    scope.launch {
                        try {
                            api.disconnectGoogleDrive(token)
                            driveConnected = false
                            driveEmail = ""
                            driveVideos = emptyList()
                            driveError = ""
                            notice = "Google Drive disconnected."
                        } catch (failure: Exception) {
                            driveError = failure.message ?: "Unable to disconnect Google Drive."
                        }
                    }
                },
                onDriveAnalyzed = { driveFileId, discipline, player ->
                    val result = api.analyzeDriveVideo(token, driveFileId, discipline, player)
                    videoHistory = listOf(result) + videoHistory
                    notice = "Google Drive video analysis completed."
                },
                onAnalyzed = { result ->
                    videoHistory = listOf(result) + videoHistory
                    notice = "Video analysis completed."
                },
                modifier = Modifier.weight(1f)
            )
            "Settings" -> ClubSettingsPanel(
                logoUrl = clubLogo,
                onSave = { logoData ->
                    scope.launch {
                        error = ""
                        try {
                            api.updateClubBranding(token, logoData)
                            clubLogo = logoData
                            notice = "Club branding saved."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to save club branding."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Drills" -> ReadOnlyDrills(drills, Modifier.weight(1f))
            else -> ReadOnlyTemplates(templates, Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            WorkspaceAction(
                label = if (loading) "Syncing…" else "Sync",
                icon = Icons.Outlined.Sync,
                onClick = {
                    scope.launch {
                        synchronizeQueuedMutations()
                        refresh()
                    }
                },
                enabled = !loading
            )
        }
            }
        }
        if (!isTablet) {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                tonalElevation = 0.dp
            ) {
                bottomTabs.forEach { item ->
                    NavigationBarItem(
                        selected = sectionTab == item,
                        onClick = { tab = item },
                        icon = { Icon(workspaceTabIcon(item), contentDescription = null) },
                        label = { Text(item, fontSize = 11.sp, maxLines = 1) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.onPrimary,
                            indicatorColor = MaterialTheme.colorScheme.onPrimary,
                            unselectedIconColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f),
                            unselectedTextColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                        )
                    )
                }
            }
        }
        }
        }
    }

    if (showInvite) {
        InviteMemberDialog(
            onDismiss = { showInvite = false },
            onSave = { name, email, role, ageGroup, discipline ->
                scope.launch {
                    error = ""
                    notice = ""
                    try {
                        api.inviteClubMember(
                            token,
                            JSONObject()
                                .put("name", name)
                                .put("email", email)
                                .put("role", role)
                                .put("ageGroup", ageGroup)
                                .put("discipline", discipline)
                                .put("clubId", clubId)
                        )
                        showInvite = false
                        refresh()
                        notice = "Invitation sent to $email."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to invite this member."
                    }
                }
            }
        )
    }
    if (showCreateSquad) {
        CreateSquadDialog(
            onDismiss = { showCreateSquad = false },
            onSave = { name, ageGroup, disciplines ->
                scope.launch {
                    error = ""
                    try {
                        api.createSquad(
                            token,
                            JSONObject()
                                .put("name", name)
                                .put("ageGroup", ageGroup)
                                .put("discipline", JSONArray(disciplines))
                                .put("memberIds", JSONArray())
                                .put("clubId", clubId)
                        )
                        showCreateSquad = false
                        refresh()
                        notice = "Squad created."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to create squad."
                    }
                }
            }
        )
    }
    if (showScheduleAssessment) {
        ScheduleAssessmentDialog(
            players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
            onDismiss = { showScheduleAssessment = false },
            onSave = { player, title, date, time, discipline ->
                scope.launch {
                    error = ""
                    try {
                        val body = JSONObject()
                            .put("title", title)
                            .put("playerId", player.id)
                            .put("discipline", discipline)
                            .put("scheduledDate", date)
                        if (time.isNotBlank()) body.put("scheduledTime", time)
                        api.schedulePlayerAssessment(
                            token,
                            body
                        )
                        showScheduleAssessment = false
                        refresh()
                        notice = "Assessment scheduled for ${player.name}."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to schedule this assessment."
                    }
                }
            }
        )
    }
    executingSession?.let { session ->
        SessionExecutionScreen(
            session = session,
            players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
            drills = drills + clubDrills,
            readOnly = session.isExecuted,
            onDismiss = {
                executingSession = null
                aiAnalysisError = ""
                followUpError = ""
                createdFollowUpSession = null
            },
            isSaving = executionSaving,
            saveError = executionError,
            aiBusy = aiAnalysisBusy,
            aiError = aiAnalysisError,
            followUpBusy = followUpBusy,
            followUpError = followUpError,
            createdFollowUp = createdFollowUpSession,
            onRunAiAnalysis = { executionLog, playerNotes, notes ->
                scope.launch {
                    aiAnalysisBusy = true
                    aiAnalysisError = ""
                    createdFollowUpSession = null
                    try {
                        val update = JSONObject()
                            .put("executionLog", executionLog)
                            .put("playerNotes", playerNotes)
                            .put("postNotes", notes)
                            .put("complete", false)
                        api.saveSessionExecution(token, session.id, update)
                        val assessed = api.assessCompletedSession(token, session.id, notes)
                        sessions = sessions.map { if (it.id == assessed.id) assessed else it }
                        executingSession = assessed
                        notice = "AI session analysis generated."
                    } catch (failure: Exception) {
                        aiAnalysisError = failure.message ?: "AI analysis failed."
                    } finally {
                        aiAnalysisBusy = false
                    }
                }
            },
            onCreateFollowUp = { payload ->
                scope.launch {
                    followUpBusy = true
                    followUpError = ""
                    try {
                        val (newSession, newDrills) = api.createFollowUpSession(token, session.id, payload)
                        clubDrills = clubDrills + newDrills.filterNot { created -> clubDrills.any { it.id == created.id } }
                        sessions = sessions + newSession
                        createdFollowUpSession = newSession
                        notice = "Follow-up session created."
                    } catch (failure: Exception) {
                        followUpError = failure.message ?: "Unable to create follow-up session."
                    } finally {
                        followUpBusy = false
                    }
                }
            },
            onSave = { executionLog, playerNotes, notes, complete ->
                scope.launch {
                    executionSaving = true
                    executionError = ""
                    try {
                        val update = JSONObject()
                            .put("executionLog", executionLog)
                            .put("playerNotes", playerNotes)
                            .put("postNotes", notes)
                            .put("complete", complete)
                        val updated = api.saveSessionExecution(
                            token,
                            session.id,
                            update
                        )
                        sessions = sessions.map { if (it.id == updated.id) updated else it }
                        executingSession = if (complete) null else updated
                        refresh()
                        notice = if (complete) "Session completed and saved." else "Session progress saved."
                    } catch (failure: IOException) {
                        try {
                            val mutation = OfflineMutation(
                                userId = user.id,
                                tenantId = clubId,
                                kind = OfflineMutation.SAVE_SESSION_EXECUTION,
                                resourceId = session.id,
                                payload = JSONObject()
                                    .put("executionLog", executionLog)
                                    .put("playerNotes", playerNotes)
                                    .put("postNotes", notes)
                                    .put("complete", complete)
                                    .toString(),
                                baseValue = session.executionLog?.toString() ?: "null"
                            )
                            store.enqueueMutation(mutation)
                            reloadQueue()
                            executingSession = null
                            notice = if (complete) {
                                "Completion is queued on this device. The session is not delivered until the server confirms synchronization."
                            } else {
                                "Execution progress is queued on this device and will sync when connectivity returns."
                            }
                        } catch (storageFailure: Exception) {
                            executionError = "Network unavailable and this edit could not be safely queued: ${storageFailure.message ?: "encrypted storage error"}"
                        }
                    } catch (failure: Exception) {
                        executionError = failure.message ?: "Unable to save session execution."
                    } finally {
                        executionSaving = false
                    }
                }
            }
        )
    }
    selectedPromotionPlayer?.let { player ->
        PromotePlayerDialog(
            player = player,
            onDismiss = { selectedPromotionPlayer = null },
            onSave = { nextLevel, notes ->
                scope.launch {
                    error = ""
                    try {
                        api.promotePlayer(token, player.id, nextLevel, user.name, notes)
                        selectedPromotionPlayer = null
                        refresh()
                        notice = "${player.name} promoted to $nextLevel."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to promote this player."
                    }
                }
            }
        )
    }
    discardMutation?.let { mutation ->
        AlertDialog(
            onDismissRequest = { discardMutation = null },
            title = { Text("Discard this failed edit?") },
            text = { Text("This permanently removes the encrypted queued change for ${mutation.resourceId}. It will not be sent to the server.") },
            confirmButton = {
                Button(onClick = {
                    store.removeQueuedMutation(mutation.id)
                    discardMutation = null
                    reloadQueue()
                }) { Text("Discard edit") }
            },
            dismissButton = { TextButton(onClick = { discardMutation = null }) { Text("Keep edit") } }
        )
    }
}

private fun workspaceSectionFor(tab: String): String = when (tab) {
    "Delivered sessions", "Participants" -> "Overview"
    "Edit squad" -> "Squads"
    "Edit session", "Schedule session" -> "Sessions"
    "Edit assessment", "Assessment" -> "Assessments"
    else -> tab
}

private fun workspaceTabIcon(label: String): androidx.compose.ui.graphics.vector.ImageVector = when (label) {
    "Overview" -> Icons.Outlined.Dashboard
    "Roster" -> Icons.Outlined.Group
    "Squads" -> Icons.Outlined.Groups
    "Sessions" -> Icons.Outlined.CalendarMonth
    "Assessments" -> Icons.Outlined.Assignment
    "Reports" -> Icons.Outlined.BarChart
    "Certificates" -> Icons.Outlined.WorkspacePremium
    "Drills" -> Icons.Outlined.FitnessCenter
    "Club drills" -> Icons.Outlined.LibraryBooks
    "Templates" -> Icons.Outlined.Description
    "Progression" -> Icons.Outlined.TrendingUp
    "Video analysis" -> Icons.Outlined.Videocam
    "Settings" -> Icons.Outlined.Settings
    else -> Icons.Outlined.Dashboard
}

@Composable
private fun WorkspaceTab(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(18.dp),
        tonalElevation = if (selected) 6.dp else 0.dp,
        shadowElevation = if (selected) 4.dp else 0.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                workspaceTabIcon(label),
                contentDescription = null,
                tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                modifier = Modifier.height(16.dp)
            )
            Text(
                label,
                color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun OverviewPanel(
    coachName: String,
    clubName: String,
    userId: String,
    members: List<ClubMember>,
    squads: List<ClubSquad>,
    sessions: List<ClubTrainingSession>,
    assessments: List<PlayerAssessment>,
    loading: Boolean,
    onOpen: (String) -> Unit,
    onExecute: (ClubTrainingSession) -> Unit,
    modifier: Modifier = Modifier
) {
    val today = LocalDate.now().toString()
    // Matches the web app's CoachOperations dashboard: "upcoming" means not yet executed,
    // with no date restriction (overdue, undelivered sessions still count as upcoming).
    val upcomingSessions = sessions
        .filter { !it.isExecuted }
        .sortedBy { it.sessionDate }
    val myUpcomingSessions = upcomingSessions.filter { it.isAssignedTo(userId) }
    val upcomingAssessments = assessments
        .filter { it.status != "COMPLETED" && it.scheduledDate >= today }
        .sortedBy { it.scheduledDate }
    val deliveredSessions = sessions.count { it.isExecuted }
    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("COACH WORKSPACE", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text("Plan sessions, monitor club events, and measure development.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 13.sp)
        }
        if (isTablet) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SummaryCard("Sessions", myUpcomingSessions.size.toString(), "Scheduled or ready to deliver", Icons.Outlined.CalendarMonth, Modifier.weight(1f), onClick = { onOpen("Sessions") })
                    SummaryCard("Assessments", upcomingAssessments.size.toString(), "Due or in progress", Icons.Outlined.Assignment, Modifier.weight(1f), onClick = { onOpen("Assessments") })
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SummaryCard("Delivered sessions", deliveredSessions.toString(), "Current coaching season", Icons.Outlined.CheckCircle, Modifier.weight(1f), onClick = { onOpen("Delivered sessions") })
                    SummaryCard("Active participants", members.count { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" }.toString(), "Players in your club", Icons.Outlined.Group, Modifier.weight(1f), onClick = { onOpen("Participants") })
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OverviewList("Next sessions and events", upcomingSessions.take(7), Modifier.weight(1f)) { session ->
                        Text(session.title, fontWeight = FontWeight.SemiBold)
                        Text("${session.squadName} · ${session.durationMinutes} min · Led by ${session.coachId ?: "Coach"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                        Text(session.sessionDate, fontSize = 12.sp, color = Color(0xFF8B88FF), fontWeight = FontWeight.SemiBold)
                    }
                    OverviewList("My upcoming sessions", myUpcomingSessions.take(7), Modifier.weight(1f), onRowClick = onExecute) { session ->
                        Text(session.title, fontWeight = FontWeight.SemiBold)
                        Text("${session.squadName} · ${session.durationMinutes} min", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                        Text(session.sessionDate, fontSize = 12.sp, color = Color(0xFF8B88FF), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        } else {
            item { SummaryCard("Sessions", myUpcomingSessions.size.toString(), "Scheduled or ready to deliver", Icons.Outlined.CalendarMonth, onClick = { onOpen("Sessions") }) }
            item { SummaryCard("Assessments", upcomingAssessments.size.toString(), "Due or in progress", Icons.Outlined.Assignment, onClick = { onOpen("Assessments") }) }
            item { SummaryCard("Delivered sessions", deliveredSessions.toString(), "Current coaching season", Icons.Outlined.CheckCircle, onClick = { onOpen("Delivered sessions") }) }
            item { SummaryCard("Active participants", members.count { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" }.toString(), "Players in your club", Icons.Outlined.Group, onClick = { onOpen("Participants") }) }
            item { OverviewList("Next sessions and events", upcomingSessions.take(7)) { session ->
                Text(session.title, fontWeight = FontWeight.SemiBold)
                Text("${session.squadName} · ${session.durationMinutes} min · Led by ${session.coachId ?: "Coach"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                Text(session.sessionDate, fontSize = 12.sp, color = Color(0xFF8B88FF), fontWeight = FontWeight.SemiBold)
            } }
            item { OverviewList("My upcoming sessions", myUpcomingSessions.take(7), onRowClick = onExecute) { session ->
                Text(session.title, fontWeight = FontWeight.SemiBold)
                Text("${session.squadName} · ${session.durationMinutes} min", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                Text(session.sessionDate, fontSize = 12.sp, color = Color(0xFF8B88FF), fontWeight = FontWeight.SemiBold)
            } }
        }
        item { Text("Assessments", color = MaterialTheme.colorScheme.primary, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
        if (upcomingAssessments.isEmpty()) {
            item { Text("Nothing scheduled.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), fontSize = 12.sp, modifier = Modifier.padding(vertical = 12.dp)) }
        } else if (isTablet) {
            items(upcomingAssessments.take(6).chunked(2)) { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    pair.forEach { assessment -> AssessmentOverviewCard(assessment, Modifier.weight(1f)) { onOpen("Assessments") } }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        } else {
            items(upcomingAssessments.take(6)) { assessment ->
                AssessmentOverviewCard(assessment, Modifier.fillMaxWidth()) { onOpen("Assessments") }
            }
        }
        item {
            Text("Coaching practice library", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LibraryLink("ECB coaching resources")
                LibraryLink("ICC development guidance")
            }
        }
        if (loading && members.isEmpty() && sessions.isEmpty()) {
            item { Text("Loading club data…", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)) }
        }
    }
}
}

@Composable
private fun AssessmentOverviewCard(assessment: PlayerAssessment, modifier: Modifier = Modifier, onView: () -> Unit) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp)) {
            Text(assessment.playerName, fontWeight = FontWeight.SemiBold)
            Text("${assessment.title} · ${assessment.discipline}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(assessment.scheduledDate, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f))
                WorkspaceAction("View", Icons.Outlined.Visibility, onView)
            }
        }
    }
}

@Composable
private fun <T> OverviewList(title: String, rows: List<T>, modifier: Modifier = Modifier, onRowClick: ((T) -> Unit)? = null, content: @Composable (T) -> Unit) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, color = MaterialTheme.colorScheme.primary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        if (rows.isEmpty()) {
            Text("Nothing scheduled.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), fontSize = 12.sp, modifier = Modifier.padding(vertical = 12.dp))
        } else {
            rows.forEach { row ->
                val cardColors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                val cardShape = RoundedCornerShape(16.dp)
                val cardElevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                if (onRowClick != null) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { onRowClick(row) },
                        colors = cardColors,
                        shape = cardShape,
                        elevation = cardElevation
                    ) {
                        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp)) { content(row) }
                    }
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = cardColors,
                        shape = cardShape,
                        elevation = cardElevation
                    ) {
                        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp)) { content(row) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LibraryLink(label: String) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(14.dp),
        tonalElevation = 3.dp
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f), fontSize = 12.sp, modifier = Modifier.padding(12.dp))
    }
}

@Composable
private fun SummaryCard(
    title: String,
    value: String,
    detail: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    Card(
        modifier = modifier,
        onClick = { onClick?.invoke() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp)
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(title, fontWeight = FontWeight.SemiBold)
                }
                Text(detail, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.padding(start = 24.dp))
            }
            Spacer(Modifier.width(10.dp))
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(50.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        value,
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontSize = if (value.length > 2) 15.sp else 19.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun RosterPanel(
    members: List<ClubMember>,
    squads: List<ClubSquad>,
    canInvite: Boolean,
    onInvite: () -> Unit,
    onAssignSquad: (ClubMember, String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Club roster", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                if (canInvite) WorkspaceAction("Invite", Icons.Outlined.Send, onInvite, primary = true)
            }
        }
        if (members.isEmpty()) item { EmptyMessage("No members found for this club.") }
        items(members, key = ClubMember::id) { member ->
            var menuOpen by remember(member.id) { mutableStateOf(false) }
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(member.name, fontWeight = FontWeight.SemiBold)
                    Text("${member.role} · ${member.email}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f))
                    Text("${member.ageGroup.ifBlank { "No age group" }} · ${member.discipline} · ${member.currentLevel}", fontSize = 12.sp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Squad: ${member.squad}", fontSize = 12.sp, modifier = Modifier.weight(1f))
                        WorkspaceAction("Assign", Icons.Outlined.Group, { menuOpen = true })
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            (listOf("Unassigned") + squads.map(ClubSquad::name)).distinct().forEach { squad ->
                                DropdownMenuItem(
                                    text = { Text(squad) },
                                    onClick = {
                                        menuOpen = false
                                        onAssignSquad(member, squad)
                                    }
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
private fun SquadPanel(
    squads: List<ClubSquad>,
    members: List<ClubMember>,
    onCreate: () -> Unit,
    onEdit: (ClubSquad) -> Unit,
    onDelete: (ClubSquad) -> Unit,
    modifier: Modifier = Modifier
) {
    var deleteTarget by remember { mutableStateOf<ClubSquad?>(null) }
    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Squads", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    WorkspaceAction("New squad", Icons.Outlined.Add, onCreate, primary = true, trailingIcon = Icons.Outlined.Groups)
                }
            }
            if (squads.isEmpty()) {
                item { EmptyMessage("Create a squad to organize your players.") }
            } else if (isTablet) {
                items(squads.chunked(2)) { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        pair.forEach { squad ->
                            SquadCard(squad, members.count { it.squad == squad.name }, Modifier.weight(1f), onEdit = { onEdit(squad) }, onDelete = { deleteTarget = squad })
                        }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            } else {
                items(squads, key = ClubSquad::id) { squad ->
                    SquadCard(squad, members.count { it.squad == squad.name }, Modifier.fillMaxWidth(), onEdit = { onEdit(squad) }, onDelete = { deleteTarget = squad })
                }
            }
        }
    }
    deleteTarget?.let { squad ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete squad?") },
            text = { Text("Permanently delete '${squad.name}'? Members will become unassigned. This cannot be undone.") },
            confirmButton = {
                Button(onClick = {
                    deleteTarget = null
                    onDelete(squad)
                }) { Text("Delete squad") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Keep squad") } }
        )
    }
}

@Composable
private fun SquadCard(squad: ClubSquad, memberCount: Int, modifier: Modifier = Modifier, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text(squad.name, fontWeight = FontWeight.SemiBold)
            Text("${squad.ageGroup} · $memberCount ${if (memberCount == 1) "member" else "members"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
            if (squad.disciplines.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 5.dp, bottom = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    squad.disciplines.forEach { discipline -> DisciplineChip(discipline) }
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)) {
                WorkspaceAction("Edit", Icons.Outlined.Edit, onEdit)
                WorkspaceAction("Delete", Icons.Outlined.Delete, onDelete)
            }
        }
    }
}

@Composable
private fun EditSquadPanel(
    squad: ClubSquad,
    members: List<ClubMember>,
    isSaving: Boolean,
    saveError: String,
    onSave: (String, String, List<String>) -> Unit,
    onDelete: () -> Unit,
    onToggleMember: (ClubMember, Boolean) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var name by remember(squad.id) { mutableStateOf(squad.name) }
    var ageGroup by remember(squad.id) { mutableStateOf(squad.ageGroup) }
    val selected = remember(squad.id) {
        mutableStateMapOf<String, Boolean>().apply { ClubDisciplines.forEach { put(it, it in squad.disciplines) } }
    }
    var deleteConfirm by remember { mutableStateOf(false) }
    var playerSearch by remember { mutableStateOf("") }
    var showPlayerPicker by remember { mutableStateOf(false) }
    val playerCount = members.count { it.role == "PLAYER" && it.squad == squad.name }

    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        Column(Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Edit squad", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            if (isTablet) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SquadDetailsCard(
                        name = name,
                        onNameChange = { name = it },
                        ageGroup = ageGroup,
                        onAgeGroupChange = { ageGroup = it },
                        selected = selected,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = { onSave(name.trim(), ageGroup.trim(), selected.filterValues { it }.keys.toList()) },
                        onDeleteRequest = { deleteConfirm = true },
                        modifier = Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
                    )
                    SquadPlayersPanel(
                        squad = squad,
                        members = members,
                        search = playerSearch,
                        onSearchChange = { playerSearch = it },
                        onToggle = onToggleMember,
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    )
                }
            } else {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SquadDetailsCard(
                        name = name,
                        onNameChange = { name = it },
                        ageGroup = ageGroup,
                        onAgeGroupChange = { ageGroup = it },
                        selected = selected,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = { onSave(name.trim(), ageGroup.trim(), selected.filterValues { it }.keys.toList()) },
                        onDeleteRequest = { deleteConfirm = true },
                        modifier = Modifier.fillMaxWidth()
                    )
                    WorkspaceAction("Manage players ($playerCount)", Icons.Outlined.Group, { showPlayerPicker = true })
                }
            }
        }
    }
    if (showPlayerPicker) {
        AlertDialog(
            onDismissRequest = { showPlayerPicker = false },
            title = { Text("Manage players") },
            text = {
                SquadPlayersPanel(
                    squad = squad,
                    members = members,
                    search = playerSearch,
                    onSearchChange = { playerSearch = it },
                    onToggle = onToggleMember,
                    modifier = Modifier.height(380.dp)
                )
            },
            confirmButton = { TextButton(onClick = { showPlayerPicker = false }) { Text("Done") } }
        )
    }
    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Delete squad?") },
            text = { Text("Permanently delete '${squad.name}'? Members will become unassigned. This cannot be undone.") },
            confirmButton = {
                Button(onClick = { deleteConfirm = false; onDelete() }) { Text("Delete squad") }
            },
            dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Keep squad") } }
        )
    }
}

@Composable
private fun SquadDetailsCard(
    name: String,
    onNameChange: (String) -> Unit,
    ageGroup: String,
    onAgeGroupChange: (String) -> Unit,
    selected: SnapshotStateMap<String, Boolean>,
    isSaving: Boolean,
    saveError: String,
    onSave: () -> Unit,
    onDeleteRequest: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            WorkspaceField(name, onNameChange, "Squad name", Modifier.fillMaxWidth(), enabled = !isSaving)
            WorkspaceField(ageGroup, onAgeGroupChange, "Age group", Modifier.fillMaxWidth(), enabled = !isSaving)
            Text("Disciplines", fontWeight = FontWeight.SemiBold)
            ClubDisciplines.forEach { discipline ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = selected[discipline] == true, onCheckedChange = { selected[discipline] = it }, enabled = !isSaving)
                    Icon(disciplineIcon(discipline), contentDescription = null, tint = disciplineColor(discipline), modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(discipline)
                }
            }
            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)) {
                WorkspaceAction("Delete", Icons.Outlined.Delete, onDeleteRequest, enabled = !isSaving)
                WorkspaceAction(
                    "Save",
                    Icons.Outlined.CheckCircle,
                    onSave,
                    enabled = !isSaving && name.isNotBlank() && selected.values.any { it },
                    primary = true
                )
            }
        }
    }
}

@Composable
private fun SquadPlayersPanel(
    squad: ClubSquad,
    members: List<ClubMember>,
    search: String,
    onSearchChange: (String) -> Unit,
    onToggle: (ClubMember, Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val players = members
        .filter { it.role == "PLAYER" }
        .filter { it.name.contains(search.trim(), ignoreCase = true) }
        .sortedByDescending { it.squad == squad.name }
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Players", fontWeight = FontWeight.SemiBold)
            WorkspaceField(search, onSearchChange, "Filter players", Modifier.fillMaxWidth())
            if (players.isEmpty()) {
                EmptyMessage("No players match this filter.")
            } else {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    players.forEach { member ->
                        val inSquad = member.squad == squad.name
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(member.name, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text(
                                    if (inSquad) "In this squad" else member.squad.ifBlank { "Unassigned" },
                                    fontSize = 11.sp,
                                    color = if (inSquad) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Surface(
                                shape = CircleShape,
                                color = if (inSquad) MaterialTheme.colorScheme.error.copy(alpha = 0.15f) else MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                                modifier = Modifier.size(32.dp)
                            ) {
                                IconButton(onClick = { onToggle(member, !inSquad) }, modifier = Modifier.size(32.dp)) {
                                    Icon(
                                        if (inSquad) Icons.Outlined.Remove else Icons.Outlined.Add,
                                        contentDescription = if (inSquad) "Remove from squad" else "Add to squad",
                                        tint = if (inSquad) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(18.dp)
                                    )
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
private fun SessionsPanel(
    sessions: List<ClubTrainingSession>,
    userId: String,
    canDeleteAny: Boolean,
    canSchedule: Boolean,
    canCoachSessions: Boolean,
    allDrills: List<Drill> = emptyList(),
    onSchedule: () -> Unit,
    onEdit: (ClubTrainingSession) -> Unit,
    onDelete: (ClubTrainingSession) -> Unit,
    onPublish: (ClubTrainingSession) -> Unit,
    onExecute: (ClubTrainingSession) -> Unit,
    onReview: (ClubTrainingSession) -> Unit,
    modifier: Modifier = Modifier
) {
    var search by remember { mutableStateOf("") }
    var fromDate by remember { mutableStateOf("") }
    var throughDate by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("ALL") }
    var statusMenuOpen by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<ClubTrainingSession?>(null) }
    val validRange = (fromDate.isBlank() || isIsoDate(fromDate)) &&
        (throughDate.isBlank() || isIsoDate(throughDate)) &&
        (fromDate.isBlank() || throughDate.isBlank() || fromDate <= throughDate)
    val filteredSessions = sessions.filter { session ->
        val sessionStatus = when {
            session.isExecuted -> "DELIVERED"
            session.isPublished -> "PUBLISHED"
            else -> "DRAFT"
        }
        session.title.contains(search.trim(), ignoreCase = true) &&
            (fromDate.isBlank() || session.sessionDate >= fromDate) &&
            (throughDate.isBlank() || session.sessionDate <= throughDate) &&
            (status == "ALL" || status == sessionStatus)
    }
    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        val sortedSessions = filteredSessions.sortedByDescending(ClubTrainingSession::sessionDate)
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Training sessions", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    if (canSchedule) WorkspaceAction("Schedule", Icons.Outlined.Add, onSchedule, primary = true, trailingIcon = Icons.Outlined.CalendarMonth)
                }
                WorkspaceField(search, { search = it }, "Filter session title", Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    DateField(fromDate, { fromDate = it }, "From date", Modifier.weight(1f))
                    DateField(throughDate, { throughDate = it }, "Through date", Modifier.weight(1f))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Status: ")
                    TextButton(onClick = { statusMenuOpen = true }) { Text(status) }
                    DropdownMenu(expanded = statusMenuOpen, onDismissRequest = { statusMenuOpen = false }) {
                        listOf("ALL", "DRAFT", "PUBLISHED", "DELIVERED").forEach { value ->
                            DropdownMenuItem(text = { Text(value) }, onClick = { status = value; statusMenuOpen = false })
                        }
                    }
                }
                if (!validRange) Text("Enter valid dates and make sure the start date is not after the end date.", color = MaterialTheme.colorScheme.error)
            }
            if (sortedSessions.isEmpty()) {
                item { EmptyMessage(if (sessions.isEmpty()) "No training sessions scheduled yet." else "No sessions match these filters.") }
            } else if (isTablet) {
                items(sortedSessions.chunked(2)) { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        pair.forEach { session ->
                            SessionCard(
                                session = session,
                                userId = userId,
                                canDeleteAny = canDeleteAny,
                                canCoachSessions = canCoachSessions,
                                allDrills = allDrills,
                                onEdit = onEdit,
                                onDelete = { deleteTarget = session },
                                onPublish = onPublish,
                                onExecute = onExecute,
                                onReview = onReview,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            } else {
                items(sortedSessions, key = ClubTrainingSession::id) { session ->
                    SessionCard(
                        session = session,
                        userId = userId,
                        canDeleteAny = canDeleteAny,
                        canCoachSessions = canCoachSessions,
                        allDrills = allDrills,
                        onEdit = onEdit,
                        onDelete = { deleteTarget = session },
                        onPublish = onPublish,
                        onExecute = onExecute,
                        onReview = onReview,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
    deleteTarget?.let { session ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete scheduled session?") },
            text = { Text("Permanently delete '${session.title}'? This cannot be undone.") },
            confirmButton = {
                Button(onClick = {
                    deleteTarget = null
                    onDelete(session)
                }) { Text("Delete session") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Keep session") } }
        )
    }
}

@Composable
private fun SessionIconAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    danger: Boolean = false
) {
    val color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = 0.12f)) {
        IconButton(onClick = onClick, modifier = Modifier.size(32.dp)) {
            Icon(icon, contentDescription = label, tint = color, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun SessionCard(
    session: ClubTrainingSession,
    userId: String,
    canDeleteAny: Boolean,
    canCoachSessions: Boolean,
    allDrills: List<Drill> = emptyList(),
    onEdit: (ClubTrainingSession) -> Unit,
    onDelete: () -> Unit,
    onPublish: (ClubTrainingSession) -> Unit,
    onExecute: (ClubTrainingSession) -> Unit,
    onReview: (ClubTrainingSession) -> Unit,
    modifier: Modifier = Modifier
) {
    var safetyExpanded by remember(session.id) { mutableStateOf(false) }
    val statusColor = sessionStatusColor(session)
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Text(session.title, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f).padding(end = 6.dp))
                Surface(shape = RoundedCornerShape(50), color = statusColor.copy(alpha = 0.15f)) {
                    Text(
                        sessionStatusLabel(session),
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }
            Text("Squad: ${session.squadName}", fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            if (!session.coachName.isNullOrBlank()) Text("Head Coach: ${session.coachName}", fontSize = 12.sp)
            Text(
                "Date: ${session.sessionDate} · Duration: ${session.durationMinutes} min",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 2.dp, bottom = 4.dp)
            )
            if (session.safety.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().clickable { safetyExpanded = !safetyExpanded }.padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (safetyExpanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(2.dp))
                    Text("Session safety", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
                if (safetyExpanded) {
                    Column(Modifier.padding(start = 18.dp, top = 2.dp, bottom = 4.dp)) {
                        session.safety.forEach { item -> Text("• $item", fontSize = 12.sp) }
                    }
                }
            }
            if (session.drillIds.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 4.dp, bottom = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    session.drillIds.distinct().forEach { drillId ->
                        val name = allDrills.find { it.id == drillId }?.title ?: "Unknown Drill"
                        Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)) {
                            Text(name, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                        }
                    }
                }
            }
            val canManage = canDeleteAny || (canCoachSessions && session.isAssignedTo(userId))
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("${session.drillIds.size} Planned Drills", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.End)
                ) {
                    if (!session.isExecuted && canManage) {
                        SessionIconAction(Icons.Outlined.Edit, "Edit", { onEdit(session) })
                        SessionIconAction(Icons.Outlined.Delete, "Delete", onDelete, danger = true)
                    }
                    if (canManage && !session.isPublished && !session.isExecuted) SessionIconAction(Icons.Outlined.Publish, "Publish", { onPublish(session) })
                    if (canCoachSessions && session.isAssignedTo(userId) && !session.isExecuted) SessionIconAction(Icons.Outlined.PlayArrow, "Run", { onExecute(session) })
                    if (canCoachSessions && session.isAssignedTo(userId) && session.isExecuted) SessionIconAction(Icons.Outlined.Visibility, "Review", { onReview(session) })
                }
            }
        }
    }
}

@Composable
private fun AssessmentsPanel(
    assessments: List<PlayerAssessment>,
    players: List<ClubMember>,
    onSchedule: () -> Unit,
    onStart: (PlayerAssessment) -> Unit,
    onOpen: (PlayerAssessment) -> Unit,
    onEdit: (PlayerAssessment) -> Unit,
    onDelete: (PlayerAssessment) -> Unit,
    modifier: Modifier = Modifier
) {
    var search by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("ALL") }
    var statusMenuOpen by remember { mutableStateOf(false) }
    var discipline by remember { mutableStateOf("ALL") }
    var disciplineMenuOpen by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<PlayerAssessment?>(null) }
    val filteredAssessments = assessments.filter { assessment ->
        (assessment.title.contains(search.trim(), ignoreCase = true) || assessment.playerName.contains(search.trim(), ignoreCase = true)) &&
            (status == "ALL" || status == assessment.status) &&
            (discipline == "ALL" || discipline == assessment.discipline)
    }
    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Player assessments", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    WorkspaceAction("Schedule", Icons.Outlined.Add, onSchedule, enabled = players.isNotEmpty(), primary = true, trailingIcon = Icons.Outlined.CalendarMonth)
                }
                WorkspaceField(search, { search = it }, "Filter by player or title", Modifier.fillMaxWidth())
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Status: ")
                    TextButton(onClick = { statusMenuOpen = true }) { Text(status) }
                    DropdownMenu(expanded = statusMenuOpen, onDismissRequest = { statusMenuOpen = false }) {
                        listOf("ALL", "SCHEDULED", "IN_PROGRESS", "COMPLETED").forEach { value ->
                            DropdownMenuItem(text = { Text(value) }, onClick = { status = value; statusMenuOpen = false })
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Text("Discipline: ")
                    TextButton(onClick = { disciplineMenuOpen = true }) { Text(discipline) }
                    DropdownMenu(expanded = disciplineMenuOpen, onDismissRequest = { disciplineMenuOpen = false }) {
                        (listOf("ALL") + ClubDisciplines).forEach { value ->
                            DropdownMenuItem(text = { Text(value) }, onClick = { discipline = value; disciplineMenuOpen = false })
                        }
                    }
                }
            }
            if (filteredAssessments.isEmpty()) {
                item { EmptyMessage(if (assessments.isEmpty()) "No assessments scheduled yet." else "No assessments match these filters.") }
            } else if (isTablet) {
                items(filteredAssessments.chunked(2)) { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        pair.forEach { assessment ->
                            AssessmentCard(
                                assessment = assessment,
                                onStart = onStart,
                                onOpen = onOpen,
                                onEdit = onEdit,
                                onDelete = { deleteTarget = assessment },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            } else {
                items(filteredAssessments, key = PlayerAssessment::id) { assessment ->
                    AssessmentCard(
                        assessment = assessment,
                        onStart = onStart,
                        onOpen = onOpen,
                        onEdit = onEdit,
                        onDelete = { deleteTarget = assessment },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
    deleteTarget?.let { assessment ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete assessment?") },
            text = { Text("Permanently delete '${assessment.title}' for ${assessment.playerName}? This cannot be undone.") },
            confirmButton = {
                Button(onClick = {
                    deleteTarget = null
                    onDelete(assessment)
                }) { Text("Delete assessment") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Keep assessment") } }
        )
    }
}

@Composable
private fun AssessmentCard(
    assessment: PlayerAssessment,
    onStart: (PlayerAssessment) -> Unit,
    onOpen: (PlayerAssessment) -> Unit,
    onEdit: (PlayerAssessment) -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.clickable(enabled = assessment.status != "SCHEDULED") { onOpen(assessment) },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text(assessment.playerName, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text(assessment.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 2.dp))
            Text(
                "${assessment.discipline} · ${assessment.scheduledDate}${assessment.scheduledTime?.let { " at $it" } ?: ""}",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 1.dp)
            )
            Text(
                assessment.status.replace('_', ' '),
                color = MaterialTheme.colorScheme.primary,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 3.dp, bottom = 6.dp)
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(bottom = 4.dp))
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)
            ) {
                WorkspaceAction("Edit", Icons.Outlined.Edit, { onEdit(assessment) })
                when (assessment.status) {
                    "SCHEDULED" -> {
                        WorkspaceAction("Delete", Icons.Outlined.Delete, onDelete)
                        WorkspaceAction("Start", Icons.Outlined.PlayArrow, { onStart(assessment) }, primary = true)
                    }
                    "IN_PROGRESS" -> WorkspaceAction("Continue", Icons.Outlined.PlayArrow, { onOpen(assessment) }, primary = true)
                    "COMPLETED" -> WorkspaceAction("View", Icons.Outlined.Visibility, { onOpen(assessment) }, primary = true)
                }
            }
        }
    }
}

@Composable
private fun EditAssessmentPanel(
    assessment: PlayerAssessment,
    isSaving: Boolean,
    saveError: String,
    onSave: (String, String, String) -> Unit,
    onDelete: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var title by remember(assessment.id) { mutableStateOf(assessment.title) }
    var scheduledDate by remember(assessment.id) { mutableStateOf(assessment.scheduledDate) }
    var scheduledTime by remember(assessment.id) { mutableStateOf(assessment.scheduledTime.orEmpty()) }
    var deleteConfirm by remember { mutableStateOf(false) }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Edit assessment", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${assessment.playerName} · ${assessment.discipline}", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                    WorkspaceField(title, { title = it }, "Assessment title", Modifier.fillMaxWidth(), enabled = !isSaving)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DateField(scheduledDate, { scheduledDate = it }, "Scheduled date", Modifier.weight(1f), enabled = !isSaving)
                        TimeField(scheduledTime, { scheduledTime = it }, "Time (optional)", Modifier.weight(1f), enabled = !isSaving)
                    }
                    if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)) {
                        if (assessment.status == "SCHEDULED") {
                            WorkspaceAction("Delete", Icons.Outlined.Delete, { deleteConfirm = true }, enabled = !isSaving)
                        }
                        WorkspaceAction(
                            "Save",
                            Icons.Outlined.CheckCircle,
                            { onSave(title.trim(), scheduledDate.trim(), scheduledTime.trim()) },
                            enabled = !isSaving && title.isNotBlank() && isIsoDate(scheduledDate),
                            primary = true
                        )
                    }
                }
            }
        }
    }
    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Delete assessment?") },
            text = { Text("Permanently delete '${assessment.title}' for ${assessment.playerName}? This cannot be undone.") },
            confirmButton = {
                Button(onClick = { deleteConfirm = false; onDelete() }) { Text("Delete assessment") }
            },
            dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Keep assessment") } }
        )
    }
}

@Composable
private fun ReadOnlyDrills(drills: List<Drill>, modifier: Modifier = Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Drill catalogue", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        if (drills.isEmpty()) item { EmptyMessage("No drills are available. Sync while online to load the catalogue.") }
        items(drills, key = Drill::id) { drill ->
            InfoCard(drill.title, "${drill.discipline} · ${drill.durationMinutes} min", listOf(drill.skillSet, drill.instructions).filter(String::isNotBlank).joinToString("\n"))
        }
    }
}

@Composable
private fun ReadOnlyTemplates(templates: List<TrainingTemplate>, modifier: Modifier = Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Training templates", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        if (templates.isEmpty()) item { EmptyMessage("No shared training templates are available.") }
        items(templates, key = TrainingTemplate::id) { template ->
            InfoCard(template.title, "${template.durationMinutes} min · ${template.disciplines.joinToString()}", template.focus)
        }
    }
}

@Composable
internal fun InfoCard(title: String, subtitle: String, details: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
            if (details.isNotBlank()) Text(details, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun EmptyMessage(message: String) {
    Text(message, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), modifier = Modifier.padding(vertical = 12.dp))
}

@Composable
private fun InviteMemberDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("PLAYER") }
    var ageGroup by remember { mutableStateOf("U15") }
    var discipline by remember { mutableStateOf("BATTING") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Invite club member") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                WorkspaceField(name, { name = it }, "Name")
                WorkspaceField(email, { email = it }, "Email")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Role: $role", modifier = Modifier.weight(1f))
                    TextButton(onClick = { role = if (role == "PLAYER") "COACH" else "PLAYER" }) { Text("Change") }
                }
                if (role == "PLAYER") {
                    WorkspaceField(ageGroup, { ageGroup = it }, "Age group")
                    DisciplinePicker(discipline) { discipline = it }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onSave(name.trim(), email.trim(), role, ageGroup.trim(), discipline) }, enabled = name.isNotBlank() && email.contains("@")) {
                Text("Send invite")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun CreateSquadDialog(onDismiss: () -> Unit, onSave: (String, String, List<String>) -> Unit) {
    var name by remember { mutableStateOf("") }
    var ageGroup by remember { mutableStateOf("U15") }
    val selected = remember { mutableStateMapOf<String, Boolean>().apply { ClubDisciplines.forEach { put(it, it == "BATTING") } } }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create squad") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                WorkspaceField(name, { name = it }, "Squad name")
                WorkspaceField(ageGroup, { ageGroup = it }, "Age group")
                Text("Disciplines")
                ClubDisciplines.forEach { discipline ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = selected[discipline] == true, onCheckedChange = { selected[discipline] = it })
                        Text(discipline)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(name.trim(), ageGroup.trim(), selected.filterValues { it }.keys.toList()) },
                enabled = name.isNotBlank() && selected.values.any { it }
            ) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun PlannedDrillChip(name: String, onRemove: () -> Unit, modifier: Modifier = Modifier) {
    Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f), modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 10.dp, end = 4.dp, top = 2.dp, bottom = 2.dp)) {
            Text(name, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium)
            IconButton(onClick = onRemove, modifier = Modifier.size(22.dp).padding(start = 2.dp)) {
                Icon(Icons.Outlined.Close, contentDescription = "Remove drill", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun AvailableDrillsPanel(
    allDrills: List<Drill>,
    isBusy: Boolean,
    onAdd: (Drill) -> Unit,
    modifier: Modifier = Modifier
) {
    var filter by remember { mutableStateOf("ALL") }
    var filterMenuOpen by remember { mutableStateOf(false) }
    val filtered = allDrills.filter { filter == "ALL" || it.discipline.equals(filter, ignoreCase = true) }
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Available Drills", fontWeight = FontWeight.SemiBold)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Discipline: ")
                TextButton(onClick = { filterMenuOpen = true }) { Text(filter) }
                DropdownMenu(expanded = filterMenuOpen, onDismissRequest = { filterMenuOpen = false }) {
                    (listOf("ALL") + ClubDisciplines).forEach { value ->
                        DropdownMenuItem(text = { Text(value) }, onClick = { filter = value; filterMenuOpen = false })
                    }
                }
            }
            if (filtered.isEmpty()) {
                EmptyMessage("No drills available for this filter.")
            } else {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    filtered.forEach { drill ->
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f).padding(end = 6.dp)) {
                                Text(drill.title, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text(
                                    "${drill.discipline} · ${drill.durationMinutes} min",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            TextButton(onClick = { onAdd(drill) }, enabled = !isBusy) {
                                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(2.dp))
                                Text("Add")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionDetailsCard(
    session: ClubTrainingSession,
    title: String,
    onTitleChange: (String) -> Unit,
    date: String,
    onDateChange: (String) -> Unit,
    duration: String,
    onDurationChange: (String) -> Unit,
    safety: String,
    onSafetyChange: (String) -> Unit,
    squads: List<ClubSquad>,
    selectedSquad: ClubSquad?,
    onSquadChange: (ClubSquad?) -> Unit,
    coaches: List<ClubMember>,
    selectedCoach: ClubMember?,
    onCoachChange: (ClubMember?) -> Unit,
    allDrills: List<Drill>,
    isSaving: Boolean,
    saveError: String,
    onSave: () -> Unit,
    onDeleteRequest: () -> Unit,
    onRemoveDrill: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var squadMenuOpen by remember { mutableStateOf(false) }
    var coachMenuOpen by remember { mutableStateOf(false) }
    val minutes = duration.toIntOrNull() ?: 0
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            WorkspaceField(title, onTitleChange, "Session title", Modifier.fillMaxWidth(), enabled = !isSaving)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Squad: ${selectedSquad?.name ?: "All players"}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { squadMenuOpen = true }, enabled = !isSaving) { Text("Change") }
                DropdownMenu(expanded = squadMenuOpen, onDismissRequest = { squadMenuOpen = false }) {
                    DropdownMenuItem(text = { Text("All players") }, onClick = { onSquadChange(null); squadMenuOpen = false })
                    squads.forEach { squad ->
                        DropdownMenuItem(text = { Text(squad.name) }, onClick = { onSquadChange(squad); squadMenuOpen = false })
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Head Coach: ${selectedCoach?.name ?: "Unassigned"}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { coachMenuOpen = true }, enabled = !isSaving && coaches.isNotEmpty()) { Text("Change") }
                DropdownMenu(expanded = coachMenuOpen, onDismissRequest = { coachMenuOpen = false }) {
                    coaches.forEach { coach ->
                        DropdownMenuItem(text = { Text(coach.name) }, onClick = { onCoachChange(coach); coachMenuOpen = false })
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                DateField(date, onDateChange, "Date", Modifier.weight(1f), enabled = !isSaving)
                WorkspaceField(duration, onDurationChange, "Duration in minutes", Modifier.weight(1f), enabled = !isSaving)
            }
            WorkspaceField(safety, onSafetyChange, "Safety instructions (one per line)", Modifier.fillMaxWidth(), singleLine = false, enabled = !isSaving)
            Text("Planned Drills (${session.drillIds.size})", fontWeight = FontWeight.SemiBold)
            if (session.drillIds.isEmpty()) {
                Text("No drills added yet.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            } else {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    session.drillIds.forEach { drillId ->
                        val drillName = allDrills.find { it.id == drillId }?.title ?: "Unknown Drill"
                        PlannedDrillChip(drillName, onRemove = { onRemoveDrill(drillId) })
                    }
                }
            }
            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)) {
                WorkspaceAction("Delete", Icons.Outlined.Delete, onDeleteRequest, enabled = !isSaving)
                WorkspaceAction(
                    "Save",
                    Icons.Outlined.CheckCircle,
                    onSave,
                    enabled = !isSaving && title.isNotBlank() && isIsoDate(date) && minutes in 15..600,
                    primary = true
                )
            }
        }
    }
}

@Composable
private fun EditSessionPanel(
    session: ClubTrainingSession,
    squads: List<ClubSquad>,
    coaches: List<ClubMember>,
    allDrills: List<Drill>,
    isSaving: Boolean,
    saveError: String,
    drillBusy: Boolean,
    onSave: (String, String, Int, ClubSquad?, ClubMember?, List<String>) -> Unit,
    onDelete: () -> Unit,
    onAddDrill: (Drill) -> Unit,
    onRemoveDrill: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var title by remember(session.id) { mutableStateOf(session.title) }
    var date by remember(session.id) { mutableStateOf(session.sessionDate) }
    var duration by remember(session.id) { mutableStateOf(session.durationMinutes.toString()) }
    var safety by remember(session.id) { mutableStateOf(session.safety.joinToString("\n")) }
    var selectedSquad by remember(session.id) { mutableStateOf(squads.find { it.id == session.squadId }) }
    var selectedCoach by remember(session.id) { mutableStateOf(coaches.find { it.id == session.coachId }) }
    var deleteConfirm by remember { mutableStateOf(false) }
    var showDrillPicker by remember { mutableStateOf(false) }

    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        Column(Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Edit session", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            if (isTablet) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SessionDetailsCard(
                        session = session,
                        title = title, onTitleChange = { title = it },
                        date = date, onDateChange = { date = it },
                        duration = duration, onDurationChange = { duration = it.filter(Char::isDigit) },
                        safety = safety, onSafetyChange = { safety = it },
                        squads = squads, selectedSquad = selectedSquad, onSquadChange = { selectedSquad = it },
                        coaches = coaches, selectedCoach = selectedCoach, onCoachChange = { selectedCoach = it },
                        allDrills = allDrills,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = {
                            onSave(
                                title.trim(),
                                date,
                                duration.toIntOrNull() ?: 0,
                                selectedSquad,
                                selectedCoach,
                                safety.lines().map(String::trim).filter(String::isNotBlank)
                            )
                        },
                        onDeleteRequest = { deleteConfirm = true },
                        onRemoveDrill = onRemoveDrill,
                        modifier = Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
                    )
                    AvailableDrillsPanel(
                        allDrills = allDrills,
                        isBusy = drillBusy,
                        onAdd = onAddDrill,
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    )
                }
            } else {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SessionDetailsCard(
                        session = session,
                        title = title, onTitleChange = { title = it },
                        date = date, onDateChange = { date = it },
                        duration = duration, onDurationChange = { duration = it.filter(Char::isDigit) },
                        safety = safety, onSafetyChange = { safety = it },
                        squads = squads, selectedSquad = selectedSquad, onSquadChange = { selectedSquad = it },
                        coaches = coaches, selectedCoach = selectedCoach, onCoachChange = { selectedCoach = it },
                        allDrills = allDrills,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = {
                            onSave(
                                title.trim(),
                                date,
                                duration.toIntOrNull() ?: 0,
                                selectedSquad,
                                selectedCoach,
                                safety.lines().map(String::trim).filter(String::isNotBlank)
                            )
                        },
                        onDeleteRequest = { deleteConfirm = true },
                        onRemoveDrill = onRemoveDrill,
                        modifier = Modifier.fillMaxWidth()
                    )
                    WorkspaceAction("Manage drills (${session.drillIds.size})", Icons.Outlined.FitnessCenter, { showDrillPicker = true })
                }
            }
        }
    }
    if (showDrillPicker) {
        AlertDialog(
            onDismissRequest = { showDrillPicker = false },
            title = { Text("Available drills") },
            text = {
                AvailableDrillsPanel(
                    allDrills = allDrills,
                    isBusy = drillBusy,
                    onAdd = onAddDrill,
                    modifier = Modifier.height(380.dp)
                )
            },
            confirmButton = { TextButton(onClick = { showDrillPicker = false }) { Text("Done") } }
        )
    }
    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Delete scheduled session?") },
            text = { Text("Permanently delete '${session.title}'? This cannot be undone.") },
            confirmButton = { Button(onClick = { deleteConfirm = false; onDelete() }) { Text("Delete session") } },
            dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Keep session") } }
        )
    }
}

@Composable
private fun ScheduleSessionPanel(
    squads: List<ClubSquad>,
    players: List<ClubMember>,
    coaches: List<ClubMember>,
    allDrills: List<Drill>,
    templates: List<TrainingTemplate>,
    isSaving: Boolean,
    saveError: String,
    onBack: () -> Unit,
    onSave: (JSONObject) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var targetType by remember { mutableStateOf("SQUAD") }
    var selectedSquad by remember { mutableStateOf(squads.firstOrNull()) }
    val selectedPlayerIds = remember { mutableStateListOf<String>() }
    var selectedCoach by remember { mutableStateOf<ClubMember?>(null) }
    var selectedCoordinator by remember { mutableStateOf<ClubMember?>(null) }
    var selectedAssistant by remember { mutableStateOf<ClubMember?>(null) }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var duration by remember { mutableStateOf("90") }
    var safety by remember { mutableStateOf("") }
    val drillIds = remember { mutableStateListOf<String>() }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val isTablet = maxWidth >= 600.dp
        Column(Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Schedule training session", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            val form: @Composable (Modifier) -> Unit = { formModifier ->
                Column(formModifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (templates.isNotEmpty()) {
                        SharedTemplatePickerCard(templates) { template ->
                            title = template.title
                            duration = template.durationMinutes.takeIf { it > 0 }?.toString() ?: duration
                            safety = template.safety.joinToString("\n")
                            drillIds.clear()
                            drillIds.addAll(template.drillIds)
                        }
                    }
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            WorkspaceField(title, { title = it }, "Session title *", Modifier.fillMaxWidth(), enabled = !isSaving)
                            Text("Assign Training To", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                    .padding(3.dp)
                            ) {
                                listOf("SQUAD" to "Existing Squad", "PLAYERS" to "Individual Player(s)").forEach { (value, label) ->
                                    val selected = targetType == value
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent,
                                        modifier = Modifier.weight(1f).clickable(enabled = !isSaving) { targetType = value }
                                    ) {
                                        Text(
                                            label,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                            modifier = Modifier.padding(vertical = 8.dp),
                                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                        )
                                    }
                                }
                            }
                            if (targetType == "SQUAD") {
                                if (squads.isEmpty()) {
                                    Text(
                                        "No squads formed yet. Switch to \"Individual Player(s)\" or form a squad first.",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                } else {
                                    LabeledDropdown("Target Squad", selectedSquad?.name ?: "Select a squad", enabled = !isSaving) { close ->
                                        squads.forEach { squad ->
                                            DropdownMenuItem(text = { Text(squad.name) }, onClick = { selectedSquad = squad; close() })
                                        }
                                    }
                                }
                            } else {
                                Text(
                                    "Select Player(s)${if (selectedPlayerIds.isNotEmpty()) " (${selectedPlayerIds.size} selected)" else ""}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                                Column(
                                    Modifier
                                        .fillMaxWidth()
                                        .heightIn(max = 180.dp)
                                        .verticalScroll(rememberScrollState())
                                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                        .padding(6.dp)
                                ) {
                                    if (players.isEmpty()) {
                                        Text("No players in roster yet.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), modifier = Modifier.padding(6.dp))
                                    }
                                    players.forEach { player ->
                                        val checked = player.id in selectedPlayerIds
                                        Row(
                                            Modifier
                                                .fillMaxWidth()
                                                .clickable(enabled = !isSaving) {
                                                    if (checked) selectedPlayerIds.remove(player.id) else selectedPlayerIds.add(player.id)
                                                }
                                                .padding(vertical = 4.dp, horizontal = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Checkbox(checked = checked, onCheckedChange = { add ->
                                                if (add) selectedPlayerIds.add(player.id) else selectedPlayerIds.remove(player.id)
                                            }, enabled = !isSaving)
                                            Text(player.name, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                        }
                                    }
                                }
                            }
                            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
                            LabeledDropdown("Head Coach *", selectedCoach?.name ?: "Select an active coach", enabled = !isSaving && coaches.isNotEmpty()) { close ->
                                coaches.forEach { coach ->
                                    DropdownMenuItem(text = { Text(coach.name) }, onClick = { selectedCoach = coach; close() })
                                }
                            }
                            if (coaches.isEmpty()) {
                                Text("No active coaches are available. Activate a coach invitation before scheduling a session.", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(Modifier.weight(1f)) {
                                    LabeledDropdown("Coordinator", selectedCoordinator?.name ?: "None", enabled = !isSaving) { close ->
                                        DropdownMenuItem(text = { Text("None") }, onClick = { selectedCoordinator = null; close() })
                                        coaches.filter { it.id != selectedCoach?.id && it.id != selectedAssistant?.id }.forEach { coach ->
                                            DropdownMenuItem(text = { Text(coach.name) }, onClick = { selectedCoordinator = coach; close() })
                                        }
                                    }
                                }
                                Box(Modifier.weight(1f)) {
                                    LabeledDropdown("Assistant Coach", selectedAssistant?.name ?: "None", enabled = !isSaving) { close ->
                                        DropdownMenuItem(text = { Text("None") }, onClick = { selectedAssistant = null; close() })
                                        coaches.filter { it.id != selectedCoach?.id && it.id != selectedCoordinator?.id }.forEach { coach ->
                                            DropdownMenuItem(text = { Text(coach.name) }, onClick = { selectedAssistant = coach; close() })
                                        }
                                    }
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                DateField(date, { date = it }, "Date", Modifier.weight(1f), enabled = !isSaving)
                                WorkspaceField(duration, { duration = it.filter(Char::isDigit) }, "Duration (minutes)", Modifier.weight(1f), enabled = !isSaving)
                            }
                            WorkspaceField(safety, { safety = it }, "Session safety (one instruction per line)", Modifier.fillMaxWidth(), singleLine = false, enabled = !isSaving)
                            Text("Planned Drills (${drillIds.size})", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            if (drillIds.isEmpty()) {
                                Text("No drills added yet — pick from the panel.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            } else {
                                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    drillIds.toList().forEachIndexed { index, drillId ->
                                        val drillName = allDrills.find { it.id == drillId }?.title ?: "Unknown Drill"
                                        PlannedDrillChip(drillName, onRemove = { drillIds.removeAt(index) })
                                    }
                                }
                            }
                            if (!isTablet) {
                                HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
                                AvailableDrillsPanel(
                                    allDrills = allDrills,
                                    isBusy = false,
                                    onAdd = { drill -> drillIds.add(drill.id) },
                                    modifier = Modifier.fillMaxWidth().height(260.dp)
                                )
                            }
                            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)) {
                                WorkspaceAction("Cancel", Icons.Outlined.Close, onBack, enabled = !isSaving)
                                val minutes = duration.toIntOrNull() ?: 0
                                val valid = title.isNotBlank() && isIsoDate(date) && minutes in 15..240 && selectedCoach != null &&
                                    (targetType == "SQUAD" || selectedPlayerIds.isNotEmpty())
                                WorkspaceAction(
                                    if (isSaving) "Scheduling…" else "Schedule session",
                                    Icons.Outlined.CheckCircle,
                                    {
                                        val payload = JSONObject()
                                            .put("title", title.trim())
                                            .put("sessionDate", date)
                                            .put("durationMinutes", duration.toIntOrNull() ?: 90)
                                            .put("coachId", selectedCoach?.id)
                                            .put("coachName", selectedCoach?.name)
                                            .put("coordinatorCoachId", selectedCoordinator?.id ?: JSONObject.NULL)
                                            .put("coordinatorCoachName", selectedCoordinator?.name ?: JSONObject.NULL)
                                            .put("assistantCoachId", selectedAssistant?.id ?: JSONObject.NULL)
                                            .put("assistantCoachName", selectedAssistant?.name ?: JSONObject.NULL)
                                            .put("safety", JSONArray(safety.lines().map(String::trim).filter(String::isNotBlank)))
                                            .put("drillIds", JSONArray(drillIds.toList()))
                                        if (targetType == "SQUAD") {
                                            payload.put("squadId", selectedSquad?.id ?: JSONObject.NULL)
                                                .put("squadName", selectedSquad?.name ?: "All players")
                                                .put("assignedPlayerIds", JSONArray())
                                        } else {
                                            payload.put("squadId", JSONObject.NULL)
                                                .put("squadName", "Individual players")
                                                .put("assignedPlayerIds", JSONArray(selectedPlayerIds.toList()))
                                        }
                                        onSave(payload)
                                    },
                                    enabled = !isSaving && valid,
                                    primary = true
                                )
                            }
                        }
                    }
                }
            }
            if (isTablet) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    form(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()))
                    AvailableDrillsPanel(
                        allDrills = allDrills,
                        isBusy = false,
                        onAdd = { drill -> drillIds.add(drill.id) },
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    )
                }
            } else {
                form(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()))
            }
        }
    }
}

@Composable
private fun LabeledDropdown(
    label: String,
    valueText: String,
    enabled: Boolean = true,
    items: @Composable (close: () -> Unit) -> Unit
) {
    var open by remember { mutableStateOf(false) }
    Column {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(enabled = enabled) { open = true }
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(valueText, fontSize = 12.sp, modifier = Modifier.weight(1f))
            Icon(Icons.Outlined.ExpandMore, contentDescription = null, modifier = Modifier.size(16.dp))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items { open = false }
        }
    }
}

@Composable
private fun SharedTemplatePickerCard(templates: List<TrainingTemplate>, onApply: (TrainingTemplate) -> Unit) {
    var selected by remember { mutableStateOf<TrainingTemplate?>(null) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.06f))) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Shared training templates", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
            Text("Reusable activities available to every club and coach.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            LabeledDropdown(label = "", valueText = selected?.title ?: "Choose a training activity") { close ->
                templates.forEach { template ->
                    DropdownMenuItem(text = { Text(template.title) }, onClick = { selected = template; close() })
                }
            }
            selected?.let { template ->
                Text(
                    "${template.disciplines.joinToString(", ")} · ${template.durationMinutes} min · ${template.drillIds.size} drills",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
                if (template.focus.isNotBlank()) Text(template.focus, fontSize = 11.sp)
                Text(
                    "Applying replaces this draft's title, duration, safety instructions, and planned drills.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
                WorkspaceAction("Use template", Icons.Outlined.CheckCircle, { onApply(template) })
            }
        }
    }
}

@Composable
private fun ScheduleAssessmentDialog(
    players: List<ClubMember>,
    onDismiss: () -> Unit,
    onSave: (ClubMember, String, String, String, String) -> Unit
) {
    var selectedPlayer by remember { mutableStateOf(players.firstOrNull()) }
    var title by remember { mutableStateOf("Skills assessment") }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var time by remember { mutableStateOf("") }
    var discipline by remember { mutableStateOf(selectedPlayer?.discipline?.uppercase()?.takeIf(ClubDisciplines::contains) ?: "BATTING") }
    var menuOpen by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Schedule assessment") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(selectedPlayer?.name ?: "Select player", modifier = Modifier.weight(1f))
                    TextButton(onClick = { menuOpen = true }) { Text("Player") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        players.forEach { player ->
                            DropdownMenuItem(text = { Text(player.name) }, onClick = { selectedPlayer = player; menuOpen = false })
                        }
                    }
                }
                WorkspaceField(title, { title = it }, "Assessment title")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DateField(date, { date = it }, "Date", Modifier.weight(1f))
                    TimeField(time, { time = it }, "Time (optional)", Modifier.weight(1f))
                }
                DisciplinePicker(discipline) { discipline = it }
            }
        },
        confirmButton = {
            Button(
                onClick = { selectedPlayer?.let { onSave(it, title.trim(), date, time, discipline) } },
                enabled = selectedPlayer != null && title.isNotBlank() && isIsoDate(date)
            ) { Text("Schedule") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun DisciplinePicker(value: String, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Discipline: $value", modifier = Modifier.weight(1f))
        TextButton(onClick = { open = true }) { Text("Change") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            ClubDisciplines.forEach { discipline ->
                DropdownMenuItem(text = { Text(discipline) }, onClick = { onChange(discipline); open = false })
            }
        }
    }
}

@Composable
private fun AssessmentRunPanel(
    assessment: PlayerAssessment,
    isSaving: Boolean,
    isGeneratingInsights: Boolean,
    error: String,
    onSave: (metrics: List<AssessmentMetric>, strengths: String, focusAreas: String, coachFeedback: String, playerFeedback: String, complete: Boolean) -> Unit,
    onGenerateInsights: () -> Unit,
    onDownloadReport: () -> Unit,
    onShareReport: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val names = AssessmentMetricNames[assessment.discipline].orEmpty()
    val scores = remember(assessment.id) {
        mutableStateMapOf<String, Int>().also { state ->
            assessment.metrics.forEach { metric -> metric.score?.let { state[metric.name] = it } }
        }
    }
    val notes = remember(assessment.id) {
        mutableStateMapOf<String, String>().also { state -> assessment.metrics.forEach { state[it.name] = it.note } }
    }
    var strengths by remember(assessment.id) { mutableStateOf(assessment.strengths) }
    var focusAreas by remember(assessment.id) { mutableStateOf(assessment.focusAreas) }
    var coachFeedback by remember(assessment.id) { mutableStateOf(assessment.coachFeedback) }
    var playerFeedback by remember(assessment.id) { mutableStateOf(assessment.playerFeedback) }
    val completed = assessment.status == "COMPLETED"
    val editable = !completed && !isSaving
    fun currentMetrics() = names.map { AssessmentMetric(it, scores[it], notes[it].orEmpty().trim()) }
    val canComplete = names.all { scores[it] in 1..5 } && coachFeedback.isNotBlank()

    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(verticalAlignment = Alignment.Top) {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                    Column(Modifier.weight(1f).padding(top = 4.dp)) {
                        Text(
                            "${assessment.playerName} · ${assessment.discipline}".uppercase(),
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(assessment.title, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 2.dp))
                        Text(
                            assessment.scheduledDate +
                                (assessment.scheduledTime?.let { " at $it" } ?: "") +
                                (assessment.coachName.takeIf(String::isNotBlank)?.let { " · Coach $it" } ?: ""),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                    Text(
                        assessment.status.replace('_', ' '),
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .padding(top = 8.dp)
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f), RoundedCornerShape(50))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), modifier = Modifier.padding(top = 8.dp))
            }
            item {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("Performance ratings", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(
                        "  (1 = needs work, 5 = strong)",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            items(names, key = { "metric-$it" }) { name ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                ) {
                    val ratingRow: @Composable () -> Unit = {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (1..5).forEach { score ->
                                RatingCircle(score, selected = scores[name] == score, enabled = editable) { scores[name] = score }
                            }
                        }
                    }
                    val noteField: @Composable (Modifier) -> Unit = { fieldModifier ->
                        OutlinedTextField(
                            value = notes[name].orEmpty(),
                            onValueChange = { notes[name] = it.take(1000) },
                            placeholder = { Text("Observation (optional)", fontSize = 13.sp) },
                            readOnly = !editable,
                            singleLine = true,
                            shape = RoundedCornerShape(10.dp),
                            textStyle = MaterialTheme.typography.bodySmall,
                            modifier = fieldModifier
                        )
                    }
                    if (isTablet) {
                        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(0.3f))
                            ratingRow()
                            Spacer(Modifier.width(10.dp))
                            noteField(Modifier.weight(0.45f))
                        }
                    } else {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            ratingRow()
                            noteField(Modifier.fillMaxWidth())
                        }
                    }
                }
            }
            item {
                if (isTablet) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AssessmentTextArea(strengths, { strengths = it }, "Strengths", "Strength shown: ...\nEvidence from this assessment: ...", editable, Modifier.weight(1f))
                        AssessmentTextArea(focusAreas, { focusAreas = it }, "Focus areas", "Skill to develop: ...\nSuggested next step: ...", editable, Modifier.weight(1f))
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        AssessmentTextArea(strengths, { strengths = it }, "Strengths", "Strength shown: ...\nEvidence from this assessment: ...", editable, Modifier.fillMaxWidth())
                        AssessmentTextArea(focusAreas, { focusAreas = it }, "Focus areas", "Skill to develop: ...\nSuggested next step: ...", editable, Modifier.fillMaxWidth())
                    }
                }
            }
            item {
                AssessmentTextArea(
                    coachFeedback, { coachFeedback = it }, "Feedback for player",
                    "What you did well: ...\nWhat to focus on next: ...\nTry this in training: ...",
                    editable, Modifier.fillMaxWidth()
                )
            }
            item {
                AssessmentTextArea(
                    playerFeedback, { playerFeedback = it }, "Player's thoughts or feedback",
                    "What felt good during this assessment?\nWhat would you like to improve or ask about?",
                    editable, Modifier.fillMaxWidth()
                )
            }
            if (completed && assessment.aiSummary != null) {
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f))) {
                        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                Text("  Development insights", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            }
                            Text(assessment.aiSummary, fontSize = 13.sp)
                            assessment.aiRecommendations.forEachIndexed { index, recommendation ->
                                Text("${index + 1}. $recommendation", fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp))
                            }
                        }
                    }
                }
            }
            item {
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                if (!completed && !canComplete) {
                    Text(
                        "Rate every metric and add feedback for the player to complete the assessment.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(vertical = 6.dp))
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isSaving || isGeneratingInsights) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    if (completed) {
                        OutlinedButton(onClick = onGenerateInsights, enabled = !isGeneratingInsights, shape = RoundedCornerShape(14.dp)) {
                            Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text(if (assessment.aiSummary == null) "  Generate insights" else "  Regenerate insights")
                        }
                        OutlinedButton(onClick = onShareReport, shape = RoundedCornerShape(14.dp)) {
                            Icon(Icons.Outlined.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Share")
                        }
                        Button(onClick = onDownloadReport, shape = RoundedCornerShape(14.dp)) {
                            Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Download report")
                        }
                    } else {
                        OutlinedButton(
                            onClick = { onSave(currentMetrics(), strengths.trim(), focusAreas.trim(), coachFeedback.trim(), playerFeedback.trim(), false) },
                            enabled = !isSaving,
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Outlined.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Save progress")
                        }
                        Button(
                            onClick = { onSave(currentMetrics(), strengths.trim(), focusAreas.trim(), coachFeedback.trim(), playerFeedback.trim(), true) },
                            enabled = !isSaving && canComplete,
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Complete assessment")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RatingCircle(score: Int, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val primary = MaterialTheme.colorScheme.primary
    Box(
        Modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(if (selected) primary else Color.Transparent)
            .border(1.dp, if (selected) primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.6f), CircleShape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            score.toString(),
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun AssessmentTextArea(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    editable: Boolean,
    modifier: Modifier = Modifier
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(
            value = value,
            onValueChange = { onValueChange(it.take(4000)) },
            placeholder = { Text(placeholder, fontSize = 13.sp) },
            readOnly = !editable,
            minLines = 3,
            shape = RoundedCornerShape(12.dp),
            textStyle = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

private fun isIsoDate(value: String): Boolean =
    runCatching { LocalDate.parse(value).toString() == value }.getOrDefault(false)
