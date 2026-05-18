import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const formatLastUpdated = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function RecommendationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadExistingResult = useCallback(async () => {
    if (!user?.studentNumber) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/predictions/my/result');
      setResult(res.data?.result || null);
    } catch (_) {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [user?.studentNumber]);

  const generatePrediction = useCallback(async () => {
    if (!user?.studentNumber) return;
    setGenerating(true);
    try {
      const gen = await api.post(`/predictions/${user.studentNumber}`);
      setResult(gen.data?.prediction || null);
    } catch (_) {
      setResult(null);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [user?.studentNumber]);

  useEffect(() => {
    loadExistingResult();
    const onPredictionRefresh = () => loadExistingResult();
    window.addEventListener('ppt-prediction-refresh', onPredictionRefresh);
    window.addEventListener('ptt-prediction-refresh', onPredictionRefresh);

    return () => {
      window.removeEventListener('ppt-prediction-refresh', onPredictionRefresh);
      window.removeEventListener('ptt-prediction-refresh', onPredictionRefresh);
    };
  }, [loadExistingResult]);

  if (loading || generating) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 300, gap: '1rem' }}>
      <span className="spinner"></span>
      {generating && <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Generating your recommendations…</p>}
    </div>
  );

  if (!result) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
      <Zap size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.75rem' }} />
      <h3 style={{ fontWeight: 700, color: 'var(--gray-600)' }}>No Prediction Yet</h3>
      <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', margin: '0.5rem 0 1.5rem' }}>Generate your employability prediction first.</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">Go to Dashboard</button>
        <button onClick={generatePrediction} className="btn btn-primary" disabled={generating || !user?.studentNumber}>
          {generating ? 'Generating...' : 'Generate Result'}
        </button>
      </div>
    </div>
  );

  const CAREER_RESOURCES = {
    'Developer Track': ['LeetCode', 'freeCodeCamp', 'The Odin Project', 'CS50 on edX'],
    'Data Analyst Track': ['Kaggle', 'Google Data Analytics Certificate', 'DataCamp', 'Mode Analytics'],
    'Tester Track': ['ISTQB Foundation', 'Ministry of Testing', 'Test Automation University', 'Selenium Docs'],
    'Designer Track': ['Figma Learn', 'Google UX Design Certificate', 'Dribbble', 'Interaction Design Foundation'],
    'Manager Track': ['PMI CAPM', 'Scrum.org', 'Coursera Google Project Management', 'LinkedIn Learning Leadership'],
    'Researcher Track': ['Google Scholar', 'ResearchGate', 'IEEE Xplore', 'Coursera Research Methods'],
    'Freelancer Track': ['Upwork Academy', 'Fiverr Learn', 'Toptal Guides', 'HubSpot Free Courses'],
  };

  const resources = CAREER_RESOURCES[result.clusterLabel] || [];
  const jobRecommendations = (Array.isArray(result.jobRecommendations) ? result.jobRecommendations : []).slice(0, 5);
  const jobRecommendationContext = result.jobRecommendationContext || null;
  const isLowEmployability = result.employabilityStatus === 'Low Employability';
  const jobsTitle = jobRecommendationContext?.title || (isLowEmployability ? '🎯 Target Roles After Improvement' : '💼 Top 5 Job Recommendations');
  const jobsNote = jobRecommendationContext?.message || (isLowEmployability ? 'These are target roles to work toward after you complete your improvement action plan.' : 'These are your current best-fit roles based on your profile.');
  const trackHeading = isLowEmployability ? 'Your Target Track' : 'Your Career Track';
  const trackNote = isLowEmployability
    ? 'This is your likely path after completing the action plan, not an immediate-fit placement.'
    : 'This track reflects your current best-fit direction based on your profile.';
  const score = Number(result.employabilityScore);
  const scoreText = Number.isFinite(score) ? score.toFixed(1) : 'N/A';
  const lastUpdated = formatLastUpdated(result.updatedAt || result.createdAt);
  const derivedFromActions = (Array.isArray(result.recommendations) ? result.recommendations : [])
    .map((line) => {
      const match = String(line).match(/strengthen\s+(.+?)\s+for\s+/i);
      return match?.[1]?.trim() || null;
    })
    .filter(Boolean);
  const skillSuggestions = (Array.isArray(result.skillImprovementSuggestions) ? result.skillImprovementSuggestions : [])
    .concat(derivedFromActions)
    .filter((v, i, arr) => v && arr.findIndex((x) => String(x).toLowerCase() === String(v).toLowerCase()) === i)
    .slice(0, 8);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Career Recommendations</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Personalized guidance based on your employability prediction</p>
        <p style={{ color: 'var(--gray-400)', fontSize: '0.8rem', marginTop: '0.4rem' }}>Last updated: {lastUpdated}</p>
      </div>

      {/* Career Track Banner */}
      <div style={{ background: 'var(--maroon)', color: 'white', borderRadius: 'var(--radius-lg)', padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>{trackHeading}</div>
          <div style={{ fontWeight: 800, fontSize: '1.35rem' }}>🎯 {result.clusterLabel}</div>
          <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.35rem', maxWidth: 420 }}>{trackNote}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>Employability Score</div>
          <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>{scoreText}%</div>
        </div>
      </div>

      {/* Job Recommendations */}
      {jobRecommendations.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.5rem' }}>{jobsTitle}</h3>
          <p style={{ color: isLowEmployability ? 'var(--amber-700)' : 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '1rem' }}>{jobsNote}</p>
          <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {jobRecommendations.map((job, i) => (
              <li key={job} style={{ color: 'var(--gray-700)', lineHeight: 1.65, fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{i + 1}</span>&nbsp; {job}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Action Recommendations */}
      {result.recommendations?.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>📋 Improvement Action Plan</h3>
          <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {result.recommendations.slice(0, 5).map((r, i) => (
              <li key={i} style={{ color: 'var(--gray-700)', lineHeight: 1.65, fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{i + 1}</span>&nbsp; {r}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Skill Improvement */}
      {skillSuggestions.length > 0 && (
        <div style={{
          background: 'linear-gradient(180deg, #fff 0%, #fff8f8 100%)',
          border: '1px solid #f4d1d1',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}>
          <h3 style={{ fontWeight: 800, color: 'var(--gray-800)', marginBottom: '0.35rem' }}>Skill Improvement Suggestions</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.84rem', marginBottom: '0.95rem' }}>
            Prioritized skills you should focus on to improve your job-fit and employability score.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.7rem' }}>
            {skillSuggestions.map((s, i) => (
              <div key={`${s}-${i}`} style={{
                background: 'white',
                border: '1px solid #f1d0d0',
                borderRadius: '10px',
                padding: '0.72rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
              }}>
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'var(--maroon-pale)',
                  color: 'var(--maroon)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{ color: 'var(--gray-700)', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Resources */}
      {resources.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>📚 Recommended Learning Resources</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {resources.map(r => (
              <div key={r} style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '0.875rem 1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-700)', border: '1px solid var(--gray-100)' }}>
                📖 {r}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => navigate('/dashboard/result')} className="btn btn-outline" style={{ gap: '0.5rem' }}>
        <ArrowLeft size={16} />View Full Result
      </button>
    </div>
  );
}
