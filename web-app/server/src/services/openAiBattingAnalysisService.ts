import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import OpenAI from 'openai';

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
}

interface SampledFrame {
  sampleIndex: number;
  timestampSeconds: number;
  dataUrl: string;
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
  phases: Array<{ phase: string; sampleIndex: number | null; evidence: string }>;
  limitations: string[];
}

interface DetailedAnalysis {
  contactStatus: ContactStatus;
  contactSampleIndex: number | null;
  contactConfidence: number;
  contactEvidence: string;
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
  video: VideoMetadata & { sampledOverviewFrames: number };
  contact: {
    status: ContactStatus;
    frameIndex: number | null;
    timestampSeconds: number | null;
    confidence: number;
    evidence: string;
    imageDataUrl: string | null;
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

function fraction(value: string | undefined): number {
  if (!value) return 0;
  const [numerator, denominator] = value.split('/').map(Number);
  return denominator ? numerator / denominator : numerator;
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
    '-show_entries', 'stream=width,height,avg_frame_rate,r_frame_rate:format=duration',
    '-of', 'json', videoPath
  ], 20_000);
  let probe: { streams?: Array<Record<string, unknown>>; format?: { duration?: string } };
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
  return { durationSeconds, width, height, fps: fps > 0 ? fps : 30 };
}

