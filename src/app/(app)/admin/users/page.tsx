'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { patch, post, qs } from '@/lib/api';
import { USER_ROLES } from '@/lib/types';
import type { Company, Paged, User } from '@/lib/types';
import { useAuth } from '@/components/app/auth';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHead, Pager, fmtDate, formValues, humanize, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

function Users() {
  const { me } = useAuth();
  const { values, set } = useQueryState();
  const page = Number(values.page ?? 1);
  const [q, setQ] = useState(values.q ?? '');
  const list = useApi<Paged<User>>(`/users${qs({ q: values.q, role: values.role, page, pageSize: 25 })}`);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('sales');
  const [link, setLink] = useState<string | null>(null);
  const companies = useApi<Paged<Company>>(open && role === 'customer' ? '/companies?pageSize=200' : null);
  const { busy, run } = useAction();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await run(() => post<{ inviteToken: string }>('/users/invite', formValues(e.currentTarget)), 'Invitation created');
    if (r) { setLink(`${origin}/accept-invite/?token=${r.inviteToken}`); list.reload(); }
  }

  return (
    <>
      <PageHead eyebrow="Settings" title="Users" sub="Team accounts and customer logins. Accounts are by invitation only.">
        <button className="btn" onClick={() => { setLink(null); setOpen(true); }}>Invite user</button>
      </PageHead>
      <div className="card">
        <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
          <input className="input grow" type="search" placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={values.role ?? ''} onChange={(e) => set({ role: e.target.value })} aria-label="Role">
            <option value="">All roles</option>{USER_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
          </select>
          <button className="btn secondary">Search</button>
        </form>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <table className="table">
              <thead><tr><th>Email</th><th>Role</th><th>Two-factor</th><th>Status</th><th>Last login</th><th /></tr></thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>
                      <select className="input" value={u.role} disabled={busy || u.id === me?.id} aria-label="Role"
                        onChange={async (e) => { if (await run(() => patch(`/users/${u.id}`, { role: e.target.value }), 'Role changed')) list.reload(); }}>
                        {USER_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                      </select>
                    </td>
                    <td><Badge value={u.mfaEnabled ? 'on' : 'off'} tone={u.mfaEnabled ? 'ok' : u.role === 'customer' ? '' : 'warn'} /></td>
                    <td><Badge value={u.isActive ? 'active' : 'deactivated'} tone={u.isActive ? 'ok' : 'bad'} /></td>
                    <td className="small muted">{u.lastLoginAt ? fmtDate(u.lastLoginAt, true) : 'Never'}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {!u.lastLoginAt && (
                          <button className="btn small ghost" disabled={busy} onClick={async () => {
                            const r = await run(() => post<{ inviteToken: string }>(`/users/${u.id}/resend-invite`), 'New invitation created');
                            if (r) { setLink(`${origin}/accept-invite/?token=${r.inviteToken}`); setOpen(true); }
                          }}>Resend invite</button>
                        )}
                        {u.mfaEnabled && <button className="btn small ghost" disabled={busy} onClick={async () => { if (confirm(`Reset two-factor login for ${u.email}?`) && await run(() => post(`/users/${u.id}/reset-mfa`), 'Two-factor reset')) list.reload(); }}>Reset 2FA</button>}
                        {u.id !== me?.id && (
                          <button className={`btn small ${u.isActive ? 'danger' : 'secondary'}`} disabled={busy}
                            onClick={async () => { if (await run(() => patch(`/users/${u.id}`, { isActive: !u.isActive }), u.isActive ? 'User deactivated' : 'User reactivated')) list.reload(); }}>
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <Empty>No users found.</Empty>}
            <Pager page={page} pageSize={25} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
      <Modal open={open} title="Invite user" onClose={() => setOpen(false)}>
        {link ? (
          <div className="stack">
            <div className="alert success">Invitation ready. The email is queued; until email sending is connected, send this link yourself (valid 72 hours):</div>
            <input className="input mono" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="btn secondary" onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
          </div>
        ) : (
          <form className="stack" onSubmit={invite}>
            <label className="field"><span>Email</span><input name="email" type="email" required /></label>
            <label className="field"><span>Role</span>
              <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>{USER_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</select></label>
            {role === 'customer' && (
              <label className="field"><span>Company</span>
                <select name="companyId" required>{companies.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            )}
            <button className="btn" disabled={busy}>Create invitation</button>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function UsersPage() {
  return <Suspense fallback={<Loading />}><Users /></Suspense>;
}
