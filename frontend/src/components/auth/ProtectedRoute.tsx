import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getRoleHomeRoute, normalizeRole } from '@/pages/auth/auth.shared';

export type ProtectedRouteRole =
  | 'student'
  | 'officer'
  | 'manager'
  | 'admin'
  | 'super_admin'
  | 'SuperAdmin'
  | 'Admin'
  | 'Manager'
  | 'Officer'
  | 'Student';

interface ProtectedRouteProps {
  allowedRoles?: ProtectedRouteRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedRole = normalizeRole(user?.role);
    const isAuthorized = normalizedRole
      ? allowedRoles.some((role) => normalizeRole(role) === normalizedRole)
      : false;

    if (!isAuthorized) {
      const redirectTo = getRoleHomeRoute(user?.role);
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }
  }

  return <Outlet />;
}
