import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import UploadReport from './pages/UploadReport';
import Reports from './pages/Reports';
import Trends from './pages/Trends';
import HealthInsights from './pages/HealthInsights';
import AIChat from './pages/AIChat';
import Settings from './pages/Settings';
import HealthTips from './pages/HealthTips';
import HealthTipDetail from './pages/HealthTipDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminHealthTips from './pages/AdminHealthTips';
import AdminSettings from './pages/AdminSettings';
import AdminReports from './pages/AdminReports';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* User Routes */}
        <Route path="/dashboard" element={<ProtectedRoute requiredRole="user"><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute requiredRole="user"><UploadReport /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute requiredRole="user"><Reports /></ProtectedRoute>} />
        <Route path="/trends" element={<ProtectedRoute requiredRole="user"><Trends /></ProtectedRoute>} />
        <Route path="/health-insights" element={<ProtectedRoute requiredRole="user"><HealthInsights /></ProtectedRoute>} />
        <Route path="/risk" element={<ProtectedRoute requiredRole="user"><HealthInsights /></ProtectedRoute>} />
        <Route path="/diagnosis" element={<ProtectedRoute requiredRole="user"><HealthInsights /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute requiredRole="user"><AIChat /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requiredRole="user"><Settings /></ProtectedRoute>} />
        <Route path="/health-tips" element={<ProtectedRoute><HealthTips /></ProtectedRoute>} />
        <Route path="/health-tips/:id" element={<ProtectedRoute><HealthTipDetail /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>} />
        <Route path="/admin/health-tips" element={<ProtectedRoute requiredRole="admin"><AdminHealthTips /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><AdminReports /></ProtectedRoute>} />

      </Routes>
    </Router>
  );
}

export default App;
