import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Router, Request, Response, NextFunction } from 'express';
import { ZipArchive } from 'archiver';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';
import { capeQueuePosition, createCapeJob, stageCapeUpload } from '../queues/capeQueue.js';
import { CapeError, fetchContactCandidates, isCapeConfigured, type CapeManualFrames, type CapeRequest } from '../services/capeClient.js';
import { assignCapeGuidanceDrill, DrillAssignmentError, playerDrillAssignmentView } from '../services/playerDrillService.js';
import { downloadDriveFile, downloadDriveFileToPath, DriveUploadError } from './googleDrive.js';

export const capeJobsRouter = Router();

const TARGETS = ['batter', 'bowler'] as const;
const HANDEDNESS = ['right', 'left'] as const;
export const SHOT_TYPES = ['front_foot_drive', 'back_foot_drive', 'forward_defence', 'backward_defence', 'pull', 'cut', 'sweep'] as const;
export const BOWLER_TYPES = ['pace', 'spin'] as const;
const ZIP_NAME = 'all.zip';
const ARTIFACT_NAME = /^[1-3]_[a-z_]+\.jpg$/;

// Plain-language messages for CAPE / worker error codes, telling the coach how to re-film.
const FRIENDLY_ERRORS: Record<string, string> = {
  no_contact_detected: 'We could not see the bat hit the ball. Re-film side-on with the whole batter and the ball in frame, in good light, and keep the camera still.',
  no_pitching_point_detected: 'We could not see where the ball pitched. Re-film from behind the bowler or side-on so the whole pitch is visible, and keep the camera still.',
  calibration_invalid: 'The four crease corners did not line up. Tap the corners again in order: batter-end left, batter-end right, bowler-end right, bowler-end left.',
  calibration_out_of_frame: 'The crease corners must be inside the video frame. Tap all four corners again.',
  unreadable_video: 'The video could not be read. Record it again as MP4 or MOV and try once more.',
  empty_file: 'The video file was empty. Record it again and retry.',
  unsupported_media_type: 'This file type is not supported. Use an MP4, MOV, AVI, MKV or WebM video.',
  unsupported_video: 'This file type is not supported. Use an MP4, MOV, AVI, MKV or WebM video.',
  file_too_large: 'The video is too large. Trim it to the delivery and try again.',
  drive_error: 'The video could not be fetched from Google Drive. Please try again.',
  models_unavailable: 'The video analysis engine is starting up or unavailable. Please try again later.',
  cape_unreachable: 'The video analysis engine could not be reached. Please try again later.',
  drive_not_connected: 'Connect Google Drive to analyse videos stored there.',
  upload_missing: 'The uploaded video is no longer available. Please upload it again.',
  manual_frames_out_of_range: 'The selected frames are beyond the end of the video. Choose the frames again.',
  queue_unavailable: 'The analysis queue is unavailable right now. Please try again later.'
};

export function friendlyCapeError(code: string | null): string | null {
  if (!code) return null;
  return FRIENDLY_ERRORS[code] || 'The video could not be analysed. Please try again or film the delivery again.';
}

const isPoints = (value: unknown): value is [number, number][] =>
  Array.isArray(value) && value.length === 4 &&
  value.every(p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10_000));

function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

