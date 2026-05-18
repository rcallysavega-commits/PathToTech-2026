import { useState, useEffect, useCallback } from 'react';
import { BookOpen, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function MyGradesPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadGrades = useCallback(() => {
    if (!user?.studentNumber) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    api.get(`/grades/${encodeURIComponent(user.studentNumber)}`)
      .then((res) => { setData(res.data); })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to load grades. Please try again.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [user?.studentNumber]);

  useEffect(() => {
    loadGrades();
    const onGradesRefresh = () => loadGrades();
    window.addEventListener('ppt-grades-refresh', onGradesRefresh);
    window.addEventListener('ppt-student-sync', onGradesRefresh);
    return () => {
      window.removeEventListener('ppt-grades-refresh', onGradesRefresh);
      window.removeEventListener('ppt-student-sync', onGradesRefresh);
    };
  }, [loadGrades]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;

  if (!user?.studentNumber) return (
    <div className="alert alert-warning">
      Please update your <strong>student number</strong> in your profile to view your grades.
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid #fca5a5' }}>
      <BookOpen size={48} style={{ color: '#dc2626', marginBottom: '0.75rem' }} />
      <h3 style={{ fontWeight: 700, color: '#dc2626' }}>Could Not Load Grades</h3>
      <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>
      <p style={{ color: 'var(--gray-400)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Student No: <strong>{user.studentNumber}</strong> — make sure this matches what was uploaded in the CSV.</p>
    </div>
  );

  if (!data || !data.grades?.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
      <BookOpen size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.75rem' }} />
      <h3 style={{ fontWeight: 700, color: 'var(--gray-600)' }}>No Grades Found</h3>
      <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', marginTop: '0.5rem' }}>No grades found for student number <strong>{user.studentNumber}</strong>.</p>
      <p style={{ color: 'var(--gray-400)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Make sure your student number exactly matches what was uploaded in the CSV.</p>
    </div>
  );

  const getGradeColor = (g) => {
    const n = parseFloat(g);
    if (Number.isNaN(n)) return 'var(--gray-600)';
    return n <= 1.5 ? '#059669' : n <= 2.5 ? '#2563eb' : n <= 3.0 ? '#d97706' : n <= 3.5 ? '#ea580c' : '#dc2626';
  };

  const formatGrade = (g) => {
    const n = parseFloat(g);
    return Number.isNaN(n) ? g : n.toFixed(2);
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>My Grades</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Student No: {user.studentNumber}</p>
      </div>

      {/* GWA Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={20} /></div>
          <div className="stat-value">{typeof data.gwa === 'number' ? data.gwa.toFixed(2) : 'N/A'}</div>
            <div className="stat-label">GWA</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><BookOpen size={20} /></div>
          <div className="stat-value">{data.totalUnits}</div>
          <div className="stat-label">Total Units</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TrendingDown size={20} /></div>
          <div className="stat-value">{data.grades?.length}</div>
          <div className="stat-label">Subjects</div>
        </div>
      </div>

      {/* Grades Table */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--gray-100)', fontWeight: 700, color: 'var(--gray-700)' }}>
          Subject Grades
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Subject Code</th>
                <th>Subject Title</th>
                <th>Units</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {data.grades.map((g, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--maroon)' }}>{g.subjectCode}</td>
                  <td>{g.subjectTitle}</td>
                  <td>{g.units}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: getGradeColor(g.grade) }}>{formatGrade(g.grade)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', display: 'flex', justifyContent: 'flex-end', gap: '2rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Total Units: <strong>{data.totalUnits}</strong></span>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--maroon)' }}>GWA: {typeof data.gwa === 'number' ? data.gwa.toFixed(4) : 'N/A'}</span>
        </div>
      </div>

      <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--gray-400)' }}>
        * GWA is computed from numeric grades only. Text grades (e.g. INC, Satisfactory, Outstanding) are shown but excluded from GWA.
      </p>
    </div>
  );
}
