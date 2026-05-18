import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { KeyRound, Lock, Save, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function AdminSettingsPage() {
  const { user, updateUser } = useAuth();
  const [profileForm, setProfileForm] = useState({ fullName: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setProfileForm({ fullName: user?.fullName || '' });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.fullName.trim()) {
      await Swal.fire({ title: 'Required', text: 'Full name is required.', icon: 'warning', confirmButtonColor: 'var(--maroon)' });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.put(`/users/${user._id}`, { fullName: profileForm.fullName.trim() });
      updateUser(res.data.user);
      await Swal.fire({ title: 'Profile Updated', text: 'Admin name has been updated.', icon: 'success', confirmButtonColor: 'var(--maroon)' });
    } catch (err) {
      await Swal.fire({ title: 'Update Failed', text: err.response?.data?.message || 'Unable to update profile.', icon: 'error', confirmButtonColor: 'var(--maroon)' });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      await Swal.fire({ title: 'Missing Fields', text: 'Complete all password fields.', icon: 'warning', confirmButtonColor: 'var(--maroon)' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      await Swal.fire({ title: 'Password Mismatch', text: 'New password and confirm password do not match.', icon: 'warning', confirmButtonColor: 'var(--maroon)' });
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await Swal.fire({ title: 'Password Updated', text: 'Admin password has been changed.', icon: 'success', confirmButtonColor: 'var(--maroon)' });
    } catch (err) {
      await Swal.fire({ title: 'Update Failed', text: err.response?.data?.message || 'Unable to change password.', icon: 'error', confirmButtonColor: 'var(--maroon)' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Admin Settings</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Manage your administrator profile and password.</p>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <form onSubmit={saveProfile} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--maroon-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--maroon)' }}>
              <UserRound size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Profile Information</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Update the displayed administrator name.</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-control" value={profileForm.fullName} onChange={(e) => setProfileForm({ fullName: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingProfile}>
            {savingProfile ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Save size={16} />Save Name</>}
          </button>
        </form>

        <form onSubmit={savePassword} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--maroon-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--maroon)' }}>
              <KeyRound size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Password</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Use your current password to authorize the change.</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--gray-400)' }} />
              <input type="password" className="form-control" style={{ paddingLeft: '2.4rem' }} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--gray-400)' }} />
                <input type="password" className="form-control" style={{ paddingLeft: '2.4rem' }} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--gray-400)' }} />
                <input type="password" className="form-control" style={{ paddingLeft: '2.4rem' }} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPassword}>
            {savingPassword ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
