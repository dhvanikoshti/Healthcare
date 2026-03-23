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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<UploadReport />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/health-insights" element={<HealthInsights />} />
        <Route path="/risk" element={<HealthInsights />} />
        <Route path="/diagnosis" element={<HealthInsights />} />
        <Route path="/chat" element={<AIChat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/health-tips" element={<HealthTips />} />
        <Route path="/health-tips/:id" element={<HealthTipDetail />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/health-tips" element={<AdminHealthTips />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Routes>
    </Router>
  );
}

export default App;
