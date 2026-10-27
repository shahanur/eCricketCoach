package com.ecricketcoach.mobile.domain.repository

import android.net.Uri
import com.ecricketcoach.mobile.domain.model.*
import java.io.File
import org.json.JSONObject

/** Club administration: members, squads, sessions, assessments, drills, certificates and branding. */
interface ClubRepository {
    suspend fun getDrills(tenantId: String): List<Drill>
    suspend fun getClubMembers(clubId: String): List<ClubMember>
    suspend fun inviteClubMember(member: JSONObject): ClubMember
    suspend fun acceptClubMember(memberId: String): ClubMember
    suspend fun updateClubMember(memberId: String, updates: JSONObject, operationId: String? = null): ClubMember
    suspend fun deleteClubMember(memberId: String)
    suspend fun getSquads(clubId: String): List<ClubSquad>
    suspend fun createSquad(squad: JSONObject): ClubSquad
    suspend fun updateSquad(squadId: String, updates: JSONObject): ClubSquad
    suspend fun deleteSquad(squadId: String)
    suspend fun getClubSessions(clubId: String): List<ClubTrainingSession>
    suspend fun getClubSessionReportData(): Pair<List<ClubMember>, List<ClubTrainingSession>>
    suspend fun scheduleClubSession(session: JSONObject): ClubTrainingSession
    suspend fun getSessionObservations(sessionId: String): List<SessionObservation>
    suspend fun createSessionObservation(sessionId: String, observation: SessionObservationDraft): SessionObservation
    suspend fun addSessionPlayer(sessionId: String, player: SessionPlayerDraft): SessionPlayerAddition
    suspend fun publishClubSession(sessionId: String): ClubTrainingSession
    suspend fun updateClubSession(sessionId: String, updates: JSONObject): ClubTrainingSession
    suspend fun addDrillToSession(sessionId: String, drillId: String): ClubTrainingSession
    suspend fun removeDrillFromSession(sessionId: String, drillId: String): ClubTrainingSession
    suspend fun deleteClubSession(sessionId: String)
    suspend fun getPlayerAssessments(): List<PlayerAssessment>
    suspend fun schedulePlayerAssessment(assessment: JSONObject): PlayerAssessment
    suspend fun updatePlayerAssessment(assessmentId: String, updates: JSONObject): PlayerAssessment
    suspend fun deleteAssessment(assessmentId: String)
    suspend fun saveSessionExecution(sessionId: String, update: JSONObject, operationId: String? = null): ClubTrainingSession
    suspend fun getCoachSessionExecution(sessionId: String): ClubTrainingSession
    suspend fun generateAssessmentInsights(assessmentId: String): PlayerAssessment
    suspend fun assessCompletedSession(sessionId: String, notes: String): ClubTrainingSession
    suspend fun createFollowUpSession(sessionId: String, payload: JSONObject): Pair<ClubTrainingSession, List<Drill>>
    suspend fun getCertificates(): List<ClubCertificate>
    suspend fun deleteCertificate(certificateId: String)
    suspend fun promotePlayer(playerId: String, newLevel: String, coachName: String, coachNotes: String)
    suspend fun getClubBranding(): String?
    suspend fun updateClubBranding(logoUrl: String?)
    suspend fun addClubDrill(drill: JSONObject): Drill
    suspend fun getClubDrills(clubId: String): List<Drill>
    suspend fun deleteDrill(drillId: String)
    suspend fun cloneDrill(drillId: String): Drill
    suspend fun updateDrill(drillId: String, updates: JSONObject): Drill
}
