'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { post, qs } from '@/lib/api';
import { PROJECT_STATUSES } from '@/lib/types';
import type { Company, Paged, ProjectDetail, ProjectRow, StageTemplate } from '@/lib/types';
import { isStaff, useAuth } from './auth';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHead, Pager, fmtDate, humanize, useAction, useApi } from './ui';
import { useQueryState } from './useQueryState';

function NewProject({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [companyQ, setCompanyQ] = useState('');
  const companies = useApi<Paged<Company>>(open ? `/companies${qs({ q: companyQ, pageSize: 20 })}` : null);
  const templates = useApi<StageTemplate[]>(open ? '/stage-templates' : null);
  const { busy, run } = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = await run(() => post<ProjectDetail>('/projects', {
      companyId: f.get('companyId'), name: f.get('name'), stageTemplateId: f.get('stageTemplateId') || undefined,
    }), 'Project created');
    if (p) { setOpen(false); onCreated(p.id); }
  }
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>New project</button>
      <Modal open={open} title="New project" onClose={() => setOpen(false)}>
        <form className="stack" onSubmit={submit}>
          <label className="field"><span>Find company</span><input value={companyQ} onChange={(e) => setCompanyQ(e.target.value)} placeholder="Type to filter…" /></label>
          <label className="field"><span>Company</span>
            <select name="companyId" required>{companies.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>Project name</span><input name="name" required maxLength={200} /></label>
          <label className="field"><span>Stages</span>
            <select name="stageTemplateId"><option value="">Default template</option>{templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <button className="btn" disabled={busy}>Create project</button>
        </form>
      </Modal>
    </>
  );
}

function List({ base }: { base: '/admin/projects/' | '/portal/projects/' }) {
  const router = useRouter();
  const { me } = useAuth();
  const staff = isStaff(me?.role) && base === '/admin/projects/';
  const { values, set } = useQueryState();
  const [q, setQ] = useState(values.q ?? '');
  const page = Number(values.page ?? 1);
  const list = useApi<Paged<ProjectRow>>(`/projects${qs({ q: values.q, status: values.status, page, pageSize: 25 })}`);
  return (
    <>
      <PageHead eyebrow={staff ? 'Customers' : 'Workspace'} title="Projects" sub={staff ? 'All customer projects.' : 'Your projects with Despina Pharma.'}>
        {staff && <NewProject onCreated={(id) => router.push(`/admin/projects/${id}/`)} />}
      </PageHead>
      <div className="card">
        <form className="toolbar" style={{ padding: '14px 16px 0' }} onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
          <input className="input grow" type="search" placeholder="Search name, code or company…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={values.status ?? ''} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
          <button className="btn secondary">Search</button>
        </form>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Project</th>{staff && <th>Company</th>}<th>Stage</th><th>Status</th><th>Updated</th></tr></thead>
                <tbody>
                  {list.data.items.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => router.push(`${base}${p.id}/`)}>
                      <td><Link href={`${base}${p.id}/`} onClick={(e) => e.stopPropagation()}>{p.name}</Link><div className="mono small muted">{p.code}</div></td>
                      {staff && <td>{p.companyName}</td>}
                      <td>{p.currentStage ?? '—'}</td>
                      <td><Badge value={p.status} /></td>
                      <td className="muted small">{fmtDate(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!list.data.items.length && <Empty>{staff ? 'No projects yet. Convert a lead or create one.' : 'You have no projects yet. Your Despina contact will set one up with you.'}</Empty>}
            </div>
            <Pager page={page} pageSize={25} total={list.data.total} onPage={(p) => set({ page: String(p) }, false)} />
          </>
        )}
      </div>
    </>
  );
}

export function ProjectsList({ base }: { base: '/admin/projects/' | '/portal/projects/' }) {
  return <Suspense fallback={<Loading />}><List base={base} /></Suspense>;
}
