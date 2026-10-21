import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeWithCape } from './capeClient.js';

export interface OpenAiCapeKinetics {
  status: 'not_requested' | 'available' | 'partial' | 'unavailable';
  source: 'cape' | null;
  contactFrame: number | null;
  contactSelectionSource: 'gemini' | 'detector' | 'manual' | null;
  message: string | null;
  metrics: {
    incomingBallSpeedKmh: number | null;
    incomingMomentumKgMps: number | null;
    incomingKineticEnergyJ: number | null;
    exitSpeedKmh: number | null;
    exitMomentumKgMps: number | null;
    exitKineticEnergyJ: number | null;
    launchAngleDegrees: number | null;
    batSwingSpeedKmh: number | null;
    batSwingArcDegrees: number | null;
    followThroughArcDegrees: number | null;
  };
  limitations: string[];
}

export interface OpenAiCapeKineticsInput {
  video: Buffer;
  filename: string;
  mimeType: string;
  calibrationPoints: [number, number][];
  contactFrame?: number;
  handedness: 'right' | 'left';
  shotType: 'front_foot_drive' | 'forward_defence';
}

const EMPTY_METRICS: OpenAiCapeKinetics['metrics'] = {
  incomingBallSpeedKmh: null,
  incomingMomentumKgMps: null,
  incomingKineticEnergyJ: null,
  exitSpeedKmh: null,
  exitMomentumKgMps: null,
  exitKineticEnergyJ: null,
  launchAngleDegrees: null,
  batSwingSpeedKmh: null,
  batSwingArcDegrees: null,
  followThroughArcDegrees: null
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function emptyOpenAiCapeKinetics(
  status: OpenAiCapeKinetics['status'],
  message: string | null = null,
  contactFrame: number | null = null,
  contactSelectionSource: OpenAiCapeKinetics['contactSelectionSource'] = null
): OpenAiCapeKinetics {
  return { status, source: null, contactFrame, contactSelectionSource, message, metrics: { ...EMPTY_METRICS }, limitations: [] };
}

export function mapCapeKineticsResponse(payload: unknown, fallbackContactFrame: number | null = null): OpenAiCapeKinetics {
  const root = record(payload);
  const analytics = record(root.analytics_payload);
  const pre = record(analytics.pre_contact);
  const contact = record(analytics.point_of_contact);
  const post = record(analytics.post_contact);
  const actualContactFrame = metric(contact.milestone_frame);
  const selectionSource = contact.selection_source;
  const metrics: OpenAiCapeKinetics['metrics'] = {
    incomingBallSpeedKmh: metric(contact.ball_velocity_kmh),
    incomingMomentumKgMps: metric(contact.estimated_ball_momentum_kg_m_s),
    incomingKineticEnergyJ: metric(contact.estimated_ball_kinetic_energy_j),
    exitSpeedKmh: metric(post.exit_velocity_kmh),
    exitMomentumKgMps: metric(post.estimated_ball_momentum_kg_m_s),
    exitKineticEnergyJ: metric(post.estimated_ball_kinetic_energy_j),
    launchAngleDegrees: metric(post.launch_angle_degrees),
    batSwingSpeedKmh: metric(pre.bat_swing_speed_kmh),
    batSwingArcDegrees: metric(pre.bat_swing_arc_degrees),
    followThroughArcDegrees: metric(post.follow_through_arc_degrees)
  };
  const hasAny = Object.values(metrics).some(value => value !== null);
  const hasBallDynamics = [metrics.incomingBallSpeedKmh, metrics.exitSpeedKmh, metrics.launchAngleDegrees].some(value => value !== null);
  return {
    status: !hasAny ? 'unavailable' : hasAny && !hasBallDynamics ? 'partial' : 'available',
    source: 'cape',
    contactFrame: actualContactFrame === null ? fallbackContactFrame : actualContactFrame,
    contactSelectionSource: selectionSource === 'gemini' || selectionSource === 'manual' || selectionSource === 'detector' ? selectionSource : null,
    message: hasAny ? null : 'CAPE did not detect enough ball or bat motion to estimate video kinetics.',
    metrics,
    limitations: [
      'CAPE estimates these values from video detections; they are not radar measurements.',
      'Ball speed, momentum, energy and launch angle depend on the supplied four-point pitch calibration.',
      'Bat swing speed uses CAPE’s assumed standard bat length and is an estimate.'
    ]
  };
}

export async function analyzeVideoKineticsWithCape(input: OpenAiCapeKineticsInput): Promise<OpenAiCapeKinetics> {
  const contactFrame = input.contactFrame ?? null;
  if (!process.env.CAPE_API_URL) {
    return emptyOpenAiCapeKinetics('unavailable', 'CAPE_API_URL is not configured on the server.', contactFrame);
  }
  const ext = path.extname(input.filename).toLowerCase();
  const safeExt = ['.mp4', '.mov', '.m4v', '.avi', '.mkv'].includes(ext) ? ext : '.mp4';
  let workDir: string | null = null;
  try {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecco-openai-cape-'));
    const videoPath = path.join(workDir, `input${safeExt}`);
    await fs.writeFile(videoPath, input.video, { flag: 'wx' });
    const timeoutValue = Number(process.env.OPENAI_CAPE_TIMEOUT_MS);
    const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue >= 30_000 && timeoutValue <= 600_000 ? timeoutValue : 180_000;
    const capeRequest = {
      target: 'batter',
      handedness: input.handedness,
      shot_type: input.shotType,
      calibration_points: input.calibrationPoints
    } as const;
    const response = await analyzeWithCape(videoPath, input.contactFrame === undefined ? capeRequest : {
      ...capeRequest,
      manual_frames: { pre_contact: [], point_of_contact: [input.contactFrame], post_contact: [] }
    }, timeoutMs);
    return mapCapeKineticsResponse(response, contactFrame);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('CAPE video kinetics were unavailable for OpenAI batting analysis:', message);
    return emptyOpenAiCapeKinetics('unavailable', message, contactFrame);
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
