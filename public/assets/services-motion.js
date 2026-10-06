(() => {
  const root = document.querySelector('.ds-services');
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const groups = [...root.querySelectorAll('.ds-group')];
  const links = [...root.querySelectorAll('.ds-jump a')];
  const hero = root.querySelector('.ds-hero');
  const photo = root.querySelector('.ds-hero-art');
  const activeAnimations = new Set();
  const paused = () => reduced.matches || document.documentElement.classList.contains('motion-paused');
  function animate(el, frames, options) {
    if (paused() || !el.animate) return;
    const animation = el.animate(frames, options);
    activeAnimations.add(animation);
    animation.finished.then(() => activeAnimations.delete(animation), () => activeAnimations.delete(animation));
  }
  function reveal(el, delay = 0) {
    animate(el, [{opacity: .12, transform: 'translateY(28px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 750, delay, easing: 'cubic-bezier(.2,.65,.25,1)'});
  }
  [...root.querySelectorAll('.ds-hero-copy > *')].forEach((el, i) => reveal(el, i * 70));
  animate(photo, [{opacity: .25, transform: 'translateY(22px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 1000, easing: 'ease-out'});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        reveal(el, el.classList.contains('ds-card') ? ([...el.parentElement.children].indexOf(el) % 2) * 100 : 0);
        observer.unobserve(el);
      });
    }, {threshold: .08});
    root.querySelectorAll('.ds-intro, .ds-group-intro, .ds-card').forEach(el => observer.observe(el));
  }
  let scheduled = false;
  function update() {
    scheduled = false;
    const marker = Math.min(innerHeight * .42, 320);
    let current = -1;
    groups.forEach((group, i) => {if (group.getBoundingClientRect().top <= marker) current = i;});
    links.forEach((link, i) => {
      if(i === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
      const rect = groups[i].getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (marker - rect.top) / rect.height));
      link.style.setProperty('--stage-progress', `${progress * 100}%`);
    });
    const rect = hero.getBoundingClientRect();
    photo.style.setProperty('--image-shift', paused() ? '0px' : `${Math.max(-18, Math.min(26, -rect.top * .065))}px`);
  }
  function requestUpdate() {if (!scheduled) {scheduled = true; requestAnimationFrame(update);}}
  addEventListener('scroll', requestUpdate, {passive: true});
  addEventListener('resize', requestUpdate, {passive: true});
  root.querySelectorAll('.ds-card').forEach(card => {
    card.addEventListener('pointermove', e => {
      if (!fine.matches || paused()) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
    }, {passive: true});
  });
  function motionChanged() {
    if (paused()) activeAnimations.forEach(animation => animation.cancel());
    requestUpdate();
  }
  reduced.addEventListener('change', motionChanged);
  new MutationObserver(motionChanged).observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
  update();
})();
