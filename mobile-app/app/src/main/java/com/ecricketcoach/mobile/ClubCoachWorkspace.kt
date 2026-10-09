package com.ecricketcoach.mobile

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
private val AssessmentMetricNames = mapOf(
    "BATTING" to listOf("Stance & balance", "Footwork", "Shot selection", "Timing & contact", "Running between wickets"),
    "BOWLING" to listOf("Run-up & rhythm", "Action & alignment", "Release point", "Accuracy", "Follow-through"),
    "KEEPING" to listOf("Stance & readiness", "Footwork", "Glove technique", "Catching & gathering", "Communication"),
    "FIELDING" to listOf("Ready position", "Movement & agility", "Ground fielding", "Throwing accuracy", "Communication")
)

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
    var tab by remember { mutableStateOf(if (user.role == "COACH") "Squads" else "Roster") }
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
    var showScheduleSession by remember { mutableStateOf(false) }
    var editingSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var sessionEditSaving by remember { mutableStateOf(false) }
    var sessionEditError by remember { mutableStateOf("") }
    var showScheduleAssessment by remember { mutableStateOf(false) }
    var executingSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var completingAssessment by remember { mutableStateOf<PlayerAssessment?>(null) }
    var selectedPromotionPlayer by remember { mutableStateOf<ClubMember?>(null) }
    var executionSaving by remember { mutableStateOf(false) }
    var executionError by remember { mutableStateOf("") }
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

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(user.clubName?.takeIf(String::isNotBlank) ?: "Club workspace", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Welcome, ${user.name}", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 13.sp)
            }
            TextButton(onClick = onToggleTheme) { Text(if (isDark) "Light" else "Dark") }
        }
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            buildList {
                add("Overview")
                if (isClubAdmin) add("Roster")
                addAll(listOf("Squads", "Sessions", "Assessments", "Reports", "Certificates", "Drills", "Club drills", "Templates", "Progression", "Video analysis"))
                if (isClubAdmin) add("Settings")
            }.forEach { item ->
                WorkspaceTab(item, tab == item) { tab = item }
            }
        }
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
                modifier = Modifier.weight(1f)
            )
            "Roster" -> RosterPanel(
                members = members,
                squads = squads,
                canInvite = isClubAdmin,
                onInvite = { showInvite = true },
                onAssignSquad = { member, squad ->
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
                },
                modifier = Modifier.weight(1f)
            )
            "Squads" -> SquadPanel(
                squads,
                onCreate = { showCreateSquad = true },
                modifier = Modifier.weight(1f)
            )
            "Sessions" -> SessionsPanel(
                sessions = sessions,
                userId = user.id,
                canDeleteAny = isClubAdmin,
                canSchedule = isClubAdmin || isClubCoach,
                canCoachSessions = isClubCoach,
                onSchedule = { showScheduleSession = true },
                onEdit = { session ->
                    sessionEditError = ""
                    if (queuedMutations.any {
                            it.kind == OfflineMutation.SAVE_SESSION_EXECUTION &&
                                it.resourceId == session.id && it.state == "PENDING"
                        }) {
                        error = "Sync this session's pending execution before editing its plan."
                    } else {
                        editingSession = session
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
                onExecute = { session ->
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
                },
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
                onAssess = { session ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            api.assessCompletedSession(token, session.id, session.postNotes)
                            refresh()
                            notice = "AI session review generated."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to generate the session review."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Assessments" -> AssessmentsPanel(
                assessments,
                members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
                onSchedule = { showScheduleAssessment = true },
                onGenerateInsights = { assessment ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            val updated = api.generateAssessmentInsights(token, assessment.id)
                            assessments = assessments.map { if (it.id == updated.id) updated else it }
                            notice = "Assessment insights generated."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to generate assessment insights."
                        }
                    }
                },
                onStart = { assessment ->
                    scope.launch {
                        error = ""
                        try {
                            api.updatePlayerAssessment(token, assessment.id, JSONObject().put("status", "IN_PROGRESS"))
                            refresh()
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to start this assessment."
                        }
                    }
                },
                onComplete = { completingAssessment = it },
                modifier = Modifier.weight(1f)
            )
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
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = {
                scope.launch {
                    synchronizeQueuedMutations()
                    refresh()
                }
            }, enabled = !loading) {
                Text(if (loading) "Syncing…" else "Sync now")
            }
            TextButton(onClick = onSignOut) { Text("Sign out") }
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
    if (showScheduleSession) {
        ScheduleSessionDialog(
            squads = squads,
            onDismiss = { showScheduleSession = false },
            onSave = { title, date, duration, squad, safety ->
                scope.launch {
                    error = ""
                    try {
                        api.scheduleClubSession(
                            token,
                            JSONObject()
                                .put("title", title)
                                .put("sessionDate", date)
                                .put("durationMinutes", duration)
                                .put("squadId", squad?.id ?: JSONObject.NULL)
                                .put("squadName", squad?.name ?: "All players")
                                .put("coachId", user.id)
                                .put("coachName", user.name)
                                .put("clubId", clubId)
                                .put("safety", JSONArray(safety))
                                .put("drillIds", JSONArray())
                        )
                        showScheduleSession = false
                        refresh()
                        notice = "Training session scheduled."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to schedule this session."
                    }
                }
            }
        )
    }
    if (showScheduleAssessment) {
        ScheduleAssessmentDialog(
            players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
            onDismiss = { showScheduleAssessment = false },
            onSave = { player, title, date, discipline ->
                scope.launch {
                    error = ""
                    try {
                        api.schedulePlayerAssessment(
                            token,
                            JSONObject()
                                .put("title", title)
                                .put("playerId", player.id)
                                .put("discipline", discipline)
                                .put("scheduledDate", date)
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
    editingSession?.let { session ->
        ScheduleSessionDialog(
            squads = squads,
            session = session,
            isSaving = sessionEditSaving,
            saveError = sessionEditError,
            onDismiss = { if (!sessionEditSaving) editingSession = null },
            onSave = { title, date, duration, squad, safety ->
                scope.launch {
                    sessionEditSaving = true
                    sessionEditError = ""
                    try {
                        val updates = sessionPlanUpdates(session, title, date, duration, squad, safety)
                        val updated = api.updateClubSession(token, session.id, updates)
                        sessions = sessions.map { if (it.id == updated.id) updated else it }
                        editingSession = null
                        refresh()
                        notice = "Session changes saved."
                    } catch (failure: Exception) {
                        sessionEditError = failure.message ?: "Unable to save session changes."
                    } finally {
                        sessionEditSaving = false
                    }
                }
            }
        )
    }
    executingSession?.let { session ->
        SessionExecutionDialog(
            session = session,
            players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
            drills = drills + clubDrills,
            readOnly = session.isExecuted,
            onDismiss = { executingSession = null },
            isSaving = executionSaving,
            saveError = executionError,
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
    completingAssessment?.let { assessment ->
        CompleteAssessmentDialog(
            assessment = assessment,
            onDismiss = { completingAssessment = null },
            onSave = { metrics, feedback ->
                scope.launch {
                    error = ""
                    try {
                        val metricRows = JSONArray()
                        metrics.forEach { (name, score) ->
                            metricRows.put(JSONObject().put("name", name).put("score", score).put("note", ""))
                        }
                        api.updatePlayerAssessment(
                            token,
                            assessment.id,
                            JSONObject()
                                .put("status", "COMPLETED")
                                .put("metrics", metricRows)
                                .put("coachFeedback", feedback)
                        )
                        completingAssessment = null
                        refresh()
                        notice = "Assessment saved."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to save this assessment."
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

@Composable
private fun WorkspaceTab(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp
        )
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
    modifier: Modifier = Modifier
) {
    val today = LocalDate.now().toString()
    val upcomingSessions = sessions
        .filter { !it.isExecuted && it.sessionDate >= today }
        .sortedBy { it.sessionDate }
    val myUpcomingSessions = upcomingSessions.filter { it.isAssignedTo(userId) }
    val upcomingAssessments = assessments
        .filter { it.status != "COMPLETED" && it.scheduledDate >= today }
        .sortedBy { it.scheduledDate }
    val deliveredSessions = sessions.count { it.isExecuted }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(clubName.uppercase() + " CLUB COACH WORKSPACE", color = Color(0xFF8B88FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text("$coachName's club coaching dashboard", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text("Plan sessions, monitor club events, and measure development.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 13.sp)
        }
        item { SummaryCard("Upcoming sessions", upcomingSessions.size.toString(), "Scheduled or ready to deliver", onClick = { onOpen("Sessions") }) }
        item { SummaryCard("Upcoming assessments", upcomingAssessments.size.toString(), "Due or in progress", onClick = { onOpen("Assessments") }) }
        item { SummaryCard("Delivered sessions", deliveredSessions.toString(), "Current coaching season") }
        item { SummaryCard("Active participants", members.count { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" }.toString(), "Players in your club") }
        item { OverviewList("Next sessions and events", upcomingSessions.take(7)) { session ->
            Text(session.title, fontWeight = FontWeight.SemiBold)
            Text("${session.squadName} · ${session.durationMinutes} min · Led by ${session.coachId ?: "Coach"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            Text(session.sessionDate, fontSize = 12.sp, color = Color(0xFF8B88FF), fontWeight = FontWeight.SemiBold)
        } }
        item { OverviewList("My upcoming sessions", myUpcomingSessions.take(7)) { session ->
            Text(session.title, fontWeight = FontWeight.SemiBold)
            Text("${session.squadName} · ${session.durationMinutes} min", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(session.sessionDate, fontSize = 12.sp, color = Color(0xFF8B88FF), fontWeight = FontWeight.SemiBold)
                TextButton(onClick = { onOpen("Sessions") }) { Text("▶ Run") }
            }
        } }
        item { OverviewList("Upcoming assessments", upcomingAssessments.take(6)) { assessment ->
            Text(assessment.playerName, fontWeight = FontWeight.SemiBold)
            Text("${assessment.title} · ${assessment.discipline}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(assessment.scheduledDate, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f))
                TextButton(onClick = { onOpen("Assessments") }) { Text("View") }
            }
        } }
        item {
            Text("Coaching practice library", fontWeight = FontWeight.Bold)
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

@Composable
private fun <T> OverviewList(title: String, rows: List<T>, content: @Composable (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Text(title, fontWeight = FontWeight.Bold)
        if (rows.isEmpty()) {
            Text("Nothing scheduled.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), fontSize = 12.sp, modifier = Modifier.padding(vertical = 12.dp))
        } else {
            rows.forEach { row ->
                Column(Modifier.fillMaxWidth().padding(vertical = 10.dp)) { content(row) }
            }
        }
    }
}

@Composable
private fun LibraryLink(label: String) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(8.dp)
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f), fontSize = 12.sp, modifier = Modifier.padding(12.dp))
    }
}

@Composable
private fun SummaryCard(title: String, value: String, detail: String, onClick: (() -> Unit)? = null) {
    Card(
        onClick = { onClick?.invoke() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            Modifier.fillMaxWidth().padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(title, fontWeight = FontWeight.SemiBold)
                Text(detail, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 12.sp)
            }
            Text(value, color = MaterialTheme.colorScheme.primary, fontSize = 26.sp, fontWeight = FontWeight.Bold)
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
                Text("Club roster", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                if (canInvite) Button(onClick = onInvite) { Text("Invite") }
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
                        TextButton(onClick = { menuOpen = true }) { Text("Assign") }
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
private fun SquadPanel(squads: List<ClubSquad>, onCreate: () -> Unit, modifier: Modifier = Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Squads", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Button(onClick = onCreate) { Text("New squad") }
            }
        }
        if (squads.isEmpty()) item { EmptyMessage("Create a squad to organize your players.") }
        items(squads, key = ClubSquad::id) { squad ->
            InfoCard(squad.name, "${squad.ageGroup} · ${squad.memberCount} members", squad.disciplines.joinToString(" · "))
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
    onSchedule: () -> Unit,
    onEdit: (ClubTrainingSession) -> Unit,
    onDelete: (ClubTrainingSession) -> Unit,
    onPublish: (ClubTrainingSession) -> Unit,
    onExecute: (ClubTrainingSession) -> Unit,
    onReview: (ClubTrainingSession) -> Unit,
    onAssess: (ClubTrainingSession) -> Unit,
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
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Training sessions", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                if (canSchedule) Button(onClick = onSchedule) { Text("Schedule") }
            }
            OutlinedTextField(search, { search = it }, label = { Text("Filter session title") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(fromDate, { fromDate = it }, label = { Text("From date") }, modifier = Modifier.weight(1f), singleLine = true)
                OutlinedTextField(throughDate, { throughDate = it }, label = { Text("Through date") }, modifier = Modifier.weight(1f), singleLine = true)
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
        if (filteredSessions.isEmpty()) item { EmptyMessage(if (sessions.isEmpty()) "No training sessions scheduled yet." else "No sessions match these filters.") }
        items(filteredSessions.sortedByDescending(ClubTrainingSession::sessionDate), key = ClubTrainingSession::id) { session ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(session.title, fontWeight = FontWeight.SemiBold)
                    Text("${session.sessionDate} · ${session.squadName} · ${session.durationMinutes} min", fontSize = 12.sp)
                    Text(
                        "${if (session.isExecuted) "Delivered" else if (session.isPublished) "Published" else "Draft"} · ${session.drillCount} drills",
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 3.dp)
                    )
                    val canManage = canDeleteAny || (canCoachSessions && session.isAssignedTo(userId))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        if (!session.isExecuted && canManage) {
                            TextButton(onClick = { onEdit(session) }) { Text("Edit") }
                            TextButton(onClick = { deleteTarget = session }) { Text("Delete") }
                        }
                        if (canManage && !session.isPublished && !session.isExecuted) TextButton(onClick = { onPublish(session) }) { Text("Publish") }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        if (canCoachSessions && session.isAssignedTo(userId) && !session.isExecuted) TextButton(onClick = { onExecute(session) }) { Text("Run") }
                        if (canCoachSessions && session.isAssignedTo(userId) && session.isExecuted) TextButton(onClick = { onReview(session) }) { Text("Review") }
                        if (session.isExecuted) TextButton(onClick = { onAssess(session) }) { Text("AI review") }
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
        }
    }
}

@Composable
private fun AssessmentsPanel(
    assessments: List<PlayerAssessment>,
    players: List<ClubMember>,
    onSchedule: () -> Unit,
    onGenerateInsights: (PlayerAssessment) -> Unit,
    onStart: (PlayerAssessment) -> Unit,
    onComplete: (PlayerAssessment) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Player assessments", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Button(onClick = onSchedule, enabled = players.isNotEmpty()) { Text("Schedule") }
            }
        }
        if (assessments.isEmpty()) item { EmptyMessage("No assessments scheduled yet.") }
        items(assessments, key = PlayerAssessment::id) { assessment ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(assessment.title, fontWeight = FontWeight.SemiBold)
                    Text("${assessment.playerName} · ${assessment.discipline} · ${assessment.scheduledDate}", fontSize = 12.sp)
                    Text(assessment.status.replace('_', ' '), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp)
                    when (assessment.status) {
                        "SCHEDULED" -> TextButton(onClick = { onStart(assessment) }) { Text("Start assessment") }
                        "IN_PROGRESS" -> TextButton(onClick = { onComplete(assessment) }) { Text("Complete assessment") }
                        "COMPLETED" -> TextButton(onClick = { onGenerateInsights(assessment) }) { Text("Generate insights") }
                    }
                    if (assessment.aiSummary != null) {
                        Text("Development insights", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
                        Text(assessment.aiSummary, fontSize = 12.sp)
                        assessment.aiRecommendations.forEachIndexed { index, recommendation ->
                            Text("${index + 1}. $recommendation", fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReadOnlyDrills(drills: List<Drill>, modifier: Modifier = Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Drill catalogue", fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        if (drills.isEmpty()) item { EmptyMessage("No drills are available. Sync while online to load the catalogue.") }
        items(drills, key = Drill::id) { drill ->
            InfoCard(drill.title, "${drill.discipline} · ${drill.durationMinutes} min", listOf(drill.skillSet, drill.instructions).filter(String::isNotBlank).joinToString("\n"))
        }
    }
}

@Composable
private fun ReadOnlyTemplates(templates: List<TrainingTemplate>, modifier: Modifier = Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Training templates", fontSize = 20.sp, fontWeight = FontWeight.Bold) }
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
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Role: $role", modifier = Modifier.weight(1f))
                    TextButton(onClick = { role = if (role == "PLAYER") "COACH" else "PLAYER" }) { Text("Change") }
                }
                if (role == "PLAYER") {
                    OutlinedTextField(ageGroup, { ageGroup = it }, label = { Text("Age group") }, singleLine = true)
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
                OutlinedTextField(name, { name = it }, label = { Text("Squad name") }, singleLine = true)
                OutlinedTextField(ageGroup, { ageGroup = it }, label = { Text("Age group") }, singleLine = true)
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
private fun ScheduleSessionDialog(
    squads: List<ClubSquad>,
    session: ClubTrainingSession? = null,
    isSaving: Boolean = false,
    saveError: String = "",
    onDismiss: () -> Unit,
    onSave: (String, String, Int, ClubSquad?, List<String>) -> Unit
) {
    var title by remember(session?.id) { mutableStateOf(session?.title.orEmpty()) }
    var date by remember(session?.id) { mutableStateOf(session?.sessionDate ?: LocalDate.now().toString()) }
    var duration by remember(session?.id) { mutableStateOf((session?.durationMinutes ?: 90).toString()) }
    var safety by remember(session?.id) { mutableStateOf(session?.safety?.joinToString("\n").orEmpty()) }
    var selectedSquad by remember(session?.id) {
        mutableStateOf<ClubSquad?>(if (session == null) squads.firstOrNull() else squads.find { it.id == session.squadId })
    }
    val unresolvedSquad = session?.squadId != null && squads.none { it.id == session.squadId }
    var menuOpen by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = { if (!isSaving) onDismiss() },
        title = { Text(if (session == null) "Schedule training" else "Edit Training Session") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text("Session title") }, singleLine = true, enabled = !isSaving)
                OutlinedTextField(date, { date = it }, label = { Text("Date (YYYY-MM-DD)") }, singleLine = true, enabled = !isSaving)
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("Duration in minutes") }, singleLine = true, enabled = !isSaving)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        selectedSquad?.name ?: session?.takeIf { it.squadId == null }?.squadName ?: "All players",
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = { menuOpen = true }, enabled = !isSaving) { Text("Squad") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("All players") }, onClick = { selectedSquad = null; menuOpen = false })
                        squads.forEach { squad ->
                            DropdownMenuItem(text = { Text(squad.name) }, onClick = { selectedSquad = squad; menuOpen = false })
                        }
                    }
                }
                OutlinedTextField(safety, { safety = it }, label = { Text("Safety instructions (one per line)") }, enabled = !isSaving)
                if (session != null && selectedSquad?.id != session.squadId) {
                    Text("Changing the squad replaces individual player targeting with the selected squad (or all players).", fontSize = 12.sp)
                }
                if (unresolvedSquad) Text("The saved squad is not available. Sync the club before editing.", color = MaterialTheme.colorScheme.error)
                if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            val minutes = duration.toIntOrNull() ?: 0
            Button(onClick = { onSave(title.trim(), date, minutes, selectedSquad, safety.lines().map(String::trim).filter(String::isNotBlank)) }, enabled = !isSaving && !unresolvedSquad && title.isNotBlank() && isIsoDate(date) && minutes in 15..600) {
                Text(if (isSaving) "Saving..." else if (session == null) "Schedule" else "Save Changes")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !isSaving) { Text("Cancel") } }
    )
}

@Composable
private fun ScheduleAssessmentDialog(
    players: List<ClubMember>,
    onDismiss: () -> Unit,
    onSave: (ClubMember, String, String, String) -> Unit
) {
    var selectedPlayer by remember { mutableStateOf(players.firstOrNull()) }
    var title by remember { mutableStateOf("Skills assessment") }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
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
                OutlinedTextField(title, { title = it }, label = { Text("Assessment title") }, singleLine = true)
                OutlinedTextField(date, { date = it }, label = { Text("Date (YYYY-MM-DD)") }, singleLine = true)
                DisciplinePicker(discipline) { discipline = it }
            }
        },
        confirmButton = {
            Button(
                onClick = { selectedPlayer?.let { onSave(it, title.trim(), date, discipline) } },
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
private fun CompleteAssessmentDialog(
    assessment: PlayerAssessment,
    onDismiss: () -> Unit,
    onSave: (Map<String, Int>, String) -> Unit
) {
    val metrics = remember(assessment.id) {
        mutableStateMapOf<String, Int>().also { state ->
            assessment.metrics.forEach { metric -> metric.score?.let { state[metric.name] = it } }
            AssessmentMetricNames[assessment.discipline].orEmpty().forEach { name ->
                if (name !in state) state[name] = 0
            }
        }
    }
    var feedback by remember { mutableStateOf("") }
    val names = AssessmentMetricNames[assessment.discipline].orEmpty()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Assess ${assessment.playerName}") },
        text = {
            Column {
                LazyColumn(Modifier.height(300.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(names, key = { it }) { name ->
                        Column {
                            Text(name, fontSize = 13.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                (1..5).forEach { score ->
                                    TextButton(onClick = { metrics[name] = score }) {
                                        Text(if (metrics[name] == score) "[$score]" else score.toString())
                                    }
                                }
                            }
                        }
                    }
                }
                OutlinedTextField(feedback, { feedback = it }, label = { Text("Feedback for player") }, minLines = 2)
            }
        },
        confirmButton = {
            Button(onClick = { onSave(metrics.toMap(), feedback.trim()) }, enabled = metrics.values.all { it in 1..5 } && feedback.isNotBlank()) {
                Text("Complete")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

private fun isIsoDate(value: String): Boolean =
    runCatching { LocalDate.parse(value).toString() == value }.getOrDefault(false)
