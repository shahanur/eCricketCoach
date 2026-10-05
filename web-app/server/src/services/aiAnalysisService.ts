export interface AiAnalysisResult {
  detectedIssues: string[];
  recommendedDrills: Array<{
    title: string;
    discipline: string;
    durationMinutes: number;
    context: 'INDIVIDUAL' | 'GROUP';
    isNewRecommendation: boolean;
  }>;
  overallScore: number;
  biomechanicalMetrics: {
    headPosition: string;
    footAlignment: string;
    backliftAngle?: string;
    releasePoint?: string;
  };
}

export interface PostSessionAiEvaluation {
  squadSummary: string;
  identifiedGaps: string[];
  tailoredRecommendedDrills: Array<{
    id: string;
    title: string;
    discipline: string;
    durationMinutes: number;
    context: 'INDIVIDUAL' | 'GROUP';
    reason: string;
  }>;
  progressionReadiness: 'READY_FOR_PROMOTION' | 'CONSOLIDATE_CURRENT_STAGE' | 'REQUIRES_REMEDIATION';
  aiCommendation: string;
}

export class AiAnalysisService {
  /**
   * Evaluates post-session notes entered by coach for group/individual.
   * Diagnoses performance gaps and recommends tailored drills.
   */
  public static async evaluateSessionNotes(
    coachNotes: string,
    discipline: string,
    context: 'INDIVIDUAL' | 'GROUP'
  ): Promise<PostSessionAiEvaluation> {
    const isSpinFocus = coachNotes.toLowerCase().includes('spin') || coachNotes.toLowerCase().includes('turn');
    const isPaceFocus = coachNotes.toLowerCase().includes('pace') || coachNotes.toLowerCase().includes('seam') || coachNotes.toLowerCase().includes('run-up');
    const isBattingCover = coachNotes.toLowerCase().includes('drive') || coachNotes.toLowerCase().includes('cover') || coachNotes.toLowerCase().includes('footwork');

    if (isBattingCover) {
      return {
        squadSummary: 'Coach noted technical divergence during front-foot drive executions. Front foot angle requires stabilization.',
        identifiedGaps: ['Weight transfer stalling prematurely', 'Head not over line of impact'],
        tailoredRecommendedDrills: [
          {
            id: 'rec-' + Date.now() + '-1',
            title: 'Stationary Cone Head-Over-Ball Transfer Drill',
            discipline: 'BATTING',
            durationMinutes: 20,
            context: context,
            reason: 'Locks head alignment directly above contact zone to avoid edged shots.'
          },
          {
            id: 'rec-' + Date.now() + '-2',
            title: 'Low Full Toss Drive & Follow-Through Extension',
            discipline: 'BATTING',
            durationMinutes: 25,
            context: context,
            reason: 'Encourages full weight transfer through the shot.'
          }
        ],
        progressionReadiness: 'CONSOLIDATE_CURRENT_STAGE',
        aiCommendation: 'Solid hand speed and balance at stance; fine-tune foot alignment before level advancement.'
      };
    }

    if (isPaceFocus || isSpinFocus) {
      return {
        squadSummary: 'Bowling rhythm and wrist orientation showed variance during the match simulation overs.',
        identifiedGaps: ['Non-bowling arm pulling down across the torso', 'Inconsistent release height'],
        tailoredRecommendedDrills: [
          {
            id: 'rec-' + Date.now() + '-3',
            title: 'High Non-Bowling Arm Extension & Target Drop Drill',
            discipline: 'BOWLING',
            durationMinutes: 20,
            context: context,
            reason: 'Prevents lateral collapse and maintains upright bowling channel.'
          },
          {
            id: 'rec-' + Date.now() + '-4',
            title: 'Crease Stride Length Consistency Markers',
            discipline: 'BOWLING',
            durationMinutes: 15,
            context: context,
            reason: 'Standardizes landing position across spells.'
          }
        ],
        progressionReadiness: 'CONSOLIDATE_CURRENT_STAGE',
        aiCommendation: 'Excellent gather velocity. Rectifying non-bowling arm drop will increase accuracy by an estimated 18%.'
      };
    }

    return {
      squadSummary: 'Session execution met baseline parameters with key improvements noted in spatial awareness.',
      identifiedGaps: ['Minor reaction latency during high-tempo transitions'],
      tailoredRecommendedDrills: [
        {
          id: 'rec-' + Date.now() + '-5',
          title: 'Split-Step Reaction Ladder & Pickup Relay',
          discipline: discipline || 'FIELDING',
          durationMinutes: 20,
          context: context,
          reason: 'Sharpens fast twitch movement and balance.'
        }
      ],
      progressionReadiness: 'READY_FOR_PROMOTION',
      aiCommendation: 'Demonstrated high competency and consistency across all benchmark stations.'
    };
  }
}
