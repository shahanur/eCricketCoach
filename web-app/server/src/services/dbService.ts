import { pool } from '../config/database.js';

export class DbService {
  // Drills
  static async getDrills(filters?: { context?: string; discipline?: string; source?: string; clubId?: string }) {
    let query = 'SELECT * FROM drills_store WHERE 1=1';
    const params: any[] = [];
    if (filters?.context) {
      params.push(filters.context.toUpperCase());
      query += ` AND UPPER(context_type) = $${params.length}`;
    }
    if (filters?.discipline) {
      params.push(filters.discipline.toUpperCase());
      query += ` AND UPPER(discipline) = $${params.length}`;
    }
    if (filters?.source) {
      params.push(filters.source.toUpperCase());
      query += ` AND UPPER(source) = $${params.length}`;
    }
    if (filters?.clubId) {
      params.push(filters.clubId);
      query += ` AND (source = 'SYSTEM_PREDEFINED' OR club_id = $${params.length})`;
    }
    query += ' ORDER BY id DESC';
    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      title: r.title,
      discipline: r.discipline,
      skillSet: r.skill_set,
      contextType: r.context_type,
      duration: r.duration,
      durationMinutes: r.duration,
      source: r.source,
      clubId: r.club_id,
      clubName: r.club_name,
      instructions: r.instructions
    }));
  }

  static async createDrill(drill: any) {
    const res = await pool.query(
      `INSERT INTO drills_store (id, title, discipline, skill_set, context_type, duration, source, club_id, club_name, instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        drill.id,
        drill.title,
        drill.discipline,
        drill.skillSet,
        drill.contextType,
        drill.duration || drill.durationMinutes || 20,
        drill.source,
        drill.clubId || null,
        drill.clubName || null,
        drill.instructions || null
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      title: r.title,
      discipline: r.discipline,
      skillSet: r.skill_set,
      contextType: r.context_type,
      duration: r.duration,
      durationMinutes: r.duration,
      source: r.source,
      clubId: r.club_id,
      clubName: r.club_name,
      instructions: r.instructions
    };
  }

  // Customers
  static async getCustomers(search?: string, type?: string, status?: string) {
    let query = 'SELECT * FROM customer_tenants WHERE 1=1';
    const params: any[] = [];
    if (type) {
      params.push(type.toUpperCase());
      query += ` AND UPPER(type) = $${params.length}`;
    }
    if (status) {
      params.push(status.toUpperCase());
      query += ` AND UPPER(status) = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`;
    }
    query += ' ORDER BY joined_at DESC';
    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      email: r.email,
      subscriptionPlan: r.subscription_plan,
      status: r.status,
      billingCycle: r.billing_cycle,
      mrr: Number(r.mrr),
      activeMembers: r.active_members,
      joinedAt: r.joined_at
    }));
  }

  static async createCustomer(customer: any) {
    const res = await pool.query(
      `INSERT INTO customer_tenants (id, name, type, email, subscription_plan, status, billing_cycle, mrr, active_members, joined_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        customer.id,
        customer.name,
        customer.type,
        customer.email,
        customer.subscriptionPlan,
        customer.status,
        customer.billingCycle,
        customer.mrr || 0,
        customer.activeMembers || 1,
        customer.joinedAt || new Date().toISOString().split('T')[0]
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      email: r.email,
      subscriptionPlan: r.subscription_plan,
      status: r.status,
      billingCycle: r.billing_cycle,
      mrr: Number(r.mrr),
      activeMembers: r.active_members,
      joinedAt: r.joined_at
    };
  }

  static async updateCustomer(id: string, updates: { status?: string; subscriptionPlan?: string; mrr?: number }) {
    let query = 'UPDATE customer_tenants SET ';
    const sets: string[] = [];
    const params: any[] = [];
    if (updates.status) {
      params.push(updates.status);
      sets.push(`status = $${params.length}`);
    }
    if (updates.subscriptionPlan) {
      params.push(updates.subscriptionPlan);
      sets.push(`subscription_plan = $${params.length}`);
    }
    if (updates.mrr !== undefined) {
      params.push(updates.mrr);
      sets.push(`mrr = $${params.length}`);
    }
    if (sets.length === 0) return null;
    params.push(id);
    query += sets.join(', ') + ` WHERE id = $${params.length} RETURNING *`;
    const res = await pool.query(query, params);
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      email: r.email,
      subscriptionPlan: r.subscription_plan,
      status: r.status,
      billingCycle: r.billing_cycle,
      mrr: Number(r.mrr),
      activeMembers: r.active_members,
      joinedAt: r.joined_at
    };
  }

  // Invoices
  static async getInvoices() {
    const res = await pool.query('SELECT * FROM invoices ORDER BY invoice_date DESC');
    return res.rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      customerName: r.customer_name,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      date: r.invoice_date,
      planName: r.plan_name
    }));
  }

  static async createInvoice(inv: any) {
    const res = await pool.query(
      `INSERT INTO invoices (id, tenant_id, customer_name, amount, currency, status, invoice_date, plan_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [inv.id, inv.tenantId, inv.customerName, inv.amount, inv.currency || 'USD', inv.status, inv.date, inv.planName]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      customerName: r.customer_name,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      date: r.invoice_date,
      planName: r.plan_name
    };
  }

  static async updateInvoiceStatus(id: string, status: string) {
    const res = await pool.query('UPDATE invoices SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      customerName: r.customer_name,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      date: r.invoice_date,
      planName: r.plan_name
    };
  }

  // Club Approvals
  static async getClubApprovals() {
    const res = await pool.query('SELECT * FROM club_approvals_store ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      clubName: r.club_name,
      adminName: r.admin_name,
      adminEmail: r.admin_email,
      plan: r.plan,
      amountPaid: Number(r.amount_paid),
      type: r.type,
      billingCycle: r.billing_cycle,
      status: r.status,
      createdAt: r.created_at
    }));
  }

  static async createClubApproval(appr: any) {
    const res = await pool.query(
      `INSERT INTO club_approvals_store (id, club_name, admin_name, admin_email, plan, amount_paid, type, billing_cycle, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        appr.id,
        appr.clubName,
        appr.adminName,
        appr.adminEmail,
        appr.plan,
        appr.amountPaid,
        appr.type || 'CLUB',
        appr.billingCycle || 'ANNUAL',
        appr.status || 'AWAITING_APPROVAL',
        appr.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 16)
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      clubName: r.club_name,
      adminName: r.admin_name,
      adminEmail: r.admin_email,
      plan: r.plan,
      amountPaid: Number(r.amount_paid),
      type: r.type,
      billingCycle: r.billing_cycle,
      status: r.status,
      createdAt: r.created_at
    };
  }

  static async approveClub(id: string) {
    const res = await pool.query('UPDATE club_approvals_store SET status = $1 WHERE id = $2 RETURNING *', ['APPROVED', id]);
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      clubName: r.club_name,
      adminName: r.admin_name,
      adminEmail: r.admin_email,
      plan: r.plan,
      amountPaid: Number(r.amount_paid),
      type: r.type,
      billingCycle: r.billing_cycle,
      status: r.status,
      createdAt: r.created_at
    };
  }

  // Admin Notifications
  static async getNotifications() {
    const res = await pool.query('SELECT * FROM admin_notifications ORDER BY timestamp DESC');
    return res.rows.map(r => ({
      id: r.id,
      title: r.title,
      message: r.message,
      type: r.type,
      timestamp: r.timestamp,
      read: r.is_read
    }));
  }

  static async createNotification(notif: any) {
    const res = await pool.query(
      `INSERT INTO admin_notifications (id, title, message, type, timestamp, is_read)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [notif.id, notif.title, notif.message, notif.type, notif.timestamp, notif.read || false]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      title: r.title,
      message: r.message,
      type: r.type,
      timestamp: r.timestamp,
      read: r.is_read
    };
  }

  // Club Members
  static async getClubMembers(clubId?: string) {
    let query = 'SELECT * FROM club_members_store';
    const params: any[] = [];
    if (clubId) {
      params.push(clubId);
      query += ' WHERE club_id = $1';
    }
    query += ' ORDER BY id ASC';
    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      ageGroup: r.age_group,
      discipline: r.discipline,
      invitationStatus: r.invitation_status,
      currentLevel: r.current_level,
      squad: r.squad
    }));
  }

  static async createClubMember(member: any) {
    const res = await pool.query(
      `INSERT INTO club_members_store (id, club_id, name, email, role, age_group, discipline, invitation_status, current_level, squad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        member.id,
        member.clubId || 'ten-003',
        member.name,
        member.email,
        member.role,
        member.ageGroup,
        member.discipline,
        member.invitationStatus || 'PENDING_ACCEPTANCE',
        member.currentLevel || 'FOUNDATION',
        member.squad || 'Unassigned'
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      ageGroup: r.age_group,
      discipline: r.discipline,
      invitationStatus: r.invitation_status,
      currentLevel: r.current_level,
      squad: r.squad
    };
  }

  static async updateClubMember(id: string, updates: { invitationStatus?: string; currentLevel?: string; squad?: string }) {
    let query = 'UPDATE club_members_store SET ';
    const sets: string[] = [];
    const params: any[] = [];
    if (updates.invitationStatus) {
      params.push(updates.invitationStatus);
      sets.push(`invitation_status = $${params.length}`);
    }
    if (updates.currentLevel) {
      params.push(updates.currentLevel);
      sets.push(`current_level = $${params.length}`);
    }
    if (updates.squad) {
      params.push(updates.squad);
      sets.push(`squad = $${params.length}`);
    }
    if (sets.length === 0) return null;
    params.push(id);
    query += sets.join(', ') + ` WHERE id = $${params.length} RETURNING *`;
    const res = await pool.query(query, params);
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      ageGroup: r.age_group,
      discipline: r.discipline,
      invitationStatus: r.invitation_status,
      currentLevel: r.current_level,
      squad: r.squad
    };
  }

  // Squads
  static async getSquads(clubId?: string) {
    let query = 'SELECT * FROM squads_store';
    const params: any[] = [];
    if (clubId) {
      params.push(clubId);
      query += ' WHERE club_id = $1';
    }
    query += ' ORDER BY id ASC';
    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      ageGroup: r.age_group,
      discipline: r.discipline,
      coachName: r.coach_name,
      memberCount: r.member_count
    }));
  }

  static async createSquad(squad: any) {
    const res = await pool.query(
      `INSERT INTO squads_store (id, club_id, name, age_group, discipline, coach_name, member_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        squad.id,
        squad.clubId || 'ten-003',
        squad.name,
        squad.ageGroup,
        squad.discipline,
        squad.coachName,
        squad.memberCount || 0
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      ageGroup: r.age_group,
      discipline: r.discipline,
      coachName: r.coach_name,
      memberCount: r.member_count
    };
  }

  // Training Sessions
  static async getTrainingSessions(clubId?: string) {
    let query = 'SELECT * FROM training_sessions_store';
    const params: any[] = [];
    if (clubId) {
      params.push(clubId);
      query += ' WHERE club_id = $1';
    }
    query += ' ORDER BY session_date DESC';
    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      squadName: r.squad_name,
      title: r.title,
      sessionDate: r.session_date,
      durationMinutes: r.duration_minutes,
      isPublished: r.is_published,
      drillCount: r.drill_count,
      postNotes: r.post_notes,
      aiEvaluation: r.ai_evaluation
    }));
  }

  static async createTrainingSession(sess: any) {
    const res = await pool.query(
      `INSERT INTO training_sessions_store (id, club_id, squad_name, title, session_date, duration_minutes, is_published, drill_count, post_notes, ai_evaluation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        sess.id,
        sess.clubId || 'ten-003',
        sess.squadName,
        sess.title,
        sess.sessionDate,
        sess.durationMinutes || 90,
        sess.isPublished || false,
        sess.drillCount || (sess.drills ? sess.drills.length : 0),
        sess.postNotes || null,
        sess.aiEvaluation ? JSON.stringify(sess.aiEvaluation) : null
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      squadName: r.squad_name,
      title: r.title,
      sessionDate: r.session_date,
      durationMinutes: r.duration_minutes,
      isPublished: r.is_published,
      drillCount: r.drill_count,
      postNotes: r.post_notes,
      aiEvaluation: r.ai_evaluation
    };
  }

  static async publishTrainingSession(id: string) {
    const res = await pool.query(
      'UPDATE training_sessions_store SET is_published = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      squadName: r.squad_name,
      title: r.title,
      sessionDate: r.session_date,
      durationMinutes: r.duration_minutes,
      isPublished: r.is_published,
      drillCount: r.drill_count,
      postNotes: r.post_notes,
      aiEvaluation: r.ai_evaluation
    };
  }

  static async updateSessionNotesAndEvaluation(id: string, notes: string, aiEvaluation: any) {
    const res = await pool.query(
      'UPDATE training_sessions_store SET post_notes = $1, ai_evaluation = $2 WHERE id = $3 RETURNING *',
      [notes, JSON.stringify(aiEvaluation), id]
    );
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      squadName: r.squad_name,
      title: r.title,
      sessionDate: r.session_date,
      durationMinutes: r.duration_minutes,
      isPublished: r.is_published,
      drillCount: r.drill_count,
      postNotes: r.post_notes,
      aiEvaluation: r.ai_evaluation
    };
  }

  // Certificates
  static async getCertificates() {
    const res = await pool.query('SELECT * FROM certificates_store ORDER BY issued_date DESC');
    return res.rows.map(r => ({
      id: r.id,
      certificateNumber: r.certificate_number,
      playerName: r.player_name,
      discipline: r.discipline,
      achievedLevel: r.achieved_level,
      issuedDate: r.issued_date,
      coachName: r.coach_name,
      coachNotes: r.coach_notes,
      aiCommendation: r.ai_commendation || r.ai_recommendation
    }));
  }

  static async createCertificate(cert: any) {
    const res = await pool.query(
      `INSERT INTO certificates_store (id, certificate_number, player_id, player_name, discipline, achieved_level, issued_date, coach_name, coach_notes, ai_commendation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        cert.id,
        cert.certificateNumber,
        cert.playerId || null,
        cert.playerName,
        cert.discipline,
        cert.achievedLevel,
        cert.issuedDate,
        cert.coachName,
        cert.coachNotes,
        cert.aiCommendation
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      certificateNumber: r.certificate_number,
      playerName: r.player_name,
      discipline: r.discipline,
      achievedLevel: r.achieved_level,
      issuedDate: r.issued_date,
      coachName: r.coach_name,
      coachNotes: r.coach_notes,
      aiCommendation: r.ai_commendation
    };
  }
}
