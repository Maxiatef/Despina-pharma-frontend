'use client';

import { Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { del, patch, post } from '@/lib/api';
import type { Contact, SessionRow, UserRole } from '@/lib/types';
import { isStaff, useAuth } from './auth';
import { ErrorBox, Kv, Loading, PageHead, fmtDate, formValues, humanize, useAction, useApi } from './ui';

interface PortalMe {
  id: string; email: string; role: UserRole; mfaEnabled: boolean; contact: Contact | null;
  companies: { id: string; name: string; website: string | null }[];
}

function Profile({ me, reload }: { me: PortalMe; reload: () => void }) {
  const { busy, run } = useAction();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await run(() => patch('/portal/me', formValues(e.currentTarget)), 'Profile saved')) reload();
  }
  const c = me.contact;
  return (
    <div className="card pad">
      <h2>Profile</h2>
      <form className="form-grid" style={{ marginTop: 14 }} onSubmit={save}>
        <label className="field"><span>First name</span><input name="firstName" defaultValue={c?.firstName ?? ''} maxLength={100} /></label>
        <label className="field"><span>Last name</span><input name="lastName" defaultValue={c?.lastName ?? ''} maxLength={100} /></label>
        <label className="field"><span>Phone</span><input name="phone" defaultValue={c?.phone ?? ''} maxLength={50} /></label>
        <label className="field"><span>Job title</span><input name="jobTitle" defaultValue={c?.jobTitle ?? ''} maxLength={150} /></label>
        <label className="field"><span>Country</span><input name="country" defaultValue={c?.country ?? ''} maxLength={100} /></label>
        <label className="field"><span>Email</span><input value={me.email} disabled /><small className="hint">To change your email, ask your Despina contact.</small></label>
        <div className="full"><button className="btn" disabled={busy}>Save profile</button></div>
      </form>
      {!!me.companies.length && <div style={{ marginTop: 16 }}><Kv rows={[['Companies', me.companies.map((x) => x.name).join(', ')], ['Role', humanize(me.role)]]} /></div>}
    </div>
  );
}

function Password() {
  const { busy, run } = useAction();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const v = formValues(f);
    if (v.newPassword !== v.repeat) return void run(async () => { throw new Error('The new passwords do not match'); });
    if (await run(() => post('/auth/password/change', { currentPassword: v.currentPassword, newPassword: v.newPassword }), 'Password changed')) f.reset();
  }
  return (
    <div className="card pad">
      <h2>Password</h2>
      <form className="form-grid" style={{ marginTop: 14 }} onSubmit={save}>
        <label className="field full"><span>Current password</span><input name="currentPassword" type="password" required autoComplete="current-password" /></label>
        <label className="field"><span>New password</span><input name="newPassword" type="password" required minLength={10} autoComplete="new-password" /></label>
        <label className="field"><span>Repeat new password</span><input name="repeat" type="password" required minLength={10} autoComplete="new-password" /></label>
        <div className="full"><button className="btn" disabled={busy}>Change password</button></div>
      </form>
    </div>
  );
}

function TwoFactor({ enabled, reload, required }: { enabled: boolean; reload: () => void; required: boolean }) {
  const { busy, run } = useAction();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => {
    if (setup) QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(''));
  }, [setup]);
  return (
    <div className="card pad">
      <div className="row between"><h2>Two-factor login</h2><span className={`badge ${enabled ? 'ok' : 'warn'}`}>{enabled ? 'On' : 'Off'}</span></div>
      {required && !enabled && <div className="alert info" style={{ marginTop: 12 }}>Team accounts must use two-factor login. Please turn it on now.</div>}
      <p className="small muted" style={{ marginTop: 8 }}>Use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) to get a 6-digit code at each login.</p>
      {!enabled && !setup && (
        <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={async () => { const r = await run(() => post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup')); if (r) setSetup(r); }}>Set up two-factor login</button>
      )}
      {setup && (
        <form className="stack" style={{ marginTop: 14 }} onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => post('/auth/mfa/enable', { code }), 'Two-factor login is on')) { setSetup(null); setCode(''); reload(); }
        }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URL */}
            {qr && <img src={qr} width={160} height={160} alt="QR code for your authenticator app" />}
            <div className="small">
              <p>1. Scan the QR code with your app.</p>
              <p className="muted">Can’t scan? Enter this key: <span className="mono">{setup.secret}</span></p>
              <p style={{ marginTop: 8 }}>2. Enter the 6-digit code it shows.</p>
            </div>
          </div>
          <label className="field"><span>Code</span><input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <button className="btn" disabled={busy}>Turn on</button>
        </form>
      )}
      {enabled && (
        <form className="row" style={{ marginTop: 12 }} onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => post('/auth/mfa/disable', { code }), 'Two-factor login is off')) { setCode(''); reload(); }
        }}>
          <input className="input" placeholder="Current code" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn danger" disabled={busy}>Turn off</button>
        </form>
      )}
    </div>
  );
}

function Sessions() {
  const router = useRouter();
  const s = useApi<SessionRow[]>('/auth/sessions');
  const { busy, run } = useAction();
  return (
    <div className="card">
      <div className="card-head">
        <h2>Signed-in devices</h2>
        <button className="btn small danger" disabled={busy} onClick={async () => { if (await run(() => post('/auth/sessions/revoke-all'), 'Signed out everywhere')) router.replace('/login/'); }}>Sign out everywhere</button>
      </div>
      <ErrorBox error={s.error} onRetry={s.reload} />
      <table className="table">
        <tbody>
          {s.data?.map((x) => (
            <tr key={x.id}>
              <td className="small">{x.userAgent?.slice(0, 90) ?? 'Unknown device'}<div className="muted">{x.ip}</div></td>
              <td className="small muted">Since {fmtDate(x.createdAt, true)}</td>
              <td style={{ textAlign: 'right' }}>
                {x.current ? <span className="badge info">This device</span> : (
                  <button className="btn small secondary" disabled={busy} onClick={async () => { if (await run(() => del(`/auth/sessions/${x.id}`), 'Device signed out')) s.reload(); }}>Sign out</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountInner() {
  const { me: auth } = useAuth();
  const me = useApi<PortalMe>('/portal/me');
  const params = useSearchParams();
  if (me.loading && !me.data) return <Loading />;
  if (!me.data) return <ErrorBox error={me.error} onRetry={me.reload} />;
  return (
    <>
      <PageHead eyebrow="Account" title="My account" sub={me.data.email} />
      <div className="grid cols-2">
        <div className="stack">
          <Profile me={me.data} reload={me.reload} />
          <Password />
        </div>
        <div className="stack">
          <TwoFactor enabled={me.data.mfaEnabled} reload={me.reload} required={isStaff(auth?.role) && params.get('setup-mfa') === '1'} />
          <Sessions />
        </div>
      </div>
    </>
  );
}

export function Account() {
  return <Suspense fallback={<Loading />}><AccountInner /></Suspense>;
}
