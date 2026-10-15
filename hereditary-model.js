/*
 * HereditaryAtlas: exact integer AR combinatorics for split hereditary ADE
 * and Euclidean path algebras. Browser-safe: paste this entire IIFE into a
 * script; it exposes globalThis.HereditaryAtlas. No libraries or network.
 *
 * CONVENTION: dimension vectors are columns; a right-module arrow follows Q.
 * A[u][v] counts u -> v, E=I-A, H=E^-1 counts directed paths (incl. length 0).
 * P_i=H^T e_i, I_i=H e_i; tau=-H E^T, tau^-1=-H^T E.
 * For u -> v, preprojective arrows are (t,v)->(t,u), (t,u)->(t+1,v).
 * Preinjective arrows are (t,v)->(t,u), (t+1,u)->(t,v).
 * Sources: W. Crawley-Boevey, Representations of Algebras (2025), sections
 * 3.3-3.4, https://www.math.uni-bielefeld.de/~wcrawley/25RA/Representations_of_Algebras_final_version_2025-07.pdf
 * C. M. Ringel, Representation Theory I, section 23.9,
 * https://www.math.uni-bielefeld.de/~ringel/opus/rs1.pdf
 *
 * API:
 * dynkin(type, n, orientation='forward') -> complete finite AR graph.
 * affine(type,n,p,q,depth=8,orientation='forward') -> TWO truncated graphs,
 *    with flattened nodes/edges and components.preprojective/preinjective.
 *    For A: n=p+q-1; supply n=null to infer it. Omitted p,q mean p=1,q=n.
 * affineA(p,q,depth=8,orientation='forward') is a convenience wrapper.
 * dynkinQuiver / affineQuiver return {vertices:number, edges:[[u,v],...]}.
 * orient(quiver,mode) returns a copy. mode is forward/reverse/bipartite
 *    ('alternating' aliases bipartite), or one boolean flip per input edge.
 * build(quiver,{finite,depth=8,component='preprojective'}) -> one graph.
 *    Only connected ADE/Euclidean underlying graphs are accepted. Cyclic
 *    orientations, loops, unsafe integers, and unsupported graphs are errors.
 *
 * NODE: {id,vertex,layer,component,dimension,label,projective,injective,
 *        tauId,tauInverseId,tauOutside,tauInverseOutside,boundary,index}.
 * EDGE: {source:id,target:id,multiplicity,kind:'slice'|'mesh'}.
 * Parallel quiver arrows become one edge with multiplicity (Kronecker: 2).
 * GRAPH: {quiver,nodes,edges,matrices,classification,component,complete,
 *         depth,scope,regularIncluded:false}. depth counts layers INCLUDING 0.
 * type,n,family,delta are top-level metadata; delta is null for finite type
 * and the minimal positive imaginary root for affine type. quiver.positions
 * optionally supplies [x,y] per vertex in unscaled layout units.
 * matrices={euler,pathCounts,coxeter,inverseCoxeter,projectives,injectives}:
 * projectives[i]/injectives[i] are dimension vectors, other fields matrices.
 * A null translation ID can mean actual zero or outside the displayed window;
 * the corresponding ...Outside boolean distinguishes these cases.
 * An affine result never claims to be the complete AR quiver: regular tubes
 * are NOT included. No matrices for individual representations/Hom maps are
 * constructed; these are theorem-based dimension vectors and AR arrows.
 */
