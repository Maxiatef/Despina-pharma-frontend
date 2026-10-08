'use client';

import { useEffect } from 'react';
import { ApiError, get, post, qs, uploadFile } from '@/lib/api';

/**
 * Connects the site's original project forms (form[data-project-form]) to the backend.
 *
 * The form, its fields, the review dialog and their styles stay exactly as designed.
 * This only:
 *  - replaces the "prepare locally" submit with a real submission to POST /api/inquiries
 *    (plus file upload for attachments), showing the reference number in the same dialog;
 *  - adds the privacy consent checkbox the backend requires, using the forms' own markup;
 *  - adds an invisible honeypot field against spam bots;
 *  - updates the copy that said nothing is sent.
 */
type Mode = 'contact' | 'customer' | 'product' | 'sample' | 'sample_request';

const BUTTON_TEXT: Record<Mode, string> = {
  contact: 'Send inquiry',
  customer: 'Send company profile',
  product: 'Send product brief',
  sample: 'Send sample review',
  sample_request: 'Send sample request',
};
const TITLES: Record<Mode, string> = {
  sample: 'SAMPLE REVIEW', customer: 'BRAND PROFILE', product: 'PROJECT BRIEF', contact: 'INQUIRY', sample_request: 'SAMPLE REQUEST',
};
const FILES: Record<Mode, string> = {
  sample: 'Sample-Review', customer: 'Brand-Profile', product: 'Project-Brief', contact: 'Inquiry', sample_request: 'Sample-Request',
};

/** Contact-form topics: [API code, label shown]. Some point to a more detailed form. */
const INQUIRY_TYPES: [code: string, label: string, form?: [href: string, text: string]][] = [
  ['general', 'General question'],
  ['new_product', 'New product development', ['/new-product-profile/', 'For a full product brief, use the product brief form']],
  ['private_label', 'Private label / stock formula', ['/products/', 'Browse the product library to pick a starting point']],
  ['sample_request', 'Sample request', ['/sample-request/', 'Use the sample request form to add the shipping details']],
  ['quotation', 'Quotation / pricing', ['/new-product-profile/', 'A product brief helps us quote accurately']],
  ['packaging_filling', 'Packaging & filling'],
  ['existing_project', 'Existing project', ['/login/', 'Customers with a workspace can also message us there']],
  ['partnership', 'Partnership / supplier'],
  ['other', 'Other'],
];
const POLICY_VERSION = '2026-10';
const SKIP = new Set(['_privacy', '_marketing', '_hp']);

interface Collected {
  fields: Record<string, string | string[]>;
  labels: Record<string, string>;
  files: File[];
  brief: string;
}

