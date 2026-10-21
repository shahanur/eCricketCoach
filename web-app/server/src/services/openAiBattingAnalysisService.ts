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
import { emptyOpenAiCapeKinetics, OpenAiCapeKinetics } from './openAiCapeKinetics.js';

const execFileAsync = promisify(execFile);
const MAX_FRAME_DIMENSION = 960;
const PROMPT_VERSION = 'batting-v1';
const SCHEMA_VERSION = 'batting-v1';
const runningFromBuild = /(^|[\\/])dist([\\/]|$)/.test(process.argv[1] || '');
const INPUT_ASSET_DIRS = [
  path.resolve(process.cwd(), runningFromBuild ? 'dist/services/openai_inputs' : 'src/services/openai_inputs'),
  path.resolve(process.cwd(), runningFromBuild ? 'src/services/openai_inputs' : 'dist/services/openai_inputs')
];

function boundedEnvironmentNumber(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
}

function getAnalysisLimits() {
  return {
    maxVideoDurationSeconds: boundedEnvironmentNumber('OPENAI_MAX_VIDEO_DURATION_SECONDS', 180, 1, 600),
    maxOverviewFrames: Math.floor(boundedEnvironmentNumber('OPENAI_MAX_OVERVIEW_FRAMES', 36, 4, 120)),
    overviewFps: boundedEnvironmentNumber('OPENAI_OVERVIEW_FPS', 4, 0.5, 10),
    contactContextSeconds: boundedEnvironmentNumber('OPENAI_CONTACT_CONTEXT_SECONDS', 0.5, 0.1, 1.5),
    maxContactWindowSeconds: boundedEnvironmentNumber('OPENAI_MAX_CONTACT_WINDOW_SECONDS', 2, 0.5, 5),
    maxContactWindowFrames: Math.floor(boundedEnvironmentNumber('OPENAI_MAX_CONTACT_WINDOW_FRAMES', 120, 1, 800))
  };
}

function getOpenAiRequestTimeoutMs(): number {
  return Math.floor(boundedEnvironmentNumber('OPENAI_REQUEST_TIMEOUT_MS', 240_000, 30_000, 600_000));
}

export function isOpenAiTimeoutMessage(message: string): boolean {
  return /timed?\s*out|timeout/i.test(message);
}

export function contactFrameImageDetail(timestampSeconds: number, anchorSeconds: number, highDetailRadiusSeconds = 0.1): 'low' | 'high' {
  return Math.abs(timestampSeconds - anchorSeconds) <= highDetailRadiusSeconds ? 'high' : 'low';
}

export function selectDenseContactWindow(
  anchorSeconds: number,
  durationSeconds: number,
  contextSeconds: number,
  maximumWindowSeconds: number,
  proposedStartSeconds: number | null,
  proposedEndSeconds: number | null
): { startSeconds: number; endSeconds: number; usedProposedWindow: boolean } {
  const proposalIsNarrow = proposedStartSeconds !== null && proposedEndSeconds !== null &&
    Number.isFinite(proposedStartSeconds) && Number.isFinite(proposedEndSeconds) &&
    proposedStartSeconds >= 0 && proposedEndSeconds >= proposedStartSeconds &&
    proposedEndSeconds - proposedStartSeconds <= maximumWindowSeconds;
  const startSeconds = Math.max(0, Math.min(anchorSeconds - contextSeconds,
    proposalIsNarrow ? proposedStartSeconds! : anchorSeconds - contextSeconds));
  const endSeconds = Math.min(durationSeconds, Math.max(anchorSeconds + contextSeconds,
    proposalIsNarrow ? proposedEndSeconds! : anchorSeconds + contextSeconds));
  if (endSeconds - startSeconds <= maximumWindowSeconds) {
    return { startSeconds, endSeconds, usedProposedWindow: proposalIsNarrow };
  }
  return {
    startSeconds: Math.max(0, anchorSeconds - maximumWindowSeconds / 2),
    endSeconds: Math.min(durationSeconds, anchorSeconds + maximumWindowSeconds / 2),
    usedProposedWindow: false
  };
}

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
  contextPhase?: StrokePhase;
  visionDetail?: 'low' | 'high';
}

interface Observation {
  title: string;
  observation: string;
  coachingImplication: string;
  frameIndices: number[];
  confidence: Confidence;
}

type StrokePhase = 'preparation' | 'foot_plant' | 'downswing' | 'contact' | 'extension' | 'finish';

interface OverviewPhase {
  phase: StrokePhase;
  sampleIndex: number | null;
  confidence: number;
  evidence: string;
  playerBoxNorm: NormalizedBox | null;
}

interface ShotCandidate {
  shotId: string;
  sampleIndex: number;
  shotType: string | null;
  confidence: number;
  evidence: string;
  windowStartSeconds: number | null;
  windowEndSeconds: number | null;
  phases: OverviewPhase[];
}

interface OverviewAnalysis {
  subjectStatus: 'single_batter' | 'multiple_batters' | 'uncertain';
  subjectEvidence: string;
  contactCandidateSampleIndex: number | null;
  contactCandidateConfidence: number;
  contactCandidateEvidence: string;
  summary: string;
  observations: Observation[];
  phases: OverviewPhase[];
  limitations: string[];
  shotCandidates: ShotCandidate[];
}

interface DetailedObservation extends Observation {
  alternativeExplanation: string;
  coachingCue: string;
  drill: string;
}

interface StrengthObservation {
  title: string;
  observation: string;
  frameIndices: number[];
  confidence: Confidence;
}

interface DetailedShotAssessment {
  shotType: string | null;
  batterHandedness: 'right' | 'left' | 'unknown';
  confidence: number;
  evidence: string;
}

type AnnotationType = 'point' | 'line' | 'polyline' | 'arrow' | 'ellipse' | 'text';
type AnnotationEvidenceStatus = 'observed' | 'estimated' | 'schematic';

interface AnnotationSpec {
  frameIndex: number;
  type: AnnotationType;
  points: NormalizedPoint[];
  label: string;
  evidenceStatus: AnnotationEvidenceStatus;
  confidence: number;
}

interface PhaseReviewFrame {
  shotId: string;
  frameIndex: number;
  timestampSeconds: number;
  phase: StrokePhase;
  confidence: number;
  landmarksNorm: EstimatedLandmarks;
  imageDataUrl: string;
}

interface SourceFrameImage {
  frameIndex: number;
  timestampSeconds: number;
  imageDataUrl: string;
}

interface FootageQuality {
  cameraView: 'front_on' | 'side_on' | 'three_quarter' | 'unknown';
  framing: 'full_batter_visible' | 'partially_cropped' | 'poor' | 'unknown';
  blur: 'low' | 'moderate' | 'high' | 'unknown';
  occlusions: string[];
  timingLimitations: string[];
  cameraMotion: 'stable' | 'moving' | 'unknown';
}

interface KineticsAssessment {
  status: 'not_measured';
  hypotheses: string[];
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
  batLandmarksByFrame: Array<{
    frameIndex: number;
    phase: StrokePhase;
    confidence: number;
    visibility: 'visible' | 'partially_visible' | 'hidden' | 'unknown';
    handleNorm: NormalizedPoint | null;
    toeNorm: NormalizedPoint | null;
  }>;
  annotations: AnnotationSpec[];
  summary: string;
  observations: DetailedObservation[];
  errors: DetailedObservation[];
  shotIdentification: DetailedShotAssessment;
  status: 'assessable' | 'partially_assessable' | 'unassessable';
  footageQuality: FootageQuality;
  strengths: StrengthObservation[];
  kinetics: KineticsAssessment;
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
  strengths: StrengthObservation[];
  limitations: string[];
  jointAngles: JointAngleRecord[];
  batAngles: BatAngleRecord[];
  phaseReviewFrames: PhaseReviewFrame[];
  batLandmarksByFrame: DetailedAnalysis['batLandmarksByFrame'];
  annotations: AnnotationSpec[];
}

interface BatAngleRecord {
  frameId: string;
  frameIndex: number;
  timestampSeconds: number;
  phase: string;
  confidence: number;
  visibility: DetailedAnalysis['batLandmarksByFrame'][number]['visibility'];
  handle: NormalizedPoint | null;
  toe: NormalizedPoint | null;
  handleSource: 'model' | 'wrists' | null;
  angleDegrees: number | null;
  source: 'openai_visual_estimate';
  calculation: 'image_plane_handle_to_toe_from_vertical';
  status: 'calculated' | 'unassessable';
  limitations: string[];
}

interface ContactBatAngle {
  frameIndex: number;
  angleDegrees: number;
  method: 'handle_to_toe' | 'hands_to_toe' | 'wrists_to_contact';
  source: 'openai_visual_estimate';
  limitations: string[];
}

