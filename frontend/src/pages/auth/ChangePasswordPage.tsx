import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/services';
import {
  AuthCard, ErrorAlert, SuccessAlert, PasswordInput,
  PrimaryButton, StrengthMeter,
} from './auth.shared';

/**
 * ChangePasswordPage
 * Route: /change-password
 *
 * Shown to any logged-in user (all roles) who needs to change their
 * temporary admin-issued password. Calls PATCH /users/change-password.
 * On success, logs the user out so they re-authenticate with the new password.
 */
export default function ChangePasswordPage() {
  const navigate  = useNavigate();
  const { logout } = useAuthStore();

  const [currentPassword, setCurrentPassword]     = useState('');
  const [newPassword, setNewPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]     = useState('');
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState('');
  const [done, setDone]                           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.'); return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.'); return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.'); return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.'); return;
    }

    setLoading(true);
    try {
      await authApi.patch('/users/change-password', {
        current_password: currentPassword,
        new_password:     newPassword,
      });
      setDone(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        'Failed to change password. Please check your current password and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndLogin = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthCard>
      <div className="flex flex-col gap-1">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Account security</p>
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">Change password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You're using a temporary password. Set a new one to secure your account.
        </p>
      </div>

      {!done ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="current-pass" className="text-[0.8rem] font-medium">Current password</label>
            <PasswordInput
              id="current-pass"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Your temporary password"
              autoComplete="current-password"
            />
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-pass" className="text-[0.8rem] font-medium">New password</label>
            <PasswordInput
              id="new-pass"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
            <StrengthMeter password={newPassword} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-new-pass" className="text-[0.8rem] font-medium">Confirm new password</label>
            <PasswordInput
              id="confirm-new-pass"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[0.72rem] text-destructive">Passwords don't match</p>
            )}
          </div>

          <PrimaryButton loading={loading} className="mt-1">
            {loading ? 'Updating…' : 'Update password'}
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
            <p className="text-sm text-muted-foreground mt-1 max-w-[300px]">
              Your password has been changed successfully. Sign in again with your new password.
            </p>
          </div>
          <SuccessAlert>Your account is now secured with your new password.</SuccessAlert>
          <PrimaryButton type="button" onClick={handleLogoutAndLogin} className="max-w-[220px]">
            Sign in with new password
          </PrimaryButton>
        </div>
      )}
    </AuthCard>
  );
}
