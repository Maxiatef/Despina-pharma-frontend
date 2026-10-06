'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { post, qs } from '@/lib/api';
import type { Company, Paged } from '@/lib/types';
import { Empty, ErrorBox, Loading, Modal, PageHead, Pager, fmtDate, formValues, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

function Companies() {
  const router = useRouter();
  const { values, set } = useQueryState();
  const [q, setQ] = useState(values.q ?? '');
  const [open, setOpen] = useState(false);
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<Company>>(`/companies${qs({ q: values.q, page, pageSize: 25 })}`);
  const { busy, run } = useAction();

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const c = await run(() => post<Company>('/companies', formValues(e.currentTarget)), 'Company created');
    if (c) router.push(`/admin/companies/${c.id}/`);
  }

  return (
    <>
      <PageHead eyebrow="Customers" title="Companies"><button className="btn" onClick={() => setOpen(true)}>New company</button></PageHead>
      <div className="card">
        <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
          <input className="input grow" type="search" placeholder="Search name or website…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn secondary">Search</button>
        </form>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <table className="table">
              <thead><tr><th>Name</th><th>Website</th><th>Country</th><th>Industry</th><th>Added</th></tr></thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => router.push(`/admin/companies/${c.id}/`)}>
                    <td><Link href={`/admin/companies/${c.id}/`} onClick={(e) => e.stopPropagation()}>{c.name}</Link></td>
                    <td className="small">{c.website ?? '—'}</td><td>{c.country ?? '—'}</td><td>{c.industry ?? '—'}</td>
                    <td className="small muted">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <Empty>No companies found.</Empty>}
            <Pager page={page} pageSize={25} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
      <Modal open={open} title="New company" onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={create}>
          <label className="field full"><span>Name</span><input name="name" required maxLength={200} /></label>
          <label className="field"><span>Website</span><input name="website" placeholder="example.com" /></label>
          <label className="field"><span>Country</span><input name="country" /></label>
          <label className="field full"><span>Industry</span><input name="industry" /></label>
          <label className="field full"><span>Notes</span><textarea name="notes" /></label>
          <div className="full"><button className="btn" disabled={busy}>Create</button></div>
        </form>
      </Modal>
    </>
  );
}

export default function CompaniesPage() {
  return <Suspense fallback={<Loading />}><Companies /></Suspense>;
}
