import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { GeminiVideoAnalysisService } from '../services/geminiVideoAnalysisService.js';
import { getValidAccessToken } from './googleDrive.js';
import { DbService } from '../services/dbService.js';
import { fetchWithRetry } from '../utils/retry.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { analyzeBattingVideoWithOpenAI, OpenAiBattingAnalysis, OpenAiBattingAnalysisError } from '../services/openAiBattingAnalysisService.js';
import { createAndPersistBattingReport, isBattingReportArtifactName, persistBattingCoachReview, persistOpenAiPoseOverlay, StoredReportArtifact } from '../services/openAiBattingReportArtifacts.js';
import { analyzeVideoKineticsWithCape } from '../services/openAiCapeKinetics.js';
import { buildBattingReportPdf } from '../services/assessmentReportPdf.js';

export const aiRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const poseOverlayImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 10, fieldSize: 512 * 1024 }
}).fields([
  { name: 'overlay', maxCount: 1 },
  ...Array.from({ length: 9 }, (_, index) => ({ name: `sequence_${index}`, maxCount: 1 }))
]);
const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const BATTING_PRIORITIES = ['footwork', 'head_alignment', 'contact', 'joint_angles', 'bat_path', 'extension', 'follow_through'] as const;

function getOpenAiMaxVideoBytes(): number {
  const megabytes = Number(process.env.OPENAI_MAX_VIDEO_SIZE_MB);
  const configured = Number.isFinite(megabytes) && megabytes >= 1 && megabytes <= 2048 ? megabytes : 500;
  return Math.floor(configured * 1024 * 1024);
}

function readPromptEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T | null {
  if (value === undefined || value === null || value === '') return fallback;
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : null;
}

function readBodyAlias(body: Record<string, unknown>, camelName: string, snakeName: string): unknown {
  return body[camelName] ?? body[snakeName];
}

function parsePriorities(value: unknown): Array<typeof BATTING_PRIORITIES[number]> | null {
  if (value === undefined || value === null || value === '') return [...BATTING_PRIORITIES];
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return null; }
  }
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string' || !BATTING_PRIORITIES.includes(item as typeof BATTING_PRIORITIES[number]))) return null;
  return [...new Set(parsed as Array<typeof BATTING_PRIORITIES[number]>)];
}

function parseCapeCalibrationPoints(value: unknown): [number, number][] | null | false {
  if (value === undefined || value === null || value === '') return null;
  let points = value;
  if (typeof value === 'string') {
    try { points = JSON.parse(value); } catch { return false; }
  }
  if (!Array.isArray(points) || points.length !== 4 || points.some(point =>
    !Array.isArray(point) || point.length !== 2 || point.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)
  )) return false;
  return points as [number, number][];
}

type Discipline = 'BATTING' | 'BOWLING' | 'KEEPING' | 'FIELDING';

// Real video analysis: analyzes either a directly uploaded device video (multipart "file" field)
// or a video already stored in the user's connected Google Drive ("driveFileId" field), using
// Gemini's multimodal video understanding. Falls back to a deterministic heuristic analysis if
// Gemini is not configured, fails, or no actual video bytes are available.
aiRouter.post('/analyze', upload.single('file'), async (req: Request, res: Response) => {
  const discipline = (req.body?.discipline || 'BATTING') as Discipline;
  const context = (req.body?.context === 'GROUP' ? 'GROUP' : 'INDIVIDUAL') as 'INDIVIDUAL' | 'GROUP';
  const driveFileId = req.body?.driveFileId as string | undefined;
  const playerId = (req.body?.playerId as string | undefined) || null;
  const playerName = (req.body?.playerName as string | undefined) || null;
  const file = (req as Request & { file?: Express.Multer.File }).file;

  if (!discipline) {
    return res.status(400).json({ error: 'Discipline is required (BATTING, BOWLING, KEEPING, FIELDING)' });
  }

  try {
    let analysis;
    let userId: string | null = null;
    let sourceType: 'LOCAL_UPLOAD' | 'GOOGLE_DRIVE';

    // Best-effort: identify the user (if authenticated) so we can attribute the saved result,
    // even for device uploads which don't strictly require auth today.
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1];
    if (bearerToken) {
      try {
        const decoded = jwt.verify(bearerToken, jwtSecret) as { userId: string };
        userId = decoded.userId;
      } catch {
        // ignore - handled per-branch below where auth is actually required
      }
    }

    if (file) {
      // Device-uploaded clip: send the raw bytes straight to Gemini for real analysis.
      sourceType = 'LOCAL_UPLOAD';
      analysis = await GeminiVideoAnalysisService.analyzeVideoBuffer(file.buffer, file.mimetype, discipline, context);
    } else if (driveFileId) {
      // Drive-sourced clip: authenticate the user, pull their Drive access token, download the
      // actual video bytes, then feed them to Gemini the same way as a device upload.
      sourceType = 'GOOGLE_DRIVE';
      if (!bearerToken) {
        return res.status(401).json({ error: 'Authentication required to analyze a Google Drive video.' });
      }
      if (!userId) {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      }

      const driveAccess = await getValidAccessToken(userId);
      if (!driveAccess) {
        return res.status(404).json({ error: 'Google Drive is not connected for this account.' });
      }

      const downloadRes = await fetchWithRetry(`${GOOGLE_DRIVE_FILES_URL}/${driveFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${driveAccess.accessToken}` }
      }, { label: 'Google Drive video download' });
      if (!downloadRes.ok) {
        return res.status(downloadRes.status).json({ error: 'Failed to download the selected video from Google Drive.' });
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = downloadRes.headers.get('content-type') || 'video/mp4';
      analysis = await GeminiVideoAnalysisService.analyzeVideoBuffer(buffer, mimeType, discipline, context);
    } else {
      return res.status(400).json({ error: 'No video provided. Upload a device video file or select a video from your connected Google Drive.' });
    }

    // Persist the real Gemini analysis result so it's queryable later (history, progression, etc.)
    let savedId: string | null = null;
    try {
      const saved = await DbService.createVideoAnalysis({
        userId,
        playerId,
        playerName,
        discipline,
        context,
        sourceType,
        driveFileId: driveFileId || null,
        model: GeminiVideoAnalysisService.getLastUsedModel() || process.env.GEMINI_MODEL || 'gemini-flash-latest',
        analysis
      });
      savedId = saved.id;
    } catch (persistErr) {
      // Don't fail the request if saving history fails - the analysis itself already succeeded.
      console.error('Failed to persist video analysis result:', persistErr);
    }

    return res.json({ status: 'COMPLETED', discipline, analysis, analysisId: savedId });
  } catch (err: any) {
    // Log the full internal error (including which AI provider/model failed) server-side only.
    // The client never needs to know which AI vendor powers the analysis.
    console.error('Video analysis error:', err);
    const errorMessage = String(err?.message || '');
    const isNotConfigured = /not configured/i.test(errorMessage);
    const isQuotaExceeded = /GEMINI_QUOTA_EXCEEDED/i.test(errorMessage);

    if (isQuotaExceeded) {
      return res.status(429).json({
        error: 'Our AI video analysis service has reached its usage limit for right now. Please try again in a little while (usage limits typically reset within an hour, or by tomorrow for daily limits).'
      });
    }

    return res.status(502).json({
      error: isNotConfigured
        ? 'AI video analysis is not available on this server right now. Please contact support.'
        : 'We could not analyze this video clip right now. Please try again in a moment.'
    });
  }
});

