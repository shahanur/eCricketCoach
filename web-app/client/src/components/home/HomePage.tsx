import React, { useEffect, useState } from 'react';
import { CustomerTenant } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { PublicSite, PublicPage } from './PublicSite';
import {
  Layers,
  Cpu,
  ShieldCheck,
  Users,
  ChevronRight,
  ArrowRight,
  Check,
  Sparkles,
  BookOpen,
  Clock,
  TrendingUp,
  Target,
  Zap
} from 'lucide-react';

export interface PlanConfig {
  id: 'INDIVIDUAL' | 'COACH_PRO' | 'CLUB_ACADEMY';
  type: CustomerTenant['type'];
  name: string;
  tagline: string;
  priceMonthly: number;
  priceAnnual: number;
  highlighted?: boolean;
  features: string[];
  deliverables: string[];
  ctaLabel: string;
  badge?: string;
}

interface CoreService {
  id: string;
  number: number;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  highlights: string[];
  capabilities: { title: string; desc: string }[];
  metrics: { value: string; label: string };
}

const CORE_SERVICES: CoreService[] = [
  {
    id: 'ai-biomechanics',
    number: 1,
    name: 'AI Video Biomechanical Analysis',
    tagline: 'Instant technique breakdown from standard smartphone video',
    description: 'Upload short net clips of batting drives, pace run-ups, spin releases, or glovework. Computer vision tracks 33 anatomical keypoints to identify biomechanical faults and provide actionable coaching cues.',
    badge: 'COMPUTER VISION',
    highlights: ['Bowling Arm Flexion (15° ICC Rule)', 'Head Position Over Impact Line', 'Hip-Torso Separation Velocity', 'Weight Transfer & Follow-Through'],
    capabilities: [
      { title: 'Bowling Action Integrity', desc: 'Monitors elbow extension throughout delivery stride to flag hyperextension or throwing tendencies early.' },
      { title: 'Batting Balance Scoring', desc: 'Measures head balance and front-foot commitment at the point of impact on drives and defensive strokes.' },
      { title: 'Automatic Remediation Cues', desc: 'Identifies technical variances and pairs each observation with targeted corrective practice drills.' }
    ],
    metrics: { value: '< 2s', label: 'Analysis Turnaround Time' }
  },
  {
    id: 'drill-catalogue',
    number: 2,
    name: 'Curated Drills & Practice Planning',
    tagline: '250+ verified drills for solo training and squad sessions',
    description: 'A comprehensive cricket curriculum spanning Batting, Fast Bowling, Spin, Wicketkeeping, and Fielding. Coaches can also author and save proprietary custom drills private to their academy.',
    badge: 'CURRICULUM',
    highlights: ['Solo Practice & Group Circuits', 'Equipment & Cone Setup Cues', 'Progression Difficulty Tiers', 'Proprietary Club Drill Creator'],
    capabilities: [
      { title: 'Full-Discipline Coverage', desc: 'Structured drills covering defensive fundamentals, power-hitting, seam presentation, spin flight, and direct-hit relays.' },
      { title: 'Multi-Tenant Isolation', desc: 'Drills authored by club coaches remain private and encrypted within their club academy workspace.' },
      { title: 'Context-Adaptive Ratios', desc: 'Drills automatically scale repetitions, partner feeds, and rotation rules for 1-on-1 nets or full squad practices.' }
    ],
    metrics: { value: '250+', label: 'Pre-Defined Technical Drills' }
  },
  {
    id: 'club-squads',
    number: 3,
    name: 'Club & Squad Roster Management',
    tagline: 'Multi-squad organisation from Under-9 to Senior cricket',
    description: 'Purpose-built operations for cricket academies and clubs. Invite coaches and players via email, organise squads by age group and discipline, and publish date-specific training session plans.',
    badge: 'ACADEMY HUB',
    highlights: ['U9 to Senior Age Brackets', '1-Click Email Roster Invites', 'Session Schedule Publishing', 'Consolidated Club Billing'],
    capabilities: [
      { title: 'Squad Delegation', desc: 'Organise players into developmental groups (e.g., U15 Pace Unit, Senior Top-Order) with assigned head coaches.' },
      { title: 'Frictionless Member Invites', desc: 'Send roster invitations with auto-acceptance links for coaches, parents, and youth players.' },
      { title: 'Session Schedule Alerts', desc: 'Publish planned training sessions so squad athletes receive instant notifications with required drill itineraries.' }
    ],
    metrics: { value: '100%', label: 'Club Tenancy Isolation' }
  },
  {
    id: 'progression-certs',
    number: 4,
    name: 'Player Progression & Digital Certificates',
    tagline: 'Structured 5-tier milestones from Foundation to Elite',
    description: 'Clear, transparent skill pathways. Coaches evaluate players against milestone rubrics, approve stage promotions, and generate official verifiable achievement certificates.',
    badge: 'PROGRESSION',
    highlights: ['Foundation to Elite Levels', 'Milestone Competency Gates', 'Coach & AI Technique Commendations', 'Verifiable Certificate IDs'],
    capabilities: [
      { title: 'Milestone Assessment Gates', desc: 'Evaluate specific technical criteria (crease balance, seam presentation, glovework) before unlocking promotions.' },
      { title: 'Automated Certificate Generator', desc: 'Generate branded, downloadable certificates detailing achieved levels, coach commendations, and verification numbers.' },
      { title: 'Long-Term Player History', desc: 'Permanent skill development timeline documenting each player’s journey across seasons and age groups.' }
    ],
    metrics: { value: '5 Stages', label: 'Foundation → Developing → Intermediate → Advanced → Elite' }
  }
];

