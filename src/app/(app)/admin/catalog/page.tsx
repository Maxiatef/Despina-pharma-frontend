'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { patch, post, qs } from '@/lib/api';
import { CATALOG_KINDS } from '@/lib/types';
import type { CatalogCategory, CatalogItem, CatalogSource, Paged } from '@/lib/types';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHead, Pager, Tabs, formValues, humanize, useAction, useApi } from '@/components/app/ui';
import { useQueryState } from '@/components/app/useQueryState';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-');

function ItemForm({ item, categories, sources, onSaved }: { item?: CatalogItem; categories: CatalogCategory[]; sources: CatalogSource[]; onSaved: () => void }) {
  const { busy, run } = useAction();
  const [name, setName] = useState(item?.name ?? '');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body = {
      ...v,
      sourceId: v.sourceId || undefined,
      ingredients: typeof v.ingredients === 'string' ? v.ingredients.split('\n').map((x) => x.trim()).filter(Boolean) : [],
    };
    const ok = await run(() => (item ? patch(`/admin/catalog/items/${item.id}`, body) : post('/admin/catalog/items', body)), item ? 'Item saved' : 'Item created');
    if (ok) onSaved();
  }
  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="field full"><span>Name</span><input name="name" required maxLength={300} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Slug (URL)</span><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={item?.slug ?? ''} placeholder={slugify(name)} />
        <small className="hint">Changing it adds a redirect from the old URL automatically.</small></label>
      <label className="field"><span>Category</span>
        <select name="categoryId" defaultValue={item?.categoryId} required>{categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="field"><span>Kind</span>
        <select name="kind" defaultValue={item?.kind ?? 'concept'}>{CATALOG_KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</select></label>
      <label className="field"><span>Supplier reference</span>
        <select name="sourceId" defaultValue={item?.sourceId ?? ''}><option value="">None (Despina)</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field full"><span>Subgroup</span><input name="subgroup" defaultValue={item?.subgroup ?? ''} /></label>
      <label className="field full"><span>Ingredients (one per line)</span><textarea name="ingredients" rows={5} defaultValue={item?.ingredients?.join('\n') ?? ''} /></label>
      <label className="field full"><span>Notes</span><textarea name="notes" defaultValue={item?.notes ?? ''} /></label>
      <label className="field"><span>Image URL</span><input name="imageUrl" defaultValue={item?.imageUrl ?? ''} /></label>
      <label className="field"><span>SEO title</span><input name="seoTitle" maxLength={200} defaultValue={item?.seoTitle ?? ''} /></label>
      <label className="field full"><span>SEO description</span><textarea name="seoDescription" maxLength={400} rows={2} defaultValue={item?.seoDescription ?? ''} /></label>
      <label className="check full"><input type="checkbox" name="isPublished" defaultChecked={item?.isPublished ?? true} /> Published on the website</label>
      <div className="full"><button className="btn" disabled={busy}>{item ? 'Save' : 'Create'}</button></div>
    </form>
  );
}

function Items({ categories, sources }: { categories: CatalogCategory[]; sources: CatalogSource[] }) {
  const { values, set } = useQueryState();
  const [q, setQ] = useState(values.q ?? '');
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<CatalogItem>>(`/admin/catalog/items${qs({ q: values.q, category: values.category, kind: values.kind, source: values.source, page, pageSize: 25 })}`);
  const [edit, setEdit] = useState<CatalogItem | 'new' | null>(null);
  const full = useApi<CatalogItem>(edit && edit !== 'new' ? `/admin/catalog/items/${edit.id}` : null);
  return (
    <div className="card">
      <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
        <input className="input grow" type="search" placeholder="Search name, subgroup or ingredient…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={values.category ?? ''} onChange={(e) => set({ category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.slug}>{c.title}</option>)}
        </select>
        <select className="input" value={values.kind ?? ''} onChange={(e) => set({ kind: e.target.value })} aria-label="Kind">
          <option value="">All kinds</option>{CATALOG_KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}
        </select>
        <select className="input" value={values.source ?? ''} onChange={(e) => set({ source: e.target.value })} aria-label="Source">
          <option value="">All sources</option>{sources.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
        </select>
        <button className="btn secondary">Search</button>
        <button type="button" className="btn" onClick={() => setEdit('new')}>New item</button>
      </form>
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.loading && !list.data ? <Loading /> : list.data && (
        <>
          <table className="table">
            <thead><tr><th>Name</th><th>Category</th><th>Kind</th><th>Source</th><th>Website</th><th /></tr></thead>
            <tbody>
              {list.data.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}<div className="small muted">{i.subgroup}</div></td>
                  <td>{i.category?.title}</td>
                  <td><Badge value={i.kind} /></td>
                  <td className="small">{i.source?.name ?? 'Despina'}</td>
                  <td>{i.isPublished ? <a href={`/formulations/${i.category?.slug}/${i.slug}/`} target="_blank" rel="noreferrer">View</a> : <Badge value="hidden" tone="warn" />}</td>
                  <td><button className="btn small secondary" onClick={() => setEdit(i)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.data.items.length && <Empty>No items match.</Empty>}
          <Pager page={page} pageSize={25} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
        </>
      )}
      <Modal open={!!edit} title={edit === 'new' ? 'New catalog item' : 'Edit catalog item'} onClose={() => setEdit(null)}>
        {edit === 'new' ? <ItemForm categories={categories} sources={sources} onSaved={() => { setEdit(null); list.reload(); }} />
          : full.data ? <ItemForm item={full.data} categories={categories} sources={sources} onSaved={() => { setEdit(null); list.reload(); }} /> : <Loading />}
        <p className="small muted" style={{ marginTop: 12 }}>The public pages are built from the site generator; run <span className="mono">npm run import-site</span> after a content release to publish catalog changes.</p>
      </Modal>
    </div>
  );
}

