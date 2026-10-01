import React, { useState } from 'react';
import { CustomerTenant } from '../../types';

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
      'Create and save Proprietary Custom Coaching Drills to catalog',
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
    tagline: 'Complete organizational suite for cricket clubs, schools & academies.',
    priceMonthly: 199.99,
    priceAnnual: 1999.99,
    features: [
      'Unlimited coaches, managers, and registered youth/senior players',
      'Multi-squad & age-group management (U11, U13, U15, U19, Seniors)',
      'Club-wide Google Drive video integration & archive',
      'System Admin multi-tenant isolation with custom organizational branding',
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
}

export const HomePage: React.FC<HomePageProps> = ({ onRegisterPlan, onExploreDemo }) => {
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<PlanConfig | null>(null);

  // Modal payment form state
  const [subscriberName, setSubscriberName] = useState('');
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

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
      alert('Please complete all required fields.');
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

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          The Next-Generation AI Cricket Training & Academy Operating System
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Master Modern Cricket With{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            AI Pose Biomechanics
          </span>{' '}
          & Multi-Tenant Coaching
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto">
          eCricketCoach bridges grassroot academies, elite coaches, and aspiring players into a single cohesive ecosystem.
          Upload practice videos for instant kinematic computer vision feedback, assign curated technical drills, organize age-group squads, and track player promotions with certified digital credentials.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <a
            href="#pricing"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition flex items-center gap-2"
          >
            <span>View Subscription Plans</span>
            <span>↓</span>
          </a>
          <button
            onClick={onExploreDemo}
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2"
          >
            <span>🚀 Explore Live App Demo</span>
          </button>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl">
              📹
            </div>
            <h3 className="text-lg font-bold text-white">AI Kinematic Pose Estimation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload batting cover drives, pace run-ups, or spin releases. Our AI biomechanics engine tracks elbow extension, hip-shoulder separation, head balance, and release angles in milliseconds.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-emerald-400 font-semibold">
            Google Drive & Cloud Video Sync Enabled →
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl">
              🎯
            </div>
            <h3 className="text-lg font-bold text-white">Dual Drill Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Access official pre-defined training drills curated by certified master coaches, or design proprietary club-custom drills tailored to your academy’s specific match strategies.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-purple-300 font-semibold">
            Individual Solo & Group Squad Contexts →
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-2xl">
              🏆
            </div>
            <h3 className="text-lg font-bold text-white">Stage Progression & Certs</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Advance players from Foundation to Elite through structured milestones. Generate verifiable, downloadable progression certificates signed by coaches with AI technique commendations.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-cyan-300 font-semibold">
            Verifiable Digital Achievement Badges →
          </div>
        </div>
      </section>

      {/* Pricing & Subscriptions Section */}
      <section id="pricing" className="space-y-8 px-4 scroll-mt-24">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-white">Transparent, Tiered Subscriptions</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Select the subscription that matches your cricket journey. Upon payment, your account is immediately queued for activation with automated notification dispatched to our system administration.
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
                className={`relative rounded-2xl p-7 flex flex-col justify-between transition duration-200 ${
                  plan.highlighted
                    ? 'bg-slate-900 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10'
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
                      <span className="text-4xl font-extrabold text-white">${price.toFixed(2)}</span>
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
                          <span className="text-emerald-400 font-bold mt-0.5">✓</span>
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
                        <span className="text-cyan-400 text-xs">◆</span> {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => handleOpenPayment(plan)}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
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

      {/* About Us Section */}
      <section id="about-us" className="space-y-6 px-4 scroll-mt-24 max-w-5xl mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
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
              <span className="text-purple-400">🌐</span> Enterprise Multi-Tenancy for Grassroots to Pro
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Whether you are an individual cricketer training in your backyard, a freelance coach guiding 20 students across weekend clinics, or a major cricket academy directing multiple junior and senior squads, our isolated tenant architecture ensures private drills, video archives, and progress records remain secure.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-center">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <p className="text-2xl font-extrabold text-emerald-400">99.4%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pose Landmark Precision</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <p className="text-2xl font-extrabold text-teal-400">250+</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pre-defined Tech Drills</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <p className="text-2xl font-extrabold text-cyan-400">4 Tiers</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Foundation to Elite</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <p className="text-2xl font-extrabold text-purple-400">24 / 7</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Admin & Cloud Video Access</p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQs) Section */}
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
              <span className="text-cyan-400 text-xs">● MP4 / MOV / Cloud</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              You can record videos using standard smartphone cameras (60fps or 120fps recommended). For batting drives, side-on (square leg) or front-on angles work best. For pace bowling, side-on delivery stride and front-on release corridor angles provide optimal kinematic accuracy.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Can coaches create proprietary drills that are hidden from other clubs?</span>
              <span className="text-purple-400 text-xs">● Multi-Tenant Isolation</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Yes! eCricketCoach supports dual drill catalogs. Official pre-defined drills are shared globally, but any drill created by your coaching staff under the Club Portal is scoped solely to your club ID.
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

      {/* Contact Us Section */}
      <section id="contact-us" className="space-y-6 px-4 scroll-mt-24 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold">
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
            <p className="text-xs text-slate-400">admin@ecricketcoach.com</p>
            <p className="text-[11px] text-slate-500">Response within 4 hours</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto text-lg">
              🏢
            </div>
            <h4 className="text-sm font-bold text-white">Academy Sales</h4>
            <p className="text-xs text-slate-400">sales@ecricketcoach.com</p>
            <p className="text-[11px] text-slate-500">Custom enterprise quoting</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto text-lg">
              🌐
            </div>
            <h4 className="text-sm font-bold text-white">Global Headquarters</h4>
            <p className="text-xs text-slate-400">Melbourne Cricket Ground Precinct</p>
            <p className="text-[11px] text-slate-500">Melbourne, VIC, Australia</p>
          </div>
        </div>
      </section>

      {/* Payment & Registration Modal */}
      {selectedPlanForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={handleClosePayment}
              disabled={isProcessing}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg disabled:opacity-40"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <h3 className="text-lg font-bold text-white">Subscribe to {selectedPlanForPayment.name}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Amount:{' '}
                <span className="font-bold text-emerald-400">
                  ${(billingCycle === 'MONTHLY' ? selectedPlanForPayment.priceMonthly : selectedPlanForPayment.priceAnnual).toFixed(2)}
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
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {selectedPlanForPayment.type === 'CLUB' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Club or Academy Organization Name *</label>
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
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <span className="animate-spin text-sm">↻</span>
                        <span>Authorizing Payment...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay ${(billingCycle === 'MONTHLY' ? selectedPlanForPayment.priceMonthly : selectedPlanForPayment.priceAnnual).toFixed(2)} & Register</span>
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
    </div>
  );
};
