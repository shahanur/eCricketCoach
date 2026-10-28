package com.ecricketcoach.mobile.domain.model

import java.util.UUID

/** A coach edit captured while offline, replayed against the API once connectivity returns. */
data class OfflineMutation(
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
    companion object {
        const val UPDATE_MEMBER_SQUAD = "UPDATE_MEMBER_SQUAD"
        const val SAVE_SESSION_EXECUTION = "SAVE_SESSION_EXECUTION"
    }
}

class OfflineMutationConflict(message: String) : Exception(message)
