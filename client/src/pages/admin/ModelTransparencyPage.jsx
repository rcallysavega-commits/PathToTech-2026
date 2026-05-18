import { useState, useEffect } from 'react';
import { Brain, Database, Cpu, BarChart3, Info } from 'lucide-react';
import api from '../../services/api';

export default function ModelTransparencyPage() {
  const [trainingInfo, setTrainingInfo] = useState(null);
  const [features, setFeatures] = useState(null);
  const [modelSummary, setModelSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [tiRes, fRes, msRes] = await Promise.allSettled([
          api.get('/ml/training-info'),
          api.get('/ml/features'),
          api.get('/ml/model-summary'),
        ]);
        if (tiRes.status === 'fulfilled') setTrainingInfo(tiRes.value.data?.data || null);
        if (fRes.status === 'fulfilled') setFeatures(fRes.value.data?.data || null);
        if (msRes.status === 'fulfilled') setModelSummary(msRes.value.data?.data || null);
        if (tiRes.status === 'rejected' && fRes.status === 'rejected') setError('ML service is not available.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Model Transparency</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>How PathToTech's AI prediction model works</p>
      </div>

      {error && <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>{error} Showing static information.</div>}

      {/* Algorithm Overview */}
      <div style={{ background: 'linear-gradient(135deg, var(--maroon) 0%, #600000 100%)', color: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Brain size={28} />
          <h2 style={{ fontWeight: 800, fontSize: '1.3rem' }}>Gaussian Mixture Model (GMM)</h2>
        </div>
        <p style={{ opacity: 0.9, lineHeight: 1.7, maxWidth: 700, fontSize: '0.9rem' }}>
          PathToTech uses a <strong>Gaussian Mixture Model (GMM)</strong>, a probabilistic machine learning algorithm that assumes data is generated from a mixture of several Gaussian distributions with unknown parameters. Unlike K-Means, GMM provides "soft" cluster assignments, giving each student a probability score of belonging to each career cluster. This allows for nuanced employability predictions that account for the multi-dimensional nature of student readiness.
        </p>
      </div>

      {/* Scoring Formula */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={20} style={{ color: 'var(--maroon)' }} />Composite Employability Score
        </h3>
        <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 2, marginBottom: '1rem', border: '1px solid var(--gray-100)' }}>
          <div>academic_score = (5.0 - GWA) / 4.0 &nbsp;&nbsp;&nbsp;&nbsp;// Normalized to [0, 1]</div>
          <div>survey_score = totalAverage / 5.0</div>
          <div>skills_score = min(technicalSkillsCount / 40, 1.0)</div>
          <div>soft_score = softSkillsAverage / 5.0</div>
          <div>cert_score = min(certificationCount / 5, 1.0)</div>
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--gray-200)', paddingTop: '0.5rem', color: 'var(--maroon)', fontWeight: 700 }}>
            employabilityScore = (academic*0.30 + survey*0.25 + skills*0.20 + soft*0.15 + cert*0.10) × 100
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {[['Academic (GWA)', '30%', '#800000'], ['Survey Score', '25%', '#b91c1c'], ['Technical Skills', '20%', '#059669'], ['Soft Skills', '15%', '#2563eb'], ['Certifications', '10%', '#d97706']].map(([label, weight, color]) => (
            <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', color }}>{weight}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--gray-600)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Employability Levels */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={18} style={{ color: 'var(--maroon)' }} />Employability Labels and Final Decision Rule
        </h3>
        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem', marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.83rem', color: 'var(--gray-600)', lineHeight: 1.65 }}>
            The system computes two status views: <strong>Score-Based Status</strong> from thresholds (High: 75+, Moderate: 50-74.99, Low: below 50), and <strong>GMM-Based Status</strong> from probabilistic cluster assignment.
            The stored and displayed <strong>final status</strong> is the GMM-based label.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {[['High Employability', 'Top GMM group', '#059669', 'Profile is grouped in high-readiness cluster using GMM.'],
            ['Moderate Employability', 'Middle GMM group', '#d97706', 'Profile is grouped in moderate-readiness cluster using GMM.'],
            ['Low Employability', 'Lower GMM group', '#dc2626', 'Profile is grouped in lower-readiness cluster using GMM.']].map(([status, groupLabel, color, desc]) => (
            <div key={status} style={{ display: 'flex', gap: '1rem', padding: '0.875rem 1rem', background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 'var(--radius)', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 100, fontWeight: 800, fontSize: '0.8rem', color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{groupLabel}</div>
              <div>
                <div style={{ fontWeight: 700, color, marginBottom: '0.2rem' }}>{status}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ECLAT */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={18} style={{ color: 'var(--maroon)' }} />ECLAT Pattern Discovery
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: 1.7 }}>
          ECLAT is used to discover frequent feature combinations from training profiles and derive relationship patterns.
          These mined patterns power the recommendation hints such as what competencies or profile dimensions should be improved
          to move from a lower employability level to a higher one.
        </p>
      </div>

      {/* Career Clusters */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={18} style={{ color: 'var(--maroon)' }} />GMM Career Clusters
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {[['Developer Track', 'High tech skills, strong programming background, software design survey scores.'],
            ['Data Analyst Track', 'Strong academic performance, database skills, analytical survey scores.'],
            ['Tester Track', 'Detail-oriented, QA knowledge, systematic testing and validation skills.'],
            ['Designer Track', 'Creative skills, UI/UX focus, design and user experience survey alignment.'],
            ['Manager Track', 'Leadership qualities, project management, team capacity and communication scores.'],
            ['Researcher Track', 'Scientific spirit, academic depth, research methodology and analytical thinking.'],
            ['Freelancer Track', 'Diverse skills, entrepreneurial mindset, broad IT knowledge and adaptability.']].map(([track, desc], i) => (
            <div key={track} style={{ border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '1rem', position: 'relative', paddingTop: '1.25rem' }}>
              <div style={{ position: 'absolute', top: -10, left: 12, background: 'var(--maroon)', color: 'white', borderRadius: 999, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>{i + 1}</div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.4rem', fontSize: '0.875rem' }}>{track}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live ML Data */}
      {(trainingInfo || features || modelSummary) && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} style={{ color: 'var(--maroon)' }} />Live Training Information
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {trainingInfo && Object.entries(trainingInfo).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--gray-50)', padding: '0.875rem', borderRadius: 'var(--radius)', border: '1px solid var(--gray-100)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: '0.25rem', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
              </div>
            ))}
          </div>
          {features?.feature_names && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>Input Features ({features.feature_names.length})</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {features.feature_names.map(f => (
                  <span key={f} style={{ background: 'var(--maroon-pale)', color: 'var(--maroon)', fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: 999, border: '1px solid #fbd0d0', fontFamily: 'monospace' }}>{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
