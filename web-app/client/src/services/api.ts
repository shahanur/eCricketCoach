import {
  Drill,
  CustomerTenant,
  Invoice,
  ClubApproval,
  ClubMember,
  Squad,
  TrainingSession,
  Certificate,
  AdminNotification
} from '../types';

const API_BASE = '/api';

export const api = {
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
    if (!res.ok) throw new Error('Failed to create club drill');
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

  // Subscriptions & Checkout
  async checkout(payload: {
    planId: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    name: string;
    email: string;
    organizationName: string;
    cardNumber?: string;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member)
    });
    if (!res.ok) throw new Error('Failed to invite member');
    const data = await res.json();
    return data.member;
  },

  async acceptMemberInvite(memberId: string): Promise<ClubMember> {
    const res = await fetch(`${API_BASE}/club/members/${memberId}/accept-invitation`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to accept invitation');
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
    if (!res.ok) throw new Error('Failed to schedule session');
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

  async getCertificates(): Promise<Certificate[]> {
    const res = await fetch(`${API_BASE}/club/certificates`);
    if (!res.ok) throw new Error('Failed to fetch certificates');
    return res.json();
  },

  async promotePlayer(playerId: string, payload: { action: 'PROMOTE'; newLevel: string; coachNotes?: string }): Promise<{ certificate: Certificate; member: ClubMember }> {
    const res = await fetch(`${API_BASE}/club/players/${playerId}/assess-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to assess and promote player');
    return res.json();
  },

  async uploadDriveVideo(playerId: string, payload: { fileName: string; discipline: string; playerName?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/club/players/${playerId}/upload-drive-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to upload video to Drive');
    return res.json();
  }
};
