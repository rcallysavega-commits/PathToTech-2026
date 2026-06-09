import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Plus, Trash2, Save, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Download, FileText } from 'lucide-react';
import api from '../../services/api';
import { downloadTemplatePdf } from '../../utils/pdfExport';

const RESP_PAGE_SIZE = 10;

function exportResponsesCSV(rows) {
  if (!rows.length) return;
  const cats = rows[0].categoryScores?.map(c => c.category) || [];
  const headers = ['Student Name', 'Student No.', 'Email', 'Total Average', ...cats.map(c => c.replace(/_/g, ' ')), 'Submitted'];
  const csv = [headers, ...rows.map(r => [
    r.userId?.fullName || '',
    r.userId?.studentNumber || '',
    r.userId?.email || '',
    Number(r.totalAverage || 0).toFixed(2),
    ...cats.map(c => { const found = r.categoryScores?.find(cs => cs.category === c); return found ? Number(found.average || 0).toFixed(2) : ''; }),
    new Date(r.updatedAt || r.createdAt).toLocaleDateString(),
  ])].map(row => row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'survey-responses.csv'; a.click();
  URL.revokeObjectURL(url);
}

async function exportResponsesPDF(rows) {
  if (!rows.length) return;
  const cats = rows[0].categoryScores?.map(c => c.category) || [];
  const columns = ['Student', 'Student No.', 'Total Avg', ...cats.map(c => c.replace(/_/g, ' ')), 'Submitted'];
  const tableRows = rows.map((r) => {
    const tdBase = [r.userId?.fullName || '', r.userId?.studentNumber || '', Number(r.totalAverage || 0).toFixed(2)];
    const catVals = cats.map((c) => {
      const found = r.categoryScores?.find((cs) => cs.category === c);
      return found ? Number(found.average || 0).toFixed(2) : '-';
    });
    return [...tdBase, ...catVals, new Date(r.updatedAt || r.createdAt).toLocaleDateString()];
  });

  await downloadTemplatePdf({
    reportTitle: 'PathToTech Survey Responses',
    subtitle: `${rows.length} response(s)`,
    columns,
    rows: tableRows,
    fileName: `survey-responses-${new Date().toISOString().slice(0, 10)}`,
  });
}

function ResponsesModal({ onClose, survey }) {
  const [responses, setResponses] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/responses/all').then(res => {
      const all = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data?.responses) ? res.data.responses : []);
      // Filter to only responses for the selected survey
      const forSurvey = all.filter(r => {
        const rid = r.surveyId?._id || r.surveyId;
        return String(rid) === String(survey._id);
      });
      setResponses(forSurvey);
    }).finally(() => setLoading(false));
  }, [survey._id]);

  const filtered = responses.filter(r => {
    const q = search.toLowerCase();
    return !q || r.userId?.fullName?.toLowerCase().includes(q) || r.userId?.email?.toLowerCase().includes(q) || r.userId?.studentNumber?.includes(q);
  });
  const totalPages = Math.ceil(filtered.length / RESP_PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * RESP_PAGE_SIZE, page * RESP_PAGE_SIZE);

  const scoreColor = (score) => {
    if (!score) return 'var(--gray-400)';
    if (score >= 4) return '#15803d';
    if (score >= 3) return '#d97706';
    return '#b91c1c';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 860, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-100)' }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--maroon)', margin: 0 }}>Survey Responses</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.8rem', margin: 0, maxWidth: 400 }}>{survey.title} · {responses.length} response{responses.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => exportResponsesCSV(filtered)} className="btn btn-secondary btn-sm" style={{ gap: '0.4rem', fontSize: '0.78rem' }}>
              <Download size={13} /> CSV
            </button>
            <button onClick={() => exportResponsesPDF(filtered)} className="btn btn-secondary btn-sm" style={{ gap: '0.4rem', fontSize: '0.78rem' }}>
              <FileText size={13} /> PDF
            </button>
            <button onClick={onClose} style={{ background: 'var(--gray-100)', border: 'none', borderRadius: 8, padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--gray-100)' }}>
          <input type="text" className="form-control" style={{ maxWidth: 360 }} placeholder="Search by name, email, or student no..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>

        {/* Body */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner" /></div>
          ) : paginated.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '3rem', fontSize: '0.875rem' }}>No survey responses found</div>
          ) : (
            paginated.map((r, idx) => {
              const isExpanded = expanded === (r._id || idx);
              return (
                <div key={r._id || idx} style={{ borderBottom: idx < paginated.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1.5rem', gap: '1rem', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : (r._id || idx))}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--maroon)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                          {r.userId?.fullName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-800)' }}>{r.userId?.fullName || 'Unknown Student'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{r.userId?.email} · {r.userId?.studentNumber || 'No student no.'}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Overall Avg</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: scoreColor(r.totalAverage) }}>{Number(r.totalAverage || 0).toFixed(2)} <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--gray-400)' }}>/ 5.00</span></div>
                      </div>
                      <span className={`badge ${r.completed ? 'badge-success' : 'badge-warning'}`}>{r.completed ? 'Complete' : 'Partial'}</span>
                      <div style={{ color: 'var(--gray-400)' }}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 1.5rem 1rem 1.5rem', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)' }}>
                      <div style={{ paddingTop: '0.75rem' }}>
                        {r.categoryScores?.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.82rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category Scores</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.875rem' }}>
                              {r.categoryScores.map(cs => (
                                <div key={cs.category} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.6rem 0.875rem' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'capitalize', marginBottom: '0.2rem' }}>{cs.category.replace(/_/g, ' ')}</div>
                                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: scoreColor(cs.average) }}>{Number(cs.average || 0).toFixed(2)} <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--gray-400)' }}>/ 5.00</span></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {Array.isArray(r.answers) && r.answers.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.82rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Individual Answers</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 220, overflowY: 'auto' }}>
                              {r.answers.map((a, i) => (
                                <div key={a._id || i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', alignItems: 'flex-start', padding: '0.3rem 0.5rem', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--gray-100)' }}>
                                  <span style={{ color: 'var(--gray-500)', flex: 1 }}>{a.questionText || `Q${(a.questionIndex ?? i) + 1}`}</span>
                                  <span style={{ fontWeight: 700, color: scoreColor(Number(a.answer)), flexShrink: 0 }}>{a.answer}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                          Submitted: {new Date(r.updatedAt || r.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.5rem', borderTop: '1px solid var(--gray-100)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginRight: '0.5rem' }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm btn-outline" style={{ padding: '0.3rem 0.6rem' }}><ChevronLeft size={14} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-sm btn-outline" style={{ padding: '0.3rem 0.6rem' }}><ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

const QUESTION_TYPES = [
  { value: 'likert', label: 'Likert Scale' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'text', label: 'Text / Open-ended' },
];

const DEFAULT_LIKERT_LABELS = {
  1: 'Strongly Disagree',
  2: 'Disagree',
  3: 'Neutral',
  4: 'Agree',
  5: 'Strongly Agree',
};

const buildLikertOptions = (min = 1, max = 5, existing = []) => {
  const start = Number(min);
  const end = Number(max);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) return [];
  const result = [];
  for (let n = start; n <= end; n++) {
    const idx = n - start;
    result.push(String(existing[idx] || DEFAULT_LIKERT_LABELS[n] || `Rating ${n}`).trim());
  }
  return result;
};

const emptyQuestion = () => ({
  questionText: '',
  questionType: 'likert',
  options: buildLikertOptions(1, 5, []),
  scaleMin: 1,
  scaleMax: 5,
});

const emptySection = () => ({
  title: '',
  description: '',
  category: '',
  questions: [emptyQuestion()],
});

const normalizeQuestion = (q = {}) => {
  const type = q.questionType || q.type || 'likert';
  const scaleMin = Number.isFinite(Number(q.scaleMin)) ? Number(q.scaleMin) : 1;
  const scaleMax = Number.isFinite(Number(q.scaleMax)) ? Number(q.scaleMax) : 5;
  const rawOptions = Array.isArray(q.options)
    ? q.options.map((o) => String(o).trim()).filter(Boolean)
    : [];
  return {
    questionText: String(q.questionText ?? q.text ?? '').trim(),
    questionType: type,
    scaleMin,
    scaleMax,
    options: type === 'likert'
      ? buildLikertOptions(scaleMin, scaleMax, rawOptions)
      : type === 'multiple_choice' || type === 'dropdown'
        ? (rawOptions.length >= 2 ? rawOptions : ['Option 1', 'Option 2'])
        : [],
  };
};

const normalizeSection = (s = {}) => ({
  title: s.title || '',
  description: s.description || '',
  category: s.category || '',
  questions: Array.isArray(s.questions) && s.questions.length
    ? s.questions.map(normalizeQuestion)
    : [emptyQuestion()],
});

export default function SurveyBuilderPage() {
  const [surveys, setSurveys] = useState([]);
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [mode, setMode] = useState('list');
  const [form, setForm] = useState({ title: '', description: '', sections: [emptySection()] });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [responseSurvey, setResponseSurvey] = useState(null);

  useEffect(() => { fetchSurveys(); }, []);

  const fetchSurveys = async () => {
    try {
      const res = await api.get('/surveys');
      setSurveys(Array.isArray(res.data?.surveys) ? res.data.surveys : []);
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setForm({ title: '', description: '', source: '', sections: [emptySection()] });
    setActiveSurvey(null);
    setMode('create');
  };

  const startEdit = (survey) => {
    setForm({
      title: survey.title,
      description: survey.description || '',
      source: survey.source || '',
      sections: Array.isArray(survey.sections) && survey.sections.length
        ? survey.sections.map(normalizeSection)
        : [emptySection()],
    });
    setActiveSurvey(survey);
    setMode('edit');
  };

  // ── Section helpers ──────────────────────────────────────────────────────────
  const addSection = () =>
    setForm((f) => ({ ...f, sections: [...f.sections, emptySection()] }));

  const removeSection = (si) =>
    setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== si) }));

  const updateSection = (si, key, val) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) => (i === si ? { ...s, [key]: val } : s)),
    }));

  // ── Question helpers ─────────────────────────────────────────────────────────
  const addQuestion = (si) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si ? { ...s, questions: [...s.questions, emptyQuestion()] } : s
      ),
    }));

  const removeQuestion = (si, qi) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si ? { ...s, questions: s.questions.filter((_, j) => j !== qi) } : s
      ),
    }));

  const updateQuestion = (si, qi, key, val) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si
          ? { ...s, questions: s.questions.map((q, j) => (j === qi ? { ...q, [key]: val } : q)) }
          : s
      ),
    }));

  const changeQuestionType = (si, qi, type) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si
          ? {
            ...s,
            questions: s.questions.map((q, j) => {
              if (j !== qi) return q;
              return {
                ...q,
                questionType: type,
                options: type === 'likert'
                  ? buildLikertOptions(q.scaleMin || 1, q.scaleMax || 5, [])
                  : type === 'multiple_choice' || type === 'dropdown'
                    ? ['Option 1', 'Option 2']
                    : [],
              };
            }),
          }
          : s
      ),
    }));

  const updateLikertRange = (si, qi, field, rawVal) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si
          ? {
            ...s,
            questions: s.questions.map((q, j) => {
              if (j !== qi) return q;
              const updated = { ...q, [field]: rawVal === '' ? '' : Number(rawVal) };
              const min = Number(updated.scaleMin);
              const max = Number(updated.scaleMax);
              if (Number.isInteger(min) && Number.isInteger(max) && min < max) {
                updated.options = buildLikertOptions(min, max, q.options || []);
              }
              return updated;
            }),
          }
          : s
      ),
    }));

  const updateLikertLabel = (si, qi, idx, val) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si
          ? {
            ...s,
            questions: s.questions.map((q, j) =>
              j === qi
                ? { ...q, options: (q.options || []).map((o, k) => (k === idx ? val : o)) }
                : q
            ),
          }
          : s
      ),
    }));

  const addChoiceOption = (si, qi) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si
          ? {
            ...s,
            questions: s.questions.map((q, j) =>
              j === qi
                ? { ...q, options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] }
                : q
            ),
          }
          : s
      ),
    }));

  const updateChoiceOption = (si, qi, oi, val) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si
          ? {
            ...s,
            questions: s.questions.map((q, j) =>
              j === qi
                ? { ...q, options: (q.options || []).map((o, k) => (k === oi ? val : o)) }
                : q
            ),
          }
          : s
      ),
    }));

  const removeChoiceOption = (si, qi, oi) =>
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === si
          ? {
            ...s,
            questions: s.questions.map((q, j) =>
              j === qi
                ? { ...q, options: (q.options || []).filter((_, k) => k !== oi) }
                : q
            ),
          }
          : s
      ),
    }));

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) {
      await Swal.fire({ title: 'Required', text: 'Survey title is required.', icon: 'warning', confirmButtonColor: '#800000' });
      return;
    }
    for (let si = 0; si < form.sections.length; si++) {
      const s = form.sections[si];
      if (!s.title?.trim()) {
        await Swal.fire({ title: 'Required', text: `Section ${si + 1} title is required.`, icon: 'warning', confirmButtonColor: '#800000' });
        return;
      }
      for (let qi = 0; qi < s.questions.length; qi++) {
        const q = s.questions[qi];
        if (!q.questionText?.trim()) {
          await Swal.fire({ title: 'Required', text: `Section ${si + 1}, Question ${qi + 1}: question text is required.`, icon: 'warning', confirmButtonColor: '#800000' });
          return;
        }
        if (q.questionType === 'likert') {
          const min = Number(q.scaleMin);
          const max = Number(q.scaleMax);
          if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) {
            await Swal.fire({ title: 'Invalid Scale', text: `Section ${si + 1}, Q${qi + 1}: Likert min must be less than max.`, icon: 'warning', confirmButtonColor: '#800000' });
            return;
          }
        }
        if (q.questionType === 'multiple_choice' || q.questionType === 'dropdown') {
          const clean = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
          if (clean.length < 2) {
            await Swal.fire({ title: 'Required', text: `Section ${si + 1}, Q${qi + 1}: needs at least 2 options.`, icon: 'warning', confirmButtonColor: '#800000' });
            return;
          }
        }
      }
    }

    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || '',
      source: form.source?.trim() || '',
      sections: form.sections.map((s, si) => ({
        title: s.title.trim(),
        description: s.description?.trim() || '',
        category: s.category?.trim() || '',
        order: si,
        questions: s.questions.map((q, qi) => {
          const base = {
            questionText: String(q.questionText).trim(),
            required: true,
            order: qi,
            questionType: q.questionType,
          };
          if (q.questionType === 'likert') {
            return { ...base, scaleMin: Number(q.scaleMin), scaleMax: Number(q.scaleMax), options: q.options || [] };
          }
          if (q.questionType === 'multiple_choice' || q.questionType === 'dropdown') {
            return { ...base, options: (q.options || []).map((o) => String(o).trim()).filter(Boolean) };
          }
          return { ...base, options: [] };
        }),
      })),
    };

    setSaving(true);
    try {
      if (mode === 'create') {
        await api.post('/surveys', payload);
      } else {
        await api.put(`/surveys/${activeSurvey._id}`, payload);
      }
      await Swal.fire({ title: 'Saved!', text: `Survey ${mode === 'create' ? 'created' : 'updated'} successfully.`, icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
      fetchSurveys();
      setMode('list');
    } catch (err) {
      await Swal.fire({ title: 'Save Failed', text: err.response?.data?.message || 'Failed to save.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id) => {
    try {
      await api.put(`/surveys/${id}`, { isActive: true });
      await Swal.fire({ title: 'Survey Activated!', icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
      fetchSurveys();
    } catch (err) {
      await Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Failed.', icon: 'error', confirmButtonColor: '#800000' });
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({ title: 'Delete Survey?', text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', cancelButtonColor: '#6b7280', confirmButtonText: 'Yes, Delete' });
    if (!confirm.isConfirmed) return;
    try {
      await api.delete(`/surveys/${id}`);
      fetchSurveys();
    } catch (err) {
      await Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Failed.', icon: 'error', confirmButtonColor: '#800000' });
    }
  };

  // ── Form view ────────────────────────────────────────────────────────────────
  if (mode !== 'list') {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>
            {mode === 'create' ? 'Create Survey' : 'Edit Survey'}
          </h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setMode('list')} className="btn btn-outline">Cancel</button>
            <button onClick={handleSave} className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={saving}>
              {saving
                ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }} />
                : <><Save size={15} /> Save Survey</>}
            </button>
          </div>
        </div>

        {/* Survey meta */}
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Survey Title *</label>
            <input type="text" className="form-control" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Employability Assessment Survey" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this survey..." />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Source</label>
            <input type="text" className="form-control" value={form.source || ''}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="e.g. Department of Labor and Employment (DOLE)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: '0.25rem', display: 'block' }}>Where this survey is sourced or adapted from (optional)</span>
          </div>
        </div>

        {/* Sections */}
        {form.sections.map((section, si) => (
          <div key={si} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--maroon)', padding: '0.875rem 1.25rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Section {si + 1} — {section.title || 'Untitled'}</span>
              {form.sections.length > 1 && (
                <button onClick={() => removeSection(si)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}>
                  Remove Section
                </button>
              )}
            </div>

            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Section Title *</label>
                  <input type="text" className="form-control" value={section.title}
                    onChange={(e) => updateSection(si, 'title', e.target.value)}
                    placeholder="e.g. Professional Ethics" />
                </div>
                <div>
                  <label className="form-label">Category (for scoring)</label>
                  <input type="text" className="form-control" value={section.category}
                    onChange={(e) => updateSection(si, 'category', e.target.value)}
                    placeholder="e.g. professional_ethics" />
                </div>
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Description (optional)</label>
                <input type="text" className="form-control" value={section.description}
                  onChange={(e) => updateSection(si, 'description', e.target.value)}
                  placeholder="Short description for this section..." />
              </div>

              {/* Questions */}
              <label className="form-label">Questions ({section.questions.length})</label>
              {section.questions.map((q, qi) => (
                <div key={qi} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--maroon)', background: '#fbd0d0', borderRadius: 6, padding: '0.3rem 0.6rem', flexShrink: 0, marginTop: '0.15rem' }}>
                      Q{qi + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      {/* Question text */}
                      <input
                        type="text"
                        className="form-control"
                        value={q.questionText}
                        onChange={(e) => updateQuestion(si, qi, 'questionText', e.target.value)}
                        placeholder={`Question ${qi + 1}...`}
                        style={{ marginBottom: '0.6rem' }}
                      />

                      {/* Type buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        {QUESTION_TYPES.map((t) => (
                          <button key={t.value} type="button" onClick={() => changeQuestionType(si, qi, t.value)}
                            style={{
                              padding: '0.3rem 0.75rem',
                              borderRadius: 'var(--radius)',
                              border: `2px solid ${q.questionType === t.value ? 'var(--maroon)' : 'var(--gray-200)'}`,
                              background: q.questionType === t.value ? 'var(--maroon-pale)' : 'white',
                              color: q.questionType === t.value ? 'var(--maroon)' : 'var(--gray-600)',
                              fontWeight: q.questionType === t.value ? 700 : 400,
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                            }}>
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Likert config */}
                      {q.questionType === 'likert' && (
                        <div style={{ background: '#fff8f8', border: '1px solid #fbd0d0', borderRadius: 'var(--radius)', padding: '0.875rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Min</label>
                              <input type="number" className="form-control" style={{ width: 72 }} min={1} max={9}
                                value={q.scaleMin}
                                onChange={(e) => updateLikertRange(si, qi, 'scaleMin', e.target.value)} />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Max</label>
                              <input type="number" className="form-control" style={{ width: 72 }} min={2} max={10}
                                value={q.scaleMax}
                                onChange={(e) => updateLikertRange(si, qi, 'scaleMax', e.target.value)} />
                            </div>
                          </div>
                          {Number.isInteger(Number(q.scaleMin)) && Number.isInteger(Number(q.scaleMax)) && Number(q.scaleMin) < Number(q.scaleMax) && (
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Rating Labels</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.4rem' }}>
                                {(q.options || []).map((lbl, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--maroon)', width: 26, textAlign: 'center', background: '#fbd0d0', borderRadius: 5, padding: '0.15rem 0', flexShrink: 0 }}>
                                      {Number(q.scaleMin) + idx}
                                    </span>
                                    <input type="text" className="form-control" value={lbl}
                                      onChange={(e) => updateLikertLabel(si, qi, idx, e.target.value)}
                                      placeholder={`Label for ${Number(q.scaleMin) + idx}`} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Multiple choice / dropdown config */}
                      {(q.questionType === 'multiple_choice' || q.questionType === 'dropdown') && (
                        <div>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>{q.questionType === 'dropdown' ? 'Dropdown Options' : 'Choices'}</label>
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                              <input type="text" className="form-control" value={opt}
                                onChange={(e) => updateChoiceOption(si, qi, oi, e.target.value)}
                                placeholder={`${q.questionType === 'dropdown' ? 'Dropdown option' : 'Option'} ${oi + 1}`} style={{ fontSize: '0.85rem' }} />
                              <button type="button" onClick={() => removeChoiceOption(si, qi, oi)}
                                disabled={(q.options || []).length <= 2}
                                style={{ padding: '0.3rem 0.6rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.78rem', opacity: (q.options || []).length <= 2 ? 0.4 : 1 }}>
                                ✕
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addChoiceOption(si, qi)}
                            style={{ fontSize: '0.78rem', color: 'var(--maroon)', background: 'none', border: '1px dashed var(--maroon)', borderRadius: 'var(--radius)', padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
                            + Add {q.questionType === 'dropdown' ? 'Option' : 'Choice'}
                          </button>
                        </div>
                      )}

                      {/* Text note */}
                      {q.questionType === 'text' && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                          📝 Open-ended — student types a free response.
                        </div>
                      )}
                    </div>

                    {section.questions.length > 1 && (
                      <button onClick={() => removeQuestion(si, qi)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.25rem', flexShrink: 0 }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button onClick={() => addQuestion(si)} className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <Plus size={15} /> Add Question
              </button>
            </div>
          </div>
        ))}

        <button onClick={addSection} className="btn btn-outline"
          style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <Plus size={18} /> Add Section
        </button>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Survey Builder</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {surveys.length} survey{surveys.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={startCreate} className="btn btn-primary" style={{ gap: '0.5rem' }}>
          <Plus size={18} /> Create Survey
        </button>
      </div>

      {responseSurvey && <ResponsesModal survey={responseSurvey} onClose={() => setResponseSurvey(null)} />}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <span className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {surveys.map((s) => (
            <div key={s._id} style={{ background: 'white', border: `2px solid ${s.isActive ? 'var(--maroon)' : 'var(--gray-100)'}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{s.title}</span>
                  {s.isActive && <span className="badge badge-success">Active</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                  {s.sections?.length || 0} section{s.sections?.length !== 1 ? 's' : ''} · {s.sections?.reduce((a, sec) => a + (sec.questions?.length || 0), 0)} questions
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!s.isActive && (
                  <button onClick={() => handleActivate(s._id)} className="btn btn-sm btn-outline" style={{ fontSize: '0.8rem' }}>
                    Activate
                  </button>
                )}
                <button onClick={() => setResponseSurvey(s)} className="btn btn-sm btn-outline" style={{ fontSize: '0.8rem', gap: '0.3rem', display: 'flex', alignItems: 'center' }}>
                  <MessageSquare size={13} /> Responses
                </button>
                <button onClick={() => startEdit(s)} className="btn btn-sm btn-outline" style={{ fontSize: '0.8rem' }}>Edit</button>
                <button onClick={() => handleDelete(s._id)} className="btn btn-sm"
                  style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '0.8rem' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {surveys.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
              No surveys yet. Click "Create Survey" to start.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
