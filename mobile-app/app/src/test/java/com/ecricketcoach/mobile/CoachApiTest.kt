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
}
