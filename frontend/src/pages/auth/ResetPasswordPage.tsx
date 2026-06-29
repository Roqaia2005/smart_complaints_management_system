import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authApi } from '@/api/services';
import {
  AuthCard, ErrorAlert, PasswordInput, PrimaryButton, StrengthMeter,
} from './auth.shared';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [done, setDone]                       = useState(false);
  const [error, setError]                     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password || !confirmPassword) { setError('Please fill in both fields.'); return; }
    if (password !== confirmPassword)  { setError('Passwords do not match.'); return; }
    if (password.length < 8)           { setError('Password must be at least 8 characters.'); return; }
    if (!token)                        { setError('Invalid or missing reset token. Please request a new link.'); return; }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <div className="flex flex-col gap-1">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Password recovery</p>
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">Set new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a strong password you haven't used before.
        </p>
      </div>

      {!done ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-pass" className="text-[0.8rem] font-medium">New password</label>
            <PasswordInput
              id="new-pass"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
            <StrengthMeter password={password} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-new-pass" className="text-[0.8rem] font-medium">Confirm password</label>
            <PasswordInput
              id="confirm-new-pass"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[0.72rem] text-destructive">Passwords don't match</p>
            )}
          </div>

          <PrimaryButton loading={loading} className="mt-1">
            {loading ? 'Saving…' : 'Save new password'}
          </PrimaryButton>
        </form>
      ) : (
        <div className="flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">All done</p>
            <h2 className="text-[1.3rem] font-bold tracking-tight">Password updated</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your password has been changed. Sign in with your new credentials.
            </p>
          </div>
          <PrimaryButton type="button" onClick={() => navigate('/login')} className="max-w-[200px]">
            Sign in
          </PrimaryButton>
        </div>
      )}

      {!done && (
        <p className="text-center">
          <Link to="/login" className="text-[0.8rem] text-primary underline underline-offset-2 hover:opacity-70">
            ← Back to sign in
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
