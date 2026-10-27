package com.ecricketcoach.mobile.domain.model

/** Raised when the eCricketCoach API rejects a request with a non-success HTTP status. */
class ApiException(val statusCode: Int, message: String) : Exception(message)
