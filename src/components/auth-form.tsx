'use client';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
export function AuthForm({
  mode,
  configured,
  initialStatus = '',
}: {
  mode: 'login' | 'recovery' | 'password';
  configured: boolean;
  initialStatus?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth-shell">
      <div className="auth-branding">
        <Link href="/dashboard" className="brand logo-brand" aria-label="RepairMe One home">
          <BrandLogo />
        </Link>
        <div>
          <h1>
            Good people.
            <br />
            Great work.
            <br />
            <span>One workspace.</span>
          </h1>
          <p>The place where our people, projects, and possibilities come together.</p>
        </div>
        <small>REPAIRME · BUILT FOR THE WAY WE WORK</small>
      </div>
      <div className="auth-form-area">
        <div className="auth-card">
          <div className="eyebrow">
            <ShieldCheck size={14} /> YOUR COMPANY WORKSPACE
          </div>
          <h1>
            {mode === 'login'
              ? 'Welcome back.'
              : mode === 'recovery'
                ? 'Let’s get you back in.'
                : 'Secure your account.'}
          </h1>
          <p>
            {mode === 'login'
              ? 'Sign in with your company account to pick up where you left off.'
              : mode === 'recovery'
                ? 'Enter your work email to request a password recovery link.'
                : 'Set a new password for your RepairMe One account.'}
          </p>
          {!configured && (
            <div className="auth-status">
              Workspace setup is required. Add your Supabase URL and publishable key to the server
              environment. No credentials are stored in this preview.
            </div>
          )}
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              setBusy(true);
              setStatus('');
              try {
                const res = await fetch('/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mode,
                    ...Object.fromEntries(new FormData(ev.currentTarget)),
                  }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error);
                if (result.redirect) window.location.assign(result.redirect);
                else setStatus(result.message);
              } catch (e) {
                setStatus(e instanceof Error ? e.message : 'Unable to complete the request.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode !== 'password' && (
              <label className="field">
                Work email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@repairme.lk"
                  required
                />
              </label>
            )}
            {mode !== 'recovery' && (
              <label className="field">
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === 'password' ? 'new-password' : 'current-password'}
                  minLength={mode === 'password' ? 12 : 8}
                  required
                />
              </label>
            )}
            <button type="submit" className="button yellow" disabled={busy || !configured}>
              {busy
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : mode === 'recovery'
                    ? 'Send recovery link'
                    : 'Update password'}
              <ArrowRight size={16} />
            </button>
          </form>
          {status && (
            <div className="auth-status" role="status">
              {status}
            </div>
          )}
          <div className="auth-links">
            <Link href="/recovery">Forgot password?</Link>
            <Link href="/login">Company sign in</Link>
            {!configured && process.env.NODE_ENV !== 'production' && (
              <Link href="/dashboard">Explore preview →</Link>
            )}
          </div>
          <p className="small-note">
            Accounts are invitation only. Contact your system administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
