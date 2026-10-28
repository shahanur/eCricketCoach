package com.ecricketcoach.mobile.domain.repository

import com.ecricketcoach.mobile.domain.model.Drill
import com.ecricketcoach.mobile.domain.model.TrainingTemplate

/** Drill catalogue and training templates, cached on device for offline use. */
interface TrainingContentRepository {
    fun cachedDrills(ownerId: String?): List<Drill>
    fun cachedTemplates(ownerId: String?): List<TrainingTemplate>
    suspend fun refreshDrills(ownerId: String): List<Drill>
    suspend fun refreshTemplates(ownerId: String): List<TrainingTemplate>
}
