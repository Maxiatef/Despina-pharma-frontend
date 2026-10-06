(()=>{
 const section=document.querySelector('[data-scroll-worlds]');if(!section)return;
 const anchors=[...section.querySelectorAll('[data-world-anchor]')],links=[...section.querySelectorAll('[data-world-link]')],number=section.querySelector('[data-world-number]'),progress=section.querySelector('[data-world-progress]'),navigation=section.querySelector('.worlds-navigation');
 let scheduled=false;
 function update(){
  scheduled=false;
  const header=document.querySelector('.header'),headerHeight=header?.getBoundingClientRect().height||80;
  section.style.setProperty('--world-header',headerHeight+'px');
  const line=headerHeight+navigation.offsetHeight+Math.min(innerHeight*.25,200);
  let active=0;anchors.forEach((a,i)=>{if(a.getBoundingClientRect().top<=line)active=i});
  links.forEach((l,i)=>{if(i===active)l.setAttribute('aria-current','true');else l.removeAttribute('aria-current')});
  number.textContent=String(active+1).padStart(2,'0');
  const first=anchors[0].getBoundingClientRect().top,last=anchors.at(-1).getBoundingClientRect().top;
  const fraction=Math.max(0,Math.min(1,(line-first)/Math.max(1,last-first)));
  progress.style.transform=`scaleX(${fraction})`;
 }
 function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(update)}}
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue,{passive:true});addEventListener('pageshow',queue);
 if('ResizeObserver'in window){const ro=new ResizeObserver(queue);ro.observe(section);const header=document.querySelector('.header');if(header)ro.observe(header)}
 update();
})();
