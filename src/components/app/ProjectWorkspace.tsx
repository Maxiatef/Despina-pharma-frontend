'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { del, patch, post, qs, uploadFile } from '@/lib/api';
import { PROJECT_STATUSES, SAMPLE_STATUSES } from '@/lib/types';
import type {
  Approval, Brief, CatalogItem, Paged, ProjectDetail, ProjectProduct, QuoteDetail, SampleDetail, StageTemplate, StatusEventLike,
} from './workspace-types';
import type { Feedback, FeedbackDetails, QuoteTerms } from '@/lib/types';
import { isStaff, useAuth } from './auth';
import { DocumentsPanel, MessagesPanel, TasksPanel } from './panels';
import { ScrollToSection } from './ui';
import { Badge, Empty, ErrorBox, Kv, Loading, Modal, PageHead, approvalsChanged, fmtDate, fmtMoney, humanize, useAction, useApi, useApprovalsChanged, Tip } from './ui';

// ===================================================================== stages
function Stages({ project, reload, staff }: { project: ProjectDetail; reload: () => void; staff: boolean }) {
  const { me } = useAuth();
  const { busy, run } = useAction();
  const [note, setNote] = useState('');
  const current = project.stages.find((s) => s.id === project.currentStageId);
  const gated = current?.requiresRole && me?.role !== current.requiresRole && me?.role !== 'admin';
  return (
    <div className="card pad">
      <div className="row between">
        <h3>Stages<Tip>{staff ? 'The steps of this project. Complete the current one to start the next. The customer sees the same steps.' : 'The steps of your project, from inquiry to dispatch. The highlighted one is where your project is now.'}</Tip></h3>
        {current && <span className="small muted">Current: <b style={{ fontWeight: 500 }}>{current.name}</b>{current.startedAt && ` · since ${fmtDate(current.startedAt)}`}</span>}
      </div>
      <div className="stages" style={{ marginTop: 12 }}>
        {project.stages.map((s) => (
          <span key={s.id} className={`stage ${s.completedAt ? 'done' : s.id === project.currentStageId ? 'current' : ''}`} title={s.requiresRole ? `Requires ${s.requiresRole}` : undefined}>
            {s.completedAt ? '✓ ' : ''}{s.name}{s.requiresRole ? ' 🔒' : ''}
          </span>
        ))}
      </div>
      {staff && current && project.status !== 'completed' && (
        <div className="row" style={{ marginTop: 14 }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Note for this stage (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" disabled={busy || !!gated} title={gated ? `Only ${current.requiresRole} staff can complete this stage` : undefined}
            onClick={async () => { if (await run(() => post(`/projects/${project.id}/stages/${current.id}/complete`, { note: note || undefined }), `“${current.name}” completed`)) { setNote(''); reload(); } }}>
            Complete “{current.name}”
          </button>
        </div>
      )}
      {gated && <p className="small muted" style={{ marginTop: 6 }}>This is a quality gate: only {current?.requiresRole} staff (or an admin) can complete it.</p>}
    </div>
  );
}

// ===================================================================== stages per product line
function ProductStages({ product, projectId, staff, reload }: { product: ProjectProduct; projectId: string; staff: boolean; reload: () => void }) {
  const { me } = useAuth();
  const { busy, run } = useAction();
  const templates = useApi<StageTemplate[]>(staff ? '/stage-templates' : null);
  const [templateId, setTemplateId] = useState('');
  const stages = product.stages ?? [];
  const current = stages.find((s) => s.id === product.currentStageId);
  const gated = current?.requiresRole && me?.role !== current.requiresRole && me?.role !== 'admin';
  const started = stages.some((s) => s.completedAt);
  const allDone = stages.length > 0 && stages.every((s) => s.completedAt);
  const setTemplate = async () => {
    if (await run(() => post(`/project-products/${product.id}/stages`, { stageTemplateId: templateId || undefined }), 'Stages set for this product')) reload();
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="row between">
        <span className="eyebrow">Stages for this product</span>
        {product.stageSummary && (
          <span className="small muted">
            {allDone ? 'All stages completed' : <>Current: <b style={{ fontWeight: 500 }}>{current?.name}</b></>} · {product.stageSummary.done} of {product.stageSummary.total} done
          </span>
        )}
      </div>
      {stages.length > 0 ? (
        <div className="stages" style={{ marginTop: 8 }}>
          {stages.map((s) => (
            <span key={s.id} className={`stage ${s.completedAt ? 'done' : s.id === product.currentStageId ? 'current' : ''}`} title={s.requiresRole ? `Requires ${s.requiresRole}` : undefined}>
              {s.completedAt ? '✓ ' : ''}{s.name}{s.requiresRole ? ' 🔒' : ''}
            </span>
          ))}
        </div>
      ) : <p className="small muted" style={{ marginTop: 6 }}>No stages yet for this product.</p>}
      {staff && current && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small" disabled={busy || !!gated} title={gated ? `Only ${current.requiresRole} staff can complete this stage` : undefined}
            onClick={async () => { if (await run(() => post(`/projects/${projectId}/stages/${current.id}/complete`, {}), `“${current.name}” completed for ${product.name}`)) reload(); }}>
            Complete “{current.name}”
          </button>
          {gated && <span className="small muted">Quality gate: only {current.requiresRole} staff or an admin.</span>}
        </div>
      )}
      {staff && !started && (
        <div className="row" style={{ marginTop: 8 }}>
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} aria-label={`Stage template for ${product.name}`}>
            <option value="">Project / default template</option>
            {templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
          </select>
          <button className="btn small secondary" disabled={busy} onClick={setTemplate}>{stages.length ? 'Use these stages' : 'Start stages'}</button>
        </div>
      )}
    </div>
  );
}

// ===================================================================== add product (catalog search)
function AddProduct({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const results = useApi<Paged<CatalogItem>>(open && query ? `/public/catalog/items${qs({ q: query, pageSize: 8 })}` : null);
  const { busy, run } = useAction();
  const add = async (body: Record<string, unknown>) => {
    if (await run(() => post(`/projects/${projectId}/products`, { ...body, targetQuantity: qty ? Number(qty) : undefined }), 'Added to project')) {
      setOpen(false);
      setQ(''); setQuery(''); setName(''); setQty('');
      onAdded();
    }
  };
  return (
    <>
      <button className="btn small" onClick={() => setOpen(true)}>Add product</button>
      <Modal open={open} title="Add a product to this project" onClose={() => setOpen(false)}>
        <div className="stack">
          <p className="small muted">Pick a starting point from the product library, or describe your own product. This is a brief, not an order.</p>
          <label className="field"><span>Target quantity (optional)</span><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></label>
          <form className="row" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
            <input className="input" style={{ flex: 1 }} placeholder="Search the product library…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn secondary">Search</button>
          </form>
          {results.loading && <Loading />}
          {results.data?.items.map((i) => (
            <div key={i.id} className="row between" style={{ borderBottom: '1px solid var(--line-2)', padding: '6px 0' }}>
              <span>{i.name}<div className="small muted">{i.category?.title}{i.subgroup ? ` · ${i.subgroup}` : ''}</div></span>
              <button className="btn small" disabled={busy} onClick={() => add({ catalogItemId: i.id })}>Add</button>
            </div>
          ))}
          {results.data && !results.data.items.length && <p className="small muted">Nothing found.</p>}
          <hr />
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void add({ name }); }}>
            <input className="input" style={{ flex: 1 }} placeholder="…or name your own product" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" disabled={busy || !name.trim()}>Add</button>
          </form>
        </div>
      </Modal>
    </>
  );
}

