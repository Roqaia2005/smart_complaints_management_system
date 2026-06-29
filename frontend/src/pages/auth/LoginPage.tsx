import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  AuthCard, ErrorAlert, PasswordInput, PrimaryButton, ROLE_HOME,
} from './auth.shared';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState('other');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');

  const ROLES = [
    
    { key: 'admin',   label: 'Admin'   },
    { key: 'other', label: 'Other Roles' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email || !password) return;
    try {
      await login(email, password);
      const role = useAuthStore.getState().user?.role ?? 'student';
      navigate(ROLE_HOME[role] ?? '/', { replace: true });
    } catch {
      // error is already set in the store
    }
  };

  return (
    <AuthCard>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Welcome back</p>
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Access your dashboard and manage complaints.
        </p>
      </div>

      {/* Role pills */}
      <div className="flex flex-col gap-2">
        <label className="text-[0.8rem] font-medium">Signing in as</label>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => { setSelectedRole(r.key); clearError(); }}
              className={[
                'flex-1 py-2 px-1 rounded-lg border text-[0.75rem] font-medium transition-all duration-150',
                selectedRole === r.key
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              ].join(' ')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <ErrorAlert message={error} />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[0.8rem] font-medium">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu.eg"
            autoComplete="email"
            className="w-full p-2 rounded-lg"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-[0.8rem] font-medium">Password</label>
            <Link
              to="/forgot-password"
              className="text-[0.78rem] text-primary underline underline-offset-2 hover:opacity-70"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <PrimaryButton loading={isLoading} disabled={!email || !password} className="mt-1">
          {isLoading ? 'Signing in…' : 'Sign in'}
        </PrimaryButton>
      </form>

      {/* Admin register link — only shown when admin pill is selected */}
      {selectedRole === 'admin' && (
        <p className="text-center text-[0.8rem] text-muted-foreground">
          New faculty administrator?{' '}
          <Link to="/register" className="text-primary underline underline-offset-2 hover:opacity-70">
            Submit registration request
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
