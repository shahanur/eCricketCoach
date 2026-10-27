import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { CapeRequest } from '../services/capeClient.js';

export const CAPE_QUEUE_NAME = 'cape-analysis';

// Job data is only the CapeJob id; video bytes never go through Redis.
export interface CapeQueueData {
  capeJobId: string;
}

export function redisConnection(): Redis {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
}

// Must be a directory shared by the API and the worker (a volume when they run as separate containers).
export function capeUploadDir(): string {
  return process.env.CAPE_UPLOAD_DIR || path.join(os.tmpdir(), 'cape-uploads');
}

let queue: Queue<CapeQueueData> | null = null;

export function capeQueue(): Queue<CapeQueueData> {
  queue ??= new Queue<CapeQueueData>(CAPE_QUEUE_NAME, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 }
    }
  });
  return queue;
}

export async function enqueueCapeJob(capeJobId: string): Promise<void> {
  await capeQueue().add('analyze', { capeJobId }, { jobId: capeJobId });
}

// Writes an in-memory upload (multer memoryStorage, up to 500 MB) to the shared upload dir so the
// request buffer can be released before the job runs. Peak memory per upload is still the full
// file size while multer holds it; this only stops it lingering for the life of the job.
export async function stageCapeUpload(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = /^\.(mp4|mov|avi|mkv|webm)$/.test(ext) ? ext : '.mp4';
  const dir = capeUploadDir();
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${crypto.randomUUID()}${safeExt}`);
  await fs.writeFile(dest, buffer);
  return dest;
}

export interface NewCapeJob {
  tenantId: string;
  createdById: string;
  request: CapeRequest;
  playerId?: string | null;
  playerName?: string | null;
  assessmentId?: string | null;
  driveFileId?: string | null;
  uploadPath?: string | null;
}

export async function createCapeJob(input: NewCapeJob) {
  if (!input.driveFileId && !input.uploadPath) {
    throw new Error('A CAPE job needs either a Drive file or a staged upload.');
  }
  const job = await prisma.capeJob.create({
    data: { ...input, request: input.request as unknown as Prisma.InputJsonValue }
  });
  try {
    await enqueueCapeJob(job.id);
  } catch (err) {
    await prisma.capeJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: 'queue_unavailable' } });
    if (input.uploadPath) await fs.rm(input.uploadPath, { force: true });
    throw err;
  }
  return job;
}

// 1-based position among waiting jobs (next to run = 1), or null if the job is not waiting.
export async function capeQueuePosition(capeJobId: string): Promise<number | null> {
  const waiting = await capeQueue().getJobs(['waiting'], 0, 500, true);
  const index = waiting.findIndex(job => job.id === capeJobId);
  return index < 0 ? null : index + 1;
}
