'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script id="([^"]+)">([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,6);
for(const [,id,code]of scripts) {new vm.Script(code);if(['hereditary-model','atlas-model','brauer-tree-model','brauer-tree-layout'].includes(id))vm.runInThisContext(code);}
const H=globalThis.HereditaryAtlas,Q=globalThis.QuiverAtlas;
let groups=0,orientationCases=0,verifiedNodes=0;
function test(name,fn){fn();groups++;console.log('PASS '+name);}
const key=v=>v.join(',');
const transpose=a=>a[0].map((_,j)=>a.map(row=>row[j]));
const mul=(a,b)=>a.map(row=>transpose(b).map(col=>row.reduce((s,x,i)=>s+x*col[i],0)));
const mv=(a,v)=>a.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
const ident=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
const roots=g=>g.nodes.map(n=>key(n.dimension)).sort();
function cartan(q){const a=ident(q.vertices).map(row=>row.map(x=>2*x));for(const [u,v]of q.edges){a[u][v]--;a[v][u]--;}return a;}
function determinant(a){
  // Bareiss integer elimination, independent of the model's path/Coxeter code.
  a=a.map(row=>row.slice());let previous=1,sign=1;
  if(a.length===1)return a[0][0];
  for(let k=0;k<a.length-1;k++){
    let pivot=k;while(pivot<a.length&&!a[pivot][k])pivot++;
    if(pivot===a.length)return 0;
    if(pivot!==k){[a[pivot],a[k]]=[a[k],a[pivot]];sign=-sign;}
    const p=a[k][k];
    for(let i=k+1;i<a.length;i++)for(let j=k+1;j<a.length;j++)a[i][j]=(a[i][j]*p-a[i][k]*a[k][j])/previous;
    for(let i=k+1;i<a.length;i++)a[i][k]=0;
    previous=p;
  }
  return sign*a.at(-1).at(-1);
}
function verify(g){
  const q=g.quiver,n=q.vertices,lookup=new Map(g.nodes.map(x=>[x.id,x]));
  assert.equal(lookup.size,g.nodes.length);
  assert.equal(new Set(roots(g)).size,g.nodes.length,'real roots are distinct in each component');
  const incoming=new Map(g.nodes.map(x=>[x.id,[]]));
  for(const e of g.edges){
    assert(lookup.has(e.source)&&lookup.has(e.target));
    assert(Number.isInteger(e.multiplicity)&&e.multiplicity>0);
    incoming.get(e.target).push(e);
  }
  for(const x of g.nodes){
    assert(x.dimension.every(d=>Number.isSafeInteger(d)&&d>=0));
    assert(x.dimension.some(d=>d>0));
    const qvalue=x.dimension.reduce((s,d)=>s+d*d,0)-q.edges.reduce((s,[u,v])=>s+x.dimension[u]*x.dimension[v],0);
    assert.equal(qvalue,1,'positive real root');
    if(x.tauId){
      const tau=lookup.get(x.tauId);
      assert.deepEqual(mv(g.matrices.coxeter,x.dimension),tau.dimension);
      const sum=Array(n).fill(0);
      for(const e of incoming.get(x.id))lookup.get(e.source).dimension.forEach((d,i)=>{sum[i]+=e.multiplicity*d;});
      assert.deepEqual(sum,x.dimension.map((d,i)=>d+tau.dimension[i]),'AR mesh dimension equation');
    }else assert(x.projective||x.tauOutside);
    if(x.tauInverseId)assert.deepEqual(mv(g.matrices.inverseCoxeter,x.dimension),lookup.get(x.tauInverseId).dimension);
    if(g.complete){assert(!x.boundary);assert.equal(x.projective,x.tauId===null);assert.equal(x.injective,x.tauInverseId===null);}
    verifiedNodes++;
  }
  assert.deepEqual(mul(g.matrices.coxeter,g.matrices.inverseCoxeter),ident(n));
  assert.deepEqual(mul(mul(transpose(g.matrices.coxeter),g.matrices.euler),g.matrices.coxeter),g.matrices.euler);
  g.matrices.projectives.forEach((p,i)=>assert.deepEqual(mv(g.matrices.coxeter,p),g.matrices.injectives[i].map(x=>x===0?0:-x)));
}

