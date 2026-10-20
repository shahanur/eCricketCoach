import {
  Drill,
  CustomerTenant,
  Invoice,
  ClubApproval,
  ClubMember,
  Squad,
  TrainingSession,
  TrainingSessionTemplate,
  Certificate,
  AdminNotification,
  SupportTicket,
  CoachDashboardData,
  SessionExecutionUpdate,
  PlayerAssessment,
  AssessmentMetric,
  CapeAnalysisInput,
  CapeContactCandidates,
  CapeJob,
  CapeJobSummary,
  CapeJobStatus,
  CapeTarget,
  PlayerDrillAssignment,
  OpenAiBattingAnalysis,
  PoseOverlayAnalysis
} from '../types';

const API_BASE = '/api';

function authenticatedHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

// Auth header only, so the browser sets the multipart boundary itself.
function bearerHeader(): Record<string, string> {
  const { 'Content-Type': _contentType, ...rest } = authenticatedHeaders() as Record<string, string>;
  return rest;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(typeof body.error === 'string' ? body.error : fallback);
}

export const api = {
  async getTrainingSessionTemplates(): Promise<TrainingSessionTemplate[]> {
    const res = await fetch(`${API_BASE}/training-templates`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load shared training templates');
    return res.json();
  },

  // Drills
  async getDrills(filters?: { context?: string; discipline?: string; source?: string; clubId?: string }): Promise<Drill[]> {
    const params = new URLSearchParams();
    if (filters?.context) params.append('context', filters.context);
    if (filters?.discipline) params.append('discipline', filters.discipline);
    if (filters?.source) params.append('source', filters.source);
    if (filters?.clubId) params.append('clubId', filters.clubId);

    const res = await fetch(`${API_BASE}/drills?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch drills');
    return res.json();
  },

  async addAdminDrill(drill: Partial<Drill>): Promise<Drill> {
    const res = await fetch(`${API_BASE}/drills/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drill)
    });
    if (!res.ok) throw new Error('Failed to create admin drill');
    const data = await res.json();
    return data.drill;
  },

  async addClubDrill(drill: Partial<Drill>): Promise<Drill> {
    const res = await fetch(`${API_BASE}/drills/club`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drill)
    });
    if (!res.ok) throw await responseError(res, 'Failed to create club drill');
    const data = await res.json();
    return data.drill;
  },

  async deleteDrill(drillId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/drills/${drillId}`, { method: 'DELETE', headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to delete drill');
    return true;
  },

  async updateDrill(drillId: string, updates: Partial<Drill>): Promise<Drill> {
    const res = await fetch(`${API_BASE}/drills/${drillId}`, {
      method: 'PATCH',
      headers: authenticatedHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw await responseError(res, 'Failed to update drill');
    const data = await res.json();
    return data.drill;
  },

  async cloneDrill(drillId: string): Promise<Drill> {
    const res = await fetch(`${API_BASE}/drills/${encodeURIComponent(drillId)}/clone`, {
      method: 'POST',
      headers: authenticatedHeaders()
    });
    if (!res.ok) throw await responseError(res, 'Failed to clone drill');
    const data = await res.json();
    return data.drill;
  },

  // Admin & Customers
  async getCustomers(params?: { search?: string; type?: string; status?: string }): Promise<{ customers: CustomerTenant[]; metrics: any }> {
    const sp = new URLSearchParams();
    if (params?.search) sp.append('search', params.search);
    if (params?.type) sp.append('type', params.type);
    if (params?.status) sp.append('status', params.status);

    const res = await fetch(`${API_BASE}/admin/customers?${sp.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  async updateCustomerStatus(id: string, status: string): Promise<CustomerTenant> {
    const res = await fetch(`${API_BASE}/admin/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update customer status');
    const data = await res.json();
    return data.customer;
  },

  async updateCustomerPlan(id: string, subscriptionPlan: string): Promise<CustomerTenant> {
    const res = await fetch(`${API_BASE}/admin/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionPlan })
    });
    if (!res.ok) throw new Error('Failed to update customer plan');
    const data = await res.json();
    return data.customer;
  },

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    const res = await fetch(`${API_BASE}/admin/invoices`);
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return res.json();
  },

  async updateInvoiceStatus(id: string, status: string = 'PAID'): Promise<Invoice> {
    const res = await fetch(`${API_BASE}/admin/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update invoice');
    const data = await res.json();
    return data.invoice;
  },

  // Club Approvals
  async getClubApprovals(): Promise<ClubApproval[]> {
    const res = await fetch(`${API_BASE}/admin/club-approvals`);
    if (!res.ok) throw new Error('Failed to fetch club approvals');
    return res.json();
  },

  async approveClub(id: string): Promise<{ item: ClubApproval; customer: CustomerTenant; notification: AdminNotification }> {
    const res = await fetch(`${API_BASE}/admin/club-approvals/${id}/approve`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to approve club registration');
    return res.json();
  },

  // Admin Notifications
  async getNotifications(): Promise<AdminNotification[]> {
    const res = await fetch(`${API_BASE}/admin/notifications`);
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  // Support Tickets Desk
  async getSupportTickets(filters?: { status?: string; category?: string; search?: string }): Promise<SupportTicket[]> {
    const sp = new URLSearchParams();
    if (filters?.status) sp.append('status', filters.status);
    if (filters?.category) sp.append('category', filters.category);
    if (filters?.search) sp.append('search', filters.search);

    const res = await fetch(`${API_BASE}/admin/support-tickets?${sp.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch support tickets');
    return res.json();
  },

  async createSupportTicket(ticket: {
    name: string;
    email: string;
    category: string;
    priority?: string;
    subject: string;
    message: string;
    tenantRole?: string;
    clubName?: string;
  }): Promise<{ success: boolean; ticket: SupportTicket }> {
    const res = await fetch(`${API_BASE}/admin/support-tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket)
    });
    if (!res.ok) throw new Error('Failed to create support ticket');
    return res.json();
  },

  async resolveSupportTicket(ticketId: string, payload: {
    resolution: string;
    resolvedBy?: string;
    status?: string;
  }): Promise<{ success: boolean; ticket: SupportTicket }> {
    const res = await fetch(`${API_BASE}/admin/support-tickets/${ticketId}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to resolve support ticket');
    return res.json();
  },

  // Club-coach dashboard data comes from club members and training sessions.
  async getCoachDashboard(): Promise<CoachDashboardData> {
    const res = await fetch(`${API_BASE}/coach/dashboard`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load club coach dashboard');
    return res.json();
  },

  async getPlayerAssessments(): Promise<PlayerAssessment[]> {
    const res = await fetch(`${API_BASE}/club/assessments`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load player assessments');
    return res.json();
  },

  async schedulePlayerAssessment(input: {
    title: string;
    playerId: string;
    coachId?: string;
    discipline: string;
    scheduledDate: string;
    scheduledTime?: string;
    trainingSessionId?: string;
    videoAnalysisId?: string;
  }): Promise<PlayerAssessment> {
    const res = await fetch(`${API_BASE}/club/assessments`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify(input)
    });
    if (!res.ok) throw await responseError(res, 'Failed to schedule player assessment');
    return res.json();
  },

  async getAssessmentCapeJob(assessmentId: string): Promise<CapeJob | null> {
    const res = await fetch(`${API_BASE}/club/assessments/${encodeURIComponent(assessmentId)}/video`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load the video analysis');
    const data = await res.json();
    return data.capeJob ?? null;
  },

  async analyzeAssessmentVideoWithCape(assessmentId: string, file: File, input: CapeAnalysisInput): Promise<{ jobId: string; status: CapeJobStatus }> {
    const form = new FormData();
    form.append('engine', 'cape');
    form.append('target', input.target);
    form.append('handedness', input.handedness);
    if (input.shot_type) form.append('shot_type', input.shot_type);
    if (input.bowler_type) form.append('bowler_type', input.bowler_type);
    form.append('calibration_points', JSON.stringify(input.calibration_points));
    if (input.manual_frames) form.append('manual_frames', JSON.stringify(input.manual_frames));
    form.append('file', file);
    const res = await fetch(`${API_BASE}/club/assessments/${encodeURIComponent(assessmentId)}/video`, {
      method: 'POST',
      headers: bearerHeader(),
      body: form
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'The video could not be submitted for analysis');
    }
    return res.json();
  },

  async getLatestPlayerCapeJob(playerId: string, target: CapeTarget): Promise<CapeJob | null> {
    const query = new URLSearchParams({ playerId, target });
    const res = await fetch(`${API_BASE}/club/cape-jobs/latest?${query}`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load the video analysis');
    const data = await res.json();
    return data.job ?? null;
  },

  // Standalone analysis for a club player: a device file is sent as multipart, a Drive video by id.
  async analyzePlayerVideoWithCape(playerId: string, source: { file?: File; driveFileId?: string }, input: CapeAnalysisInput): Promise<{ jobId: string; status: CapeJobStatus }> {
    let res: Response;
    if (source.file) {
      const form = new FormData();
      form.append('playerId', playerId);
      form.append('target', input.target);
      form.append('handedness', input.handedness);
      if (input.shot_type) form.append('shot_type', input.shot_type);
      if (input.bowler_type) form.append('bowler_type', input.bowler_type);
      form.append('calibration_points', JSON.stringify(input.calibration_points));
      if (input.manual_frames) form.append('manual_frames', JSON.stringify(input.manual_frames));
      form.append('file', source.file);
      res = await fetch(`${API_BASE}/club/cape-jobs`, { method: 'POST', headers: bearerHeader(), body: form });
    } else {
      res = await fetch(`${API_BASE}/club/cape-jobs`, {
        method: 'POST',
        headers: authenticatedHeaders(),
        body: JSON.stringify({ ...input, playerId, driveFileId: source.driveFileId })
      });
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'The video could not be submitted for analysis');
    }
    return res.json();
  },

  // A page of video frames for manual contact selection. Pass centerFrame/before/after to page the clip without Gemini.
  async getCapeContactCandidates(
    source: { file?: File; driveFileId?: string },
    options: { centerFrame?: number; before?: number; after?: number } = {}
  ): Promise<CapeContactCandidates> {
    let res: Response;
    if (source.file) {
      const form = new FormData();
      if (options.centerFrame !== undefined) form.append('centerFrame', String(options.centerFrame));
      if (options.before !== undefined) form.append('before', String(options.before));
      if (options.after !== undefined) form.append('after', String(options.after));
      form.append('file', source.file);
      res = await fetch(`${API_BASE}/club/cape-jobs/contact-candidates`, { method: 'POST', headers: bearerHeader(), body: form });
    } else {
      res = await fetch(`${API_BASE}/club/cape-jobs/contact-candidates`, {
        method: 'POST',
        headers: authenticatedHeaders(),
        body: JSON.stringify({
          driveFileId: source.driveFileId,
          centerFrame: options.centerFrame,
          before: options.before,
          after: options.after
        })
      });
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'The video frames could not be loaded');
    }
    return res.json();
  },

  async fetchDriveVideo(fileId: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/google-drive/videos/${encodeURIComponent(fileId)}/content`, { headers: bearerHeader() });
    if (!res.ok) throw await responseError(res, 'Failed to load the video from Google Drive');
    return res.blob();
  },

  async getPlayerCapeJobs(playerId: string): Promise<CapeJobSummary[]> {
    const res = await fetch(`${API_BASE}/club/cape-jobs?${new URLSearchParams({ playerId })}`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load the video analyses');
    const data = await res.json();
    return data.jobs ?? [];
  },

  async getCapeJob(jobId: string): Promise<CapeJob> {
    const res = await fetch(`${API_BASE}/club/cape-jobs/${encodeURIComponent(jobId)}`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load the video analysis');
    const data = await res.json();
    return data.job;
  },

  async getCapeJobDrillAssignments(jobId: string): Promise<PlayerDrillAssignment[]> {
    const res = await fetch(`${API_BASE}/club/cape-jobs/${encodeURIComponent(jobId)}/drills`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load assigned drills');
    const data = await res.json();
    return data.assignments ?? [];
  },

  // Assigns the suggested drill for one finding to the analysed player and adds it to the drill catalogues.
  async assignCapeGuidanceDrill(jobId: string, faultCode: string): Promise<PlayerDrillAssignment> {
    const res = await fetch(`${API_BASE}/club/cape-jobs/${encodeURIComponent(jobId)}/drills`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify({ faultCode })
    });
    if (!res.ok) throw await responseError(res, 'Failed to assign the drill');
    const data = await res.json();
    return data.assignment;
  },

  // Players get their own assignments; club staff pass the player's id.
  async getAssignedDrills(playerId?: string): Promise<PlayerDrillAssignment[]> {
    const query = playerId ? `?${new URLSearchParams({ playerId })}` : '';
    const res = await fetch(`${API_BASE}/club/cape-jobs/assigned-drills${query}`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to load assigned drills');
    const data = await res.json();
    return data.assignments ?? [];
  },

  // Fetches an analysis image or ZIP through the authenticated Node route (never the CAPE service directly).
  async fetchCapeArtifact(path: string): Promise<{ blob: Blob; fileName: string }> {
    if (!path.startsWith(`${API_BASE}/club/cape-jobs/`)) throw new Error('Invalid download link');
    const res = await fetch(path, { headers: bearerHeader() });
    if (!res.ok) throw await responseError(res, 'The download failed');
    const disposition = res.headers.get('Content-Disposition') || '';
    const fileName = disposition.match(/filename="?([^";]+)"?/)?.[1] || path.split('/').pop() || 'analysis';
    return { blob: await res.blob(), fileName };
  },

  async updatePlayerAssessment(
    assessmentId: string,
    update: {
      status?: 'IN_PROGRESS' | 'COMPLETED';
      metrics?: AssessmentMetric[];
      strengths?: string;
      focusAreas?: string;
      coachFeedback?: string;
      playerFeedback?: string;
    }
  ): Promise<PlayerAssessment> {
    const res = await fetch(`${API_BASE}/club/assessments/${encodeURIComponent(assessmentId)}`, {
      method: 'PATCH',
      headers: authenticatedHeaders(),
      body: JSON.stringify(update)
    });
    if (!res.ok) throw await responseError(res, 'Failed to update player assessment');
    return res.json();
  },

  async generatePlayerAssessmentInsights(assessmentId: string): Promise<PlayerAssessment> {
    const res = await fetch(`${API_BASE}/club/assessments/${encodeURIComponent(assessmentId)}/insights`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      signal: AbortSignal.timeout(180000)
    }).catch(err => {
      if (err?.name === 'TimeoutError') throw new Error('AI insights timed out. Please try again.');
      throw err;
    });
    if (!res.ok) throw await responseError(res, 'Failed to generate assessment insights');
    return res.json();
  },

  async saveSessionExecution(sessionId: string, update: SessionExecutionUpdate): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/coach/sessions/${encodeURIComponent(sessionId)}/execution`, {
      method: 'PATCH',
      headers: authenticatedHeaders(),
      body: JSON.stringify(update)
    });
    if (!res.ok) throw await responseError(res, 'Failed to save session execution');
    const data = await res.json();
    return data.session;
  },

  async addCoachSessionDrill(
    sessionId: string,
    payload: { drillId: string } | { drill: Pick<Drill, 'title' | 'discipline' | 'skillSet' | 'contextType' | 'duration' | 'instructions'> }
  ): Promise<{ session: TrainingSession; drill: Drill }> {
    const res = await fetch(`${API_BASE}/coach/sessions/${encodeURIComponent(sessionId)}/drills`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await responseError(res, 'Failed to add drill to session');
    const data = await res.json();
    return { session: data.session, drill: data.drill };
  },

  async removeCoachSessionDrill(sessionId: string, drillId: string): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/coach/sessions/${encodeURIComponent(sessionId)}/drills/${encodeURIComponent(drillId)}`, {
      method: 'DELETE',
      headers: authenticatedHeaders()
    });
    if (!res.ok) throw await responseError(res, 'Failed to remove drill from session');
    const data = await res.json();
    return data.session;
  },

  async assessSessionWithAi(sessionId: string, notes: string): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/club/sessions/${encodeURIComponent(sessionId)}/post-notes-ai-assess`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify({ notes })
    });
    if (!res.ok) throw await responseError(res, 'AI assessment failed');
    const data = await res.json();
    return data.session;
  },

  async createFollowUpSession(sessionId: string, payload: {
    title: string;
    sessionDate: string;
    durationMinutes: number;
    drillIds: string[];
    recommendedDrillIndexes: number[];
  }): Promise<{ session: TrainingSession; drills: Drill[] }> {
    const res = await fetch(`${API_BASE}/coach/sessions/${encodeURIComponent(sessionId)}/follow-up`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await responseError(res, 'Failed to create follow-up session');
    const data = await res.json();
    return { session: data.session, drills: data.drills || [] };
  },

  // Subscriptions & Checkout
  async checkout(payload: {
    planId: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    name: string;
    email: string;
    organizationName: string;
    cardNumber?: string;
    registrationToken?: string;
  }): Promise<{ approval: ClubApproval; invoice: Invoice; notification: AdminNotification }> {
    const res = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to complete checkout');
    const data = await res.json();
    return data.data;
  },

  // Club Portal Operations
  async getClubMembers(clubId?: string): Promise<ClubMember[]> {
    const sp = clubId ? `?clubId=${clubId}` : '';
    const res = await fetch(`${API_BASE}/club/members${sp}`);
    if (!res.ok) throw new Error('Failed to fetch club members');
    return res.json();
  },

  async inviteMember(member: Partial<ClubMember>): Promise<ClubMember> {
    const res = await fetch(`${API_BASE}/club/members/invite`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify(member)
    });
    if (!res.ok) throw await responseError(res, 'Failed to invite member');
    const data = await res.json();
    return data.member;
  },

  async acceptMemberInvite(memberId: string): Promise<ClubMember> {
    const res = await fetch(`${API_BASE}/club/members/${memberId}/accept-invitation`, {
      method: 'POST',
      headers: authenticatedHeaders()
    });
    if (!res.ok) throw await responseError(res, 'Failed to accept invitation');
    const data = await res.json();
    return data.member;
  },

  async updateClubMember(memberId: string, updates: Partial<ClubMember> & { addSquad?: string; removeSquad?: string }): Promise<ClubMember> {
    const res = await fetch(`${API_BASE}/club/members/${memberId}`, {
      method: 'PATCH',
      headers: authenticatedHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw await responseError(res, 'Failed to update club member');
    const data = await res.json();
    return data.member;
  },

  async getSquads(clubId?: string): Promise<Squad[]> {
    const sp = clubId ? `?clubId=${clubId}` : '';
    const res = await fetch(`${API_BASE}/club/squads${sp}`);
    if (!res.ok) throw new Error('Failed to fetch squads');
    return res.json();
  },

  async addSquad(squad: Partial<Squad>): Promise<Squad> {
    const res = await fetch(`${API_BASE}/club/squads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(squad)
    });
    if (!res.ok) throw new Error('Failed to create squad');
    const data = await res.json();
    return data.squad;
  },

  async updateSquad(squadId: string, updates: Partial<Squad>): Promise<Squad> {
    const res = await fetch(`${API_BASE}/club/squads/${squadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update squad');
    const data = await res.json();
    return data.squad;
  },

  async deleteSquad(squadId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/club/squads/${squadId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete squad');
    return true;
  },

  async getSessions(clubId?: string): Promise<TrainingSession[]> {
    const sp = clubId ? `?clubId=${clubId}` : '';
    const res = await fetch(`${API_BASE}/club/sessions${sp}`);
    if (!res.ok) throw new Error('Failed to fetch sessions');
    return res.json();
  },

  async scheduleSession(session: Partial<TrainingSession>): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/club/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    if (!res.ok) throw await responseError(res, 'Failed to schedule session');
    const data = await res.json();
    return data.session;
  },

  async publishSession(sessionId: string): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/club/sessions/${sessionId}/publish`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to publish session');
    const data = await res.json();
    return data.session;
  },

  async updateSession(sessionId: string, updates: Partial<TrainingSession>): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/club/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: authenticatedHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw await responseError(res, 'Failed to update session');
    const data = await res.json();
    return data.session;
  },

  // Incorporates a drill (adopted AI recommendation or manually picked by a coach) into an
  // upcoming training session (appends it to the session's drill list) so it's actually
  // reflected in that squad's training plan.
  async addDrillToSession(sessionId: string, drillId?: string): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/club/sessions/${sessionId}/add-drill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drillId })
    });
    if (!res.ok) throw new Error('Failed to add drill to session');
    const data = await res.json();
    return data.session;
  },

  async removeDrillFromSession(sessionId: string, drillId: string): Promise<TrainingSession> {
    const res = await fetch(`${API_BASE}/club/sessions/${sessionId}/remove-drill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drillId })
    });
    if (!res.ok) throw new Error('Failed to remove drill from session');
    const data = await res.json();
    return data.session;
  },

  async deleteSession(sessionId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/club/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: authenticatedHeaders()
    });
    if (!res.ok) throw await responseError(res, 'Failed to delete session');
    return true;
  },

  async getCertificates(): Promise<Certificate[]> {
    const res = await fetch(`${API_BASE}/club/certificates`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to fetch certificates');
    return res.json();
  },

  async deleteCertificate(certificateId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/club/certificates/${encodeURIComponent(certificateId)}`, {
      method: 'DELETE',
      headers: authenticatedHeaders()
    });
    if (!res.ok) throw await responseError(res, 'Failed to delete certificate');
  },

  async promotePlayer(playerId: string, payload: { action: 'PROMOTE'; newLevel: string; coachName?: string; coachNotes?: string; aiCommendation?: string }): Promise<{ certificate: Certificate; member: ClubMember }> {
    const res = await fetch(`${API_BASE}/club/players/${playerId}/assess-progress`, {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await responseError(res, 'Failed to assess and promote player');
    return res.json();
  },

  async getClubBranding(): Promise<{ logoUrl: string | null }> {
    const res = await fetch(`${API_BASE}/club/settings/branding`, { headers: authenticatedHeaders() });
    if (!res.ok) throw await responseError(res, 'Failed to fetch club branding');
    return res.json();
  },

  async updateClubBranding(logoUrl: string | null): Promise<{ logoUrl: string | null }> {
    const res = await fetch(`${API_BASE}/club/settings/branding`, {
      method: 'PATCH',
      headers: authenticatedHeaders(),
      body: JSON.stringify({ logoUrl })
    });
    if (!res.ok) throw await responseError(res, 'Failed to save club branding');
    return res.json();
  },

  // Real video analysis via the backend (Gemini multimodal video understanding).
  // Pass videoFile for a device-uploaded clip, or driveFileId for a clip already in Google Drive.
  // playerId/playerName attribute the saved result to a specific player so history can be filtered.
  async analyzeVideo(payload: {
    discipline: string;
    context?: 'INDIVIDUAL' | 'GROUP';
    videoFile?: File;
    driveFileId?: string;
    videoUrl?: string;
    playerId?: string;
    playerName?: string;
  }): Promise<{
    status: string;
    discipline: string;
    analysis: import('../types').VideoAnalysisResult;
    analysisId: string | null;
  }> {
    const token = localStorage.getItem('auth_token');
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    if (payload.videoFile) {
      const formData = new FormData();
      formData.append('file', payload.videoFile, payload.videoFile.name);
      formData.append('discipline', payload.discipline);
      if (payload.context) formData.append('context', payload.context);
      if (payload.playerId) formData.append('playerId', payload.playerId);
      if (payload.playerName) formData.append('playerName', payload.playerName);
      const res = await fetch(`${API_BASE}/videos/analyze`, {
        method: 'POST',
        headers: authHeader,
        body: formData
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to analyze video clip');
      }
      return res.json();
    }

    const res = await fetch(`${API_BASE}/videos/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        discipline: payload.discipline,
        context: payload.context,
        driveFileId: payload.driveFileId,
        videoUrl: payload.videoUrl,
        playerId: payload.playerId,
        playerName: payload.playerName
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to analyze video clip');
    }
    return res.json();
  },

  async analyzeOpenAiBatting(payload: {
    videoFile?: File;
    driveFileId?: string;
    playerId?: string;
    contactTimestampSeconds?: number;
  }): Promise<{
    status: 'COMPLETED';
    discipline: 'BATTING';
    playerId: string | null;
    playerName: string | null;
    reportId: string;
    artifactNames: string[];
    analysis: OpenAiBattingAnalysis;
  }> {
    const token = localStorage.getItem('auth_token');
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    let res: Response;
    if (payload.videoFile) {
      const formData = new FormData();
      formData.append('file', payload.videoFile, payload.videoFile.name);
      if (payload.playerId) formData.append('playerId', payload.playerId);
      if (payload.contactTimestampSeconds !== undefined) formData.append('contactTimestampSeconds', String(payload.contactTimestampSeconds));
      res = await fetch(`${API_BASE}/videos/analyze/openai-batting`, {
        method: 'POST',
        headers: authHeader,
        body: formData
      });
    } else {
      res = await fetch(`${API_BASE}/videos/analyze/openai-batting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          driveFileId: payload.driveFileId,
          playerId: payload.playerId,
          contactTimestampSeconds: payload.contactTimestampSeconds
        })
      });
    }
    if (!res.ok) throw await responseError(res, 'Failed to analyze batting video with OpenAI');
    const result = await res.json();
    return {
      ...result,
      analysis: { ...result.analysis, reportId: result.reportId, artifactNames: result.artifactNames }
    };
  },

  async fetchOpenAiBattingArtifact(reportId: string, name: string): Promise<{ blob: Blob; fileName: string }> {
    const allowedNames = new Set([
      'analysis.json', 'joint_angles.json', 'contact_review.png', 'joint_analysis.png',
      'bat_path_sequence.png', 'follow_through.png', 'phase_sequence.png', 'report.md',
      'execution_log.json', 'analysis_bundle.zip'
    ]);
    if (!/^[0-9a-f-]{36}$/i.test(reportId) || !allowedNames.has(name)) throw new Error('Invalid report artifact');
    const res = await fetch(`${API_BASE}/videos/analyze/openai-batting/${encodeURIComponent(reportId)}/artifacts/${encodeURIComponent(name)}`, {
      headers: authenticatedHeaders()
    });
    if (!res.ok) throw await responseError(res, 'The report download failed');
    return { blob: await res.blob(), fileName: name };
  },

  async analyzeKinematicsOverlay(payload: {
    discipline: string;
    videoFile?: File;
    driveFileId?: string;
  }): Promise<{
    discipline: string;
    timestampMs: number;
    issues: string[];
    metrics: Record<string, string | number>;
    overlayImageBase64: string;
    overlayMimeType: string;
    overlaySeries: Array<{
      timestampMs: number;
      overlayImageBase64: string;
      overlayMimeType: string;
      phase: string;
    }>;
    cricketInterpretation: {
      cricketSummary: string;
      phase: string;
      contactTimestampMs: number | null;
      contactConfidence: number;
      ballLine: { status: 'DETECTED' | 'NOT_VISIBLE' | 'UNCERTAIN'; label: string; confidence: number; evidence: string };
      errors: Array<{ title: string; cricketMeaning: string; evidence: string }>;
      corrections: Array<{ title: string; coachingCue: string; drill: string }>;
    } | null;
    cricketInterpretationError: string | null;
  }> {
    const token = localStorage.getItem('auth_token');
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    let res: Response;

    if (payload.videoFile) {
      const formData = new FormData();
      formData.append('file', payload.videoFile, payload.videoFile.name);
      formData.append('discipline', payload.discipline);
      res = await fetch(`${API_BASE}/videos/kinematics/analyze`, {
        method: 'POST',
        headers: authHeader,
        body: formData
      });
    } else {
      res = await fetch(`${API_BASE}/videos/kinematics/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ discipline: payload.discipline, driveFileId: payload.driveFileId })
      });
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to create the kinematic overlay');
    }
    return res.json();
  },

  async analyzePoseOverlayImage(
    imageDataUrl: string,
    handedness: 'right' | 'left',
    shotType: string,
    openAiLandmarks: Record<string, { x: number; y: number } | null>,
    openAiContactPoint: { x: number; y: number } | null,
    sequenceFrames: Array<{ frameIndex: number; timestampSeconds: number; phase: string; imageDataUrl: string }> = []
  ): Promise<PoseOverlayAnalysis> {
    const formData = new FormData();
    const appendImage = (field: string, dataUrl: string, filename: string) => {
      const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new Error('A contact-sequence frame is not a supported base64 image.');
      const binary = atob(match[2]);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      formData.append(field, new Blob([bytes], { type: match[1] }), filename);
    };
    appendImage('image', imageDataUrl, 'openai-contact-crop.jpg');
    formData.append('handedness', handedness);
    formData.append('shotType', shotType);
    formData.append('openAiLandmarks', JSON.stringify(openAiLandmarks));
    formData.append('openAiContactPoint', JSON.stringify(openAiContactPoint));
    sequenceFrames.forEach((frame, index) => {
      appendImage('sequenceImages', frame.imageDataUrl, `contact-sequence-${index}.jpg`);
    });
    formData.append('sequenceMetadata', JSON.stringify(sequenceFrames.map(({ frameIndex, timestampSeconds, phase }) => ({ frameIndex, timestampSeconds, phase }))));
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/videos/kinematics/analyze-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'The cropped image pose analysis failed');
    }
    return res.json();
  },

  // Fetch previously saved real Gemini video analysis results (most recent first), optionally
  // filtered to a specific player, persisted server-side in video_analysis_store.
  async getVideoAnalysisHistory(playerId?: string): Promise<{
    history: Array<{
      id: string;
      playerId: string | null;
      playerName: string | null;
      discipline: string;
      context: string;
      sourceType: string;
      driveFileId: string | null;
      model: string;
      overallScore: number;
      analysis: import('../types').VideoAnalysisResult;
      drillAdopted: boolean;
      createdAt: string;
    }>;
  }> {
    const token = localStorage.getItem('auth_token');
    if (!token) return { history: [] };
    const query = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
    const res = await fetch(`${API_BASE}/videos/analyze/history${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { history: [] };
    return res.json();
  },

  // Fetch a single saved analysis result in full detail (for the detail view).
  async getVideoAnalysisById(id: string): Promise<{
    entry: {
      id: string;
      playerId: string | null;
      playerName: string | null;
      discipline: string;
      context: string;
      sourceType: string;
      driveFileId: string | null;
      model: string;
      overallScore: number;
      analysis: import('../types').VideoAnalysisResult;
      drillAdopted: boolean;
      createdAt: string;
    } | null;
  }> {
    const token = localStorage.getItem('auth_token');
    if (!token) return { entry: null };
    const res = await fetch(`${API_BASE}/videos/analyze/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { entry: null };
    return res.json();
  },

  // Mark a saved analysis's recommended drill as adopted into the training catalogue.
  async markVideoAnalysisDrillAdopted(id: string): Promise<{ status: string; drillAdopted: boolean }> {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/videos/analyze/${id}/adopt-drill`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Failed to update the analysis result.');
    return res.json();
  },


  // Google Drive Integration (real OAuth 2.0 + Drive API v3)
  getGoogleDriveConnectUrl(): string {
    const token = localStorage.getItem('auth_token') || '';
    return `${API_BASE}/google-drive/connect?token=${encodeURIComponent(token)}`;
  },

  async getGoogleDriveStatus(): Promise<import('../types').GoogleDriveStatus> {
    const token = localStorage.getItem('auth_token');
    if (!token) return { connected: false, email: null };
    const res = await fetch(`${API_BASE}/google-drive/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { connected: false, email: null };
    return res.json();
  },

  async listGoogleDriveVideos(): Promise<{ files: import('../types').DriveVideoFile[]; email?: string }> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('You must be signed in to access Google Drive.');
    const res = await fetch(`${API_BASE}/google-drive/videos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to list Google Drive videos');
    }
    return res.json();
  },

  async disconnectGoogleDrive(): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    await fetch(`${API_BASE}/google-drive/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  // Backs up a device-uploaded video into the user's connected Google Drive account, organized
  // into an eCricketCoach/{playerName}/{discipline} folder structure.
  async uploadVideoToGoogleDrive(file: File, playerName: string, discipline: string): Promise<import('../types').DriveVideoFile> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('You must be signed in to back up videos to Google Drive.');
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('playerName', playerName);
    formData.append('discipline', discipline);
    const res = await fetch(`${API_BASE}/google-drive/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to back up the video to Google Drive.');
    }
    const data = await res.json();
    return data.file;
  }
};
