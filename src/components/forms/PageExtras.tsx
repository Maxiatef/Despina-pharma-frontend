'use client';

import { useEffect } from 'react';

/**
 * Small additions to the imported pages, using their own markup and classes:
 *  - /forms/   lists every form (adds "Ask a question" and "Request a sample") and corrects the
 *              "nothing is submitted" note – the forms are sent to the team now;
 *  - /contact/ adds the sample request next to the three existing options.
 * The served HTML stays identical to the design export (verify-site); this runs in the browser.
 */
const FORM_CARDS = [
  ['04', 'Ask a question', 'Send a short question with its topic – product, pricing, packaging, an existing project or anything else.', '/contact/', 'Send a question'],
  ['05', 'Request a sample', 'Name the product or library reference you want to evaluate and where we should send it.', '/sample-request/', 'Request a sample'],
] as const;

const icon = (paths: string) =>
  `<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const CONTACT_ICONS = {
  flask: icon('<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>'),
  tag: icon('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>'),
  review: icon('<path d="M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l4 4v4"/><path d="M8 9h5M8 13h3"/><circle cx="17" cy="17" r="4"/><path d="m15.5 17 1 1 2-2"/>'),
  box: icon('<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
};

export function PageExtras({ route }: { route: string }) {
  useEffect(() => {
    if (route === '/forms/') {
      const grid = document.querySelector('.form-cards');
      if (grid && !grid.querySelector('[data-extra]')) {
        for (const [index, title, text, href, cta] of FORM_CARDS) {
          const card = document.createElement('article');
          card.dataset.extra = '';
          card.innerHTML = `<span class="index">${index}</span><h2>${title}</h2><p>${text}</p><a class="button secondary" href="${href}">${cta}</a>`;
          grid.append(card);
        }
      }
      const note = [...document.querySelectorAll('.section-head p')].find((p) => p.textContent?.includes('processed on your device'));
      if (note) note.textContent = 'Each form is sent securely to the Despina Pharma team. You get a reference number straight away, and the team follows up on every request.';
    }
    if (route === '/contact/') {
      const options = document.querySelector('.contact-options');
      if (options && !options.querySelector('[data-extra]')) {
        const a = document.createElement('a');
        a.href = '/sample-request/';
        a.dataset.extra = '';
        a.innerHTML = '<span class="index">04</span><h2>A sample to request</h2><p>Name the product you want to try and where to send it.</p><span class="text-link">Request a sample</span>';
        options.append(a);
        // Line icons and specific button labels, one per card in order.
        const extras = [
          [CONTACT_ICONS.flask, 'Start a product brief'],
          [CONTACT_ICONS.tag, 'Create a brand profile'],
          [CONTACT_ICONS.review, 'Submit sample feedback'],
          [CONTACT_ICONS.box, 'Request a sample'],
        ];
        options.querySelectorAll(':scope > a').forEach((card, i) => {
          if (!extras[i] || card.querySelector('.card-icon')) return;
          card.insertAdjacentHTML('afterbegin', extras[i][0]);
          const cta = card.querySelector('.text-link');
          if (cta) cta.textContent = extras[i][1];
        });
      }
    }
  }, [route]);
  return null;
}
