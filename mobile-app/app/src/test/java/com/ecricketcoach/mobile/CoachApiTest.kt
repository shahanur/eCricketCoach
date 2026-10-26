package com.ecricketcoach.mobile

import java.net.URI
import java.net.URLDecoder
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CoachApiTest {
    private val api = CoachApi("http://api.example.test:3000", "https://login.example.test")

    @Test
    fun signInUrlUsesExactMobileCallback() {
        val url = URI(api.signInUrl("google"))

        assertEquals("https", url.scheme)
        assertEquals("login.example.test", url.host)
        assertEquals("/api/auth/google", url.path)
        assertEquals(
            CoachApi.MOBILE_CALLBACK,
            URLDecoder.decode(url.rawQuery.substringAfter("returnTo="), "UTF-8")
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun signInUrlRejectsUnknownProviders() {
        api.signInUrl("unknown")
    }

    @Test
    fun drillPathEncodesTenantIdAsOneQueryValue() {
        assertEquals(
            "/api/drills?clubId=tenant%26role%3DADMIN",
            api.drillCataloguePath("tenant&role=ADMIN")
        )
    }

    @Test
    fun protectedClubActionsEncodeResourceIdsInApiPaths() {
        assertEquals(
            "/api/coach/sessions/session%2F1%3Finclude%3Dother/execution",
            api.sessionExecutionPath("session/1?include=other")
        )
        assertEquals(
            "/api/coach/sessions/session%2F1%3Finclude%3Dother/players",
            api.sessionPlayersPath("session/1?include=other")
        )
        assertEquals(
            "/api/club/assessments/assessment%2F1/insights",
            api.assessmentInsightsPath("assessment/1")
        )
        assertEquals("/api/club/sessions/session%2F1", api.clubSessionPath("session/1"))
    }

    @Test
    fun driveAuthorizationUsesTheConfiguredApiOriginAndEncodesToken() {
        val url = URI(api.googleDriveConnectUrl("token+value&scope=other"))

        assertEquals("api.example.test", url.host)
        assertEquals("/api/google-drive/connect", url.path)
        assertTrue(url.rawQuery.contains("token=token%2Bvalue%26scope%3Dother"))
    }

    @Test
    fun missingExecutionRouteExplainsDeploymentWithoutHidingAssignmentErrors() {
        val path = api.sessionExecutionPath("session-a")
        assertTrue(apiErrorMessage(404, "<html>Cannot GET</html>", path).contains("Deploy the matching API build"))
        assertEquals(
            "Session not found or not assigned to you.",
            apiErrorMessage(404, """{"error":"Session not found or not assigned to you."}""", path)
        )
        assertEquals("The server returned HTTP 500.", apiErrorMessage(500, "", path))
    }

    @Test
    fun runLoadsTheAuthenticatedSessionAndRecognizesEveryAssignedCoachRole() = runBlocking {
        val server = ServerSocket()
        server.bind(InetSocketAddress("127.0.0.1", 0))
        server.soTimeout = 10_000
        val executor = Executors.newSingleThreadExecutor()
        val response = """{"session":{"id":"session-a","title":"Training","sessionDate":"2026-10-09","coachId":"lead-a","coordinatorCoachId":"coordinator-a","assistantCoachId":"assistant-a"}}"""
        val request = executor.submit<String> {
            server.accept().use { socket ->
                socket.soTimeout = 10_000
                val reader = socket.getInputStream().bufferedReader()
                val headers = mutableListOf<String>()
                while (true) {
                    val line = reader.readLine() ?: break
                    if (line.isEmpty()) break
                    headers.add(line)
                }
                val bytes = response.toByteArray()
                socket.getOutputStream().use {
                    it.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    it.write(bytes)
                }
                headers.joinToString("\n")
            }
        }
        try {
            val origin = "http://127.0.0.1:${server.localPort}"
            val localApi = CoachApi(origin, origin)
            val session = localApi.getCoachSessionExecution("test-token", "session-a")
            assertTrue(session.isAssignedTo("lead-a"))
            assertTrue(session.isAssignedTo("coordinator-a"))
            assertTrue(session.isAssignedTo("assistant-a"))
            assertFalse(session.isAssignedTo("other-coach"))
            val headers = request.get(10, TimeUnit.SECONDS)
            assertTrue(headers.startsWith("GET /api/coach/sessions/session-a/execution HTTP/1.1"))
            assertTrue(headers.contains("Authorization: Bearer test-token"))
        } finally {
            server.close()
            executor.shutdownNow()
        }
    }

    @Test
    fun latestOpenAiBattingAnalysisLoadsTheAssessmentReport() = runBlocking {
        val server = ServerSocket()
        server.bind(InetSocketAddress("127.0.0.1", 0))
        server.soTimeout = 10_000
        val executor = Executors.newSingleThreadExecutor()
        val response = """{"report":{"reportId":"report-1","analysis":{"provider":"openai","model":"gpt-4o","summary":"Balanced front-foot contact.","video":{"durationSeconds":4.5},"contact":{"status":"LIKELY","confidence":0.8,"evidence":"Contact is visible."},"drill":{"title":"Forward press","instructions":["Repeat the movement"],"rationale":"Build balance."},"observations":[],"errors":[],"strengths":[],"limitations":[],"phases":[]}}}"""
        val request = executor.submit<String> {
            server.accept().use { socket ->
                socket.soTimeout = 10_000
                val reader = socket.getInputStream().bufferedReader()
                val requestLine = reader.readLine().orEmpty()
                while (reader.readLine()?.isNotEmpty() == true) Unit
                val bytes = response.toByteArray()
                socket.getOutputStream().use {
                    it.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    it.write(bytes)
                }
                requestLine
            }
        }
        try {
            val localApi = CoachApi("http://127.0.0.1:${server.localPort}", "https://login.example.test")
            val analysis = localApi.getLatestOpenAiBattingAnalysis("test-token", "player&id", "assessment/1")

            assertTrue(request.get(10, TimeUnit.SECONDS).contains("playerId=player%26id&assessmentId=assessment%2F1"))
            assertEquals("report-1", analysis?.reportId)
            assertEquals("Balanced front-foot contact.", analysis?.summary)
            assertEquals("LIKELY", analysis?.contact?.status)
        } finally {
            server.close()
            executor.shutdownNow()
        }
    }

    @Test
    fun openAiBattingAnalysisParsesCoachReviewFindingsAndSavedPoseOverlay() = runBlocking {
        val reportId = "123e4567-e89b-12d3-a456-426614174000"
        val server = ServerSocket()
        server.bind(InetSocketAddress("127.0.0.1", 0))
        server.soTimeout = 10_000
        val executor = Executors.newSingleThreadExecutor()
        val poseOverlay = """{"status":"success","width":10,"height":10,"handedness":"left","shot_type":"front_foot_drive","overlayArtifactName":"pose_overlay.png","metrics":{"back_knee":152.4,"front_knee":null},"temporal_angle_estimates":{"front_knee":{"value":128.0}},"coaching_rules":{"verdict":"Solid base","shot_type":"front_foot_drive","score":80,"score_scope":"full","checks":[{"group":"shot","metric":"back_knee","expected":[140,null],"status":"fault","severity":"medium"}],"faults":[{"code":"BK","metric":"back_knee","value":152.4,"expected":[140,null],"severity":"medium","message":"Back knee too straight","recommendation":"Bend more","drill":null,"verdict":null}],"strengths":["Head still"],"unavailable":["stride_m"]},"sequence":[{"frame_index":3,"timestamp_seconds":1.2,"phase":"PRE_CONTACT","status":"unavailable","error":"No pose","artifactName":null}]}"""
        val analysisJson = """{"report":{"reportId":"$reportId","analysis":{"summary":"ok","contact":{"status":"DETECTED"},"drill":{"title":"Drive","instructions":[]},"requestMetadata":{"shotType":"front_foot_drive","batterHandedness":"right"},"shotIdentification":{"batterHandedness":"left","shotType":"front_foot_drive"},"errors":[{"title":"Late head","observation":"Head falls","coachingImplication":"Balance","alternativeExplanation":"Camera angle","coachingCue":"Eyes level","drill":"Mirror drill","frameIndices":[2,4],"confidence":"moderate"}],"observations":[],"strengths":[{"title":"Balance","observation":"Stable base"}],"coachReview":{"note":"Good work","findings":[{"findingIndex":0,"status":"accepted","note":"Agree"}]},"poseOverlay":$poseOverlay}}}"""
        val png = byteArrayOf(1, 2, 3)
        val requests = executor.submit<List<String>> {
            (0 until 2).map { index ->
                server.accept().use { socket ->
                    socket.soTimeout = 10_000
                    val reader = socket.getInputStream().bufferedReader()
                    val requestLine = reader.readLine().orEmpty()
                    while (reader.readLine()?.isNotEmpty() == true) Unit
                    val bytes = if (index == 0) analysisJson.toByteArray() else png
                    val type = if (index == 0) "application/json" else "image/png"
                    socket.getOutputStream().use {
                        it.write("HTTP/1.1 200 OK\r\nContent-Type: $type\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        it.write(bytes)
                    }
                    requestLine
                }
            }
        }
        try {
            val localApi = CoachApi("http://127.0.0.1:${server.localPort}", "https://login.example.test")
            val analysis = requireNotNull(localApi.getLatestOpenAiBattingAnalysis("test-token", "player-1", reportId = reportId))

            assertTrue(analysis.restoredFromReport)
            assertEquals("left", analysis.batterHandedness)
            assertEquals(listOf(OpenAiBattingStrength("Balance", "Stable base")), analysis.strengthItems)
            assertEquals(listOf("Balance: Stable base"), analysis.strengths)
            assertEquals("Eyes level", analysis.errors.single().coachingCue)
            assertEquals(listOf(2, 4), analysis.errors.single().frameIndices)
            assertEquals(OpenAiFindingReview(0, "accepted", "Agree"), analysis.coachReview?.findings?.single())

            val overlay = requireNotNull(localApi.loadSavedPoseOverlay("test-token", analysis))
            val paths = requests.get(10, TimeUnit.SECONDS)
            assertTrue(paths[0].contains("reportId=$reportId"))
            assertTrue(paths[1].startsWith("GET /api/videos/analyze/openai-batting/$reportId/artifacts/pose_overlay.png"))
            assertTrue(png.contentEquals(overlay.overlayImage))
            assertEquals("Solid base", overlay.verdict)
            assertEquals(152.4, overlay.metrics["back_knee"]!!, 0.001)
            assertEquals(null, overlay.metrics["front_knee"])
            assertEquals(128.0, overlay.temporalEstimates["front_knee"]!!, 0.001)
            assertEquals(140.0, overlay.checks.single().expectedMin!!, 0.001)
            assertEquals("Back knee too straight", overlay.faults.single().message)
            assertEquals("No pose", overlay.sequence.single().error)
            assertFalse(overlay.metadataJson.contains("overlay_image_base64"))
            assertFalse(overlay.metadataJson.contains("overlayArtifactName"))
        } finally {
            server.close()
            executor.shutdownNow()
        }
    }
}
