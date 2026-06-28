import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/services';

// ── Role → redirect path ───────────────────────────────────────────────────
const ROLE_HOME = {
  student:     '/student/chat',
  officer:     '/officer/dashboards',
  manager:     '/manager/overview',
  admin:       '/admin/categories',
  super_admin: '/superadmin/requests',
};

// ── Shared small components ────────────────────────────────────────────────
function EyeIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </>
      )}
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function PasswordInput({ id, value, onChange, placeholder = '••••••••', autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full pr-10 p-2 rounded-lg"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/8 border border-destructive/20 text-destructive text-sm">
      <AlertIcon />
      <span>{message}</span>
    </div>
  );
}

function SuccessAlert({ children }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-green-500/8 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
      <span className="shrink-0 mt-0.5"><CheckIcon /></span>
      <span>{children}</span>
    </div>
  );
}

/** Centred card wrapper used by every auth page */
function AuthCard({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[420px] flex flex-col gap-7 animate-in fade-in slide-in-from-bottom-3 duration-300">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-base shrink-0">
            🎓
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none tracking-tight">UniDesk</p>
            <p className="text-[0.68rem] text-muted-foreground uppercase tracking-widest mt-0.5">Complaint Management</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1 — LOGIN
// ═══════════════════════════════════════════════════════════════════════════
export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState('other');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const ROLES = [

    { key: 'admin',   label: 'Admin'   },
    { key: 'other', label: 'Other' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (!email || !password) return;
    try {
      await login(email, password);
      // store now holds user.role — read it back for redirect
      const role = useAuthStore.getState().user?.role ?? 'student';
      navigate(ROLE_HOME[role] ?? '/', { replace: true });
    } catch {
      // error already set in store by login()
    }
  };

  return (
    <AuthCard>
      <div className="flex flex-col gap-1">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Welcome back</p>
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-1">Access your dashboard and manage complaints.</p>
      </div>

      {/* Role selector */}
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <ErrorAlert message={error} />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[0.8rem] font-medium">Email address</label>
          <input
            id="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu.eg"
            autoComplete="email"
            className="w-full p-2 rounded-lg "
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-[0.8rem] font-medium">Password</label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-[0.78rem] text-primary underline underline-offset-2 hover:opacity-70"
            >
              Forgot password?
            </button>
          </div>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="mt-1 w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {selectedRole === 'admin' && (
        <p className="text-center text-[0.8rem] text-muted-foreground">
          New faculty administrator?{' '}
          <button onClick={() => navigate('/register')} className="text-primary underline underline-offset-2 hover:opacity-70">
            Submit registration request
          </button>
        </p>
      )}
    </AuthCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2 — ADMIN REGISTER (2-step)
// ═══════════════════════════════════════════════════════════════════════════
export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [done, setDone]     = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirmPassword: '',
    university_name: '', faculty_name: '', email_domain: '', supporting_document: '',
  });

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const nextStep = (e) => {
    e.preventDefault();
    setError('');
    if (!form.full_name || !form.email || !form.password || !form.confirmPassword) {
      setError('Please fill in all fields.'); return;
    }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.university_name || !form.faculty_name || !form.email_domain) {
      setError('Please fill in all required fields.'); return;
    }
    setLoading(true);
    try {
      await authApi.registerAdmin({
        full_name:           form.full_name,
        email:               form.email,
        password:            form.password,
        university_name:     form.university_name,
        faculty_name:        form.faculty_name,
        email_domain:        form.email_domain,
        supporting_document: form.supporting_document,
      });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const StepDot = ({ n }) => (
    <div className={[
      'w-6 h-6 rounded-full border-2 flex items-center justify-center text-[0.68rem] font-semibold transition-all duration-200',
      step > n  ? 'bg-primary border-primary text-primary-foreground' :
      step === n ? 'border-primary text-primary' :
                   'border-border text-muted-foreground',
    ].join(' ')}>
      {step > n ? <CheckIcon /> : n}
    </div>
  );

  if (done) return (
    <AuthCard>
      <div className="flex flex-col items-center text-center gap-5">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Request submitted</p>
          <h1 className="text-[1.4rem] font-bold tracking-tight">Pending review</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[300px]">
            Your registration request for <strong>{form.faculty_name}</strong> has been sent to the super admin. You'll receive an email once it's reviewed.
          </p>
        </div>
        <button onClick={() => navigate('/login')} className="w-full max-w-[200px] py-2.5 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          Back to sign in
        </button>
      </div>
    </AuthCard>
  );

  return (
    <AuthCard>
      <div className="flex flex-col gap-1">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Admin registration</p>
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">Request faculty access</h1>
        <p className="text-sm text-muted-foreground mt-1">Submit your details for super admin approval.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        <StepDot n={1} />
        <div className={`flex-1 h-0.5 transition-colors duration-200 ${step > 1 ? 'bg-primary' : 'bg-border'}`} />
        <StepDot n={2} />
      </div>

      {step === 1 && (
        <form key="step1" onSubmit={nextStep} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="full_name" className="text-[0.8rem] font-medium">Full name</label>
            <input id="full_name" type="text" value={form.full_name} onChange={set('full_name')} placeholder="Dr. Mohamed Hassan" autoComplete="name" className="w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-email" className="text-[0.8rem] font-medium">Work email</label>
            <input id="reg-email" type="email" value={form.email} onChange={set('email')} placeholder="m.hassan@eng.cu.edu.eg" autoComplete="email" className="w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-pass" className="text-[0.8rem] font-medium">Password</label>
            <PasswordInput id="reg-pass" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-pass" className="text-[0.8rem] font-medium">Confirm password</label>
            <PasswordInput id="confirm-pass" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
          </div>
          <button type="submit" className="mt-1 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            Continue
          </button>
        </form>
      )}

      {step === 2 && (
        <form key="step2" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="uni" className="text-[0.8rem] font-medium">University <span className="text-destructive">*</span></label>
              <input id="uni" type="text" value={form.university_name} onChange={set('university_name')} placeholder="Cairo University" className="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fac" className="text-[0.8rem] font-medium">Faculty <span className="text-destructive">*</span></label>
              <input id="fac" type="text" value={form.faculty_name} onChange={set('faculty_name')} placeholder="Engineering" className="w-full" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="domain" className="text-[0.8rem] font-medium">Email domain <span className="text-destructive">*</span></label>
            <input id="domain" type="text" value={form.email_domain} onChange={set('email_domain')} placeholder="@eng.cu.edu.eg" className="w-full" />
            <p className="text-[0.72rem] text-muted-foreground">Students and officers must register under this domain.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc" className="text-[0.8rem] font-medium">Supporting document URL</label>
            <input id="doc" type="url" value={form.supporting_document} onChange={set('supporting_document')} placeholder="https://drive.google.com/…" className="w-full" />
            <p className="text-[0.72rem] text-muted-foreground">Optional — official letter or faculty decree.</p>
          </div>
          <div className="flex gap-2.5 mt-1">
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="py-2.5 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-[0.8rem] text-muted-foreground">
        Already have an account?{' '}
        <button onClick={() => navigate('/login')} className="text-primary underline underline-offset-2 hover:opacity-70">
          Sign in
        </button>
      </p>
    </AuthCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 3 — FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════════════════
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
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
        <p className="text-sm text-muted-foreground mt-1">Enter the email linked to your account and we'll send a reset link.</p>
      </div>

      {!sent ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fp-email" className="text-[0.8rem] font-medium">Email address</label>
            <input
              id="fp-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu.eg"
              autoComplete="email"
              className="w-full"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="mt-1 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
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
            <button type="button" className="underline underline-offset-2 hover:opacity-70" onClick={() => setSent(false)}>
              try again
            </button>.
          </SuccessAlert>
        </div>
      )}

      <p className="text-center">
        <button onClick={() => navigate('/login')} className="text-[0.8rem] text-primary underline underline-offset-2 hover:opacity-70">
          ← Back to sign in
        </button>
      </p>
    </AuthCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 4 — RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════
export function ResetPasswordPage() {
  const navigate  = useNavigate();
  // Read token from URL: /reset-password?token=xxx
  const token = new URLSearchParams(window.location.search).get('token') ?? '';

  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [error, setError]                 = useState('');

  const strength =
    password.length === 0 ? 0 :
    password.length < 6   ? 1 :
    password.length < 10  ? 2 :
    /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;

  const strengthMeta = [
    null,
    { label: 'Weak',   color: 'bg-destructive' },
    { label: 'Fair',   color: 'bg-yellow-500'  },
    { label: 'Good',   color: 'bg-blue-500'    },
    { label: 'Strong', color: 'bg-green-500'   },
  ];

  const handleSubmit = async (e) => {
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
    } catch (err) {
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
        <p className="text-sm text-muted-foreground mt-1">Choose a strong password you haven't used before.</p>
      </div>

      {!done ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-pass" className="text-[0.8rem] font-medium">New password</label>
            <PasswordInput id="new-pass" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" />
            {password.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-0.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1 rounded-full transition-all duration-200 ${i <= strength ? (strengthMeta[strength]?.color ?? 'bg-border') : 'bg-border'}`}
                    />
                  ))}
                </div>
                <p className="text-[0.7rem] font-medium" style={{ color: 'inherit' }}>
                  {strengthMeta[strength]?.label}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-new-pass" className="text-[0.8rem] font-medium">Confirm password</label>
            <PasswordInput id="confirm-new-pass" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[0.72rem] text-destructive">Passwords don't match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
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
          <button
            onClick={() => navigate('/login')}
            className="w-full max-w-[200px] py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in
          </button>
        </div>
      )}
    </AuthCard>
  );
}
// Root — page router
// ═══════════════════════════════════════════════════════════════════════════
export default function AuthPages() {
  const [page, setPage] = useState('login');
  const pages = { login: LoginPage, register: RegisterPage, forgot: ForgotPasswordPage, reset: ResetPasswordPage };
  const Page = pages[page] || LoginPage;
 
  return (
    <>
      <Page onNavigate={setPage} />
    </>
  );
}
