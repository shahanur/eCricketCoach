package com.ecricketcoach.mobile.domain.usecase

import com.ecricketcoach.mobile.domain.model.ApiException
import com.ecricketcoach.mobile.domain.model.ClubMember
import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.GoogleSignInChallenge
import com.ecricketcoach.mobile.domain.model.OfflineMutation
import com.ecricketcoach.mobile.domain.repository.AuthRepository
import com.ecricketcoach.mobile.domain.repository.ClubRepository
import com.ecricketcoach.mobile.domain.repository.OfflineMutationRepository
import java.io.IOException
import java.lang.reflect.Proxy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private inline fun <reified T : Any> unimplemented(): T =
    Proxy.newProxyInstance(T::class.java.classLoader, arrayOf(T::class.java)) { _, method, _ ->
        throw NotImplementedError("${method.name} is not used by this test")
    } as T

private fun member(squad: String = "Unassigned") = ClubMember(
    id = "member-1", name = "Asha", email = "asha@example.com", role = "PLAYER", ageGroup = "U15",
    discipline = "Batting", invitationStatus = "ACCEPTED", currentLevel = "Foundation", squad = squad
)

private class FakeQueue(initial: List<OfflineMutation> = emptyList()) : OfflineMutationRepository {
    val items = initial.toMutableList()
    var failEnqueue = false
    override fun queued(userId: String, tenantId: String) = items.filter { it.userId == userId && it.tenantId == tenantId }
    override fun enqueue(mutation: OfflineMutation) {
        if (failEnqueue) throw IllegalStateException("keystore locked")
        items += mutation
    }
    override fun update(mutation: OfflineMutation) {
        items.replaceAll { if (it.id == mutation.id) mutation else it }
    }
    override fun remove(mutationId: String) {
        items.removeAll { it.id == mutationId }
    }
}

private class FakeClub(
    var serverMembers: List<ClubMember> = listOf(member()),
    var updateFailure: Exception? = null
) : ClubRepository by unimplemented() {
    val updates = mutableListOf<Pair<String, String>>()
    override suspend fun getClubMembers(clubId: String) = serverMembers
    override suspend fun updateClubMember(memberId: String, updates: JSONObject, operationId: String?): ClubMember {
        updateFailure?.let { throw it }
        this.updates += memberId to updates.toString()
        return serverMembers.first { it.id == memberId }
    }
}

class SyncOfflineMutationsUseCaseTest {
    private fun squadEdit(payload: JSONObject, baseValue: String = "Unassigned") = OfflineMutation(
        userId = "user-1", tenantId = "club-1", kind = OfflineMutation.UPDATE_MEMBER_SQUAD,
        resourceId = "member-1", payload = payload.toString(), baseValue = baseValue
    )

    @Test
    fun replaysPendingSquadAdditionAndMarksItSynced() = runTest {
        val queue = FakeQueue(listOf(squadEdit(JSONObject().put("addSquad", "U15 A"))))
        val club = FakeClub()

        SyncOfflineMutationsUseCase(club, queue)("user-1", "club-1")

        assertEquals(1, club.updates.size)
        assertEquals("SYNCED", queue.items.single().state)
    }

    @Test
    fun marksConflictWhenServerSquadChangedSinceTheEdit() = runTest {
        val queue = FakeQueue(listOf(squadEdit(JSONObject().put("squad", "U15 A"), baseValue = "Unassigned")))
        val club = FakeClub(serverMembers = listOf(member(squad = "U17 B")))

        SyncOfflineMutationsUseCase(club, queue)("user-1", "club-1")

        val result = queue.items.single()
        assertEquals("FAILED", result.state)
        assertTrue(result.error.contains("changed on the server"))
        assertTrue(club.updates.isEmpty())
    }

    @Test
    fun keepsEditPendingWhenNetworkIsUnavailable() = runTest {
        val queue = FakeQueue(listOf(squadEdit(JSONObject().put("addSquad", "U15 A"))))
        val club = FakeClub(updateFailure = IOException("offline"))

        SyncOfflineMutationsUseCase(club, queue)("user-1", "club-1")

        val result = queue.items.single()
        assertEquals("PENDING", result.state)
        assertEquals(1, result.attempts)
    }

