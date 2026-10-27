package com.ecricketcoach.mobile.domain.repository

import android.net.Uri
import com.ecricketcoach.mobile.domain.model.*
import java.io.File
import org.json.JSONObject

/** Video, CAPE and OpenAI batting analysis, Google Drive import and report downloads. */
interface AnalysisRepository {
    suspend fun analyzeKinematicsDriveVideo(driveFileId: String, discipline: String, timestampMs: Long = 0): KinematicsOverlay
    suspend fun downloadAssessmentReportPdf(assessmentId: String): ByteArray
    suspend fun downloadOpenAiBattingReportPdf(reportId: String): ByteArray
    suspend fun deleteOpenAiBattingReport(reportId: String)
    suspend fun getVideoAnalysisHistory(): List<VideoAnalysisEntry>
    suspend fun deleteVideoAnalysis(analysisId: String)
    suspend fun analyzeVideo(uri: Uri, discipline: String, player: ClubMember?): VideoAnalysisEntry
    suspend fun analyzeOpenAiBattingVideo(uri: Uri?, driveFileId: String?, player: ClubMember?, playerId: String? = player?.id, assessmentId: String? = null, shotType: String = "unknown", batterHandedness: String = "unknown", cameraView: String = "unknown", playbackSpeed: String = "unknown", captureFps: Double? = null, priorities: List<String> = emptyList(), contactTimestampSeconds: Double? = null, startTimeSeconds: Double? = null, endTimeSeconds: Double? = null): OpenAiBattingAnalysis
    suspend fun getLatestOpenAiBattingAnalysis(playerId: String, assessmentId: String? = null, reportId: String? = null): OpenAiBattingAnalysis?
    suspend fun listOpenAiBattingReports(playerId: String): List<OpenAiBattingReportSummary>
    suspend fun saveOpenAiBattingReview(reportId: String, note: String, findings: List<OpenAiFindingReview>)
    suspend fun analyzeOpenAiPoseOverlay(input: OpenAiPoseOverlayInput, handedness: String, shotType: String): PoseOverlayResult
    suspend fun saveOpenAiPoseOverlay(reportId: String, result: PoseOverlayResult)
    suspend fun loadSavedPoseOverlay(analysis: OpenAiBattingAnalysis): PoseOverlayResult?
    suspend fun analyzeKinematicsVideo(uri: Uri, discipline: String, timestampMs: Long = 0): KinematicsOverlay
    suspend fun getAssessmentVideo(assessmentId: String): AssessmentVideo?
    suspend fun uploadAssessmentVideo(assessmentId: String, uri: Uri): Pair<PlayerAssessment, AssessmentVideo>
    suspend fun analyzeAssessmentDriveVideo(assessmentId: String, driveFileId: String): Pair<PlayerAssessment, AssessmentVideo>
    suspend fun getAssessmentCapeJob(assessmentId: String): CapeJob?
    suspend fun analyzeAssessmentVideoWithCape(assessmentId: String, uri: Uri?, driveFileId: String?, input: CapeInput): String
    suspend fun analyzePlayerVideoWithCape(playerId: String, uri: Uri?, driveFileId: String?, input: CapeInput, manualFrames: CapeManualFrames? = null): String
    suspend fun getLatestPlayerCapeJob(playerId: String, target: String): CapeJob?
    suspend fun getCapeContactCandidates(uri: Uri?, driveFileId: String?, centerFrame: Int? = null, before: Int? = null, after: Int? = null): CapeContactCandidates
    suspend fun downloadDriveVideoToCache(driveFileId: String): File
    suspend fun getCapeJob(jobId: String): CapeJob
    suspend fun deleteCapeJob(jobId: String)
    suspend fun getPlayerCapeJobs(playerId: String): List<CapeJobSummary>
    suspend fun getCapeJobDrills(jobId: String): List<CapeDrillAssignment>
    suspend fun assignCapeDrill(jobId: String, faultCode: String): CapeDrillAssignment
    suspend fun downloadCapeArtifact(path: String): Pair<ByteArray, String>
    suspend fun getGoogleDriveStatus(): Pair<Boolean, String?>
    fun googleDriveConnectUrl(): String
    suspend fun listGoogleDriveVideos(): List<DriveVideoFile>
    suspend fun disconnectGoogleDrive()
    suspend fun analyzeDriveVideo(driveFileId: String, discipline: String, player: ClubMember?): VideoAnalysisEntry
}
