package com.ecricketcoach.mobile.data.api

import org.json.JSONObject

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