// ===================================================================== product-line details (plan §7)
const PATHS: [string, string][] = [
  ['custom_formulation', 'Custom formulation'], ['private_label', 'Private label (stock formula)'], ['semi_custom', 'Semi-custom'],
  ['formula_transfer', 'Formula transfer'], ['packaging_only', 'Packaging / filling only'],
];
type DetailField = { key: string; label: string; long?: boolean; hint?: string };
const DETAIL_GROUPS: [string, DetailField[]][] = [
  ['Product', [
    { key: 'category', label: 'Category', hint: 'e.g. Skincare' }, { key: 'format', label: 'Format', hint: 'e.g. Lotion, serum, shampoo' },
    { key: 'path', label: 'Development path' }, { key: 'quantity', label: 'Desired quantity', hint: 'e.g. 5,000 units first run' },
    { key: 'fillSize', label: 'Fill size', hint: 'e.g. 50 ml' },
  ]],
  ['Formula', [
    { key: 'includeIngredients', label: 'Ingredients wanted', long: true }, { key: 'excludeIngredients', label: 'Ingredients to avoid', long: true },
    { key: 'texture', label: 'Texture' }, { key: 'fragrance', label: 'Fragrance' }, { key: 'color', label: 'Colour' }, { key: 'finish', label: 'Finish' },
  ]],
  ['Packaging', [{ key: 'packaging', label: 'Packaging', long: true }, { key: 'artwork', label: 'Artwork / labels', long: true }]],
  ['Market', [
    { key: 'market', label: 'Market / countries' }, { key: 'channels', label: 'Sales channels', hint: 'e.g. Amazon, salons, retail' },
    { key: 'launchDate', label: 'Target launch', hint: 'e.g. Spring 2027' }, { key: 'budget', label: 'Budget (optional)' },
    { key: 'references', label: 'Reference products and links', long: true },
  ]],
];
const ALL_FIELDS = DETAIL_GROUPS.flatMap(([, f]) => f);
const pathLabel = (v?: string) => PATHS.find(([k]) => k === v)?.[1] ?? v;

