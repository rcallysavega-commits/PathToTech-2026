import { useState, useEffect } from 'react';
import { Search, Eye, Archive, ChevronLeft, ChevronRight, X, BookOpen, ClipboardList, Award, Code2, Brain } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../../services/api';

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All', 'High Employability', 'Moderate Employability', 'Low Employability', 'Archived'];

const STATUS_COLORS = {
  'High Employability': { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  'Moderate Employability': { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  'Low Employability': { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
};

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

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--gray-50)', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: '0.82rem', minWidth: 150 }}>{label}</span>
      <span style={{ fontSize: '0.82rem', color: 'var(--gray-800)' }}>{value ?? '—'}</span>
    </div>
  );
}
function SectionHeader({ icon: Icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0 0.5rem', borderBottom: '2px solid var(--maroon)', paddingBottom: '0.4rem' }}>
      <Icon size={16} style={{ color: 'var(--maroon)' }} />
      <span style={{ fontWeight: 700, color: 'var(--maroon)', fontSize: '0.9rem' }}>{title}</span>
    </div>
  );
}

function ResultDetailModal({ result, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Prediction');
  const MODAL_TABS = ['Prediction', 'Profile', 'Grades', 'Survey', 'Skills', 'Certifications'];

  const userId = result?.userId?._id || result?.userId;
  const studentNumber = result?.studentNumber;

  useEffect(() => {
    if (!result) return;
    (async () => {
      setLoading(true);
      const [studentR, gradesR, surveyR, techR, softR, certR] = await Promise.allSettled([
        userId ? api.get(`/users/${userId}`) : Promise.reject(),
        api.get(`/grades/${studentNumber || 'none'}`),
        userId ? api.get(`/responses/user/${userId}`) : Promise.reject(),
        userId ? api.get(`/technical-skills/${userId}`) : Promise.reject(),
        userId ? api.get(`/soft-skills/${userId}`) : Promise.reject(),
        userId ? api.get(`/certifications/${userId}`) : Promise.reject(),
      ]);
      setDetails({
        student: studentR.status === 'fulfilled' ? (studentR.value.data?.user || studentR.value.data) : null,
        grades: gradesR.status === 'fulfilled' ? (gradesR.value.data?.data?.grades || gradesR.value.data?.grades || []) : [],
        survey: surveyR.status === 'fulfilled' ? (surveyR.value.data?.response || null) : null,
        techSkills: techR.status === 'fulfilled' ? (techR.value.data?.data?.skills || []) : [],
        softSkills: softR.status === 'fulfilled' ? (softR.value.data?.data?.scores || {}) : {},
        certifications: certR.status === 'fulfilled' ? (certR.value.data?.data?.certifications || []) : [],
      });
      setLoading(false);
    })();
  }, [result]);

  if (!result) return null;
  const st = result.employabilityStatus;
  const stColor = STATUS_COLORS[st] || { bg: 'var(--gray-100)', text: 'var(--gray-600)', border: 'var(--gray-200)' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 760, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--gray-100)', background: 'var(--maroon)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '1rem' }}>
              {result.userId?.fullName?.[0]?.toUpperCase() || result.studentNumber?.[0] || '?'}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{result.userId?.fullName || 'Student Result'}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{result.studentNumber} · Generated {new Date(result.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', overflowX: 'auto' }}>
          {MODAL_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? 'var(--maroon)' : 'var(--gray-500)', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--maroon)' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.25rem 1.5rem', maxHeight: '65vh', overflowY: 'auto' }}>
          {loading && activeTab !== 'Prediction' ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div>
          ) : (
            <>
              {activeTab === 'Prediction' && (
                <div>
                  <SectionHeader icon={Eye} title="Prediction Summary" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                      { label: 'Employability Score', value: `${Number(result.employabilityScore || 0).toFixed(1)}%` },
                      { label: 'Status', value: st, style: { color: stColor.text } },
                      { label: 'Career Track', value: result.clusterLabel },
                      { label: 'GWA', value: Number(result.inputSummary?.gwa || 0).toFixed(2) },
                      { label: 'Technical Score', value: Number(result.inputSummary?.technicalSkillsScore || 0).toFixed(1) },
                      { label: 'Soft Skills Score', value: Number(result.inputSummary?.softSkillsScore || 0).toFixed(1) },
                      { label: 'Certifications', value: result.inputSummary?.certificationCount || 0 },
                      { label: 'Survey Score', value: Number(result.inputSummary?.surveyScore || 0).toFixed(2) },
                    ].map(({ label, value, style: s2 }) => (
                      <div key={label} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.2rem' }}>{label}</div>
                        <div style={{ fontWeight: 700, color: 'var(--maroon)', fontSize: '0.95rem', ...s2 }}>{value || '—'}</div>
                      </div>
                    ))}
                  </div>
                  {result.recommendations?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Recommendations</div>
                      {result.recommendations.map((r2, i) => <div key={i} style={{ fontSize: '0.82rem', color: 'var(--gray-600)', padding: '0.2rem 0' }}>• {r2}</div>)}
                    </div>
                  )}
                  {result.skillImprovementSuggestions?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Skill Improvement Suggestions</div>
                      {result.skillImprovementSuggestions.map((s2, i) => <div key={i} style={{ fontSize: '0.82rem', color: 'var(--gray-600)', padding: '0.2rem 0' }}>• {s2}</div>)}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Profile' && (
                loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div> :
                <div>
                  <SectionHeader icon={Eye} title="Student Profile" />
                  <InfoRow label="Full Name" value={details?.student?.fullName} />
                  <InfoRow label="Email" value={details?.student?.email} />
                  <InfoRow label="Student Number" value={result.studentNumber} />
                  <InfoRow label="Major" value={details?.student?.major} />
                  <InfoRow label="Gender" value={details?.student?.gender} />
                </div>
              )}

              {activeTab === 'Grades' && (
                loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div> :
                <div>
                  <SectionHeader icon={BookOpen} title="Grade Records" />
                  {details?.grades?.length ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.82rem' }}>
                        <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Units</th><th>Grade</th><th>Semester</th></tr></thead>
                        <tbody>{details.grades.map((g, i) => <tr key={i}><td>{g.subjectCode}</td><td>{g.subjectName || '—'}</td><td>{g.units}</td><td style={{ fontWeight: 600 }}>{g.gradeDisplay || g.gradeNumeric || g.grade}</td><td>{g.semester || '—'}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem', fontSize: '0.875rem' }}>No grade records found</div>}
                </div>
              )}

              {activeTab === 'Survey' && (
                loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div> :
                <div>
                  <SectionHeader icon={ClipboardList} title="Survey Response" />
                  {details?.survey ? (
                    <div>
                      <div style={{ marginBottom: '0.75rem' }}><span className={`badge ${details.survey.completed ? 'badge-success' : 'badge-warning'}`}>{details.survey.completed ? 'Completed' : 'In Progress'}</span></div>
                      {details.survey.categoryScores?.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                          {details.survey.categoryScores.map(cs => (
                            <div key={cs.category} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.6rem 0.875rem' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'capitalize', marginBottom: '0.2rem' }}>{cs.category.replace(/_/g, ' ')}</div>
                              <div style={{ fontWeight: 700, color: 'var(--maroon)' }}>{Number(cs.average).toFixed(2)} <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 400 }}>/ 5.00</span></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem', fontSize: '0.875rem' }}>No survey response found</div>}
                </div>
              )}

              {activeTab === 'Skills' && (
                loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div> :
                <div>
                  <SectionHeader icon={Code2} title="Technical Skills" />
                  {details?.techSkills?.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                      {details.techSkills.map((s2, i) => <span key={i} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 20, padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 500 }}>{s2.skillName} <span style={{ color: '#60a5fa' }}>({s2.level || 'Intermediate'})</span></span>)}
                    </div>
                  ) : <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem', marginBottom: '1rem' }}>No technical skills recorded</div>}
                  <SectionHeader icon={Brain} title="Soft Skills" />
                  {Object.keys(details?.softSkills || {}).length > 0 && Object.values(details.softSkills).some(v => v > 0) ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.4rem' }}>
                      {Object.entries(details.softSkills).map(([key, val]) => (
                        <div key={key} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                          <div style={{ fontWeight: 700, color: 'var(--maroon)' }}>{val} <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 400 }}>/ 5</span></div>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No soft skills recorded</div>}
                </div>
              )}

              {activeTab === 'Certifications' && (
                loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div> :
                <div>
                  <SectionHeader icon={Award} title="Certifications" />
                  {details?.certifications?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {details.certifications.map((c, i) => (
                        <div key={i} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.6rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-800)' }}>{c.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{c.issuer || c.category || ''} {c.year ? `· ${c.year}` : ''}</div>
                          </div>
                          {c.credentialUrl && <a href={c.credentialUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--maroon)' }}>View</a>}
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem', fontSize: '0.875rem' }}>No certifications found</div>}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-outline">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ResultsManagementPage() {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);
  const [archiving, setArchiving] = useState(null);

  useEffect(() => { fetchResults(); }, []);

  const fetchResults = async () => {
    try {
      const res = await api.get('/results');
      setResults(Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data?.data) ? res.data.data : []));
    } finally { setLoading(false); }
  };

  const handleArchive = async (r) => {
    const action = r.archived ? 'unarchive' : 'archive';
    const confirm = await Swal.fire({ title: `${r.archived ? 'Unarchive' : 'Archive'} this result?`, text: `This will ${action} the result for ${r.userId?.fullName || r.studentNumber}.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#800000', confirmButtonText: `Yes, ${action}` });
    if (!confirm.isConfirmed) return;
    setArchiving(r._id);
    try {
      await api.put(`/results/${r._id}/archive`);
      await fetchResults();
      Swal.fire({ icon: 'success', title: `Result ${action}d`, timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Failed', text: `Could not ${action} result.` });
    } finally { setArchiving(null); }
  };

  const filtered = results.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.userId?.fullName?.toLowerCase().includes(q) || r.studentNumber?.includes(q);
    if (filterStatus === 'Archived') return matchSearch && r.archived;
    if (filterStatus === 'All') return matchSearch && !r.archived;
    return matchSearch && !r.archived && r.employabilityStatus === filterStatus;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusStyle = (st) => STATUS_COLORS[st] || { bg: 'var(--gray-100)', text: 'var(--gray-600)', border: 'var(--gray-200)' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Results Management</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>{results.filter(r => !r.archived).length} active result{results.filter(r => !r.archived).length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input type="text" className="form-control" style={{ paddingLeft: '2.1rem' }} placeholder="Search by name or student no..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(sf => (
            <button key={sf} onClick={() => { setFilterStatus(sf); setPage(1); }} className="btn btn-sm" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: filterStatus === sf ? 'var(--maroon)' : 'white', color: filterStatus === sf ? 'white' : 'var(--gray-600)', border: `1px solid ${filterStatus === sf ? 'var(--maroon)' : 'var(--gray-200)'}`, fontWeight: filterStatus === sf ? 700 : 400 }}>{sf}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student No.</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Career Track</th>
                  <th>GWA</th>
                  <th>Generated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => {
                  const sc = statusStyle(r.employabilityStatus);
                  return (
                    <tr key={r._id} style={{ opacity: r.archived ? 0.65 : 1 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--maroon)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                            {r.userId?.fullName?.[0]?.toUpperCase() || r.studentNumber?.[0] || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-800)' }}>{r.userId?.fullName || 'Unknown'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{r.userId?.email || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{r.studentNumber || '—'}</td>
                      <td style={{ fontWeight: 700, fontSize: '0.9rem', color: sc.text }}>{Number(r.employabilityScore || 0).toFixed(1)}%</td>
                      <td>
                        <span style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {r.archived ? 'Archived' : (r.employabilityStatus || '—')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>{r.clusterLabel || '—'}</td>
                      <td style={{ fontSize: '0.875rem', fontWeight: 600 }}>{Number(r.inputSummary?.gwa || 0).toFixed(2)}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button onClick={() => setSelectedResult(r)} className="btn btn-sm btn-outline" style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', gap: '0.25rem' }}>
                            <Eye size={12} /> View
                          </button>
                          <button onClick={() => handleArchive(r)} disabled={archiving === r._id} className="btn btn-sm btn-outline" style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', gap: '0.25rem', color: r.archived ? '#15803d' : '#d97706', borderColor: r.archived ? '#bbf7d0' : '#fde68a' }}>
                            {archiving === r._id ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }}></span> : <><Archive size={12} />{r.archived ? 'Unarchive' : 'Archive'}</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2.5rem' }}>No results found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      {selectedResult && <ResultDetailModal result={selectedResult} onClose={() => setSelectedResult(null)} />}
    </div>
  );
}