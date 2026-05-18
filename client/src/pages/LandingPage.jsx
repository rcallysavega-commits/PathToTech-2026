import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Briefcase, Building2, GraduationCap, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import PathToTechLogo from '../components/PathToTechLogo';
import api from '../services/api';
import { DEFAULT_LANDING_CONTENT } from '../utils/defaultLandingContent';

const highlightIcons = [BarChart3, Target, Briefcase];
const capabilityIcons = [GraduationCap, Building2, ShieldCheck];

export default function LandingPage() {
  const [content, setContent] = useState(DEFAULT_LANDING_CONTENT);
  const contentSignatureRef = useRef(JSON.stringify(DEFAULT_LANDING_CONTENT));

  useEffect(() => {
    let active = true;

    const loadContent = async () => {
      try {
        const res = await api.get('/landing-content');
        if (!active) return;

        const nextContent = { ...DEFAULT_LANDING_CONTENT, ...(res.data?.data || {}) };
        const nextSignature = JSON.stringify(nextContent);

        if (nextSignature !== contentSignatureRef.current) {
          contentSignatureRef.current = nextSignature;
          setContent(nextContent);
        }
      } catch {
        if (!active) return;
        const fallbackSignature = JSON.stringify(DEFAULT_LANDING_CONTENT);
        if (fallbackSignature !== contentSignatureRef.current) {
          contentSignatureRef.current = fallbackSignature;
          setContent(DEFAULT_LANDING_CONTENT);
        }
      }

    };

    loadContent();
    const timer = setInterval(loadContent, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f7f3ee' }}>
      <nav style={{ backdropFilter: 'blur(18px)', background: 'rgba(247,243,238,0.82)', borderBottom: '1px solid rgba(95,15,27,0.08)', padding: '0 2rem', minHeight: 74, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <PathToTechLogo size={38} textColor="#221c1a" wordmark={content.brandName} tagline={content.brandTagline} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
          <a href="#home" style={{ fontSize: '0.92rem', color: '#43332f', fontWeight: 600 }}>Home</a>
          <a href="#about" style={{ fontSize: '0.92rem', color: '#43332f', fontWeight: 600 }}>About</a>
          <a href="#capabilities" style={{ fontSize: '0.92rem', color: '#43332f', fontWeight: 600 }}>Capabilities</a>
          <Link to="/login" className="btn btn-primary btn-sm">Login</Link>
        </div>
      </nav>

      <section id="home" style={{ padding: '4.5rem 0 3.5rem', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at top left, rgba(204,90,52,0.16), transparent 34%), radial-gradient(circle at top right, rgba(95,15,27,0.18), transparent 30%), linear-gradient(180deg, #f8f3ee 0%, #f7f3ee 44%, #f0e4d7 100%)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '2rem', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.9rem', borderRadius: 999, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(95,15,27,0.08)', boxShadow: '0 10px 30px rgba(50,20,10,0.05)', marginBottom: '1.2rem', fontSize: '0.8rem', color: '#69493f', fontWeight: 600 }}>
              <Sparkles size={14} />
              {content.heroBadge}
            </div>

            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9a4a32', marginBottom: '0.9rem', fontWeight: 700 }}>
              {content.systemTitle}
            </div>

            <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.7rem)', lineHeight: 1.02, letterSpacing: '-0.04em', color: '#201715', marginBottom: '1.2rem', maxWidth: 720, fontWeight: 800 }}>
              {content.heroTitleLine1}
              <span style={{ color: '#8f1d2c', display: 'block' }}>{content.heroTitleHighlight}</span>
            </h1>

            <p style={{ maxWidth: 660, fontSize: '1.03rem', color: '#5b4b45', lineHeight: 1.8, marginBottom: '1.9rem' }}>
              {content.heroDescription}
            </p>

            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              <Link to="/login" className="btn btn-primary btn-lg">
                Access Platform
                <ArrowRight size={18} />
              </Link>
              <a href="#about" className="btn btn-outline btn-lg" style={{ borderColor: '#8f1d2c', color: '#8f1d2c' }}>
                Learn More
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.9rem', maxWidth: 760 }}>
              {content.heroHighlights.map(({ title, desc }) => (
                <div key={title} style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(95,15,27,0.08)', borderRadius: 18, padding: '1rem 1.05rem', boxShadow: '0 12px 30px rgba(41,22,15,0.05)' }}>
                  <div style={{ fontWeight: 700, color: '#231815', marginBottom: '0.28rem' }}>{title}</div>
                  <div style={{ fontSize: '0.85rem', color: '#68544c', lineHeight: 1.55 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ background: 'linear-gradient(155deg, #58111c 0%, #7f1d2d 42%, #c85d35 100%)', borderRadius: 28, padding: '1.2rem', boxShadow: '0 30px 80px rgba(69,20,16,0.22)' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '1.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.2rem' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)', marginBottom: '0.25rem' }}>Readiness Snapshot</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'white' }}>{content.systemTitle}</div>
                  </div>
                  <div style={{ padding: '0.4rem 0.7rem', borderRadius: 999, background: 'rgba(244,201,93,0.2)', color: '#ffe7a4', fontWeight: 700, fontSize: '0.82rem' }}>Student-Focused</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem', marginBottom: '0.95rem' }}>
                  {[['Prediction Confidence', '87%'], ['Readiness Band', 'Moderate to High']].map(([label, value]) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.76rem', marginBottom: '0.35rem' }}>{label}</div>
                      <div style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'white', borderRadius: 20, padding: '1rem 1rem 0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#2a1c18' }}>Improvement Signals</div>
                    <div style={{ fontSize: '0.78rem', color: '#7a6a62' }}>Priority-ranked</div>
                  </div>
                  {[['Technical depth', 'Strengthen project-ready tools and frameworks', '78%'], ['Communication', 'Improve presentation and collaboration signals', '64%'], ['Certification readiness', 'Add proof of specialization or role alignment', '52%']].map(([title, desc, pct]) => (
                    <div key={title} style={{ padding: '0.8rem 0', borderTop: '1px solid #f1e6de' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.28rem' }}>
                        <div style={{ fontWeight: 700, color: '#2b1d18' }}>{title}</div>
                        <div style={{ fontWeight: 700, color: '#8f1d2c' }}>{pct}</div>
                      </div>
                      <div style={{ fontSize: '0.83rem', color: '#6a5b55', lineHeight: 1.55 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '1.3rem 0', background: '#2e1718', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {content.statMetrics.map(({ label, value }) => (
            <div key={label} style={{ color: 'white', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.56)' }}>{label}</span>
              <span style={{ fontSize: '1rem', fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="about" style={{ padding: '5rem 0', background: '#fcfaf7' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '2rem', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9a4a32', marginBottom: '0.85rem', fontWeight: 700 }}>{content.aboutEyebrow}</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.08, color: '#1f1513', marginBottom: '1rem' }}>{content.aboutTitle}</h2>
            <p style={{ color: '#5f4e47', lineHeight: 1.85, marginBottom: '1rem' }}>{content.aboutParagraph1}</p>
            <p style={{ color: '#5f4e47', lineHeight: 1.85 }}>{content.aboutParagraph2}</p>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {content.highlights.map(({ title, desc }, index) => {
              const Icon = highlightIcons[index] || BarChart3;
              return (
                <div key={title} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'white', borderRadius: 20, border: '1px solid #f0e3d8', padding: '1.2rem 1.2rem', boxShadow: '0 14px 40px rgba(52,25,18,0.05)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(180deg, #fff1e8 0%, #f7dfd0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8f1d2c', flexShrink: 0 }}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#241815', marginBottom: '0.35rem' }}>{title}</div>
                    <div style={{ color: '#685852', fontSize: '0.92rem', lineHeight: 1.7 }}>{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="capabilities" style={{ padding: '5rem 0', background: 'linear-gradient(180deg, #f4ebe2 0%, #f9f6f1 100%)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 2.5rem' }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9a4a32', marginBottom: '0.8rem', fontWeight: 700 }}>{content.capabilitiesEyebrow}</div>
            <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#1e1513', marginBottom: '0.8rem' }}>{content.capabilitiesTitle}</h2>
            <p style={{ color: '#65544d', lineHeight: 1.75 }}>{content.capabilitiesDescription}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem', marginBottom: '2.3rem' }}>
            {content.capabilities.map(({ title, desc }, index) => {
              const Icon = capabilityIcons[index] || GraduationCap;
              return (
                <div key={title} style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid #ead8ca', borderRadius: 22, padding: '1.5rem', boxShadow: '0 18px 48px rgba(56,28,20,0.06)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: '#2d1718', color: '#f8e7d5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <Icon size={24} />
                  </div>
                  <h3 style={{ color: '#241815', fontSize: '1.1rem', marginBottom: '0.4rem' }}>{title}</h3>
                  <p style={{ color: '#695a53', fontSize: '0.92rem', lineHeight: 1.75 }}>{desc}</p>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#241516', borderRadius: 28, padding: '1.4rem', boxShadow: '0 24px 64px rgba(38,21,19,0.22)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {content.processSteps.map(({ label, desc }, idx) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '1.2rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(244,201,93,0.16)', color: '#f4c95d', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.85rem', fontWeight: 800 }}>{idx + 1}</div>
                  <div style={{ color: 'white', fontWeight: 700, marginBottom: '0.35rem' }}>{label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, fontSize: '0.9rem' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '4.5rem 0', background: '#fffaf5' }}>
        <div className="container">
          <div style={{ background: 'linear-gradient(135deg, #5f0f1b 0%, #8f1d2c 45%, #bf5a38 100%)', borderRadius: 30, padding: '2.3rem', color: 'white', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '1.5rem', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.72)', marginBottom: '0.8rem' }}>
                <Users size={14} />
                {content.ctaEyebrow}
              </div>
              <h2 style={{ fontSize: 'clamp(1.9rem, 3vw, 2.6rem)', lineHeight: 1.1, marginBottom: '0.8rem' }}>{content.ctaTitle}</h2>
              <p style={{ color: 'rgba(255,255,255,0.82)', lineHeight: 1.75, maxWidth: 700 }}>{content.ctaText}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link to="/login" className="btn btn-white btn-lg">
                {content.ctaButtonLabel}
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ background: '#1d1212', color: 'rgba(255,255,255,0.72)', padding: '2.2rem 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <PathToTechLogo size={34} textColor="white" wordmark={content.brandName} tagline={content.brandTagline} />
          <div style={{ textAlign: 'right', fontSize: '0.88rem', lineHeight: 1.7 }}>
            <div>{content.footerText}</div>
            <div>{content.footerSubtext}</div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 900px) {
          #home .container,
          #about .container {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          nav {
            padding: 1rem 1.1rem !important;
            align-items: flex-start !important;
            gap: 1rem !important;
            flex-direction: column !important;
          }

          #home {
            padding-top: 3rem !important;
          }
        }
      `}</style>
    </div>
  );
}
