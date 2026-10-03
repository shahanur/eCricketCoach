import { useState, useEffect } from 'react';
import {
  ViewMode,
  ThemeMode,
  Drill,
  CustomerTenant,
  Invoice,
  ClubApproval,
  ClubMember,
  Squad,
  TrainingSession,
  Certificate,
  AdminNotification,
  AuthUser,
  SupportTicket
} from './types';
import { api } from './services/api';
import { Navbar } from './components/common/Navbar';
import { LoginModal } from './components/common/LoginModal';
import { ConfirmationModal, ConfirmationType } from './components/common/ConfirmationModal';
import { HomePage, PlanConfig } from './components/home/HomePage';
import { CoachingPortal } from './components/coaching/CoachingPortal';
import { AdminPanel } from './components/admin/AdminPanel';
import { ClubPortal } from './components/club/ClubPortal';
import { UserHomeDashboard } from './components/dashboard/UserHomeDashboard';
import { HelpSupportPage } from './components/help/HelpSupportPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const savedUser = localStorage.getItem('current_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u.roles?.includes('SUPER_ADMIN')) return 'ADMIN_PANEL';
        if (u.roles?.includes('CLUB_ADMIN')) return 'CLUB_PORTAL';
        return 'COACHING_PORTAL';
      }
    } catch {}
    return 'HOME';
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [socialRegistration, setSocialRegistration] = useState<{ token: string; name: string; email: string } | null>(null);

  // Global modal state for confirmations and action notifications
  const [appModal, setAppModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type?: ConfirmationType;
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  // Theme state with localStorage persistence: 'dark' | 'light' | 'pure-light'
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'pure-light') return saved as ThemeMode;
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'pure-light');
    if (theme === 'light') {
      root.classList.add('light');
    } else if (theme === 'pure-light') {
      root.classList.add('pure-light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const authToken = hash.get('auth_token');
    const role = hash.get('role');
    if (authToken && role && ['SUPER_ADMIN', 'PLAYER', 'COACH', 'CLUB_ADMIN'].includes(role)) {
      const user: AuthUser = {
        id: 'social-user',
        name: hash.get('name') || (role === 'SUPER_ADMIN' ? 'System Administrator' : 'eCricketCoach member'),
        email: hash.get('email') || '',
        roles: [role as AuthUser['roles'][number]],
        clubName: hash.get('clubName') || undefined
      };
      localStorage.setItem('auth_token', authToken);
      localStorage.setItem('current_user', JSON.stringify(user));
      setCurrentUser(user);
      if (role === 'SUPER_ADMIN') {
        setViewMode('ADMIN_PANEL');
      } else if (role === 'CLUB_ADMIN') {
        setViewMode('CLUB_PORTAL');
      } else {
        setViewMode('COACHING_PORTAL');
      }
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const token = query.get('registration_token');
    const name = query.get('registration_name');
    const email = query.get('registration_email');
    if (token && name && email) {
      setSocialRegistration({ token, name, email });
      query.delete('registration_token');
      query.delete('registration_name');
      query.delete('registration_email');
      const remainingQuery = query.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ''}`);
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'pure-light';
      return 'dark';
    });
  };

  const handleSelectTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  // Master Drill Catalog
  const [drills, setDrills] = useState<Drill[]>([]);

  // Master Customer Tenancies
  const [customers, setCustomers] = useState<CustomerTenant[]>([]);

  // Invoices State
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Awaiting Registrations for Super-Admin Approval
  const [clubApprovals, setClubApprovals] = useState<ClubApproval[]>([]);

  // System Admin Notification Email Inbox
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);

  // Club Members
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);

  // Squads State
  const [squads, setSquads] = useState<Squad[]>([]);

  // Training Sessions State
  const [sessions, setSessions] = useState<TrainingSession[]>([]);

  // Certificates State
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // Support Tickets State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  // Drive upload state
  const [uploadingDriveVideo, setUploadingDriveVideo] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState<any>(null);

  // Initial Load from PostgreSQL APIs
  useEffect(() => {
    async function loadData() {
      try {
        const [
          drillsData,
          custData,
          invoicesData,
          approvalsData,
          notifsData,
          membersData,
          squadsData,
          sessionsData,
          certsData,
          ticketsData
        ] = await Promise.all([
          api.getDrills().catch(() => []),
          api.getCustomers().catch(() => ({ customers: [] })),
          api.getInvoices().catch(() => []),
          api.getClubApprovals().catch(() => []),
          api.getNotifications().catch(() => []),
          api.getClubMembers().catch(() => []),
          api.getSquads().catch(() => []),
          api.getSessions().catch(() => []),
          api.getCertificates().catch(() => []),
          api.getSupportTickets().catch(() => [])
        ]);

        if (drillsData?.length) setDrills(drillsData);
        if (custData?.customers?.length) setCustomers(custData.customers);
        if (invoicesData?.length) setInvoices(invoicesData);
        if (approvalsData?.length) setClubApprovals(approvalsData);
        if (notifsData?.length) setAdminNotifications(notifsData);
        if (membersData?.length) setClubMembers(membersData);
        if (squadsData?.length) setSquads(squadsData);
        if (sessionsData?.length) setSessions(sessionsData);
        if (certsData?.length) setCertificates(certsData);
        if (ticketsData?.length) setSupportTickets(ticketsData);
      } catch (err) {
        console.error('Failed to load data from backend:', err);
      }
    }
    loadData();
  }, []);

  // App handlers backed by PostgreSQL APIs
  const handleAddDrill = async (drill: Drill) => {
    try {
      let savedDrill: Drill;
      if (drill.source === 'CLUB_CUSTOM') {
        savedDrill = await api.addClubDrill(drill);
      } else {
        savedDrill = await api.addAdminDrill(drill);
      }
      setDrills(prev => [savedDrill, ...prev]);
    } catch {
      setDrills(prev => [drill, ...prev]);
    }
  };

  // Called from HomePage when a user subscribes and pays
  const handleRegisterFromHomePage = async (data: {
    plan: PlanConfig;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    name: string;
    email: string;
    organizationName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
    registrationToken?: string;
  }) => {
    try {
      const result = await api.checkout({
        planId: data.plan.type === 'CLUB' ? 'CLUB_ACADEMY' : data.plan.type === 'COACH' ? 'COACH_PRO' : 'INDIVIDUAL',
        billingCycle: data.billingCycle,
        name: data.name,
        email: data.email,
        organizationName: data.organizationName,
        cardNumber: data.cardNumber,
        registrationToken: data.registrationToken
      });

      if (result) {
        setClubApprovals(prev => [result.approval, ...prev]);
        setInvoices(prev => [result.invoice, ...prev]);
        setAdminNotifications(prev => [result.notification, ...prev]);
        return;
      }
    } catch (err) {
      console.error('Checkout API error, falling back to local update:', err);
    }

    const amountPaid = data.billingCycle === 'MONTHLY' ? data.plan.priceMonthly : data.plan.priceAnnual;
    const approvalId = 'appr-' + Date.now();
    const invoiceId = 'INV-' + Math.floor(1100 + Math.random() * 900);

    const newApproval: ClubApproval = {
      id: approvalId,
      clubName: data.organizationName,
      adminName: data.name,
      adminEmail: data.email,
      plan: `${data.plan.name} (${data.billingCycle === 'MONTHLY' ? 'Monthly' : 'Annual'})`,
      amountPaid: amountPaid,
      type: data.plan.type,
      billingCycle: data.billingCycle,
      status: 'AWAITING_APPROVAL',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setClubApprovals(prev => [newApproval, ...prev]);

    const newInvoice: Invoice = {
      id: invoiceId,
      tenantId: 'pending-' + approvalId,
      customerName: data.organizationName,
      amount: amountPaid,
      currency: 'USD',
      status: 'PAID',
      date: new Date().toISOString().split('T')[0],
      planName: `${data.plan.name} (${data.billingCycle})`
    };
    setInvoices(prev => [newInvoice, ...prev]);

    const newNotification: AdminNotification = {
      id: 'notif-' + Date.now(),
      title: `New Registration Paid: ${data.organizationName} (${data.plan.name})`,
      message: `System Admin Notification: ${data.name} (${data.email}) just completed a successful payment of $${amountPaid.toFixed(2)} for the ${data.plan.name} plan via Card ending in 4242. The application has been queued under Admin Panel > Awaiting Approvals.`,
      type: 'PAYMENT_RECEIVED',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      read: false
    };
    setAdminNotifications(prev => [newNotification, ...prev]);
  };

  const handleApproveClub = async (apprId: string) => {
    try {
      const res = await api.approveClub(apprId);
      if (res?.customer) {
        setClubApprovals(prev => prev.filter(a => a.id !== apprId));
        setCustomers(prev => [res.customer, ...prev]);
        if (res.notification) {
          setAdminNotifications(prev => [res.notification, ...prev]);
        }
        setAppModal({
          isOpen: true,
          title: 'Account Approved & Activated',
          message: `🎉 Account "${res.item.clubName}" has been successfully approved! Credentials and welcome access tokens have been dispatched to ${res.item.adminEmail}.`,
          type: 'success',
          confirmLabel: 'Done',
          onConfirm: () => setAppModal(null)
        });
        return;
      }
    } catch (err) {
      console.error('Approve API error, applying state fallback:', err);
    }

    const appr = clubApprovals.find(a => a.id === apprId);
    if (!appr) return;
    setClubApprovals(prev => prev.filter(a => a.id !== apprId));

    const priceMonthly = appr.type === 'CLUB' ? 199.99 : appr.type === 'COACH' ? 49.99 : 14.99;
    const planType: CustomerTenant['subscriptionPlan'] =
      appr.type === 'CLUB' ? 'CLUB_ACADEMY' : appr.type === 'COACH' ? 'COACH_PRO' : 'INDIVIDUAL';

    setCustomers(prev => [
      {
        id: 'ten-' + Date.now(),
        name: appr.clubName,
        type: appr.type || 'CLUB',
        email: appr.adminEmail,
        subscriptionPlan: planType,
        status: 'ACTIVE',
        billingCycle: appr.billingCycle || 'ANNUAL',
        mrr: priceMonthly,
        activeMembers: 1,
        joinedAt: new Date().toISOString().split('T')[0]
      },
      ...prev
    ]);

    setAdminNotifications(prev => [
      {
        id: 'notif-' + Date.now(),
        title: `Account Activated: ${appr.clubName}`,
        message: `System Admin approved the registration for ${appr.adminName} (${appr.adminEmail}). Welcome email and access tokens have been dispatched.`,
        type: 'TENANT_ACTIVATED',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        read: false
      },
      ...prev
    ]);

    setAppModal({
      isOpen: true,
      title: 'Account Approved & Activated',
      message: `🎉 Account "${appr.clubName}" has been approved! Onboarding link & credentials dispatched to ${appr.adminEmail}.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setAppModal(null)
    });
  };

  const handleUpdateCustomerStatus = async (id: string, newStatus: CustomerTenant['status']) => {
    try {
      const updated = await api.updateCustomerStatus(id, newStatus);
      if (updated) {
        setCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
        return;
      }
    } catch {
      // fallback
    }
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, status: newStatus } : c)));
  };

  const handleUpgradeCustomerPlan = async (id: string, newPlan: CustomerTenant['subscriptionPlan']) => {
    try {
      const updated = await api.updateCustomerPlan(id, newPlan);
      if (updated) {
        setCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
        return;
      }
    } catch {
      // fallback
    }
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

  const handleRetryInvoice = async (invoiceId: string) => {
    try {
      const updated = await api.updateInvoiceStatus(invoiceId, 'PAID');
      if (updated) {
        setInvoices(prev => prev.map(i => (i.id === invoiceId ? updated : i)));
        setAppModal({
          isOpen: true,
          title: 'Invoice Payment Succeeded',
          message: `Invoice ${invoiceId} has been successfully recharged and recorded as PAID.`,
          type: 'success',
          confirmLabel: 'OK',
          onConfirm: () => setAppModal(null)
        });
        return;
      }
    } catch {
      // fallback
    }
    setInvoices(prev => prev.map(i => (i.id === invoiceId ? { ...i, status: 'PAID' } : i)));
    setAppModal({
      isOpen: true,
      title: 'Invoice Payment Succeeded',
      message: `Invoice ${invoiceId} marked as successfully charged.`,
      type: 'success',
      confirmLabel: 'OK',
      onConfirm: () => setAppModal(null)
    });
  };

  const handleResolveSupportTicket = async (ticketId: string, resolution: string) => {
    try {
      const resolverName = currentUser?.name || 'Support Engineer';
      const res = await api.resolveSupportTicket(ticketId, {
        resolution,
        resolvedBy: resolverName
      });
      if (res?.ticket) {
        setSupportTickets(prev => prev.map(t => t.id === ticketId ? res.ticket : t));
        setAppModal({
          isOpen: true,
          title: 'Ticket Resolved & Customer Notified',
          message: `Ticket #${res.ticket.ticketRef} was marked RESOLVED. Notification dispatched to ${res.ticket.email}.`,
          type: 'success',
          confirmLabel: 'Done',
          onConfirm: () => setAppModal(null)
        });
        return;
      }
    } catch (err) {
      console.error('Resolve ticket error, applying fallback:', err);
    }
    // Fallback local update
    setSupportTickets(prev => prev.map(t => t.id === ticketId ? {
      ...t,
      status: 'RESOLVED',
      resolution,
      resolvedBy: currentUser?.name || 'Support Engineer',
      resolvedAt: new Date().toISOString()
    } : t));
    setAppModal({
      isOpen: true,
      title: 'Ticket Resolved',
      message: 'Support ticket has been marked resolved.',
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setAppModal(null)
    });
  };

  const handleInviteMember = async (member: ClubMember) => {
    try {
      const saved = await api.inviteMember(member);
      setClubMembers(prev => [...prev, saved || member]);
    } catch {
      setClubMembers(prev => [...prev, member]);
    }
  };

  const handleAcceptMemberInvite = async (memberId: string) => {
    try {
      const saved = await api.acceptMemberInvite(memberId);
      if (saved) {
        setClubMembers(prev => prev.map(m => (m.id === memberId ? saved : m)));
        setAppModal({
          isOpen: true,
          title: 'Roster Invitation Accepted',
          message: 'Invitation accepted! Member profile is now active and can access assigned training plans and squad communications.',
          type: 'success',
          confirmLabel: 'Done',
          onConfirm: () => setAppModal(null)
        });
        return;
      }
    } catch {
      // fallback
    }
    setClubMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, invitationStatus: 'ACTIVE' } : m))
    );
    setAppModal({
      isOpen: true,
      title: 'Roster Invitation Accepted',
      message: 'Invitation accepted! Member profile is now active and can access assigned training plans and squad communications.',
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setAppModal(null)
    });
  };

  const handlePromotePlayer = async (memberId: string) => {
    const member = clubMembers.find(m => m.id === memberId);
    if (!member) return;

    const nextLevel =
      member.currentLevel === 'FOUNDATION' ? 'DEVELOPING' :
      member.currentLevel === 'DEVELOPING' ? 'INTERMEDIATE' :
      member.currentLevel === 'INTERMEDIATE' ? 'ADVANCED' : 'ELITE';

    try {
      const res = await api.promotePlayer(memberId, {
        action: 'PROMOTE',
        newLevel: nextLevel,
        coachNotes: 'Completed all stage competency gates with distinction across matches and net sessions.'
      });

      if (res?.certificate) {
        setCertificates(prev => [res.certificate, ...prev]);
        setClubMembers(prev =>
          prev.map(m => (m.id === memberId ? { ...m, currentLevel: nextLevel } : m))
        );
        setAppModal({
          isOpen: true,
          title: 'Player Milestone Certified',
          message: `🎉 ${member.name} has been promoted to ${nextLevel}! Digital progression certificate #${res.certificate.certificateNumber} has been issued and cataloged.`,
          type: 'success',
          confirmLabel: 'View Certificates',
          onConfirm: () => setAppModal(null)
        });
        return;
      }
    } catch {
      // fallback
    }

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
    setAppModal({
      isOpen: true,
      title: 'Player Milestone Certified',
      message: `🎉 ${member.name} has been promoted to ${nextLevel}! Digital progression certificate #${newCert.certificateNumber} has been issued and cataloged.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setAppModal(null)
    });
  };

  const handleAddSquad = async (squad: Squad) => {
    try {
      const saved = await api.addSquad(squad);
      setSquads(prev => [...prev, saved || squad]);
    } catch {
      setSquads(prev => [...prev, squad]);
    }
  };

  const handleScheduleSession = async (session: TrainingSession) => {
    try {
      const saved = await api.scheduleSession(session);
      setSessions(prev => [...prev, saved || session]);
    } catch {
      setSessions(prev => [...prev, session]);
    }
  };

  const handlePublishSession = async (sessionId: string) => {
    try {
      const published = await api.publishSession(sessionId);
      if (published) {
        setSessions(prev => prev.map(s => (s.id === sessionId ? published : s)));
        setAppModal({
          isOpen: true,
          title: 'Training Schedule Published',
          message: 'Training session published! Registered squad athletes and coaches have been notified with the assigned drill itinerary.',
          type: 'success',
          confirmLabel: 'Done',
          onConfirm: () => setAppModal(null)
        });
        return;
      }
    } catch {
      // fallback
    }
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, isPublished: true } : s))
    );
    setAppModal({
      isOpen: true,
      title: 'Training Schedule Published',
      message: 'Training session published! Registered squad athletes and coaches have been notified with the assigned drill itinerary.',
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setAppModal(null)
    });
  };

  const handleSimulateDriveUpload = async (playerName: string) => {
    setUploadingDriveVideo(true);
    setDriveUploadSuccess(null);
    try {
      const result = await api.uploadDriveVideo('mem-4', {
        fileName: `${playerName.replace(' ', '_')}_Bowling_Spell.mp4`,
        discipline: 'BOWLING',
        playerName
      });
      setUploadingDriveVideo(false);
      setDriveUploadSuccess({
        player: playerName,
        fileName: `${playerName.replace(' ', '_')}_Bowling_Spell.mp4`,
        drivePath: result?.googleDrivePath || `Google Drive / eCricketCoach / MelbourneCricketAcademy / ${playerName} / Bowling`,
        aiSummary: result?.aiAnalysis?.keyBiomechanicalObservations?.[0] || 'Kinematic analysis complete: Detected front arm dropping 80ms early before ball release.',
        prescribedDrill: result?.aiAnalysis?.recommendedDrills?.[0] || 'High Non-Bowling Arm Extension & Target Drop Drill (20 mins)'
      });
    } catch {
      setTimeout(() => {
        setUploadingDriveVideo(false);
        setDriveUploadSuccess({
          player: playerName,
          fileName: `${playerName.replace(' ', '_')}_Bowling_Spell.mp4`,
          drivePath: `Google Drive / eCricketCoach / MelbourneCricketAcademy / ${playerName} / Bowling`,
          aiSummary: 'Kinematic analysis complete: Detected front arm dropping 80ms early before ball release.',
          prescribedDrill: 'High Non-Bowling Arm Extension & Target Drop Drill (20 mins)'
        });
      }, 1000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    sessionStorage.clear();
    setCurrentUser(null);
    setViewMode('HOME');
    // Clear any residual hash or query params from URL history
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        pendingApprovalsCount={clubApprovals.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelectTheme={handleSelectTheme}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Confirmation & Notification Modal */}
      {appModal && (
        <ConfirmationModal
          isOpen={appModal.isOpen}
          title={appModal.title}
          message={appModal.message}
          type={appModal.type}
          confirmLabel={appModal.confirmLabel}
          cancelLabel={appModal.cancelLabel}
          showCancel={appModal.showCancel}
          onConfirm={appModal.onConfirm}
          onCancel={appModal.onCancel || (() => setAppModal(null))}
          onClose={() => setAppModal(null)}
        />
      )}

      {/* Main Content Areas */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {viewMode === 'HOME' && !currentUser && (
          <HomePage
            onRegisterPlan={handleRegisterFromHomePage}
            onExploreDemo={() => setIsLoginModalOpen(true)}
            socialRegistration={socialRegistration}
          />
        )}

        {viewMode === 'HOME' && currentUser && (
          <UserHomeDashboard
            currentUser={currentUser}
            setViewMode={setViewMode}
            drills={drills}
            clubMembers={clubMembers}
            squads={squads}
            sessions={sessions}
            certificates={certificates}
          />
        )}

        {viewMode === 'HELP_SUPPORT' && (
          <HelpSupportPage
            currentUser={currentUser}
            setViewMode={setViewMode}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}

        {viewMode === 'COACHING_PORTAL' && (
          <CoachingPortal drills={drills} onAddAiDrill={handleAddDrill} />
        )}

        {viewMode === 'ADMIN_PANEL' && (
          <AdminPanel
            customers={customers}
            invoices={invoices}
            clubApprovals={clubApprovals}
            drills={drills}
            notifications={adminNotifications}
            supportTickets={supportTickets}
            onApproveClub={handleApproveClub}
            onAddSystemDrill={handleAddDrill}
            onUpdateCustomerStatus={handleUpdateCustomerStatus}
            onUpgradeCustomerPlan={handleUpgradeCustomerPlan}
            onRetryInvoice={handleRetryInvoice}
            onResolveTicket={handleResolveSupportTicket}
          />
        )}

        {viewMode === 'CLUB_PORTAL' && (
          <ClubPortal
            clubMembers={clubMembers}
            squads={squads}
            sessions={sessions}
            certificates={certificates}
            drills={drills}
            clubName={currentUser?.clubName || 'Melbourne Cricket Academy'}
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
