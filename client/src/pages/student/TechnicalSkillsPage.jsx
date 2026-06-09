import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Trash2, Save, Code2, Info, Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { TECH_SKILLS } from '../../utils/constants';

const RATING_META = [
  null,
  { label: 'Very Poor',    color: '#dc2626', bg: '#fef2f2', track: '#fca5a5' },
  { label: 'Poor',         color: '#ea580c', bg: '#fff7ed', track: '#fdba74' },
  { label: 'Below Average',color: '#d97706', bg: '#fffbeb', track: '#fcd34d' },
  { label: 'Fair',         color: '#ca8a04', bg: '#fefce8', track: '#fde68a' },
  { label: 'Average',      color: '#65a30d', bg: '#f7fee7', track: '#a3e635' },
  { label: 'Satisfactory', color: '#16a34a', bg: '#f0fdf4', track: '#6ee7b7' },
  { label: 'Good',         color: '#0d9488', bg: '#f0fdfa', track: '#5eead4' },
  { label: 'Very Good',    color: '#2563eb', bg: '#eff6ff', track: '#93c5fd' },
  { label: 'Excellent',    color: '#7c3aed', bg: '#f5f3ff', track: '#c4b5fd' },
  { label: 'Outstanding',  color: '#800000', bg: '#fff1f1', track: '#fca5a5' },
];

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
  const [otherInput, setOtherInput] = useState('');

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

  const addOtherSkill = () => {
    const name = otherInput.trim();
    if (!name) return;
    const alreadyExists = skills.some(
      s => s.category === activeCategory && s.skillName.toLowerCase() === name.toLowerCase()
    );
    if (alreadyExists) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Skill already added.', showConfirmButton: false, timer: 2000 });
      return;
    }
    setSkills(prev => [...prev, { category: activeCategory, skillName: name, rating: 5, level: levelFromRating(5), isCustom: true }]);
    setOtherInput('');
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
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--maroon)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Code2 size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Technical Skills</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', margin: 0 }}>Select skills and rate yourself from 1 (Very Poor) to 10 (Outstanding)</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {skills.length > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)', background: 'var(--gray-100)', borderRadius: 20, padding: '0.3rem 0.8rem', fontWeight: 600 }}>
              {skills.length} skill{skills.length !== 1 ? 's' : ''} selected
            </span>
          )}
          <button onClick={handleSave} className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Save size={14} />Save Skills</>}
          </button>
        </div>
      </div>

      {/* ── Rating Scale Guide ── */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <Info size={13} color="var(--gray-400)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rating Scale Guide</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
          {RATING_META.slice(1).map((meta, i) => {
            const score = i + 1;
            return (
              <div key={score} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: meta.bg, border: `1.5px solid ${meta.color}30`, borderRadius: 9, padding: '0.4rem 0.65rem' }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: meta.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', flexShrink: 0, boxShadow: `0 2px 6px ${meta.color}55` }}>
                  {score}
                </div>
                <span style={{ fontSize: '0.73rem', fontWeight: 600, color: meta.color, lineHeight: 1.25 }}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {technicalChoices.map(c => {
          const count = skills.filter(s => s.category === c.category).length;
          const active = activeCategory === c.category;
          return (
            <button key={c.category} onClick={() => setActiveCategory(c.category)}
              style={{
                padding: '0.45rem 1rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                background: active ? 'var(--maroon)' : 'white',
                color: active ? 'white' : 'var(--gray-600)',
                border: `1.5px solid ${active ? 'var(--maroon)' : 'var(--gray-200)'}`,
                boxShadow: active ? '0 2px 8px rgba(128,0,0,0.25)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
              {c.category}
              {count > 0 && (
                <span style={{ background: active ? 'rgba(255,255,255,0.28)' : 'var(--maroon)', color: 'white', borderRadius: 99, padding: '0.05rem 0.45rem', fontSize: '0.68rem', fontWeight: 700 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Skill Cards ── */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', margin: '0 0 0.35rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Code2 size={17} style={{ color: 'var(--maroon)' }} />{catData?.category}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', margin: '0 0 1.25rem 0' }}>
          Check a skill to select it, then drag the slider to set your proficiency level.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.75rem' }}>
          {catData?.skills.map(skillName => {
            const selected = isSelected(activeCategory, skillName);
            const rating = getRating(activeCategory, skillName);
            const meta = RATING_META[rating];
            return (
              <div
                key={skillName}
                style={{
                  border: `2px solid ${selected ? meta.color : 'var(--gray-200)'}`,
                  borderRadius: 11,
                  padding: '0.85rem',
                  background: selected ? meta.bg : 'var(--gray-50)',
                  transition: 'all 0.15s',
                  cursor: selected ? 'default' : 'pointer',
                }}
                onClick={() => !selected && toggleSkill(activeCategory, skillName)}
              >
                {/* Skill name + checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', marginBottom: selected ? '0.85rem' : 0 }}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSkill(activeCategory, skillName)}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: selected ? meta.color : '#800000', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontWeight: selected ? 700 : 500, color: selected ? meta.color : 'var(--gray-700)', fontSize: '0.875rem', lineHeight: 1.3 }}>
                    {skillName}
                  </span>
                </label>

                {/* Slider + rating badge */}
                {selected && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600 }}>Proficiency</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: meta.color, color: 'white', borderRadius: 20, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, boxShadow: `0 2px 6px ${meta.color}55` }}>
                        {rating} · {meta.label}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={rating}
                      onChange={e => setRating(activeCategory, skillName, e.target.value)}
                      style={{ width: '100%', accentColor: meta.color }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--gray-300)', marginTop: '0.1rem' }}>
                      <span>1</span><span>5</span><span>10</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Other / Custom Skills ── */}
        <div style={{ marginTop: '1.25rem', borderTop: '1px dashed var(--gray-200)', paddingTop: '1.1rem' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.65rem 0' }}>
            Add Other Skill under "{activeCategory}"
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={otherInput}
              onChange={e => setOtherInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOtherSkill()}
              placeholder="e.g. Tailwind CSS, Docker, Figma…"
              style={{ flex: 1, minWidth: 200, padding: '0.55rem 0.85rem', border: '1.5px solid var(--gray-200)', borderRadius: 9, fontSize: '0.875rem', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#800000'}
              onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
            />
            <button
              onClick={addOtherSkill}
              disabled={!otherInput.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem', background: otherInput.trim() ? 'var(--maroon)' : 'var(--gray-200)', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.82rem', cursor: otherInput.trim() ? 'pointer' : 'not-allowed' }}
            >
              <Plus size={14} /> Add Skill
            </button>
          </div>

          {/* Custom skills for this category */}
          {skills.filter(s => s.category === activeCategory && s.isCustom).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.75rem', marginTop: '0.85rem' }}>
              {skills.filter(s => s.category === activeCategory && s.isCustom).map(s => {
                const r = getRating(activeCategory, s.skillName);
                const m = RATING_META[r];
                return (
                  <div key={s.skillName} style={{ border: `2px solid ${m.color}`, borderRadius: 11, padding: '0.85rem', background: m.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: m.color, flex: 1, lineHeight: 1.3 }}>{s.skillName}</span>
                      <button
                        onClick={() => toggleSkill(activeCategory, s.skillName)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 0.4rem', color: m.color, opacity: 0.6, display: 'flex', alignItems: 'center' }}
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600 }}>Proficiency</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: m.color, color: 'white', borderRadius: 20, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>
                        {r} · {m.label}
                      </span>
                    </div>
                    <input
                      type="range" min={1} max={10} step={1} value={r}
                      onChange={e => setRating(activeCategory, s.skillName, e.target.value)}
                      style={{ width: '100%', accentColor: m.color }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--gray-300)', marginTop: '0.1rem' }}>
                      <span>1</span><span>5</span><span>10</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Selected summary ── */}
      {skills.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '1.25rem 1.5rem', marginTop: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h4 style={{ fontWeight: 700, color: 'var(--gray-700)', margin: '0 0 0.85rem 0', fontSize: '0.9rem' }}>
            All Selected Skills <span style={{ color: 'var(--gray-400)', fontWeight: 500 }}>({skills.length})</span>
          </h4>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {skills.map(s => {
              const r = Number.isFinite(Number(s.rating)) ? Number(s.rating) : 5;
              const m = RATING_META[r];
              return (
                <span
                  key={`${s.category}-${s.skillName}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: m.bg, border: `1.5px solid ${m.color}40`, color: m.color, borderRadius: 20, padding: '0.3rem 0.65rem 0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600 }}
                >
                  {s.skillName}
                  <span style={{ background: m.color, color: 'white', borderRadius: 99, padding: '0.05rem 0.4rem', fontSize: '0.68rem', fontWeight: 800 }}>{r}</span>
                  <button
                    onClick={() => toggleSkill(s.category, s.skillName)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: m.color, lineHeight: 1, display: 'flex', alignItems: 'center', opacity: 0.7 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