// Returns the active player in the caller's club, or sends the appropriate error response and returns null.
async function resolveBattingReportPlayer(req: AuthenticatedRequest, res: Response, playerId: string): Promise<{ id: string } | null> {
  const user = req.user!;
  if (user.role === 'COACH') {
    if (user.coachContext !== 'CLUB') { res.status(403).json({ error: 'club_coach_required' }); return null; }
    const coach = await prisma.clubMember.findFirst({
      where: { id: user.userId, clubId: user.tenantId, role: 'COACH', invitationStatus: 'ACTIVE' }
    });
    if (!coach) { res.status(403).json({ error: 'club_coach_required' }); return null; }
  }
  const player = await prisma.clubMember.findFirst({
    where: { id: playerId, clubId: user.tenantId, role: 'PLAYER', invitationStatus: 'ACTIVE' },
    select: { id: true }
  });
  if (!player) { res.status(404).json({ error: 'player_not_found', message: 'The selected player is not active in this club.' }); return null; }
  return player;
}

const BATTING_SHOT_LABELS: Record<string, string> = {
  front_foot_drive: 'Front-foot drive',
  front_foot_defence: 'Front-foot defence'
};

// Prefers the coach-selected shot; falls back to the shot the model identified.
function describeBattingShotType(requested: string | null, identified: string | null): string | null {
  if (requested && BATTING_SHOT_LABELS[requested]) return BATTING_SHOT_LABELS[requested];
  const text = identified?.trim();
  if (!text || text === 'unknown') return null;
  if (BATTING_SHOT_LABELS[text]) return BATTING_SHOT_LABELS[text];
  const label = text.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Lists a player's saved OpenAI batting reports, newest first, for the history cards.
aiRouter.get(
  '/analyze/openai-batting/history',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  async (req: AuthenticatedRequest, res: Response) => {
    const playerId = typeof req.query.playerId === 'string' ? req.query.playerId.trim() : '';
    if (!playerId) return res.status(400).json({ error: 'player_required', message: 'Select a player to load their batting review history.' });
    try {
      const player = await resolveBattingReportPlayer(req, res, playerId);
      if (!player) return;
      // Reads only the shot-type fields from the analysis JSON rather than loading each full record.
      const reports = await prisma.$queryRaw<Array<{
        id: string; created_at: Date; source_type: string | null; source_name: string | null;
        requested_shot: string | null; identified_shot: string | null;
      }>>`
        SELECT id, created_at, source_type, source_name,
          analysis->'requestMetadata'->>'shotType' AS requested_shot,
          analysis->'shotIdentification'->>'shotType' AS identified_shot
        FROM openai_batting_reports
        WHERE tenant_id = ${req.user!.tenantId} AND player_id = ${player.id}
        ORDER BY created_at DESC
        LIMIT 100`;
      return res.json({
        reports: reports.map(report => ({
          reportId: report.id,
          createdAt: report.created_at,
          sourceType: report.source_type,
          sourceName: report.source_name,
          discipline: 'BATTING',
          shotType: describeBattingShotType(report.requested_shot, report.identified_shot)
        }))
      });
    } catch (error) {
      console.error('OpenAI batting report history list failed:', error);
      return res.status(500).json({ error: 'report_history_failed', message: 'The batting review history could not be loaded.' });
    }
  }
);

// OpenAI-assisted batting review using timestamped sampled frames and a focused contact window.
// Loads the player's latest saved report, or the one given by the optional reportId query parameter.
aiRouter.get(
  '/analyze/openai-batting/latest',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  async (req: AuthenticatedRequest, res: Response) => {
    const playerId = typeof req.query.playerId === 'string' ? req.query.playerId.trim() : '';
    if (!playerId) return res.status(400).json({ error: 'player_required', message: 'Select a player to load their latest batting review.' });
    const reportId = typeof req.query.reportId === 'string' ? req.query.reportId.trim() : '';
    if (reportId && !/^[0-9a-f-]{36}$/i.test(reportId)) return res.status(400).json({ error: 'invalid_report_id' });
    const assessmentId = typeof req.query.assessmentId === 'string' ? req.query.assessmentId.trim().slice(0, 100) : '';

    const user = req.user!;
    try {
      const player = await resolveBattingReportPlayer(req, res, playerId);
      if (!player) return;

      const report = await prisma.openAiBattingReport.findFirst({
        where: {
          tenantId: user.tenantId,
          playerId: player.id,
          ...(reportId ? { id: reportId } : {}),
          ...(assessmentId ? { assessmentId } : {})
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, playerName: true, createdAt: true, sourceType: true, sourceName: true, analysis: true, artifacts: true }
      });
      if (!report) return reportId ? res.status(404).json({ error: 'report_not_found', message: 'That saved batting review was not found.' }) : res.json({ report: null });

      const saved = report.analysis as Record<string, unknown>;
      const rawArtifacts = Array.isArray(report.artifacts) ? report.artifacts : [];
      const artifactNames = rawArtifacts.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const name = (item as Record<string, unknown>).name;
        return typeof name === 'string' && isBattingReportArtifactName(name) ? [name] : [];
      });
      const reportRoot = path.resolve(process.env.OPENAI_REPORTS_DIR || path.join(process.cwd(), 'var', 'openai-reports'));
      const reportDirectory = path.resolve(reportRoot, report.id);
      if (!reportDirectory.startsWith(`${reportRoot}${path.sep}`)) return res.status(404).json({ error: 'report_not_found' });
      const readPngDataUrl = async (name: string): Promise<string> => {
        if (!artifactNames.includes(name)) return '';
        try {
          const bytes = await fs.readFile(path.join(reportDirectory, name));
          return `data:image/png;base64,${bytes.toString('base64')}`;
        } catch {
          return '';
        }
      };
      const [movementImage, alignmentImage, contactCropImage] = await Promise.all([
        readPngDataUrl('phase_sequence.png'),
        readPngDataUrl('joint_analysis.png'),
        readPngDataUrl('contact_crop.png')
      ]);
      const contact = saved.contact && typeof saved.contact === 'object' ? saved.contact as Record<string, unknown> : {};
      const shotAssessments = Array.isArray(saved.shotAssessments) ? saved.shotAssessments : [];
      const analysis = {
        ...saved,
        reportId: report.id,
        artifactNames,
        restoredFromReport: true,
        contact: { ...contact, imageDataUrl: null },
        croppedContactImageDataUrl: contactCropImage || null,
        phaseReviewFrames: [],
        sourceFrameImages: [],
        poseSequenceFrames: [],
        visualOutputs: { movementSequenceImageDataUrl: movementImage, jointAlignmentImageDataUrl: alignmentImage },
        shotAssessments: shotAssessments.map(item => item && typeof item === 'object'
          ? { ...(item as Record<string, unknown>), phaseReviewFrames: [] }
          : item)
      };
      return res.json({ report: { reportId: report.id, playerName: report.playerName, createdAt: report.createdAt, sourceType: report.sourceType, sourceName: report.sourceName, artifactNames, analysis } });
    } catch (error) {
      console.error('OpenAI batting report history fetch failed:', error);
      return res.status(500).json({ error: 'report_fetch_failed', message: 'The saved batting review could not be loaded.' });
    }
  }
);

