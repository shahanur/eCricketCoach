import { prisma } from '../config/prisma.js';

export class DbService {
  // Option to expose prisma directly and raw SQL helpers
  static get client() {
    return prisma;
  }

  /**
   * Helper to execute raw SQL queries when complex SQL or custom operations are needed
   */
  static async executeRawSql<T = any>(query: string, ...params: any[]): Promise<T> {
    return prisma.$queryRawUnsafe<T>(query, ...params);
  }

  // --- Drills ---
  static async getDrills(filters?: { context?: string; discipline?: string; source?: string; clubId?: string }) {
    const where: any = {};
    if (filters?.context) {
      where.contextType = { equals: filters.context, mode: 'insensitive' };
    }
    if (filters?.discipline) {
      where.discipline = { equals: filters.discipline, mode: 'insensitive' };
    }
    if (filters?.source) {
      where.source = { equals: filters.source, mode: 'insensitive' };
    }
    if (filters?.clubId) {
      where.OR = [
        { source: 'SYSTEM_PREDEFINED' },
        { clubId: filters.clubId }
      ];
    }

    const drills = await prisma.drillStore.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return drills.map(d => ({
      id: d.id,
      title: d.title,
      discipline: d.discipline,
      skillSet: d.skillSet,
      contextType: d.contextType,
      duration: d.duration,
      durationMinutes: d.duration,
      source: d.source,
      clubId: d.clubId,
      clubName: d.clubName,
      squadId: d.squadId,
      squadName: d.squadName,
      instructions: d.instructions,
      imageUrl: d.imageUrl
    }));
  }

  static async createDrill(drill: any) {
    const created = await prisma.drillStore.create({
      data: {
        id: drill.id,
        title: drill.title,
        discipline: drill.discipline,
        skillSet: drill.skillSet,
        contextType: drill.contextType,
        duration: drill.duration || drill.durationMinutes || 20,
        source: drill.source,
        clubId: drill.clubId || null,
        clubName: drill.clubName || null,
        squadId: drill.squadId || null,
        squadName: drill.squadName || null,
        instructions: drill.instructions || null,
        imageUrl: drill.imageUrl || null
      }
    });

    return {
      id: created.id,
      title: created.title,
      discipline: created.discipline,
      skillSet: created.skillSet,
      contextType: created.contextType,
      duration: created.duration,
      durationMinutes: created.duration,
      source: created.source,
      clubId: created.clubId,
      clubName: created.clubName,
      squadId: created.squadId,
      squadName: created.squadName,
      instructions: created.instructions,
      imageUrl: created.imageUrl
    };
  }

  static async updateDrill(id: string, updates: {
    title?: string;
    discipline?: string;
    skillSet?: string;
    contextType?: string;
    duration?: number;
    instructions?: string;
    imageUrl?: string | null;
  }) {
    try {
      const data: any = {};
      if (updates.title !== undefined) data.title = updates.title;
      if (updates.discipline !== undefined) data.discipline = updates.discipline;
      if (updates.skillSet !== undefined) data.skillSet = updates.skillSet;
      if (updates.contextType !== undefined) data.contextType = updates.contextType;
      if (updates.duration !== undefined) data.duration = updates.duration;
      if (updates.instructions !== undefined) data.instructions = updates.instructions;
      if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl;

      const updated = await prisma.drillStore.update({
        where: { id },
        data
      });

      return {
        id: updated.id,
        title: updated.title,
        discipline: updated.discipline,
        skillSet: updated.skillSet,
        contextType: updated.contextType,
        duration: updated.duration,
        durationMinutes: updated.duration,
        source: updated.source,
        clubId: updated.clubId,
        clubName: updated.clubName,
        squadId: updated.squadId,
        squadName: updated.squadName,
        instructions: updated.instructions,
        imageUrl: updated.imageUrl
      };
    } catch {
      return null;
    }
  }

