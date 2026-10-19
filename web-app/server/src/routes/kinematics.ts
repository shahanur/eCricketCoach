import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { downloadVideoFromDrive } from './googleDrive.js';
import { GeminiVideoAnalysisService } from '../services/geminiVideoAnalysisService.js';
import { prisma } from '../config/prisma.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const aihubUrl = () => (process.env.AI_HUB_URL || 'http://localhost:8100').replace(/\/$/, '');
const poseOverlayUrl = () => (process.env.POSE_OVERLAY_API_URL || 'http://pose-overlay-api:8200').replace(/\/$/, '');
// Stay under nginx's 300 s proxy_read_timeout so the client gets a JSON error instead of a gateway timeout.
const aihubTimeoutMs = () => Number(process.env.AI_HUB_TIMEOUT_MS) || 280_000;
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
    signal: AbortSignal.timeout(aihubTimeoutMs())
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result.detail === 'string' ? result.detail : 'AIHub could not analyze this video.';
    throw Object.assign(new Error(message), { statusCode: response.status });
  }
  return result;
}

export const kinematicsRouter = Router();

kinematicsRouter.post(
  '/analyze-image',
  authenticateToken,
  requireRole(['CLUB_ADMIN', 'COACH']),
  imageUpload.single('image'),
  async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const image = (req as Request & { file?: Express.Multer.File }).file;
    const handedness = req.body?.handedness;
    if (user.role === 'COACH') {
      if (user.coachContext !== 'CLUB') {
        res.status(403).json({ error: 'club_coach_required', message: 'An active club coach account is required.' });
        return;
      }
      const coach = await prisma.clubMember.findFirst({
        where: { id: user.userId, clubId: user.tenantId, role: 'COACH', invitationStatus: 'ACTIVE' }
      });
      if (!coach) {
        res.status(403).json({ error: 'club_coach_required', message: 'An active club coach account is required.' });
        return;
      }
    }
    if (!image) {
      res.status(400).json({ error: 'image_required', message: 'Upload the cropped contact image.' });
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(image.mimetype)) {
      res.status(415).json({ error: 'unsupported_image', message: 'Upload a JPEG, PNG, or WebP image.' });
      return;
    }
    if (handedness !== 'right' && handedness !== 'left') {
      res.status(400).json({ error: 'invalid_handedness', message: 'Choose right- or left-handed batting.' });
      return;
    }

    try {
      const body = new FormData();
      body.append('image', new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), image.originalname || 'contact-crop.jpg');
      body.append('handedness', handedness);
      const headers: Record<string, string> = {};
      if (process.env.POSE_OVERLAY_API_KEY) headers['X-API-Key'] = process.env.POSE_OVERLAY_API_KEY;
      const response = await fetch(`${poseOverlayUrl()}/v1/pose-overlay`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(Number(process.env.POSE_OVERLAY_TIMEOUT_MS) || 90_000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof result.detail === 'string' ? result.detail : 'The pose overlay service could not analyse this crop.';
        res.status(response.status).json({ error: 'pose_overlay_failed', message });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error('Cropped pose overlay request failed:', error);
      res.status(502).json({ error: 'pose_overlay_unavailable', message: 'The cropped image pose service is unavailable.' });
    }
  }
);

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