aiRouter.post(
  '/analyze/openai-batting',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  (req: Request, res: Response, next) => {
    multer({ storage: multer.memoryStorage(), limits: { fileSize: getOpenAiMaxVideoBytes() } }).single('file')(req, res, error => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'file_too_large', message: `Choose a video smaller than ${Math.round(getOpenAiMaxVideoBytes() / (1024 * 1024))} MB.` });
      } else if (error) {
        res.status(400).json({ error: 'invalid_upload', message: 'The video upload could not be read.' });
      } else {
        next();
      }
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const driveFileId = typeof req.body?.driveFileId === 'string' ? req.body.driveFileId.trim() : '';
    const playerId = typeof req.body?.playerId === 'string' ? req.body.playerId.trim() : '';
    const assessmentId = typeof req.body?.assessmentId === 'string' ? req.body.assessmentId.trim() : '';
    const body = (req.body || {}) as Record<string, unknown>;
    const shotType = readPromptEnum(readBodyAlias(body, 'shotType', 'shot_type'), ['front_foot_drive', 'front_foot_defence', 'unknown'] as const, 'unknown');
    const batterHandedness = readPromptEnum(readBodyAlias(body, 'batterHandedness', 'batter_handedness'), ['right', 'left', 'unknown'] as const, 'unknown');
    const cameraView = readPromptEnum(readBodyAlias(body, 'cameraView', 'camera_view'), ['front_on', 'side_on', 'three_quarter', 'unknown'] as const, 'unknown');
    const playbackSpeed = readPromptEnum(readBodyAlias(body, 'playbackSpeed', 'playback_speed'), ['real_time', 'slow_motion', 'unknown'] as const, 'unknown');
    const rawCaptureFps = readBodyAlias(body, 'captureFps', 'capture_fps');
    const captureFps = rawCaptureFps === undefined || rawCaptureFps === null || rawCaptureFps === ''
      ? null
      : typeof rawCaptureFps === 'number' || typeof rawCaptureFps === 'string' ? Number(rawCaptureFps) : Number.NaN;
    const priorities = parsePriorities(body.priorities);
    const capeCalibrationPoints = parseCapeCalibrationPoints(body.capeCalibrationPoints ?? body.cape_calibration_points);
    if (!shotType || !batterHandedness || !cameraView || !playbackSpeed || priorities === null ||
      (captureFps !== null && (!Number.isFinite(captureFps) || captureFps <= 0 || captureFps > 1000))) {
      return res.status(400).json({ error: 'invalid_analysis_metadata', message: 'Shot, handedness, camera, timing, FPS, or priorities were invalid.' });
    }
    if (capeCalibrationPoints === false) {
      return res.status(400).json({ error: 'invalid_cape_calibration_points', message: 'CAPE calibration needs four non-negative [x, y] video pixel points.' });
    }
    const rawContactTimestamp = req.body?.contactTimestampSeconds;
    const contactTimestampSeconds = rawContactTimestamp === undefined || rawContactTimestamp === ''
      ? undefined
      : typeof rawContactTimestamp === 'number' || typeof rawContactTimestamp === 'string'
        ? Number(rawContactTimestamp)
        : Number.NaN;
    const parseOptionalTime = (value: unknown): number | undefined => value === undefined || value === null || value === ''
      ? undefined
      : typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
    const startTimeSeconds = parseOptionalTime(req.body?.startTimeSeconds);
    const endTimeSeconds = parseOptionalTime(req.body?.endTimeSeconds);

    if (contactTimestampSeconds !== undefined && (!Number.isFinite(contactTimestampSeconds) || contactTimestampSeconds < 0)) {
      return res.status(400).json({ error: 'invalid_contact_timestamp', message: 'The selected contact time must be a valid non-negative number of seconds.' });
    }
    if ((startTimeSeconds !== undefined && (!Number.isFinite(startTimeSeconds) || startTimeSeconds < 0)) ||
      (endTimeSeconds !== undefined && (!Number.isFinite(endTimeSeconds) || endTimeSeconds < 0)) ||
      (startTimeSeconds !== undefined && endTimeSeconds !== undefined && endTimeSeconds <= startTimeSeconds) ||
      (contactTimestampSeconds !== undefined && ((startTimeSeconds !== undefined && contactTimestampSeconds < startTimeSeconds) ||
        (endTimeSeconds !== undefined && contactTimestampSeconds > endTimeSeconds)))) {
      return res.status(400).json({ error: 'invalid_analysis_range', message: 'Choose a valid start and end time, with the contact point inside the selected range.' });
    }

    if (file && driveFileId) {
      return res.status(400).json({ error: 'invalid_source', message: 'Upload a video or select a Google Drive video, not both.' });
    }
    if (!file && !driveFileId) {
      return res.status(400).json({ error: 'video_required', message: 'Upload a video or select one from Google Drive.' });
    }
    if (file && !/^video\/[A-Za-z0-9.+-]+$/.test(file.mimetype)) {
      return res.status(400).json({ error: 'invalid_video', message: 'Only video files can be analysed.' });
    }
    if (!file && !GOOGLE_DRIVE_FILE_ID.test(driveFileId)) {
      return res.status(400).json({ error: 'invalid_drive_file', message: 'The selected Google Drive file ID is invalid.' });
    }

    const user = req.user!;
    let playerName: string | null = null;
    try {
      if (user.role === 'COACH') {
        if (user.coachContext !== 'CLUB') {
          return res.status(403).json({ error: 'club_coach_required', message: 'An active club coach account is required.' });
        }
        const coach = await prisma.clubMember.findFirst({
          where: { id: user.userId, clubId: user.tenantId, role: 'COACH', invitationStatus: 'ACTIVE' }
        });
        if (!coach) return res.status(403).json({ error: 'club_coach_required', message: 'An active club coach account is required.' });
      }
      if (playerId) {
        const player = await prisma.clubMember.findFirst({
          where: { id: playerId, clubId: user.tenantId, role: 'PLAYER', invitationStatus: 'ACTIVE' }
        });
        if (!player) return res.status(404).json({ error: 'player_not_found', message: 'The selected player is not active in this club.' });
        playerName = player.name;
      }
      if (assessmentId) {
        const assessment = await prisma.playerAssessment.findFirst({ where: { id: assessmentId, clubId: user.tenantId } });
        if (!assessment || (user.role !== 'CLUB_ADMIN' && assessment.coachId !== user.userId)) {
          return res.status(404).json({ error: 'assessment_not_found', message: 'The assessment was not found.' });
        }
        if (assessment.playerId !== playerId) {
          return res.status(400).json({ error: 'assessment_player_mismatch', message: 'The video review player must match the assessment player.' });
        }
        if (assessment.discipline !== 'BATTING') {
          return res.status(409).json({ error: 'assessment_not_batting', message: 'Batting video review is available for batting assessments only.' });
        }
        if (assessment.status === 'COMPLETED') {
          return res.status(409).json({ error: 'assessment_completed', message: 'Videos can only be reviewed before the assessment is completed.' });
        }
      }

      let videoBuffer: Buffer;
      let sourceName: string | null = null;
      if (file) {
        videoBuffer = file.buffer;
        // Multer decodes multipart filenames as latin1; restore UTF-8 names.
        sourceName = Buffer.from(file.originalname || '', 'latin1').toString('utf8').trim().slice(0, 255) || null;
      } else {
        const driveAccess = await getValidAccessToken(user.userId);
        if (!driveAccess) return res.status(404).json({ error: 'drive_not_connected', message: 'Google Drive is not connected for this account.' });
        try {
          const metadata = await fetch(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(driveFileId)}?fields=name`, {
            headers: { Authorization: `Bearer ${driveAccess.accessToken}` }
          });
          if (metadata.ok) {
            const { name } = await metadata.json() as { name?: unknown };
            if (typeof name === 'string' && name.trim()) sourceName = name.trim().slice(0, 255);
          }
        } catch {
          // The file name is display-only; analysis continues without it.
        }
        const download = await fetchWithRetry(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(driveFileId)}?alt=media`, {
          headers: { Authorization: `Bearer ${driveAccess.accessToken}` }
        }, { label: 'Google Drive video download for OpenAI analysis' });
        if (!download.ok) return res.status(download.status).json({ error: 'drive_download_failed', message: 'The selected Drive video could not be downloaded.' });
        const contentLength = Number(download.headers.get('content-length') || 0);
        const maxVideoBytes = getOpenAiMaxVideoBytes();
        if (contentLength > maxVideoBytes) return res.status(413).json({ error: 'file_too_large', message: `Choose a video smaller than ${Math.round(maxVideoBytes / (1024 * 1024))} MB.` });
        videoBuffer = Buffer.from(await download.arrayBuffer());
        if (videoBuffer.length > maxVideoBytes) return res.status(413).json({ error: 'file_too_large', message: `Choose a video smaller than ${Math.round(maxVideoBytes / (1024 * 1024))} MB.` });
      }

      const capeKineticsPromise = capeCalibrationPoints
        ? analyzeVideoKineticsWithCape({
            video: videoBuffer,
            filename: path.basename(file?.originalname || 'clip.mp4'),
            mimeType: file?.mimetype || 'video/mp4',
            calibrationPoints: capeCalibrationPoints,
            handedness: batterHandedness === 'left' ? 'left' : 'right',
            shotType: shotType === 'front_foot_defence' ? 'forward_defence' : 'front_foot_drive'
          })
        : null;
      const analysis = await analyzeBattingVideoWithOpenAI(videoBuffer, {
        contactTimestampSeconds,
        startTimeSeconds,
        endTimeSeconds,
        shotType,
        batterHandedness,
        cameraView,
        playbackSpeed,
        captureFps,
        priorities
      });
      if (capeKineticsPromise) {
        analysis.capeKinetics = await capeKineticsPromise;
        analysis.executionLog.stages.push('cape_video_kinetics_parallel');
      }
      const reportRoot = path.resolve(process.env.OPENAI_REPORTS_DIR || path.join(process.cwd(), 'var', 'openai-reports'));
      const storedReport = await createAndPersistBattingReport(analysis, reportRoot);
      try {
        await prisma.openAiBattingReport.create({
          data: {
            id: storedReport.id,
            tenantId: user.tenantId,
            createdById: user.userId,
            playerId: playerId || null,
            playerName,
            assessmentId: assessmentId || null,
            sourceSha256: analysis.sourceSha256,
            sourceType: file ? 'LOCAL_UPLOAD' : 'GOOGLE_DRIVE',
            sourceName,
            model: analysis.executionLog.modelReturned,
            promptVersion: analysis.promptVersion,
            schemaVersion: analysis.schemaVersion,
            artifactKey: storedReport.id,
            artifacts: storedReport.artifacts as unknown as Prisma.InputJsonValue,
            analysis: storedReport.analysisRecord as Prisma.InputJsonValue
          }
        });
      } catch (error) {
        await fs.rm(storedReport.directory, { recursive: true, force: true });
        throw error;
      }
      const clientAnalysis: OpenAiBattingAnalysis = {
        ...analysis,
        contact: { ...analysis.contact, imageDataUrl: null },
        phaseReviewFrames: [],
        sourceFrameImages: [],
        shotAssessments: analysis.shotAssessments.map(shot => ({ ...shot, phaseReviewFrames: [] }))
      };
      return res.json({
        status: 'COMPLETED',
        discipline: 'BATTING',
        playerId: playerId || null,
        playerName,
        reportId: storedReport.id,
        artifactNames: storedReport.artifacts.map(artifact => artifact.name),
        analysis: clientAnalysis
      });
    } catch (error) {
      if (error instanceof OpenAiBattingAnalysisError) {
        console.warn('OpenAI batting video analysis rejected:', {
          code: error.code,
          status: error.status,
          message: error.message
        });
        return res.status(error.status).json({ error: error.code, message: error.message });
      }
      console.error('OpenAI batting video analysis failed:', error);
      return res.status(502).json({ error: 'openai_analysis_failed', message: 'The batting video could not be analysed. Please try again.' });
    }
  }
);