function ProductDetails({ product, reload }: { product: ProjectProduct; reload: () => void }) {
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [notSure, setNotSure] = useState<string[]>([]);
  const d = product.details ?? {};
  const unsure = d.notSure ?? [];
  const filled = ALL_FIELDS.filter((f) => typeof d[f.key] === 'string' && d[f.key]);
  const edit = () => {
    setForm(Object.fromEntries(ALL_FIELDS.map((f) => [f.key, typeof d[f.key] === 'string' ? (d[f.key] as string) : ''])));
    setNotSure(unsure);
    setOpen(true);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const details: Record<string, unknown> = { notSure };
    for (const f of ALL_FIELDS) if (form[f.key]?.trim() && !notSure.includes(f.key)) details[f.key] = form[f.key].trim();
    if (await run(() => patch(`/project-products/${product.id}`, { details }), 'Product details saved')) { setOpen(false); reload(); }
  };
  const toggle = (key: string) => setNotSure((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="row between">
        <span className="eyebrow">Product details</span>
        <button className="btn small secondary" onClick={edit}>{filled.length || unsure.length ? 'Edit details' : 'Add details'}</button>
      </div>
      {filled.length || unsure.length ? (
        <Kv rows={[
          ...filled.map((f): [string, string] => [f.label, f.key === 'path' ? pathLabel(d.path as string) ?? '' : (d[f.key] as string)]),
          ...(unsure.length ? [['Not sure yet', unsure.map((k) => ALL_FIELDS.find((f) => f.key === k)?.label ?? k).join(', ')] as [string, string]] : []),
        ]} />
      ) : <p className="small muted" style={{ marginTop: 6 }}>No details yet – format, fill size, ingredients, packaging, market and launch help us prepare samples and a quote.</p>}
      <Modal open={open} title={`Details – ${product.name}`} onClose={() => setOpen(false)}>
        <form className="stack" onSubmit={save}>
          <p className="small muted">Fill in what you know. Tick “Not sure yet” for anything still open – we will work it out together. This is a brief, not an order.</p>
          {DETAIL_GROUPS.map(([group, fields]) => (
            <fieldset key={group} className="form-grid" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="eyebrow" style={{ marginBottom: 6 }}>{group}</legend>
              {fields.map((f) => {
                const off = notSure.includes(f.key);
                return (
                  <label key={f.key} className={`field${f.long ? ' full' : ''}`}>
                    <span className="row between">{f.label}
                      <span className="small muted" style={{ fontWeight: 400 }}>
                        <input type="checkbox" checked={off} onChange={() => toggle(f.key)} aria-label={`${f.label}: not sure yet`} /> Not sure yet
                      </span>
                    </span>
                    {f.key === 'path' ? (
                      <select value={form.path ?? ''} disabled={off} onChange={(e) => setForm({ ...form, path: e.target.value })}>
                        <option value="">Choose…</option>
                        {PATHS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    ) : f.long ? (
                      <textarea rows={2} maxLength={2000} disabled={off} placeholder={f.hint} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                    ) : (
                      <input maxLength={f.key === 'launchDate' ? 100 : 200} disabled={off} placeholder={f.hint} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                    )}
                  </label>
                );
              })}
            </fieldset>
          ))}
          <button className="btn" disabled={busy}>Save details</button>
        </form>
      </Modal>
    </div>
  );
}

// ===================================================================== project status (reason for on hold / cancelled)
// ===================================================================== dates
const today = () => new Date().toISOString().slice(0, 10);
/** A YYYY-MM-DD date shown in the reader's format (no time-zone shift). */
const fmtDay = (d: string | null | undefined) => (d ? fmtDate(`${d}T12:00:00`) : '—');

/**
 * Internal target date (staff only) and the date promised to the customer. Customers see only the promised date.
 * A changed promised date is written on the project timeline, with the reason.
 */
function Dates({ path, target, promised, staff, done, reload, compact }: {
  path: string; target?: string | null; promised: string | null; staff: boolean; done: boolean; reload: () => void; compact?: boolean;
}) {
  const { busy, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(target ?? '');
  const [pr, setPr] = useState(promised ?? '');
  const [reason, setReason] = useState('');
  const late = !done && !!promised && promised < today();
  const targetLate = !done && !!target && target < today();
  const conflict = !!target && !!promised && target > promised;
  if (!staff) {
    if (!promised) return compact ? null : <p className="small muted">Expected date: to be confirmed</p>;
    return <p className="small">Expected {compact ? '' : 'date'}: <b>{fmtDay(promised)}</b></p>;
  }
  if (!editing) {
    const edit = <button className="btn small ghost" onClick={() => { setT(target ?? ''); setPr(promised ?? ''); setReason(''); setEditing(true); }}>Edit dates</button>;
    const parts = [
      <span key="t">Target (internal): <b>{fmtDay(target)}</b>{targetLate && <span className="badge warn" style={{ marginLeft: 6 }}>passed</span>}</span>,
      <span key="p">Promised to customer: <b>{fmtDay(promised)}</b>{late && <span className="badge bad" style={{ marginLeft: 6 }}>passed</span>}</span>,
      conflict ? <span key="c" className="badge warn">Target is after the promised date</span> : null,
    ];
    if (compact) return <div className="row small" style={{ gap: 10, flexWrap: 'wrap' }}>{parts}{edit}</div>;
    return (
      <div className="small">
        {parts.filter(Boolean).map((x, i) => <div key={i} style={{ marginBottom: 6 }}>{x}</div>)}
        {edit}
      </div>
    );
  }
  const promisedChanged = (pr || null) !== (promised ?? null);
  return (
    <form className="stack" style={{ marginTop: 6 }} onSubmit={async (e) => {
      e.preventDefault();
      if (await run(() => patch(path, { targetDate: t || null, promisedDate: pr || null, dateReason: reason || undefined }), 'Dates saved')) { setEditing(false); reload(); }
    }}>
      <div className="form-grid">
        <label className="field"><span>Target date (internal)</span><input type="date" value={t} onChange={(e) => setT(e.target.value)} /><small className="hint">Our own goal. Customers never see it.</small></label>
        <label className="field"><span>Promised to the customer</span><input type="date" value={pr} onChange={(e) => setPr(e.target.value)} /><small className="hint">Shown in the customer’s workspace.</small></label>
        {promisedChanged && promised && (
          <label className="field full"><span>Why did the promised date change? (shown on the timeline)</span><input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Packaging supplier delayed the bottles" /></label>
        )}
      </div>
      {!!t && !!pr && t > pr && <div className="alert warn">The internal target is later than the date promised to the customer.</div>}
      <div className="row"><button className="btn small" disabled={busy}>Save dates</button><button type="button" className="btn small ghost" onClick={() => setEditing(false)}>Cancel</button></div>
    </form>
  );
}

function ProjectStatus({ project, reload }: { project: ProjectDetail; reload: () => void }) {
  const { busy, run } = useAction();
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const change = async (status: string, statusReason?: string) => {
    if (await run(() => patch(`/projects/${project.id}`, { status, statusReason }), 'Project updated')) { setPending(null); setReason(''); reload(); }
  };
  return (
    <>
      <select className="input" value={project.status} disabled={busy} aria-label="Project status"
        onChange={(e) => (['on_hold', 'cancelled'].includes(e.target.value) ? setPending(e.target.value) : change(e.target.value))}>
        {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
      </select>
      <Modal open={!!pending} title={`Set project to “${humanize(pending ?? '')}”`} onClose={() => setPending(null)}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (pending && reason.trim()) void change(pending, reason.trim()); }}>
          <label className="field"><span>Reason (kept in the project history)</span>
            <textarea rows={3} required maxLength={2000} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="btn" disabled={busy || !reason.trim()}>Set to {humanize(pending ?? '')}</button>
        </form>
      </Modal>
    </>
  );
}

// ===================================================================== briefs
function Briefs({ product, projectId }: { product: ProjectProduct; projectId: string }) {
  const briefs = useApi<Brief[]>(`/project-products/${product.id}/briefs`);
  const [openId, setOpenId] = useState<string | null>(null);
  const brief = useApi<Brief>(openId ? `/briefs/${openId}` : null);
  const { busy, run } = useAction();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <div>
      <div className="row between"><span className="eyebrow">Briefs</span></div>
      {briefs.data?.map((b) => (
        <div key={b.id} className="row between small" style={{ padding: '4px 0' }}>
          <button className="btn ghost" onClick={() => { setOpenId(b.id); setText(''); }}>{b.title}</button>
          <span className="muted">{fmtDate(b.createdAt)}</span>
        </div>
      ))}
      <form className="row" style={{ marginTop: 6 }} onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => post(`/project-products/${product.id}/briefs`, { title, content: {} }), 'Brief created')) { setTitle(''); briefs.reload(); }
      }}>
        <input className="input" style={{ flex: 1 }} required placeholder="New brief title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn small secondary" disabled={busy}>Create brief</button>
      </form>

      <Modal open={!!openId} title={brief.data?.title ?? 'Brief'} onClose={() => setOpenId(null)}>
        {brief.loading && !brief.data ? <Loading /> : brief.data && (
          <div className="stack">
            {brief.data.versions?.map((v, i) => (
              <div key={v.id} className="card pad">
                <div className="row between"><b style={{ fontWeight: 500 }}>Version {v.versionNo}{i === 0 && ' (latest)'}</b><span className="small muted">{fmtDate(v.createdAt, true)}</span></div>
                <pre className="pre small" style={{ margin: '8px 0 0' }}>{typeof v.content?.text === 'string' ? v.content.text : JSON.stringify(v.content, null, 2)}</pre>
                {i === 0 && (
                  <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(() => post(`/projects/${projectId}/approvals`, { targetType: 'brief_version', targetId: v.id, confirmationText: confirm }), 'Brief version approved')) { setConfirm(''); approvalsChanged(); }
                  }}>
                    <input className="input" style={{ flex: 1 }} required minLength={5} placeholder={`Type: I approve version ${v.versionNo} of this brief`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                    <button className="btn small" disabled={busy}>Approve this version</button>
                  </form>
                )}
              </div>
            ))}
            <form className="stack" onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              if (await run(() => post(`/briefs/${openId}/versions`, { content: { text } }), 'New version saved')) { setText(''); brief.reload(); }
            }}>
              <label className="field"><span>Write a new version</span><textarea rows={6} required value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the product, changes since the last version…" /></label>
              <button className="btn" disabled={busy}>Save as new version</button>
              <p className="small muted">Earlier versions are kept unchanged. An approval always applies to one exact version.</p>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ===================================================================== samples
