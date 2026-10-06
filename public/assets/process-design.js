(() => {
 const nav = document.querySelector('.dp-stage-nav');
 if (!nav || !('IntersectionObserver' in window)) return;
 const links = [...nav.querySelectorAll('a')];
 const stages = [...document.querySelectorAll('.dp-stage')];
 const progress = nav.querySelector('.dp-progress');
 const activate = (index) => {
   links.forEach((link, i) => i === index ? link.setAttribute('aria-current', 'step') : link.removeAttribute('aria-current'));
   progress.style.width = `${(index + 1) * 20}%`;
 };
 const observer = new IntersectionObserver(entries => {
   entries.forEach(entry => { if(entry.isIntersecting) activate(stages.indexOf(entry.target)); });
 }, {rootMargin: '-25% 0px -45% 0px', threshold: 0});
 stages.forEach(stage => observer.observe(stage));
 links.forEach((link,i) => link.addEventListener('click', () => activate(i)));
 activate(0);
})();
