package com.ecricketcoach.mobile

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.DataOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

data class KinematicsOverlay(
    val discipline: String,
    val timestampMs: Long,
    val issues: List<String>,
    val metrics: Map<String, String>,
    val imageBase64: String,
    val imageMimeType: String
)

class ApiException(val statusCode: Int, message: String) : Exception(message)

internal fun apiErrorMessage(status: Int, body: String, path: String): String {
    val json = runCatching { JSONObject(body) }.getOrNull()
    val serverError = json?.optString("error").orEmpty()
    // Some routes send a machine code in "error" with the user-facing text in "message".
    val message = json?.optString("message").orEmpty()
    if (message.isNotBlank() && serverError.matches(Regex("[a-z_]+"))) return message
    if (serverError.isNotBlank()) return serverError
    if (status == 404 && path.startsWith("/api/coach/sessions/") && path.endsWith("/execution")) {
        return "The API does not provide the session execution route. Deploy the matching API build, then sync and try Run again."
    }
    if (status == 404 && path.startsWith("/api/coach/sessions/") && path.endsWith("/observations")) {
        return "Session observations are unavailable from this API build. Update or restart the coach API, then retry."
    }
    return "The server returned HTTP $status."
}

data class GoogleSignInChallenge(val clientId: String, val nonce: String, val challenge: String)
data class CoachSession(val token: String, val user: CoachUser)

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

data class PlayerAssessment(
    val id: String,
    val playerId: String,
    val playerName: String,
    val title: String,
    val discipline: String,
    val scheduledDate: String,
    val scheduledTime: String? = null,
    val status: String,
    val metrics: List<AssessmentMetric>,
    val aiSummary: String?,
    val aiRecommendations: List<String>,
    val coachName: String = "",
    val strengths: String = "",
    val focusAreas: String = "",
    val coachFeedback: String = "",
    val playerFeedback: String = "",
    val videoAnalysisId: String? = null
)

data class AssessmentVideo(
    val id: String,
    val overallScore: Int,
    val detectedIssues: List<String>,
    val recommendedDrills: List<String>,
    val biomechanics: List<Pair<String, String>>,
    val driveLink: String?,
    val createdAt: String
)

data class CapeFault(
    val code: String,
    val milestone: String,
    val metric: String,
    val value: Double,
    val expectedLo: Double?,
    val expectedHi: Double?,
    val severity: String,
    val message: String,
    val recommendation: String,
    val drill: String?
)

data class CapeDelivery(
    val speedKmh: Double?,
    val speedToleranceKmh: Double,
    val lengthM: Double,
    val lengthZone: String,
    val lineZone: String,
    val isGoodBall: Boolean
)

data class CapeResult(
    val sessionId: String,
    val target: String,
    val handedness: String,
    val shotType: String?,
    val bowlerType: String?,
    val score: Int,
    val verdict: String,
    val faults: List<CapeFault>,
    val strengths: List<String>,
    val unavailable: List<String>,
    val summary: String?,
    val jointAngles: List<Pair<String, Double>>,
    val delivery: CapeDelivery?,
    // (endpoint key, Node download path) for each stored snapshot, ZIP excluded.
    val images: List<Pair<String, String>>,
    val zipPath: String?,
    // Extra kinematics (metric key, value, unit) measured at contact, after the joint angles.
    val contactMetrics: List<CapeMeasure> = emptyList(),
    // Null when the run had no point-of-contact data (e.g. bowling).
    val alignment: List<CapeAlignmentRow>? = null,
    val kinetics: List<CapeMeasure> = emptyList(),
    val contactFrame: Int? = null,
    val contactManual: Boolean = false,
    val contactCandidateCount: Int = 0,
    val guidance: CapeGuidance? = null
)

data class CapeMeasure(val key: String, val label: String, val value: Double, val unit: String)

data class CapeAlignmentRow(val metric: String, val label: String, val value: Double?, val unit: String, val expected: String)

data class CapeGuidance(val summary: String, val items: List<CapeGuidanceItem>)

data class CapeGuidanceItem(
    val faultCode: String,
    val title: String,
    val whyItMatters: String,
    val cues: List<String>,
    val drillName: String,
    val drillInstructions: List<String>,
    val equipment: List<String>
)

data class CapeJobSummary(
    val jobId: String,
    val status: String,
    val assessmentId: String?,
    val target: String?,
    val shotType: String?,
    val bowlerType: String?,
    val score: Int?,
    val verdict: String?,
    val faultCount: Int,
    val errorMessage: String?,
    val createdAt: String
)

data class CapeDrillAssignment(
    val id: String,
    val faultCode: String?,
    val title: String,
    val playerName: String,
    val correction: String?,
    val assignedByName: String?,
    val createdAt: String
)

data class CapeJob(
    val jobId: String,
    val status: String,
    val queuePosition: Int?,
    val errorMessage: String?,
    val result: CapeResult?
) {
    val isPending: Boolean get() = status == "QUEUED" || status == "RUNNING"
}

data class CapeInput(
    val target: String,
    val handedness: String,
    val shotType: String?,
    val bowlerType: String?,
    val calibrationPoints: List<Pair<Int, Int>>
) {
    fun calibrationJson(): String =
        JSONArray(calibrationPoints.map { (x, y) -> JSONArray().put(x).put(y) }).toString()

    fun calibrationArray(): JSONArray =
        JSONArray(calibrationPoints.map { (x, y) -> JSONArray().put(x).put(y) })
}

data class CapeManualFrames(
    val preContact: List<Int> = emptyList(),
    val pointOfContact: List<Int> = emptyList(),
    val postContact: List<Int> = emptyList()
) {
    fun toJson() = JSONObject()
        .put("pre_contact", JSONArray(preContact))
        .put("point_of_contact", JSONArray(pointOfContact))
        .put("post_contact", JSONArray(postContact))

    fun isValid(): Boolean = pointOfContact.isNotEmpty() &&
        (preContact.isEmpty() || preContact.max() < pointOfContact.min()) &&
        (postContact.isEmpty() || pointOfContact.max() < postContact.min())
}

data class CapeContactFrame(val index: Int, val timeSeconds: Double, val imageBase64: String)

data class CapeContactCandidates(
    val framerateFps: Double,
    val frameCount: Int,
    val suggestedFrame: Int?,
    val suggestionSource: String,
    val suggestionNote: String?,
    val frames: List<CapeContactFrame>
)

internal fun sessionPlanUpdates(
    session: ClubTrainingSession,
    title: String,
    date: String,
    duration: Int,
    squad: ClubSquad?,
    safety: List<String>,
    coach: ClubMember? = null
): JSONObject {
    val updates = JSONObject()
        .put("title", title)
        .put("sessionDate", date)
        .put("durationMinutes", duration)
        .put("safety", JSONArray(safety))
    if (squad?.id != session.squadId) {
        updates.put("squadId", squad?.id ?: JSONObject.NULL)
            .put("squadName", squad?.name ?: "All players")
            .put("assignedPlayerIds", JSONArray())
    }
    if (coach != null && coach.id != session.coachId) {
        updates.put("coachId", coach.id)
            .put("coachName", coach.name)
    }
    return updates
}

data class AssessmentMetric(val name: String, val score: Int?, val note: String)
data class DriveVideoFile(val id: String, val name: String, val mimeType: String, val modifiedTime: String)

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

data class VideoAnalysisEntry(
    val id: String,
    val playerName: String?,
    val discipline: String,
    val score: Int,
    val detectedIssues: List<String>,
    val createdAt: String,
    val context: String = "",
    val sourceType: String = "",
    val metrics: List<Pair<String, String>> = emptyList(),
    val recommendedDrills: List<VideoRecommendedDrill> = emptyList()
)

data class VideoRecommendedDrill(
    val title: String,
    val discipline: String,
    val durationMinutes: Int,
    val context: String,
    val isNew: Boolean
)

data class OpenAiBattingContact(
    val status: String,
    val frameIndex: Int?,
    val timestampSeconds: Double?,
    val confidence: Double,
    val evidence: String,
    val imageDataUrl: String?
)

data class OpenAiBattingObservation(
    val title: String,
    val observation: String,
    val coachingImplication: String,
    val confidence: String,
    val alternativeExplanation: String = "",
    val coachingCue: String = "",
    val drill: String = "",
    val frameIndices: List<Int> = emptyList()
)

data class OpenAiBattingStrength(val title: String, val observation: String)

data class OpenAiFindingReview(val findingIndex: Int, val status: String, val note: String)

data class OpenAiCoachReview(val note: String, val findings: List<OpenAiFindingReview>)

data class OpenAiBattingReportSummary(
    val reportId: String,
    val createdAt: String,
    val sourceType: String?,
    val sourceName: String?,
    val discipline: String,
    val shotType: String?
)

/** Raw inputs the server needs to build the movement overlay for a fresh review. */
data class OpenAiPoseOverlayInput(
    val croppedContactImageDataUrl: String,
    val landmarksJson: String,
    val contactPointJson: String,
    val batPointsJson: String,
    val sequenceFrames: List<OpenAiPoseSequenceInput>
)

data class OpenAiPoseSequenceInput(
    val frameIndex: Int,
    val timestampSeconds: Double,
    val phase: String,
    val imageDataUrl: String
)

data class PoseRuleCheck(
    val group: String,
    val metric: String,
    val expectedMin: Double?,
    val expectedMax: Double?,
    val status: String,
    val severity: String?
)

data class PoseRuleFault(
    val code: String,
    val metric: String,
    val value: Double,
    val expectedMin: Double?,
    val expectedMax: Double?,
    val severity: String,
    val message: String,
    val recommendation: String,
    val drill: String?,
    val verdict: String?
)

data class PoseSequenceFrame(
    val frameIndex: Int,
    val timestampSeconds: Double,
    val phase: String,
    val status: String,
    val error: String?,
    val image: ByteArray?
)

data class PoseOverlayResult(
    val handedness: String,
    val shotType: String,
    val metrics: Map<String, Double?>,
    val temporalEstimates: Map<String, Double>,
    val verdict: String,
    val rulesShotType: String,
    val score: Double,
    val scoreScope: String,
    val checks: List<PoseRuleCheck>,
    val faults: List<PoseRuleFault>,
    val strengths: List<String>,
    val unavailable: List<String>,
    val overlayImage: ByteArray?,
    val sequence: List<PoseSequenceFrame>,
    /** Server metadata without inline images, used when saving the overlay to the report. */
    internal val metadataJson: String = "{}"
)

data class OpenAiBattingPhase(
    val phase: String,
    val frameIndex: Int?,
    val timestampSeconds: Double?,
    val evidence: String
)

data class OpenAiBattingDrill(
    val title: String,
    val instructions: List<String>,
    val rationale: String
)