  static async deleteDrill(id: string) {
    try {
      await prisma.drillStore.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // --- Customers / Tenants ---
  static async getCustomers(search?: string, type?: string, status?: string) {
    const where: any = {};
    if (type) {
      where.type = { equals: type, mode: 'insensitive' };
    }
    if (status) {
      where.status = { equals: status, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const customers = await prisma.customerTenant.findMany({
      where,
      orderBy: { joinedAt: 'desc' }
    });

    return customers.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      email: c.email,
      subscriptionPlan: c.subscriptionPlan,
      status: c.status,
      billingCycle: c.billingCycle,
      mrr: Number(c.mrr),
      activeMembers: c.activeMembers,
      joinedAt: c.joinedAt
    }));
  }

  static async createCustomer(customer: any) {
    const created = await prisma.customerTenant.create({
      data: {
        id: customer.id,
        name: customer.name,
        type: customer.type,
        email: customer.email,
        subscriptionPlan: customer.subscriptionPlan,
        status: customer.status,
        billingCycle: customer.billingCycle,
        mrr: customer.mrr || 0,
        activeMembers: customer.activeMembers || 1,
        joinedAt: customer.joinedAt || new Date().toISOString().split('T')[0]
      }
    });

    return {
      id: created.id,
      name: created.name,
      type: created.type,
      email: created.email,
      subscriptionPlan: created.subscriptionPlan,
      status: created.status,
      billingCycle: created.billingCycle,
      mrr: Number(created.mrr),
      activeMembers: created.activeMembers,
      joinedAt: created.joinedAt
    };
  }

  static async updateCustomer(id: string, updates: { status?: string; subscriptionPlan?: string; mrr?: number }) {
    const data: any = {};
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.subscriptionPlan !== undefined) data.subscriptionPlan = updates.subscriptionPlan;
    if (updates.mrr !== undefined) data.mrr = updates.mrr;

    try {
      const updated = await prisma.customerTenant.update({
        where: { id },
        data
      });

      return {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        email: updated.email,
        subscriptionPlan: updated.subscriptionPlan,
        status: updated.status,
        billingCycle: updated.billingCycle,
        mrr: Number(updated.mrr),
        activeMembers: updated.activeMembers,
        joinedAt: updated.joinedAt
      };
    } catch {
      return null;
    }
  }

  // --- Invoices ---
  static async getInvoices() {
    const invoices = await prisma.invoice.findMany({
      orderBy: { date: 'desc' }
    });

    return invoices.map(i => ({
      id: i.id,
      tenantId: i.tenantId,
      customerName: i.customerName,
      amount: Number(i.amount),
      currency: i.currency,
      status: i.status,
      date: i.date,
      planName: i.planName
    }));
  }

  static async createInvoice(inv: any) {
    const created = await prisma.invoice.create({
      data: {
        id: inv.id,
        tenantId: inv.tenantId,
        customerName: inv.customerName,
        amount: inv.amount,
        currency: inv.currency || 'GBP',
        status: inv.status,
        date: inv.date,
        planName: inv.planName
      }
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      customerName: created.customerName,
      amount: Number(created.amount),
      currency: created.currency,
      status: created.status,
      date: created.date,
      planName: created.planName
    };
  }

  static async updateInvoiceStatus(id: string, status: string) {
    try {
      const updated = await prisma.invoice.update({
        where: { id },
        data: { status }
      });

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        customerName: updated.customerName,
        amount: Number(updated.amount),
        currency: updated.currency,
        status: updated.status,
        date: updated.date,
        planName: updated.planName
      };
    } catch {
      return null;
    }
  }

  // --- Club Approvals ---
  static async getClubApprovals() {
    const approvals = await prisma.clubApproval.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return approvals.map(a => ({
      id: a.id,
      clubName: a.clubName,
      adminName: a.adminName,
      adminEmail: a.adminEmail,
      plan: a.plan,
      amountPaid: Number(a.amountPaid),
      type: a.type,
      billingCycle: a.billingCycle,
      status: a.status,
      createdAt: a.createdAt
    }));
  }

  static async createClubApproval(appr: any) {
    const created = await prisma.clubApproval.create({
      data: {
        id: appr.id,
        clubName: appr.clubName,
        adminName: appr.adminName,
        adminEmail: appr.adminEmail,
        plan: appr.plan,
        amountPaid: appr.amountPaid,
        type: appr.type || 'CLUB',
        billingCycle: appr.billingCycle || 'ANNUAL',
        status: appr.status || 'AWAITING_APPROVAL',
        createdAt: appr.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 16)
      }
    });

