import { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Plus, Trash2, Save, Award, Upload, CheckCircle, Clock, XCircle, AlertCircle, ExternalLink, Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const emptyNew = () => ({
  name: '',
  issuer: '',
  yearObtained: '',
  _tempProofFile: '',
  _tempProofFileName: '',
  _tempProofFileType: '',
  _extracting: false,
  _extractError: '',
});

const RELEVANCE_LABELS = {
  high: { label: 'Dataset-recognized (1.0×)', color: '#15803d', bg: '#dcfce7' },
  medium: { label: 'Known provider (0.6×)', color: '#b45309', bg: '#fef3c7' },
  low: { label: 'Other provider (0.3×)', color: '#6b7280', bg: '#f3f4f6' },
};

const STATUS_BADGES = {
  pending_proof: { label: 'Upload Proof Required', color: '#b45309', bg: '#fef3c7', Icon: AlertCircle },
  pending_review: { label: 'Pending Admin Review', color: '#2563eb', bg: '#dbeafe', Icon: Clock },
  approved: { label: 'Approved', color: '#15803d', bg: '#dcfce7', Icon: CheckCircle },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2', Icon: XCircle },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGES[status] || STATUS_BADGES.pending_proof;
  const { label, color, bg, Icon } = s;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color, background: bg, borderRadius: 999, padding: '2px 10px' }}>
      <Icon size={12} />{label}
    </span>
  );
}

