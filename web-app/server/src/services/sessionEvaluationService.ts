import { prisma } from '../config/prisma.js';
import { GeminiVideoAnalysisService } from './geminiVideoAnalysisService.js';
import { SessionExecutionLog } from '../types/index.js';

const DISCIPLINES = ['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'];
const READINESS = ['READY_FOR_PROMOTION', 'CONSOLIDATE_CURRENT_STAGE', 'REQUIRES_REMEDIATION'];

export interface SessionAiEvaluation {
  squadSummary: string;
  identifiedGaps: string[];
  playerFeedback: Array<{ playerName: string; focus: string }>;
  tailoredRecommendedDrills: Array<{
    title: string;
    discipline: string;
    durationMinutes: number;
    context: 'INDIVIDUAL' | 'GROUP';
    reason: string;
  }>;
  progressionReadiness: 'READY_FOR_PROMOTION' | 'CONSOLIDATE_CURRENT_STAGE' | 'REQUIRES_REMEDIATION';
  aiCommendation: string;
  sessionImprovements: string[];
  followUpPlan: {
    title: string;
    objective: string;
    durationMinutes: number;
    catalogueDrillIds: string[];
  };
  generatedAt?: string;
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

function isValidEvaluation(data: any): data is SessionAiEvaluation {
  return (
    data &&
    typeof data.squadSummary === 'string' &&
    isStringArray(data.identifiedGaps) &&
    Array.isArray(data.playerFeedback) &&
    data.playerFeedback.every((item: any) => typeof item?.playerName === 'string' && typeof item?.focus === 'string') &&
    Array.isArray(data.tailoredRecommendedDrills) &&
    data.tailoredRecommendedDrills.every((drill: any) =>
      typeof drill?.title === 'string' &&
      DISCIPLINES.includes(drill.discipline) &&
      typeof drill.durationMinutes === 'number' &&
      (drill.context === 'INDIVIDUAL' || drill.context === 'GROUP') &&
      typeof drill.reason === 'string') &&
    READINESS.includes(data.progressionReadiness) &&
    typeof data.aiCommendation === 'string' &&
    isStringArray(data.sessionImprovements) &&
    typeof data.followUpPlan?.title === 'string' &&
    typeof data.followUpPlan.objective === 'string' &&
    typeof data.followUpPlan.durationMinutes === 'number' &&
    isStringArray(data.followUpPlan.catalogueDrillIds)
  );
}

export class SessionEvaluationService {
  /**
   * Builds the coaching record for a session (per-player notes, session summary, planned drills,
   * execution log and any extra observations) and asks Gemini for a diagnosis and top-up drills.
   * Returns null when there are no coach observations to evaluate.
   */
  static async evaluate(sessionId: string, extraNotes: string): Promise<SessionAiEvaluation | null> {
    const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error('Session not found');

    const playerNotes = (session.playerNotes && typeof session.playerNotes === 'object' ? session.playerNotes : {}) as Record<string, string>;
    const drillIds: string[] = Array.isArray(session.drillIds) ? session.drillIds as string[] : [];
    const log = session.executionLog as unknown as SessionExecutionLog | null;
    const playerIds = Array.from(new Set([...Object.keys(playerNotes), ...Object.keys(log?.attendance || {})]));

    const drillSelect = { id: true, title: true, discipline: true, skillSet: true, duration: true };
    const [members, drills, catalogue] = await Promise.all([
      prisma.clubMember.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } }),
      prisma.drill.findMany({ where: { id: { in: drillIds } }, select: drillSelect }),
      prisma.drill.findMany({
        where: { OR: [{ source: { not: 'CLUB_CUSTOM' } }, { clubId: session.clubId || '__none__' }] },
        select: drillSelect,
        take: 200
      })
    ]);
    const nameOf = (id: string) => members.find(member => member.id === id)?.name || 'Player';

    const noteLines = Object.entries(playerNotes)
      .filter(([, note]) => typeof note === 'string' && note.trim())
      .map(([id, note]) => `- ${nameOf(id)}: ${note.trim()}`);
    const observations = [extraNotes.trim(), (session.postNotes || '').trim(), log?.evaluation?.wentWell, log?.evaluation?.challenges]
      .filter(Boolean);
    if (!noteLines.length && !observations.length) return null;

    const sections = [
      `Session: ${session.title} | Squad: ${session.squadName} | Date: ${session.sessionDate} | Duration: ${session.durationMinutes} min`,
      `Planned drills:\n${drillIds.map(id => drills.find(drill => drill.id === id)).filter(Boolean)
        .map(drill => `- ${drill!.title} (${drill!.discipline}, ${drill!.skillSet}, ${drill!.duration} min)`).join('\n') || '- None recorded'}`,
      `Per-player coach notes:\n${noteLines.join('\n') || '- None'}`,
      `Session summary: ${(session.postNotes || '').trim() || '-'}`,
      `Additional coach observations: ${extraNotes.trim() || '-'}`
    ];
    if (log) {
      sections.push(
        `Attendance: ${Object.entries(log.attendance || {}).map(([id, status]) => `${nameOf(id)} ${status}`).join(', ') || '-'}`,
        `Drill log:\n${(log.drillLog || []).map(entry => `- ${entry.title}: planned ${entry.plannedMinutes} min, actual ${entry.actualMinutes} min, ${entry.completed ? 'completed' : 'not completed'}${entry.notes ? `; notes: ${entry.notes}` : ''}`).join('\n') || '- None'}`,
        `Disruptions: ${(log.incidents || []).map(item => `[${item.category}] ${item.note}`).join('; ') || 'None'}`,
        `Coach evaluation: objectives met ${log.evaluation?.objectivesMet || '-'}, engagement ${log.evaluation?.engagement || '-'}/5, went well: ${log.evaluation?.wentWell || '-'}, challenges: ${log.evaluation?.challenges || '-'}, next adjustments: ${log.evaluation?.nextAdjustments || '-'}`
      );
    }

    const prompt = `You are an elite cricket coach and biomechanics specialist reviewing a club training session from the coach's written records.

${sections.join('\n\n')}

Using ONLY the information above (do not invent observations that are not supported by the notes), respond with ONLY a single valid JSON object (no markdown fences, no extra text) matching EXACTLY this shape:
{
  "squadSummary": string (2-3 sentence diagnosis of the session's main technical themes),
  "identifiedGaps": string[] (1 to 4 specific technical gaps evidenced by the notes),
  "playerFeedback": [{ "playerName": string, "focus": string }] (one entry per player who has notes, with their next technical focus),
  "tailoredRecommendedDrills": [
    { "title": string, "discipline": "BATTING" | "BOWLING" | "KEEPING" | "FIELDING", "durationMinutes": number, "context": "INDIVIDUAL" | "GROUP", "reason": string }
  ] (1 to 3 corrective top-up drills targeting the gaps),
  "progressionReadiness": "READY_FOR_PROMOTION" | "CONSOLIDATE_CURRENT_STAGE" | "REQUIRES_REMEDIATION",
  "aiCommendation": string (one encouraging, specific sentence for the coach and players),
  "sessionImprovements": string[] (2 to 4 practical changes to how the next session is planned or run, e.g. time management, grouping, engagement, based on the execution log),
  "followUpPlan": {
    "title": string (short title for the follow-up session),
    "objective": string (one sentence describing what the follow-up session should achieve),
    "durationMinutes": number (between 30 and ${Math.max(session.durationMinutes, 60)}),
    "catalogueDrillIds": string[] (2 to 5 ids chosen ONLY from the drill catalogue below, in running order, that best address the gaps)
  }
}

Drill catalogue (id | title | discipline | skill | minutes):
${catalogue.map(drill => `${drill.id} | ${drill.title} | ${drill.discipline} | ${drill.skillSet} | ${drill.duration}`).join('\n') || '- Empty'}`;

    const result = await GeminiVideoAnalysisService.generateJson([prompt], isValidEvaluation, 'Post-session AI assessment');
    const catalogueIds = new Set(catalogue.map(drill => drill.id));
    return {
      ...result,
      followUpPlan: {
        ...result.followUpPlan,
        durationMinutes: Math.min(Math.max(Math.round(result.followUpPlan.durationMinutes), 30), 240),
        catalogueDrillIds: Array.from(new Set(result.followUpPlan.catalogueDrillIds.filter(id => catalogueIds.has(id)))).slice(0, 8)
      },
      generatedAt: new Date().toISOString()
    };
  }
}
