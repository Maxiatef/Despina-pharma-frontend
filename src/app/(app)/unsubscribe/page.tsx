'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { get } from '@/lib/api';
import { AuthLayout } from '@/components/app/AuthLayout';
import { Loading } from '@/components/app/ui';

/** One-click marketing opt-out from the link in our emails (/unsubscribe/?c=…&s=…). */
function Unsubscribe() {
  const params = useSearchParams();
  const c = params.get('c');
  const s = params.get('s');
  const [result, setResult] = useState<{ state: 'done' | 'error'; message: string } | null>(null);
  useEffect(() => {
    if (!c || !s) return;
    get<{ message: string }>(`/public/unsubscribe?c=${encodeURIComponent(c)}&s=${encodeURIComponent(s)}`)
      .then((r) => setResult({ state: 'done', message: r.message }))
      .catch((e: Error) => setResult({ state: 'error', message: e.message }));
  }, [c, s]);
  const { state, message } = !c || !s
    ? { state: 'error' as const, message: 'This link is incomplete.' }
    : result ?? { state: 'working' as const, message: '' };
  return (
    <AuthLayout eyebrow="EMAIL PREFERENCES" title={state === 'done' ? 'You are unsubscribed.' : 'Unsubscribe'}>
      {state === 'working' && <Loading />}
      {state !== 'working' && <div className={`alert ${state === 'done' ? 'success' : 'error'}`} style={{ marginTop: 22 }}>{message}</div>}
      <p className="small muted" style={{ marginTop: 16 }}>You will still receive replies about requests you send us.</p>
      <p style={{ marginTop: 16 }}>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- website page: separate root layout, full load intended */}
        <a href="/">Back to the website</a>
      </p>
    </AuthLayout>
  );
}

export default function UnsubscribePage() {
  return <Suspense><Unsubscribe /></Suspense>;
}
