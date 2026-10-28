package com.ecricketcoach.mobile.data.repository

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import android.net.Uri
import com.ecricketcoach.mobile.domain.model.*
import java.io.File
import org.json.JSONObject
import com.ecricketcoach.mobile.data.api.CoachApi
import com.ecricketcoach.mobile.data.datastore.AuthStore
import com.ecricketcoach.mobile.domain.repository.AnalysisRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnalysisRepositoryImpl @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val api: CoachApi,
    private val store: AuthStore
) : AnalysisRepository {
    private fun token(): String = store.requireToken()

    override suspend fun analyzeKinematicsDriveVideo(driveFileId: String, discipline: String, timestampMs: Long): KinematicsOverlay =
        api.analyzeKinematicsDriveVideo(token(), driveFileId, discipline, timestampMs)

    override suspend fun downloadAssessmentReportPdf(assessmentId: String): ByteArray =
        api.downloadAssessmentReportPdf(token(), assessmentId)

    override suspend fun downloadOpenAiBattingReportPdf(reportId: String): ByteArray =
        api.downloadOpenAiBattingReportPdf(token(), reportId)

    override suspend fun deleteOpenAiBattingReport(reportId: String) {
        api.deleteOpenAiBattingReport(token(), reportId)
    }

    override suspend fun getVideoAnalysisHistory(): List<VideoAnalysisEntry> =
        api.getVideoAnalysisHistory(token())

    override suspend fun deleteVideoAnalysis(analysisId: String) {
        api.deleteVideoAnalysis(token(), analysisId)
    }

    override suspend fun analyzeVideo(uri: Uri, discipline: String, player: ClubMember?): VideoAnalysisEntry =
        api.analyzeVideo(appContext, token(), uri, discipline, player)

    override suspend fun analyzeOpenAiBattingVideo(uri: Uri?, driveFileId: String?, player: ClubMember?, playerId: String?, assessmentId: String?, shotType: String, batterHandedness: String, cameraView: String, playbackSpeed: String, captureFps: Double?, priorities: List<String>, contactTimestampSeconds: Double?, startTimeSeconds: Double?, endTimeSeconds: Double?): OpenAiBattingAnalysis =
        api.analyzeOpenAiBattingVideo(appContext, token(), uri, driveFileId, player, playerId, assessmentId, shotType, batterHandedness, cameraView, playbackSpeed, captureFps, priorities, contactTimestampSeconds, startTimeSeconds, endTimeSeconds)

    override suspend fun getLatestOpenAiBattingAnalysis(playerId: String, assessmentId: String?, reportId: String?): OpenAiBattingAnalysis? =
        api.getLatestOpenAiBattingAnalysis(token(), playerId, assessmentId, reportId)

    override suspend fun listOpenAiBattingReports(playerId: String): List<OpenAiBattingReportSummary> =
        api.listOpenAiBattingReports(token(), playerId)

    override suspend fun saveOpenAiBattingReview(reportId: String, note: String, findings: List<OpenAiFindingReview>) =
        api.saveOpenAiBattingReview(token(), reportId, note, findings)

    override suspend fun analyzeOpenAiPoseOverlay(input: OpenAiPoseOverlayInput, handedness: String, shotType: String): PoseOverlayResult =
        api.analyzeOpenAiPoseOverlay(token(), input, handedness, shotType)

    override suspend fun saveOpenAiPoseOverlay(reportId: String, result: PoseOverlayResult) =
        api.saveOpenAiPoseOverlay(token(), reportId, result)

    override suspend fun loadSavedPoseOverlay(analysis: OpenAiBattingAnalysis): PoseOverlayResult? =
        api.loadSavedPoseOverlay(token(), analysis)

    override suspend fun analyzeKinematicsVideo(uri: Uri, discipline: String, timestampMs: Long): KinematicsOverlay =
        api.analyzeKinematicsVideo(appContext, token(), uri, discipline, timestampMs)

    override suspend fun getAssessmentVideo(assessmentId: String): AssessmentVideo? =
        api.getAssessmentVideo(token(), assessmentId)

    override suspend fun uploadAssessmentVideo(assessmentId: String, uri: Uri): Pair<PlayerAssessment, AssessmentVideo> =
        api.uploadAssessmentVideo(appContext, token(), assessmentId, uri)

    override suspend fun analyzeAssessmentDriveVideo(assessmentId: String, driveFileId: String): Pair<PlayerAssessment, AssessmentVideo> =
        api.analyzeAssessmentDriveVideo(token(), assessmentId, driveFileId)

    override suspend fun getAssessmentCapeJob(assessmentId: String): CapeJob? =
        api.getAssessmentCapeJob(token(), assessmentId)

    override suspend fun analyzeAssessmentVideoWithCape(assessmentId: String, uri: Uri?, driveFileId: String?, input: CapeInput): String =
        api.analyzeAssessmentVideoWithCape(appContext, token(), assessmentId, uri, driveFileId, input)

    override suspend fun analyzePlayerVideoWithCape(playerId: String, uri: Uri?, driveFileId: String?, input: CapeInput, manualFrames: CapeManualFrames?): String =
        api.analyzePlayerVideoWithCape(appContext, token(), playerId, uri, driveFileId, input, manualFrames)

    override suspend fun getLatestPlayerCapeJob(playerId: String, target: String): CapeJob? =
        api.getLatestPlayerCapeJob(token(), playerId, target)

    override suspend fun getCapeContactCandidates(uri: Uri?, driveFileId: String?, centerFrame: Int?, before: Int?, after: Int?): CapeContactCandidates =
        api.getCapeContactCandidates(appContext, token(), uri, driveFileId, centerFrame, before, after)

    override suspend fun downloadDriveVideoToCache(driveFileId: String): File =
        api.downloadDriveVideoToCache(appContext, token(), driveFileId)

    override suspend fun getCapeJob(jobId: String): CapeJob =
        api.getCapeJob(token(), jobId)

    override suspend fun deleteCapeJob(jobId: String) {
        api.deleteCapeJob(token(), jobId)
    }

    override suspend fun getPlayerCapeJobs(playerId: String): List<CapeJobSummary> =
        api.getPlayerCapeJobs(token(), playerId)

    override suspend fun getCapeJobDrills(jobId: String): List<CapeDrillAssignment> =
        api.getCapeJobDrills(token(), jobId)

    override suspend fun assignCapeDrill(jobId: String, faultCode: String): CapeDrillAssignment =
        api.assignCapeDrill(token(), jobId, faultCode)

    override suspend fun downloadCapeArtifact(path: String): Pair<ByteArray, String> =
        api.downloadCapeArtifact(token(), path)

    override suspend fun getGoogleDriveStatus(): Pair<Boolean, String?> =
        api.getGoogleDriveStatus(token())

    override fun googleDriveConnectUrl(): String =
        api.googleDriveConnectUrl(token())

    override suspend fun listGoogleDriveVideos(): List<DriveVideoFile> =
        api.listGoogleDriveVideos(token())

    override suspend fun disconnectGoogleDrive() {
        api.disconnectGoogleDrive(token())
    }

    override suspend fun analyzeDriveVideo(driveFileId: String, discipline: String, player: ClubMember?): VideoAnalysisEntry =
        api.analyzeDriveVideo(token(), driveFileId, discipline, player)
}
