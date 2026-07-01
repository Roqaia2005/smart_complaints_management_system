import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getRoleHomeRoute } from './auth/auth.shared';

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomeRoute(user.role)} replace />;
}
