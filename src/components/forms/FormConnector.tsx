'use client';

import { useEffect } from 'react';
import { ApiError, get, post, qs, uploadFile } from '@/lib/api';
import { readList, writeList } from './ProjectList';

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

/** Sample request and product brief: pre-fill the product from ?product= or ?format= (links from product pages). */
function prefillSampleRequest(form: HTMLFormElement, params: URLSearchParams) {
  const product = params.get('product') || params.get('format');
  const input = form.querySelector<HTMLInputElement>('[name="productName"]');
  if (product && input && !input.value) input.value = product;
  const category = params.get('category');
  const select = form.querySelector<HTMLSelectElement>('[name="category"]');
  const match = category && select && [...select.options].find((o) => o.value.toLowerCase() === category.toLowerCase());
  if (match) select!.value = match.value;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx';
const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;

/** Product brief: the concepts the visitor collected with "Add to project list" (sent as product lines). */
function addProjectList(form: HTMLFormElement): () => void {
  const bottom = form.querySelector('.form-bottom');
  const section = document.createElement('fieldset');
  section.className = 'resource-form-section project-list';
  const render = () => {
    const list = readList();
    section.hidden = !list.length;
    section.innerHTML = '<legend>Your project list</legend><div class="form-grid"><div class="field full"><small>These concepts are sent with your brief as starting points – not an order.</small><div class="catalog-chips" style="margin-top:8px"></div></div></div>';
    const chips = section.querySelector('.catalog-chips')!;
    for (const item of list) {
      const chip = document.createElement('span');
      chip.textContent = `${item.name}${item.category ? ` · ${item.category}` : ''} `;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${item.name} from the list`);
      remove.style.cssText = 'background:none;border:0;cursor:pointer;font:inherit;padding:0 2px';
      remove.addEventListener('click', () => { writeList(readList().filter((x) => x.path !== item.path)); render(); });
      chip.append(remove);
      chips.append(chip);
    }
  };
  form.insertBefore(section, form.querySelector('fieldset.resource-form-section:has(input[type="file"])') ?? bottom);
  render();
  return () => section.remove();
}

/** Forms without a file field get an optional "Attachments" field (never required). */
function addAttachments(form: HTMLFormElement) {
  if (form.querySelector('input[type="file"]')) return;
  const bottom = form.querySelector('.form-bottom');
  const section = document.createElement('fieldset');
  section.className = 'resource-form-section';
  section.innerHTML =
    '<legend>Attachments</legend><div class="form-grid"><label class="field full">Reference files (optional)' +
    `<input data-label="Attachments" name="attachments" type="file" multiple accept="${ACCEPT}"><small></small></label></div>`;
  form.insertBefore(section, bottom);
}

/** Checks the chosen files (count, size); empty is always fine. */
function checkFiles(form: HTMLFormElement): boolean {
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    const files = [...(input.files ?? [])];
    const msg =
      files.length > MAX_FILES ? `Please choose up to ${MAX_FILES} files.`
      : files.some((f) => f.size > MAX_BYTES) ? 'Each file must be 10 MB or smaller.'
      : '';
    input.setCustomValidity(msg);
  }
  return form.reportValidity();
}

function updateCopy(form: HTMLFormElement, mode: Mode) {
  const note = form.querySelector('.form-bottom p');
  if (note) note.textContent = 'When you send this form, your details go securely to the Despina Pharma team. You will get a reference number straight away.';
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.textContent = BUTTON_TEXT[mode];
  form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
    input.accept = ACCEPT;
    input.required = false;
    input.addEventListener('change', () => input.setCustomValidity(''));
    const hint = input.parentElement?.querySelector('small');
    if (hint) hint.textContent = `Optional. PDF, JPG, PNG, DOCX or XLSX, up to 10 MB each${input.multiple ? `, max ${MAX_FILES} files` : ''}. Files are sent securely with your form.`;
  });
}

/**
 * Asks before leaving the page once the visitor has typed something that was not sent yet
 * (closing the tab, reloading, or following a link). Returns a cleanup function with `.saved()` for after a send.
 */
function warnBeforeLeaving(form: HTMLFormElement) {
  let dirty = false;
  const onInput = (e: Event) => { if (e.isTrusted) dirty = true; };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  };
  const onClick = (e: MouseEvent) => {
    if (!dirty || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || a.hasAttribute('download') || !/^https?:$/.test(a.protocol)) return;
    if (a.pathname === location.pathname && a.search === location.search) return; // same page (e.g. #anchor)
    if (confirm('You have entries in this form that were not sent. Leave the page anyway?')) dirty = false;
    else { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('click', onClick, true);
  const stop = () => {
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('click', onClick, true);
  };
  return Object.assign(stop, { saved: () => { dirty = false; } });
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
    if (mode === 'sample_request' || mode === 'product') prefillSampleRequest(form, params);
    addAttachments(form);
    const stopList = mode === 'product' ? addProjectList(form) : () => {};
    addConsentAndHoneypot(form);
    updateCopy(form, mode);
    const stopConsent = requireConsent(form);
    const openedAt = Date.now();
    const stopUnsaved = warnBeforeLeaving(form);

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
      if (sending || !checkFiles(form)) return;
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
        const listed = mode === 'product' ? readList() : [];
        for (const l of listed) {
          const catalogPath = l.path.replace(/^\/formulations\//, '').replace(/\/$/, '');
          if (!items.some((i) => i.catalogPath === catalogPath)) items.push({ catalogPath });
        }
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

        const result = await post<{ referenceNo: string; duplicate: boolean; confirmationEmail?: boolean }>('/inquiries', {
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
          elapsedMs: Date.now() - openedAt,
        });
        const sent = collect(form, mode, result.referenceNo);
        clearIdempotencyKey();
        form.reset();
        stopUnsaved.saved();
        if (listed.length) writeList([]);
        show({
          eyebrow: 'SENT',
          title: 'Thank you. We have your details.',
          // Only promise an e-mail when the backend really sends one (e-mail connected and the confirmation switched on).
          html: `Your reference number is <strong>${result.referenceNo}</strong>. ${result.confirmationEmail ? 'A confirmation email is on its way, and our' : 'Our'} team will reply soon. You can keep a copy below.`,
          brief: sent.brief,
        });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Check your connection and try again.';
        const tracking = err instanceof ApiError && err.requestId && err.status >= 500
          ? `<br><small>If this keeps happening, quote this code to Despina: ${escapeHtml(err.requestId)}</small>` : '';
        show({
          eyebrow: 'NOT SENT YET',
          title: 'We couldn’t send this.',
          html: `${escapeHtml(msg)}<br>Your entries are still in the form, so you can try again — or download the brief and share it with your Despina contact.${tracking}`,
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
      stopList();
      stopUnsaved();
      download?.removeEventListener('click', onDownload);
    };
  }, []);

  return null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