const FEEDBACK_FIELDS: [keyof FeedbackDetails, string, string][] = [
  ['appearance', 'Colour / appearance', 'e.g. A bit too yellow'], ['texture', 'Texture / thickness', 'e.g. Too runny, absorbs fast'],
  ['scent', 'Scent', 'e.g. Fragrance too strong'], ['performance', 'Performance / application', 'e.g. Lathers well, spreads easily'],
  ['afterFeel', 'After-feel', 'e.g. Slightly sticky after 10 minutes'], ['packaging', 'Packaging', 'e.g. Pump works, label too small'],
];
const DECISIONS: Record<string, string> = { approved_next_stage: 'Approved for next-stage discussion', request_changes: 'Changes requested' };

function FeedbackView({ f }: { f: Feedback }) {
  const d = f.details ?? {};
  const rows = FEEDBACK_FIELDS.filter(([k]) => d[k]).map(([k, label]): [string, string] => [label, d[k] as string]);
  return (
    <div className="card pad" style={{ marginTop: 8 }}>
      <div className="row between">
        <span>{f.rating ? `★ ${f.rating}/5` : 'Feedback'}{d.decision && <> · {DECISIONS[d.decision]}</>}</span>
        <span className="muted">{f.inquiryId ? 'From the website form · ' : ''}{fmtDate(f.createdAt)}</span>
      </div>
      {rows.length > 0 && <Kv rows={rows} />}
      {d.changes && <p className="pre"><b style={{ fontWeight: 500 }}>Requested changes:</b> {d.changes}</p>}
      {f.comments && <p className="pre muted">{f.comments}</p>}
      {!!d.documentIds?.length && <p className="muted">{d.documentIds.length} photo(s) / file(s) – see Documents.</p>}
    </div>
  );
}

function FeedbackForm({ revisionId, revisionNo, projectId, onSent }: { revisionId: string; revisionNo: number; projectId: string; onSent: () => void }) {
  const { busy, run } = useAction();
  const [rating, setRating] = useState('');
  const [decision, setDecision] = useState('');
  const [d, setD] = useState<Record<string, string>>({});
  const [comments, setComments] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const empty = !rating && !decision && !comments.trim() && !Object.values(d).some((v) => v.trim()) && !files.length;
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      const documentIds: string[] = [];
      for (const file of files) documentIds.push((await uploadFile(file, { projectId, title: `Sample feedback – revision ${revisionNo}`, visibility: 'customer' })).documentId);
      const details = { ...Object.fromEntries(Object.entries(d).filter(([, v]) => v.trim())), decision: decision || undefined, documentIds: documentIds.length ? documentIds : undefined };
      return post(`/sample-revisions/${revisionId}/feedback`, { rating: rating ? Number(rating) : undefined, comments: comments.trim() || undefined, details });
    }, 'Feedback sent');
    if (ok) { setRating(''); setDecision(''); setD({}); setComments(''); setFiles([]); onSent(); }
  };
  return (
    <form className="form-grid" style={{ marginTop: 12 }} onSubmit={send}>
      <p className="small muted full">Feedback on revision {revisionNo}. Answer what you can – every field is optional. Feedback is not a production approval.</p>
      <label className="field"><span>Overall rating</span>
        <select value={rating} onChange={(e) => setRating(e.target.value)}><option value="">–</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></label>
      <label className="field"><span>Your decision</span>
        <select value={decision} onChange={(e) => setDecision(e.target.value)}><option value="">Not decided yet</option>{Object.entries(DECISIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {FEEDBACK_FIELDS.map(([k, label, hint]) => (
        <label key={k} className="field"><span>{label}</span><textarea rows={2} maxLength={2000} placeholder={hint} value={d[k] ?? ''} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></label>
      ))}
      <label className="field full"><span>What should change in the next revision?</span><textarea rows={3} maxLength={4000} value={d.changes ?? ''} onChange={(e) => setD({ ...d, changes: e.target.value })} /></label>
      <label className="field full"><span>Other comments</span><textarea rows={2} maxLength={10000} value={comments} onChange={(e) => setComments(e.target.value)} /></label>
      <label className="field full"><span>Photos or files (optional, up to 5)</span>
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} /></label>
      <div className="full"><button className="btn small" disabled={busy || empty}>Send feedback</button></div>
    </form>
  );
}

