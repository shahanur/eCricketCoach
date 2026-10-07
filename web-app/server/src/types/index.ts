export interface DrillItem {
  id: string;
  title: string;
  discipline: 'BATTING' | 'BOWLING' | 'KEEPING' | 'FIELDING';
  skillSet: string;
  contextType: 'INDIVIDUAL' | 'GROUP';
  ageGroup: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ELITE';
  durationMinutes: number;
  source: 'SYSTEM_PREDEFINED' | 'CLUB_CUSTOM' | 'AI_RECOMMENDED';
  clubId?: string;
  clubName?: string;
  squadId?: string | null;
  squadName?: string | null;
  instructions?: string;
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
  paymentStatus: 'PAID' | 'PENDING';
  approvalStatus: 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  type?: 'INDIVIDUAL' | 'COACH' | 'CLUB';
  billingCycle?: 'MONTHLY' | 'ANNUAL';
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'PAYMENT_RECEIVED' | 'APPROVAL_PENDING' | 'TENANT_ACTIVATED';
  timestamp: string;
  read: boolean;
}

export interface ClubMember {
  id: string;
  clubId: string;
  name: string;
  email: string;
  role: 'COACH' | 'PLAYER';
  ageGroup: string;
  discipline: string;
  invitationStatus: 'PENDING_ACCEPTANCE' | 'ACTIVE';
  currentLevel: 'SUPPORT_COACH' | 'FOUNDATION_COACH' | 'CORE_COACH' | 'ADVANCED_COACH' | 'SPECIALIST_COACH' | 'FOUNDATION' | 'DEVELOPING' | 'INTERMEDIATE' | 'ADVANCED' | 'ELITE';
  squadId?: string;
  squad?: string;
}

export interface Squad {
  id: string;
  clubId: string;
  name: string;
  ageGroup: string;
  discipline: string;
  memberIds: string[];
}

export interface TrainingSession {
  id: string;
  clubId: string;
  coachId?: string | null;
  coachName?: string | null;
  coordinatorCoachId?: string | null;
  coordinatorCoachName?: string | null;
  assistantCoachId?: string | null;
  assistantCoachName?: string | null;
  squadId?: string | null;
  squadName: string;
  assignedPlayerIds?: string[];
  title: string;
  sessionDate: string;
  durationMinutes: number;
  drills: Array<{ id: string; title: string; duration: number; discipline: string; context: 'INDIVIDUAL' | 'GROUP' }>;
  drillIds?: string[];
  drillCount?: number;
  isPublished: boolean;
  isExecuted?: boolean;
  publishedAt?: string;
  playerNotes?: Record<string, string>;
  postSessionNotes?: string;
  aiAssessment?: any;
  executionLog?: SessionExecutionLog | null;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export interface SessionExecutionLog {
  status: 'PREPARING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt?: string | null;
  completedAt?: string | null;
  checklist: Record<string, boolean>;
  attendance: Record<string, AttendanceStatus>;
  drillLog: Array<{
    id: string;
    drillId?: string | null;
    title: string;
    plannedMinutes: number;
    actualMinutes: number;
    completed: boolean;
    notes: string;
  }>;
  incidents: Array<{ id: string; time: string; category: string; note: string }>;
  evaluation: {
    objectivesMet: 'YES' | 'PARTIAL' | 'NO' | '';
    engagement: number;
    wentWell: string;
    challenges: string;
    nextAdjustments: string;
  };
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  playerId: string;
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
