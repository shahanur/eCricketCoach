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
