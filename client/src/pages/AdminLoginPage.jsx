import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PathToTechLogo from '../components/PathToTechLogo';
import api from '../services/api';

export default function AdminLoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') navigate('/admin');
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      await Swal.fire({ title: 'Missing Fields', text: 'Please enter your email and password.', icon: 'warning', confirmButtonColor: '#800000' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/admin-login', form);
      login(res.data.token, res.data.user);
      await Swal.fire({
        title: 'Login Successful!',
        text: `Welcome back, ${res.data.user.fullName}!`,
        icon: 'success',
        confirmButtonColor: '#800000',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
      navigate('/admin');
    } catch (err) {
      await Swal.fire({
        title: 'Login Failed',
        text: err.response?.data?.message || 'Invalid credentials.',
        icon: 'error',
        confirmButtonColor: '#800000',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '0 1.5rem', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--maroon)', fontWeight: 700 }}>
          <PathToTechLogo size={32} textColor="var(--maroon-dark)" />
        </Link>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gray-500)', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} />Back to Home
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '3rem 2.5rem', width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <div style={{ background: 'linear-gradient(180deg, #fff8f3 0%, #f7eadf 100%)', borderRadius: 24, padding: '0.9rem 1rem', border: '1px solid var(--gray-100)' }}>
                <PathToTechLogo size={50} showWordmark={false} />
              </div>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--maroon)', marginBottom: '0.3rem' }}>Admin Login</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>PathToTech Faculty / Administrator</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="admin@pathtotech.edu.ph"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', padding: 0 }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', height: 44, fontSize: '0.95rem' }} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span> : 'Login as Admin'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--gray-100)', textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              Are you a student?{' '}
              <Link to="/login" style={{ color: 'var(--maroon)', fontWeight: 600 }}>Student Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