    @Test
    fun marksServerRejectionAsFailed() = runTest {
        val queue = FakeQueue(listOf(squadEdit(JSONObject().put("addSquad", "U15 A"))))
        val club = FakeClub(updateFailure = ApiException(403, "Forbidden"))

        SyncOfflineMutationsUseCase(club, queue)("user-1", "club-1")

        assertEquals("FAILED", queue.items.single().state)
        assertTrue(queue.items.single().error.contains("HTTP 403"))
    }
}

class AssignMemberToSquadUseCaseTest {
    @Test
    fun savesDirectlyWhenOnline() = runTest {
        val club = FakeClub()
        val result = AssignMemberToSquadUseCase(club, FakeQueue())("user-1", "club-1", member(), "U15 A", inSquad = true)
        assertEquals(SquadAssignmentResult.SAVED, result)
        assertEquals("""{"addSquad":"U15 A"}""", club.updates.single().second)
    }

    @Test
    fun queuesEditWhenOffline() = runTest {
        val queue = FakeQueue()
        val result = AssignMemberToSquadUseCase(FakeClub(updateFailure = IOException("offline")), queue)(
            "user-1", "club-1", member(), "U15 A", inSquad = false
        )
        assertEquals(SquadAssignmentResult.QUEUED_OFFLINE, result)
        assertEquals("""{"removeSquad":"U15 A"}""", queue.items.single().payload)
    }

    @Test
    fun refusesSecondEditWhileOneIsPending() = runTest {
        val pending = OfflineMutation(
            userId = "user-1", tenantId = "club-1", kind = OfflineMutation.UPDATE_MEMBER_SQUAD,
            resourceId = "member-1", payload = "{}", baseValue = "Unassigned"
        )
        val club = FakeClub()
        val result = AssignMemberToSquadUseCase(club, FakeQueue(listOf(pending)))("user-1", "club-1", member(), "U15 A", true)
        assertEquals(SquadAssignmentResult.ALREADY_PENDING, result)
        assertTrue(club.updates.isEmpty())
    }

    @Test(expected = OfflineQueueUnavailableException::class)
    fun reportsWhenOfflineEditCannotBeQueued() = runTest {
        val queue = FakeQueue().apply { failEnqueue = true }
        AssignMemberToSquadUseCase(FakeClub(updateFailure = IOException("offline")), queue)(
            "user-1", "club-1", member(), "U15 A", true
        )
    }
}

class CompleteOAuthCallbackUseCaseTest {
    private class FakeAuth : AuthRepository {
        private val user = MutableStateFlow<CoachUser?>(null)
        var savedToken: String? = null
        override val currentUser: StateFlow<CoachUser?> = user
        override val mobileCallbackUrl = "ecricketcoach://auth/callback"
        override suspend fun getProviders() = emptyMap<String, Boolean>()
        override suspend fun getGoogleSignInChallenge(): GoogleSignInChallenge = throw NotImplementedError()
        override suspend fun signInWithGoogle(idToken: String, challenge: String): CoachUser = throw NotImplementedError()
        override fun signInUrl(provider: String) = ""
        override fun saveSession(token: String, user: CoachUser) {
            savedToken = token
            this.user.value = user
        }
        override fun signOut() {
            user.value = null
        }
    }

    @Test
    fun savesSessionForSupportedRole() {
        val auth = FakeAuth()
        val accepted = CompleteOAuthCallbackUseCase(auth)(
            mapOf("auth_token" to "jwt", "role" to "COACH", "userId" to "u-1", "name" to "Sam", "tenantId" to "club-1")
        )
        assertTrue(accepted)
        assertEquals("jwt", auth.savedToken)
        assertEquals("club-1", auth.currentUser.value?.tenantId)
    }

    @Test
    fun rejectsUnsupportedRoleOrMissingToken() {
        val auth = FakeAuth()
        val useCase = CompleteOAuthCallbackUseCase(auth)
        assertFalse(useCase(mapOf("auth_token" to "jwt", "role" to "ROOT")))
        assertFalse(useCase(mapOf("auth_token" to "", "role" to "COACH")))
        assertNull(auth.currentUser.value)
    }
}
