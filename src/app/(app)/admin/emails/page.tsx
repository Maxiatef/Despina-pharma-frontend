'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { post, qs } from '@/lib/api';
import { EMAIL_JOB_STATUSES } from '@/lib/types';
import type { EmailEventRow, EmailJob, Paged } from '@/lib/types';
import { Badge, Empty, ErrorBox, Kv, Loading, Modal, PageHead, Pager, fmtDate, humanize, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';
import { useAuth } from '@/components/app/auth';

const KINDS = ['owner_notice', 'staff_notice', 'customer_ack', 'customer_notice', 'message_notice', 'quote_notice', 'invite', 'password_reset', 'test'];

/** The e-mail exactly as it was sent, plus what Resend reported about its delivery. */
function Preview({ id }: { id: string }) {
  const job = useApi<EmailJob & { events: EmailEventRow[] }>(`/email-jobs/${id}`);
  const [mode, setMode] = useState<'html' | 'text'>('html');
  if (!job.data) return job.loading ? <Loading /> : <ErrorBox error={job.error} />;
  const j = job.data;
  return (
    <div className="stack">
      <Kv rows={[
        ['To', j.toEmail], ['Subject', j.subject], ['Status', <Badge key="s" value={j.status} />], ['Template', j.template ? humanize(j.template) : humanize(j.kind)],
        ['Sent', j.sentAt ? fmtDate(j.sentAt, true) : '—'], ['Problem', j.lastError], ['Resend id', j.providerMessageId && <span key="p" className="mono small">{j.providerMessageId}</span>],
      ]} />
      <div>
        <span className="eyebrow">Delivery events</span>
        {j.events.length ? (
          <ul className="timeline" style={{ marginTop: 6 }}>{j.events.map((e) => <li key={e.id}><div className="when">{fmtDate(e.occurredAt, true)}</div><Badge value={e.event} /></li>)}</ul>
        ) : <p className="small muted">No delivery events yet – Resend reports them through the webhook (delivered, bounced, spam …).</p>}
      </div>
      <div className="tabs" style={{ margin: 0 }}>
        <button type="button" className={mode === 'html' ? 'active' : ''} onClick={() => setMode('html')}>E-mail</button>
        <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Plain text</button>
      </div>
      {mode === 'html' && j.bodyHtml
        ? <iframe title="E-mail" sandbox="" srcDoc={j.bodyHtml} style={{ width: '100%', height: '60vh', border: '1px solid var(--line-2)', borderRadius: 8, background: '#fff' }} />
        : <pre className="pre small" style={{ maxHeight: '60vh', overflow: 'auto' }}>{j.bodyText ?? '(no text)'}</pre>}
    </div>
  );
}

function Emails() {
  const { me } = useAuth();
  const { values, set } = useQueryState();
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<EmailJob>>(`/email-jobs${qs({ status: values.status, kind: values.kind, q: values.q, page, pageSize: 50 })}`);
  const { busy, run } = useAction();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHead eyebrow="Settings" title="Email log" sub="Every e-mail the system sent or tried to send, exactly as the recipient sees it.">
        {me?.role === 'admin' && <Link className="btn secondary" href="/admin/settings/emails/">E-mail settings</Link>}
      </PageHead>
      <div className="card">
        <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get('q') ?? '') || undefined }); }}>
          <input className="input grow" name="q" type="search" defaultValue={values.q ?? ''} placeholder="Search recipient or subject…" aria-label="Search" />
          <select className="input" value={values.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })} aria-label="Status">
            <option value="">All statuses</option>{EMAIL_JOB_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
          <select className="input" value={values.kind ?? ''} onChange={(e) => set({ kind: e.target.value || undefined })} aria-label="Kind">
            <option value="">All kinds</option>{KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}
          </select>
        </form>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Sent / created</th><th>To</th><th>Subject</th><th>Status</th><th>Related</th><th /></tr></thead>
                <tbody>
                  {list.data.items.map((j) => (
                    <tr key={j.id}>
                      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(j.sentAt ?? j.createdAt, true)}</td>
                      <td className="small">{j.toEmail}<div className="muted">{humanize(j.template ?? j.kind)}</div></td>
                      <td className="small">{j.subject}</td>
                      <td>
                        <Badge value={j.status} />{j.lastEvent && j.lastEvent !== 'sent' && <> <Badge value={j.lastEvent} /></>}
                        {j.lastError && <div className="small muted" style={{ maxWidth: 280 }}>{j.lastError}</div>}
                      </td>
                      <td className="small">
                        {j.inquiryId && <Link href={`/admin/inquiries/${j.inquiryId}/`}>Lead</Link>}
                        {j.projectId && <Link href={`/admin/projects/${j.projectId}/`}>Project</Link>}
                      </td>
                      <td><div className="row">
                        <button className="btn small ghost" onClick={() => setOpen(j.id)}>View</button>
                        {j.status === 'failed' && <button className="btn small secondary" disabled={busy} onClick={async () => { if (await run(() => post(`/email-jobs/${j.id}/retry`), 'Sent again')) list.reload(); }}>Retry</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!list.data.items.length && <Empty>No e-mails.</Empty>}
            <Pager page={page} pageSize={50} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
      <Modal open={!!open} title="E-mail" onClose={() => setOpen(null)}>{open && <Preview id={open} />}</Modal>
    </>
  );
}

export default function EmailsPage() {
  return <Suspense fallback={<Loading />}><Emails /></Suspense>;
}
