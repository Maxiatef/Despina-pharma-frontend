(()=>{
 const directory=document.querySelector('[data-catalog]');
 if(directory){
  const grid=directory.querySelector('.product-grid'),cards=[...grid.querySelectorAll('[data-product]')];
  const search=document.getElementById('product-search'),category=document.getElementById('product-category'),kind=document.getElementById('product-kind'),sort=document.getElementById('product-sort'),source=document.getElementById('product-source'),count=document.getElementById('product-results'),empty=document.getElementById('catalog-empty'),pagination=document.getElementById('catalog-pagination'),prev=document.getElementById('catalog-prev'),next=document.getElementById('catalog-next'),pageLabel=document.getElementById('catalog-page');
  const params=new URLSearchParams(location.search);search.value=params.get('q')||'';if(category)category.value=params.get('category')||'';kind.value=params.get('kind')||'';if(source)source.value=params.get('source')||'';if(params.get('sort')==='za')sort.value='za';
  let page=Math.max(1,Number(params.get('page'))||1),pages=1;const size=24;
  function render(sync=true){
   const q=search.value.trim().toLocaleLowerCase(),tokens=q.split(/\s+/).filter(Boolean),cat=category?.value||directory.dataset.fixedCategory;
   const matches=cards.filter(c=>(!cat||c.dataset.category===cat)&&(!kind.value||c.dataset.kind===kind.value)&&(!source?.value||c.dataset.sources.split(' ').includes(source.value))&&tokens.every(t=>c.dataset.search.includes(t))).sort((a,b)=>(sort.value==='za'?-1:1)*a.dataset.name.localeCompare(b.dataset.name));
   pages=Math.max(1,Math.ceil(matches.length/size));page=Math.min(Math.max(1,page),pages);const visible=matches.slice((page-1)*size,page*size);
   cards.forEach(c=>c.hidden=true);visible.forEach(c=>{c.hidden=false;grid.append(c)});
   count.textContent=matches.length?`${matches.length} concepts · Showing ${(page-1)*size+1}–${Math.min(page*size,matches.length)}`:'0 matching concepts';empty.hidden=matches.length>0;pagination.hidden=matches.length<=size;prev.disabled=page===1;next.disabled=page===pages;pageLabel.textContent=`Page ${page} of ${pages}`;
   if(sync){const u=new URL(location.href);u.search='';if(search.value.trim())u.searchParams.set('q',search.value.trim());if(category?.value)u.searchParams.set('category',category.value);if(kind.value)u.searchParams.set('kind',kind.value);if(source?.value)u.searchParams.set('source',source.value);if(sort.value==='za')u.searchParams.set('sort','za');if(page>1)u.searchParams.set('page',page);history.replaceState(null,'',u.pathname+u.search+u.hash)}
  }
  [search,category,kind,sort,source].filter(Boolean).forEach(el=>el.addEventListener(el===search?'input':'change',()=>{page=1;render()}));
  document.getElementById('reset-products').addEventListener('click',()=>{search.value='';if(category)category.value='';kind.value='';if(source)source.value='';sort.value='az';page=1;render();search.focus()});
  [prev,next].forEach((b,i)=>b.addEventListener('click',()=>{page+=i?1:-1;render();directory.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});count.setAttribute('tabindex','-1');count.focus({preventScroll:true})}));render(false);
 }
 const form=document.querySelector('.project-form');if(form){document.querySelectorAll('[data-show-when]').forEach(group=>{const name=group.dataset.showWhen,value=group.dataset.showValue;const controls=[...form.elements].filter(f=>f.name===name);if(!controls.length)return;const update=()=>{const show=controls.some(c=>c.value===value&&(c.type!=='checkbox'||c.checked));group.hidden=!show;group.querySelectorAll('input,select,textarea').forEach(f=>f.disabled=!show)};controls.forEach(c=>c.addEventListener('change',update));update()})}
})();
