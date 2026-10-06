'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, get } from '@/lib/api';

// ===================================================================== data hook
export interface ApiState<T> {
  data: T | undefined;
  error: string | null;
  status: number | null;
  loading: boolean;
  reload: () => void;
}

/** GET a backend path and keep it in state. Pass `null` to skip. Re-runs when the path changes. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [tick, setTick] = useState(0);
  const key = path ? `${path}#${tick}` : null;
  // `key` records which request the state belongs to; loading = the current request has not answered yet.
  const [state, setState] = useState<{ key: string | null; data?: T; error: string | null; status: number | null }>({ key: null, error: null, status: null });
  useEffect(() => {
    if (!path || !key) return;
    const ctrl = new AbortController();
    get<T>(path, ctrl.signal)
      .then((d) => setState({ key, data: d, error: null, status: 200 }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ key, data: s.data, error: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null }));
      });
    return () => ctrl.abort();
  }, [path, key]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, status: state.status, loading: !!key && state.key !== key, reload };
}

// ===================================================================== toasts
type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Run an API action with a busy flag and toasts. Returns the result, or undefined on error. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast(success);
        return r;
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'error');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { busy, run };
}

// ===================================================================== small pieces
export function Loading() {
  return <div className="loading"><span className="spinner" aria-label="Loading" /></div>;
}

export function ErrorBox({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="alert error row between">
      <span>{error}</span>
      {onRetry && <button className="btn small secondary" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

const TONE: Record<string, string> = {
  new: 'info', assigned: 'info', awaiting_customer: 'warn', qualified: 'navy', quoted: 'info', won: 'ok', lost: 'bad', closed: '',
  not_a_fit: 'bad', active: 'ok', on_hold: 'warn', completed: 'navy', cancelled: 'bad', draft: '', sent: 'info', accepted: 'ok',
  rejected: 'bad', expired: 'warn', requested: 'info', in_development: 'warn', shipped: 'info', feedback_received: 'navy',
  approved: 'ok', queued: 'warn', sending: 'info', failed: 'bad', pending: 'warn', clean: 'ok', infected: 'bad', urgent: 'bad',
  high: 'warn', normal: '', low: '', internal: '', customer: 'info',
};

export function Badge({ value, tone }: { value: string | null | undefined; tone?: string }) {
  if (!value) return null;
  return <span className={`badge ${tone ?? TONE[value] ?? ''}`}>{humanize(value)}</span>;
}

export const humanize = (s: string) => s.replace(/[_-]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function fmtDate(d: string | Date | null | undefined, withTime = false) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString(undefined, withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtMoney(amount: string | number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
}

export function fmtBytes(n: string | number) {
  const b = Number(n);
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function PageHead({ eyebrow, title, sub, children }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>{total.toLocaleString()} total · page {page} of {pages}</span>
      <div className="row">
        <button className="btn small secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn small secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={t.key === value} className={t.key === value ? 'active' : ''} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Native <dialog> modal. */
export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onCancel={onClose}>
      {open && (
        <>
          <div className="modal-head">
            <h2>{title}</h2>
            <button type="button" aria-label="Close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function Field({ label, hint, children, full }: { label: ReactNode; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

/** Values of a <form> as a plain object (empty strings dropped, checkboxes → boolean). */
export function formValues(form: HTMLFormElement): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.value.trim() !== '') out[el.name] = el.value.trim();
  }
  return out;
}

export function Kv({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
