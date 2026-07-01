import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getRoleHomeRoute } from '@/pages/auth/auth.shared';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const handleGoHome = () => {
    navigate(isAuthenticated ? getRoleHomeRoute(user?.role) : '/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="text-3xl font-semibold">404</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Page Not Found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or may have been moved.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={handleGoHome}>
            {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
