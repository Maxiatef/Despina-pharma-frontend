'use client';

import { Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { del, patch, post } from '@/lib/api';
import type { Contact, SessionRow, UserRole } from '@/lib/types';
import { isStaff, useAuth } from './auth';
import { ErrorBox, Kv, Loading, PageHead, fmtDate, formValues, humanize, useAction, useApi, Tip } from './ui';

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
      <h2>Password<Tip>At least 10 characters. Changing it signs out your other devices.</Tip></h2>
      <form className="form-grid" style={{ marginTop: 14 }} onSubmit={save}>
        <label className="field full"><span>Current password</span><input name="currentPassword" type="password" required autoComplete="current-password" /></label>
        <label className="field"><span>New password</span><input name="newPassword" type="password" required minLength={10} autoComplete="new-password" /></label>
        <label className="field"><span>Repeat new password</span><input name="repeat" type="password" required minLength={10} autoComplete="new-password" /></label>
        <div className="full"><button className="btn" disabled={busy}>Change password</button></div>
      </form>
    </div>
  );
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = `Despina Pharma – two-factor backup codes\nEach code works once.\n\n${codes.join('\n')}\n`;
  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <div className="alert warn">Save these backup codes now – they are shown only once. Each one signs you in once if you lose your phone.</div>
      <div className="backup-codes mono">{codes.map((c) => <span key={c}>{c}</span>)}</div>
      <div className="row">
        <button type="button" className="btn small secondary" onClick={() => void navigator.clipboard?.writeText(text)}>Copy</button>
        <a className="btn small secondary" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="despina-backup-codes.txt">Download</a>
        <button type="button" className="btn small" onClick={onDone}>I saved them</button>
      </div>
    </div>
  );
}