(function (root) {
  'use strict';
  const fail = message => { throw new Error(message); };
  const integer = (value, label='integer') => {
    if (!Number.isSafeInteger(value)) fail(`${label} exceeds exact JavaScript integer arithmetic`);
    return value;
  };
  const positiveInteger = (value, label) => {
    if (!Number.isSafeInteger(value) || value < 1) fail(`${label} must be a positive integer`);
    return value;
  };
  const zeros = n => Array.from({length:n}, () => Array(n).fill(0));
  const identity = n => zeros(n).map((row,i) => row.map((_,j) => +(i===j)));
  const transpose = a => a[0].map((_,j) => a.map(row => row[j]));
  const dot = (a,b) => a.reduce((sum,x,i) => integer(sum+integer(x*b[i])),0);
  const multiply = (a,b) => { const bt=transpose(b); return a.map(row=>bt.map(col=>dot(row,col))); };
  const mv = (a,v) => a.map(row=>dot(row,v));
  const negative = a => a.map(row=>row.map(x=>x===0?0:-x));
  const key = v => v.join(',');
  const positive = v => v.every(x=>x>=0) && v.some(x=>x>0);

  function normalize(quiver) {
    const n=Array.isArray(quiver.vertices)?quiver.vertices.length:quiver.vertices;
    positiveInteger(n,'vertex count');
    if(n>100) fail('This interactive model supports at most 100 vertices');
    if(!Array.isArray(quiver.edges)) fail('quiver.edges must be an array');
    const edges=quiver.edges.map(edge=>{
      if(!Array.isArray(edge)||edge.length!==2) fail('Every arrow must be [source,target]');
      const [u,v]=edge;
      if(!Number.isInteger(u)||!Number.isInteger(v)||u<0||v<0||u>=n||v>=n||u===v)
        fail('Arrows require distinct, valid zero-based vertices');
      return [u,v];
    });
    const incoming=Array(n).fill(0),out=Array.from({length:n},()=>[]);
    for(const [u,v] of edges){incoming[v]++;out[u].push(v);}
    const ready=[],topological=[];
    incoming.forEach((d,v)=>{if(!d)ready.push(v);});
    for(let h=0;h<ready.length;h++){
      const u=ready[h];topological.push(u);
      for(const v of out[u])if(--incoming[v]===0)ready.push(v);
    }
    if(topological.length!==n) fail('The quiver has an oriented cycle; hereditary construction requires an acyclic quiver');
    return {vertices:n,edges,name:quiver.name||'Q',topological,
      positions:Array.isArray(quiver.positions)?quiver.positions.map(p=>p.slice()):null};
  }

  function classification(quiver) {
    const {vertices:n,edges}=normalize(quiver);
    const neighbors=Array.from({length:n},()=>new Set()),multiplicities=new Map();
    for(const [u,v] of edges){
      neighbors[u].add(v);neighbors[v].add(u);
      const k=[Math.min(u,v),Math.max(u,v)].join(',');
      multiplicities.set(k,(multiplicities.get(k)||0)+1);
    }
    const seen=new Set([0]),todo=[0];
    for(let h=0;h<todo.length;h++)for(const v of neighbors[todo[h]])if(!seen.has(v)){seen.add(v);todo.push(v);}
    if(seen.size!==n) fail('Use a connected Dynkin or Euclidean quiver');
    const degree=neighbors.map(x=>x.size),max=Math.max(...degree);
    if(n===2&&edges.length===2&&multiplicities.size===1)return {family:'affine',type:'A',n:1};
    if([...multiplicities.values()].some(m=>m!==1)) fail('Only ADE/Euclidean graphs and the two-arrow Kronecker quiver are supported');
    if(edges.length===n&&degree.every(d=>d===2))return {family:'affine',type:'A',n:n-1};
    if(edges.length!==n-1)fail('The underlying graph is not an ADE or Euclidean diagram');
    if(max<=2)return {family:'dynkin',type:'A',n};
    const forks=degree.map((d,i)=>d>=3?i:-1).filter(i=>i>=0);
    if(forks.length===1&&degree[forks[0]]===4&&n===5)return {family:'affine',type:'D',n:4};
    if(forks.length===2&&max===3){
      // Affine D: each trivalent vertex has two adjacent leaves; their other
      // incident edges form the connecting chain, of arbitrary positive length.
      if(forks.every(v=>[...neighbors[v]].filter(w=>degree[w]===1).length===2))
        return {family:'affine',type:'D',n:n-1};
    }
    if(forks.length===1&&max===3){
      const center=forks[0];
      const arms=[...neighbors[center]].map(first=>{
        let previous=center,current=first,length=1;
        while(degree[current]===2){const next=[...neighbors[current]].find(v=>v!==previous);previous=current;current=next;length++;}
        return length;
      }).sort((a,b)=>a-b);
      const signature=arms.join(',');
      if(arms[0]===1&&arms[1]===1)return {family:'dynkin',type:'D',n};
      if(['1,2,2','1,2,3','1,2,4'].includes(signature))return {family:'dynkin',type:'E',n};
      if(['2,2,2','1,3,3','1,2,5'].includes(signature))return {family:'affine',type:'E',n:n-1};
    }
    fail('The underlying graph is not an ADE or Euclidean diagram');
  }

  function minimalImaginaryRoot(quiver) {
    const q=normalize(quiver),kind=classification(q),n=q.vertices;
    if(kind.family!=='affine')return null;
    const neighbors=Array.from({length:n},()=>new Set());
    for(const [u,v]of q.edges){neighbors[u].add(v);neighbors[v].add(u);}
    let delta;
    if(kind.type==='A')delta=Array(n).fill(1);
    else if(kind.type==='D')delta=neighbors.map(ns=>ns.size===1?1:2);
    else {
      const center=neighbors.findIndex(ns=>ns.size===3);
      const arms=[...neighbors[center]].map(first=>{
        const path=[];let previous=center,current=first;
        while(true){path.push(current);const next=[...neighbors[current]].find(v=>v!==previous);
          if(next==null)break;previous=current;current=next;}
        return path;
      });
      const gcd=(a,b)=>b?gcd(b,a%b):a;
      const central=arms.reduce((v,arm)=>v*(arm.length+1)/gcd(v,arm.length+1),1);
      delta=Array(n).fill(0);delta[center]=central;
      for(const arm of arms)arm.forEach((v,r)=>{delta[v]=central*(arm.length-r)/(arm.length+1);});
      const divisor=delta.reduce(gcd);delta=delta.map(v=>integer(v/divisor));
    }
    const equation=delta.map(v=>2*v);
    for(const [u,v]of q.edges){equation[u]-=delta[v];equation[v]-=delta[u];}
    if(!delta.every(v=>Number.isSafeInteger(v)&&v>0)||equation.some(x=>x!==0))fail('Invalid affine null root');
    return delta;
  }

  function orient(quiver, mode='forward') {
    const q={...quiver,edges:quiver.edges.map(e=>e.slice())};
    if(mode==='forward'||mode==='default'||mode==null)return q;
    if(mode==='reverse'){q.edges=q.edges.map(([u,v])=>[v,u]);return q;}
    if(Array.isArray(mode)){
      if(mode.length!==q.edges.length||mode.some(x=>typeof x!=='boolean'))fail('Orientation flips must be one boolean per arrow');
      q.edges=q.edges.map(([u,v],i)=>mode[i]?[v,u]:[u,v]);return q;
    }
    if(mode==='bipartite'||mode==='alternating'){
      const neighbors=Array.from({length:q.vertices},()=>[]),colors=Array(q.vertices).fill(-1);
      for(const [u,v] of q.edges){neighbors[u].push(v);neighbors[v].push(u);}
      const todo=[0];colors[0]=0;
      for(let h=0;h<todo.length;h++)for(const v of neighbors[todo[h]]){
        if(colors[v]===-1){colors[v]=1-colors[todo[h]];todo.push(v);}
        else if(colors[v]===colors[todo[h]])fail('This graph is not bipartite; choose an acyclic orientation instead');
      }
      q.edges=q.edges.map(([u,v])=>colors[u]===0?[u,v]:[v,u]);return q;
    }
    fail(`Unknown orientation: ${mode}`);
  }

  function dynkinQuiver(type,n,orientation='forward') {
    type=String(type).toUpperCase();positiveInteger(n,'rank');
    if(n>100)fail('This interactive model supports at most 100 vertices');
    let edges=[],positions=Array.from({length:n},(_,i)=>[i,0]);
    if(type==='A'){for(let i=0;i<n-1;i++)edges.push([i,i+1]);}
    else if(type==='D'){
      if(n<4)fail('D_n requires n>=4');
      for(let i=0;i<n-3;i++)edges.push([i,i+1]);
      edges.push([n-3,n-2],[n-3,n-1]);
      positions[n-2]=[n-2,-1];positions[n-1]=[n-2,1];
    }else if(type==='E'&&[6,7,8].includes(n)){
      for(let i=0;i<n-2;i++)edges.push([i,i+1]);
      edges.push([2,n-1]);positions[n-1]=[2,-1];
    }else fail('Supported finite diagrams: A_n, D_n (n>=4), E_6,E_7,E_8');
    return orient({vertices:n,edges,positions,name:`${type}${n}`},orientation);
  }

  function affineQuiver(type,n,p,q,orientation='forward') {
    type=String(type).toUpperCase();let edges=[],vertices,name,positions;
    if(type==='A'){
      if(p==null&&q==null){p=1;q=n==null?1:n;}
      positiveInteger(p,'p');positiveInteger(q,'q');vertices=p+q;
      if(vertices>100)fail('This interactive model supports at most 100 vertices');
      if(n!=null&&n!==vertices-1)fail('For affine A, rank n must equal p+q-1 (or use n=null)');
      // Two disjoint directed paths of lengths p,q from vertex 0 to one sink.
      // At p=q=1 these are two distinct parallel arrows, not a directed cycle.
      const sink=vertices-1;
      for(const path of [[0,...Array.from({length:p-1},(_,i)=>i+1),sink],
                         [0,...Array.from({length:q-1},(_,i)=>p+i),sink]])
        for(let i=0;i<path.length-1;i++)edges.push([path[i],path[i+1]]);
      positions=Array.from({length:vertices},()=>[0,0]);
      const width=Math.max(p,q);positions[sink]=[width,0];
      for(let r=1;r<p;r++)positions[r]=[width*r/p,-1];
      for(let r=1;r<q;r++)positions[p+r-1]=[width*r/q,1];
      name=`A~${vertices-1}(${p},${q})`;
    }else if(type==='D'){
      positiveInteger(n,'rank');if(n<4)fail('Affine D_n requires n>=4');vertices=n+1;
      if(vertices>100)fail('This interactive model supports at most 100 vertices');
      edges=[[0,2],[1,2]];
      for(let i=2;i<n-2;i++)edges.push([i,i+1]);
      edges.push([n-2,n-1],[n-2,n]);name=`D~${n}`;
      positions=Array.from({length:vertices},(_,i)=>[i-1,0]);
      positions[0]=[0,-1];positions[1]=[0,1];
      positions[n-1]=[n-2,-1];positions[n]=[n-2,1];
    }else if(type==='E'&&[6,7,8].includes(n)){
      const arms={6:[2,2,2],7:[1,3,3],8:[1,2,5]}[n];
      vertices=n+1;let next=1;positions=[[0,0]];
      arms.forEach((length,a)=>{let previous=0;const direction=[[-1,0],[1,0],[0,-1]][a];
        for(let i=0;i<length;i++){edges.push([previous,next]);positions[next]=direction.map(x=>x*(i+1));previous=next++;}});
      name=`E~${n}`;
    }else fail('Supported affine diagrams: A~(p,q), D~_n (n>=4), E~_6,E~_7,E~_8');
    return orient({vertices,edges,positions,name},orientation);
  }

  function matrices(quiver) {
    const q=normalize(quiver),n=q.vertices,H=identity(n),E=identity(n);
    const out=Array.from({length:n},()=>[]);
    for(const [u,v]of q.edges){E[u][v]--;out[u].push(v);}
    for(const u of q.topological)for(const v of out[u])for(let s=0;s<n;s++)H[s][v]=integer(H[s][v]+H[s][u]);
    return {euler:E,pathCounts:H,coxeter:negative(multiply(H,transpose(E))),
      inverseCoxeter:negative(multiply(transpose(H),E)),
      projectives:H.map(row=>row.slice()),injectives:transpose(H)};
  }

  function tits(quiver,v) {
    const q=normalize(quiver);
    if(v.length!==q.vertices)fail('Dimension vector has incorrect length');
    let value=dot(v,v);
    for(const [u,w]of q.edges)value=integer(value-integer(v[u]*v[w]));
    return value;
  }

  function build(quiver, options={}) {
    // Also accept build(q,depth,finite) for a simple browser integration.
    if(typeof options==='number')options={depth:options,finite:arguments[2]};
    const q=normalize(quiver),kind=classification(q),n=q.vertices;
    const finite=options.finite==null?kind.family==='dynkin':!!options.finite;
    if(finite!==(kind.family==='dynkin'))fail('finite flag does not match the underlying Dynkin/Euclidean diagram');
    const component=options.component||'preprojective';
    if(!['preprojective','preinjective'].includes(component))fail('Unknown AR component');
    const depth=options.depth==null?8:positiveInteger(options.depth,'depth');
    if(depth>1000)fail('At most 1000 layers may be requested');
    const mat=matrices(q),pre=component==='preprojective';
    const operator=pre?mat.inverseCoxeter:mat.coxeter;
    const initial=pre?mat.projectives:mat.injectives;
    const projectiveKeys=new Set(mat.projectives.map(key)),injectiveKeys=new Set(mat.injectives.map(key));
    const nodes=[],lookup=new Map(),prefix=pre?'p':'i';
    const id=(layer,vertex)=>`${prefix}:${layer}:${vertex}`;
    // A_n needs at most n layers; the safe finite bound below also covers D/E.
    const maxLayers=finite?Math.max(64,2*n+2):depth;
    let allStopped=true;
    for(let vertex=0;vertex<n;vertex++){
      let dimension=initial[vertex].slice(),stopped=false;
      for(let layer=0;layer<maxLayers;layer++){
        if(!positive(dimension)){
          if(!dimension.every(x=>x<=0)||!dimension.some(x=>x<0))fail('Coxeter orbit has unexpected mixed or zero signs');
          stopped=true;break;
        }
        if(tits(q,dimension)!==1)fail('Generated vector is not a real root');
        const node={id:id(layer,vertex),vertex,layer,component,dimension:dimension.slice(),
          label:pre?(layer?`τ^(-${layer})P${vertex+1}`:`P${vertex+1}`):(layer?`τ^${layer}I${vertex+1}`:`I${vertex+1}`),
          projective:projectiveKeys.has(key(dimension)),injective:injectiveKeys.has(key(dimension))};
        nodes.push(node);lookup.set(node.id,node);dimension=mv(operator,dimension);
      }
      if(!stopped&&finite)fail('A finite Coxeter orbit did not terminate within the proven safe layer bound');
      allStopped=allStopped&&stopped;
    }
    nodes.sort((a,b)=>a.layer-b.layer||a.vertex-b.vertex);
    nodes.forEach((node,index)=>{
      const tauLayer=node.layer+(pre?-1:1),inverseLayer=node.layer+(pre?1:-1);
      node.tauId=node.projective?null:(lookup.has(id(tauLayer,node.vertex))?id(tauLayer,node.vertex):null);
      node.tauInverseId=node.injective?null:(lookup.has(id(inverseLayer,node.vertex))?id(inverseLayer,node.vertex):null);
      node.tauOutside=!node.projective&&node.tauId===null;
      node.tauInverseOutside=!node.injective&&node.tauInverseId===null;
      node.boundary=node.tauOutside||node.tauInverseOutside;node.index=index;
    });
    const edgeMap=new Map();
    function add(source,target,edgeKind){
      if(!lookup.has(source)||!lookup.has(target))return;
      const k=source+'>'+target;
      if(edgeMap.has(k))edgeMap.get(k).multiplicity++;
      else edgeMap.set(k,{source,target,multiplicity:1,kind:edgeKind});
    }
    const layers=Math.max(...nodes.map(x=>x.layer))+1;
    for(let t=0;t<layers;t++)for(const [u,v]of q.edges){
      add(id(t,v),id(t,u),'slice');
      if(pre)add(id(t,u),id(t+1,v),'mesh');
      else add(id(t+1,u),id(t,v),'mesh');
    }
    return {quiver:q,nodes,edges:[...edgeMap.values()],matrices:mat,classification:kind,
      component,type:kind.type,n:kind.n,family:kind.family,delta:minimalImaginaryRoot(q),
      complete:finite&&allStopped,depth:layers,regularIncluded:false,
      scope:finite?'Complete finite Dynkin AR quiver':`${component} component, layers 0 through ${depth-1}; regular tubes omitted`};
  }

  function dynkin(type,n,orientation='forward') {return build(dynkinQuiver(type,n,orientation),{finite:true});}
  function affine(type,n,p,q,depth=8,orientation='forward') {
    const quiver=affineQuiver(type,n,p,q,orientation);
    const preprojective=build(quiver,{finite:false,depth,component:'preprojective'});
    const preinjective=build(quiver,{finite:false,depth,component:'preinjective'});
    return {quiver:preprojective.quiver,nodes:[...preprojective.nodes,...preinjective.nodes].map((node,index)=>({...node,index})),
      edges:[...preprojective.edges,...preinjective.edges],components:{preprojective,preinjective},
      matrices:preprojective.matrices,classification:preprojective.classification,
      type:preprojective.type,n:preprojective.n,family:'affine',delta:preprojective.delta,
      complete:false,depth,regularIncluded:false,
      scope:'Finite windows in the preprojective and preinjective components; ALL regular tubes omitted'};
  }
  const api={version:'1.0.0',dynkin,affine,affineA:(p,q,depth=8,orientation='forward')=>affine('A',null,p,q,depth,orientation),
    dynkinQuiver,affineQuiver,orient,build,matrices,tits,minimalImaginaryRoot,classify:classification};
  root.HereditaryAtlas=Object.freeze(api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