async function sampleFrames(
  videoPath: string,
  directory: string,
  options: { startSeconds: number; durationSeconds: number; fps: number; maxFrames: number; prefix: string; dimension: number }
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
    frames.push({
      sampleIndex,
      timestampSeconds: Math.min(options.startSeconds + sampleIndex / options.fps, options.startSeconds + options.durationSeconds),
      dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`
    });
  }
  if (!frames.length) throw new OpenAiBattingAnalysisError(422, 'video_frames_unavailable', 'No video frames could be extracted.');
  return frames;
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
      )) && typeof (phase as Record<string, unknown>).evidence === 'string'
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
  validator: (value: unknown) => value is T
): Promise<T> {
  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a cautious cricket batting coach. Analyze only visible evidence. Do not invent measurements, forces, 3D positions, or contact that cannot be seen. Separate visual observation from coaching interpretation, state uncertainty, and return valid JSON only.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...frames.flatMap(frame => [
              { type: 'text' as const, text: `Sample ${frame.sampleIndex}; approximate source time ${frame.timestampSeconds.toFixed(3)} seconds.` },
              { type: 'image_url' as const, image_url: { url: frame.dataUrl, detail: 'low' as const } }
            ])
          ]
        }
      ]
    });
    const text = response.choices[0]?.message?.content;
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

export async function analyzeBattingVideoWithOpenAI(videoBuffer: Buffer): Promise<OpenAiBattingAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAiBattingAnalysisError(503, 'openai_not_configured', 'OpenAI analysis is not configured. Set OPENAI_API_KEY on the server.');

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecco-openai-video-'));
  const inputPath = path.join(workDir, 'input-video');
  try {
    await fs.writeFile(inputPath, videoBuffer);
    const metadata = await probeVideo(inputPath);
    const overviewFps = Math.min(2, (MAX_OVERVIEW_FRAMES - 1) / metadata.durationSeconds);
    const overviewFrames = await sampleFrames(inputPath, workDir, {
      startSeconds: 0,
      durationSeconds: metadata.durationSeconds,
      fps: overviewFps,
      maxFrames: MAX_OVERVIEW_FRAMES,
      prefix: 'overview',
      dimension: 768
    });

    const model = process.env.OPENAI_VIDEO_ANALYSIS_MODEL?.trim() || 'gpt-4.1-mini';
    const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 1 });
    const overviewPrompt = `Review this batting video as an evidence-based cricket coach. The frames are uniformly sampled across the clip and labeled with sample index and approximate source time. Return one JSON object with this exact shape:
{
  "contactCandidateSampleIndex": integer from the supplied overview samples or null,
  "contactCandidateConfidence": number from 0 to 1,
  "contactCandidateEvidence": "what is visibly happening at the candidate; say if impact is unclear",
  "summary": "brief cautious assessment of the batting technique",
  "observations": [{"title":"short label","observation":"visible evidence only","coachingImplication":"practical interpretation","confidence":"low|moderate|high"}],
  "phases": [{"phase":"preparation|downswing|near_contact|follow_through","sampleIndex":integer or null,"evidence":"visible cue"}],
  "limitations": ["specific visibility or viewpoint limitations"]
}
Pick the sample closest to visible bat-ball contact, not merely the end of the swing. Use null if no candidate can reasonably be identified. Describe contact as likely/uncertain in the evidence when ball and bat are blurred, occluded, or too small. Do not claim exact joint angles, forces, weight transfer, or 3D movement from this overview.`;
    const overview = await requestVisionJson(client, model, overviewPrompt, overviewFrames, value => isOverview(value, overviewFrames.length));

    let contactStatus: ContactStatus = overview.contactCandidateSampleIndex === null ? 'NOT_VISIBLE' : 'LIKELY';
    let contactTimestampSeconds: number | null = overview.contactCandidateSampleIndex === null
      ? null
      : overviewFrames[overview.contactCandidateSampleIndex].timestampSeconds;
    let contactConfidence = overview.contactCandidateConfidence;
    let contactEvidence = overview.contactCandidateEvidence;
    let contactImageDataUrl: string | null = overview.contactCandidateSampleIndex === null
      ? null
      : overviewFrames[overview.contactCandidateSampleIndex].dataUrl;
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
        frameIndex: sample ? Math.round(sample.timestampSeconds * metadata.fps) : null,
        timestampSeconds: sample?.timestampSeconds ?? null,
        evidence: phase.evidence
      };
    });

    if (overview.contactCandidateSampleIndex !== null) {
      const candidate = overviewFrames[overview.contactCandidateSampleIndex];
      const startSeconds = Math.max(0, candidate.timestampSeconds - CONTACT_WINDOW_SECONDS / 2);
      const windowSeconds = Math.min(CONTACT_WINDOW_SECONDS, metadata.durationSeconds - startSeconds);
      const detailFps = Math.max(1, Math.min(DETAIL_FPS, metadata.fps, (MAX_DETAIL_FRAMES - 1) / Math.max(windowSeconds, 0.05)));
      const detailFrames = await sampleFrames(inputPath, workDir, {
        startSeconds,
        durationSeconds: windowSeconds,
        fps: detailFps,
        maxFrames: MAX_DETAIL_FRAMES,
        prefix: 'contact-detail',
        dimension: MAX_FRAME_DIMENSION
      });
      const detailPrompt = `The overview pass proposed a likely contact near ${candidate.timestampSeconds.toFixed(3)} seconds. These higher-resolution frames cover a short interval around that time, with a sample index and approximate timestamp for each. Return JSON with this exact shape:
{
  "contactStatus":"DETECTED|LIKELY|UNCERTAIN|NOT_VISIBLE",
  "contactSampleIndex":integer from these detail samples or null,
  "contactConfidence":number from 0 to 1,
  "contactEvidence":"specific visual evidence for/against ball meeting bat",
  "summary":"concise batting assessment grounded in the overview and detail frames",
  "observations":[{"title":"short label","observation":"visible evidence","coachingImplication":"practical interpretation","confidence":"low|moderate|high"}],
  "errors":[{"title":"specific correctable error","observation":"visible evidence","coachingImplication":"why it matters/how to correct","confidence":"low|moderate|high"}],
  "strengths":["visible strengths only"],
  "priorityCue":"one short coaching cue or empty string",
  "drill":{"title":"simple drill or empty string","instructions":["safe specific steps"],"rationale":"what it tests"},
  "limitations":["what cannot be determined from this footage"]
}
Set DETECTED only if impact is visibly identifiable; LIKELY when timing is plausible but the precise collision is blurred; otherwise use UNCERTAIN or NOT_VISIBLE and null sample index if no frame can be selected. Do not infer quantitative biomechanics, forces, 3D position, or a technical fault solely from a front-on projected offset. Distinguish an observation from its coaching interpretation.`;
      const detailed = await requestVisionJson(client, model, detailPrompt, detailFrames, value => isDetailed(value, detailFrames.length));
      contactStatus = detailed.contactStatus;
      contactConfidence = detailed.contactConfidence;
      contactEvidence = detailed.contactEvidence;
      summary = detailed.summary;
      observations = detailed.observations;
      errors = detailed.errors;
      strengths = detailed.strengths;
      priorityCue = detailed.priorityCue;
      drill = detailed.drill;
      limitations = [...new Set([...limitations, ...detailed.limitations])];
      if (detailed.contactSampleIndex !== null) {
        const selected = detailFrames[detailed.contactSampleIndex];
        contactTimestampSeconds = selected.timestampSeconds;
        contactImageDataUrl = selected.dataUrl;
      } else if (contactStatus === 'NOT_VISIBLE' || contactStatus === 'UNCERTAIN') {
        contactTimestampSeconds = null;
        contactImageDataUrl = null;
      }
    }

    const frameIndex = contactTimestampSeconds === null ? null : Math.round(contactTimestampSeconds * metadata.fps);
    return {
      provider: 'openai',
      model,
      video: { ...metadata, sampledOverviewFrames: overviewFrames.length },
      contact: {
        status: contactStatus,
        frameIndex,
        timestampSeconds: contactTimestampSeconds,
        confidence: contactConfidence,
        evidence: contactEvidence,
        imageDataUrl: contactImageDataUrl
      },
      phases,
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