data class OpenAiBattingAnalysis(
    val provider: String,
    val model: String,
    val durationSeconds: Double,
    val width: Int,
    val height: Int,
    val fps: Double,
    val sampledOverviewFrames: Int,
    val contact: OpenAiBattingContact,
    val phases: List<OpenAiBattingPhase>,
    val summary: String,
    val observations: List<OpenAiBattingObservation>,
    val errors: List<OpenAiBattingObservation>,
    val strengths: List<String>,
    val priorityCue: String,
    val drill: OpenAiBattingDrill,
    val limitations: List<String>,
    val reportId: String = "",
    val strengthItems: List<OpenAiBattingStrength> = emptyList(),
    val coachReview: OpenAiCoachReview? = null,
    val batterHandedness: String = "unknown",
    val requestedShotType: String = "unknown",
    val identifiedShotType: String? = null,
    val restoredFromReport: Boolean = false,
    val poseOverlayInput: OpenAiPoseOverlayInput? = null,
    /** Persisted overlay metadata on a saved report; images are fetched as report artifacts. */
    val savedPoseOverlayJson: String? = null,
    val poseOverlay: PoseOverlayResult? = null
)

class CoachApi(private val baseUrl: String, private val oauthOrigin: String) {
    suspend fun getGoogleSignInChallenge(): GoogleSignInChallenge = withContext(Dispatchers.IO) {
        val json = JSONObject(request("/api/auth/google/native"))
        GoogleSignInChallenge(json.getString("clientId"), json.getString("nonce"), json.getString("challenge"))
    }

    suspend fun analyzeKinematicsDriveVideo(
        token: String,
        driveFileId: String,
        discipline: String,
        timestampMs: Long = 0
    ): KinematicsOverlay = withContext(Dispatchers.IO) {
        val response = JSONObject(request(
            "/api/videos/kinematics/analyze",
            token,
            JSONObject()
                .put("driveFileId", driveFileId)
                .put("discipline", discipline)
                .put("timestampMs", timestampMs),
            method = "POST",
            readTimeoutMs = 300_000
        ))
        responseToKinematicsOverlay(response)
    }

    private fun responseToKinematicsOverlay(response: JSONObject): KinematicsOverlay {
        val metricsJson = response.optJSONObject("metrics") ?: JSONObject()
        val metrics = metricsJson.keys().asSequence().associateWith { metricsJson.optString(it) }
        val issues = response.optJSONArray("issues") ?: JSONArray()
        return KinematicsOverlay(
            discipline = response.optString("discipline"),
            timestampMs = response.optLong("timestampMs"),
            issues = (0 until issues.length()).map(issues::getString),
            metrics = metrics,
            imageBase64 = response.getString("overlayImageBase64"),
            imageMimeType = response.optString("overlayMimeType", "image/png")
        )
    }
    suspend fun signInWithGoogle(idToken: String, challenge: String): CoachSession = withContext(Dispatchers.IO) {
        val body = JSONObject().put("idToken", idToken).put("challenge", challenge)
        val json = JSONObject(request("/api/auth/google/native", body = body))
        val user = json.getJSONObject("user")
        val role = user.getString("role")
        require(role in setOf("SUPER_ADMIN", "CLUB_ADMIN", "COACH", "PLAYER")) { "Unsupported account role." }
        val token = json.getString("authToken")
        require(token.isNotBlank()) { "The server returned an empty session token." }
        CoachSession(token, CoachUser(
            id = user.getString("userId"),
            name = user.getString("name"),
            email = user.getString("email"),
            role = role,
            coachContext = user.optString("coachContext").takeIf { it.isNotBlank() && it != "null" },
            tenantId = user.optString("tenantId").takeIf { it.isNotBlank() && it != "null" },
            clubName = user.optString("clubName").takeIf { it.isNotBlank() && it != "null" }
        ))
    }

    suspend fun getProviders(): Map<String, Boolean> = withContext(Dispatchers.IO) {
        val response = request("/api/auth/providers")
        val json = JSONObject(response)
        listOf("google", "microsoft", "apple").associateWith {
            if (it == "google") json.optBoolean("googleNative", json.optBoolean("google"))
            else json.optBoolean(it)
        }
    }

    internal fun signInUrl(provider: String): String {
        require(provider in PROVIDERS) { "Unsupported sign-in provider." }
        val returnTo = URLEncoder.encode(MOBILE_CALLBACK, UTF_8)
        return "${oauthOrigin.trimEnd('/')}/api/auth/$provider?returnTo=$returnTo"
    }

