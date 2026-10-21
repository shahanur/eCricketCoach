export type Discipline = 'BATTING' | 'BOWLING' | 'KEEPING' | 'FIELDING';
export type ContextType = 'INDIVIDUAL' | 'GROUP';
export type ViewMode = 'HOME' | 'COACHING_PORTAL' | 'ADMIN_PANEL' | 'CLUB_PORTAL' | 'HELP_SUPPORT';
export type ThemeMode = 'dark' | 'light';

export type UserRole = 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'COACH' | 'PLAYER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  coachContext?: 'CLUB' | 'STANDALONE';
  tenantId?: string;
  clubName?: string;
}

export interface Drill {
  id: string;
  title: string;
  discipline: Discipline;
  skillSet: string;
  contextType: ContextType;
  duration: number;
  source: 'SYSTEM_PREDEFINED' | 'CLUB_CUSTOM' | 'AI_RECOMMENDED';
  clubName?: string;
  instructions?: string;
  squadId?: string | null;
  squadName?: string | null;
  imageUrl?: string | null;
}

export interface CustomerTenant {
  id: string;
  name: string;
  type: 'INDIVIDUAL' | 'COACH' | 'CLUB';
  email: string;
  subscriptionPlan: 'FREE_TRIAL' | 'INDIVIDUAL' | 'COACH_PRO' | 'CLUB_ACADEMY';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL';
  billingCycle: 'MONTHLY' | 'ANNUAL';
  mrr: number;
  activeMembers: number;
  joinedAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  customerName: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  date: string;
  planName: string;
}

export interface ClubApproval {
  id: string;
  clubName: string;
  adminName: string;
  adminEmail: string;
  plan: string;
  amountPaid: number;
  status: 'AWAITING_APPROVAL' | 'APPROVED';
  createdAt: string;
  type?: 'INDIVIDUAL' | 'COACH' | 'CLUB';
  billingCycle?: 'MONTHLY' | 'ANNUAL';
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'PAYMENT_RECEIVED' | 'APPROVAL_PENDING' | 'TENANT_ACTIVATED' | 'SUPPORT_TICKET_RAISED' | 'SUPPORT_TICKET_RESOLVED' | string;
  timestamp: string;
  read: boolean;
}

export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportCategory = 'TECHNICAL' | 'BILLING' | 'AI_ANALYSIS' | 'ROSTER_MANAGEMENT' | 'FEATURE_REQUEST' | 'OTHER';

