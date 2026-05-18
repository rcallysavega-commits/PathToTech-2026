import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { useLocation } from 'react-router-dom';

// Public Pages
import LandingPage from './pages/LandingPage';
import StudentLoginPage from './pages/StudentLoginPage';
import OTPVerificationPage from './pages/OTPVerificationPage';

// Layouts
import StudentLayout from './layouts/StudentLayout';
import AdminLayout from './layouts/AdminLayout';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import ProfilePage from './pages/student/ProfilePage';
import SettingsPage from './pages/student/SettingsPage';
import TakeSurveyPage from './pages/student/TakeSurveyPage';
import TechnicalSkillsPage from './pages/student/TechnicalSkillsPage';
import SoftSkillsPage from './pages/student/SoftSkillsPage';
import CertificationsPage from './pages/student/CertificationsPage';
import MyGradesPage from './pages/student/MyGradesPage';
import ResultPage from './pages/student/ResultPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import CertificationApprovalsPage from './pages/admin/CertificationApprovalsPage';
import ManageStudentsPage from './pages/admin/ManageStudentsPage';
import UploadGradesPage from './pages/admin/UploadGradesPage';
import SurveyBuilderPage from './pages/admin/SurveyBuilderPage';
import ResultsManagementPage from './pages/admin/ResultsManagementPage';
import ModelTransparencyPage from './pages/admin/ModelTransparencyPage';
import SkillOptionsPage from './pages/admin/SkillOptionsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import LandingCmsPage from './pages/admin/LandingCmsPage';

// Protected Route
const ProtectedStudentRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student') return <Navigate to="/admin" replace />;
  if (!user.firstLoginCompleted) return <Navigate to="/otp-verify" replace />;
  return children;
};

const ProtectedAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

const OTPRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const resetEmail = sessionStorage.getItem('ptt_reset_password_email');
  const resetFlowRequested = location.state?.flow === 'reset-password' || Boolean(resetEmail);
  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;
  if (!user && !resetFlowRequested) return <Navigate to="/login" replace />;
  if (user && user.firstLoginCompleted && !resetFlowRequested) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<StudentLoginPage />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/otp-verify" element={<OTPRoute><OTPVerificationPage /></OTPRoute>} />

      {/* Student Routes */}
      <Route path="/dashboard" element={<ProtectedStudentRoute><StudentLayout /></ProtectedStudentRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="survey" element={<TakeSurveyPage />} />
        <Route path="technical-skills" element={<TechnicalSkillsPage />} />
        <Route path="soft-skills" element={<SoftSkillsPage />} />
        <Route path="certifications" element={<CertificationsPage />} />
        <Route path="grades" element={<MyGradesPage />} />
        <Route path="result" element={<ResultPage />} />
        <Route path="recommendations" element={<Navigate to="/dashboard/result" replace />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<ManageStudentsPage />} />
        <Route path="upload-grades" element={<UploadGradesPage />} />
        <Route path="survey-builder" element={<SurveyBuilderPage />} />
        <Route path="analytics" element={<Navigate to="/admin" replace />} />
        <Route path="results" element={<ResultsManagementPage />} />
        <Route path="skill-options" element={<SkillOptionsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="landing-cms" element={<LandingCmsPage />} />
        <Route path="model-transparency" element={<ModelTransparencyPage />} />
        <Route path="certification-approvals" element={<CertificationApprovalsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