export default function CertificationsPage() {
  const { user } = useAuth();
  const [certifications, setCertifications] = useState([emptyNew()]);
  const [hasNoCertification, setHasNoCertification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRefs = useRef({});

  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  const loadCerts = useCallback(async () => {
    try {
      const res = await api.get(`/certifications/${user._id}`);
      const data = res.data?.data;
      if (data?.hasNoCertification) {
        setHasNoCertification(true);
        setCertifications([]);
      } else if (data?.certifications?.length) {
        setCertifications(data.certifications);
      }
    } catch (_) {}
    setLoading(false);
  }, [user._id]);

  useEffect(() => { loadCerts(); }, [loadCerts]);

  useEffect(() => {
    window.addEventListener('ppt-cert-status-refresh', loadCerts);
    return () => window.removeEventListener('ppt-cert-status-refresh', loadCerts);
  }, [loadCerts]);

  const addCert = () => setCertifications((prev) => [...prev, emptyNew()]);
  const removeCert = (i) => setCertifications((prev) => prev.filter((_, idx) => idx !== i));
  const updateCert = (i, field, value) =>
    setCertifications((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const handleNoCertChange = (checked) => {
    setHasNoCertification(checked);
    setCertifications(checked ? [] : [emptyNew()]);
  };

  // Upload for a NEW (not-yet-saved) cert — validates + extracts fields from PDF
  const handleExtractFields = async (index, file) => {
    if (!file) return;
    setCertifications((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, _extracting: true, _extractError: '' } : c))
    );
    try {
      const formData = new FormData();
      formData.append('proof', file);
      const res = await api.post('/certifications/extract-fields', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { proofFile, proofFileName, proofFileType, extracted } = res.data;
      setCertifications((prev) =>
        prev.map((c, idx) => {
          if (idx !== index) return c;
          return {
            ...c,
            _tempProofFile: proofFile,
            _tempProofFileName: proofFileName,
            _tempProofFileType: proofFileType,
            _extracting: false,
            _extractError: '',
            // Pre-fill extracted fields — student can still edit
            name: extracted?.name || c.name,
            issuer: extracted?.issuer || c.issuer,
            yearObtained: extracted?.yearObtained || c.yearObtained,
          };
        })
      );
    } catch (err) {
      setCertifications((prev) =>
        prev.map((c, idx) =>
          idx === index
            ? { ...c, _extracting: false, _extractError: err.response?.data?.message || 'Upload failed. Please try again.' }
            : c
        )
      );
    }
  };

  // Re-upload proof for an EXISTING (already saved) cert
  const handleReuploadProof = async (certId, file) => {
    if (!file) return;
    setUploadingId(certId);
    try {
      const formData = new FormData();
      formData.append('proof', file);
      await api.post(`/certifications/upload-proof/${certId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadCerts();
      await Swal.fire({ title: 'Proof Uploaded!', text: 'Your proof has been submitted for admin review.', icon: 'success', confirmButtonColor: '#800000', timer: 3000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Upload Failed', text: err.response?.data?.message || 'Failed to upload proof.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async () => {
    if (!hasNoCertification) {
      for (const c of certifications) {
        if (!c._id) {
          if (!c._tempProofFile) {
            await Swal.fire({ title: 'Upload Required', text: 'Upload your certificate file first before saving.', icon: 'warning', confirmButtonColor: '#800000' });
            return;
          }
          if (!c.name?.trim() || !c.issuer?.trim() || !c.yearObtained) {
            await Swal.fire({ title: 'Incomplete', text: 'Please fill in all fields (name, issuing organization, year).', icon: 'warning', confirmButtonColor: '#800000' });
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      // Build payload — strip local-only _* fields, map _temp* to actual proof fields
      const payload = certifications.map((c) => {
        const { _tempProofFile, _tempProofFileName, _tempProofFileType, _extracting, _extractError, ...rest } = c;
        if (!c._id && _tempProofFile) {
          return { ...rest, proofFile: _tempProofFile, proofFileName: _tempProofFileName, proofFileType: _tempProofFileType };
        }
        return rest;
      });

      await api.post('/certifications', { userId: user._id, certifications: hasNoCertification ? [] : payload, hasNoCertification });

      if (user?.studentNumber) {
        try { await api.post(`/predictions/${user.studentNumber}`); } catch (_) {}
      }
      window.dispatchEvent(new Event('ppt-prediction-refresh'));
      await loadCerts();
      await Swal.fire({ title: 'Saved!', text: 'Certifications saved successfully.', icon: 'success', confirmButtonColor: '#800000', timer: 2500, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Save Failed', text: err.response?.data?.message || 'Failed to save.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <span className="spinner"></span>
    </div>
  );

  const currentYear = new Date().getFullYear();

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Certifications</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Upload your certificate proof — details will be auto-filled from the file</p>
        </div>
        <button onClick={handleSave} className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Save size={15} />Save</>}
        </button>
      </div>

      {/* No certification checkbox */}
      <div style={{ background: 'white', border: `2px solid ${hasNoCertification ? 'var(--maroon)' : 'var(--gray-100)'}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={hasNoCertification} onChange={(e) => handleNoCertChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#800000' }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>I don't have any certifications</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.1rem' }}>Check this if you haven't obtained any industry certifications.</div>
          </div>
        </label>
      </div>

      {!hasNoCertification && (
        <>
          {certifications.map((cert, i) => {
            const isNew = !cert._id;
            const certId = cert._id ? String(cert._id) : null;
            const status = cert.status || null;
            const rel = RELEVANCE_LABELS[cert.relevanceTier] || RELEVANCE_LABELS.low;
            const isUploading = uploadingId === certId;
            const proofUrl = cert.proofFile
              ? (cert.proofFile.startsWith('http') ? cert.proofFile : `${apiBase}/uploads/certifications/${cert.proofFile}`)
              : null;
            const refKey = certId || `new_${i}`;

            return (
              <div key={certId || `new_${i}`} style={{
                background: 'white',
                border: `1px solid ${status === 'rejected' ? '#fca5a5' : status === 'approved' ? '#86efac' : 'var(--gray-100)'}`,
                borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem',
              }}>
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--maroon)' }}>
                    <Award size={18} />Certification #{i + 1}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {status && <StatusBadge status={status} />}
                    {status !== 'approved' && (
                      <button onClick={() => removeCert(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── NEW CERT: upload-first zone ── */}
                {isNew && (
                  <div style={{ marginBottom: '1rem' }}>
                    {!cert._tempProofFile && !cert._extracting && (
                      <div
                        style={{ border: `2px dashed ${cert._extractError ? '#fca5a5' : 'var(--gray-200)'}`, borderRadius: 10, padding: '1.75rem', textAlign: 'center', cursor: 'pointer', background: cert._extractError ? '#fff7f7' : 'var(--gray-50)', transition: 'border-color 0.15s' }}
                        onClick={() => fileInputRefs.current[refKey]?.click()}
                      >
                        <Upload size={30} style={{ color: 'var(--maroon)', marginBottom: '0.5rem' }} />
                        <div style={{ fontWeight: 600, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Click to Upload Certificate</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '0.25rem' }}>PDF or clear photo/image (JPEG, PNG, WEBP) · max 10 MB</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: '0.15rem' }}>The system will read your certificate and auto-fill the title, issuer, and year</div>
                        {cert._extractError && (
                          <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#dc2626', fontWeight: 500 }}>{cert._extractError}</div>
                        )}
                      </div>
                    )}
                    {cert._extracting && (
                      <div style={{ border: '2px dashed #bfdbfe', borderRadius: 10, padding: '1.75rem', textAlign: 'center', background: '#eff6ff' }}>
                        <Loader size={26} style={{ color: '#2563eb', marginBottom: '0.5rem', animation: 'spin 1s linear infinite' }} />
                        <div style={{ fontSize: '0.875rem', color: '#2563eb', fontWeight: 600 }}>Validating certificate and extracting info...</div>
                      </div>
                    )}
                    {cert._tempProofFile && !cert._extracting && (
                      <div style={{ border: '1px solid #86efac', borderRadius: 10, padding: '0.75rem 1rem', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <CheckCircle size={18} style={{ color: '#15803d', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert._tempProofFileName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#166534' }}>Certificate uploaded — review and confirm the details below, then click Save</div>
                        </div>
                        <button
                          onClick={() => fileInputRefs.current[refKey]?.click()}
                          style={{ background: 'none', border: '1px solid #86efac', borderRadius: 6, padding: '2px 10px', fontSize: '0.75rem', color: '#15803d', cursor: 'pointer' }}
                        >
                          Replace
                        </button>
                      </div>
                    )}
                    <input
                      ref={(el) => (fileInputRefs.current[refKey] = el)}
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => { if (e.target.files[0]) handleExtractFields(i, e.target.files[0]); e.target.value = ''; }}
                    />
                  </div>
                )}

                {/* Fields — show only after upload for new certs, always for existing */}
                {(!isNew || cert._tempProofFile) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Certification Name *</label>
                      <input type="text" className="form-control" placeholder="e.g. AWS Certified Cloud Practitioner" value={cert.name} onChange={(e) => updateCert(i, 'name', e.target.value)} disabled={status === 'approved'} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Issuing Organization *</label>
                      <input type="text" className="form-control" placeholder="e.g. Amazon Web Services" value={cert.issuer} onChange={(e) => updateCert(i, 'issuer', e.target.value)} disabled={status === 'approved'} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Year Obtained *</label>
                      <input type="number" className="form-control" placeholder="2024" min={2000} max={currentYear} value={cert.yearObtained} onChange={(e) => updateCert(i, 'yearObtained', e.target.value)} disabled={status === 'approved'} />
                    </div>
                  </div>
                )}

                {/* Relevance tier badge for saved certs */}
                {!isNew && cert.relevanceTier && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: rel.color, background: rel.bg, borderRadius: 6, padding: '2px 10px' }}>
                      Algorithm weight: {rel.label}
                    </span>
                  </div>
                )}

                {/* Rejection reason */}
                {status === 'rejected' && cert.adminNote && (
                  <div style={{ marginTop: '0.75rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '0.625rem 0.875rem', fontSize: '0.82rem', color: '#991b1b' }}>
                    <strong>Rejection reason:</strong> {cert.adminNote}
                  </div>
                )}

                {/* Re-upload for existing certs that need it */}
                {certId && (status === 'pending_proof' || status === 'rejected') && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-100)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                      {status === 'rejected' ? 'Re-upload corrected proof' : 'Upload certificate proof'}
                    </div>
                    <input
                      ref={(el) => (fileInputRefs.current[refKey] = el)}
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => { if (e.target.files[0]) handleReuploadProof(certId, e.target.files[0]); e.target.value = ''; }}
                    />
                    <button
                      className="btn btn-outline"
                      style={{ gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[refKey]?.click()}
                    >
                      {isUploading
                        ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }}></span> Uploading...</>
                        : <><Upload size={13} />{status === 'rejected' ? 'Re-upload Proof' : 'Upload Proof'}</>}
                    </button>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: '0.3rem' }}>PDF or JPEG/PNG/WEBP · max 10 MB</div>
                  </div>
                )}

                {/* Pending review */}
                {status === 'pending_review' && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#2563eb' }}>
                    <Clock size={13} />Proof submitted — waiting for admin review.
                    {proofUrl && <a href={proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', marginLeft: 4 }}><ExternalLink size={11} /></a>}
                  </div>
                )}

                {/* Approved */}
                {status === 'approved' && (
                  <div style={{ marginTop: '0.75rem', background: '#dcfce7', borderRadius: 6, padding: '0.5rem 0.875rem', fontSize: '0.8rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={13} />Verified — counts toward your employability score.
                    {proofUrl && <a href={proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#166534', marginLeft: 4 }}><ExternalLink size={11} /></a>}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={addCert} className="btn btn-outline" style={{ gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
            <Plus size={18} />Add Another Certification
          </button>
        </>
      )}

      {hasNoCertification && (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
          <Award size={40} style={{ color: 'var(--gray-300)', marginBottom: '0.75rem' }} />
          <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>You've indicated no certifications. This is factored into your employability prediction.</div>
        </div>
      )}
    </div>
  );
}
