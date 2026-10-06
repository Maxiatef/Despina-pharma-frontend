'use client';

import Link from 'next/link';
import { Badge, ErrorBox, Loading, PageHead, fmtDate, humanize, useApi } from '@/components/app/ui';
import { useAuth } from '@/components/app/auth';

interface Overview {
  leads: { new: number; last_7_days: number; last_30_days: number; won: number; lost: number; unassigned: number };
  myWork: { open_tasks: number; overdue_tasks: number; my_open_leads: number };
  projectsByStatus: Record<string, number>;
  emailsLast30Days: Record<string, number>;
  leadsByFormLast30Days: { form_type: string; count: number }[];
  recentLeads: { id: string; reference_no: string; form_type: string; status: string; created_at: string; first_name: string; last_name: string | null; company: string | null }[];
}

function Stat({ label, value, href }: { label: string; value: number | undefined; href?: string }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="value">{value ?? '—'}</div>
    </>
  );
  return <div className="card stat">{href ? <Link href={href}>{body}</Link> : body}</div>;
}

export default function DashboardPage() {
  const { me } = useAuth();
  const o = useApi<Overview>('/dashboard/overview');
  const weeks = useApi<{ week: string; count: number }[]>('/dashboard/leads-per-week?weeks=12');
  const max = Math.max(1, ...(weeks.data ?? []).map((w) => w.count));

  return (
    <>
      <PageHead eyebrow="Dashboard" title={`Hello${me ? `, ${me.email.split('@')[0]}` : ''}.`} sub="Leads, your tasks and projects at a glance." />
      <ErrorBox error={o.error} onRetry={o.reload} />
      {o.loading && !o.data ? <Loading /> : o.data && (
        <>
          <div className="grid cols-4">
            <Stat label="New leads" value={o.data.leads.new} href="/admin/inquiries/?status=new" />
            <Stat label="Unassigned" value={o.data.leads.unassigned} href="/admin/inquiries/?unassigned=true" />
            <Stat label="My open leads" value={o.data.myWork.my_open_leads} href={`/admin/inquiries/?assigneeId=${me?.id}`} />
            <Stat label="My overdue tasks" value={o.data.myWork.overdue_tasks} href="/admin/tasks/?state=overdue&assignee=me" />
          </div>
          <div className="grid cols-4" style={{ marginTop: 16 }}>
            <Stat label="Leads · 7 days" value={o.data.leads.last_7_days} />
            <Stat label="Leads · 30 days" value={o.data.leads.last_30_days} />
            <Stat label="Won" value={o.data.leads.won} href="/admin/inquiries/?status=won" />
            <Stat label="Active projects" value={o.data.projectsByStatus.active ?? 0} href="/admin/projects/?status=active" />
          </div>

          <div className="split" style={{ marginTop: 20 }}>
            <div className="card">
              <div className="card-head"><h2>Latest leads</h2><Link href="/admin/inquiries/">All inquiries</Link></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Reference</th><th>From</th><th>Form</th><th>Status</th><th>Received</th></tr></thead>
                  <tbody>
                    {o.data.recentLeads.map((l) => (
                      <tr key={l.id}>
                        <td><Link href={`/admin/inquiries/${l.id}/`} className="mono">{l.reference_no}</Link></td>
                        <td>{[l.first_name, l.last_name].filter(Boolean).join(' ')}<div className="muted small">{l.company}</div></td>
                        <td>{humanize(l.form_type)}</td>
                        <td><Badge value={l.status} /></td>
                        <td className="muted">{fmtDate(l.created_at, true)}</td>
                      </tr>
                    ))}
                    {!o.data.recentLeads.length && <tr><td colSpan={5} className="empty">No inquiries yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="stack">
              <div className="card pad">
                <h3>Leads per week</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, marginTop: 14 }} aria-label="Leads per week, last 12 weeks">
                  {(weeks.data ?? []).map((w) => (
                    <div key={w.week} title={`Week of ${w.week}: ${w.count}`} style={{ flex: 1, background: 'var(--cyan)', borderRadius: 3, height: `${(w.count / max) * 100}%`, minHeight: 2 }} />
                  ))}
                </div>
                <div className="row between small muted" style={{ marginTop: 6 }}>
                  <span>{weeks.data?.[0]?.week}</span><span>this week</span>
                </div>
              </div>
              <div className="card pad">
                <h3>Leads by form · 30 days</h3>
                <div style={{ marginTop: 10 }}>
                  {o.data.leadsByFormLast30Days.map((f) => (
                    <div key={f.form_type} className="row between small" style={{ padding: '4px 0' }}>
                      <span>{humanize(f.form_type)}</span><b>{f.count}</b>
                    </div>
                  ))}
                  {!o.data.leadsByFormLast30Days.length && <p className="muted small">No leads in the last 30 days.</p>}
                </div>
              </div>
              <div className="card pad">
                <h3>Emails · 30 days</h3>
                <div className="row" style={{ marginTop: 10 }}>
                  {Object.entries(o.data.emailsLast30Days).map(([k, v]) => <Badge key={k} value={`${k}: ${v}`} tone={k === 'failed' ? 'bad' : k === 'sent' ? 'ok' : 'warn'} />)}
                  {!Object.keys(o.data.emailsLast30Days).length && <span className="muted small">None</span>}
                </div>
                <p className="small muted" style={{ marginTop: 8 }}>Email sending is not connected yet (Resend). Emails wait in the queue.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
