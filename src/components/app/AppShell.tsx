'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth, useAuth } from './auth';
import { useApi, humanize } from './ui';
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

function Side({ nav, open, onNavigate }: { nav: NavGroup[]; open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { me, logout } = useAuth();
  const isActive = (href: string) => (href === '/admin/' || href === '/portal/' ? pathname === href : pathname.startsWith(href));
  return (
    <aside className={`side ${open ? 'open' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- website page: separate root layout, full load intended */}
      <a className="brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG logo */}
        <img src="/assets/logo.svg" alt="" />
        <span>Despina<small>{me?.role === 'customer' ? 'WORKSPACE' : 'TEAM'}</small></span>
      </a>
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
                  {!!i.count && <span className="count">{i.count}</span>}
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

function StaffFrame({ children }: { children: ReactNode }) {
  const summary = useApi<{ new: number }>('/inquiries/summary');
  return <Frame nav={staffNav(summary.data?.new)}>{children}</Frame>;
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
