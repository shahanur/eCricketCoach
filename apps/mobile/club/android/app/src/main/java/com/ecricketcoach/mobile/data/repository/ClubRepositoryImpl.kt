package com.ecricketcoach.mobile.data.repository

import android.net.Uri
import com.ecricketcoach.mobile.domain.model.*
import java.io.File
import org.json.JSONObject
import com.ecricketcoach.mobile.data.api.CoachApi
import com.ecricketcoach.mobile.data.datastore.AuthStore
import com.ecricketcoach.mobile.domain.repository.ClubRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ClubRepositoryImpl @Inject constructor(
    private val api: CoachApi,
    private val store: AuthStore
) : ClubRepository {
    private fun token(): String = store.requireToken()

    override suspend fun getDrills(tenantId: String): List<Drill> =
        api.getDrills(token(), tenantId)

    override suspend fun getClubMembers(clubId: String): List<ClubMember> =
        api.getClubMembers(token(), clubId)

    override suspend fun inviteClubMember(member: JSONObject): ClubMember =
        api.inviteClubMember(token(), member)

    override suspend fun acceptClubMember(memberId: String): ClubMember =
        api.acceptClubMember(token(), memberId)

    override suspend fun updateClubMember(memberId: String, updates: JSONObject, operationId: String?): ClubMember =
        api.updateClubMember(token(), memberId, updates, operationId)

    override suspend fun deleteClubMember(memberId: String) {
        api.deleteClubMember(token(), memberId)
    }

    override suspend fun getSquads(clubId: String): List<ClubSquad> =
        api.getSquads(token(), clubId)

    override suspend fun createSquad(squad: JSONObject): ClubSquad =
        api.createSquad(token(), squad)

    override suspend fun updateSquad(squadId: String, updates: JSONObject): ClubSquad =
        api.updateSquad(token(), squadId, updates)

    override suspend fun deleteSquad(squadId: String) {
        api.deleteSquad(token(), squadId)
    }

    override suspend fun getClubSessions(clubId: String): List<ClubTrainingSession> =
        api.getClubSessions(token(), clubId)

    override suspend fun getClubSessionReportData(): Pair<List<ClubMember>, List<ClubTrainingSession>> =
        api.getClubSessionReportData(token())

    override suspend fun scheduleClubSession(session: JSONObject): ClubTrainingSession =
        api.scheduleClubSession(token(), session)

    override suspend fun getSessionObservations(sessionId: String): List<SessionObservation> =
        api.getSessionObservations(token(), sessionId)

    override suspend fun createSessionObservation(sessionId: String, observation: SessionObservationDraft): SessionObservation =
        api.createSessionObservation(token(), sessionId, observation)

    override suspend fun addSessionPlayer(sessionId: String, player: SessionPlayerDraft): SessionPlayerAddition =
        api.addSessionPlayer(token(), sessionId, player)

    override suspend fun publishClubSession(sessionId: String): ClubTrainingSession =
        api.publishClubSession(token(), sessionId)

    override suspend fun updateClubSession(sessionId: String, updates: JSONObject): ClubTrainingSession =
        api.updateClubSession(token(), sessionId, updates)

    override suspend fun addDrillToSession(sessionId: String, drillId: String): ClubTrainingSession =
        api.addDrillToSession(token(), sessionId, drillId)

    override suspend fun removeDrillFromSession(sessionId: String, drillId: String): ClubTrainingSession =
        api.removeDrillFromSession(token(), sessionId, drillId)

    override suspend fun deleteClubSession(sessionId: String) {
        api.deleteClubSession(token(), sessionId)
    }

    override suspend fun getPlayerAssessments(): List<PlayerAssessment> =
        api.getPlayerAssessments(token())

    override suspend fun schedulePlayerAssessment(assessment: JSONObject): PlayerAssessment =
        api.schedulePlayerAssessment(token(), assessment)

    override suspend fun updatePlayerAssessment(assessmentId: String, updates: JSONObject): PlayerAssessment =
        api.updatePlayerAssessment(token(), assessmentId, updates)

    override suspend fun deleteAssessment(assessmentId: String) {
        api.deleteAssessment(token(), assessmentId)
    }

    override suspend fun saveSessionExecution(sessionId: String, update: JSONObject, operationId: String?): ClubTrainingSession =
        api.saveSessionExecution(token(), sessionId, update, operationId)

    override suspend fun getCoachSessionExecution(sessionId: String): ClubTrainingSession =
        api.getCoachSessionExecution(token(), sessionId)

    override suspend fun generateAssessmentInsights(assessmentId: String): PlayerAssessment =
        api.generateAssessmentInsights(token(), assessmentId)

    override suspend fun assessCompletedSession(sessionId: String, notes: String): ClubTrainingSession =
        api.assessCompletedSession(token(), sessionId, notes)

    override suspend fun createFollowUpSession(sessionId: String, payload: JSONObject): Pair<ClubTrainingSession, List<Drill>> =
        api.createFollowUpSession(token(), sessionId, payload)

    override suspend fun getCertificates(): List<ClubCertificate> =
        api.getCertificates(token())

    override suspend fun deleteCertificate(certificateId: String) {
        api.deleteCertificate(token(), certificateId)
    }

    override suspend fun promotePlayer(playerId: String, newLevel: String, coachName: String, coachNotes: String) {
        api.promotePlayer(token(), playerId, newLevel, coachName, coachNotes)
    }

    override suspend fun getClubBranding(): String? =
        api.getClubBranding(token())

    override suspend fun updateClubBranding(logoUrl: String?) {
        api.updateClubBranding(token(), logoUrl)
    }

    override suspend fun addClubDrill(drill: JSONObject): Drill =
        api.addClubDrill(token(), drill)

    override suspend fun getClubDrills(clubId: String): List<Drill> =
        api.getClubDrills(token(), clubId)

    override suspend fun deleteDrill(drillId: String) {
        api.deleteDrill(token(), drillId)
    }

    override suspend fun cloneDrill(drillId: String): Drill =
        api.cloneDrill(token(), drillId)

    override suspend fun updateDrill(drillId: String, updates: JSONObject): Drill =
        api.updateDrill(token(), drillId, updates)
}
