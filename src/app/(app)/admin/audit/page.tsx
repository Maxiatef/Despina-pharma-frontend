'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { qs } from '@/lib/api';
import type { AuditEvent, AuditFilters, Paged } from '@/lib/types';
import { Badge, Empty, ErrorBox, Kv, Loading, Modal, PageHead, Pager, fmtDate, humanize, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';
import { useAuth } from '@/components/app/auth';

/** Where a record of this type can be opened. */
function recordHref(type: string, id: string | null, a: Pick<AuditEvent, 'projectId' | 'inquiryId' | 'companyId'>): string | null {
  if (type === 'inquiry' && id) return `/admin/inquiries/${id}/`;
  if (type === 'project' && id) return `/admin/projects/${id}/`;
  if (type === 'company' && id) return `/admin/companies/${id}/`;
  if (type === 'contact' && id) return `/admin/contacts/${id}/`;
  if (type === 'user') return '/admin/users/';
  if (type === 'task' && a.inquiryId) return `/admin/inquiries/${a.inquiryId}/`;
  if (a.projectId) return `/admin/projects/${a.projectId}/`;
  if (a.inquiryId) return `/admin/inquiries/${a.inquiryId}/`;
  if (type === 'task') return '/admin/tasks/';
  return null;
}

const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Details({ id, onFilter }: { id: string; onFilter: (f: Record<string, string>) => void }) {
  const d = useApi<AuditEvent>(`/audit-events/${id}`);
  if (!d.data) return d.loading ? <Loading /> : <ErrorBox error={d.error} />;
  const a = d.data;
  const changes = (a.details?.changes ?? []) as { field: string; from: unknown; to: unknown }[];
  const href = recordHref(a.entityType, a.entityId, a);
  return (
    <div className="stack">
      <p>{a.summary}</p>
      <Kv rows={[
        ['When', fmtDate(a.createdAt, true)],
        ['Who', a.actorEmail ? <>{a.actorEmail} <Badge value={a.actorRole} /></> : 'Website visitor (no account)'],
        ['Action', <span key="a" className="mono">{a.action}</span>],
        ['Record', <span key="r">{humanize(a.entityType)}{a.entityLabel ? ` · ${a.entityLabel}` : ''}{href && <> · <Link href={href}>open</Link></>}</span>],
        ['Record id', a.entityId && <span key="i" className="mono small">{a.entityId}</span>],
        ['Request', <span key="q" className="mono small">{a.method} {a.path} → {a.statusCode}</span>],
        ['IP / browser', <span key="b" className="small">{a.ip ?? '—'} · {a.userAgent ?? '—'}</span>],
      ]} />
      <div className="row">
        {a.actorId && <button className="btn small secondary" onClick={() => onFilter({ actorId: a.actorId! })}>Everything by this user</button>}
        {a.entityId && <button className="btn small secondary" onClick={() => onFilter({ entityType: a.entityType, entityId: a.entityId! })}>History of this record</button>}
        {a.projectId && <button className="btn small secondary" onClick={() => onFilter({ projectId: a.projectId! })}>Whole project</button>}
        {a.inquiryId && <button className="btn small secondary" onClick={() => onFilter({ inquiryId: a.inquiryId! })}>Whole lead</button>}
      </div>
      {changes.length > 0 && (
        <div>
          <span className="eyebrow">What changed</span>
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.field}>
                  <td className="mono small">{c.field}</td>
                  <td className="small" style={{ color: 'var(--bad, #b42318)', wordBreak: 'break-word' }}>{show(c.from)}</td>
                  <td className="small" style={{ color: 'var(--ok, #067647)', wordBreak: 'break-word' }}>{show(c.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details>
        <summary className="small">What was sent (request input, secrets hidden)</summary>
        <pre className="pre small mono">{JSON.stringify(a.details?.input ?? null, null, 2)}</pre>
      </details>
      {a.details?.events != null && (
        <details>
          <summary className="small">Extra details recorded by the system</summary>
          <pre className="pre small mono">{JSON.stringify(a.details.events, null, 2)}</pre>
        </details>
      )}
      <details>
        <summary className="small">Full record before / after</summary>
        <div className="grid cols-2">
          <div><span className="eyebrow">Before</span><pre className="pre small mono">{JSON.stringify(a.before, null, 2)}</pre></div>
          <div><span className="eyebrow">After</span><pre className="pre small mono">{JSON.stringify(a.after, null, 2)}</pre></div>
        </div>
      </details>
    </div>
  );
}

const FILTER_KEYS = ['q', 'actorId', 'visitors', 'action', 'entityType', 'entityId', 'projectId', 'inquiryId', 'companyId', 'from', 'to'] as const;

function Audit() {
  const { me } = useAuth();
  // Admins only (the API refuses everyone else too); other staff get a message and nothing is loaded.
  const isAdmin = me?.role === 'admin';
  const { values, set } = useQueryState();
  const [q, setQ] = useState(values.q ?? '');
  const page = Number(values.page ?? 1);
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, values[k]]).filter(([, v]) => v)) as Record<string, string>;
  // Dates from the pickers are whole days: "to" includes the whole day.
  const query = { ...filters, to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined, from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined };
  const list = useApi<Paged<AuditEvent>>(isAdmin ? `/audit-events${qs({ ...query, page, pageSize: 50 })}` : null);
  const opts = useApi<AuditFilters>(isAdmin ? '/audit-events/filters' : null);
  const [open, setOpen] = useState<string | null>(null);
  const clear = () => { setQ(''); set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined]))); };
  const who = values.visitors === 'true' ? '_visitors' : values.actorId ?? '';
  const scoped = filters.entityId || filters.projectId || filters.inquiryId || filters.companyId;
  if (!me) return <Loading />;
  if (!isAdmin) {
    return (
      <>
        <PageHead eyebrow="Settings" title="Audit log" />
        <div className="card pad"><p>Only administrators can see the audit log.</p></div>
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Settings" title="Audit log" sub="Every change in the system: who did what, to which record, and what it was before and after. Sign-in and sign-out are not included.">
        <a className="btn secondary" href={`/api/audit-events/export.csv${qs(query)}`}>Export CSV</a>
      </PageHead>
      <div className="card">
        <form className="toolbar" style={{ padding: '14px 16px 0', flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); set({ q: q || undefined }); }}>
          <input className="input grow" type="search" placeholder="Search: person, record, reference, words in the summary…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select className="input" value={who} aria-label="Who"
            onChange={(e) => set(e.target.value === '_visitors' ? { visitors: 'true', actorId: undefined } : { actorId: e.target.value || undefined, visitors: undefined })}>
            <option value="">Everyone</option>
            <option value="_visitors">Website visitors (no account)</option>
            {opts.data?.actors.map((u) => <option key={u.id} value={u.id}>{u.email} ({u.count})</option>)}
          </select>
          <select className="input" value={values.action ?? ''} onChange={(e) => set({ action: e.target.value || undefined })} aria-label="Action">
            <option value="">All actions</option>
            {opts.data?.actions.map((x) => <option key={x} value={x}>{x}{opts.data?.actionCounts[x] ? ` (${opts.data.actionCounts[x]})` : ''}</option>)}
          </select>
          <select className="input" value={values.entityType ?? ''} onChange={(e) => set({ entityType: e.target.value || undefined, entityId: undefined })} aria-label="Record type">
            <option value="">All record types</option>
            {opts.data?.entityTypes.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
          <label className="small row">From <input className="input" type="date" value={values.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} /></label>
          <label className="small row">To <input className="input" type="date" value={values.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} /></label>
          <button className="btn secondary">Search</button>
          {Object.keys(filters).length > 0 && <button type="button" className="btn ghost" onClick={clear}>Clear filters</button>}
        </form>
        {scoped && (
          <p className="small" style={{ padding: '8px 16px 0' }}>
            Showing the history of one {filters.entityId ? humanize(filters.entityType ?? 'record') : filters.projectId ? 'project' : filters.inquiryId ? 'lead' : 'company'}.{' '}
            <button className="btn small ghost" onClick={() => set({ entityId: undefined, projectId: undefined, inquiryId: undefined, companyId: undefined })}>Show all</button>
          </p>
        )}
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>When</th><th>Who</th><th>What happened</th><th>Record</th><th /></tr></thead>
                <tbody>
                  {list.data.items.map((a) => {
                    const href = recordHref(a.entityType, a.entityId, a);
                    return (
                      <tr key={a.id}>
                        <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.createdAt, true)}</td>
                        <td className="small">{a.actorEmail ?? <span className="muted">Website visitor</span>}{a.actorRole && <div><Badge value={a.actorRole} /></div>}</td>
                        <td className="small">{a.summary ?? a.action}<div className="mono muted">{a.action}</div></td>
                        <td className="small">{humanize(a.entityType)}{a.entityLabel && <div>{href ? <Link href={href}>{a.entityLabel}</Link> : a.entityLabel}</div>}</td>
                        <td><button className="btn small ghost" onClick={() => setOpen(a.id)}>Details</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!list.data.items.length && <Empty>No actions match these filters.</Empty>}
            <Pager page={page} pageSize={50} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
      <Modal open={!!open} title="Audit entry" onClose={() => setOpen(null)}>
        {open && <Details id={open} onFilter={(f) => { setOpen(null); set(Object.fromEntries([...FILTER_KEYS.map((k) => [k, undefined]), ...Object.entries(f)])); }} />}
      </Modal>
    </>
  );
}

export default function AuditPage() {
  return <Suspense fallback={<Loading />}><Audit /></Suspense>;
}
