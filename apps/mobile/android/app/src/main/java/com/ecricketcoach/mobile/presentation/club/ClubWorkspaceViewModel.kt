package com.ecricketcoach.mobile.presentation.club

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ecricketcoach.mobile.domain.model.ClubCertificate
import com.ecricketcoach.mobile.domain.model.ClubMember
import com.ecricketcoach.mobile.domain.model.ClubSquad
import com.ecricketcoach.mobile.domain.model.ClubTrainingSession
import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.Drill
import com.ecricketcoach.mobile.domain.model.OfflineMutation
import com.ecricketcoach.mobile.domain.model.PlayerAssessment
import com.ecricketcoach.mobile.domain.repository.AnalysisRepository
import com.ecricketcoach.mobile.domain.repository.ClubRepository
import com.ecricketcoach.mobile.domain.repository.OfflineMutationRepository
import com.ecricketcoach.mobile.domain.usecase.AssignMemberToSquadUseCase
import com.ecricketcoach.mobile.domain.usecase.LoadClubWorkspaceUseCase
import com.ecricketcoach.mobile.domain.usecase.SquadAssignmentResult
import com.ecricketcoach.mobile.domain.usecase.SyncOfflineMutationsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Holds club workspace data and orchestrates loading, offline queue replay and squad assignment. */
@HiltViewModel
class ClubWorkspaceViewModel @Inject constructor(
    val club: ClubRepository,
    val analysis: AnalysisRepository,
    private val offlineQueue: OfflineMutationRepository,
    private val loadWorkspace: LoadClubWorkspaceUseCase,
    private val syncOfflineMutations: SyncOfflineMutationsUseCase,
    private val assignToSquad: AssignMemberToSquadUseCase
) : ViewModel() {
    private var user: CoachUser? = null
    private val clubId get() = user?.tenantId.orEmpty()

    var members by mutableStateOf<List<ClubMember>>(emptyList())
    var squads by mutableStateOf<List<ClubSquad>>(emptyList())
    var sessions by mutableStateOf<List<ClubTrainingSession>>(emptyList())
    var reportMembers by mutableStateOf<List<ClubMember>>(emptyList())
    var reportSessions by mutableStateOf<List<ClubTrainingSession>>(emptyList())
    var reportError by mutableStateOf("")
    var assessments by mutableStateOf<List<PlayerAssessment>>(emptyList())
    var clubDrills by mutableStateOf<List<Drill>>(emptyList())
    var catalogueDrills by mutableStateOf<List<Drill>>(emptyList())
    var certificates by mutableStateOf<List<ClubCertificate>>(emptyList())
    var driveConnected by mutableStateOf(false)
    var driveEmail by mutableStateOf("")
    var driveError by mutableStateOf("")
    var clubLogo by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)
    var error by mutableStateOf("")
    var notice by mutableStateOf("")
    var queuedMutations by mutableStateOf<List<OfflineMutation>>(emptyList())

    /** Binds the signed-in user. State is reset only when the user or club changes. */
    fun bind(user: CoachUser, drills: List<Drill>) {
        val current = this.user
        if (current != null && current.id == user.id && current.tenantId == user.tenantId) {
            this.user = user
            return
        }
        this.user = user
        members = emptyList(); squads = emptyList(); sessions = emptyList()
        reportMembers = emptyList(); reportSessions = emptyList(); reportError = ""
        assessments = emptyList(); certificates = emptyList()
        clubDrills = drills.filter { it.id.startsWith("drill-club-") }
        catalogueDrills = drills
        driveConnected = false; driveEmail = ""; driveError = ""
        clubLogo = null; loading = false; error = ""; notice = ""
        queuedMutations = emptyList()
    }

    fun reloadQueue(): Boolean {
        val user = user ?: return false
        return try {
            queuedMutations = offlineQueue.queued(user.id, clubId)
            true
        } catch (failure: Exception) {
            error = "Unable to read the encrypted offline queue: ${failure.message ?: "storage error"}"
            false
        }
    }

    suspend fun synchronizeQueuedMutations() {
        val user = user ?: return
        if (!reloadQueue()) return
        syncOfflineMutations(user.id, clubId)
        reloadQueue()
    }

    suspend fun refresh() {
        val user = user ?: return
        if (clubId.isBlank()) {
            error = "This account is not linked to a club."
            return
        }
        loading = true
        error = ""
        try {
            val snapshot = loadWorkspace(clubId)
            members = snapshot.members
            squads = snapshot.squads
            sessions = snapshot.sessions
            clubDrills = snapshot.drills
            catalogueDrills = snapshot.catalogueDrills
            certificates = snapshot.certificates
            clubLogo = snapshot.logo
            try {
                val (scopedMembers, scopedSessions) = club.getClubSessionReportData()
                reportMembers = scopedMembers
                reportSessions = scopedSessions
                reportError = ""
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                reportError = failure.message ?: "Unable to load this club's session report."
            }
            val isClubAdmin = user.role == "CLUB_ADMIN"
            val isClubCoach = user.role == "COACH" && user.coachContext == "CLUB"
            if (isClubAdmin || isClubCoach) {
                assessments = club.getPlayerAssessments()
            }
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to synchronize club workspace."
        } finally {
            loading = false
        }
    }

    fun syncAndRefresh() {
        viewModelScope.launch {
            synchronizeQueuedMutations()
            refresh()
        }
    }

    fun assignMemberToSquad(member: ClubMember, squad: String, inSquad: Boolean) {
        val user = user ?: return
        viewModelScope.launch {
            error = ""
            notice = ""
            try {
                when (assignToSquad(user.id, clubId, member, squad, inSquad)) {
                    SquadAssignmentResult.SAVED -> {
                        refresh()
                        notice = if (inSquad) "${member.name} added to $squad." else "${member.name} removed from $squad."
                    }
                    SquadAssignmentResult.QUEUED_OFFLINE -> {
                        reloadQueue()
                        notice = "Squad assignment saved on this device and queued for synchronization. It is not yet saved on the server."
                    }
                    SquadAssignmentResult.ALREADY_PENDING ->
                        error = "This member already has a pending offline assignment. Sync it before making another change."
                }
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                error = failure.message ?: "Unable to update member assignment."
            }
        }
    }

    fun enqueueMutation(mutation: OfflineMutation) = offlineQueue.enqueue(mutation)

    fun removeQueuedMutation(id: String) = offlineQueue.remove(id)

    suspend fun checkDriveStatus() {
        try {
            val (connected, email) = analysis.getGoogleDriveStatus()
            driveConnected = connected
            driveEmail = email.orEmpty()
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            driveError = failure.message ?: "Unable to check Google Drive connection."
        }
    }
}
