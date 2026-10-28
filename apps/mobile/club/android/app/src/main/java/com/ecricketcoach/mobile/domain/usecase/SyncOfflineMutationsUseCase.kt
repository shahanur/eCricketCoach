package com.ecricketcoach.mobile.domain.usecase

import com.ecricketcoach.mobile.domain.model.ApiException
import com.ecricketcoach.mobile.domain.model.OfflineMutation
import com.ecricketcoach.mobile.domain.model.OfflineMutationConflict
import com.ecricketcoach.mobile.domain.repository.ClubRepository
import com.ecricketcoach.mobile.domain.repository.OfflineMutationRepository
import com.ecricketcoach.mobile.utils.canonicalJson
import java.io.IOException
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import org.json.JSONObject

/**
 * Replays pending offline edits against the server. Each edit is checked against the server state it
 * was based on, so conflicting changes are marked FAILED for review instead of overwriting newer data.
 */
class SyncOfflineMutationsUseCase @Inject constructor(
    private val club: ClubRepository,
    private val queue: OfflineMutationRepository
) {
    suspend operator fun invoke(userId: String, clubId: String) {
        val work = queue.queued(userId, clubId).filter { it.state == "PENDING" }
        for (mutation in work) {
            try {
                apply(mutation, clubId)
                queue.update(mutation.copy(state = "SYNCED", error = "", attempts = mutation.attempts + 1))
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: OfflineMutationConflict) {
                queue.update(mutation.copy(state = "FAILED", error = failure.message.orEmpty(), attempts = mutation.attempts + 1))
            } catch (failure: ApiException) {
                queue.update(mutation.copy(
                    state = "FAILED",
                    error = "Server rejected the queued edit (HTTP ${failure.statusCode}): ${failure.message}",
                    attempts = mutation.attempts + 1
                ))
            } catch (failure: IOException) {
                queue.update(mutation.copy(
                    error = failure.message ?: "Network unavailable. The edit remains queued.",
                    attempts = mutation.attempts + 1
                ))
                break
            } catch (failure: Exception) {
                queue.update(mutation.copy(
                    state = "FAILED",
                    error = failure.message ?: "Unable to safely apply this queued edit.",
                    attempts = mutation.attempts + 1
                ))
            }
        }
    }

    private suspend fun apply(mutation: OfflineMutation, clubId: String) {
        when (mutation.kind) {
            OfflineMutation.UPDATE_MEMBER_SQUAD -> {
                val member = club.getClubMembers(clubId).firstOrNull { it.id == mutation.resourceId }
                    ?: throw OfflineMutationConflict("The member no longer belongs to this club. This change was not replayed.")
                val payload = JSONObject(mutation.payload)
                if (payload.has("addSquad") || payload.has("removeSquad")) {
                    // Add/remove edits only touch one squad, so they replay safely alongside other server changes.
                    val adding = payload.has("addSquad")
                    val squadName = if (adding) payload.getString("addSquad") else payload.getString("removeSquad")
                    if (member.isInSquad(squadName) == adding) return
                    club.updateClubMember(mutation.resourceId, payload, operationId = mutation.id)
                    return
                }
                val targetSquad = payload.getString("squad")
                when (member.squad) {
                    targetSquad -> return
                    mutation.baseValue -> club.updateClubMember(
                        mutation.resourceId,
                        JSONObject(mutation.payload),
                        operationId = mutation.id
                    )
                    else -> throw OfflineMutationConflict(
                        "Squad assignment changed on the server from '${mutation.baseValue}' to '${member.squad}'. Review the roster before applying this edit."
                    )
                }
            }
            OfflineMutation.SAVE_SESSION_EXECUTION -> {
                val update = JSONObject(mutation.payload)
                val current = club.getCoachSessionExecution(mutation.resourceId)
                val targetLog = update.getJSONObject("executionLog")
                val targetNotes = update.optJSONObject("playerNotes") ?: JSONObject()
                val targetPostNotes = update.optString("postNotes")
                val executionAlreadySaved = canonicalJson(current.executionLog?.toString()) == canonicalJson(targetLog.toString()) &&
                    targetNotes.keys().asSequence().all { playerId ->
                        current.playerNotes.optString(playerId) == targetNotes.optString(playerId)
                    } && current.postNotes == targetPostNotes
                if (executionAlreadySaved) return
                if (canonicalJson(current.executionLog?.toString()) != canonicalJson(mutation.baseValue)) {
                    throw OfflineMutationConflict(
                        "Session execution changed on the server while this edit was offline. The queued changes were retained for review and were not applied."
                    )
                }
                club.saveSessionExecution(mutation.resourceId, update, operationId = mutation.id)
            }
            else -> throw OfflineMutationConflict("This queued change type is not supported and was not replayed.")
        }
    }
}
