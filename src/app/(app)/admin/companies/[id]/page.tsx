'use client';

import { use, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { del, patch, post } from '@/lib/api';
import type { Company, Contact, ProjectRow, UserRole } from '@/lib/types';
import { useAuth } from '@/components/app/auth';
import { Badge, ErrorBox, Loading, Modal, PageHead, fmtDate, formValues, humanize, useAction, useApi } from '@/components/app/ui';

interface CompanyDetail extends Company {
  contacts: Contact[];
  members: { id: string; memberRole: string; user: { id: string; email: string; role: UserRole } | null }[];
  inquiries: { id: string; referenceNo: string; formType: string; status: string; createdAt: string }[];
  projects: ProjectRow[];
}

export default function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { me } = useAuth();
  const c = useApi<CompanyDetail>(`/companies/${id}`);
  const { busy, run } = useAction();
  const [invite, setInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  if (c.loading && !c.data) return <Loading />;
  if (!c.data) return <ErrorBox error={c.error} onRetry={c.reload} />;
  const d = c.data;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await run(() => patch(`/companies/${id}`, formValues(e.currentTarget)), 'Company saved')) c.reload();
  }

  async function sendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const r = await run(() => post<{ inviteToken: string }>('/users/invite', { email: v.email, role: 'customer', companyId: id, contactId: v.contactId || undefined, memberRole: v.memberRole }), 'Invitation created');
    if (r) { setInviteLink(`${window.location.origin}/accept-invite/?token=${r.inviteToken}`); c.reload(); }
  }

  return (
    <>
      <p className="small"><Link href="/admin/companies/">← Companies</Link></p>
      <PageHead eyebrow="Company" title={d.name} sub={`Added ${fmtDate(d.createdAt)}`}>
        {me?.role === 'admin' && (
          <button className="btn danger" disabled={busy} onClick={async () => { if (confirm(`Delete ${d.name}? Only possible without projects.`) && await run(() => del(`/companies/${id}`), 'Company deleted')) router.push('/admin/companies/'); }}>Delete</button>
        )}
      </PageHead>
      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Projects</h2></div>
            <table className="table"><tbody>
              {d.projects.map((p) => <tr key={p.id}><td><Link href={`/admin/projects/${p.id}/`}>{p.name}</Link><div className="mono small muted">{p.code}</div></td><td><Badge value={p.status} /></td><td className="small muted">{fmtDate(p.updatedAt)}</td></tr>)}
            </tbody></table>
            {!d.projects.length && <p className="empty">No projects yet.</p>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Inquiries</h2></div>
            <table className="table"><tbody>
              {d.inquiries.map((i) => <tr key={i.id}><td><Link href={`/admin/inquiries/${i.id}/`} className="mono">{i.referenceNo}</Link></td><td>{humanize(i.formType)}</td><td><Badge value={i.status} /></td><td className="small muted">{fmtDate(i.createdAt)}</td></tr>)}
            </tbody></table>
            {!d.inquiries.length && <p className="empty">No inquiries.</p>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Contacts</h2></div>
            <table className="table"><tbody>
              {d.contacts.map((x) => <tr key={x.id}><td><Link href={`/admin/contacts/${x.id}/`}>{[x.firstName, x.lastName].filter(Boolean).join(' ')}</Link></td><td className="small">{x.email}</td><td className="small">{x.phone ?? ''}</td></tr>)}
            </tbody></table>
          </div>
        </div>
        <div className="stack">
          <div className="card pad">
            <h3>Details</h3>
            <form className="stack" style={{ marginTop: 10 }} onSubmit={save}>
              <label className="field"><span>Name</span><input name="name" defaultValue={d.name} required /></label>
              <label className="field"><span>Website</span><input name="website" defaultValue={d.website ?? ''} /></label>
              <label className="field"><span>Country</span><input name="country" defaultValue={d.country ?? ''} /></label>
              <label className="field"><span>Industry</span><input name="industry" defaultValue={d.industry ?? ''} /></label>
              <label className="field"><span>Notes</span><textarea name="notes" defaultValue={d.notes ?? ''} /></label>
              <button className="btn" disabled={busy}>Save</button>
            </form>
          </div>
          <div className="card pad">
            <div className="row between"><h3>Workspace access</h3><button className="btn small" onClick={() => { setInviteLink(null); setInvite(true); }}>Invite customer</button></div>
            {d.members.map((m) => (
              <div key={m.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span>{m.user?.email}<div className="muted">{humanize(m.memberRole)}</div></span>
                {m.user && <button className="btn small ghost" disabled={busy} onClick={async () => { if (await run(() => del(`/companies/${id}/members/${m.user!.id}`), 'Access removed')) c.reload(); }}>Remove</button>}
              </div>
            ))}
            {!d.members.length && <p className="small muted" style={{ marginTop: 8 }}>No one from this company can log in yet.</p>}
          </div>
        </div>
      </div>
      <Modal open={invite} title="Invite a customer to the workspace" onClose={() => setInvite(false)}>
        {inviteLink ? (
          <div className="stack">
            <div className="alert success">Invitation created. The email is queued; until email sending is connected, share this link yourself (valid 72 hours):</div>
            <input className="input mono" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
            <button className="btn secondary" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy link</button>
          </div>
        ) : (
          <form className="stack" onSubmit={sendInvite}>
            <label className="field"><span>Contact (optional)</span>
              <select name="contactId" onChange={(e) => { const x = d.contacts.find((k) => k.id === e.target.value); const el = (e.target.form!.elements.namedItem('email') as HTMLInputElement); if (x) el.value = x.email; }}>
                <option value="">—</option>{d.contacts.map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName ?? ''} · {x.email}</option>)}
              </select></label>
            <label className="field"><span>Email</span><input name="email" type="email" required /></label>
            <label className="field"><span>Access</span><select name="memberRole"><option value="member">Member</option><option value="owner">Owner</option><option value="viewer">Viewer</option></select></label>
            <button className="btn" disabled={busy}>Create invitation</button>
          </form>
        )}
      </Modal>
    </>
  );
}