    return {
      id: created.id,
      clubName: created.clubName,
      adminName: created.adminName,
      adminEmail: created.adminEmail,
      plan: created.plan,
      amountPaid: Number(created.amountPaid),
      type: created.type,
      billingCycle: created.billingCycle,
      status: created.status,
      createdAt: created.createdAt
    };
  }

  static async approveClub(id: string) {
    try {
      const updated = await prisma.clubApproval.update({
        where: { id },
        data: { status: 'APPROVED' }
      });

      return {
        id: updated.id,
        clubName: updated.clubName,
        adminName: updated.adminName,
        adminEmail: updated.adminEmail,
        plan: updated.plan,
        amountPaid: Number(updated.amountPaid),
        type: updated.type,
        billingCycle: updated.billingCycle,
        status: updated.status,
        createdAt: updated.createdAt
      };
    } catch {
      return null;
    }
  }

  // --- Admin Notifications ---
  static async getNotifications() {
    const notifs = await prisma.adminNotification.findMany({
      orderBy: { timestamp: 'desc' }
    });

    return notifs.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      timestamp: n.timestamp,
      read: n.read
    }));
  }

  static async createNotification(notif: any) {
    const created = await prisma.adminNotification.create({
      data: {
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        timestamp: notif.timestamp,
        read: notif.read || false
      }
    });

    return {
      id: created.id,
      title: created.title,
      message: created.message,
      type: created.type,
      timestamp: created.timestamp,
      read: created.read
    };
  }

  // --- Support Tickets Desk ---
  static async getSupportTickets(filters?: { status?: string; category?: string; search?: string }) {
    const where: any = {};
    if (filters?.status && filters.status !== 'ALL') {
      where.status = { equals: filters.status, mode: 'insensitive' };
    }
    if (filters?.category && filters.category !== 'ALL') {
      where.category = { equals: filters.category, mode: 'insensitive' };
    }
    if (filters?.search) {
      where.OR = [
        { ticketRef: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { message: { contains: filters.search, mode: 'insensitive' } },
        { clubName: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const tickets = await (prisma as any).supportTicketStore.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return tickets.map((t: any) => ({
      id: t.id,
      ticketRef: t.ticketRef,
      name: t.name,
      email: t.email,
      category: t.category,
      priority: t.priority,
      subject: t.subject,
      message: t.message,
      status: t.status,
      tenantRole: t.tenantRole,
      clubName: t.clubName,
      resolution: t.resolution,
      resolvedBy: t.resolvedBy,
      resolvedAt: t.resolvedAt,
      createdAt: t.createdAt
    }));
  }

  static async createSupportTicket(data: any) {
    const ticketRef = 'ECC-' + Math.floor(100000 + Math.random() * 900000);
    const id = 'tkt-' + Date.now();
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const created = await (prisma as any).supportTicketStore.create({
      data: {
        id,
        ticketRef,
        name: data.name,
        email: data.email,
        category: data.category,
        priority: data.priority || 'NORMAL',
        subject: data.subject,
        message: data.message,
        status: 'OPEN',
        tenantRole: data.tenantRole || null,
        clubName: data.clubName || null,
        createdAt
      }
    });

    // Also dispatch a transactional notification to the Admin Email Inbox
    await prisma.adminNotification.create({
      data: {
        id: 'notif-' + Date.now(),
        title: `New Support Ticket [${ticketRef}]: ${data.subject}`,
        message: `Ticket Ref #${ticketRef} raised by ${data.name} (${data.email}, Role: ${data.tenantRole || 'Customer'}, Club: ${data.clubName || 'Individual'}). Priority: ${data.priority || 'NORMAL'}. Category: ${data.category}. Message: "${data.message.substring(0, 120)}..."`,
        type: 'SUPPORT_TICKET_RAISED',
        timestamp: createdAt,
        read: false
      }
    });

    return created;
  }

  static async resolveSupportTicket(ticketId: string, payload: { resolution: string; resolvedBy: string; status?: string }) {
    const resolvedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const updated = await (prisma as any).supportTicketStore.update({
      where: { id: ticketId },
      data: {
        status: payload.status || 'RESOLVED',
        resolution: payload.resolution,
        resolvedBy: payload.resolvedBy || 'Support Engineer',
        resolvedAt
      }
    });

    // Create an Admin Notification that ticket was resolved
    await prisma.adminNotification.create({
      data: {
        id: 'notif-' + Date.now(),
        title: `Ticket Resolved [${updated.ticketRef}]: ${updated.subject}`,
        message: `Support Engineer ${payload.resolvedBy || 'Admin'} marked ticket #${updated.ticketRef} as ${updated.status}. Resolution: "${payload.resolution}"`,
        type: 'SUPPORT_TICKET_RESOLVED',
        timestamp: resolvedAt,
        read: true
      }
    });

    return updated;
  }

  // --- Club Members ---
  static async getClubMembers(clubId?: string) {
    const where: any = {};
    if (clubId) where.clubId = clubId;

    const members = await prisma.clubMemberStore.findMany({
      where,
      orderBy: { id: 'asc' }
    });

    return members.map(m => ({
      id: m.id,
      clubId: m.clubId,
      name: m.name,
      email: m.email,
      role: m.role,
      ageGroup: m.ageGroup,
      discipline: m.discipline,
      invitationStatus: m.invitationStatus,
      currentLevel: m.currentLevel,
      squad: m.squad
    }));
  }

  static async createClubMember(member: any) {
    const created = await prisma.clubMemberStore.create({
      data: {
        id: member.id,
        clubId: member.clubId || 'ten-003',
        name: member.name,
        email: member.email,
        role: member.role,
        ageGroup: member.ageGroup,
        discipline: member.discipline,
        invitationStatus: member.invitationStatus || 'PENDING_ACCEPTANCE',
        currentLevel: member.currentLevel || 'FOUNDATION',
        squad: member.squad || 'Unassigned'
      }
    });

    return {
      id: created.id,
      clubId: created.clubId,
      name: created.name,
      email: created.email,
      role: created.role,
      ageGroup: created.ageGroup,
      discipline: created.discipline,
      invitationStatus: created.invitationStatus,
      currentLevel: created.currentLevel,
      squad: created.squad
    };
  }

  static async updateClubMember(id: string, updates: { invitationStatus?: string; currentLevel?: string; squad?: string; name?: string; email?: string; role?: string; ageGroup?: string; discipline?: string }) {
    const data: any = {};
    if (updates.invitationStatus !== undefined) data.invitationStatus = updates.invitationStatus;
    if (updates.currentLevel !== undefined) data.currentLevel = updates.currentLevel;
    if (updates.squad !== undefined) data.squad = updates.squad;
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.email !== undefined) data.email = updates.email;
    if (updates.role !== undefined) data.role = updates.role;
    if (updates.ageGroup !== undefined) data.ageGroup = updates.ageGroup;
    if (updates.discipline !== undefined) data.discipline = updates.discipline;

    try {
      const updated = await prisma.clubMemberStore.update({
        where: { id },
        data
      });

      return {
        id: updated.id,
        clubId: updated.clubId,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        ageGroup: updated.ageGroup,
        discipline: updated.discipline,
        invitationStatus: updated.invitationStatus,
        currentLevel: updated.currentLevel,
        squad: updated.squad
      };
    } catch {
      return null;
    }
  }

  // --- Squads ---
  static async getSquads(clubId?: string) {
    const where: any = {};
    if (clubId) where.clubId = clubId;

    const squads = await prisma.squadStore.findMany({
      where,
      orderBy: { id: 'asc' }
    });

    return squads.map(s => ({
      id: s.id,
      name: s.name,
      ageGroup: s.ageGroup,
      discipline: s.discipline,
      coachId: s.coachId,
      coachName: s.coachName,
      coordinatorCoachId: s.coordinatorCoachId,
      coordinatorCoachName: s.coordinatorCoachName,
      assistantCoachId: s.assistantCoachId,
      assistantCoachName: s.assistantCoachName,
      memberCount: s.memberCount
    }));
  }

  static async createSquad(squad: any) {
    const created = await prisma.squadStore.create({
      data: {
        id: squad.id,
        clubId: squad.clubId || 'ten-003',
        name: squad.name,
        ageGroup: squad.ageGroup,
        discipline: squad.discipline,
        coachId: squad.coachId,
        coachName: squad.coachName,
        coordinatorCoachId: squad.coordinatorCoachId || null,
        coordinatorCoachName: squad.coordinatorCoachName || null,
        assistantCoachId: squad.assistantCoachId || null,
        assistantCoachName: squad.assistantCoachName || null,
        memberCount: squad.memberCount || 0
      }
    });

    return {
      id: created.id,
      name: created.name,
      ageGroup: created.ageGroup,
      discipline: created.discipline,
      coachId: created.coachId,
      coachName: created.coachName,
      coordinatorCoachId: created.coordinatorCoachId,
      coordinatorCoachName: created.coordinatorCoachName,
      assistantCoachId: created.assistantCoachId,
      assistantCoachName: created.assistantCoachName,
      memberCount: created.memberCount
    };
  }

  static async updateSquad(id: string, updates: { memberCount?: number; name?: string; coachId?: string; coachName?: string; coordinatorCoachId?: string | null; coordinatorCoachName?: string | null; assistantCoachId?: string | null; assistantCoachName?: string | null; ageGroup?: string; discipline?: string }) {
    try {
      const data: any = {};
      if (updates.memberCount !== undefined) data.memberCount = updates.memberCount;
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.coachId !== undefined) data.coachId = updates.coachId;
      if (updates.coachName !== undefined) data.coachName = updates.coachName;
      if (updates.coordinatorCoachId !== undefined) data.coordinatorCoachId = updates.coordinatorCoachId;
      if (updates.coordinatorCoachName !== undefined) data.coordinatorCoachName = updates.coordinatorCoachName;
      if (updates.assistantCoachId !== undefined) data.assistantCoachId = updates.assistantCoachId;
      if (updates.assistantCoachName !== undefined) data.assistantCoachName = updates.assistantCoachName;
      if (updates.ageGroup !== undefined) data.ageGroup = updates.ageGroup;
      if (updates.discipline !== undefined) data.discipline = updates.discipline;

      const updated = await prisma.squadStore.update({
        where: { id },
        data
      });
      return {
        id: updated.id,
        name: updated.name,
        ageGroup: updated.ageGroup,
        discipline: updated.discipline,
        coachId: updated.coachId,
        coachName: updated.coachName,
        coordinatorCoachId: updated.coordinatorCoachId,
        coordinatorCoachName: updated.coordinatorCoachName,
        assistantCoachId: updated.assistantCoachId,
        assistantCoachName: updated.assistantCoachName,
        memberCount: updated.memberCount
      };
    } catch {
      return null;
    }
  }

  static async deleteSquad(id: string) {
    try {
      await prisma.squadStore.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // --- Training Sessions ---
  static async getTrainingSessions(clubId?: string) {
    const where: any = {};
    if (clubId) where.clubId = clubId;

    const sessions = await prisma.trainingSessionStore.findMany({
      where,
      orderBy: { sessionDate: 'desc' }
    });

    return sessions.map(s => ({
      id: s.id,
      squadName: s.squadName,
      coachId: s.coachId,
      coachName: s.coachName,
      coordinatorCoachId: s.coordinatorCoachId,
      coordinatorCoachName: s.coordinatorCoachName,
      assistantCoachId: s.assistantCoachId,
      assistantCoachName: s.assistantCoachName,
      assignedPlayerIds: Array.isArray(s.assignedPlayerIds) ? s.assignedPlayerIds : [],
      title: s.title,
      sessionDate: s.sessionDate,
      durationMinutes: s.durationMinutes,
      isPublished: s.isPublished,
      isExecuted: s.isExecuted,
      drillCount: s.drillCount,
      drillIds: Array.isArray(s.drillIds) ? s.drillIds : [],
      playerNotes: s.playerNotes && typeof s.playerNotes === 'object' ? s.playerNotes : {},
      postNotes: s.postNotes,
      aiEvaluation: s.aiEvaluation
    }));
  }

  static async createTrainingSession(sess: any) {
    const created = await prisma.trainingSessionStore.create({
      data: {
        id: sess.id,
        clubId: sess.clubId || 'ten-003',
        squadName: sess.squadName,
        coachId: sess.coachId || null,
        coachName: sess.coachName || null,
        coordinatorCoachId: sess.coordinatorCoachId || null,
        coordinatorCoachName: sess.coordinatorCoachName || null,
        assistantCoachId: sess.assistantCoachId || null,
        assistantCoachName: sess.assistantCoachName || null,
        assignedPlayerIds: sess.assignedPlayerIds || [],
        title: sess.title,
        sessionDate: sess.sessionDate,
        durationMinutes: sess.durationMinutes || 90,
        isPublished: sess.isPublished || false,
        isExecuted: sess.isExecuted || false,
        drillCount: sess.drillCount || (sess.drills ? sess.drills.length : 0),
        drillIds: sess.drillIds || [],
        playerNotes: sess.playerNotes || {},
        postNotes: sess.postNotes || null,
        aiEvaluation: sess.aiEvaluation || undefined
      }
    });

    return {
      id: created.id,
      squadName: created.squadName,
      coachId: created.coachId,
      coachName: created.coachName,
      coordinatorCoachId: created.coordinatorCoachId,
      coordinatorCoachName: created.coordinatorCoachName,
      assistantCoachId: created.assistantCoachId,
      assistantCoachName: created.assistantCoachName,
      assignedPlayerIds: Array.isArray(created.assignedPlayerIds) ? created.assignedPlayerIds : [],
      title: created.title,
      sessionDate: created.sessionDate,
      durationMinutes: created.durationMinutes,
      isPublished: created.isPublished,
      isExecuted: created.isExecuted,
      drillCount: created.drillCount,
      drillIds: Array.isArray(created.drillIds) ? created.drillIds : [],
      playerNotes: created.playerNotes && typeof created.playerNotes === 'object' ? created.playerNotes : {},
      postNotes: created.postNotes,
      aiEvaluation: created.aiEvaluation
    };
  }

  static async publishTrainingSession(id: string) {
    try {
      const updated = await prisma.trainingSessionStore.update({
        where: { id },
        data: { isPublished: true }
      });

      return {
        id: updated.id,
        squadName: updated.squadName,
        coachId: updated.coachId,
        coachName: updated.coachName,
        coordinatorCoachId: updated.coordinatorCoachId,
        coordinatorCoachName: updated.coordinatorCoachName,
        assistantCoachId: updated.assistantCoachId,
        assistantCoachName: updated.assistantCoachName,
        assignedPlayerIds: Array.isArray(updated.assignedPlayerIds) ? updated.assignedPlayerIds : [],
        title: updated.title,
        sessionDate: updated.sessionDate,
        durationMinutes: updated.durationMinutes,
        isPublished: updated.isPublished,
        isExecuted: updated.isExecuted,
        drillCount: updated.drillCount,
        drillIds: Array.isArray(updated.drillIds) ? updated.drillIds : [],
        playerNotes: updated.playerNotes && typeof updated.playerNotes === 'object' ? updated.playerNotes : {},
        postNotes: updated.postNotes,
        aiEvaluation: updated.aiEvaluation
      };
    } catch {
      return null;
    }
  }

  // Incorporates a drill into a training session by appending it to the session's drill list
  // and bumping its drill count. Used both when a coach manually adds a drill to a session and
  // when an AI-recommended drill is adopted for a player with an upcoming squad session.
  static async incrementSessionDrillCount(id: string, drillId?: string) {
    try {
      const existing = await prisma.trainingSessionStore.findUnique({ where: { id } });
      if (!existing) return null;
      const currentIds: string[] = Array.isArray(existing.drillIds) ? (existing.drillIds as any) : [];
      const newIds = drillId ? [...currentIds, drillId] : currentIds;

      const updated = await prisma.trainingSessionStore.update({
        where: { id },
        data: {
          drillCount: drillId ? newIds.length : { increment: 1 },
          drillIds: drillId ? newIds : undefined
        }
      });

      return {
        id: updated.id,
        squadName: updated.squadName,
        coachId: updated.coachId,
        coachName: updated.coachName,
        coordinatorCoachId: updated.coordinatorCoachId,
        coordinatorCoachName: updated.coordinatorCoachName,
        assistantCoachId: updated.assistantCoachId,
        assistantCoachName: updated.assistantCoachName,
        assignedPlayerIds: Array.isArray(updated.assignedPlayerIds) ? updated.assignedPlayerIds : [],
        title: updated.title,
        sessionDate: updated.sessionDate,
        durationMinutes: updated.durationMinutes,
        isPublished: updated.isPublished,
        isExecuted: updated.isExecuted,
        drillCount: updated.drillCount,
        drillIds: Array.isArray(updated.drillIds) ? updated.drillIds : [],
        playerNotes: updated.playerNotes && typeof updated.playerNotes === 'object' ? updated.playerNotes : {},
        postNotes: updated.postNotes,
        aiEvaluation: updated.aiEvaluation
      };
    } catch {
      return null;
    }
  }

  // Removes a single instance of a drill from a session's drill list (used by the "Remove"
  // action on an already-added session drill in the Club Portal Sessions tab).
  static async removeDrillFromSession(id: string, drillId: string) {
    try {
      const existing = await prisma.trainingSessionStore.findUnique({ where: { id } });
      if (!existing) return null;
      const currentIds: string[] = Array.isArray(existing.drillIds) ? (existing.drillIds as any) : [];
      const idx = currentIds.indexOf(drillId);
      if (idx !== -1) currentIds.splice(idx, 1);

      const updated = await prisma.trainingSessionStore.update({
        where: { id },
        data: {
          drillCount: currentIds.length,
          drillIds: currentIds
        }
      });

      return {
        id: updated.id,
        squadName: updated.squadName,
        coachId: updated.coachId,
        coachName: updated.coachName,
        coordinatorCoachId: updated.coordinatorCoachId,
        coordinatorCoachName: updated.coordinatorCoachName,
        assistantCoachId: updated.assistantCoachId,
        assistantCoachName: updated.assistantCoachName,
        assignedPlayerIds: Array.isArray(updated.assignedPlayerIds) ? updated.assignedPlayerIds : [],
        title: updated.title,
        sessionDate: updated.sessionDate,
        durationMinutes: updated.durationMinutes,
        isPublished: updated.isPublished,
        isExecuted: updated.isExecuted,
        drillCount: updated.drillCount,
        drillIds: Array.isArray(updated.drillIds) ? updated.drillIds : [],
        playerNotes: updated.playerNotes && typeof updated.playerNotes === 'object' ? updated.playerNotes : {},
        postNotes: updated.postNotes,
        aiEvaluation: updated.aiEvaluation
      };
    } catch {
      return null;
    }
  }

  // Edits a scheduled training session's core details (title, target squad, date, duration).
  // Used by the Edit Session flow in the Club Portal's Sessions tab.
  static async updateTrainingSession(id: string, updates: {
    title?: string;
    squadName?: string;
    coachId?: string | null;
    coachName?: string | null;
    coordinatorCoachId?: string | null;
    coordinatorCoachName?: string | null;
    assistantCoachId?: string | null;
    assistantCoachName?: string | null;
    assignedPlayerIds?: string[];
    sessionDate?: string;
    durationMinutes?: number;
    isExecuted?: boolean;
    playerNotes?: Record<string, string>;
  }) {
    try {
      const data: any = {};
      if (updates.title !== undefined) data.title = updates.title;
      if (updates.squadName !== undefined) data.squadName = updates.squadName;
      if (updates.coachId !== undefined) data.coachId = updates.coachId;
      if (updates.coachName !== undefined) data.coachName = updates.coachName;
      if (updates.coordinatorCoachId !== undefined) data.coordinatorCoachId = updates.coordinatorCoachId;
      if (updates.coordinatorCoachName !== undefined) data.coordinatorCoachName = updates.coordinatorCoachName;
      if (updates.assistantCoachId !== undefined) data.assistantCoachId = updates.assistantCoachId;
      if (updates.assistantCoachName !== undefined) data.assistantCoachName = updates.assistantCoachName;
      if (updates.assignedPlayerIds !== undefined) data.assignedPlayerIds = updates.assignedPlayerIds;
      if (updates.sessionDate !== undefined) data.sessionDate = updates.sessionDate;
      if (updates.durationMinutes !== undefined) data.durationMinutes = updates.durationMinutes;
      if (updates.isExecuted !== undefined) data.isExecuted = updates.isExecuted;
      if (updates.playerNotes !== undefined) data.playerNotes = updates.playerNotes;

      const updated = await prisma.trainingSessionStore.update({
        where: { id },
        data
      });

      return {
        id: updated.id,
        squadName: updated.squadName,
        coachId: updated.coachId,
        coachName: updated.coachName,
        coordinatorCoachId: updated.coordinatorCoachId,
        coordinatorCoachName: updated.coordinatorCoachName,
        assistantCoachId: updated.assistantCoachId,
        assistantCoachName: updated.assistantCoachName,
        assignedPlayerIds: Array.isArray(updated.assignedPlayerIds) ? updated.assignedPlayerIds : [],
        title: updated.title,
        sessionDate: updated.sessionDate,
        durationMinutes: updated.durationMinutes,
        isPublished: updated.isPublished,
        isExecuted: updated.isExecuted,
        drillCount: updated.drillCount,
        drillIds: Array.isArray(updated.drillIds) ? updated.drillIds : [],
        playerNotes: updated.playerNotes && typeof updated.playerNotes === 'object' ? updated.playerNotes : {},
        postNotes: updated.postNotes,
        aiEvaluation: updated.aiEvaluation
      };
    } catch {
      return null;
    }
  }

  static async deleteTrainingSession(id: string) {
    try {
      await prisma.trainingSessionStore.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  static async updateSessionNotesAndEvaluation(id: string, notes: string, aiEvaluation: any) {
    try {
      const updated = await prisma.trainingSessionStore.update({
        where: { id },
        data: {
          postNotes: notes,
          aiEvaluation: aiEvaluation || undefined
        }
      });

      return {
        id: updated.id,
        squadName: updated.squadName,
        coachId: updated.coachId,
        coachName: updated.coachName,
        coordinatorCoachId: updated.coordinatorCoachId,
        coordinatorCoachName: updated.coordinatorCoachName,
        assistantCoachId: updated.assistantCoachId,
        assistantCoachName: updated.assistantCoachName,
        title: updated.title,
        sessionDate: updated.sessionDate,
        durationMinutes: updated.durationMinutes,
        isPublished: updated.isPublished,
        isExecuted: updated.isExecuted,
        drillCount: updated.drillCount,
        drillIds: Array.isArray(updated.drillIds) ? updated.drillIds : [],
        playerNotes: updated.playerNotes && typeof updated.playerNotes === 'object' ? updated.playerNotes : {},
        postNotes: updated.postNotes,
        aiEvaluation: updated.aiEvaluation
      };
    } catch {
      return null;
    }
  }

  // --- Certificates ---
  static async getCertificates() {
    const certs = await prisma.certificateStore.findMany({
      orderBy: { issuedDate: 'desc' }
    });

    return certs.map(c => ({
      id: c.id,
      certificateNumber: c.certificateNumber,
      playerName: c.playerName,
      discipline: c.discipline,
      achievedLevel: c.achievedLevel,
      issuedDate: c.issuedDate,
      coachName: c.coachName,
      coachNotes: c.coachNotes,
      aiCommendation: c.aiCommendation
    }));
  }

  static async createCertificate(cert: any) {
    const created = await prisma.certificateStore.create({
      data: {
        id: cert.id,
        certificateNumber: cert.certificateNumber,
        playerId: cert.playerId || null,
        playerName: cert.playerName,
        discipline: cert.discipline,
        achievedLevel: cert.achievedLevel,
        issuedDate: cert.issuedDate,
        coachName: cert.coachName,
        coachNotes: cert.coachNotes || null,
        aiCommendation: cert.aiCommendation || null
      }
    });

    return {
      id: created.id,
      certificateNumber: created.certificateNumber,
      playerName: created.playerName,
      discipline: created.discipline,
      achievedLevel: created.achievedLevel,
      issuedDate: created.issuedDate,
      coachName: created.coachName,
      coachNotes: created.coachNotes,
      aiCommendation: created.aiCommendation
    };
  }

  // --- Video Analysis Results (real Gemini AI output) ---
  static async createVideoAnalysis(entry: {
    userId?: string | null;
    playerId?: string | null;
    playerName?: string | null;
    discipline: string;
    context: string;
    sourceType: 'LOCAL_UPLOAD' | 'GOOGLE_DRIVE';
    driveFileId?: string | null;
    model: string;
    analysis: any;
  }) {
    const created = await prisma.videoAnalysisStore.create({
      data: {
        userId: entry.userId || null,
        playerId: entry.playerId || null,
        playerName: entry.playerName || null,
        discipline: entry.discipline,
        context: entry.context,
        sourceType: entry.sourceType,
        driveFileId: entry.driveFileId || null,
        model: entry.model,
        overallScore: Math.round(entry.analysis?.overallScore ?? 0),
        analysis: entry.analysis
      }
    });

    return created;
  }

  static async getVideoAnalyses(filters?: { userId?: string; playerId?: string }) {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.playerId) where.playerId = filters.playerId;

    const results = await prisma.videoAnalysisStore.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return results.map(r => ({
      id: r.id,
      userId: r.userId,
      playerId: r.playerId,
      playerName: r.playerName,
      discipline: r.discipline,
      context: r.context,
      sourceType: r.sourceType,
      driveFileId: r.driveFileId,
      model: r.model,
      overallScore: r.overallScore,
      analysis: r.analysis,
      drillAdopted: r.drillAdopted,
      createdAt: r.createdAt
    }));
  }

  static async getVideoAnalysisById(id: string) {
    const r = await prisma.videoAnalysisStore.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      userId: r.userId,
      playerId: r.playerId,
      playerName: r.playerName,
      discipline: r.discipline,
      context: r.context,
      sourceType: r.sourceType,
      driveFileId: r.driveFileId,
      model: r.model,
      overallScore: r.overallScore,
      analysis: r.analysis,
      drillAdopted: r.drillAdopted,
      createdAt: r.createdAt
    };
  }

  static async markVideoAnalysisDrillAdopted(id: string) {
    try {
      const updated = await prisma.videoAnalysisStore.update({
        where: { id },
        data: { drillAdopted: true }
      });
      return {
        id: updated.id,
        drillAdopted: updated.drillAdopted
      };
    } catch {
      return null;
    }
  }
}