export interface SupportTicket {
  id: string;
  ticketRef: string;
  name: string;
  email: string;
  category: SupportCategory;
  priority: SupportTicketPriority;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  tenantRole?: string;
  clubName?: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ClubMember {
  id: string;
  clubId?: string;
  name: string;
  email: string;
  role: 'COACH' | 'PLAYER';
  ageGroup: string;
  discipline: Discipline | string;
  invitationStatus: 'PENDING_ACCEPTANCE' | 'ACTIVE';
  currentLevel: 'SUPPORT_COACH' | 'FOUNDATION_COACH' | 'CORE_COACH' | 'ADVANCED_COACH' | 'SPECIALIST_COACH' | 'FOUNDATION' | 'DEVELOPING' | 'INTERMEDIATE' | 'ADVANCED' | 'ELITE';
  squad: string;
  squads?: string[];
}

export interface Squad {
  id: string;
  clubId?: string;
  name: string;
  ageGroup: string;
  discipline: Discipline[];
  memberCount: number;
}

export interface TrainingSessionTemplate {
  id: string;
  title: string;
  activityName: string;
  disciplines: Discipline[];
  focus: string;
  organization: string;
  safety: string[];
  durationMinutes: number;
  drillIds: string[];
  drills: Drill[];
}

export interface TrainingSession {
  id: string;
  clubId?: string;
  squadId?: string | null;
  squadName: string;
  coachId?: string | null;
  coachName?: string | null;
  coordinatorCoachId?: string | null;
  coordinatorCoachName?: string | null;
  assistantCoachId?: string | null;
  assistantCoachName?: string | null;
  assignedPlayerIds?: string[];
  title: string;
  sessionDate: string;
  durationMinutes: number;
  isPublished: boolean;
  safety?: string[];
  isExecuted?: boolean;
  drillCount: number;
  drillIds?: string[];
  playerNotes?: Record<string, string>;
  postNotes?: string;
  aiEvaluation?: SessionAiEvaluation | null;
  executionLog?: SessionExecutionLog | null;
}

export interface SessionAiEvaluation {
  squadSummary: string;
  identifiedGaps: string[];
  playerFeedback?: Array<{ playerName: string; focus: string }>;
  tailoredRecommendedDrills: Array<{
    title: string;
    discipline: Discipline;
    durationMinutes: number;
    context: ContextType;
    reason: string;
  }>;
  progressionReadiness: 'READY_FOR_PROMOTION' | 'CONSOLIDATE_CURRENT_STAGE' | 'REQUIRES_REMEDIATION';
  aiCommendation: string;
  sessionImprovements?: string[];
  followUpPlan?: {
    title: string;
    objective: string;
    durationMinutes: number;
    catalogueDrillIds: string[];
  };
  generatedAt?: string;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export interface SessionDrillLogEntry {
  id: string;
  drillId?: string | null;
  title: string;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  notes: string;
}

export interface SessionIncident {
  id: string;
  time: string;
  category: string;
  note: string;
}

export interface SessionEvaluation {
  objectivesMet: 'YES' | 'PARTIAL' | 'NO' | '';
  engagement: number;
  wentWell: string;
  challenges: string;
  nextAdjustments: string;
}

export interface SessionExecutionLog {
  status: 'PREPARING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt?: string | null;
  startedEarly?: boolean;
  completedAt?: string | null;
  checklist: Record<string, boolean>;
  attendance: Record<string, AttendanceStatus>;
  drillLog: SessionDrillLogEntry[];
  incidents: SessionIncident[];
  evaluation: SessionEvaluation;
}

export interface SessionExecutionUpdate {
  executionLog: SessionExecutionLog;
  playerNotes?: Record<string, string>;
  postNotes?: string;
  complete?: boolean;
}

export type PlayerAssessmentStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface AssessmentMetric {
  name: string;
  score: number | null;
  note: string;
}

export interface PlayerAssessment {
  id: string;
  clubId: string;
  playerId: string;
  playerName: string;
  coachId: string;
  coachName: string;
  title: string;
  discipline: Discipline;
  scheduledDate: string;
  scheduledTime: string | null;
  status: PlayerAssessmentStatus;
  metrics: AssessmentMetric[];
  strengths: string;
  focusAreas: string;
  coachFeedback: string;
  playerFeedback: string;
  trainingSessionId: string | null;
  videoAnalysisId: string | null;
  aiInsights: { summary: string; recommendations: string[] } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CoachDashboardData {
  players: ClubMember[];
  sessions: TrainingSession[];
  mySessions: TrainingSession[];
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  playerId?: string;
  clubId?: string;
  clubName?: string;
  clubLogo?: string | null;
  playerName: string;
  discipline: string;
  achievedLevel: string;
  issuedDate: string;
  coachName: string;
  coachNotes: string;
  aiCommendation: string;
}

export interface VideoAnalysisResult {
  detectedIssues: string[];
  overallScore: number;
  biomechanicalMetrics: {
    headPosition: string;
    footAlignment: string;
    backliftAngle?: string;
    releasePoint?: string;
  };
  recommendedDrills: Array<{
    title: string;
    discipline: Discipline | string;
    durationMinutes: number;
    context: 'INDIVIDUAL' | 'GROUP';
    isNewRecommendation: boolean;
  }>;
}

export type OpenAiContactStatus = 'DETECTED' | 'LIKELY' | 'UNCERTAIN' | 'NOT_VISIBLE';
export type OpenAiVisualConfidence = 'low' | 'moderate' | 'high';

export interface OpenAiBattingObservation {
  title: string;
  observation: string;
  coachingImplication: string;
  alternativeExplanation: string;
  coachingCue?: string;
  drill?: string;
  frameIndices: number[];
  confidence: OpenAiVisualConfidence;
}

export interface OpenAiBatAngle {
  frameId: string;
  frameIndex: number;
  timestampSeconds: number;
  phase: string;
  confidence: number;
  visibility: 'visible' | 'partially_visible' | 'hidden' | 'unknown';
  handle: { x: number; y: number } | null;
  toe: { x: number; y: number } | null;
  handleSource?: 'model' | 'wrists' | null;
  angleDegrees: number | null;
  source: 'openai_visual_estimate';
  calculation: 'image_plane_handle_to_toe_from_vertical';
  status: 'calculated' | 'unassessable';
  limitations: string[];
}

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

export interface OpenAiBattingAnalysis {
  provider: 'openai';
  model: string;
  promptVersion: string;
  schemaVersion: string;
  sourceSha256: string;
  reportId?: string;
  artifactNames?: string[];
  status: 'assessable' | 'partially_assessable' | 'unassessable';
  requestMetadata: {
    shotType: 'front_foot_drive' | 'front_foot_defence' | 'unknown';
    batterHandedness: 'right' | 'left' | 'unknown';
    cameraView: 'front_on' | 'side_on' | 'three_quarter' | 'unknown';
    playbackSpeed: 'real_time' | 'slow_motion' | 'unknown';
    captureFps: number | null;
    priorities: string[];
  };
  video: { durationSeconds: number; width: number; height: number; fps: number; sampledOverviewFrames: number };
  frameManifest: Array<{
    frameId: string;
    shotId: string | null;
    sourceFrameIndex: number;
    timestampSeconds: number;
    width: number;
    height: number;
    coordinateSpace: 'orientation_corrected_supplied_image';
    detail: 'overview' | 'contact';
  }>;
  shotCandidates: Array<{
    shotId: string;
    sampleIndex: number;
    shotType: string | null;
    confidence: number;
    evidence: string;
    windowStartSeconds: number | null;
    windowEndSeconds: number | null;
    phases: Array<{ phase: string; sampleIndex: number | null; confidence: number; evidence: string; playerBoxNorm: { left: number; top: number; right: number; bottom: number } | null }>;
  }>;
  shotAssessments: Array<{
    shotId: string;
    shotType: string | null;
    timestampSeconds: number;
    status: 'assessable' | 'partially_assessable' | 'unassessable';
    contactStatus: OpenAiContactStatus;
    confidence: number;
    summary: string;
    observations: OpenAiBattingObservation[];
    errors: OpenAiBattingObservation[];
    strengths: Array<{ title: string; observation: string; frameIndices: number[]; confidence: OpenAiVisualConfidence }>;
    limitations: string[];
    kinetics: { status: 'not_measured'; hypotheses: string[] };
    jointAngles: Array<{
      frameId: string;
      joint: 'elbow' | 'knee' | 'hip' | 'shoulder';
      side: 'left' | 'right';
      landmarkNames: [string, string, string];
      a: { x: number; y: number } | null;
      b: { x: number; y: number } | null;
      c: { x: number; y: number } | null;
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
    }>;
    batAngles?: OpenAiBatAngle[];
    phaseReviewFrames: Array<{ shotId: string; frameIndex: number; timestampSeconds: number; phase: string; confidence: number; landmarksNorm: Record<string, { x: number; y: number } | null>; imageDataUrl: string }>;
    batLandmarksByFrame: Array<{ frameIndex: number; phase: string; confidence: number; visibility: 'visible' | 'partially_visible' | 'hidden' | 'unknown'; handleNorm: { x: number; y: number } | null; toeNorm: { x: number; y: number } | null }>;
    annotations: Array<{ frameIndex: number; type: 'point' | 'line' | 'polyline' | 'arrow' | 'ellipse' | 'text'; points: Array<{ x: number; y: number }>; label: string; evidenceStatus: 'observed' | 'estimated' | 'schematic'; confidence: number }>;
  }>;
  jointAngles: Array<{
    frameId: string;
    joint: 'elbow' | 'knee' | 'hip' | 'shoulder';
    side: 'left' | 'right';
    landmarkNames: [string, string, string];
    a: { x: number; y: number } | null;
    b: { x: number; y: number } | null;
    c: { x: number; y: number } | null;
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
  }>;
  batAngles?: OpenAiBatAngle[];
  contactBatAngle?: {
    frameIndex: number;
    angleDegrees: number;
    method: 'handle_to_toe' | 'hands_to_toe' | 'wrists_to_contact';
    source: 'openai_visual_estimate';
    limitations: string[];
  } | null;
  phaseReviewFrames: Array<{ shotId: string; frameIndex: number; timestampSeconds: number; phase: string; confidence: number; landmarksNorm: Record<string, { x: number; y: number } | null>; imageDataUrl: string }>;
  sourceFrameImages: Array<{ frameIndex: number; timestampSeconds: number; imageDataUrl: string }>;
  batLandmarksByFrame: Array<{ frameIndex: number; phase: string; confidence: number; visibility: 'visible' | 'partially_visible' | 'hidden' | 'unknown'; handleNorm: { x: number; y: number } | null; toeNorm: { x: number; y: number } | null }>;
  annotations: Array<{ frameIndex: number; type: 'point' | 'line' | 'polyline' | 'arrow' | 'ellipse' | 'text'; points: Array<{ x: number; y: number }>; label: string; evidenceStatus: 'observed' | 'estimated' | 'schematic'; confidence: number }>;
  executionLog: {
    stages: string[];
    toolVersions: { node: string; ffmpeg: string; ffprobe: string; sharp: string };
    modelRequested: string;
    modelReturned: string;
    responseIds: string[];
    usage: { inputTokens: number; outputTokens: number } | null;
    sourceSha256: string;
    frameManifest: OpenAiBattingAnalysis['frameManifest'];
    cropTransforms: Array<{ frameIndex: number; sourceWidth: number; sourceHeight: number; cropX: number; cropY: number; cropWidth: number; cropHeight: number; outputWidth: number; outputHeight: number; coordinateSpace: string }>;
    errors: string[];
    outputs: Array<{ path: string; sha256: string; sizeBytes: number }>;
  };
  contact: {
    status: OpenAiContactStatus;
    selectionSource: 'AI' | 'MANUAL';
    selectedTimestampSeconds: number | null;
    frameIndex: number | null;
    timestampSeconds: number | null;
    confidence: number;
    evidence: string;
    imageDataUrl: string | null;
    pointNorm: { x: number; y: number } | null;
  };
  croppedContactImageDataUrl: string | null;
  contactLandmarksNorm: Record<string, { x: number; y: number } | null>;
  batHandleNorm: { x: number; y: number } | null;
  batToeNorm: { x: number; y: number } | null;
  croppedContactLandmarksNorm: Record<string, { x: number; y: number } | null>;
  croppedContactPointNorm: { x: number; y: number } | null;
  croppedBatHandleNorm?: { x: number; y: number } | null;
  croppedBatToeNorm?: { x: number; y: number } | null;
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
  shotIdentification: { shotType: string | null; batterHandedness: 'right' | 'left' | 'unknown'; confidence: number; evidence: string };
  footageQuality: {
    cameraView: 'front_on' | 'side_on' | 'three_quarter' | 'unknown';
    framing: 'full_batter_visible' | 'partially_cropped' | 'poor' | 'unknown';
    blur: 'low' | 'moderate' | 'high' | 'unknown';
    occlusions: string[];
    timingLimitations: string[];
    cameraMotion: 'stable' | 'moving' | 'unknown';
  };
  contactWindow: { startSeconds: number | null; endSeconds: number | null };
  summary: string;
  kinetics: { status: 'not_measured'; hypotheses: string[] };
  capeKinetics?: OpenAiCapeKinetics;
  observations: OpenAiBattingObservation[];
  errors: OpenAiBattingObservation[];
  strengths: Array<{ title: string; observation: string; frameIndices: number[]; confidence: OpenAiVisualConfidence }>;
  priorityCue: string;
  drill: { title: string; instructions: string[]; rationale: string };
  limitations: string[];
  additionalEvidence: string[];
}

export interface PoseOverlayAnalysis {
  status: 'success';
  width: number;
  height: number;
  handedness: 'right' | 'left';
  landmark_source: 'openai' | 'mediapipe' | 'openai+mediapipe-fallback';
  landmark_sources: Record<string, 'openai' | 'mediapipe_fallback' | 'unavailable'>;
  metric_sources: Record<string, string>;
  temporal_angle_estimates: Record<string, {
    value: number;
    frame_index: number;
    timestamp_seconds: number;
    offset_ms: number;
    source: string;
  }>;
  shot_type: string;
  person_detection: { confidence: number; box_px: [number, number, number, number]; box_norm: [number, number, number, number] } | null;
  landmarks: Record<string, { x: number; y: number; visibility: number } | null>;
  metrics: Record<string, number | null>;
  mediapipe_metrics: Record<string, number | null>;
  openai_landmarks: Record<string, { x: number; y: number }>;
  openai_contact_point: { x: number; y: number } | null;
  openai_metrics: Record<string, number | null>;
  landmark_disagreement_pct: Record<string, number | null>;
  coaching_rules: {
    source: string;
    shot_type: string;
    score: number;
    score_scope: string;
    metric_basis: string;
    verdict: string;
    checks_applicable: number;
    checks_evaluated: number;
    checks: Array<{
      group: 'alignment' | 'shot';
      code: string;
      milestone: string;
      metric: string;
      value: number | null;
      expected: [number | null, number | null];
      status: 'measured' | 'fault' | 'unavailable';
      severity: 'low' | 'medium' | 'high' | null;
      message: string | null;
      recommendation: string | null;
      drill: string | null;
    }>;
    faults: Array<{
      code: string;
      milestone: string;
      metric: string;
      value: number;
      expected: [number | null, number | null];
      severity: 'low' | 'medium' | 'high';
      message: string;
      recommendation: string;
      drill: string | null;
      verdict: string | null;
    }>;
    strengths: string[];
    unavailable: string[];
  };
  limitations: string[];
  overlay_image_base64: string;
  overlay_mime_type: string;
  sequence: Array<{
    frame_index: number;
    timestamp_seconds: number;
    phase: 'PRE_CONTACT' | 'CONTACT' | 'POST_CONTACT';
    status: 'success' | 'unavailable';
    error?: string;
    width?: number;
    height?: number;
    metrics?: Record<string, number | null>;
    mediapipe_world_metrics?: Record<string, number>;
    overlay_image_base64?: string;
    overlay_mime_type?: string;
  }>;
}

export interface DriveVideoFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  durationMillis?: number | null;
  width?: number;
  height?: number;
}

export interface GoogleDriveStatus {
  connected: boolean;
  email: string | null;
}

export type CapeTarget = 'batter' | 'bowler';
export type CapeJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type CapeSeverity = 'low' | 'medium' | 'high';

export interface CapeFault {
  code: string;
  milestone: string;
  metric: string;
  value: number;
  expected: [number | null, number | null];
  severity: CapeSeverity;
  message: string;
  recommendation: string;
  drill: string | null;
}

export interface CapeAiGuidance {
  source: 'gemini';
  summary: string;
  items: Array<{
    fault_code: string;
    title: string;
    why_it_matters: string;
    coaching_cues: string[];
    drill: {
      name: string;
      instructions: string[];
      equipment: string[];
    };
  }>;
}

export interface PlayerDrillAssignment {
  id: string;
  playerId: string;
  playerName: string;
  drillId: string;
  systemDrillId: string | null;
  capeJobId: string | null;
  faultCode: string | null;
  title: string;
  discipline: string;
  details: {
    correction?: string;
    why_it_matters?: string;
    coaching_cues?: string[];
    instructions?: string[];
    equipment?: string[];
  };
  assignedByName: string | null;
  createdAt: string;
}

export interface CapeResult {
  session_id: string;
  metadata: { resolution: string; framerate_fps: number; target: CapeTarget; handedness: 'right' | 'left'; shot_type: string | null; bowler_type: string | null };
  analytics_payload: {
    pre_contact?: { milestone_frame: number; batter_joint_angles: Record<string, number>; swing_frames?: number[]; bat_swing_arc_degrees?: number | null; bat_swing_estimated?: boolean; bat_swing_speed_kmh?: number | null; swing_frames_auto?: boolean } | null;
    point_of_contact?: { milestone_frame: number; selection_source?: 'gemini' | 'detector' | 'manual'; selection_confidence?: number | null; candidate_frames?: number[]; ball_velocity_kmh: number | null; estimated_ball_momentum_kg_m_s?: number | null; estimated_ball_kinetic_energy_j?: number | null; bat_angle_degrees: number | null; head_front_knee_offset_pct?: number | null; stride_m?: number | null; front_foot_to_contact_angle_degrees?: number | null; front_toe_contact_distance_cm?: number | null; chin_front_toe_offset_pct?: number | null; front_shoulder_target_angle_degrees?: number | null; back_foot_crease_angle_degrees?: number | null; front_elbow_height_pct?: number | null; ball_line?: string | null; batter_joint_angles?: Record<string, number>; batter_3d_landmarks?: Record<string, [number, number, number]> } | null;
    post_contact?: { milestone_frame: number; follow_through_frames?: number[]; follow_through_arc_degrees?: number | null; follow_through_estimated?: boolean; follow_through_frames_auto?: boolean; exit_velocity_kmh: number | null; estimated_ball_momentum_kg_m_s?: number | null; estimated_ball_kinetic_energy_j?: number | null; launch_angle_degrees: number | null; batter_joint_angles?: Record<string, number> } | null;
    release?: { milestone_frame: number; bowler_joint_angles: Record<string, number>; release_height_m: number | null } | null;
  };
  delivery: {
    speed_kmh: number | null;
    speed_tolerance_kmh: number;
    pitching_point_m: [number, number];
    length_m: number;
    length_zone: string;
    line_zone: string;
    is_good_ball: boolean;
  } | null;
  coaching: { score: number; verdict: string; faults: CapeFault[]; strengths: string[]; unavailable: string[]; summary: string | null; ai_guidance?: CapeAiGuidance | null };
  download_endpoints: Record<string, string | null>;
}

export interface CapeJob {
  jobId: string;
  status: CapeJobStatus;
  queuePosition: number | null;
  attempts: number;
  playerName?: string | null;
  error: string | null;
  errorMessage: string | null;
  result: CapeResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapeJobSummary {
  jobId: string;
  status: CapeJobStatus;
  assessmentId: string | null;
  target: CapeTarget | null;
  shotType: string | null;
  bowlerType: string | null;
  score: number | null;
  verdict: string | null;
  faultCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface CapeManualFrames {
  pre_contact: number[];
  point_of_contact: number[];
  post_contact: number[];
}

export interface CapeAnalysisInput {
  target: CapeTarget;
  handedness: 'right' | 'left';
  shot_type?: string;
  bowler_type?: string;
  calibration_points: [number, number][];
  manual_frames?: CapeManualFrames;
}

export interface CapeContactCandidates {
  framerate_fps: number;
  frame_count: number;
  suggested_frame: number | null;
  suggestion_source: 'gemini' | 'none';
  suggestion_note: string | null;
  frames: Array<{ index: number; time_s: number; image_base64: string }>;
}
