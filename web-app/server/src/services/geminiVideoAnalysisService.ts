import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { AiAnalysisResult } from './aiAnalysisService.js';
import { withRetry, isRateLimitOrOverloadedError, isQuotaExceededError } from '../utils/retry.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Requests above ~18MB should use the Files API instead of inline base64 to stay within
// Gemini's request size limits.
const INLINE_SIZE_LIMIT = 15 * 1024 * 1024;
// Gemini occasionally returns transient 429 "rate limited" / 503 "high demand" errors;
// retry several times with exponential backoff + jitter before giving up, rather than
// masking the failure behind fake/mock data or crashing the request.
const MAX_RETRIES = 5;
// Per-request ceiling so a stalled Gemini call fails instead of leaving the UI waiting indefinitely.
const REQUEST_TIMEOUT_MS = 45000;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 20000;

// Fallback model names used only if GEMINI_MODEL isn't set AND the live model-discovery
// call (below) fails entirely (e.g. no network). Google periodically retires older model
// aliases, so these are tried in order and skipped automatically if unavailable.
const STATIC_FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];

// Dynamic model resolution: rather than hard-coding a single GEMINI_MODEL, we ask the Gemini
// API itself which multimodal models currently support generateContent, rank them (preferring
// fast "flash" models, "latest" aliases, and higher version numbers), and cache the ranked list
// for an hour. If the Gemini model Google recommends changes or an alias is retired, the app
// picks it up automatically on the next cache refresh instead of needing a manual env var update.
let cachedModelCandidates: string[] = [];
let cachedCandidatesFetchedAt = 0;
let lastUsedModel: string | null = null;
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function rankModelName(name: string): number {
  let score = 0;
  if (/flash/i.test(name)) score += 100;
  else if (/pro/i.test(name)) score += 50;
  if (/latest/i.test(name)) score += 25;
  const versionMatch = name.match(/(\d+(?:\.\d+)?)/);
  if (versionMatch) score += parseFloat(versionMatch[1]);
  return score;
}

async function fetchAvailableGeminiModels(): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
  if (!res.ok) {
    throw new Error(`Failed to list Gemini models (HTTP ${res.status})`);
  }
  const data: any = await res.json();
  const models: any[] = Array.isArray(data?.models) ? data.models : [];

  return models
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => String(m.name || '').replace(/^models\//, ''))
    .filter(name => name && !/embedding|aqa|vision$|tts|image|audio|live|robotics|computer|omni|lyria|deep-research|customtools/i.test(name));
}

/**
 * Returns an ordered list of Gemini model names to try, best candidate first. Honors an explicit
 * GEMINI_MODEL env var override if set; otherwise dynamically discovers + ranks currently
 * available models via the Gemini API (cached for an hour), falling back to a static list only
 * if discovery itself fails (e.g. no network connectivity).
 */
async function resolveModelCandidates(): Promise<string[]> {
  const envOverride = process.env.GEMINI_MODEL?.trim();
  const discovered = await discoverModelCandidates();
  // The override is tried first, but discovered models remain as fallbacks if it stalls or is overloaded.
  return envOverride ? [envOverride, ...discovered.filter(name => name !== envOverride)] : discovered;
}

async function discoverModelCandidates(): Promise<string[]> {
  const now = Date.now();
  if (cachedModelCandidates.length > 0 && now - cachedCandidatesFetchedAt < MODEL_CACHE_TTL_MS) {
    return cachedModelCandidates;
  }

  try {
    const models = await fetchAvailableGeminiModels();
    if (models.length === 0) {
      throw new Error('Gemini returned no usable models.');
    }
    const ranked = models.sort((a, b) => rankModelName(b) - rankModelName(a));
    cachedModelCandidates = ranked;
    cachedCandidatesFetchedAt = now;
    console.log(`Gemini: dynamically resolved model candidates (best first): ${ranked.slice(0, 5).join(', ')}`);
    return ranked;
  } catch (err) {
    console.warn('Gemini: dynamic model discovery failed, falling back to static defaults.', err instanceof Error ? err.message : err);
    cachedModelCandidates = STATIC_FALLBACK_MODELS;
    cachedCandidatesFetchedAt = now;
    return cachedModelCandidates;
  }
}

