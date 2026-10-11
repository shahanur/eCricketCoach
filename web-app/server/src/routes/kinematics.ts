import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { downloadVideoFromDrive } from './googleDrive.js';
import { GeminiVideoAnalysisService } from '../services/geminiVideoAnalysisService.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const aihubUrl = () => (process.env.AI_HUB_URL || 'http://localhost:8100').replace(/\/$/, '');
const disciplines = new Set(['BATTING', 'BOWLING', 'KEEPING', 'FIELDING']);

async function requestAihub(video: Buffer, mimeType: string, filename: string, discipline: string, timestampMs: number, forceTimestamp: boolean) {
  const body = new FormData();
  body.append('file', new Blob([new Uint8Array(video)], { type: mimeType }), filename);
  body.append('discipline', discipline);
  body.append('timestamp_ms', String(timestampMs));
  body.append('force_timestamp', String(forceTimestamp));
  const response = await fetch(`${aihubUrl()}/v1/kinematics/analyze`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(180_000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result.detail === 'string' ? result.detail : 'AIHub could not analyze this video.';
    throw Object.assign(new Error(message), { statusCode: response.status });
  }
  return result;
}

export const kinematicsRouter = Router();

kinematicsRouter.post('/analyze', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  const authenticated = req as AuthenticatedRequest;
  const discipline = String(req.body?.discipline || 'BATTING').toUpperCase();
  const driveFileId = typeof req.body?.driveFileId === 'string' ? req.body.driveFileId : '';
  const timestampMs = Number.isFinite(Number(req.body?.timestampMs)) ? Math.max(0, Number(req.body.timestampMs)) : 0;
  if (!disciplines.has(discipline)) {
    res.status(400).json({ error: 'Discipline is required (BATTING, BOWLING, KEEPING, FIELDING).' });
    return;
  }
  if (!req.file && !driveFileId) {
    res.status(400).json({ error: 'Upload a video file or provide a Google Drive file ID.' });
    return;
  }

  try {
    let video: Buffer;
    let mimeType: string;
    let filename: string;
    if (req.file) {
      video = req.file.buffer;
      mimeType = req.file.mimetype || 'video/mp4';
      filename = req.file.originalname || 'training-video.mp4';
    } else {
      const downloaded = await downloadVideoFromDrive(authenticated.user!.userId, driveFileId);
      video = downloaded.buffer;
      mimeType = downloaded.mimeType;
      filename = `drive-${driveFileId}.mp4`;
    }

    let result = await requestAihub(video, mimeType, filename, discipline, timestampMs, false);
    let cricketInterpretation = null;
    let cricketInterpretationError: string | null = null;
    try {
      cricketInterpretation = await GeminiVideoAnalysisService.analyzeCricketKinematics(
        video,
        mimeType,
        discipline as 'BATTING' | 'BOWLING' | 'KEEPING' | 'FIELDING',
        result.metrics || {}
      );
    } catch (interpretationError) {
      console.error('Cricket kinematics interpretation error:', interpretationError);
      cricketInterpretationError = 'Cricket-specific interpretation was unavailable; the pose overlay is still available.';
    }

    const interpretation = cricketInterpretation;
    const contactTimestamp = interpretation?.contactTimestampMs;
    if (interpretation && typeof contactTimestamp === 'number' && interpretation.contactConfidence >= 0.55) {
      try {
        result = await requestAihub(video, mimeType, filename, discipline, Math.max(0, contactTimestamp), true);
      } catch (renderError) {
        console.error('Contact-frame AIHub render error:', renderError);
        cricketInterpretationError = 'The cricket contact timestamp was found, but the exact overlay frame could not be rendered.';
      }
    }

    res.json({
      ...result,
      sourceType: req.file ? 'LOCAL_UPLOAD' : 'GOOGLE_DRIVE',
      driveFileId: driveFileId || null,
      cricketInterpretation,
      cricketInterpretationError
    });
  } catch (error) {
    console.error('Kinematics AIHub error:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Kinematic overlay analysis failed.' });
  }
});
