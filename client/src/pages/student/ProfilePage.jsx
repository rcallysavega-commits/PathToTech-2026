import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { User, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const MAJORS = ['Computer Science', 'Information Technology', 'Information Systems'];
const GENDERS = ['Male', 'Female', 'Prefer not to say'];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ fullName: '', studentNumber: '', gender: '', major: '' });
  const [loading, setLoading] = useState(false);
  const studentNumberRef = useRef(null);

  useEffect(() => {
    if (user) setForm({ fullName: user.fullName || '', studentNumber: user.studentNumber || '', gender: user.gender || '', major: user.major || '' });
  }, [user]);

  useEffect(() => {
    if (searchParams.get('focus') !== 'studentNumber') return;
    studentNumberRef.current?.focus();
    studentNumberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      await Swal.fire({ title: 'Required', text: 'Full name is required.', icon: 'warning', confirmButtonColor: '#800000' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.put(`/users/${user._id}`, form);
      updateUser(res.data.user);
      await Swal.fire({ title: 'Profile Updated!', text: 'Your profile has been saved.', icon: 'success', confirmButtonColor: '#800000', timer: 2000, showConfirmButton: false });
    } catch (err) {
      await Swal.fire({ title: 'Update Failed', text: err.response?.data?.message || 'Failed to update profile.', icon: 'error', confirmButtonColor: '#800000' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>My Profile</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Update your personal information</p>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--maroon)', padding: '2rem', textAlign: 'center', color: 'white' }}>
          {user?.profilePicture ? (
            <img src={user.profilePicture} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', marginBottom: '0.75rem', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', fontSize: '2rem', fontWeight: 800 }}>
              {user?.fullName?.[0]?.toUpperCase() || 'S'}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user?.fullName}</div>
          <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>{user?.email}</div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input type="text" className="form-control" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Student Number</label>
            <input ref={studentNumberRef} type="text" className="form-control" placeholder="e.g. 2021-12345" value={form.studentNumber} onChange={e => setForm({ ...form, studentNumber: e.target.value })} />
            <small style={{ color: 'var(--gray-400)', fontSize: '0.78rem' }}>Required for grade lookup and prediction generation</small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-control" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select gender</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Major / Program</label>
              <select className="form-control" value={form.major} onChange={e => setForm({ ...form, major: e.target.value })}>
                <option value="">Select major</option>
                {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email (from Google)</label>
            <input type="email" className="form-control" value={user?.email || ''} disabled style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ gap: '0.5rem' }} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Save size={16} />Save Profile</>}
          </button>
        </form>
      </div>
    </div>
  );
}