type Discipline = 'BATTING' | 'BOWLING' | 'KEEPING' | 'FIELDING';
type TrainingContext = 'INDIVIDUAL' | 'GROUP';

function buildPrompt(discipline: Discipline, context: TrainingContext): string {
  return `You are an elite cricket biomechanics coach and computer-vision analyst reviewing a short training clip.

Carefully watch the uploaded video and analyse the player's technique for the discipline: ${discipline} (training context: ${context}).

Respond with ONLY a single valid JSON object (no markdown fences, no commentary, no extra text) matching EXACTLY this shape:
{
  "overallScore": number between 0 and 100,
  "detectedIssues": string[] (1 to 3 concise, specific technical flaws you actually observed in the footage),
  "biomechanicalMetrics": {
    "headPosition": string,
    "footAlignment": string,
    "backliftAngle": string (only include for BATTING, omit otherwise),
    "releasePoint": string (only include for BOWLING, omit otherwise)
  },
  "recommendedDrills": [
    {
      "title": string,
      "discipline": "${discipline}",
      "durationMinutes": number,
      "context": "${context}",
      "isNewRecommendation": boolean
    }
  ] (1 to 2 targeted corrective drills)
}

Base every observation strictly on what is visually evident in the video (posture, head position, foot/base alignment, swing or arm path, release point, balance, follow-through). Be specific and realistic rather than generic. If the clip quality makes an exact measurement impossible, give your best expert visual estimate rather than omitting the field.`;
}

