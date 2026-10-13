'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { api, post } from '@/lib/api';
import type { EmailSettingsResponse } from '@/lib/types';
import { Badge, ErrorBox, Loading, Modal, PageHead, useAction, useApi } from '@/components/app/ui';
import { useAuth } from '@/components/app/auth';

const K = {
  senderName: 'email.sender_name',
  senderEmail: 'email.sender_email',
  replyTo: 'email.reply_to',
  enabled: 'email.enabled',
  notifyEnabled: (k: string) => `notify.${k}.enabled`,
  notifyTo: (k: string) => `notify.${k}.to`,
  customerEnabled: (k: string) => `customer.${k}.enabled`,
};

/** On/off switch in the dashboard's style (a checkbox underneath, so it works with the keyboard). */
function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="row" style={{ gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: 'var(--cyan, #0ec4df)' }} />
      <span className="small">{checked ? 'On' : 'Off'}</span>
    </label>
  );
}

const PREVIEWS: [template: string, label: string][] = [
  ['owner_notice', 'New website request (staff)'], ['customer_ack', 'Form confirmation (customer)'], ['quote_ready', 'Quote ready'],
  ['quote_response_staff', 'Quote answered (staff)'], ['quote_response_ack', 'Quote answer confirmation'], ['sample_shipped', 'Sample shipped'],
  ['feedback_request', 'Feedback request'], ['document_ready', 'New document'], ['approval_request', 'Approval requested'],
  ['stage_update', 'Stage update'], ['info_request', 'More information needed'], ['message_to_customer', 'Team message (customer)'],
  ['message_to_staff', 'Customer message (staff)'], ['approval_staff', 'Approval received (staff)'], ['sample_feedback_staff', 'Sample feedback (staff)'],
  ['lead_assigned', 'Lead assigned'], ['task_assigned', 'Task assigned'], ['overdue_digest', 'Overdue reminder'],
  ['failure_alert', 'Delivery problem'], ['invite', 'Invitation'], ['password_reset', 'Password reset'], ['test', 'Test e-mail'],
];

