/**
 * Browser client for the NestJS backend. All calls go to the same origin (/api/...),
 * which next.config.ts rewrites to BACKEND_URL, so the httpOnly login cookie just works.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
  }
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(' · ');
    if (typeof m === 'string') return m;
  }
  if (status === 429) return 'Too many requests, please try again later.';
  if (status >= 500) return 'The server had a problem. Please try again in a moment.';
  return `Request failed (${status})`;
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  raw?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  let body: BodyInit | undefined = opts.raw;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
    credentials: 'same-origin',
    signal: opts.signal,
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* plain text, e.g. CSV */
  }
  if (!res.ok) throw new ApiError(res.status, messageOf(data, res.status), data);
  return data as T;
}

export const get = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

/** Build a query string, skipping empty values. Arrays become repeated keys. */
export function qs(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => u.append(k, String(x)));
    else u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

export interface UploadedRef {
  documentId: string;
  token: string;
  versionId: string;
  sha256: string;
  scanStatus: string;
}

/** initiate → PUT bytes → complete. Works anonymously (inquiries) or logged in (projects). */
export async function uploadFile(
  file: File,
  extra: { projectId?: string; documentId?: string; title?: string; visibility?: 'internal' | 'customer' } = {},
): Promise<UploadedRef> {
  const mimeType = file.type || guessMime(file.name);
  const init = await post<{ documentId: string; uploadToken: string; uploadUrl: string }>('/uploads/initiate', {
    filename: file.name,
    mimeType,
    sizeBytes: file.size,
    ...extra,
  });
  const put = await api<{ versionId: string; sha256: string; scanStatus: string }>(`/uploads/${init.documentId}/content`, {
    method: 'PUT',
    raw: file,
    headers: { 'Content-Type': mimeType, 'X-Upload-Token': init.uploadToken, 'X-Filename': encodeURIComponent(file.name) },
  });
  await post('/uploads/complete', { documentId: init.documentId, token: init.uploadToken });
  return { documentId: init.documentId, token: init.uploadToken, ...put };
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split('.').pop();
  return (
    {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }[ext ?? ''] ?? 'application/octet-stream'
  );
}