interface JointAngleRecord {
  frameId: string;
  joint: 'elbow' | 'knee' | 'hip' | 'shoulder';
  side: 'left' | 'right';
  landmarkNames: [string, string, string];
  a: NormalizedPoint | null;
  b: NormalizedPoint | null;
  c: NormalizedPoint | null;
  visibility: 'visible' | 'unassessable';
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
  responseIds: string[];
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

interface CropTransformRecord {
  frameIndex: number;
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  outputWidth: number;
  outputHeight: number;
  coordinateSpace: 'crop_pixels_to_orientation_corrected_source_pixels';
}

interface ExecutionOutputRecord {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface OpenAiBattingAnalysis {
  provider: 'openai';
  model: string;
  promptVersion: string;
  schemaVersion: string;
  sourceSha256: string;
  requestMetadata: {
    shotType: 'front_foot_drive' | 'front_foot_defence' | 'unknown';
    batterHandedness: 'right' | 'left' | 'unknown';
    cameraView: 'front_on' | 'side_on' | 'three_quarter' | 'unknown';
    playbackSpeed: 'real_time' | 'slow_motion' | 'unknown';
    captureFps: number | null;
    priorities: NonNullable<OpenAiBattingAnalysisOptions['priorities']>;
  };
  video: Omit<VideoMetadata, 'presentationTimestampsSeconds'> & { sampledOverviewFrames: number };
  frameManifest: FrameManifestEntry[];
  shotCandidates: OverviewAnalysis['shotCandidates'];
  shotAssessments: ShotAssessment[];
  jointAngles: JointAngleRecord[];
  batAngles: BatAngleRecord[];
  contactBatAngle: ContactBatAngle | null;
  phaseReviewFrames: PhaseReviewFrame[];
  sourceFrameImages: SourceFrameImage[];
  batLandmarksByFrame: DetailedAnalysis['batLandmarksByFrame'];
  annotations: AnnotationSpec[];
  executionLog: {
    stages: string[];
    toolVersions: { node: string; ffmpeg: string; ffprobe: string; sharp: string };
    modelRequested: string;
    modelReturned: string;
    responseIds: string[];
    usage: { inputTokens: number; outputTokens: number } | null;
    sourceSha256: string;
    frameManifest: FrameManifestEntry[];
    cropTransforms: CropTransformRecord[];
    errors: string[];
    outputs: ExecutionOutputRecord[];
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
  croppedBatHandleNorm: NormalizedPoint | null;
  croppedBatToeNorm: NormalizedPoint | null;
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
  phases: Array<{ phase: string; frameIndex: number | null; timestampSeconds: number | null; confidence: number; evidence: string }>;
  summary: string;
  status: DetailedAnalysis['status'];
  shotIdentification: DetailedShotAssessment;
  footageQuality: FootageQuality;
  contactWindow: { startSeconds: number | null; endSeconds: number | null };
  observations: DetailedObservation[];
  errors: DetailedObservation[];
  strengths: StrengthObservation[];
  priorityCue: string;
  drill: DetailedAnalysis['drill'];
  limitations: string[];
  additionalEvidence: string[];
  kinetics: KineticsAssessment;
  capeKinetics?: OpenAiCapeKinetics;
}

export class OpenAiBattingAnalysisError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'OpenAiBattingAnalysisError';
  }
}

export interface OpenAiBattingAnalysisOptions {
  contactTimestampSeconds?: number;
  shotType?: 'front_foot_drive' | 'front_foot_defence' | 'unknown';
  batterHandedness?: 'right' | 'left' | 'unknown';
  cameraView?: 'front_on' | 'side_on' | 'three_quarter' | 'unknown';
  playbackSpeed?: 'real_time' | 'slow_motion' | 'unknown';
  captureFps?: number | null;
  priorities?: Array<'footwork' | 'head_alignment' | 'contact' | 'joint_angles' | 'bat_path' | 'extension' | 'follow_through'>;
}

const DEFAULT_PRIORITIES: NonNullable<OpenAiBattingAnalysisOptions['priorities']> = [
  'footwork', 'head_alignment', 'contact', 'joint_angles', 'bat_path', 'extension', 'follow_through'
];

export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  const rendered = template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key: string) => values[key] ?? 'unknown');
  if (/\{\{[a-z_]+\}\}/.test(rendered)) throw new Error('An OpenAI prompt template variable was not resolved.');
  return rendered;
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

