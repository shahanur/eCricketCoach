package com.ecricketcoach.mobile.domain.model

data class KinematicsOverlay(
    val discipline: String,
    val timestampMs: Long,
    val issues: List<String>,
    val metrics: Map<String, String>,
    val imageBase64: String,
    val imageMimeType: String
)

data class CapeFault(
    val code: String,
    val milestone: String,
    val metric: String,
    val value: Double,
    val expectedLo: Double?,
    val expectedHi: Double?,
    val severity: String,
    val message: String,
    val recommendation: String,
    val drill: String?
)

data class CapeDelivery(
    val speedKmh: Double?,
    val speedToleranceKmh: Double,
    val lengthM: Double,
    val lengthZone: String,
    val lineZone: String,
    val isGoodBall: Boolean
)

data class CapeResult(
    val sessionId: String,
    val target: String,
    val handedness: String,
    val shotType: String?,
    val bowlerType: String?,
    val score: Int,
    val verdict: String,
    val faults: List<CapeFault>,
    val strengths: List<String>,
    val unavailable: List<String>,
    val summary: String?,
    val jointAngles: List<Pair<String, Double>>,
    val delivery: CapeDelivery?,
    // (endpoint key, Node download path) for each stored snapshot, ZIP excluded.
    val images: List<Pair<String, String>>,
    val zipPath: String?,
    // Extra kinematics (metric key, value, unit) measured at contact, after the joint angles.
    val contactMetrics: List<CapeMeasure> = emptyList(),
    // Null when the run had no point-of-contact data (e.g. bowling).
    val alignment: List<CapeAlignmentRow>? = null,
    val kinetics: List<CapeMeasure> = emptyList(),
    val contactFrame: Int? = null,
    val contactManual: Boolean = false,
    val contactCandidateCount: Int = 0,
    val guidance: CapeGuidance? = null
)

data class CapeMeasure(val key: String, val label: String, val value: Double, val unit: String)

data class CapeAlignmentRow(val metric: String, val label: String, val value: Double?, val unit: String, val expected: String)

data class CapeGuidance(val summary: String, val items: List<CapeGuidanceItem>)

data class CapeGuidanceItem(
    val faultCode: String,
    val title: String,
    val whyItMatters: String,
    val cues: List<String>,
    val drillName: String,
    val drillInstructions: List<String>,
    val equipment: List<String>
)

data class CapeJobSummary(
    val jobId: String,
    val status: String,
    val assessmentId: String?,
    val target: String?,
    val shotType: String?,
    val bowlerType: String?,
    val score: Int?,
    val verdict: String?,
    val faultCount: Int,
    val errorMessage: String?,
    val createdAt: String
)

data class CapeDrillAssignment(
    val id: String,
    val faultCode: String?,
    val title: String,
    val playerName: String,
    val correction: String?,
    val assignedByName: String?,
    val createdAt: String
)

data class CapeJob(
    val jobId: String,
    val status: String,
    val queuePosition: Int?,
    val errorMessage: String?,
    val result: CapeResult?
) {
    val isPending: Boolean get() = status == "QUEUED" || status == "RUNNING"
}

data class CapeInput(
    val target: String,
    val handedness: String,
    val shotType: String?,
    val bowlerType: String?,
    val calibrationPoints: List<Pair<Int, Int>>
)

data class CapeManualFrames(
    val preContact: List<Int> = emptyList(),
    val pointOfContact: List<Int> = emptyList(),
    val postContact: List<Int> = emptyList()
) {
    fun isValid(): Boolean = pointOfContact.isNotEmpty() &&
        (preContact.isEmpty() || preContact.max() < pointOfContact.min()) &&
        (postContact.isEmpty() || pointOfContact.max() < postContact.min())
}

data class CapeContactFrame(val index: Int, val timeSeconds: Double, val imageBase64: String)

data class CapeContactCandidates(
    val framerateFps: Double,
    val frameCount: Int,
    val suggestedFrame: Int?,
    val suggestionSource: String,
    val suggestionNote: String?,
    val frames: List<CapeContactFrame>
)

data class DriveVideoFile(val id: String, val name: String, val mimeType: String, val modifiedTime: String)

data class VideoAnalysisEntry(
    val id: String,
    val playerName: String?,
    val discipline: String,
    val score: Int,
    val detectedIssues: List<String>,
    val createdAt: String,
    val context: String = "",
    val sourceType: String = "",
    val metrics: List<Pair<String, String>> = emptyList(),
    val recommendedDrills: List<VideoRecommendedDrill> = emptyList()
)

