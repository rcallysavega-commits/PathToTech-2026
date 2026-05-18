import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Code2, Heart, Award, BookOpen, Zap, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const COMPLETION_ITEMS = [
  { key: 'profile', icon: BookOpen, label: 'Complete Profile', path: '/dashboard/profile?focus=studentNumber', desc: 'Set student number, gender, and course' },
  { key: 'survey', icon: ClipboardList, label: 'Employability Survey', path: '/dashboard/survey', desc: 'Complete the 9-section survey' },
  { key: 'technical', icon: Code2, label: 'Technical Skills', path: '/dashboard/technical-skills?category=Programming%20Languages', desc: 'Add your programming & technical skills' },
  { key: 'soft', icon: Heart, label: 'Soft Skills', path: '/dashboard/soft-skills', desc: 'Rate your interpersonal skills' },
  { key: 'certifications', icon: Award, label: 'Certifications', path: '/dashboard/certifications', desc: 'List your certifications or mark none' },
  { key: 'grades', icon: BookOpen, label: 'Academic Grades', path: '/dashboard/grades', desc: 'Grades uploaded by faculty/admin' },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completion, setCompletion] = useState({ profile: false, survey: false, technical: false, soft: false, certifications: false, grades: false });
  const [loadingPred, setLoadingPred] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const autoGeneratePrediction = async () => {
    if (!user.studentNumber) return;
    setLoadingPred(true);
    try {
      const res = await api.post(`/predictions/${user.studentNumber}`);
      setResult(res.data?.prediction || null);
    } catch (error) {
      console.error('Auto-generate prediction failed:', error?.response?.data || error?.message || error);
    } finally {
      setLoadingPred(false);
    }
  };

  const fetchCompletion = useCallback(async () => {
    setLoading(true);
    try {
      const userId = user._id;
      const sn = user.studentNumber;

      const [surveyRes, techRes, softRes, certRes, gradeRes] = await Promise.allSettled([
        api.get(`/responses/user/${userId}`),
        api.get(`/technical-skills/${userId}`),
        api.get(`/soft-skills/${userId}`),
        api.get(`/certifications/${userId}`),
        sn ? api.get(`/grades/check-complete/${sn}`) : Promise.resolve({ data: { isComplete: false } }),
      ]);

      const newCompletion = {
        profile: Boolean(user?.studentNumber && user?.gender && user?.major),
        survey: surveyRes.value?.data?.response?.completed ?? false,
        technical: techRes.value?.data?.data?.completed ?? false,
        soft: softRes.value?.data?.data?.completed ?? false,
        certifications: certRes.value?.data?.data?.completed ?? false,
        grades: gradeRes.value?.data?.isComplete ?? false,
      };
      setCompletion(newCompletion);

      // Fetch existing result
      let existingResult = null;
      try {
        const resultRes = await api.get('/predictions/my/result');
        existingResult = resultRes.data?.result || null;
        setResult(existingResult);
      } catch (_) {}

      // Auto-generate if all complete and no result yet
      const allDone = Object.values(newCompletion).every(Boolean);
      if (allDone && !existingResult && sn) {
        setLoading(false);
        setLoadingPred(true);
        try {
          const res = await api.post(`/predictions/${sn}`);
          setResult(res.data?.prediction || null);
        } catch (error) {
          console.error('Background prediction generation failed:', error?.response?.data || error?.message || error);
        }
        setLoadingPred(false);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.studentNumber, user?.gender, user?.major]);

  useEffect(() => {
    fetchCompletion();
    const onStudentSync = () => fetchCompletion();
    window.addEventListener('ppt-student-sync', onStudentSync);
    window.addEventListener('ppt-prediction-refresh', onStudentSync);
    window.addEventListener('ppt-grades-refresh', onStudentSync);
    return () => {
      window.removeEventListener('ppt-student-sync', onStudentSync);
      window.removeEventListener('ppt-prediction-refresh', onStudentSync);
      window.removeEventListener('ppt-grades-refresh', onStudentSync);
    };
  }, [fetchCompletion]);

  const completedCount = Object.values(completion).filter(Boolean).length;
  const allComplete = completedCount === COMPLETION_ITEMS.length;
  const fmtNum = (value, digits = 1, fallback = 'N/A') => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : fallback;
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;
  }

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{ background: 'linear-gradient(135deg, var(--maroon) 0%, #600000 100%)', color: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>
          Welcome back, {user.fullName?.split(' ')[0]}! 👋
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.9rem' }}>
          {user.studentNumber ? `Student No.: ${user.studentNumber}` : 'Please update your profile with your student number.'} &nbsp;·&nbsp; {user.major || 'No major set'}
        </p>
      </div>

      {/* Progress Summary */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.2rem' }}>Profile Completion</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{completedCount} of {COMPLETION_ITEMS.length} sections completed</p>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: completedCount === COMPLETION_ITEMS.length ? '#059669' : 'var(--maroon)' }}>
            {Math.round((completedCount / COMPLETION_ITEMS.length) * 100)}%
          </div>
        </div>
        <div style={{ background: 'var(--gray-100)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${(completedCount / COMPLETION_ITEMS.length) * 100}%`, height: '100%', background: completedCount === COMPLETION_ITEMS.length ? '#059669' : 'var(--maroon)', borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Completion Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {COMPLETION_ITEMS.map(({ key, icon: Icon, label, path, desc }) => {
          const done = completion[key];
          const targetPath = key === 'grades' && !user?.studentNumber
            ? '/dashboard/profile?focus=studentNumber'
            : path;
          return (
            <div
              key={key}
              onClick={() => navigate(targetPath)}
              style={{
                background: 'white', border: `2px solid ${done ? '#d1fae5' : 'var(--gray-100)'}`,
                borderRadius: 'var(--radius-lg)', padding: '1.25rem',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = done ? '#6ee7b7' : 'var(--maroon)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = done ? '#d1fae5' : 'var(--gray-100)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ width: 40, height: 40, background: done ? '#d1fae5' : 'var(--maroon-pale)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: done ? '#059669' : 'var(--maroon)' }}>
                  <Icon size={18} />
                </div>
                {done ? <CheckCircle size={20} style={{ color: '#059669' }} /> : <AlertCircle size={20} style={{ color: '#f59e0b' }} />}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>{label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>{desc}</div>
              <div style={{ marginTop: '0.625rem', fontSize: '0.78rem', fontWeight: 600, color: done ? '#059669' : '#f59e0b' }}>
                {done
                  ? '✓ Completed'
                  : key === 'grades' && !user?.studentNumber
                  ? 'Incomplete — click to complete profile first'
                  : key === 'grades'
                  ? 'Awaiting upload'
                  : 'Incomplete — click to complete'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Prediction Status + Result Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: allComplete ? 'var(--maroon)' : 'var(--gray-100)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: allComplete ? 'white' : 'var(--gray-400)' }}>
            {loadingPred ? <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3, borderTopColor: 'white' }}></span> : <Zap size={26} />}
          </div>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
            {loadingPred ? 'Generating your prediction…' : allComplete ? (result ? 'Prediction Up to Date' : 'Ready to Predict!') : 'Complete All Sections First'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            {loadingPred
              ? 'Analyzing your grades, survey, skills, and certifications. This will only take a moment.'
              : allComplete
              ? result
                ? 'Your employability prediction has been generated. You can regenerate it any time.'
                : 'All your data is ready. Your prediction is being generated automatically.'
              : `${COMPLETION_ITEMS.length - completedCount} more section(s) needed before a prediction can be generated.`}
          </p>
          {allComplete && !loadingPred && (
            <button
              onClick={autoGeneratePrediction}
              className="btn btn-primary"
              style={{ justifyContent: 'center', gap: '0.5rem' }}
              disabled={!user.studentNumber}
            >
              <Zap size={16} /> {result ? 'Regenerate Prediction' : 'Generate Now'}
            </button>
          )}
        </div>

        {result && (
          <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '2rem', cursor: 'pointer' }} onClick={() => navigate('/dashboard/result')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Latest Prediction</h3>
              <ArrowRight size={18} style={{ color: 'var(--gray-400)' }} />
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--maroon)', marginBottom: '0.25rem' }}>
              {fmtNum(result.employabilityScore, 1)}%
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span className={`badge ${result.employabilityStatus === 'High Employability' ? 'badge-success' : result.employabilityStatus === 'Moderate Employability' ? 'badge-warning' : 'badge-danger'}`}>
                {result.employabilityStatus}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
              Career Track: <strong style={{ color: 'var(--gray-700)' }}>{result.clusterLabel}</strong>
            </div>
            <div style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--maroon)', fontWeight: 600 }}>
              View full results & recommendations →
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
