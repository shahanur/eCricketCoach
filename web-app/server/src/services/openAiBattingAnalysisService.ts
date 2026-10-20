import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import OpenAI from 'openai';
import {
  EstimatedLandmarks,
  NormalizedBox,
  NormalizedPoint,
  SequencePhase,
  VisualFrame,
  makeJointAlignmentSvg,
  makeMovementSequenceSvg,
  svgDataUrl
} from './openAiBattingVisuals.js';

const execFileAsync = promisify(execFile);
const MAX_VIDEO_DURATION_SECONDS = 180;
const MAX_OVERVIEW_FRAMES = 36;
const MAX_DETAIL_FRAMES = 36;
const OVERVIEW_FPS = 4;
const CONTACT_WINDOW_SECONDS = 0.7;
const MAX_FRAME_DIMENSION = 960;
const OPENAI_TIMEOUT_MS = 120_000;
const PROMPT_VERSION = 'batting-v1';
const SCHEMA_VERSION = 'batting-v1';
const runningFromBuild = /(^|[\\/])dist([\\/]|$)/.test(process.argv[1] || '');
const INPUT_ASSET_DIRS = [
  path.resolve(process.cwd(), runningFromBuild ? 'dist/services/openai_inputs' : 'src/services/openai_inputs'),
  path.resolve(process.cwd(), runningFromBuild ? 'src/services/openai_inputs' : 'dist/services/openai_inputs')
];

type Confidence = 'low' | 'moderate' | 'high';
type ContactStatus = 'DETECTED' | 'LIKELY' | 'UNCERTAIN' | 'NOT_VISIBLE';

interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  presentationTimestampsSeconds: number[];
}

interface SampledFrame extends VisualFrame {
  sampleIndex: number;
  imagePath: string;
}

interface Observation {
  title: string;
  observation: string;
  coachingImplication: string;
  frameIndices: number[];
  confidence: Confidence;
}

interface OverviewAnalysis {
  contactCandidateSampleIndex: number | null;
  contactCandidateConfidence: number;
  contactCandidateEvidence: string;
  summary: string;
  observations: Observation[];
  phases: Array<{ phase: string; sampleIndex: number | null; evidence: string; playerBoxNorm: NormalizedBox | null }>;
  limitations: string[];
  shotCandidates: Array<{ shotId: string; sampleIndex: number; shotType: string | null; confidence: number; evidence: string }>;
}

interface DetailedObservation extends Observation {
  alternativeExplanation: string;
}

interface DetailedShotAssessment {
  shotType: string | null;
  confidence: number;
  evidence: string;
}

interface FootageQuality {
  cameraView: 'front_on' | 'side_on' | 'three_quarter' | 'unknown';
  blur: 'low' | 'moderate' | 'high' | 'unknown';
  occlusions: string[];
  timingLimitations: string[];
  cameraMotion: 'stable' | 'moving' | 'unknown';
}

interface DetailedAnalysis {
  contactStatus: ContactStatus;
  contactSampleIndex: number | null;
  contactConfidence: number;
  contactEvidence: string;
  contactWindowStartSeconds: number | null;
  contactWindowEndSeconds: number | null;
  contactPointNorm: NormalizedPoint | null;
  playerBoxNorm: NormalizedBox | null;
  landmarksNorm: EstimatedLandmarks;
  landmarksByFrame: Array<{
    frameIndex: number;
    phase: 'preparation' | 'foot_plant' | 'downswing' | 'contact' | 'extension' | 'finish';
    confidence: number;
    landmarksNorm: EstimatedLandmarks;
  }>;
  batHandleNorm: NormalizedPoint | null;
  batToeNorm: NormalizedPoint | null;
  summary: string;
  observations: DetailedObservation[];
  errors: DetailedObservation[];
  shotIdentification: DetailedShotAssessment;
  status: 'assessable' | 'partially_assessable' | 'unassessable';
  footageQuality: FootageQuality;
  strengths: string[];
  priorityCue: string;
  drill: { title: string; instructions: string[]; rationale: string };
  limitations: string[];
  additionalEvidence: string[];
}

interface ShotAssessment {
  shotId: string;
  shotType: string | null;
  timestampSeconds: number;
  status: DetailedAnalysis['status'];
  contactStatus: ContactStatus;
  confidence: number;
  summary: string;
  observations: DetailedObservation[];
  errors: DetailedObservation[];
  strengths: string[];
  limitations: string[];
  jointAngles: JointAngleRecord[];
}

interface JointAngleRecord {
  joint: 'elbow' | 'knee' | 'hip' | 'shoulder';
  side: 'left' | 'right';
  angleDegrees: number | null;
  frameIndex: number;
  timestampSeconds: number;
  phase: string;
  confidence: number;
  source: 'openai_visual_estimate';
  calculation: 'image_plane_angle_from_normalized_landmarks';
  status: 'calculated' | 'unassessable';
  limitations: string[];
}

interface VisionCallMetadata {
  responseId: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

interface VisionCallResult<T> {
  value: T;
  metadata: VisionCallMetadata;
}

interface FrameManifestEntry {
  frameId: string;
  shotId: string | null;
  sourceFrameIndex: number;
  timestampSeconds: number;
  width: number;
  height: number;
  coordinateSpace: 'orientation_corrected_supplied_image';
  detail: 'overview' | 'contact';
}

export interface OpenAiBattingAnalysis {
  provider: 'openai';
  model: string;
  promptVersion: string;
  schemaVersion: string;
  sourceSha256: string;
  video: Omit<VideoMetadata, 'presentationTimestampsSeconds'> & { sampledOverviewFrames: number };
  frameManifest: FrameManifestEntry[];
  shotCandidates: OverviewAnalysis['shotCandidates'];
  shotAssessments: ShotAssessment[];
  jointAngles: JointAngleRecord[];
  executionLog: {
    stages: string[];
    toolVersions: { node: string; ffmpeg: string; ffprobe: string };
    modelRequested: string;
    modelReturned: string;
    responseIds: string[];
    usage: { inputTokens: number; outputTokens: number } | null;
  };
  contact: {
    status: ContactStatus;
    selectionSource: 'AI' | 'MANUAL';
    selectedTimestampSeconds: number | null;
    frameIndex: number | null;
    timestampSeconds: number | null;
    confidence: number;
    evidence: string;
    imageDataUrl: string | null;
    pointNorm: NormalizedPoint | null;
  };
  croppedContactImageDataUrl: string | null;
  contactLandmarksNorm: EstimatedLandmarks;
  batHandleNorm: NormalizedPoint | null;
  batToeNorm: NormalizedPoint | null;
  croppedContactLandmarksNorm: Record<string, NormalizedPoint | null>;
  croppedContactPointNorm: NormalizedPoint | null;
  poseSequenceFrames: Array<{
    frameIndex: number;
    timestampSeconds: number;
    phase: 'PRE_CONTACT' | 'CONTACT' | 'POST_CONTACT';
    imageDataUrl: string;
  }>;
  visualOutputs: {
    movementSequenceImageDataUrl: string;
    jointAlignmentImageDataUrl: string;
  };
  phases: Array<{ phase: string; frameIndex: number | null; timestampSeconds: number | null; evidence: string }>;
  summary: string;
  status: DetailedAnalysis['status'];
  shotIdentification: DetailedShotAssessment;
  footageQuality: FootageQuality;
  contactWindow: { startSeconds: number | null; endSeconds: number | null };
  observations: DetailedObservation[];
  errors: DetailedObservation[];
  strengths: string[];
  priorityCue: string;
  drill: DetailedAnalysis['drill'];
  limitations: string[];
  additionalEvidence: string[];
}

export class OpenAiBattingAnalysisError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'OpenAiBattingAnalysisError';
  }
}

