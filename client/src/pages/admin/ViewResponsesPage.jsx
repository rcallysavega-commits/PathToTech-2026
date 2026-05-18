import { useState, useEffect } from 'react';
import { Search, Download, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import { downloadTemplatePdf } from '../../utils/pdfExport';

const PAGE_SIZE = 10;

function exportCSV(rows) {
  if (!rows.length) return;
  const cats = rows[0].categoryScores?.map(c => c.category) || [];
  const headers = ['Student Name', 'Student No.', 'Email', 'Total Average', ...cats.map(c => c.replace(/_/g, ' ')), 'Submitted'];
  const csv = [headers, ...rows.map(r => [
    r.userId?.fullName || r.studentName || '',
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

async function exportPDF(rows) {
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

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--gray-100)', background: 'white' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginRight: '0.5rem' }}>
        Page {page} of {totalPages} &bull; {total} result{total !== 1 ? 's' : ''}
      </span>
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="btn btn-sm btn-outline" style={{ padding: '0.3rem 0.6rem' }}><ChevronLeft size={14} /></button>
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        const start = Math.max(1, Math.min(page - 2, totalPages - 4));
        const p = start + i;
        if (p > totalPages) return null;
        return <button key={p} onClick={() => onChange(p)} className="btn btn-sm" style={{ padding: '0.3rem 0.6rem', background: p === page ? 'var(--maroon)' : 'white', color: p === page ? 'white' : 'var(--gray-700)', border: '1px solid var(--gray-200)' }}>{p}</button>;
      })}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="btn btn-sm btn-outline" style={{ padding: '0.3rem 0.6rem' }}><ChevronRight size={14} /></button>
    </div>
  );
}

export default function ViewResponsesPage() {
  const [responses, setResponses] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/responses/all').then(res => {
      setResponses(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data?.responses) ? res.data.responses : []));
    }).finally(() => setLoading(false));
  }, []);

  const filtered = responses.filter(r => {
    const q = search.toLowerCase();
    return !q || r.userId?.fullName?.toLowerCase().includes(q) || r.userId?.email?.toLowerCase().includes(q) || r.userId?.studentNumber?.includes(q);
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const scoreColor = (score) => {
    if (!score) return 'var(--gray-400)';
    if (score >= 4) return '#15803d';
    if (score >= 3) return '#d97706';
    return '#b91c1c';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Survey Responses</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>{responses.length} response{responses.length !== 1 ? 's' : ''} submitted</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => exportCSV(filtered)} className="btn btn-secondary" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => exportPDF(filtered)} className="btn btn-secondary" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
            <FileText size={14} /> Export PDF
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '1rem', maxWidth: 400 }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
        <input type="text" className="form-control" style={{ paddingLeft: '2.1rem' }} placeholder="Search by name, email, or student no..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {paginated.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '3rem', fontSize: '0.875rem' }}>No survey responses found</div>
          ) : (
            <div>
              {paginated.map((r, idx) => {
                const isExpanded = expanded === (r._id || idx);
                return (
                  <div key={r._id || idx} style={{ borderBottom: idx < paginated.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                    {/* Row header */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1rem', gap: '1rem', cursor: 'pointer', ':hover': { background: 'var(--gray-50)' } }} onClick={() => setExpanded(isExpanded ? null : (r._id || idx))}>
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

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ padding: '0 1rem 1rem 1rem', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)' }}>
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
                          {r.answers && (Array.isArray(r.answers) ? r.answers.length > 0 : Object.keys(r.answers).length > 0) && (
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.82rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Individual Answers</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 300, overflowY: 'auto' }}>
                                {Array.isArray(r.answers)
                                  ? r.answers.map((a, i) => (
                                    <div key={a._id || i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', alignItems: 'flex-start', padding: '0.3rem 0.5rem', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--gray-100)' }}>
                                      <span style={{ color: 'var(--gray-500)', flex: 1 }}>{a.questionText || `Q${(a.questionIndex ?? i) + 1}`}</span>
                                      <span style={{ fontWeight: 700, color: scoreColor(Number(a.answer)), flexShrink: 0 }}>{a.answer}</span>
                                    </div>
                                  ))
                                  : Object.entries(r.answers).map(([qId, val]) => (
                                    <div key={qId} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', alignItems: 'center', padding: '0.3rem 0.5rem', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--gray-100)' }}>
                                      <span style={{ color: 'var(--gray-500)', flex: 1 }}>{qId}</span>
                                      <span style={{ fontWeight: 700, color: scoreColor(Number(val)), flexShrink: 0 }}>{String(val)}</span>
                                    </div>
                                  ))
                                }
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
              })}
            </div>
          )}
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}
    </div>
  );
}