'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { patch, post } from '@/lib/api';
import { Badge, Empty, ErrorBox, Loading, PageHead, fmtDate, useAction, useApi, Tip } from '@/components/app/ui';
import { useAuth } from '@/components/app/auth';

/**
 * Waiting list (plan §08 "a dashboard of items waiting on customers and items waiting on Despina") with the
 * automatic customer reminders: when the next one goes out, pause / resume, send one now, and the schedule.
 */
interface CustomerRow {
  key: string; type: 'quote' | 'sample' | 'inquiry'; title: string; ref: string; company: string | null;
  projectId: string | null; inquiryId: string | null; since: string; sentCount: number; lastSentAt: string | null;
  pausedAt: string | null; nextAt: string | null; recipients: number; optedOut: number;
}
interface UsRow {
  type: string; title: string; ref: string; company: string | null; projectId: string | null; inquiryId: string | null; since: string; owner: string | null;
}
interface Settings {
  customer: { enabled: boolean; firstDays: number; repeatDays: number; max: number };
  staff: { enabled: boolean; replyHours: number; dueSoonDays: number };
  values: Record<string, string | null>;
  defaults: Record<string, string>;
}
interface Overview { settings: Settings; waitingOnCustomer: CustomerRow[]; waitingOnUs: UsRow[] }

const TYPE_LABEL: Record<string, string> = {
  quote: 'Quote', sample: 'Sample', inquiry: 'Lead', unanswered_message: 'Message', quote_changes: 'Quote', sample_feedback: 'Sample',
  promised_soon: 'Promised date', promised_passed: 'Promised date', target_passed: 'Target date',
};
const URGENT = new Set(['promised_passed', 'unanswered_message']);
const linkFor = (r: { projectId: string | null; inquiryId: string | null }) =>
  r.projectId ? `/admin/projects/${r.projectId}/` : r.inquiryId ? `/admin/inquiries/${r.inquiryId}/` : '#';
const daysSince = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

function NextReminder({ r, s }: { r: CustomerRow; s: Settings }) {
  if (!s.customer.enabled) return <span className="muted">Reminders are off</span>;
  if (r.pausedAt) return <Badge value="paused" tone="warn" />;
  if (!r.recipients) return <span className="muted">No customer login to remind</span>;
  if (r.optedOut === r.recipients) return <span className="muted">Customer turned reminders off</span>;
  if (r.sentCount >= s.customer.max) return <span className="muted">All {s.customer.max} sent</span>;
  if (!r.nextAt) return <>—</>;
  // Due already: it goes out with the next daily run (each morning).
  return new Date(r.nextAt) <= new Date() ? <span>Due – next morning run</span> : <>{fmtDate(r.nextAt)}</>;
}

function ReminderSettings({ s, onSaved }: { s: Settings; onSaved: () => void }) {
  const { busy, run } = useAction();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const values = useMemo(() => ({ ...s.values, ...edits }), [s.values, edits]);
  const val = (k: string) => values[k] ?? '';
  const set = (k: string, v: string) => setEdits((e) => ({ ...e, [k]: v }));
  const onOff = (k: string, label: string) => (
    <label className="field"><span>{label}</span>
      <select value={val(k)} onChange={(e) => set(k, e.target.value)}>
        <option value="">Standard ({s.defaults[k] === 'false' ? 'off' : 'on'})</option>
        <option value="true">On</option>
        <option value="false">Off</option>
      </select></label>
  );
  const num = (k: string, label: string, hint: string) => (
    <label className="field"><span>{label}</span><input inputMode="numeric" placeholder={s.defaults[k]} value={val(k)} onChange={(e) => set(k, e.target.value)} /><small className="hint">{hint}</small></label>
  );
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => patch('/reminders/settings', { values: edits }), 'Reminder settings saved')) { setEdits({}); onSaved(); }
  };
  return (
    <form className="card pad stack" onSubmit={save}>
      <h3>Reminder schedule</h3>
      <p className="small muted">Customer reminders stop by themselves when the customer answers, writes a message, the item changes or the project is not active. Customers can also turn them off with the link in each reminder. Empty = the standard value in grey.</p>
      <div className="form-grid">
        {onOff('reminders.customer.enabled', 'Reminders to customers')}
        {num('reminders.customer.max', 'Most reminders per item', '0–10. Then we stop and leave it to the team.')}
        {num('reminders.customer.first_days', 'First reminder after (days)', 'Days after the quote / sample / question was sent.')}
        {num('reminders.customer.repeat_days', 'Next reminder after (days)', 'Days after the previous reminder.')}
        {onOff('reminders.staff.enabled', 'Daily “waiting on you” list to staff')}
        {num('reminders.staff.reply_hours', 'Customer message unanswered after (hours)', 'Then it shows on the owner’s list.')}
        {num('reminders.staff.due_soon_days', 'Warn before a promised date (days)', 'Promised dates this close show on the list.')}
      </div>
      <div className="row">
        <button className="btn" disabled={busy || !Object.keys(edits).length}>Save schedule</button>
        {Object.keys(edits).length > 0 && <button type="button" className="btn ghost" onClick={() => setEdits({})}>Discard changes</button>}
      </div>
    </form>
  );
}

