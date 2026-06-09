import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Mail, RefreshCw, ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PathToTechLogo from '../components/PathToTechLogo';
import FAQWidget from '../components/FAQWidget';
import api from '../services/api';

export default function OTPVerificationPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inputRefs = useRef([]);

  const resetEmail = user?.email || sessionStorage.getItem('ptt_reset_password_email') || location.state?.email || '';
  const resetFlow = Boolean(location.state?.flow === 'reset-password' || sessionStorage.getItem('ptt_reset_password_flow'));
  const isResetMode = resetFlow && Boolean(resetEmail);

  const handleChange = (val, idx) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const clearResetStorage = () => {
    sessionStorage.removeItem('ptt_reset_password_email');
    sessionStorage.removeItem('ptt_reset_password_flow');
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      await Swal.fire({ title: 'Invalid OTP', text: 'Please enter the complete 6-digit OTP.', icon: 'warning', confirmButtonColor: '#800000' });
      return;
    }

    if (isResetMode) {
      const normalizedPassword = String(newPassword || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      const normalizedConfirm = String(confirmPassword || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (!normalizedPassword || normalizedPassword.length < 8) {
        await Swal.fire({ title: 'Invalid Password', text: 'Password must be at least 8 characters long.', icon: 'warning', confirmButtonColor: '#800000' });
        return;
      }
      const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
      if (!strongPassword.test(normalizedPassword)) {
        await Swal.fire({ title: 'Weak Password', text: 'Use at least 8 characters with uppercase, lowercase, number, and special character.', icon: 'warning', confirmButtonColor: '#800000' });
        return;
      }
      if (normalizedPassword !== normalizedConfirm) {
        await Swal.fire({ title: 'Password Mismatch', text: 'Confirm password does not match.', icon: 'warning', confirmButtonColor: '#800000' });
        return;
      }
    }

    setLoading(true);
    try {
      if (isResetMode) {
        await api.post('/auth/reset-password-with-otp', {
          email: resetEmail,
          otp: code,
          newPassword: newPassword.trim(),
        });
        clearResetStorage();
        await Swal.fire({
          title: 'Password Reset Successful!',
          text: 'You may now log in using your new password.',
          icon: 'success',
          confirmButtonColor: '#800000',
          timer: 2600,
          timerProgressBar: true,
          showConfirmButton: false,
        });
        navigate('/login');
        return;
      }

      const res = await api.post('/auth/verify-otp', { otp: code });
      login(res.data.token, res.data.user);
      await Swal.fire({
        title: 'Email Verified!',
        text: 'Your CvSU email has been verified. Welcome to PathToTech!',
        icon: 'success',
        confirmButtonColor: '#800000',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false,
      });
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid OTP.';
      const isExpired = err.response?.data?.code === 'OTP_EXPIRED';
      await Swal.fire({
        title: isExpired ? 'OTP Expired' : 'Invalid OTP',
        text: msg,
        icon: 'error',
        confirmButtonColor: '#800000',
      });
      if (isExpired) setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      if (isResetMode) {
        await api.post('/auth/request-password-reset-otp', { email: resetEmail });
      } else {
        await api.post('/auth/resend-otp');
      }
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      await Swal.fire({
        title: 'OTP Resent!',
        text: isResetMode ? 'A new password reset OTP has been sent to your email.' : 'A new OTP has been sent to your CvSU email.',
        icon: 'success',
        confirmButtonColor: '#800000',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Failed to Resend',
        text: err.response?.data?.message || 'Failed to resend OTP.',
        icon: 'error',
        confirmButtonColor: '#800000',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '3rem 2.5rem', width: '100%', maxWidth: 460, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, background: 'var(--maroon)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <ShieldCheck size={34} color="white" />
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--maroon)', marginBottom: '0.5rem' }}>
          {isResetMode ? 'Reset Password' : 'Email Verification'}
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
          {isResetMode ? 'Enter the OTP sent to your registered email, then set your new password.' : 'We sent a 6-digit OTP to'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '2rem' }}>
          <Mail size={16} style={{ color: 'var(--maroon)' }} />
          <span style={{ fontWeight: 600, color: 'var(--maroon)', fontSize: '0.9rem' }}>{resetEmail || user?.email}</span>
        </div>

        {/* OTP Input */}
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', marginBottom: '2rem' }} onPaste={handlePaste}>
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={el => inputRefs.current[idx] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(e.target.value, idx)}
              onKeyDown={e => handleKeyDown(e, idx)}
              style={{
                width: 52, height: 58, textAlign: 'center', fontSize: '1.5rem',
                fontWeight: 700, border: `2px solid ${digit ? 'var(--maroon)' : 'var(--gray-200)'}`,
                borderRadius: 'var(--radius)', outline: 'none', color: 'var(--maroon)',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--maroon)'}
              onBlur={e => { if (!digit) e.target.style.borderColor = 'var(--gray-200)'; }}
            />
          ))}
        </div>

        <button onClick={handleVerify} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 46, fontSize: '0.95rem', marginBottom: '1rem' }} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span> : isResetMode ? 'Verify OTP & Reset Password' : 'Verify OTP'}
        </button>

        {isResetMode && (
          <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', top: 12, left: 10, color: 'var(--gray-400)' }} />
                <input
                  className="form-control"
                  style={{ paddingLeft: '2rem', paddingRight: '2.3rem' }}
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'transparent', color: 'var(--gray-500)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label">Confirm New Password</label>
              <input
                className="form-control"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--gray-500)', fontSize: '0.875rem' }}>
          <span>Didn't receive the code?</span>
          <button onClick={handleResend} disabled={resending}
            style={{ background: 'none', border: 'none', color: 'var(--maroon)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.875rem' }}>
            {resending ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
            Resend OTP
          </button>
        </div>

        <p style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--gray-400)' }}>
          OTP expires in 5 minutes. Check your spam folder if not received.
        </p>

        {isResetMode && (
          <button
            type="button"
            onClick={() => { clearResetStorage(); navigate('/login'); }}
            style={{ marginTop: '0.75rem', border: 'none', background: 'transparent', color: 'var(--maroon)', fontWeight: 700, cursor: 'pointer' }}
          >
            Back to Login
          </button>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <PathToTechLogo size={32} textColor="var(--maroon-dark)" />
        </div>
      </div>
      <FAQWidget />
    </div>
  );
}
