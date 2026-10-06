'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { del, post, qs } from '@/lib/api';
import type { Paged, Task } from '@/lib/types';
import { Badge, Empty, ErrorBox, Loading, PageHead, Pager, fmtDate, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

function Tasks() {
  const { values, set } = useQueryState();
  const state = values.state ?? 'open';
  const assignee = values.assignee ?? 'me';
  const page = Number(values.page ?? 1);
  const tasks = useApi<Paged<Task>>(`/tasks${qs({ state, assignee: assignee === 'all' ? undefined : assignee, q: values.q, page, pageSize: 50 })}`);
  const staff = useApi<{ id: string; email: string }[]>('/users/staff');
  const { busy, run } = useAction();
  const emailOf = (id: string | null) => staff.data?.find((u) => u.id === id)?.email ?? '—';

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
            <option value="me">My tasks</option>
            <option value="all">Everyone</option>
            {staff.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
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
                        {t.inquiryId && <Link href={`/admin/inquiries/${t.inquiryId}/`}>Lead</Link>}
                        {t.projectId && <Link href={`/admin/projects/${t.projectId}/`}>Project</Link>}
                      </td>
                      <td className="small">{emailOf(t.assigneeId)}</td>
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