export default function WaitingPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const o = useApi<Overview>('/reminders');
  const { busy, run } = useAction();
  const [tab, setTab] = useState<'customer' | 'us'>('us');
  if (!o.data) return o.loading ? <Loading /> : <ErrorBox error={o.error} onRetry={o.reload} />;
  const { settings: s, waitingOnCustomer: cust, waitingOnUs: us } = o.data;
  const act = async (path: string, key: string, msg: string) => { if (await run(() => post(path, { key }), msg)) o.reload(); };

  return (
    <>
      <PageHead eyebrow="Leads & projects" title="Waiting list" sub="What waits on the customer, and what waits on us. Customers get friendly reminders automatically; staff get one list each morning."
        help={<>
          <p><b>Waiting on us</b> – things a customer is waiting for: a message not answered for a day, a quote they asked to change, sample feedback to act on, a promised date that is close or passed. The owner gets this list by e-mail each morning.</p>
          <p><b>Waiting on the customer</b> – a quote to answer, a sample to rate, or a question on a lead. The customer gets a friendly reminder e-mail after a few days, and once more later. Reminders stop by themselves when they answer or write a message.</p>
          <ul>
            <li><b>Pause</b> – no reminders for this item (e.g. you spoke on the phone).</li>
            <li><b>Remind now</b> – send one reminder straight away.</li>
            <li>Customers can stop reminders with a link in the e-mail; you can turn them back on from their contact page.</li>
          </ul>
        </>}>
        {isAdmin && <button className="btn secondary" disabled={busy} onClick={async () => {
          const r = await run(() => post<{ customerReminders: number; staffDigests: number }>('/reminders/run'));
          if (r) { alert(`Sent ${r.customerReminders} customer reminder(s) and ${r.staffDigests} staff list(s).`); o.reload(); }
        }}>Run today’s reminders now</button>}
      </PageHead>
      <div className="card">
        <div className="tabs" style={{ padding: '6px 16px 0', margin: 0 }}>
          <button className={tab === 'us' ? 'active' : ''} onClick={() => setTab('us')}>Waiting on us ({us.length})</button>
          <button className={tab === 'customer' ? 'active' : ''} onClick={() => setTab('customer')}>Waiting on the customer ({cust.length})</button>
        </div>
        {tab === 'us' ? (
          us.length ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>What</th><th>Customer</th><th>Since / date</th><th>Owner</th></tr></thead>
              <tbody>
                {us.map((r, i) => (
                  <tr key={`${r.type}-${r.ref}-${i}`}>
                    <td><Badge value={TYPE_LABEL[r.type] ?? r.type} tone={URGENT.has(r.type) ? 'bad' : 'warn'} /> <Link href={linkFor(r)}>{r.title}</Link><div className="small muted mono">{r.ref}</div></td>
                    <td className="small">{r.company ?? '—'}</td>
                    <td className="small">{isDay(r.since) ? fmtDate(`${r.since}T12:00:00`) : <>{fmtDate(r.since)}<div className="muted">{daysSince(r.since)} day(s)</div></>}</td>
                    <td className="small">{r.owner ?? <span className="muted">No owner</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <div className="card-body"><Empty>Nothing waits on us right now.</Empty></div>
        ) : cust.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>What</th><th>Customer</th><th>Waiting since</th><th>Reminders sent</th><th>Next reminder<Tip>Reminders go out with the morning run. “Due” means it goes out next morning.</Tip></th><th /></tr></thead>
            <tbody>
              {cust.map((r) => (
                <tr key={r.key}>
                  <td><Badge value={TYPE_LABEL[r.type]} tone="info" /> <Link href={linkFor(r)}>{r.title}</Link><div className="small muted mono">{r.ref}</div></td>
                  <td className="small">{r.company ?? '—'}</td>
                  <td className="small">{fmtDate(r.since)}<div className="muted">{daysSince(r.since)} day(s)</div></td>
                  <td className="small">{r.sentCount} of {s.customer.max}{r.lastSentAt && <div className="muted">last {fmtDate(r.lastSentAt)}</div>}</td>
                  <td className="small"><NextReminder r={r} s={s} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.pausedAt
                      ? <button className="btn small secondary" disabled={busy} onClick={() => act('/reminders/resume', r.key, 'Reminders back on')}>Resume</button>
                      : <button className="btn small ghost" disabled={busy} onClick={() => act('/reminders/pause', r.key, 'Reminders paused')}>Pause</button>}
                    {!r.pausedAt && r.sentCount < s.customer.max && r.recipients > r.optedOut && (
                      <button className="btn small secondary" style={{ marginLeft: 6 }} disabled={busy} onClick={() => { if (confirm('Send a reminder e-mail to the customer now?')) void act('/reminders/send', r.key, 'Reminder sent'); }}>Remind now</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <div className="card-body"><Empty>Nothing waits on the customer right now.</Empty></div>}
      </div>
      {isAdmin && <div style={{ marginTop: 16 }}><ReminderSettings s={s} onSaved={o.reload} /></div>}
    </>
  );
}
