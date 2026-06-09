import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, ClipboardList, Code2, Heart,
  Award, BookOpen, BarChart3, LogOut, Menu, Settings,
} from 'lucide-react';
import PathToTechLogo from '../components/PathToTechLogo';
import FAQWidget from '../components/FAQWidget';
import api from '../services/api';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/profile', icon: User, label: 'My Profile' },
  { to: '/dashboard/survey', icon: ClipboardList, label: 'Employability Survey' },
  { to: '/dashboard/technical-skills', icon: Code2, label: 'Technical Skills' },
  { to: '/dashboard/soft-skills', icon: Heart, label: 'Soft Skills' },
  { to: '/dashboard/certifications', icon: Award, label: 'Certifications' },
  { to: '/dashboard/grades', icon: BookOpen, label: 'My Grades' },
  { to: '/dashboard/result', icon: BarChart3, label: 'My Result' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const syncSignatureRef = useRef('');
  const certStatusesRef = useRef(null); // map of certId -> status

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

  useEffect(() => {
    if (!user?._id || !user?.studentNumber) return undefined;

    let mounted = true;

    const runSync = async () => {
      try {
        const [gradeRes, resultRes] = await Promise.all([
          api.get(`/grades/check-complete/${encodeURIComponent(user.studentNumber)}`),
          api.get('/predictions/my/result'),
        ]);

        const gradesComplete = Boolean(gradeRes.data?.isComplete);
        const activeUpload = Boolean(gradeRes.data?.activeUpload);
        const result = resultRes.data?.result || null;
        const resultToken = result?._id || result?.updatedAt || result?.createdAt || 'none';
        const nextSignature = `${activeUpload}|${gradesComplete}|${resultToken}`;

        if (!mounted) return;
        if (syncSignatureRef.current && syncSignatureRef.current !== nextSignature) {
          window.dispatchEvent(new Event('ppt-grades-refresh'));
          window.dispatchEvent(new Event('ppt-prediction-refresh'));
          window.dispatchEvent(new Event('ppt-student-sync'));
        }
        syncSignatureRef.current = nextSignature;
      } catch (_) {
        // Keep UI stable when background sync fails temporarily.
      }
    };

    runSync();
    const timer = setInterval(runSync, 3000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user?._id, user?.studentNumber]);

  // Poll cert statuses — notify student when admin approves/rejects
  useEffect(() => {
    if (!user?._id) return;
    let mounted = true;

    const pollCerts = async () => {
      try {
        const res = await api.get(`/certifications/${user._id}`);
        const certs = res.data?.data?.certifications || [];
        if (!mounted) return;

        // Build current status map
        const current = {};
        certs.forEach(c => { if (c._id) current[String(c._id)] = { status: c.status, name: c.name }; });

        const prev = certStatusesRef.current;
        if (prev !== null) {
          // Check for status changes
          const changed = [];
          Object.keys(current).forEach(id => {
            const prevStatus = prev[id]?.status;
            const newStatus = current[id]?.status;
            if (prevStatus === 'pending_review' && newStatus === 'approved') {
              changed.push({ name: current[id].name, status: 'approved' });
            } else if (prevStatus === 'pending_review' && newStatus === 'rejected') {
              changed.push({ name: current[id].name, status: 'rejected' });
            }
          });

          if (changed.length > 0) {
            window.dispatchEvent(new Event('ppt-cert-status-refresh'));
            changed.forEach(({ name, status }) => {
              Swal.fire({
                toast: true,
                position: 'top-end',
                icon: status === 'approved' ? 'success' : 'warning',
                title: status === 'approved'
                  ? `Certification approved`
                  : `Certification rejected`,
                html: `<span style="font-size:0.85rem"><strong>${name}</strong> has been ${status === 'approved' ? '✅ approved by admin.' : '❌ rejected. Please check the reason and re-upload.'}</span>`,
                showConfirmButton: false,
                timer: status === 'approved' ? 5000 : 8000,
                timerProgressBar: true,
              });
            });
          }
        }

        certStatusesRef.current = current;
      } catch (_) {}
    };

    pollCerts();
    const timer = setInterval(pollCerts, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, [user?._id]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: 'var(--maroon)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, bottom: 0, left: 0,
        zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        overflowY: 'auto',
      }}
        className="sidebar-desktop"
      >
        {/* Brand */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <PathToTechLogo size={34} textColor="white" />
            <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.35rem', marginLeft: '0.2rem' }}>Employability System</div>
          </div>
        </div>

        {/* User info */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {user?.profilePicture ? (
              <img src={user.profilePicture} alt="avatar" style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                {user?.fullName?.[0]?.toUpperCase() || 'S'}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName}</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>Student</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.75rem 0' }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 1.25rem',
                margin: '0.1rem 0.5rem',
                borderRadius: 7,
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                transition: 'all 0.15s',
              })}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '0.75rem 0.5rem 1.25rem' }}>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.65rem 1.25rem', borderRadius: 7, background: 'transparent', color: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: 0, display: 'flex', flexDirection: 'column' }} className="main-content">
        {/* Top header */}
        <header style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30, boxShadow: 'var(--shadow-sm)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', color: 'var(--maroon)', cursor: 'pointer', padding: 4 }}
          >
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--maroon)' }}>
            <PathToTechLogo size={28} textColor="var(--maroon)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {user?.profilePicture ? (
              <img src={user.profilePicture} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--maroon)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                {user?.fullName?.[0]?.toUpperCase() || 'S'}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
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

      <FAQWidget />
    </div>
  );
}
