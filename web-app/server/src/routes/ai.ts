import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { GeminiVideoAnalysisService } from '../services/geminiVideoAnalysisService.js';
import { getValidAccessToken } from './googleDrive.js';
import { DbService } from '../services/dbService.js';
import { fetchWithRetry } from '../utils/retry.js';

export const aiRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

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