// Server-rendered movement and technique PDF for a saved batting review, shared by the web and mobile apps.
aiRouter.get(
  '/analyze/openai-batting/:reportId/report.pdf',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  async (req: AuthenticatedRequest, res: Response) => {
    const reportId = req.params.reportId;
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return res.status(404).json({ error: 'report_not_found' });
    try {
      const report = await prisma.openAiBattingReport.findFirst({
        where: { id: reportId, tenantId: req.user!.tenantId },
        select: { id: true, playerId: true, playerName: true, createdAt: true, analysis: true, artifacts: true }
      });
      if (!report || !report.playerId) return res.status(404).json({ error: 'report_not_found' });
      const player = await resolveBattingReportPlayer(req, res, report.playerId);
      if (!player) return;
      const playerName = report.playerName || 'Player';
      const pdf = await buildBattingReportPdf(report, playerName, report.createdAt);
      const safePlayerName = playerName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'player';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ecricketcoach-movement-technique-${safePlayerName}-${report.createdAt.toISOString().slice(0, 10)}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(pdf);
    } catch (error) {
      console.error('OpenAI batting report PDF failed:', error);
      return res.status(500).json({ error: 'report_pdf_failed', message: 'The PDF report could not be prepared.' });
    }
  }
);

// Deletes a saved batting review and its stored artifacts; shared by the web and mobile history cards.
aiRouter.delete(
  '/analyze/openai-batting/:reportId',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  async (req: AuthenticatedRequest, res: Response) => {
    const reportId = req.params.reportId;
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return res.status(404).json({ error: 'report_not_found' });
    try {
      const report = await prisma.openAiBattingReport.findFirst({
        where: { id: reportId, tenantId: req.user!.tenantId },
        select: { id: true, playerId: true }
      });
      if (!report) return res.status(404).json({ error: 'report_not_found', message: 'The batting review was not found.' });
      if (report.playerId) {
        const player = await resolveBattingReportPlayer(req, res, report.playerId);
        if (!player) return;
      }
      await prisma.openAiBattingReport.deleteMany({ where: { id: report.id, tenantId: req.user!.tenantId } });
      const root = path.resolve(process.env.OPENAI_REPORTS_DIR || path.join(process.cwd(), 'var', 'openai-reports'));
      const reportDirectory = path.resolve(root, report.id);
      if (reportDirectory.startsWith(`${root}${path.sep}`)) {
        await fs.rm(reportDirectory, { recursive: true, force: true }).catch(error => {
          console.error('OpenAI batting report artifact cleanup failed:', error);
        });
      }
      return res.status(204).send();
    } catch (error) {
      console.error('OpenAI batting report delete failed:', error);
      return res.status(500).json({ error: 'report_delete_failed', message: 'The batting review could not be deleted.' });
    }
  }
);

