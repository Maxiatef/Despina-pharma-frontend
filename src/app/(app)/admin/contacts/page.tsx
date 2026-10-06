'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { post, qs } from '@/lib/api';
import type { Company, Contact, Paged } from '@/lib/types';
import { Empty, ErrorBox, Loading, Modal, PageHead, Pager, fmtDate, formValues, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

function Contacts() {
  const router = useRouter();
  const { values, set } = useQueryState();
  const [q, setQ] = useState(values.q ?? '');
  const [open, setOpen] = useState(false);
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<Contact>>(`/contacts${qs({ q: values.q, page, pageSize: 25 })}`);
  const companies = useApi<Paged<Company>>(open ? '/companies?pageSize=200' : null);
  const { busy, run } = useAction();

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const c = await run(() => post<Contact>('/contacts', formValues(e.currentTarget)), 'Contact created');
    if (c) router.push(`/admin/contacts/${c.id}/`);
  }

  return (
    <>
      <PageHead eyebrow="Customers" title="Contacts" sub="Everyone who contacted Despina. A contact does not need a login."><button className="btn" onClick={() => setOpen(true)}>New contact</button></PageHead>
      <div className="card">
        <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
          <input className="input grow" type="search" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn secondary">Search</button>
        </form>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Added</th></tr></thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => router.push(`/admin/contacts/${c.id}/`)}>
                    <td><Link href={`/admin/contacts/${c.id}/`} onClick={(e) => e.stopPropagation()}>{[c.firstName, c.lastName].filter(Boolean).join(' ')}</Link></td>
                    <td className="small">{c.email}</td><td className="small">{c.phone ?? '—'}</td><td>{c.company?.name ?? '—'}</td>
                    <td className="small muted">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <Empty>No contacts found.</Empty>}
            <Pager page={page} pageSize={25} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
      <Modal open={open} title="New contact" onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={create}>
          <label className="field"><span>First name</span><input name="firstName" required /></label>
          <label className="field"><span>Last name</span><input name="lastName" /></label>
          <label className="field full"><span>Email</span><input name="email" type="email" required /></label>
          <label className="field"><span>Phone</span><input name="phone" /></label>
          <label className="field"><span>Job title</span><input name="jobTitle" /></label>
          <label className="field full"><span>Company</span>
            <select name="companyId"><option value="">—</option>{companies.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div className="full"><button className="btn" disabled={busy}>Create</button></div>
        </form>
      </Modal>
    </>
  );
}

export default function ContactsPage() {
  return <Suspense fallback={<Loading />}><Contacts /></Suspense>;
}
