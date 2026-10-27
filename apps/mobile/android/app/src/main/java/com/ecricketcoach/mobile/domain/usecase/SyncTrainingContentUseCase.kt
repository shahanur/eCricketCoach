package com.ecricketcoach.mobile.domain.usecase

import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.Drill
import com.ecricketcoach.mobile.domain.model.TrainingTemplate
import com.ecricketcoach.mobile.domain.repository.TrainingContentRepository
import javax.inject.Inject

data class TrainingContent(val drills: List<Drill>, val templates: List<TrainingTemplate>)

/** Refreshes the drill catalogue (and templates for coaching roles) and caches them on device. */
class SyncTrainingContentUseCase @Inject constructor(private val training: TrainingContentRepository) {
    fun cached(user: CoachUser?): TrainingContent {
        val ownerId = user?.ownerId()
        return TrainingContent(training.cachedDrills(ownerId), training.cachedTemplates(ownerId))
    }

    suspend operator fun invoke(user: CoachUser, current: TrainingContent): TrainingContent {
        val ownerId = user.ownerId()
        val drills = training.refreshDrills(ownerId)
        val templates = if (user.hasCoachAccess()) training.refreshTemplates(ownerId) else current.templates
        return TrainingContent(drills, templates)
    }
}

fun CoachUser.ownerId(): String = tenantId ?: id

fun CoachUser.hasCoachAccess(): Boolean = role in setOf("SUPER_ADMIN", "CLUB_ADMIN", "COACH")

fun CoachUser.usesClubWorkspace(): Boolean = role == "CLUB_ADMIN" || (role == "COACH" && coachContext == "CLUB")
