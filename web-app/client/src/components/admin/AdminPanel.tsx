import React, { useState } from 'react';
import { CustomerTenant, Invoice, ClubApproval, Drill, Discipline, ContextType, AdminNotification, SupportTicket } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { CheckCircle2, MessageSquare, LifeBuoy, Clock, ShieldCheck, Search, Pencil } from 'lucide-react';

interface AdminPanelProps {
  customers: CustomerTenant[];
  invoices: Invoice[];
  clubApprovals: ClubApproval[];
  drills: Drill[];
  notifications?: AdminNotification[];
  supportTickets?: SupportTicket[];
  onApproveClub: (id: string) => void;
  onAddSystemDrill: (drill: Drill) => void;
  onUpdateCustomerStatus: (id: string, status: CustomerTenant['status']) => void;
  onUpgradeCustomerPlan: (id: string, plan: CustomerTenant['subscriptionPlan']) => void;
  onRetryInvoice: (id: string) => void;
  onResolveTicket?: (ticketId: string, resolution: string) => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  customers,
  invoices,
  clubApprovals,
  drills,
  notifications = [],
  supportTickets = [],
  onApproveClub,
  onAddSystemDrill,
  onUpdateCustomerStatus,
  onUpgradeCustomerPlan,
  onRetryInvoice,
  onResolveTicket
}) => {
  const [adminTab, setAdminTab] = useState<'CUSTOMERS' | 'SUPPORT_TICKETS' | 'BILLING' | 'CLUB_APPROVALS' | 'DRILL_CURATOR' | 'NOTIFICATIONS'>('CUSTOMERS');
  const [customerFilterType, setCustomerFilterType] = useState<string>('ALL');
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // Support Tickets Filter & Resolution Modal state
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('ALL');
  const [ticketSearch, setTicketSearch] = useState<string>('');
  const [selectedTicketForResolution, setSelectedTicketForResolution] = useState<SupportTicket | null>(null);
  const [resolutionText, setResolutionText] = useState<string>('');
  const [resolvingTicket, setResolvingTicket] = useState<boolean>(false);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type?: ConfirmationType;
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Drill form state
  const [newDrillTitle, setNewDrillTitle] = useState('');
  const [newDrillDiscipline, setNewDrillDiscipline] = useState<Discipline>('BATTING');
  const [newDrillSkillSet, setNewDrillSkillSet] = useState('');
  const [newDrillContext, setNewDrillContext] = useState<ContextType>('INDIVIDUAL');
  const [newDrillDuration, setNewDrillDuration] = useState(20);
  const [newDrillInstructions, setNewDrillInstructions] = useState('');

  const handleCreateDrill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrillTitle || !newDrillSkillSet) return;
    const drill: Drill = {
      id: 'drill-sys-' + Date.now(),
      title: newDrillTitle,
      discipline: newDrillDiscipline,
      skillSet: newDrillSkillSet,
      contextType: newDrillContext,
      duration: Number(newDrillDuration) || 20,
      source: 'SYSTEM_PREDEFINED',
      instructions: newDrillInstructions || 'Official eCricketCoach pre-defined technical drill.'
    };
    onAddSystemDrill(drill);
    setNewDrillTitle('');
    setNewDrillSkillSet('');
    setNewDrillInstructions('');
    setConfirmModal({
      isOpen: true,
      title: 'Official Drill Curated',
      message: `Official Pre-defined Drill "${drill.title}" has been successfully added to the system library!`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setConfirmModal(null)
    });
  };

  const promptApproveClub = (appr: ClubApproval) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve & Activate Account',
      message: (
        <div className="space-y-2">
          <p>Are you sure you want to approve this registration application?</p>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <p className="font-semibold text-white">{appr.clubName}</p>
            <p className="text-slate-400">Admin: {appr.adminName} ({appr.adminEmail})</p>
            <p className="text-emerald-400">Plan: {appr.plan} • £{appr.amountPaid} (Paid)</p>
          </div>
          <p className="text-[11px] text-slate-400">This will immediately generate their active tenancy and dispatch login access tokens.</p>
        </div>
      ),
      type: 'confirm',
      confirmLabel: 'Confirm & Activate',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setConfirmModal(null);
        onApproveClub(appr.id);
      }
    });
  };

  const promptRetryInvoice = (inv: Invoice) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Payment Retry',
      message: `Attempt automated payment recharge for invoice #${inv.id} (${inv.customerName} - £${inv.amount.toFixed(2)})?`,
      type: 'confirm',
      confirmLabel: 'Retry Payment',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setConfirmModal(null);
        onRetryInvoice(inv.id);
      }
    });
  };

  const filteredCustomers = customers.filter(c => {
    const matchesType = customerFilterType === 'ALL' || c.type === customerFilterType;
    const matchesSearch =
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const totalMrr = customers
    .filter(c => c.status === 'ACTIVE')
    .reduce((sum, c) => sum + (c.mrr || 0), 0);

  const openTicketsCount = supportTickets.filter(t => t.status === 'OPEN').length;

  const filteredTickets = supportTickets.filter(t => {
    if (ticketStatusFilter !== 'ALL' && t.status !== ticketStatusFilter) return false;
    if (ticketCategoryFilter !== 'ALL' && t.category !== ticketCategoryFilter) return false;
    if (ticketSearch.trim()) {
      const q = ticketSearch.toLowerCase();
      const match =
        t.ticketRef.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        (t.clubName && t.clubName.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleOpenResolveModal = (ticket: SupportTicket) => {
    setSelectedTicketForResolution(ticket);
    setResolutionText(ticket.resolution || '');
  };

  const handleConfirmResolve = async () => {
    if (!selectedTicketForResolution || !resolutionText.trim()) return;
    setResolvingTicket(true);
    try {
      if (onResolveTicket) {
        await onResolveTicket(selectedTicketForResolution.id, resolutionText.trim());
      }
      setSelectedTicketForResolution(null);
      setResolutionText('');
      setConfirmModal({
        isOpen: true,
        title: 'Support Ticket Resolved',
        message: `Ticket Ref #${selectedTicketForResolution.ticketRef} has been resolved! Customer ${selectedTicketForResolution.name} (${selectedTicketForResolution.email}) and engineering logs have been updated.`,
        type: 'success',
        confirmLabel: 'Done',
        onConfirm: () => setConfirmModal(null)
      });
    } catch (err: any) {
      console.error('Failed to resolve ticket:', err);
    } finally {
      setResolvingTicket(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Panel Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🏢</span> Master Multi-Tenant Admin Panel
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          System Admin oversight: Customer accounts, billing, club approvals, and official pre-defined drill curation.
        </p>
      </div>

      {/* Full-width Sub-tabs Panel below Master Multi-Tenant Admin Panel */}
      <div className="w-full rounded-xl bg-slate-900 border border-slate-800 p-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 shadow-sm">
        <button
          onClick={() => setAdminTab('CUSTOMERS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            adminTab === 'CUSTOMERS' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Tenants</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold ${
            adminTab === 'CUSTOMERS' ? 'bg-sky-950 text-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
          }`}>
            {customers.length}
          </span>
        </button>

        {/* Support Tickets Desk Tab */}
        <button
          onClick={() => setAdminTab('SUPPORT_TICKETS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            adminTab === 'SUPPORT_TICKETS' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Support Desk</span>
          {openTicketsCount > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] bg-rose-500 text-white font-extrabold animate-pulse">
              {openTicketsCount}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-bold">
              {supportTickets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('CLUB_APPROVALS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            adminTab === 'CLUB_APPROVALS' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Awaiting Approvals</span>
          {clubApprovals.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] bg-rose-500 text-white font-extrabold animate-bounce">
              {clubApprovals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAdminTab('NOTIFICATIONS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            adminTab === 'NOTIFICATIONS' ? 'bg-sky-500 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Admin Alerts</span>
          {notifications.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] bg-sky-900 text-sky-200 border border-sky-400 font-extrabold">
              {notifications.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAdminTab('DRILL_CURATOR')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            adminTab === 'DRILL_CURATOR' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Drill Curator</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold ${
            adminTab === 'DRILL_CURATOR' ? 'bg-emerald-950 text-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}>
            {drills.filter(d => d.source === 'SYSTEM_PREDEFINED').length}
          </span>
        </button>
        <button
          onClick={() => setAdminTab('BILLING')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            adminTab === 'BILLING' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Billing</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold ${
            adminTab === 'BILLING' ? 'bg-sky-950 text-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
          }`}>
            {invoices.length}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total MRR</span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">£{totalMrr.toFixed(2)}</p>
          <span className="text-[11px] text-slate-500">Monthly recurring rev</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Pending Club Approvals</span>
          <p className="text-2xl font-extrabold text-amber-400 mt-1">{clubApprovals.length}</p>
          <span className="text-[11px] text-slate-500">Paid onboarding queue</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Active Support Tickets</span>
          <p className="text-2xl font-extrabold text-sky-400 mt-1">{openTicketsCount}</p>
          <span className="text-[11px] text-slate-500">{supportTickets.length} total logged tickets</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">System Drills Catalogue</span>
          <p className="text-2xl font-extrabold text-sky-400 mt-1">{drills.filter(d => d.source === 'SYSTEM_PREDEFINED').length}</p>
          <span className="text-[11px] text-slate-500">Pre-defined curriculum</span>
        </div>
      </div>

      {/* Sub-tab 1: Customers */}
      {adminTab === 'CUSTOMERS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-semibold text-lg text-white">All Tenant Customers</h3>
              <p className="text-xs text-slate-400">Manage individual players, pro coaches, and club academy accounts.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg">
                {(['ALL', 'CLUB', 'COACH', 'INDIVIDUAL'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setCustomerFilterType(type)}
                    className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      customerFilterType === type ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search tenant or email..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-full sm:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Customer / Organisation</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Plan</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">MRR</th>
                  <th className="py-3 px-3">Members</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-100">{cust.name}</p>
                      <p className="text-slate-400 text-[11px]">{cust.email}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cust.type === 'CLUB' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                        cust.type === 'COACH' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                        'bg-slate-700/60 text-slate-300'
                      }`}>
                        {cust.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={cust.subscriptionPlan}
                        onChange={e => onUpgradeCustomerPlan(cust.id, e.target.value as CustomerTenant['subscriptionPlan'])}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="FREE_TRIAL">Free Trial</option>
                        <option value="INDIVIDUAL">Individual (£14.99)</option>
                        <option value="COACH_PRO">Coach Pro (£49.99)</option>
                        <option value="CLUB_ACADEMY">Club Academy (£199.99)</option>
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cust.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        cust.status === 'PAST_DUE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        cust.status === 'TRIAL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {cust.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">£{cust.mrr.toFixed(2)}/mo</td>
                    <td className="py-3 px-3 text-slate-400">{cust.activeMembers}</td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      {cust.status === 'PAST_DUE' ? (
                        <button onClick={() => onUpdateCustomerStatus(cust.id, 'ACTIVE')} className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px]">Clear Due</button>
                      ) : cust.status === 'ACTIVE' ? (
                        <button onClick={() => onUpdateCustomerStatus(cust.id, 'CANCELED')} className="px-2.5 py-1 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 text-slate-400 rounded text-[11px]">Suspend</button>
                      ) : (
                        <button onClick={() => onUpdateCustomerStatus(cust.id, 'ACTIVE')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]">Reactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab: Support Desk & Customer Tickets */}
      {adminTab === 'SUPPORT_TICKETS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-emerald-400" />
                <span>eCricketCoach Customer Support Desk</span>
              </h3>
              <p className="text-xs text-slate-400">
                Tickets submitted by Club Admins, Coaches, and Players across Technical, Billing, and AI Kinematic topics.
              </p>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status Segmented Buttons */}
              <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg">
                {(['ALL', 'OPEN', 'RESOLVED'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setTicketStatusFilter(st)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                      ticketStatusFilter === st
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {st === 'ALL' ? 'All Tickets' : st}
                  </button>
                ))}
              </div>

              {/* Category Filter */}
              <select
                value={ticketCategoryFilter}
                onChange={e => setTicketCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="TECHNICAL">Technical Support</option>
                <option value="BILLING">Billing & Invoices</option>
                <option value="AI_ANALYSIS">AI Pose Estimation</option>
                <option value="ROSTER_MANAGEMENT">Rosters & Squads</option>
                <option value="FEATURE_REQUEST">Feature Request</option>
                <option value="OTHER">Other</option>
              </select>

              {/* Search Input */}
              <div className="relative flex-1 sm:w-56">
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Search ref, tenant, text..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
              </div>
            </div>
          </div>

          {/* Tickets List */}
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2">
              <LifeBuoy className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">No tickets match the selected filter criteria.</p>
              <p className="text-[11px] text-slate-500">Tickets submitted by tenant users will automatically appear in this inbox.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map(t => (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    t.status === 'OPEN'
                      ? 'bg-slate-950 border-slate-800 hover:border-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800/60 opacity-90'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        {t.ticketRef}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        t.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        t.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {t.priority}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        {t.category.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'OPEN'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {t.status === 'OPEN' ? '● Open / Needs Action' : '✓ Resolved'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{t.createdAt}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{t.subject}</span>
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed pt-1 whitespace-pre-line">
                      {t.message}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs border-t border-slate-800/60">
                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      <span>Customer: <strong className="text-slate-200">{t.name}</strong></span>
                      <span>Email: <a href={`mailto:${t.email}`} className="text-sky-400 hover:underline">{t.email}</a></span>
                      {t.clubName && <span>Club: <strong className="text-sky-300">{t.clubName}</strong></span>}
                      {t.tenantRole && <span className="bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">{t.tenantRole}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status === 'OPEN' ? (
                        <button
                          onClick={() => handleOpenResolveModal(t)}
                          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolve Ticket</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            Resolved by <strong className="text-emerald-400">{t.resolvedBy || 'Engineer'}</strong> on {t.resolvedAt}
                          </span>
                          <button
                            onClick={() => handleOpenResolveModal(t)}
                            type="button"
                            title="Edit resolution"
                            aria-label="Edit resolution"
                            className="inline-flex h-7 w-7 items-center justify-center text-slate-400 hover:text-white rounded border border-slate-700 hover:bg-slate-800 cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {t.resolution && (
                    <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Engineer Resolution Note</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed pl-5 whitespace-pre-line">
                        {t.resolution}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ticket Resolution Modal */}
      {selectedTicketForResolution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedTicketForResolution(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg cursor-pointer p-1"
            >
              ✕
            </button>

            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Support Engineer Resolution</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Resolve Ticket #{selectedTicketForResolution.ticketRef}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Customer: <strong className="text-white">{selectedTicketForResolution.name}</strong> ({selectedTicketForResolution.email})
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <span className="font-bold text-slate-300">Issue Subject:</span>
              <p className="text-slate-200">{selectedTicketForResolution.subject}</p>
              <span className="font-bold text-slate-400 block pt-1">Customer Description:</span>
              <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3">
                {selectedTicketForResolution.message}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Action Taken / Engineer Resolution Details <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={resolutionText}
                onChange={e => setResolutionText(e.target.value)}
                placeholder="Explain the technical remedy, billing credit applied, or configuration instructions provided to the customer..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTicketForResolution(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resolutionText.trim() || resolvingTicket}
                onClick={handleConfirmResolve}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{resolvingTicket ? 'Saving Resolution...' : 'Mark as Resolved & Notify'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Awaiting Club Approvals */}
      {adminTab === 'CLUB_APPROVALS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-white">Pending Registrations Awaiting System Admin Approval</h3>
            <p className="text-xs text-slate-400">
              When a player, coach, or club registers and pays on the Home page, the item is queued here and a notification email is dispatched to the admin.
            </p>
          </div>

          {clubApprovals.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No pending registrations. All accounts are approved and active!
            </div>
          ) : (
            <div className="space-y-3">
              {clubApprovals.map(appr => (
                <div key={appr.id} className="p-4 rounded-lg bg-slate-950 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{appr.clubName}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        appr.type === 'CLUB' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                        appr.type === 'COACH' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {appr.type || 'CLUB'}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                        Payment Confirmed (£{appr.amountPaid.toFixed(2)})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Applicant: <span className="font-semibold text-white">{appr.adminName}</span> • Email: <span className="text-sky-300">{appr.adminEmail}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Plan: <span className="text-slate-300 font-medium">{appr.plan}</span> • Billing: {appr.billingCycle || 'ANNUAL'} • Registered: {appr.createdAt}
                    </p>
                  </div>
                  <button
                    onClick={() => promptApproveClub(appr)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition whitespace-nowrap cursor-pointer"
                  >
                    ✓ Approve & Activate Account
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab: System Admin Email Notifications */}
      {adminTab === 'NOTIFICATIONS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                <span>📬</span> System Admin Notification Inbox (Emails Received)
              </h3>
              <p className="text-xs text-slate-400">
                System admin receives immediate transactional email notifications when payments complete and new tenant registrations occur.
              </p>
            </div>
            <span className="text-xs text-sky-300 font-mono bg-sky-950/80 px-2.5 py-1 rounded border border-sky-700/50">
              admin@ecricketcoach.com
            </span>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No recent notifications received.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div key={notif.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>📩</span> {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-500">{notif.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">{notif.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 3: System Drill Curator */}
      {adminTab === 'DRILL_CURATOR' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-base text-white">Add Pre-Defined Drill</h3>
            <p className="text-xs text-slate-400">
              Pre-defined drills entered here become instantly available for all coaches across all clubs.
            </p>
            <form onSubmit={handleCreateDrill} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Drill Title</label>
                <input
                  type="text"
                  required
                  value={newDrillTitle}
                  onChange={e => setNewDrillTitle(e.target.value)}
                  placeholder="e.g. Slower Ball Back-of-Hand Release"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Discipline</label>
                  <select
                    value={newDrillDiscipline}
                    onChange={e => setNewDrillDiscipline(e.target.value as Discipline)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="BATTING">Batting</option>
                    <option value="BOWLING">Bowling</option>
                    <option value="KEEPING">Keeping</option>
                    <option value="FIELDING">Fielding</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Context</label>
                  <select
                    value={newDrillContext}
                    onChange={e => setNewDrillContext(e.target.value as ContextType)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="INDIVIDUAL">Individual (1-on-1)</option>
                    <option value="GROUP">Group (Squad)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Skill Set Category</label>
                <input
                  type="text"
                  required
                  value={newDrillSkillSet}
                  onChange={e => setNewDrillSkillSet(e.target.value)}
                  placeholder="e.g. Spin Variation, Front-Foot Defense"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={newDrillDuration}
                  onChange={e => setNewDrillDuration(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Instructions / Key Coaching Cues</label>
                <textarea
                  rows={2}
                  value={newDrillInstructions}
                  onChange={e => setNewDrillInstructions(e.target.value)}
                  placeholder="Key markers, biomechanical cues, and reps..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition"
              >
                Publish Pre-Defined Drill
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-white">System Pre-Defined Drills Library</h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Global Catalogue
              </span>
            </div>
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {drills.filter(d => d.source === 'SYSTEM_PREDEFINED').map(drill => (
                <div key={drill.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{drill.title}</h4>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                        {drill.skillSet}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{drill.instructions}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {drill.duration} mins • {drill.discipline} • {drill.contextType}
                    </p>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                    Official
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Billing Table */}
      {adminTab === 'BILLING' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Plan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-mono text-sky-400 font-medium">{inv.id}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{inv.customerName}</td>
                    <td className="py-3 px-3 text-slate-400">{inv.planName}</td>
                    <td className="py-3 px-3 text-slate-400">{inv.date}</td>
                    <td className="py-3 px-3 font-bold text-white">£{inv.amount.toFixed(2)}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        inv.status === 'FAILED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {inv.status === 'FAILED' ? (
                        <button
                          onClick={() => promptRetryInvoice(inv)}
                          className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded text-[11px] cursor-pointer"
                        >
                          Retry
                        </button>
                      ) : (
                        <button className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]">Receipt</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={confirmModal.cancelLabel}
          showCancel={confirmModal.showCancel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};