function collect(form: HTMLFormElement, mode: Mode, reference?: string): Collected {
  const fields: Record<string, string | string[]> = {};
  const labels: Record<string, string> = {};
  const byLabel = new Map<string, string[]>();
  const files: File[] = [];
  for (const [key, raw] of new FormData(form).entries()) {
    if (SKIP.has(key)) continue;
    const control = form.elements.namedItem(key) as HTMLInputElement | RadioNodeList | null;
    const el = control instanceof RadioNodeList ? (control[0] as HTMLInputElement) : control;
    const label = el?.dataset?.label ?? key;
    let value: string;
    if (raw instanceof File) {
      if (!raw.name || !raw.size) continue;
      files.push(raw);
      value = raw.name;
    } else {
      value = raw.trim();
    }
    if (!value) continue;
    labels[key] = label;
    const prev = fields[key];
    fields[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
    byLabel.set(label, [...(byLabel.get(label) ?? []), value]);
  }
  const brief =
    `DESPINA PHARMA\n${TITLES[mode]}\nPrepared ${new Date().toLocaleDateString()}\n` +
    (reference ? `Reference ${reference}\n` : '') +
    '\n' +
    [...byLabel].map(([label, items]) => `${label.toUpperCase()}\n${items.join(', ')}`).join('\n\n') +
    (reference ? '\n\nSent to Despina Pharma.' : '\n\nNot sent yet.');
  return { fields, labels, files, brief };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Product context: the formulation page the visitor came from, or category + product name in the URL. */
async function catalogItems(params: URLSearchParams): Promise<{ catalogPath?: string; catalogItemId?: string }[]> {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    const m = ref && ref.origin === location.origin ? ref.pathname.match(/^\/formulations\/([^/]+)\/([^/]+)\/$/) : null;
    if (m) return [{ catalogPath: `${m[1]}/${m[2]}` }];
    const name = params.get('format');
    const categoryTitle = params.get('category');
    if (!name) return [];
    const cats = await get<{ slug: string; title: string }[]>('/public/catalog/categories');
    const cat = cats.find((c) => c.title.toLowerCase() === categoryTitle?.toLowerCase());
    const found = await get<{ items: { id: string; name: string }[] }>(
      `/public/catalog/items${qs({ q: name, category: cat?.slug, pageSize: 10 })}`,
    );
    const exact = found.items.find((i) => i.name.toLowerCase() === name.toLowerCase());
    return exact ? [{ catalogItemId: exact.id }] : [];
  } catch {
    return [];
  }
}

async function serviceSlug(title: string): Promise<string | undefined> {
  try {
    const services = await get<{ slug: string; title: string }[]>('/public/services');
    return services.find((s) => s.title.toLowerCase() === title.trim().toLowerCase())?.slug;
  } catch {
    return undefined;
  }
}

function addConsentAndHoneypot(form: HTMLFormElement) {
  if (form.querySelector('[name="_privacy"]')) return;
  const bottom = form.querySelector('.form-bottom');
  const section = document.createElement('fieldset');
  section.className = 'resource-form-section';
  section.innerHTML =
    '<legend>Consent</legend><div class="form-grid"><fieldset class="field full choice-group"><legend>Before you send</legend><div class="choice-options">' +
    '<label><input type="checkbox" name="_privacy" required data-label="Privacy"> <span>I agree that Despina Pharma may store and use these details to reply to my request, as described in the <a href="/privacy-policy/" target="_blank" rel="noopener" style="color:#007f9e;text-decoration:underline;text-underline-offset:3px;font-weight:500">privacy notice</a>. <span>*</span></span></label>' +
    '<label><input type="checkbox" name="_marketing" data-label="News"> <span>Send me occasional news from Despina Pharma (optional).</span></label>' +
    '</div></fieldset></div>';
  form.insertBefore(section, bottom);

  const trap = document.createElement('div');
  trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden';
  trap.innerHTML = '<label>Leave this field empty<input type="text" name="_hp" tabindex="-1" autocomplete="off"></label>';
  form.append(trap);
}

/** The brief can only be sent after the privacy consent box is ticked. */
function requireConsent(form: HTMLFormElement): () => void {
  const box = form.querySelector<HTMLInputElement>('[name="_privacy"]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!box || !button) return () => {};
  let hint = form.querySelector<HTMLParagraphElement>('.consent-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'consent-hint';
    hint.style.cssText = 'margin:10px 0 0;font-size:.84rem;color:#9a5b00';
    hint.textContent = 'Please tick the privacy consent above to send your brief.';
    button.insertAdjacentElement('afterend', hint);
  }
  const sync = () => {
    button.disabled = !box.checked;
    button.style.opacity = box.checked ? '' : '0.45';
    button.style.cursor = box.checked ? '' : 'not-allowed';
    button.title = box.checked ? '' : 'Tick the privacy consent to send';
    hint!.hidden = box.checked;
  };
  box.addEventListener('change', sync);
  sync();
  return () => box.removeEventListener('change', sync);
}

/** Contact form: required "Inquiry type" select (pre-selected from ?type=), with a link to the matching detailed form. */
function addInquiryType(form: HTMLFormElement, params: URLSearchParams) {
  if (form.querySelector('[name="inquiryType"]')) return;
  const before = form.querySelector('textarea[name="message"]')?.closest('label');
  if (!before) return;
  const label = document.createElement('label');
  label.className = 'field full';
  label.innerHTML =
    'Inquiry type <span>*</span><select data-label="Inquiry type" name="inquiryType" required><option value="">Choose an option</option>' +
    INQUIRY_TYPES.map(([code, text]) => `<option value="${text}" data-code="${code}">${text}</option>`).join('') +
    '</select><small class="inquiry-type-hint"></small>';
  before.before(label);
  const select = label.querySelector('select')!;
  const hint = label.querySelector<HTMLElement>('.inquiry-type-hint')!;
  hint.style.cssText = 'margin-top:6px;font-size:.84rem';
  const sync = () => {
    const target = INQUIRY_TYPES.find(([, text]) => text === select.value)?.[2];
    hint.style.display = target ? 'block' : 'none';
    if (target) hint.innerHTML = `${target[1]}: <a href="${target[0]}" style="color:#007f9e;text-decoration:underline;text-underline-offset:3px">open it</a>`;
  };
  select.addEventListener('change', sync);
  const wanted = params.get('type')?.toLowerCase();
  const preset = INQUIRY_TYPES.find(([code, text]) => code === wanted || text.toLowerCase() === wanted);
  if (preset) select.value = preset[1];
  sync();
}

/** Sample request: pre-fill the product from ?product= or ?format= (links from product pages). */
function prefillSampleRequest(form: HTMLFormElement, params: URLSearchParams) {
  const product = params.get('product') || params.get('format');
  const input = form.querySelector<HTMLInputElement>('[name="productName"]');
  if (product && input && !input.value) input.value = product;
  const category = params.get('category');
  const select = form.querySelector<HTMLSelectElement>('[name="category"]');
  const match = category && select && [...select.options].find((o) => o.value.toLowerCase() === category.toLowerCase());
  if (match) select!.value = match.value;
}

function updateCopy(form: HTMLFormElement, mode: Mode) {
  const note = form.querySelector('.form-bottom p');
  if (note) note.textContent = 'When you send this form, your details go securely to the Despina Pharma team. You will get a reference number and a confirmation email.';
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.textContent = BUTTON_TEXT[mode];
  form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
    input.accept = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx';
    const hint = input.parentElement?.querySelector('small');
    if (hint) hint.textContent = 'Optional. PDF, JPG, PNG, DOCX or XLSX, up to 10 MB. The file is sent securely with your review.';
  });
}

