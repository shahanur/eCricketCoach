import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
const MAX_DETAIL_FRAMES = 16;
const OVERVIEW_FPS = 2;
const CONTACT_WINDOW_SECONDS = 0.7;
const DETAIL_FPS = 20;
const MAX_FRAME_DIMENSION = 960;
const OPENAI_TIMEOUT_MS = 120_000;

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
}

interface DetailedAnalysis {
  contactStatus: ContactStatus;
  contactSampleIndex: number | null;
  contactConfidence: number;
  contactEvidence: string;
  contactPointNorm: NormalizedPoint | null;
  playerBoxNorm: NormalizedBox | null;
  landmarksNorm: EstimatedLandmarks;
  summary: string;
  observations: Observation[];
  errors: Observation[];
  strengths: string[];
  priorityCue: string;
  drill: { title: string; instructions: string[]; rationale: string };
  limitations: string[];
}

export interface OpenAiBattingAnalysis {
  provider: 'openai';
  model: string;
  video: Omit<VideoMetadata, 'presentationTimestampsSeconds'> & { sampledOverviewFrames: number };
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
  observations: Observation[];
  errors: Observation[];
  strengths: string[];
  priorityCue: string;
  drill: DetailedAnalysis['drill'];
  limitations: string[];
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
  const item = value as Record<string, unknown>;
  return typeof item.title === 'string' && typeof item.observation === 'string' &&
    typeof item.coachingImplication === 'string' && isConfidence(item.confidence);
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

function isOverview(value: unknown, frameCount: number): value is OverviewAnalysis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const index = item.contactCandidateSampleIndex;
  const phases = item.phases;
  const limitations = item.limitations;
  return (index === null || (Number.isInteger(index) && Number(index) >= 0 && Number(index) < frameCount)) &&
    typeof item.contactCandidateConfidence === 'number' && item.contactCandidateConfidence >= 0 && item.contactCandidateConfidence <= 1 &&
    typeof item.contactCandidateEvidence === 'string' && typeof item.summary === 'string' &&
    Array.isArray(item.observations) && item.observations.every(isObservation) &&
    Array.isArray(phases) && phases.every(phase => Boolean(
      phase && typeof phase === 'object' && typeof (phase as Record<string, unknown>).phase === 'string' &&
      ((phase as Record<string, unknown>).sampleIndex === null || (
        Number.isInteger((phase as Record<string, unknown>).sampleIndex) &&
        Number((phase as Record<string, unknown>).sampleIndex) >= 0 &&
        Number((phase as Record<string, unknown>).sampleIndex) < frameCount
      )) && typeof (phase as Record<string, unknown>).evidence === 'string' &&
      isNormalizedBox((phase as Record<string, unknown>).playerBoxNorm)
    )) && Array.isArray(limitations) && limitations.every(entry => typeof entry === 'string');
}

function isDetailed(value: unknown, frameCount: number): value is DetailedAnalysis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const index = item.contactSampleIndex;
  const statuses: ContactStatus[] = ['DETECTED', 'LIKELY', 'UNCERTAIN', 'NOT_VISIBLE'];
  const drill = item.drill as Record<string, unknown> | undefined;
  return statuses.includes(item.contactStatus as ContactStatus) &&
    (index === null || (Number.isInteger(index) && Number(index) >= 0 && Number(index) < frameCount)) &&
    typeof item.contactConfidence === 'number' && item.contactConfidence >= 0 && item.contactConfidence <= 1 &&
    typeof item.contactEvidence === 'string' && typeof item.summary === 'string' &&
    isNormalizedPoint(item.contactPointNorm) && isNormalizedBox(item.playerBoxNorm) &&
    isEstimatedLandmarks(item.landmarksNorm) &&
    Array.isArray(item.observations) && item.observations.every(isObservation) &&
    Array.isArray(item.errors) && item.errors.every(isObservation) &&
    Array.isArray(item.strengths) && item.strengths.every(value => typeof value === 'string') &&
    typeof item.priorityCue === 'string' && drill !== undefined && typeof drill.title === 'string' &&
    Array.isArray(drill.instructions) && drill.instructions.every(value => typeof value === 'string') &&
    typeof drill.rationale === 'string' && Array.isArray(item.limitations) && item.limitations.every(value => typeof value === 'string');
}

