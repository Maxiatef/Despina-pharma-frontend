'use client';

import { Suspense, useState } from 'react';
import { qs } from '@/lib/api';
import { AUDIT_ENTITIES } from '@/lib/types';
import type { AuditEvent, Paged } from '@/lib/types';
import { Empty, ErrorBox, Loading, Modal, PageHead, Pager, fmtDate, humanize, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

function Audit() {
  const { values, set } = useQueryState();
  const [q, setQ] = useState(values.q ?? '');
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<AuditEvent>>(`/audit-events${qs({ q: values.q, entityType: values.entityType, entityId: values.entityId, page, pageSize: 50 })}`);
  const users = useApi<Paged<{ id: string; email: string }>>('/users?pageSize=200');
  const [open, setOpen] = useState<AuditEvent | null>(null);
  const who = (id: string | null) => (id ? users.data?.items.find((u) => u.id === id)?.email ?? id.slice(0, 8) : 'System / website');
  return (
    <>
      <PageHead eyebrow="Settings" title="Audit log" sub="Who changed what, and when." />
      <div className="card">
        <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
          <input className="input grow" type="search" placeholder="Action, e.g. inquiry.status" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={values.entityType ?? ''} onChange={(e) => set({ entityType: e.target.value })} aria-label="Type">
            <option value="">Everything</option>{AUDIT_ENTITIES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
          <button className="btn secondary">Search</button>
        </form>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>IP</th><th /></tr></thead>
              <tbody>
                {list.data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="small">{fmtDate(a.createdAt, true)}</td><td className="small">{who(a.actorId)}</td>
                    <td className="mono small">{a.action}</td>
                    <td className="small">{humanize(a.entityType)} <span className="mono muted">{a.entityId?.slice(0, 8)}</span></td>
                    <td className="small muted">{a.ip ?? ''}</td>
                    <td>{(a.before != null || a.after != null) && <button className="btn small ghost" onClick={() => setOpen(a)}>Details</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <Empty>No events.</Empty>}
            <Pager page={page} pageSize={50} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
      <Modal open={!!open} title={open?.action ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <div className="grid cols-2">
            <div><span className="eyebrow">Before</span><pre className="pre small mono">{JSON.stringify(open.before, null, 2)}</pre></div>
            <div><span className="eyebrow">After</span><pre className="pre small mono">{JSON.stringify(open.after, null, 2)}</pre></div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function AuditPage() {
  return <Suspense fallback={<Loading />}><Audit /></Suspense>;
}