function TwoFactor({ reload, required }: { reload: () => void; required: boolean }) {
  const { refresh } = useAuth();
  const params = useSearchParams();
  const status = useApi<{ enabled: boolean; backupCodesLeft: number; required: boolean }>('/auth/mfa');
  const { busy, run } = useAction();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  useEffect(() => {
    if (setup) QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(''));
  }, [setup]);
  const enabled = !!status.data?.enabled;
  const left = status.data?.backupCodesLeft ?? 0;
  const usedBackup = params.get('backup-left');
  const done = () => { setCodes(null); status.reload(); reload(); };
  return (
    <div className="card pad">
      <div className="row between"><h2>Two-factor login<Tip>After your password, you also type a 6-digit code from an app on your phone. A stolen password alone is then not enough to get in.</Tip></h2><span className={`badge ${enabled ? 'ok' : 'warn'}`}>{enabled ? 'On' : 'Off'}</span></div>
      {required && !enabled && <div className="alert info" style={{ marginTop: 12 }}>Team accounts must use two-factor login. Please turn it on now – the rest of the dashboard opens once it is on.</div>}
      {usedBackup !== null && enabled && !codes && <div className="alert warn" style={{ marginTop: 12 }}>You signed in with a backup code. {left} backup code{left === 1 ? '' : 's'} left{left <= 3 ? ' – make new ones below.' : '.'}</div>}
      <p className="small muted" style={{ marginTop: 8 }}>Use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) to get a 6-digit code at each login.</p>
      {codes && <BackupCodes codes={codes} onDone={done} />}
      {!enabled && !setup && !codes && (
        <button className="btn" style={{ marginTop: 12 }} disabled={busy || status.loading} onClick={async () => { const r = await run(() => post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup')); if (r) setSetup(r); }}>Set up two-factor login</button>
      )}
      {setup && (
        <form className="stack" style={{ marginTop: 14 }} onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => post<{ backupCodes: string[] }>('/auth/mfa/enable', { code }), 'Two-factor login is on');
          if (r) { setSetup(null); setCode(''); setCodes(r.backupCodes); status.reload(); await refresh(); }
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
      {enabled && !codes && (
        <>
          <p className="small" style={{ marginTop: 12 }}>Backup codes left: <b>{left}</b> of 10. Each one signs you in once without your phone.</p>
          <form className="row" style={{ marginTop: 8 }} onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => post<{ backupCodes: string[] }>('/auth/mfa/backup-codes', { code }), 'New backup codes made');
            if (r) { setCode(''); setCodes(r.backupCodes); }
          }}>
            <input className="input" placeholder="Current 6-digit code" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn secondary" disabled={busy}>New backup codes</button>
            {!status.data?.required && (
              <button type="button" className="btn danger" disabled={busy || !code} onClick={async () => {
                if (await run(() => post('/auth/mfa/disable', { code }), 'Two-factor login is off')) { setCode(''); done(); }
              }}>Turn off</button>
            )}
          </form>
          {status.data?.required && <p className="small muted" style={{ marginTop: 8 }}>Team accounts keep two-factor login on. New phone? Ask an admin to reset it, or sign in with a backup code and set it up again.</p>}
        </>
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
        <h2>Signed-in devices<Tip>Where your account is signed in now. Sign out anything you do not recognise, then change your password.</Tip></h2>
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

interface TeamCompany {
  id: string; name: string; canManage: boolean;
  people: { id: string; email: string; name: string | null; role: string; status: 'active' | 'invited'; isYou: boolean }[];
}

/** Colleagues in the customer's company. The company's main contact can invite and remove them. */
function Team() {
  const t = useApi<{ companies: TeamCompany[] }>('/portal/team');
  const { busy, run } = useAction();
  const [inviteTo, setInviteTo] = useState<string | null>(null);
  if (!t.data?.companies.length) return <ErrorBox error={t.error} onRetry={t.reload} />;

  async function invite(e: FormEvent<HTMLFormElement>, companyId: string) {
    e.preventDefault();
    const f = e.currentTarget;
    const v = formValues(f);
    const r = await run(() => post<{ emailStatus: string }>('/portal/team/invite', {
      companyId, email: v.email, firstName: v.firstName, lastName: v.lastName || undefined, jobTitle: v.jobTitle || undefined,
      role: v.owner ? 'owner' : 'member',
    }), 'Invitation sent');
    if (r) { f.reset(); setInviteTo(null); t.reload(); }
  }

  return (
    <>
      {t.data.companies.map((co) => (
        <div className="card" key={co.id}>
          <div className="card-head">
            <h2>Team – {co.name}<Tip>People from your company who can open your projects. The main contact can invite and remove colleagues.</Tip></h2>
            {co.canManage && <button className="btn small" onClick={() => setInviteTo(inviteTo === co.id ? null : co.id)}>Invite a colleague</button>}
          </div>
          {inviteTo === co.id && (
            <form className="form-grid card-body" onSubmit={(e) => invite(e, co.id)}>
              <label className="field"><span>First name</span><input name="firstName" required maxLength={100} /></label>
              <label className="field"><span>Last name</span><input name="lastName" maxLength={100} /></label>
              <label className="field"><span>Email</span><input name="email" type="email" required maxLength={254} /></label>
              <label className="field"><span>Job title</span><input name="jobTitle" maxLength={150} /></label>
              <label className="check full"><input type="checkbox" name="owner" /> Can also invite and remove colleagues</label>
              <p className="small muted full">They get an e-mail to set a password and will see all of {co.name}’s projects.</p>
              <div className="full row"><button className="btn" disabled={busy}>Send invitation</button><button type="button" className="btn ghost" onClick={() => setInviteTo(null)}>Cancel</button></div>
            </form>
          )}
          <table className="table">
            <tbody>
              {co.people.map((p) => (
                <tr key={p.id}>
                  <td className="small">{p.name ?? p.email}{p.name && <div className="muted">{p.email}</div>}</td>
                  <td className="small">{p.role === 'owner' ? 'Main contact' : 'Member'}{p.isYou && <span className="muted"> (you)</span>}</td>
                  <td><span className={`badge ${p.status === 'active' ? 'ok' : 'warn'}`}>{p.status === 'active' ? 'Active' : 'Invited'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    {co.canManage && !p.isYou && (
                      <span className="row" style={{ justifyContent: 'flex-end' }}>
                        {p.status === 'invited' && <button className="btn small secondary" disabled={busy} onClick={async () => { await run(() => post(`/portal/team/${p.id}/resend`), 'Invitation sent again'); }}>Send again</button>}
                        <button className="btn small ghost" disabled={busy} onClick={async () => {
                          if (confirm(`Remove ${p.name ?? p.email}? They will lose access to ${co.name}’s projects at once.`) && await run(() => post(`/portal/team/${p.id}/remove`), 'Colleague removed')) t.reload();
                        }}>Remove</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!co.canManage && <p className="small muted card-body">To add or remove colleagues, ask your company’s main contact or Despina Pharma.</p>}
        </div>
      ))}
    </>
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
      <PageHead eyebrow="Account" title="My account" sub={me.data.email}
        help={isStaff(auth?.role) ? (
          <ul>
            <li><b>Two-factor login</b> is required for the team: install an authenticator app (Google Authenticator, Microsoft Authenticator…), scan the QR code, and type the 6-digit code from the app each time you sign in.</li>
            <li>Keep your <b>backup codes</b> safe – each one signs you in once if you do not have your phone. Lost them and your phone? Ask an admin to reset two-factor login.</li>
            <li><b>Signed-in devices</b> – sign out a device you do not recognise.</li>
          </ul>
        ) : (
          <ul>
            <li>Keep your profile up to date so the team can reach you.</li>
            <li><b>Two-factor login</b> is optional but recommended: a code from your phone is asked at each sign-in.</li>
            <li><b>Team</b> – if you are your company’s main contact, you can invite colleagues and remove them here.</li>
          </ul>
        )} />
      <div className="grid cols-2">
        <div className="stack">
          <Profile me={me.data} reload={me.reload} />
          <Password />
        </div>
        <div className="stack">
          <TwoFactor reload={me.reload} required={isStaff(auth?.role) && (params.get('setup-mfa') === '1' || !!auth?.mfaPending)} />
          <Sessions />
        </div>
      </div>
      {!isStaff(auth?.role) && <div className="stack" style={{ marginTop: 20 }}><Team /></div>}
    </>
  );
}

export function Account() {
  return <Suspense fallback={<Loading />}><AccountInner /></Suspense>;
}
