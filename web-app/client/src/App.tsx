import { useState } from 'react';
import { ViewMode, Drill, CustomerTenant, Invoice, ClubApproval, ClubMember, Squad, TrainingSession, Certificate } from './types';
import { Navbar } from './components/common/Navbar';
import { CoachingPortal } from './components/coaching/CoachingPortal';
import { AdminPanel } from './components/admin/AdminPanel';
import { ClubPortal } from './components/club/ClubPortal';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('COACHING_PORTAL');

  // Master Drill Catalog
  const [drills, setDrills] = useState<Drill[]>([
    {
      id: 'drill-sys-1',
      title: 'Top Hand Control & Front Foot Drive',
      discipline: 'BATTING',
      skillSet: 'Front Foot Defense & Drive',
      contextType: 'INDIVIDUAL',
      duration: 20,
      source: 'SYSTEM_PREDEFINED',
      instructions: 'Underarm drop feeds into marker cones focusing on leading with top-hand and head over ball.'
    },
    {
      id: 'drill-sys-2',
      title: 'Target Spot Bowling Channel Corridor',
      discipline: 'BOWLING',
      skillSet: 'Pace & Seam Presentation',
      contextType: 'INDIVIDUAL',
      duration: 25,
      source: 'SYSTEM_PREDEFINED',
      instructions: 'Place A4 paper targets in the corridor of uncertainty at 6-8 meters length.'
    },
    {
      id: 'drill-sys-3',
      title: 'Squad Infield Circle Quick-Throw Relay',
      discipline: 'FIELDING',
      skillSet: 'Ground Fielding & Direct Hits',
      contextType: 'GROUP',
      duration: 30,
      source: 'SYSTEM_PREDEFINED',
      instructions: 'Squad forms 30-yard circle with rotating targets at non-striker stumps.'
    },
    {
      id: 'drill-sys-4',
      title: 'Wicketkeeping Stance & Standing Up to Spin',
      discipline: 'KEEPING',
      skillSet: 'Close-in Glovework',
      contextType: 'INDIVIDUAL',
      duration: 20,
      source: 'SYSTEM_PREDEFINED',
      instructions: 'Standing up within 1 foot of off stump, tracking spin bounce off deflectors.'
    },
    {
      id: 'drill-sys-5',
      title: 'Back Foot Punch & Weight Transfer',
      discipline: 'BATTING',
      skillSet: 'Back Foot Play',
      contextType: 'INDIVIDUAL',
      duration: 25,
      source: 'SYSTEM_PREDEFINED',
      instructions: 'Short-length side-arm throwdowns, stepping back and across into the high punch.'
    },
    {
      id: 'drill-club-1',
      title: 'MCA Death Overs Yorker & Slower Ball Challenge',
      discipline: 'BOWLING',
      skillSet: 'Death Bowling & Variations',
      contextType: 'GROUP',
      duration: 30,
      source: 'CLUB_CUSTOM',
      clubName: 'Melbourne Cricket Academy',
      instructions: 'Proprietary MCA death-overs match simulation with boundary scoring penalties.'
    }
  ]);

  // Master Customer Tenancies
  const [customers, setCustomers] = useState<CustomerTenant[]>([
    { id: 'ten-001', name: 'Liam Henderson (Player)', type: 'INDIVIDUAL', email: 'liam.h@crickethub.com', subscriptionPlan: 'INDIVIDUAL', status: 'ACTIVE', billingCycle: 'MONTHLY', mrr: 14.99, activeMembers: 1, joinedAt: '2026-08-12' },
    { id: 'ten-002', name: 'David Warner Coaching Clinic', type: 'COACH', email: 'dw.coaching@crickpro.com', subscriptionPlan: 'COACH_PRO', status: 'ACTIVE', billingCycle: 'MONTHLY', mrr: 49.99, activeMembers: 22, joinedAt: '2026-05-04' },
    { id: 'ten-003', name: 'Melbourne Cricket Academy', type: 'CLUB', email: 'admin@mca-cricket.org', subscriptionPlan: 'CLUB_ACADEMY', status: 'ACTIVE', billingCycle: 'ANNUAL', mrr: 199.99, activeMembers: 145, joinedAt: '2026-01-15' },
    { id: 'ten-004', name: 'Sara Khan (Youth Spinner)', type: 'INDIVIDUAL', email: 'sara.spin@fastmail.com', subscriptionPlan: 'FREE_TRIAL', status: 'TRIAL', billingCycle: 'MONTHLY', mrr: 0.00, activeMembers: 1, joinedAt: '2026-09-24' },
    { id: 'ten-005', name: 'Yorkshire Strikers CC', type: 'CLUB', email: 'treasurer@yorkshirestrikers.co.uk', subscriptionPlan: 'CLUB_ACADEMY', status: 'PAST_DUE', billingCycle: 'MONTHLY', mrr: 199.99, activeMembers: 84, joinedAt: '2026-03-10' }
  ]);

  // Invoices State
  const [invoices, setInvoices] = useState<Invoice[]>([
    { id: 'INV-1092', tenantId: 'ten-003', customerName: 'Melbourne Cricket Academy', amount: 2399.88, currency: 'USD', status: 'PAID', date: '2026-09-15', planName: 'Club / Academy (Annual)' },
    { id: 'INV-1091', tenantId: 'ten-002', customerName: 'David Warner Coaching Clinic', amount: 49.99, currency: 'USD', status: 'PAID', date: '2026-09-10', planName: 'Coach Pro' },
    { id: 'INV-1090', tenantId: 'ten-001', customerName: 'Liam Henderson (Player)', amount: 14.99, currency: 'USD', status: 'PAID', date: '2026-09-12', planName: 'Individual Player' },
    { id: 'INV-1089', tenantId: 'ten-005', customerName: 'Yorkshire Strikers CC', amount: 199.99, currency: 'USD', status: 'FAILED', date: '2026-09-28', planName: 'Club / Academy (Monthly)' }
  ]);

  // Awaiting Club Registrations
  const [clubApprovals, setClubApprovals] = useState<ClubApproval[]>([
    { id: 'appr-01', clubName: 'Sydney Thunder Junior Academy', adminName: 'Greg Chappell', adminEmail: 'greg.c@thunderacademy.com.au', plan: 'Club / Academy Annual', amountPaid: 2399.88, status: 'AWAITING_APPROVAL', createdAt: '2026-09-30' },
    { id: 'appr-02', clubName: 'Lord’s Colts Cricket Club', adminName: 'Eoin Morgan', adminEmail: 'eoin@lordscolts.co.uk', plan: 'Club / Academy Monthly', amountPaid: 199.99, status: 'AWAITING_APPROVAL', createdAt: '2026-09-30' }
  ]);

  // Club Members
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([
    { id: 'mem-1', name: 'Brendon McCullum', email: 'brendon@mca.org', role: 'COACH', ageGroup: 'Senior', discipline: 'BATTING', invitationStatus: 'ACTIVE', currentLevel: 'ELITE', squad: 'Senior Top-Order Hitters' },
    { id: 'mem-2', name: 'Shane Bond', email: 'shane.b@mca.org', role: 'COACH', ageGroup: 'U15', discipline: 'BOWLING', invitationStatus: 'ACTIVE', currentLevel: 'ELITE', squad: 'U15 Pace & Power Squad' },
    { id: 'mem-3', name: 'Gary Kirsten', email: 'gary@mca.org', role: 'COACH', ageGroup: 'U13', discipline: 'BATTING', invitationStatus: 'PENDING_ACCEPTANCE', currentLevel: 'ADVANCED', squad: 'Unassigned' },
    { id: 'mem-4', name: 'Arjun Tendulkar', email: 'arjun.t@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'BOWLING', invitationStatus: 'ACTIVE', currentLevel: 'DEVELOPING', squad: 'U15 Pace & Power Squad' },
    { id: 'mem-5', name: 'Sam Billings', email: 'sam.b@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'KEEPING', invitationStatus: 'ACTIVE', currentLevel: 'INTERMEDIATE', squad: 'U15 Pace & Power Squad' },
    { id: 'mem-6', name: 'Leo Finch', email: 'leo.f@crick.com', role: 'PLAYER', ageGroup: 'U15', discipline: 'BATTING', invitationStatus: 'ACTIVE', currentLevel: 'INTERMEDIATE', squad: 'U15 Pace & Power Squad' },
    { id: 'mem-7', name: 'Rohan Sharma', email: 'rohan.s@crick.com', role: 'PLAYER', ageGroup: 'U13', discipline: 'BATTING', invitationStatus: 'PENDING_ACCEPTANCE', currentLevel: 'FOUNDATION', squad: 'Unassigned' }
  ]);

  // Squads State
  const [squads, setSquads] = useState<Squad[]>([
    { id: 'sq-1', name: 'U15 Pace & Power Squad', ageGroup: 'U15', coachName: 'Shane Bond', discipline: 'BOWLING', memberCount: 3 },
    { id: 'sq-2', name: 'Senior Top-Order Hitters', ageGroup: 'Senior', coachName: 'Brendon McCullum', discipline: 'BATTING', memberCount: 1 }
  ]);

  // Training Sessions State
  const [sessions, setSessions] = useState<TrainingSession[]>([
    {
      id: 'sess-101',
      squadName: 'U15 Pace & Power Squad',
      title: 'Seam Presentation & Front Foot Defense Circuit',
      sessionDate: '2026-10-02',
      durationMinutes: 90,
      isPublished: true,
      drillCount: 3,
      postNotes: 'Pace bowling unit had tight run-up rhythm; front-foot drives lacked head balance in simulation overs.'
    }
  ]);

  // Certificates State
  const [certificates, setCertificates] = useState<Certificate[]>([
    {
      id: 'cert-01',
      certificateNumber: 'ECC-2026-9041',
      playerName: 'Arjun Tendulkar',
      discipline: 'BOWLING',
      achievedLevel: 'INTERMEDIATE',
      issuedDate: '2026-09-28',
      coachName: 'Shane Bond',
      coachNotes: 'Demonstrated consistent high-arm release and seam angle control across 10-over spells.',
      aiCommendation: 'Kinematic tracking confirms 14% improvement in lateral torso stability.'
    }
  ]);

  // Drive upload state
  const [uploadingDriveVideo, setUploadingDriveVideo] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState<any>(null);

  // App handlers
  const handleAddDrill = (drill: Drill) => {
    setDrills(prev => [drill, ...prev]);
  };

  const handleApproveClub = (apprId: string) => {
    const appr = clubApprovals.find(a => a.id === apprId);
    if (!appr) return;
    setClubApprovals(prev => prev.filter(a => a.id !== apprId));
    setCustomers(prev => [
      {
        id: 'ten-' + Date.now(),
        name: appr.clubName,
        type: 'CLUB',
        email: appr.adminEmail,
        subscriptionPlan: 'CLUB_ACADEMY',
        status: 'ACTIVE',
        billingCycle: 'ANNUAL',
        mrr: 199.99,
        activeMembers: 1,
        joinedAt: '2026-09-30'
      },
      ...prev
    ]);
    alert(`Club "${appr.clubName}" approved! Onboarding link & credentials dispatched to ${appr.adminEmail}.`);
  };

  const handleUpdateCustomerStatus = (id: string, newStatus: CustomerTenant['status']) => {
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, status: newStatus } : c)));
  };

  const handleUpgradeCustomerPlan = (id: string, newPlan: CustomerTenant['subscriptionPlan']) => {
    const priceMap: Record<CustomerTenant['subscriptionPlan'], number> = {
      FREE_TRIAL: 0,
      INDIVIDUAL: 14.99,
      COACH_PRO: 49.99,
      CLUB_ACADEMY: 199.99
    };
    setCustomers(prev =>
      prev.map(c => (c.id === id ? { ...c, subscriptionPlan: newPlan, mrr: priceMap[newPlan], status: 'ACTIVE' } : c))
    );
  };

  const handleRetryInvoice = (invoiceId: string) => {
    setInvoices(prev => prev.map(i => (i.id === invoiceId ? { ...i, status: 'PAID' } : i)));
    alert(`Invoice ${invoiceId} marked as successfully charged.`);
  };

  const handleInviteMember = (member: ClubMember) => {
    setClubMembers(prev => [...prev, member]);
  };

  const handleAcceptMemberInvite = (memberId: string) => {
    setClubMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, invitationStatus: 'ACTIVE' } : m))
    );
    alert('Invitation accepted! Member can now log in and access assigned training plans.');
  };

  const handlePromotePlayer = (memberId: string) => {
    const member = clubMembers.find(m => m.id === memberId);
    if (!member) return;

    const nextLevel =
      member.currentLevel === 'FOUNDATION' ? 'DEVELOPING' :
      member.currentLevel === 'DEVELOPING' ? 'INTERMEDIATE' :
      member.currentLevel === 'INTERMEDIATE' ? 'ADVANCED' : 'ELITE';

    setClubMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, currentLevel: nextLevel } : m))
    );

    const newCert: Certificate = {
      id: 'cert-' + Date.now(),
      certificateNumber: 'ECC-2026-' + Math.floor(1000 + Math.random() * 9000),
      playerName: member.name,
      discipline: member.discipline,
      achievedLevel: nextLevel,
      issuedDate: '2026-09-30',
      coachName: 'Shane Bond',
      coachNotes: 'Completed all stage competency gates with distinction across matches and net sessions.',
      aiCommendation: 'Kinematic tracking confirms 92/100 technique stability and repeatable execution.'
    };

    setCertificates(prev => [newCert, ...prev]);
    alert(`🎉 ${member.name} promoted to ${nextLevel}! Certificate #${newCert.certificateNumber} generated.`);
  };

  const handleAddSquad = (squad: Squad) => {
    setSquads(prev => [...prev, squad]);
  };

  const handleScheduleSession = (session: TrainingSession) => {
    setSessions(prev => [...prev, session]);
  };

  const handlePublishSession = (sessionId: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, isPublished: true } : s))
    );
    alert('Training session published! Squad players have been notified with the planned drills.');
  };

  const handleSimulateDriveUpload = (playerName: string) => {
    setUploadingDriveVideo(true);
    setDriveUploadSuccess(null);
    setTimeout(() => {
      setUploadingDriveVideo(false);
      setDriveUploadSuccess({
        player: playerName,
        fileName: `${playerName.replace(' ', '_')}_Bowling_Spell.mp4`,
        drivePath: `Google Drive / eCricketCoach / MelbourneCricketAcademy / ${playerName} / Bowling`,
        aiSummary: 'Kinematic analysis complete: Detected front arm dropping 80ms early before ball release.',
        prescribedDrill: 'High Non-Bowling Arm Extension & Target Drop Drill (20 mins)'
      });
    }, 1300);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar viewMode={viewMode} setViewMode={setViewMode} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {viewMode === 'COACHING_PORTAL' && (
          <CoachingPortal drills={drills} onAddAiDrill={handleAddDrill} />
        )}

        {viewMode === 'ADMIN_PANEL' && (
          <AdminPanel
            customers={customers}
            invoices={invoices}
            clubApprovals={clubApprovals}
            drills={drills}
            onApproveClub={handleApproveClub}
            onAddSystemDrill={handleAddDrill}
            onUpdateCustomerStatus={handleUpdateCustomerStatus}
            onUpgradeCustomerPlan={handleUpgradeCustomerPlan}
            onRetryInvoice={handleRetryInvoice}
          />
        )}

        {viewMode === 'CLUB_PORTAL' && (
          <ClubPortal
            clubMembers={clubMembers}
            squads={squads}
            sessions={sessions}
            certificates={certificates}
            drills={drills}
            onInviteMember={handleInviteMember}
            onAcceptMemberInvite={handleAcceptMemberInvite}
            onPromotePlayer={handlePromotePlayer}
            onAddSquad={handleAddSquad}
            onScheduleSession={handleScheduleSession}
            onPublishSession={handlePublishSession}
            onAddClubDrill={handleAddDrill}
            onSimulateDriveUpload={handleSimulateDriveUpload}
            uploadingDriveVideo={uploadingDriveVideo}
            driveUploadSuccess={driveUploadSuccess}
          />
        )}
      </main>
    </div>
  );
}