async function probeVideo(videoPath: string, maxDurationSeconds: number): Promise<VideoMetadata> {
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
  if (durationSeconds > maxDurationSeconds) {
    throw new OpenAiBattingAnalysisError(413, 'video_too_long', `OpenAI batting analysis supports videos up to ${maxDurationSeconds} seconds.`);
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

async function extractEverySourceFrameInWindow(
  videoPath: string,
  directory: string,
  options: { startSeconds: number; endSeconds: number; prefix: string; dimension: number; maxFrames: number; presentationTimestampsSeconds: number[] }
): Promise<SampledFrame[]> {
  const expectedFrames = options.presentationTimestampsSeconds
    .map((timestamp, index) => ({ timestamp, index }))
    .filter(frame => frame.timestamp >= options.startSeconds && frame.timestamp <= options.endSeconds);
  if (!expectedFrames.length) throw new OpenAiBattingAnalysisError(422, 'video_frames_unavailable', 'No source frames were found in the selected contact window.');
  if (expectedFrames.length > options.maxFrames) {
    throw new OpenAiBattingAnalysisError(413, 'contact_window_too_dense', `The selected contact window contains ${expectedFrames.length} source frames; this analysis is bounded to ${options.maxFrames} frames per stroke. Select a shorter clip around contact.`);
  }
  const outputPattern = path.join(directory, `${options.prefix}-%04d.jpg`);
  const filter = `select='between(t\\,${options.startSeconds.toFixed(6)}\\,${options.endSeconds.toFixed(6)})',scale=${options.dimension}:${options.dimension}:force_original_aspect_ratio=decrease`;
  await runBinary('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath,
    '-vf', filter, '-fps_mode', 'vfr', '-frames:v', String(options.maxFrames + 1),
    '-q:v', '3', outputPattern
  ], 120_000);
  const files = (await fs.readdir(directory))
    .filter(name => name.startsWith(`${options.prefix}-`) && name.endsWith('.jpg'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length !== expectedFrames.length) {
    throw new OpenAiBattingAnalysisError(422, 'contact_window_decode_mismatch', 'The contact window could not be mapped reliably to all original presentation-timestamp frames.');
  }
  const frames: SampledFrame[] = [];
  for (const [sampleIndex, name] of files.entries()) {
    const source = expectedFrames[sampleIndex];
    const bytes = await fs.readFile(path.join(directory, name));
    const dimensions = jpegDimensions(bytes);
    frames.push({
      sampleIndex,
      frameIndex: source.index,
      timestampSeconds: source.timestamp,
      width: dimensions.width,
      height: dimensions.height,
      imageDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
      imagePath: path.join(directory, name),
      playerBoxNorm: null
    });
  }
  return frames;
}

async function extractOriginalSourceFrames(
  videoPath: string,
  directory: string,
  sourceFrameIndices: number[]
): Promise<Map<number, { imageDataUrl: string; width: number; height: number }>> {
  const indices = [...new Set(sourceFrameIndices)].sort((a, b) => a - b);
  if (!indices.length) return new Map();
  const outputPrefix = `report-source-frame`;
  const outputPattern = path.join(directory, `${outputPrefix}-%04d.jpg`);
  const select = indices.map(index => `eq(n\\,${index})`).join('+');
  await runBinary('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath,
    '-vf', `select='${select}'`, '-fps_mode', 'vfr', '-frames:v', String(indices.length),
    '-q:v', '2', outputPattern
  ], 120_000);
  const files = (await fs.readdir(directory))
    .filter(name => name.startsWith(`${outputPrefix}-`) && name.endsWith('.jpg'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length !== indices.length) throw new OpenAiBattingAnalysisError(422, 'source_frame_render_mismatch', 'Some selected report frames could not be decoded at source resolution.');
  const result = new Map<number, { imageDataUrl: string; width: number; height: number }>();
  for (let position = 0; position < files.length; position += 1) {
    const bytes = await fs.readFile(path.join(directory, files[position]));
    const dimensions = jpegDimensions(bytes);
    result.set(indices[position], {
      imageDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
      width: dimensions.width,
      height: dimensions.height
    });
  }
  return result;
}

async function createContactPlayerCrop(
  frame: SampledFrame,
  playerBox: NormalizedBox | null,
  directory: string
): Promise<{ imageDataUrl: string; bounds: { left: number; top: number; width: number; height: number }; outputWidth: number; outputHeight: number } | null> {
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
  const outputDimensions = jpegDimensions(bytes);
  return {
    imageDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
    bounds: { left, top, width: cropWidth, height: cropHeight },
    outputWidth: outputDimensions.width,
    outputHeight: outputDimensions.height
  };
}

export function normalizeLandmarksInCrop(
  landmarks: EstimatedLandmarks,
  frame: Pick<SampledFrame, 'width' | 'height'>,
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

function isFrameReference(value: unknown, frames: Array<Pick<SampledFrame, 'frameIndex'>>): value is number {
  return Number.isInteger(value) && (frames.some(frame => frame.frameIndex === value) || (Number(value) >= 0 && Number(value) < frames.length));
}

function normalizeFrameReference(value: number, frames: SampledFrame[]): number | null {
  if (frames.some(frame => frame.frameIndex === value)) return value;
  return frames[value]?.frameIndex ?? null;
}

export function normalizeFrameReferenceList(values: number[], frames: Array<Pick<SampledFrame, 'frameIndex'>>): number[] | null {
  const sourceFrames = new Set(frames.map(frame => frame.frameIndex));
  if (values.every(value => sourceFrames.has(value))) return values;
  if (!values.every(value => Number.isInteger(value) && value >= 0 && value < frames.length)) return null;
  return values.map(value => frames[value].frameIndex);
}

function isDetailedObservation(value: unknown, frames: SampledFrame[]): value is DetailedObservation {
  if (!isObservation(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  return typeof item.alternativeExplanation === 'string' && typeof item.coachingCue === 'string' && typeof item.drill === 'string' && Array.isArray(item.frameIndices) &&
    item.frameIndices.every(index => isFrameReference(index, frames));
}

function isStrengthObservation(value: unknown, frames: SampledFrame[]): value is StrengthObservation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.title === 'string' && typeof item.observation === 'string' && isConfidence(item.confidence) &&
    Array.isArray(item.frameIndices) && item.frameIndices.every(index => isFrameReference(index, frames));
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

function isAnnotationSpec(value: unknown, frames: SampledFrame[]): value is AnnotationSpec {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const type = item.type;
  const points = item.points;
  if (!isFrameReference(item.frameIndex, frames) ||
    !['point', 'line', 'polyline', 'arrow', 'ellipse', 'text'].includes(String(type)) ||
    typeof item.label !== 'string' || !['observed', 'estimated', 'schematic'].includes(String(item.evidenceStatus)) ||
    typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1 ||
    !Array.isArray(points) || !points.every(point => point !== null && isNormalizedPoint(point))) return false;
  const expectedCountIsValid = type === 'point' || type === 'text' ? points.length === 1
    : type === 'line' || type === 'arrow' || type === 'ellipse' ? points.length === 2
      : points.length >= 2;
  return expectedCountIsValid;
}

function isOverview(value: unknown, frames: Array<Pick<SampledFrame, 'frameIndex'>>, durationSeconds: number): value is OverviewAnalysis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const frameCount = frames.length;
  const index = item.contactCandidateSampleIndex;
  const phases = item.phases;
  const limitations = item.limitations;
  return ['single_batter', 'multiple_batters', 'uncertain'].includes(String(item.subjectStatus)) &&
    typeof item.subjectEvidence === 'string' &&
    (index === null || (Number.isInteger(index) && Number(index) >= 0 && Number(index) < frameCount)) &&
    typeof item.contactCandidateConfidence === 'number' && item.contactCandidateConfidence >= 0 && item.contactCandidateConfidence <= 1 &&
    typeof item.contactCandidateEvidence === 'string' && typeof item.summary === 'string' &&
    Array.isArray(item.observations) && item.observations.every(observation => isObservation(observation) && observation.frameIndices.every(frameIndex => isFrameReference(frameIndex, frames))) &&
    Array.isArray(phases) && phases.every(phase => Boolean(
      phase && typeof phase === 'object' && ['preparation', 'foot_plant', 'downswing', 'contact', 'extension', 'finish'].includes(String((phase as Record<string, unknown>).phase)) &&
      ((phase as Record<string, unknown>).sampleIndex === null || (
        Number.isInteger((phase as Record<string, unknown>).sampleIndex) &&
        Number((phase as Record<string, unknown>).sampleIndex) >= 0 &&
        Number((phase as Record<string, unknown>).sampleIndex) < frameCount
      )) && typeof (phase as Record<string, unknown>).confidence === 'number' && Number((phase as Record<string, unknown>).confidence) >= 0 && Number((phase as Record<string, unknown>).confidence) <= 1 &&
      typeof (phase as Record<string, unknown>).evidence === 'string' &&
      isNormalizedBox((phase as Record<string, unknown>).playerBoxNorm)
    )) && Array.isArray(limitations) && limitations.every(entry => typeof entry === 'string') &&
    Array.isArray(item.shotCandidates) && item.shotCandidates.length <= 3 && item.shotCandidates.every(candidate => {
      if (!candidate || typeof candidate !== 'object') return false;
      const shot = candidate as Record<string, unknown>;
      const phases = shot.phases;
      const windowStart = shot.windowStartSeconds;
      const windowEnd = shot.windowEndSeconds;
      return typeof shot.shotId === 'string' && shot.shotId.length > 0 &&
        Number.isInteger(shot.sampleIndex) && Number(shot.sampleIndex) >= 0 && Number(shot.sampleIndex) < frameCount &&
        (shot.shotType === null || typeof shot.shotType === 'string') &&
        typeof shot.confidence === 'number' && shot.confidence >= 0 && shot.confidence <= 1 &&
        typeof shot.evidence === 'string' &&
        (windowStart === null || (typeof windowStart === 'number' && Number.isFinite(windowStart) && windowStart >= 0 && windowStart <= durationSeconds)) &&
        (windowEnd === null || (typeof windowEnd === 'number' && Number.isFinite(windowEnd) && windowEnd >= 0 && windowEnd <= durationSeconds)) &&
        (windowStart === null || windowEnd === null || windowStart <= windowEnd) &&
        Array.isArray(phases) && phases.every(phase => {
          if (!phase || typeof phase !== 'object') return false;
          const phaseItem = phase as Record<string, unknown>;
          const sampleIndex = phaseItem.sampleIndex;
          return ['preparation', 'foot_plant', 'downswing', 'contact', 'extension', 'finish'].includes(String(phaseItem.phase)) &&
            (sampleIndex === null || (Number.isInteger(sampleIndex) && Number(sampleIndex) >= 0 && Number(sampleIndex) < frameCount)) &&
            typeof phaseItem.confidence === 'number' && phaseItem.confidence >= 0 && phaseItem.confidence <= 1 &&
            typeof phaseItem.evidence === 'string' && isNormalizedBox(phaseItem.playerBoxNorm);
        });
    });
}

function isDetailed(value: unknown, frames: SampledFrame[], durationSeconds: number, contactFrameIndices: Set<number>): value is DetailedAnalysis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const index = item.contactSampleIndex;
  const statuses: ContactStatus[] = ['DETECTED', 'LIKELY', 'UNCERTAIN', 'NOT_VISIBLE'];
  const drill = item.drill as Record<string, unknown> | undefined;
  const shotIdentification = item.shotIdentification as Record<string, unknown> | undefined;
  const footageQuality = item.footageQuality as Record<string, unknown> | undefined;
  const kinetics = item.kinetics as Record<string, unknown> | undefined;
  const kineticHypotheses = kinetics?.hypotheses;
  const contactWindowStartSeconds = item.contactWindowStartSeconds;
  const contactWindowEndSeconds = item.contactWindowEndSeconds;
  const status = item.status;
  const shotConfidence = shotIdentification?.confidence;
  return statuses.includes(item.contactStatus as ContactStatus) &&
    (item.contactStatus !== 'DETECTED' || index !== null) &&
    (index === null || (Number.isInteger(index) && Number(index) >= 0 && Number(index) < frames.length && contactFrameIndices.has(frames[Number(index)].frameIndex))) &&
    typeof item.contactConfidence === 'number' && item.contactConfidence >= 0 && item.contactConfidence <= 1 &&
    typeof item.contactEvidence === 'string' && typeof item.summary === 'string' &&
    isNormalizedPoint(item.contactPointNorm) && isNormalizedBox(item.playerBoxNorm) &&
    isEstimatedLandmarks(item.landmarksNorm) && isNormalizedPoint(item.batHandleNorm) && isNormalizedPoint(item.batToeNorm) &&
    Array.isArray(item.landmarksByFrame) && item.landmarksByFrame.length <= 6 && item.landmarksByFrame.every(entry => {
      if (!entry || typeof entry !== 'object') return false;
      const frameLandmarks = entry as Record<string, unknown>;
      return isFrameReference(frameLandmarks.frameIndex, frames) &&
        ['preparation', 'foot_plant', 'downswing', 'contact', 'extension', 'finish'].includes(String(frameLandmarks.phase)) &&
        typeof frameLandmarks.confidence === 'number' && frameLandmarks.confidence >= 0 && frameLandmarks.confidence <= 1 &&
        isEstimatedLandmarks(frameLandmarks.landmarksNorm);
    }) &&
    Array.isArray(item.batLandmarksByFrame) && item.batLandmarksByFrame.length <= 12 && item.batLandmarksByFrame.every(entry => {
      if (!entry || typeof entry !== 'object') return false;
      const batFrame = entry as Record<string, unknown>;
      return isFrameReference(batFrame.frameIndex, frames) &&
        ['preparation', 'foot_plant', 'downswing', 'contact', 'extension', 'finish'].includes(String(batFrame.phase)) &&
        typeof batFrame.confidence === 'number' && batFrame.confidence >= 0 && batFrame.confidence <= 1 &&
        ['visible', 'partially_visible', 'hidden', 'unknown'].includes(String(batFrame.visibility)) &&
        isNormalizedPoint(batFrame.handleNorm) && isNormalizedPoint(batFrame.toeNorm) &&
        (batFrame.visibility !== 'visible' || (batFrame.handleNorm !== null && batFrame.toeNorm !== null));
    }) && Array.isArray(item.annotations) && item.annotations.length <= 100 &&
    item.annotations.every(annotation => isAnnotationSpec(annotation, frames)) &&
    Array.isArray(item.observations) && item.observations.every(entry => isDetailedObservation(entry, frames)) &&
    Array.isArray(item.errors) && item.errors.length <= 3 && item.errors.every(entry => isDetailedObservation(entry, frames)) &&
    Array.isArray(item.strengths) && item.strengths.every(value => isStrengthObservation(value, frames)) &&
    kinetics?.status === 'not_measured' && Array.isArray(kineticHypotheses) && kineticHypotheses.every(value => typeof value === 'string' && /^hypothesis:/i.test(value.trim())) &&
    typeof item.priorityCue === 'string' && drill !== undefined && typeof drill.title === 'string' &&
    Array.isArray(drill.instructions) && drill.instructions.every(value => typeof value === 'string') &&
    typeof drill.rationale === 'string' && Array.isArray(item.limitations) && item.limitations.every(value => typeof value === 'string') &&
    Array.isArray(item.additionalEvidence) && item.additionalEvidence.every(value => typeof value === 'string') &&
    typeof status === 'string' && ['assessable', 'partially_assessable', 'unassessable'].includes(status) &&
    shotIdentification !== undefined && (shotIdentification.shotType === null || typeof shotIdentification.shotType === 'string') &&
    ['right', 'left', 'unknown'].includes(String(shotIdentification.batterHandedness)) &&
    typeof shotConfidence === 'number' && shotConfidence >= 0 && shotConfidence <= 1 && typeof shotIdentification.evidence === 'string' &&
    footageQuality !== undefined && ['front_on', 'side_on', 'three_quarter', 'unknown'].includes(String(footageQuality.cameraView)) &&
    ['full_batter_visible', 'partially_cropped', 'poor', 'unknown'].includes(String(footageQuality.framing)) &&
    ['low', 'moderate', 'high', 'unknown'].includes(String(footageQuality.blur)) &&
    ['stable', 'moving', 'unknown'].includes(String(footageQuality.cameraMotion)) &&
    Array.isArray(footageQuality.occlusions) && footageQuality.occlusions.every(value => typeof value === 'string') &&
    Array.isArray(footageQuality.timingLimitations) && footageQuality.timingLimitations.every(value => typeof value === 'string') &&
    (contactWindowStartSeconds === null || (typeof contactWindowStartSeconds === 'number' && Number.isFinite(contactWindowStartSeconds) && contactWindowStartSeconds >= 0 && contactWindowStartSeconds <= durationSeconds)) &&
    (contactWindowEndSeconds === null || (typeof contactWindowEndSeconds === 'number' && Number.isFinite(contactWindowEndSeconds) && contactWindowEndSeconds >= 0 && contactWindowEndSeconds <= durationSeconds)) &&
    (contactWindowStartSeconds === null || contactWindowEndSeconds === null || contactWindowStartSeconds <= contactWindowEndSeconds);
}

function normalizeOverviewEvidenceFrames(overview: OverviewAnalysis, frames: Array<Pick<SampledFrame, 'frameIndex'>>): void {
  for (const observation of overview.observations) {
    const normalized = normalizeFrameReferenceList(observation.frameIndices, frames);
    if (!normalized) throw new OpenAiBattingAnalysisError(502, 'overview_frame_reference_invalid', 'An overview finding referenced an unknown frame.');
    observation.frameIndices = normalized;
  }
}

export function validateAndNormalizeOverview(value: unknown, frames: Array<Pick<SampledFrame, 'frameIndex'>>, durationSeconds: number): value is OverviewAnalysis {
  if (!isOverview(value, frames, durationSeconds)) return false;
  normalizeOverviewEvidenceFrames(value, frames);
  return true;
}

function normalizeDetailedEvidenceFrames(detailed: DetailedAnalysis, frames: SampledFrame[]): void {
  const normalizeIndices = (indices: number[]) => {
    const normalized = normalizeFrameReferenceList(indices, frames);
    if (!normalized) throw new OpenAiBattingAnalysisError(502, 'detailed_frame_reference_invalid', 'A detailed finding referenced an unknown frame.');
    return normalized;
  };
  for (const item of [...detailed.observations, ...detailed.errors, ...detailed.strengths]) item.frameIndices = normalizeIndices(item.frameIndices);
  for (const item of detailed.landmarksByFrame) {
    const sourceFrameIndex = normalizeFrameReference(item.frameIndex, frames);
    if (sourceFrameIndex === null) throw new OpenAiBattingAnalysisError(502, 'detailed_frame_reference_invalid', 'A joint landmark referenced an unknown frame.');
    item.frameIndex = sourceFrameIndex;
  }
  for (const item of detailed.batLandmarksByFrame) {
    const sourceFrameIndex = normalizeFrameReference(item.frameIndex, frames);
    if (sourceFrameIndex === null) throw new OpenAiBattingAnalysisError(502, 'detailed_frame_reference_invalid', 'A bat landmark referenced an unknown frame.');
    item.frameIndex = sourceFrameIndex;
  }
  for (const item of detailed.annotations) {
    const sourceFrameIndex = normalizeFrameReference(item.frameIndex, frames);
    if (sourceFrameIndex === null) throw new OpenAiBattingAnalysisError(502, 'detailed_frame_reference_invalid', 'An annotation referenced an unknown frame.');
    item.frameIndex = sourceFrameIndex;
  }
}

export function calculateProjectedAngle(
  a: NormalizedPoint | null | undefined,
  vertex: NormalizedPoint | null | undefined,
  c: NormalizedPoint | null | undefined,
  width: number,
  height: number
): number | null {
  if (!a || !vertex || !c || !Number.isFinite(width) || !Number.isFinite(height) || width <= 1 || height <= 1) return null;
  const points = [a, vertex, c];
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return null;
  const toPixel = (point: NormalizedPoint) => ({ x: point.x * (width - 1), y: point.y * (height - 1) });
  const [pixelA, pixelVertex, pixelC] = points.map(toPixel);
  const ax = pixelA.x - pixelVertex.x;
  const ay = pixelA.y - pixelVertex.y;
  const cx = pixelC.x - pixelVertex.x;
  const cy = pixelC.y - pixelVertex.y;
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
      const a = phaseEntry.landmarksNorm[definition.a] ?? null;
      const b = phaseEntry.landmarksNorm[definition.vertex] ?? null;
      const c = phaseEntry.landmarksNorm[definition.c] ?? null;
      const angleDegrees = calculateProjectedAngle(
        a, b, c, frame.width, frame.height
      );
      return {
        frameId: `frame_${String(frame.frameIndex).padStart(6, '0')}`,
        joint: definition.joint,
        side: definition.side,
        landmarkNames: [definition.a, definition.vertex, definition.c],
        a,
        b,
        c,
        visibility: angleDegrees === null ? 'unassessable' : 'visible',
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

const BAT_ANGLE_LIMITATIONS = [
  'Estimated 2D image-plane angle of the bat shaft from vertical; not a 3D bat face or lie angle.',
  'Handle and toe points are visually estimated and may be affected by motion blur, occlusion and perspective.'
];

/** CAPE convention: handle-to-toe direction measured from straight down (0-180 degrees; above 90 = toe above hands). */
export function calculateBatAngle(
  handle: NormalizedPoint | null | undefined,
  toe: NormalizedPoint | null | undefined,
  width: number,
  height: number
): number | null {
  if (!handle || !toe || !Number.isFinite(width) || !Number.isFinite(height) || width <= 1 || height <= 1) return null;
  if ([handle, toe].some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return null;
  const dx = (toe.x - handle.x) * (width - 1);
  const dy = (toe.y - handle.y) * (height - 1);
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;
  return Math.round(Math.acos(Math.max(-1, Math.min(1, dy / length))) * 1800 / Math.PI) / 10;
}

const GRIP_HANDLE_LIMITATION = 'The handle was hidden by the hands; the wrist midpoint (grip) was used as the handle end, as CAPE does.';

function gripPoint(landmarks: EstimatedLandmarks | null | undefined): NormalizedPoint | null {
  const wrists = [landmarks?.leftWrist, landmarks?.rightWrist].filter((point): point is NormalizedPoint => Boolean(point));
  if (!wrists.length) return null;
  return {
    x: wrists.reduce((sum, point) => sum + point.x, 0) / wrists.length,
    y: wrists.reduce((sum, point) => sum + point.y, 0) / wrists.length
  };
}

export function calculateBatAngles(
  batLandmarksByFrame: DetailedAnalysis['batLandmarksByFrame'],
  frames: SampledFrame[],
  bodyLandmarksByFrame: Map<number, EstimatedLandmarks> = new Map()
): BatAngleRecord[] {
  const framesBySourceIndex = new Map(frames.map(frame => [frame.frameIndex, frame]));
  return batLandmarksByFrame.flatMap(entry => {
    const frame = framesBySourceIndex.get(entry.frameIndex);
    if (!frame) return [];
    const grip = entry.handleNorm ? null : gripPoint(bodyLandmarksByFrame.get(entry.frameIndex));
    const handle = entry.handleNorm ?? grip;
    const angleDegrees = entry.visibility === 'hidden'
      ? null
      : calculateBatAngle(handle, entry.toeNorm, frame.width, frame.height);
    return [{
      frameId: `frame_${String(frame.frameIndex).padStart(6, '0')}`,
      frameIndex: frame.frameIndex,
      timestampSeconds: frame.timestampSeconds,
      phase: entry.phase,
      confidence: entry.confidence,
      visibility: entry.visibility,
      handle,
      toe: entry.toeNorm,
      handleSource: entry.handleNorm ? 'model' as const : grip ? 'wrists' as const : null,
      angleDegrees,
      source: 'openai_visual_estimate' as const,
      calculation: 'image_plane_handle_to_toe_from_vertical' as const,
      status: angleDegrees === null ? 'unassessable' as const : 'calculated' as const,
      limitations: grip ? [...BAT_ANGLE_LIMITATIONS, GRIP_HANDLE_LIMITATION] : BAT_ANGLE_LIMITATIONS
    }];
  });
}

/** Body landmarks keyed by source frame, including the contact frame's landmarks. */
function bodyLandmarkMap(detailed: DetailedAnalysis, frames: SampledFrame[]): Map<number, EstimatedLandmarks> {
  const map = new Map(detailed.landmarksByFrame.map(entry => [entry.frameIndex, entry.landmarksNorm]));
  const contactFrame = detailed.contactSampleIndex === null ? undefined : frames[detailed.contactSampleIndex];
  if (contactFrame && !map.has(contactFrame.frameIndex)) map.set(contactFrame.frameIndex, detailed.landmarksNorm);
  return map;
}

/** Bat angle at contact: handle-to-toe, else grip-to-toe, else CAPE's wrists-to-contact fallback. */
export function calculateContactBatAngle(
  frame: Pick<SampledFrame, 'frameIndex' | 'width' | 'height'>,
  handle: NormalizedPoint | null,
  toe: NormalizedPoint | null,
  landmarks: EstimatedLandmarks,
  contactPoint: NormalizedPoint | null
): ContactBatAngle | null {
  const direct = calculateBatAngle(handle, toe, frame.width, frame.height);
  if (direct !== null) {
    return { frameIndex: frame.frameIndex, angleDegrees: direct, method: 'handle_to_toe', source: 'openai_visual_estimate', limitations: BAT_ANGLE_LIMITATIONS };
  }
  const hands = gripPoint(landmarks);
  const gripToToe = calculateBatAngle(hands, toe, frame.width, frame.height);
  if (gripToToe !== null) {
    return { frameIndex: frame.frameIndex, angleDegrees: gripToToe, method: 'hands_to_toe', source: 'openai_visual_estimate', limitations: [...BAT_ANGLE_LIMITATIONS, GRIP_HANDLE_LIMITATION] };
  }
  if (!hands || !contactPoint) return null;
  const fallback = calculateBatAngle(hands, contactPoint, frame.width, frame.height);
  return fallback === null ? null : {
    frameIndex: frame.frameIndex,
    angleDegrees: fallback,
    method: 'wrists_to_contact',
    source: 'openai_visual_estimate',
    limitations: [...BAT_ANGLE_LIMITATIONS, 'Bat ends were not both visible; the bat line was approximated from the hands to the estimated contact point.']
  };
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

function combineContactAndPhaseFrames(contactFrames: SampledFrame[], phases: OverviewPhase[], overviewFrames: SampledFrame[], anchorSeconds: number): SampledFrame[] {
  const combined = new Map<number, SampledFrame>();
  for (const frame of contactFrames) {
    combined.set(frame.frameIndex, {
      ...frame,
      visionDetail: contactFrameImageDetail(frame.timestampSeconds, anchorSeconds)
    });
  }
  for (const phase of phases) {
    if (phase.sampleIndex === null) continue;
    const source = overviewFrames[phase.sampleIndex];
    if (!source || combined.has(source.frameIndex)) continue;
    combined.set(source.frameIndex, { ...source, contextPhase: phase.phase, visionDetail: 'low' });
  }
  return [...combined.values()]
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .map((frame, sampleIndex) => ({ ...frame, sampleIndex }));
}

export function extractStructuredOutput(responseValue: unknown): VisionCallResult<string> {
  if (!responseValue || typeof responseValue !== 'object') throw new OpenAiBattingAnalysisError(502, 'openai_response_invalid', 'OpenAI returned an invalid response.');
  const response = responseValue as Record<string, unknown>;
  if (response.status === 'incomplete') {
    const details = response.incomplete_details as Record<string, unknown> | null;
    throw new OpenAiBattingAnalysisError(502, 'openai_response_incomplete', `OpenAI returned an incomplete analysis (${String(details?.reason ?? 'unknown')}).`);
  }
  if (response.status !== 'completed') {
    throw new OpenAiBattingAnalysisError(502, 'openai_response_not_completed', `OpenAI analysis ended with status ${String(response.status)}.`);
  }
  const output = Array.isArray(response.output) ? response.output : [];
  const message = output.find(item => Boolean(item && typeof item === 'object' && (item as Record<string, unknown>).type === 'message')) as Record<string, unknown> | undefined;
  const content = Array.isArray(message?.content) ? message.content : [];
  const refusal = content.find(item => Boolean(item && typeof item === 'object' && (item as Record<string, unknown>).type === 'refusal')) as Record<string, unknown> | undefined;
  if (refusal) throw new OpenAiBattingAnalysisError(422, 'openai_analysis_refused', 'OpenAI declined to analyze the supplied video frames.');
  const textItem = content.find(item => Boolean(item && typeof item === 'object' && (item as Record<string, unknown>).type === 'output_text')) as Record<string, unknown> | undefined;
  if (!textItem || typeof textItem.text !== 'string' || !textItem.text) throw new Error('OpenAI returned an empty analysis.');
  const usage = response.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : {};
  return {
    value: textItem.text,
    metadata: {
      responseId: typeof response.id === 'string' ? response.id : '',
      responseIds: typeof response.id === 'string' ? [response.id] : [],
      model: typeof response.model === 'string' ? response.model : '',
      inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : null,
      outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : null
    }
  };
}

export function nextOutputTokenBudget(status: unknown, reason: unknown, currentBudget: number, maximumBudget: number): number | null {
  if (status !== 'incomplete' || reason !== 'max_output_tokens' || currentBudget >= maximumBudget) return null;
  return Math.min(maximumBudget, currentBudget * 2);
}

export function safeOpenAiErrorDiagnostics(error: unknown): {
  name: string;
  message: string;
  status: number | null;
  code: string | null;
  type: string | null;
  param: string | null;
  requestId: string | null;
} {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const apiError = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : {};
  const rawMessage = error instanceof Error ? error.message : typeof record.message === 'string' ? record.message : 'Unknown error';
  const message = rawMessage
    .replace(/data:image\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '[image data redacted]')
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/g, '[API key redacted]')
    .replace(/\bBearer\s+[^\s,]+/gi, 'Bearer [redacted]')
    .slice(0, 400);
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    message,
    status: typeof record.status === 'number' ? record.status : null,
    code: typeof record.code === 'string' ? record.code : typeof apiError.code === 'string' ? apiError.code : null,
    type: typeof record.type === 'string' ? record.type : typeof apiError.type === 'string' ? apiError.type : null,
    param: typeof apiError.param === 'string' ? apiError.param : null,
    requestId: typeof record.request_id === 'string' ? record.request_id : null
  };
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
  const requestStartedAt = Date.now();
  const outputBudgets: number[] = [];
  try {
    const createResponse = (maxOutputTokens: number) => client.responses.create({
      model,
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: 'medium' },
      instructions,
      text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
      input: [
        {
          role: 'user' as const,
          content: [
            { type: 'input_text', text: prompt },
            ...frames.flatMap(frame => [
              { type: 'input_text' as const, text: `Supplied sample ${frame.sampleIndex}; original source PTS ${frame.timestampSeconds.toFixed(6)} seconds; source frame ${frame.frameIndex}.${frame.contextPhase ? ` Overview phase context: ${frame.contextPhase}.` : ' Dense contact-window frame.'}` },
              { type: 'input_image' as const, image_url: frame.imageDataUrl, detail: frame.visionDetail ?? detail }
            ])
          ]
        }
      ]
    });
    const initialBudget = detail === 'high' ? 8_000 : 4_000;
    const maximumBudget = detail === 'high' ? 16_000 : 8_000;
    outputBudgets.push(initialBudget);
    let response = await createResponse(initialBudget);
    const responseAttempts = [response];
    const retryBudget = nextOutputTokenBudget(response.status, response.incomplete_details?.reason, initialBudget, maximumBudget);
    if (retryBudget !== null) {
      console.warn('OpenAI structured output reached its token cap; retrying once with a larger bounded output budget.', {
        schemaName,
        responseId: response.id,
        previousBudget: initialBudget,
        retryBudget,
        suppliedFrameCount: frames.length
      });
      outputBudgets.push(retryBudget);
      response = await createResponse(retryBudget);
      responseAttempts.push(response);
      if (response.status === 'incomplete') {
        console.error('OpenAI structured output remained incomplete after the bounded retry.', {
          schemaName,
          responseId: response.id,
          reason: response.incomplete_details?.reason ?? 'unknown',
          outputBudget: retryBudget,
          suppliedFrameCount: frames.length
        });
      }
    }
    const output = extractStructuredOutput(response);
    let parsed: unknown;
    try {
      parsed = JSON.parse(output.value);
    } catch {
      throw new Error('OpenAI returned invalid JSON.');
    }
    if (!validator(parsed)) {
      const topLevelKeys = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : [];
      console.error('OpenAI response failed semantic analysis validation:', {
        schemaName,
        responseId: output.metadata.responseId,
        model: output.metadata.model,
        topLevelKeys,
        suppliedFrameCount: frames.length
      });
      throw new OpenAiBattingAnalysisError(502, 'openai_analysis_validation_failed', 'OpenAI returned a structured response that did not satisfy source-frame and evidence validation.');
    }
    const attemptUsages = responseAttempts.map(attempt => attempt.usage);
    const completeUsage = attemptUsages.every(usage => usage !== null && usage !== undefined && typeof usage.input_tokens === 'number' && typeof usage.output_tokens === 'number');
    return {
      value: parsed,
      metadata: {
        ...output.metadata,
        responseIds: responseAttempts.map(attempt => attempt.id),
        inputTokens: completeUsage ? attemptUsages.reduce((total, usage) => total + (usage?.input_tokens ?? 0), 0) : null,
        outputTokens: completeUsage ? attemptUsages.reduce((total, usage) => total + (usage?.output_tokens ?? 0), 0) : null
      }
    };
  } catch (error) {
    const diagnostics = safeOpenAiErrorDiagnostics(error);
    const status = diagnostics.status ?? undefined;
    if (status === 401 || status === 403) {
      throw new OpenAiBattingAnalysisError(503, 'openai_auth_failed', 'OpenAI authentication failed. Check the server API key.');
    }
    if (status === 429) {
      throw new OpenAiBattingAnalysisError(429, 'openai_rate_limited', 'OpenAI is rate limiting requests. Please try again shortly.');
    }
    if (error instanceof OpenAiBattingAnalysisError) throw error;
    console.error('OpenAI batting analysis request failed:', {
      ...diagnostics,
      schemaName,
      elapsedMs: Date.now() - requestStartedAt,
      suppliedFrameCount: frames.length,
      outputBudgets
    });
    if (isOpenAiTimeoutMessage(diagnostics.message)) {
      throw new OpenAiBattingAnalysisError(504, 'openai_request_timeout', 'OpenAI timed out while analyzing the supplied frames. Try a shorter contact selection or lower the overview/contact-frame limits.');
    }
    throw new OpenAiBattingAnalysisError(502, 'openai_analysis_failed', 'OpenAI could not complete the batting analysis. Please try again.');
  }
}

export async function analyzeBattingVideoWithOpenAI(
  videoBuffer: Buffer,
  options: OpenAiBattingAnalysisOptions = {}
): Promise<OpenAiBattingAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAiBattingAnalysisError(503, 'openai_not_configured', 'OpenAI analysis is not configured. Set OPENAI_API_KEY on the server.');

  const limits = getAnalysisLimits();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecco-openai-video-'));
  const inputPath = path.join(workDir, 'input-video');
  try {
    await fs.writeFile(inputPath, videoBuffer);
    const metadata = await probeVideo(inputPath, limits.maxVideoDurationSeconds);
    const manualTimestamp = options.contactTimestampSeconds;
    if (manualTimestamp !== undefined && (!Number.isFinite(manualTimestamp) || manualTimestamp < 0 || manualTimestamp > metadata.durationSeconds)) {
      throw new OpenAiBattingAnalysisError(400, 'invalid_contact_timestamp', 'The selected contact time must be within the video duration.');
    }
    const overviewFps = Math.min(limits.overviewFps, (limits.maxOverviewFrames - 1) / metadata.durationSeconds);
    const overviewFrames = await sampleFrames(inputPath, workDir, {
      startSeconds: 0,
      durationSeconds: metadata.durationSeconds,
      fps: overviewFps,
      maxFrames: limits.maxOverviewFrames,
      prefix: 'overview',
      dimension: 768,
      presentationTimestampsSeconds: metadata.presentationTimestampsSeconds
    });

    const model = process.env.OPENAI_VIDEO_ANALYSIS_MODEL?.trim() || 'gpt-6.1-sol';
    const client = new OpenAI({ apiKey, timeout: getOpenAiRequestTimeoutMs(), maxRetries: 0 });
    const [sharedInstructions, overviewTemplate, overviewSchema] = await Promise.all([
      loadPromptAsset('shared-instructions.v1.md'),
      loadPromptAsset('overview.v1.md'),
      loadSchemaAsset('overview.schema.v1.json')
    ]);
    const priorities = options.priorities?.length ? options.priorities : DEFAULT_PRIORITIES;
    const requestMetadata = {
      shot_type: options.shotType ?? 'unknown',
      batter_handedness: options.batterHandedness ?? 'unknown',
      camera_view: options.cameraView ?? 'unknown',
      playback_speed: options.playbackSpeed ?? 'unknown',
      capture_fps: options.captureFps ?? null,
      priorities
    };
    const overviewPrompt = renderPromptTemplate(overviewTemplate, {
      validated_user_metadata_json: JSON.stringify(requestMetadata)
    });
    const overviewCall = await requestVisionJson(
      client, model, sharedInstructions, overviewPrompt, 'batting_overview_v1', overviewSchema,
      overviewFrames, value => validateAndNormalizeOverview(value, overviewFrames, metadata.durationSeconds)
    );
    const overview = overviewCall.value;
    if (overview.subjectStatus !== 'single_batter') {
      throw new OpenAiBattingAnalysisError(422, 'batter_selection_required', 'The clip may contain multiple or ambiguous batters. Please upload a single-batter crop or provide a clip with the intended batter clearly isolated.');
    }
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
              confidence: overview.contactCandidateConfidence, evidence: overview.contactCandidateEvidence,
              windowStartSeconds: null, windowEndSeconds: null, phases: overview.phases
            },
            ...rankedShotCandidates.filter(shot => shot.sampleIndex !== aiCandidateIndex)
          ].slice(0, 3)
      : [{
          shotId: 'manual_selection',
          sampleIndex: aiCandidate?.sampleIndex ?? 0,
          shotType: null,
          confidence: 1,
          evidence: 'Coach-selected contact timestamp.',
          windowStartSeconds: null,
          windowEndSeconds: null,
          phases: overview.phases
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
    let contactConfidence = manualTimestamp === undefined ? shotCandidates[0]?.confidence ?? overview.contactCandidateConfidence : 0.5;
    let contactEvidence = manualTimestamp === undefined
      ? shotCandidates[0]?.evidence ?? overview.contactCandidateEvidence
      : 'A coach selected this contact-time reference; the surrounding frames are being checked for visible bat-ball contact.';
    let contactImageDataUrl: string | null = closestOverviewFrame?.imageDataUrl ?? null;
    let contactPointNorm: NormalizedPoint | null = null;
    let contactPlayerBoxNorm: NormalizedBox | null = closestOverviewFrame === null
      ? null
      : shotCandidates[0]?.phases.find(phase => phase.phase === 'contact')?.playerBoxNorm ?? null;
    let contactLandmarksNorm: EstimatedLandmarks = {};
    let batHandleNorm: NormalizedPoint | null = null;
    let batToeNorm: NormalizedPoint | null = null;
    let detailContactFrame: SampledFrame | null = null;
    let poseSequenceFrames: OpenAiBattingAnalysis['poseSequenceFrames'] = [];
    let summary = overview.summary;
    let observations: DetailedObservation[] = overview.observations.map(observation => ({
      ...observation,
      alternativeExplanation: 'Sparse overview footage may omit relevant movement between sampled frames.',
      coachingCue: '',
      drill: ''
    }));
    let errors: DetailedObservation[] = [];
    let strengths: StrengthObservation[] = [];
    let kinetics: KineticsAssessment = { status: 'not_measured', hypotheses: [] };
    let priorityCue = '';
    let drill: DetailedAnalysis['drill'] = { title: '', instructions: [], rationale: '' };
    let limitations = overview.limitations;
    let assessmentStatus: DetailedAnalysis['status'] = candidate ? 'partially_assessable' : 'unassessable';
    let shotIdentification: DetailedShotAssessment = { shotType: null, batterHandedness: options.batterHandedness ?? 'unknown', confidence: 0, evidence: '' };
    let footageQuality: FootageQuality = {
      cameraView: 'unknown', framing: 'unknown', blur: 'unknown', occlusions: [], timingLimitations: [], cameraMotion: 'unknown'
    };
    let contactWindow = { startSeconds: null as number | null, endSeconds: null as number | null };
    let additionalEvidence: string[] = [];
    const shotAssessments: ShotAssessment[] = [];
    const jointAngles: JointAngleRecord[] = [];
    const batAngles: BatAngleRecord[] = [];
    const phaseReviewFrames: PhaseReviewFrame[] = [];
    const batLandmarksByFrame: DetailedAnalysis['batLandmarksByFrame'] = [];
    const annotations: AnnotationSpec[] = [];
    const phases = overview.phases.map(phase => {
      const sample = phase.sampleIndex === null ? null : overviewFrames[phase.sampleIndex];
      return {
        phase: phase.phase,
        frameIndex: sample?.frameIndex ?? null,
        timestampSeconds: sample?.timestampSeconds ?? null,
        evidence: phase.evidence,
        confidence: phase.confidence
      };
    });

    if (candidate !== null) {
      const proposedWindow = shotCandidates[0];
      const denseWindow = selectDenseContactWindow(
        candidate.timestampSeconds, metadata.durationSeconds, limits.contactContextSeconds,
        limits.maxContactWindowSeconds, proposedWindow?.windowStartSeconds ?? null, proposedWindow?.windowEndSeconds ?? null
      );
      const { startSeconds, endSeconds } = denseWindow;
      if (!denseWindow.usedProposedWindow && typeof proposedWindow?.windowStartSeconds === 'number' && typeof proposedWindow.windowEndSeconds === 'number') {
        limitations = [...limitations, 'The overview window covered the wider stroke; dense extraction used a bounded window centered on its contact anchor.'];
      }
      const detailFrames = await extractEverySourceFrameInWindow(inputPath, workDir, {
        startSeconds,
        endSeconds,
        prefix: 'contact-detail',
        dimension: MAX_FRAME_DIMENSION,
        maxFrames: limits.maxContactWindowFrames,
        presentationTimestampsSeconds: metadata.presentationTimestampsSeconds
      });
      frameManifest.push(...createFrameManifest(detailFrames, 'contact', shotCandidates[0]?.shotId ?? 'shot_001'));
      const primaryPhaseContext = shotCandidates[0]?.phases.length ? shotCandidates[0].phases : overview.phases;
      const detailInputFrames = combineContactAndPhaseFrames(detailFrames, primaryPhaseContext, overviewFrames, candidate.timestampSeconds);
      const contactFrameIndices = new Set(detailFrames.map(frame => frame.frameIndex));
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
      const detailPrompt = `${renderPromptTemplate(detailTaskPrompt, {
        shot_id: shotCandidates[0]?.shotId || 'shot_001',
        shot_type: options.shotType ?? shotCandidates[0]?.shotType ?? 'unknown',
        batter_handedness: options.batterHandedness ?? 'unknown',
        camera_view: options.cameraView ?? 'unknown',
        timing_metadata: JSON.stringify({ playback_speed: options.playbackSpeed ?? 'unknown', capture_fps: options.captureFps ?? null }),
        priorities: JSON.stringify(priorities)
      })}\n\nContact reference: ${contactReferenceInstruction}`;
      const detailCall = await requestVisionJson(
        client, model, sharedInstructions, detailPrompt, 'batting_detailed_v1', detailSchema,
        detailInputFrames, value => isDetailed(value, detailInputFrames, metadata.durationSeconds, contactFrameIndices), 'high'
      );
      visionCalls.push(detailCall.metadata);
      const detailed = detailCall.value;
      normalizeDetailedEvidenceFrames(detailed, detailInputFrames);
      const primaryShotId = shotCandidates[0]?.shotId || 'shot_001';
      const primaryPhaseReviewFrames = detailed.landmarksByFrame.flatMap(phase => {
        const frame = detailInputFrames.find(item => item.frameIndex === phase.frameIndex);
        return frame ? [{
          shotId: primaryShotId,
          frameIndex: phase.frameIndex,
          timestampSeconds: frame.timestampSeconds,
          phase: phase.phase,
          confidence: phase.confidence,
          landmarksNorm: phase.landmarksNorm,
          imageDataUrl: frame.imageDataUrl
        }] : [];
      });
      phaseReviewFrames.push(...primaryPhaseReviewFrames);
      batLandmarksByFrame.push(...detailed.batLandmarksByFrame);
      annotations.push(...detailed.annotations);
      const primaryShotJointAngles = calculateJointAngles(detailed.landmarksByFrame, detailInputFrames);
      jointAngles.push(...primaryShotJointAngles);
      const primaryShotBatAngles = calculateBatAngles(detailed.batLandmarksByFrame, detailInputFrames, bodyLandmarkMap(detailed, detailInputFrames));
      batAngles.push(...primaryShotBatAngles);
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
      kinetics = detailed.kinetics;
      shotAssessments.push({
        shotId: primaryShotId,
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
        jointAngles: primaryShotJointAngles,
        batAngles: primaryShotBatAngles,
        phaseReviewFrames: primaryPhaseReviewFrames,
        batLandmarksByFrame: detailed.batLandmarksByFrame,
        annotations: detailed.annotations
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
        const selected = detailInputFrames[detailed.contactSampleIndex];
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
        const denseWindow = selectDenseContactWindow(
          shotFrame.timestampSeconds, metadata.durationSeconds, limits.contactContextSeconds,
          limits.maxContactWindowSeconds, shot.windowStartSeconds, shot.windowEndSeconds
        );
        const { startSeconds, endSeconds } = denseWindow;
        const candidateWindowLimitations = !denseWindow.usedProposedWindow && typeof shot.windowStartSeconds === 'number' && typeof shot.windowEndSeconds === 'number'
          ? ['The overview window covered the wider stroke; dense extraction used a bounded window centered on its contact anchor.']
          : [];
        const detailFrames = await extractEverySourceFrameInWindow(inputPath, workDir, {
          startSeconds,
          endSeconds,
          prefix: `shot-${candidatePosition + 2}-detail`,
          dimension: MAX_FRAME_DIMENSION,
          maxFrames: limits.maxContactWindowFrames,
          presentationTimestampsSeconds: metadata.presentationTimestampsSeconds
        });
        frameManifest.push(...createFrameManifest(detailFrames, 'contact', shot.shotId));
        const candidatePhaseContext = shot.phases.length ? shot.phases : overview.phases;
        const detailInputFrames = combineContactAndPhaseFrames(detailFrames, candidatePhaseContext, overviewFrames, shotFrame.timestampSeconds);
        const contactFrameIndices = new Set(detailFrames.map(frame => frame.frameIndex));
        const [detailTaskPrompt, detailSchema] = await Promise.all([
          loadPromptAsset('detailed.v1.md'),
          loadSchemaAsset('detailed.schema.v1.json')
        ]);
        const detailCall = await requestVisionJson(
          client, model, sharedInstructions,
          `${renderPromptTemplate(detailTaskPrompt, {
            shot_id: shot.shotId,
            shot_type: options.shotType ?? shot.shotType ?? 'unknown',
            batter_handedness: options.batterHandedness ?? 'unknown',
            camera_view: options.cameraView ?? 'unknown',
            timing_metadata: JSON.stringify({ playback_speed: options.playbackSpeed ?? 'unknown', capture_fps: options.captureFps ?? null }),
            priorities: JSON.stringify(priorities)
          })}\n\nCandidate context: centered near ${shotFrame.timestampSeconds.toFixed(6)} seconds. ${shot.evidence}`,
          'batting_detailed_v1', detailSchema, detailInputFrames,
          value => isDetailed(value, detailInputFrames, metadata.durationSeconds, contactFrameIndices), 'high'
        );
        visionCalls.push(detailCall.metadata);
        const detailed = detailCall.value;
        normalizeDetailedEvidenceFrames(detailed, detailInputFrames);
        batLandmarksByFrame.push(...detailed.batLandmarksByFrame);
        annotations.push(...detailed.annotations);
        const candidatePhaseReviewFrames = detailed.landmarksByFrame.flatMap(phase => {
          const frame = detailInputFrames.find(item => item.frameIndex === phase.frameIndex);
          return frame ? [{
            shotId: shot.shotId,
            frameIndex: phase.frameIndex,
            timestampSeconds: frame.timestampSeconds,
            phase: phase.phase,
            confidence: phase.confidence,
            landmarksNorm: phase.landmarksNorm,
            imageDataUrl: frame.imageDataUrl
          }] : [];
        });
        phaseReviewFrames.push(...candidatePhaseReviewFrames);
        const candidateJointAngles = calculateJointAngles(detailed.landmarksByFrame, detailInputFrames);
        jointAngles.push(...candidateJointAngles);
        const candidateBatAngles = calculateBatAngles(detailed.batLandmarksByFrame, detailInputFrames, bodyLandmarkMap(detailed, detailInputFrames));
        batAngles.push(...candidateBatAngles);
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
          limitations: [...new Set([...detailed.limitations, ...candidateWindowLimitations])],
          jointAngles: candidateJointAngles,
          batAngles: candidateBatAngles,
          phaseReviewFrames: candidatePhaseReviewFrames,
          batLandmarksByFrame: detailed.batLandmarksByFrame,
          annotations: detailed.annotations
        });
      }
    }

    let croppedContactImageDataUrl: string | null = null;
    let croppedContactLandmarksNorm: Record<string, NormalizedPoint | null> = {};
    let croppedContactPointNorm: NormalizedPoint | null = null;
    let croppedBatHandleNorm: NormalizedPoint | null = null;
    let croppedBatToeNorm: NormalizedPoint | null = null;
    const contactBatFrame = detailContactFrame
      ? batLandmarksByFrame.find(entry => entry.frameIndex === detailContactFrame!.frameIndex && entry.visibility !== 'hidden')
      : undefined;
    const contactBatAngle = detailContactFrame
      ? calculateContactBatAngle(
          detailContactFrame,
          batHandleNorm ?? contactBatFrame?.handleNorm ?? null,
          batToeNorm ?? contactBatFrame?.toeNorm ?? null,
          contactLandmarksNorm,
          contactPointNorm
        )
      : null;
    const cropTransforms: CropTransformRecord[] = [];
    if (detailContactFrame && contactPlayerBoxNorm) {
      try {
        const crop = await createContactPlayerCrop(detailContactFrame, contactPlayerBoxNorm, workDir);
        if (crop) {
          croppedContactImageDataUrl = crop.imageDataUrl;
          cropTransforms.push({
            frameIndex: detailContactFrame.frameIndex,
            sourceWidth: detailContactFrame.width,
            sourceHeight: detailContactFrame.height,
            cropX: crop.bounds.left,
            cropY: crop.bounds.top,
            cropWidth: crop.bounds.width,
            cropHeight: crop.bounds.height,
            outputWidth: crop.outputWidth,
            outputHeight: crop.outputHeight,
            coordinateSpace: 'crop_pixels_to_orientation_corrected_source_pixels'
          });
          croppedContactLandmarksNorm = normalizeLandmarksInCrop(contactLandmarksNorm, detailContactFrame, crop.bounds);
          croppedContactPointNorm = contactPointNorm
            ? normalizeLandmarksInCrop({ head: contactPointNorm }, detailContactFrame, crop.bounds).head ?? null
            : null;
          croppedBatHandleNorm = batHandleNorm
            ? normalizeLandmarksInCrop({ head: batHandleNorm }, detailContactFrame, crop.bounds).head ?? null
            : null;
          croppedBatToeNorm = batToeNorm
            ? normalizeLandmarksInCrop({ head: batToeNorm }, detailContactFrame, crop.bounds).head ?? null
            : null;
        }
      } catch (error) {
        console.warn('Could not crop the OpenAI contact frame for pose overlay:', error);
      }
    }

    const frameIndex = contactTimestampSeconds === null
      ? null
      : detailContactFrame?.frameIndex ?? nearestPresentationFrame(metadata.presentationTimestampsSeconds, contactTimestampSeconds)?.index ?? null;
    const originalReportFrames = await extractOriginalSourceFrames(inputPath, workDir, [
      ...phaseReviewFrames.map(frame => frame.frameIndex),
      ...batLandmarksByFrame.map(frame => frame.frameIndex),
      ...poseSequenceFrames.map(frame => frame.frameIndex),
      ...(frameIndex === null ? [] : [frameIndex])
    ]);
    for (const phaseFrame of phaseReviewFrames) {
      const original = originalReportFrames.get(phaseFrame.frameIndex);
      if (original) phaseFrame.imageDataUrl = original.imageDataUrl;
    }
    const sourceFrameImages = [...originalReportFrames.entries()].map(([sourceFrameIndex, sourceFrame]) => ({
      frameIndex: sourceFrameIndex,
      timestampSeconds: metadata.presentationTimestampsSeconds[sourceFrameIndex],
      imageDataUrl: sourceFrame.imageDataUrl
    }));
    if (contactImageDataUrl && frameIndex !== null) {
      contactImageDataUrl = originalReportFrames.get(frameIndex)?.imageDataUrl ?? contactImageDataUrl;
    }
    const fallbackContactIndex = closestOverviewFrame?.sampleIndex ?? Math.floor(overviewFrames.length / 2);
    const phaseDefinitions = [
      { label: 'Preparation', key: 'preparation', fallback: 0 },
      { label: 'Downswing', key: 'downswing', fallback: Math.max(0, fallbackContactIndex - 2) },
      { label: 'Near contact', key: 'contact', fallback: fallbackContactIndex },
      { label: 'Follow-through', key: 'finish', fallback: overviewFrames.length - 1 }
    ];
    const sequencePhases: SequencePhase[] = phaseDefinitions.map(({ label, key, fallback }) => {
      if (key === 'contact' && detailContactFrame) {
        return { label, frame: { ...detailContactFrame, playerBoxNorm: contactPlayerBoxNorm } };
      }
      const overviewPhase = overview.phases.find(phase => phase.phase === key && phase.sampleIndex !== null);
      const sample = overviewPhase?.sampleIndex === null || overviewPhase?.sampleIndex === undefined
        ? overviewFrames[fallback]
        : overviewFrames[overviewPhase.sampleIndex];
      return { label, frame: { ...sample, playerBoxNorm: overviewPhase?.playerBoxNorm ?? null } };
    });
    const jointFrame = detailContactFrame || (closestOverviewFrame === null
      ? overviewFrames[Math.floor(overviewFrames.length / 2)]
      : closestOverviewFrame);
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
    const sourceSha256 = createHash('sha256').update(videoBuffer).digest('hex');
    return {
      provider: 'openai',
      model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      sourceSha256,
      requestMetadata: {
        shotType: options.shotType ?? 'unknown',
        batterHandedness: options.batterHandedness ?? 'unknown',
        cameraView: options.cameraView ?? 'unknown',
        playbackSpeed: options.playbackSpeed ?? 'unknown',
        captureFps: options.captureFps ?? null,
        priorities
      },
      video: { ...videoMetadata, sampledOverviewFrames: overviewFrames.length },
      frameManifest,
      shotCandidates,
      shotAssessments,
      jointAngles,
      batAngles,
      contactBatAngle,
      phaseReviewFrames,
      sourceFrameImages,
      batLandmarksByFrame,
      annotations,
      executionLog: {
        stages: ['hash_source_video', 'probe_video', 'sample_overview_frames', 'openai_overview', ...(candidate ? ['decode_all_contact_window_pts_frames', 'include_overview_phase_context', 'openai_detailed_analysis'] : []), ...(shotAssessments.length > 1 ? ['analyze_additional_shots'] : []), 'calculate_projected_joint_angles', 'calculate_projected_bat_angles', 'render_review_svgs'],
        toolVersions: { node: process.version, ffmpeg: ffmpegVersion, ffprobe: ffprobeVersion, sharp: 'pending_artifact_renderer' },
        modelRequested: model,
        modelReturned: visionCalls.at(-1)?.model ?? model,
        responseIds: visionCalls.flatMap(call => call.responseIds),
        usage,
        sourceSha256,
        frameManifest,
        cropTransforms,
        errors: [],
        outputs: []
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
      croppedBatHandleNorm,
      croppedBatToeNorm,
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
      additionalEvidence,
      kinetics,
      capeKinetics: emptyOpenAiCapeKinetics('not_requested')
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
