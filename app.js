/* Local, dependency-free adaptation of the FORU skill's starter. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => `<svg viewBox="0 0 56 56" aria-hidden="true"><use href="#foru-${name}"/></svg>`;
  const iconNames = {industry:'building',teaching:'learning',interview:'jobs',data:'assessment'};
  const roles = [
    {id:'manager',label:'院校管理者',icon:'building',items:[['industry-education-report','产业与专业建设'],['classroom-assistant','课程实施支持']]},
    {id:'teacher',label:'教师',icon:'learning',items:[['classroom-assistant','课程与教学开发'],['ai-interview','学生就业训练']]},
    {id:'student',label:'学生',icon:'jobs',items:[['ai-interview','面试练习与复盘'],['classroom-assistant','课程答疑与练习']]},
    {id:'data-team',label:'数据团队',icon:'assessment',items:[['training-data-qa','数据治理与质检'],['industry-education-report','决策数据分析']]}
  ];
  const features = [
    {id:'industry',title:'规划产业与专业',description:'让产业、岗位和专业建议回到证据与口径。',tags:['产业分析','专业建设','证据报告'],slug:'industry-education-report',icon:'building'},
    {id:'teaching',title:'开发课程与教学',description:'在授权课程资料内生成答疑、要点和练习。',tags:['授权资料','定位引用','课堂练习'],slug:'classroom-assistant',icon:'learning'},
    {id:'interview',title:'组织实训与就业',description:'围绕目标岗位和简历完成面试练习闭环。',tags:['能力地图','逐题追问','回答复盘'],slug:'ai-interview',icon:'jobs'},
    {id:'data',title:'治理训练数据',description:'把样本构造、机器质检和专家抽检连成流程。',tags:['数据集划分','泄漏检查','专家抽检'],slug:'training-data-qa',icon:'assessment'}
  ];
  const state = {q:'',category:'全部',sort:'featured',page:'home'};
  const categories = ['全部','产业与专业建设','课程与教学开发','实训与就业','数据治理与模型底座'];
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
  $('#mega-content').innerHTML=roles.map(role=>`<div class="foru-menu-group"><h3><span>面向${role.label}</span></h3>${role.items.slice(0,3).map(([slug,description])=>{const skill=skills.find(item=>item.slug===slug);return `<a class="foru-menu-item" href="${detailHash(slug)}">${icon(iconNames[skill.kind])}<div><strong>${esc(skill.name)}</strong><p>${esc(description)}</p></div></a>`;}).join('')}</div>`).join('');

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
    if(id==='industry')return `<div class="report-preview"><aside class="report-sidebar"><span>产业链</span><span>岗位人才</span><span>专业课程</span><span>就业反馈</span></aside><div class="report-page"><h3>新能源汽车专业建设报告</h3><p>分别标注事实、推断、建议和缺数，让每项关键结论都能回到来源。</p><table class="report-table"><thead><tr><th>决策主题</th><th>证据状态</th></tr></thead><tbody><tr><td>产业与岗位</td><td>来源与口径已登记</td></tr><tr><td>专业与课程</td><td>待补院校微观数据</td></tr><tr><td>建设建议</td><td>关联证据与限制</td></tr></tbody></table><span class="citation-chip">结构校验 + 语义审核</span></div></div>`;
    if(id==='teaching')return `<div class="mini-website"><div><h3>课程资料<br>变成可学内容</h3><p>答疑 · 要点 · 练习</p><span class="mini-pill">每条结论附定位引用</span></div><svg viewBox="0 0 360 310" aria-hidden="true"><use href="#foru-scene-ai"/></svg></div><div class="mini-entry-row"><span>授权资料</span><span>课堂练习</span><span>待教师清单</span></div>`;
    if(id==='interview')return `<div class="video-stage"><div><span>岗位与简历分析</span><br><strong>一次一题<br>根据回答追问</strong></div><svg viewBox="0 0 100 95" aria-hidden="true"><g fill="#76c6ff"><rect x="8" y="50" width="8" height="12" rx="4"/><rect x="23" y="38" width="8" height="24" rx="4"/><rect x="38" y="20" width="8" height="42" rx="4"/><rect x="53" y="30" width="8" height="32" rx="4"/><rect x="68" y="12" width="8" height="50" rx="4"/><rect x="83" y="25" width="8" height="37" rx="4"/></g></svg></div><div class="timeline"><div class="time-ruler"><span>开始练习</span><span>形成报告</span></div><div class="time-track"><span>能力地图</span><span>逐题问答</span><span>重答</span></div><div class="time-track audio"><span>Q1 → A1 → Q1-F1 → A1-F1</span></div><div class="time-track"><span>原话引用</span><span>待验证项</span><span>改进建议</span></div></div>`;
    return `<svg class="diagram-preview" role="img" aria-label="训练数据治理流程示例：治理数据依次经过样本构造、机器质检和专家抽检，再形成可追溯版本" viewBox="0 0 500 245"><rect x="12" y="28" width="476" height="188" rx="12" fill="#162544" stroke="#5f9eff" stroke-dasharray="5 5"/><g fill="#cde1ff" font-family="sans-serif" font-size="13"><text x="29" y="52">数据治理与验收边界</text></g><g fill="none" stroke="#69afff" stroke-width="2"><path d="M122 124h30m102 0h30m102 0h22"/></g><g fill="#223b66" stroke="#628fcc"><rect x="28" y="92" width="94" height="64" rx="8"/><rect x="152" y="92" width="102" height="64" rx="8"/><rect x="284" y="92" width="102" height="64" rx="8"/><rect x="408" y="92" width="64" height="64" rx="8"/></g><g fill="#fff" text-anchor="middle" font-size="13" font-family="sans-serif"><text x="75" y="120">治理数据</text><text x="75" y="139">与规则</text><text x="203" y="120">样本构造</text><text x="203" y="139">四类划分</text><text x="335" y="120">机器质检</text><text x="335" y="139">专家抽检</text><text x="440" y="120">封存</text><text x="440" y="139">版本</text></g><g fill="#a8c3e8" font-size="12" font-family="sans-serif"><text x="29" y="188">候选结果 ≠ 专家确认 · 全程保留来源与谱系</text></g></svg>`;
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
    const list=skills.filter(skill=>(state.category==='全部'||skill.category===state.category)&&(!needle||[skill.name,skill.identifier,skill.summary,skill.installPrompt,skill.minimalInput,...skill.tags].join(' ').toLocaleLowerCase().includes(needle)));
    list.sort((a,b)=>{
      if(state.sort==='updated'){if(a.updatedAt!==b.updatedAt)return(b.updatedAt||'').localeCompare(a.updatedAt||'');}
      else if(state.sort==='featured'){if(a.featured!==b.featured)return Number(b.featured)-Number(a.featured);}
      return a.name.localeCompare(b.name,'zh-CN');
    });
    $('#result-count').textContent=list.length+' 个 SKILL';
    $('#sort-note').textContent=state.sort==='updated'?'暂无已确认日期，未标日期条目按名称排列':'4 个业务分类 · 4 个公开 GitHub 仓库';
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
    if(path==='/catalog'||path.startsWith('/role/')){setCurrentNav('catalog');requestAnimationFrame(()=>$('#catalog').scrollIntoView());}
    else{setCurrentNav('home');window.scrollTo(0,0);}
  }
  function renderDetail(skill,returnTo) {
    const safeReturn=returnTo&&/^#\/catalog(?:\?|$)/.test(returnTo)?returnTo:'#/catalog';
    const feature=features.find(item=>item.slug===skill.slug);
    $('#detail-content').innerHTML=`<a class="back-link" href="${esc(safeReturn)}">← 返回 SKILL 目录</a><header class="detail-header"><div><span class="detail-category">${esc(skill.category)}</span><h1>${esc(skill.name)}</h1><code>${esc(skill.identifier)}</code><p>${esc(skill.summary)}</p></div><div class="detail-info"><span>适用环境</span><strong>${esc(skill.compatibility.join(' / '))}</strong><span>公开来源</span><strong><a href="${esc(skill.repository)}" target="_blank" rel="noreferrer">${esc(skill.repositoryLabel)}</a></strong></div></header><section class="detail-section"><div class="section-number">01</div><div><h2>产物与效果</h2><p>${esc(skill.output)}</p>${feature?`<div class="foru-preview">${previewMarkup(feature,true)}</div>`:`<div class="code-panel"><code>产物说明\n${esc(skill.output)}\n\n此条目尚未配置真实作品预览。</code></div>`}</div></section><section class="detail-section"><div class="section-number">02</div><div><h2>安装提示词</h2><p>复制整句发给 Codex，即可请求从指定 GitHub 仓库安装该 SKILL。</p><div class="code-panel"><code>${esc(skill.installPrompt)}</code><button type="button" class="copy-button" data-copy="installPrompt">复制提示词</button></div></div></section><section class="detail-section"><div class="section-number">03</div><div><h2>最小输入示例</h2><p>安装完成后，从这条最小任务开始；把示例中的地区、资料或附件替换成你的实际输入。</p><div class="code-panel"><code>${esc(skill.minimalInput)}</code><button type="button" class="copy-button" data-copy="minimalInput">复制示例</button></div></div></section><section class="detail-section"><div class="section-number">04</div><div><h2>仓库与安装</h2><ol class="detail-list">${skill.installation.map(item=>`<li>${esc(item)}</li>`).join('')}</ol><div class="source-note"><a href="${esc(skill.repository)}" target="_blank" rel="noreferrer">打开 GitHub 仓库 ↗</a><span>${esc(skill.repositoryLabel)}</span></div></div></section><section class="detail-section"><div class="section-number">05</div><div class="split-content"><div><h2>必要依赖</h2><ul class="detail-list">${skill.dependencies.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div><div><h2>使用限制</h2><ul class="detail-list">${skill.limitations.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div></div></section>`;
    $('#detail-content').querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',event=>{
      const key=event.currentTarget.dataset.copy;
      copyText(skill[key],event.currentTarget,key==='installPrompt'?'安装提示词已复制':'最小输入示例已复制');
    }));
  }
  async function copyText(value,button,message) {
    let area;
    const original=button.dataset.defaultLabel||button.textContent;
    button.dataset.defaultLabel=original;
    try {
      if(navigator.clipboard&&isSecureContext)await navigator.clipboard.writeText(value);
      else{area=document.createElement('textarea');area.value=value;area.style.cssText='position:fixed;opacity:0;left:0;top:0';document.body.append(area);area.select();if(!document.execCommand('copy'))throw new Error('copy failed');}
      button.textContent='已复制';notify(message);
    }catch{button.textContent='请手动复制';notify('未能自动复制，请选择文字手动复制。');const selection=getSelection();const range=document.createRange();range.selectNodeContents(button.closest('.code-panel').querySelector('code'));selection.removeAllRanges();selection.addRange(range);}
    finally{area?.remove();button.focus();setTimeout(()=>{if(button.isConnected)button.textContent=original;},2200);}
  }
  function notify(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,2600);}
  function renderGuide() {
    $('#guide-content').innerHTML=`<a class="back-link" href="#/catalog">← 返回 SKILL 目录</a><header class="guide-header"><h1>从一个明确的任务开始</h1><p>选择业务分类，复制安装提示词，再用最小输入示例开始。</p></header><div class="guide-steps"><section class="guide-step"><div class="step-icon">1</div><div><h2>按业务分类选择</h2><p>目录包含产业与专业建设、课程与教学开发、实训与就业、数据治理与模型底座四类，每类先提供一个公开 SKILL。</p></div></section><section class="guide-step"><div class="step-icon">2</div><div><h2>复制安装提示词</h2><p>进入详情页复制完整句子并发给 Codex；提示词包含指定 GitHub 仓库和保留完整目录的要求。</p><pre>请从 GitHub 仓库安装对应 SKILL，\n保留 SKILL.md、references、scripts、assets 等完整目录，\n并在安装后检查依赖、说明调用方式。</pre></div></section><section class="guide-step"><div class="step-icon">3</div><div><h2>从最小输入开始</h2><p>复制详情页的最小输入示例，再把地区、课程资料、岗位简历或治理数据替换成你的实际内容。</p><pre>使用 $ai-interview，\n目标岗位是 Java 后端实习生，\n岗位要求和匿名简历见附件，请开始 3 题模拟面试。</pre></div></section></div><div class="guide-faq"><h2>常见问题</h2><details><summary>这个 demo 需要 npm 吗？</summary><p>不需要。双击此目录的 index.html 即可，所有样式、数据和交互均在本地。没有 package.json，也不需要 npm install 或 npm run dev。</p></details><details><summary>能从页面获取 SKILL 吗？</summary><p>可以进入详情页打开对应的公开 GitHub 仓库，并复制安装提示词交给 Codex；本页面只提供入口，不会在线执行 SKILL。</p></details><details><summary>为什么要保留完整目录？</summary><p>这些 SKILL 可能依赖 references、scripts、assets、examples 或 requirements.txt。只复制 SKILL.md 可能丢失执行规则、脚本、模板或示例。</p></details></div>`;
  }
  window.addEventListener('hashchange',route);
  selectFeature(0);renderGuide();route();frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();});
  window.addEventListener('pageshow',event=>{if(event.persisted){observer.observe(area);previous=0;frame=requestAnimationFrame(tick);}});
})();
