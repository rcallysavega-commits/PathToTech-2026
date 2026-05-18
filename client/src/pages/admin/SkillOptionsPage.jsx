import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Plus, Trash2, Save, Code2, Brain, FolderPlus } from 'lucide-react';
import api from '../../services/api';

const TABS = ['Technical Skills', 'Soft Skills'];

export default function SkillOptionsPage() {
  const [activeTab, setActiveTab] = useState('Technical Skills');

  // --- Technical Skills state ---
  const [techCategories, setTechCategories] = useState([]);
  const [techLoading, setTechLoading] = useState(true);
  const [techSaving, setTechSaving] = useState(false);

  // --- Soft Skills state ---
  const [softItems, setSoftItems] = useState([]);
  const [softLoading, setSoftLoading] = useState(true);
  const [softSaving, setSoftSaving] = useState(false);

  useEffect(() => {
    fetchTech();
    fetchSoft();
  }, []);

  const fetchTech = async () => {
    setTechLoading(true);
    try {
      const res = await api.get('/skill-options/technical');
      setTechCategories(res.data?.data || []);
    } catch {
      setTechCategories([]);
    }
    setTechLoading(false);
  };

  const fetchSoft = async () => {
    setSoftLoading(true);
    try {
      const res = await api.get('/skill-options/soft');
      setSoftItems(res.data?.data || []);
    } catch {
      setSoftItems([]);
    }
    setSoftLoading(false);
  };

  // ======================== Technical Skills Handlers ========================

  const addCategory = () => {
    setTechCategories(prev => [...prev, { category: '', skills: [] }]);
  };

  const removeCategory = (ci) => {
    setTechCategories(prev => prev.filter((_, i) => i !== ci));
  };

  const updateCategoryName = (ci, value) => {
    setTechCategories(prev => prev.map((cat, i) => i === ci ? { ...cat, category: value } : cat));
  };

  const addSkill = (ci) => {
    setTechCategories(prev => prev.map((cat, i) =>
      i === ci ? { ...cat, skills: [...cat.skills, ''] } : cat
    ));
  };

  const updateSkill = (ci, si, value) => {
    setTechCategories(prev => prev.map((cat, i) =>
      i === ci
        ? { ...cat, skills: cat.skills.map((s, j) => j === si ? value : s) }
        : cat
    ));
  };

  const removeSkill = (ci, si) => {
    setTechCategories(prev => prev.map((cat, i) =>
      i === ci ? { ...cat, skills: cat.skills.filter((_, j) => j !== si) } : cat
    ));
  };

  const saveTech = async () => {
    // Validate
    for (const cat of techCategories) {
      if (!cat.category.trim()) {
        await Swal.fire({ title: 'Validation Error', text: 'Category name cannot be empty.', icon: 'warning', confirmButtonColor: '#800000' });
        return;
      }
      const nonEmpty = cat.skills.filter(s => s.trim());
      if (!nonEmpty.length) {
        await Swal.fire({ title: 'Validation Error', text: `Category "${cat.category}" must have at least one skill.`, icon: 'warning', confirmButtonColor: '#800000' });
        return;
      }
    }
    const cleaned = techCategories.map(cat => ({ category: cat.category.trim(), skills: cat.skills.map(s => s.trim()).filter(Boolean) }));
    setTechSaving(true);
    try {
      await api.put('/skill-options/technical', { categories: cleaned });
      setTechCategories(cleaned);
      await Swal.fire({ title: 'Saved!', text: 'Technical skill options updated.', icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Save Failed', text: err.response?.data?.message || 'Failed to save.', icon: 'error', confirmButtonColor: '#800000' });
    }
    setTechSaving(false);
  };

  // ======================== Soft Skills Handlers ========================

  const addSoftSkill = () => {
    setSoftItems(prev => [...prev, { key: '', label: '' }]);
  };

  const removeSoftSkill = (i) => {
    setSoftItems(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateSoftKey = (i, value) => {
    // Auto-derive camelCase key from label if key is still empty
    setSoftItems(prev => prev.map((item, idx) => idx === i ? { ...item, key: value } : item));
  };

  const updateSoftLabel = (i, value) => {
    setSoftItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      // If the key hasn't been manually changed, auto-generate from label
      const autoKey = value.replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, c => c.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '');
      const currentKey = item.key;
      // Only auto-update key if it looks auto-generated (no spaces, camelCase or matches old auto)
      const oldAutoKey = item.label.replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, c => c.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '');
      const shouldAutoUpdate = currentKey === '' || currentKey === oldAutoKey;
      return { ...item, label: value, key: shouldAutoUpdate ? autoKey : currentKey };
    }));
  };

  const saveSoft = async () => {
    for (const item of softItems) {
      if (!item.key.trim() || !item.label.trim()) {
        await Swal.fire({ title: 'Validation Error', text: 'Each soft skill must have a Key and a Label.', icon: 'warning', confirmButtonColor: '#800000' });
        return;
      }
    }
    const cleaned = softItems.map(item => ({ key: item.key.trim(), label: item.label.trim() }));
    // Check duplicate keys
    const keys = cleaned.map(i => i.key);
    if (new Set(keys).size !== keys.length) {
      await Swal.fire({ title: 'Duplicate Keys', text: 'Each soft skill must have a unique key.', icon: 'warning', confirmButtonColor: '#800000' });
      return;
    }
    setSoftSaving(true);
    try {
      await api.put('/skill-options/soft', { items: cleaned });
      setSoftItems(cleaned);
      await Swal.fire({ title: 'Saved!', text: 'Soft skill options updated.', icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Save Failed', text: err.response?.data?.message || 'Failed to save.', icon: 'error', confirmButtonColor: '#800000' });
    }
    setSoftSaving(false);
  };

  // ======================== Render ========================

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Skill Options Manager</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
          Define the technical and soft skill choices that students see when filling their profile.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--gray-100)' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? 'var(--maroon)' : 'var(--gray-500)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--maroon)' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {tab === 'Technical Skills' ? <Code2 size={15} /> : <Brain size={15} />}
            {tab}
          </button>
        ))}
      </div>

      {/* ============= TECHNICAL SKILLS TAB ============= */}
      {activeTab === 'Technical Skills' && (
        <div>
          {techLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner" /></div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
                <button onClick={addCategory} className="btn btn-secondary" style={{ gap: '0.4rem' }}>
                  <FolderPlus size={15} /> Add Category
                </button>
                <button onClick={saveTech} className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={techSaving}>
                  {techSaving ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2, borderTopColor: 'white' }} /> : <><Save size={15} />Save Changes</>}
                </button>
              </div>

              {techCategories.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)', background: 'white', borderRadius: 'var(--radius)', border: '1px dashed var(--gray-200)' }}>
                  No categories yet. Click "Add Category" to start.
                </div>
              )}

              {techCategories.map((cat, ci) => (
                <div key={ci} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <input
                      value={cat.category}
                      onChange={e => updateCategoryName(ci, e.target.value)}
                      placeholder="Category name (e.g. Programming Languages)"
                      style={{ flex: 1, padding: '0.45rem 0.75rem', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600 }}
                    />
                    <button onClick={() => removeCategory(ci)} title="Remove category" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                      <Trash2 size={17} />
                    </button>
                  </div>

                  {/* Skills grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {cat.skills.map((skill, si) => (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 20, padding: '0.2rem 0.5rem 0.2rem 0.75rem', gap: '0.35rem' }}>
                        <input
                          value={skill}
                          onChange={e => updateSkill(ci, si, e.target.value)}
                          placeholder="Skill name"
                          style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', outline: 'none', minWidth: 60, maxWidth: 140 }}
                        />
                        <button onClick={() => removeSkill(ci, si)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, lineHeight: 1, display: 'flex' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addSkill(ci)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', border: '1px dashed var(--gray-300)', borderRadius: 20, padding: '0.2rem 0.65rem', background: 'none', cursor: 'pointer', color: 'var(--gray-500)', fontSize: '0.8rem' }}>
                      <Plus size={13} /> Add Skill
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: 0 }}>{cat.skills.filter(s => s.trim()).length} skill(s)</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ============= SOFT SKILLS TAB ============= */}
      {activeTab === 'Soft Skills' && (
        <div>
          {softLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner" /></div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
                <button onClick={addSoftSkill} className="btn btn-secondary" style={{ gap: '0.4rem' }}>
                  <Plus size={15} /> Add Soft Skill
                </button>
                <button onClick={saveSoft} className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={softSaving}>
                  {softSaving ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2, borderTopColor: 'white' }} /> : <><Save size={15} />Save Changes</>}
                </button>
              </div>

              <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)', width: '40%' }}>Label (shown to students)</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)', width: '40%' }}>Key (internal, camelCase)</th>
                      <th style={{ padding: '0.65rem 1rem', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {softItems.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                          No soft skills yet. Click "Add Soft Skill" to start.
                        </td>
                      </tr>
                    )}
                    {softItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '0.5rem 1rem' }}>
                          <input
                            value={item.label}
                            onChange={e => updateSoftLabel(i, e.target.value)}
                            placeholder="e.g. Communication"
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 1rem' }}>
                          <input
                            value={item.key}
                            onChange={e => updateSoftKey(i, e.target.value)}
                            placeholder="e.g. communication"
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'monospace' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <button onClick={() => removeSoftSkill(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: '0.5rem' }}>
                The <strong>Key</strong> must be unique and camelCase (e.g. <code>problemSolving</code>). It is used internally to store student scores. Changing a key will clear existing student data for that skill.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
