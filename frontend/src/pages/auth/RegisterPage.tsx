import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/api/services';
import {
  AuthCard, ErrorAlert, PasswordInput, PrimaryButton,
  StepIndicator, MailIcon, CheckSmallIcon,
} from './auth.shared';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirmPassword: '',
    university_name: '', faculty_name: '', email_domain: '', supporting_document: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Step 1 validation ────────────────────────────────────────────────────
  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.full_name || !form.email || !form.password || !form.confirmPassword) {
      setError('Please fill in all fields.'); return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    setStep(2);
  };

  // ── Step 2 submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (done) return (
    <AuthCard>
      <div className="flex flex-col items-center text-center gap-5">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <MailIcon />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Request submitted</p>
          <h1 className="text-[1.4rem] font-bold tracking-tight">Pending review</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[300px]">
            Your registration request for <strong>{form.faculty_name}</strong> has been sent
            to the super admin. You'll receive an email once it's reviewed.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => navigate('/login')} className="max-w-[200px]">
          Back to sign in
        </PrimaryButton>
      </div>
    </AuthCard>
  );

  return (
    <AuthCard>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-primary">Admin registration</p>
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">Request faculty access</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit your details for super admin approval.
        </p>
      </div>

      <StepIndicator current={step} total={2} />

      {/* ── Step 1 ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="full_name" className="text-[0.8rem] font-medium">Full name</label>
            <input id="full_name" type="text" value={form.full_name} onChange={set('full_name')}
              placeholder="Dr. Mohamed Hassan" autoComplete="name" className="w-full p-2 rounded-lg" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-email" className="text-[0.8rem] font-medium">Work email</label>
            <input id="reg-email" type="email" value={form.email} onChange={set('email')}
              placeholder="m.hassan@eng.cu.edu.eg" autoComplete="email" className="w-full p-2 rounded-lg" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-pass" className="text-[0.8rem] font-medium">Password</label>
            <PasswordInput id="reg-pass" value={form.password} onChange={set('password')}
              placeholder="Min. 8 characters" autoComplete="new-password" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-pass" className="text-[0.8rem] font-medium">Confirm password</label>
            <PasswordInput id="confirm-pass" value={form.confirmPassword} onChange={set('confirmPassword')}
              autoComplete="new-password" />
          </div>

          <PrimaryButton className="mt-1">Continue</PrimaryButton>
        </form>
      )}

      {/* ── Step 2 ─────────────────────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorAlert message={error} />}

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="uni" className="text-[0.8rem] font-medium">
                University <span className="text-destructive">*</span>
              </label>
              <input id="uni" type="text" value={form.university_name} onChange={set('university_name')}
                placeholder="Cairo University" className="w-full p-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fac" className="text-[0.8rem] font-medium">
                Faculty <span className="text-destructive">*</span>
              </label>
              <input id="fac" type="text" value={form.faculty_name} onChange={set('faculty_name')}
                placeholder="Engineering" className="w-full p-2 rounded-lg" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="domain" className="text-[0.8rem] font-medium">
              Email domain <span className="text-destructive">*</span>
            </label>
            <input id="domain" type="text" value={form.email_domain} onChange={set('email_domain')}
              placeholder="@eng.cu.edu.eg" className="w-full p-2 rounded-lg" />
            <p className="text-[0.72rem] text-muted-foreground">
              Students and officers must register under this domain.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc" className="text-[0.8rem] font-medium">Supporting document URL</label>
            <input id="doc" type="url" value={form.supporting_document} onChange={set('supporting_document')}
              placeholder="https://drive.google.com/…" className="w-full p-2 rounded-lg" />
            <p className="text-[0.72rem] text-muted-foreground">
              Optional — official letter or faculty decree.
            </p>
          </div>

          <div className="flex gap-2.5 mt-1">
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="py-2.5 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              Back
            </button>
            <PrimaryButton loading={loading} className="flex-1">
              {loading ? 'Submitting…' : 'Submit request'}
            </PrimaryButton>
          </div>
        </form>
      )}

      <p className="text-center text-[0.8rem] text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary underline underline-offset-2 hover:opacity-70">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
