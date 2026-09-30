import { DrillItem, CustomerTenant, Invoice, ClubApproval, ClubMember, Squad, TrainingSession, Certificate } from '../types/index.js';

export let mockDrills: DrillItem[] = [
  {
    id: 'drill-sys-1',
    title: 'Top Hand Control & Front Foot Drive',
    discipline: 'BATTING',
    skillSet: 'Front Foot Defense & Drive',
    contextType: 'INDIVIDUAL',
    ageGroup: 'U11+',
    difficulty: 'BEGINNER',
    durationMinutes: 20,
    source: 'SYSTEM_PREDEFINED',
    instructions: 'Underarm drop feeds into marker cones focusing on leading with top-hand and head over ball.'
  },
  {
    id: 'drill-sys-2',
    title: 'Target Spot Bowling Channel Corridor',
    discipline: 'BOWLING',
    skillSet: 'Pace & Seam Presentation',
    contextType: 'INDIVIDUAL',
    ageGroup: 'U13+',
    difficulty: 'INTERMEDIATE',
    durationMinutes: 25,
    source: 'SYSTEM_PREDEFINED',
    instructions: 'Place A4 paper targets in the corridor of uncertainty at 6-8 meters length.'
  },
  {
    id: 'drill-sys-3',
    title: 'Squad Infield Circle Quick-Throw Relay',
    discipline: 'FIELDING',
    skillSet: 'Ground Fielding & Direct Hits',
    contextType: 'GROUP',
    ageGroup: 'ALL',
    difficulty: 'INTERMEDIATE',
    durationMinutes: 30,
    source: 'SYSTEM_PREDEFINED',
    instructions: 'Squad forms 30-yard circle with rotating targets at non-striker stumps.'
  },
  {
    id: 'drill-sys-4',
    title: 'Wicketkeeping Stance & Standing Up to Spin',
    discipline: 'KEEPING',
    skillSet: 'Close-in Glovework',
    contextType: 'INDIVIDUAL',
    ageGroup: 'U15+',
    difficulty: 'ADVANCED',
    durationMinutes: 20,
    source: 'SYSTEM_PREDEFINED',
    instructions: 'Standing up within 1 foot of off stump, tracking spin bounce off deflectors.'
  },
  {
    id: 'drill-sys-5',
    title: 'Back Foot Punch & Weight Transfer',
    discipline: 'BATTING',
    skillSet: 'Back Foot Play',
    contextType: 'INDIVIDUAL',
    ageGroup: 'U13+',
    difficulty: 'INTERMEDIATE',
    durationMinutes: 25,
    source: 'SYSTEM_PREDEFINED',
    instructions: 'Short-length side-arm throwdowns, stepping back and across into the high punch.'
  },
  {
    id: 'drill-club-1',
    title: 'MCA Death Overs Yorker & Slower Ball Challenge',
    discipline: 'BOWLING',
    skillSet: 'Death Bowling & Variations',
    contextType: 'GROUP',
    ageGroup: 'Senior',
    difficulty: 'ADVANCED',
    durationMinutes: 30,
    source: 'CLUB_CUSTOM',
    clubId: 'ten-003',
    clubName: 'Melbourne Cricket Academy',
    instructions: 'Proprietary MCA death-overs match simulation with boundary scoring penalties.'
  }
];

export let mockCustomers: CustomerTenant[] = [
  {
    id: 'ten-001',
    name: 'Liam Henderson (Player)',
    type: 'INDIVIDUAL',
    email: 'liam.h@crickethub.com',
    subscriptionPlan: 'INDIVIDUAL',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    mrr: 14.99,
    activeMembers: 1,
    joinedAt: '2026-08-12'
  },
  {
    id: 'ten-002',
    name: 'David Warner Coaching Clinic',
    type: 'COACH',
    email: 'dw.coaching@crickpro.com',
    subscriptionPlan: 'COACH_PRO',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    mrr: 49.99,
    activeMembers: 22,
    joinedAt: '2026-05-04'
  },
  {
    id: 'ten-003',
    name: 'Melbourne Cricket Academy',
    type: 'CLUB',
    email: 'admin@mca-cricket.org',
    subscriptionPlan: 'CLUB_ACADEMY',
    status: 'ACTIVE',
    billingCycle: 'ANNUAL',
    mrr: 199.99,
    activeMembers: 145,
    joinedAt: '2026-01-15'
  },
  {
    id: 'ten-004',
    name: 'Sara Khan (Youth Spinner)',
    type: 'INDIVIDUAL',
    email: 'sara.spin@fastmail.com',
    subscriptionPlan: 'FREE_TRIAL',
    status: 'TRIAL',
    billingCycle: 'MONTHLY',
    mrr: 0.00,
    activeMembers: 1,
    joinedAt: '2026-09-24'
  },
  {
    id: 'ten-005',
    name: 'Yorkshire Strikers CC',
    type: 'CLUB',
    email: 'treasurer@yorkshirestrikers.co.uk',
    subscriptionPlan: 'CLUB_ACADEMY',
    status: 'PAST_DUE',
    billingCycle: 'MONTHLY',
    mrr: 199.99,
    activeMembers: 84,
    joinedAt: '2026-03-10'
  }
];

