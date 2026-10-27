package com.ecricketcoach.mobile.domain.model

data class PlayerAssessment(
    val id: String,
    val playerId: String,
    val playerName: String,
    val title: String,
    val discipline: String,
    val scheduledDate: String,
    val scheduledTime: String? = null,
    val status: String,
    val metrics: List<AssessmentMetric>,
    val aiSummary: String?,
    val aiRecommendations: List<String>,
    val coachName: String = "",
    val strengths: String = "",
    val focusAreas: String = "",
    val coachFeedback: String = "",
    val playerFeedback: String = "",
    val videoAnalysisId: String? = null
)

data class AssessmentVideo(
    val id: String,
    val overallScore: Int,
    val detectedIssues: List<String>,
    val recommendedDrills: List<String>,
    val biomechanics: List<Pair<String, String>>,
    val driveLink: String?,
    val createdAt: String
)

data class AssessmentMetric(val name: String, val score: Int?, val note: String)
