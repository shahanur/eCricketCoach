import React, { useState } from 'react';
import { CustomerTenant, Invoice, ClubApproval, Drill, Discipline, ContextType } from '../../types';

interface AdminPanelProps {
  customers: CustomerTenant[];
  invoices: Invoice[];
  clubApprovals: ClubApproval[];
  drills: Drill[];
  onApproveClub: (id: string) => void;
  onAddSystemDrill: (drill: Drill) => void;
  onUpdateCustomerStatus: (id: string, status: CustomerTenant['status']) => void;
  onUpgradeCustomerPlan: (id: string, plan: CustomerTenant['subscriptionPlan']) => void;
  onRetryInvoice: (id: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  customers,
  invoices,
  clubApprovals,
  drills,
  onApproveClub,
  onAddSystemDrill,
  onUpdateCustomerStatus,
  onUpgradeCustomerPlan,
  onRetryInvoice
}) => {
  const [adminTab, setAdminTab] = useState<'CUSTOMERS' | 'BILLING' | 'CLUB_APPROVALS' | 'DRILL_CURATOR'>('CUSTOMERS');
  const [customerFilterType, setCustomerFilterType] = useState<string>('ALL');
  const [customerSearch, setCustomerSearch] = useState<string>('');

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
    alert(`New Official Pre-defined Drill "${drill.title}" added to system library!`);
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
    .reduce((sum, c) => sum + c.mrr, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🏢</span> Master Multi-Tenant Admin Panel
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            System Admin oversight: Customer accounts, billing, club approvals, and official pre-defined drill curation.
          </p>
        </div>

        {/* Sub-tabs within Admin */}
        <div className="flex flex-wrap rounded-lg bg-slate-900 border border-slate-800 p-1 gap-1">
          <button
            onClick={() => setAdminTab('CUSTOMERS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              adminTab === 'CUSTOMERS' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tenants ({customers.length})
          </button>
          <button
            onClick={() => setAdminTab('CLUB_APPROVALS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              adminTab === 'CLUB_APPROVALS' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Awaiting Approvals</span>
            {clubApprovals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-extrabold">
                {clubApprovals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setAdminTab('DRILL_CURATOR')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              adminTab === 'DRILL_CURATOR' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Drill Curator ({drills.filter(d => d.source === 'SYSTEM_PREDEFINED').length})
          </button>
          <button
            onClick={() => setAdminTab('BILLING')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              adminTab === 'BILLING' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Billing ({invoices.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total MRR</span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">${totalMrr.toFixed(2)}</p>
          <span className="text-[11px] text-slate-500">Monthly recurring rev</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Pending Club Approvals</span>
          <p className="text-2xl font-extrabold text-amber-400 mt-1">{clubApprovals.length}</p>
          <span className="text-[11px] text-amber-500/80">Paid, awaiting activation</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">System Drills</span>
          <p className="text-2xl font-extrabold text-white mt-1">
            {drills.filter(d => d.source === 'SYSTEM_PREDEFINED').length}
          </p>
          <span className="text-[11px] text-slate-500">Official eCricketCoach drills</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Past Due Invoices</span>
          <p className="text-2xl font-extrabold text-rose-400 mt-1">
            {customers.filter(c => c.status === 'PAST_DUE').length}
          </p>
          <span className="text-[11px] text-rose-500/80">Requires dunning action</span>
        </div>
      </div>

      {/* Sub-tab 1: Customers Table */}
      {adminTab === 'CUSTOMERS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Filter Type:</span>
              {['ALL', 'INDIVIDUAL', 'COACH', 'CLUB'].map(type => (
                <button
                  key={type}
                  onClick={() => setCustomerFilterType(type)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    customerFilterType === type ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search customer or email..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-full sm:w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Customer / Organization</th>
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
                        cust.type === 'CLUB' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        cust.type === 'COACH' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
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
                        <option value="INDIVIDUAL">Individual ($14.99)</option>
                        <option value="COACH_PRO">Coach Pro ($49.99)</option>
                        <option value="CLUB_ACADEMY">Club Academy ($199.99)</option>
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
                    <td className="py-3 px-3 font-semibold text-slate-200">${cust.mrr.toFixed(2)}/mo</td>
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

      {/* Sub-tab 2: Awaiting Club Approvals */}
      {adminTab === 'CLUB_APPROVALS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-white">Pending Club Registrations (Awaiting Approval)</h3>
            <p className="text-xs text-slate-400">
              Following a successful paid subscription, system admin verifies and activates the club admin credentials.
            </p>
          </div>

          {clubApprovals.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No pending club approvals. All clubs are active.
            </div>
          ) : (
            <div className="space-y-3">
              {clubApprovals.map(appr => (
                <div key={appr.id} className="p-4 rounded-lg bg-slate-950 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{appr.clubName}</h4>
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                        Payment Confirmed (${appr.amountPaid})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">Admin: <span className="font-semibold">{appr.adminName}</span> ({appr.adminEmail})</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Plan: {appr.plan} • Registered: {appr.createdAt}</p>
                  </div>
                  <button
                    onClick={() => onApproveClub(appr.id)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition whitespace-nowrap"
                  >
                    Approve & Activate Club Admin
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 3: System Drill Curator */}
      {adminTab === 'DRILL_CURATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                Global Catalog
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
                    <td className="py-3 px-3 font-mono text-cyan-400 font-medium">{inv.id}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{inv.customerName}</td>
                    <td className="py-3 px-3 text-slate-400">{inv.planName}</td>
                    <td className="py-3 px-3 text-slate-400">{inv.date}</td>
                    <td className="py-3 px-3 font-bold text-white">${inv.amount.toFixed(2)}</td>
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
                        <button onClick={() => onRetryInvoice(inv.id)} className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-[11px]">Retry</button>
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
    </div>
  );
};