function Categories({ categories, reload }: { categories: CatalogCategory[]; reload: () => void }) {
  const { busy, run } = useAction();
  const [edit, setEdit] = useState<CatalogCategory | 'new' | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body = { ...v, sortOrder: v.sortOrder ? Number(v.sortOrder) : undefined };
    const ok = await run(() => (edit && edit !== 'new' ? patch(`/admin/catalog/categories/${edit.id}`, body) : post('/admin/catalog/categories', body)), 'Category saved');
    if (ok) { setEdit(null); reload(); }
  }
  const cur = edit && edit !== 'new' ? edit : undefined;
  return (
    <div className="card">
      <div className="card-head"><h2>Categories</h2><button className="btn small" onClick={() => setEdit('new')}>New category</button></div>
      <table className="table">
        <thead><tr><th>Order</th><th>Title</th><th>Slug</th><th>Items</th><th>Status</th><th /></tr></thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}><td>{c.sortOrder}</td><td>{c.title}</td><td className="mono small">{c.slug}</td><td>{c.itemCount}</td>
              <td><Badge value={c.isPublished ? 'published' : 'hidden'} tone={c.isPublished ? 'ok' : 'warn'} /></td>
              <td><button className="btn small secondary" onClick={() => setEdit(c)}>Edit</button></td></tr>
          ))}
        </tbody>
      </table>
      <Modal open={!!edit} title={cur ? 'Edit category' : 'New category'} onClose={() => setEdit(null)}>
        <form className="form-grid" onSubmit={submit} key={cur?.id ?? 'new'}>
          <label className="field"><span>Title</span><input name="title" required defaultValue={cur?.title} /></label>
          <label className="field"><span>Slug</span><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={cur?.slug} /></label>
          <label className="field full"><span>Description</span><textarea name="description" defaultValue={cur?.description ?? ''} /></label>
          <label className="field"><span>Order</span><input name="sortOrder" type="number" defaultValue={cur?.sortOrder ?? 0} /></label>
          <label className="check"><input type="checkbox" name="isPublished" defaultChecked={cur?.isPublished ?? true} /> Published</label>
          <div className="full"><button className="btn" disabled={busy}>Save</button></div>
        </form>
      </Modal>
    </div>
  );
}

function Sources({ sources, reload }: { sources: CatalogSource[]; reload: () => void }) {
  const { busy, run } = useAction();
  const [edit, setEdit] = useState<CatalogSource | 'new' | null>(null);
  const cur = edit && edit !== 'new' ? edit : undefined;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = formValues(e.currentTarget);
    if (await run(() => (cur ? patch(`/admin/catalog/sources/${cur.id}`, body) : post('/admin/catalog/sources', body)), 'Source saved')) { setEdit(null); reload(); }
  }
  return (
    <div className="card">
      <div className="card-head"><h2>Manufacturer references</h2><button className="btn small" onClick={() => setEdit('new')}>New source</button></div>
      <p className="small muted" style={{ padding: '12px 20px 0' }}>Supplier catalogs used as references. Their products are not Despina inventory.</p>
      <table className="table">
        <thead><tr><th>Name</th><th>Code</th><th>Website</th><th /></tr></thead>
        <tbody>{sources.map((s) => <tr key={s.id}><td>{s.name}</td><td className="mono small">{s.code}</td><td className="small">{s.website}</td><td><button className="btn small secondary" onClick={() => setEdit(s)}>Edit</button></td></tr>)}</tbody>
      </table>
      <Modal open={!!edit} title={cur ? 'Edit source' : 'New source'} onClose={() => setEdit(null)}>
        <form className="stack" onSubmit={submit} key={cur?.id ?? 'new'}>
          <label className="field"><span>Name</span><input name="name" required defaultValue={cur?.name} /></label>
          <label className="field"><span>Code</span><input name="code" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={cur?.code} /></label>
          <label className="field"><span>Website</span><input name="website" type="url" defaultValue={cur?.website ?? ''} /></label>
          <button className="btn" disabled={busy}>Save</button>
        </form>
      </Modal>
    </div>
  );
}

function Catalog() {
  const { values, set } = useQueryState();
  const tab = (values.tab as 'items' | 'categories' | 'sources') ?? 'items';
  const categories = useApi<CatalogCategory[]>('/admin/catalog/categories');
  const sources = useApi<CatalogSource[]>('/admin/catalog/sources');
  return (
    <>
      <PageHead eyebrow="Website" title="Catalog" sub={`${categories.data?.reduce((s, c) => s + (c.itemCount ?? 0), 0) ?? '…'} items in ${categories.data?.length ?? '…'} categories`} />
      <Tabs value={tab} onChange={(t) => set({ tab: t === 'items' ? undefined : t, q: undefined, category: undefined, kind: undefined, source: undefined })}
        tabs={[{ key: 'items', label: 'Items' }, { key: 'categories', label: 'Categories' }, { key: 'sources', label: 'Sources' }]} />
      <ErrorBox error={categories.error ?? sources.error} />
      {!categories.data || !sources.data ? <Loading /> : (
        tab === 'items' ? <Items categories={categories.data} sources={sources.data} />
          : tab === 'categories' ? <Categories categories={categories.data} reload={categories.reload} />
            : <Sources sources={sources.data} reload={sources.reload} />
      )}
    </>
  );
}

export default function CatalogPage() {
  return <Suspense fallback={<Loading />}><Catalog /></Suspense>;
}