// Validates the spec §11.1 inputs (multipart fields arrive as strings; points as JSON).
export function parseCapeRequest(body: Record<string, unknown>): { request: CapeRequest } | { error: string } {
  const target = body.target;
  const handedness = body.handedness;
  if (!TARGETS.includes(target as never)) return { error: 'target must be "batter" or "bowler".' };
  if (!HANDEDNESS.includes(handedness as never)) return { error: 'handedness must be "right" or "left".' };
  const shotType = typeof body.shot_type === 'string' && body.shot_type ? body.shot_type : null;
  const bowlerType = typeof body.bowler_type === 'string' && body.bowler_type ? body.bowler_type : null;
  if (target === 'batter' && !SHOT_TYPES.includes(shotType as never)) return { error: `shot_type must be one of: ${SHOT_TYPES.join(', ')}.` };
  if (target === 'bowler' && !BOWLER_TYPES.includes(bowlerType as never)) return { error: `bowler_type must be one of: ${BOWLER_TYPES.join(', ')}.` };
  const calibration = parseJsonField(body.calibration_points);
  if (!isPoints(calibration)) return { error: 'calibration_points must be four [x, y] pixel points.' };
  const pitchRaw = body.pitch_points_m === undefined || body.pitch_points_m === '' ? null : parseJsonField(body.pitch_points_m);
  if (pitchRaw !== null && !isPoints(pitchRaw)) return { error: 'pitch_points_m must be four [x, y] points in metres.' };
  const manualRaw = body.manual_frames === undefined || body.manual_frames === null || body.manual_frames === '' ? null : parseJsonField(body.manual_frames);
  let manualFrames: CapeManualFrames | null = null;
  if (manualRaw !== null) {
    if (target !== 'batter') return { error: 'manual_frames is only allowed for batting analysis.' };
    const normalised = normaliseManualFrames(manualRaw);
    if (!normalised) {
      return { error: `manual_frames must give 1-${MAX_MANUAL_FRAMES_PER_ROLE} frame numbers per role, with every pre_contact frame before every point_of_contact frame and every point_of_contact frame before every post_contact frame.` };
    }
    manualFrames = normalised;
  }
  return {
    request: {
      target: target as CapeRequest['target'],
      handedness: handedness as CapeRequest['handedness'],
      shot_type: target === 'batter' ? shotType : null,
      bowler_type: target === 'bowler' ? bowlerType : null,
      calibration_points: calibration,
      pitch_points_m: pitchRaw as [number, number][] | null,
      ...(manualFrames ? { manual_frames: manualFrames } : {})
    }
  };
}

const isFrameIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000;

const MAX_MANUAL_FRAMES_PER_ROLE = 20;
const MANUAL_ROLES = ['pre_contact', 'point_of_contact', 'post_contact'] as const;

// Accepts a single frame or a list per role; returns sorted, de-duplicated lists in time order.
// Pre/post may be omitted or empty: CAPE then scans the frames around contact automatically.
function normaliseManualFrames(value: unknown): CapeManualFrames | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !(MANUAL_ROLES as readonly string[]).includes(key))) return null;
  const lists: number[][] = [];
  for (const role of MANUAL_ROLES) {
    const optional = role !== 'point_of_contact';
    const raw = Array.isArray(v[role]) ? v[role] as unknown[] : v[role] == null && optional ? [] : [v[role]];
    if ((raw.length === 0 && !optional) || raw.length > MAX_MANUAL_FRAMES_PER_ROLE || !raw.every(isFrameIndex)) return null;
    lists.push([...new Set(raw as number[])].sort((a, b) => a - b));
  }
  const [pre, contact, post] = lists;
  if (pre.length && pre[pre.length - 1] >= contact[0]) return null;
  if (post.length && contact[contact.length - 1] >= post[0]) return null;
  return { pre_contact: pre, point_of_contact: contact, post_contact: post };
}

type CapeJobRecord = NonNullable<Awaited<ReturnType<typeof prisma.capeJob.findFirst>>>;

export async function capeJobView(job: CapeJobRecord) {
  return {
    jobId: job.id,
    status: job.status,
    queuePosition: job.status === 'QUEUED' ? await capeQueuePosition(job.id).catch(() => null) : null,
    attempts: job.attempts,
    playerName: job.playerName,
    error: job.status === 'FAILED' ? job.error : null,
    errorMessage: job.status === 'FAILED' ? friendlyCapeError(job.error) : null,
    request: job.request,
    result: job.status === 'SUCCEEDED' ? job.result : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

// Tenant-scoped lookup; coaches see jobs they created or for assessments they run, players only their own.
async function findAccessibleJob(req: AuthenticatedRequest, jobId: string): Promise<CapeJobRecord | null> {
  const user = req.user!;
  const job = await prisma.capeJob.findFirst({ where: { id: jobId, tenantId: user.tenantId } });
  if (!job) return null;
  if (user.role === 'CLUB_ADMIN') return job;
  if (user.role === 'PLAYER') return job.playerId === user.userId ? job : null;
  if (job.createdById === user.userId) return job;
  if (job.assessmentId) {
    const assessment = await prisma.playerAssessment.findFirst({ where: { id: job.assessmentId, clubId: user.tenantId } });
    if (assessment?.coachId === user.userId) return job;
  }
  return null;
}

function fileStem(job: CapeJobRecord): string {
  const player = (job.playerName || 'player').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'player';
  return `${player}_${job.createdAt.toISOString().slice(0, 10)}`;
}

function storedArtifacts(job: CapeJobRecord): Record<string, string> {
  const value = job.artifacts;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

capeJobsRouter.use(authenticateToken, requireRole(['CLUB_ADMIN', 'COACH', 'PLAYER']));

// Same in-memory multipart pattern and 500 MB per-file limit as the other video upload routes.
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024, files: 1 } });
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;