/** Staff: attach a sample review sent from the public website form (reference DP-INQ-…) to this revision. */
function LinkWebsiteReview({ revisionId, revisionNo, onLinked }: { revisionId: string; revisionNo: number; onLinked: () => void }) {
  const { busy, run } = useAction();
  const [ref, setRef] = useState('');
  return (
    <form className="row" style={{ marginTop: 6 }} onSubmit={async (e) => {
      e.preventDefault();
      if (await run(() => post(`/sample-revisions/${revisionId}/link-inquiry`, { inquiry: ref.trim() }), `Website review linked to revision ${revisionNo}`)) { setRef(''); onLinked(); }
    }}>
      <input className="input" style={{ flex: 1 }} placeholder="Website sample review reference, e.g. DP-INQ-2026-000123" value={ref} onChange={(e) => setRef(e.target.value)} />
      <button className="btn small ghost" disabled={busy || !ref.trim()}>Link review</button>
    </form>
  );
}

function SampleCard({ sampleId, projectId, staff }: { sampleId: string; projectId: string; staff: boolean }) {
  const s = useApi<SampleDetail>(`/samples/${sampleId}`);
  const { busy, run } = useAction();
  const [desc, setDesc] = useState('');
  const [tracking, setTracking] = useState('');
  const [confirm, setConfirm] = useState('');
  if (!s.data) return s.loading ? <Loading /> : <ErrorBox error={s.error} />;
  const latest = s.data.revisions[s.data.revisions.length - 1];
  return (
    <div className="card pad" style={{ marginTop: 8 }}>
      <div className="row between">
        <b style={{ fontWeight: 500 }}>{s.data.title}</b>
        {staff ? (
          <select className="input" value={s.data.status} disabled={busy} onChange={async (e) => { if (await run(() => patch(`/samples/${sampleId}`, { status: e.target.value }), 'Sample updated')) s.reload(); }}>
            {SAMPLE_STATUSES.map((x) => <option key={x} value={x}>{humanize(x)}</option>)}
          </select>
        ) : <Badge value={s.data.status} />}
      </div>
      {s.data.revisions.map((r) => (
        <div key={r.id} style={{ borderTop: '1px solid var(--line-2)', marginTop: 10, paddingTop: 10 }} className="small">
          <div className="row between"><b style={{ fontWeight: 500 }}>Revision {r.revisionNo}</b><span className="muted">{r.shippedAt ? `Shipped ${fmtDate(r.shippedAt)}` : 'In development'}{r.trackingNo && ` · ${r.trackingNo}`}</span></div>
          {r.description && <p className="pre">{r.description}</p>}
          {r.feedback.map((f) => <FeedbackView key={f.id} f={f} />)}
          {staff && <LinkWebsiteReview revisionId={r.id} revisionNo={r.revisionNo} onLinked={s.reload} />}
          {staff && r.shippedAt && (
            <button className="btn small ghost" style={{ marginTop: 6 }} disabled={busy} title="E-mail the customer asking for feedback on this revision"
              onClick={() => run(() => post(`/sample-revisions/${r.id}/request-feedback`), `Feedback requested for revision ${r.revisionNo}`)}>Ask for feedback</button>
          )}
          {staff && !r.shippedAt && (
            <form className="row" style={{ marginTop: 6 }} onSubmit={async (e) => { e.preventDefault(); if (await run(() => patch(`/sample-revisions/${r.id}`, { shippedAt: new Date().toISOString(), trackingNo: tracking || undefined }), 'Marked as shipped')) { setTracking(''); s.reload(); } }}>
              <input className="input" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              <button className="btn small secondary" disabled={busy}>Mark shipped</button>
            </form>
          )}
        </div>
      ))}
      {latest && <FeedbackForm revisionId={latest.id} revisionNo={latest.revisionNo} projectId={projectId} onSent={s.reload} />}
      {latest && !staff && (
        <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => post(`/projects/${projectId}/approvals`, { targetType: 'sample_revision', targetId: latest.id, confirmationText: confirm }), 'Sample approved')) { setConfirm(''); s.reload(); approvalsChanged(); }
        }}>
          <input className="input" style={{ flex: 1 }} required minLength={5} placeholder={`Type: I approve sample revision ${latest.revisionNo}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="btn small accent" disabled={busy}>Approve sample</button>
        </form>
      )}
      {staff && (
        <form className="row" style={{ marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); if (await run(() => post(`/samples/${sampleId}/revisions`, { description: desc.trim() }), 'Revision added')) { setDesc(''); s.reload(); } }}>
          <input className="input" style={{ flex: 1 }} required placeholder="New revision – what changed?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <button className="btn small secondary" disabled={busy || !desc.trim()}>Add revision</button>
        </form>
      )}
    </div>
  );
}

function Products({ project, staff, reload }: { project: ProjectDetail; staff: boolean; reload: () => void }) {
  const { busy, run } = useAction();
  const [sampleTitle, setSampleTitle] = useState<Record<string, string>>({});
  return (
    <div className="card">
      <div className="card-head"><h2>Products<Tip>{staff ? 'Each product line in this project, with its own details, stages, briefs and samples.' : 'The products in this project. Open the details to tell us what you need; rate samples here when they arrive.'}</Tip></h2><AddProduct projectId={project.id} onAdded={reload} /></div>
      <div className="card-body stack">
        {project.products.map((p) => (
          <div key={p.id} className="card pad">
            <div className="row between">
              <div>
                <h3>{p.name}</h3>
                <div className="small muted">{p.targetQuantity ? `Target ${p.targetQuantity.toLocaleString()} units` : 'Quantity to be confirmed'}{p.notes ? ` · ${p.notes}` : ''}</div>
                <div style={{ marginTop: 6 }}>
                  <Dates compact path={`/project-products/${p.id}`} target={p.targetDate} promised={p.promisedDate} staff={staff}
                    done={!!p.stageSummary && p.stageSummary.done === p.stageSummary.total} reload={reload} />
                </div>
              </div>
              <button className="btn small ghost" disabled={busy} onClick={async () => {
                if (confirm(`Remove “${p.name}” from this project?`) && await run(() => del(`/project-products/${p.id}`), 'Product removed')) reload();
              }}>Remove</button>
            </div>
            <hr />
            <ProductDetails product={p} reload={reload} />
            <ProductStages product={p} projectId={project.id} staff={staff} reload={reload} />
            <Briefs product={p} projectId={project.id} />
            <div style={{ marginTop: 12 }}>
              <span className="eyebrow">Samples</span>
              {p.samples?.map((s) => <SampleCard key={s.id} sampleId={s.id} projectId={project.id} staff={staff} />)}
              {!p.samples?.length && <p className="small muted">No samples yet.</p>}
              {staff && (
                <form className="row" style={{ marginTop: 8 }} onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run(() => post(`/project-products/${p.id}/samples`, { title: sampleTitle[p.id] }), 'Sample created')) { setSampleTitle({ ...sampleTitle, [p.id]: '' }); reload(); }
                }}>
                  <input className="input" style={{ flex: 1 }} required placeholder="New sample, e.g. Lotion – version A" value={sampleTitle[p.id] ?? ''} onChange={(e) => setSampleTitle({ ...sampleTitle, [p.id]: e.target.value })} />
                  <button className="btn small secondary" disabled={busy}>Create sample</button>
                </form>
              )}
            </div>
          </div>
        ))}
        {!project.products.length && <Empty>No products yet. Use “Add product” to pick from the library.</Empty>}
      </div>
    </div>
  );
}

// ===================================================================== quotes
type Line = { description: string; quantity: string; unitPrice: string };
const QUOTE_TERMS: [keyof QuoteTerms, string, string][] = [
  ['paymentSchedule', 'Payment schedule', 'e.g. 50% deposit with the order, 50% before dispatch'],
  ['taxes', 'Taxes', 'e.g. Prices exclude VAT (14%) and import duties'],
  ['exclusions', 'Not included', 'e.g. Stability testing, artwork design, shipping'],
  ['assumptions', 'Assumptions', 'e.g. Based on the approved sample, standard 50 ml bottle, one fragrance'],
  ['leadTime', 'Estimated lead time', 'e.g. About 6–8 weeks after approval (an estimate, not a commitment)'],
];

type QuoteSave = { currency: string; validUntil?: string; terms: QuoteTerms; lines: { description: string; quantity: number; unitPrice: number }[] };
function QuoteEditor({ initial, initialTerms, onSave, busy }: { initial?: Line[]; initialTerms?: QuoteTerms; onSave: (v: QuoteSave) => void; busy: boolean }) {
  const [lines, setLines] = useState<Line[]>(initial ?? [{ description: '', quantity: '1', unitPrice: '0' }]);
  const [terms, setTerms] = useState<QuoteTerms>(initialTerms ?? {});
  const [currency, setCurrency] = useState('USD');
  const [validUntil, setValidUntil] = useState('');
  const total = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  const upd = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <form className="stack" onSubmit={(e) => {
      e.preventDefault();
      onSave({ currency, validUntil: validUntil || undefined, terms, lines: lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) });
    }}>
      <table className="table">
        <thead><tr><th>Description</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 130 }}>Unit price</th><th style={{ width: 110 }}>Total</th><th /></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td><input className="input" required value={l.description} onChange={(e) => upd(i, 'description', e.target.value)} /></td>
              <td><input className="input" type="number" min="0" step="0.01" required value={l.quantity} onChange={(e) => upd(i, 'quantity', e.target.value)} /></td>
              <td><input className="input" type="number" min="0" step="0.0001" required value={l.unitPrice} onChange={(e) => upd(i, 'unitPrice', e.target.value)} /></td>
              <td className="small">{fmtMoney(Number(l.quantity || 0) * Number(l.unitPrice || 0), currency)}</td>
              <td><button type="button" className="btn small ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row between">
        <button type="button" className="btn small secondary" onClick={() => setLines([...lines, { description: '', quantity: '1', unitPrice: '0' }])}>Add line</button>
        <b style={{ fontWeight: 500 }}>Total {fmtMoney(total, currency)}</b>
      </div>
      <div className="form-grid">
        <label className="field"><span>Currency</span><input maxLength={3} minLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></label>
        <label className="field"><span>Valid until</span><input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label>
        {QUOTE_TERMS.map(([k, label, hint]) => (
          <label key={k} className="field full"><span>{label} (optional)</span>
            <textarea rows={2} maxLength={k === 'leadTime' ? 500 : 2000} placeholder={hint} value={terms[k] ?? ''} onChange={(e) => setTerms({ ...terms, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <button className="btn" disabled={busy}>Save quote</button>
    </form>
  );
}

function QuoteView({ quoteId, projectId, staff, onChanged }: { quoteId: string; projectId: string; staff: boolean; onChanged: () => void }) {
  const q = useApi<QuoteDetail>(`/quotes/${quoteId}`);
  const { busy, run } = useAction();
  const [revising, setRevising] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [answer, setAnswer] = useState<'declined' | 'changes_requested' | null>(null);
  const [answerNote, setAnswerNote] = useState('');
  if (!q.data) return q.loading ? <Loading /> : <ErrorBox error={q.error} />;
  const latest = q.data.versions[0];
  const reload = () => { q.reload(); onChanged(); };
  return (
    <div className="card pad" style={{ marginTop: 10 }}>
      <div className="row between">
        <span className="row"><b className="mono">{q.data.quoteNo}</b><Badge value={q.data.status} /><span className="small muted">v{latest?.versionNo}</span></span>
        {staff && (
          <div className="row">
            {q.data.status === 'draft' && <button className="btn small accent" disabled={busy} onClick={async () => { if (await run(() => post(`/quotes/${quoteId}/send`), 'Quote sent to the customer')) reload(); }}>Send to customer</button>}
            {q.data.status !== 'accepted' && <button className="btn small secondary" onClick={() => setRevising((r) => !r)}>{revising ? 'Cancel' : 'Revise'}</button>}
            {['sent', 'draft', 'changes_requested'].includes(q.data.status) && (
              <select className="input" value="" onChange={async (e) => { if (e.target.value && await run(() => patch(`/quotes/${quoteId}`, { status: e.target.value }), 'Quote updated')) reload(); }}>
                <option value="">Mark as…</option><option value="rejected">Rejected</option><option value="expired">Expired</option>
              </select>
            )}
          </div>
        )}
      </div>
      {latest && !revising && (
        <>
          <table className="table" style={{ marginTop: 10 }}>
            <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {latest.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td>{Number(l.quantity)}</td><td>{fmtMoney(l.unitPrice, latest.currency)}</td><td style={{ textAlign: 'right' }}>{fmtMoney(l.lineTotal, latest.currency)}</td></tr>)}
              <tr><td colSpan={3}><b style={{ fontWeight: 500 }}>Total</b>{latest.validUntil && <span className="small muted"> · valid until {fmtDate(latest.validUntil)}</span>}</td><td style={{ textAlign: 'right' }}><b style={{ fontWeight: 500 }}>{fmtMoney(latest.total, latest.currency)}</b></td></tr>
            </tbody>
          </table>
          {QUOTE_TERMS.some(([k]) => latest.terms?.[k]) && (
            <Kv rows={QUOTE_TERMS.filter(([k]) => latest.terms?.[k]).map(([k, label]) => [label, <span key={k} className="pre">{latest.terms![k]}</span>])} />
          )}
          {latest.approvals.map((a) => <p key={a.id} className="small" style={{ marginTop: 8 }}><Badge value="accepted" /> {fmtDate(a.approvedAt, true)} — “{a.confirmationText}”</p>)}
          {q.data.versions.flatMap((v) => (v.responses ?? []).map((r) => (
            <p key={r.id} className="small" style={{ marginTop: 8 }}>
              <Badge value={r.decision} /> v{v.versionNo} · {fmtDate(r.createdAt, true)}{r.note && <> — “{r.note}”</>}
            </p>
          )))}
          {staff && q.data.status === 'changes_requested' && (
            <p className="small" style={{ marginTop: 8 }}>The customer asked for changes. Use <b style={{ fontWeight: 500 }}>Revise</b> to make a new version, then send it again.</p>
          )}
          {!staff && q.data.status === 'sent' && (
            <form className="row" style={{ marginTop: 12 }} onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => post(`/projects/${projectId}/approvals`, { targetType: 'quote_version', targetId: latest.id, confirmationText: confirm }), 'Quote accepted. Thank you!')) { setConfirm(''); reload(); approvalsChanged(); }
            }}>
              <input className="input" style={{ flex: 1 }} required minLength={5} placeholder={`Type: I accept quote ${q.data.quoteNo} version ${latest.versionNo}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <button className="btn accent" disabled={busy}>Accept quote</button>
            </form>
          )}
          {!staff && q.data.status === 'sent' && (
            <div style={{ marginTop: 10 }}>
              {!answer ? (
                <div className="row">
                  <span className="small muted">Not ready to accept?</span>
                  <button className="btn small secondary" onClick={() => setAnswer('changes_requested')}>Request changes</button>
                  <button className="btn small ghost" onClick={() => setAnswer('declined')}>Decline quote</button>
                </div>
              ) : (
                <form className="stack" onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await run(
                    () => post(`/quotes/${quoteId}/respond`, { decision: answer, quoteVersionId: latest.id, note: answerNote.trim() || undefined }),
                    answer === 'declined' ? 'Quote declined. Your Despina contact has been told.' : 'Change request sent to your Despina contact.',
                  );
                  if (ok) { setAnswer(null); setAnswerNote(''); reload(); }
                }}>
                  <label className="field">
                    <span>{answer === 'declined' ? 'Reason for declining (optional)' : 'What should change? *'}</span>
                    <textarea rows={3} maxLength={5000} required={answer === 'changes_requested'} minLength={answer === 'changes_requested' ? 5 : undefined}
                      value={answerNote} onChange={(e) => setAnswerNote(e.target.value)}
                      placeholder={answer === 'declined' ? 'e.g. budget, timing, chose another option' : 'e.g. quantity 2,000 instead of 1,000; price per unit; different packaging'} />
                  </label>
                  <div className="row">
                    <button className={`btn small ${answer === 'declined' ? '' : 'accent'}`} disabled={busy}>{answer === 'declined' ? `Decline quote ${q.data.quoteNo}` : 'Send change request'}</button>
                    <button type="button" className="btn small ghost" onClick={() => { setAnswer(null); setAnswerNote(''); }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          )}
          {q.data.versions.length > 1 && <p className="small muted" style={{ marginTop: 8 }}>{q.data.versions.length - 1} earlier version(s) kept for the record.</p>}
        </>
      )}
      {revising && latest && (
        <div style={{ marginTop: 12 }}>
          <QuoteEditor busy={busy} initialTerms={latest.terms} initial={latest.lines.map((l) => ({ description: l.description, quantity: String(Number(l.quantity)), unitPrice: String(Number(l.unitPrice)) }))}
            onSave={async (v) => { if (await run(() => post(`/quotes/${quoteId}/versions`, v), 'New quote version saved (draft)')) { setRevising(false); reload(); } }} />
        </div>
      )}
    </div>
  );
}

