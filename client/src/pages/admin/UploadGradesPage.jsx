import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../services/api';

export default function UploadGradesPage() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [togglingId, setTogglingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    setLoadingUploads(true);
    try {
      const res = await api.get('/grades/uploads');
      setUploads(Array.isArray(res.data?.uploads) ? res.data.uploads : []);
    } catch (_) {
      setUploads([]);
    } finally {
      setLoadingUploads(false);
    }
  };

  const handleFile = (f) => {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      Swal.fire({ title: 'Invalid File', text: 'Only CSV, XLSX, and XLS files are accepted.', icon: 'error', confirmButtonColor: '#800000' });
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    const confirm = await Swal.fire({
      title: 'Upload Grades?',
      text: `Upload "${file.name}" — existing matching records will be updated.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#800000',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Upload',
    });
    if (!confirm.isConfirmed) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/grades/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      await fetchUploads();
      await Swal.fire({
        title: 'Upload Complete!',
        text: `${res.data.total || 0} records processed. ${res.data.errors?.length || 0} errors.`,
        icon: res.data.errors?.length ? 'warning' : 'success',
        confirmButtonColor: '#800000',
      });
    } catch (err) {
      const errData = err.response?.data;
      const errList = errData?.errors;
      if (errList?.length) {
        setResult({ total: 0, errors: errList });
        await Swal.fire({
          title: 'Validation Failed',
          html: `<div style="text-align:left;font-size:0.85rem;max-height:200px;overflow-y:auto">${errList.slice(0, 10).map(e => `<div>• ${typeof e === 'string' ? e : `Row ${e.row}: ${e.message}`}</div>`).join('')}${errList.length > 10 ? `<div>...and ${errList.length - 10} more</div>` : ''}</div>`,
          icon: 'error',
          confirmButtonColor: '#800000',
        });
      } else {
        await Swal.fire({ title: 'Upload Failed', text: errData?.message || 'Upload failed.', icon: 'error', confirmButtonColor: '#800000' });
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleStatus = async (upload) => {
    const nextActive = !upload.active;
    setTogglingId(upload._id);
    try {
      await api.put(`/grades/uploads/${upload._id}/status`, { active: nextActive });
      await fetchUploads();
    } catch (err) {
      await Swal.fire({
        title: 'Status Update Failed',
        text: err.response?.data?.message || 'Failed to update upload status.',
        icon: 'error',
        confirmButtonColor: '#800000',
      });
    } finally {
      setTogglingId('');
    }
  };

  const handleDeleteUpload = async (upload) => {
    const choice = await Swal.fire({
      title: 'Delete uploaded file entry?',
      text: `File: ${upload.originalName}`,
      icon: 'warning',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonColor: '#b91c1c',
      denyButtonColor: '#800000',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete file + grades',
      denyButtonText: 'Delete file only',
      cancelButtonText: 'Cancel',
    });

    if (!choice.isConfirmed && !choice.isDenied) return;

    const deleteGrades = Boolean(choice.isConfirmed);
    setDeletingId(upload._id);
    try {
      const res = await api.delete(`/grades/uploads/${upload._id}`, { data: { deleteGrades } });
      await fetchUploads();
      await Swal.fire({
        title: 'Deleted',
        text: res.data?.message || 'Upload deleted successfully.',
        icon: 'success',
        confirmButtonColor: '#800000',
      });
    } catch (err) {
      await Swal.fire({
        title: 'Delete Failed',
        text: err.response?.data?.message || 'Failed to delete upload.',
        icon: 'error',
        confirmButtonColor: '#800000',
      });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Upload Grades</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Upload student grades via CSV or Excel file</p>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--maroon)' : file ? '#059669' : 'var(--gray-300)'}`,
          background: dragging ? 'var(--maroon-pale)' : file ? '#f0fdf4' : 'white',
          borderRadius: 'var(--radius-lg)', padding: '3rem', textAlign: 'center',
          cursor: 'pointer', transition: 'all 0.2s', marginBottom: '1.25rem',
        }}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        <FileSpreadsheet size={48} style={{ color: file ? '#059669' : 'var(--gray-300)', marginBottom: '0.75rem' }} />
        {file ? (
          <>
            <div style={{ fontWeight: 700, color: '#059669', marginBottom: '0.25rem' }}>{file.name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>{(file.size / 1024).toFixed(1)} KB — Click to change file</div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.25rem' }}>Drop your file here or click to browse</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>Supports CSV, XLSX, XLS</div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={handleUpload} className="btn btn-primary" style={{ gap: '0.5rem' }} disabled={!file || uploading}>
          {uploading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Upload size={16} />Upload Grades</>}
        </button>
        {file && <button onClick={() => { setFile(null); setResult(null); }} className="btn btn-outline">Clear</button>}
      </div>

      {/* Results */}
      {result && (
        <div style={{ marginTop: '1.5rem', background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669' }}>
              <CheckCircle size={18} />
              <span style={{ fontWeight: 700 }}>{result.total || 0} records processed</span>
            </div>
            {result.errors?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                <AlertCircle size={18} />
                <span style={{ fontWeight: 700 }}>{result.errors.length} errors</span>
              </div>
            )}
          </div>
          {result.errors?.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Errors:</div>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: '#7f1d1d', marginBottom: '0.25rem' }}>
                  {typeof e === 'string' ? e : `Row ${e.row}: ${e.message}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload History */}
      <div style={{ marginTop: '1.5rem', background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)' }}>Uploaded CSV/Excel Files</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{uploads.length} file{uploads.length !== 1 ? 's' : ''}</span>
        </div>

        {loadingUploads ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><span className="spinner"></span></div>
        ) : uploads.length === 0 ? (
          <div style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>No uploaded files yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th>Records</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontSize: '0.85rem' }}>{u.originalName}</td>
                    <td style={{ fontSize: '0.82rem' }}>{u.uploadedBy?.fullName || u.uploadedBy?.email || 'Admin'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{new Date(u.createdAt).toLocaleString()}</td>
                    <td style={{ fontSize: '0.82rem' }}>
                      Total: {u.totalRecords || 0}<br />
                      <span style={{ color: 'var(--gray-500)' }}>Inserted: {u.insertedRecords || 0}, Updated: {u.updatedRecords || 0}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-success' : 'badge-secondary'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleStatus(u)}
                          className="btn btn-sm btn-outline"
                          disabled={togglingId === u._id || deletingId === u._id}
                        >
                          {togglingId === u._id ? 'Updating...' : u.active ? 'Set Inactive' : 'Set Active'}
                        </button>
                        <button
                          onClick={() => handleDeleteUpload(u)}
                          className="btn btn-sm"
                          style={{ border: '1px solid #fecaca', color: '#b91c1c', background: '#fef2f2' }}
                          disabled={deletingId === u._id || togglingId === u._id}
                        >
                          {deletingId === u._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
