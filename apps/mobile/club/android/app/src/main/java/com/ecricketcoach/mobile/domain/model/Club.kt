package com.ecricketcoach.mobile.domain.model

import org.json.JSONObject

data class ClubMember(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val ageGroup: String,
    val discipline: String,
    val invitationStatus: String,
    val currentLevel: String,
    val squad: String,
    // A player can belong to several squads; `squad` is the server's display label.
    val squads: List<String> = if (squad.isBlank() || squad == "Unassigned") emptyList() else listOf(squad)
) {
    fun isInSquad(name: String) = name in squads
}

data class ClubSquad(
    val id: String,
    val name: String,
    val ageGroup: String,
    val disciplines: List<String>,
    val memberCount: Int
)

data class ClubTrainingSession(
    val id: String,
    val title: String,
    val squadId: String?,
    val squadName: String,
    val sessionDate: String,
    val durationMinutes: Int,
    val isPublished: Boolean,
    val isExecuted: Boolean,
    val drillCount: Int,
    val postNotes: String,
    val coachId: String?,
    val coachName: String? = null,
    val assignedPlayerIds: List<String>,
    val safety: List<String>,
    val drillIds: List<String>,
    val playerNotes: JSONObject,
    val executionLog: JSONObject?,
    val aiEvaluation: JSONObject? = null,
    val coordinatorCoachId: String? = null,
    val assistantCoachId: String? = null,
    val sessionTime: String? = null
) {
    fun isAssignedTo(userId: String): Boolean =
        userId.isNotBlank() && userId in listOf(coachId, coordinatorCoachId, assistantCoachId)
}

data class SessionObservation(
    val id: String,
    val sessionId: String,
    val playerId: String?,
    val playerName: String?,
    val scope: String,
    val category: String,
    val text: String,
    val drillId: String?,
    val drillTitle: String?,
    val createdAt: String
)

data class SessionObservationDraft(
    val id: String,
    val playerId: String?,
    val scope: String,
    val category: String,
    val text: String,
    val drillId: String?
)

data class SessionPlayerDraft(
    val name: String,
    val email: String,
    val ageGroup: String,
    val disciplines: List<String>
)

data class SessionPlayerAddition(
    val member: ClubMember,
    val session: ClubTrainingSession
)

data class ClubCertificate(
    val id: String,
    val number: String,
    val playerName: String,
    val discipline: String,
    val level: String,
    val issuedDate: String,
    val coachName: String,
    val coachNotes: String,
    val clubName: String,
    val clubLogo: String?,
    val aiCommendation: String
)
