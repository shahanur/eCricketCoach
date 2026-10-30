import { playerProfileOptions, PlayerProfileError } from './playerProfile.js';

export const roadmapPolicyVersion = 'provisional-practice-v2';
export const roadmapDisciplines = playerProfileOptions.disciplines;
export type RoadmapDiscipline = typeof roadmapDisciplines[number];
export type RoadmapAnswers = Record<RoadmapDiscipline, { focus: string; confidence: number }>;
export type RoadmapDrill = { id: string; title: string; discipline: string; instructions: string | null; duration: number };
export type RoadmapRecommendation = {
  discipline: RoadmapDiscipline;
  objective: string;
  proposedStage: string | null;
  evidence: string[];
  drills: { drillId: string; reason: string }[];
};

export function roadmapError(status: number, code: string, message: string): never {
  throw new PlayerProfileError(status, code, message);
}

export function objectInput(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key)) ||
      keys.some(key => !Object.hasOwn(value, key))) {
    roadmapError(400, 'INVALID_ROADMAP_INPUT', 'Check your roadmap details and try again.');
  }
  return value as Record<string, unknown>;
}

export function textInput(value: unknown, maximum: number, multiline = false): string {
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum || controls.test(value)) {
    roadmapError(400, 'INVALID_ROADMAP_INPUT', 'Check your roadmap details and try again.');
  }
  return value.trim();
}

export function versionInput(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    roadmapError(400, 'INVALID_ROADMAP_VERSION', 'Refresh your roadmap and try again.');
  }
  return value;
}

export function validateAnswers(value: unknown): RoadmapAnswers {
  const record = objectInput(value, [...roadmapDisciplines]);
  const entries = roadmapDisciplines.map(discipline => {
    const answer = objectInput(record[discipline], ['focus', 'confidence']);
    if (typeof answer.confidence !== 'number' || !Number.isInteger(answer.confidence) ||
        answer.confidence < 1 || answer.confidence > 5) {
      roadmapError(400, 'INVALID_CONFIDENCE', 'Choose your confidence from one to five.');
    }
    return [discipline, { focus: textInput(answer.focus, 300, true), confidence: answer.confidence }] as const;
  });
  return Object.fromEntries(entries) as RoadmapAnswers;
}

// Model output can propose a path, never an authoritative score, promotion or award.
export function validateRecommendations(
  value: unknown,
  catalogue: RoadmapDrill[],
  evidenceIds: string[],
): RoadmapRecommendation[] {
  if (!Array.isArray(value) || value.length !== 4) {
    roadmapError(502, 'INVALID_ROADMAP_AI', 'We could not prepare a reliable training path. Please try again.');
  }
  try {
    const result = value.map(item => {
      const row = objectInput(item, ['discipline', 'objective', 'proposedStage', 'evidence', 'drills']);
      if (!roadmapDisciplines.includes(row.discipline as RoadmapDiscipline) ||
          !Array.isArray(row.evidence) || !row.evidence.length || row.evidence.length > 10 ||
          !row.evidence.every(id => typeof id === 'string' && evidenceIds.includes(id)) ||
          !Array.isArray(row.drills) || row.drills.length > 3) throw new Error('Unsupported evidence or discipline');
      const discipline = row.discipline as RoadmapDiscipline;
      const drills = row.drills.map(item => {
        const drill = objectInput(item, ['drillId', 'reason']);
        const id = textInput(drill.drillId, 200);
        if (!catalogue.some(entry => entry.id === id && entry.discipline === discipline)) throw new Error('Unsupported drill');
        return { drillId: id, reason: textInput(drill.reason, 500, true) };
      });
      if (new Set(drills.map(drill => drill.drillId)).size !== drills.length) throw new Error('Duplicate drill');
      return {
        discipline, objective: textInput(row.objective, 500, true),
        proposedStage: row.proposedStage === null ? null : textInput(row.proposedStage, 80),
        evidence: row.evidence as string[], drills,
      };
    });
    if (new Set(result.map(row => row.discipline)).size !== 4) throw new Error('Duplicate discipline');
    return result;
  } catch {
    roadmapError(502, 'INVALID_ROADMAP_AI', 'We could not prepare a reliable training path. Please try again.');
  }
}