async function requestVisionJson<T>(
  client: OpenAI,
  model: string,
  prompt: string,
  frames: SampledFrame[],
  validator: (value: unknown) => value is T,
  detail: 'low' | 'high' = 'low'
): Promise<T> {
  try {
    const response = await client.responses.create({
      model,
      max_output_tokens: 3000,
      reasoning: { effort: 'medium' },
      text: { format: { type: 'json_object' } },
      input: [
        {
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'You are a cautious cricket batting coach. Analyze only visible evidence. Do not invent measurements, forces, 3D positions, or contact that cannot be seen. Landmark coordinates are approximate visual estimates, not measurements. Separate visual observation from coaching interpretation, state uncertainty, and return valid JSON only.'
          }]
        },
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
    const text = response.output_text;
    if (!text) throw new Error('OpenAI returned an empty analysis.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('OpenAI returned invalid JSON.');
    }
    if (!validator(parsed)) throw new Error('OpenAI returned analysis in an unexpected format.');
    return parsed;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw new OpenAiBattingAnalysisError(503, 'openai_auth_failed', 'OpenAI authentication failed. Check the server API key.');
    }
    if (status === 429) {
      throw new OpenAiBattingAnalysisError(429, 'openai_rate_limited', 'OpenAI is rate limiting requests. Please try again shortly.');
    }
    if (error instanceof OpenAiBattingAnalysisError) throw error;
    console.error('OpenAI batting analysis request failed:', error);
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
    const overviewFps = Math.min(2, (MAX_OVERVIEW_FRAMES - 1) / metadata.durationSeconds);
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
    const overviewPrompt = `Review this batting video as an evidence-based cricket coach. The frames are uniformly sampled across the clip and labeled with sample index, original presentation timestamp, and decoded source frame index. Return one JSON object with this exact shape:
{
  "contactCandidateSampleIndex": integer from the supplied overview samples or null,
  "contactCandidateConfidence": number from 0 to 1,
  "contactCandidateEvidence": "what is visibly happening at the candidate; say if impact is unclear",
  "summary": "brief cautious assessment of the batting technique",
  "observations": [{"title":"short label","observation":"visible evidence only","coachingImplication":"practical interpretation","confidence":"low|moderate|high"}],
  "phases": [{"phase":"preparation|downswing|near_contact|follow_through","sampleIndex":integer or null,"evidence":"visible cue","playerBoxNorm":{"left":number,"top":number,"right":number,"bottom":number} or null}],
  "limitations": ["specific visibility or viewpoint limitations"]
}
For each phase, estimate the full visible batter box normalized to the image (0..1, top-left origin); include padding-free player bounds and use null if the batter cannot be bounded. Pick the sample closest to visible bat-ball contact, not merely the end of the swing. Use null if no candidate can reasonably be identified. Describe contact as likely/uncertain in the evidence when ball and bat are blurred, occluded, or too small. Do not claim exact joint angles, forces, weight transfer, or 3D movement from this overview.`;
    const overview = await requestVisionJson(client, model, overviewPrompt, overviewFrames, value => isOverview(value, overviewFrames.length));

    const aiCandidate = overview.contactCandidateSampleIndex === null
      ? null
      : overviewFrames[overview.contactCandidateSampleIndex];
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
    let detailContactFrame: SampledFrame | null = null;
    let poseSequenceFrames: OpenAiBattingAnalysis['poseSequenceFrames'] = [];
    let summary = overview.summary;
    let observations = overview.observations;
    let errors: Observation[] = [];
    let strengths: string[] = [];
    let priorityCue = '';
    let drill: DetailedAnalysis['drill'] = { title: '', instructions: [], rationale: '' };
    let limitations = overview.limitations;
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
      const detailFps = Math.max(1, Math.min(DETAIL_FPS, metadata.fps, (MAX_DETAIL_FRAMES - 1) / Math.max(windowSeconds, 0.05)));
      const detailFrames = await sampleFrames(inputPath, workDir, {
        startSeconds,
        durationSeconds: windowSeconds,
        fps: detailFps,
        maxFrames: MAX_DETAIL_FRAMES,
        prefix: 'contact-detail',
        dimension: MAX_FRAME_DIMENSION,
        presentationTimestampsSeconds: metadata.presentationTimestampsSeconds
      });
      detailContactFrame = detailFrames.reduce((closest, frame) =>
        Math.abs(frame.timestampSeconds - candidate.timestampSeconds) < Math.abs(closest.timestampSeconds - candidate.timestampSeconds) ? frame : closest
      );
      contactImageDataUrl = detailContactFrame.imageDataUrl;
      const contactReferenceInstruction = manualTimestamp === undefined
        ? `The overview pass proposed a likely contact near ${candidate.timestampSeconds.toFixed(6)} seconds.`
        : `A coach manually selected ${candidate.timestampSeconds.toFixed(6)} seconds as the contact-time reference. Treat that selected moment as the center of review, inspect the neighboring frames for confirmation, and do not silently replace it with a distant event.`;
      const detailPrompt = `${contactReferenceInstruction} These higher-resolution frames cover a short interval around that time, with sample index, original PTS and source frame index for each. Return JSON with this exact shape:
{
  "contactStatus":"DETECTED|LIKELY|UNCERTAIN|NOT_VISIBLE",
  "contactSampleIndex":integer from these detail samples or null,
  "contactConfidence":number from 0 to 1,
  "contactEvidence":"specific visual evidence for/against ball meeting bat",
  "contactPointNorm":{"x":number,"y":number} or null,
  "playerBoxNorm":{"left":number,"top":number,"right":number,"bottom":number} or null,
  "landmarksNorm":{"head":{"x":number,"y":number} or null,"leftShoulder":{"x":number,"y":number} or null,"rightShoulder":{"x":number,"y":number} or null,"leftElbow":{"x":number,"y":number} or null,"rightElbow":{"x":number,"y":number} or null,"leftWrist":{"x":number,"y":number} or null,"rightWrist":{"x":number,"y":number} or null,"leftHip":{"x":number,"y":number} or null,"rightHip":{"x":number,"y":number} or null,"leftKnee":{"x":number,"y":number} or null,"rightKnee":{"x":number,"y":number} or null,"leftAnkle":{"x":number,"y":number} or null,"rightAnkle":{"x":number,"y":number} or null,"frontToe":{"x":number,"y":number} or null},
  "summary":"concise batting assessment grounded in the overview and detail frames",
  "observations":[{"title":"short label","observation":"visible evidence","coachingImplication":"practical interpretation","confidence":"low|moderate|high"}],
  "errors":[{"title":"specific correctable error","observation":"visible evidence","coachingImplication":"why it matters/how to correct","confidence":"low|moderate|high"}],
  "strengths":["visible strengths only"],
  "priorityCue":"one short coaching cue or empty string",
  "drill":{"title":"simple drill or empty string","instructions":["safe specific steps"],"rationale":"what it tests"},
  "limitations":["what cannot be determined from this footage"]
}
Coordinates are normalized to the full detail image (0..1, origin at top-left); estimate them only when the feature is visible, otherwise use null. Return all landmark keys. Set DETECTED only if impact is visibly identifiable; LIKELY when timing is plausible but the precise collision is blurred; otherwise use UNCERTAIN or NOT_VISIBLE and null sample index if no frame can be selected. Do not infer quantitative biomechanics, forces, 3D position, or a technical fault solely from a front-on projected offset. Distinguish an observation from its coaching interpretation.`;
      const detailed = await requestVisionJson(client, model, detailPrompt, detailFrames, value => isDetailed(value, detailFrames.length), 'high');
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
    return {
      provider: 'openai',
      model,
      video: { ...videoMetadata, sampledOverviewFrames: overviewFrames.length },
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
      croppedContactLandmarksNorm,
      croppedContactPointNorm,
      poseSequenceFrames,
      phases,
      visualOutputs,
      summary,
      observations,
      errors,
      strengths,
      priorityCue,
      drill,
      limitations
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
