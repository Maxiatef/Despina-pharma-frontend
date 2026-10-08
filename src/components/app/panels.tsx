'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { post, patch, qs, uploadFile } from '@/lib/api';
import { TASK_PRIORITIES } from '@/lib/types';
import type { Doc, Message, Task, TimelineEntry } from '@/lib/types';
import { useAuth, isStaff } from './auth';
import { Badge, Empty, ErrorBox, Loading, fmtBytes, fmtDate, humanize, useAction, useApi } from './ui';

// ===================================================================== documents
export function DocumentsPanel({ path, projectId, canUpload = true }: { path: string; projectId?: string; canUpload?: boolean }) {
  const { me } = useAuth();
  const staff = isStaff(me?.role);
  const docs = useApi<Doc[]>(path);
  const { busy, run } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [visibility, setVisibility] = useState<'internal' | 'customer'>('customer');

  async function download(versionId: string) {
    const r = await run(() => post<{ url: string }>(`/document-versions/${versionId}/download-link`));
    if (r) window.location.href = r.url;
  }

  async function upload(file: File, documentId?: string) {
    const ok = await run(() => uploadFile(file, { projectId: documentId ? undefined : projectId, documentId, visibility: staff ? visibility : undefined }), 'File uploaded');
    if (ok) docs.reload();
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Documents</h2>
        {canUpload && projectId && (
          <div className="row">
            {staff && (
              <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as 'internal' | 'customer')} aria-label="Visibility">
                <option value="customer">Visible to customer</option>
                <option value="internal">Internal only</option>
              </select>
            )}
            <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            <button className="btn small" disabled={busy} onClick={() => fileRef.current?.click()}>Upload file</button>
          </div>
        )}
      </div>
      <ErrorBox error={docs.error} onRetry={docs.reload} />
      {docs.loading && !docs.data ? <Loading /> : (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {docs.data?.map((d) => {
                const v = d.latestVersion;
                return (
                  <tr key={d.id}>
                    <td>
                      <b style={{ fontWeight: 500 }}>{d.title}</b>
                      <div className="muted small">{v ? `${v.originalFilename} · ${fmtBytes(v.sizeBytes)} · v${v.versionNo}` : 'Upload not finished'}</div>
                    </td>
                    <td>{staff && <Badge value={d.visibility} />}</td>
                    <td>{v && <Badge value={v.scanStatus} />}</td>
                    <td className="muted small">{fmtDate(d.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {v?.scanStatus === 'clean' && <button className="btn small secondary" disabled={busy} onClick={() => download(v.id)}>Download</button>}
                        {!staff && projectId && v?.scanStatus === 'clean' && (
                          <button className="btn small accent" disabled={busy} onClick={async () => {
                            const text = window.prompt(`To approve “${d.title}” version ${v.versionNo}, type your confirmation:`, `I approve ${d.title} version ${v.versionNo}`);
                            if (text && text.trim().length >= 5) await run(() => post(`/projects/${projectId}/approvals`, { targetType: 'document_version', targetId: v.id, confirmationText: text.trim() }), 'Document approved');
                          }}>Approve</button>
                        )}
                        {staff && v?.scanStatus === 'pending' && (
                          <>
                            <button className="btn small" disabled={busy} onClick={async () => { if (await run(() => post(`/document-versions/${v.id}/scan`, { scanStatus: 'clean' }), 'File released')) docs.reload(); }}>Release</button>
                            <button className="btn small danger" disabled={busy} onClick={async () => { if (await run(() => post(`/document-versions/${v.id}/scan`, { scanStatus: 'infected' }), 'File quarantined')) docs.reload(); }}>Quarantine</button>
                          </>
                        )}
                        {staff && (
                          <button className="btn small ghost" disabled={busy} onClick={async () => {
                            const next = d.visibility === 'internal' ? 'customer' : 'internal';
                            if (await run(() => patch(`/documents/${d.id}`, { visibility: next }), `Now ${next === 'internal' ? 'internal only' : 'visible to customer'}`)) docs.reload();
                          }}>{d.visibility === 'internal' ? 'Share' : 'Hide'}</button>
                        )}
                        {canUpload && projectId && (
                          <label className="btn small ghost" style={{ cursor: 'pointer' }}>
                            New version
                            <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, d.id); e.target.value = ''; }} />
                          </label>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!docs.data?.length && <Empty>No documents yet.</Empty>}
          {staff && <p className="small muted" style={{ padding: '0 20px 14px' }}>No virus scanner is connected yet: check new files and release them before customers can download.</p>}
        </div>
      )}
    </div>
  );
}

// ===================================================================== messages
export function MessagesPanel({ path, title = 'Messages', hint }: { path: string; title?: string; hint?: string }) {
  const { me } = useAuth();
  const messages = useApi<Message[]>(path);
  const { busy, run } = useAction();
  const [body, setBody] = useState('');

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    if (await run(() => post(path, { body }), 'Message sent')) {
      setBody('');
      messages.reload();
    }
  }

  return (
    <div className="card">
      <div className="card-head"><h2>{title}</h2></div>
      <div className="card-body">
        <ErrorBox error={messages.error} onRetry={messages.reload} />
        <div className="thread">
          {messages.data?.map((m) => (
            <div key={m.id} className={`msg ${m.senderId === me?.id ? 'mine' : ''}`}>
              {m.body}
              <div className="meta">{m.viaEmail ? 'By email · ' : ''}{fmtDate(m.createdAt, true)}</div>
            </div>
          ))}
          {messages.data && !messages.data.length && <p className="muted small">No messages yet.</p>}
        </div>
        <form onSubmit={send} style={{ marginTop: 12 }} className="stack">
          <textarea className="input" rows={3} placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="row between">
            <span className="small muted">{hint}</span>
            <button className="btn" disabled={busy || !body.trim()}>Send</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================================================== tasks
/** Who owns a task: pick a staff member, or "Unassigned". Saves immediately. */
export function TaskAssignee({ task, staff, onChanged, disabled }: {
  task: Task; staff: { id: string; email: string }[] | undefined; onChanged: () => void; disabled?: boolean;
}) {
  const { busy, run } = useAction();
  return (
    <select className="input" style={{ minWidth: 0, maxWidth: 220, padding: '4px 8px', fontSize: '.84rem' }} aria-label={`Assigned to – ${task.title}`}
      value={task.assigneeId ?? ''} disabled={busy || disabled}
      onChange={async (e) => {
        const userId = e.target.value || null;
        const who = staff?.find((u) => u.id === userId)?.email;
        if (await run(() => post(`/tasks/${task.id}/assign`, { userId }), who ? `Task assigned to ${who}` : 'Task unassigned')) onChanged();
      }}>
      <option value="">Unassigned</option>
      {staff?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
    </select>
  );
}

export function TasksPanel({ inquiryId, projectId }: { inquiryId?: string; projectId?: string }) {
  const tasks = useApi<{ items: Task[] }>(`/tasks${qs({ inquiryId, projectId, state: 'all', pageSize: 100 })}`);
  const staff = useApi<{ id: string; email: string }[]>('/users/staff');
  const { busy, run } = useAction();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assigneeId, setAssigneeId] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => post('/tasks', {
      title, inquiryId, projectId, priority, assigneeId: assigneeId || undefined, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
    }), 'Task added');
    if (ok) {
      setTitle('');
      setDueAt('');
      tasks.reload();
    }
  }

  return (
    <div className="card">
      <div className="card-head"><h2>Follow-up tasks</h2></div>
      <div className="card-body">
        {tasks.data?.items.map((t) => {
          const overdue = !t.completedAt && t.dueAt && new Date(t.dueAt) < new Date();
          return (
            <div key={t.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
              <label className="check" style={{ textDecoration: t.completedAt ? 'line-through' : undefined, flex: 1 }}>
                <input type="checkbox" checked={!!t.completedAt} disabled={busy}
                  onChange={async () => { if (await run(() => post(`/tasks/${t.id}/${t.completedAt ? 'reopen' : 'complete'}`))) tasks.reload(); }} />
                <span>{t.title}<div className="small muted">{t.dueAt ? `due ${fmtDate(t.dueAt, true)}` : 'no due date'}</div></span>
              </label>
              <TaskAssignee task={t} staff={staff.data} onChanged={tasks.reload} />
              <div className="row">{overdue && <Badge value="overdue" tone="bad" />}<Badge value={t.priority} /></div>
            </div>
          );
        })}
        {tasks.data && !tasks.data.items.length && <p className="muted small">No tasks yet.</p>}
        <form onSubmit={add} className="form-grid" style={{ marginTop: 14 }}>
          <label className="field full"><span>New task</span><input required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call to confirm quantities" /></label>
          <label className="field"><span>Due</span><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label>
          <label className="field"><span>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}</select></label>
          <label className="field full"><span>Assign to</span>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Me</option>
              {staff.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select></label>
          <div className="full"><button className="btn" disabled={busy}>Add task</button></div>
        </form>
      </div>
    </div>
  );
}

// ===================================================================== timeline
export function Timeline({ entries, people }: { entries: TimelineEntry[]; people?: Record<string, string> }) {
  const who = (id?: string | null) => (id ? people?.[id] ?? 'Team member' : 'Website');
  const text = (e: TimelineEntry) => {
    switch (e.type) {
      case 'status':
        return e.to ? <>{who(e.actorId)} changed status {e.from ? <><Badge value={e.from} /> → </> : ''}<Badge value={e.to} />{e.note && <> — {e.note}</>}</> : <>{who(e.actorId)}: {e.note}</>;
      case 'message': return <>{e.viaEmail ? 'Email reply' : `${who(e.actorId)} wrote`}: <span className="muted">{e.body?.slice(0, 160)}</span></>;
      case 'email': return <>Email <b style={{ fontWeight: 500 }}>{humanize(e.kind ?? '')}</b> to {e.to} <Badge value={e.status} />{e.error && <span className="muted small"> {e.error}</span>}</>;
      case 'document': return <>File added: {e.title}</>;
      case 'assignment': return <>Assigned to {who(e.userId)}{e.endedAt && <span className="muted"> (until {fmtDate(e.endedAt)})</span>}</>;
      case 'task': return <>Task “{e.title}”{e.completedAt ? ' — done' : e.dueAt ? ` — due ${fmtDate(e.dueAt)}` : ''}</>;
    }
  };
  return (
    <ul className="timeline">
      {entries.map((e, i) => (
        <li key={i}><div className="when">{fmtDate(e.at, true)}</div>{text(e)}</li>
      ))}
      {!entries.length && <li className="muted">Nothing yet.</li>}
    </ul>
  );
}