function Quotes({ project, staff, reload }: { project: ProjectDetail; staff: boolean; reload: () => void }) {
  const { busy, run } = useAction();
  const [creating, setCreating] = useState(false);
  return (
    <div className="card">
      <div className="card-head"><h2>Quotes<Tip>{staff ? 'A quote is a draft until you send it. The customer then accepts, asks for changes or declines. Each change makes a new version.' : 'Price offers from Despina. Open one to accept it, ask for changes or decline.'}</Tip></h2>{staff && <button className="btn small" onClick={() => setCreating((c) => !c)}>{creating ? 'Cancel' : 'New quote'}</button>}</div>
      <div className="card-body">
        {creating && (
          <QuoteEditor busy={busy} initial={project.products.map((p) => ({ description: p.name, quantity: String(p.targetQuantity ?? 1), unitPrice: '0' }))}
            onSave={async (v) => { if (await run(() => post(`/projects/${project.id}/quotes`, v), 'Draft quote created')) { setCreating(false); reload(); } }} />
        )}
        {project.quotes.map((q) => <QuoteView key={q.id} quoteId={q.id} projectId={project.id} staff={staff} onChanged={reload} />)}
        {!project.quotes.length && !creating && <p className="muted small">{staff ? 'No quotes yet.' : 'Your quote will appear here when it is ready.'}</p>}
      </div>
    </div>
  );
}

