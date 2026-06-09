import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ArrowLeft, ShieldCheck, Mail, Lock, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PathToTechLogo from '../components/PathToTechLogo';
import FAQWidget from '../components/FAQWidget';
import api from '../services/api';

const COURSES = ['Computer Science', 'Information Technology', 'Information Systems'];

export default function StudentLoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    studentNumber: '',
    gender: '',
    course: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isRegisterMode = mode === 'register';
  const isForgotMode = mode === 'forgot';

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (!user.firstLoginCompleted) navigate('/otp-verify');
    else navigate('/dashboard');
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = form.email.trim().toLowerCase();
    const password = String(form.password || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const firstName = form.firstName.trim();
    const middleName = form.middleName.trim();
    const lastName = form.lastName.trim();
    const studentNumber = form.studentNumber.trim();
    const gender = form.gender.trim();
    const course = form.course.trim();
    if (!email.endsWith('@cvsu.edu.ph')) {
      await Swal.fire({
        title: 'Access Denied',
        text: 'Only CvSU email accounts (@cvsu.edu.ph) are allowed.',
        icon: 'error',
        confirmButtonColor: '#800000',
      });
      return;
    }

    if (!isForgotMode && (!password || password.length < 8)) {
      await Swal.fire({
        title: 'Invalid Password',
        text: 'Password must be at least 8 characters long.',
        icon: 'warning',
        confirmButtonColor: '#800000',
      });
      return;
    }

    if (isRegisterMode) {
      if (!firstName || !lastName) {
        await Swal.fire({
          title: 'Required Field',
          text: 'First name and last name are required.',
          icon: 'warning',
          confirmButtonColor: '#800000',
        });
        return;
      }

      if (!studentNumber) {
        await Swal.fire({
          title: 'Required Field',
          text: 'Student number is required.',
          icon: 'warning',
          confirmButtonColor: '#800000',
        });
        return;
      }

      if (!gender) {
        await Swal.fire({
          title: 'Required Field',
          text: 'Please select your gender.',
          icon: 'warning',
          confirmButtonColor: '#800000',
        });
        return;
      }

      if (!course) {
        await Swal.fire({
          title: 'Required Field',
          text: 'Please select your course.',
          icon: 'warning',
          confirmButtonColor: '#800000',
        });
        return;
      }

      const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
      if (!strongPassword.test(password)) {
        await Swal.fire({
          title: 'Weak Password',
          text: 'Use at least 8 characters with uppercase, lowercase, number, and special character.',
          icon: 'warning',
          confirmButtonColor: '#800000',
        });
        return;
      }

      if (password !== String(form.confirmPassword || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()) {
        await Swal.fire({
          title: 'Password Mismatch',
          text: 'Confirm password does not match.',
          icon: 'warning',
          confirmButtonColor: '#800000',
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (isForgotMode) {
        const res = await api.post('/auth/request-password-reset-otp', { email });
        sessionStorage.setItem('ptt_reset_password_email', res.data.email || email);
        sessionStorage.setItem('ptt_reset_password_flow', '1');
        await Swal.fire({
          title: 'OTP Sent!',
          text: `A 6-digit password reset code has been sent to ${email}. Please check your inbox.`,
          icon: 'success',
          confirmButtonColor: '#800000',
          confirmButtonText: 'Set New Password',
        });
        navigate('/otp-verify', { state: { flow: 'reset-password', email } });
        return;
      }

      const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
      const payload = isRegisterMode
        ? { firstName, middleName, lastName, studentNumber, gender, major: course, email, password }
        : { email, password };

      const res = await api.post(endpoint, payload);
      const { token, user: userData, requiresOTP } = res.data;

      login(token, userData);

      if (requiresOTP) {
        await Swal.fire({
          title: 'OTP Sent!',
          text: `A 6-digit verification code has been sent to ${email}. Please check your inbox.`,
          icon: 'success',
          confirmButtonColor: '#800000',
          confirmButtonText: 'Enter OTP',
        });
        navigate('/otp-verify');
      } else if (userData.role === 'admin') {
        await Swal.fire({
          title: 'Welcome Back!',
          text: `Hello, ${userData.fullName}!`,
          icon: 'success',
          confirmButtonColor: '#800000',
          timer: 1800,
          timerProgressBar: true,
          showConfirmButton: false,
        });
        navigate('/admin');
      } else {
        await Swal.fire({
          title: 'Welcome Back!',
          text: `Hello, ${userData.fullName}! You are now logged in.`,
          icon: 'success',
          confirmButtonColor: '#800000',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false,
        });
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      const isInvalidDomain = err.response?.data?.code === 'INVALID_DOMAIN';

      await Swal.fire({
        title: isInvalidDomain ? 'Access Denied' : (isForgotMode ? 'Reset Failed' : (isRegisterMode ? 'Registration Failed' : 'Login Failed')),
        text: msg,
        icon: 'error',
        confirmButtonColor: '#800000',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <nav style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '0 1.5rem', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--maroon)', fontWeight: 700 }}>
          <PathToTechLogo size={32} textColor="var(--maroon-dark)" />
        </Link>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gray-500)', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </nav>

      {/* Login Card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '3rem 2.5rem', width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <div style={{ background: 'linear-gradient(180deg, #fff8f3 0%, #f7eadf 100%)', borderRadius: 24, padding: '0.9rem 1rem', border: '1px solid var(--gray-100)' }}>
              <PathToTechLogo size={52} showWordmark={false} />
            </div>
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--maroon)', marginBottom: '0.4rem' }}>
            {isRegisterMode ? 'Account Registration' : isForgotMode ? 'Forgot Password' : 'PathToTech Login'}
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            {isForgotMode
              ? 'Enter your registered CvSU email and we will send a reset OTP to your inbox.'
              : `Use your CvSU email to ${isRegisterMode ? 'create an account' : 'sign in'} to PathToTech.`}
          </p>

          <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 10, padding: 4, marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setMode('login')}
              style={{
                flex: 1,
                border: 'none',
                background: mode === 'login' ? 'white' : 'transparent',
                color: mode === 'login' ? 'var(--maroon)' : 'var(--gray-500)',
                borderRadius: 8,
                padding: '0.55rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              style={{
                flex: 1,
                border: 'none',
                background: mode === 'register' ? 'white' : 'transparent',
                color: mode === 'register' ? 'var(--maroon)' : 'var(--gray-500)',
                borderRadius: 8,
                padding: '0.55rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Register
            </button>
          </div>

          {/* Domain notice */}
          <div style={{ background: 'var(--maroon-pale)', border: '1px solid #ffd7d7', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', textAlign: 'left' }}>
            <ShieldCheck size={16} style={{ color: 'var(--maroon)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--maroon)' }}>CvSU Gmail Only</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.1rem' }}>
                Only <strong>@cvsu.edu.ph</strong> accounts are authorized.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
            {isRegisterMode && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <div style={{ position: 'relative' }}>
                      <UserPlus size={16} style={{ position: 'absolute', top: 12, left: 10, color: 'var(--gray-400)' }} />
                      <input
                        className="form-control"
                        style={{ paddingLeft: '2rem' }}
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        placeholder="Juan"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Middle Name</label>
                    <input
                      className="form-control"
                      type="text"
                      value={form.middleName}
                      onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))}
                      placeholder="Santos (optional)"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    className="form-control"
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Dela Cruz"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Student Number</label>
                  <input
                    className="form-control"
                    type="text"
                    value={form.studentNumber}
                    onChange={(e) => setForm((f) => ({ ...f, studentNumber: e.target.value }))}
                    placeholder="e.g. 2026-000001"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-control"
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Course</label>
                  <select
                    className="form-control"
                    value={form.course}
                    onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
                  >
                    <option value="">Select course</option>
                    {COURSES.map((course) => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">CvSU Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', top: 12, left: 10, color: 'var(--gray-400)' }} />
                <input
                  className="form-control"
                  style={{ paddingLeft: '2rem' }}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="yourname@cvsu.edu.ph"
                />
              </div>
            </div>

            {!isForgotMode && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', top: 12, left: 10, color: 'var(--gray-400)' }} />
                  <input
                    className="form-control"
                    style={{ paddingLeft: '2rem', paddingRight: '2.3rem' }}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={isRegisterMode ? 'At least 8 characters' : 'Enter your password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--gray-500)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {isRegisterMode && (
                  <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>
                    Must include uppercase, lowercase, number, and special character.
                  </small>
                )}
                {!isRegisterMode && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    style={{
                      marginTop: '0.65rem',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--maroon)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
            )}

            {isRegisterMode && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', top: 12, left: 10, color: 'var(--gray-400)' }} />
                  <input
                    className="form-control"
                    style={{ paddingLeft: '2rem', paddingRight: '2.3rem' }}
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--gray-500)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', gap: '0.45rem' }} disabled={loading}>
              {loading ? (
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span>
              ) : isRegisterMode ? (
                <>
                  <UserPlus size={16} />Create Account & Send OTP
                </>
              ) : isForgotMode ? (
                <>
                  <Mail size={16} />Send Reset OTP
                </>
              ) : (
                <>
                  <LogIn size={16} />Login & Continue
                </>
              )}
            </button>
          </form>

          <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', lineHeight: 1.5 }}>
            Only <strong>@cvsu.edu.ph</strong> emails are accepted.<br />
            {isForgotMode ? 'Forgot password sends a reset OTP to your registered email.' : 'First login/registration sends OTP verification to student email.'}
          </p>

          {isForgotMode && (
            <button
              type="button"
              onClick={() => setMode('login')}
              style={{ marginTop: '0.75rem', border: 'none', background: 'transparent', color: 'var(--maroon)', fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Login
            </button>
          )}

        </div>
      </div>      <FAQWidget />    </div>
  );
}
