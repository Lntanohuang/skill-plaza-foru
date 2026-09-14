/* Local, dependency-free adaptation of the FORU skill's starter. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => `<svg viewBox="0 0 56 56" aria-hidden="true"><use href="#foru-${name}"/></svg>`;
  const iconNames = {foru:'projects',page:'learning',diagram:'projects',site:'building',research:'assessment',video:'jobs',model:'assessment'};
  const roles = [
    {id:'creator',label:'创作者',icon:'learning',items:[['foru-web-ui','平台页面'],['deepseek-homepage-ui','产品首页'],['architecture-diagram','系统架构图'],['remotion-voice-sync','旁白视频']]},
    {id:'developer',label:'开发者',icon:'projects',items:[['sites-building','网站构建'],['architecture-diagram','系统设计'],['hugging-face-model-trainer','模型训练']]},
    {id:'researcher',label:'研究者',icon:'assessment',items:[['deep-research','证据研究'],['hugging-face-model-trainer','数据与训练']]},
    {id:'team',label:'团队',icon:'team',items:[['architecture-diagram','架构沟通'],['sites-building','网站原型'],['deep-research','研究文档']]}
  ];
  const features = [
    {id:'page',title:'构建中文平台页面',description:'把角色、资源与业务入口整理成可用页面。',tags:['角色入口','响应式布局','导航菜单'],slug:'foru-web-ui',icon:'projects'},
    {id:'diagram',title:'梳理系统架构',description:'让组件关系、数据流和信任边界清楚可见。',tags:['HTML + SVG','组件关系','系统边界'],slug:'architecture-diagram',icon:'building'},
    {id:'report',title:'整理研究证据',description:'围绕问题组织资料，让结论能回到来源。',tags:['多来源','结构化报告','直接引用'],slug:'deep-research',icon:'assessment'},
    {id:'video',title:'校准旁白与画面',description:'以最终旁白为基准，同步场景、字幕与音乐。',tags:['场景时长','句级字幕','音画校验'],slug:'remotion-voice-sync',icon:'jobs'}
  ];
  const state = {q:'',category:'全部',sort:'featured',role:'creator',page:'home'};
  const categories = ['全部','设计与页面','开发工具','研究与知识','音视频','模型与数据'];
  const roleTabs = $('#role-tabs');
  const featureTabs = $('#feature-tabs');
  const nav = $('#foru-nav');
  const navToggle = $('#nav-toggle');
  const productMenu = $('#product-menu');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 767px)');
  let activeFeature=0, elapsed=0, previous=0, frame=0, visible=false, paused=false, hover=false, focused=false, toastTimer;

  function catalogHash() {
    const p = new URLSearchParams();
    if(state.q)p.set('q',state.q);
    if(state.category!=='全部')p.set('category',state.category);
    if(state.sort!=='featured')p.set('sort',state.sort);
    return '#/catalog'+(p.size?'?'+p:'');
  }
  const detailHash = slug => `#/skill/${encodeURIComponent(slug)}?return=${encodeURIComponent(catalogHash())}`;
  $('.foru-skip').addEventListener('click',event=>{event.preventDefault();$('#main').focus();$('#main').scrollIntoView();});
  function keyboardTabs(list, select, vertical=false) {
    list.forEach((button,i) => button.addEventListener('keydown', event => {
      let index;
      if(event.key===(vertical?'ArrowUp':'ArrowLeft'))index=(i-1+list.length)%list.length;
      if(event.key===(vertical?'ArrowDown':'ArrowRight'))index=(i+1)%list.length;
      if(event.key==='Home')index=0;
      if(event.key==='End')index=list.length-1;
      if(index!==undefined){event.preventDefault();select(index);list[index].focus();}
    }));
  }
  function selectRole(id) {
    const role=roles.find(item=>item.id===id);if(!role)return;
    state.role=id;
    roleTabs.querySelectorAll('button').forEach(button=>{const active=button.dataset.role===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    const panel=$('#products');panel.setAttribute('aria-labelledby','role-'+id);panel.style.setProperty('--product-count',role.items.length);
    panel.innerHTML=role.items.map(([slug,description])=>{
      const skill=skills.find(item=>item.slug===slug);
      return `<a class="foru-product" href="${detailHash(slug)}"><span class="foru-product-icon">${icon(iconNames[skill.kind])}</span><span>${esc(skill.name)}</span><span class="product-desc">${esc(description)}</span></a>`;
    }).join('');
  }
  roleTabs.innerHTML=roles.map((role,i)=>`<button id="role-${role.id}" type="button" role="tab" data-role="${role.id}" aria-selected="${i===0}" aria-controls="products" tabindex="${i===0?0:-1}">${icon(role.icon)}${role.label}</button>`).join('');
  const tabs=[...roleTabs.querySelectorAll('button')];
  tabs.forEach(button=>button.addEventListener('click',()=>selectRole(button.dataset.role)));
  keyboardTabs(tabs,index=>selectRole(roles[index].id));
  $('#mega-content').innerHTML=roles.map(role=>`<div class="foru-menu-group"><h3><span>面向${role.label}</span></h3>${role.items.slice(0,3).map(([slug,description])=>{const skill=skills.find(item=>item.slug===slug);return `<a class="foru-menu-item" href="#/role/${role.id}">${icon(iconNames[skill.kind])}<div><strong>${esc(skill.name)}</strong><p>${esc(description)}</p></div></a>`;}).join('')}</div>`).join('');

  function closeNav(restore=false) {
    const wasOpen=nav.classList.contains('open');
    nav.classList.remove('open');navToggle.setAttribute('aria-expanded','false');navToggle.textContent='菜单';productMenu.open=false;
    document.body.style.overflow='';$('#main').inert=false;$('#footer').inert=false;
    if(wasOpen&&restore)navToggle.focus();
  }
  navToggle.addEventListener('click',()=>{
    if(nav.classList.contains('open')){closeNav(true);return;}
    nav.classList.add('open');navToggle.setAttribute('aria-expanded','true');navToggle.textContent='关闭';
    document.body.style.overflow='hidden';$('#main').inert=true;$('#footer').inert=true;nav.querySelector('a').focus();
  });
  nav.addEventListener('click',event=>{if(event.target.closest('a'))closeNav();});
  document.addEventListener('click',event=>{if(!event.target.closest('.foru-header'))closeNav();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(nav.classList.contains('open'))closeNav(true);
      else if(productMenu.open){productMenu.open=false;productMenu.querySelector('summary').focus();}
    }
    if(event.key==='Tab'&&nav.classList.contains('open')){
      const nodes=[navToggle,...nav.querySelectorAll('a,summary')].filter(node=>node.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  narrow.addEventListener('change',()=>closeNav());

  function artwork(id) {
    if(id==='page')return `<div class="mini-website"><div><h3>AI 能力<br>连接专业方法</h3><p>设计 · 开发 · 研究</p><span class="mini-pill">探索 SKILL</span></div><svg viewBox="0 0 360 310" aria-hidden="true"><use href="#foru-scene-ai"/></svg></div><div class="mini-entry-row"><span>创作者</span><span>开发者</span><span>研究者</span></div>`;
    if(id==='diagram')return `<svg class="diagram-preview" role="img" aria-label="架构示例：浏览器通过 API 连接任务队列和数据库，蓝色虚线为服务边界" viewBox="0 0 500 245"><rect x="145" y="36" width="325" height="178" rx="12" fill="#162544" stroke="#5f9eff" stroke-dasharray="5 5"/><g fill="#cde1ff" font-family="sans-serif" font-size="13"><text x="163" y="59">服务边界</text></g><g fill="none" stroke="#69afff" stroke-width="2"><path d="M116 123h57m95 0h55m-10 0v-44h25m-25 44v44h25"/></g><g fill="#223b66" stroke="#628fcc"><rect x="20" y="97" width="96" height="52" rx="8"/><rect x="173" y="97" width="96" height="52" rx="8"/><rect x="338" y="54" width="110" height="52" rx="8"/><rect x="338" y="141" width="110" height="52" rx="8"/></g><g fill="#fff" text-anchor="middle" font-size="14" font-family="sans-serif"><text x="68" y="127">浏览器</text><text x="221" y="127">API 服务</text><text x="393" y="85">任务队列</text><text x="393" y="172">数据库</text></g><g fill="#a8c3e8" font-size="12" font-family="sans-serif"><text x="21" y="181">请求 → 处理 → 保存</text></g></svg>`;
    if(id==='report')return `<div class="report-preview"><aside class="report-sidebar"><span>研究问题</span><span>来源与范围</span><span>方法比较</span><span>依赖与限制</span></aside><div class="report-page"><h3>端侧模型部署研究</h3><p>按内存、延迟与许可比较部署路径，并区分来源事实与推断。</p><table class="report-table"><thead><tr><th>比较维度</th><th>待验证信息</th></tr></thead><tbody><tr><td>内存</td><td>模型与量化配置</td></tr><tr><td>延迟</td><td>设备与测试条件</td></tr><tr><td>许可</td><td>原始授权条款</td></tr></tbody></table><span class="citation-chip">关键结论关联来源</span></div></div>`;
    return `<div class="video-stage"><div><span>旁白驱动的场景</span><br><strong>先校准声音<br>再安排画面</strong></div><svg viewBox="0 0 100 95" aria-hidden="true"><g fill="#76c6ff"><rect x="8" y="32" width="8" height="30" rx="4"/><rect x="23" y="20" width="8" height="54" rx="4"/><rect x="38" y="8" width="8" height="78" rx="4"/><rect x="53" y="25" width="8" height="44" rx="4"/><rect x="68" y="15" width="8" height="66" rx="4"/><rect x="83" y="34" width="8" height="28" rx="4"/></g></svg></div><div class="timeline"><div class="time-ruler"><span>场景起点</span><span>旁白结束</span></div><div class="time-track"><span>开场介绍</span><span>方法说明</span><span>总结</span></div><div class="time-track audio"><span>旁白 ━╋━╋╋━━╋━╋╋━╋━━╋━━</span></div><div class="time-track"><span>句级字幕</span><span>句级字幕</span><span>句级字幕</span></div></div>`;
  }
  function previewMarkup(feature, detail=false) {
    return `<div class="foru-window"><span>● ● ●</span><span>产物示意 · 非真实运行结果</span></div><div class="preview-frame"><div class="preview-topline"><strong>${esc(feature.title)}</strong><span>SKILL</span></div><div class="preview-inner">${artwork(feature.id)}</div></div><div class="preview-footer"><div class="foru-tags">${feature.tags.slice(0,2).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>${detail?'<span>示意预览</span>':`<a href="${detailHash(feature.slug)}">查看详情 →</a>`}</div>`;
  }
  featureTabs.innerHTML=features.map((feature,i)=>`<button type="button" id="feature-${feature.id}" role="tab" class="foru-feature${i===0?' active':''}" aria-selected="${i===0}" aria-controls="feature-preview" tabindex="${i===0?0:-1}"><svg class="foru-feature-icon" viewBox="0 0 56 56" aria-hidden="true"><use href="#foru-${feature.icon}"/></svg><strong>${esc(feature.title)}</strong><span>${esc(feature.description)}</span><small>${feature.tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</small></button>`).join('');
  const featureButtons=[...featureTabs.querySelectorAll('button')];
  function selectFeature(index) {
    activeFeature=index;elapsed=0;
    featureButtons.forEach((button,i)=>{button.classList.toggle('active',i===index);button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;button.style.setProperty('--progress',0);});
    const panel=$('#feature-preview');panel.setAttribute('aria-labelledby','feature-'+features[index].id);panel.dataset.feature=features[index].id;panel.innerHTML=previewMarkup(features[index]);
  }
  featureButtons.forEach((button,i)=>button.addEventListener('click',()=>selectFeature(i)));
  keyboardTabs(featureButtons,selectFeature,true);
  const area=$('#feature-area');
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;},{threshold:.25});observer.observe(area);
  area.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')hover=true;});area.addEventListener('pointerleave',()=>hover=false);
  area.addEventListener('focusin',()=>focused=true);area.addEventListener('focusout',event=>focused=area.contains(event.relatedTarget));
  $('#feature-pause').addEventListener('click',()=>{paused=!paused;$('#feature-pause').setAttribute('aria-pressed',String(paused));$('#feature-pause').textContent=paused?'继续自动展示':'暂停自动展示';});
  function tick(time) {
    const delta=previous?Math.min(time-previous,100):0;previous=time;
    if(state.page==='home'&&visible&&!document.hidden&&!paused&&!hover&&!focused&&!reduced.matches){elapsed+=delta;if(elapsed>=5000)selectFeature((activeFeature+1)%features.length);featureButtons[activeFeature].style.setProperty('--progress',elapsed/5000);}
    frame=requestAnimationFrame(tick);
  }

  function renderCatalog() {
    const needle=state.q.trim().toLocaleLowerCase();
    const list=skills.filter(skill=>(state.category==='全部'||skill.category===state.category)&&(!needle||[skill.name,skill.identifier,skill.summary,...skill.tags].join(' ').toLocaleLowerCase().includes(needle)));
    list.sort((a,b)=>{
      if(state.sort==='updated'){if(a.updatedAt!==b.updatedAt)return(b.updatedAt||'').localeCompare(a.updatedAt||'');}
      else if(state.sort==='featured'){if(a.featured!==b.featured)return Number(b.featured)-Number(a.featured);}
      return a.name.localeCompare(b.name,'zh-CN');
    });
    $('#result-count').textContent=list.length+' 个 SKILL';
    $('#sort-note').textContent=state.sort==='updated'?'暂无已确认日期，未标日期条目按名称排列':'演示条目，仓库与发布信息待补充';
    $('#empty-state').hidden=list.length!==0;$('#skill-grid').hidden=list.length===0;
    $('#categories').innerHTML=categories.map(category=>`<button type="button" class="${category===state.category?'active':''}" aria-pressed="${category===state.category}" data-category="${esc(category)}">${esc(category)}</button>`).join('');
    $('#skill-grid').innerHTML=list.map(skill=>`<article class="skill-card"><div class="skill-card-head"><span class="skill-card-icon">${icon(iconNames[skill.kind])}</span><div><h3>${esc(skill.name)}</h3><p>${esc(skill.identifier)}</p></div></div><div class="skill-card-body"><p class="skill-summary">${esc(skill.summary)}</p><div class="foru-tags">${skill.tags.slice(0,3).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div><div class="skill-card-meta">${icon('case')}<span>${esc(skill.compatibility.join(' / '))}</span></div></div><div class="skill-card-foot"><span>${esc(skill.category)}</span><a href="${detailHash(skill.slug)}">查看详情 →</a></div></article>`).join('');
  }
  function syncCatalog() {history.replaceState(null,'',catalogHash());renderCatalog();setCurrentNav('catalog');}
  $('#search-input').addEventListener('input',event=>{state.q=event.target.value;syncCatalog();});
  $('#sort-select').addEventListener('change',event=>{state.sort=event.target.value;syncCatalog();});
  $('#categories').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(button){state.category=button.dataset.category;syncCatalog();}});
  $('#clear-filters').addEventListener('click',()=>{state.q='';state.category='全部';state.sort='featured';$('#search-input').value='';$('#sort-select').value='featured';syncCatalog();$('#search-input').focus();});
  function setCurrentNav(name) {nav.querySelectorAll('[data-nav]').forEach(link=>{if(link.dataset.nav===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});}
  function showPage(name) {state.page=name;document.querySelectorAll('.page-view').forEach(view=>view.hidden=view.dataset.page!==name);}
  function route() {
    const raw=location.hash.startsWith('#/')?location.hash.slice(1):'/';const pos=raw.indexOf('?');const path=pos===-1?raw:raw.slice(0,pos);const p=new URLSearchParams(pos===-1?'':raw.slice(pos+1));
    closeNav();
    if(path==='/guide'){showPage('guide');setCurrentNav('guide');document.title='使用指南 · SKILL 广场';window.scrollTo(0,0);return;}
    if(path.startsWith('/skill/')){const skill=skills.find(item=>item.slug===path.slice(7));if(skill){renderDetail(skill,p.get('return'));showPage('detail');setCurrentNav('catalog');document.title=skill.name+' · SKILL 广场';window.scrollTo(0,0);return;}}
    state.q=p.get('q')||'';state.category=categories.includes(p.get('category'))?p.get('category'):'全部';state.sort=['featured','updated','name'].includes(p.get('sort'))?p.get('sort'):'featured';
    $('#search-input').value=state.q;$('#sort-select').value=state.sort;renderCatalog();showPage('home');document.title='SKILL 广场 · FORU 风格 Demo';
    if(path==='/catalog'){setCurrentNav('catalog');requestAnimationFrame(()=>$('#catalog').scrollIntoView());}
    else if(path.startsWith('/role/')){selectRole(path.slice(6));setCurrentNav('home');requestAnimationFrame(()=>$('#ecosystem').scrollIntoView());}
    else{setCurrentNav('home');window.scrollTo(0,0);}
  }
  function renderDetail(skill,returnTo) {
    const safeReturn=returnTo&&/^#\/catalog(?:\?|$)/.test(returnTo)?returnTo:'#/catalog';
    const feature=features.find(item=>item.slug===skill.slug);
    $('#detail-content').innerHTML=`<a class="back-link" href="${esc(safeReturn)}">← 返回 SKILL 目录</a><header class="detail-header"><div><span class="detail-category">${esc(skill.category)}</span><h1>${esc(skill.name)}</h1><code>${esc(skill.identifier)}</code><p>${esc(skill.summary)}</p></div><div class="detail-info"><span>适用环境参考</span><strong>${esc(skill.compatibility.join(' / '))}</strong><span>版本与更新时间</span><strong>待公开发布资料确认</strong></div></header><section class="detail-section"><div class="section-number">01</div><div><h2>产物与效果</h2><p>${esc(skill.output)}</p>${feature?`<div class="foru-preview">${previewMarkup(feature,true)}</div>`:`<div class="code-panel"><code>产物说明\n${esc(skill.output)}\n\n此条目尚未配置真实作品预览。</code></div>`}</div></section><section class="detail-section"><div class="section-number">02</div><div><h2>调用示例</h2><p>提供目标、输入和约束，再交给对应 SKILL。</p><div class="code-panel"><code id="example-text">${esc(skill.example)}</code><button type="button" class="copy-button" data-copy>复制示例</button></div></div></section><section class="detail-section"><div class="section-number">03</div><div><h2>安装方法</h2><ol class="detail-list">${skill.installation.map(item=>`<li>${esc(item)}</li>`).join('')}</ol><div class="source-note"><button disabled type="button">获取文件 · 待发布</button><span>当前 demo 未配置下载仓库及许可，不能直接安装。</span></div></div></section><section class="detail-section"><div class="section-number">04</div><div class="split-content"><div><h2>必要依赖</h2><ul class="detail-list">${skill.dependencies.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div><div><h2>使用限制</h2><ul class="detail-list">${skill.limitations.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div></div></section>`;
    $('#detail-content [data-copy]').addEventListener('click',event=>copyText(skill.example,event.currentTarget));
  }
  async function copyText(value,button) {
    let area;
    try {
      if(navigator.clipboard&&isSecureContext)await navigator.clipboard.writeText(value);
      else{area=document.createElement('textarea');area.value=value;area.style.cssText='position:fixed;opacity:0;left:0;top:0';document.body.append(area);area.select();if(!document.execCommand('copy'))throw new Error('copy failed');}
      button.textContent='已复制';notify('调用示例已复制');
    }catch{button.textContent='请手动复制';notify('未能自动复制，请选择示例文字复制。');const selection=getSelection();const range=document.createRange();range.selectNodeContents($('#example-text'));selection.removeAllRanges();selection.addRange(range);}
    finally{area?.remove();button.focus();setTimeout(()=>{if(button.isConnected)button.textContent='复制示例';},2200);}
  }
  function notify(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,2600);}
  function renderGuide() {
    $('#guide-content').innerHTML=`<a class="back-link" href="#/catalog">← 返回 SKILL 目录</a><header class="guide-header"><h1>从一个明确的任务开始</h1><p>先确认依赖，再安装完整目录，最后用具体输入调用。</p></header><div class="guide-steps"><section class="guide-step"><div class="step-icon">1</div><div><h2>选择对应的 SKILL</h2><p>查看用途、依赖、限制和示例。不要把展示预览当作实际执行结果；训练、外部 API 等任务可能产生费用。</p></div></section><section class="guide-step"><div class="step-icon">2</div><div><h2>安装完整目录</h2><p>从发布者提供的可信仓库获取完整文件，包含说明、参考资料、脚本和素材。当前 demo 的下载入口尚未配置。</p><pre>my-skill/\n├── SKILL.md\n├── references/   # 参考资料（可选）\n├── scripts/      # 执行脚本（可选）\n└── assets/       # 素材（可选）</pre></div></section><section class="guide-step"><div class="step-icon">3</div><div><h2>说明输入与交付要求</h2><p>在支持该 SKILL 的工具中调用，说明目标、输入文件、技术栈和要保留的约束。</p><pre>使用 $foru-web-ui，制作 SKILL 广场 demo。\n保持纯静态 HTML/CSS/JS，可双击打开。\n包含角色入口、目录检索、详情和使用指南。</pre></div></section></div><div class="guide-faq"><h2>常见问题</h2><details><summary>这个 demo 需要 npm 吗？</summary><p>不需要。双击此目录的 index.html 即可，所有样式、数据和交互均在本地。没有 package.json，也不需要 npm install 或 npm run dev。</p></details><details><summary>能直接下载并执行 SKILL 吗？</summary><p>目前只能浏览资料和复制调用示例。仓库、许可与正式发布清单需要补充后才能提供有效下载；本页面也不提供在线执行。</p></details><details><summary>复制完整目录为什么很重要？</summary><p>部分 SKILL 依赖 references、scripts 或 assets。只复制 SKILL.md 可能丢失执行规则、脚本或素材。安装前还应检查来源、权限、依赖与许可。</p></details></div>`;
  }
  window.addEventListener('hashchange',route);
  selectRole('creator');selectFeature(0);renderGuide();route();frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();});
  window.addEventListener('pageshow',event=>{if(event.persisted){observer.observe(area);previous=0;frame=requestAnimationFrame(tick);}});
})();