aiRouter.get(
  '/analyze/openai-batting/:reportId/review',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  async (req: AuthenticatedRequest, res: Response) => {
    const reportId = req.params.reportId;
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return res.status(404).json({ error: 'report_not_found' });
    try {
      const report = await prisma.openAiBattingReport.findFirst({
        where: { id: reportId, tenantId: req.user!.tenantId },
        select: { id: true, analysis: true, artifacts: true }
      });
      if (!report) return res.status(404).json({ error: 'report_not_found' });
      const record = report.analysis as Record<string, unknown>;
      return res.json({ review: record.coachReview ?? null });
    } catch (error) {
      console.error('OpenAI batting coach review fetch failed:', error);
      return res.status(500).json({ error: 'review_fetch_failed' });
    }
  }
);

aiRouter.post(
  '/analyze/openai-batting/:reportId/pose-overlay',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  (req: Request, res: Response, next) => {
    poseOverlayImageUpload(req, res, error => {
      if (error instanceof multer.MulterError) {
        return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'invalid_pose_overlay_upload', message: 'The pose overlay images could not be uploaded.' });
      }
      if (error) return res.status(400).json({ error: 'invalid_pose_overlay_upload', message: 'The pose overlay images could not be uploaded.' });
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const reportId = req.params.reportId;
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return res.status(404).json({ error: 'report_not_found' });
    const files = (req as Request & { files?: Record<string, Express.Multer.File[]> }).files || {};
    const overlayFile = files.overlay?.[0];
    if (!overlayFile || overlayFile.mimetype !== 'image/png') {
      return res.status(400).json({ error: 'invalid_pose_overlay', message: 'A PNG contact overlay is required.' });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(String(req.body?.poseOverlay || ''));
    } catch {
      return res.status(400).json({ error: 'invalid_pose_overlay', message: 'Pose overlay metadata must be valid JSON.' });
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return res.status(400).json({ error: 'invalid_pose_overlay', message: 'Pose overlay metadata must be an object.' });
    }
    const result = raw as Record<string, unknown>;
    const sequenceRaw = Array.isArray(result.sequence) ? result.sequence : [];
    if (result.status !== 'success' || !Number.isInteger(result.width) || !Number.isInteger(result.height) || sequenceRaw.length > 9) {
      return res.status(400).json({ error: 'invalid_pose_overlay', message: 'Pose overlay metadata is incomplete.' });
    }
    const sequence: Array<Record<string, unknown>> = [];
    const imageAssets: Array<{ name: string; buffer: Buffer }> = [{ name: 'pose_overlay.png', buffer: overlayFile.buffer }];
    for (const [index, value] of sequenceRaw.entries()) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return res.status(400).json({ error: 'invalid_pose_overlay', message: 'Pose sequence metadata is invalid.' });
      }
      const frame = value as Record<string, unknown>;
      if (!Number.isInteger(frame.frame_index) || typeof frame.timestamp_seconds !== 'number' || !Number.isFinite(frame.timestamp_seconds) ||
        !['PRE_CONTACT', 'CONTACT', 'POST_CONTACT'].includes(String(frame.phase)) || !['success', 'unavailable'].includes(String(frame.status))) {
        return res.status(400).json({ error: 'invalid_pose_overlay', message: 'Pose sequence metadata is invalid.' });
      }
      const { overlay_image_base64: _inlineImage, ...frameMetadata } = frame;
      const sequenceFile = files[`sequence_${index}`]?.[0];
      if (frame.status === 'success' && (!sequenceFile || sequenceFile.mimetype !== 'image/png')) {
        return res.status(400).json({ error: 'invalid_pose_overlay', message: 'A successful pose frame is missing its PNG image.' });
      }
      const artifactName = sequenceFile ? `pose_sequence_${index}.png` : null;
      sequence.push({ ...frameMetadata, artifactName });
      if (sequenceFile && artifactName) imageAssets.push({ name: artifactName, buffer: sequenceFile.buffer });
    }
    const user = req.user!;
    try {
      const report = await prisma.openAiBattingReport.findFirst({
        where: { id: reportId, tenantId: user.tenantId },
        select: { id: true, analysis: true, artifacts: true }
      });
      if (!report) return res.status(404).json({ error: 'report_not_found' });
      const record = report.analysis as Record<string, unknown>;
      const { overlay_image_base64: _inlineOverlay, ...resultMetadata } = result;
      const metadata = { ...resultMetadata, overlayArtifactName: 'pose_overlay.png', sequence };
      const root = path.resolve(process.env.OPENAI_REPORTS_DIR || path.join(process.cwd(), 'var', 'openai-reports'));
      const directory = path.resolve(root, report.id);
      if (!directory.startsWith(`${root}${path.sep}`)) return res.status(404).json({ error: 'report_not_found' });
      const currentArtifacts: StoredReportArtifact[] = Array.isArray(report.artifacts)
        ? report.artifacts.flatMap(item => {
            if (!item || typeof item !== 'object') return [];
            const artifact = item as Record<string, unknown>;
            return typeof artifact.name === 'string' && typeof artifact.mimeType === 'string' && typeof artifact.sizeBytes === 'number' && typeof artifact.sha256 === 'string'
              ? [{ name: artifact.name, mimeType: artifact.mimeType, sizeBytes: artifact.sizeBytes, sha256: artifact.sha256 }]
              : [];
          })
        : [];
      const persisted = await persistOpenAiPoseOverlay(directory, record, currentArtifacts, metadata, imageAssets);
      const updated = await prisma.openAiBattingReport.updateMany({
        where: { id: report.id, tenantId: user.tenantId },
        data: {
          analysis: persisted.analysisRecord as Prisma.InputJsonValue,
          artifacts: persisted.artifacts as unknown as Prisma.InputJsonValue
        }
      });
      if (!updated.count) return res.status(404).json({ error: 'report_not_found' });
      return res.json({ artifactNames: persisted.artifacts.map(artifact => artifact.name) });
    } catch (error) {
      console.error('OpenAI pose overlay persistence failed:', error);
      return res.status(500).json({ error: 'pose_overlay_save_failed', message: 'The pose overlay could not be saved to the report.' });
    }
  }
);

