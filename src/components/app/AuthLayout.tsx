import type { ReactNode } from 'react';

/** Two-column sign-in screen in the site's style (pearl banner image + navy). */
export function AuthLayout({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-art">
        <div>
          <span className="eyebrow" style={{ color: 'var(--cyan)' }}>DESPINA PHARMA · BEAUTY MEETS SCIENCE</span>
          <h2>The science of skincare.<br /><em>The art of manufacturing.</em></h2>
        </div>
      </div>
      <div className="auth-panel">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- website page: separate root layout, full load intended */}
        <a className="logo" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG logo */}
          <img src="/assets/logo.svg" width={34} height={37} alt="" /> Despina Pharma
        </a>
        <span className="eyebrow">{eyebrow}</span>
        <h1 style={{ marginTop: 8 }}>{title}</h1>
        {children}
      </div>
    </main>
  );
}
