'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { del, post, qs } from '@/lib/api';
import type { Paged, Task } from '@/lib/types';
import { Badge, Empty, ErrorBox, Loading, PageHead, Pager, fmtDate, useAction, useApi } from '@/components/app/ui';
import { TaskAssignee } from '@/components/app/panels';
import { useQueryState } from '@/components/app/useQueryState';

function Tasks() {
  const { values, set } = useQueryState();
  const state = values.state ?? 'open';
  // Everyone by default: new website inquiries create unassigned follow-up tasks.
  const assignee = values.assignee ?? 'all';
  const page = Number(values.page ?? 1);
  const tasks = useApi<Paged<Task>>(`/tasks${qs({ state, assignee: assignee === 'all' ? undefined : assignee, q: values.q, page, pageSize: 50 })}`);
  const staff = useApi<{ id: string; email: string }[]>('/users/staff');
  const { busy, run } = useAction();

  return (
    <>
      <PageHead eyebrow="Leads" title="Tasks" sub="Follow-ups on leads and projects. Overdue tasks are emailed every morning.">
        <button className="btn secondary" disabled={busy} onClick={() => run(() => post<{ sent: number }>('/tasks/send-overdue-digest'), 'Overdue reminders queued')}>Send overdue reminders now</button>
      </PageHead>
      <div className="card">
        <div className="toolbar" style={{ padding: '14px 16px 0' }}>
          <div className="tabs" style={{ margin: 0, border: 0 }}>
            {(['open', 'overdue', 'done', 'all'] as const).map((s) => (
              <button key={s} className={state === s ? 'active' : ''} onClick={() => set({ state: s })}>{s[0].toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
          <select className="input" value={assignee} onChange={(e) => set({ assignee: e.target.value })} aria-label="Assignee">
            <option value="all">Everyone</option>
            <option value="me">My tasks</option>
            <option value="unassigned">Unassigned</option>
            {staff.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <form className="row" onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get('q') ?? '') || undefined }); }}>
            <input className="input" name="q" defaultValue={values.q ?? ''} placeholder="Search tasks…" aria-label="Search tasks" />
          </form>
        </div>
        <ErrorBox error={tasks.error} onRetry={tasks.reload} />
        {tasks.loading && !tasks.data ? <Loading /> : tasks.data && (
          <>
            <table className="table">
              <thead><tr><th /><th>Task</th><th>For</th><th>Assigned</th><th>Priority</th><th>Due</th><th /></tr></thead>
              <tbody>
                {tasks.data.items.map((t) => {
                  const overdue = !t.completedAt && t.dueAt && new Date(t.dueAt) < new Date();
                  return (
                    <tr key={t.id}>
                      <td><input type="checkbox" aria-label="Done" checked={!!t.completedAt} disabled={busy}
                        onChange={async () => { if (await run(() => post(`/tasks/${t.id}/${t.completedAt ? 'reopen' : 'complete'}`))) tasks.reload(); }} /></td>
                      <td style={{ textDecoration: t.completedAt ? 'line-through' : undefined }}>{t.title}</td>
                      <td className="small">
                        {t.inquiryId && <Link href={`/admin/inquiries/${t.inquiryId}/`} className="mono">{t.inquiryRef ?? 'Lead'}</Link>}
                        {t.projectId && <Link href={`/admin/projects/${t.projectId}/`} className="mono">{t.projectCode ?? 'Project'}</Link>}
                        <div className="muted">{[t.contactName, t.companyName].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="small">
                        <TaskAssignee task={t} staff={staff.data} onChanged={tasks.reload} disabled={!!t.completedAt} />
                        {!t.assigneeId && !t.completedAt && <div style={{ marginTop: 4 }}><Badge value="unassigned" tone="warn" /></div>}
                      </td>
                      <td><Badge value={t.priority} /></td>
                      <td className="small">{overdue ? <span className="badge bad">{fmtDate(t.dueAt, true)}</span> : fmtDate(t.dueAt, true)}</td>
                      <td><button className="btn small ghost" disabled={busy} onClick={async () => { if (confirm('Delete this task?') && await run(() => del(`/tasks/${t.id}`), 'Task deleted')) tasks.reload(); }}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!tasks.data.items.length && <Empty>No tasks here.</Empty>}
            <Pager page={page} pageSize={50} total={tasks.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
    </>
  );
}

export default function TasksPage() {
  return <Suspense fallback={<Loading />}><Tasks /></Suspense>;
}
