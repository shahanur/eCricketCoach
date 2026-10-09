package com.ecricketcoach.mobile

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal data class OfflineMutation(
    val id: String = UUID.randomUUID().toString(),
    val userId: String,
    val tenantId: String,
    val kind: String,
    val resourceId: String,
    val payload: String,
    val baseValue: String,
    val state: String = "PENDING",
    val error: String = "",
    val attempts: Int = 0
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id)
        .put("userId", userId)
        .put("tenantId", tenantId)
        .put("kind", kind)
        .put("resourceId", resourceId)
        .put("payload", payload)
        .put("baseValue", baseValue)
        .put("state", state)
        .put("error", error)
        .put("attempts", attempts)

    companion object {
        const val UPDATE_MEMBER_SQUAD = "UPDATE_MEMBER_SQUAD"
        const val SAVE_SESSION_EXECUTION = "SAVE_SESSION_EXECUTION"

        fun fromJson(json: JSONObject): OfflineMutation = OfflineMutation(
            id = json.getString("id"),
            userId = json.getString("userId"),
            tenantId = json.getString("tenantId"),
            kind = json.getString("kind"),
            resourceId = json.getString("resourceId"),
            payload = json.getString("payload"),
            baseValue = json.optString("baseValue"),
            state = json.optString("state", "PENDING"),
            error = json.optString("error"),
            attempts = json.optInt("attempts")
        )
    }
}

internal fun canonicalJson(value: String?): String {
    if (value == null || value == "null" || value.isBlank()) return "null"
    return runCatching { canonicalValue(JSONObject(value)) }
        .recoverCatching { canonicalValue(JSONArray(value)) }
        .getOrElse { value }
}

private fun canonicalValue(value: Any?): String = when (value) {
    is JSONObject -> {
        val keys = value.keys().asSequence().toList().sorted()
        keys.joinToString(prefix = "{", postfix = "}") { key ->
            "${JSONObject.quote(key)}:${canonicalValue(value.get(key))}"
        }
    }
    is JSONArray -> (0 until value.length()).joinToString(prefix = "[", postfix = "]") { index ->
        canonicalValue(value.get(index))
    }
    JSONObject.NULL -> "null"
    is String -> JSONObject.quote(value)
    else -> value.toString()
}

internal class OfflineMutationConflict(message: String) : Exception(message)

internal object OfflineMutationJournal {
    fun scoped(rows: List<OfflineMutation>, userId: String, tenantId: String): List<OfflineMutation> =
        rows.filter { it.userId == userId && it.tenantId == tenantId }

    fun enqueue(rows: List<OfflineMutation>, mutation: OfflineMutation): List<OfflineMutation> =
        if (rows.any { it.id == mutation.id }) rows else rows + mutation

    fun update(rows: List<OfflineMutation>, mutation: OfflineMutation): List<OfflineMutation> =
        rows.map { if (it.id == mutation.id) mutation else it }

    fun remove(rows: List<OfflineMutation>, mutationId: String): List<OfflineMutation> =
        rows.filterNot { it.id == mutationId }
}
