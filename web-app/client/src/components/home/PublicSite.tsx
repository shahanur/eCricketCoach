import React, { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Check, ClipboardList, CircleDot, Menu, Play, UserRound, Users, Video, X } from 'lucide-react';
import './public-site.css';

export const PUBLIC_PAGES = ['home', 'features', 'pricing', 'about-us', 'contact-us', 'faqs'] as const;
export type PublicPage = typeof PUBLIC_PAGES[number];

const photos = {
  hero: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=2000&q=85',
  video: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1200&q=85',
  training: 'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?auto=format&fit=crop&w=1000&q=85',
  performance: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=85',
  club: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1000&q=85'
};

const features = [
  { title: 'Video Analysis', icon: Video, photo: photos.video, audience: 'Players & Coaches', headline: 'See every detail. Improve your technique.', description: 'Upload match footage or training clips for AI-assisted technique feedback. Turn observations into practical coaching cues and targeted drills for your next session.', points: ['Upload batting, bowling and fielding clips', 'AI-assisted biomechanical feedback', 'Share coaching insights with players', 'Access your workspace on mobile, tablet and desktop'] },
  { title: 'Training Plans', icon: ClipboardList, photo: photos.training, audience: 'Players & Coaches', headline: 'Structured programmes. Measurable progress.', description: 'Explore cricket-specific drills and shared training templates, or build a session tailored to your squad. From setup instructions to safety guidance, keep every practice purposeful.', points: ['Drills for batting, bowling, keeping and fielding', 'Coach-built sessions for players and squads', 'Global catalogue and editable club drill copies', 'Session execution and completion tracking'] },
  { title: 'Performance Tracking', icon: BarChart3, photo: photos.performance, audience: 'Players, Coaches & Clubs', headline: 'Know your progress. Own your development.', description: 'Keep player assessments and coaching reviews together. Follow skill development from Foundation to Elite, identify the next steps and celebrate achievements along the way.', points: ['Player assessments and coaching notes', 'Post-session reviews and corrective drills', 'Foundation-to-Elite progression pathways', 'Verifiable achievement certificates'] },
  { title: 'Club Management', icon: Users, photo: photos.club, audience: 'Clubs & Coaches', headline: 'Run your club. Develop your players.', description: 'Give your club a central hub for squads, session scheduling and player development. Assign coaches, publish training plans and bring your academy operations together.', points: ['Multi-team roster and squad management', 'Training schedules and player notifications', 'Assign coaches to squads and players', 'Club drill libraries and shared templates'] }
];

interface PublicSiteProps {
  children: React.ReactNode;
  onSignIn: () => void;
  onOpenHelp: () => void;
  page: PublicPage;
  onNavigate: (page: PublicPage) => void;
}

