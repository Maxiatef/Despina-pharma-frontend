'use client';

import { useState } from 'react';
import { patch, post } from '@/lib/api';
import { STAFF_ROLES } from '@/lib/types';
import type { StageTemplate, UserRole } from '@/lib/types';
import { useAuth } from '@/components/app/auth';
import { Badge, ErrorBox, Loading, Modal, PageHead, humanize, useAction, useApi } from '@/components/app/ui';

type Stage = { name: string; requiresRole?: UserRole };

function Editor({ template, onSaved }: { template?: StageTemplate; onSaved: () => void }) {
  const { busy, run } = useAction();
  const [name, setName] = useState(template?.name ?? '');
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [stages, setStages] = useState<Stage[]>(template?.stages ?? [{ name: 'Inquiry' }]);
  const upd = (i: number, s: Stage) => setStages(stages.map((x, j) => (j === i ? s : x)));
  const move = (i: number, d: -1 | 1) => {
    const n = [...stages];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setStages(n);
  };
  async function save() {
    const body = { name, isDefault, stages: stages.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), requiresRole: s.requiresRole || undefined })) };
    if (await run(() => (template ? patch(`/stage-templates/${template.id}`, body) : post('/stage-templates', body)), 'Template saved')) onSaved();
  }
  return (
    <div className="stack">
      <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="check"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default for new projects</label>
      {stages.map((s, i) => (
        <div key={i} className="row">
          <span className="muted small" style={{ width: 22 }}>{i + 1}.</span>
          <input className="input" style={{ flex: 1 }} value={s.name} onChange={(e) => upd(i, { ...s, name: e.target.value })} />
          <select className="input" value={s.requiresRole ?? ''} onChange={(e) => upd(i, { ...s, requiresRole: (e.target.value || undefined) as UserRole | undefined })} aria-label="Who can complete">
            <option value="">Any staff</option>{STAFF_ROLES.map((r) => <option key={r} value={r}>Only {humanize(r)}</option>)}
          </select>
          <button type="button" className="btn small ghost" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button type="button" className="btn small ghost" disabled={i === stages.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button type="button" className="btn small ghost" disabled={stages.length === 1} onClick={() => setStages(stages.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="row between">
        <button type="button" className="btn small secondary" onClick={() => setStages([...stages, { name: '' }])}>Add stage</button>
        <button className="btn" disabled={busy || !name.trim()} onClick={save}>Save template</button>
      </div>
      <p className="small muted">Changes apply to new projects. Existing projects keep their stages.</p>
    </div>
  );
}

export default function StageTemplatesPage() {
  const { me } = useAuth();
  const list = useApi<StageTemplate[]>('/stage-templates');
  const [edit, setEdit] = useState<StageTemplate | 'new' | null>(null);
  const admin = me?.role === 'admin';
  return (
    <>
      <PageHead eyebrow="Settings" title="Project stages" sub="The steps every project goes through. Gated stages (e.g. Quality Release) can only be completed by one role.">
        {admin && <button className="btn" onClick={() => setEdit('new')}>New template</button>}
      </PageHead>
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.loading && !list.data ? <Loading /> : list.data?.map((t) => (
        <div key={t.id} className="card pad">
          <div className="row between">
            <h2 className="row">{t.name} {t.isDefault && <Badge value="default" tone="navy" />}</h2>
            {admin && <button className="btn small secondary" onClick={() => setEdit(t)}>Edit</button>}
          </div>
          <div className="stages" style={{ marginTop: 12 }}>
            {t.stages.map((s, i) => <span key={i} className="stage">{i + 1}. {s.name}{s.requiresRole && ` · ${humanize(s.requiresRole)} only`}</span>)}
          </div>
        </div>
      ))}
      <Modal open={!!edit} title={edit === 'new' ? 'New stage template' : 'Edit stage template'} onClose={() => setEdit(null)}>
        {edit && <Editor key={edit === 'new' ? 'new' : edit.id} template={edit === 'new' ? undefined : edit} onSaved={() => { setEdit(null); list.reload(); }} />}
      </Modal>
    </>
  );
}