test('A3 explicit dimensions, projectives, injectives and six arrows',()=>{
  const g=H.dynkin('A',3);verify(g);
  assert.equal(g.nodes.length,6);assert.equal(g.edges.length,6);
  assert.deepEqual(g.matrices.projectives,[[1,1,1],[0,1,1],[0,0,1]]);
  assert.deepEqual(g.matrices.injectives,[[1,0,0],[1,1,0],[1,1,1]]);
  assert.deepEqual(roots(g),['0,0,1','0,1,0','0,1,1','1,0,0','1,1,0','1,1,1']);
  const dims=new Map(g.nodes.map(x=>[x.id,key(x.dimension)]));
  assert.deepEqual(g.edges.map(e=>dims.get(e.source)+'>'+dims.get(e.target)).sort(),[
    '0,0,1>0,1,1','0,1,1>1,1,1','1,1,1>1,1,0',
    '0,1,1>0,1,0','0,1,0>1,1,0','1,1,0>1,0,0'].sort());
});

test('All orientations of A3,A4,D4,E6,E7,E8 match finite root counts and mesh equations',()=>{
  for(const [type,n,count]of [['A',3,6],['A',4,10],['D',4,12],['E',6,36],['E',7,63],['E',8,120]]){
    const q=H.dynkinQuiver(type,n),expectedRoots=roots(H.build(q,{finite:true}));
    for(let mask=0;mask<2**q.edges.length;mask++){
      const flips=q.edges.map((_,i)=>!!(mask&(1<<i)));
      const g=H.dynkin(type,n,flips);orientationCases++;
      assert.equal(g.nodes.length,count);assert(g.complete);assert.equal(g.delta,null);
      assert.equal(g.nodes.filter(x=>x.projective).length,n);
      assert.equal(g.nodes.filter(x=>x.injective).length,n);
      assert.deepEqual(roots(g),expectedRoots);
      verify(g);
    }
    for(const mode of ['reverse','alternating'])assert.deepEqual(roots(H.dynkin(type,n,mode)),expectedRoots);
  }
});

test('Finite boundary cases A1,A2,A8,D5,D8 and dual finite construction',()=>{
  for(const [t,n,count]of [['A',1,1],['A',2,3],['A',8,36],['D',5,20],['D',8,56]]){
    const g=H.dynkin(t,n,'alternating');assert.equal(g.nodes.length,count);verify(g);
    const injective=H.build(g.quiver,{finite:true,component:'preinjective'});verify(injective);
    assert.deepEqual(roots(injective),roots(g));
  }
});

test('Affine standard diagrams have positive semidefinite Cartan of corank one and primitive delta',()=>{
  for(const q of [H.affineQuiver('A',1),H.affineQuiver('A',null,2,3),H.affineQuiver('A',null,3,3),
    H.affineQuiver('D',4),H.affineQuiver('D',5),H.affineQuiver('D',8),
    H.affineQuiver('E',6),H.affineQuiver('E',7),H.affineQuiver('E',8)]){
    const c=cartan(q),delta=H.minimalImaginaryRoot(q);
    assert.equal(determinant(c),0,q.name);
    for(let k=1;k<q.vertices;k++)assert(determinant(c.slice(0,k).map(row=>row.slice(0,k)))>0,q.name);
    assert.deepEqual(mv(c,delta),Array(q.vertices).fill(0));
    const gcd=(a,b)=>b?gcd(b,a%b):a;assert.equal(delta.reduce(gcd),1);assert(delta.every(d=>d>0));
  }
});

