'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { del, patch, post, qs } from '@/lib/api';
import { PROJECT_STATUSES, SAMPLE_STATUSES } from '@/lib/types';
import type {
  Approval, Brief, CatalogItem, Paged, ProjectDetail, ProjectProduct, QuoteDetail, SampleDetail, StatusEventLike,
} from './workspace-types';
import { isStaff, useAuth } from './auth';
import { DocumentsPanel, MessagesPanel, TasksPanel } from './panels';
import { Badge, Empty, ErrorBox, Kv, Loading, Modal, PageHead, fmtDate, fmtMoney, humanize, useAction, useApi } from './ui';

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
        <h3>Stages</h3>
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
                    if (await run(() => post(`/projects/${projectId}/approvals`, { targetType: 'brief_version', targetId: v.id, confirmationText: confirm }), 'Brief version approved')) setConfirm('');
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
function SampleCard({ sampleId, projectId, staff }: { sampleId: string; projectId: string; staff: boolean }) {
  const s = useApi<SampleDetail>(`/samples/${sampleId}`);
  const { busy, run } = useAction();
  const [rating, setRating] = useState('5');
  const [comments, setComments] = useState('');
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
          {r.feedback.map((f) => <p key={f.id} className="muted">★ {f.rating ?? '–'}/5 — {f.comments}</p>)}
          {staff && !r.shippedAt && (
            <form className="row" style={{ marginTop: 6 }} onSubmit={async (e) => { e.preventDefault(); if (await run(() => patch(`/sample-revisions/${r.id}`, { shippedAt: new Date().toISOString(), trackingNo: tracking || undefined }), 'Marked as shipped')) { setTracking(''); s.reload(); } }}>
              <input className="input" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              <button className="btn small secondary" disabled={busy}>Mark shipped</button>
            </form>
          )}
        </div>
      ))}
      {latest && (
        <form className="form-grid" style={{ marginTop: 12 }} onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => post(`/sample-revisions/${latest.id}/feedback`, { rating: Number(rating), comments }), 'Feedback sent')) { setComments(''); s.reload(); }
        }}>
          <label className="field"><span>Rating</span><select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></label>
          <label className="field full"><span>Feedback on revision {latest.revisionNo}</span><textarea rows={3} required value={comments} onChange={(e) => setComments(e.target.value)} /></label>
          <div className="full"><button className="btn small" disabled={busy}>Send feedback</button></div>
        </form>
      )}
      {latest && !staff && (
        <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => post(`/projects/${projectId}/approvals`, { targetType: 'sample_revision', targetId: latest.id, confirmationText: confirm }), 'Sample approved')) { setConfirm(''); s.reload(); }
        }}>
          <input className="input" style={{ flex: 1 }} required minLength={5} placeholder={`Type: I approve sample revision ${latest.revisionNo}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="btn small accent" disabled={busy}>Approve sample</button>
        </form>
      )}
      {staff && (
        <form className="row" style={{ marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); if (await run(() => post(`/samples/${sampleId}/revisions`, { description: desc || undefined }), 'Revision added')) { setDesc(''); s.reload(); } }}>
          <input className="input" style={{ flex: 1 }} placeholder="New revision – what changed?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <button className="btn small secondary" disabled={busy}>Add revision</button>
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
      <div className="card-head"><h2>Products</h2><AddProduct projectId={project.id} onAdded={reload} /></div>
      <div className="card-body stack">
        {project.products.map((p) => (
          <div key={p.id} className="card pad">
            <div className="row between">
              <div>
                <h3>{p.name}</h3>
                <div className="small muted">{p.targetQuantity ? `Target ${p.targetQuantity.toLocaleString()} units` : 'Quantity to be confirmed'}{p.notes ? ` · ${p.notes}` : ''}</div>
              </div>
              <button className="btn small ghost" disabled={busy} onClick={async () => {
                if (confirm(`Remove “${p.name}” from this project?`) && await run(() => del(`/project-products/${p.id}`), 'Product removed')) reload();
              }}>Remove</button>
            </div>
            <hr />
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
function QuoteEditor({ initial, onSave, busy }: { initial?: Line[]; onSave: (v: { currency: string; validUntil?: string; lines: { description: string; quantity: number; unitPrice: number }[] }) => void; busy: boolean }) {
  const [lines, setLines] = useState<Line[]>(initial ?? [{ description: '', quantity: '1', unitPrice: '0' }]);
  const [currency, setCurrency] = useState('USD');
  const [validUntil, setValidUntil] = useState('');
  const total = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  const upd = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <form className="stack" onSubmit={(e) => {
      e.preventDefault();
      onSave({ currency, validUntil: validUntil || undefined, lines: lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) });
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
            {['sent', 'draft'].includes(q.data.status) && (
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
          {latest.approvals.map((a) => <p key={a.id} className="small" style={{ marginTop: 8 }}><Badge value="accepted" /> {fmtDate(a.approvedAt, true)} — “{a.confirmationText}”</p>)}
          {!staff && q.data.status === 'sent' && (
            <form className="row" style={{ marginTop: 12 }} onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => post(`/projects/${projectId}/approvals`, { targetType: 'quote_version', targetId: latest.id, confirmationText: confirm }), 'Quote accepted. Thank you!')) { setConfirm(''); reload(); }
            }}>
              <input className="input" style={{ flex: 1 }} required minLength={5} placeholder={`Type: I accept quote ${q.data.quoteNo} version ${latest.versionNo}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <button className="btn accent" disabled={busy}>Accept quote</button>
            </form>
          )}
          {q.data.versions.length > 1 && <p className="small muted" style={{ marginTop: 8 }}>{q.data.versions.length - 1} earlier version(s) kept for the record.</p>}
        </>
      )}
      {revising && latest && (
        <div style={{ marginTop: 12 }}>
          <QuoteEditor busy={busy} initial={latest.lines.map((l) => ({ description: l.description, quantity: String(Number(l.quantity)), unitPrice: String(Number(l.unitPrice)) }))}
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
      <div className="card-head"><h2>Quotes</h2>{staff && <button className="btn small" onClick={() => setCreating((c) => !c)}>{creating ? 'Cancel' : 'New quote'}</button>}</div>
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
  return (
    <div className="card pad">
      <h3>Approvals</h3>
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
      <h3>History</h3>
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

  return (
    <>
      <p className="small"><Link href={backHref}>← Projects</Link></p>
      <PageHead eyebrow={project.code} title={project.name} sub={<>{project.company?.name}{project.owner && ` · Despina contact: ${project.owner.email}`}</>}>
        {staff ? (
          <select className="input" value={project.status} disabled={busy} aria-label="Project status"
            onChange={async (e) => { if (await run(() => patch(`/projects/${id}`, { status: e.target.value }), 'Project updated')) p.reload(); }}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        ) : <Badge value={project.status} />}
        {staff && project.sourceInquiryId && <Link className="btn secondary" href={`/admin/inquiries/${project.sourceInquiryId}/`}>Original inquiry</Link>}
      </PageHead>

      <Stages project={project} reload={p.reload} staff={staff} />
      <div className="split" style={{ marginTop: 16 }}>
        <div className="stack">
          <Products project={project} staff={staff} reload={p.reload} />
          <Quotes project={project} staff={staff} reload={p.reload} />
          <DocumentsPanel path={`/projects/${id}/documents`} projectId={id} />
          <MessagesPanel path={`/projects/${id}/messages`} title={staff ? 'Messages with the customer' : 'Messages with Despina'} />
        </div>
        <div className="stack">
          {staff && (
            <div className="card pad">
              <h3>Project owner</h3>
              <select className="input" style={{ marginTop: 10 }} value={project.ownerId ?? ''} disabled={busy}
                onChange={async (e) => { if (await run(() => patch(`/projects/${id}`, { ownerId: e.target.value }), 'Owner updated')) p.reload(); }}>
                {staffList.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
              <div style={{ marginTop: 12 }}>
                <Kv rows={[['Company', project.company && <Link href={`/admin/companies/${project.company.id}/`}>{project.company.name}</Link>], ['Created', fmtDate(project.createdAt)]]} />
              </div>
            </div>
          )}
          <Approvals projectId={id} />
          {staff && <TasksPanel projectId={id} />}
          <ProjectTimeline projectId={id} />
        </div>
      </div>
    </>
  );
}

