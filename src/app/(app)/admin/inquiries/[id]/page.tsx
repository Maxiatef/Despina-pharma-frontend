'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { del, patch, post } from '@/lib/api';
import { INQUIRY_STATUSES } from '@/lib/types';
import type { InquiryDetail, ProjectDetail, StageTemplate } from '@/lib/types';
import { Badge, ErrorBox, Kv, Loading, Modal, PageHead, fmtDate, humanize, useAction, useApi } from '@/components/app/ui';
import { DocumentsPanel, MessagesPanel, TasksPanel, Timeline } from '@/components/app/panels';
import { useAuth } from '@/components/app/auth';

export default function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { me } = useAuth();
  const inq = useApi<InquiryDetail>(`/inquiries/${id}`);
  const staff = useApi<{ id: string; email: string }[]>('/users/staff');
  const templates = useApi<StageTemplate[]>('/stage-templates');
  const { busy, run } = useAction();
  const [note, setNote] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [templateId, setTemplateId] = useState('');

  if (inq.loading && !inq.data) return <Loading />;
  if (inq.error || !inq.data) return <ErrorBox error={inq.error ?? 'Not found'} onRetry={inq.reload} />;
  const d = inq.data;
  const people = Object.fromEntries((staff.data ?? []).map((u) => [u.id, u.email]));
  const current = d.assignments.find((a) => !a.unassignedAt);
  const fields = d.payload?.fields ?? {};
  const labels = d.payload?.labels ?? {};
  const canConvert = me?.role === 'admin' || me?.role === 'sales';

  async function setStatus(status: string) {
    if (await run(() => patch(`/inquiries/${id}/status`, { status, note: statusNote || undefined }), 'Status updated')) {
      setStatusNote('');
      inq.reload();
    }
  }

  async function convert() {
    const p = await run(() => post<ProjectDetail>(`/inquiries/${id}/convert`, { name: projectName || undefined, stageTemplateId: templateId || undefined }), 'Project created');
    if (p) router.push(`/admin/projects/${p.id}/`);
  }

  return (
    <>
      <p className="small"><Link href="/admin/inquiries/">← Inquiries</Link></p>
      <PageHead
        eyebrow={humanize(d.formType)}
        title={<span className="row">{d.referenceNo} <Badge value={d.status} /></span>}
        sub={<>Received {fmtDate(d.createdAt, true)}{d.sourcePage && <> from <a href={d.sourcePage} target="_blank" rel="noreferrer">{d.sourcePage.split('?')[0]}</a></>}</>}
      >
        {d.project ? (
          <Link className="btn accent" href={`/admin/projects/${d.project.id}/`}>Project {d.project.code}</Link>
        ) : canConvert && (
          <button className="btn accent" onClick={() => { setProjectName(''); setConvertOpen(true); }}>Convert to project</button>
        )}
      </PageHead>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Request</h2></div>
            <div className="card-body stack">
              {d.message && <p className="pre">{d.message}</p>}
              {!!d.items.length && (
                <div>
                  <span className="eyebrow">Products & services</span>
                  {d.items.map((it) => (
                    <div key={it.id} className="row" style={{ marginTop: 6 }}>
                      {it.catalog_item_name && <a href={`/formulations/${it.category_slug}/${it.catalog_item_slug}/`} target="_blank" rel="noreferrer">{it.catalog_item_name}</a>}
                      {it.service_title && <Badge value={it.service_title} tone="info" />}
                      {it.quantity && <span className="muted small">qty {it.quantity}</span>}
                      {it.notes && <span className="muted small">{it.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div>
                <span className="eyebrow">Form answers</span>
                <Kv rows={Object.entries(fields).map(([k, v]) => [labels[k] ?? k, <span key={k} className="pre">{Array.isArray(v) ? v.join(', ') : v}</span>])} />
              </div>
            </div>
          </div>
          <DocumentsPanel path={`/inquiries/${id}/documents`} canUpload={false} />
          <MessagesPanel path={`/inquiries/${id}/messages`} title="Reply to the customer" hint={`Emailed to ${d.contact.email}`} />
          <div className="card">
            <div className="card-head"><h2>Activity</h2></div>
            <div className="card-body">
              <Timeline entries={d.timeline} people={people} />
              <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => { e.preventDefault(); if (note.trim() && await run(() => post(`/inquiries/${id}/notes`, { note }), 'Note added')) { setNote(''); inq.reload(); } }}>
                <input className="input grow" style={{ flex: 1 }} placeholder="Add an internal note…" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn secondary" disabled={busy || !note.trim()}>Add note</button>
              </form>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card pad stack">
            <h3>Status</h3>
            <select className="input" value={d.status} disabled={busy} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
            <input className="input" placeholder="Optional note for the status change" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
            <h3 style={{ marginTop: 8 }}>Assigned to</h3>
            <select className="input" value={current?.userId ?? ''} disabled={busy} aria-label="Assigned to"
              onChange={async (e) => {
                const v = e.target.value;
                const ok = v ? await run(() => post(`/inquiries/${id}/assign`, { userId: v }), 'Lead assigned') : await run(() => del(`/inquiries/${id}/assign`), 'Lead unassigned');
                if (ok) inq.reload();
              }}>
              <option value="">Nobody</option>
              {staff.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          </div>
          <div className="card pad">
            <h3>Contact</h3>
            <div style={{ marginTop: 10 }}>
              <Kv rows={[
                ['Name', <Link key="n" href={`/admin/contacts/${d.contact.id}/`}>{[d.contact.firstName, d.contact.lastName].filter(Boolean).join(' ')}</Link>],
                ['Email', <a key="e" href={`mailto:${d.contact.email}`}>{d.contact.email}</a>],
                ['Phone', d.contact.phone],
                ['Company', d.company ? <Link key="c" href={`/admin/companies/${d.company.id}/`}>{d.company.name}</Link> : null],
                ['Website', d.company?.website],
              ]} />
            </div>
            <div className="row small" style={{ marginTop: 12 }}>
              {d.consents.map((c) => <Badge key={c.id} value={`${c.consentType}: ${c.granted ? 'yes' : 'no'}`} tone={c.granted ? 'ok' : ''} />)}
            </div>
          </div>
          <TasksPanel inquiryId={id} />
          <div className="card pad">
            <h3>Emails</h3>
            {d.emails.map((e) => (
              <div key={e.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span>{humanize(e.kind)}<div className="muted">{e.toEmail}</div></span>
                <Badge value={e.status} />
              </div>
            ))}
            {!d.emails.length && <p className="muted small">No emails.</p>}
          </div>
        </div>
      </div>

      <Modal open={convertOpen} title="Convert to project" onClose={() => setConvertOpen(false)}
        footer={<><button className="btn secondary" onClick={() => setConvertOpen(false)}>Cancel</button><button className="btn" disabled={busy} onClick={convert}>Create project</button></>}>
        <div className="stack">
          <p className="small muted">The company, contact, products and files of this lead are copied into a new project. Nothing has to be typed again.</p>
          <label className="field"><span>Project name</span><input placeholder={`${d.company?.name ?? d.contact.firstName} – ${d.referenceNo}`} value={projectName} onChange={(e) => setProjectName(e.target.value)} /></label>
          <label className="field"><span>Stages</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Default template</option>
              {templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
            </select></label>
        </div>
      </Modal>
    </>
  );
}
