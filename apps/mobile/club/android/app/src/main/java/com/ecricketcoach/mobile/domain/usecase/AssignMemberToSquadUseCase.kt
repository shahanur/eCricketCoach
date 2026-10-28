package com.ecricketcoach.mobile.domain.usecase

import com.ecricketcoach.mobile.domain.model.ClubMember
import com.ecricketcoach.mobile.domain.model.OfflineMutation
import com.ecricketcoach.mobile.domain.repository.ClubRepository
import com.ecricketcoach.mobile.domain.repository.OfflineMutationRepository
import java.io.IOException
import javax.inject.Inject
import org.json.JSONObject

enum class SquadAssignmentResult { SAVED, QUEUED_OFFLINE, ALREADY_PENDING }

/** Adds or removes a member from a squad, queueing the edit on device when the network is unavailable. */
class AssignMemberToSquadUseCase @Inject constructor(
    private val club: ClubRepository,
    private val queue: OfflineMutationRepository
) {
    /** @throws OfflineQueueUnavailableException when offline and the edit could not be queued safely. */
    suspend operator fun invoke(userId: String, clubId: String, member: ClubMember, squad: String, inSquad: Boolean): SquadAssignmentResult {
        val pending = queue.queued(userId, clubId).any {
            it.kind == OfflineMutation.UPDATE_MEMBER_SQUAD && it.resourceId == member.id && it.state == "PENDING"
        }
        if (pending) return SquadAssignmentResult.ALREADY_PENDING
        val payload = if (inSquad) JSONObject().put("addSquad", squad) else JSONObject().put("removeSquad", squad)
        return try {
            club.updateClubMember(member.id, payload)
            SquadAssignmentResult.SAVED
        } catch (failure: IOException) {
            try {
                queue.enqueue(
                    OfflineMutation(
                        userId = userId,
                        tenantId = clubId,
                        kind = OfflineMutation.UPDATE_MEMBER_SQUAD,
                        resourceId = member.id,
                        payload = payload.toString(),
                        baseValue = member.squad
                    )
                )
                SquadAssignmentResult.QUEUED_OFFLINE
            } catch (storageFailure: Exception) {
                throw OfflineQueueUnavailableException(storageFailure)
            }
        }
    }
}

class OfflineQueueUnavailableException(cause: Throwable) :
    Exception("The network is unavailable and this edit could not be safely queued: ${cause.message ?: "encrypted storage error"}", cause)
