'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { del, patch, post } from '@/lib/api';
import type { Faq, Redirect, Service } from '@/lib/types';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHead, Tabs, formValues, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

function Services() {
  const list = useApi<Service[]>('/admin/services');
  const { busy, run } = useAction();
  const [edit, setEdit] = useState<Service | 'new' | null>(null);
  const cur = edit && edit !== 'new' ? edit : undefined;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body = { ...v, sortOrder: v.sortOrder ? Number(v.sortOrder) : undefined };
    if (await run(() => (cur ? patch(`/admin/services/${cur.id}`, body) : post('/admin/services', body)), 'Service saved')) { setEdit(null); list.reload(); }
  }
  return (
    <div className="card">
      <div className="card-head"><h2>Services</h2><button className="btn small" onClick={() => setEdit('new')}>New service</button></div>
      <ErrorBox error={list.error} onRetry={list.reload} />
      <table className="table">
        <thead><tr><th>Order</th><th>Title</th><th>Page</th><th>Status</th><th /></tr></thead>
        <tbody>{list.data?.map((s) => (
          <tr key={s.id}><td>{s.sortOrder}</td><td>{s.title}<div className="small muted">{s.summary?.slice(0, 90)}</div></td>
            <td><a href={`/${s.slug}/`} target="_blank" rel="noreferrer" className="mono small">/{s.slug}/</a></td>
            <td><Badge value={s.isPublished ? 'published' : 'hidden'} tone={s.isPublished ? 'ok' : 'warn'} /></td>
            <td><button className="btn small secondary" onClick={() => setEdit(s)}>Edit</button></td></tr>
        ))}</tbody>
      </table>
      <Modal open={!!edit} title={cur ? 'Edit service' : 'New service'} onClose={() => setEdit(null)}>
        <form className="form-grid" onSubmit={submit} key={cur?.id ?? 'new'}>
          <label className="field"><span>Title</span><input name="title" required defaultValue={cur?.title} /></label>
          <label className="field"><span>Slug</span><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={cur?.slug} /></label>
          <label className="field full"><span>Summary</span><textarea name="summary" rows={3} defaultValue={cur?.summary ?? ''} /></label>
          <label className="field full"><span>Body</span><textarea name="body" rows={8} defaultValue={cur?.body ?? ''} /></label>
          <label className="field"><span>Order</span><input name="sortOrder" type="number" defaultValue={cur?.sortOrder ?? 0} /></label>
          <label className="check"><input type="checkbox" name="isPublished" defaultChecked={cur?.isPublished ?? true} /> Published</label>
          <div className="full"><button className="btn" disabled={busy}>Save</button></div>
        </form>
      </Modal>
    </div>
  );
}

