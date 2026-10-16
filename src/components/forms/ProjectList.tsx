'use client';

import { useEffect } from 'react';

/**
 * "Project list" (plan §7): visitors collect product concepts while browsing and send them together
 * with the product brief. A development brief, not a shopping cart. Kept in this browser only.
 */
export interface ListedConcept { path: string; name: string; category: string }

const KEY = 'dp-project-list';
const MAX = 20;

export function readList(): ListedConcept[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.path === 'string' && typeof x.name === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function writeList(list: ListedConcept[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* private mode: the list simply is not kept */
  }
}

/** Product page: a text link beside "Explore the category" that adds / removes this concept. */
export function ProjectListButton() {
  useEffect(() => {
    const actions = document.querySelector('.concept-hero-grid .hero-actions');
    const h1 = document.querySelector('.concept-hero-grid h1');
    if (!actions || !h1 || actions.querySelector('.project-list-link')) return;
    const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
    const name = (h1.firstChild?.textContent ?? h1.textContent ?? '').trim();
    const category = document.querySelector('.concept-hero-grid .catalog-chips span')?.textContent?.trim() ?? '';
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'text-link project-list-link';
    link.style.cssText = 'background:none;border:0;padding:0;cursor:pointer;font:inherit';
    const view = document.createElement('a');
    view.className = 'text-link';
    view.href = '/new-product-profile/?list=1';
    view.textContent = 'Send my project list';
    const sync = () => {
      const list = readList();
      const listed = list.some((x) => x.path === path);
      link.textContent = listed ? '✓ In your project list (remove)' : '+ Add to project list';
      link.setAttribute('aria-pressed', String(listed));
      view.hidden = !list.length;
      view.textContent = `Send my project list (${list.length})`;
    };
    link.addEventListener('click', () => {
      const list = readList();
      const listed = list.some((x) => x.path === path);
      if (!listed && list.length >= MAX) { link.textContent = `Your list is full (${MAX})`; return; }
      writeList(listed ? list.filter((x) => x.path !== path) : [...list, { path, name, category }]);
      sync();
    });
    actions.append(link, view);
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); link.remove(); view.remove(); };
  }, []);
  return null;
}