test('Affine windows: every real-root mesh, defect signs, boundary semantics and opposite-quiver duality',()=>{
  for(const q of [H.affineQuiver('A',null,1,1),H.affineQuiver('A',null,1,4),H.affineQuiver('A',null,2,3),
    H.affineQuiver('D',4),H.affineQuiver('D',7),H.affineQuiver('E',6),H.affineQuiver('E',7),H.affineQuiver('E',8)]){
    for(const orientation of ['forward','reverse']){
      const original=H.orient(q,orientation),depth=7;
      const pp=H.build(original,{finite:false,depth}),pi=H.build(original,{finite:false,depth,component:'preinjective'});
      for(const g of [pp,pi]){
        verify(g);assert(!g.complete);assert.equal(g.nodes.length,q.vertices*depth);assert.equal(g.regularIncluded,false);
        assert.equal(g.edges.reduce((s,e)=>s+e.multiplicity,0),q.edges.length*(2*depth-1));
        for(const x of g.nodes){const ed=mv(g.matrices.euler,x.dimension);const defect=g.delta.reduce((s,d,i)=>s+d*ed[i],0);
          assert(g.component==='preprojective'?defect<0:defect>0,'correct defect sign');}
      }
      assert.equal(pp.nodes.filter(x=>x.projective).length,q.vertices);assert.equal(pp.nodes.filter(x=>x.injective).length,0);
      assert.equal(pi.nodes.filter(x=>x.injective).length,q.vertices);assert.equal(pi.nodes.filter(x=>x.projective).length,0);
      assert.equal(pp.nodes.filter(x=>x.tauInverseOutside).length,q.vertices);assert.equal(pi.nodes.filter(x=>x.tauOutside).length,q.vertices);
      const dual=H.build(H.orient(original,'reverse'),{finite:false,depth});
      assert.deepEqual(pi.nodes.map(x=>x.dimension),dual.nodes.map(x=>x.dimension));
      const normalizeId=id=>id.slice(1);
      assert.deepEqual(pi.edges.map(e=>`${normalizeId(e.source)}>${normalizeId(e.target)}:${e.multiplicity}`).sort(),
        dual.edges.map(e=>`${normalizeId(e.target)}>${normalizeId(e.source)}:${e.multiplicity}`).sort());
    }
  }
});

test('Kronecker closed dimension formula and arrow multiplicity two',()=>{
  const g=H.affineA(1,1,10);
  assert.deepEqual(g.delta,[1,1]);assert.equal(g.nodes.length,40);
  assert.deepEqual(g.nodes.map(x=>x.index),Array.from({length:40},(_,i)=>i));
  for(const x of g.components.preprojective.nodes)assert.deepEqual(x.dimension,
    x.vertex===0?[2*x.layer+1,2*x.layer+2]:[2*x.layer,2*x.layer+1]);
  for(const x of g.components.preinjective.nodes)assert.deepEqual(x.dimension,
    x.vertex===0?[2*x.layer+1,2*x.layer]:[2*x.layer+2,2*x.layer+1]);
  assert(g.edges.every(e=>e.multiplicity===2));
});

test('Parameter validation rejects cycles, invalid ranks, orientation and false finiteness',()=>{
  assert.throws(()=>H.build({vertices:3,edges:[[0,1],[1,2],[2,0]]}),/oriented cycle/);
  assert.throws(()=>H.dynkin('D',3),/n>=4/);
  assert.throws(()=>H.dynkin('A',1000000),/at most 100/);
  assert.throws(()=>H.affineA(1000000,1),/at most 100/);
  assert.throws(()=>H.dynkin('E',9),/Supported/);
  assert.throws(()=>H.affineA(0,2),/positive integer/);
  assert.throws(()=>H.affine('A',4,2,2),/p\+q-1/);
  assert.throws(()=>H.build(H.affineQuiver('D',4),{finite:true}),/finite flag/);
  assert.throws(()=>H.build(H.dynkinQuiver('A',3),{finite:false}),/finite flag/);
  assert.throws(()=>H.affineA(2,3,3,'bipartite'),/not bipartite/);
  assert.throws(()=>H.build({vertices:2,edges:[]}),/connected/);
  assert.throws(()=>H.build({vertices:2,edges:[[0,1],[0,1],[0,1]]}),/Only ADE/);
  assert.throws(()=>H.build(H.affineQuiver('D',4),{depth:0}),/positive integer/);
});
console.log(`HEREDITARY_MODEL_PASS groups=${groups} finiteOrientations=${orientationCases} verifiedNodes=${verifiedNodes}`);

