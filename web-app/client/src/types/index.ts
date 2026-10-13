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

export interface CapeResult {
  session_id: string;
  metadata: { resolution: string; framerate_fps: number; target: CapeTarget; handedness: 'right' | 'left'; shot_type: string | null; bowler_type: string | null };
  analytics_payload: {
    pre_contact?: { milestone_frame: number; batter_joint_angles: Record<string, number> } | null;
    point_of_contact?: { milestone_frame: number; selection_source?: 'gemini' | 'detector'; selection_confidence?: number | null; ball_velocity_kmh: number | null; estimated_ball_momentum_kg_m_s?: number | null; estimated_ball_kinetic_energy_j?: number | null; bat_angle_degrees: number | null; head_front_knee_offset_pct?: number | null; stride_m?: number | null; front_foot_to_contact_angle_degrees?: number | null; front_toe_contact_distance_cm?: number | null; chin_front_toe_offset_pct?: number | null; front_shoulder_target_angle_degrees?: number | null; back_foot_crease_angle_degrees?: number | null; front_elbow_height_pct?: number | null; ball_line?: string | null; batter_joint_angles?: Record<string, number>; batter_3d_landmarks?: Record<string, [number, number, number]> } | null;
    post_contact?: { milestone_frame: number; exit_velocity_kmh: number | null; estimated_ball_momentum_kg_m_s?: number | null; estimated_ball_kinetic_energy_j?: number | null; launch_angle_degrees: number | null; batter_joint_angles?: Record<string, number> } | null;
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
  coaching: { score: number; verdict: string; faults: CapeFault[]; strengths: string[]; unavailable: string[]; summary: string | null };
  download_endpoints: Record<string, string | null>;
}

export interface CapeJob {
  jobId: string;
  status: CapeJobStatus;
  queuePosition: number | null;
  attempts: number;
  error: string | null;
  errorMessage: string | null;
  result: CapeResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapeAnalysisInput {
  target: CapeTarget;
  handedness: 'right' | 'left';
  shot_type?: string;
  bowler_type?: string;
  calibration_points: [number, number][];
}
