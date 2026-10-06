'use client';

import { use, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { get, patch, post } from '@/lib/api';
import type { Company, Contact, Paged } from '@/lib/types';
import { Badge, ErrorBox, Loading, PageHead, fmtDate, formValues, humanize, useAction, useApi } from '@/components/app/ui';

interface ContactDetail extends Contact {
  inquiries: { id: string; referenceNo: string; formType: string; status: string; createdAt: string }[];
  consents: { id: string; consentType: string; granted: boolean; policyVersion: string | null; createdAt: string }[];
}

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const c = useApi<ContactDetail>(`/contacts/${id}`);
  const companies = useApi<Paged<Company>>('/companies?pageSize=200');
  const { busy, run } = useAction();
  const [unsub, setUnsub] = useState<string | null>(null);

  if (c.loading && !c.data) return <Loading />;
  if (!c.data) return <ErrorBox error={c.error} onRetry={c.reload} />;
  const d = c.data;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (await run(() => patch(`/contacts/${id}`, { ...v, companyId: v.companyId || undefined }), 'Contact saved')) c.reload();
  }
  const consent = (type: string, granted: boolean) =>
    run(() => post(`/contacts/${id}/consents`, { consentType: type, granted }), 'Consent recorded').then((ok) => ok && c.reload());

  return (
    <>
      <p className="small"><Link href="/admin/contacts/">← Contacts</Link></p>
      <PageHead eyebrow="Contact" title={[d.firstName, d.lastName].filter(Boolean).join(' ')} sub={<a href={`mailto:${d.email}`}>{d.email}</a>} />
      <div className="split">
        <div className="stack">
          <div className="card pad">
            <h3>Details</h3>
            <form className="form-grid" style={{ marginTop: 12 }} onSubmit={save}>
              <label className="field"><span>First name</span><input name="firstName" defaultValue={d.firstName} required /></label>
              <label className="field"><span>Last name</span><input name="lastName" defaultValue={d.lastName ?? ''} /></label>
              <label className="field full"><span>Email</span><input name="email" type="email" defaultValue={d.email} required /></label>
              <label className="field"><span>Phone</span><input name="phone" defaultValue={d.phone ?? ''} /></label>
              <label className="field"><span>Job title</span><input name="jobTitle" defaultValue={d.jobTitle ?? ''} /></label>
              <label className="field"><span>Country</span><input name="country" defaultValue={d.country ?? ''} /></label>
              <label className="field"><span>Company</span>
                <select name="companyId" defaultValue={d.companyId ?? ''}><option value="">—</option>{companies.data?.items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <div className="full"><button className="btn" disabled={busy}>Save</button></div>
            </form>
          </div>
          <div className="card">
            <div className="card-head"><h2>Inquiries</h2></div>
            <table className="table"><tbody>
              {d.inquiries.map((i) => <tr key={i.id}><td><Link href={`/admin/inquiries/${i.id}/`} className="mono">{i.referenceNo}</Link></td><td>{humanize(i.formType)}</td><td><Badge value={i.status} /></td><td className="small muted">{fmtDate(i.createdAt)}</td></tr>)}
            </tbody></table>
          </div>
        </div>
        <div className="card pad">
          <h3>Consent history</h3>
          {d.consents.map((x) => (
            <div key={x.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
              <span>{humanize(x.consentType)} <Badge value={x.granted ? 'granted' : 'withdrawn'} tone={x.granted ? 'ok' : 'bad'} /></span>
              <span className="muted">{fmtDate(x.createdAt, true)}{x.policyVersion && ` · v${x.policyVersion}`}</span>
            </div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn small secondary" disabled={busy} onClick={() => consent('marketing', true)}>Record marketing opt-in</button>
            <button className="btn small danger" disabled={busy} onClick={() => consent('marketing', false)}>Record marketing opt-out</button>
          </div>
          <button className="btn small ghost" style={{ marginTop: 10 }} onClick={async () => {
            const r = await run(() => get<{ url: string }>(`/contacts/${id}/consents/unsubscribe-link`));
            if (r) setUnsub(r.url);
          }}>Get one-click unsubscribe link</button>
          {unsub && <input className="input mono small" style={{ marginTop: 8 }} readOnly value={unsub} onFocus={(e) => e.target.select()} />}
        </div>
      </div>
    </>
  );
}
