package com.ecricketcoach.mobile.domain.model

data class CoachUser(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val coachContext: String?,
    val tenantId: String?,
    val clubName: String?
)

data class GoogleSignInChallenge(val clientId: String, val nonce: String, val challenge: String)
data class CoachSession(val token: String, val user: CoachUser)
