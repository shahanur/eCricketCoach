package com.ecricketcoach.mobile

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.DataOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(val statusCode: Int, message: String) : Exception(message)

internal fun apiErrorMessage(status: Int, body: String, path: String): String {
    val serverError = runCatching { JSONObject(body).optString("error") }.getOrNull().orEmpty()
    if (serverError.isNotBlank()) return serverError
    if (status == 404 && path.startsWith("/api/coach/sessions/") && path.endsWith("/execution")) {
        return "The API does not provide the session execution route. Deploy the matching API build, then sync and try Run again."
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
    val assistantCoachId: String? = null
) {
    fun isAssignedTo(userId: String): Boolean =
        userId.isNotBlank() && userId in listOf(coachId, coordinatorCoachId, assistantCoachId)
}

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
    val createdAt: String
)

class CoachApi(private val baseUrl: String, private val oauthOrigin: String) {
    suspend fun getGoogleSignInChallenge(): GoogleSignInChallenge = withContext(Dispatchers.IO) {
        val json = JSONObject(request("/api/auth/google/native"))
        GoogleSignInChallenge(json.getString("clientId"), json.getString("nonce"), json.getString("challenge"))
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
                imageUrl = row.optString("imageUrl").takeIf(String::isNotBlank)
            )
        }
    }

    internal fun drillCataloguePath(tenantId: String): String {
        val clubId = URLEncoder.encode(tenantId, UTF_8)
        return "/api/drills?clubId=$clubId"
    }

    internal fun sessionExecutionPath(sessionId: String): String =
        "/api/coach/sessions/${URLEncoder.encode(sessionId, UTF_8)}/execution"

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

    suspend fun getVideoAnalysisHistory(token: String): List<VideoAnalysisEntry> = withContext(Dispatchers.IO) {
        val response = JSONObject(request("/api/videos/analyze/history", token))
        val rows = response.optJSONArray("history") ?: JSONArray()
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            val analysis = row.optJSONObject("analysis") ?: JSONObject()
            val issues = analysis.optJSONArray("detectedIssues") ?: JSONArray()
            VideoAnalysisEntry(
                id = row.optString("id"),
                playerName = row.optString("playerName").takeIf { it.isNotBlank() && it != "null" },
                discipline = row.optString("discipline"),
                score = row.optInt("overallScore", analysis.optInt("overallScore")),
                detectedIssues = (0 until issues.length()).map(issues::getString),
                createdAt = row.optString("createdAt")
            )
        }
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
                val message = runCatching { JSONObject(responseBody).optString("error") }
                    .getOrNull()
                    .orEmpty()
                    .ifBlank { "The server returned HTTP $status." }
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
        val issues = analysis.optJSONArray("detectedIssues") ?: JSONArray()
        return VideoAnalysisEntry(
            id = response.optString("analysisId"),
            playerName = playerName,
            discipline = response.optString("discipline", discipline),
            score = analysis.optInt("overallScore"),
            detectedIssues = (0 until issues.length()).map(issues::getString),
            createdAt = ""
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

    companion object {
        const val MOBILE_CALLBACK = "ecricketcoach://auth/callback"
        private const val UTF_8 = "UTF-8"
        private const val MAX_VIDEO_BYTES = 500L * 1024 * 1024
        private val PROVIDERS = setOf("google", "microsoft", "apple")
    }
}
