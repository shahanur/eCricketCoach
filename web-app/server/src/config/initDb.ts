import { pool } from '../config/database.js';

export async function initDb() {
  // 1. Create tables if not exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_tenants (
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
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(100) PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      status VARCHAR(50) NOT NULL,
      invoice_date VARCHAR(50) NOT NULL,
      plan_name VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_notifications (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      timestamp VARCHAR(50) NOT NULL,
      is_read BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS club_approvals_store (
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
    );

    CREATE TABLE IF NOT EXISTS drills_store (
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
    );

    CREATE TABLE IF NOT EXISTS club_members_store (
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
    );

    CREATE TABLE IF NOT EXISTS squads_store (
      id VARCHAR(100) PRIMARY KEY,
      club_id VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      age_group VARCHAR(50) NOT NULL,
      discipline VARCHAR(50) NOT NULL,
      coach_name VARCHAR(255) NOT NULL,
      member_count INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS training_sessions_store (
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
    );

    CREATE TABLE IF NOT EXISTS certificates_store (
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
    );
  `);

  // 2. Seed default data if customer_tenants is empty
  const countRes = await pool.query('SELECT count(*) FROM customer_tenants');
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    console.log('🌱 Seeding initial PostgreSQL data...');

    // Seed Drills
    await pool.query(`
      INSERT INTO drills_store (id, title, discipline, skill_set, context_type, duration, source, instructions) VALUES
      ('drill-sys-1', 'Top Hand Control & Front Foot Drive', 'BATTING', 'Front Foot Defense & Drive', 'INDIVIDUAL', 20, 'SYSTEM_PREDEFINED', 'Underarm drop feeds into marker cones focusing on leading with top-hand and head over ball.'),
      ('drill-sys-2', 'Target Spot Bowling Channel Corridor', 'BOWLING', 'Pace & Seam Presentation', 'INDIVIDUAL', 25, 'SYSTEM_PREDEFINED', 'Place A4 paper targets in the corridor of uncertainty at 6-8 meters length.'),
      ('drill-sys-3', 'Squad Infield Circle Quick-Throw Relay', 'FIELDING', 'Ground Fielding & Direct Hits', 'GROUP', 30, 'SYSTEM_PREDEFINED', 'Squad forms 30-yard circle with rotating targets at non-striker stumps.'),
      ('drill-sys-4', 'Wicketkeeping Stance & Standing Up to Spin', 'KEEPING', 'Close-in Glovework', 'INDIVIDUAL', 20, 'SYSTEM_PREDEFINED', 'Standing up within 1 foot of off stump, tracking spin bounce off deflectors.'),
      ('drill-sys-5', 'Back Foot Punch & Weight Transfer', 'BATTING', 'Back Foot Play', 'INDIVIDUAL', 25, 'SYSTEM_PREDEFINED', 'Short-length side-arm throwdowns, stepping back and across into the high punch.'),
      ('drill-club-1', 'MCA Death Overs Yorker & Slower Ball Challenge', 'BOWLING', 'Death Bowling & Variations', 'GROUP', 30, 'CLUB_CUSTOM', 'Proprietary MCA death-overs match simulation with boundary scoring penalties.')
    `);

    // Seed Customers
    await pool.query(`
      INSERT INTO customer_tenants (id, name, type, email, subscription_plan, status, billing_cycle, mrr, active_members, joined_at) VALUES
      ('ten-001', 'Liam Henderson (Player)', 'INDIVIDUAL', 'liam.h@crickethub.com', 'INDIVIDUAL', 'ACTIVE', 'MONTHLY', 14.99, 1, '2026-08-12'),
      ('ten-002', 'David Warner Coaching Clinic', 'COACH', 'dw.coaching@crickpro.com', 'COACH_PRO', 'ACTIVE', 'MONTHLY', 49.99, 22, '2026-05-04'),
      ('ten-003', 'Melbourne Cricket Academy', 'CLUB', 'admin@mca-cricket.org', 'CLUB_ACADEMY', 'ACTIVE', 'ANNUAL', 199.99, 145, '2026-01-15'),
      ('ten-004', 'Sara Khan (Youth Spinner)', 'INDIVIDUAL', 'sara.spin@fastmail.com', 'FREE_TRIAL', 'TRIAL', 'MONTHLY', 0.00, 1, '2026-09-24'),
      ('ten-005', 'Yorkshire Strikers CC', 'CLUB', 'treasurer@yorkshirestrikers.co.uk', 'CLUB_ACADEMY', 'PAST_DUE', 'MONTHLY', 199.99, 84, '2026-03-10')
    `);

    // Seed Invoices
    await pool.query(`
      INSERT INTO invoices (id, tenant_id, customer_name, amount, currency, status, invoice_date, plan_name) VALUES
      ('INV-1092', 'ten-003', 'Melbourne Cricket Academy', 2399.88, 'USD', 'PAID', '2026-09-15', 'Club / Academy (Annual)'),
      ('INV-1091', 'ten-002', 'David Warner Coaching Clinic', 49.99, 'USD', 'PAID', '2026-09-10', 'Coach Pro'),
      ('INV-1090', 'ten-001', 'Liam Henderson (Player)', 14.99, 'USD', 'PAID', '2026-09-12', 'Individual Player'),
      ('INV-1089', 'ten-005', 'Yorkshire Strikers CC', 199.99, 'USD', 'FAILED', '2026-09-28', 'Club / Academy (Monthly)')
    `);

    // Seed Club Approvals
    await pool.query(`
      INSERT INTO club_approvals_store (id, club_name, admin_name, admin_email, plan, amount_paid, type, billing_cycle, status, created_at) VALUES
      ('appr-01', 'Sydney Thunder Junior Academy', 'Greg Chappell', 'greg.c@thunderacademy.com.au', 'Club / Academy Annual', 1999.99, 'CLUB', 'ANNUAL', 'AWAITING_APPROVAL', '2026-09-30 09:30'),
      ('appr-02', 'Lord’s Colts Cricket Club', 'Eoin Morgan', 'eoin@lordscolts.co.uk', 'Club / Academy Monthly', 199.99, 'CLUB', 'MONTHLY', 'AWAITING_APPROVAL', '2026-09-30 11:15')
    `);

    // Seed Admin Notifications
    await pool.query(`
      INSERT INTO admin_notifications (id, title, message, type, timestamp, is_read) VALUES
      ('notif-1', 'New Paid Registration: Sydney Thunder Junior Academy', 'Payment of $1,999.99 confirmed via Stripe. New Club tenant registration is awaiting Super-Admin approval.', 'PAYMENT_RECEIVED', '2026-09-30 09:31', false),
      ('notif-2', 'New Paid Registration: Lord’s Colts Cricket Club', 'Payment of $199.99 confirmed via Stripe. New Club tenant registration is awaiting Super-Admin approval.', 'PAYMENT_RECEIVED', '2026-09-30 11:16', false)
    `);

    // Seed Club Members
    await pool.query(`
      INSERT INTO club_members_store (id, club_id, name, email, role, age_group, discipline, invitation_status, current_level, squad) VALUES
      ('mem-1', 'ten-003', 'Brendon McCullum', 'brendon@mca.org', 'COACH', 'Senior', 'BATTING', 'ACTIVE', 'ELITE', 'Senior Top-Order Hitters'),
      ('mem-2', 'ten-003', 'Shane Bond', 'shane.b@mca.org', 'COACH', 'U15', 'BOWLING', 'ACTIVE', 'ELITE', 'U15 Pace & Power Squad'),
      ('mem-3', 'ten-003', 'Gary Kirsten', 'gary@mca.org', 'COACH', 'U13', 'BATTING', 'PENDING_ACCEPTANCE', 'ADVANCED', 'Unassigned'),
      ('mem-4', 'ten-003', 'Arjun Tendulkar', 'arjun.t@crick.com', 'PLAYER', 'U15', 'BOWLING', 'ACTIVE', 'DEVELOPING', 'U15 Pace & Power Squad'),
      ('mem-5', 'ten-003', 'Sam Billings', 'sam.b@crick.com', 'PLAYER', 'U15', 'KEEPING', 'ACTIVE', 'INTERMEDIATE', 'U15 Pace & Power Squad'),
      ('mem-6', 'ten-003', 'Leo Finch', 'leo.f@crick.com', 'PLAYER', 'U15', 'BATTING', 'ACTIVE', 'INTERMEDIATE', 'U15 Pace & Power Squad'),
      ('mem-7', 'ten-003', 'Rohan Sharma', 'rohan.s@crick.com', 'PLAYER', 'U13', 'BATTING', 'PENDING_ACCEPTANCE', 'FOUNDATION', 'Unassigned')
    `);

    // Seed Squads
    await pool.query(`
      INSERT INTO squads_store (id, club_id, name, age_group, discipline, coach_name, member_count) VALUES
      ('sq-1', 'ten-003', 'U15 Pace & Power Squad', 'U15', 'BOWLING', 'Shane Bond', 3),
      ('sq-2', 'ten-003', 'Senior Top-Order Hitters', 'Senior', 'BATTING', 'Brendon McCullum', 1)
    `);

    // Seed Training Sessions
    await pool.query(`
      INSERT INTO training_sessions_store (id, club_id, squad_name, title, session_date, duration_minutes, is_published, drill_count, post_notes) VALUES
      ('sess-101', 'ten-003', 'U15 Pace & Power Squad', 'Seam Presentation & Front Foot Defense Circuit', '2026-10-02', 90, true, 3, 'Pace bowling unit had tight run-up rhythm; front-foot drives lacked head balance in simulation overs.')
    `);

    // Seed Certificates
    await pool.query(`
      INSERT INTO certificates_store (id, certificate_number, player_id, player_name, discipline, achieved_level, issued_date, coach_name, coach_notes, ai_recommendation) VALUES
      ('cert-01', 'ECC-2026-9041', 'mem-4', 'Arjun Tendulkar', 'BOWLING', 'INTERMEDIATE', '2026-09-28', 'Shane Bond', 'Demonstrated consistent high-arm release and seam angle control across 10-over spells.', 'Kinematic tracking confirms 14% improvement in lateral torso stability.')
    `).catch(() => {
      // fallback in case ai_recommendation column is named ai_commendation
      return pool.query(`
        INSERT INTO certificates_store (id, certificate_number, player_id, player_name, discipline, achieved_level, issued_date, coach_name, coach_notes, ai_commendation) VALUES
        ('cert-01', 'ECC-2026-9041', 'mem-4', 'Arjun Tendulkar', 'BOWLING', 'INTERMEDIATE', '2026-09-28', 'Shane Bond', 'Demonstrated consistent high-arm release and seam angle control across 10-over spells.', 'Kinematic tracking confirms 14% improvement in lateral torso stability.')
      `);
    });

    console.log('✅ PostgreSQL database seeded successfully!');
  }
}
