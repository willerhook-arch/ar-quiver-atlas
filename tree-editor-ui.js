/* Local tree editor. Edge numbers are displayed from 1; engine indices start at 0. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let edges=[['A','B'],['B','C'],['C','D']],orders={},exceptional='B',multiplicity=2,selected='B',dirty=false,apply=()=>{};
  const vertices=()=>[...new Set(edges.flat())];
  const incident=v=>edges.map((e,i)=>e.includes(v)?i:-1).filter(i=>i>=0);
  function error(text){$('tree-error').textContent=text;$('tree-error').hidden=!text;}
  function markDirty(){dirty=true;$('tree-dirty').textContent='编辑尚未应用';}
  function normalizeOrders(){const out=Object.create(null);for(const v of vertices()){const inc=incident(v),old=orders[v]||[];out[v]=old.filter(i=>inc.includes(i));for(const i of inc)if(!out[v].includes(i))out[v].push(i);}orders=out;}
  function readEdges(){return [...$('tree-edge-table').querySelectorAll('tr')].map(tr=>[tr.querySelector('[data-end="0"]').value.trim(),tr.querySelector('[data-end="1"]').value.trim()]);}
  function validateTree(candidate){
    if(!Array.isArray(candidate)||candidate.length<1||candidate.length>10||candidate.some(e=>!Array.isArray(e)||e.length!==2||e.some(v=>typeof v!=='string'&&typeof v!=='number')))throw Error('树需要 1–10 条边；每条边须恰有两个有效端点。');
    const vs=[...new Set(candidate.flat())];
    for(const v of vs)if(!/^[\p{L}\p{N}_-]{1,16}$/u.test(v)||['__proto__','constructor','prototype'].includes(v))throw Error('顶点名请使用 1–16 个字母、数字、中文、下划线或短横线。');
    const neighbors=new Map(vs.map(v=>[v,[]])),pairs=new Set();
    for(const[a,b]of candidate){if(a===b)throw Error('Brauer 树不能有自环。');const k=[a,b].sort().join('|');if(pairs.has(k))throw Error('两顶点之间不能有重复边。');pairs.add(k);neighbors.get(a).push(b);neighbors.get(b).push(a);}
    const seen=new Set([vs[0]]),todo=[vs[0]];for(let j=0;j<todo.length;j++)for(const v of neighbors.get(todo[j]))if(!seen.has(v)){seen.add(v);todo.push(v);}
    if(seen.size!==vs.length)throw Error('输入不连通：所有边必须组成一棵树。');
    if(vs.length!==candidate.length+1)throw Error('输入含有圈；一般 Brauer graph 不属于本次有限型树引擎。');
    return vs;
  }
  function updateEdges(){try{const next=readEdges();validateTree(next);edges=next;normalizeOrders();if(!vertices().includes(exceptional))exceptional=vertices()[0];if(!vertices().includes(selected))selected=vertices()[0];render();markDirty();error('');return true;}catch(e){error(e.message);return false;}}
  function readInput(){
    const next=readEdges(),vs=validateTree(next);
    const fields=[...$('tree-orders').querySelectorAll('input')];
    if(fields.length!==vs.length||fields.some(el=>!vs.includes(el.dataset.vertex)))throw Error('边的端点已改变。请先点“更新顶点与循环序”，再检查新循环序。');
    edges=next;
    for(const el of $('tree-orders').querySelectorAll('input')){
      const v=el.dataset.vertex,order=el.value.trim().split(/[\s,，]+/).filter(Boolean).map(x=>Number(x)-1),inc=incident(v);
      if(order.length!==inc.length||new Set(order).size!==inc.length||order.some(i=>!Number.isInteger(i)||!inc.includes(i)))throw Error(`顶点 ${v} 的循环序必须恰好包含关联边 ${inc.map(i=>i+1).join(', ')}，各一次。`);
      orders[v]=order;
    }
    exceptional=$('tree-exceptional').value;multiplicity=Number($('tree-multiplicity').value);
    if(!Number.isInteger(multiplicity)||multiplicity<1||multiplicity>8)throw Error('异常重数须为 1–8 的整数；其余顶点重数固定为 1。');
    const expected=edges.length*(edges.length*multiplicity+1);
    if(expected>150)throw Error(`此输入有 ${expected} 个不可分解同构类，超过浏览器精确计算的 150 个资源上限。请减少边数或重数；程序不会用截断冒充完整结果。`);
    return {edges:edges.map(e=>e.slice()),orders:Object.fromEntries(Object.entries(orders).map(([v,o])=>[v,o.slice()])),exceptionalVertex:exceptional,multiplicity,field:5};
  }
  function draw(){
    const vs=vertices(),N=vs.length,neighbors=new Map(vs.map(v=>[v,[]]));edges.forEach(([a,b],i)=>{neighbors.get(a).push([b,i]);neighbors.get(b).push([a,i]);});
    const root=vs.reduce((best,v)=>incident(v).length>incident(best).length?v:best,vs[0]),parent=new Map([[root,null]]),sub=new Map(),coords=new Map();
    function weight(v){let w=0;for(const[u]of neighbors.get(v))if(u!==parent.get(v)){parent.set(u,v);w+=weight(u);}sub.set(v,w||1);return w||1;}
    weight(root);
    const W=430,H=270,maxDepth={v:0};
    function place(v,depth,start,end){maxDepth.v=Math.max(maxDepth.v,depth);coords.set(v,[depth,(start+end)/2]);let at=start,seq=(orders[v]||incident(v)).slice();
      if(parent.get(v)!=null){const pe=neighbors.get(v).find(([u])=>u===parent.get(v))[1],p=seq.indexOf(pe);seq=seq.slice(p+1).concat(seq.slice(0,p+1));}
      const ordered=seq.map(i=>neighbors.get(v).find(x=>x[1]===i)).filter(Boolean);
      for(const[u]of ordered)if(u!==parent.get(v)){const next=at+(end-start)*sub.get(u)/sub.get(v);place(u,depth+1,at,next);at=next;}}
    place(root,0,0,1);coords.forEach((p,v)=>coords.set(v,[maxDepth.v?42+p[0]*(W-84)/maxDepth.v:W/2,32+p[1]*(H-64)]));
    let html=`<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="自定义 Brauer 树">`;
    edges.forEach(([a,b],i)=>{const[x,y]=coords.get(a),[u,v]=coords.get(b);html+=`<line x1="${x}" y1="${y}" x2="${u}" y2="${v}" stroke="#8da5b5" stroke-width="2"/><rect x="${(x+u)/2-12}" y="${(y+v)/2-10}" width="24" height="20" rx="5" fill="#fff"/><text x="${(x+u)/2}" y="${(y+v)/2+4}" text-anchor="middle" font-size="12" fill="#607485">${i+1}</text>`;});
    for(const v of vs){const[x,y]=coords.get(v),ex=v===exceptional&&multiplicity>1;html+=`<g role="button" tabindex="0" data-tree-vertex="${esc(v)}" aria-label="选择树顶点 ${esc(v)}"><circle cx="${x}" cy="${y}" r="${ex?19:15}" fill="${ex?'#fff0dd':v===selected?'#dcf2ec':'white'}" stroke="${ex?'#bc7736':'#4b8d8a'}" stroke-width="${v===selected?3:1.5}"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="11" fill="#183044">${esc(v)}</text>${ex?`<text x="${x}" y="${y-25}" text-anchor="middle" font-size="11" fill="#a76226">m=${multiplicity}</text>`:''}</g>`;}
    $('tree-canvas').innerHTML=html+'</svg>';
    $('tree-canvas').querySelectorAll('[data-tree-vertex]').forEach(g=>{const fn=()=>{selected=g.dataset.treeVertex;$('tree-leaf-parent').value=selected;draw();};g.addEventListener('click',fn);g.addEventListener('keydown',e=>{if(e.key==='Enter')fn();});});
    $('tree-summary').textContent=`${edges.length} 条边 / ${vs.length} 个树顶点；代数有 ${edges.length} 个简单模。图上的边号就是简单模编号。`;
  }
  function render(){
    normalizeOrders();const vs=vertices();
    $('tree-edge-table').innerHTML=edges.map(([a,b],i)=>`<tr><td>${i+1}</td><td><input data-end="0" aria-label="边 ${i+1} 起点" value="${esc(a)}" maxlength="16"></td><td>—</td><td><input data-end="1" aria-label="边 ${i+1} 终点" value="${esc(b)}" maxlength="16"></td></tr>`).join('');
    $('tree-orders').innerHTML=vs.map(v=>`<label class="tree-order-row"><span>${esc(v)}</span><input data-vertex="${esc(v)}" aria-label="顶点 ${esc(v)} 的循环序" value="${orders[v].map(i=>i+1).join(', ')}"></label>`).join('');
    const options=vs.map(v=>`<option value="${esc(v)}">${esc(v)} · 度 ${incident(v).length}</option>`).join('');
    $('tree-exceptional').innerHTML=options;$('tree-exceptional').value=exceptional;
    $('tree-leaf-parent').innerHTML=options;$('tree-leaf-parent').value=selected;
    $('tree-multiplicity').value=multiplicity;$('tree-multiplicity-value').textContent=multiplicity;
    $('tree-edge-table').querySelectorAll('input').forEach(x=>x.addEventListener('input',markDirty));
    $('tree-orders').querySelectorAll('input').forEach(x=>x.addEventListener('input',()=>{const arr=x.value.split(/[\s,，]+/).filter(Boolean).map(n=>Number(n)-1);if(arr.length===incident(x.dataset.vertex).length&&new Set(arr).size===arr.length&&arr.every(i=>incident(x.dataset.vertex).includes(i))){orders[x.dataset.vertex]=arr;draw();}markDirty();}));
    draw();
  }
  function preset(name){
    if(name==='star'){edges=[['A','B'],['A','C'],['A','D']];exceptional='A';multiplicity=2;}
    else if(name==='fork'){edges=[['A','B'],['B','C'],['B','D'],['D','E']];exceptional='B';multiplicity=1;}
    else if(name==='double'){edges=[['A','B'],['A','C'],['A','D'],['D','E'],['D','F']];exceptional='D';multiplicity=1;}
    else{edges=[['A','B'],['B','C'],['C','D']];exceptional='B';multiplicity=2;}
    orders=Object.create(null);selected=exceptional;render();markDirty();error('');
  }
  function init(onApply){
    apply=onApply;render();
    $('tree-update').addEventListener('click',updateEdges);
    $('tree-apply').addEventListener('click',()=>{try{const input=readInput();error('');dirty=false;$('tree-dirty').textContent='正在计算…';apply(input);}catch(e){error(e.message);}});
    $('tree-exceptional').addEventListener('change',()=>{exceptional=$('tree-exceptional').value;draw();markDirty();});
    $('tree-leaf-parent').addEventListener('change',()=>{selected=$('tree-leaf-parent').value;draw();});
    $('tree-multiplicity').addEventListener('input',()=>{multiplicity=Number($('tree-multiplicity').value);$('tree-multiplicity-value').textContent=multiplicity;draw();markDirty();});
    $('tree-leaf-add').addEventListener('click',()=>{if(!updateEdges())return;if(edges.length>=10){error('交互编辑器最多 10 条边。');return;}const vs=vertices();let i=0;while(vs.includes('V'+i))i++;edges.push([$('tree-leaf-parent').value,'V'+i]);render();markDirty();});
    $('tree-leaf-remove').addEventListener('click',()=>{if(!updateEdges())return;const v=$('tree-leaf-parent').value,inc=incident(v);if(edges.length===1||inc.length!==1){error('请选择度为 1 的叶子；至少保留一条边。');return;}edges.splice(inc[0],1);orders=Object.create(null);if(exceptional===v)exceptional=vertices()[0];selected=vertices()[0];render();markDirty();});
    $('tree-preset').addEventListener('change',()=>preset($('tree-preset').value));
    $('tree-reset-order').addEventListener('click',()=>{orders=Object.create(null);render();markDirty();});
    $('tree-export').addEventListener('click',()=>{try{const input=readInput(),u=URL.createObjectURL(new Blob([JSON.stringify(input,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='brauer-tree-input.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}catch(e){error(e.message);}});
    $('tree-import').addEventListener('change',async()=>{try{
      const file=$('tree-import').files[0];if(!file)return;if(file.size>32768)throw Error('配置文件超过 32 KiB。');const obj=JSON.parse(await file.text());validateTree(obj.edges);
      const next=obj.edges.map(e=>e.map(String)),vs=validateTree(next),m=obj.multiplicity===undefined?1:obj.multiplicity;
      if(!Number.isInteger(m)||m<1||m>8)throw Error('重数必须是 1–8 的整数。');
      if(obj.field!==undefined&&obj.field!==5)throw Error('此引擎使用 GF(5)，不能把其他域的配置静默改写。');
      if(next.length*(next.length*m+1)>150)throw Error('配置超过 150 个不可分解模的浏览器资源上限。');
      const ex=obj.exceptionalVertex==null?vs[0]:String(obj.exceptionalVertex);if(!vs.includes(ex))throw Error('异常顶点不在树上。');
      if(obj.orders!==undefined&&(!obj.orders||typeof obj.orders!=='object'||Array.isArray(obj.orders)))throw Error('循环序须为顶点到边号数组的映射。');
      const orderData=Object.create(null);if(obj.orders&&Object.keys(obj.orders).some(v=>!vs.includes(v)))throw Error('循环序含不在树中的顶点。');
      for(const v of vs){const inc=next.map((e,i)=>e.includes(v)?i:-1).filter(i=>i>=0),o=obj.orders?.[v]===undefined?inc:obj.orders[v];
        if(!Array.isArray(o)||o.length!==inc.length||new Set(o).size!==inc.length||o.some(i=>!Number.isInteger(i)||!inc.includes(i)))throw Error('顶点 '+v+' 的循环序无效；配置文件用从 0 开始的边号。');orderData[v]=o.slice();}
      edges=next;orders=orderData;exceptional=ex;multiplicity=m;selected=exceptional;render();markDirty();error('');
    }catch(e){error('导入失败：'+e.message);}finally{$('tree-import').value='';}});
  }
  window.BrauerTreeEditor={init,getInput:readInput,getSnapshot:()=>({edges:edges.map(e=>e.slice()),orders:Object.fromEntries(Object.entries(orders).map(([v,o])=>[v,o.slice()])),exceptionalVertex:exceptional,multiplicity,field:5}),setStatus:text=>{$('tree-dirty').textContent=text;},setError:error};
})();