const PLANS: PlanConfig[] = [
  {
    id: 'INDIVIDUAL',
    type: 'INDIVIDUAL',
    name: 'Individual Player',
    tagline: 'Ideal for aspiring youth, club cricketers & passionate players.',
    priceMonthly: 14.99,
    priceAnnual: 149.99,
    features: [
      'Tailored personalized batting, bowling, keeping & fielding roadmap',
      'AI Biomechanical Video Pose Estimation & Kinematic feedback',
      '5 AI Video Action Uploads / Month with Google Drive cloud sync',
      'Solo Practice Mode & self-guided technical drills',
      'Digital Certificate of Progression upon skill stage milestones'
    ],
    deliverables: [
      '1 Player Profile & Performance Dashboard',
      'Mobile-Friendly Video Biomechanics Uploader',
      'AI Kinematic Posture & Balance Scorecard'
    ],
    ctaLabel: 'Register as Player'
  },
  {
    id: 'COACH_PRO',
    type: 'COACH',
    name: 'Coach Pro',
    tagline: 'For private cricket coaches, freelance trainers & net clinic instructors.',
    priceMonthly: 49.99,
    priceAnnual: 499.99,
    highlighted: true,
    badge: 'MOST POPULAR',
    features: [
      'Manage up to 25 active players with dedicated profiles',
      'Individual & Group drill planning and scheduling',
      'Create and save Proprietary Custom Coaching Drills to catalogue',
      'Post-session coach observation logging with automated AI drill top-ups',
      'Player Stage Evaluations & 1-Click Progression Certificate Generator'
    ],
    deliverables: [
      'Coach Command Console with multi-player switcher',
      'Access to Official Pre-defined + Custom Drill libraries',
      'Unlimited session scheduling and publish alerts'
    ],
    ctaLabel: 'Register as Coach'
  },
  {
    id: 'CLUB_ACADEMY',
    type: 'CLUB',
    name: 'Club / Academy',
    tagline: 'Complete organisational suite for cricket clubs, schools & academies.',
    priceMonthly: 199.99,
    priceAnnual: 1999.99,
    features: [
      'Unlimited coaches, managers, and registered youth/senior players',
      'Multi-squad & age-group management (U11, U13, U15, U19, Seniors)',
      'Club-wide Google Drive video integration & archive',
      'System Admin multi-tenant isolation with custom organisational branding',
      'Consolidated academy billing, invoice history & audit reports'
    ],
    deliverables: [
      'Club Administrator Operations Portal',
      'Instant Email Roster Invitations & Auto-Acceptance Links',
      'Academy-wide Progression and Tournament Readiness Analytics'
    ],
    ctaLabel: 'Register Club / Academy'
  }
];

