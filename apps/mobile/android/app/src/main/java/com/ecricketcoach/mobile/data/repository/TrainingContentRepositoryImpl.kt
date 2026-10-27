package com.ecricketcoach.mobile.data.repository

import com.ecricketcoach.mobile.data.api.CoachApi
import com.ecricketcoach.mobile.data.datastore.AuthStore
import com.ecricketcoach.mobile.domain.model.Drill
import com.ecricketcoach.mobile.domain.model.TrainingTemplate
import com.ecricketcoach.mobile.domain.repository.TrainingContentRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrainingContentRepositoryImpl @Inject constructor(
    private val api: CoachApi,
    private val store: AuthStore
) : TrainingContentRepository {
    override fun cachedDrills(ownerId: String?): List<Drill> = store.readDrills(ownerId)

    override fun cachedTemplates(ownerId: String?): List<TrainingTemplate> = store.readTemplates(ownerId)

    override suspend fun refreshDrills(ownerId: String): List<Drill> =
        api.getDrills(store.requireToken(), ownerId).also { store.saveDrills(ownerId, it) }

    override suspend fun refreshTemplates(ownerId: String): List<TrainingTemplate> =
        api.getTemplates(store.requireToken()).also { store.saveTemplates(ownerId, it) }
}
