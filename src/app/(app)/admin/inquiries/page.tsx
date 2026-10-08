'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { qs } from '@/lib/api';
import { FORM_TYPES, INQUIRY_STATUSES, INQUIRY_TYPES } from '@/lib/types';
import type { InquiryRow, Paged } from '@/lib/types';
import { Badge, Empty, ErrorBox, Loading, PageHead, Pager, fmtDate, humanize, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';
import { useAuth } from '@/components/app/auth';

type BoardData = Record<string, { total: number; items: InquiryRow[] }>;

function Inquiries() {
  const router = useRouter();
  const { me } = useAuth();
  const { values, all, set } = useQueryState();
  const view = values.view === 'board' ? 'board' : 'table';

  const filters = {
    q: values.q, status: all('status'), formType: values.formType, inquiryType: values.inquiryType, assigneeId: values.assigneeId,
    unassigned: values.unassigned, overdue: values.overdue, from: values.from, to: values.to, sort: values.sort,
  };
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<InquiryRow>>(view === 'table' ? `/inquiries${qs({ ...filters, page, pageSize: 25 })}` : null);
  const board = useApi<BoardData>(view === 'board' ? `/inquiries/board${qs({ ...filters, status: undefined })}` : null);
  const staff = useApi<{ id: string; email: string }[]>('/users/staff');
  const canExport = me?.role === 'admin' || me?.role === 'sales';

  return (
    <>
      <PageHead eyebrow="Leads" title="Inquiries" sub="Every submission from the website forms.">
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          <button className={view === 'table' ? 'active' : ''} onClick={() => set({ view: undefined })}>Table</button>
          <button className={view === 'board' ? 'active' : ''} onClick={() => set({ view: 'board' })}>Board</button>
        </div>
        {canExport && (
          <a className="btn secondary" href={`/api/inquiries/export.csv${qs(filters)}`}>Export CSV</a>
        )}
      </PageHead>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <form className="toolbar" style={{ margin: 0 }} onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get('q') ?? '') }); }}>
          <input key={values.q ?? ''} name="q" className="input grow" type="search" placeholder="Search reference, name, email, company or message…" defaultValue={values.q ?? ''} />
          {view === 'table' && (
            <select className="input" value={all('status')[0] ?? ''} onChange={(e) => set({ status: e.target.value || undefined })} aria-label="Status">
              <option value="">All statuses</option>
              {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          )}
          <select className="input" value={values.formType ?? ''} onChange={(e) => set({ formType: e.target.value })} aria-label="Form">
            <option value="">All forms</option>
            {FORM_TYPES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
          <select className="input" value={values.inquiryType ?? ''} onChange={(e) => set({ inquiryType: e.target.value })} aria-label="Inquiry type">
            <option value="">All inquiry types</option>
            {Object.entries(INQUIRY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" value={values.assigneeId ?? (values.unassigned === 'true' ? '_none' : '')} aria-label="Assignee"
            onChange={(e) => e.target.value === '_none' ? set({ assigneeId: undefined, unassigned: 'true' }) : set({ assigneeId: e.target.value, unassigned: undefined })}>
            <option value="">Anyone</option>
            <option value="_none">Unassigned</option>
            {staff.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={values.overdue === 'true'} onChange={(e) => set({ overdue: e.target.checked ? 'true' : undefined })} /> Overdue follow-up</label>
          <input className="input" type="date" aria-label="From" value={values.from ?? ''} onChange={(e) => set({ from: e.target.value })} />
          <input className="input" type="date" aria-label="To" value={values.to ?? ''} onChange={(e) => set({ to: e.target.value ? `${e.target.value}T23:59:59` : undefined })} />
          <select className="input" value={values.sort ?? 'newest'} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
          </select>
          <button className="btn">Search</button>
        </form>
      </div>

      {view === 'table' ? (
        <div className="card">
          <ErrorBox error={list.error} onRetry={list.reload} />
          {list.loading && !list.data ? <Loading /> : list.data && (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Reference</th><th>From</th><th>Company</th><th>Form</th><th>Status</th><th>Assigned</th><th>Next follow-up</th><th>Received</th></tr></thead>
                  <tbody>
                    {list.data.items.map((i) => (
                      <tr key={i.id} className="clickable" onClick={() => router.push(`/admin/inquiries/${i.id}/`)}>
                        <td><Link href={`/admin/inquiries/${i.id}/`} className="mono" onClick={(e) => e.stopPropagation()}>{i.referenceNo}</Link></td>
                        <td>{[i.contact.firstName, i.contact.lastName].filter(Boolean).join(' ')}<div className="muted small">{i.contact.email}</div></td>
                        <td>{i.companyName ?? '—'}</td>
                        <td>{humanize(i.formType)}{i.inquiryType && <div className="muted small">{INQUIRY_TYPES[i.inquiryType] ?? i.inquiryType}</div>}</td>
                        <td><Badge value={i.status} /></td>
                        <td className="small">{i.assignee?.email ?? <span className="muted">—</span>}</td>
                        <td className="small">{i.nextDueAt ? <span className={new Date(i.nextDueAt) < new Date() ? 'badge bad' : ''}>{fmtDate(i.nextDueAt)}</span> : '—'}</td>
                        <td className="muted small">{fmtDate(i.createdAt, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!list.data.items.length && <Empty>No inquiries match these filters.</Empty>}
              </div>
              <Pager page={page} pageSize={25} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
            </>
          )}
        </div>
      ) : (
        <>
          <ErrorBox error={board.error} onRetry={board.reload} />
          {board.loading && !board.data ? <Loading /> : board.data && (
            <div className="board">
              {INQUIRY_STATUSES.map((s) => (
                <div key={s} className="board-col">
                  <h3><span>{humanize(s)}</span><span>{board.data![s]?.total ?? 0}</span></h3>
                  {board.data![s]?.items.map((i) => (
                    <Link key={i.id} href={`/admin/inquiries/${i.id}/`} className="board-card">
                      <div className="row between"><span className="mono small">{i.referenceNo}</span><span className="muted small">{fmtDate(i.createdAt)}</span></div>
                      <b style={{ fontWeight: 500 }}>{[i.contact.firstName, i.contact.lastName].filter(Boolean).join(' ')}</b>
                      <div className="muted small">{i.companyName ?? i.contact.email}</div>
                      <div className="row small" style={{ marginTop: 6 }}><Badge value={i.formType} />{i.assignee && <span className="muted">{i.assignee.email.split('@')[0]}</span>}</div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function InquiriesPage() {
  return <Suspense fallback={<Loading />}><Inquiries /></Suspense>;
}
