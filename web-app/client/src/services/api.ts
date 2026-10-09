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
  AssessmentMetric
} from '../types';

const API_BASE = '/api';

function authenticatedHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
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

  async updateClubMember(memberId: string, updates: Partial<ClubMember>): Promise<ClubMember> {
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