function idempotencyKey(): string {
  const k = `dp-idem:${location.pathname}`;
  try {
    const existing = sessionStorage.getItem(k);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(k, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function clearIdempotencyKey() {
  try {
    sessionStorage.removeItem(`dp-idem:${location.pathname}`);
  } catch {
    /* ignore */
  }
}

export function FormConnector() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>('form[data-project-form]');
    const dialog = document.querySelector<HTMLDialogElement>('.brief-dialog');
    if (!form || !dialog) return;
    const mode = (form.dataset.mode as Mode) ?? 'contact';
    const params = new URLSearchParams(location.search);
    if (mode === 'contact') addInquiryType(form, params);
    if (mode === 'sample_request') prefillSampleRequest(form, params);
    addConsentAndHoneypot(form);
    updateCopy(form, mode);
    const stopConsent = requireConsent(form);

    const eyebrow = dialog.querySelector('.eyebrow');
    const title = dialog.querySelector('h2');
    const text = dialog.querySelector('p');
    const preview = dialog.querySelector<HTMLPreElement>('#brief-preview');
    // Replace the download button so it downloads *our* brief (the original handler keeps its own copy).
    const oldDownload = dialog.querySelector<HTMLButtonElement>('#download-brief');
    const download = oldDownload?.cloneNode(true) as HTMLButtonElement | undefined;
    if (oldDownload && download) oldDownload.replaceWith(download);
    let briefText = '';
    const onDownload = () => {
      const url = URL.createObjectURL(new Blob([briefText], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Despina-Pharma-${FILES[mode]}.txt`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    download?.addEventListener('click', onDownload);
    if (download) download.textContent = 'Download a copy';

    const show = (state: { eyebrow: string; title: string; html: string; brief: string }) => {
      if (eyebrow) eyebrow.textContent = state.eyebrow;
      if (title) title.textContent = state.title;
      if (text) text.innerHTML = state.html;
      if (preview) preview.textContent = state.brief;
      briefText = state.brief;
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('modal-open');
    };

    let sending = false;
    const onSubmit = async (e: Event) => {
      if (e.target !== form) return;
      // Run instead of the original "prepare locally" handler.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (sending || !form.reportValidity()) return;
      sending = true;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const label = button?.textContent ?? '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending…';
      }
      const data = collect(form, mode);
      try {
        const [given, ...rest] = first(data.fields.name).split(/\s+/);
        const companyName = first(data.fields.company) || first(data.fields.brandName);
        const service = params.get('service') || first(data.fields.service);
        const items: Record<string, unknown>[] = mode === 'product' || mode === 'sample_request' ? await catalogItems(params) : [];
        const slug = service ? await serviceSlug(service) : undefined;
        if (slug) items.push({ serviceSlug: slug });
        const uploads = [];
        for (const file of data.files) uploads.push(await uploadFile(file));

        const formType =
          mode === 'contact' ? 'contact'
          : mode === 'customer' ? 'new_customer'
          : mode === 'sample' ? 'sample_feedback'
          : mode === 'sample_request' ? 'sample_request'
          : service && !items.some((i) => i.catalogPath || i.catalogItemId) ? 'service'
          : 'new_product';
        const inquiryType = mode === 'contact'
          ? INQUIRY_TYPES.find(([, text]) => text === first(data.fields.inquiryType))?.[0]
          : undefined;
        const message =
          first(data.fields.message) || first(data.fields.idea) || first(data.fields.observations) ||
          first(data.fields.brand) || first(data.fields.comments) || undefined;

        const result = await post<{ referenceNo: string; duplicate: boolean }>('/inquiries', {
          formType,
          inquiryType,
          idempotencyKey: idempotencyKey(),
          contact: {
            firstName: given || first(data.fields.email),
            lastName: rest.join(' ') || undefined,
            email: first(data.fields.email),
            phone: first(data.fields.phone) || first(data.fields.mobile) || undefined,
          },
          company: companyName ? { name: companyName, website: first(data.fields.website) || undefined } : undefined,
          message,
          payload: { form: mode, fields: data.fields, labels: data.labels },
          sourcePage: `${location.pathname}${location.search}`.slice(0, 500),
          items: items.length ? items : undefined,
          uploads: uploads.length ? uploads.map((u) => ({ documentId: u.documentId, token: u.token })) : undefined,
          consent: {
            privacy: (form.elements.namedItem('_privacy') as HTMLInputElement).checked,
            marketing: (form.elements.namedItem('_marketing') as HTMLInputElement).checked,
            policyVersion: POLICY_VERSION,
          },
          hp: (form.elements.namedItem('_hp') as HTMLInputElement).value || undefined,
        });
        const sent = collect(form, mode, result.referenceNo);
        clearIdempotencyKey();
        form.reset();
        show({
          eyebrow: 'SENT',
          title: 'Thank you. We have your details.',
          html: `Your reference number is <strong>${result.referenceNo}</strong>. A confirmation email is on its way, and our team will reply soon. You can keep a copy below.`,
          brief: sent.brief,
        });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Check your connection and try again.';
        show({
          eyebrow: 'NOT SENT YET',
          title: 'We couldn’t send this.',
          html: `${escapeHtml(msg)}<br>Your entries are still in the form, so you can try again — or download the brief and share it with your Despina contact.`,
          brief: data.brief,
        });
      } finally {
        sending = false;
        if (button) button.textContent = label;
        // Re-apply the consent rule (form.reset() unticks the box after a successful send).
        (form.querySelector('[name="_privacy"]') as HTMLInputElement | null)?.dispatchEvent(new Event('change'));
      }
    };
    // Capture phase on document runs before the original handler on the form.
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('submit', onSubmit, true);
      stopConsent();
      download?.removeEventListener('click', onDownload);
    };
  }, []);

  return null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