    suspend fun getDrills(token: String, tenantId: String): List<Drill> = withContext(Dispatchers.IO) {
        val rows = JSONArray(request(drillCataloguePath(tenantId), token))
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            Drill(
                id = row.optString("id"),
                title = row.optString("title", "Untitled drill"),
                discipline = row.optString("discipline", "GENERAL"),
                skillSet = row.optString("skillSet", ""),
                durationMinutes = row.optInt("durationMinutes", row.optInt("duration", 0)),
                instructions = row.optString("instructions", ""),
                imageUrl = row.optString("imageUrl").takeIf(String::isNotBlank),
                contextType = row.optString("contextType", "GROUP"),
                source = row.optString("source", "SYSTEM_PREDEFINED")
            )
        }
    }

    internal fun drillCataloguePath(tenantId: String): String {
        val clubId = URLEncoder.encode(tenantId, UTF_8)
        return "/api/drills?clubId=$clubId"
    }

    internal fun sessionExecutionPath(sessionId: String): String =
        "/api/coach/sessions/${URLEncoder.encode(sessionId, UTF_8)}/execution"

    internal fun sessionObservationsPath(sessionId: String): String =
        "/api/coach/sessions/${URLEncoder.encode(sessionId, UTF_8)}/observations"

    internal fun sessionPlayersPath(sessionId: String): String =
        "/api/coach/sessions/${URLEncoder.encode(sessionId, UTF_8)}/players"

    internal fun clubSessionPath(sessionId: String): String =
        "/api/club/sessions/${URLEncoder.encode(sessionId, UTF_8)}"

    internal fun assessmentInsightsPath(assessmentId: String): String =
        "/api/club/assessments/${URLEncoder.encode(assessmentId, UTF_8)}/insights"

    suspend fun getTemplates(token: String): List<TrainingTemplate> = withContext(Dispatchers.IO) {
        val rows = JSONArray(request("/api/training-templates", token))
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            val disciplines = row.optJSONArray("disciplines") ?: JSONArray()
            val safety = row.optJSONArray("safety") ?: JSONArray()
            val drillIds = row.optJSONArray("drillIds") ?: JSONArray()
            TrainingTemplate(
                id = row.optString("id"),
                title = row.optString("title", "Training template"),
                focus = row.optString("focus", ""),
                durationMinutes = row.optInt("durationMinutes"),
                disciplines = (0 until disciplines.length()).map(disciplines::getString),
                safety = (0 until safety.length()).map(safety::getString),
                drillIds = (0 until drillIds.length()).map(drillIds::getString)
            )
        }
    }

    suspend fun getClubMembers(token: String, clubId: String): List<ClubMember> = withContext(Dispatchers.IO) {
        val rows = JSONArray(request("/api/club/members?clubId=${URLEncoder.encode(clubId, UTF_8)}", token))
        (0 until rows.length()).map { index -> rows.getJSONObject(index).toClubMember() }
    }

    suspend fun inviteClubMember(token: String, member: JSONObject): ClubMember = withContext(Dispatchers.IO) {
        val json = JSONObject(request("/api/club/members/invite", token, member))
        json.getJSONObject("member").toClubMember()
    }

    suspend fun acceptClubMember(token: String, memberId: String): ClubMember = withContext(Dispatchers.IO) {
        val json = JSONObject(request(
            "/api/club/members/${URLEncoder.encode(memberId, UTF_8)}/accept-invitation",
            token,
            method = "POST"
        ))
        json.getJSONObject("member").toClubMember()
    }

    suspend fun updateClubMember(
        token: String,
        memberId: String,
        updates: JSONObject,
        operationId: String? = null
    ): ClubMember =
        withContext(Dispatchers.IO) {
            val json = JSONObject(request(
                "/api/club/members/${URLEncoder.encode(memberId, UTF_8)}",
                token,
                updates,
                method = "PATCH",
                idempotencyKey = operationId
            ))
            json.getJSONObject("member").toClubMember()
        }

    suspend fun deleteClubMember(token: String, memberId: String) = withContext(Dispatchers.IO) {
        request(
            "/api/club/members/${URLEncoder.encode(memberId, UTF_8)}",
            token,
            method = "DELETE"
        )
    }

    suspend fun getSquads(token: String, clubId: String): List<ClubSquad> = withContext(Dispatchers.IO) {
        val rows = JSONArray(request("/api/club/squads?clubId=${URLEncoder.encode(clubId, UTF_8)}", token))
        (0 until rows.length()).map { index -> rows.getJSONObject(index).toClubSquad() }
    }

    suspend fun createSquad(token: String, squad: JSONObject): ClubSquad = withContext(Dispatchers.IO) {
        val json = JSONObject(request("/api/club/squads", token, squad))
        json.getJSONObject("squad").toClubSquad()
    }

    suspend fun updateSquad(token: String, squadId: String, updates: JSONObject): ClubSquad =
        withContext(Dispatchers.IO) {
            val json = JSONObject(request(
                "/api/club/squads/${URLEncoder.encode(squadId, UTF_8)}",
                token,
                updates,
                method = "PATCH"
            ))
            json.getJSONObject("squad").toClubSquad()
        }

    suspend fun deleteSquad(token: String, squadId: String) = withContext(Dispatchers.IO) {
        request(
            "/api/club/squads/${URLEncoder.encode(squadId, UTF_8)}",
            token,
            method = "DELETE"
        )
    }

    suspend fun getClubSessions(token: String, clubId: String): List<ClubTrainingSession> =
        withContext(Dispatchers.IO) {
            val rows = JSONArray(request("/api/club/sessions?clubId=${URLEncoder.encode(clubId, UTF_8)}", token))
            (0 until rows.length()).map { index -> rows.getJSONObject(index).toClubTrainingSession() }
        }

    suspend fun getClubSessionReportData(token: String): Pair<List<ClubMember>, List<ClubTrainingSession>> =
        withContext(Dispatchers.IO) {
            val response = JSONObject(request("/api/club/reports/session-activity", token))
            val memberRows = response.optJSONArray("members") ?: JSONArray()
            val sessionRows = response.optJSONArray("sessions") ?: JSONArray()
            val members = (0 until memberRows.length()).map { index -> memberRows.getJSONObject(index).toClubMember() }
            val sessions = (0 until sessionRows.length()).map { index -> sessionRows.getJSONObject(index).toClubTrainingSession() }
            members to sessions
        }

    suspend fun scheduleClubSession(token: String, session: JSONObject): ClubTrainingSession =
        withContext(Dispatchers.IO) {
            val json = JSONObject(request("/api/club/sessions", token, session))
            json.getJSONObject("session").toClubTrainingSession()
        }

    suspend fun getSessionObservations(token: String, sessionId: String): List<SessionObservation> =
        withContext(Dispatchers.IO) {
            val response = JSONObject(request(sessionObservationsPath(sessionId), token))
            val rows = response.optJSONArray("observations") ?: JSONArray()
            (0 until rows.length()).map { index -> rows.getJSONObject(index).toSessionObservation() }
        }

    suspend fun createSessionObservation(
        token: String,
        sessionId: String,
        observation: SessionObservationDraft
    ): SessionObservation = withContext(Dispatchers.IO) {
        val payload = JSONObject()
            .put("id", observation.id)
            .put("scope", observation.scope)
            .put("category", observation.category)
            .put("text", observation.text)
            .put("playerId", observation.playerId ?: JSONObject.NULL)
            .put("drillId", observation.drillId ?: JSONObject.NULL)
        val response = JSONObject(request(
            sessionObservationsPath(sessionId),
            token,
            payload,
            method = "POST",
            idempotencyKey = observation.id
        ))
        response.getJSONObject("observation").toSessionObservation()
    }

    suspend fun addSessionPlayer(
        token: String,
        sessionId: String,
        player: SessionPlayerDraft
    ): SessionPlayerAddition = withContext(Dispatchers.IO) {
        val payload = JSONObject()
            .put("name", player.name)
            .put("email", player.email)
            .put("ageGroup", player.ageGroup)
            .put("disciplines", JSONArray(player.disciplines))
        val response = JSONObject(request(
            sessionPlayersPath(sessionId),
            token,
            payload,
            method = "POST"
        ))
        SessionPlayerAddition(
            member = response.getJSONObject("member").toClubMember(),
            session = response.getJSONObject("session").toClubTrainingSession()
        )
    }

    suspend fun publishClubSession(token: String, sessionId: String): ClubTrainingSession =
        withContext(Dispatchers.IO) {
            val json = JSONObject(request(
                "/api/club/sessions/${URLEncoder.encode(sessionId, UTF_8)}/publish",
                token,
                method = "POST"
            ))
            json.getJSONObject("session").toClubTrainingSession()
        }

    suspend fun updateClubSession(
        token: String,
        sessionId: String,
        updates: JSONObject
    ): ClubTrainingSession = withContext(Dispatchers.IO) {
        val json = JSONObject(request(clubSessionPath(sessionId), token, updates, method = "PATCH"))
        json.getJSONObject("session").toClubTrainingSession()
    }

    suspend fun addDrillToSession(token: String, sessionId: String, drillId: String): ClubTrainingSession =
        withContext(Dispatchers.IO) {
            val json = JSONObject(
                request(
                    "/api/club/sessions/${URLEncoder.encode(sessionId, UTF_8)}/add-drill",
                    token,
                    JSONObject().put("drillId", drillId),
                    method = "PATCH"
                )
            )
            json.getJSONObject("session").toClubTrainingSession()
        }

    suspend fun removeDrillFromSession(token: String, sessionId: String, drillId: String): ClubTrainingSession =
        withContext(Dispatchers.IO) {
            val json = JSONObject(
                request(
                    "/api/club/sessions/${URLEncoder.encode(sessionId, UTF_8)}/remove-drill",
                    token,
                    JSONObject().put("drillId", drillId),
                    method = "PATCH"
                )
            )
            json.getJSONObject("session").toClubTrainingSession()
        }

    suspend fun deleteClubSession(token: String, sessionId: String) = withContext(Dispatchers.IO) {
        request(
            clubSessionPath(sessionId),
            token,
            method = "DELETE"
        )
    }

    suspend fun getPlayerAssessments(token: String): List<PlayerAssessment> = withContext(Dispatchers.IO) {
        val rows = JSONArray(request("/api/club/assessments", token))
        (0 until rows.length()).map { index -> rows.getJSONObject(index).toPlayerAssessment() }
    }

    suspend fun schedulePlayerAssessment(token: String, assessment: JSONObject): PlayerAssessment =
        withContext(Dispatchers.IO) {
            JSONObject(request("/api/club/assessments", token, assessment)).toPlayerAssessment()
        }

    suspend fun updatePlayerAssessment(
        token: String,
        assessmentId: String,
        updates: JSONObject
    ): PlayerAssessment = withContext(Dispatchers.IO) {
        JSONObject(request(
            "/api/club/assessments/${URLEncoder.encode(assessmentId, UTF_8)}",
            token,
            updates,
            method = "PATCH"
        )).toPlayerAssessment()
    }

    suspend fun deleteAssessment(token: String, assessmentId: String) = withContext(Dispatchers.IO) {
        request(
            "/api/club/assessments/${URLEncoder.encode(assessmentId, UTF_8)}",
            token,
            method = "DELETE"
        )
    }

    suspend fun saveSessionExecution(
        token: String,
        sessionId: String,
        update: JSONObject,
        operationId: String? = null
    ): ClubTrainingSession = withContext(Dispatchers.IO) {
        val json = JSONObject(request(
            sessionExecutionPath(sessionId),
            token,
            update,
            method = "PATCH",
            idempotencyKey = operationId
        ))
        json.getJSONObject("session").toClubTrainingSession()
    }

    suspend fun getCoachSessionExecution(token: String, sessionId: String): ClubTrainingSession =
        withContext(Dispatchers.IO) {
            val json = JSONObject(request(
                sessionExecutionPath(sessionId),
                token
            ))
            json.getJSONObject("session").toClubTrainingSession()
        }

    suspend fun generateAssessmentInsights(token: String, assessmentId: String): PlayerAssessment =
        withContext(Dispatchers.IO) {
            JSONObject(request(
                assessmentInsightsPath(assessmentId),
                token,
                JSONObject(),
                method = "POST",
                readTimeoutMs = 180_000
            )).toPlayerAssessment()
        }

    suspend fun assessCompletedSession(
        token: String,
        sessionId: String,
        notes: String
    ): ClubTrainingSession = withContext(Dispatchers.IO) {
        val json = JSONObject(request(
            "/api/club/sessions/${URLEncoder.encode(sessionId, UTF_8)}/post-notes-ai-assess",
            token,
            JSONObject().put("notes", notes),
            method = "POST",
            readTimeoutMs = 180_000
        ))
        json.getJSONObject("session").toClubTrainingSession()
    }

    suspend fun createFollowUpSession(
        token: String,
        sessionId: String,
        payload: JSONObject
    ): Pair<ClubTrainingSession, List<Drill>> = withContext(Dispatchers.IO) {
        val json = JSONObject(request(
            "/api/coach/sessions/${URLEncoder.encode(sessionId, UTF_8)}/follow-up",
            token,
            payload,
            method = "POST"
        ))
        val session = json.getJSONObject("session").toClubTrainingSession()
        val drillRows = json.optJSONArray("drills") ?: JSONArray()
        val createdDrills = (0 until drillRows.length()).map { index ->
            val row = drillRows.getJSONObject(index)
            Drill(
                id = row.optString("id"),
                title = row.optString("title", "Untitled drill"),
                discipline = row.optString("discipline", "GENERAL"),
                skillSet = row.optString("skillSet", ""),
                durationMinutes = row.optInt("durationMinutes", row.optInt("duration", 0)),
                instructions = row.optString("instructions", ""),
                imageUrl = row.optString("imageUrl").takeIf(String::isNotBlank)
            )
        }
        session to createdDrills
    }

    suspend fun getCertificates(token: String): List<ClubCertificate> = withContext(Dispatchers.IO) {
        val rows = JSONArray(request("/api/club/certificates", token))
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            ClubCertificate(
                id = row.optString("id"),
                number = row.optString("certificateNumber"),
                playerName = row.optString("playerName"),
                discipline = row.optString("discipline"),
                level = row.optString("achievedLevel"),
                issuedDate = row.optString("issuedDate"),
                coachName = row.optString("coachName"),
                coachNotes = row.optString("coachNotes"),
                clubName = row.optString("clubName").takeIf { it.isNotBlank() && it != "null" } ?: "eCricketCoach",
                clubLogo = row.optString("clubLogo").takeIf { it.startsWith("data:image/") },
                aiCommendation = row.optString("aiCommendation")
            )
        }
    }

    suspend fun deleteCertificate(token: String, certificateId: String) = withContext(Dispatchers.IO) {
        request(
            "/api/club/certificates/${URLEncoder.encode(certificateId, UTF_8)}",
            token,
            method = "DELETE"
        )
    }

    suspend fun promotePlayer(
        token: String,
        playerId: String,
        newLevel: String,
        coachName: String,
        coachNotes: String
    ) = withContext(Dispatchers.IO) {
        request(
            "/api/club/players/${URLEncoder.encode(playerId, UTF_8)}/assess-progress",
            token,
            JSONObject()
                .put("action", "PROMOTE")
                .put("newLevel", newLevel)
                .put("coachName", coachName)
                .put("coachNotes", coachNotes)
        )
    }

    suspend fun getClubBranding(token: String): String? = withContext(Dispatchers.IO) {
        JSONObject(request("/api/club/settings/branding", token))
            .optString("logoUrl")
            .takeIf { it.isNotBlank() && it != "null" }
    }

    suspend fun updateClubBranding(token: String, logoUrl: String?) = withContext(Dispatchers.IO) {
        request(
            "/api/club/settings/branding",
            token,
            JSONObject().put("logoUrl", logoUrl ?: JSONObject.NULL),
            method = "PATCH"
        )
    }

    suspend fun addClubDrill(token: String, drill: JSONObject): Drill = withContext(Dispatchers.IO) {
        JSONObject(request("/api/drills/club", token, drill)).getJSONObject("drill").let { row ->
            Drill(
                id = row.optString("id"),
                title = row.optString("title"),
                discipline = row.optString("discipline"),
                skillSet = row.optString("skillSet"),
                durationMinutes = row.optInt("duration", row.optInt("durationMinutes")),
                instructions = row.optString("instructions"),
                imageUrl = row.optString("imageUrl").takeIf(String::isNotBlank)
            )
        }
    }

    suspend fun getClubDrills(token: String, clubId: String): List<Drill> = withContext(Dispatchers.IO) {
        getDrills(token, clubId).filter { it.id.startsWith("drill-club-") }
    }

    suspend fun deleteDrill(token: String, drillId: String) = withContext(Dispatchers.IO) {
        request(
            "/api/drills/${URLEncoder.encode(drillId, UTF_8)}",
            token,
            method = "DELETE"
        )
    }

    suspend fun cloneDrill(token: String, drillId: String): Drill = withContext(Dispatchers.IO) {
        val row = JSONObject(request(
            "/api/drills/${URLEncoder.encode(drillId, UTF_8)}/clone",
            token,
            method = "POST"
        )).getJSONObject("drill")
        drillFromJson(row)
    }

    suspend fun updateDrill(token: String, drillId: String, updates: JSONObject): Drill = withContext(Dispatchers.IO) {
        val row = JSONObject(request(
            "/api/drills/${URLEncoder.encode(drillId, UTF_8)}",
            token,
            updates,
            method = "PATCH"
        )).getJSONObject("drill")
        drillFromJson(row)
    }

    private fun drillFromJson(row: JSONObject) = Drill(
        id = row.optString("id"),
        title = row.optString("title", "Untitled drill"),
        discipline = row.optString("discipline", "GENERAL"),
        skillSet = row.optString("skillSet", ""),
        durationMinutes = row.optInt("durationMinutes", row.optInt("duration", 0)),
        instructions = row.optString("instructions", ""),
        imageUrl = row.optString("imageUrl").takeIf(String::isNotBlank),
        contextType = row.optString("contextType", "GROUP"),
        source = row.optString("source", "CLUB_CUSTOM")
    )

    suspend fun getVideoAnalysisHistory(token: String): List<VideoAnalysisEntry> = withContext(Dispatchers.IO) {
        val response = JSONObject(request("/api/videos/analyze/history", token))
        val rows = response.optJSONArray("history") ?: JSONArray()
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            val analysis = row.optJSONObject("analysis") ?: JSONObject()
            analysis.toVideoEntry(
                id = row.optString("id"),
                playerName = row.optString("playerName").takeIf { it.isNotBlank() && it != "null" },
                discipline = row.optString("discipline"),
                score = row.optInt("overallScore", analysis.optInt("overallScore")),
                createdAt = row.optString("createdAt"),
                context = row.optString("context"),
                sourceType = row.optString("sourceType")
            )
        }
    }

    suspend fun deleteVideoAnalysis(token: String, analysisId: String) = withContext(Dispatchers.IO) {
        request(
            "/api/videos/analyze/${URLEncoder.encode(analysisId, UTF_8)}",
            token,
            method = "DELETE"
        )
    }

    suspend fun analyzeVideo(
        context: Context,
        token: String,
        uri: Uri,
        discipline: String,
        player: ClubMember?
    ): VideoAnalysisEntry = withContext(Dispatchers.IO) {
        val fields = buildList {
            add("discipline" to discipline)
            add("context" to if (player == null) "GROUP" else "INDIVIDUAL")
            if (player != null) {
                add("playerId" to player.id)
                add("playerName" to player.name)
            }
        }
        val responseBody = postVideoMultipart(context, token, "/api/videos/analyze", uri, fields)
        responseToVideoEntry(JSONObject(responseBody), discipline, player?.name)
    }

    suspend fun analyzeOpenAiBattingVideo(
        context: Context,
        token: String,
        uri: Uri?,
        driveFileId: String?,
        player: ClubMember?,
        playerId: String? = player?.id,
        assessmentId: String? = null,
        shotType: String = "unknown",
        batterHandedness: String = "unknown",
        cameraView: String = "unknown",
        playbackSpeed: String = "unknown",
        captureFps: Double? = null,
        priorities: List<String> = emptyList(),
        contactTimestampSeconds: Double? = null,
        startTimeSeconds: Double? = null,
        endTimeSeconds: Double? = null
    ): OpenAiBattingAnalysis = withContext(Dispatchers.IO) {
        require((uri != null) xor (!driveFileId.isNullOrBlank())) {
            "Choose one video source."
        }
        val fields = buildList {
            (playerId ?: player?.id)?.let { add("playerId" to it) }
            assessmentId?.let { add("assessmentId" to it) }
            add("shotType" to shotType)
            add("batterHandedness" to batterHandedness)
            add("cameraView" to cameraView)
            add("playbackSpeed" to playbackSpeed)
            captureFps?.let { add("captureFps" to it.toString()) }
            add("priorities" to JSONArray(priorities).toString())
            contactTimestampSeconds?.let { add("contactTimestampSeconds" to it.toString()) }
            startTimeSeconds?.let { add("startTimeSeconds" to it.toString()) }
            endTimeSeconds?.let { add("endTimeSeconds" to it.toString()) }
        }
        val body = if (uri != null) {
            postVideoMultipart(context, token, "/api/videos/analyze/openai-batting", uri, fields)
        } else {
            val json = JSONObject()
                .put("driveFileId", requireNotNull(driveFileId) { "Choose a video first." })
                .put("shotType", shotType)
                .put("batterHandedness", batterHandedness)
                .put("cameraView", cameraView)
                .put("playbackSpeed", playbackSpeed)
                .put("priorities", JSONArray(priorities))
            (playerId ?: player?.id)?.let { json.put("playerId", it) }
            assessmentId?.let { json.put("assessmentId", it) }
            captureFps?.let { json.put("captureFps", it) }
            contactTimestampSeconds?.let { json.put("contactTimestampSeconds", it) }
            startTimeSeconds?.let { json.put("startTimeSeconds", it) }
            endTimeSeconds?.let { json.put("endTimeSeconds", it) }
            request("/api/videos/analyze/openai-batting", token, json, method = "POST", readTimeoutMs = 300_000)
        }
        JSONObject(body).let { response ->
            response.getJSONObject("analysis").put("reportId", response.optString("reportId"))
                .toOpenAiBattingAnalysis()
        }
    }

    suspend fun getLatestOpenAiBattingAnalysis(
        token: String,
        playerId: String,
        assessmentId: String? = null,
        reportId: String? = null
    ): OpenAiBattingAnalysis? = withContext(Dispatchers.IO) {
        val query = buildString {
            append("playerId=${URLEncoder.encode(playerId, UTF_8)}")
            assessmentId?.let { append("&assessmentId=${URLEncoder.encode(it, UTF_8)}") }
            reportId?.let { append("&reportId=${URLEncoder.encode(it, UTF_8)}") }
        }
        val response = JSONObject(request("/api/videos/analyze/openai-batting/latest?$query", token))
        val report = response.optJSONObject("report") ?: return@withContext null
        val analysis = report.optJSONObject("analysis") ?: return@withContext null
        analysis.put("reportId", report.optString("reportId"))
        analysis.toOpenAiBattingAnalysis().copy(restoredFromReport = true)
    }

    suspend fun listOpenAiBattingReports(token: String, playerId: String): List<OpenAiBattingReportSummary> =
        withContext(Dispatchers.IO) {
            val query = "playerId=${URLEncoder.encode(playerId, UTF_8)}"
            val rows = JSONObject(request("/api/videos/analyze/openai-batting/history?$query", token))
                .optJSONArray("reports") ?: JSONArray()
            (0 until rows.length()).mapNotNull { index ->
                val row = rows.optJSONObject(index) ?: return@mapNotNull null
                val reportId = row.optString("reportId").takeIf { REPORT_ID.matches(it) } ?: return@mapNotNull null
                OpenAiBattingReportSummary(
                    reportId = reportId,
                    createdAt = row.optString("createdAt"),
                    sourceType = row.optNullableString("sourceType"),
                    sourceName = row.optNullableString("sourceName"),
                    discipline = row.optString("discipline", "BATTING"),
                    shotType = row.optNullableString("shotType")
                )
            }
        }

    suspend fun saveOpenAiBattingReview(
        token: String,
        reportId: String,
        note: String,
        findings: List<OpenAiFindingReview>
    ) = withContext(Dispatchers.IO) {
        require(REPORT_ID.matches(reportId)) { "Invalid report identifier" }
        val body = JSONObject()
            .put("note", note)
            .put("findings", JSONArray(findings.map {
                JSONObject().put("findingIndex", it.findingIndex).put("status", it.status).put("note", it.note)
            }))
        request("/api/videos/analyze/openai-batting/${URLEncoder.encode(reportId, UTF_8)}/review", token, body, method = "PATCH")
        Unit
    }

    /** Builds the movement overlay and alignment checks from the review's cropped contact frames. */
    suspend fun analyzeOpenAiPoseOverlay(
        token: String,
        input: OpenAiPoseOverlayInput,
        handedness: String,
        shotType: String
    ): PoseOverlayResult = withContext(Dispatchers.IO) {
        val parts = buildList {
            val (mime, bytes) = decodeImageDataUrl(input.croppedContactImageDataUrl)
            add(MultipartPart("image", "openai-contact-crop.jpg", mime, bytes))
            input.sequenceFrames.forEachIndexed { index, frame ->
                val (frameMime, frameBytes) = decodeImageDataUrl(frame.imageDataUrl)
                add(MultipartPart("sequenceImages", "contact-sequence-$index.jpg", frameMime, frameBytes))
            }
        }
        val fields = listOf(
            "handedness" to handedness,
            "shotType" to shotType,
            "openAiLandmarks" to input.landmarksJson,
            "openAiContactPoint" to input.contactPointJson,
            "openAiBatPoints" to input.batPointsJson,
            "sequenceMetadata" to JSONArray(input.sequenceFrames.map {
                JSONObject().put("frameIndex", it.frameIndex).put("timestampSeconds", it.timestampSeconds).put("phase", it.phase)
            }).toString()
        )
        JSONObject(postBytesMultipart(token, "/api/videos/kinematics/analyze-image", fields, parts)).toPoseOverlayResult()
    }

    suspend fun saveOpenAiPoseOverlay(token: String, reportId: String, result: PoseOverlayResult) = withContext(Dispatchers.IO) {
        require(REPORT_ID.matches(reportId)) { "Invalid report identifier" }
        val overlay = requireNotNull(result.overlayImage) { "The pose overlay image is missing." }
        val metadata = JSONObject(result.metadataJson)
        val parts = buildList {
            add(MultipartPart("overlay", "pose-overlay.png", "image/png", overlay))
            result.sequence.forEachIndexed { index, frame ->
                if (frame.status == "success" && frame.image != null) {
                    add(MultipartPart("sequence_$index", "pose-sequence-$index.png", "image/png", frame.image))
                }
            }
        }
        postBytesMultipart(
            token,
            "/api/videos/analyze/openai-batting/${URLEncoder.encode(reportId, UTF_8)}/pose-overlay",
            listOf("poseOverlay" to metadata.toString()),
            parts
        )
        Unit
    }

    /** Restores a saved overlay by downloading its PNG artifacts from the report. */
    suspend fun loadSavedPoseOverlay(token: String, analysis: OpenAiBattingAnalysis): PoseOverlayResult? =
        withContext(Dispatchers.IO) {
            val json = analysis.savedPoseOverlayJson?.let(::JSONObject) ?: return@withContext null
            val reportId = analysis.reportId.takeIf { REPORT_ID.matches(it) } ?: return@withContext null
            fun artifact(name: String?): ByteArray? {
                if (name == null || !ARTIFACT_NAME.matches(name)) return null
                return runCatching {
                    requestBytes("/api/videos/analyze/openai-batting/${URLEncoder.encode(reportId, UTF_8)}/artifacts/${URLEncoder.encode(name, UTF_8)}", token)
                }.getOrNull()
            }
            val overlay = artifact(json.optNullableString("overlayArtifactName"))
            val sequence = json.optJSONArray("sequence") ?: JSONArray()
            for (index in 0 until sequence.length()) {
                val frame = sequence.optJSONObject(index) ?: continue
                artifact(frame.optNullableString("artifactName"))?.let {
                    frame.put("overlay_image_base64", java.util.Base64.getEncoder().encodeToString(it))
                }
            }
            overlay?.let { json.put("overlay_image_base64", java.util.Base64.getEncoder().encodeToString(it)) }
            json.toPoseOverlayResult()
        }

    private fun JSONObject.toOpenAiBattingAnalysis(): OpenAiBattingAnalysis {
        val video = optJSONObject("video") ?: JSONObject()
        val contactJson = optJSONObject("contact") ?: JSONObject()
        val drillJson = optJSONObject("drill") ?: JSONObject()
        fun strings(name: String): List<String> {
            val array = optJSONArray(name) ?: JSONArray()
            return (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotBlank) }
        }
        fun observations(name: String): List<OpenAiBattingObservation> {
            val array = optJSONArray(name) ?: JSONArray()
            return (0 until array.length()).mapNotNull { index ->
                val row = array.optJSONObject(index) ?: return@mapNotNull null
                val frames = row.optJSONArray("frameIndices") ?: JSONArray()
                OpenAiBattingObservation(
                    title = row.optString("title"),
                    observation = row.optString("observation"),
                    coachingImplication = row.optString("coachingImplication"),
                    confidence = row.optString("confidence", "low"),
                    alternativeExplanation = row.optNullableString("alternativeExplanation").orEmpty(),
                    coachingCue = row.optNullableString("coachingCue").orEmpty(),
                    drill = row.optNullableString("drill").orEmpty(),
                    frameIndices = (0 until frames.length()).mapNotNull { frames.opt(it) as? Number }.map(Number::toInt)
                )
            }
        }
        val strengthArray = optJSONArray("strengths") ?: JSONArray()
        val strengthItems = (0 until strengthArray.length()).mapNotNull { index ->
            when (val value = strengthArray.opt(index)) {
                is JSONObject -> OpenAiBattingStrength(value.optString("title"), value.optString("observation"))
                is String -> value.takeIf(String::isNotBlank)?.let { OpenAiBattingStrength("", it) }
                else -> null
            }
        }
        val review = optJSONObject("coachReview")?.let { json ->
            val rows = json.optJSONArray("findings") ?: JSONArray()
            OpenAiCoachReview(
                note = json.optString("note"),
                findings = (0 until rows.length()).mapNotNull { index ->
                    val row = rows.optJSONObject(index) ?: return@mapNotNull null
                    OpenAiFindingReview(row.optInt("findingIndex"), row.optString("status"), row.optString("note"))
                }
            )
        }
        val requestMetadata = optJSONObject("requestMetadata") ?: JSONObject()
        val identification = optJSONObject("shotIdentification") ?: JSONObject()
        val identifiedHand = identification.optString("batterHandedness", "unknown")
        val croppedImage = optNullableString("croppedContactImageDataUrl")?.takeIf { it.startsWith("data:image/") }
        val poseInput = croppedImage?.let { image ->
            val frames = optJSONArray("poseSequenceFrames") ?: JSONArray()
            OpenAiPoseOverlayInput(
                croppedContactImageDataUrl = image,
                landmarksJson = (optJSONObject("croppedContactLandmarksNorm") ?: JSONObject()).toString(),
                contactPointJson = optJSONObject("croppedContactPointNorm")?.toString() ?: "null",
                batPointsJson = JSONObject()
                    .put("handle", optJSONObject("croppedBatHandleNorm") ?: JSONObject.NULL)
                    .put("toe", optJSONObject("croppedBatToeNorm") ?: JSONObject.NULL)
                    .put("angle", optJSONObject("contactBatAngle")?.opt("angleDegrees")?.takeIf { it is Number } ?: JSONObject.NULL)
                    .toString(),
                sequenceFrames = (0 until frames.length()).mapNotNull { index ->
                    val frame = frames.optJSONObject(index) ?: return@mapNotNull null
                    val url = frame.optString("imageDataUrl").takeIf { it.startsWith("data:image/") } ?: return@mapNotNull null
                    OpenAiPoseSequenceInput(frame.optInt("frameIndex"), frame.optDouble("timestampSeconds", 0.0), frame.optString("phase"), url)
                }
            )
        }
        val phaseArray = optJSONArray("phases") ?: JSONArray()
        val instructionArray = drillJson.optJSONArray("instructions") ?: JSONArray()
        return OpenAiBattingAnalysis(
            provider = optString("provider", "openai"),
            model = optString("model"),
            durationSeconds = video.optDouble("durationSeconds"),
            width = video.optInt("width"),
            height = video.optInt("height"),
            fps = video.optDouble("fps"),
            sampledOverviewFrames = video.optInt("sampledOverviewFrames"),
            contact = OpenAiBattingContact(
                status = contactJson.optString("status", "UNCERTAIN"),
                frameIndex = if (contactJson.isNull("frameIndex")) null else contactJson.optInt("frameIndex"),
                timestampSeconds = if (contactJson.isNull("timestampSeconds")) null else contactJson.optDouble("timestampSeconds"),
                confidence = contactJson.optDouble("confidence"),
                evidence = contactJson.optString("evidence"),
                imageDataUrl = contactJson.optString("imageDataUrl").takeIf { it.startsWith("data:image/") }
            ),
            phases = (0 until phaseArray.length()).mapNotNull { index ->
                val row = phaseArray.optJSONObject(index) ?: return@mapNotNull null
                OpenAiBattingPhase(
                    phase = row.optString("phase"),
                    frameIndex = if (row.isNull("frameIndex")) null else row.optInt("frameIndex"),
                    timestampSeconds = if (row.isNull("timestampSeconds")) null else row.optDouble("timestampSeconds"),
                    evidence = row.optString("evidence")
                )
            },
            summary = optString("summary"),
            observations = observations("observations"),
            errors = observations("errors"),
            strengths = strengthItems.map { if (it.title.isBlank()) it.observation else "${it.title}: ${it.observation}" },
            priorityCue = optString("priorityCue"),
            drill = OpenAiBattingDrill(
                title = drillJson.optString("title"),
                instructions = (0 until instructionArray.length()).map(instructionArray::optString),
                rationale = drillJson.optString("rationale")
            ),
            limitations = strings("limitations"),
            reportId = optString("reportId"),
            strengthItems = strengthItems,
            coachReview = review,
            batterHandedness = if (identifiedHand != "unknown") identifiedHand else requestMetadata.optString("batterHandedness", "unknown"),
            requestedShotType = requestMetadata.optString("shotType", "unknown"),
            identifiedShotType = identification.optNullableString("shotType"),
            poseOverlayInput = poseInput,
            savedPoseOverlayJson = optJSONObject("poseOverlay")?.takeIf { it.has("overlayArtifactName") }?.toString()
        )
    }

    private fun JSONObject.toPoseOverlayResult(): PoseOverlayResult {
        fun nullableDouble(json: JSONObject, name: String): Double? =
            (json.opt(name) as? Number)?.toDouble()?.takeIf { it.isFinite() }
        fun expected(json: JSONObject): Pair<Double?, Double?> {
            val array = json.optJSONArray("expected") ?: return null to null
            return (array.opt(0) as? Number)?.toDouble() to (array.opt(1) as? Number)?.toDouble()
        }
        fun stringList(array: JSONArray?): List<String> =
            if (array == null) emptyList() else (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotBlank) }
        fun decode(base64: String?): ByteArray? =
            base64?.takeIf { it.isNotBlank() }?.let { runCatching { java.util.Base64.getDecoder().decode(it) }.getOrNull() }

        val metricsJson = optJSONObject("metrics") ?: JSONObject()
        val metrics = metricsJson.keys().asSequence().associateWith { nullableDouble(metricsJson, it) }
        val temporalJson = optJSONObject("temporal_angle_estimates") ?: JSONObject()
        val temporal = temporalJson.keys().asSequence().mapNotNull { key ->
            temporalJson.optJSONObject(key)?.let { nullableDouble(it, "value") }?.let { key to it }
        }.toMap()
        val rules = optJSONObject("coaching_rules") ?: JSONObject()
        val checkArray = rules.optJSONArray("checks") ?: JSONArray()
        val faultArray = rules.optJSONArray("faults") ?: JSONArray()
        val sequenceArray = optJSONArray("sequence") ?: JSONArray()
        val sequence = (0 until sequenceArray.length()).mapNotNull { index ->
            val frame = sequenceArray.optJSONObject(index) ?: return@mapNotNull null
            PoseSequenceFrame(
                frameIndex = frame.optInt("frame_index"),
                timestampSeconds = frame.optDouble("timestamp_seconds", 0.0),
                phase = frame.optString("phase"),
                status = frame.optString("status"),
                error = frame.optNullableString("error"),
                image = decode(frame.optNullableString("overlay_image_base64"))
            )
        }
        val metadata = JSONObject(toString()).apply {
            remove("overlay_image_base64")
            remove("overlayArtifactName")
            optJSONArray("sequence")?.let { frames ->
                for (index in 0 until frames.length()) {
                    frames.optJSONObject(index)?.apply { remove("overlay_image_base64"); remove("artifactName") }
                }
            }
        }
        return PoseOverlayResult(
            handedness = optString("handedness", "right"),
            shotType = optString("shot_type"),
            metrics = metrics,
            temporalEstimates = temporal,
            verdict = rules.optString("verdict"),
            rulesShotType = rules.optString("shot_type"),
            score = rules.optDouble("score", 0.0),
            scoreScope = rules.optString("score_scope"),
            checks = (0 until checkArray.length()).mapNotNull { index ->
                val check = checkArray.optJSONObject(index) ?: return@mapNotNull null
                val (min, max) = expected(check)
                PoseRuleCheck(check.optString("group"), check.optString("metric"), min, max, check.optString("status"), check.optNullableString("severity"))
            },
            faults = (0 until faultArray.length()).mapNotNull { index ->
                val fault = faultArray.optJSONObject(index) ?: return@mapNotNull null
                val (min, max) = expected(fault)
                PoseRuleFault(
                    code = fault.optString("code"),
                    metric = fault.optString("metric"),
                    value = fault.optDouble("value", 0.0),
                    expectedMin = min,
                    expectedMax = max,
                    severity = fault.optString("severity", "low"),
                    message = fault.optString("message"),
                    recommendation = fault.optString("recommendation"),
                    drill = fault.optNullableString("drill"),
                    verdict = fault.optNullableString("verdict")
                )
            },
            strengths = stringList(rules.optJSONArray("strengths")),
            unavailable = stringList(rules.optJSONArray("unavailable")),
            overlayImage = decode(optNullableString("overlay_image_base64")),
            sequence = sequence,
            metadataJson = metadata.toString()
        )
    }

    private fun JSONObject.optNullableString(name: String): String? =
        if (isNull(name)) null else optString(name).takeIf { it.isNotBlank() && it != "null" }

    private fun decodeImageDataUrl(dataUrl: String): Pair<String, ByteArray> {
        val match = Regex("^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$").find(dataUrl)
            ?: throw IllegalArgumentException("A contact frame is not a supported image.")
        return match.groupValues[1] to java.util.Base64.getDecoder().decode(match.groupValues[2])
    }

    private class MultipartPart(val name: String, val fileName: String, val mimeType: String, val bytes: ByteArray)

    private fun postBytesMultipart(
        token: String,
        path: String,
        fields: List<Pair<String, String>>,
        parts: List<MultipartPart>
    ): String {
        val boundary = "eCricketCoach-${UUID.randomUUID()}"
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 15_000
        connection.readTimeout = 180_000
        connection.doOutput = true
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Authorization", "Bearer $token")
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
        try {
            DataOutputStream(connection.outputStream).use { output ->
                fields.forEach { (name, value) -> writeMultipartField(output, boundary, name, value) }
                parts.forEach { part ->
                    output.writeBytes("--$boundary\r\n")
                    output.writeBytes("Content-Disposition: form-data; name=\"${part.name}\"; filename=\"${part.fileName}\"\r\n")
                    output.writeBytes("Content-Type: ${part.mimeType}\r\n\r\n")
                    output.write(part.bytes)
                    output.writeBytes("\r\n")
                }
                output.writeBytes("--$boundary--\r\n")
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw ApiException(status, apiErrorMessage(status, responseBody, path))
            return responseBody
        } finally {
            connection.disconnect()
        }
    }

    private fun requestBytes(path: String, token: String): ByteArray {
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 30_000
        connection.setRequestProperty("Authorization", "Bearer $token")
        try {
            val status = connection.responseCode
            if (status !in 200..299) {
                val body = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                throw ApiException(status, apiErrorMessage(status, body, path))
            }
            return connection.inputStream.use { it.readBytes() }
        } finally {
            connection.disconnect()
        }
    }

    suspend fun analyzeKinematicsVideo(
        context: Context,
        token: String,
        uri: Uri,
        discipline: String,
        timestampMs: Long = 0
    ): KinematicsOverlay = withContext(Dispatchers.IO) {
        val fields = listOf("discipline" to discipline, "timestampMs" to timestampMs.toString())
        responseToKinematicsOverlay(JSONObject(postVideoMultipart(context, token, "/api/videos/kinematics/analyze", uri, fields)))
    }

    suspend fun getAssessmentVideo(token: String, assessmentId: String): AssessmentVideo? = withContext(Dispatchers.IO) {
        JSONObject(request(assessmentVideoPath(assessmentId), token)).optJSONObject("video")?.toAssessmentVideo()
    }

    // Uploads a clip recorded during an assessment. The server stores it in the coach's Google Drive,
    // analyses it with AI and links the analysis to the assessment.
    suspend fun uploadAssessmentVideo(
        context: Context,
        token: String,
        assessmentId: String,
        uri: Uri
    ): Pair<PlayerAssessment, AssessmentVideo> = withContext(Dispatchers.IO) {
        val response = JSONObject(postVideoMultipart(context, token, assessmentVideoPath(assessmentId), uri, emptyList()))
        response.getJSONObject("assessment").toPlayerAssessment() to response.getJSONObject("video").toAssessmentVideo()
    }

    internal fun assessmentVideoPath(assessmentId: String): String =
        "/api/club/assessments/${URLEncoder.encode(assessmentId, UTF_8)}/video"

    suspend fun analyzeAssessmentDriveVideo(
        token: String,
        assessmentId: String,
        driveFileId: String
    ): Pair<PlayerAssessment, AssessmentVideo> = withContext(Dispatchers.IO) {
        val response = JSONObject(
            request(
                assessmentVideoPath(assessmentId),
                token,
                JSONObject().put("driveFileId", driveFileId),
                method = "POST",
                readTimeoutMs = 300_000
            )
        )
        response.getJSONObject("assessment").toPlayerAssessment() to response.getJSONObject("video").toAssessmentVideo()
    }

    suspend fun getAssessmentCapeJob(token: String, assessmentId: String): CapeJob? = withContext(Dispatchers.IO) {
        JSONObject(request(assessmentVideoPath(assessmentId), token)).optJSONObject("capeJob")?.toCapeJob()
    }

    // Queues a detailed (CAPE) analysis from a local clip or a Google Drive file; returns the job id.
    suspend fun analyzeAssessmentVideoWithCape(
        context: Context,
        token: String,
        assessmentId: String,
        uri: Uri?,
        driveFileId: String?,
        input: CapeInput
    ): String = withContext(Dispatchers.IO) {
        val fields = buildList {
            add("engine" to "cape")
            add("target" to input.target)
            add("handedness" to input.handedness)
            input.shotType?.let { add("shot_type" to it) }
            input.bowlerType?.let { add("bowler_type" to it) }
            add("calibration_points" to input.calibrationJson())
        }
        val body = if (uri != null) {
            postVideoMultipart(context, token, assessmentVideoPath(assessmentId), uri, fields)
        } else {
            val json = JSONObject().put("driveFileId", requireNotNull(driveFileId) { "Choose a video first." })
            fields.forEach { (name, value) -> json.put(name, value) }
            request(assessmentVideoPath(assessmentId), token, json, method = "POST", readTimeoutMs = 60_000)
        }
        JSONObject(body).getString("jobId")
    }

    suspend fun analyzePlayerVideoWithCape(
        context: Context,
        token: String,
        playerId: String,
        uri: Uri?,
        driveFileId: String?,
        input: CapeInput,
        manualFrames: CapeManualFrames? = null
    ): String = withContext(Dispatchers.IO) {
        val fields = buildList {
            add("playerId" to playerId)
            add("target" to input.target)
            add("handedness" to input.handedness)
            input.shotType?.let { add("shot_type" to it) }
            input.bowlerType?.let { add("bowler_type" to it) }
            add("calibration_points" to input.calibrationJson())
            manualFrames?.let { add("manual_frames" to it.toJson().toString()) }
        }
        val body = if (uri != null) {
            postVideoMultipart(context, token, "/api/club/cape-jobs", uri, fields)
        } else {
            val json = JSONObject()
                .put("playerId", playerId)
                .put("driveFileId", requireNotNull(driveFileId) { "Choose a video first." })
                .put("target", input.target)
                .put("handedness", input.handedness)
                .put("calibration_points", input.calibrationArray())
            input.shotType?.let { json.put("shot_type", it) }
            input.bowlerType?.let { json.put("bowler_type", it) }
            manualFrames?.let { json.put("manual_frames", it.toJson()) }
            request("/api/club/cape-jobs", token, json, method = "POST", readTimeoutMs = 60_000)
        }
        JSONObject(body).getString("jobId")
    }

    suspend fun getLatestPlayerCapeJob(token: String, playerId: String, target: String): CapeJob? = withContext(Dispatchers.IO) {
        val query = "playerId=${URLEncoder.encode(playerId, UTF_8)}&target=${URLEncoder.encode(target, UTF_8)}"
        JSONObject(request("/api/club/cape-jobs/latest?$query", token)).optJSONObject("job")?.toCapeJob()
    }

    suspend fun getCapeContactCandidates(
        context: Context,
        token: String,
        uri: Uri?,
        driveFileId: String?,
        centerFrame: Int? = null,
        before: Int? = null,
        after: Int? = null
    ): CapeContactCandidates = withContext(Dispatchers.IO) {
        val body = if (uri != null) {
            val fields = buildList {
                centerFrame?.let { add("centerFrame" to it.toString()) }
                before?.let { add("before" to it.toString()) }
                after?.let { add("after" to it.toString()) }
            }
            postVideoMultipart(context, token, "/api/club/cape-jobs/contact-candidates", uri, fields)
        } else {
            val json = JSONObject().put("driveFileId", requireNotNull(driveFileId) { "Choose a video first." })
            centerFrame?.let { json.put("centerFrame", it) }
            before?.let { json.put("before", it) }
            after?.let { json.put("after", it) }
            request("/api/club/cape-jobs/contact-candidates", token, json, method = "POST", readTimeoutMs = 300_000)
        }
        JSONObject(body).toCapeContactCandidates()
    }

    suspend fun downloadDriveVideoToCache(context: Context, token: String, driveFileId: String): File = withContext(Dispatchers.IO) {
        val path = "/api/google-drive/videos/${URLEncoder.encode(driveFileId, UTF_8)}/content"
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 300_000
        connection.setRequestProperty("Authorization", "Bearer $token")
        val file = File(context.cacheDir, "cape-calibration-${UUID.randomUUID()}.mp4")
        try {
            val status = connection.responseCode
            if (status !in 200..299) {
                val response = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                throw ApiException(status, apiErrorMessage(status, response, path))
            }
            connection.inputStream.use { input ->
                file.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var total = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        require(total <= MAX_VIDEO_BYTES) { "Choose a video smaller than 500 MB." }
                        output.write(buffer, 0, read)
                    }
                }
            }
            file
        } catch (failure: Exception) {
            file.delete()
            throw failure
        } finally {
            connection.disconnect()
        }
    }

    suspend fun getCapeJob(token: String, jobId: String): CapeJob = withContext(Dispatchers.IO) {
        JSONObject(request("/api/club/cape-jobs/${URLEncoder.encode(jobId, UTF_8)}", token)).getJSONObject("job").toCapeJob()
    }

    suspend fun deleteCapeJob(token: String, jobId: String) = withContext(Dispatchers.IO) {
        request(
            "/api/club/cape-jobs/${URLEncoder.encode(jobId, UTF_8)}",
            token,
            method = "DELETE"
        )
    }

    suspend fun getPlayerCapeJobs(token: String, playerId: String): List<CapeJobSummary> = withContext(Dispatchers.IO) {
        val rows = JSONObject(request("/api/club/cape-jobs?playerId=${URLEncoder.encode(playerId, UTF_8)}", token))
            .optJSONArray("jobs") ?: JSONArray()
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            CapeJobSummary(
                jobId = row.getString("jobId"),
                status = row.optString("status"),
                assessmentId = row.text("assessmentId"),
                target = row.text("target"),
                shotType = row.text("shotType"),
                bowlerType = row.text("bowlerType"),
                score = if (row.isNull("score")) null else row.optInt("score"),
                verdict = row.text("verdict"),
                faultCount = row.optInt("faultCount"),
                errorMessage = row.text("errorMessage"),
                createdAt = row.optString("createdAt")
            )
        }
    }

    suspend fun getCapeJobDrills(token: String, jobId: String): List<CapeDrillAssignment> = withContext(Dispatchers.IO) {
        val rows = JSONObject(request("/api/club/cape-jobs/${URLEncoder.encode(jobId, UTF_8)}/drills", token))
            .optJSONArray("assignments") ?: JSONArray()
        (0 until rows.length()).map { rows.getJSONObject(it).toCapeDrillAssignment() }
    }

    // Assigns a coaching-guidance drill to the analysed player; the server also adds it to the drill catalogues.
    suspend fun assignCapeDrill(token: String, jobId: String, faultCode: String): CapeDrillAssignment = withContext(Dispatchers.IO) {
        JSONObject(request(
            "/api/club/cape-jobs/${URLEncoder.encode(jobId, UTF_8)}/drills",
            token,
            JSONObject().put("faultCode", faultCode),
            method = "POST"
        )).getJSONObject("assignment").toCapeDrillAssignment()
    }

    private fun JSONObject.toCapeDrillAssignment() = CapeDrillAssignment(
        id = optString("id"),
        faultCode = text("faultCode"),
        title = optString("title"),
        playerName = optString("playerName"),
        correction = optJSONObject("details")?.text("correction"),
        assignedByName = text("assignedByName"),
        createdAt = optString("createdAt")
    )

    // Downloads an analysis image or ZIP through the authenticated Node route; returns bytes and file name.
    suspend fun downloadCapeArtifact(token: String, path: String): Pair<ByteArray, String> = withContext(Dispatchers.IO) {
        require(path.startsWith("/api/club/cape-jobs/")) { "Invalid download link." }
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 120_000
        connection.setRequestProperty("Authorization", "Bearer $token")
        try {
            val status = connection.responseCode
            if (status !in 200..299) {
                val body = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                throw ApiException(status, apiErrorMessage(status, body, path))
            }
            val fileName = Regex("filename=\"?([^\";]+)\"?")
                .find(connection.getHeaderField("Content-Disposition").orEmpty())
                ?.groupValues?.get(1)
                ?: path.substringAfterLast('/')
            connection.inputStream.use { it.readBytes() } to fileName
        } finally {
            connection.disconnect()
        }
    }

    private fun postVideoMultipart(
        context: Context,
        token: String,
        path: String,
        uri: Uri,
        fields: List<Pair<String, String>>
    ): String {
        val resolver = context.contentResolver
        val fileName = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
            ?.replace(Regex("[\\r\\n\"]"), "_")
            ?.takeIf(String::isNotBlank)
            ?: "training-video"
        val mimeType = resolver.getType(uri)
            ?.takeIf { it.matches(Regex("video/[A-Za-z0-9.+-]+")) }
            ?: "video/mp4"
        val fileSize = resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null
            }
        require(fileSize == null || fileSize <= MAX_VIDEO_BYTES) {
            "Choose a video smaller than 500 MB."
        }

        val boundary = "eCricketCoach-${System.currentTimeMillis()}"
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 15_000
        connection.readTimeout = 300_000
        connection.doOutput = true
        connection.setChunkedStreamingMode(64 * 1024)
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Authorization", "Bearer $token")
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")

        try {
            DataOutputStream(connection.outputStream).use { output ->
                fields.forEach { (name, value) -> writeMultipartField(output, boundary, name, value) }
                output.writeBytes("--$boundary\r\n")
                output.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"$fileName\"\r\n")
                output.writeBytes("Content-Type: $mimeType\r\n\r\n")
                resolver.openInputStream(uri)?.use { input ->
                    input.copyTo(output, 64 * 1024)
                } ?: error("Unable to open the selected video.")
                output.writeBytes("\r\n--$boundary--\r\n")
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = apiErrorMessage(status, responseBody, path)
                throw ApiException(status, message)
            }
            return responseBody
        } finally {
            connection.disconnect()
        }
    }

    suspend fun getGoogleDriveStatus(token: String): Pair<Boolean, String?> = withContext(Dispatchers.IO) {
        val response = JSONObject(request("/api/google-drive/status", token))
        response.optBoolean("connected") to response.optString("email").takeIf { it.isNotBlank() && it != "null" }
    }

    internal fun googleDriveConnectUrl(token: String): String =
        "${baseUrl.trimEnd('/')}/api/google-drive/connect?token=${URLEncoder.encode(token, UTF_8)}"

    suspend fun listGoogleDriveVideos(token: String): List<DriveVideoFile> = withContext(Dispatchers.IO) {
        val files = JSONObject(request("/api/google-drive/videos", token)).optJSONArray("files") ?: JSONArray()
        (0 until files.length()).map { index ->
            val row = files.getJSONObject(index)
            DriveVideoFile(
                id = row.optString("id"),
                name = row.optString("name", "Drive video"),
                mimeType = row.optString("mimeType"),
                modifiedTime = row.optString("modifiedTime")
            )
        }
    }

    suspend fun disconnectGoogleDrive(token: String) = withContext(Dispatchers.IO) {
        request("/api/google-drive/disconnect", token, JSONObject(), method = "POST")
    }

    suspend fun analyzeDriveVideo(
        token: String,
        driveFileId: String,
        discipline: String,
        player: ClubMember?
    ): VideoAnalysisEntry = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("discipline", discipline)
            .put("context", if (player == null) "GROUP" else "INDIVIDUAL")
            .put("driveFileId", driveFileId)
        if (player != null) body.put("playerId", player.id).put("playerName", player.name)
        val response = JSONObject(request("/api/videos/analyze", token, body))
        responseToVideoEntry(response, discipline, player?.name)
    }

    private fun responseToVideoEntry(
        response: JSONObject,
        discipline: String,
        playerName: String?
    ): VideoAnalysisEntry {
        val analysis = response.getJSONObject("analysis")
        return analysis.toVideoEntry(
            id = response.optString("analysisId"),
            playerName = playerName,
            discipline = response.optString("discipline", discipline),
            score = analysis.optInt("overallScore"),
            createdAt = "",
            context = if (playerName == null) "GROUP" else "INDIVIDUAL",
            sourceType = response.optString("sourceType")
        )
    }

    private fun JSONObject.toVideoEntry(
        id: String,
        playerName: String?,
        discipline: String,
        score: Int,
        createdAt: String,
        context: String,
        sourceType: String
    ): VideoAnalysisEntry {
        val issues = optJSONArray("detectedIssues") ?: JSONArray()
        val metricsJson = optJSONObject("biomechanicalMetrics")
        val metrics = metricsJson?.keys()?.asSequence()
            ?.mapNotNull { key ->
                metricsJson.optString(key).takeIf { it.isNotBlank() && it != "null" }?.let { key to it }
            }
            ?.toList()
            .orEmpty()
        val drillsJson = optJSONArray("recommendedDrills") ?: JSONArray()
        val drills = (0 until drillsJson.length()).mapNotNull { index ->
            val drill = drillsJson.optJSONObject(index) ?: return@mapNotNull null
            VideoRecommendedDrill(
                title = drill.optString("title"),
                discipline = drill.optString("discipline"),
                durationMinutes = drill.optInt("durationMinutes"),
                context = drill.optString("context"),
                isNew = drill.optBoolean("isNewRecommendation")
            )
        }
        return VideoAnalysisEntry(
            id = id,
            playerName = playerName,
            discipline = discipline,
            score = score,
            detectedIssues = (0 until issues.length()).map(issues::getString),
            createdAt = createdAt,
            context = context.takeIf { it != "null" }.orEmpty(),
            sourceType = sourceType.takeIf { it != "null" }.orEmpty(),
            metrics = metrics,
            recommendedDrills = drills
        )
    }

    private fun writeMultipartField(output: DataOutputStream, boundary: String, name: String, value: String) {
        output.writeBytes("--$boundary\r\n")
        output.writeBytes("Content-Disposition: form-data; name=\"$name\"\r\n\r\n")
        output.write(value.toByteArray(Charsets.UTF_8))
        output.writeBytes("\r\n")
    }

    private fun request(
        path: String,
        token: String? = null,
        body: JSONObject? = null,
        method: String? = null,
        readTimeoutMs: Int = 15_000,
        idempotencyKey: String? = null
    ): String {
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.requestMethod = method ?: if (body == null) "GET" else "POST"
        connection.connectTimeout = 10_000
        connection.readTimeout = readTimeoutMs
        connection.setRequestProperty("Accept", "application/json")
        if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
        if (idempotencyKey != null) connection.setRequestProperty("Idempotency-Key", idempotencyKey)

        try {
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body.toString()) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = apiErrorMessage(status, body, path)
                throw ApiException(status, message)
            }
            return body
        } finally {
            connection.disconnect()
        }
    }

    private fun JSONObject.toClubMember() = ClubMember(
        id = optString("id"),
        name = optString("name", "Club member"),
        email = optString("email"),
        role = optString("role", "PLAYER"),
        ageGroup = optString("ageGroup"),
        discipline = optString("discipline", "BATTING"),
        invitationStatus = optString("invitationStatus", "ACTIVE"),
        currentLevel = optString("currentLevel", "FOUNDATION"),
        squad = optString("squad", "Unassigned"),
        squads = optJSONArray("squads")?.let { array ->
            (0 until array.length()).map { array.optString(it) }.filter { it.isNotBlank() }
        } ?: optString("squad", "Unassigned").let { squad ->
            if (squad.isBlank() || squad == "Unassigned") emptyList() else listOf(squad)
        }
    )

    private fun JSONObject.toClubSquad(): ClubSquad {
        val rawDisciplines = opt("discipline")
        val disciplines = when (rawDisciplines) {
            is JSONArray -> (0 until rawDisciplines.length()).map(rawDisciplines::getString)
            is String -> rawDisciplines.split(',').map(String::trim).filter(String::isNotBlank)
            else -> emptyList()
        }
        return ClubSquad(
            id = optString("id"),
            name = optString("name", "Squad"),
            ageGroup = optString("ageGroup"),
            disciplines = disciplines,
            memberCount = optInt("memberCount")
        )
    }

    private fun JSONObject.toClubTrainingSession() = ClubTrainingSession(
        id = optString("id"),
        title = optString("title", "Training session"),
        squadId = optString("squadId").takeIf { it.isNotBlank() && it != "null" },
        squadName = optString("squadName", "Squad"),
        sessionDate = optString("sessionDate"),
        sessionTime = optString("sessionTime").takeIf { Regex("\\d{2}:\\d{2}").matches(it) },
        durationMinutes = optInt("durationMinutes", 90),
        isPublished = optBoolean("isPublished"),
        isExecuted = optBoolean("isExecuted"),
        drillCount = optInt("drillCount"),
        postNotes = optString("postNotes").takeIf { it.isNotBlank() && it != "null" }.orEmpty(),
        coachId = optString("coachId").takeIf { it.isNotBlank() && it != "null" },
        coachName = optString("coachName").takeIf { it.isNotBlank() && it != "null" },
        assignedPlayerIds = optJSONArray("assignedPlayerIds")?.let { rows ->
            (0 until rows.length()).map(rows::getString)
        } ?: emptyList(),
        safety = optJSONArray("safety")?.let { rows ->
            (0 until rows.length()).map(rows::getString)
        } ?: emptyList(),
        drillIds = optJSONArray("drillIds")?.let { rows ->
            (0 until rows.length()).map(rows::getString)
        } ?: emptyList(),
        playerNotes = optJSONObject("playerNotes") ?: JSONObject(),
        executionLog = optJSONObject("executionLog"),
        aiEvaluation = optJSONObject("aiEvaluation")?.takeIf { it.optString("squadSummary").isNotBlank() },
        coordinatorCoachId = optString("coordinatorCoachId").takeIf { it.isNotBlank() && it != "null" },
        assistantCoachId = optString("assistantCoachId").takeIf { it.isNotBlank() && it != "null" }
    )

    private fun JSONObject.toSessionObservation() = SessionObservation(
        id = optString("id"),
        sessionId = optString("sessionId"),
        playerId = optString("playerId").takeIf { it.isNotBlank() && it != "null" },
        playerName = optString("playerName").takeIf { it.isNotBlank() && it != "null" },
        scope = optString("scope"),
        category = optString("category"),
        text = optString("text"),
        drillId = optString("drillId").takeIf { it.isNotBlank() && it != "null" },
        drillTitle = optString("drillTitle").takeIf { it.isNotBlank() && it != "null" },
        createdAt = optString("createdAt")
    )

    private fun JSONObject.toPlayerAssessment(): PlayerAssessment {
        val rows = optJSONArray("metrics") ?: JSONArray()
        return PlayerAssessment(
            id = optString("id"),
            playerId = optString("playerId"),
            playerName = optString("playerName", "Player"),
            title = optString("title", "Player assessment"),
            discipline = optString("discipline", "BATTING"),
            scheduledDate = optString("scheduledDate"),
            scheduledTime = optString("scheduledTime").takeIf(String::isNotBlank),
            status = optString("status", "SCHEDULED"),
            metrics = (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                AssessmentMetric(
                    name = row.optString("name"),
                    score = if (row.isNull("score")) null else row.optInt("score"),
                    note = row.optString("note")
                )
            },
            aiSummary = optJSONObject("aiInsights")?.optString("summary")
                ?.takeIf { it.isNotBlank() && it != "null" },
            aiRecommendations = optJSONObject("aiInsights")?.optJSONArray("recommendations")?.let { insights ->
                (0 until insights.length()).map(insights::getString)
            } ?: emptyList(),
            coachName = optString("coachName").takeUnless { it == "null" }.orEmpty(),
            strengths = optString("strengths").takeUnless { it == "null" }.orEmpty(),
            focusAreas = optString("focusAreas").takeUnless { it == "null" }.orEmpty(),
            coachFeedback = optString("coachFeedback").takeUnless { it == "null" }.orEmpty(),
            playerFeedback = optString("playerFeedback").takeUnless { it == "null" }.orEmpty(),
            videoAnalysisId = optString("videoAnalysisId").takeIf { it.isNotBlank() && it != "null" }
        )
    }

    private fun JSONObject.toAssessmentVideo(): AssessmentVideo {
        fun strings(key: String) = optJSONArray(key)?.let { rows -> (0 until rows.length()).map(rows::getString) } ?: emptyList()
        val metrics = optJSONArray("biomechanicalMetrics") ?: JSONArray()
        return AssessmentVideo(
            id = optString("id"),
            overallScore = optInt("overallScore"),
            detectedIssues = strings("detectedIssues"),
            recommendedDrills = strings("recommendedDrills"),
            biomechanics = (0 until metrics.length()).map { index ->
                val row = metrics.getJSONObject(index)
                row.optString("key") to row.optString("value")
            },
            driveLink = optString("driveLink").takeIf { it.startsWith("https://drive.google.com/") },
            createdAt = optString("createdAt")
        )
    }

    private fun JSONObject.text(key: String): String? = if (isNull(key)) null else optString(key).takeIf(String::isNotBlank)
    private fun JSONObject.number(key: String): Double? = if (isNull(key)) null else optDouble(key).takeUnless(Double::isNaN)
    private fun JSONObject.measure(key: String, label: String, unit: String, metric: String = key): CapeMeasure? =
        number(key)?.let { CapeMeasure(metric, label, it, unit) }
    private fun JSONObject.strings(key: String): List<String> =
        optJSONArray(key)?.let { rows -> (0 until rows.length()).map(rows::getString) } ?: emptyList()

    private fun JSONObject.toCapeContactCandidates(): CapeContactCandidates {
        val rows = optJSONArray("frames") ?: JSONArray()
        return CapeContactCandidates(
            framerateFps = optDouble("framerate_fps"),
            frameCount = optInt("frame_count"),
            suggestedFrame = if (isNull("suggested_frame")) null else optInt("suggested_frame"),
            suggestionSource = optString("suggestion_source", "none"),
            suggestionNote = text("suggestion_note"),
            frames = (0 until rows.length()).map { index ->
                val frame = rows.getJSONObject(index)
                CapeContactFrame(
                    index = frame.optInt("index"),
                    timeSeconds = frame.optDouble("time_s"),
                    imageBase64 = frame.optString("image_base64")
                )
            }
        )
    }

    private fun JSONObject.toCapeJob() = CapeJob(
        jobId = getString("jobId"),
        status = optString("status", "QUEUED"),
        queuePosition = if (isNull("queuePosition")) null else optInt("queuePosition"),
        errorMessage = text("errorMessage"),
        result = optJSONObject("result")?.toCapeResult()
    )

    private fun JSONObject.toCapeResult(): CapeResult {
        val metadata = optJSONObject("metadata") ?: JSONObject()
        val coaching = optJSONObject("coaching") ?: JSONObject()
        val payload = optJSONObject("analytics_payload") ?: JSONObject()
        val contact = payload.optJSONObject("point_of_contact")
        val preContact = payload.optJSONObject("pre_contact")
        val postContact = payload.optJSONObject("post_contact")
        val angles = contact?.optJSONObject("batter_joint_angles")
            ?: preContact?.optJSONObject("batter_joint_angles")
            ?: payload.optJSONObject("release")?.optJSONObject("bowler_joint_angles")
            ?: JSONObject()
        val faults = coaching.optJSONArray("faults") ?: JSONArray()
        val downloads = optJSONObject("download_endpoints") ?: JSONObject()
        return CapeResult(
            sessionId = optString("session_id"),
            target = metadata.optString("target", "batter"),
            handedness = metadata.optString("handedness", "right"),
            shotType = metadata.text("shot_type"),
            bowlerType = metadata.text("bowler_type"),
            score = coaching.optInt("score"),
            verdict = coaching.optString("verdict"),
            faults = (0 until faults.length()).map { index ->
                val row = faults.getJSONObject(index)
                val expected = row.optJSONArray("expected") ?: JSONArray()
                CapeFault(
                    code = row.optString("code"),
                    milestone = row.optString("milestone"),
                    metric = row.optString("metric"),
                    value = row.optDouble("value"),
                    expectedLo = if (expected.isNull(0)) null else expected.optDouble(0),
                    expectedHi = if (expected.isNull(1)) null else expected.optDouble(1),
                    severity = row.optString("severity", "medium"),
                    message = row.optString("message"),
                    recommendation = row.optString("recommendation"),
                    drill = row.text("drill")
                )
            },
            strengths = coaching.strings("strengths"),
            unavailable = coaching.strings("unavailable"),
            summary = coaching.text("summary"),
            jointAngles = angles.keys().asSequence().map { it to angles.optDouble(it) }.toList(),
            delivery = optJSONObject("delivery")?.let { d ->
                CapeDelivery(
                    speedKmh = d.number("speed_kmh"),
                    speedToleranceKmh = d.optDouble("speed_tolerance_kmh", 5.0),
                    lengthM = d.optDouble("length_m"),
                    lengthZone = d.optString("length_zone"),
                    lineZone = d.optString("line_zone"),
                    isGoodBall = d.optBoolean("is_good_ball")
                )
            },
            images = downloads.keys().asSequence()
                .filter { it != "all_zip" }
                .mapNotNull { key -> downloads.text(key)?.let { key to it } }
                .sortedBy { it.second.substringAfterLast('/') }
                .toList(),
            zipPath = downloads.text("all_zip"),
            contactMetrics = listOfNotNull(
                contact?.measure("head_front_knee_offset_pct", "head_front_knee_offset_pct", "%"),
                contact?.measure("bat_angle_degrees", "bat_angle_deg", "°", metric = "bat_angle_deg"),
                contact?.measure("stride_m", "stride_m", " m"),
                contact?.measure("front_foot_to_contact_angle_degrees", "front_foot_to_contact_angle", "°", metric = "front_foot_to_contact_angle"),
                contact?.measure("front_toe_contact_distance_cm", "front_toe_contact_distance", " cm", metric = "front_toe_contact_distance")
            ),
            alignment = contact?.let { c ->
                listOf(
                    CapeAlignmentRow("chin_front_toe_offset_pct", "Chin over front toe", c.number("chin_front_toe_offset_pct"), "%", "≤ 20%"),
                    CapeAlignmentRow("front_shoulder_target_angle_deg", "Front shoulder to target", c.number("front_shoulder_target_angle_degrees"), "°", "≤ 25°"),
                    CapeAlignmentRow("back_foot_crease_angle_deg", "Back foot to crease", c.number("back_foot_crease_angle_degrees"), "°", "≤ 20°"),
                    CapeAlignmentRow("front_elbow_height_pct", "Front elbow height", c.number("front_elbow_height_pct"), "%", "≥ -5%")
                )
            },
            kinetics = listOfNotNull(
                contact?.measure("ball_velocity_kmh", "Incoming ball speed", " km/h"),
                contact?.measure("estimated_ball_momentum_kg_m_s", "Incoming momentum", " kg m/s"),
                contact?.measure("estimated_ball_kinetic_energy_j", "Incoming kinetic energy", " J"),
                postContact?.measure("exit_velocity_kmh", "Exit speed", " km/h"),
                postContact?.measure("estimated_ball_momentum_kg_m_s", "Exit momentum", " kg m/s"),
                postContact?.measure("estimated_ball_kinetic_energy_j", "Exit kinetic energy", " J"),
                postContact?.measure("launch_angle_degrees", "Launch angle", "°"),
                preContact?.measure("bat_swing_speed_kmh", "Bat swing speed before contact (est.)", " km/h"),
                preContact?.measure(
                    "bat_swing_arc_degrees",
                    "Bat swing arc" +
                        (if (preContact.optBoolean("bat_swing_estimated")) " (est. from forearms)" else "") +
                        (if (preContact.optBoolean("swing_frames_auto")) " · auto-detected frames" else ""),
                    "°"
                ),
                postContact?.measure(
                    "follow_through_arc_degrees",
                    "Follow-through arc" +
                        (if (postContact.optBoolean("follow_through_estimated")) " (est. from forearms)" else "") +
                        (if (postContact.optBoolean("follow_through_frames_auto")) " · auto-detected frames" else ""),
                    "°"
                )
            ),
            contactFrame = contact?.takeUnless { it.isNull("milestone_frame") }?.optInt("milestone_frame"),
            contactManual = contact?.optString("selection_source") == "manual",
            contactCandidateCount = contact?.optJSONArray("candidate_frames")?.length() ?: 0,
            guidance = coaching.optJSONObject("ai_guidance")?.let { g ->
                val items = g.optJSONArray("items") ?: JSONArray()
                CapeGuidance(
                    summary = g.optString("summary"),
                    items = (0 until items.length()).mapNotNull { index ->
                        val item = items.optJSONObject(index) ?: return@mapNotNull null
                        val drill = item.optJSONObject("drill") ?: JSONObject()
                        CapeGuidanceItem(
                            faultCode = item.optString("fault_code"),
                            title = item.optString("title"),
                            whyItMatters = item.optString("why_it_matters"),
                            cues = item.strings("coaching_cues"),
                            drillName = drill.optString("name"),
                            drillInstructions = drill.strings("instructions"),
                            equipment = drill.strings("equipment")
                        )
                    }
                )
            }
        )
    }

    companion object {
        const val MOBILE_CALLBACK = "ecricketcoach://auth/callback"
        private const val UTF_8 = "UTF-8"
        private const val MAX_VIDEO_BYTES = 500L * 1024 * 1024
        private val PROVIDERS = setOf("google", "microsoft", "apple")
        private val REPORT_ID = Regex("^[0-9a-fA-F-]{36}$")
        private val ARTIFACT_NAME = Regex("^(pose_overlay|pose_sequence_[0-8])\\.png$")
    }
}