export let mockInvoices: Invoice[] = [
  { id: 'INV-1092', tenantId: 'ten-003', customerName: 'Melbourne Cricket Academy', amount: 2399.88, currency: 'USD', status: 'PAID', date: '2026-09-15', planName: 'Club / Academy (Annual)' },
  { id: 'INV-1091', tenantId: 'ten-002', customerName: 'David Warner Coaching Clinic', amount: 49.99, currency: 'USD', status: 'PAID', date: '2026-09-10', planName: 'Coach Pro' },
  { id: 'INV-1090', tenantId: 'ten-001', customerName: 'Liam Henderson (Player)', amount: 14.99, currency: 'USD', status: 'PAID', date: '2026-09-12', planName: 'Individual Player' },
  { id: 'INV-1089', tenantId: 'ten-005', customerName: 'Yorkshire Strikers CC', amount: 199.99, currency: 'USD', status: 'FAILED', date: '2026-09-28', planName: 'Club / Academy (Monthly)' }
];

export let mockClubApprovals: ClubApproval[] = [
  {
    id: 'appr-01',
    clubName: 'Sydney Thunder Junior Academy',
    adminName: 'Greg Chappell',
    adminEmail: 'greg.c@thunderacademy.com.au',
    plan: 'Club / Academy Annual',
    amountPaid: 2399.88,
    paymentStatus: 'PAID',
    approvalStatus: 'AWAITING_APPROVAL',
    createdAt: '2026-09-30 09:30'
  },
  {
    id: 'appr-02',
    clubName: 'Lord’s Colts Cricket Club',
    adminName: 'Eoin Morgan',
    adminEmail: 'eoin@lordscolts.co.uk',
    plan: 'Club / Academy Monthly',
    amountPaid: 199.99,
    paymentStatus: 'PAID',
    approvalStatus: 'AWAITING_APPROVAL',
    createdAt: '2026-09-30 11:15'
  }
];

export let mockClubMembers: ClubMember[] = [
  { id: 'mem-1', clubId: 'ten-003', name: 'Brendon McCullum', email: 'brendon@mca.org', role: 'COACH', ageGroup: 'Senior', discipline: 'BATTING', invitationStatus: 'ACTIVE', currentLevel: 'ELITE' },
  { id: 'mem-2', clubId: 'ten-003', name: 'Shane Bond', email: 'shane.b@mca.org', role: 'COACH', ageGroup: 'U15', discipline: 'BOWLING', invitationStatus: 'ACTIVE', currentLevel: 'ELITE' },
  { id: 'mem-3', clubId: 'ten-003', name: 'Gary Kirsten', email: 'gary@mca.org', role: 'COACH', ageGroup: 'U13', discipline: 'BATTING', invitationStatus: 'PENDING_ACCEPTANCE', currentLevel: 'ADVANCED' },
  { id: 'mem-4', clubId: 'ten-003', name: 'Arjun Tendulkar', email: 'arjun.t@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'BOWLING', invitationStatus: 'ACTIVE', currentLevel: 'DEVELOPING', squadId: 'sq-1' },
  { id: 'mem-5', clubId: 'ten-003', name: 'Sam Billings', email: 'sam.b@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'KEEPING', invitationStatus: 'ACTIVE', currentLevel: 'INTERMEDIATE', squadId: 'sq-1' },
  { id: 'mem-6', clubId: 'ten-003', name: 'Leo Finch', email: 'leo.f@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'BATTING', invitationStatus: 'ACTIVE', currentLevel: 'INTERMEDIATE', squadId: 'sq-1' },
  { id: 'mem-7', clubId: 'ten-003', name: 'Rohan Sharma', email: 'rohan.s@crick.com', role: 'PLAYER', ageGroup: 'U13', discipline: 'BATTING', invitationStatus: 'PENDING_ACCEPTANCE', currentLevel: 'FOUNDATION' }
];

export let mockSquads: Squad[] = [
  {
    id: 'sq-1',
    clubId: 'ten-003',
    coachId: 'mem-2',
    coachName: 'Shane Bond',
    name: 'U15 Pace & Power Squad',
    ageGroup: 'U15',
    discipline: 'BOWLING',
    memberIds: ['mem-4', 'mem-5', 'mem-6']
  },
  {
    id: 'sq-2',
    clubId: 'ten-003',
    coachId: 'mem-1',
    coachName: 'Brendon McCullum',
    name: 'Senior Top-Order Hitters',
    ageGroup: 'Senior',
    discipline: 'BATTING',
    memberIds: []
  }
];

export let mockSessions: TrainingSession[] = [
  {
    id: 'sess-101',
    clubId: 'ten-003',
    coachId: 'mem-2',
    coachName: 'Shane Bond',
    squadId: 'sq-1',
    squadName: 'U15 Pace & Power Squad',
    title: 'Seam Presentation & Front Foot Defense Circuit',
    sessionDate: '2026-10-02',
    durationMinutes: 90,
    isPublished: true,
    publishedAt: '2026-09-30 14:00',
    drills: [
      { id: '1', title: 'Top Hand Control & Front Foot Drive', duration: 25, discipline: 'BATTING', context: 'GROUP' },
      { id: '2', title: 'Target Spot Bowling Channel Drill', duration: 35, discipline: 'BOWLING', context: 'GROUP' },
      { id: '3', title: 'Squad Infield Circle Quick-Throw Relay', duration: 30, discipline: 'FIELDING', context: 'GROUP' }
    ],
    postSessionNotes: 'Pace attack maintained seam alignment, but front-foot drives lacked head balance in over-the-stump deliveries.'
  }
];

export let mockCertificates: Certificate[] = [
  {
    id: 'cert-01',
    certificateNumber: 'ECC-2026-9041',
    playerId: 'mem-4',
    playerName: 'Arjun Tendulkar',
    discipline: 'BOWLING',
    achievedLevel: 'INTERMEDIATE',
    issuedDate: '2026-09-28',
    coachName: 'Shane Bond',
    coachNotes: 'Demonstrated consistent high-arm release and seam angle control across 10-over spells.',
    aiCommendation: 'Kinematic tracking confirms 14% improvement in lateral torso stability.'
  }
];