data class VideoRecommendedDrill(
    val title: String,
    val discipline: String,
    val durationMinutes: Int,
    val context: String,
    val isNew: Boolean
)

data class OpenAiBattingContact(
    val status: String,
    val frameIndex: Int?,
    val timestampSeconds: Double?,
    val confidence: Double,
    val evidence: String,
    val imageDataUrl: String?
)

data class OpenAiBattingObservation(
    val title: String,
    val observation: String,
    val coachingImplication: String,
    val confidence: String,
    val alternativeExplanation: String = "",
    val coachingCue: String = "",
    val drill: String = "",
    val frameIndices: List<Int> = emptyList()
)

data class OpenAiBattingStrength(val title: String, val observation: String)

data class OpenAiFindingReview(val findingIndex: Int, val status: String, val note: String)

data class OpenAiCoachReview(val note: String, val findings: List<OpenAiFindingReview>)

data class OpenAiBattingReportSummary(
    val reportId: String,
    val createdAt: String,
    val sourceType: String?,
    val sourceName: String?,
    val discipline: String,
    val shotType: String?
)

/** Raw inputs the server needs to build the movement overlay for a fresh review. */
data class OpenAiPoseOverlayInput(
    val croppedContactImageDataUrl: String,
    val landmarksJson: String,
    val contactPointJson: String,
    val batPointsJson: String,
    val sequenceFrames: List<OpenAiPoseSequenceInput>
)

data class OpenAiPoseSequenceInput(
    val frameIndex: Int,
    val timestampSeconds: Double,
    val phase: String,
    val imageDataUrl: String
)

data class PoseRuleCheck(
    val group: String,
    val metric: String,
    val expectedMin: Double?,
    val expectedMax: Double?,
    val status: String,
    val severity: String?
)

data class PoseRuleFault(
    val code: String,
    val metric: String,
    val value: Double,
    val expectedMin: Double?,
    val expectedMax: Double?,
    val severity: String,
    val message: String,
    val recommendation: String,
    val drill: String?,
    val verdict: String?
)

data class PoseSequenceFrame(
    val frameIndex: Int,
    val timestampSeconds: Double,
    val phase: String,
    val status: String,
    val error: String?,
    val image: ByteArray?
)

data class PoseOverlayResult(
    val handedness: String,
    val shotType: String,
    val metrics: Map<String, Double?>,
    val temporalEstimates: Map<String, Double>,
    val verdict: String,
    val rulesShotType: String,
    val score: Double,
    val scoreScope: String,
    val checks: List<PoseRuleCheck>,
    val faults: List<PoseRuleFault>,
    val strengths: List<String>,
    val unavailable: List<String>,
    val overlayImage: ByteArray?,
    val sequence: List<PoseSequenceFrame>,
    /** Server metadata without inline images, used when saving the overlay to the report. */
    internal val metadataJson: String = "{}"
)

data class OpenAiBattingPhase(
    val phase: String,
    val frameIndex: Int?,
    val timestampSeconds: Double?,
    val evidence: String
)

data class OpenAiBattingDrill(
    val title: String,
    val instructions: List<String>,
    val rationale: String
)

data class OpenAiBattingAnalysis(
    val provider: String,
    val model: String,
    val durationSeconds: Double,
    val width: Int,
    val height: Int,
    val fps: Double,
    val sampledOverviewFrames: Int,
    val contact: OpenAiBattingContact,
    val phases: List<OpenAiBattingPhase>,
    val summary: String,
    val observations: List<OpenAiBattingObservation>,
    val errors: List<OpenAiBattingObservation>,
    val strengths: List<String>,
    val priorityCue: String,
    val drill: OpenAiBattingDrill,
    val limitations: List<String>,
    val reportId: String = "",
    val strengthItems: List<OpenAiBattingStrength> = emptyList(),
    val coachReview: OpenAiCoachReview? = null,
    val batterHandedness: String = "unknown",
    val requestedShotType: String = "unknown",
    val identifiedShotType: String? = null,
    val restoredFromReport: Boolean = false,
    val poseOverlayInput: OpenAiPoseOverlayInput? = null,
    /** Persisted overlay metadata on a saved report; images are fetched as report artifacts. */
    val savedPoseOverlayJson: String? = null,
    val poseOverlay: PoseOverlayResult? = null
)
