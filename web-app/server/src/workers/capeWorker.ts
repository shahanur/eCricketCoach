import 'dotenv/config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { CAPE_QUEUE_NAME, CapeQueueData, redisConnection } from '../queues/capeQueue.js';
import { analyzeWithCape, CapeError, CapeRequest, CapeResponse, downloadCapeArtifact } from '../services/capeClient.js';
import { downloadDriveFileToPath, DriveUploadError, resolveDriveFolder, uploadFileToDriveFolder } from '../routes/googleDrive.js';
import { GeminiVideoAnalysisService } from '../services/geminiVideoAnalysisService.js';

const EXT_BY_MIME: Record<string, string> = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/x-msvideo': '.avi', 'video/x-matroska': '.mkv', 'video/webm': '.webm' };
const ZIP_NAME = 'all.zip';

class JobFailure extends Error {
  constructor(public code: string, message: string, public retryable: boolean) {
    super(message);
  }
}

function toFailure(err: unknown): JobFailure {
  if (err instanceof JobFailure) return err;
  if (err instanceof CapeError) return new JobFailure(err.code, err.message, err.retryable);
  if (err instanceof DriveUploadError) {
    const retryable = err.status >= 500 || err.status === 429;
    return new JobFailure(err.status === 409 ? 'drive_not_connected' : 'drive_error', err.message, retryable);
  }
  return new JobFailure('internal_error', err instanceof Error ? err.message : String(err), true);
}

export function capeArtifactRoute(capeJobId: string, name: string): string {
  return `/api/club/cape-jobs/${capeJobId}/artifacts/${encodeURIComponent(name)}`;
}

async function resolveVideo(job: { id: string; createdById: string; driveFileId: string | null; uploadPath: string | null }, workDir: string): Promise<string> {
  if (job.uploadPath) {
    try {
      await fs.access(job.uploadPath);
    } catch {
      throw new JobFailure('upload_missing', 'The uploaded video is no longer available. Please upload it again.', false);
    }
    return job.uploadPath;
  }
  if (!job.driveFileId) throw new JobFailure('no_video', 'The job has no video source.', false);
  const raw = path.join(workDir, 'video');
  const { mimeType } = await downloadDriveFileToPath(job.createdById, job.driveFileId, raw);
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) throw new JobFailure('unsupported_video', 'The selected Google Drive file is not a supported video.', false);
  const dest = raw + ext;
  await fs.rename(raw, dest);
  return dest;
}

// Copies CAPE's images to the user's Drive before CAPE's TTL sweeps them. Returns { fileName: driveFileId }.
async function storeArtifacts(job: { id: string; createdById: string; playerName: string | null }, request: CapeRequest, response: CapeResponse, workDir: string): Promise<Record<string, string>> {
  const names = Object.values(response.download_endpoints)
    .filter((url): url is string => Boolean(url))
    .map(url => url.split('/').pop()!)
    .filter(name => name !== ZIP_NAME);
  if (names.length === 0) return {};

  const discipline = request.target === 'bowler' ? 'BOWLING' : 'BATTING';
  const folderName = `CAPE analysis ${new Date().toISOString().slice(0, 10)} ${job.id.slice(0, 8)}`;
  let folderId: string;
  try {
    folderId = await resolveDriveFolder(job.createdById, job.playerName || 'Unassigned player', discipline, folderName);
  } catch (err) {
    if (err instanceof DriveUploadError && err.status === 409) {
      console.warn(`CAPE job ${job.id}: Google Drive not connected; analysis images will not be kept.`);
      return {};
    }
    throw err;
  }

  const stored: Record<string, string> = {};
  for (const name of names) {
    const local = path.join(workDir, name);
    await downloadCapeArtifact(response.session_id, name, local);
    stored[name] = await uploadFileToDriveFolder(job.createdById, folderId, {
      buffer: await fs.readFile(local),
      mimeType: 'image/jpeg',
      fileName: name,
      description: 'eCricketCoach CAPE analysis image'
    });
  }
  return stored;
}

function rewriteDownloads(capeJobId: string, endpoints: Record<string, string | null>, stored: Record<string, string>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, url] of Object.entries(endpoints)) {
    const name = url?.split('/').pop();
    if (name === ZIP_NAME) out[key] = Object.keys(stored).length ? capeArtifactRoute(capeJobId, ZIP_NAME) : null;
    else out[key] = name && stored[name] ? capeArtifactRoute(capeJobId, name) : null;
  }
  return out;
}

