import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Plus, Pencil, Trash2, Eye, EyeOff, HelpCircle, X, Save, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

const emptyForm = { question: '', answer: '', isVisible: true };

export default function FAQManagementPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const fetchFAQs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/faqs?all=true');
      setFaqs(res.data?.data || []);
    } catch {
      setFaqs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFAQs(); }, [fetchFAQs]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setFormError(''); setModalOpen(true); };
  const openEdit = (faq) => { setEditingId(faq._id); setForm({ question: faq.question, answer: faq.answer, isVisible: faq.isVisible }); setFormError(''); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); setFormError(''); };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) { setFormError('Question and answer are both required.'); return; }
    setSaving(true);
    try {
      if (editingId) { await api.put(`/faqs/${editingId}`, form); }
      else { await api.post('/faqs', { ...form, order: faqs.length }); }
      await fetchFAQs();
      closeModal();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: editingId ? 'FAQ updated.' : 'FAQ added.', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch { setFormError('Failed to save. Please try again.'); }
    setSaving(false);
  };

  const toggleVisible = async (faq) => {
    try {
      await api.put(`/faqs/${faq._id}`, { isVisible: !faq.isVisible });
      setFaqs(prev => prev.map(f => f._id === faq._id ? { ...f, isVisible: !f.isVisible } : f));
    } catch {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Failed to update visibility.', showConfirmButton: false, timer: 2000 });
    }
  };

  const handleDelete = async (faq) => {
    const result = await Swal.fire({
      title: 'Delete FAQ?',
      html: `<span style="font-size:0.88rem;color:#374151">"${faq.question}"</span>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#800000', cancelButtonColor: '#6b7280', confirmButtonText: 'Yes, delete',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/faqs/${faq._id}`);
      setFaqs(prev => prev.filter(f => f._id !== faq._id));
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'FAQ deleted.', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Failed to delete.', showConfirmButton: false, timer: 2000 });
    }
  };

  const moveItem = async (index, direction) => {
    const newList = [...faqs];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newList.length) return;
    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    const withOrder = newList.map((f, i) => ({ ...f, order: i }));
    setFaqs(withOrder);
    try { await api.put('/faqs/reorder', { items: withOrder.map(f => ({ _id: f._id, order: f.order })) }); }
    catch { fetchFAQs(); }
  };

  const visibleCount = faqs.filter(f => f.isVisible).length;
  const hiddenCount = faqs.length - visibleCount;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* â”€â”€ Page Header â”€â”€ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--maroon)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(128,0,0,0.25)', flexShrink: 0 }}>
            <HelpCircle size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--gray-900)', margin: 0 }}>FAQ Management</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.15rem 0 0 0' }}>
              Manage questions and answers shown to students
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: 'var(--maroon)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(128,0,0,0.3)', whiteSpace: 'nowrap' }}
        >
          <Plus size={16} /> Add FAQ
        </button>
      </div>

      {/* â”€â”€ Stats row â”€â”€ */}
      {faqs.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Total FAQs', value: faqs.length, color: '#800000', bg: '#fff1f1' },
            { label: 'Visible to Students', value: visibleCount, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Hidden', value: hiddenCount, color: '#d97706', bg: '#fffbeb' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: s.bg, border: `1px solid ${s.color}25`, borderRadius: 10, padding: '0.6rem 1rem', minWidth: 140 }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: '0.78rem', color: s.color, fontWeight: 600, lineHeight: 1.3 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* â”€â”€ FAQ List â”€â”€ */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem 0', color: 'var(--gray-400)' }}>
          <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }}></span>
        </div>
      ) : faqs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--gray-400)', background: 'white', borderRadius: 14, border: '1px solid var(--gray-100)' }}>
          <HelpCircle size={44} style={{ marginBottom: '0.85rem', opacity: 0.3 }} />
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--gray-500)' }}>No FAQs yet</p>
          <p style={{ fontSize: '0.85rem' }}>Click <strong>Add FAQ</strong> to create the first entry.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {faqs.map((faq, index) => {
            const isExpanded = expandedId === faq._id;
            return (
              <div
                key={faq._id}
                style={{
                  background: 'white',
                  border: '1px solid var(--gray-100)',
                  borderLeft: `4px solid ${faq.isVisible ? 'var(--maroon)' : '#d1d5db'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: faq.isVisible ? 1 : 0.6,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.15s',
                }}
              >
                {/* Card header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1rem' }}>
                  {/* Reorder buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                    <button onClick={() => moveItem(index, -1)} disabled={index === 0}
                      style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', padding: '1px 3px', color: index === 0 ? 'var(--gray-200)' : 'var(--gray-400)', borderRadius: 4 }}>
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => moveItem(index, 1)} disabled={index === faqs.length - 1}
                      style={{ background: 'none', border: 'none', cursor: index === faqs.length - 1 ? 'default' : 'pointer', padding: '1px 3px', color: index === faqs.length - 1 ? 'var(--gray-200)' : 'var(--gray-400)', borderRadius: 4 }}>
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Number badge */}
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: faq.isVisible ? 'var(--maroon)' : 'var(--gray-300)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                    {index + 1}
                  </div>

                  {/* Question + expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : faq._id)}
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: faq.isVisible ? 'var(--gray-800)' : 'var(--gray-400)', lineHeight: 1.4, flex: 1 }}>
                      {faq.question}
                    </span>
                    <ChevronDown size={15} style={{ color: 'var(--gray-400)', flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>

                  {/* Status badge */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 20, background: faq.isVisible ? '#dcfce7' : '#fef3c7', color: faq.isVisible ? '#16a34a' : '#d97706', flexShrink: 0 }}>
                    {faq.isVisible ? <><CheckCircle2 size={11} />Visible</> : <><EyeOff size={11} />Hidden</>}
                  </span>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button onClick={() => toggleVisible(faq)} title={faq.isVisible ? 'Hide' : 'Show'}
                      style={{ background: faq.isVisible ? '#f0fdf4' : '#fffbeb', border: `1px solid ${faq.isVisible ? '#bbf7d0' : '#fde68a'}`, borderRadius: 7, padding: '0.35rem 0.5rem', cursor: 'pointer', color: faq.isVisible ? '#16a34a' : '#d97706', display: 'flex', alignItems: 'center' }}>
                      {faq.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => openEdit(faq)} title="Edit"
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '0.35rem 0.5rem', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(faq)} title="Delete"
                      style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, padding: '0.35rem 0.5rem', cursor: 'pointer', color: '#e11d48', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded answer */}
                {isExpanded && (
                  <div style={{ padding: '0 1rem 1rem 3.85rem', borderTop: '1px solid var(--gray-100)' }}>
                    <p style={{ fontSize: '0.83rem', color: 'var(--gray-600)', margin: '0.75rem 0 0 0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* â”€â”€ Add / Edit Modal â”€â”€ */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--maroon)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <HelpCircle size={17} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)', margin: 0 }}>
                  {editingId ? 'Edit FAQ' : 'Add New FAQ'}
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: 0 }}>
                  {editingId ? 'Update the question or answer below.' : 'Fill in the question and answer for students.'}
                </p>
              </div>
              <button onClick={closeModal} style={{ background: 'var(--gray-100)', border: 'none', borderRadius: 8, padding: '0.4rem', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {formError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '0.65rem 1rem', color: '#b91c1c', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  âš  {formError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Question <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <input
                  value={form.question}
                  onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                  placeholder="e.g. What is Path to Tech â€“ DCS?"
                  style={{ width: '100%', padding: '0.7rem 0.85rem', border: '1.5px solid var(--gray-200)', borderRadius: 9, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = '#800000'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Answer <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <textarea
                  value={form.answer}
                  onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
                  placeholder="Write the answer hereâ€¦"
                  rows={7}
                  style={{ width: '100%', padding: '0.7rem 0.85rem', border: '1.5px solid var(--gray-200)', borderRadius: 9, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.65, transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = '#800000'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                />
                <p style={{ fontSize: '0.74rem', color: 'var(--gray-400)', margin: '0.3rem 0 0 0' }}>
                  Tip: You can use line breaks for lists or multi-step answers.
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', userSelect: 'none', background: form.isVisible ? '#f0fdf4' : '#fafafa', border: `1.5px solid ${form.isVisible ? '#bbf7d0' : 'var(--gray-200)'}`, borderRadius: 9, padding: '0.65rem 0.9rem', transition: 'all 0.15s' }}>
                <input
                  type="checkbox"
                  checked={form.isVisible}
                  onChange={e => setForm(p => ({ ...p, isVisible: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }}
                />
                <div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: form.isVisible ? '#16a34a' : 'var(--gray-500)' }}>
                    {form.isVisible ? 'Visible to students' : 'Hidden from students'}
                  </span>
                  <p style={{ fontSize: '0.73rem', color: 'var(--gray-400)', margin: 0 }}>
                    {form.isVisible ? 'This FAQ will appear in the student widget.' : 'Students will not see this FAQ.'}
                  </p>
                </div>
              </label>
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', borderRadius: '0 0 16px 16px' }}>
              <button onClick={closeModal}
                style={{ padding: '0.6rem 1.2rem', border: '1.5px solid var(--gray-200)', borderRadius: 9, background: 'white', color: 'var(--gray-600)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.4rem', background: 'var(--maroon)', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.75 : 1, boxShadow: '0 2px 8px rgba(128,0,0,0.3)' }}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: 'white' }}></span> : <Save size={14} />}
                {saving ? 'Savingâ€¦' : editingId ? 'Save Changes' : 'Add FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

