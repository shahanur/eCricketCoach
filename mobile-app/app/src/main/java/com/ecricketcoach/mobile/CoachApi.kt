package com.ecricketcoach.mobile

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(val statusCode: Int, message: String) : Exception(message)

data class GoogleSignInChallenge(val clientId: String, val nonce: String, val challenge: String)
data class CoachSession(val token: String, val user: CoachUser)

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
                instructions = row.optString("instructions", "")
            )
        }
    }

    internal fun drillCataloguePath(tenantId: String): String {
        val clubId = URLEncoder.encode(tenantId, UTF_8)
        return "/api/drills?clubId=$clubId"
    }

    suspend fun getTemplates(token: String): List<TrainingTemplate> = withContext(Dispatchers.IO) {
        val rows = JSONArray(request("/api/training-templates", token))
        (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            val disciplines = row.optJSONArray("disciplines") ?: JSONArray()
            TrainingTemplate(
                id = row.optString("id"),
                title = row.optString("title", "Training template"),
                focus = row.optString("focus", ""),
                durationMinutes = row.optInt("durationMinutes"),
                disciplines = (0 until disciplines.length()).map(disciplines::getString)
            )
        }
    }

    private fun request(path: String, token: String? = null, body: JSONObject? = null): String {
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.requestMethod = if (body == null) "GET" else "POST"
        connection.connectTimeout = 10_000
        connection.readTimeout = 15_000
        connection.setRequestProperty("Accept", "application/json")
        if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")

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
                val message = runCatching { JSONObject(body).optString("error") }
                    .getOrNull()
                    .orEmpty()
                    .ifBlank { "The server returned HTTP $status." }
                throw ApiException(status, message)
            }
            return body
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        const val MOBILE_CALLBACK = "ecricketcoach://auth/callback"
        private const val UTF_8 = "UTF-8"
        private val PROVIDERS = setOf("google", "microsoft", "apple")
    }
}