// ===================================================================== approvals + timeline
function Approvals({ projectId }: { projectId: string }) {
  const a = useApi<Approval[]>(`/projects/${projectId}/approvals`);
  useApprovalsChanged(a.reload);
  return (
    <div className="card pad">
      <h3>Approvals<Tip>A record of what was approved (sample, document, quote or brief), by whom and when – fixed to that exact version.</Tip></h3>
      {a.data?.map((x) => (
        <div key={x.id} className="small" style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
          <div className="row between"><Badge value={x.targetType} tone="ok" /><span className="muted">{fmtDate(x.approvedAt, true)}</span></div>
          <div style={{ marginTop: 4 }}>“{x.confirmationText}”</div>
          <div className="muted mono" title="Fingerprint of the exact version approved">#{x.targetHash.slice(0, 12)} · {humanize(x.approverRole)}</div>
        </div>
      ))}
      {a.data && !a.data.length && <p className="muted small" style={{ marginTop: 8 }}>No approvals yet.</p>}
    </div>
  );
}

function ProjectTimeline({ projectId }: { projectId: string }) {
  const t = useApi<StatusEventLike[]>(`/projects/${projectId}/timeline`);
  return (
    <div className="card pad">
      <h3>History<Tip>Everything that happened in this project, newest first.</Tip></h3>
      <ul className="timeline" style={{ marginTop: 12 }}>
        {t.data?.slice().reverse().map((e) => <li key={e.id}><div className="when">{fmtDate(e.createdAt, true)}</div>{e.note ?? (e.toStatus ? `Status → ${humanize(e.toStatus)}` : '')}</li>)}
      </ul>
    </div>
  );
}