export interface OpenAiBattingAnalysisOptions {
  contactTimestampSeconds?: number;
}

function fraction(value: string | undefined): number {
  if (!value) return 0;
  const [numerator, denominator] = value.split('/').map(Number);
  return denominator ? numerator / denominator : numerator;
}

async function readInputAsset(name: string): Promise<string> {
  for (const directory of INPUT_ASSET_DIRS) {
    try {
      return await fs.readFile(path.join(directory, name), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`OpenAI prompt/schema asset ${name} was not found.`);
}

async function loadPromptAsset(name: string): Promise<string> {
  return (await readInputAsset(name)).trim();
}

async function loadSchemaAsset(name: string): Promise<Record<string, unknown>> {
  const raw = await readInputAsset(name);
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`OpenAI schema asset ${name} must contain a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } {
  let offset = 2;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    if (startOfFrame.has(marker)) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  throw new OpenAiBattingAnalysisError(422, 'sample_frame_invalid', 'An extracted video frame could not be read.');
}

function nearestPresentationFrame(timestamps: number[], target: number): { index: number; timestamp: number } | null {
  if (!timestamps.length) return null;
  let low = 0;
  let high = timestamps.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (timestamps[mid] < target) low = mid + 1;
    else high = mid;
  }
  const later = low;
  const earlier = Math.max(0, later - 1);
  const index = Math.abs(timestamps[earlier] - target) <= Math.abs(timestamps[later] - target) ? earlier : later;
  return { index, timestamp: timestamps[index] };
}

async function runBinary(binary: string, args: string[], timeout: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync(binary, args, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    });
    return stdout;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new OpenAiBattingAnalysisError(503, 'video_decoder_unavailable', 'FFmpeg is required for video analysis but was not found on the server.');
    }
    const stderr = (error as { stderr?: string }).stderr;
    throw new OpenAiBattingAnalysisError(
      422,
      'video_decode_failed',
      stderr?.toString().trim().slice(-500) || 'The uploaded video could not be decoded.'
    );
  }
}

async function binaryVersion(binary: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(binary, ['-version'], {
      encoding: 'utf8', timeout: 5_000, maxBuffer: 1024 * 1024, windowsHide: true
    });
    return stdout.split(/\r?\n/, 1)[0].trim();
  } catch {
    return 'unavailable';
  }
}

async function probeVideo(videoPath: string): Promise<VideoMetadata> {
  const raw = await runBinary('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_frames',
    '-show_entries', 'stream=width,height,avg_frame_rate,r_frame_rate:format=duration:frame=best_effort_timestamp_time',
    '-of', 'json', videoPath
  ], 20_000);
  let probe: {
    streams?: Array<Record<string, unknown>>;
    format?: { duration?: string };
    frames?: Array<{ best_effort_timestamp_time?: string }>;
  };
  try {
    probe = JSON.parse(raw);
  } catch {
    throw new OpenAiBattingAnalysisError(422, 'video_probe_failed', 'Video metadata could not be read.');
  }
  const stream = probe.streams?.[0];
  const durationSeconds = Number(probe.format?.duration);
  const fps = fraction(String(stream?.avg_frame_rate || stream?.r_frame_rate || '0'));
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  if (![durationSeconds, fps, width, height].every(Number.isFinite) || durationSeconds <= 0 || width <= 0 || height <= 0) {
    throw new OpenAiBattingAnalysisError(422, 'invalid_video_metadata', 'The uploaded file has no readable video stream.');
  }
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw new OpenAiBattingAnalysisError(413, 'video_too_long', `OpenAI batting analysis supports videos up to ${MAX_VIDEO_DURATION_SECONDS} seconds.`);
  }
  const presentationTimestampsSeconds = (probe.frames || [])
    .map(frame => Number(frame.best_effort_timestamp_time))
    .filter(Number.isFinite);
  return { durationSeconds, width, height, fps: fps > 0 ? fps : 30, presentationTimestampsSeconds };
}

async function sampleFrames(
  videoPath: string,
  directory: string,
  options: {
    startSeconds: number;
    durationSeconds: number;
    fps: number;
    maxFrames: number;
    prefix: string;
    dimension: number;
    presentationTimestampsSeconds: number[];
  }
): Promise<SampledFrame[]> {
  const outputPattern = path.join(directory, `${options.prefix}-%03d.jpg`);
  const filter = `fps=${options.fps.toFixed(4)},scale=${options.dimension}:${options.dimension}:force_original_aspect_ratio=decrease`;
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', options.startSeconds.toFixed(3), '-i', videoPath,
    '-t', options.durationSeconds.toFixed(3),
    '-vf', filter,
    '-frames:v', String(options.maxFrames),
    '-q:v', '3', outputPattern
  ];
  await runBinary('ffmpeg', args, 60_000);
  const files = (await fs.readdir(directory))
    .filter(name => name.startsWith(`${options.prefix}-`) && name.endsWith('.jpg'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const frames: SampledFrame[] = [];
  for (const [sampleIndex, name] of files.entries()) {
    const bytes = await fs.readFile(path.join(directory, name));
    const expectedTimestamp = Math.min(options.startSeconds + sampleIndex / options.fps, options.startSeconds + options.durationSeconds);
    const pts = nearestPresentationFrame(options.presentationTimestampsSeconds, expectedTimestamp);
    const dimensions = jpegDimensions(bytes);
    frames.push({
      sampleIndex,
      frameIndex: pts?.index ?? Math.round(expectedTimestamp * options.fps),
      timestampSeconds: pts?.timestamp ?? expectedTimestamp,
      width: dimensions.width,
      height: dimensions.height,
      imageDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
      imagePath: path.join(directory, name),
      playerBoxNorm: null
    });
  }
  if (!frames.length) throw new OpenAiBattingAnalysisError(422, 'video_frames_unavailable', 'No video frames could be extracted.');
  return frames;
}

async function createContactPlayerCrop(
  frame: SampledFrame,
  playerBox: NormalizedBox | null,
  directory: string
): Promise<{ imageDataUrl: string; bounds: { left: number; top: number; width: number; height: number } } | null> {
  if (!playerBox) return null;
  const { width, height } = frame;
  const boxLeft = playerBox.left * width;
  const boxTop = playerBox.top * height;
  const boxWidth = (playerBox.right - playerBox.left) * width;
  const boxHeight = (playerBox.bottom - playerBox.top) * height;
  const paddingX = Math.max(16, Math.round(boxWidth * 0.16));
  const paddingY = Math.max(16, Math.round(boxHeight * 0.1));
  const left = Math.max(0, Math.floor(boxLeft - paddingX));
  const top = Math.max(0, Math.floor(boxTop - paddingY));
  const right = Math.min(width, Math.ceil(boxLeft + boxWidth + paddingX));
  const bottom = Math.min(height, Math.ceil(boxTop + boxHeight + paddingY));
  const cropWidth = Math.max(2, right - left);
  const cropHeight = Math.max(2, bottom - top);
  const outputPath = path.join(directory, 'contact-player-crop.jpg');
  await runBinary('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', frame.imagePath,
    '-vf', `crop=${cropWidth}:${cropHeight}:${left}:${top},scale=960:960:force_original_aspect_ratio=decrease:flags=lanczos`,
    '-frames:v', '1', '-q:v', '2', outputPath
  ], 20_000);
  const bytes = await fs.readFile(outputPath);
  return {
    imageDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
    bounds: { left, top, width: cropWidth, height: cropHeight }
  };
}

function normalizeLandmarksInCrop(
  landmarks: EstimatedLandmarks,
  frame: SampledFrame,
  bounds: { left: number; top: number; width: number; height: number }
): Record<string, NormalizedPoint | null> {
  const targetNames: Record<string, string> = {
    head: 'head', leftShoulder: 'left_shoulder', rightShoulder: 'right_shoulder',
    leftElbow: 'left_elbow', rightElbow: 'right_elbow', leftWrist: 'left_wrist',
    rightWrist: 'right_wrist', leftHip: 'left_hip', rightHip: 'right_hip',
    leftKnee: 'left_knee', rightKnee: 'right_knee', leftAnkle: 'left_ankle',
    rightAnkle: 'right_ankle', frontToe: 'front_toe'
  };
  const normalized: Record<string, NormalizedPoint | null> = {};
  for (const [sourceName, targetName] of Object.entries(targetNames)) {
    const point = landmarks[sourceName as keyof EstimatedLandmarks];
    if (!point) {
      normalized[targetName] = null;
      continue;
    }
    const x = (point.x * frame.width - bounds.left) / bounds.width;
    const y = (point.y * frame.height - bounds.top) / bounds.height;
    normalized[targetName] = x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
  }
  return normalized;
}

function isConfidence(value: unknown): value is Confidence {
  return value === 'low' || value === 'moderate' || value === 'high';
}

function isObservation(value: unknown): value is Observation {
  if (!value || typeof value !== 'object') return false;
  const item = value as unknown as Record<string, unknown>;
  return typeof item.title === 'string' && typeof item.observation === 'string' &&
    typeof item.coachingImplication === 'string' && Array.isArray(item.frameIndices) &&
    item.frameIndices.every(index => Number.isInteger(index)) && isConfidence(item.confidence);
}

function isDetailedObservation(value: unknown, allowedFrames: Set<number>): value is DetailedObservation {
  if (!isObservation(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  return typeof item.alternativeExplanation === 'string' && Array.isArray(item.frameIndices) &&
    item.frameIndices.every(index => Number.isInteger(index) && allowedFrames.has(Number(index)));
}

function isNormalizedPoint(value: unknown): value is NormalizedPoint | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return typeof point.x === 'number' && point.x >= 0 && point.x <= 1 &&
    typeof point.y === 'number' && point.y >= 0 && point.y <= 1;
}

function isNormalizedBox(value: unknown): value is NormalizedBox | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const box = value as Record<string, unknown>;
  return typeof box.left === 'number' && typeof box.top === 'number' &&
    typeof box.right === 'number' && typeof box.bottom === 'number' &&
    box.left >= 0 && box.top >= 0 && box.right <= 1 && box.bottom <= 1 &&
    box.right > box.left && box.bottom > box.top;
}

const LANDMARK_NAMES = [
  'head', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
  'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee',
  'rightKnee', 'leftAnkle', 'rightAnkle', 'frontToe'
] as const;

function isEstimatedLandmarks(value: unknown): value is EstimatedLandmarks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const points = value as Record<string, unknown>;
  return LANDMARK_NAMES.every(name => name in points && isNormalizedPoint(points[name]));
}

function isOverview(value: unknown, frames: SampledFrame[]): value is OverviewAnalysis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const frameCount = frames.length;
  const allowedFrames = new Set(frames.map(frame => frame.frameIndex));
  const index = item.contactCandidateSampleIndex;
  const phases = item.phases;
  const limitations = item.limitations;
  return (index === null || (Number.isInteger(index) && Number(index) >= 0 && Number(index) < frameCount)) &&
    typeof item.contactCandidateConfidence === 'number' && item.contactCandidateConfidence >= 0 && item.contactCandidateConfidence <= 1 &&
    typeof item.contactCandidateEvidence === 'string' && typeof item.summary === 'string' &&
    Array.isArray(item.observations) && item.observations.every(observation => isObservation(observation) && observation.frameIndices.every(frameIndex => allowedFrames.has(frameIndex))) &&
    Array.isArray(phases) && phases.every(phase => Boolean(
      phase && typeof phase === 'object' && typeof (phase as Record<string, unknown>).phase === 'string' &&
      ((phase as Record<string, unknown>).sampleIndex === null || (
        Number.isInteger((phase as Record<string, unknown>).sampleIndex) &&
        Number((phase as Record<string, unknown>).sampleIndex) >= 0 &&
        Number((phase as Record<string, unknown>).sampleIndex) < frameCount
      )) && typeof (phase as Record<string, unknown>).evidence === 'string' &&
      isNormalizedBox((phase as Record<string, unknown>).playerBoxNorm)
    )) && Array.isArray(limitations) && limitations.every(entry => typeof entry === 'string') &&
    Array.isArray(item.shotCandidates) && item.shotCandidates.length <= 3 && item.shotCandidates.every(candidate => {
      if (!candidate || typeof candidate !== 'object') return false;
      const shot = candidate as Record<string, unknown>;
      return typeof shot.shotId === 'string' && shot.shotId.length > 0 &&
        Number.isInteger(shot.sampleIndex) && Number(shot.sampleIndex) >= 0 && Number(shot.sampleIndex) < frameCount &&
        (shot.shotType === null || typeof shot.shotType === 'string') &&
        typeof shot.confidence === 'number' && shot.confidence >= 0 && shot.confidence <= 1 &&
        typeof shot.evidence === 'string';
    });
}

function isDetailed(value: unknown, frames: SampledFrame[], durationSeconds: number): value is DetailedAnalysis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const index = item.contactSampleIndex;
  const statuses: ContactStatus[] = ['DETECTED', 'LIKELY', 'UNCERTAIN', 'NOT_VISIBLE'];
  const drill = item.drill as Record<string, unknown> | undefined;
  const shotIdentification = item.shotIdentification as Record<string, unknown> | undefined;
  const footageQuality = item.footageQuality as Record<string, unknown> | undefined;
  const allowedFrames = new Set(frames.map(frame => frame.frameIndex));
  const contactWindowStartSeconds = item.contactWindowStartSeconds;
  const contactWindowEndSeconds = item.contactWindowEndSeconds;
  const status = item.status;
  const shotConfidence = shotIdentification?.confidence;
  return statuses.includes(item.contactStatus as ContactStatus) &&
    (item.contactStatus !== 'DETECTED' || index !== null) &&
    (index === null || (Number.isInteger(index) && Number(index) >= 0 && Number(index) < frames.length)) &&
    typeof item.contactConfidence === 'number' && item.contactConfidence >= 0 && item.contactConfidence <= 1 &&
    typeof item.contactEvidence === 'string' && typeof item.summary === 'string' &&
    isNormalizedPoint(item.contactPointNorm) && isNormalizedBox(item.playerBoxNorm) &&
    isEstimatedLandmarks(item.landmarksNorm) && isNormalizedPoint(item.batHandleNorm) && isNormalizedPoint(item.batToeNorm) &&
    Array.isArray(item.landmarksByFrame) && item.landmarksByFrame.length <= 6 && item.landmarksByFrame.every(entry => {
      if (!entry || typeof entry !== 'object') return false;
      const frameLandmarks = entry as Record<string, unknown>;
      return Number.isInteger(frameLandmarks.frameIndex) && allowedFrames.has(Number(frameLandmarks.frameIndex)) &&
        ['preparation', 'foot_plant', 'downswing', 'contact', 'extension', 'finish'].includes(String(frameLandmarks.phase)) &&
        typeof frameLandmarks.confidence === 'number' && frameLandmarks.confidence >= 0 && frameLandmarks.confidence <= 1 &&
        isEstimatedLandmarks(frameLandmarks.landmarksNorm);
    }) &&
    Array.isArray(item.observations) && item.observations.every(entry => isDetailedObservation(entry, allowedFrames)) &&
    Array.isArray(item.errors) && item.errors.length <= 3 && item.errors.every(entry => isDetailedObservation(entry, allowedFrames)) &&
    Array.isArray(item.strengths) && item.strengths.every(value => typeof value === 'string') &&
    typeof item.priorityCue === 'string' && drill !== undefined && typeof drill.title === 'string' &&
    Array.isArray(drill.instructions) && drill.instructions.every(value => typeof value === 'string') &&
    typeof drill.rationale === 'string' && Array.isArray(item.limitations) && item.limitations.every(value => typeof value === 'string') &&
    Array.isArray(item.additionalEvidence) && item.additionalEvidence.every(value => typeof value === 'string') &&
    typeof status === 'string' && ['assessable', 'partially_assessable', 'unassessable'].includes(status) &&
    shotIdentification !== undefined && (shotIdentification.shotType === null || typeof shotIdentification.shotType === 'string') &&
    typeof shotConfidence === 'number' && shotConfidence >= 0 && shotConfidence <= 1 && typeof shotIdentification.evidence === 'string' &&
    footageQuality !== undefined && ['front_on', 'side_on', 'three_quarter', 'unknown'].includes(String(footageQuality.cameraView)) &&
    ['low', 'moderate', 'high', 'unknown'].includes(String(footageQuality.blur)) &&
    ['stable', 'moving', 'unknown'].includes(String(footageQuality.cameraMotion)) &&
    Array.isArray(footageQuality.occlusions) && footageQuality.occlusions.every(value => typeof value === 'string') &&
    Array.isArray(footageQuality.timingLimitations) && footageQuality.timingLimitations.every(value => typeof value === 'string') &&
    (contactWindowStartSeconds === null || (typeof contactWindowStartSeconds === 'number' && Number.isFinite(contactWindowStartSeconds) && contactWindowStartSeconds >= 0 && contactWindowStartSeconds <= durationSeconds)) &&
    (contactWindowEndSeconds === null || (typeof contactWindowEndSeconds === 'number' && Number.isFinite(contactWindowEndSeconds) && contactWindowEndSeconds >= 0 && contactWindowEndSeconds <= durationSeconds)) &&
    (contactWindowStartSeconds === null || contactWindowEndSeconds === null || contactWindowStartSeconds <= contactWindowEndSeconds);
}

export function calculateProjectedAngle(
  a: NormalizedPoint | null | undefined,
  vertex: NormalizedPoint | null | undefined,
  c: NormalizedPoint | null | undefined,
  width: number,
  height: number
): number | null {
  if (!a || !vertex || !c) return null;
  const ax = (a.x - vertex.x) * width;
  const ay = (a.y - vertex.y) * height;
  const cx = (c.x - vertex.x) * width;
  const cy = (c.y - vertex.y) * height;
  const aLength = Math.hypot(ax, ay);
  const cLength = Math.hypot(cx, cy);
  if (aLength === 0 || cLength === 0) return null;
  const cosine = Math.max(-1, Math.min(1, (ax * cx + ay * cy) / (aLength * cLength)));
  return Math.round(Math.acos(cosine) * 18000 / Math.PI) / 100;
}

function calculateJointAngles(
  landmarksByFrame: DetailedAnalysis['landmarksByFrame'],
  frames: SampledFrame[]
): JointAngleRecord[] {
  const framesBySourceIndex = new Map(frames.map(frame => [frame.frameIndex, frame]));
  const definitions: Array<{ joint: JointAngleRecord['joint']; side: JointAngleRecord['side']; a: keyof EstimatedLandmarks; vertex: keyof EstimatedLandmarks; c: keyof EstimatedLandmarks }> = [
    { joint: 'elbow', side: 'left', a: 'leftShoulder', vertex: 'leftElbow', c: 'leftWrist' },
    { joint: 'elbow', side: 'right', a: 'rightShoulder', vertex: 'rightElbow', c: 'rightWrist' },
    { joint: 'knee', side: 'left', a: 'leftHip', vertex: 'leftKnee', c: 'leftAnkle' },
    { joint: 'knee', side: 'right', a: 'rightHip', vertex: 'rightKnee', c: 'rightAnkle' },
    { joint: 'hip', side: 'left', a: 'leftShoulder', vertex: 'leftHip', c: 'leftKnee' },
    { joint: 'hip', side: 'right', a: 'rightShoulder', vertex: 'rightHip', c: 'rightKnee' },
    { joint: 'shoulder', side: 'left', a: 'leftElbow', vertex: 'leftShoulder', c: 'leftHip' },
    { joint: 'shoulder', side: 'right', a: 'rightElbow', vertex: 'rightShoulder', c: 'rightHip' }
  ];
  return landmarksByFrame.flatMap(phaseEntry => {
    const frame = framesBySourceIndex.get(phaseEntry.frameIndex);
    if (!frame) return [];
    return definitions.map(definition => {
      const angleDegrees = calculateProjectedAngle(
        phaseEntry.landmarksNorm[definition.a], phaseEntry.landmarksNorm[definition.vertex],
        phaseEntry.landmarksNorm[definition.c], frame.width, frame.height
      );
      return {
        joint: definition.joint,
        side: definition.side,
        angleDegrees,
        frameIndex: frame.frameIndex,
        timestampSeconds: frame.timestampSeconds,
        phase: phaseEntry.phase,
        confidence: phaseEntry.confidence,
        source: 'openai_visual_estimate',
        calculation: 'image_plane_angle_from_normalized_landmarks',
        status: angleDegrees === null ? 'unassessable' : 'calculated',
        limitations: ['Estimated 2D image-plane angle; not a 3D or clinical angle.', 'Landmarks are visually estimated and may be affected by occlusion and perspective.']
      };
    });
  });
}

function createFrameManifest(frames: SampledFrame[], detail: FrameManifestEntry['detail'], shotId: string | null = null): FrameManifestEntry[] {
  return frames.map(frame => ({
    frameId: `${detail}_frame_${String(frame.frameIndex).padStart(6, '0')}`,
    shotId,
    sourceFrameIndex: frame.frameIndex,
    timestampSeconds: frame.timestampSeconds,
    width: frame.width,
    height: frame.height,
    coordinateSpace: 'orientation_corrected_supplied_image',
    detail
  }));
}

async function requestVisionJson<T>(
  client: OpenAI,
  model: string,
  instructions: string,
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  frames: SampledFrame[],
  validator: (value: unknown) => value is T,
  detail: 'low' | 'high' = 'low'
): Promise<VisionCallResult<T>> {
  try {
    const response = await client.responses.create({
      model,
      max_output_tokens: 6000,
      reasoning: { effort: 'medium' },
      instructions,
      text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            ...frames.flatMap(frame => [
              { type: 'input_text' as const, text: `Sample ${frame.sampleIndex}; original source PTS ${frame.timestampSeconds.toFixed(6)} seconds; frame ${frame.frameIndex}.` },
              { type: 'input_image' as const, image_url: frame.imageDataUrl, detail }
            ])
          ]
        }
      ]
    });
    if (response.status === 'incomplete') {
      const reason = response.incomplete_details?.reason || 'unknown';
      throw new OpenAiBattingAnalysisError(502, 'openai_response_incomplete', `OpenAI returned an incomplete analysis (${reason}).`);
    }
    if (response.status !== 'completed') {
      throw new OpenAiBattingAnalysisError(502, 'openai_response_not_completed', `OpenAI analysis ended with status ${response.status}.`);
    }
    const message = response.output.find(item => item.type === 'message');
    const refusal = message?.content.find(content => content.type === 'refusal');
    if (refusal?.type === 'refusal') {
      throw new OpenAiBattingAnalysisError(422, 'openai_analysis_refused', 'OpenAI declined to analyze the supplied video frames.');
    }
    const structuredOutput = message?.content.find(content => content.type === 'output_text');
    const text = structuredOutput?.type === 'output_text' ? structuredOutput.text : '';
    if (!text) throw new Error('OpenAI returned an empty analysis.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('OpenAI returned invalid JSON.');
    }
    if (!validator(parsed)) throw new Error('OpenAI returned analysis in an unexpected format.');
    return {
      value: parsed,
      metadata: {
        responseId: response.id,
        model: response.model,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null
      }
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw new OpenAiBattingAnalysisError(503, 'openai_auth_failed', 'OpenAI authentication failed. Check the server API key.');
    }
    if (status === 429) {
      throw new OpenAiBattingAnalysisError(429, 'openai_rate_limited', 'OpenAI is rate limiting requests. Please try again shortly.');
    }
    if (error instanceof OpenAiBattingAnalysisError) throw error;
    console.error('OpenAI batting analysis request failed:', {
      status,
      name: error instanceof Error ? error.name : 'UnknownError'
    });
    throw new OpenAiBattingAnalysisError(502, 'openai_analysis_failed', 'OpenAI could not complete the batting analysis. Please try again.');
  }
}

export async function analyzeBattingVideoWithOpenAI(
  videoBuffer: Buffer,
  options: OpenAiBattingAnalysisOptions = {}
): Promise<OpenAiBattingAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAiBattingAnalysisError(503, 'openai_not_configured', 'OpenAI analysis is not configured. Set OPENAI_API_KEY on the server.');

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecco-openai-video-'));
  const inputPath = path.join(workDir, 'input-video');
  try {
    await fs.writeFile(inputPath, videoBuffer);
    const metadata = await probeVideo(inputPath);
    const manualTimestamp = options.contactTimestampSeconds;
    if (manualTimestamp !== undefined && (!Number.isFinite(manualTimestamp) || manualTimestamp < 0 || manualTimestamp > metadata.durationSeconds)) {
      throw new OpenAiBattingAnalysisError(400, 'invalid_contact_timestamp', 'The selected contact time must be within the video duration.');
    }
    const overviewFps = Math.min(OVERVIEW_FPS, (MAX_OVERVIEW_FRAMES - 1) / metadata.durationSeconds);
    const overviewFrames = await sampleFrames(inputPath, workDir, {
      startSeconds: 0,
      durationSeconds: metadata.durationSeconds,
      fps: overviewFps,
      maxFrames: MAX_OVERVIEW_FRAMES,
      prefix: 'overview',
      dimension: 768,
      presentationTimestampsSeconds: metadata.presentationTimestampsSeconds
    });

    const model = process.env.OPENAI_VIDEO_ANALYSIS_MODEL?.trim() || 'gpt-6.1-sol';
    const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 1 });
    const [sharedInstructions, overviewPrompt, overviewSchema] = await Promise.all([
      loadPromptAsset('shared-instructions.v1.md'),
      loadPromptAsset('overview.v1.md'),
      loadSchemaAsset('overview.schema.v1.json')
    ]);
    const overviewCall = await requestVisionJson(
      client, model, sharedInstructions, overviewPrompt, 'batting_overview_v1', overviewSchema,
      overviewFrames, value => isOverview(value, overviewFrames)
    );
    const overview = overviewCall.value;
    const visionCalls: VisionCallMetadata[] = [overviewCall.metadata];
    const frameManifest = createFrameManifest(overviewFrames, 'overview');

    const aiCandidateIndex = overview.contactCandidateSampleIndex ?? overview.shotCandidates[0]?.sampleIndex ?? null;
    const aiCandidate = aiCandidateIndex === null ? null : overviewFrames[aiCandidateIndex];
    const rankedShotCandidates = overview.shotCandidates.slice(0, 3);
    const primaryShotCandidate = rankedShotCandidates.find(shot => shot.sampleIndex === aiCandidateIndex);
    const shotCandidates = manualTimestamp === undefined
      ? aiCandidateIndex === null
        ? rankedShotCandidates
        : [
            primaryShotCandidate ?? {
              shotId: 'shot_primary', sampleIndex: aiCandidateIndex, shotType: null,
              confidence: overview.contactCandidateConfidence, evidence: overview.contactCandidateEvidence
            },
            ...rankedShotCandidates.filter(shot => shot.sampleIndex !== aiCandidateIndex)
          ].slice(0, 3)
      : [{
          shotId: 'manual_selection',
          sampleIndex: aiCandidate?.sampleIndex ?? 0,
          shotType: null,
          confidence: 1,
          evidence: 'Coach-selected contact timestamp.'
        }];
    const manualReference = manualTimestamp === undefined
      ? null
      : nearestPresentationFrame(metadata.presentationTimestampsSeconds, manualTimestamp);
    const manualSelectedTimestampSeconds = manualTimestamp === undefined
      ? null
      : manualReference?.timestamp ?? manualTimestamp;
    const candidate = manualTimestamp === undefined
      ? aiCandidate
      : {
          timestampSeconds: manualSelectedTimestampSeconds!,
          frameIndex: manualReference?.index ?? Math.round(manualSelectedTimestampSeconds! * metadata.fps)
        };
    const closestOverviewFrame = candidate
      ? overviewFrames.reduce((closest, frame) =>
          Math.abs(frame.timestampSeconds - candidate.timestampSeconds) < Math.abs(closest.timestampSeconds - candidate.timestampSeconds) ? frame : closest
        )
      : null;
    if (manualTimestamp !== undefined && closestOverviewFrame && shotCandidates[0]) {
      shotCandidates[0].sampleIndex = closestOverviewFrame.sampleIndex;
    }
    const selectionSource = manualTimestamp === undefined ? 'AI' as const : 'MANUAL' as const;
    const selectedTimestampSeconds = candidate?.timestampSeconds ?? null;
    let contactStatus: ContactStatus = candidate ? 'LIKELY' : 'NOT_VISIBLE';
    let contactTimestampSeconds: number | null = candidate?.timestampSeconds ?? null;
    let contactConfidence = manualTimestamp === undefined ? overview.contactCandidateConfidence : 0.5;
    let contactEvidence = manualTimestamp === undefined
      ? overview.contactCandidateEvidence
      : 'A coach selected this contact-time reference; the surrounding frames are being checked for visible bat-ball contact.';
    let contactImageDataUrl: string | null = closestOverviewFrame?.imageDataUrl ?? null;
    let contactPointNorm: NormalizedPoint | null = null;
    let contactPlayerBoxNorm: NormalizedBox | null = closestOverviewFrame === null
      ? null
      : overview.phases.find(phase => phase.phase === 'near_contact')?.playerBoxNorm ?? null;
    let contactLandmarksNorm: EstimatedLandmarks = {};
    let batHandleNorm: NormalizedPoint | null = null;
    let batToeNorm: NormalizedPoint | null = null;
    let detailContactFrame: SampledFrame | null = null;
    let poseSequenceFrames: OpenAiBattingAnalysis['poseSequenceFrames'] = [];
    let summary = overview.summary;
    let observations: DetailedObservation[] = overview.observations.map(observation => ({
      ...observation,
      alternativeExplanation: 'Sparse overview footage may omit relevant movement between sampled frames.'
    }));
    let errors: DetailedObservation[] = [];
    let strengths: string[] = [];
    let priorityCue = '';
    let drill: DetailedAnalysis['drill'] = { title: '', instructions: [], rationale: '' };
    let limitations = overview.limitations;
    let assessmentStatus: DetailedAnalysis['status'] = candidate ? 'partially_assessable' : 'unassessable';
    let shotIdentification: DetailedShotAssessment = { shotType: null, confidence: 0, evidence: '' };
    let footageQuality: FootageQuality = {
      cameraView: 'unknown', blur: 'unknown', occlusions: [], timingLimitations: [], cameraMotion: 'unknown'
    };
    let contactWindow = { startSeconds: null as number | null, endSeconds: null as number | null };
    let additionalEvidence: string[] = [];
    const shotAssessments: ShotAssessment[] = [];
    const jointAngles: JointAngleRecord[] = [];
    const phases = overview.phases.map(phase => {
      const sample = phase.sampleIndex === null ? null : overviewFrames[phase.sampleIndex];
      return {
        phase: phase.phase,
        frameIndex: sample?.frameIndex ?? null,
        timestampSeconds: sample?.timestampSeconds ?? null,
        evidence: phase.evidence
      };
    });

    if (candidate !== null) {
      const startSeconds = Math.max(0, candidate.timestampSeconds - CONTACT_WINDOW_SECONDS / 2);
      const windowSeconds = Math.min(CONTACT_WINDOW_SECONDS, metadata.durationSeconds - startSeconds);
      const detailFps = Math.max(1, Math.min(metadata.fps, MAX_DETAIL_FRAMES / Math.max(windowSeconds, 0.05)));
      const detailFrames = await sampleFrames(inputPath, workDir, {
        startSeconds,
        durationSeconds: windowSeconds,
        fps: detailFps,
        maxFrames: MAX_DETAIL_FRAMES,
        prefix: 'contact-detail',
        dimension: MAX_FRAME_DIMENSION,
        presentationTimestampsSeconds: metadata.presentationTimestampsSeconds
      });
      frameManifest.push(...createFrameManifest(detailFrames, 'contact', shotCandidates[0]?.shotId ?? 'shot_001'));
      detailContactFrame = detailFrames.reduce((closest, frame) =>
        Math.abs(frame.timestampSeconds - candidate.timestampSeconds) < Math.abs(closest.timestampSeconds - candidate.timestampSeconds) ? frame : closest
      );
      contactImageDataUrl = detailContactFrame.imageDataUrl;
      const contactReferenceInstruction = manualTimestamp === undefined
        ? `The overview pass proposed a likely contact near ${candidate.timestampSeconds.toFixed(6)} seconds.`
        : `A coach manually selected ${candidate.timestampSeconds.toFixed(6)} seconds as the contact-time reference. Treat that selected moment as the center of review, inspect the neighboring frames for confirmation, and do not silently replace it with a distant event.`;
      const [detailTaskPrompt, detailSchema] = await Promise.all([
        loadPromptAsset('detailed.v1.md'),
        loadSchemaAsset('detailed.schema.v1.json')
      ]);
      const detailPrompt = `${detailTaskPrompt}\n\n${contactReferenceInstruction}`;
      const detailCall = await requestVisionJson(
        client, model, sharedInstructions, detailPrompt, 'batting_detailed_v1', detailSchema,
        detailFrames, value => isDetailed(value, detailFrames, metadata.durationSeconds), 'high'
      );
      visionCalls.push(detailCall.metadata);
      const detailed = detailCall.value;
      const primaryShotJointAngles = calculateJointAngles(detailed.landmarksByFrame, detailFrames);
      jointAngles.push(...primaryShotJointAngles);
      assessmentStatus = detailed.status;
      shotIdentification = detailed.shotIdentification;
      footageQuality = detailed.footageQuality;
      contactWindow = {
        startSeconds: detailed.contactWindowStartSeconds,
        endSeconds: detailed.contactWindowEndSeconds
      };
      batHandleNorm = detailed.batHandleNorm;
      batToeNorm = detailed.batToeNorm;
      additionalEvidence = detailed.additionalEvidence;
      shotAssessments.push({
        shotId: shotCandidates[0]?.shotId || 'shot_001',
        shotType: detailed.shotIdentification.shotType,
        timestampSeconds: candidate.timestampSeconds,
        status: detailed.status,
        contactStatus: detailed.contactStatus,
        confidence: detailed.contactConfidence,
        summary: detailed.summary,
        observations: detailed.observations,
        errors: detailed.errors,
        strengths: detailed.strengths,
        limitations: detailed.limitations,
        jointAngles: primaryShotJointAngles
      });
      contactStatus = detailed.contactStatus;
      contactConfidence = detailed.contactConfidence;
      contactEvidence = detailed.contactEvidence;
      contactPointNorm = detailed.contactPointNorm;
      contactPlayerBoxNorm = detailed.playerBoxNorm ?? contactPlayerBoxNorm;
      contactLandmarksNorm = detailed.landmarksNorm;
      summary = detailed.summary;
      observations = detailed.observations;
      errors = detailed.errors;
      strengths = detailed.strengths;
      priorityCue = detailed.priorityCue;
      drill = detailed.drill;
      limitations = [...new Set([...limitations, ...detailed.limitations])];
      if (detailed.contactSampleIndex !== null) {
        const selected = detailFrames[detailed.contactSampleIndex];
        detailContactFrame = selected;
        contactTimestampSeconds = selected.timestampSeconds;
        contactImageDataUrl = selected.imageDataUrl;
      } else if ((contactStatus === 'NOT_VISIBLE' || contactStatus === 'UNCERTAIN') && manualTimestamp === undefined) {
        contactTimestampSeconds = null;
        contactImageDataUrl = null;
      }

      if (detailContactFrame) {
        const centerSeconds = detailContactFrame.timestampSeconds;
        const offsetsSeconds = [-0.3, -0.225, -0.15, -0.075, 0.075, 0.15, 0.225, 0.3];
        const selectedFrames = new Map<number, SampledFrame>([[detailContactFrame.frameIndex, detailContactFrame]]);
        for (const offset of offsetsSeconds) {
          const targetSeconds = centerSeconds + offset;
          const candidates = detailFrames.filter(frame => offset < 0
            ? frame.timestampSeconds < centerSeconds
            : frame.timestampSeconds > centerSeconds);
          if (!candidates.length) continue;
          const closest = candidates.reduce((best, frame) =>
            Math.abs(frame.timestampSeconds - targetSeconds) < Math.abs(best.timestampSeconds - targetSeconds) ? frame : best
          );
          selectedFrames.set(closest.frameIndex, closest);
        }
        poseSequenceFrames = [...selectedFrames.values()]
          .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
          .map(frame => ({
            frameIndex: frame.frameIndex,
            timestampSeconds: frame.timestampSeconds,
            phase: frame.timestampSeconds < centerSeconds ? 'PRE_CONTACT' as const
              : frame.timestampSeconds > centerSeconds ? 'POST_CONTACT' as const : 'CONTACT' as const,
            imageDataUrl: frame.imageDataUrl
          }));
      }
    }

    if (manualTimestamp === undefined) {
      for (const [candidatePosition, shot] of shotCandidates.slice(1, 3).entries()) {
        if (aiCandidate && shot.sampleIndex === aiCandidate.sampleIndex) continue;
        const shotFrame = overviewFrames[shot.sampleIndex];
        const startSeconds = Math.max(0, shotFrame.timestampSeconds - CONTACT_WINDOW_SECONDS / 2);
        const windowSeconds = Math.min(CONTACT_WINDOW_SECONDS, metadata.durationSeconds - startSeconds);
        const detailFps = Math.max(1, Math.min(metadata.fps, MAX_DETAIL_FRAMES / Math.max(windowSeconds, 0.05)));
        const detailFrames = await sampleFrames(inputPath, workDir, {
          startSeconds,
          durationSeconds: windowSeconds,
          fps: detailFps,
          maxFrames: MAX_DETAIL_FRAMES,
          prefix: `shot-${candidatePosition + 2}-detail`,
          dimension: MAX_FRAME_DIMENSION,
          presentationTimestampsSeconds: metadata.presentationTimestampsSeconds
        });
        frameManifest.push(...createFrameManifest(detailFrames, 'contact', shot.shotId));
        const [detailTaskPrompt, detailSchema] = await Promise.all([
          loadPromptAsset('detailed.v1.md'),
          loadSchemaAsset('detailed.schema.v1.json')
        ]);
        const detailCall = await requestVisionJson(
          client, model, sharedInstructions,
          `${detailTaskPrompt}\n\nAnalyze shot ${shot.shotId} (${shot.shotType || 'type unknown'}), centered near ${shotFrame.timestampSeconds.toFixed(6)} seconds. ${shot.evidence}`,
          'batting_detailed_v1', detailSchema, detailFrames,
          value => isDetailed(value, detailFrames, metadata.durationSeconds), 'high'
        );
        visionCalls.push(detailCall.metadata);
        const detailed = detailCall.value;
        const candidateJointAngles = calculateJointAngles(detailed.landmarksByFrame, detailFrames);
        jointAngles.push(...candidateJointAngles);
        shotAssessments.push({
          shotId: shot.shotId,
          shotType: detailed.shotIdentification.shotType ?? shot.shotType,
          timestampSeconds: shotFrame.timestampSeconds,
          status: detailed.status,
          contactStatus: detailed.contactStatus,
          confidence: detailed.contactConfidence,
          summary: detailed.summary,
          observations: detailed.observations,
          errors: detailed.errors,
          strengths: detailed.strengths,
          limitations: detailed.limitations,
          jointAngles: candidateJointAngles
        });
      }
    }

    let croppedContactImageDataUrl: string | null = null;
    let croppedContactLandmarksNorm: Record<string, NormalizedPoint | null> = {};
    let croppedContactPointNorm: NormalizedPoint | null = null;
    if (detailContactFrame && contactPlayerBoxNorm) {
      try {
        const crop = await createContactPlayerCrop(detailContactFrame, contactPlayerBoxNorm, workDir);
        if (crop) {
          croppedContactImageDataUrl = crop.imageDataUrl;
          croppedContactLandmarksNorm = normalizeLandmarksInCrop(contactLandmarksNorm, detailContactFrame, crop.bounds);
          croppedContactPointNorm = contactPointNorm
            ? normalizeLandmarksInCrop({ head: contactPointNorm }, detailContactFrame, crop.bounds).head ?? null
            : null;
        }
      } catch (error) {
        console.warn('Could not crop the OpenAI contact frame for pose overlay:', error);
      }
    }

    const frameIndex = contactTimestampSeconds === null
      ? null
      : detailContactFrame?.frameIndex ?? nearestPresentationFrame(metadata.presentationTimestampsSeconds, contactTimestampSeconds)?.index ?? null;
    const fallbackContactIndex = closestOverviewFrame?.sampleIndex ?? Math.floor(overviewFrames.length / 2);
    const phaseDefinitions = [
      { label: 'Preparation', key: 'preparation', fallback: 0 },
      { label: 'Downswing', key: 'downswing', fallback: Math.max(0, fallbackContactIndex - 2) },
      { label: 'Near contact', key: 'near_contact', fallback: fallbackContactIndex },
      { label: 'Follow-through', key: 'follow_through', fallback: overviewFrames.length - 1 }
    ];
    const sequencePhases: SequencePhase[] = phaseDefinitions.map(({ label, key, fallback }) => {
      if (key === 'near_contact' && detailContactFrame) {
        return { label, frame: { ...detailContactFrame, playerBoxNorm: contactPlayerBoxNorm } };
      }
      const overviewPhase = overview.phases.find(phase => phase.phase === key && phase.sampleIndex !== null);
      const sample = overviewPhase?.sampleIndex === null || overviewPhase?.sampleIndex === undefined
        ? overviewFrames[fallback]
        : overviewFrames[overviewPhase.sampleIndex];
      return { label, frame: { ...sample, playerBoxNorm: overviewPhase?.playerBoxNorm ?? null } };
    });
    const jointFrame = detailContactFrame || (overview.contactCandidateSampleIndex === null
      ? overviewFrames[Math.floor(overviewFrames.length / 2)]
      : overviewFrames[overview.contactCandidateSampleIndex]);
    const visualOutputs = {
      movementSequenceImageDataUrl: svgDataUrl(makeMovementSequenceSvg(sequencePhases)),
      jointAlignmentImageDataUrl: svgDataUrl(makeJointAlignmentSvg({
        frame: { ...jointFrame, playerBoxNorm: contactPlayerBoxNorm },
        landmarks: contactLandmarksNorm,
        contactPoint: contactPointNorm,
        observations,
        errors,
        priorityCue,
        limitations
      }))
    };
    const { presentationTimestampsSeconds: _framePts, ...videoMetadata } = metadata;
    const usageValues = visionCalls.filter(call => call.inputTokens !== null && call.outputTokens !== null);
    const usage = usageValues.length !== visionCalls.length ? null : {
      inputTokens: usageValues.reduce((total, call) => total + (call.inputTokens ?? 0), 0),
      outputTokens: usageValues.reduce((total, call) => total + (call.outputTokens ?? 0), 0)
    };
    const [ffmpegVersion, ffprobeVersion] = await Promise.all([binaryVersion('ffmpeg'), binaryVersion('ffprobe')]);
    return {
      provider: 'openai',
      model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      sourceSha256: createHash('sha256').update(videoBuffer).digest('hex'),
      video: { ...videoMetadata, sampledOverviewFrames: overviewFrames.length },
      frameManifest,
      shotCandidates,
      shotAssessments,
      jointAngles,
      executionLog: {
        stages: ['probe_video', 'sample_overview_frames', 'openai_overview', ...(candidate ? ['sample_contact_window', 'openai_detailed_analysis'] : []), ...(shotAssessments.length > 1 ? ['analyze_additional_shots'] : []), 'calculate_projected_joint_angles', 'render_review_svgs'],
        toolVersions: { node: process.version, ffmpeg: ffmpegVersion, ffprobe: ffprobeVersion },
        modelRequested: model,
        modelReturned: visionCalls.at(-1)?.model ?? model,
        responseIds: visionCalls.map(call => call.responseId),
        usage
      },
      contact: {
        status: contactStatus,
        selectionSource,
        selectedTimestampSeconds,
        frameIndex,
        timestampSeconds: contactTimestampSeconds,
        confidence: contactConfidence,
        evidence: contactEvidence,
        imageDataUrl: contactImageDataUrl,
        pointNorm: contactPointNorm
      },
      croppedContactImageDataUrl,
      contactLandmarksNorm,
      batHandleNorm,
      batToeNorm,
      croppedContactLandmarksNorm,
      croppedContactPointNorm,
      poseSequenceFrames,
      phases,
      visualOutputs,
      summary,
      status: assessmentStatus,
      shotIdentification,
      footageQuality,
      contactWindow,
      observations,
      errors,
      strengths,
      priorityCue,
      drill,
      limitations,
      additionalEvidence
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
