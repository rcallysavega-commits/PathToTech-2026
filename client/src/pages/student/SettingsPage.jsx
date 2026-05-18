import { useState } from 'react';
import Swal from 'sweetalert2';
import { KeyRound, Mail, ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, next: false, confirm: false });

  const openOtpModal = async () => {
    return Swal.fire({
      title: 'Enter OTP',
      text: `A verification code was sent to ${user?.email}.`,
      html: `
        <div id="otp-modal-inputs" style="display:flex;gap:0.625rem;justify-content:center;margin-top:1rem;">
          <input class="otp-digit" inputmode="numeric" maxlength="1" style="width:46px;height:52px;text-align:center;font-size:1.3rem;font-weight:700;border:2px solid #e5e7eb;border-radius:10px;outline:none;color:#800000;" />
          <input class="otp-digit" inputmode="numeric" maxlength="1" style="width:46px;height:52px;text-align:center;font-size:1.3rem;font-weight:700;border:2px solid #e5e7eb;border-radius:10px;outline:none;color:#800000;" />
          <input class="otp-digit" inputmode="numeric" maxlength="1" style="width:46px;height:52px;text-align:center;font-size:1.3rem;font-weight:700;border:2px solid #e5e7eb;border-radius:10px;outline:none;color:#800000;" />
          <input class="otp-digit" inputmode="numeric" maxlength="1" style="width:46px;height:52px;text-align:center;font-size:1.3rem;font-weight:700;border:2px solid #e5e7eb;border-radius:10px;outline:none;color:#800000;" />
          <input class="otp-digit" inputmode="numeric" maxlength="1" style="width:46px;height:52px;text-align:center;font-size:1.3rem;font-weight:700;border:2px solid #e5e7eb;border-radius:10px;outline:none;color:#800000;" />
          <input class="otp-digit" inputmode="numeric" maxlength="1" style="width:46px;height:52px;text-align:center;font-size:1.3rem;font-weight:700;border:2px solid #e5e7eb;border-radius:10px;outline:none;color:#800000;" />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Verify & Change Password',
      cancelButtonText: 'Cancel',
      confirmButtonColor: 'var(--maroon)',
      focusConfirm: false,
      didOpen: () => {
        const popup = Swal.getPopup();
        if (!popup) return;

        const inputs = Array.from(popup.querySelectorAll('.otp-digit'));
        const setBorder = (el, active) => {
          el.style.borderColor = active || el.value ? '#800000' : '#e5e7eb';
        };

        inputs.forEach((input, idx) => {
          input.addEventListener('input', (e) => {
            const digitsOnly = String(e.target.value || '').replace(/\D/g, '');
            e.target.value = digitsOnly.slice(-1);
            setBorder(e.target, true);
            if (e.target.value && idx < inputs.length - 1) inputs[idx + 1].focus();
          });

          input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && idx > 0) {
              inputs[idx - 1].focus();
            }
          });

          input.addEventListener('focus', () => setBorder(input, true));
          input.addEventListener('blur', () => setBorder(input, false));
        });

        const container = popup.querySelector('#otp-modal-inputs');
        container?.addEventListener('paste', (e) => {
          const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
          if (pasted.length === 6) {
            pasted.split('').forEach((digit, idx) => {
              inputs[idx].value = digit;
              setBorder(inputs[idx], true);
            });
            inputs[5]?.focus();
            e.preventDefault();
          }
        });

        inputs[0]?.focus();
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const inputs = Array.from(popup?.querySelectorAll('.otp-digit') || []);
        const code = inputs.map((input) => input.value).join('');

        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
          Swal.showValidationMessage('Please enter the complete 6-digit OTP.');
          return false;
        }
        return code;
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      await Swal.fire({ title: 'Missing Fields', text: 'Complete current, new, and confirm password.', icon: 'warning', confirmButtonColor: 'var(--maroon)' });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      await Swal.fire({ title: 'Password Mismatch', text: 'New password and confirm password do not match.', icon: 'warning', confirmButtonColor: 'var(--maroon)' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/request-password-change-otp');

      const otpPrompt = await openOtpModal();

      if (!otpPrompt.isConfirmed) {
        return;
      }

      await api.post('/auth/confirm-password-change', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        otp: otpPrompt.value,
      });

      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await Swal.fire({
        title: 'Password Updated',
        text: 'Your password has been changed successfully.',
        icon: 'success',
        confirmButtonColor: 'var(--maroon)',
      });
    } catch (err) {
      await Swal.fire({
        title: 'Update Failed',
        text: err.response?.data?.message || 'Unable to update your password.',
        icon: 'error',
        confirmButtonColor: 'var(--maroon)',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Settings</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Enter your passwords first, then verify with OTP to complete password change.</p>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--maroon-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--maroon)' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Password Security</div>
              <div style={{ fontSize: '0.83rem', color: 'var(--gray-500)' }}>After clicking Change Password, an OTP will be sent to your email for confirmation.</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--gray-50)', borderRadius: 12, padding: '0.9rem 1rem', border: '1px solid var(--gray-100)', marginBottom: '1rem' }}>
            <Mail size={16} style={{ color: 'var(--maroon)' }} />
            <div>
              <div style={{ fontSize: '0.76rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Registered Email</div>
              <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{user?.email}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--gray-400)' }} />
                <input
                  type={showPassword.current ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                  value={form.currentPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
                  style={{ position: 'absolute', top: 9, right: 8, border: 'none', background: 'transparent', color: 'var(--gray-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                >
                  {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={16} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--gray-400)' }} />
                  <input
                    type={showPassword.next ? 'text' : 'password'}
                    className="form-control"
                    style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                    value={form.newPassword}
                    onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => ({ ...prev, next: !prev.next }))}
                    style={{ position: 'absolute', top: 9, right: 8, border: 'none', background: 'transparent', color: 'var(--gray-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                  >
                    {showPassword.next ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <small style={{ color: 'var(--gray-500)', fontSize: '0.74rem' }}>Use uppercase, lowercase, number, and special character.</small>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={16} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--gray-400)' }} />
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    className="form-control"
                    style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                    value={form.confirmPassword}
                    onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
                    style={{ position: 'absolute', top: 9, right: 8, border: 'none', background: 'transparent', color: 'var(--gray-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                  >
                    {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span> : <><ShieldCheck size={16} />Change Password</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
