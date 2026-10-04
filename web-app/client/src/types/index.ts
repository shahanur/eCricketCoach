export type Discipline = 'BATTING' | 'BOWLING' | 'KEEPING' | 'FIELDING';
export type ContextType = 'INDIVIDUAL' | 'GROUP';
export type ViewMode = 'HOME' | 'COACHING_PORTAL' | 'ADMIN_PANEL' | 'CLUB_PORTAL' | 'HELP_SUPPORT';
export type ThemeMode = 'dark' | 'light' | 'pure-light';

export type UserRole = 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'COACH' | 'PLAYER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
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
  name: string;
  email: string;
  role: 'COACH' | 'PLAYER';
  ageGroup: string;
  discipline: Discipline | string;
  invitationStatus: 'PENDING_ACCEPTANCE' | 'ACTIVE';
  currentLevel: 'FOUNDATION' | 'DEVELOPING' | 'INTERMEDIATE' | 'ADVANCED' | 'ELITE';
  squad: string;
}

export interface Squad {
  id: string;
  name: string;
  ageGroup: string;
  coachName: string;
  discipline: Discipline;
  memberCount: number;
}

export interface TrainingSession {
  id: string;
  squadName: string;
  title: string;
  sessionDate: string;
  durationMinutes: number;
  isPublished: boolean;
  drillCount: number;
  postNotes?: string;
  aiEvaluation?: any;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
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

