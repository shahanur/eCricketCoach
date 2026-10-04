import { prisma } from './prisma.js';

export async function initDb() {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS customer_tenants (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subscription_plan VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL,
      billing_cycle VARCHAR(50) NOT NULL,
      mrr NUMERIC(10,2) NOT NULL DEFAULT 0,
      active_members INT DEFAULT 1,
      joined_at VARCHAR(50) NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(100) PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'GBP',
      status VARCHAR(50) NOT NULL,
      invoice_date VARCHAR(50) NOT NULL,
      plan_name VARCHAR(255) NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      timestamp VARCHAR(50) NOT NULL,
      is_read BOOLEAN DEFAULT FALSE
    )`,

    `CREATE TABLE IF NOT EXISTS club_approvals_store (
      id VARCHAR(100) PRIMARY KEY,
      club_name VARCHAR(255) NOT NULL,
      admin_name VARCHAR(255) NOT NULL,
      admin_email VARCHAR(255) NOT NULL,
      plan VARCHAR(255) NOT NULL,
      amount_paid NUMERIC(10,2) NOT NULL,
      type VARCHAR(50) NOT NULL,
      billing_cycle VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL,
      created_at VARCHAR(50) NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS drills_store (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      discipline VARCHAR(50) NOT NULL,
      skill_set VARCHAR(255) NOT NULL,
      context_type VARCHAR(50) NOT NULL,
      duration INT DEFAULT 20,
      source VARCHAR(50) NOT NULL,
      club_id VARCHAR(100),
      club_name VARCHAR(255),
      instructions TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS club_members_store (
      id VARCHAR(100) PRIMARY KEY,
      club_id VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      age_group VARCHAR(50) NOT NULL,
      discipline VARCHAR(50) NOT NULL,
      invitation_status VARCHAR(50) NOT NULL,
      current_level VARCHAR(50) NOT NULL,
      squad VARCHAR(255) DEFAULT 'Unassigned'
    )`,

    `CREATE TABLE IF NOT EXISTS squads_store (
      id VARCHAR(100) PRIMARY KEY,
      club_id VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      age_group VARCHAR(50) NOT NULL,
      discipline VARCHAR(50) NOT NULL,
      coach_name VARCHAR(255) NOT NULL,
      member_count INT DEFAULT 0
    )`,

    `CREATE TABLE IF NOT EXISTS training_sessions_store (
      id VARCHAR(100) PRIMARY KEY,
      club_id VARCHAR(100),
      squad_name VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      session_date VARCHAR(50) NOT NULL,
      duration_minutes INT DEFAULT 90,
      is_published BOOLEAN DEFAULT FALSE,
      drill_count INT DEFAULT 0,
      post_notes TEXT,
      ai_evaluation JSONB
    )`,

    `CREATE TABLE IF NOT EXISTS certificates_store (
      id VARCHAR(100) PRIMARY KEY,
      certificate_number VARCHAR(100) UNIQUE NOT NULL,
      player_id VARCHAR(100),
      player_name VARCHAR(255) NOT NULL,
      discipline VARCHAR(50) NOT NULL,
      achieved_level VARCHAR(50) NOT NULL,
      issued_date VARCHAR(50) NOT NULL,
      coach_name VARCHAR(255) NOT NULL,
      coach_notes TEXT,
      ai_commendation TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS support_tickets_store (
      id VARCHAR(100) PRIMARY KEY,
      ticket_ref VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      priority VARCHAR(50) DEFAULT 'NORMAL',
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'OPEN',
      tenant_role VARCHAR(50),
      club_name VARCHAR(255),
      resolution TEXT,
      resolved_by VARCHAR(255),
      resolved_at VARCHAR(50),
      created_at VARCHAR(50) NOT NULL
    )`
  ];

  // 1. Execute each DDL statement individually
  for (const statement of ddlStatements) {
    await prisma.$executeRawUnsafe(statement);
  }

  // 2. Check and seed default data if empty using Prisma
  const tenantCount = await prisma.customerTenant.count();
  if (tenantCount === 0) {
    console.log('�� Seeding initial PostgreSQL data via Prisma...');

    await prisma.drillStore.createMany({
      data: [
        { id: 'drill-sys-1', title: 'Top Hand Control & Front Foot Drive', discipline: 'BATTING', skillSet: 'Front Foot Defense & Drive', contextType: 'INDIVIDUAL', duration: 20, source: 'SYSTEM_PREDEFINED', instructions: 'Underarm drop feeds into marker cones focusing on leading with top-hand and head over ball.' },
        { id: 'drill-sys-2', title: 'Target Spot Bowling Channel Corridor', discipline: 'BOWLING', skillSet: 'Pace & Seam Presentation', contextType: 'INDIVIDUAL', duration: 25, source: 'SYSTEM_PREDEFINED', instructions: 'Place A4 paper targets in the corridor of uncertainty at 6-8 meters length.' },
        { id: 'drill-sys-3', title: 'Squad Infield Circle Quick-Throw Relay', discipline: 'FIELDING', skillSet: 'Ground Fielding & Direct Hits', contextType: 'GROUP', duration: 30, source: 'SYSTEM_PREDEFINED', instructions: 'Squad forms 30-yard circle with rotating targets at non-striker stumps.' },
        { id: 'drill-sys-4', title: 'Wicketkeeping Stance & Standing Up to Spin', discipline: 'KEEPING', skillSet: 'Close-in Glovework', contextType: 'INDIVIDUAL', duration: 20, source: 'SYSTEM_PREDEFINED', instructions: 'Standing up within 1 foot of off stump, tracking spin bounce off deflectors.' },
        { id: 'drill-sys-5', title: 'Back Foot Punch & Weight Transfer', discipline: 'BATTING', skillSet: 'Back Foot Play', contextType: 'INDIVIDUAL', duration: 25, source: 'SYSTEM_PREDEFINED', instructions: 'Short-length side-arm throwdowns, stepping back and across into the high punch.' },
        { id: 'drill-club-1', title: 'MCA Death Overs Yorker & Slower Ball Challenge', discipline: 'BOWLING', skillSet: 'Death Bowling & Variations', contextType: 'GROUP', duration: 30, source: 'CLUB_CUSTOM', instructions: 'Proprietary MCA death-overs match simulation with boundary scoring penalties.' }
      ]
    });

    await prisma.customerTenant.createMany({
      data: [
        { id: 'ten-001', name: 'Liam Henderson (Player)', type: 'INDIVIDUAL', email: 'liam.h@crickethub.com', subscriptionPlan: 'INDIVIDUAL', status: 'ACTIVE', billingCycle: 'MONTHLY', mrr: 14.99, activeMembers: 1, joinedAt: '2026-08-12' },
        { id: 'ten-002', name: 'David Warner Coaching Clinic', type: 'COACH', email: 'dw.coaching@crickpro.com', subscriptionPlan: 'COACH_PRO', status: 'ACTIVE', billingCycle: 'MONTHLY', mrr: 49.99, activeMembers: 22, joinedAt: '2026-05-04' },
        { id: 'ten-003', name: 'Marylebone Cricket Club Academy', type: 'CLUB', email: 'admin@mcc-cricket.org.uk', subscriptionPlan: 'CLUB_ACADEMY', status: 'ACTIVE', billingCycle: 'ANNUAL', mrr: 199.99, activeMembers: 145, joinedAt: '2026-01-15' },
        { id: 'ten-004', name: 'Sara Khan (Youth Spinner)', type: 'INDIVIDUAL', email: 'sara.spin@fastmail.com', subscriptionPlan: 'FREE_TRIAL', status: 'TRIAL', billingCycle: 'MONTHLY', mrr: 0.00, activeMembers: 1, joinedAt: '2026-09-24' },
        { id: 'ten-005', name: 'Yorkshire Strikers CC', type: 'CLUB', email: 'treasurer@yorkshirestrikers.co.uk', subscriptionPlan: 'CLUB_ACADEMY', status: 'PAST_DUE', billingCycle: 'MONTHLY', mrr: 199.99, activeMembers: 84, joinedAt: '2026-03-10' }
      ]
    });

    await prisma.invoice.createMany({
      data: [
        { id: 'INV-1092', tenantId: 'ten-003', customerName: 'Marylebone Cricket Club Academy', amount: 2399.88, currency: 'GBP', status: 'PAID', date: '2026-09-15', planName: 'Club / Academy (Annual)' },
        { id: 'INV-1091', tenantId: 'ten-002', customerName: 'David Warner Coaching Clinic', amount: 49.99, currency: 'GBP', status: 'PAID', date: '2026-09-10', planName: 'Coach Pro' },
        { id: 'INV-1090', tenantId: 'ten-001', customerName: 'Liam Henderson (Player)', amount: 14.99, currency: 'GBP', status: 'PAID', date: '2026-09-12', planName: 'Individual Player' },
        { id: 'INV-1089', tenantId: 'ten-005', customerName: 'Yorkshire Strikers CC', amount: 199.99, currency: 'GBP', status: 'FAILED', date: '2026-09-28', planName: 'Club / Academy (Monthly)' }
      ]
    });

    await prisma.clubApproval.createMany({
      data: [
        { id: 'appr-01', clubName: 'Sydney Thunder Junior Academy', adminName: 'Greg Chappell', adminEmail: 'greg.c@thunderacademy.com.au', plan: 'Club / Academy Annual', amountPaid: 1999.99, type: 'CLUB', billingCycle: 'ANNUAL', status: 'AWAITING_APPROVAL', createdAt: '2026-09-30 09:30' },
        { id: 'appr-02', clubName: 'Lord’s Colts Cricket Club', adminName: 'Eoin Morgan', adminEmail: 'eoin@lordscolts.co.uk', plan: 'Club / Academy Monthly', amountPaid: 199.99, type: 'CLUB', billingCycle: 'MONTHLY', status: 'AWAITING_APPROVAL', createdAt: '2026-09-30 11:15' }
      ]
    });

    await prisma.adminNotification.createMany({
      data: [
        { id: 'notif-1', title: 'New Paid Registration: Sydney Thunder Junior Academy', message: 'Payment of $1,999.99 confirmed via Stripe. New Club tenant registration is awaiting Super-Admin approval.', type: 'PAYMENT_RECEIVED', timestamp: '2026-09-30 09:31', read: false },
        { id: 'notif-2', title: 'New Paid Registration: Lord’s Colts Cricket Club', message: 'Payment of $199.99 confirmed via Stripe. New Club tenant registration is awaiting Super-Admin approval.', type: 'PAYMENT_RECEIVED', timestamp: '2026-09-30 11:16', read: false }
      ]
    });

    await prisma.clubMemberStore.createMany({
      data: [
        { id: 'mem-1', clubId: 'ten-003', name: 'Brendon McCullum', email: 'brendon@mca.org', role: 'COACH', ageGroup: 'Senior', discipline: 'BATTING', invitationStatus: 'ACTIVE', currentLevel: 'ELITE', squad: 'Senior Top-Order Hitters' },
        { id: 'mem-2', clubId: 'ten-003', name: 'Shane Bond', email: 'shane.b@mca.org', role: 'COACH', ageGroup: 'U15', discipline: 'BOWLING', invitationStatus: 'ACTIVE', currentLevel: 'ELITE', squad: 'U15 Pace & Power Squad' },
        { id: 'mem-3', clubId: 'ten-003', name: 'Gary Kirsten', email: 'gary@mca.org', role: 'COACH', ageGroup: 'U13', discipline: 'BATTING', invitationStatus: 'PENDING_ACCEPTANCE', currentLevel: 'ADVANCED', squad: 'Unassigned' },
        { id: 'mem-4', clubId: 'ten-003', name: 'Arjun Tendulkar', email: 'arjun.t@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'BOWLING', invitationStatus: 'ACTIVE', currentLevel: 'DEVELOPING', squad: 'U15 Pace & Power Squad' },
        { id: 'mem-5', clubId: 'ten-003', name: 'Sam Billings', email: 'sam.b@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'KEEPING', invitationStatus: 'ACTIVE', currentLevel: 'INTERMEDIATE', squad: 'U15 Pace & Power Squad' },
        { id: 'mem-6', clubId: 'ten-003', name: 'Leo Finch', email: 'leo.f@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'BATTING', invitationStatus: 'ACTIVE', currentLevel: 'INTERMEDIATE', squad: 'U15 Pace & Power Squad' },
        { id: 'mem-7', clubId: 'ten-003', name: 'Rohan Sharma', email: 'rohan.s@crick.com', role: 'PLAYER', ageGroup: 'U13', discipline: 'BATTING', invitationStatus: 'PENDING_ACCEPTANCE', currentLevel: 'FOUNDATION', squad: 'Unassigned' }
      ]
    });

    await prisma.squadStore.createMany({
      data: [
        { id: 'sq-1', clubId: 'ten-003', name: 'U15 Pace & Power Squad', ageGroup: 'U15', discipline: 'BOWLING', coachName: 'Shane Bond', memberCount: 3 },
        { id: 'sq-2', clubId: 'ten-003', name: 'Senior Top-Order Hitters', ageGroup: 'Senior', discipline: 'BATTING', coachName: 'Brendon McCullum', memberCount: 1 }
      ]
    });

    const existingTickets = await (prisma as any).supportTicketStore.count();
    if (existingTickets === 0) {
      await (prisma as any).supportTicketStore.createMany({
        data: [
          {
            id: 'tkt-seed-1',
            ticketRef: 'ECC-849201',
            name: 'Shane Warne',
            email: 'shane.w@spinacademy.com.au',
            category: 'AI_ANALYSIS',
            priority: 'HIGH',
            subject: 'Kinematic analysis front-arm keypoint latency in slow-motion video',
            message: 'When uploading 240fps slow-motion bowling spells from our Sony Alpha cameras, the arm release angle detector is flagging a 30-frame offset. Could the computer vision team review our camera orientation calibration?',
            status: 'OPEN',
            tenantRole: 'COACH',
            clubName: 'Spin Wizard Academy',
            createdAt: '2026-10-01 14:20'
          },
          {
            id: 'tkt-seed-2',
            ticketRef: 'ECC-672109',
            name: 'Sarah Connor',
            email: 's.connor@mcc-cricket.org.uk',
            category: 'BILLING',
            priority: 'NORMAL',
            subject: 'Invoice tax breakdown requirement for Victorian Cricket Board grant',
            message: 'We require an itemized GST breakdown on our annual Club / Academy invoice #INV-1102 to submit for regional sports development funding.',
            status: 'OPEN',
            tenantRole: 'CLUB_ADMIN',
            clubName: 'Marylebone Cricket Club Academy',
            createdAt: '2026-10-02 09:45'
          }
        ]
      });
    }

    console.log('✅ PostgreSQL seed tables checked and prepared successfully!');
  }
}