async function isActiveClubCoach(req: AuthenticatedRequest): Promise<boolean> {
  const user = req.user!;
  if (user.role !== 'COACH') return true;
  if (user.coachContext !== 'CLUB') return false;
  const member = await prisma.clubMember.findFirst({
    where: { id: user.userId, clubId: user.tenantId, role: 'COACH', invitationStatus: 'ACTIVE' }
  });
  return Boolean(member);
}

// Latest standalone (not assessment-linked) job for a player and target, e.g. from the AI Video Analysis tab.
capeJobsRouter.get('/latest', requireRole(['CLUB_ADMIN', 'COACH']), async (req: AuthenticatedRequest, res: Response) => {
  const playerId = typeof req.query.playerId === 'string' ? req.query.playerId.slice(0, 100) : '';
  const target = req.query.target;
  if (!playerId || !TARGETS.includes(target as never)) {
    res.status(400).json({ error: 'playerId and target are required.' });
    return;
  }
  try {
    if (!(await isActiveClubCoach(req))) {
      res.status(403).json({ error: 'Active club coach membership required.' });
      return;
    }
    const user = req.user!;
    const job = await prisma.capeJob.findFirst({
      where: {
        tenantId: user.tenantId,
        playerId,
        assessmentId: null,
        request: { path: ['target'], equals: target as string },
        ...(user.role === 'COACH' ? { createdById: user.userId } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ job: job ? await capeJobView(job) : null });
  } catch (error) {
    console.error('CAPE latest job lookup failed:', error);
    res.status(500).json({ error: 'Unable to load the analysis.' });
  }
});

// Drills assigned to a player. Players see their own; club staff pass ?playerId= within their tenant.
capeJobsRouter.get('/assigned-drills', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const playerId = user.role === 'PLAYER'
    ? user.userId
    : typeof req.query.playerId === 'string' ? req.query.playerId.slice(0, 100) : '';
  if (!playerId) {
    res.status(400).json({ error: 'playerId is required.' });
    return;
  }
  try {
    if (!(await isActiveClubCoach(req))) {
      res.status(403).json({ error: 'Active club coach membership required.' });
      return;
    }
    const records = await prisma.playerDrillAssignment.findMany({
      where: { tenantId: user.tenantId, playerId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ assignments: records.map(playerDrillAssignmentView) });
  } catch (error) {
    console.error('Assigned drills lookup failed:', error);
    res.status(500).json({ error: 'Unable to load assigned drills.' });
  }
});

// Queues a standalone analysis for a club player from a device upload (multipart `file`) or a Drive video (`driveFileId`).
capeJobsRouter.post(
  '/',
  requireRole(['CLUB_ADMIN', 'COACH']),
  (req: Request, res: Response, next: NextFunction) => {
    videoUpload.single('file')(req, res, error => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Choose a video smaller than 500 MB.' });
      } else if (error) {
        res.status(400).json({ error: 'The video upload could not be read.' });
      } else {
        next();
      }
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    try {
      if (!(await isActiveClubCoach(req))) {
        res.status(403).json({ error: 'Active club coach membership required.' });
        return;
      }
      if (!isCapeConfigured()) {
        res.status(503).json({ error: 'cape_unavailable', message: 'Detailed video analysis is not available on this server right now.' });
        return;
      }
      const parsed = parseCapeRequest(req.body ?? {});
      if ('error' in parsed) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const playerId = typeof req.body?.playerId === 'string' ? req.body.playerId.trim().slice(0, 100) : '';
      const player = playerId
        ? await prisma.clubMember.findFirst({ where: { id: playerId, clubId: req.user!.tenantId, role: 'PLAYER', invitationStatus: 'ACTIVE' } })
        : null;
      if (!player) {
        res.status(404).json({ error: 'Player not found in your club.' });
        return;
      }
      const driveFileId = typeof req.body?.driveFileId === 'string' ? req.body.driveFileId.trim() : '';
      if (file && !/^video\/[A-Za-z0-9.+-]+$/.test(file.mimetype)) {
        res.status(400).json({ error: 'Only video files can be analysed.' });
        return;
      }
      if (!file && !DRIVE_FILE_ID.test(driveFileId)) {
        res.status(400).json({ error: 'Upload a video or choose one from Google Drive.' });
        return;
      }
      const uploadPath = file ? await stageCapeUpload(file.buffer, file.originalname) : null;
      let job;
      try {
        job = await createCapeJob({
          tenantId: req.user!.tenantId,
          createdById: req.user!.userId,
          request: parsed.request,
          playerId: player.id,
          playerName: player.name,
          driveFileId: uploadPath ? null : driveFileId,
          uploadPath
        });
      } catch (queueError) {
        console.error('CAPE job could not be queued:', queueError);
        if (uploadPath) await fs.rm(uploadPath, { force: true });
        res.status(503).json({ error: 'cape_unavailable', message: 'The analysis queue is unavailable right now. Please try again later.' });
        return;
      }
      res.status(202).json({ jobId: job.id, status: job.status });
    } catch (error) {
      console.error('CAPE job creation failed:', error);
      res.status(500).json({ error: 'The video could not be submitted for analysis.' });
    }
  }
);

const optionalInt = (value: unknown, max: number): number | undefined | null => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

// Synchronous helper for poor-quality clips: thumbnails around the suggested bat-ball contact so the
// coach can pick the pre-contact, contact and post-contact frames before queueing the analysis.
// Nothing is persisted; the staged video is deleted once CAPE responds.
capeJobsRouter.post(
  '/contact-candidates',
  requireRole(['CLUB_ADMIN', 'COACH']),
  (req: Request, res: Response, next: NextFunction) => {
    videoUpload.single('file')(req, res, error => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Choose a video smaller than 500 MB.' });
      } else if (error) {
        res.status(400).json({ error: 'The video upload could not be read.' });
      } else {
        next();
      }
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    let stagedPath: string | null = null;
    try {
      if (!(await isActiveClubCoach(req))) {
        res.status(403).json({ error: 'Active club coach membership required.' });
        return;
      }
      if (!isCapeConfigured()) {
        res.status(503).json({ error: 'cape_unavailable', message: 'Detailed video analysis is not available on this server right now.' });
        return;
      }
      const centerFrame = optionalInt(req.body?.centerFrame, 1_000_000);
      const before = optionalInt(req.body?.before, 40);
      const after = optionalInt(req.body?.after, 40);
      if (centerFrame === null || before === null || after === null) {
        res.status(400).json({ error: 'centerFrame, before and after must be non-negative whole numbers.' });
        return;
      }
      const driveFileId = typeof req.body?.driveFileId === 'string' ? req.body.driveFileId.trim() : '';
      if (file && !/^video\/[A-Za-z0-9.+-]+$/.test(file.mimetype)) {
        res.status(400).json({ error: 'Only video files can be analysed.' });
        return;
      }
      if (!file && !DRIVE_FILE_ID.test(driveFileId)) {
        res.status(400).json({ error: 'Upload a video or choose one from Google Drive.' });
        return;
      }
      if (file) {
        stagedPath = await stageCapeUpload(file.buffer, file.originalname);
      } else {
        stagedPath = path.join(os.tmpdir(), `cape-candidates-${crypto.randomUUID()}.mp4`);
        await downloadDriveFileToPath(req.user!.userId, driveFileId, stagedPath);
      }
      const candidates = await fetchContactCandidates(stagedPath, { centerFrame, before, after });
      res.json(candidates);
    } catch (error) {
      if (error instanceof DriveUploadError) {
        res.status(error.status).json({ error: error.message });
      } else if (error instanceof CapeError) {
        console.error('CAPE contact candidates failed:', error.code, error.message);
        res.status(error.status >= 400 && error.status < 500 ? 422 : 502).json({
          error: error.code,
          message: friendlyCapeError(error.code) || 'The video frames could not be loaded. Please try again.'
        });
      } else {
        console.error('CAPE contact candidates failed:', error);
        res.status(500).json({ error: 'The video frames could not be loaded.' });
      }
    } finally {
      if (stagedPath) await fs.rm(stagedPath, { force: true }).catch(() => undefined);
    }
  }
);

capeJobsRouter.get('/:jobId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await findAccessibleJob(req, req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }
    res.json({ job: await capeJobView(job) });
  } catch (error) {
    console.error('CAPE job lookup failed:', error);
    res.status(500).json({ error: 'Unable to load the analysis.' });
  }
});

