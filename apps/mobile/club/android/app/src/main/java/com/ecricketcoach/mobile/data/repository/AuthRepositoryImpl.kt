package com.ecricketcoach.mobile.data.repository

import com.ecricketcoach.mobile.data.api.CoachApi
import com.ecricketcoach.mobile.data.datastore.AuthStore
import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.GoogleSignInChallenge
import com.ecricketcoach.mobile.domain.repository.AuthRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val api: CoachApi,
    private val store: AuthStore
) : AuthRepository {
    private val user = MutableStateFlow(if (store.readToken() != null) store.readUser() else null)
    override val currentUser: StateFlow<CoachUser?> = user.asStateFlow()

    override suspend fun getProviders(): Map<String, Boolean> = api.getProviders()

    override suspend fun getGoogleSignInChallenge(): GoogleSignInChallenge = api.getGoogleSignInChallenge()

    override suspend fun signInWithGoogle(idToken: String, challenge: String): CoachUser {
        val session = api.signInWithGoogle(idToken, challenge)
        saveSession(session.token, session.user)
        return session.user
    }

    override fun signInUrl(provider: String): String = api.signInUrl(provider)

    override val mobileCallbackUrl: String = CoachApi.MOBILE_CALLBACK

    override fun saveSession(token: String, user: CoachUser) {
        store.saveSession(token, user)
        this.user.value = user
    }

    override fun signOut() {
        store.clearSession()
        user.value = null
    }
}
