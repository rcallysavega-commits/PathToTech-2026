import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Plus, Trash2, Save, Code2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { TECH_SKILLS } from '../../utils/constants';

const levelFromRating = (rating) => {
  const n = Number(rating);
  if (!Number.isFinite(n)) return 'Intermediate';
  if (n <= 3) return 'Beginner';
  if (n <= 7) return 'Intermediate';
  return 'Advanced';
};

const ratingFromLegacyLevel = (level) => {
  if (level === 'Beginner') return 3;
  if (level === 'Advanced') return 8;
  return 5;
};

export default function TechnicalSkillsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [technicalChoices, setTechnicalChoices] = useState(TECH_SKILLS);
  const [activeCategory, setActiveCategory] = useState(TECH_SKILLS[0]?.category || 'Programming Languages');

  useEffect(() => {
    fetchSkills();
  }, []);

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (!categoryParam) return;
    const exists = technicalChoices.some((c) => c.category === categoryParam);
    if (exists) {
      setActiveCategory(categoryParam);
    }
  }, [searchParams, technicalChoices]);

  const fetchSkills = async () => {
    try {
      // 1. Fetch admin-managed options first
      try {
        const optRes = await api.get('/skill-options/technical');
        const adminChoices = optRes.data?.data;
        if (Array.isArray(adminChoices) && adminChoices.length) {
          setTechnicalChoices(adminChoices);
          if (!adminChoices.some((c) => c.category === activeCategory)) {
            setActiveCategory(adminChoices[0].category);
          }
        }
      } catch (_) {
        // Fall back to ML dataset options or constants
        try {
          const options = await api.get('/ml/dataset-options');
          const incomingChoices = options.data?.data?.technicalSkills;
          if (Array.isArray(incomingChoices) && incomingChoices.length) {
            setTechnicalChoices(incomingChoices);
            if (!incomingChoices.some((c) => c.category === activeCategory)) {
              setActiveCategory(incomingChoices[0].category);
            }
          }
        } catch (_) {
          // Keep fallback constants if dataset options are unavailable.
        }
      }

      const res = await api.get(`/technical-skills/${user._id}`);
      const savedSkills = res.data?.data?.skills;
      if (Array.isArray(savedSkills) && savedSkills.length) {
        const normalized = savedSkills.map((s) => {
          const rating = Number.isFinite(Number(s.rating)) ? Number(s.rating) : ratingFromLegacyLevel(s.level);
          return {
            ...s,
            rating,
            level: levelFromRating(rating),
          };
        });
        setSkills(normalized);
      }
    } catch (_) {}
    setLoading(false);
  };

  const toggleSkill = (category, skillName) => {
    const exists = skills.find(s => s.category === category && s.skillName === skillName);
    if (exists) {
      setSkills(skills.filter(s => !(s.category === category && s.skillName === skillName)));
    } else {
      const rating = 5;
      setSkills([...skills, { category, skillName, rating, level: levelFromRating(rating) }]);
    }
  };

  const setRating = (category, skillName, rating) => {
    const parsed = Number(rating);
    setSkills(skills.map(s =>
      s.category === category && s.skillName === skillName
        ? { ...s, rating: parsed, level: levelFromRating(parsed) }
        : s
    ));
  };

  const isSelected = (category, skillName) => skills.some(s => s.category === category && s.skillName === skillName);
  const getRating = (category, skillName) => {
    const value = Number(skills.find(s => s.category === category && s.skillName === skillName)?.rating);
    return Number.isFinite(value) ? value : 5;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/technical-skills', { userId: user._id, skills });
      // Regenerate prediction with updated technical skills
      if (user?.studentNumber) {
        try {
          await api.post(`/predictions/${user.studentNumber}`);
        } catch (_) {}
      }
      window.dispatchEvent(new Event('ppt-prediction-refresh'));
      await Swal.fire({ title: 'Saved!', text: 'Technical skills updated.', icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Save Failed', text: err.response?.data?.message || 'Failed to save.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;

  const catData = technicalChoices.find(c => c.category === activeCategory);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Technical Skills</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Select your technical skills and rate yourself from 1 to 10</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{skills.length} skill{skills.length !== 1 ? 's' : ''} selected</span>
          <button onClick={handleSave} className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Save size={15} />Save</>}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {technicalChoices.map(c => {
          const count = skills.filter(s => s.category === c.category).length;
          return (
            <button key={c.category} onClick={() => setActiveCategory(c.category)}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
                background: activeCategory === c.category ? 'var(--maroon)' : 'white',
                color: activeCategory === c.category ? 'white' : 'var(--gray-600)',
                boxShadow: activeCategory === c.category ? 'var(--shadow)' : 'none',
                border: `1px solid ${activeCategory === c.category ? 'var(--maroon)' : 'var(--gray-200)'}`,
              }}>
              {c.category}
              {count > 0 && <span style={{ marginLeft: '0.4rem', background: activeCategory === c.category ? 'rgba(255,255,255,0.25)' : 'var(--maroon)', color: activeCategory === c.category ? 'white' : 'white', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.7rem' }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Skill Grid */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Code2 size={18} style={{ color: 'var(--maroon)' }} />{catData?.category}
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
          Choose skills, then rate yourself from 1 to 10. These ratings are used in prediction scoring.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {catData?.skills.map(skillName => {
            const selected = isSelected(activeCategory, skillName);
            return (
              <div key={skillName} style={{ border: `2px solid ${selected ? 'var(--maroon)' : 'var(--gray-200)'}`, borderRadius: 'var(--radius)', padding: '0.875rem', background: selected ? 'var(--maroon-pale)' : 'white', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: selected ? '0.75rem' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: selected ? 600 : 400, color: selected ? 'var(--maroon)' : 'var(--gray-700)', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={selected} onChange={() => toggleSkill(activeCategory, skillName)} style={{ accentColor: '#800000' }} />
                    {skillName}
                  </label>
                </div>
                {selected && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.35rem' }}>
                      Self-rating (1-10)
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={getRating(activeCategory, skillName)}
                      onChange={e => setRating(activeCategory, skillName, e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--maroon)', marginTop: '0.2rem' }}>
                      {getRating(activeCategory, skillName)} / 10
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {skills.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginTop: '1rem' }}>
          <h4 style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: '1rem' }}>Selected Skills ({skills.length})</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {skills.map(s => (
              <span key={`${s.category}-${s.skillName}`} className="badge badge-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem' }}>
                {s.skillName} · {Number.isFinite(Number(s.rating)) ? Number(s.rating) : 5}/10
                <button onClick={() => toggleSkill(s.category, s.skillName)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1 }}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