interface HomePageProps {
  onRegisterPlan: (registrationData: {
    plan: PlanConfig;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    name: string;
    email: string;
    organizationName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
  }) => void;
  onExploreDemo: () => void;
  onOpenHelp: () => void;
  publicPage: PublicPage;
  onNavigatePublic: (page: PublicPage) => void;
  socialRegistration?: { token: string; name: string; email: string } | null;
}

export const HomePage: React.FC<HomePageProps> = ({ onRegisterPlan, onExploreDemo, onOpenHelp, publicPage, onNavigatePublic, socialRegistration }) => {
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<PlanConfig | null>(null);
  const [activeServiceIndex, setActiveServiceIndex] = useState<number>(0);

  // Modal payment form state
  const [subscriberName, setSubscriberName] = useState('');
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [homeModal, setHomeModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type?: ConfirmationType;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!socialRegistration) return;
    setSubscriberName(socialRegistration.name);
    setSubscriberEmail(socialRegistration.email);
  }, [socialRegistration]);

  const handleOpenPayment = (plan: PlanConfig) => {
    setSelectedPlanForPayment(plan);
    setPaymentSuccessMessage(null);
  };

  const handleClosePayment = () => {
    if (isProcessing) return;
    setSelectedPlanForPayment(null);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForPayment) return;
    if (!subscriberName || !subscriberEmail) {
      setHomeModal({
        isOpen: true,
        title: 'Missing Required Information',
        message: 'Please complete all required fields (Full Name and Email Address) before proceeding.',
        type: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setHomeModal(null)
      });
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      const data = {
        plan: selectedPlanForPayment,
        billingCycle,
        name: subscriberName,
        email: subscriberEmail,
        organizationName: organizationName || (selectedPlanForPayment.type === 'CLUB' ? subscriberName + ' Cricket Club' : subscriberName),
        cardNumber: cardNumber || '•••• •••• •••• 4242',
        expiry: cardExpiry || '12/28',
        cvc: cardCvc || '123'
        , registrationToken: socialRegistration?.token
      };

      onRegisterPlan(data);

      setPaymentSuccessMessage(
        `Payment successful! An automated confirmation email was sent to ${subscriberEmail}. A notification email has been dispatched to the System Admin, and your registration has been placed in the Admin Approval Queue.`
      );

      // Reset form
      setSubscriberName('');
      setSubscriberEmail('');
      setOrganizationName('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
    }, 1200);
  };

  const currentService = CORE_SERVICES[activeServiceIndex];

  return (
    <PublicSite onSignIn={onExploreDemo} onOpenHelp={onOpenHelp} page={publicPage} onNavigate={onNavigatePublic}>
    <div className="public-legacy">
      {/* 1. Hero Section: Focused directly on Cricket Coaching & Player Progression */}
      <section className="text-center space-y-6 max-w-5xl mx-auto px-4 pt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide shadow-sm">
          <Sparkles size={14} className="text-emerald-400 animate-pulse" />
          <span>Cricket Coaching, Skill Progression & AI Biomechanics Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
          Master modern cricket with{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
            AI video biomechanics
          </span>{' '}
          and structured coaching.
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto">
          eCricketCoach connects individual players, private coaches, and cricket academies in one cohesive platform. Upload net practice videos for automated technique feedback, assign verified drills, manage age-group squads, and track certified player progression from Foundation to Elite.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a
            href={window.location.pathname}
            onClick={event => { event.preventDefault(); onNavigatePublic('pricing'); }}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition flex items-center gap-2 cursor-pointer"
          >
            <span>View Subscription Plans</span>
            <ArrowRight size={16} />
          </a>
          <button
            onClick={onExploreDemo}
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Zap size={16} className="text-amber-400" />
            <span>Explore Interactive Portal Demo</span>
          </button>
        </div>
      </section>

      {/* 2. Real Cricket Performance Metrics & Academy Marquee */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="space-y-2 md:pr-6 pt-4 md:pt-0">
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <span className="text-4xl sm:text-5xl font-black text-emerald-400">99.4%</span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300/80">accuracy</span>
              </div>
              <h4 className="text-sm font-bold text-white">Pose Landmark Precision</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tracks 33 anatomical keypoints across bowling delivery stride, batting impact, and keeping stances with zero physical sensors required.
              </p>
            </div>

            <div className="space-y-2 md:px-6 pt-6 md:pt-0">
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <span className="text-4xl sm:text-5xl font-black text-sky-400">250+</span>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300/80">drills</span>
              </div>
              <h4 className="text-sm font-bold text-white">Curated Coaching Drills</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verified practice routines spanning Batting, Fast Bowling, Spin, Wicketkeeping, and Fielding—plus proprietary custom academy drills.
              </p>
            </div>

            <div className="space-y-2 md:pl-6 pt-6 md:pt-0">
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <span className="text-4xl sm:text-5xl font-black text-sky-400">5 Tiers</span>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300/80">pathway</span>
              </div>
              <h4 className="text-sm font-bold text-white">Certified Skill Progression</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Milestone-based advancement from Foundation (Level 1) to Elite (Level 5) with verifiable digital achievement certificates.
              </p>
            </div>
          </div>

          {/* Trusted Academy Marquee */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
              Trusted by coaching clinics, school academies & club teams:
            </span>
            <div className="flex flex-wrap items-center gap-6 font-semibold text-slate-300">
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Marylebone Cricket Club Academy</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-sky-400" /> Surrey County Cricket Academy</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-sky-400" /> Yorkshire Strikers CC</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-sky-400" /> Lord&apos;s Colts Cricket Club</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Product Services Explorer */}
      <section className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold">
            <Layers size={14} /> Core Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Everything you need to run, coach, and train cricket.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            From video capture in the nets to squad practice schedules and certified player milestones, explore the four core pillars powering eCricketCoach.
          </p>
        </div>

        {/* Interactive Service Explorer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Core Services Navigation */}
          <div className="lg:col-span-5 space-y-2.5">
            {CORE_SERVICES.map((service, idx) => {
              const isSelected = activeServiceIndex === idx;
              return (
                <button
                  key={service.id}
                  onClick={() => setActiveServiceIndex(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition duration-150 flex items-center justify-between group cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10 text-white'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
                      }`}
                    >
                      {service.number}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold tracking-tight">{service.name}</h4>
                      <p className="text-[11px] text-slate-400">{service.tagline}</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`transition shrink-0 ${isSelected ? 'text-emerald-400 translate-x-1' : 'text-slate-600'}`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Column: Active Service Detail Card */}
          <div className="lg:col-span-7 rounded-3xl bg-slate-900 border border-slate-800 p-7 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                {currentService.badge} • FEATURE {currentService.number} OF 4
              </span>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-400">{currentService.metrics.value}</span>
                <span className="text-[11px] text-slate-400 ml-1.5">{currentService.metrics.label}</span>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black text-white">{currentService.name}</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{currentService.description}</p>
            </div>

            {/* Capability Deep-Dives */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Key Capabilities:</p>
              <div className="grid grid-cols-1 gap-2.5">
                {currentService.capabilities.map((cap, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="text-emerald-400 text-sm">◆</span> {cap.title}
                    </h5>
                    <p className="text-[11px] text-slate-400 leading-relaxed pl-3.5">{cap.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Highlights pill tags */}
            <div className="pt-2 flex flex-wrap gap-2">
              {currentService.highlights.map((h, i) => (
                <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                  ✓ {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Performance, Economics, and Simplicity (The 4 Pillar Grid) */}
      <section className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-white">
            Performance, economics, and simplicity — together.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Engineered so individual players improve technical fundamentals, private coaches multiply their client roster, and clubs govern hundreds of players without operational friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Performance Proven in the Nets</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sub-second pose estimation transforms standard smartphone video into 33 keypoint landmark tracking. Measure elbow extension compliance, hip-shoulder separation, head balance, and crease arrival vectors with zero hardware sensors required.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-sky-500/40 transition">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Target size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Coaching Curricula You Already Trust</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Over 250+ pre-defined drills aligned with international cricket coaching pathways across batting, fast bowling, spin, wicketkeeping, and fielding. Or create and save proprietary club-custom drills isolated securely to your academy.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-sky-500/40 transition">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Users size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Built for How Academies Scale</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              One unified operations dashboard. Send 1-click email invitations to coaches and players, organise age-group squads (U11, U13, U15, U19, Seniors), schedule training sessions, and issue verified digital progression certificates in seconds.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-sky-500/40 transition">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Economics that Compound as You Grow</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Transparent, flat-rate tiers with generous active member allocations and 17% annual discounts. No surprise video upload surcharges, no per-query fees, and seamless self-serve upgrades through federated social authentication.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Pricing & Subscriptions Section */}
      <section id="pricing" className="space-y-8 px-4 scroll-mt-24 max-w-6xl mx-auto">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Transparent, Tiered Subscriptions</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Select the subscription that matches your cricket journey. Upon payment, your account is queued for immediate activation with automated notification dispatched to our system administration.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center rounded-xl bg-slate-900 p-1 border border-slate-800 mt-2">
            <button
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                billingCycle === 'MONTHLY' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                billingCycle === 'ANNUAL' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-extrabold">Save ~17%</span>
            </button>
          </div>
        </div>

        {/* 3 Subscription Plan Boxes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {PLANS.map(plan => {
            const price = billingCycle === 'MONTHLY' ? plan.priceMonthly : plan.priceAnnual;
            const periodText = billingCycle === 'MONTHLY' ? '/ month' : '/ year';

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-7 flex flex-col justify-between transition duration-200 ${
                  plan.highlighted
                    ? 'bg-slate-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/10'
                    : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold tracking-wide uppercase shadow">
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.tagline}</p>
                  </div>

                  <div className="pt-2 pb-4 border-b border-slate-800">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-white">£{price.toFixed(2)}</span>
                      <span className="text-xs text-slate-400 font-medium">{periodText}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {billingCycle === 'ANNUAL' ? 'Billed annually with instant activation' : 'Billed monthly, cancel anytime'}
                    </p>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">What do you get:</p>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check size={14} className="text-emerald-400 font-bold mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Included Deliverables */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Included In Plan:</p>
                    {plan.deliverables.map((item, idx) => (
                      <p key={idx} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                        <span className="text-sky-400 text-xs">◆</span> {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => handleOpenPayment(plan)}
                    className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
                      plan.highlighted
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {plan.ctaLabel} →
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-2">
                    Instant checkout • System Admin approval workflow
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Technical Insights & Coaching Science Resources */}
      <section className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-1">
              <BookOpen size={14} /> Knowledge & Coaching Guides
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Cricket Coaching Science & Training Deep Dives</h2>
          </div>
          <a href={window.location.pathname} onClick={event => { event.preventDefault(); onNavigatePublic('about-us'); }} className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1">
            <span>Explore academy mission</span>
            <ArrowRight size={14} />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between hover:border-slate-700 transition">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Coaching Science
              </span>
              <h4 className="text-sm font-bold text-white leading-snug">
                Kinematic Elbow Angle Thresholds: Measuring Bowling Action Legality at 60fps
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                How our computer vision pipeline calculates the 15-degree ICC elbow extension limit from side-on net video without wearable sensors.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Clock size={12} /> 7 min read</span>
              <span className="text-emerald-400 font-semibold">Technical Guide →</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between hover:border-slate-700 transition">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                Academy Architecture
              </span>
              <h4 className="text-sm font-bold text-white leading-snug">
                Multi-Tenant Video Isolation & Google Drive Integration for Clubs
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                How academy rosters, practice sessions, and player video archives are partitioned with PostgreSQL multi-tenancy and encrypted Google Drive sync.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Clock size={12} /> 5 min read</span>
              <span className="text-sky-400 font-semibold">Architecture Spec →</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between hover:border-slate-700 transition">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                Curriculum Design
              </span>
              <h4 className="text-sm font-bold text-white leading-snug">
                Structuring U11 to Senior Training Circuits: Pairing Drills with AI Feedback
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Step-by-step methodology for setting up net circuits where players rotate between technical solo drills and coach AI video stations.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Clock size={12} /> 6 min read</span>
              <span className="text-sky-400 font-semibold">Curriculum Guide →</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Final Call to Action Banner (DigitalOcean "Start Building Today" Pattern) */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-sky-950/80 border border-emerald-500/30 p-10 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Start modernizing your cricket training today.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Join elite academies, certified coaches, and dedicated players. Get instant access to AI kinematic pose analysis, 250+ technical drills, and certified milestone progression.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a
              href={window.location.pathname}
              onClick={event => { event.preventDefault(); onNavigatePublic('pricing'); }}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition flex items-center gap-2"
            >
              <span>Choose Your Subscription</span>
              <ArrowRight size={16} />
            </a>
            <button
              onClick={onExploreDemo}
              className="px-8 py-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-700 text-white font-bold text-sm transition flex items-center gap-2"
            >
              <span>🚀 Launch Interactive Demo</span>
            </button>
          </div>
        </div>
      </section>

      {/* 8. About Us Section */}
      <section id="about-us" className="space-y-6 px-4 scroll-mt-24 max-w-5xl mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold">
            <span>🏏</span> Our Mission & Heritage
          </div>
          <h2 className="text-3xl font-extrabold text-white">About eCricketCoach</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            Democratizing world-class cricket coaching science with cutting-edge computer vision, multi-tenant academy architecture, and certified stage pathways.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">⚡</span> Computer Vision Meets Cricket Biomechanics
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Traditional cricket coaching relies on subjective observations in the nets. eCricketCoach leverages state-of-the-art pose estimation to calculate real kinematic markers: elbow extension thresholds during bowling actions, head alignment over the ball at the point of front-foot impact, and hip-torso rotation velocities.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-sky-400">🌐</span> Enterprise Multi-Tenancy for Grassroots to Pro
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Whether you are an individual cricketer training in your backyard, a freelance coach guiding 20 students across weekend clinics, or a major cricket academy directing multiple junior and senior squads, our isolated tenant architecture ensures private drills, video archives, and progress records remain secure.
            </p>
          </div>
        </div>
      </section>

      {/* 9. Frequently Asked Questions (FAQs) Section */}
      <section id="faqs" className="space-y-6 px-4 scroll-mt-24 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <span>❓</span> Got Questions?
          </div>
          <h2 className="text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Find immediate answers regarding plan activations, video uploads, AI pose estimation, and academy billing.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center justify-between">
              <span>How does the System Admin Approval process work after payment?</span>
              <span className="text-emerald-400 text-xs">● Instant Email</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Once you submit your payment via the registration form, our billing service processes the transaction and immediately dispatches an automated notification email to the System Administrator. The application enters the Super-Admin approval queue with payment confirmation. Once verified, onboarding credentials and portal access tokens are emailed directly to you.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center justify-between">
              <span>What video formats and angles are supported for AI Pose Estimation?</span>
              <span className="text-sky-400 text-xs">● MP4 / MOV / Cloud</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              You can record videos using standard smartphone cameras (60fps or 120fps recommended). For batting drives, side-on (square leg) or front-on angles work best. For pace bowling, side-on delivery stride and front-on release corridor angles provide optimal kinematic accuracy.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Can coaches create proprietary drills that are hidden from other clubs?</span>
              <span className="text-sky-400 text-xs">● Multi-Tenant Isolation</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Yes! eCricketCoach supports dual drill catalogues. Official pre-defined drills are shared globally, but any drill created by your coaching staff under the Club Portal is scoped solely to your club ID.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Can I switch from Monthly to Annual billing later?</span>
              <span className="text-amber-400 text-xs">● Flexible Upgrades</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Yes, you can upgrade your plan or change billing frequency at any time from your tenant dashboard or by contacting the system administrator with prorated credit.
            </p>
          </div>
        </div>
      </section>

      {/* 10. Contact Us Section */}
      <section id="contact-us" className="space-y-6 px-4 scroll-mt-24 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-semibold">
            <span>💬</span> Get in Touch
          </div>
          <h2 className="text-3xl font-extrabold text-white">Contact Our Team</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Have questions about club rollouts, custom academy integrations, or coach partnerships? Reach out to our technical coaching team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-lg">
              📧
            </div>
            <h4 className="text-sm font-bold text-white">Email Support</h4>
            <a className="text-xs text-slate-400" href="mailto:admin@ecricketcoach.com">admin@ecricketcoach.com</a>
            <p className="text-[11px] text-slate-500">Response within 4 hours</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto text-lg">
              🏢
            </div>
            <h4 className="text-sm font-bold text-white">Academy Sales</h4>
            <a className="text-xs text-slate-400" href="mailto:sales@ecricketcoach.com">sales@ecricketcoach.com</a>
            <p className="text-[11px] text-slate-500">Custom enterprise quoting</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto text-lg">
              🌐
            </div>
            <h4 className="text-sm font-bold text-white">Global Headquarters</h4>
            <p className="text-xs text-slate-400">Lord's Cricket Ground Precinct, St John's Wood</p>
            <p className="text-[11px] text-slate-500">London NW8 8QN, United Kingdom</p>
          </div>
        </div>
      </section>

      {/* Payment & Registration Modal */}
      {selectedPlanForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={handleClosePayment}
              disabled={isProcessing}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg disabled:opacity-40 cursor-pointer p-1"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <h3 className="text-base sm:text-lg font-bold text-white">Subscribe to {selectedPlanForPayment.name}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Amount:{' '}
                <span className="font-bold text-emerald-400">
                  £{(billingCycle === 'MONTHLY' ? selectedPlanForPayment.priceMonthly : selectedPlanForPayment.priceAnnual).toFixed(2)}
                </span>{' '}
                ({billingCycle.toLowerCase()})
              </p>
            </div>

            {paymentSuccessMessage ? (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed flex items-start gap-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="font-bold text-white mb-1">Registration & Payment Confirmed!</p>
                    <p>{paymentSuccessMessage}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSelectedPlanForPayment(null);
                      onExploreDemo();
                    }}
                    className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    Go to Portal & View Queue →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Full Name / Primary Contact *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Dravid"
                      value={subscriberName}
                      onChange={e => setSubscriberName(e.target.value)}
                      readOnly={Boolean(socialRegistration)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Email Address (For receipt & notifications) *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@cricketacademy.org"
                      value={subscriberEmail}
                      onChange={e => setSubscriberEmail(e.target.value)}
                      readOnly={Boolean(socialRegistration)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    {socialRegistration && <p className="mt-1 text-[10px] text-emerald-400">Verified by social sign-in</p>}
                  </div>

                  {selectedPlanForPayment.type === 'CLUB' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Club or Academy Organisation Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bangalore Strikers Cricket Academy"
                        value={organizationName}
                        onChange={e => setOrganizationName(e.target.value)}
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  {/* Payment Card Details */}
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Payment Method (Card)</p>
                    <div>
                      <label className="text-[10px] text-slate-400">Card Number</label>
                      <input
                        type="text"
                        required
                        placeholder="4242 •••• •••• 4242"
                        value={cardNumber}
                        onChange={e => setCardNumber(e.target.value)}
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400">Expiry (MM/YY)</label>
                        <input
                          type="text"
                          required
                          placeholder="12/28"
                          value={cardExpiry}
                          onChange={e => setCardExpiry(e.target.value)}
                          className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">CVC</label>
                        <input
                          type="password"
                          required
                          maxLength={4}
                          placeholder="•••"
                          value={cardCvc}
                          onChange={e => setCardCvc(e.target.value)}
                          className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">🔒</span>
                  <span>
                    Secured by 256-bit encryption. System Admin will immediately receive a registration notification email and an approval item in the Super-Admin panel.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClosePayment}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <span className="animate-spin text-sm">↻</span>
                        <span>Authorizing Payment...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay £{(billingCycle === 'MONTHLY' ? selectedPlanForPayment.priceMonthly : selectedPlanForPayment.priceAnnual).toFixed(2)} & Register</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirmation & Info Modal */}
      {homeModal && (
        <ConfirmationModal
          isOpen={homeModal.isOpen}
          title={homeModal.title}
          message={homeModal.message}
          type={homeModal.type}
          confirmLabel={homeModal.confirmLabel}
          onConfirm={homeModal.onConfirm}
          onClose={() => setHomeModal(null)}
        />
      )}
    </div>
    </PublicSite>
  );
};
