'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth, useAuth } from './auth';
import { useApi, humanize, fmtDate } from './ui';
import { get, post } from '@/lib/api';
import { STAFF_ROLES } from '@/lib/types';
import type { UserRole } from '@/lib/types';

type NavItem = { href: string; label: string; roles?: UserRole[]; count?: number };
type NavGroup = { group: string; items: NavItem[] };

const ADMIN_ONLY: UserRole[] = ['admin'];
const EDITORS: UserRole[] = ['admin', 'sales'];

function staffNav(newLeads?: number): NavGroup[] {
  return [
    { group: 'Overview', items: [{ href: '/admin/', label: 'Dashboard' }] },
    {
      group: 'Leads',
      items: [
        { href: '/admin/inquiries/', label: 'Inquiries', count: newLeads },
        { href: '/admin/tasks/', label: 'Tasks' },
        { href: '/admin/waiting/', label: 'Waiting list' },
      ],
    },
    {
      group: 'Customers',
      items: [
        { href: '/admin/projects/', label: 'Projects' },
        { href: '/admin/companies/', label: 'Companies' },
        { href: '/admin/contacts/', label: 'Contacts' },
      ],
    },
    {
      group: 'Website',
      items: [
        { href: '/admin/catalog/', label: 'Catalog', roles: EDITORS },
        { href: '/admin/content/', label: 'Services & FAQs', roles: EDITORS },
      ],
    },
    {
      group: 'Settings',
      items: [
        { href: '/admin/users/', label: 'Users', roles: ADMIN_ONLY },
        { href: '/admin/stage-templates/', label: 'Project stages' },
        { href: '/admin/emails/', label: 'Email log' },
        { href: '/admin/settings/emails/', label: 'Email settings', roles: ADMIN_ONLY },
        { href: '/admin/settings/rules/', label: 'Lead rules', roles: ADMIN_ONLY },
        { href: '/admin/audit/', label: 'Audit log', roles: ADMIN_ONLY },
        { href: '/admin/account/', label: 'My account' },
      ],
    },
  ];
}

const PORTAL_NAV: NavGroup[] = [
  { group: 'Workspace', items: [{ href: '/portal/', label: 'Overview' }, { href: '/portal/projects/', label: 'Projects' }] },
  { group: 'You', items: [{ href: '/portal/account/', label: 'My account' }, { href: '/', label: 'Despina website' }] },
];

type Notice = { id: string; title: string; link: string | null; readAt: string | null; createdAt: string };

type Notices = { items: Notice[]; unread: number; unreadProjects: number };

/** Loads the signed-in person's notifications and checks again every minute. */
function useNotices(enabled: boolean) {
  const [data, setData] = useState<Notices | null>(null);
  const load = useCallback(() => { get<Notices>('/notifications').then(setData).catch(() => {}); }, []);
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [enabled, load]);
  return { data, setData, load };
}

/** The bell: new messages, documents, quotes, approvals… – the same events that are e-mailed. */
function Bell({ notices, onNavigate }: { notices: ReturnType<typeof useNotices>; onNavigate: () => void }) {
  const { data, setData, load } = notices;
  const [open, setOpen] = useState(false);
  async function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the list counts as reading it; the new ones stay highlighted until it is closed.
    if (next && data?.unread) { await post('/notifications/read', {}).catch(() => {}); setData({ ...data, unread: 0, unreadProjects: 0 }); }
    if (!next) load();
  }
  return (
    <div className="bell">
      <button className="bell-btn" onClick={toggle} aria-expanded={open}>
        <span>🔔 Notifications</span>
        {!!data?.unread && <span className="count">{data.unread}</span>}
      </button>
      {open && (
        <div className="bell-list">
          {!data?.items.length && <p className="muted small">Nothing yet. New messages, files and quotes will show here.</p>}
          {data?.items.map((n) => (
            <Link key={n.id} href={n.link ?? '#'} className={n.readAt ? '' : 'unread'} onClick={() => { setOpen(false); onNavigate(); load(); setTimeout(() => window.dispatchEvent(new Event('app:scroll-section')), 300); }}>
              <span>{n.title}</span>
              <small>{fmtDate(n.createdAt, true)}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Side({ nav, open, onNavigate }: { nav: NavGroup[]; open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { me, logout } = useAuth();
  const notices = useNotices(!!me && !me.mfaPending);
  const projectsUnread = notices.data?.unreadProjects;
  const isActive = (href: string) => (href === '/admin/' || href === '/portal/' ? pathname === href : pathname.startsWith(href));
  return (
    <aside className={`side ${open ? 'open' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- website page: separate root layout, full load intended */}
      <a className="brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG logo */}
        <img src="/assets/logo.svg" alt="" />
        <span>Despina<small>{me?.role === 'customer' ? 'WORKSPACE' : 'TEAM'}</small></span>
      </a>
      {me && !me.mfaPending && <Bell notices={notices} onNavigate={onNavigate} />}
      <nav aria-label="Workspace">
        {nav.map((g) => {
          const items = g.items.filter((i) => !i.roles || (me && i.roles.includes(me.role)));
          if (!items.length) return null;
          return (
            <div key={g.group} style={{ display: 'contents' }}>
              <span className="group">{g.group.toUpperCase()}</span>
              {items.map((i) => (
                <Link key={i.href} href={i.href} className={isActive(i.href) ? 'active' : ''} onClick={onNavigate}>
                  {i.label}
                  {/* New notifications about projects show on the Projects item too. */}
                  {!!(i.count ?? (i.href.endsWith('/projects/') ? projectsUnread : 0)) && (
                    <span className="count">{i.count ?? projectsUnread}</span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="who">
        <b>{me?.email}</b>
        <span className="muted">{me && humanize(me.role)}</span>
        <div><button onClick={logout}>Sign out</button></div>
      </div>
    </aside>
  );
}

function Frame({ nav, children }: { nav: NavGroup[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <Side nav={nav} open={open} onNavigate={() => setOpen(false)} />
      <div className="main">
        <div className="topbar">
          <span>Despina Pharma</span>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>Menu</button>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

const MFA_PENDING_NAV: NavGroup[] = [{ group: 'You', items: [{ href: '/admin/account/', label: 'My account' }] }];

function StaffFrame({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  // One tree in both cases, so the page (e.g. the new backup codes) stays when two-factor login turns on.
  const summary = useApi<{ new: number }>(me?.mfaPending ? null : '/inquiries/summary');
  return <Frame nav={me?.mfaPending ? MFA_PENDING_NAV : staffNav(summary.data?.new)}>{children}</Frame>;
}

/** Staff dashboard frame (/admin/*). */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth roles={STAFF_ROLES}>
      <StaffFrame>{children}</StaffFrame>
    </RequireAuth>
  );
}

/** Customer workspace frame (/portal/*). Staff can open it too (e.g. to see what customers see). */
export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Frame nav={PORTAL_NAV}>{children}</Frame>
    </RequireAuth>
  );
}