aiRouter.patch(
  '/analyze/openai-batting/:reportId/review',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  async (req: AuthenticatedRequest, res: Response) => {
    const reportId = req.params.reportId;
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return res.status(404).json({ error: 'report_not_found' });
    const body = req.body as Record<string, unknown>;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const rawReviews = body?.findings === undefined ? [] : body.findings;
    if (note.length > 3000 || !Array.isArray(rawReviews) || rawReviews.length > 30) {
      return res.status(400).json({ error: 'invalid_review', message: 'Review notes or finding edits exceed the allowed limits.' });
    }
    const findings: Array<{ findingIndex: number; status: 'accepted' | 'revised' | 'not_applicable'; note: string }> = [];
    for (const item of rawReviews) {
      if (!item || typeof item !== 'object') return res.status(400).json({ error: 'invalid_review' });
      const entry = item as Record<string, unknown>;
      if (!Number.isInteger(entry.findingIndex) || Number(entry.findingIndex) < 0 ||
        !['accepted', 'revised', 'not_applicable'].includes(String(entry.status)) ||
        typeof entry.note !== 'string' || entry.note.length > 1000) {
        return res.status(400).json({ error: 'invalid_review', message: 'Each finding review needs a valid index, status, and note up to 1000 characters.' });
      }
      findings.push({ findingIndex: Number(entry.findingIndex), status: entry.status as 'accepted' | 'revised' | 'not_applicable', note: entry.note.trim() });
    }
    try {
      const report = await prisma.openAiBattingReport.findFirst({
        where: { id: reportId, tenantId: req.user!.tenantId },
        select: { id: true, analysis: true, artifacts: true }
      });
      if (!report) return res.status(404).json({ error: 'report_not_found' });
      const analysisRecord = report.analysis as Record<string, unknown>;
      const findingCount = (Array.isArray(analysisRecord.errors) ? analysisRecord.errors.length : 0) +
        (Array.isArray(analysisRecord.observations) ? analysisRecord.observations.length : 0);
      if (findings.some(item => item.findingIndex >= findingCount)) return res.status(400).json({ error: 'invalid_review', message: 'A finding index does not exist in this report.' });
      const rawArtifacts: unknown[] = Array.isArray(report.artifacts) ? report.artifacts : [];
      const artifacts: StoredReportArtifact[] = rawArtifacts.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const artifact = item as Record<string, unknown>;
        return typeof artifact.name === 'string' && typeof artifact.mimeType === 'string' &&
          typeof artifact.sizeBytes === 'number' && typeof artifact.sha256 === 'string'
          ? [{ name: artifact.name, mimeType: artifact.mimeType, sizeBytes: artifact.sizeBytes, sha256: artifact.sha256 }]
          : [];
      });
      const review = { reviewerId: req.user!.userId, reviewedAt: new Date().toISOString(), note, findings };
      const root = path.resolve(process.env.OPENAI_REPORTS_DIR || path.join(process.cwd(), 'var', 'openai-reports'));
      const persisted = await persistBattingCoachReview(path.join(root, report.id), analysisRecord, artifacts, review);
      await prisma.openAiBattingReport.updateMany({
        where: { id: report.id, tenantId: req.user!.tenantId },
        data: {
          analysis: persisted.analysisRecord as Prisma.InputJsonValue,
          artifacts: persisted.artifacts as unknown as Prisma.InputJsonValue
        }
      });
      return res.json({ review, artifactNames: persisted.artifacts.map(item => item.name) });
    } catch (error) {
      console.error('OpenAI batting coach review save failed:', error);
      return res.status(500).json({ error: 'review_save_failed', message: 'The coach review could not be saved.' });
    }
  }
);