function Faqs() {
  const list = useApi<Faq[]>('/admin/faqs');
  const services = useApi<Service[]>('/admin/services');
  const { busy, run } = useAction();
  const [edit, setEdit] = useState<Faq | 'new' | null>(null);
  const cur = edit && edit !== 'new' ? edit : undefined;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body = { ...v, serviceId: v.serviceId || undefined, sortOrder: v.sortOrder ? Number(v.sortOrder) : undefined };
    if (await run(() => (cur ? patch(`/admin/faqs/${cur.id}`, body) : post('/admin/faqs', body)), 'FAQ saved')) { setEdit(null); list.reload(); }
  }
  return (
    <div className="card">
      <div className="card-head"><h2>FAQs</h2><button className="btn small" onClick={() => setEdit('new')}>New FAQ</button></div>
      <ErrorBox error={list.error} onRetry={list.reload} />
      <table className="table">
        <thead><tr><th>Question</th><th>Topic</th><th>Status</th><th /></tr></thead>
        <tbody>{list.data?.map((f) => (
          <tr key={f.id}><td>{f.question}<div className="small muted">{f.answer.slice(0, 120)}</div></td><td>{f.topic ?? '—'}</td>
            <td><Badge value={f.isPublished ? 'published' : 'hidden'} tone={f.isPublished ? 'ok' : 'warn'} /></td>
            <td><div className="row">
              <button className="btn small secondary" onClick={() => setEdit(f)}>Edit</button>
              <button className="btn small danger" disabled={busy} onClick={async () => { if (confirm('Delete this FAQ?') && await run(() => del(`/admin/faqs/${f.id}`), 'FAQ deleted')) list.reload(); }}>Delete</button>
            </div></td></tr>
        ))}</tbody>
      </table>
      {list.data && !list.data.length && <Empty>No FAQs yet. Add Despina’s own answers here (the research file holds competitor answers only).</Empty>}
      <Modal open={!!edit} title={cur ? 'Edit FAQ' : 'New FAQ'} onClose={() => setEdit(null)}>
        <form className="form-grid" onSubmit={submit} key={cur?.id ?? 'new'}>
          <label className="field full"><span>Question</span><input name="question" required defaultValue={cur?.question} /></label>
          <label className="field full"><span>Answer</span><textarea name="answer" rows={6} required defaultValue={cur?.answer} /></label>
          <label className="field"><span>Topic</span><input name="topic" defaultValue={cur?.topic ?? ''} /></label>
          <label className="field"><span>Service</span>
            <select name="serviceId" defaultValue={cur?.serviceId ?? ''}><option value="">General</option>{services.data?.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          <label className="field"><span>Order</span><input name="sortOrder" type="number" defaultValue={cur?.sortOrder ?? 0} /></label>
          <label className="check"><input type="checkbox" name="isPublished" defaultChecked={cur?.isPublished ?? true} /> Published</label>
          <div className="full"><button className="btn" disabled={busy}>Save</button></div>
        </form>
      </Modal>
    </div>
  );
}

function Redirects() {
  const list = useApi<Redirect[]>('/admin/redirects');
  const { busy, run } = useAction();
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const v = formValues(f);
    if (await run(() => post('/admin/redirects', { ...v, statusCode: Number(v.statusCode) }), 'Redirect added')) { f.reset(); list.reload(); }
  }
  return (
    <div className="card">
      <div className="card-head"><h2>Redirects</h2></div>
      <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={add}>
        <input className="input grow" name="fromPath" required pattern="/.*" placeholder="/old-url/" />
        <input className="input grow" name="toPath" required placeholder="/new-url/" />
        <select className="input" name="statusCode" defaultValue="301"><option value="301">301 permanent</option><option value="302">302 temporary</option></select>
        <button className="btn" disabled={busy}>Add redirect</button>
      </form>
      <table className="table">
        <thead><tr><th>From</th><th>To</th><th>Type</th><th /></tr></thead>
        <tbody>{list.data?.map((r) => (
          <tr key={r.id}><td className="mono small">{r.fromPath}</td><td className="mono small">{r.toPath}</td><td>{r.statusCode}</td>
            <td><button className="btn small danger" disabled={busy} onClick={async () => { if (await run(() => del(`/admin/redirects/${r.id}`), 'Redirect removed')) list.reload(); }}>Remove</button></td></tr>
        ))}</tbody>
      </table>
      {list.data && !list.data.length && <Empty>No redirects. They are added automatically when a catalog item or service slug changes.</Empty>}
    </div>
  );
}

function Content() {
  const { values, set } = useQueryState();
  const tab = (values.tab as 'services' | 'faqs' | 'redirects') ?? 'services';
  return (
    <>
      <PageHead eyebrow="Website" title="Services, FAQs & redirects" />
      <Tabs value={tab} onChange={(t) => set({ tab: t === 'services' ? undefined : t })}
        tabs={[{ key: 'services', label: 'Services' }, { key: 'faqs', label: 'FAQs' }, { key: 'redirects', label: 'Redirects' }]} />
      {tab === 'services' ? <Services /> : tab === 'faqs' ? <Faqs /> : <Redirects />}
    </>
  );
}

export default function ContentPage() {
  return <Suspense fallback={<Loading />}><Content /></Suspense>;
}
