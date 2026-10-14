import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

// Inputs of spec §11.1, forwarded to CAPE unchanged.
export interface CapeRequest {
  target: 'batter' | 'bowler';
  handedness: 'right' | 'left';
  shot_type?: string | null;
  bowler_type?: string | null;
  calibration_points: [number, number][];
  pitch_points_m?: [number, number][] | null;
}

export interface CapeResponse {
  status: 'success';
  session_id: string;
  metadata: Record<string, unknown>;
  analytics_payload: Record<string, unknown>;
  delivery: Record<string, unknown> | null;
  coaching: {
    score: number;
    verdict: string;
    faults: CapeFault[];
    strengths: string[];
    unavailable: string[];
    summary?: string | null;
    ai_guidance?: CapeAiGuidance | null;
  };
  download_endpoints: Record<string, string | null>;
}

export interface CapeFault {
  code: string;
  milestone: string;
  metric: string;
  value: number;
  expected: [number | null, number | null];
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendation: string;
  drill?: string | null;
}

export interface CapeAiGuidance {
  source: 'gemini';
  summary: string;
  items: Array<{
    fault_code: string;
    title: string;
    why_it_matters: string;
    coaching_cues: string[];
    drill: {
      name: string;
      instructions: string[];
      equipment: string[];
    };
  }>;
}

export class CapeError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable: boolean) {
    super(message);
    this.name = 'CapeError';
  }
}

const VIDEO_TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.webm': 'video/webm' };

export function isCapeConfigured(): boolean {
  return Boolean(process.env.CAPE_API_URL);
}

function capeUrl(pathname: string): string {
  const base = process.env.CAPE_API_URL;
  if (!base) throw new CapeError(503, 'cape_unavailable', 'CAPE_API_URL is not configured.', false);
  return `${base.replace(/\/+$/, '')}${pathname}`;
}

function headers(): Record<string, string> {
  return process.env.CAPE_API_KEY ? { 'X-API-Key': process.env.CAPE_API_KEY } : {};
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(Number(process.env.CAPE_TIMEOUT_MS) || 600_000);
}

async function toCapeError(res: Response): Promise<CapeError> {
  let code = `http_${res.status}`;
  let message = `CAPE responded with ${res.status}.`;
  try {
    const body = await res.json() as { error?: string; message?: string };
    code = body.error || code;
    message = body.message || message;
  } catch {
    // Non-JSON error body; keep the defaults.
  }
  return new CapeError(res.status, code, message, res.status >= 500);
}

function networkError(err: unknown): CapeError {
  const message = err instanceof Error ? err.message : String(err);
  return new CapeError(0, 'cape_unreachable', `CAPE request failed: ${message}`, true);
}

// Streams the video from disk as multipart (fs.openAsBlob reads lazily, so the file is never fully buffered).
export async function analyzeWithCape(videoPath: string, request: CapeRequest): Promise<CapeResponse> {
  const ext = path.extname(videoPath).toLowerCase();
  const form = new FormData();
  form.set('file', await fs.openAsBlob(videoPath, { type: VIDEO_TYPES[ext] || 'video/mp4' }), `clip${ext || '.mp4'}`);
  form.set('target', request.target);
  form.set('handedness', request.handedness);
  form.set('calibration_points', JSON.stringify(request.calibration_points));
  if (request.shot_type) form.set('shot_type', request.shot_type);
  if (request.bowler_type) form.set('bowler_type', request.bowler_type);
  if (request.pitch_points_m) form.set('pitch_points_m', JSON.stringify(request.pitch_points_m));

  let res: Response;
  try {
    res = await fetch(capeUrl('/api/v1/analyze-cricket-video'), { method: 'POST', headers: headers(), body: form, signal: timeoutSignal() });
  } catch (err) {
    throw networkError(err);
  }
  if (!res.ok) throw await toCapeError(res);
  return await res.json() as CapeResponse;
}

export async function downloadCapeArtifact(sessionId: string, name: string, destPath: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^[\w.-]+$/.test(name)) {
    throw new CapeError(400, 'invalid_artifact', 'Invalid CAPE artifact reference.', false);
  }
  let res: Response;
  try {
    res = await fetch(capeUrl(`/api/v1/artifacts/${sessionId}/${name}`), { headers: headers(), signal: timeoutSignal() });
  } catch (err) {
    throw networkError(err);
  }
  if (!res.ok || !res.body) throw await toCapeError(res);
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(destPath));
}
