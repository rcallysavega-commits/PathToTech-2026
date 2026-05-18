import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Search, Eye, Download, FileText, Filter, ChevronLeft, ChevronRight, X, BookOpen, ClipboardList, Award, Code2, Brain } from 'lucide-react';
import api from '../../services/api';
import { EMPLOYABILITY_STATUS_COLORS } from '../../utils/constants';
import { downloadTemplatePdf } from '../../utils/pdfExport';

const PAGE_SIZE = 10;

function exportCSV(rows) {
  const headers = ['Name', 'Email', 'Student No.', 'Major', 'Gender', 'Status', 'Joined'];
  const csv = [headers, ...rows.map(s => [
    s.fullName, s.email, s.studentNumber || '', s.major || '', s.gender || '',
    s.emailVerified ? 'Verified' : 'Unverified',
    new Date(s.createdAt).toLocaleDateString(),
  ])].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'students.csv'; a.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(rows) {
  if (!rows.length) return;
  const tableRows = rows.map((s) => [
    s.fullName,
    s.email,
    s.studentNumber || '',
    s.major || '',
    s.gender || '',
    s.emailVerified ? 'Verified' : 'Unverified',
    new Date(s.createdAt).toLocaleDateString(),
  ]);

  await downloadTemplatePdf({
    reportTitle: 'PathToTech Student List',
    subtitle: `${rows.length} student(s)`,
    columns: ['Name', 'Email', 'Student No.', 'Major', 'Gender', 'Status', 'Joined'],
    rows: tableRows,
    fileName: `students-${new Date().toISOString().slice(0, 10)}`,
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

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--gray-50)', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: '0.82rem', minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: '0.82rem', color: 'var(--gray-800)' }}>{value || '—'}</span>
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

function StudentDetailModal({ student, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Profile');
  const MODAL_TABS = ['Profile', 'Grades', 'Survey', 'Skills', 'Certifications', 'Prediction'];

  useEffect(() => {
    if (!student) return;
    (async () => {
      setLoading(true);
      const [gradesR, surveyR, techR, softR, certR, resultR] = await Promise.allSettled([
        api.get(`/grades/${student.studentNumber || 'none'}`),
        api.get(`/responses/user/${student._id}`),
        api.get(`/technical-skills/${student._id}`),
        api.get(`/soft-skills/${student._id}`),
        api.get(`/certifications/${student._id}`),
        api.get(`/results/${student.studentNumber || 'none'}`),
      ]);
      setDetails({
        grades: gradesR.status === 'fulfilled' ? (gradesR.value.data?.data?.grades || gradesR.value.data?.grades || []) : [],
        survey: surveyR.status === 'fulfilled' ? (surveyR.value.data?.response || null) : null,
        techSkills: techR.status === 'fulfilled' ? (techR.value.data?.data?.skills || []) : [],
        softSkills: softR.status === 'fulfilled' ? (softR.value.data?.data?.scores || {}) : {},
        certifications: certR.status === 'fulfilled' ? (certR.value.data?.data?.certifications || []) : [],
        prediction: resultR.status === 'fulfilled' ? (resultR.value.data?.result || null) : null,
      });
      setLoading(false);
    })();
  }, [student]);

  if (!student) return null;

  const missing = [];
  if (!student.studentNumber) missing.push('Student Number (Profile incomplete)');
  if (details && !details.grades?.length) missing.push('Grades');
  if (details && !details.survey) missing.push('Survey Response');
  if (details && !details.techSkills?.length) missing.push('Technical Skills');
  if (details && Object.values(details.softSkills || {}).every(v => !v)) missing.push('Soft Skills');
  if (details && !details.certifications?.length) missing.push('Certifications');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 760, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--gray-100)', background: 'var(--maroon)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '1rem' }}>
              {student.fullName?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{student.fullName}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{student.email} · {student.studentNumber || 'No student no.'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', overflowX: 'auto' }}>
          {MODAL_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? 'var(--maroon)' : 'var(--gray-500)', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--maroon)' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.25rem 1.5rem', maxHeight: '65vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner"></span></div>
          ) : (
            <>
              {/* PROFILE TAB */}
              {activeTab === 'Profile' && (
                <div>
                  <SectionHeader icon={Eye} title="Basic Information" />
                  <InfoRow label="Full Name" value={student.fullName} />
                  <InfoRow label="Email" value={student.email} />
                  <InfoRow label="Student Number" value={student.studentNumber} />
                  <InfoRow label="Major" value={student.major} />
                  <InfoRow label="Gender" value={student.gender} />
                  <InfoRow label="Email Verified" value={student.emailVerified ? 'Yes' : 'No'} />
                  <InfoRow label="Registered" value={new Date(student.createdAt).toLocaleString()} />
                  {missing.length > 0 && (
                    <div style={{ marginTop: '1rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius)', padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Missing Requirements for Algorithm</div>
                      {missing.map((m, i) => <div key={i} style={{ fontSize: '0.82rem', color: '#78350f' }}>• {m}</div>)}
                    </div>
                  )}
                </div>
              )}

              {/* GRADES TAB */}
              {activeTab === 'Grades' && (
                <div>
                  <SectionHeader icon={BookOpen} title="Academic Records" />
                  {details.grades?.length ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.82rem' }}>
                        <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Units</th><th>Grade</th></tr></thead>
                        <tbody>
                          {details.grades.map((g, i) => (
                            <tr key={i}>
                              <td>{g.subjectCode}</td>
                              <td>{g.subjectTitle || g.subjectName || '—'}</td>
                              <td>{g.units}</td>
                              <td style={{ fontWeight: 600 }}>{g.gradeDisplay || g.gradeNumeric || g.grade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem', fontSize: '0.875rem' }}>No grade records found</div>}
                </div>
              )}

              {/* SURVEY TAB */}
              {activeTab === 'Survey' && (
                <div>
                  <SectionHeader icon={ClipboardList} title="Survey Response" />
                  {details.survey ? (
                    <div>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${details.survey.completed ? 'badge-success' : 'badge-warning'}`}>{details.survey.completed ? 'Completed' : 'In Progress'}</span>
                        {details.survey.totalAverage > 0 && <span style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>Overall Average: <strong style={{ color: 'var(--maroon)' }}>{Number(details.survey.totalAverage).toFixed(2)} / 5.00</strong></span>}
                      </div>
                      {details.survey.categoryScores?.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                          {details.survey.categoryScores.map(cs => (
                            <div key={cs.category} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.6rem 0.875rem' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.2rem', textTransform: 'capitalize' }}>{cs.category.replace(/_/g, ' ')}</div>
                              <div style={{ fontWeight: 700, color: 'var(--maroon)', fontSize: '0.95rem' }}>{Number(cs.average).toFixed(2)} <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 400 }}>/ 5.00</span></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem', fontSize: '0.875rem' }}>No survey response found</div>}
                </div>
              )}

              {/* SKILLS TAB */}
              {activeTab === 'Skills' && (
                <div>
                  <SectionHeader icon={Code2} title="Technical Skills" />
                  {details.techSkills?.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                      {details.techSkills.map((s, i) => (
                        <span key={i} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 20, padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 500 }}>
                          {s.skillName} <span style={{ color: '#60a5fa' }}>({s.level || 'Intermediate'})</span>
                        </span>
                      ))}
                    </div>
                  ) : <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem', marginBottom: '1rem' }}>No technical skills recorded</div>}

                  <SectionHeader icon={Brain} title="Soft Skills" />
                  {Object.keys(details.softSkills || {}).length > 0 && Object.values(details.softSkills).some(v => v > 0) ? (
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

              {/* CERTIFICATIONS TAB */}
              {activeTab === 'Certifications' && (
                <div>
                  <SectionHeader icon={Award} title="Certifications" />
                  {details.certifications?.length ? (
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

              {/* PREDICTION TAB */}
              {activeTab === 'Prediction' && (
                <div>
                  <SectionHeader icon={FileText} title="Prediction Result" />
                  {details.prediction ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        {[
                          { label: 'Employability Score', value: `${Number(details.prediction.employabilityScore || 0).toFixed(1)}%` },
                          { label: 'Status', value: details.prediction.employabilityStatus },
                          { label: 'Career Track', value: details.prediction.clusterLabel },
                          { label: 'GWA', value: Number(details.prediction.inputSummary?.gwa || 0).toFixed(2) },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.2rem' }}>{label}</div>
                            <div style={{ fontWeight: 700, color: 'var(--maroon)', fontSize: '0.95rem' }}>{value || '—'}</div>
                          </div>
                        ))}
                      </div>
                      {details.prediction.recommendations?.length > 0 && (
                        <>
                          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Recommendations</div>
                          {details.prediction.recommendations.map((r, i) => <div key={i} style={{ fontSize: '0.82rem', color: 'var(--gray-600)', padding: '0.2rem 0' }}>• {r}</div>)}
                        </>
                      )}
                      {details.prediction.skillImprovementSuggestions?.length > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Skill Improvement Suggestions</div>
                          {details.prediction.skillImprovementSuggestions.map((s, i) => <div key={i} style={{ fontSize: '0.82rem', color: 'var(--gray-600)', padding: '0.2rem 0' }}>• {s}</div>)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '1.5rem', fontSize: '0.875rem', marginBottom: '0.5rem' }}>No prediction result yet</div>
                      {missing.length > 0 && (
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius)', padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Missing Requirements</div>
                          {missing.map((m, i) => <div key={i} style={{ fontSize: '0.82rem', color: '#78350f' }}>• {m}</div>)}
                        </div>
                      )}
                    </div>
                  )}
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

export default function ManageStudentsPage() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [filterMajor, setFilterMajor] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/users?role=student');
      setStudents(Array.isArray(res.data?.users) ? res.data.users : []);
    } finally { setLoading(false); }
  };

  const majors = [...new Set(students.map(s => s.major).filter(Boolean))].sort();
  const genders = [...new Set(students.map(s => s.gender).filter(Boolean))].sort();

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.fullName?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.studentNumber?.includes(q);
    const matchMajor = !filterMajor || s.major === filterMajor;
    const matchGender = !filterGender || s.gender === filterGender;
    const matchStatus = !filterStatus || (filterStatus === 'verified' ? s.emailVerified : !s.emailVerified);
    return matchSearch && matchMajor && matchGender && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = useCallback(() => setPage(1), []);

  const activeFilterCount = [filterMajor, filterGender, filterStatus].filter(Boolean).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Manage Students</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>{students.length} registered students</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => exportCSV(filtered)} className="btn btn-secondary" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => exportPDF(filtered)} className="btn btn-secondary" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
            <FileText size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input type="text" className="form-control" style={{ paddingLeft: '2.1rem' }} placeholder="Search by name, email, or student no..." value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} />
        </div>
        <button onClick={() => setShowFilters(v => !v)} className="btn btn-outline" style={{ gap: '0.4rem', fontSize: '0.82rem', position: 'relative' }}>
          <Filter size={14} /> Filters {activeFilterCount > 0 && <span style={{ background: 'var(--maroon)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', marginLeft: 2 }}>{activeFilterCount}</span>}
        </button>
      </div>

      {showFilters && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)' }}>Major</label>
            <select className="form-control" style={{ minWidth: 160, fontSize: '0.85rem' }} value={filterMajor} onChange={e => { setFilterMajor(e.target.value); resetPage(); }}>
              <option value="">All Majors</option>
              {majors.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)' }}>Gender</label>
            <select className="form-control" style={{ minWidth: 130, fontSize: '0.85rem' }} value={filterGender} onChange={e => { setFilterGender(e.target.value); resetPage(); }}>
              <option value="">All Genders</option>
              {genders.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)' }}>Status</label>
            <select className="form-control" style={{ minWidth: 140, fontSize: '0.85rem' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); resetPage(); }}>
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button className="btn btn-outline" style={{ fontSize: '0.82rem' }} onClick={() => { setFilterMajor(''); setFilterGender(''); setFilterStatus(''); resetPage(); }}>Clear Filters</button>
          )}
        </div>
      )}

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
                  <th>Major</th>
                  <th>Gender</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(s => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        {s.profilePicture ? (
                          <img src={s.profilePicture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--maroon)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                            {s.fullName?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-800)' }}>{s.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{s.studentNumber || '—'}</td>
                    <td style={{ fontSize: '0.875rem' }}>{s.major || '—'}</td>
                    <td style={{ fontSize: '0.875rem' }}>{s.gender || '—'}</td>
                    <td>
                      <span className={`badge ${s.emailVerified ? 'badge-success' : 'badge-warning'}`}>
                        {s.emailVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => setSelectedStudent(s)} className="btn btn-sm btn-outline" style={{ gap: '0.3rem', fontSize: '0.78rem' }}>
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2.5rem' }}>No students found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      {selectedStudent && (
        <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}