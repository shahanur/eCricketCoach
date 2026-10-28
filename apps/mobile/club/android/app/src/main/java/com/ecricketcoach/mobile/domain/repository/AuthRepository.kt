package com.ecricketcoach.mobile.domain.repository

import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.GoogleSignInChallenge
import kotlinx.coroutines.flow.StateFlow

/** Identity providers, sign-in and the locally persisted coach session. */
interface AuthRepository {
    /** The signed-in user, or null when there is no usable session. */
    val currentUser: StateFlow<CoachUser?>
    suspend fun getProviders(): Map<String, Boolean>
    suspend fun getGoogleSignInChallenge(): GoogleSignInChallenge
    suspend fun signInWithGoogle(idToken: String, challenge: String): CoachUser
    fun signInUrl(provider: String): String
    /** The deep link the browser OAuth flow returns to. */
    val mobileCallbackUrl: String
    fun saveSession(token: String, user: CoachUser)
    fun signOut()
}
