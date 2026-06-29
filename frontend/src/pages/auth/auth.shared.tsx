import { useState } from 'react';

// ── Role → redirect path (used by LoginPage) ──────────────────────────────
export const ROLE_HOME: Record<string, string> = {
  student:     '/student/chat',
  officer:     '/officer/dashboards',
  manager:     '/manager/overview',
  admin:       '/admin/categories',
  super_admin: '/superadmin/requests',
};

// ── Icons ─────────────────────────────────────────────────────────────────
export function EyeIcon({ open }: { open: boolean }) {
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

export function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

export function CheckCircleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

export function CheckSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ── Reusable inputs ────────────────────────────────────────────────────────
export function PasswordInput({
  id, value, onChange, placeholder = '••••••••', autoComplete,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
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

/** 4-bar password strength meter. Pass the raw password string. */
export function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const score =
    password.length < 6  ? 1 :
    password.length < 10 ? 2 :
    /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;

  const meta = [
    null,
    { label: 'Weak',   color: 'bg-destructive'  },
    { label: 'Fair',   color: 'bg-yellow-500'   },
    { label: 'Good',   color: 'bg-blue-500'     },
    { label: 'Strong', color: 'bg-green-500'    },
  ] as const;

  return (
    <div className="flex flex-col gap-1.5 mt-0.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-all duration-200 ${
              i <= score ? meta[score]!.color : 'bg-border'
            }`}
          />
        ))}
      </div>
      <p className="text-[0.7rem] font-medium text-muted-foreground">
        {meta[score]?.label}
      </p>
    </div>
  );
}

// ── Alert banners ──────────────────────────────────────────────────────────
export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/8 border border-destructive/20 text-destructive text-sm">
      <AlertIcon />
      <span>{message}</span>
    </div>
  );
}

export function SuccessAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-green-500/8 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
      <span className="shrink-0 mt-0.5"><CheckSmallIcon /></span>
      <span>{children}</span>
    </div>
  );
}

// ── Step indicator (used in RegisterPage) ─────────────────────────────────
export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done   = current > n;
        const active = current === n;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className={[
              'w-6 h-6 rounded-full border-2 flex items-center justify-center text-[0.68rem] font-semibold transition-all duration-200 shrink-0',
              done   ? 'bg-primary border-primary text-primary-foreground' :
              active ? 'border-primary text-primary bg-background' :
                       'border-border text-muted-foreground bg-background',
            ].join(' ')}>
              {done ? <CheckSmallIcon /> : n}
            </div>
            {n < total && (
              <div className={`flex-1 h-0.5 mx-1 transition-colors duration-200 ${done ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Centred page wrapper used by every auth page ───────────────────────────
export function AuthCard({ children }: { children: React.ReactNode }) {
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

// ── Primary button ─────────────────────────────────────────────────────────
export function PrimaryButton({
  children, loading, disabled, onClick, type = 'submit', className = '',
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold
        hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-150 ${className}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : children}
    </button>
  );
}
