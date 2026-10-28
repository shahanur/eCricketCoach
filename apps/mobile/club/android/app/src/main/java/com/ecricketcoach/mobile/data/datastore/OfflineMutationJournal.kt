package com.ecricketcoach.mobile.data.datastore

import com.ecricketcoach.mobile.domain.model.OfflineMutation
import org.json.JSONObject

internal fun OfflineMutation.toJson(): JSONObject = JSONObject()
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

internal fun OfflineMutation.Companion.fromJson(json: JSONObject): OfflineMutation = OfflineMutation(
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
