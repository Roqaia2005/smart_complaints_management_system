import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/api/services';
import {
  AuthCard, ErrorAlert, SuccessAlert, PrimaryButton, MailIcon,
} from './auth.shared';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <div className="flex flex-col gap-1">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Password recovery</p>
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the email linked to your account and we'll send a reset link.
        </p>
      </div>

      {!sent ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fp-email" className="text-[0.8rem] font-medium">Email address</label>
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu.eg"
              autoComplete="email"
              className="w-full p-2 rounded-lg"
            />
          </div>

          <PrimaryButton loading={loading} disabled={!email} className="mt-1">
            {loading ? 'Sending…' : 'Send reset link'}
          </PrimaryButton>
        </form>
      ) : (
        <div className="flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MailIcon />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Check your inbox</p>
            <h2 className="text-[1.3rem] font-bold tracking-tight">Reset link sent</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
              We sent a link to <strong>{email}</strong>. It expires in 30 minutes.
            </p>
          </div>
          <SuccessAlert>
            Didn't receive it? Check your spam folder or{' '}
            <button
              type="button"
              className="underline underline-offset-2 hover:opacity-70"
              onClick={() => setSent(false)}
            >
              try again
            </button>.
          </SuccessAlert>
        </div>
      )}

      <p className="text-center">
        <Link to="/login" className="text-[0.8rem] text-primary underline underline-offset-2 hover:opacity-70">
          ← Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
