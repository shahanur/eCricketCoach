import 'dotenv/config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { CAPE_QUEUE_NAME, CapeQueueData, redisConnection } from '../queues/capeQueue.js';
import { analyzeWithCape, CapeAiGuidance, CapeError, CapeRequest, CapeResponse, downloadCapeArtifact } from '../services/capeClient.js';
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

export interface GeminiRequestAudit {
  label: string;
  requestedAt: string;
  durationMs: number;
  model: string | null;
  status: 'SUCCEEDED' | 'FAILED';
  error: string | null;
  prompt: string;
  facts: Record<string, unknown>;
}

// Gemini personalizes corrections for CAPE's deterministic findings. It cannot alter
// measurements, severity, score, or introduce additional faults.
export async function geminiCoachingGuidance(
  response: CapeResponse,
  capeJobId = 'unknown'
): Promise<{ guidance: CapeAiGuidance | null; audit: GeminiRequestAudit | null }> {
  if (process.env.CAPE_GEMINI_SUMMARY !== 'true' || !GeminiVideoAnalysisService.isConfigured()) return { guidance: null, audit: null };
  if (response.coaching.faults.length === 0) return { guidance: null, audit: null };
  const label = 'CAPE Gemini coaching guidance';
  const factsObj = {
    metadata: response.metadata,
    score: response.coaching.score,
    verdict: response.coaching.verdict,
    faults: response.coaching.faults,
    strengths: response.coaching.strengths
  };
  const facts = JSON.stringify(factsObj);
  const expectedCodes = response.coaching.faults.map(fault => fault.code);
  const prompt = [
    'You are an elite cricket skills coach receiving verified CAPE measurements and deterministic findings.',
    'Do not reassess the video, change a measurement, change severity, change the score, or add/remove a finding.',
    'For EACH supplied fault, provide practical correction cues and one safe, specific drill suitable for a training session.',
    'Do not introduce any new numeric measurements. Use concise language that a player and coach can apply immediately.',
    'Return ONLY JSON in this exact shape:',
    '{"summary":"brief overall coaching priority","items":[{"fault_code":"exact supplied fault code","title":"short correction title","why_it_matters":"cricket consequence grounded only in the supplied finding","coaching_cues":["cue"],"drill":{"name":"drill name","instructions":["step"],"equipment":["item"]}}]}',
    facts
  ].join('\n');
  const requestedAt = new Date();
  const audit = (status: GeminiRequestAudit['status'], model: string | null, error: string | null): GeminiRequestAudit => ({
    label, requestedAt: requestedAt.toISOString(), durationMs: Date.now() - requestedAt.getTime(),
    model, status, error, prompt, facts: factsObj
  });
  console.log(`${label} for CAPE job ${capeJobId}: sending ${expectedCodes.length} fault(s) [${expectedCodes.join(', ')}]; facts=${facts}`);
  try {
    const { data, model } = await GeminiVideoAnalysisService.generateJsonDetailed(
      [prompt],
      (d: any): d is Omit<CapeAiGuidance, 'source' | 'model'> => {
        if (typeof d?.summary !== 'string' || !Array.isArray(d?.items) || d.items.length !== expectedCodes.length) return false;
        const returnedCodes = d.items.map((item: any) => item?.fault_code);
        if (new Set(returnedCodes).size !== expectedCodes.length || expectedCodes.some(code => !returnedCodes.includes(code))) return false;
        return d.items.every((item: any) =>
          typeof item.title === 'string' &&
          typeof item.why_it_matters === 'string' &&
          Array.isArray(item.coaching_cues) &&
          item.coaching_cues.length > 0 &&
          item.coaching_cues.every((cue: unknown) => typeof cue === 'string') &&
          typeof item.drill?.name === 'string' &&
          Array.isArray(item.drill?.instructions) &&
          item.drill.instructions.length > 0 &&
          item.drill.instructions.every((step: unknown) => typeof step === 'string') &&
          Array.isArray(item.drill?.equipment) &&
          item.drill.equipment.every((equipment: unknown) => typeof equipment === 'string')
        );
      },
      label,
      { jsonMode: true }
    );
    console.log(`${label} for CAPE job ${capeJobId} succeeded (model ${model}, ${Date.now() - requestedAt.getTime()}ms)`);
    return {
      guidance: { source: 'gemini', model, summary: data.summary.trim(), items: data.items },
      audit: audit('SUCCEEDED', model, null)
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`${label} for CAPE job ${capeJobId} skipped:`, message);
    return { guidance: null, audit: audit('FAILED', null, message) };
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
    const { guidance: aiGuidance, audit: geminiAudit } = await geminiCoachingGuidance(response, capeJobId);
    const result = {
      ...response,
      coaching: {
        ...response.coaching,
        summary: aiGuidance?.summary ?? response.coaching.summary ?? null,
        ai_guidance: aiGuidance
      },
      download_endpoints: rewriteDownloads(capeJobId, response.download_endpoints, stored)
    };
    await prisma.capeJob.update({
      where: { id: capeJobId },
      data: {
        status: 'SUCCEEDED',
        result: result as unknown as Prisma.InputJsonValue,
        artifacts: stored,
        error: null,
        geminiRequest: geminiAudit ? (geminiAudit as unknown as Prisma.InputJsonValue) : Prisma.DbNull
      }
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
