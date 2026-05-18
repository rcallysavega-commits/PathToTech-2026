import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { Zap, TrendingUp, Award, BarChart3, BookOpen, FileText, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { EMPLOYABILITY_STATUS_COLORS } from '../../utils/constants';
import { downloadTemplatePdf } from '../../utils/pdfExport';

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

export default function ResultPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);
  const [showJobBreakdown, setShowJobBreakdown] = useState(false);
  const [showPlanBreakdown, setShowPlanBreakdown] = useState(false);

  const loadExistingResult = useCallback(async () => {
    if (!user?.studentNumber) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/predictions/my/result');
      if (res.data?.result) {
        setResult(res.data.result);
        setLoading(false);
        return;
      }
    } catch (_) {
      // No existing result
    }

    // Do not auto-generate to avoid repeated 400 requests when data is incomplete.
    setResult(null);
    setLoading(false);
  }, [user?.studentNumber]);

  const generatePrediction = useCallback(async () => {
    if (!user?.studentNumber) return;
    setGenerating(true);
    try {
      const gen = await api.post(`/predictions/${user.studentNumber}`);
      setResult(gen.data?.prediction || null);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to generate prediction. Please try again.';
      await Swal.fire({
        title: 'Prediction Failed',
        text: msg,
        icon: 'error',
        confirmButtonColor: '#800000',
      });

      try {
        const res = await api.get('/predictions/my/result');
        setResult(res.data?.result || null);
      } catch (fetchErr) {
        console.error('Failed to reload existing prediction after generation error:', fetchErr);
        setResult(null);
      }
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

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 300, gap: '1rem' }}>
      <span className="spinner"></span>
      <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Loading result...</p>
    </div>
  );

  if (!result) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
      <Zap size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.75rem' }} />
      <h3 style={{ fontWeight: 700, color: 'var(--gray-600)' }}>No result found</h3>
      <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', margin: '0.5rem 0 1.5rem' }}>
        Complete all required sections first, then generate your prediction.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">Go to Dashboard</button>
        <button onClick={generatePrediction} className="btn btn-primary" disabled={generating || !user?.studentNumber}>
          {generating ? 'Generatingâ€¦' : 'Generate Result'}
        </button>
      </div>
    </div>
  );

  const statusColor = EMPLOYABILITY_STATUS_COLORS[result.employabilityStatus] || '#6b7280';
  const score = Number(result.employabilityScore);
  const summary = result.inputSummary || {};
  const jobRecommendations = (Array.isArray(result.jobRecommendations) ? result.jobRecommendations : []).slice(0, 5);
  const targetRolesAfterImprovement = (Array.isArray(result.targetRolesAfterImprovement) ? result.targetRolesAfterImprovement : []).slice(0, 5);
  const displayedJobRecommendations = jobRecommendations.length > 0 ? jobRecommendations : targetRolesAfterImprovement;
  const hasAnyJobRecommendations = displayedJobRecommendations.length > 0;
  const jobRecommendationContext = result.jobRecommendationContext || null;
  const isLowEmployability = result.employabilityStatus === 'Low Employability';
  const jobsTitle = jobRecommendationContext?.title || (isLowEmployability ? 'Target Roles After Improvement' : 'Top 5 Job Recommendations');
  const jobsNote = jobRecommendationContext?.message || (isLowEmployability ? 'These are target roles to work toward after your action plan.' : 'These are your current best-fit roles based on your profile.');
  const trackLabel = isLowEmployability ? 'Target Track' : 'Career Track';
  const trackNote = isLowEmployability
    ? 'Path direction after improvement, not immediate-fit placement.'
    : 'Current best-fit direction based on your profile.';
  const safeNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const fmt = (v, digits = 2, fallback = 'N/A') => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(digits) : fallback;
  };
  const surveyAverageNum = Number(summary.surveyAverage);
  const hasSurveyAverage = Number.isFinite(surveyAverageNum) && surveyAverageNum > 0;
  const lastUpdated = formatLastUpdated(result.updatedAt || result.createdAt);
  const hasDualStatus = Boolean(result.scoreBasedStatus || result.gmmBasedStatus || result.statusExplanation);
  const hasStatusMismatch = Boolean(
    result.scoreBasedStatus
    && result.gmmBasedStatus
    && result.scoreBasedStatus !== result.gmmBasedStatus
  );
  const lowEmployabilityReason = typeof result.lowEmployabilityReason === 'string'
    ? result.lowEmployabilityReason.trim()
    : '';

  // Score formula breakdown
  const gwaValue = safeNum(summary.gwa, 0);
  const surveyValue = safeNum(summary.surveyAverage, 0);
  const techValue = safeNum(summary.technicalSkillsCount, 0);
  const softValue = safeNum(summary.softSkillsAverage, 0);
  const certValue = safeNum(summary.certificationCount, 0);
  const academicNorm = Math.max(0, Math.min((5 - gwaValue) / 4, 1));
  const surveyNorm = Math.max(0, Math.min(surveyValue / 5, 1));
  const techNorm = Math.max(0, Math.min(techValue / 40, 1));
  const softNorm = Math.max(0, Math.min(softValue / 5, 1));
  const certNorm = Math.max(0, Math.min(certValue / 5, 1));
  const scoreFactors = [
    { label: 'Academic (GWA)',    raw: `GWA ${fmt(gwaValue,2)}`,         norm: academicNorm, weight: 0.30 },
    { label: 'Survey Avg',        raw: `${fmt(surveyValue,2)} / 5`,       norm: surveyNorm,   weight: 0.25 },
    { label: 'Tech Skills',       raw: `${fmt(techValue,0)} skills`,       norm: techNorm,     weight: 0.20 },
    { label: 'Soft Skills Avg',   raw: `${fmt(softValue,2)} / 5`,         norm: softNorm,     weight: 0.15 },
    { label: 'Certifications',    raw: `${fmt(certValue,0)} certs`,        norm: certNorm,     weight: 0.10 },
  ].map((r) => ({ ...r, pts: r.norm * r.weight * 100 }));
  const computedScore = scoreFactors.reduce((s, r) => s + r.pts, 0);

  const radarData = [
    { subject: 'Academic', value: Math.max(0, Math.min(((5 - safeNum(summary.gwa, 5)) / 4) * 100, 100)) },
    { subject: 'Survey', value: hasSurveyAverage ? Math.max(0, Math.min((surveyAverageNum / 5) * 100, 100)) : 0 },
    { subject: 'Tech Skills', value: Math.min(safeNum(summary.technicalSkillsCount, 0) / 40 * 100, 100) },
    { subject: 'Soft Skills', value: Math.max(0, Math.min((safeNum(summary.softSkillsAverage, 0) / 5) * 100, 100)) },
    { subject: 'Certs', value: Math.min(safeNum(summary.certificationCount, 0) * 20, 100) },
  ];

  const sectionCardStyle = {
    background: '#ffffff',
    border: '1px solid var(--gray-200)',
    borderRadius: '14px',
    padding: '1.35rem',
    boxShadow: 'var(--shadow-sm)',
  };

  const listItemStyle = {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem 0.95rem',
    background: '#ffffff',
    border: '1px solid var(--gray-200)',
    borderRadius: '10px',
    fontSize: '0.885rem',
  };

  const exportPDF = async (data, label) => {
    const sc = Number(data.employabilityScore);
    const s = data.inputSummary || {};
    const jobs = Array.isArray(data.jobRecommendations) ? data.jobRecommendations : [];
    const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
    const skills = Array.isArray(data.skillImprovementSuggestions) ? data.skillImprovementSuggestions : [];

    const rows = [
      ['Student', user?.fullName || '-'],
      ['Student Number', user?.studentNumber || '-'],
      ['Record', label || 'Latest'],
      ['Employability Score', Number.isFinite(sc) ? `${sc.toFixed(1)}%` : 'N/A'],
      ['Status', data.employabilityStatus || '-'],
      ['Career Track', data.clusterLabel || '-'],
      ['GWA', Number(s.gwa) ? Number(s.gwa).toFixed(2) : 'N/A'],
      ['Survey Average', s.surveyAverage ? Number(s.surveyAverage).toFixed(2) : 'N/A'],
      ['Soft Skills Average', Number(s.softSkillsAverage) ? Number(s.softSkillsAverage).toFixed(2) : 'N/A'],
      ['Certifications', String(s.certificationCount || 0)],
      ...jobs.map((item, i) => [`Job Recommendation ${i + 1}`, item]),
      ...recs.map((item, i) => [`Action Plan ${i + 1}`, item]),
      ...skills.map((item, i) => [`Skill Suggestion ${i + 1}`, item]),
    ];

    await downloadTemplatePdf({
      reportTitle: 'PathToTech Employability Result',
      subtitle: `Generated for ${user?.studentNumber || 'student'}`,
      columns: ['Field', 'Value'],
      rows,
      fileName: `employability-result-${(user?.studentNumber || 'student').toLowerCase()}`,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--gray-100)' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)', letterSpacing: '-0.02em', margin: 0 }}>My Employability Result</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.78rem', marginTop: '0.15rem' }}>Last updated: {lastUpdated}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => exportPDF(result, null)} className="btn btn-secondary btn-sm" style={{ gap: '0.4rem' }}>
            <FileText size={14} /> Export PDF
          </button>
          {result.history?.length > 0 && (
            <button onClick={() => setShowHistory(h => !h)} className="btn btn-secondary btn-sm" style={{ gap: '0.4rem' }}>
              <Clock size={14} /> History ({result.history.length})
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          <button
            onClick={generatePrediction}
            disabled={generating || !user?.studentNumber}
            className="btn btn-primary btn-sm"
            style={{ gap: '0.4rem' }}
            title="Re-run the prediction to get updated job recommendations and score"
          >
            <RefreshCw size={14} style={generating ? { animation: 'spin 1s linear infinite' } : {}} />
            {generating ? 'Refreshing…' : 'Refresh Result'}
          </button>
        </div>
      </div>

      {/* Score Hero Card */}
      <div style={{ background: '#ffffff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ background: `linear-gradient(135deg, ${statusColor}08 0%, ${statusColor}03 100%)`, borderBottom: `3px solid ${statusColor}`, padding: '1.75rem 2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Employability Score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: 'var(--gray-900)', letterSpacing: '-0.04em' }}>{fmt(score, 1)}</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-400)' }}>%</span>
            </div>
            <div style={{ marginTop: '0.6rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '0.3rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, background: `${statusColor}18`, color: statusColor, border: `1.5px solid ${statusColor}40` }}>
                {result.employabilityStatus}
              </span>
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--gray-200)', alignSelf: 'stretch', minHeight: 60 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>{trackLabel}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.25rem' }}>{result.clusterLabel}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.5 }}>{trackNote}</div>
          </div>
        </div>
        {/* Quick Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--gray-100)' }}>
          {[
            { icon: <BookOpen size={16} />, value: fmt(summary.gwa, 2), label: 'GWA' },
            { icon: <BarChart3 size={16} />, value: hasSurveyAverage ? surveyAverageNum.toFixed(2) : 'N/A', label: 'Survey Avg' },
            { icon: <TrendingUp size={16} />, value: fmt(summary.softSkillsAverage, 2), label: 'Soft Skills' },
            { icon: <Award size={16} />, value: summary.certificationCount || 0, label: 'Certifications' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem', borderRight: i < 3 ? '1px solid var(--gray-100)' : 'none' }}>
              <span style={{ color: 'var(--gray-400)' }}>{stat.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-800)', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--gray-400)', marginTop: '0.2rem' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transparency â€” Collapsible */}
      {hasDualStatus && (
        <div style={{ background: '#ffffff', border: `1px solid ${hasStatusMismatch ? '#fed7aa' : 'var(--gray-200)'}`, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <button
            onClick={() => setShowTransparency(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.2rem', background: hasStatusMismatch ? '#fff7ed' : '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '1rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: hasStatusMismatch ? '#92400e' : 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                How Your Status Was Determined
              </span>
              {hasStatusMismatch && (
                <span style={{ fontSize: '0.73rem', background: '#fed7aa', color: '#92400e', padding: '0.15rem 0.55rem', borderRadius: 999, fontWeight: 600 }}>Score â‰  GMM</span>
              )}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {result.scoreBasedStatus && (
                  <span style={{ fontSize: '0.74rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                    Score: {result.scoreBasedStatus.replace(' Employability', '')}
                  </span>
                )}
                {result.gmmBasedStatus && (
                  <span style={{ fontSize: '0.74rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: hasStatusMismatch ? '#fff1f2' : '#f1f5f9', color: hasStatusMismatch ? '#9f1239' : '#334155', border: `1px solid ${hasStatusMismatch ? '#fecaca' : '#e2e8f0'}`, fontWeight: 600 }}>
                    GMM: {result.gmmBasedStatus.replace(' Employability', '')}
                  </span>
                )}
              </div>
            </div>
            <span style={{ color: 'var(--gray-400)', flexShrink: 0 }}>
              {showTransparency ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {showTransparency && (
            <div style={{ padding: '1rem 1.2rem 1.2rem', borderTop: `1px solid ${hasStatusMismatch ? '#fed7aa' : 'var(--gray-100)'}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Score-Based */}
                {result.scoreBasedStatus && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-400)' }}>Score-Based</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 999, padding: '0.15rem 0.6rem' }}>{result.scoreBasedStatus}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', lineHeight: 1.8 }}>
                      <div><span style={{ color: 'var(--gray-400)', fontWeight: 600 }}>Formula: </span><code style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: '0.77rem' }}>Score = (Academic×0.30 + Survey×0.25 + TechSkills×0.20 + SoftSkills×0.15 + Certs×0.10) × 100</code></div>
                      <div><span style={{ color: 'var(--gray-400)', fontWeight: 600 }}>Your values: </span><code style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: '0.77rem' }}>({academicNorm.toFixed(3)}×0.30 + {surveyNorm.toFixed(3)}×0.25 + {techNorm.toFixed(3)}×0.20 + {softNorm.toFixed(3)}×0.15 + {certNorm.toFixed(3)}×0.10) × 100</code></div>
                      <div><span style={{ color: 'var(--gray-400)', fontWeight: 600 }}>Result: </span><code style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: '0.77rem' }}>({scoreFactors[0].pts.toFixed(2)} + {scoreFactors[1].pts.toFixed(2)} + {scoreFactors[2].pts.toFixed(2)} + {scoreFactors[3].pts.toFixed(2)} + {scoreFactors[4].pts.toFixed(2)}) = <strong>{computedScore.toFixed(2)}%</strong></code></div>
                      <div style={{ color: 'var(--gray-500)' }}>Thresholds: <strong>High &ge; 75</strong> | <strong>Moderate &ge; 50</strong> | <strong>Low &lt; 50</strong> &rarr; <strong style={{ color: '#334155' }}>{result.scoreBasedStatus}</strong></div>
                    </div>
                  </div>
                )}

                {/* GMM-Based */}
                {result.gmmBasedStatus && (
                  <div style={{ background: hasStatusMismatch ? '#fff8f8' : '#f8fafc', border: `1px solid ${hasStatusMismatch ? '#fecaca' : '#e2e8f0'}`, borderRadius: '10px', padding: '0.9rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-400)' }}>GMM-Based</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#9f1239', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 999, padding: '0.15rem 0.6rem' }}>{result.gmmBasedStatus}</span>
                      <span style={{ fontSize: '0.71rem', color: 'var(--gray-400)', marginLeft: 'auto' }}>· Final decision</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', lineHeight: 1.8 }}>
                      <div><span style={{ color: 'var(--gray-400)', fontWeight: 600 }}>Formula: </span><code style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: '0.77rem' }}>P(k|x) = πk·N(x;μk,Σk) / Σj[πj·N(x;μj,Σj)]</code></div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>where x = your normalized profile, μk/Σk = cluster mean/covariance from training data</div>
                      <div><span style={{ color: 'var(--gray-400)', fontWeight: 600 }}>Input vector: </span><code style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: '0.77rem' }}>x = [{academicNorm.toFixed(3)}, {surveyNorm.toFixed(3)}, {techNorm.toFixed(3)}, {softNorm.toFixed(3)}, {certNorm.toFixed(3)}]</code><span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginLeft: '0.3rem' }}>(Academic, Survey, Tech, Soft, Certs)</span></div>
                      {result.clusterLabel && (
                        <div>
                          <span style={{ color: 'var(--gray-400)', fontWeight: 600 }}>Assigned cluster: </span>
                          <strong style={{ color: 'var(--gray-800)' }}>{result.clusterLabel}</strong>
                          {result.gmmConfidence != null && <span style={{ color: 'var(--gray-400)', marginLeft: '0.4rem' }}>(confidence: <strong style={{ color: 'var(--gray-600)' }}>{(result.gmmConfidence * 100).toFixed(1)}%</strong>)</span>}
                        </div>
                      )}
                      <div style={{ color: 'var(--gray-500)' }}>Cluster rank: <strong>bottom 33% = Low</strong> | <strong>middle = Moderate</strong> | <strong>top 33% = High</strong> &rarr; <strong style={{ color: '#9f1239' }}>{result.gmmBasedStatus}</strong></div>
                    </div>
                  </div>
                )}

                {/* Final Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', background: `${statusColor}08`, border: `1px solid ${statusColor}30`, borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final Status</span>
                  <span style={{ fontWeight: 800, color: statusColor, fontSize: '0.9rem' }}>{result.employabilityStatus}</span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>· follows GMM classification</span>
                </div>

                {(result.statusExplanation || lowEmployabilityReason) && (
                  <div style={{ fontSize: '0.81rem', color: hasStatusMismatch ? '#78350f' : 'var(--gray-500)', lineHeight: 1.65, padding: '0.55rem 0.8rem', background: hasStatusMismatch ? '#fffbeb' : '#f8fafc', border: `1px solid ${hasStatusMismatch ? '#fde68a' : 'var(--gray-200)'}`, borderRadius: 8 }}>
                    {result.statusExplanation && <div>{result.statusExplanation}</div>}
                    {lowEmployabilityReason && <div style={{ marginTop: result.statusExplanation ? '0.35rem' : 0 }}>{lowEmployabilityReason}</div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        <div style={sectionCardStyle}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', fontSize: '0.95rem' }}>Skill Profile</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <Radar dataKey="value" stroke="#800000" fill="#800000" fillOpacity={0.25} />
              <Tooltip formatter={(v) => `${fmt(v, 1, '0.0')}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div style={sectionCardStyle}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>Score Breakdown</h3>
          {radarData.map(({ subject, value }) => (
            <div key={subject} style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--gray-600)', fontWeight: 500 }}>{subject}</span>
                <span style={{ color: '#800000', fontWeight: 700 }}>{value.toFixed(0)}%</span>
              </div>
              <div style={{ background: 'var(--gray-100)', borderRadius: 999, height: 7 }}>
                <div style={{ width: `${value}%`, height: '100%', background: '#800000', borderRadius: 999, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Jobs + Action Plan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        <div style={sectionCardStyle}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.35rem', fontSize: '0.95rem' }}>{jobsTitle}</h3>
          <p style={{ color: isLowEmployability ? '#b45309' : 'var(--gray-500)', fontSize: '0.82rem', marginBottom: '0.65rem', lineHeight: 1.5 }}>{jobsNote}</p>

          {hasAnyJobRecommendations ? (
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {displayedJobRecommendations.map((job, i) => {
                const cosineEntry = (result.jobCosineScores || []).find(j => j.job === job);
                const scoreLabel = cosineEntry
                  ? Number(cosineEntry.jobScore).toFixed(3)
                  : null;
                return (
                  <li key={`${job}-${i}`} style={{ ...listItemStyle, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#800000', fontWeight: 700, flexShrink: 0, fontSize: '0.8rem', minWidth: 24 }}>#{i + 1}</span>
                      <span style={{ color: 'var(--gray-700)', lineHeight: 1.5, fontSize: '0.875rem' }}>{job}</span>
                    </div>
                    {scoreLabel !== null && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--gray-400)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        score <strong style={{ color: 'var(--gray-600)' }}>{scoreLabel}</strong>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div style={{ fontSize: '0.84rem', color: 'var(--gray-500)', background: '#f8fafc', border: '1px dashed var(--gray-300)', borderRadius: 10, padding: '0.85rem 0.95rem' }}>
              No job recommendations were returned for this prediction. Click Refresh Result to regenerate with the latest model output.
            </div>
          )}

          {/* How jobs were ranked */}
          <button
            onClick={() => setShowJobBreakdown(v => !v)}
            style={{ marginTop: '0.85rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-500)' }}
          >
            <span>How were these jobs ranked?</span>
            {showJobBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showJobBreakdown && (
            <div style={{ marginTop: '0.5rem', padding: '0.85rem', background: '#f8fafc', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--gray-600)', lineHeight: 1.75 }}>
              <div style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.4rem' }}>Ranking Formula (ECLAT + GMM Fusion)</div>
              <code style={{ display: 'block', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.4rem 0.65rem', fontSize: '0.76rem', marginBottom: '0.65rem' }}>
                Job Score = (β × GMM contribution) + ((1−β) × ECLAT score) &nbsp;·&nbsp; β = {result.scoreFusion?.beta ?? 0.7}
              </code>
              {result.scoreFusion && (() => {
                const gmmVal = result.scoreFusion.gmmContribution ?? 0;
                const eclatVal = result.scoreFusion.eclatContribution ?? 0;
                const isStale = gmmVal === 0 && eclatVal === 0;
                return isStale ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.76rem', color: '#92400e', marginBottom: '0.65rem' }}>
                    ⚠️ This prediction was saved before the model finished loading. Click <strong>Refresh Result</strong> to regenerate with full computations.
                  </div>
                ) : (
                  <div style={{ marginBottom: '0.65rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.76rem' }}>GMM contribution: <strong>{gmmVal.toFixed(4)}</strong></span>
                    <span style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.76rem' }}>ECLAT contribution: <strong>{eclatVal.toFixed(4)}</strong></span>
                  </div>
                );
              })()}
              {result.jobCosineScores?.length > 0 && (
                <div style={{ marginTop: '0.35rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>Top cosine scores</div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    {result.jobCosineScores.map((j, idx) => (
                      <div key={`${j.job}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 58px', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem' }}>
                        <div style={{ color: '#334155', fontWeight: idx < 5 ? 600 : 500 }}>{idx + 1}. {j.job}</div>
                        <div style={{ height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min((j.jobScore / (result.jobCosineScores[0]?.jobScore || 1)) * 100, 100)}%`, height: '100%', background: idx < 5 ? '#800000' : '#cbd5e1', borderRadius: 999 }} />
                        </div>
                        <div style={{ textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Number(j.jobScore).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {result.recommendations?.length > 0 && (
          <div style={sectionCardStyle}>
            <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.35rem', fontSize: '0.95rem' }}>Improvement Action Plan</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.76rem', marginBottom: '0.7rem', lineHeight: 1.5 }}>Generated from missing skills in matched ECLAT rules, filled with profile-gap advice.</p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {result.recommendations.slice(0, 5).map((r, i) => (
                <li key={i} style={{ ...listItemStyle, alignItems: 'flex-start' }}>
                  <span style={{ color: '#800000', fontWeight: 700, flexShrink: 0, fontSize: '0.8rem', minWidth: 24 }}>#{i + 1}</span>
                  <span style={{ color: 'var(--gray-700)', lineHeight: 1.55, fontSize: '0.875rem' }}>{r}</span>
                </li>
              ))}
            </ul>

            {/* How action plan was built */}
            <button
              onClick={() => setShowPlanBreakdown(v => !v)}
              style={{ marginTop: '0.85rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-500)' }}
            >
              <span>How was this plan built?</span>
              {showPlanBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showPlanBreakdown && (
              <div style={{ marginTop: '0.5rem', padding: '0.85rem', background: '#f8fafc', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--gray-600)', lineHeight: 1.75 }}>
                <div style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.5rem' }}>Profile Gap Analysis</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginBottom: '0.65rem' }}>
                  Action items are generated by identifying skills that appear in matched ECLAT rules for your target job but are missing from your current profile. Low-scoring areas trigger extra advice.
                </p>
                <div style={{ fontWeight: 600, color: 'var(--gray-500)', marginBottom: '0.35rem', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input Data &amp; Profile Gap Analysis</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.65rem' }}>
                  {scoreFactors.map(({ label, raw, norm, weight, pts }) => {
                    const pct = norm * 100;
                    const isWeak = pct < 70;
                    return (
                      <div key={label} style={{ background: '#fff', border: `1px solid ${isWeak ? '#fde68a' : '#e2e8f0'}`, borderRadius: 6, padding: '0.35rem 0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: isWeak ? '#b45309' : 'var(--gray-700)' }}>{label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isWeak ? '#b45309' : '#800000' }}>{pct.toFixed(1)}%</span>
                            {isWeak && <span style={{ fontSize: '0.68rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 999, padding: '1px 6px' }}>gap</span>}
                          </div>
                        </div>
                        <div style={{ background: 'var(--gray-100)', borderRadius: 999, height: 4, marginBottom: '0.25rem' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: isWeak ? '#f59e0b' : '#800000', borderRadius: 999 }} />
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>
                          <strong style={{ color: 'var(--gray-700)' }}>{raw}</strong> → {pct.toFixed(1)}% × {weight} × 100 = <strong style={{ color: isWeak ? '#b45309' : '#800000' }}>{pts.toFixed(2)}pts</strong>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.6rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6 }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#92400e' }}>Total Employability Score</span>
                    <span style={{ fontSize: '0.76rem', fontWeight: 900, color: '#800000' }}>{computedScore.toFixed(2)}%</span>
                  </div>
                </div>
                {result.matchedRules?.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, color: 'var(--gray-500)', marginBottom: '0.3rem', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ECLAT rules that triggered skill gap detection</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {result.matchedRules.slice(0, 5).map((r, i) => (
                        <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ color: '#800000', fontWeight: 600 }}>{r.rule}</span>
                          <span style={{ color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>conf {r.confidence?.toFixed(3)} · lift {r.lift?.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {showHistory && result.history?.length > 0 && (
        <div style={sectionCardStyle}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
            <Clock size={17} /> Result History
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[...result.history].reverse().map((h, i) => {
              const hColor = EMPLOYABILITY_STATUS_COLORS[h.employabilityStatus] || '#6b7280';
              const hDate = h.generatedAt ? new Date(h.generatedAt).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 10, flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--gray-800)' }}>{Number(h.employabilityScore).toFixed(1)}%</span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: hColor, border: `1px solid ${hColor}33`, background: `${hColor}12`, borderRadius: 999, padding: '2px 8px' }}>{h.employabilityStatus}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>{h.clusterLabel}</span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--gray-400)', marginTop: '0.2rem' }}>{hDate}</div>
                  </div>
                  <button
                    onClick={() => exportPDF({ employabilityScore: h.employabilityScore, employabilityStatus: h.employabilityStatus, clusterLabel: h.clusterLabel, inputSummary: h.inputSummary, jobRecommendations: [], recommendations: [], skillImprovementSuggestions: [] }, hDate)}
                    className="btn btn-sm btn-secondary"
                    style={{ gap: '0.35rem', fontSize: '0.77rem' }}
                  >
                    <FileText size={13} /> PDF
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
