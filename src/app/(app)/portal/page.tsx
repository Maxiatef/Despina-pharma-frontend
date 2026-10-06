'use client';

import Link from 'next/link';
import { Badge, Empty, ErrorBox, Loading, PageHead, fmtDate, useApi } from '@/components/app/ui';

interface Overview {
  projects: { id: string; code: string; name: string; status: string; updatedAt: string; currentStage: string | null }[];
  waitingForYou: {
    quotes: { id: string; projectId: string; quoteNo: string; status: string; updatedAt: string }[];
    samples: { id: string; title: string; status: string; project_id: string; product_name: string }[];
  };
}

export default function PortalHome() {
  const o = useApi<Overview>('/portal/overview');
  const me = useApi<{ contact: { firstName: string } | null; email: string }>('/portal/me');
  const name = me.data?.contact?.firstName ?? me.data?.email.split('@')[0];
  const waiting = (o.data?.waitingForYou.quotes.length ?? 0) + (o.data?.waitingForYou.samples.length ?? 0);

  return (
    <>
      <PageHead eyebrow="Your workspace" title={`Welcome${name ? `, ${name}` : ''}.`} sub="Follow your products from first brief to dispatch." />
      <ErrorBox error={o.error} onRetry={o.reload} />
      {o.loading && !o.data ? <Loading /> : o.data && (
        <div className="split">
          <div className="card">
            <div className="card-head"><h2>Your projects</h2><Link href="/portal/projects/">All projects</Link></div>
            <div className="card-body stack">
              {o.data.projects.map((p) => (
                <Link key={p.id} href={`/portal/projects/${p.id}/`} className="board-card" style={{ marginBottom: 0 }}>
                  <div className="row between"><b style={{ fontWeight: 500 }}>{p.name}</b><Badge value={p.status} /></div>
                  <div className="small muted">{p.code} · {p.currentStage ? `Now: ${p.currentStage}` : 'Getting started'} · updated {fmtDate(p.updatedAt)}</div>
                </Link>
              ))}
              {!o.data.projects.length && (
                <Empty>
                  No projects yet. Your Despina contact will open one with you.<br />
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- website page: separate root layout, full load intended */}
                  <a href="/new-product-profile/">Send a new product brief</a>
                </Empty>
              )}
            </div>
          </div>
          <div className="card pad">
            <h3>Waiting for you {waiting > 0 && <span className="badge warn">{waiting}</span>}</h3>
            <div style={{ marginTop: 10 }}>
              {o.data.waitingForYou.quotes.map((q) => (
                <Link key={q.id} href={`/portal/projects/${q.projectId}/`} className="board-card">Quote <span className="mono">{q.quoteNo}</span> is ready to review</Link>
              ))}
              {o.data.waitingForYou.samples.map((s) => (
                <Link key={s.id} href={`/portal/projects/${s.project_id}/`} className="board-card">Sample “{s.title}” ({s.product_name}) has shipped — tell us what you think</Link>
              ))}
              {!waiting && <p className="small muted">Nothing needs your attention right now.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