export default function EmailSettingsPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const s = useApi<EmailSettingsResponse>(isAdmin ? '/settings/email' : null);
  const { busy, run } = useAction();
  // Only the fields the admin changed are kept; everything else comes from the server.
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [testToInput, setTestTo] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: string; error: string | null } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const values = useMemo(() => ({ ...(s.data?.values ?? {}), ...edits }), [s.data, edits]);
  const testTo = testToInput ?? s.data?.status.fallbackRecipient ?? me?.email ?? '';
  const on = (key: string) => values[key] !== 'false';
  const setVal = (key: string, value: string | null) => setEdits((v) => ({ ...v, [key]: value }));
  const changed = useMemo(() => {
    if (!s.data) return {};
    return Object.fromEntries(Object.entries(edits).filter(([k, v]) => (s.data!.values[k] ?? null) !== (v ?? null)));
  }, [edits, s.data]);

  if (!me) return <Loading />;
  if (!isAdmin) {
    return (<><PageHead eyebrow="Settings" title="E-mail settings" /><div className="card pad"><p>Only administrators can change the e-mail settings.</p></div></>);
  }
  if (s.loading && !s.data) return <Loading />;
  if (!s.data) return <ErrorBox error={s.error ?? 'Could not load the e-mail settings'} onRetry={s.reload} />;
  const st = s.data.status;

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await run(() => api<EmailSettingsResponse>('/settings/email', { method: 'PATCH', body: { values: changed } }), 'E-mail settings saved');
    if (res) { setEdits({}); s.reload(); }
  }

  async function sendTest() {
    setTestResult(null);
    const res = await run(() => post<{ status: string; error: string | null }>('/settings/email/test', { to: testTo }));
    if (res) setTestResult(res);
  }

  async function openPreview(template: string) {
    const htmlText = await run(() => api<string>(`/settings/email/preview/${template}`));
    if (typeof htmlText === 'string') setPreview(htmlText);
  }

  return (
    <form onSubmit={save}>
      <PageHead eyebrow="Settings" title="E-mail settings" sub="Who gets which e-mail, the sender, and which e-mails customers receive. Only administrators can see this page.">
        <button className="btn" disabled={busy || !Object.keys(changed).length}>{Object.keys(changed).length ? `Save ${Object.keys(changed).length} change${Object.keys(changed).length > 1 ? 's' : ''}` : 'Saved'}</button>
      </PageHead>

      {/* ---------------- status */}
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row between"><h3>Connection</h3><Link className="small" href="/admin/emails/">Open the e-mail log →</Link></div>
        <div className="grid cols-4" style={{ marginTop: 12 }}>
          <div><div className="small muted">Provider</div>{st.provider === 'resend' ? <Badge value="Resend connected" tone="ok" /> : <Badge value="Not sending (EMAIL_PROVIDER=none)" tone="warn" />}</div>
          <div><div className="small muted">API key</div>{st.resendKeySet ? <Badge value="set" tone="ok" /> : <Badge value="missing" tone="bad" />}</div>
          <div><div className="small muted">Delivery webhook</div>{st.webhookSecretSet ? <Badge value="secret set" tone="ok" /> : <Badge value="not set up" tone="warn" />}</div>
          <div><div className="small muted">Last 30 days</div><span className="small">{st.counts.sent} sent · {st.counts.failed} failed · {st.counts.waiting} waiting · {st.counts.skipped} skipped</span></div>
        </div>
        {st.onboardingSender && (
          <div className="alert warn" style={{ marginTop: 14 }}>
            The sender is <b>onboarding@resend.dev</b> (Resend’s test sender). It only delivers to the Resend account owner’s own address – other recipients get an error.
            To e-mail customers, verify your domain in Resend (DNS records SPF + DKIM) and set a sender on it, e.g. <span className="mono">hello@despinapharma.com</span>.
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>Webhook URL for Resend → Webhooks: <span className="mono">{st.webhookUrl}</span></p>
      </div>

      {/* ---------------- sender + master switch */}
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div><h3>Sending</h3><p className="small muted">Switch off to stop every notification and customer e-mail at once (invitations and password resets are still sent).</p></div>
          <Switch label="E-mail sending" checked={on(K.enabled)} onChange={(v) => setVal(K.enabled, String(v))} />
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="field"><span>Sender name</span><input value={values[K.senderName] ?? ''} placeholder={st.sender.name} onChange={(e) => setVal(K.senderName, e.target.value)} /></label>
          <label className="field"><span>Sender e-mail</span><input type="email" value={values[K.senderEmail] ?? ''} placeholder={st.sender.email} onChange={(e) => setVal(K.senderEmail, e.target.value)} /></label>
          <label className="field full"><span>Reply-to (where customer replies go)</span><input type="email" value={values[K.replyTo] ?? ''} placeholder={st.sender.replyTo || 'e.g. hello@despinapharma.com'} onChange={(e) => setVal(K.replyTo, e.target.value)} /></label>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>Now sending as <span className="mono">{st.sender.from}</span>. The sender’s domain must be verified in your Resend account.</p>
      </div>

      {/* ---------------- staff notifications */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Team notifications</h2></div>
        <div className="card-body stack">
          {s.data.staffNotifications.map((n) => (
            <div key={n.key} style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: 12 }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div><b style={{ fontWeight: 500 }}>{n.label}</b><div className="small muted">{n.description}</div></div>
                <Switch label={n.label} checked={on(K.notifyEnabled(n.key))} onChange={(v) => setVal(K.notifyEnabled(n.key), String(v))} />
              </div>
              {n.recipients !== 'person' && on(K.notifyEnabled(n.key)) && (
                <label className="field" style={{ marginTop: 8 }}>
                  <span className="small">Send to (comma-separated)</span>
                  <input value={values[K.notifyTo(n.key)] ?? ''} placeholder={st.fallbackRecipient ? `${st.fallbackRecipient} (default from .env)` : 'e.g. sales@despinapharma.com'}
                    onChange={(e) => setVal(K.notifyTo(n.key), e.target.value)} />
                </label>
              )}
              {n.recipients === 'person' && <p className="small muted" style={{ marginTop: 4 }}>Goes to the staff member concerned.</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- customer e-mails */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>E-mails to customers</h2></div>
        <div className="card-body stack">
          {s.data.customerEmails.map((c) => (
            <div key={c.key} className="row between" style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: 10, alignItems: 'flex-start' }}>
              <div><b style={{ fontWeight: 500 }}>{c.label}</b><div className="small muted">{c.description}</div></div>
              <Switch label={c.label} checked={on(K.customerEnabled(c.key))} onChange={(v) => setVal(K.customerEnabled(c.key), String(v))} />
            </div>
          ))}
          {s.data.accountEmails.map((c) => (
            <div key={c.key} className="row between" style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: 10 }}>
              <div><b style={{ fontWeight: 500 }}>{c.label}</b><div className="small muted">{c.description}</div></div>
              <Badge value="always sent" tone="info" />
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- test + previews */}
      <div className="split">
        <div className="card pad">
          <h3>Send a test e-mail</h3>
          <p className="small muted" style={{ marginTop: 4 }}>Sent immediately with the saved settings.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" style={{ flex: 1 }} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Test recipient" />
            <button type="button" className="btn secondary" disabled={busy || !testTo} onClick={sendTest}>Send test</button>
          </div>
          {testResult && (
            <p className="small" style={{ marginTop: 10 }}>
              {testResult.status === 'sent' ? <Badge value="Sent – check the inbox" tone="ok" /> : <><Badge value={testResult.status} tone="bad" /> {testResult.error}</>}
            </p>
          )}
        </div>
        <div className="card pad">
          <h3>What the e-mails look like</h3>
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
            {PREVIEWS.map(([t, label]) => <button type="button" key={t} className="btn small ghost" onClick={() => openPreview(t)}>{label}</button>)}
          </div>
        </div>
      </div>

      <Modal open={!!preview} title="E-mail preview (sample data)" onClose={() => setPreview(null)}>
        {preview && <iframe title="E-mail preview" sandbox="" srcDoc={preview} style={{ width: '100%', height: '70vh', border: '1px solid var(--line-2)', borderRadius: 8, background: '#fff' }} />}
      </Modal>
    </form>
  );
}