aiRouter.get(
  '/analyze/openai-batting/:reportId/artifacts/:name',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  async (req: AuthenticatedRequest, res: Response) => {
    const { reportId, name } = req.params;
    if (!isBattingReportArtifactName(name) || !/^[0-9a-f-]{36}$/i.test(reportId)) {
      return res.status(404).json({ error: 'artifact_not_found', message: 'The report artifact was not found.' });
    }
    try {
      const user = req.user!;
      const report = await prisma.openAiBattingReport.findFirst({
        where: { id: reportId, tenantId: user.tenantId },
        select: { id: true, artifacts: true }
      });
      const artifactMetadata = Array.isArray(report?.artifacts)
        ? report.artifacts.find((artifact): artifact is { name: string; mimeType: string } =>
            Boolean(artifact && typeof artifact === 'object' && 'name' in artifact && 'mimeType' in artifact &&
              (artifact as { name: unknown }).name === name))
        : undefined;
      if (!report || !artifactMetadata) {
        return res.status(404).json({ error: 'artifact_not_found', message: 'The report artifact was not found.' });
      }
      const root = path.resolve(process.env.OPENAI_REPORTS_DIR || path.join(process.cwd(), 'var', 'openai-reports'));
      const artifactPath = path.resolve(root, report.id, name);
      if (!artifactPath.startsWith(`${root}${path.sep}`)) {
        return res.status(404).json({ error: 'artifact_not_found', message: 'The report artifact was not found.' });
      }
      const data = await fs.readFile(artifactPath);
      res.setHeader('Content-Type', artifactMetadata.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.attachment(name);
      return res.send(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({ error: 'artifact_not_found', message: 'The report artifact was not found.' });
      }
      console.error('OpenAI batting report artifact download failed:', error);
      return res.status(500).json({ error: 'artifact_download_failed', message: 'The report artifact could not be downloaded.' });
    }
  }
);

// Fetch previously saved video analysis results (most recent first) for the authenticated user,
// optionally filtered to a specific player via ?playerId=.
aiRouter.get('/analyze/history', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  const playerId = req.query?.playerId as string | undefined;

  try {
    const history = await DbService.getVideoAnalyses({ userId, playerId });
    return res.json({ history });
  } catch (err: any) {
    console.error('Failed to fetch video analysis history:', err);
    return res.status(500).json({ error: 'Failed to fetch video analysis history.' });
  }
});

