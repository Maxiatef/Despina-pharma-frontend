'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { patch } from '@/lib/api';
import { ErrorBox, Loading, PageHead, useAction, useApi } from '@/components/app/ui';
import { useAuth } from '@/components/app/auth';

/** Admin → Settings → Lead rules: who gets new leads, follow-up priority, business hours (plan §6 "configurable"). */
interface RulesResponse {
  values: Record<string, string | null>;
  effective: Record<string, { assigneeEmail: string; priority: string }> & { followUpHours: number; timeZone: string };
  fallback: { business_hours: string; business_days: string; timezone: string; follow_up_hours: string };
}

const FORMS: [code: string, label: string][] = [
  ['contact', 'Contact form'], ['new_product', 'Product brief'], ['service', 'Service inquiry'], ['new_customer', 'Company profile'],
  ['sample_request', 'Sample request'], ['sample_feedback', 'Sample feedback'],
];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export default function RulesPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const r = useApi<RulesResponse>(isAdmin ? '/admin/settings/rules' : null);
  const staff = useApi<{ id: string; email: string }[]>(isAdmin ? '/users/staff' : null);
  const { busy, run } = useAction();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const values = useMemo(() => ({ ...(r.data?.values ?? {}), ...edits }), [r.data, edits]);
  const val = (k: string) => values[k] ?? '';
  const set = (k: string, v: string) => setEdits((e) => ({ ...e, [k]: v }));

  if (!isAdmin) return <ErrorBox error="Only admins can change the lead rules." />;
  if (!r.data) return r.loading ? <Loading /> : <ErrorBox error={r.error} onRetry={r.reload} />;
  const fb = r.data.fallback;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => patch('/admin/settings/rules', { values: edits }), 'Rules saved')) { setEdits({}); r.reload(); }
  };
  const staffSelect = (key: string, emptyLabel: string) => (
    <select value={val(key)} onChange={(e) => set(key, e.target.value)}>
      <option value="">{emptyLabel}</option>
      {staff.data?.map((u) => <option key={u.id} value={u.email}>{u.email}</option>)}
      {val(key) && !staff.data?.some((u) => u.email === val(key)) && <option value={val(key)}>{val(key)}</option>}
    </select>
  );

  return (
    <>
      <PageHead eyebrow="Settings" title="Lead rules" sub="Who gets each new website request, how urgent its follow-up task is, and your business hours." />
      <form className="stack" onSubmit={save}>
        <div className="card pad stack">
          <h3>Assignment and priority</h3>
          <p className="small muted">A new request is assigned to the person chosen here, with a follow-up task. “No one” leaves it unassigned in the dashboard for anyone to pick up.</p>
          <div className="form-grid">
            <label className="field full"><span>Default (all forms without their own rule)</span>{staffSelect('rules.assign.default', 'No one – leave unassigned')}</label>
            {FORMS.map(([code, label]) => (
              <div key={code} className="field full">
                <span>{label}</span>
                <div className="row">
                  <span style={{ flex: 2 }}>{staffSelect(`rules.assign.${code}`, 'Use the default')}</span>
                  <select style={{ flex: 1 }} aria-label={`${label} follow-up priority`} value={val(`rules.priority.${code}`)} onChange={(e) => set(`rules.priority.${code}`, e.target.value)}>
                    <option value="">Priority: standard ({r.data!.effective[code]?.priority})</option>
                    {PRIORITIES.map((p) => <option key={p} value={p}>Priority: {p}</option>)}
                  </select>
                </div>
                <small className="hint">Now: {r.data!.effective[code]?.assigneeEmail || 'unassigned'} · {r.data!.effective[code]?.priority} priority</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card pad stack">
          <h3>Business hours and response target</h3>
          <p className="small muted">Follow-up tasks are due after this many business hours. Empty = the server default shown in grey.</p>
          <div className="form-grid">
            <label className="field"><span>Opening hours</span><input placeholder={fb.business_hours} value={val('rules.business_hours')} onChange={(e) => set('rules.business_hours', e.target.value)} />
              <small className="hint">e.g. 09:00-17:00</small></label>
            <label className="field"><span>Working days</span><input placeholder={fb.business_days} value={val('rules.business_days')} onChange={(e) => set('rules.business_days', e.target.value)} />
              <small className="hint">1 = Monday … 7 = Sunday, e.g. 1-5 or 7,1-4</small></label>
            <label className="field"><span>Time zone</span><input placeholder={fb.timezone} value={val('rules.timezone')} onChange={(e) => set('rules.timezone', e.target.value)} />
              <small className="hint">e.g. Africa/Cairo</small></label>
            <label className="field"><span>Response target (business hours)</span><input inputMode="decimal" placeholder={fb.follow_up_hours} value={val('rules.follow_up_hours')} onChange={(e) => set('rules.follow_up_hours', e.target.value)} />
              <small className="hint">8 = one business day. Now: {r.data.effective.followUpHours} h, {r.data.effective.timeZone}</small></label>
          </div>
        </div>
        <div className="row">
          <button className="btn" disabled={busy || !Object.keys(edits).length}>Save rules</button>
          {Object.keys(edits).length > 0 && <button type="button" className="btn ghost" onClick={() => setEdits({})}>Discard changes</button>}
        </div>
      </form>
    </>
  );
}
