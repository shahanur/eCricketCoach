package com.ecricketcoach.mobile.domain.usecase

import com.ecricketcoach.mobile.domain.model.ClubWorkspaceSnapshot
import com.ecricketcoach.mobile.domain.repository.ClubRepository
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/** Loads the club workspace data in parallel so the screen updates from one consistent snapshot. */
class LoadClubWorkspaceUseCase @Inject constructor(private val club: ClubRepository) {
    suspend operator fun invoke(clubId: String): ClubWorkspaceSnapshot = coroutineScope {
        val members = async { club.getClubMembers(clubId) }
        val squads = async { club.getSquads(clubId) }
        val sessions = async { club.getClubSessions(clubId) }
        val drills = async { club.getClubDrills(clubId) }
        val catalogue = async { club.getDrills(clubId) }
        val certificates = async { club.getCertificates() }
        val logo = async { club.getClubBranding() }
        ClubWorkspaceSnapshot(
            members = members.await(),
            squads = squads.await(),
            sessions = sessions.await(),
            drills = drills.await(),
            catalogueDrills = catalogue.await(),
            certificates = certificates.await(),
            logo = logo.await()
        )
    }
}