// Delete only an analysis owned by the authenticated user.
aiRouter.delete('/analyze/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId?: string };
    if (!decoded.userId) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  try {
    const deleted = await DbService.deleteVideoAnalysis(req.params.id, userId);
    if (!deleted) return res.status(404).json({ error: 'Analysis not found.' });
    return res.json({ status: 'OK' });
  } catch (err: any) {
    console.error('Failed to delete video analysis:', err);
    return res.status(500).json({ error: 'Failed to delete the analysis.' });
  }
});

// Fetch a single saved analysis result in full detail (for the detail view).
aiRouter.get('/analyze/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  try {
    const entry = await DbService.getVideoAnalysisById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }
    return res.json({ entry });
  } catch (err: any) {
    console.error('Failed to fetch video analysis:', err);
    return res.status(500).json({ error: 'Failed to fetch the analysis result.' });
  }
});

// Mark a saved analysis's recommended drill as adopted into the training catalogue.
aiRouter.post('/analyze/:id/adopt-drill', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  try {
    const updated = await DbService.markVideoAnalysisDrillAdopted(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }
    return res.json({ status: 'OK', drillAdopted: updated.drillAdopted });
  } catch (err: any) {
    console.error('Failed to mark drill as adopted:', err);
    return res.status(500).json({ error: 'Failed to update the analysis result.' });
  }
});
