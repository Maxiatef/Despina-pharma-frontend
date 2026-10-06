(()=>{
 if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const targets=document.querySelectorAll('.section-head,.category-card,.capability-layout,.faq-layout,.service-card,.story-step,.article-card,.three-columns article,.cta-inner');const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}})},{threshold:.08,rootMargin:'0px 0px 25px 0px'});targets.forEach(t=>{t.dataset.reveal='';observer.observe(t)});document.documentElement.classList.add('reveal-ready')}
 const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#main-nav');
 menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));menu.setAttribute('aria-label',open?'Open navigation':'Close navigation');nav.toggleAttribute('data-open',!open)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.hasAttribute('data-open')){nav.removeAttribute('data-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');menu.focus()}});
 document.querySelector('.motion-control')?.addEventListener('click',e=>{const paused=document.documentElement.classList.toggle('motion-paused');e.currentTarget.textContent=paused?'Resume motion':'Pause motion';e.currentTarget.setAttribute('aria-pressed',String(paused))});
 const stageButtons=[...document.querySelectorAll('[data-step]')];
 if(stageButtons.length){const detail=document.querySelector('.stage-copy');detail.id='process-detail';detail.setAttribute('role','tabpanel');detail.setAttribute('aria-labelledby','step-0');let stages;
 const selectStage=async(i)=>{try{stages??=await fetch('/assets/stages.json').then(r=>{if(!r.ok)throw Error();return r.json()});stageButtons.forEach((b,j)=>{b.setAttribute('aria-selected',String(i===j));b.tabIndex=i===j?0:-1});detail.setAttribute('aria-labelledby','step-'+i);document.querySelector('.stage-count').textContent=`0${i+1} / 05`;document.querySelector('#stage-title').textContent=stages[i].title;document.querySelector('#stage-copy').textContent=stages[i].copy;document.querySelector('#stage-output').textContent=stages[i].output}catch{document.querySelector('#stage-copy').textContent='Explore the full process page to read all five stages.'}};
 stageButtons.forEach((b,i)=>{b.addEventListener('click',()=>selectStage(i));b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%5;if(e.key==='ArrowLeft')next=(i+4)%5;if(e.key==='Home')next=0;if(e.key==='End')next=4;if(next!==undefined){e.preventDefault();stageButtons[next].focus();selectStage(next)}})});
 }
 const search=document.querySelector('#faq-search'),filters=[...document.querySelectorAll('[data-filter]')];let group='All';
 const filterFaq=()=>{let count=0;document.querySelectorAll('[data-faq-group]').forEach(d=>{const matches=(group==='All'||d.dataset.faqGroup===group)&&d.textContent.toLowerCase().includes(search.value.trim().toLowerCase());d.hidden=!matches;if(matches)count++});document.querySelector('#no-results').hidden=count!==0};
 if(search){search.addEventListener('input',filterFaq);filters.forEach(b=>b.addEventListener('click',()=>{group=b.dataset.filter;filters.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filterFaq()}))}
 const form=document.querySelector('.project-form');
 if(form){
  const params=new URLSearchParams(location.search),dialog=document.querySelector('.brief-dialog');let brief='';
  const formTitles={sample:'SAMPLE REVIEW',customer:'BRAND PROFILE',product:'PROJECT BRIEF',contact:'INQUIRY'};
  const formFiles={sample:'Sample-Review',customer:'Brand-Profile',product:'Project-Brief',contact:'Inquiry'};
  ['category','format','service','benchmark','benchmarkUrl'].forEach(name=>{const control=form.elements[name],value=params.get(name)?.slice(0,4000);if(!value||!control)return;if(control.tagName==='SELECT'){const match=[...control.options].find(o=>o.value.toLowerCase()===value.toLowerCase());if(match)control.value=match.value;else{const option=document.createElement('option');option.value=value;option.textContent=value;control.append(option);control.value=value}}else control.value=value;const details=control.closest('details');if(details)details.open=true});
  if(params.get('format')&&form.elements.productName&&!form.elements.productName.value)form.elements.productName.value=params.get('format').slice(0,4000);
  const namedFields=()=>[...form.elements].filter(f=>f.name);
  form.addEventListener('submit',e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const fields=namedFields(),values=new Map();
   for(const [key,raw] of new FormData(form).entries()){
    const value=typeof raw==='string'?raw.trim():raw.name?`${raw.name} (${raw.size.toLocaleString()} bytes; reference only, file not included)`:'';if(!value)continue;
    const label=fields.find(f=>f.name===key)?.dataset.label||key;
    if(values.has(label))values.get(label).push(value);else values.set(label,[value]);
   }
   brief='DESPINA PHARMA\n'+(formTitles[form.dataset.mode]||'PROJECT BRIEF')+'\nPrepared '+new Date().toLocaleDateString()+'\n\n'+[...values].map(([label,items])=>label.toUpperCase()+'\n'+items.join(', ')).join('\n\n')+'\n\nPrepared locally. This document has not been submitted to Despina Pharma.';
   document.querySelector('#brief-preview').textContent=brief;dialog.showModal();document.body.classList.add('modal-open');
  });
  document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close()}});
  document.querySelector('#download-brief').addEventListener('click',()=>{const blob=new Blob([brief],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Despina-Pharma-'+(formFiles[form.dataset.mode]||'Project-Brief')+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
  if(document.modelContext?.registerTool){
   const lifecycle=new AbortController(),fields=namedFields().filter(f=>f.type!=='file'),groups=new Map();fields.forEach(f=>{if(!groups.has(f.name))groups.set(f.name,[]);groups.get(f.name).push(f)});
   const properties=Object.fromEntries([...groups].map(([name,group])=>[name,group[0].type==='checkbox'?{type:'array',items:{type:'string',enum:group.map(f=>f.value)},uniqueItems:true}:{type:'string',maxLength:4000,...(group[0].tagName==='SELECT'?{enum:[...group[0].options].map(o=>o.value)}:{})}]));
   try{Promise.resolve(document.modelContext.registerTool({name:'prepare_local_project_brief',title:'Prepare a local Despina brief',description:'Fill this form and open the local review dialog. Does not send, store, attach or download any details.',inputSchema:{type:'object',properties,required:fields.filter(f=>f.required).map(f=>f.name),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Provide a details object.');
    for(const [key,value] of Object.entries(input)){const spec=properties[key];if(!spec)throw new Error('Unknown field: '+key);if(spec.type==='array'){if(!Array.isArray(value)||value.some(v=>!spec.items.enum.includes(v)))throw new Error('Choose listed options for '+key)}else if(typeof value!=='string'||value.length>4000||(spec.enum&&!spec.enum.includes(value)))throw new Error('Invalid value for '+key)}
    const previous=fields.map(f=>({value:f.value,checked:f.checked}));fields.forEach(f=>{if(f.type==='checkbox')f.checked=(input[f.name]||[]).includes(f.value);else f.value=input[f.name]||''});fields.forEach(f=>f.dispatchEvent(new Event('change',{bubbles:true})));
    if(!form.checkValidity()){fields.forEach((f,i)=>{if(f.type==='checkbox')f.checked=previous[i].checked;else f.value=previous[i].value});fields.forEach(f=>f.dispatchEvent(new Event('change',{bubbles:true})));throw new Error('Complete required fields and use valid email and website values.')}
    form.requestSubmit();return{status:'prepared_locally',submitted:false,brief};
   }},{signal:lifecycle.signal})).catch(()=>{});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true})}catch{}
  }
 }
})();
