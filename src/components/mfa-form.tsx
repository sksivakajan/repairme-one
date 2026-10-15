'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deviceLabel } from '@/lib/attendance';
export function MfaForm({ next = '/dashboard' }: { next?: '/account' | '/dashboard' }) {
  const router = useRouter();
  const [factor, setFactor] = useState('');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  return (
    <div className="setup-page">
      <h1>Protect your workspace</h1>
      <p>
        Privileged accounts require an authenticator code. Enroll a TOTP authenticator or verify
        your existing factor.
      </p>
      <button
        className="button yellow full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          setQrCode('');
          setSecret('');
          try {
            const res = await fetch('/auth/mfa', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'prepare' }),
            });
            const result = await res.json();
            setBusy(false);
            if (!res.ok) setError(result.error);
            else {
              setFactor(result.id);
              setSecret(result.secret ?? '');
              setQrCode(result.qrCode?.startsWith('data:image/svg+xml;') ? result.qrCode : '');
            }
          } catch {
            setError('Unable to connect. Try preparing your authenticator again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Prepare authenticator
      </button>
      {secret && (
        <div className="auth-status">
          <p>
            Scan this QR code with Google Authenticator, Microsoft Authenticator, or another TOTP
            app. Then enter its six-digit code below.
          </p>
          {qrCode && (
            // Provider-generated enrollment data stays in this authenticated page, without an external QR service.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrCode}
              alt="Scan to add RepairMe One to your authenticator"
              width={240}
              height={240}
              className="mfa-qr"
            />
          )}
          <details>
            <summary>Cannot scan? Enter the setup key manually</summary>
            <code>{secret}</code>
          </details>
          <p>Keep the QR code and setup key private.</p>
        </div>
      )}
      {factor && (
        <form
          className="dialog-form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            setBusy(true);
            setError('');
            try {
              const res = await fetch('/auth/mfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'verify',
                  factorId: factor,
                  code: new FormData(ev.currentTarget).get('code'),
                  remember,
                  deviceLabel: deviceLabel(),
                }),
              });
              const result = await res.json();
              setBusy(false);
              if (res.ok) {
                setSecret('');
                setQrCode('');
                router.push(next);
                router.refresh();
              } else setError(result.error);
            } catch {
              setError('Unable to connect. Try verifying again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Six-digit authenticator code
            <input
              name="code"
              pattern="[0-9]{6}"
              inputMode="numeric"
              required
              autoComplete="one-time-code"
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={remember}
              onChange={(ev) => setRemember(ev.target.checked)}
            />
            <span>
              Remember this device for 30 days
              <small>You won’t be asked for a code when you sign in here again.</small>
            </span>
          </label>
          <button disabled={busy} className="button yellow">
            Verify
          </button>
        </form>
      )}
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
    </div>
  );
}