// ===================================================================== page
export function ProjectWorkspace({ id, backHref }: { id: string; backHref: string }) {
  const { me } = useAuth();
  const staff = isStaff(me?.role);
  const p = useApi<ProjectDetail>(`/projects/${id}`);
  const staffList = useApi<{ id: string; email: string }[]>(staff ? '/users/staff' : null);
  const { busy, run } = useAction();
  if (p.loading && !p.data) return <Loading />;
  if (!p.data) return <ErrorBox error={p.error ?? 'Not found'} onRetry={p.reload} />;
  const project = p.data;
  // Re-load the history whenever a stage or quote changes (it is fetched separately).
  const historyKey = [
    project.updatedAt, project.currentStageId, ...project.products.map((x) => `${x.id}:${x.currentStageId}:${x.stageSummary?.done}`),
    ...project.quotes.map((q) => `${q.id}:${q.status}`),
  ].join('|');

  return (
    <>
      <p className="small"><Link href={backHref}>← Projects</Link></p>
      <PageHead eyebrow={project.code} title={project.name} sub={<>{project.company?.name}{project.owner && ` · Despina contact: ${project.owner.email}`}</>}
        help={staff ? (
          <ul>
            <li><b>Stages</b> – complete the current stage to move on. Some stages (e.g. Quality Release) need a certain role.</li>
            <li><b>Products</b> – each product line has its own details, stages, briefs and samples.</li>
            <li><b>Quotes</b> – create, then “Send” so the customer can accept, ask for changes or decline.</li>
            <li><b>Documents</b> – choose “Visible to customer” or “Internal only” when you upload.</li>
            <li><b>Dates</b> – the target date is for us only; the promised date is shown to the customer.</li>
          </ul>
        ) : (
          <ul>
            <li><b>Stages</b> show where your project is now.</li>
            <li><b>Products</b> – details, samples and feedback for each product. When a sample arrives, rate it here.</li>
            <li><b>Quotes</b> – review a quote and accept it, ask for changes or decline.</li>
            <li><b>Documents</b> – files from Despina to download; you can upload files too.</li>
            <li><b>Messages</b> – write to the Despina team; you get an e-mail when they answer.</li>
          </ul>
        )}>
        {staff ? (
          <ProjectStatus project={project} reload={p.reload} />
        ) : <Badge value={project.status} />}
        {staff && project.sourceInquiryId && <Link className="btn secondary" href={`/admin/inquiries/${project.sourceInquiryId}/`}>Original inquiry</Link>}
        {me?.role === 'admin' && <Link className="btn secondary" href={`/admin/audit/?projectId=${project.id}`}>Audit history</Link>}
      </PageHead>
      <ScrollToSection />

      <div id="stages" className="anchor"><Stages project={project} reload={p.reload} staff={staff} /></div>
      <div className="split" style={{ marginTop: 16 }}>
        <div className="stack">
          <div id="products" className="anchor"><Products project={project} staff={staff} reload={p.reload} /></div>
          <div id="quotes" className="anchor"><Quotes project={project} staff={staff} reload={p.reload} /></div>
          <div id="documents" className="anchor"><DocumentsPanel path={`/projects/${id}/documents`} projectId={id} /></div>
          <div id="messages" className="anchor"><MessagesPanel path={`/projects/${id}/messages`} title={staff ? 'Messages with the customer' : 'Messages with Despina'} /></div>
        </div>
        <div className="stack">
          {staff && (
            <div className="card pad">
              <h3>Project owner<Tip>The Despina person responsible. They get the customer’s messages and the daily “waiting on you” list.</Tip></h3>
              <select className="input" style={{ marginTop: 10 }} value={project.ownerId ?? ''} disabled={busy}
                onChange={async (e) => { if (await run(() => patch(`/projects/${id}`, { ownerId: e.target.value }), 'Owner updated')) p.reload(); }}>
                {staffList.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
              <div style={{ marginTop: 12 }}>
                <Kv rows={[['Company', project.company && <Link href={`/admin/companies/${project.company.id}/`}>{project.company.name}</Link>], ['Created', fmtDate(project.createdAt)]]} />
              </div>
            </div>
          )}
          <div className="card pad">
            <h3>Dates<Tip>{staff ? 'Target = our own goal (customers never see it). Promised = the date given to the customer; changing it asks for a reason that shows in the history.' : 'The date Despina expects your project to be ready. If it changes, the reason shows in the history.'}</Tip></h3>
            <div style={{ marginTop: 10 }}>
              <Dates path={`/projects/${id}`} target={project.targetDate} promised={project.promisedDate} staff={staff}
                done={project.status === 'completed' || project.status === 'cancelled'} reload={p.reload} />
            </div>
          </div>
          <div id="approvals" className="anchor"><Approvals projectId={id} /></div>
          {staff && <div id="tasks" className="anchor"><TasksPanel projectId={id} /></div>}
          <ProjectTimeline key={historyKey} projectId={id} />
        </div>
      </div>
    </>
  );
}

