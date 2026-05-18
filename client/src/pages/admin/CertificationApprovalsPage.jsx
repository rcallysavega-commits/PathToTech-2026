import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Award, CheckCircle, XCircle, ExternalLink, RefreshCw, FileText, Image, Clock, X } from 'lucide-react';
import api from '../../services/api';

const RELEVANCE_LABELS = {
  high: { label: 'High (1.0Ã—)', color: '#15803d', bg: '#dcfce7' },
  medium: { label: 'Medium (0.6Ã—)', color: '#b45309', bg: '#fef3c7' },
  low: { label: 'Low (0.3Ã—)', color: '#6b7280', bg: '#f3f4f6' },
};

const STATUS_META = {
  pending_review: { label: 'Pending Review', color: '#2563eb', bg: '#dbeafe' },
  pending_proof:  { label: 'Awaiting Proof', color: '#9333ea', bg: '#f3e8ff' },
  approved:       { label: 'Approved',        color: '#15803d', bg: '#dcfce7' },
  rejected:       { label: 'Rejected',        color: '#dc2626', bg: '#fee2e2' },
};

const TABS = ['All', 'Pending', 'Approved', 'Rejected'];

export default function CertificationApprovalsPage() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [tab, setTab] = useState('Pending');
  const [proofModal, setProofModal] = useState(null); // { url, isPdf, fileName }

  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/certifications/admin/all');
      const raw = res.data?.data || [];
      // Flatten: one row per certification item
      const rows = [];
      for (const doc of raw) {
        for (const cert of (doc.certifications || [])) {
          rows.push({
            certId: String(cert._id),
            student: doc.student,
            cert,
          });
        }
      }
      setAllItems(rows);
    } catch {
      setAllItems([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    window.addEventListener('ppt-cert-pending-refresh', fetchAll);
    return () => window.removeEventListener('ppt-cert-pending-refresh', fetchAll);
  }, [fetchAll]);

  const getProofUrl = (cert) => {
    if (!cert.proofFile) return null;
    if (cert.proofFile.startsWith('http')) return cert.proofFile;
    return `${apiBase}/uploads/certifications/${cert.proofFile}`;
  };

  const handleApprove = async (certId, studentName, certName) => {
    const confirm = await Swal.fire({
      title: 'Approve Certification?',
      html: `Approve <strong>${certName}</strong> for <strong>${studentName}</strong>?<br><small>This will count toward their employability score.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Approve',
    });
    if (!confirm.isConfirmed) return;

    setActionId(certId);
    try {
      await api.patch(`/certifications/admin/${certId}/approve`);
      setAllItems(prev => prev.map(item =>
        item.certId === certId ? { ...item, cert: { ...item.cert, status: 'approved' } } : item
      ));
      await Swal.fire({ title: 'Approved!', text: 'Certification has been approved.', icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Failed to approve.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (certId, studentName, certName) => {
    const { value: adminNote, isConfirmed } = await Swal.fire({
      title: 'Reject Certification',
      html: `Rejecting <strong>${certName}</strong> for <strong>${studentName}</strong>.<br><small>Provide a reason so the student knows what to fix:</small>`,
      input: 'textarea',
      inputPlaceholder: 'e.g. The uploaded file does not appear to be a valid certificate. Please upload the actual certificate with your name, seminar title, and issuer signature.',
      inputAttributes: { rows: 3 },
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Reject',
      inputValidator: (value) => !value?.trim() ? 'Please provide a reason for rejection.' : undefined,
    });
    if (!isConfirmed) return;

    setActionId(certId);
    try {
      await api.patch(`/certifications/admin/${certId}/reject`, { adminNote });
      setAllItems(prev => prev.map(item =>
        item.certId === certId ? { ...item, cert: { ...item.cert, status: 'rejected', adminNote } } : item
      ));
      await Swal.fire({ title: 'Rejected', text: 'Certification has been rejected. Student will be notified.', icon: 'info', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Failed to reject.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setActionId(null);
    }
  };

  const filteredItems = allItems.filter(({ cert }) => {
    if (tab === 'All') return true;
    if (tab === 'Pending') return cert.status === 'pending_review' || cert.status === 'pending_proof';
    if (tab === 'Approved') return cert.status === 'approved';
    if (tab === 'Rejected') return cert.status === 'rejected';
    return true;
  });

  const counts = {
    All: allItems.length,
    Pending: allItems.filter(i => i.cert.status === 'pending_review' || i.cert.status === 'pending_proof').length,
    Approved: allItems.filter(i => i.cert.status === 'approved').length,
    Rejected: allItems.filter(i => i.cert.status === 'rejected').length,
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Certification Approvals</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Review and approve or reject student certification submissions</p>
        </div>
        <button onClick={fetchAll} className="btn btn-outline" style={{ gap: '0.4rem' }} disabled={loading}>
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--gray-100)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: tab === t ? 700 : 500,
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--maroon)' : '2px solid transparent',
              color: tab === t ? 'var(--maroon)' : 'var(--gray-500)',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'color 0.15s',
            }}
          >
            {t}
            <span style={{
              marginLeft: 5,
              fontSize: '0.72rem',
              fontWeight: 700,
              background: tab === t ? 'var(--maroon)' : 'var(--gray-200)',
              color: tab === t ? 'white' : 'var(--gray-600)',
              borderRadius: 999,
              padding: '1px 7px',
            }}>{counts[t]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <span className="spinner"></span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
          <CheckCircle size={48} style={{ color: '#86efac', marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.25rem' }}>
            {tab === 'Pending' ? 'All caught up!' : `No ${tab.toLowerCase()} certifications`}
          </div>
          <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {tab === 'Pending' ? 'No certifications are pending review at this time.' : `There are no ${tab.toLowerCase()} certifications yet.`}
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
            {filteredItems.length} certification{filteredItems.length !== 1 ? 's' : ''}
          </div>
          {filteredItems.map((item) => {
            const { certId, student, cert } = item;
            const rel = RELEVANCE_LABELS[cert.relevanceTier] || RELEVANCE_LABELS.low;
            const statusMeta = STATUS_META[cert.status] || STATUS_META.pending_review;
            const proofUrl = getProofUrl(cert);
            const isPdf = cert.proofFileType === 'application/pdf';
            const isActioning = actionId === String(certId);
            const isPending = cert.status === 'pending_review';

            return (
              <div key={certId} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--gray-800)', fontSize: '0.95rem' }}>{student?.fullName || 'Unknown Student'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                      {student?.studentNumber && <span style={{ marginRight: 8 }}>#{student.studentNumber}</span>}
                      {student?.email}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: statusMeta.color, background: statusMeta.bg, borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>
                    {statusMeta.label}
                  </span>
                </div>

                {/* Cert details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 600 }}>Certification</div>
                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Award size={14} style={{ color: 'var(--maroon)', flexShrink: 0 }} />{cert.name}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 600 }}>Issuer</div>
                    <div style={{ color: 'var(--gray-700)', fontSize: '0.875rem' }}>{cert.issuer}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 600 }}>Year</div>
                    <div style={{ color: 'var(--gray-700)', fontSize: '0.875rem' }}>{cert.yearObtained || 'â€”'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 600 }}>Category</div>
                    <div style={{ color: 'var(--gray-700)', fontSize: '0.875rem' }}>{cert.category || 'â€”'}</div>
                  </div>
                </div>

                {/* Relevance tier */}
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: rel.color, background: rel.bg, borderRadius: 999, padding: '2px 10px' }}>
                    Algorithm Weight: {rel.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginLeft: 8 }}>
                    {cert.relevanceTier === 'high' ? 'Dataset-recognized provider â€” full employability score credit' :
                     cert.relevanceTier === 'medium' ? 'Known provider but not in training dataset â€” partial credit' :
                     'Provider not in dataset â€” minimal score credit'}
                  </span>
                </div>

                {/* Proof file */}
                {proofUrl ? (
                  <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {isPdf ? <FileText size={20} style={{ color: '#dc2626', flexShrink: 0 }} /> : <Image size={20} style={{ color: '#7c3aed', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cert.proofFileName || 'Proof file'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{isPdf ? 'PDF Document' : 'Image'}</div>
                    </div>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', gap: 4, flexShrink: 0 }}
                      onClick={() => setProofModal({ url: proofUrl, isPdf, fileName: cert.proofFileName || 'Proof file' })}
                    >
                      <Image size={13} />View Proof
                    </button>
                  </div>
                ) : (
                  <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={15} style={{ color: 'var(--gray-400)' }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>No proof file uploaded yet</span>
                  </div>
                )}

                {/* Admin note if rejected */}
                {cert.status === 'rejected' && cert.adminNote && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#dc2626' }}>
                    <strong>Rejection reason:</strong> {cert.adminNote}
                  </div>
                )}

                {/* Action buttons â€” only for pending_review */}
                {isPending && (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      style={{ background: '#15803d', borderColor: '#15803d', gap: '0.4rem', flex: 1, minWidth: 120, justifyContent: 'center' }}
                      disabled={isActioning}
                      onClick={() => handleApprove(certId, student?.fullName, cert.name)}
                    >
                      {isActioning ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: 'white' }}></span> : <CheckCircle size={15} />}
                      Approve
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ color: '#dc2626', borderColor: '#fca5a5', gap: '0.4rem', flex: 1, minWidth: 120, justifyContent: 'center' }}
                      disabled={isActioning}
                      onClick={() => handleReject(certId, student?.fullName, cert.name)}
                    >
                      {isActioning ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> : <XCircle size={15} />}
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Proof Viewer Modal */}
      {proofModal && (
        <div
          onClick={() => setProofModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 12, width: '100%', maxWidth: 820,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {proofModal.isPdf
                  ? <FileText size={18} style={{ color: '#dc2626' }} />
                  : <Image size={18} style={{ color: '#7c3aed' }} />}
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gray-800)' }}>{proofModal.fileName}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  href={proofModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', gap: 4 }}
                >
                  <ExternalLink size={12} />Open in tab
                </a>
                <button
                  onClick={() => setProofModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Modal body */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f8', minHeight: 200 }}>
              {proofModal.isPdf ? (
                <iframe
                  src={proofModal.url}
                  title="Certificate Proof"
                  style={{ width: '100%', height: '75vh', border: 'none' }}
                />
              ) : (
                <img
                  src={proofModal.url}
                  alt="Certificate Proof"
                  style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
