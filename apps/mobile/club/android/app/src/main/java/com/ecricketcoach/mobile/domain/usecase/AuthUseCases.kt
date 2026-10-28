package com.ecricketcoach.mobile.domain.usecase

import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.GoogleSignInChallenge
import com.ecricketcoach.mobile.domain.repository.AuthRepository
import javax.inject.Inject

class GetSignInProvidersUseCase @Inject constructor(private val auth: AuthRepository) {
    suspend operator fun invoke(): Map<String, Boolean> = auth.getProviders()
}

/**
 * Runs the nonce-bound Google sign-in. [obtainIdToken] is supplied by the UI layer, which owns the
 * platform Credential Manager prompt.
 */
class SignInWithGoogleUseCase @Inject constructor(private val auth: AuthRepository) {
    suspend operator fun invoke(obtainIdToken: suspend (GoogleSignInChallenge) -> String): CoachUser {
        val challenge = auth.getGoogleSignInChallenge()
        val idToken = obtainIdToken(challenge)
        return auth.signInWithGoogle(idToken, challenge.challenge)
    }
}

/** Completes a browser-based OAuth sign-in from the parameters delivered to the mobile callback. */
class CompleteOAuthCallbackUseCase @Inject constructor(private val auth: AuthRepository) {
    operator fun invoke(parameters: Map<String, String?>): Boolean {
        val token = parameters["auth_token"].orEmpty()
        val role = parameters["role"].orEmpty()
        if (token.isBlank() || role !in SUPPORTED_ROLES) return false
        auth.saveSession(
            token,
            CoachUser(
                id = parameters["userId"] ?: "social-user",
                name = parameters["name"] ?: "eCricketCoach member",
                email = parameters["email"].orEmpty(),
                role = role,
                coachContext = parameters["coachContext"],
                tenantId = parameters["tenantId"],
                clubName = parameters["clubName"]
            )
        )
        return true
    }

    private companion object {
        val SUPPORTED_ROLES = setOf("SUPER_ADMIN", "CLUB_ADMIN", "COACH", "PLAYER")
    }
}

class SignOutUseCase @Inject constructor(private val auth: AuthRepository) {
    operator fun invoke() = auth.signOut()
}
