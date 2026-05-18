import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Upload, ClipboardList,
  FileText, LogOut, Menu, Layers, Settings, Globe2, Award,
} from 'lucide-react';
import PathToTechLogo from '../components/PathToTechLogo';
import api from '../services/api';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/students', icon: Users, label: 'Manage Students' },
  { to: '/admin/upload-grades', icon: Upload, label: 'Upload Grades' },
  { to: '/admin/survey-builder', icon: ClipboardList, label: 'Survey Builder' },
  { to: '/admin/results', icon: FileText, label: 'Results Management' },
  { to: '/admin/certification-approvals', icon: Award, label: 'Cert. Approvals' },
  { to: '/admin/skill-options', icon: Layers, label: 'Skill Options' },
  { to: '/admin/landing-cms', icon: Globe2, label: 'Landing CMS' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCertCount, setPendingCertCount] = useState(0);
  const prevPendingRef = useRef(null);

  useEffect(() => {
    if (!user?._id) return;
    let mounted = true;

    const pollPending = async () => {
      try {
        const res = await api.get('/certifications/admin/pending');
        const count = res.data?.data?.length ?? 0;
        if (!mounted) return;
        if (prevPendingRef.current !== null && count > prevPendingRef.current) {
          // New submission arrived — notify and refresh approvals page
          window.dispatchEvent(new Event('ppt-cert-pending-refresh'));
        }
        prevPendingRef.current = count;
        setPendingCertCount(count);
      } catch (_) {}
    };

    pollPending();
    const timer = setInterval(pollPending, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, [user?._id]);

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Logout?',
      text: 'Are you sure you want to logout?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#800000',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, logout',
    });
    if (result.isConfirmed) {
      logout();
      navigate('/');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--gray-50)' }}>
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      <aside style={{
        width: 260, background: 'var(--maroon)', color: 'white',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease', overflowY: 'auto',
      }} className="sidebar-desktop">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <PathToTechLogo size={34} textColor="white" />
            <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.35rem', marginLeft: '0.2rem' }}>Admin Panel</div>
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
              {user?.fullName?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user?.fullName}</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>Administrator</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.75rem 0' }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 1.25rem', margin: '0.1rem 0.5rem', borderRadius: 7,
                fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.75)',
                textDecoration: 'none', transition: 'all 0.15s',
              })}
            >
              <Icon size={17} />
              <span style={{ flex: 1 }}>{label}</span>
              {to === '/admin/certification-approvals' && pendingCertCount > 0 && (
                <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                  {pendingCertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '0.75rem 0.5rem 1.25rem' }}>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.65rem 1.25rem', borderRadius: 7, background: 'transparent', color: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, marginLeft: 0, display: 'flex', flexDirection: 'column' }} className="main-content">
        <header style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30, boxShadow: 'var(--shadow-sm)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--maroon)', cursor: 'pointer', padding: 4 }}>
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--maroon)' }}>
            <PathToTechLogo size={28} showWordmark={false} />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>PathToTech Admin</span>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--maroon)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
            {user?.fullName?.[0]?.toUpperCase() || 'A'}
          </div>
        </header>
        <main style={{ flex: 1, padding: '1.5rem' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (min-width: 769px) {
          .sidebar-desktop { transform: translateX(0) !important; position: fixed !important; }
          .main-content { margin-left: 260px !important; }
        }
      `}</style>
    </div>
  );
}
