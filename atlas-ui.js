/* Browser interface; the two pure mathematical engines above are also testable in Node. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), val = id => $(id).value,
    num = id => Number(val(id)), esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colors = {normal:'#087f83', projective:'#bb6534', injective:'#4774ba', both:'#8661b4'};
  let current, scene, selectedId, view = 'overview', pos = new Map(), noticeTimer;
  let treeInput,treeReport,treeWorker=null,treeJob=0;
  const treeCache=new Map();
  const chosen = () => current?.nodes.find(n => n.id === selectedId);
  const dims = n => n.dimension ? '(' + n.dimension.join(',') + ')' : '准单模根之和';
  const label = n => n?.label || n?.id || '0';
  const nodeColor = n => n.projective && n.injective ? colors.both : n.projective ? colors.projective : n.injective ? colors.injective : colors.normal;
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  function toast(s) { $('status').textContent=s; $('status').hidden=false; clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('status').hidden=true,2600); }
  function setPanel(name) {
    document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id===name));
    document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));
  }
  document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel)));
  document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();setPanel(b.dataset.jump);}));
  document.querySelectorAll('a[href^="#ref-"]').forEach(a=>a.addEventListener('click',()=>{setPanel('methods');}));
  function config() {
    const f=val('family'), d=val('dynkin-type'), a=val('affine-type');
    show('dynkin-field',f==='dynkin');show('affine-field',f==='affine');
    show('tree-editor',f==='tree');
    show('m-field',f==='brauer');show('L-field',f==='cyclic');show('stable-field',f==='brauer'||f==='cyclic'||f==='tree');
    show('depth-field',f==='affine');show('p-field',f==='affine'&&a==='A');
    show('orientation-field',f==='dynkin'||f==='affine');
    show('n-field',f==='brauer'||f==='cyclic'||f==='dynkin'&&(d==='A'||d==='D')||f==='affine'&&a==='D');
    show('component-tabs',f==='affine');show('tube-field',f==='affine');
    show('lambda-field',f==='affine'&&val('tube-choice')==='homogeneous');
    const isD=f==='dynkin'&&d==='D'||f==='affine'&&a==='D';
    $('size').min=isD?'4':'1';$('size').max=f==='brauer'?'7':isD?'10':'12';
    $('size').value=Math.max(Number($('size').min),Math.min(Number($('size').max),num('size')));
    $('n-field').querySelector('label').textContent=f==='brauer'?'树的边数 n':f==='affine'?'D̃ₙ 的指标 n（顶点 n+1 个）':'顶点数 n';
    const alt=$('orientation').querySelector('option[value="alternating"]');
    alt.disabled=f==='affine';if(alt.disabled&&val('orientation')==='alternating')$('orientation').value='forward';
    for(const id of ['size','multiplicity','loewy','p','q','depth'])$(id+'-value').textContent=val(id);
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  }
  function adapt(data, type, component) {
    data.nodes.forEach(n=>{
      n.kind='hereditary';n.component=component;
      if(type==='A'&&val('family')==='dynkin') {
        const support=n.dimension.map((x,i)=>x?i+1:0).filter(Boolean);
        n.label=`[${support[0]},${support[support.length-1]}]`;
      } else if(type==='K') {
        const r=Math.min(...n.dimension);n.label=(component==='preinjective'?'I':'P')+r;
      } else n.label=n.layer===0?(component==='preinjective'?'I':'P')+(n.vertex+1):
        (component==='preinjective'?`τ^${n.layer} I${n.vertex+1}`:`τ^−${n.layer} P${n.vertex+1}`);
    });return data;
  }
  function stopTreeWorker(){if(treeWorker){treeWorker.terminate();treeWorker=null;}show('tree-cancel',false);document.querySelector('.center').classList.remove('tree-busy');document.querySelector('.right').classList.remove('tree-busy');}
  function prepareTree(report){
    BrauerTreeLayout.assign(report);let ordinal=0;
    for(const n of report.nodes){n.wordLabel=n.label;if(!n.projective&&n.word.length)n.label='X'+(++ordinal);n.kind='brauer-tree';}
    report.family='tree';return report;
  }
  function computeTree(input){
    stopTreeWorker();const job=++treeJob,key=JSON.stringify(input);show('tree-cancel',true);$('tree-progress').hidden=false;
    document.querySelector('.center').classList.add('tree-busy');document.querySelector('.right').classList.add('tree-busy');
    $('tree-progress').textContent='构造代数并穷尽合法字符串…';BrauerTreeEditor.setError('');BrauerTreeEditor.setStatus('正在精确计算…');
    $('algebra-title').textContent='Brauer 树 · 正在计算';$('algebra-formula').textContent='k=GF(5) · 完整目录与不可约态射';$('scope-badge').textContent='计算中';
    $('stats').innerHTML='';$('graph').innerHTML='';$('graph-note').textContent='计算完成后才显示结果；不会用部分枚举代替完整 AR 图。';
    current=null;scene=null;$('module-table').innerHTML='';$('inspector').innerHTML='<p class="small">正在生成完整模目录…</p>';$('distribution-description').innerHTML='';$('distribution-chart').innerHTML='';$('structure-description').innerHTML='';
    const phases={algebra:'已构造 quiver 与关系',strings:'枚举全部非投射字符串',hom:'求所有 Hom 与 End radical','radical-square':'计算 rad/rad² 与不可约态射',translation:'通过完整 Hom profile 识别 τ',complete:'完成'};
    const finish=report=>{if(job!==treeJob)return;stopTreeWorker();try{treeReport=prepareTree(report);treeCache.set(key,treeReport);$('tree-progress').hidden=true;BrauerTreeEditor.setStatus('完整计算已应用');if(val('family')==='tree')regenerate();}catch(e){fail(e.message);}};
    const fail=message=>{if(job!==treeJob)return;stopTreeWorker();$('tree-progress').hidden=true;BrauerTreeEditor.setStatus('计算失败');BrauerTreeEditor.setError(message);$('graph-note').textContent='未生成结果：'+message;};
    const progress=(phase,done,total)=>{if(job!==treeJob)return;$('tree-progress').textContent=(phases[phase]||phase)+(total>1?` · ${Math.min(done,total)} / ${total}`:'');};
    try{
      const body=$('brauer-tree-model').textContent+'\nself.onmessage=e=>{try{const report=BrauerTreeAtlas.build(e.data,{progress:(phase,done,total)=>postMessage({type:"progress",phase,done,total})});postMessage({type:"result",report});}catch(error){postMessage({type:"error",message:error.message});}};';
      const url=URL.createObjectURL(new Blob([body],{type:'text/javascript'}));treeWorker=new Worker(url);
      treeWorker.onmessage=e=>{if(e.data.type==='progress')progress(e.data.phase,e.data.done,e.data.total);else if(e.data.type==='result'){URL.revokeObjectURL(url);finish(e.data.report);}else{URL.revokeObjectURL(url);fail(e.data.message);}};
      treeWorker.onerror=e=>{URL.revokeObjectURL(url);fail('本地计算线程未能完成：'+e.message);};treeWorker.postMessage(input);
    }catch(e){show('tree-cancel',false);setTimeout(()=>{try{finish(BrauerTreeAtlas.build(input,{progress}));}catch(error){fail(error.message);}},0);}
  }
  function regenerate() {
    config();
    const f=val('family'),n=num('size'),m=num('multiplicity'),L=num('loewy');
    if(f!=='tree'&&treeWorker){treeJob++;stopTreeWorker();$('tree-progress').hidden=true;}
    let title,formula,badge,note,stats;
    if(f==='tree') {
      const key=JSON.stringify(treeInput);treeReport=treeCache.get(key);
      if(!treeReport){computeTree(treeInput);return;}
      const stable=$('stable').checked,keep=new Set(treeReport.nodes.filter(n=>!stable||!n.projective).map(n=>n.id));
      current={...treeReport,stable,nodes:treeReport.nodes.filter(n=>keep.has(n.id)),edges:treeReport.edges.filter(a=>keep.has(a.source)&&keep.has(a.target))};
      scene={family:'tree',n:treeReport.e,m:treeReport.multiplicity,finite:true,fullReport:treeReport};
      title=`Brauer 树 · ${treeReport.e} 边 · m=${treeReport.multiplicity}`;
      formula=`A = GF(5)Q / I · dim A = ${treeReport.algebraDimension} · 异常顶点 ${treeReport.treeInput.exceptionalVertex}`;
      badge=stable?'完整稳定图':'完整 AR 图';stats=[[current.nodes.length,stable?'全部非投射模':'全部不可分解模'],[arrowCount(current),'当前图的箭头'],[treeReport.algebraDimension,'代数维数']];
      note=`由实际 Hom、rad/rad² 与投射附着生成。${treeReport.e>1?'虚线列重复第 1 列，不增加模。':''}${stable?'已删去投射模。':'紫色 Pᵢ 按真实 rad Pᵢ → Pᵢ → Pᵢ/soc Pᵢ 插入；位置随树与循环序变化。'}`;
    } else if(f==='dynkin') {
      const t=val('dynkin-type');current=adapt(HereditaryAtlas.dynkin(t[0],t.startsWith('E')?Number(t.slice(1)):n,val('orientation')),t,'finite');
      scene={family:f,type:t,n:current.quiver.vertices,finite:true};
      title=`Dynkin ${t==='A'||t==='D'?t+n:t}`;formula='A = kQ · 无关系 · Gabriel 正根分类';badge='完整 AR 图';
      stats=[[current.nodes.length,'全部不可分解模'],[arrowCount(current),'不可约箭头'],[current.quiver.vertices,'简单模 / P / I']];
      note='完整模范畴 AR 图。点选顶点可查看维数向量；投射模 τ=0。';
    } else if(f==='cyclic'||f==='brauer') {
      const loewy=f==='brauer'?n*m+1:L;
      current=QuiverAtlas.cyclic(n,loewy,$('stable').checked);scene={family:f,n,L:loewy,m,finite:true};
      title=f==='brauer'?`${n} 边 Brauer 星 · m=${m}`:`循环 Nakayama · n=${n}, L=${loewy}`;
      formula=`A = kC${n} / J^${loewy} · dim A = ${n*loewy}`;badge=$('stable').checked?'完整稳定图':'完整 AR 图';
      stats=[[current.nodes.length,$('stable').checked?'稳定图顶点':'全部不可分解模'],[arrowCount(current),'当前图的箭头'],[n*loewy,'完整模总数']];
      note=`${n>1?'最右虚线列重复第 1 列，用来展开圆柱；重复顶点不计数。':'n=1 时两种不可约态射方向相反。'} ${$('stable').checked?'已删去所有长度 L 的投射模及相邻箭头。':'包含长度 L 的投射且内射模。'}`;
    } else {
      const t=val('affine-type'),type=t==='K'?'A':t[0],p=t==='K'?1:num('p'),q=t==='K'?1:num('q'),depth=num('depth');
      const inherited=HereditaryAtlas.affine(type,type==='A'?null:t.startsWith('E')?Number(t.slice(1)):n,p,q,depth,val('orientation'));
      const pp=adapt(inherited.components.preprojective,t,'preprojective');
      // Use the same quiver for both components, with the dual Coxeter recurrence.
      const pi=adapt(HereditaryAtlas.build(pp.quiver,{finite:false,depth,component:'preinjective'}),t,'preinjective');
      const ranks=QuiverAtlas.tubeRanks(t==='K'?'A':t,n,p,q),old=val('tube-choice');
      $('tube-choice').innerHTML='<option value="homogeneous">同质管 · 秩 1 · 一参数族</option>'+ranks.map((r,i)=>`<option value="${i}">例外管 ${i+1} · 秩 ${r}</option>`).join('');
      if(old==='homogeneous'||Number(old)<ranks.length)$('tube-choice').value=old;
      if(!$('tube-choice').value)$('tube-choice').value='homogeneous';
      const rank=val('tube-choice')==='homogeneous'?1:ranks[Number(val('tube-choice'))],delta=pp.delta;
      const oldParameter=val('parameter'),isK=t==='K'||type==='A'&&p===1&&q===1;
      $('parameter').innerHTML=isK?'<option value="λ">一般 λ</option><option value="0">0</option><option value="1">1</option><option value="∞">∞</option>':'<option value="λ">λ ∉ D</option><option value="μ">μ ∉ D（另一参数）</option><option value="ν">ν ∉ D（另一参数）</option>';
      if(Array.from($('parameter').options).some(x=>x.value===oldParameter))$('parameter').value=oldParameter;
      const parameter=val('tube-choice')==='homogeneous'?val('parameter'):'λ'+(Number(val('tube-choice'))+1);
      const regular=QuiverAtlas.tube(rank,depth,delta,parameter);
      scene={family:f,type:t,n:pp.quiver.vertices,finite:false,ranks,delta,rank,depth,pp,pi,regular,parameter,quiver:pp.quiver,p,q};
      current=view==='preinjective'?pi:view==='regular'?regular:pp;
      title=t==='K'?'Kronecker 代数':type==='A'?`Euclidean Ã(${p},${q})`:`Euclidean ${type==='D'?'D̃'+n:'Ẽ'+t.slice(1)}`;
      formula=`A = kQ · δ = (${delta.join(',')}) · k 代数闭`;
      badge=view==='overview'?'完整分支结构':'无限图 · 有限窗口';
      stats=[['∞','不可分解模'],[ranks.length,'秩 > 1 的例外管'],['ℙ¹(k)','正则管索引']];
      note=view==='overview'?'三类区域属于不同 AR 分支；区域之间没有不可约态射。每一根管及两侧分支均无限延伸。':view==='regular'?`只画一个秩 ${rank} 管的准长度 1…${depth}。上方无限延伸。${rank>1?'虚线列重复第 1 列。':'实线只连接相邻准长度；τ 固定点可单独显示为虚线环。'}参数变化不是管间的 AR 箭头。`:`只画 ${depth} 层 τ${view==='preprojective'?'⁻¹':''} 轨道窗口；图外继续延伸。窗口边界不等于投射/内射边界。`;
    }
    $('algebra-title').textContent=title;$('algebra-formula').textContent=formula;
    $('scope-badge').textContent=badge;$('scope-badge').classList.toggle('tame',f==='affine');
    $('stats').innerHTML=stats.map(s=>`<div class="stat"><strong>${esc(s[0])}</strong><span>${s[1]}</span></div>`).join('');
    $('graph-note').textContent=note;
    $('conventions').textContent=f==='tree'?'GF(5) · 右模 · 树边 = 简单模 · X 标签详见模面板':f==='affine'||f==='dynkin'?'k 代数闭 · 右模 · 维数坐标按上图编号':'分裂代数 · 右模 · M(i,ℓ) 由顶和长度标记';
    $('footer-convention').textContent=f==='tree'?'mod-A · GF(5) · 精确 Hom/rad² · 完整枚举范围随图导出':'mod-A · 右模 · k 代数闭 · 公式生成与范围说明随图导出';
    if(!current.nodes.some(x=>x.id===selectedId))selectedId=current.nodes[0]?.id;
    config();miniQuiver(scene.quiver||current.quiver);draw();describe();renderTable();inspect();
  }
  function arrowCount(d){return d.edges.reduce((s,e)=>s+(e.multiplicity||1),0);}
  function miniQuiver(q) {
    const n=q.vertices,W=Math.max(185,n*27),H=n<=3?88:112,coords=[];
    if(scene.family==='cyclic'||scene.family==='brauer') {
      for(let i=0;i<n;i++)coords.push(n===1?[W/2,H/2]:[W/2+Math.cos(i*2*Math.PI/n-Math.PI/2)*Math.min(W*.38,60),H/2+Math.sin(i*2*Math.PI/n-Math.PI/2)*(H*.36)]);
    } else if(q.positions){const xs=q.positions.map(p=>p[0]),ys=q.positions.map(p=>p[1]),xmin=Math.min(...xs),ymin=Math.min(...ys),dx=Math.max(...xs)-xmin,dy=Math.max(...ys)-ymin;
      q.positions.forEach(([x,y])=>coords.push([dx?22+(x-xmin)*(W-44)/dx:W/2,dy?22+(y-ymin)*(H-44)/dy:H/2]));
    } else for(let i=0;i<n;i++)coords.push([22+i*(W-44)/Math.max(n-1,1),H*.5+(n>3?(i%2===0?-14:14):0)]);
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg"><defs><marker id="mini-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="none" stroke="#607485"/></marker></defs>`;
    const grouped=new Map();q.edges.forEach(([a,b])=>{const key=a+','+b;grouped.set(key,(grouped.get(key)||0)+1);});
    for(const[key,m]of grouped){const[a,b]=key.split(',').map(Number),[x,y]=coords[a],[u,v]=coords[b],dx=u-x,dy=v-y,d=Math.hypot(dx,dy)||1;
      if(a===b)out+=`<path d="M${x-6} ${y-8}C${x-32} ${y-41} ${x+32} ${y-41} ${x+6} ${y-8}" fill="none" stroke="#607485" marker-end="url(#mini-arrow)"/>`;
      else out+=`<path d="M${x+dx/d*12} ${y+dy/d*12}L${u-dx/d*14} ${v-dy/d*14}" fill="none" stroke="#607485" marker-end="url(#mini-arrow)"/>`;
      if(m>1)out+=`<text x="${(x+u)/2}" y="${(y+v)/2-7}" text-anchor="middle" font-size="10" fill="#607485">${m}</text>`;
    }
    coords.forEach(([x,y],i)=>out+=`<circle cx="${x}" cy="${y}" r="10" fill="white" stroke="#b8cbd5"/><text x="${x}" y="${y+3.5}" text-anchor="middle" font-size="10" fill="#183044">${i+1}</text>`);
    $('quiver-mini').innerHTML=out+'</svg>';
  }
  const defs=`<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L7 3.5L0 7" fill="none" stroke="#8ba1af" stroke-width="1.3"/></marker><marker id="tau-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L7 3.5L0 7" fill="none" stroke="#087f83" stroke-width="1.5"/></marker></defs>`;
  function positions(d) {
    const map=new Map(),tubular=d.family==='cyclic'||d.family==='tube';let W,H;
    if(d.family==='tree'){W=Math.max(540,(d.e+1)*180+30);H=Math.max(360,d.cylinderHeight*86+120);d.nodes.forEach(n=>map.set(n.id,{x:70+n.column*180,y:H-65-(n.row-1)*86,w:n.projective?65:95,h:32}));}
    else if(tubular){W=Math.max(540,(d.n+1)*132+60);H=Math.max(345,d.L*68+100);d.nodes.forEach(n=>map.set(n.id,{x:70+n.column*132,y:H-65-(n.row-1)*68,w:95,h:32}));}
    else {
      const n=d.quiver.vertices,rank=Array(n).fill(0),inDeg=Array(n).fill(0),out=Array.from({length:n},()=>[]);
      d.quiver.edges.forEach(([a,b])=>{out[a].push(b);inDeg[b]++;});const stack=[];inDeg.forEach((x,i)=>{if(x===0)stack.push(i);});
      for(let s=0;s<stack.length;s++){const a=stack[s];out[a].forEach(b=>{rank[b]=Math.max(rank[b],rank[a]+1);if(--inDeg[b]===0)stack.push(b);});}
      const span=Math.max(...rank),step=Math.max(155,(span+1)*60);
      d.nodes.forEach(n=>{const x=n.component==='preinjective'?-n.layer*step-rank[n.vertex]*65:n.layer*step-rank[n.vertex]*65;map.set(n.id,{x,y:62+n.vertex*62,w:95,h:32});});
      const min=Math.min(...Array.from(map.values(),p=>p.x)),max=Math.max(...Array.from(map.values(),p=>p.x));map.forEach(p=>p.x=p.x-min+70);W=Math.max(550,max-min+150);H=Math.max(345,n*62+60);
    }return {map,W,H};
  }
  function edgePath(a,b,kind,oneColumn) {
    if(oneColumn){const dx=kind==='inclusion'?28:-28;return `M${a.x+dx/3} ${a.y+(b.y>a.y?16:-16)} Q${a.x+dx*2} ${(a.y+b.y)/2} ${b.x+dx/3} ${b.y+(b.y>a.y?-20:20)}`;}
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const trim=(p,sign,extra)=>{const s=Math.min(p.w/2/Math.max(Math.abs(dx/len),.001),p.h/2/Math.max(Math.abs(dy/len),.001))+extra;return[p.x+sign*dx/len*s,p.y+sign*dy/len*s];};
    const s=trim(a,1,3),t=trim(b,-1,7);return `M${s[0]} ${s[1]}L${t[0]} ${t[1]}`;
  }
  function renderGraph(d, layout) {
    const {map,W,H}=layout,tubular=d.family==='cyclic'||d.family==='tube'||d.family==='tree',tree=d.family==='tree',step=tree?180:132;let out='';
    const grouped=new Map();
    for(const e of d.edges){const key=e.source+'|'+e.target+'|'+(e.kind||'');if(grouped.has(key))grouped.get(key).multiplicity+=(e.multiplicity||1);else grouped.set(key,{...e,multiplicity:e.multiplicity||1});}
    for(const e of grouped.values()) {
      let a=map.get(e.source),b=map.get(e.target);if(!a||!b)continue;
      if(tubular&&d.n>1&&(tree?d.nodes.find(n=>n.id===e.source).column===0&&d.nodes.find(n=>n.id===e.target).column>=d.n-1:e.kind==='inclusion'&&a.x===70&&b.x>70))a={...a,x:70+d.n*step};
      const opacity=selectedId&&(e.source===selectedId||e.target===selectedId)?1:.72;
      const kind=tree?(d.nodes.find(n=>n.id===e.source).compositionLength<d.nodes.find(n=>n.id===e.target).compositionLength?'inclusion':'quotient'):e.kind;
      out+=`<path class="edge" data-source="${e.source}" data-target="${e.target}" d="${edgePath(a,b,kind,tubular&&d.n===1)}" stroke="#8ba1af" stroke-width="${e.multiplicity>1?1.8:1.35}" opacity="${opacity}" fill="none" marker-end="url(#arrow)"/>`;
      if(e.multiplicity>1)out+=`<text x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2-7}" text-anchor="middle" font-size="11" fill="#607485">${e.multiplicity}</text>`;
    }
    if(tubular){
      if(d.n>1){const gx=70+d.n*step;out+=`<path d="M${gx} 34V${H-35}" stroke="#b8cbd5" stroke-dasharray="4 5"/><text x="${gx}" y="22" text-anchor="middle" font-size="11" fill="#8ba1af">第 1 列重复</text>`;d.nodes.filter(n=>n.column===0).forEach(n=>{const p=map.get(n.id);out+=nodeMarkup(n,{...p,x:gx},true);});}
      if(d.family==='tube')out+=`<text x="${Math.max(190,W/2)}" y="26" text-anchor="middle" font-size="12" fill="#bb6534">⋮ 准长度无上界 ⋮</text>`;
    } else if(!scene.finite){const side=d.nodes[0]?.component==='preinjective'?'左侧':'右侧';out+=`<text x="${W/2}" y="${H-15}" text-anchor="middle" font-size="12" fill="#bb6534">向${side}无限延伸 ⋯</text>`;}
    d.nodes.forEach(n=>out+=nodeMarkup(n,map.get(n.id),false));
    if($('show-tau').checked&&selectedId){const n=d.nodes.find(n=>n.id===selectedId),a=map.get(selectedId),b=n&&map.get(n.tauId);
      if(a&&b){const self=n.id===n.tauId,path=self?`M${a.x-18} ${a.y-18}C${a.x-65} ${a.y-65} ${a.x+65} ${a.y-65} ${a.x+18} ${a.y-18}`:`M${a.x} ${a.y-21}Q${(a.x+b.x)/2} ${Math.min(a.y,b.y)-63} ${b.x} ${b.y-22}`;
        out+=`<path d="${path}" fill="none" stroke="#087f83" stroke-width="1.7" stroke-dasharray="5 4" marker-end="url(#tau-arrow)"/><text x="${self?a.x:(a.x+b.x)/2}" y="${self?a.y-54:Math.min(a.y,b.y)-44}" text-anchor="middle" font-size="12" fill="#087f83">τ</text>`;}
    }
    return out;
  }
  function nodeMarkup(n,p,ghost) {
    const c=nodeColor(n),sel=n.id===selectedId&&!ghost,title=`${label(n)} · dim ${dims(n)}${n.projective?' · 投射':''}${n.injective?' · 内射':''}`;
    return `<g class="module" data-node="${n.id}" data-ghost="${ghost}" role="button" tabindex="${ghost?-1:0}" ${ghost?'aria-hidden="true"':''} aria-label="${esc(title)}" opacity="${ghost?.32:1}"><title>${esc(title)}</title><rect x="${p.x-p.w/2}" y="${p.y-p.h/2}" width="${p.w}" height="${p.h}" rx="7" fill="${sel?'#d9efea':'#fff'}" stroke="${sel?'#087f83':ghost?'#a7b7c1':c}" stroke-width="${sel?2.4:1.3}" ${ghost?'stroke-dasharray="4 3"':''}/><text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="11" font-family="ui-monospace,Consolas,sans-serif" fill="${c}">${esc(label(n))}</text></g>`;
  }
  function overview() {
    const W=920,H=405;let out=`<text x="460" y="33" font-size="14" fill="#183044" text-anchor="middle">Γ(mod-A) = 预投射 ⊔ 正则管族 ⊔ 预内射</text>`;
    const boxes=[{x:22,w:228,title:'预投射 P',sub:'离散 · τ⁻ᵗPᵢ',view:'preprojective'},{x:273,w:374,title:'正则 R',sub:'ℙ¹(k) 参数化的管族',view:'regular'},{x:670,w:228,title:'预内射 I',sub:'离散 · τᵗIᵢ',view:'preinjective'}];
    boxes.forEach(b=>out+=`<g data-goto="${b.view}" role="button" tabindex="0" aria-label="展开${b.title}" style="cursor:pointer"><rect x="${b.x}" y="59" width="${b.w}" height="285" rx="14" fill="#fff" stroke="#d5e2e8"/><text x="${b.x+b.w/2}" y="88" text-anchor="middle" font-size="15" fill="#183044">${b.title}</text><text x="${b.x+b.w/2}" y="111" text-anchor="middle" font-size="11" fill="#607485">${b.sub}</text></g>`);
    const chain=(start,y,injective=false)=>{for(let j=0;j<4;j++){const x=start+j*46,c=injective?(j>1?'#4774ba':'#087f83'):(j<2?'#bb6534':'#087f83');out+=`<circle cx="${x}" cy="${y+(j%2)*32}" r="5" fill="${c}"/>`;if(j<3){const end=x+46,Y=y+((j+1)%2)*32;out+=`<path d="M${x+7} ${y+(j%2)*32}L${end-7} ${Y}" stroke="#8ba1af" fill="none" marker-end="url(#arrow)"/>`;}}};
    chain(62,173);chain(62,239);chain(710,173,true);chain(710,239,true);
    out+=`<text x="218" y="210" font-size="18" fill="#8ba1af">⋯</text><text x="684" y="210" font-size="18" fill="#8ba1af">⋯</text>`;
    const display=scene.ranks.concat([1,1]).slice(0,5),cx=display.length;
    display.forEach((rank,k)=>{const x=313+k*(295/Math.max(1,cx-1));out+=`<ellipse cx="${x}" cy="164" rx="18" ry="6" fill="#f1faf8" stroke="#6daea9" stroke-dasharray="3 3"/><path d="M${x-18} 164V254 M${x+18} 164V254" stroke="#6daea9" fill="none"/><ellipse cx="${x}" cy="254" rx="18" ry="6" fill="#f1faf8" stroke="#6daea9"/><text x="${x}" y="283" text-anchor="middle" font-size="11" fill="#607485">秩 ${rank}</text><text x="${x}" y="211" text-anchor="middle" font-size="18" fill="#6daea9">⋮</text>`;});
    out+=`<text x="460" y="319" text-anchor="middle" font-size="11" fill="#607485">例外秩：${scene.ranks.length?scene.ranks.join(', '):'无'}；其余所有参数对应秩 1 管</text><text x="460" y="379" text-anchor="middle" font-size="12" fill="#607485">点上方分支按钮展开。此视图概括分支形状，圆点不是全部模。</text>`;
    return{W,H,out};
  }
  function draw() {
    if(!scene||!current)return;
    const svg=$('graph');let W,H,out;
    if(scene.family==='affine'&&view==='overview'){({W,H,out}=overview());pos=new Map();}
    else{const layout=positions(current);pos=layout.map;W=layout.W;H=layout.H;out=renderGraph(current,layout);}
    // Leave enough natural width for dense E-type graphs, rather than shrinking labels to illegibility.
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('width',String(W));svg.style.width=`${(scene.family==='affine'&&view==='overview'?100:Math.max(100,W/8.2))*num('zoom')/100}%`;
    svg.innerHTML=defs+`<title>${esc($('algebra-title').textContent)} — ${esc($('scope-badge').textContent)}</title><desc>${esc($('graph-note').textContent)}</desc>`+out;
    svg.querySelectorAll('[data-node]').forEach(g=>{const fn=()=>selectNode(g.dataset.node);g.addEventListener('click',fn);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}});});
    svg.querySelectorAll('[data-goto]').forEach(g=>{const fn=()=>{view=g.dataset.goto;regenerate();};g.addEventListener('click',fn);g.addEventListener('keydown',e=>{if(e.key==='Enter'){fn();}});});
  }
  function selectNode(id){if(!scene||!current)return;selectedId=id;draw();inspect();renderTable();}
  function inspect() {
    const n=chosen();if(scene.family==='affine'&&view==='overview'){
      $('inspector').innerHTML='<div class="eyebrow">03 / READ THE STRUCTURE</div><h2>三个区域，不同分支</h2><div class="module-name">P ⊔ R ⊔ I</div><p class="inspection-note">两侧是离散序列；中间每个 λ 对应一根无限高的管。先选择分支，再点击模。</p><div class="divider"></div><p class="inspection-note">虚根 δ='+esc('('+scene.delta.join(',')+')')+'。同质管每个准长度 ℓ 有一个模，维数向量 ℓδ；不同 λ 给出不同同构类。</p>';return;
    }
    if(!n){$('inspector').innerHTML='<p class="empty">当前没有顶点。</p>';return;}
    const tau=n.tauId?current.nodes.find(x=>x.id===n.tauId):null;
    let dimension=n.dimension?dims(n):'Σ dim Eₛ（见下）',extra='',description='';
    if(n.kind==='brauer-tree'){
      const factors=a=>a.map((c,i)=>c?`S${i+1}${c>1?'^'+c:''}`:'').filter(Boolean).join(' ⊕ ');
      extra=`<div class="small">顶：${esc(factors(n.top))}</div><div class="small">底：${esc(factors(n.socle))}</div><div class="divider"></div><div class="small">${n.projective?'由树两端数据构造的投射表示':'字符串（逆词代表同一个模）'}</div><span class="tree-basis">${esc(n.projective?'P'+(n.projectiveVertex+1):n.wordLabel)}</span><details><summary class="small">查看基与箭头作用</summary><span class="tree-basis">${n.basisVertices.map((v,i)=>`z${i+1}@${v+1}`).join(', ')}</span><div class="tree-rep-scroll">${n.arrowMaps.map((pairs,i)=>pairs.length?'<p>a'+(i+1)+': '+pairs.map(([s,t])=>`z${s+1}→z${t+1}`).join(', ')+'</p>':'').join('')}</div><span class="micro">系数均为 1；未列出的基向量像为 0。@ 后为 quiver 顶点（树边）编号。</span></details>`;
      description=`组成长度 ${n.compositionLength}；dim End=${n.endDimension}，rad End 维数 ${n.endDimension-1}。${n.projective?'其 radical 与 socle 商按真实表示识别，不能套用星形的最长单列模。':'这是 socle 商的一个完整枚举字符串，再沿 A→A/soc A 看作 A 模。'}维数向量相同仍可能不同构。`;
    } else if(n.kind==='cyclic'){
      const comps=Array.from({length:n.length},(_,s)=>'S'+((n.top+s)%current.n+1));
      extra='<div class="small">组成因子 · 顶 → 底</div><div class="composition">'+comps.map(x=>'<span>'+x+'</span>').join('')+'</div>';
      description=`顶 S${n.top+1} 与长度 ${n.length} 唯一确定这个单列模。End ≅ k[ε]/(ε^${n.endDimension})，ε 沿 ${current.n} 层移动；同维数向量不能代替同构判别。`;
    } else if(n.kind==='tube'){
      const quasi=Array.from({length:n.quasiLength},(_,s)=>'E'+((n.column+s)%n.rank+1));
      extra='<div class="small">准组成因子 · 正则顶 → 底</div><div class="composition">'+quasi.map(x=>'<span>'+x+'</span>').join('')+'</div>';
      description=`准长度 ${n.quasiLength}；τ 周期 ${n.rank}。${n.rank===1?'维数向量为 ℓδ；λ 区分不同同质管。':'Eₛ 是本管的准单模，所有 Eₛ 的维数之和为 δ。这里没有给出具体准单根的坐标。'}${n.boundary?' 此顶点在当前窗口顶端，图上方还有模。':''}`;
      if(scene.type==='K')description+=' Kronecker 的 λ∈k 模可用两箭头 (Iℓ,Jℓ(λ)) 表示；λ=∞ 用 (Jℓ(0),Iℓ)。';
    } else {
      description=scene.finite?'在此 Dynkin quiver 上，这个正根维数向量唯一确定一个不可分解同构类。此面板给出同构类和 AR 位置，未输出具体箭头矩阵。':`这是 ${n.component==='preinjective'?'τᵗIᵢ':'τ⁻ᵗPᵢ'} 序列中的一个模。Coxeter 变换决定其维数向量。${n.boundary?'当前窗口在此截断。':''}`;
    }
    const outside=n.tauOutside||n.tauId&&!tau;const tauText=tau?label(tau):outside?'窗口外（非零）':'0（投射）';
    $('inspector').innerHTML=`<div class="eyebrow">03 / MODULE INSPECTOR</div><h2>所选不可分解模</h2><div class="module-name">${esc(label(n))}</div><div class="detail-grid"><span>维数向量</span><b>${esc(dimension)}</b><span>总维数</span><b>${n.dimension?n.dimension.reduce((a,b)=>a+b,0):'未展开'}</b><span>投射 / 内射</span><b>${n.projective?'是':'否'} / ${n.injective?'是':'否'}</b><span>τM</span><b>${esc(tauText)}</b></div>${extra}<p class="inspection-note">${esc(description)}</p>${tau?'<button class="tau-btn" id="follow-tau">选中 τM →</button>':''}`;
    if(tau)$('follow-tau').addEventListener('click',()=>selectNode(tau.id));
  }
  function describe() {
    let intro='',details='',bars=[];
    if(scene.family==='tree'){
      const r=scene.fullReport,counts=new Map();current.nodes.forEach(n=>counts.set(n.compositionLength,(counts.get(n.compositionLength)||0)+1));bars=[...counts].sort((a,b)=>a[0]-b[0]);
      intro=`<p><strong>完整分类：${r.stableCount} 个非投射字符串模 + ${r.e} 个投射模 = ${r.fullCount} 个不可分解同构类。</strong>枚举到合法字符串的扩展耗尽；逆词去重，不按维数向量合并。</p>`;
      const path=ids=>ids.map(i=>'a'+(i+1)).join('·'),relations=r.relations.zeroPaths.map(a=>path(a)+'=0').concat(r.relations.commutativity.map(a=>path(a.left)+' = '+path(a.right)));
      details=`<p>稳定图为 ℤA${r.e*r.multiplicity}/〈τ^${r.e}〉；完整图额外包含每个 Pᵢ 的真实附着。当前树的代数维数是 <strong>${r.algebraDimension}</strong>，来自 Σᵥ mᵥdeg(v)²；不可分解模数 ${r.fullCount} 是另一项数量。</p><details><summary>代数的 quiver 与关系</summary><div class="tree-algebra-details"><code>${r.quiver.arrows.map(a=>`a${a.id+1}: ${a.source+1}→${a.target+1} （树顶点 ${a.treeVertex}）`).map(esc).join('<br>')}<br>${relations.map(esc).join('<br>')}</code></div></details><p>k=GF(5)，右模。Hom 由精确交换方程求解；稳定箭头来自 socle 商上的 rad/rad²，再补投射附着。τ 由完整 Hom 列唯一匹配识别。导出 JSON 包含树、关系、全部基与箭头矩阵、Hom 矩阵及完整图。</p>`;
    } else if(scene.family==='dynkin'){
      intro='<p><strong>有限个离散同构类。</strong>每个顶点对应一个正根；一般模是这些不可分解模的有限直和。</p>';
      const counts=new Map();current.nodes.forEach(n=>{const d=n.dimension.reduce((a,b)=>a+b,0);counts.set(d,(counts.get(d)||0)+1);});bars=Array.from(counts).sort((a,b)=>a[0]-b[0]);
      details='<p>横轴是总维数，柱高是该维数的不可分解同构类数。改变定向可能改变箭头及 P/I 位置；维数向量的正根集合保持不变。</p>';
    } else if(scene.family==='cyclic'||scene.family==='brauer') {
      intro=`<p><strong>每个长度 ℓ 有 ${scene.n} 个模</strong>，分别以 S₁,…,S${scene.n} 为顶。完整范围 ℓ=1,…,${scene.L}；共 ${scene.n*scene.L} 个。当前${current.stable?'稳定图已去掉长度 L 的模':'包含全部模'}。</p>`;
      bars=Array.from({length:current.stable?scene.L-1:scene.L},(_,i)=>[i+1,scene.n]);
      details=`<p>稳定图形状：ℤA${scene.L-1}/〈τ^${scene.n}〉，是<strong>有限</strong>高度的圆柱。非投射模的 τ 周期为 ${scene.n}。${scene.family==='brauer'?`取 L=nm+1=${scene.L}，代数对称。三边 m=1 / m=2 的模数分别为 12 / 21。`:`代数自内射；${(scene.L-1)%scene.n===0?'这里 L≡1 (mod n)，也是对称代数。':'这里 L≢1 (mod n)，一般不是对称代数；不能把 τ 等同于 Ω²。'}`}</p>`;
    } else {
      const kr=scene.type==='K',standard=scene.quiver.edges[0][0]===0;
      const pdim=standard?'(r,r+1)':'(r+1,r)',idim=standard?'(r+1,r)':'(r,r+1)';
      intro=`<div class="tame-parts"><div class="part"><b>预投射 · 离散</b><span>${kr?'Pᵣ：'+pdim+'，r≥0':'τ⁻ᵗPᵢ，t≥0；每层 |Q₀| 个'}</span></div><div class="part"><b>正则 · 一参数族</b><span>例外秩：${scene.ranks.join(', ')||'无'}；其余秩 1</span></div><div class="part"><b>预内射 · 离散</b><span>${kr?'Iᵣ：'+idim+'，r≥0':'τᵗIᵢ，t≥0；每层 |Q₀| 个'}</span></div></div>`;
      const exceptional=scene.ranks.length?`例外参数集合 D 有 ${scene.ranks.length} 个点；管秩依次为 (${scene.ranks.join(',')})。`:'没有例外管。';
      details=`<p>${exceptional}每个 λ∈ℙ¹(k)∖D 对应一根同质管，每个准长度 ℓ≥1 有一个维数向量 ℓδ 的模；同样的维数向量在不同 λ 处给出不同同构类。</p><p>秩 r 的例外管每个准长度有 r 个顶点，τ 周期为 r。管的高度没有上界；它不是 Brauer 星的有限圆柱。</p>`;
      if(view==='regular')bars=Array.from({length:scene.depth},(_,i)=>[i+1,scene.rank]);
      else if(view!=='overview') {const counts=new Map();current.nodes.forEach(n=>counts.set(n.layer,(counts.get(n.layer)||0)+1));bars=Array.from(counts).sort((a,b)=>a[0]-b[0]);}
      if(kr)details+='<p>Kronecker：Pᵣ ⇉ Pᵣ₊₁，Iᵣ₊₁ ⇉ Iᵣ；相邻位置之间有两条不可约态射。τPᵣ=Pᵣ₋₂（r≥2），τIᵣ=Iᵣ₊₂，τRλ(ℓ)=Rλ(ℓ)。</p>';
      if(view==='regular'&&scene.rank>1)details+='<p><strong>坐标范围：</strong>当前例外管用抽象准单模 Eₛ 标记；只有准长度为管秩倍数时展开为 qδ。未生成其余顶点的具体维数坐标，也未指定例外参数在 ℙ¹ 上的数值。</p>';
    }
    $('distribution-description').innerHTML=intro;$('structure-description').innerHTML=details;
    $('distribution-title').textContent=scene.family==='affine'?'整个模范畴如何分布':'不可分解模的维数与层次';
    if(bars.length){const max=Math.max(...bars.map(b=>b[1]));$('distribution-chart').innerHTML='<div class="distribution">'+bars.map(([x,y])=>`<div class="bar-wrap" title="${x}: ${y} 个"><b>${y}</b><div class="bar" style="height:${y/max*56}px"></div><small>${x}</small></div>`).join('')+'</div>';
      $('distribution-chart').insertAdjacentHTML('beforeend','<div class="micro">横轴：'+(scene.family==='dynkin'?'总维数':scene.family==='affine'?(view==='regular'?'准长度（当前一个管）':'τ 迭代层数'):'组成长度')+'；柱高：当前范围内的模数</div>');
    }else $('distribution-chart').innerHTML='';
  }
  function renderTable() {
    if(!scene||!current)return;
    const overviewMode=scene.family==='affine'&&view==='overview';
    $('module-table-title').textContent=overviewMode?'分支目录':scene.finite?(current.stable?'全部非投射不可分解模':'全部不可分解模'):'当前窗口中的模（不穷尽）';
    $('module-search').hidden=overviewMode;
    if(overviewMode){$('module-table').innerHTML='<tr><td>预投射</td><td>dim τ⁻ᵗPᵢ=C⁻ᵗ dim Pᵢ</td><td>含全部 Pᵢ</td><td>向 Pᵢ 边界移动</td></tr><tr><td>正则管族</td><td>同质管 ℓδ；例外管用 Eₛ[ℓ]</td><td>无 P/I</td><td>周期 r</td></tr><tr><td>预内射</td><td>dim τᵗIᵢ=Cᵗ dim Iᵢ</td><td>含全部 Iᵢ</td><td>无上界</td></tr>';return;}
    const search=val('module-search').trim().toLowerCase(),filtered=current.nodes.filter(n=>(label(n)+' '+dims(n)).toLowerCase().includes(search));
    $('module-table').innerHTML=filtered.map(n=>{const tau=current.nodes.find(x=>x.id===n.tauId);return `<tr data-node="${n.id}" class="${n.id===selectedId?'selected':''}" aria-selected="${n.id===selectedId}"><td>${esc(label(n))}</td><td>${esc(dims(n))}</td><td>${n.projective?'P':''}${n.projective&&n.injective?' / ':''}${n.injective?'I':''}${!n.projective&&!n.injective?'—':''}</td><td>${esc(tau?label(tau):n.tauId||n.tauOutside?'窗口外（非零）':'0')}</td></tr>`;}).join('')||'<tr><td colspan="4">没有匹配的模。</td></tr>';
    $('module-table').querySelectorAll('tr[data-node]').forEach(tr=>tr.addEventListener('click',()=>selectNode(tr.dataset.node)));
  }
  function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('已导出 '+name);}
  $('export-svg').addEventListener('click',()=>{
    if(!scene||!current){toast('尚未得到完整计算结果');return;}
    const svg=$('graph').cloneNode(true),box=svg.getAttribute('viewBox').split(' ').map(Number),W=box[2],H=box[3];svg.removeAttribute('style');svg.setAttribute('width',W);svg.setAttribute('height',H+105);svg.setAttribute('viewBox',`0 0 ${W} ${H+105}`);
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x','20');text.setAttribute('y',H+24);text.setAttribute('font-size','13');text.setAttribute('fill','#183044');text.textContent=$('algebra-title').textContent+' · '+$('scope-badge').textContent;svg.append(text);
    const desc=document.createElementNS('http://www.w3.org/2000/svg','text');desc.setAttribute('x','20');desc.setAttribute('y',H+48);desc.setAttribute('font-size','10');desc.setAttribute('fill','#607485');desc.textContent='右模 · '+(scene.family==='tree'?'GF(5) · 全部字符串及真实投射模；精确 Hom/rad²；重复顶点不计数':'k 代数闭 · '+(scene.family==='affine'?`分支结构；窗口深度 ${scene.depth}；ℙ¹(k) 参数族未穷尽`:'理论分类公式生成；虚线列重复顶点不计数'));svg.append(desc);
    download('ar-quiver-'+val('family')+'.svg','<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(svg),'image/svg+xml');
  });
  $('export-json').addEventListener('click',()=>{
    if(!scene||!current){toast('尚未得到完整计算结果');return;}
    if(scene.family==='tree'){const data={...scene.fullReport,view:current.stable?'stable':'full',displayedNodeIds:current.nodes.map(n=>n.id),notes:$('graph-note').textContent,homMatrixNodeOrder:scene.fullReport.nodes.map(n=>n.id)};download('ar-quiver-brauer-tree.json',JSON.stringify(data,null,2),'application/json');return;}
    const data={schema:'quiver-atlas-1.0',algebra:$('algebra-title').textContent,formula:$('algebra-formula').textContent,field:'algebraically closed k',convention:'finite-dimensional right modules; maps follow Q arrows',view:scene.family==='affine'?view:current.stable?'stable':'full',
      completeness:scene.family==='affine'?'full component-family structure; finite windows only':current.stable?'complete stable AR quiver; projectives excluded':'complete module-category AR quiver',
      notes:$('graph-note').textContent,quiver:scene.quiver||current.quiver,
      parameters:{n:scene.n,L:scene.L,m:scene.m,depth:scene.depth,rank:scene.rank,parameter:scene.parameter},
      componentStructure:scene.family==='affine'?{preprojective:'tau^(-t) P_i, t>=0',preinjective:'tau^t I_i, t>=0',regular:{index:'P^1(k)',exceptionalRanks:scene.ranks,otherRanks:1,delta:scene.delta}}:null,
      windows:scene.family==='affine'&&view==='overview'?{preprojective:scene.pp,preinjective:scene.pi,sampleTube:scene.regular}:{nodes:current.nodes,edges:current.edges},
      limitations:['Classification-driven formulas, not a general QPA solver','Exceptional tube quasi-simple dimension coordinates not computed','Concrete arrow matrices of representations not exported','Not a finite-field regular-module enumerator']};
    download('ar-quiver-'+val('family')+'.json',JSON.stringify(data,null,2),'application/json');
  });
  const safeRegenerate=()=>{try{regenerate();}catch(e){$('graph-note').textContent='生成失败：'+e.message;console.error(e);}};
  BrauerTreeEditor.init(input=>{treeInput=input;selectedId=null;safeRegenerate();});treeInput=BrauerTreeEditor.getSnapshot();
  $('tree-cancel').addEventListener('click',()=>{treeJob++;stopTreeWorker();$('tree-progress').hidden=true;BrauerTreeEditor.setStatus('已取消；可修改输入后重试');$('graph-note').textContent='计算已取消，没有输出部分结果。';});
  document.querySelectorAll('.settings select,.settings input').forEach(el=>el.addEventListener(el.type==='range'?'input':'change',safeRegenerate));
  $('zoom').addEventListener('input',draw);$('module-search').addEventListener('input',renderTable);
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;selectedId=null;safeRegenerate();}));
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    $('stable').checked=false;$('orientation').value='forward';$('size').min='1';$('size').max='12';$('size').value='3';$('module-search').value='';selectedId=null;
    if(b.dataset.preset==='a3'){$('family').value='dynkin';$('dynkin-type').value='A';}
    else if(b.dataset.preset==='kronecker'){$('family').value='affine';$('affine-type').value='K';view='overview';}
    else{$('family').value='brauer';$('multiplicity').value=b.dataset.preset==='m1'?'1':'2';}
    safeRegenerate();
  }));
  window.addEventListener('hashchange',()=>{const name=location.hash.slice(1);if(['explore','classification','methods'].includes(name))setPanel(name);});
  safeRegenerate();
})();
