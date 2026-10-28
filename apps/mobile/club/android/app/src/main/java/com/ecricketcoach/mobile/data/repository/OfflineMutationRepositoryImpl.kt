package com.ecricketcoach.mobile.data.repository

import com.ecricketcoach.mobile.data.datastore.AuthStore
import com.ecricketcoach.mobile.domain.model.OfflineMutation
import com.ecricketcoach.mobile.domain.repository.OfflineMutationRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OfflineMutationRepositoryImpl @Inject constructor(
    private val store: AuthStore
) : OfflineMutationRepository {
    override fun queued(userId: String, tenantId: String): List<OfflineMutation> = store.queuedMutations(userId, tenantId)
    override fun enqueue(mutation: OfflineMutation) = store.enqueueMutation(mutation)
    override fun update(mutation: OfflineMutation) = store.updateQueuedMutation(mutation)
    override fun remove(mutationId: String) = store.removeQueuedMutation(mutationId)
}