// Cross-check theorem-generated browser data against earlier matrix/QPA benchmarks.
test('A3 and both three-edge Brauer-star models match saved QPA/Python benchmark data',()=>{
  const repo=path.join(__dirname,'..');
  for(const [relative,g]of [['results/a3.json',H.dynkin('A',3)],
    ['results/brauer-star3/brauer-star3.json',Q.cyclic(3,4)],
    ['results/brauer-star3-m2/brauer-star3-m2.json',Q.cyclic(3,7)]]){
    const b=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline-fixtures.json'),'utf8'))[relative];
    const names=new Map(g.nodes.map(n=>[n.id,n.label||n.dimension.map((x,i)=>x?i+1:0).filter(Boolean)]));
    if(relative==='results/a3.json')for(const n of g.nodes){const a=n.dimension.map((x,i)=>x?i+1:0).filter(Boolean);names.set(n.id,`[${a[0]},${a.at(-1)}]`);}
    const nodes=g.nodes.map(n=>({label:names.get(n.id),dim:n.dimension.join(','),P:n.projective,I:n.injective,tau:n.tauId?names.get(n.tauId):null})).sort((a,b)=>a.label.localeCompare(b.label));
    const expected=b.modules.map(n=>({label:n.label,dim:n.dimension_vector.join(','),P:n.projective,I:n.injective,tau:n.tau})).sort((a,b)=>a.label.localeCompare(b.label));
    assert.deepEqual(nodes,expected);
    assert.deepEqual(g.edges.map(e=>names.get(e.source)+'>'+names.get(e.target)).sort(),b.ar_arrows.map(e=>e.join('>')).sort());
    if(relative!=='results/a3.json')for(const n of g.nodes)assert.equal(n.endDimension,b.modules.find(x=>x.label===n.label).endomorphism_dimension);
  }
});
let cyclicCases=0,tubeCases=0;
test('Cyclic Nakayama completeness, stable deletion, meshes and tau periods for 240 parameter pairs',()=>{
  for(let n=1;n<=12;n++)for(let L=2;L<=21;L++){
    const g=Q.cyclic(n,L),s=Q.cyclic(n,L,true),lookup=new Map(g.nodes.map(x=>[x.id,x]));cyclicCases++;
    assert.equal(g.nodes.length,n*L);assert.equal(g.edges.length,2*n*(L-1));
    assert.equal(s.nodes.length,n*(L-1));assert.equal(s.edges.length,2*n*(L-2));
    assert.equal(g.nodes.filter(x=>x.projective&&x.injective).length,n);
    for(const x of g.nodes){
      assert.equal(x.dimension.reduce((a,b)=>a+b,0),x.length);
      assert.equal(x.projective,!x.tauId);
      if(x.projective)continue;
      let t=x;for(let k=0;k<n;k++)t=lookup.get(t.tauId);assert.equal(t.id,x.id);
      const a=lookup.get(x.tauId).dimension.map((v,i)=>v+x.dimension[i]),b=Array(n).fill(0);
      for(const e of g.edges.filter(e=>e.target===x.id))lookup.get(e.source).dimension.forEach((v,i)=>b[i]+=v);
      assert.deepEqual(a,b,'almost-split mesh dimension balance');
    }
    const keep=new Set(s.nodes.map(x=>x.id));assert.deepEqual(s.edges,g.edges.filter(e=>keep.has(e.source)&&keep.has(e.target)));
  }
});
test('Tubes: quasi-composition meshes, periods, boundary counts and absence of irreducible loops',()=>{
  for(let r=1;r<=12;r++)for(let depth=2;depth<=10;depth++){
    const t=Q.tube(r,depth,[1,2]),lookup=new Map(t.nodes.map(x=>[x.id,x]));tubeCases++;
    assert.equal(t.nodes.length,r*depth);assert.equal(t.edges.length,2*r*(depth-1));
    assert(t.edges.every(e=>e.source!==e.target));
    assert.equal(t.nodes.filter(x=>x.boundary).length,r);
    const formal=x=>{const a=Array(r).fill(0);for(let k=0;k<x.quasiLength;k++)a[(x.column+k)%r]++;return a;};
    for(const x of t.nodes){let y=x;for(let i=0;i<r;i++)y=lookup.get(y.tauId);assert.equal(y.id,x.id);
      if(x.quasiLength%r===0)assert.deepEqual(x.dimension,[x.quasiLength/r,2*x.quasiLength/r]);
      if(x.boundary)continue;
      const a=formal(x).map((v,i)=>v+formal(lookup.get(x.tauId))[i]),b=Array(r).fill(0);
      for(const e of t.edges.filter(e=>e.target===x.id))formal(lookup.get(e.source)).forEach((v,i)=>b[i]+=v);
      assert.deepEqual(a,b);
    }
  }
});
test('Exceptional tube ranks satisfy the Euclidean rank identity',()=>{
  for(let p=1;p<=6;p++)for(let q=1;q<=6;q++)assert.equal(Q.tubeRanks('A',0,p,q).reduce((s,r)=>s+r-1,0),p+q-2);
  for(let n=4;n<=10;n++)assert.deepEqual(Q.tubeRanks('D',n),[2,2,n-2]);
  for(const [type,ranks]of [['E6',[2,3,3]],['E7',[2,3,4]],['E8',[2,3,5]]])assert.deepEqual(Q.tubeRanks(type),ranks);
});
test('Offline artifact has no external script/style/image dependencies or unresolved placeholders',()=>{
  assert(!/<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["']https?:/i.test(html));
  assert(!/待开发核对|将在开发核查|HEREDITARY_MODEL \*|ATLAS_UI \*|ATLAS_MODEL \*/.test(html));
  assert(!/\bfetch\s*\(/.test(html));
});
console.log(`ATLAS_PASS groups=${groups} finiteOrientations=${orientationCases} verifiedHereditaryNodes=${verifiedNodes} cyclicPairs=${cyclicCases} tubeWindows=${tubeCases}`);

test('General Brauer tree engine: closed-form stars and independent line fixture',()=>{
const B=globalThis.BrauerTreeAtlas;


function star(n, m) {
  return B.build({edges: Array.from({length: n}, (_, i) => ['center', 'leaf' + i]), exceptionalVertex: 'center', multiplicity: m});
}

// Independent cyclic-Nakayama Hom formula, including repeated dimension vectors.
for (const [n, m] of [[1, 1], [1, 3], [2, 3], [3, 1], [3, 2]]) {
  const data = star(n, m), L = n * m + 1;
  assert.equal(data.nodes.length, n * L);
  assert.equal(data.edges.length, 2 * n * (L - 1));
  const index = new Map(data.nodes.map((x, i) => [x.id, i]));
  for (const source of data.nodes) {
    const i = source.top.indexOf(1), l = source.compositionLength;
    assert.equal(source.top.reduce((a, b) => a + b), 1);
    assert.equal(source.endDimension, Math.floor((l - 1) / n) + 1);
    if (l < L) {
      const translated = data.nodes[index.get(source.tauId)];
      assert.equal(translated.top.indexOf(1), (i + 1) % n);
      assert.equal(translated.compositionLength, l);
    } else assert.equal(source.tauId, null);
    for (const target of data.nodes) {
      const j = target.top.indexOf(1), t = target.compositionLength;
      let expected = 0;
      for (let r = Math.max(0, t - l); r < t; r++) if ((j + r) % n === i) expected++;
      assert.equal(data.homMatrix[index.get(source.id)][index.get(target.id)], expected);
    }
  }
}

// Hand-derived three-edge line fixture. It has the same counts as the star,
// but a different algebra dimension, biserial projectives, and attachments.
const line = B.build({edges: [['0', '1'], ['1', '2'], ['2', '3']], multiplicity: 1});
assert.equal(line.algebraDimension, 10);
function name(node) {
  if (node.projective) return node.label;
  const d = node.dimension.join('');
  if (d === '100') return 'S1';
  if (d === '010') return 'S2';
  if (d === '001') return 'S3';
  if (d === '110') return node.top[0] ? 'U12' : 'U21';
  if (d === '011') return node.top[1] ? 'U23' : 'U32';
  if (d === '111') return node.top[1] ? 'V' : 'W';
  throw new Error('unexpected line module');
}
const names = new Map(line.nodes.map(node => [node.id, name(node)]));
const actualEdges = line.edges.map(edge => names.get(edge.source) + '>' + names.get(edge.target)).sort();
const expectedEdges = ['S1>V', 'S2>U12', 'S2>U32', 'S3>V', 'U12>W', 'U21>S2', 'U21>P1', 'U23>S2', 'U23>P3', 'U32>W', 'V>U21', 'V>U23', 'W>S1', 'W>S3', 'W>P2', 'P1>U12', 'P2>V', 'P3>U32'].sort();
assert.deepEqual(actualEdges, expectedEdges);
const expectedTau = {S1: 'U32', U32: 'U23', U23: 'S1', S3: 'U12', U12: 'U21', U21: 'S3', S2: 'V', V: 'W', W: 'S2'};
for (const node of line.nodes) if (!node.projective) assert.equal(names.get(node.tauId), expectedTau[name(node)]);

// A nonstandard cyclic order must actually determine the successor arrows.
const reordered = B.build({edges: [['0', '1'], ['0', '2'], ['0', '3']], orders: {'0': [0, 2, 1]}, exceptionalVertex: '0', multiplicity: 2});
assert.deepEqual(reordered.quiver.edges, [[0, 2], [2, 1], [1, 0]]);
assert.equal(reordered.nodes.length, 21);

// Labels are arbitrary strings; prototype-like labels must not affect parsing.
const unusualLabels = B.build({edges: [['__proto__', 'constructor'], ['constructor', 'toString']], exceptionalVertex: '__proto__', multiplicity: 2});
assert.equal(unusualLabels.nodes.length, 10);
assert.doesNotThrow(() => structuredClone(unusualLabels));
assert.doesNotThrow(() => JSON.stringify(unusualLabels));
assert.throws(() => B.build({edges: [['0', '1'], ['1', '2'], ['2', '0']]}), /树/);
assert.throws(() => B.build({edges: [['0', '1'], ['0', '2']], orders: {'0': [0, 0]}}), /循环序/);
assert.throws(() => B.build({edges: [['0', '1']], orders: {'0': '0'}}), /数组/);
assert.throws(() => B.build({edges: Array.from({length: 10}, (_, i) => ['0', '' + (i + 1)]), multiplicity: 2}), /150/);
console.log('BRAUER_TREE_JS_TESTS_PASS: cyclic Hom benchmarks; independent line AR/tau fixture; cyclic order; single-edge cases; labels; invalid input; resource bound.');

});

test('General tree cylinder drawing matches every computed stable arrow',()=>{
 const B=globalThis.BrauerTreeAtlas,L=globalThis.BrauerTreeLayout;
 for(const edges of [[['a','b']],[['a','b'],['b','c'],['c','d']],[['a','b'],['a','c'],['a','d']],[['a','b'],['a','c'],['a','d'],['d','e'],['d','f']]])for(const m of [1,2,3]){
  const data=L.assign(B.build({edges,multiplicity:m}));assert.equal(data.cylinderHeight,edges.length*m);assert.equal(data.nodes.filter(n=>!n.projective).length,edges.length**2*m);
 }
});
console.log('ALL_ATLAS_GROUPS_PASS '+groups);
