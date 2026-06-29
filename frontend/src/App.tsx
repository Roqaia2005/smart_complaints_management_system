import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
// import AuthPages from "@/pages/auth/AuthPages";

// Student Pages
import StudentChatbot from "./pages/student/Chatbot";
import StudentComplaints from "./pages/student/ComplaintsList";
import ComplaintDetails from "./pages/student/ComplaintDetails";

// Officer Pages
import OfficerDashboard from "./pages/officer/OfficerDashboard";
import OfficerComplaintDetails from "./pages/officer/OfficerComplaintDetails";
import OfficerAppeals from "./pages/officer/OfficerAppeals";

// Manager Pages
import ManagerOverview from "./pages/manager/ManagerOverview";
import ManagerHeatmap from "./pages/manager/ManagerHeatmap";
import ManagerRecommendations from "./pages/manager/ManagerRecommendations";
import ManagerReports from "./pages/manager/ManagerReports";

// Admin Pages
import AdminCategories from "./pages/admin/AdminCategories";

// Shared / Dashboard
import DashboardPage from "./pages/DashboardPage";

import { useThemeStore } from "./store/themeStore";
import AnalyticsPage from "./pages/manager/Analytics";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import InsightsPage from "./pages/admin/InsightsPage";
import PriorityRulesPage from "./pages/admin/PriorityRulesPage";
import RegulationsPage from "./pages/admin/RegulationsPage";
import UsersPage from "./pages/admin/UsersPage";
import UsersImportPage from "./pages/admin/UsersImportPage";
import TopIssuesPage from "./pages/manager/ManagerTopIssues";
import RequestsPage from "./pages/super admin/RequestsPage";
import RequestDetailPage from "./pages/super admin/RequestDetailPage";
import AdminsPage from "./pages/super admin/AdminsPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";

function App() {
  const { isDarkMode } = useThemeStore();

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <Router>
      <Routes>
        {/* <Route path="/login" element={<AuthPages />} /> */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />


        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />

          {/* Student Routes */}
          <Route path="/student/chat" element={<StudentChatbot />} />
          <Route path="/student/complaints" element={<StudentComplaints />} />
          <Route
            path="/student/complaints/:id"
            element={<ComplaintDetails />}
          />

          {/* Officer Routes */}
          <Route path="/officer/dashboards" element={<OfficerDashboard />} />
          <Route
            path="/officer/complaints/:id"
            element={<OfficerComplaintDetails />}
          />
          <Route path="/officer/appeals" element={<OfficerAppeals />} />

          {/* Manager Routes */}
          <Route path="/manager/overview" element={<ManagerOverview />} />
          <Route path="/manager/heatmap" element={<ManagerHeatmap />} />
          <Route
            path="/manager/recommendations"
            element={<ManagerRecommendations />}
          />
          <Route path="/manager/reports" element={<ManagerReports />} />
          <Route path="/manager/top-issues" element={<TopIssuesPage />} />
          <Route path="/manager/analytics" element={<AnalyticsPage />} />

          {/* Admin Routes */}
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/users/import" element={<UsersImportPage />} />
          <Route path="/admin/regulations" element={<RegulationsPage />} />
          <Route path="/admin/priority-rules" element={<PriorityRulesPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
          <Route path="/admin/insights" element={<InsightsPage />} />

          {/*Super Admin Routes */}
          <Route path="/superadmin/requests" element={<RequestsPage />} />
          <Route
            path="/superadmin/requests/:id"
            element={<RequestDetailPage />}
          />
          <Route path="/superadmin/admins" element={<AdminsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
