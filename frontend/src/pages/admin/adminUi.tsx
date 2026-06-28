// =========================================================================
// adminUi.tsx
// Small, dependency-light UI primitives shared by every admin page.
// Built entirely on the existing theme tokens (bg-card, text-foreground,
// bg-primary, border-border, .glass, .animate-in, radius scale) so every
// page matches the admin.css theme already in the project — nothing here
// introduces a new palette.
// =========================================================================

import { type ReactNode, useEffect } from "react";
import { X, Loader2, Inbox, AlertTriangle, CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-base text-muted-foreground font-medium mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow-sm ${className}`}>{children}</div>
  );
}

// ---------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  loading,
  className = "",
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "h-9 w-9 p-0 text-xs" : "h-11 px-6 text-sm";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-secondary text-secondary-foreground hover:opacity-80",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Form inputs
// ---------------------------------------------------------------------

const fieldBase =
  "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldBase} min-h-20 ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-card shadow transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </button>
  );
}

// Simple checkbox-list multi-select, used for officer category_ids etc.
export function MultiCheckList({
  options,
  selected,
  onChange,
}: {
  options: { value: number; label: string }[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  function toggle(value: number) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">No options available.</p>;
  }
  return (
    <div className="max-h-40 overflow-y-auto rounded-lg border border-input p-2 space-y-1.5">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="accent-primary"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

// Tag-style input for arrays of strings (e.g. priority rule examples).
export function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  function addTag(raw: string) {
    const tag = raw.trim();
    if (tag && !values.includes(tag)) onChange([...values, tag]);
  }
  return (
    <div className="rounded-lg border border-input bg-background px-2 py-2 flex flex-wrap gap-1.5">
      {values.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground text-xs px-2 py-1"
        >
          {tag}
          <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        placeholder={placeholder ?? "Type and press Enter"}
        className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
      <div
        className={`w-full ${widths[size]} bg-card border border-border rounded-2xl shadow-md animate-in max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "destructive" | "accent";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    accent: "bg-accent/10 text-accent",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 text-muted-foreground">
      <Inbox className="size-8 mb-3 opacity-50" />
      <p className="text-base font-bold text-foreground">{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "error" | "success";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const styles =
    tone === "error"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-primary/10 text-primary border-primary/20";
  const Icon = tone === "error" ? AlertTriangle : CheckCircle2;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm mb-4 animate-in ${styles}`}>
      <Icon className="size-4 mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}