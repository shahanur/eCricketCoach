package com.ecricketcoach.mobile.domain.repository

import com.ecricketcoach.mobile.domain.model.OfflineMutation

/** Encrypted on-device queue of edits made while offline. */
interface OfflineMutationRepository {
    fun queued(userId: String, tenantId: String): List<OfflineMutation>
    fun enqueue(mutation: OfflineMutation)
    fun update(mutation: OfflineMutation)
    fun remove(mutationId: String)
}
