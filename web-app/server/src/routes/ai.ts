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
import { analyzeBattingVideoWithOpenAI, OpenAiBattingAnalysisError } from '../services/openAiBattingAnalysisService.js';
import { createAndPersistBattingReport, isBattingReportArtifactName } from '../services/openAiBattingReportArtifacts.js';

export const aiRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;

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

// OpenAI-assisted batting review using timestamped sampled frames and a focused contact window.
aiRouter.post(
  '/analyze/openai-batting',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, error => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'file_too_large', message: 'Choose a video smaller than 500 MB.' });
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
    const rawContactTimestamp = req.body?.contactTimestampSeconds;
    const contactTimestampSeconds = rawContactTimestamp === undefined || rawContactTimestamp === ''
      ? undefined
      : typeof rawContactTimestamp === 'number' || typeof rawContactTimestamp === 'string'
        ? Number(rawContactTimestamp)
        : Number.NaN;

    if (contactTimestampSeconds !== undefined && (!Number.isFinite(contactTimestampSeconds) || contactTimestampSeconds < 0)) {
      return res.status(400).json({ error: 'invalid_contact_timestamp', message: 'The selected contact time must be a valid non-negative number of seconds.' });
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

      let videoBuffer: Buffer;
      if (file) {
        videoBuffer = file.buffer;
      } else {
        const driveAccess = await getValidAccessToken(user.userId);
        if (!driveAccess) return res.status(404).json({ error: 'drive_not_connected', message: 'Google Drive is not connected for this account.' });
        const download = await fetchWithRetry(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(driveFileId)}?alt=media`, {
          headers: { Authorization: `Bearer ${driveAccess.accessToken}` }
        }, { label: 'Google Drive video download for OpenAI analysis' });
        if (!download.ok) return res.status(download.status).json({ error: 'drive_download_failed', message: 'The selected Drive video could not be downloaded.' });
        const contentLength = Number(download.headers.get('content-length') || 0);
        if (contentLength > 500 * 1024 * 1024) return res.status(413).json({ error: 'file_too_large', message: 'Choose a video smaller than 500 MB.' });
        videoBuffer = Buffer.from(await download.arrayBuffer());
        if (videoBuffer.length > 500 * 1024 * 1024) return res.status(413).json({ error: 'file_too_large', message: 'Choose a video smaller than 500 MB.' });
      }

      const analysis = await analyzeBattingVideoWithOpenAI(videoBuffer, { contactTimestampSeconds });
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
            sourceSha256: analysis.sourceSha256,
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
      return res.json({
        status: 'COMPLETED',
        discipline: 'BATTING',
        playerId: playerId || null,
        playerName,
        reportId: storedReport.id,
        artifactNames: storedReport.artifacts.map(artifact => artifact.name),
        analysis
      });
    } catch (error) {
      if (error instanceof OpenAiBattingAnalysisError) {
        return res.status(error.status).json({ error: error.code, message: error.message });
      }
      console.error('OpenAI batting video analysis failed:', error);
      return res.status(502).json({ error: 'openai_analysis_failed', message: 'The batting video could not be analysed. Please try again.' });
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

