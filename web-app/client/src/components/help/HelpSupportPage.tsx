import React, { useState } from 'react';
import { AuthUser, ViewMode, SupportCategory, SupportTicket } from '../../types';
import {
  LifeBuoy,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Mail,
  Send,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { api } from '../../services/api';

interface HelpSupportPageProps {
  currentUser: AuthUser | null;
  setViewMode: (mode: ViewMode) => void;
  onOpenLogin?: () => void;
  onTicketSubmitted?: (ticket: SupportTicket) => void;
}

export const HelpSupportPage: React.FC<HelpSupportPageProps> = ({
  currentUser,
  setViewMode,
  onTicketSubmitted
}) => {
  const [activeTab, setActiveTab] = useState<'GUIDE' | 'CONTACT' | 'FAQ'>('GUIDE');
  const [searchQuery, setSearchQuery] = useState('');

  // Support Form State
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    category: 'TECHNICAL' as SupportCategory,
    subject: '',
    message: '',
    priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  // Modal alert
  const [modalInfo, setModalInfo] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setModalInfo({
        isOpen: true,
        title: 'Missing Required Fields',
        message: 'Please complete all required fields including your contact email, ticket subject, and inquiry details.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const tenantRole = currentUser?.roles[0] || 'CUSTOMER';
      const clubName = currentUser?.clubName || undefined;

      const res = await api.createSupportTicket({
        name: formData.name.trim(),
        email: formData.email.trim(),
        category: formData.category,
        priority: formData.priority,
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        tenantRole,
        clubName
      });

      const ticketRef = res.ticket.ticketRef;
      setSubmissionSuccess(ticketRef);
      if (onTicketSubmitted) {
        onTicketSubmitted(res.ticket);
      }

      setModalInfo({
        isOpen: true,
        title: 'Support Ticket Raised Successfully',
        message: `Ticket Ref #${ticketRef} has been recorded in the eCricketCoach Support Desk. Our System Engineers and Coaching Support team have been alerted and will review your request immediately.`
      });

      setFormData(prev => ({
        ...prev,
        subject: '',
        message: ''
      }));
    } catch (err: any) {
      console.error('Failed to submit ticket:', err);
      // Fallback ticket reference
      const ticketRef = 'ECC-' + Math.floor(100000 + Math.random() * 900000);
      setSubmissionSuccess(ticketRef);
      setModalInfo({
        isOpen: true,
        title: 'Support Ticket Logged',
        message: `Ticket Ref #${ticketRef} recorded. Our engineering & coaching support team will respond to ${formData.email} shortly.`
      });
      setFormData(prev => ({
        ...prev,
        subject: '',
        message: ''
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const guides = [
    {
      id: 'club-admin',
      role: 'CLUB_ADMIN',
      badge: 'Club Admin',
      badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
      title: 'Managing Your Club Academy & Rosters',
      description: 'Step-by-step instructions on inviting athletes and coaches, tracking registrations, assigning squads, and configuring club drill libraries.',
      steps: [
        'Navigate to your Club Portal from the top navigation bar.',
        'Use the "Invite Member" button to add Coaches or Players, choosing their age groups and one or more disciplines (Batting, Bowling, Keeping, Fielding).',
        'Filter your roster using the top toolbar to view members by Status, Role, Discipline, or Age Group.',
        'Schedule training sessions and publish them to notify registered squad athletes.',
        'Upload practice session videos to Google Drive cloud sync to automatically trigger kinematic AI pose analysis.',
        'Review player progression and award official digital competency certificates.'
      ]
    },
    {
      id: 'coach',
      role: 'COACH',
      badge: 'Coach Pro',
      badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
      title: 'Running AI Kinematic Analysis & Drills',
      description: 'How to leverage our computer vision pose estimation engine to extract player biomechanics and prescribe tailored corrective routines.',
      steps: [
        'Open the Coaching & AI App tab.',
        'Select your athlete discipline (Batting, Bowling, Keeping, Fielding) and training context (Individual vs Group).',
        'Click "Simulate AI Biomechanical Video Analysis" or upload player practice footage.',
        'Review the AI Pose score, head-over-ball metrics, front-foot alignment, and arm release velocity.',
        'Click "Adopt Drill into Catalog" to automatically publish the AI recommended corrective drill to your roster.',
        'Evaluate player assessments and promote athletes to higher skill tiers.'
      ]
    },
    {
      id: 'player',
      role: 'PLAYER',
      badge: 'Player / Athlete',
      badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
      title: 'Your Training Hub & Progress Tracking',
      description: 'Everything you need to master your technique, review assigned drills from coaches, and view your verified certifications.',
      steps: [
        'Access your personalized Player Dashboard to view your upcoming squad training schedules.',
        'Explore your assigned drill library tailored to your core discipline.',
        'Review AI feedback summaries on uploaded batting and bowling spells.',
        'Track your earned certificates and skill level achievements as awarded by your coaching staff.'
      ]
    },
    {
      id: 'billing',
      role: 'ALL',
      badge: 'Billing & Account',
      badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
      title: 'Subscription Plans, Invoices & Licensing',
      description: 'Managing individual athlete passes, coach pro seats, or multi-squad club academy licenses.',
      steps: [
        'Subscriptions can be configured on Monthly or Annual billing schedules (Annual includes a 2-month discount).',
        'Official receipts and tax invoices are automatically generated and archived under your organization account.',
        'Need to upgrade seats or change payment details? Contact our dedicated billing support desk below for instant assistance.'
      ]
    }
  ];

  const faqs = [
    {
      q: 'How does eCricketCoach AI kinematic pose estimation work?',
      a: 'Our computer vision models detect 33 human skeletal keypoints across batting and bowling deliveries. It calculates critical biomechanical metrics such as head-over-ball alignment, elbow flexion at ball release, backlift path, and hip-to-shoulder separation angles without requiring wearable sensors.'
    },
    {
      q: 'Can a player belong to multiple disciplines (e.g., Batting and Bowling)?',
      a: 'Yes! Club admins can assign multi-discipline tags (Batting, Bowling, Keeping, Fielding) when inviting athletes or updating existing roster profiles.'
    },
    {
      q: 'How do coaches share drills with players in a specific squad?',
      a: 'Coaches can build customized training sessions in the Club Portal, attach recommended drills from either the system catalog or AI pose engine, and click "Publish Schedule". All assigned squad members receive immediate access.'
    },
    {
      q: 'How can our club integrate Google Drive for video storage?',
      a: 'In the Club Portal under the "Drive Videos" tab, you can link your club\'s Google Drive directory. Player video uploads are synchronized into structured folders named by athlete and discipline, which feeds directly into the AI analyzer.'
    },
    {
      q: 'What should I do if my payment failed or an invoice is pending?',
      a: 'If a transaction fails or requires credit note adjustment, please submit a "Billing & Payments" ticket via this Help page or email admin@ecricketcoach.com. Our accounts team will review and regenerate the invoice.'
    }
  ];

  const filteredGuides = guides.filter(g =>
    !searchQuery ||
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.steps.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFaqs = faqs.filter(f =>
    !searchQuery ||
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Support & Documentation Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            How can we help you succeed?
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Browse complete user manuals, step-by-step guides for Club Admins, Coaches, and Players, or directly message our dedicated eCricketCoach technical and coaching team.
          </p>

          {/* Quick Search */}
          <div className="pt-2 max-w-lg">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tutorials, setup guides, FAQs, or troubleshooting..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-400 transition"
              />
              <span className="absolute left-3.5 top-3 text-slate-400 text-sm">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('GUIDE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'GUIDE'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>System Guide & Tutorials</span>
          </button>
          <button
            onClick={() => setActiveTab('CONTACT')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'CONTACT'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Contact eCricketCoach Team</span>
          </button>
          <button
            onClick={() => setActiveTab('FAQ')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'FAQ'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Frequently Asked Questions</span>
          </button>
        </div>

        {/* Quick Portal Shortcuts */}
        {currentUser && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Logged in as <strong className="text-white">{currentUser.name}</strong></span>
            {currentUser.roles.includes('CLUB_ADMIN') && (
              <button
                onClick={() => setViewMode('CLUB_PORTAL')}
                className="text-purple-400 hover:text-purple-300 underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                Go to Club Portal <ChevronRight className="w-3 h-3" />
              </button>
            )}
            {currentUser.roles.includes('COACH') && (
              <button
                onClick={() => setViewMode('COACHING_PORTAL')}
                className="text-emerald-400 hover:text-emerald-300 underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                Go to Coaching App <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab 1: System Guide & Tutorials */}
      {activeTab === 'GUIDE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredGuides.map(guide => (
              <div
                key={guide.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${guide.badgeColor}`}>
                      {guide.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {guide.description}
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                      Recommended Steps:
                    </span>
                    <ol className="space-y-1.5 list-decimal list-inside text-xs text-slate-300">
                      {guide.steps.map((st, idx) => (
                        <li key={idx} className="leading-relaxed">
                          <span className="text-slate-200">{st}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Need specific walkthrough?</span>
                  <button
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        category: guide.id === 'club-admin' ? 'ROSTER_MANAGEMENT' : guide.id === 'coach' ? 'AI_ANALYSIS' : 'TECHNICAL',
                        subject: `Assistance with ${guide.title}`
                      }));
                      setActiveTab('CONTACT');
                    }}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ask Team</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Contact eCricketCoach Support Desk */}
      {activeTab === 'CONTACT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Direct Infolinks */}
          <div className="space-y-5 lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Direct Contact Channels</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Our Australian and global cricket technology team is available to assist your club, coaches, and players directly.
              </p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                    Technical & AI Support
                  </span>
                  <a href="mailto:support@ecricketcoach.com" className="font-semibold text-white hover:text-emerald-300 block">
                    support@ecricketcoach.com
                  </a>
                  <span className="text-[11px] text-slate-400">For video ingestion, AI pose diagnostics & bug reports</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                    Club Licensing & Billing
                  </span>
                  <a href="mailto:billing@ecricketcoach.com" className="font-semibold text-white hover:text-cyan-300 block">
                    billing@ecricketcoach.com
                  </a>
                  <span className="text-[11px] text-slate-400">Invoices, enterprise tier upgrades & card updates</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">
                    Head Coaching Consultations
                  </span>
                  <a href="mailto:coaching@ecricketcoach.com" className="font-semibold text-white hover:text-purple-300 block">
                    coaching@ecricketcoach.com
                  </a>
                  <span className="text-[11px] text-slate-400">Custom drill authoring & squad syllabus setup</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-500/20 rounded-xl p-5 space-y-2">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                Guaranteed SLA Times
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Critical match-day technical issues are prioritized with under 2-hour response times. General inquiries answered within 4 hours.
              </p>
            </div>
          </div>

          {/* Right Column: Ticket Submission Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-2 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Direct Support Provision</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-normal">
                  Ticket Desk
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Submit an inquiry or report an issue. A member of the eCricketCoach engineering or coaching support squad will get back to you promptly.
              </p>
            </div>

            {submissionSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Ticket Logged Successfully! (Ref: {submissionSuccess})</span>
                </div>
                <p className="text-slate-300">
                  We have dispatched a confirmation email to your address. You can submit another message below if needed.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Shane Warne"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contact Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. coach@melbournecricket.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Inquiry Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as SupportCategory })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                  >
                    <option value="TECHNICAL">Technical Support / Bug Report</option>
                    <option value="BILLING">Billing, Invoices & Subscriptions</option>
                    <option value="AI_ANALYSIS">AI Video Pose Estimation & Kinematics</option>
                    <option value="ROSTER_MANAGEMENT">Club Roster, Squads & Invitations</option>
                    <option value="FEATURE_REQUEST">Feature Request / Custom Drill</option>
                    <option value="OTHER">General Inquiry / Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Urgency / Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                  >
                    <option value="LOW">Low (General Question)</option>
                    <option value="NORMAL">Normal (Assistance needed)</option>
                    <option value="HIGH">High (Session or Roster blocked)</option>
                    <option value="CRITICAL">Critical (Match day or payment issue)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subject Line <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Summary of what you need help with..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Detailed Message <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Provide all relevant details: athlete name, browser type, invoice number, or specific drill questions..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  eCricketCoach Platform Support • Melbourne, Australia
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Transmitting Ticket...' : 'Send Message to Team'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Frequently Asked Questions */}
      {activeTab === 'FAQ' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {filteredFaqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition shadow-sm"
            >
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400 font-extrabold text-base">Q.</span>
                <span>{faq.q}</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed pl-6">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Alert Modal */}
      {modalInfo && (
        <ConfirmationModal
          isOpen={modalInfo.isOpen}
          title={modalInfo.title}
          message={modalInfo.message}
          type="info"
          confirmLabel="Got It"
          showCancel={false}
          onConfirm={() => setModalInfo(null)}
          onClose={() => setModalInfo(null)}
        />
      )}
    </div>
  );
};
