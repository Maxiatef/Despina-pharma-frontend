'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { post, qs } from '@/lib/api';
import { EMAIL_JOB_STATUSES } from '@/lib/types';
import type { EmailJob, Paged } from '@/lib/types';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHead, Pager, fmtDate, humanize, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

function Events({ jobId }: { jobId: string }) {
  const ev = useApi<{ id: string; event: string; occurredAt: string }[]>(`/email-jobs/${jobId}/events`);
  if (!ev.data) return <Loading />;
  return ev.data.length ? (
    <ul className="timeline">{ev.data.map((e) => <li key={e.id}><div className="when">{fmtDate(e.occurredAt, true)}</div><Badge value={e.event} /></li>)}</ul>
  ) : <p className="small muted">No delivery events yet. They arrive from the email provider’s webhook once Resend is connected.</p>;
}

function Emails() {
  const { values, set } = useQueryState();
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<EmailJob>>(`/email-jobs${qs({ status: values.status, page, pageSize: 50 })}`);
  const { busy, run } = useAction();
  const [open, setOpen] = useState<EmailJob | null>(null);
  return (
    <>
      <PageHead eyebrow="Settings" title="Email log" sub="Every email the system wants to send. Sending is not connected yet (Resend), so emails stay queued." />
      <div className="alert info" style={{ marginBottom: 16 }}>
        Email provider: <b>not connected</b>. Owner notices, customer confirmations, invites and reminders are stored here and will be sent automatically once Resend is set up.
      </div>
      <div className="card">
        <div className="toolbar" style={{ padding: '14px 16px 0' }}>
          <select className="input" value={values.status ?? ''} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>{EMAIL_JOB_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </div>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <table className="table">
              <thead><tr><th>Kind</th><th>To</th><th>Subject</th><th>Status</th><th>Related</th><th>Created</th><th /></tr></thead>
              <tbody>
                {list.data.items.map((j) => (
                  <tr key={j.id}>
                    <td>{humanize(j.kind)}</td><td className="small">{j.toEmail}</td><td className="small">{j.subject}</td>
                    <td><Badge value={j.status} />{j.lastError && <div className="small muted">{j.lastError}</div>}</td>
                    <td className="small">
                      {j.inquiryId && <Link href={`/admin/inquiries/${j.inquiryId}/`}>Lead</Link>}
                      {j.projectId && <Link href={`/admin/projects/${j.projectId}/`}>Project</Link>}
                    </td>
                    <td className="small muted">{fmtDate(j.createdAt, true)}</td>
                    <td><div className="row">
                      <button className="btn small ghost" onClick={() => setOpen(j)}>Events</button>
                      {j.status === 'failed' && <button className="btn small secondary" disabled={busy} onClick={async () => { if (await run(() => post(`/email-jobs/${j.id}/retry`), 'Retry queued')) list.reload(); }}>Retry</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <Empty>No emails.</Empty>}
            <Pager page={page} pageSize={50} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
      <Modal open={!!open} title={open?.subject ?? ''} onClose={() => setOpen(null)}>{open && <Events jobId={open.id} />}</Modal>
    </>
  );
}

export default function EmailsPage() {
  return <Suspense fallback={<Loading />}><Emails /></Suspense>;
}