// Optional plain-language summary. Gemini only rephrases CAPE's findings; any number it
// introduces that is not in the input causes the summary to be dropped.
async function geminiSummary(response: CapeResponse): Promise<string | null> {
  if (process.env.CAPE_GEMINI_SUMMARY !== 'true' || !GeminiVideoAnalysisService.isConfigured()) return null;
  const facts = JSON.stringify({ coaching: { ...response.coaching, summary: undefined }, delivery: response.delivery });
  const prompt = [
    'You are a cricket coach. Summarise the analysis below for the player in 2-3 short sentences.',
    'Use ONLY the faults, strengths and numbers given. Do not add new faults, causes or numbers.',
    'Reply as JSON: {"summary": "..."}',
    facts
  ].join('\n');
  try {
    const data = await GeminiVideoAnalysisService.generateJson(
      [prompt],
      (d: any): d is { summary: string } => typeof d?.summary === 'string' && d.summary.trim().length > 0,
      'CAPE coaching summary'
    );
    const allowed = new Set(facts.match(/\d+(?:\.\d+)?/g) || []);
    const invented = (data.summary.match(/\d+(?:\.\d+)?/g) || []).some(n => !allowed.has(n));
    return invented ? null : data.summary.trim();
  } catch (err) {
    console.warn('CAPE Gemini summary skipped:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function processCapeJob(job: Job<CapeQueueData>): Promise<void> {
  const { capeJobId } = job.data;
  const record = await prisma.capeJob.findUnique({ where: { id: capeJobId } });
  if (!record) throw new UnrecoverableError(`CapeJob ${capeJobId} not found`);

  const attempt = job.attemptsMade + 1;
  const isLastAttempt = attempt >= (job.opts.attempts ?? 1);
  await prisma.capeJob.update({ where: { id: capeJobId }, data: { status: 'RUNNING', attempts: attempt, error: null } });

  const workDir = path.join(os.tmpdir(), 'cape', capeJobId);
  await fs.mkdir(workDir, { recursive: true });
  let final = false;
  try {
    const request = record.request as unknown as CapeRequest;
    const videoPath = await resolveVideo(record, workDir);
    const response = await analyzeWithCape(videoPath, request);
    const stored = await storeArtifacts(record, request, response, workDir);
    const summary = await geminiSummary(response);
    const result = {
      ...response,
      coaching: { ...response.coaching, summary: summary ?? response.coaching.summary ?? null },
      download_endpoints: rewriteDownloads(capeJobId, response.download_endpoints, stored)
    };
    await prisma.capeJob.update({
      where: { id: capeJobId },
      data: { status: 'SUCCEEDED', result: result as unknown as Prisma.InputJsonValue, artifacts: stored, error: null }
    });
    final = true;
  } catch (err) {
    const failure = toFailure(err);
    final = !failure.retryable || isLastAttempt;
    await prisma.capeJob.update({
      where: { id: capeJobId },
      data: { status: final ? 'FAILED' : 'QUEUED', error: failure.code }
    });
    console.error(`CAPE job ${capeJobId} attempt ${attempt} failed (${failure.code}): ${failure.message}`);
    throw failure.retryable ? failure : new UnrecoverableError(failure.code);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
    if (final && record.uploadPath) await fs.rm(record.uploadPath, { force: true });
  }
}

export function startCapeWorker(): Worker<CapeQueueData> {
  const worker = new Worker<CapeQueueData>(CAPE_QUEUE_NAME, processCapeJob, {
    connection: redisConnection(),
    concurrency: Number(process.env.CAPE_CONCURRENCY) || 1
  });
  worker.on('error', err => console.error('CAPE worker error:', err));
  console.log(`CAPE worker listening on "${CAPE_QUEUE_NAME}" (concurrency ${worker.opts.concurrency})`);
  return worker;
}

export function closeWorkerOnSignals(worker: Worker): void {
  const shutdown = async (signal: string) => {
    console.log(`CAPE worker: ${signal} received, finishing active jobs...`);
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

// Standalone entry point: `npm run worker` (separate container).
if (require.main === module) {
  closeWorkerOnSignals(startCapeWorker());
}