export function PublicSite({ children, onSignIn, onOpenHelp, page, onNavigate }: PublicSiteProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const navigate = (next: PublicPage) => {
    setMenuOpen(false);
    if (page === next) window.scrollTo({ top: 0, behavior: 'smooth' });
    onNavigate(next);
  };
  const cta = (label = 'Get Started') => <button className="public-button" onClick={() => navigate('pricing')}>{label}<ArrowRight size={18} /></button>;
  const brand = <span className="public-brand"><CircleDot aria-hidden="true" /> eCricketCoach</span>;

  return (
    <div className="public-site" data-public-page={page}>
      <header className={`public-header ${page === 'home' ? 'public-header-hero' : ''}`}>
        <button onClick={() => navigate('home')} aria-label="eCricketCoach home">{brand}</button>
        <nav aria-label="Public navigation" className={menuOpen ? 'public-nav public-nav-open' : 'public-nav'}>
          {(['features', 'pricing', 'about-us', 'contact-us'] as const).map(next => (
            <button key={next} onClick={() => navigate(next)} aria-current={page === next ? 'page' : undefined}>{next === 'about-us' ? 'About' : next === 'contact-us' ? 'Contact' : next[0].toUpperCase() + next.slice(1)}</button>
          ))}
          <button className="public-mobile-sign-in" onClick={() => { setMenuOpen(false); onSignIn(); }}>Sign In</button>
          <button className="public-mobile-start" onClick={() => navigate('pricing')}>Get Started</button>
        </nav>
        <div className="public-header-actions">
          <button onClick={onSignIn} className="public-sign-in">Sign In</button>
          {cta()}
          <button className="public-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      {page === 'home' && <>
        <section className="public-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(16,16,16,.94), rgba(16,16,16,.45)), url("${photos.hero}")` }}>
          <div className="public-container">
            <span className="public-pill">Built for your cricket journey</span>
            <h1>Elevate<br />Your <em>Game</em></h1>
            <p>The complete online cricket coaching platform for players, coaches, and clubs. Train smarter. Perform better. Win more.</p>
            <div className="public-actions">{cta('Start Your Journey')}<button className="public-button public-button-outline" onClick={() => navigate('features')}><Play size={17} />See How It Works</button></div>
          </div>
        </section>
        <section className="public-facts" aria-label="Platform capabilities">
          {[['4', 'Core tools'], ['3', 'Audiences'], ['5', 'Progression stages'], ['1', 'Connected platform']].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </section>
        <section className="public-section public-container">
          <p className="public-eyebrow">Built for everyone in cricket</p><h2>One Platform. Three Audiences.</h2>
          <div className="public-audiences">
            {[{ title: 'Players', icon: UserRound, text: 'Personalised training and video analysis to sharpen every aspect of your game.' }, { title: 'Coaches', icon: ClipboardList, text: 'Manage your squad, follow player progress, and deliver purposeful coaching from anywhere.' }, { title: 'Clubs', icon: Users, text: 'Centralise your club operations, manage teams, and develop talent at every level.' }].map(({ title, icon: Icon, text }) => <article className="public-card" key={title}><Icon className="public-icon" /><h3>{title}</h3><p>{text}</p><button className="public-text-link" onClick={() => navigate('pricing')}>For {title}<ArrowRight size={16} /></button></article>)}
          </div>
        </section>
        <section className="public-band"><div className="public-container public-section"><p className="public-eyebrow">Everything you need</p><h2>Powerful Tools. Real Results.</h2>
          <div className="public-feature-grid">{features.map(({ title, icon: Icon, photo, description }, index) => <button onClick={() => navigate('features')} className={`public-photo-card ${index === 0 ? 'public-photo-card-large' : ''}`} key={title}><img src={photo} alt={`${title} for cricket`} loading="lazy" /><div><span className="public-pill"><Icon size={13} />{title}</span><h3>{title}</h3><p>{description}</p></div></button>)}</div>
        </div></section>
      </>}

      {page === 'features' && <>
        <section className="public-page-intro public-container"><p className="public-eyebrow">Platform features</p><h1>Everything You<br />Need to<br /><em>Elevate Your<br />Game</em></h1><p>Four powerful tools built specifically for cricket - whether you're a player pushing your limits, a coach developing talent, or a club managing your entire operation.</p></section>
        <section className="public-container public-feature-details">
          {features.map(({ title, icon: Icon, photo, audience, headline, description, points }, index) => <article key={title} className={`public-feature-row ${index % 2 ? 'public-feature-row-reverse' : ''}`}>
            <div className="public-feature-copy"><div className="public-feature-label"><span className="public-eyebrow"><Icon className="public-icon" />{title}</span><span className="public-pill public-audience-pill">{audience}</span></div><h2>{headline}</h2><p>{description}</p><ul>{points.map(point => <li key={point}><Check size={16} />{point}</li>)}</ul>{cta(`Try ${title}`)}</div>
            <div className="public-detail-photo"><img src={photo} alt={`${title} for cricket`} loading="lazy" /><span className="public-pill"><Icon size={13} />{title}</span></div>
          </article>)}
        </section>
        <section className="public-band"><div className="public-container public-section"><h2 className="public-center">All Features at a Glance</h2><div className="public-overview">{features.map(({ title, icon: Icon, audience, points }) => <article className="public-card" key={title}><Icon className="public-icon" /><h3>{title}</h3><span className="public-text-link">{audience}</span><ul>{points.map(point => <li key={point}><Check size={14} />{point}</li>)}</ul></article>)}</div></div></section>
      </>}

      {!['home', 'features'].includes(page) && <section className="public-page-intro public-container public-secondary-intro"><p className="public-eyebrow">{page === 'pricing' ? 'Find your plan' : page === 'about-us' ? 'Our story' : page === 'faqs' ? 'Your questions answered' : 'Get in touch'}</p><h1>{page === 'pricing' ? <>Invest in Your<br /><em>Cricket Journey</em></> : page === 'about-us' ? <>Built for the<br /><em>Love of Cricket</em></> : page === 'faqs' ? <>Here to <em>Help</em></> : <>Let's <em>Talk Cricket</em></>}</h1></section>}

      <div className="public-existing-content">{children}</div>

      <section className="public-container public-section public-cta">
        <div><p className="public-eyebrow">Get started today</p><h2>{page === 'home' ? 'Ready to Take Your Cricket to the Next Level?' : 'Ready to Get Started?'}</h2><p>Bring your training, coaching and club development together with eCricketCoach.</p></div>
        <div className="public-card"><h3>Your next innings starts here.</h3><p>Choose a plan for you, your coaching practice or your club.</p>{cta('Explore Plans')}<p className="public-cta-note"><Check size={16} />Players, coaches and clubs - all welcome.</p></div>
      </section>
      <footer className="public-footer"><div className="public-container">
        <div className="public-footer-grid"><div><button onClick={() => navigate('home')}>{brand}</button><p>The complete online cricket coaching platform for players, coaches, and clubs. Elevate every aspect of your game.</p></div>
          <div><h4>Platform</h4><button onClick={() => navigate('features')}>Features</button><button onClick={() => navigate('pricing')}>Pricing</button><button onClick={onSignIn}>Sign In</button><button onClick={() => navigate('pricing')}>Get Started</button></div>
          <div><h4>Company</h4><button onClick={() => navigate('about-us')}>About</button><button onClick={() => navigate('contact-us')}>Contact</button><button onClick={() => navigate('faqs')}>FAQs</button><button onClick={onOpenHelp}>Help &amp; Support</button><a href="mailto:admin@ecricketcoach.co.uk">Email Support</a></div>
          <div><h4>Audiences</h4><button onClick={() => navigate('pricing')}>For Players</button><button onClick={() => navigate('pricing')}>For Coaches</button><button onClick={() => navigate('pricing')}>For Clubs</button></div>
        </div><div className="public-footer-bottom"><span>&copy; {new Date().getFullYear()} eCricketCoach. All rights reserved.</span><span>Built for the love of cricket</span></div>
      </div></footer>
    </div>
  );
}
