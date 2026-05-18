import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { SOFT_SKILLS, LIKERT_LABELS } from '../../utils/constants';

export default function SoftSkillsPage() {
  const { user } = useAuth();
  const [scores, setScores] = useState({});
  const [softSkillChoices, setSoftSkillChoices] = useState(SOFT_SKILLS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // 1. Fetch admin-managed options first
        try {
          const optRes = await api.get('/skill-options/soft');
          const adminSkills = optRes.data?.data;
          if (Array.isArray(adminSkills) && adminSkills.length) {
            setSoftSkillChoices(adminSkills);
          }
        } catch (_) {
          // Fall back to ML dataset options or constants
          try {
            const options = await api.get('/ml/dataset-options');
            const incomingSoftSkills = options.data?.data?.softSkills;
            if (Array.isArray(incomingSoftSkills) && incomingSoftSkills.length) {
              const aligned = incomingSoftSkills.filter((item) => item?.key);
              if (aligned.length) {
                setSoftSkillChoices(aligned);
              }
            }
          } catch (_) {
            // Keep fallback constants if dataset options are unavailable.
          }
        }

        const res = await api.get(`/soft-skills/${user._id}`);
        if (res.data?.data?.scores) setScores(res.data.data.scores);
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const setScore = (key, value) => setScores(prev => ({ ...prev, [key]: value }));

  const average = softSkillChoices.length
    ? softSkillChoices.reduce((sum, item) => sum + Number(scores[item.key] || 0), 0) / softSkillChoices.length
    : 0;

  const handleSave = async () => {
    const allRated = softSkillChoices.every(s => scores[s.key] > 0);
    if (!allRated) {
      await Swal.fire({ title: 'Incomplete', text: 'Please rate all soft skills.', icon: 'warning', confirmButtonColor: '#800000' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/soft-skills', { userId: user._id, scores });
      // Regenerate prediction with updated soft skills
      if (user?.studentNumber) {
        try {
          await api.post(`/predictions/${user.studentNumber}`);
        } catch (_) {}
      }
      window.dispatchEvent(new Event('ppt-prediction-refresh'));
      await Swal.fire({ title: 'Saved!', text: 'Soft skills updated.', icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Save Failed', text: err.response?.data?.message || 'Failed to save.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Soft Skills Assessment</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Rate yourself on a scale of 1–5 for each soft skill</p>
        </div>
        <button onClick={handleSave} className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Save size={15} />Save</>}
        </button>
      </div>

      {/* Likert legend */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.875rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 600 }}>Rating Scale:</span>
        {Object.entries(LIKERT_LABELS).map(([v, l]) => (
          <span key={v} style={{ fontSize: '0.78rem', color: 'var(--gray-600)' }}><strong style={{ color: 'var(--maroon)' }}>{v}</strong> = {l}</span>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {softSkillChoices.map((skill, idx) => {
          const val = scores[skill.key] || 0;
          return (
            <div key={skill.key} style={{ padding: '1.25rem 1.5rem', borderBottom: idx < softSkillChoices.length - 1 ? '1px solid var(--gray-50)' : 'none', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, color: 'var(--gray-800)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{skill.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{skill.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setScore(skill.key, n)}
                    style={{ width: 42, height: 42, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', transition: 'all 0.15s',
                      background: val === n ? 'var(--maroon)' : val > 0 && n <= val ? '#fbd0d0' : 'var(--gray-100)',
                      color: val === n ? 'white' : val > 0 && n <= val ? 'var(--maroon)' : 'var(--gray-500)',
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              {val > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--maroon)', fontWeight: 600, minWidth: 80 }}>{LIKERT_LABELS[val]}</span>}
            </div>
          );
        })}
      </div>

      {average > 0 && (
        <div style={{ background: 'var(--maroon)', color: 'white', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Average Soft Skills Score</div>
            <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>Based on {softSkillChoices.length} soft skills</div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{average.toFixed(2)}<span style={{ fontSize: '1rem', opacity: 0.7 }}> / 5.0</span></div>
        </div>
      )}
    </div>
  );
}
