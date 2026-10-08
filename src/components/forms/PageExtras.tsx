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
      }
    }
  }, [route]);
  return null;
}