function extractJson(text: string): any {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Gemini response did not contain a JSON object.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function isValidResult(data: any): data is AiAnalysisResult {
  return (
    data &&
    typeof data.overallScore === 'number' &&
    Array.isArray(data.detectedIssues) &&
    data.biomechanicalMetrics &&
    typeof data.biomechanicalMetrics.headPosition === 'string' &&
    typeof data.biomechanicalMetrics.footAlignment === 'string' &&
    Array.isArray(data.recommendedDrills)
  );
}

export class GeminiVideoAnalysisService {
  static isConfigured(): boolean {
    return Boolean(GEMINI_API_KEY);
  }

  /**
   * Analyzes a real cricket video clip using Gemini's multimodal video understanding.
   * Throws a real error if Gemini is not configured, the request fails, or the response is
   * malformed — there is no mock/heuristic fallback, since every result must reflect an actual
   * AI analysis of the uploaded footage.
   */
  static async analyzeVideoBuffer(
    buffer: Buffer,
    mimeType: string,
    discipline: Discipline,
    context: TrainingContext = 'INDIVIDUAL'
  ): Promise<AiAnalysisResult> {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini is not configured on this server. Set GEMINI_API_KEY to enable video analysis.');
    }

    const prompt = buildPrompt(discipline, context);

    let videoPart: any;

    if (buffer.length <= INLINE_SIZE_LIMIT) {
      videoPart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType
        }
      };
    } else {
      // Larger clips must go through the Gemini Files API (still free-tier) rather than inline base64.
      const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);
      const tmpPath = path.join(os.tmpdir(), `ecc_${crypto.randomBytes(8).toString('hex')}.mp4`);
      fs.writeFileSync(tmpPath, buffer);
      try {
        const uploadResult = await fileManager.uploadFile(tmpPath, {
          mimeType,
          displayName: 'eCricketCoach training clip'
        });
        let uploadedFile = uploadResult.file;
        let attempts = 0;
        while (uploadedFile.state === FileState.PROCESSING && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          uploadedFile = await fileManager.getFile(uploadedFile.name);
          attempts += 1;
        }
        if (uploadedFile.state === FileState.FAILED) {
          throw new Error('Gemini failed to process the uploaded video file.');
        }
        videoPart = {
          fileData: {
            fileUri: uploadedFile.uri,
            mimeType: uploadedFile.mimeType
          }
        };
      } finally {
        fs.unlink(tmpPath, () => {});
      }
    }

    return GeminiVideoAnalysisService.generateJson([prompt, videoPart], isValidResult, 'Gemini video analysis');
  }

  /**
   * Sends a prompt (text and optional media parts) to Gemini and returns the validated JSON response.
   * Tries the dynamically-resolved model candidates in ranked order, retrying transient 429/503
   * errors with backoff and falling through to the next model when one is unavailable or out of
   * quota. There is no mock fallback: failures surface as errors (quota errors are prefixed with
   * GEMINI_QUOTA_EXCEEDED so routes can show an actionable message).
   */
  static async generateJson<T>(parts: any[], isValid: (data: any) => data is T, label: string): Promise<T> {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini is not configured on this server. Set GEMINI_API_KEY to enable AI analysis.');
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const candidates = (await resolveModelCandidates()).slice(0, 4);
    let lastError: unknown = null;

    for (let i = 0; i < candidates.length; i++) {
      const modelName = candidates[i];
      const model = genAI.getGenerativeModel({ model: modelName });

      try {
        const parsed = await withRetry(
          async attempt => {
            // The SDK's own `timeout` option makes requests hang in this runtime, so race against a timer instead.
            let timer: NodeJS.Timeout | undefined;
            const result = await Promise.race([
              model.generateContent(parts),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
              })
            ]).finally(() => clearTimeout(timer));
            const data = extractJson(result.response.text());
            if (!isValid(data)) {
              throw new Error(`Gemini returned a response that did not match the expected ${label} shape.`);
            }
            console.log(`${label} succeeded (attempt ${attempt}/${MAX_RETRIES}, model ${modelName}):`, JSON.stringify(data));
            return data;
          },
          {
            maxRetries: MAX_RETRIES,
            baseDelayMs: BASE_DELAY_MS,
            maxDelayMs: MAX_DELAY_MS,
            // Hard quota exhaustion won't reset within seconds, so fall through to the next model instead.
            isRetryable: err => isRateLimitOrOverloadedError(err) && !isQuotaExceededError(err),
            label
          }
        );

        lastUsedModel = modelName;
        return parsed;
      } catch (err: any) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const isModelUnavailable = /not found|404|is not supported|does not support|unknown model/i.test(message);
        const isQuotaIssue = isQuotaExceededError(err);
        const isOverloaded = isRateLimitOrOverloadedError(err) || /abort|timed? ?out|fetch failed/i.test(message);
        const hasMoreCandidates = i < candidates.length - 1;

        if ((isQuotaIssue || isModelUnavailable || isOverloaded) && hasMoreCandidates) {
          console.warn(`Gemini model "${modelName}" ${isQuotaIssue ? 'has exhausted its quota' : `is unavailable (${message})`}. Trying next candidate: ${candidates[i + 1]}`);
          continue;
        }

        console.error(`${label} failed after all retries (model ${modelName}):`, err);
        if (isQuotaIssue) {
          throw new Error(`GEMINI_QUOTA_EXCEEDED: All available Gemini models have reached their current usage quota. ${message}`);
        }
        throw new Error(`${label} failed: ${message}`);
      }
    }

    const finalMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
    if (isQuotaExceededError(lastError)) {
      throw new Error(`GEMINI_QUOTA_EXCEEDED: All available Gemini models have reached their current usage quota. ${finalMessage}`);
    }
    throw new Error(`${label} failed: ${finalMessage}`);
  }
  /** Returns the Gemini model name actually used for the most recent successful analysis. */
  static getLastUsedModel(): string | null {
    return lastUsedModel;
  }
}