capeJobsRouter.get('/:jobId/drills', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await findAccessibleJob(req, req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }
    const records = await prisma.playerDrillAssignment.findMany({
      where: { tenantId: job.tenantId, capeJobId: job.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ assignments: records.map(playerDrillAssignmentView) });
  } catch (error) {
    console.error('CAPE drill assignments lookup failed:', error);
    res.status(500).json({ error: 'Unable to load assigned drills.' });
  }
});

// Assigns a coaching-guidance drill to the analysed player and adds it to the club and system drill catalogues.
capeJobsRouter.post('/:jobId/drills', requireRole(['CLUB_ADMIN', 'COACH']), async (req: AuthenticatedRequest, res: Response) => {
  const faultCode = typeof req.body?.faultCode === 'string' ? req.body.faultCode.trim().slice(0, 100) : '';
  if (!faultCode) {
    res.status(400).json({ error: 'faultCode is required.' });
    return;
  }
  try {
    if (!(await isActiveClubCoach(req))) {
      res.status(403).json({ error: 'Active club coach membership required.' });
      return;
    }
    const job = await findAccessibleJob(req, req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }
    const { assignment, created } = await assignCapeGuidanceDrill(job, faultCode, req.user!.userId);
    res.status(created ? 201 : 200).json({ assignment });
  } catch (error) {
    if (error instanceof DrillAssignmentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('CAPE drill assignment failed:', error);
    res.status(500).json({ error: 'Unable to assign the drill.' });
  }
});

capeJobsRouter.get('/:jobId/artifacts/:name', async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.params;
  if (name !== ZIP_NAME && !ARTIFACT_NAME.test(name)) {
    res.status(404).json({ error: 'Image not found.' });
    return;
  }
  try {
    const job = await findAccessibleJob(req, req.params.jobId);
    const artifacts = job ? storedArtifacts(job) : {};
    if (!job || job.status !== 'SUCCEEDED' || Object.keys(artifacts).length === 0) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    const stem = fileStem(job);

    if (name === ZIP_NAME) {
      // Fetch everything first so a Drive failure becomes a clean error instead of a truncated ZIP.
      const files = await Promise.all(Object.entries(artifacts).map(async ([file, id]) => [file, await downloadDriveFile(job.createdById, id)] as const));
      res.attachment(`${stem}_analysis.zip`);
      const archive = new ZipArchive({ store: true });
      archive.on('error', (err: Error) => {
        console.error('CAPE ZIP stream failed:', err);
        res.destroy(err);
      });
      archive.pipe(res);
      for (const [file, buffer] of files) archive.append(buffer, { name: `${stem}_${file}` });
      await archive.finalize();
      return;
    }

    const driveId = artifacts[name];
    if (!driveId) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    const buffer = await downloadDriveFile(job.createdById, driveId);
    res.attachment(`${stem}_${name}`);
    res.type('image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (error) {
    if (res.headersSent) return;
    if (error instanceof DriveUploadError) {
      res.status(error.status === 409 ? 409 : 502).json({ error: error.status === 409 ? 'Google Drive is no longer connected for the coach who ran this analysis.' : 'The image could not be fetched from Google Drive.' });
      return;
    }
    console.error('CAPE artifact download failed:', error);
    res.status(500).json({ error: 'Unable to download the image.' });
  }
});
