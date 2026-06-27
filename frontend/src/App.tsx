import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Student Pages
import StudentChatbot from './pages/student/Chatbot';
import StudentComplaints from './pages/student/ComplaintsList';
import ComplaintDetails from './pages/student/ComplaintDetails';

// Officer Pages
import OfficerDashboard from './pages/officer/OfficerDashboard';
import OfficerComplaintDetails from './pages/officer/OfficerComplaintDetails';
import OfficerAppeals from './pages/officer/OfficerAppeals';

// Manager Pages
import ManagerOverview from './pages/manager/ManagerOverview';
import ManagerHeatmap from './pages/manager/ManagerHeatmap';
import ManagerRecommendations from './pages/manager/ManagerRecommendations';
import ManagerReports from './pages/manager/ManagerReports';
import ManagerTopIssues from './pages/manager/ManagerTopIssues';

// Admin Pages
import AdminCategories from './pages/admin/AdminCategories';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPriorityRules from './pages/admin/AdminPriorityRules';

// Shared / Dashboard
import DashboardPage from './pages/DashboardPage';

// Simple placeholders for missing pages
const AdminRegulations = () => <div className="p-8"><h1>Admin Regulations</h1><p className="text-muted-foreground">Coming soon...</p></div>;
const AdminAuditLogs = () => <div className="p-8"><h1>Admin Audit Logs</h1><p className="text-muted-foreground">Coming soon...</p></div>;
const AdminInsights = () => <div className="p-8"><h1>Admin Insights</h1><p className="text-muted-foreground">Coming soon...</p></div>;

import { useThemeStore } from './store/themeStore';
import AnalyticsPage from './pages/manager/Analytics';

function App() {
  const { isDarkMode } = useThemeStore();

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          
          {/* Student Routes */}
          <Route path="/student/chat" element={<StudentChatbot />} />
          <Route path="/student/complaints" element={<StudentComplaints />} />
          <Route path="/student/complaints/:id" element={<ComplaintDetails />} />
          
          {/* Officer Routes */}
          <Route path="/officer/dashboards" element={<OfficerDashboard />} />
          <Route path="/officer/complaints/:id" element={<OfficerComplaintDetails />} />
          <Route path="/officer/appeals" element={<OfficerAppeals />} />
          
          {/* Manager Routes */}
          <Route path="/manager/overview" element={<ManagerOverview />} />
          <Route path="/manager/heatmap" element={<ManagerHeatmap />} />
          <Route path="/manager/recommendations" element={<ManagerRecommendations />} />
          <Route path="/manager/reports" element={<ManagerReports />} />
          <Route path="/manager/top-issues" element={<ManagerTopIssues />} />
          <Route path="/manager/analytics" element={<AnalyticsPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/regulations" element={<AdminRegulations />} />
          <Route path="/admin/priority-rules" element={<AdminPriorityRules />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
          <Route path="/admin/insights" element={<AdminInsights />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
