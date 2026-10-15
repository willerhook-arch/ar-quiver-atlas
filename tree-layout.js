/* Recover cylinder coordinates from the computed stable AR graph and translation.
 * Coordinates affect drawing only, never module identity or AR arrows. */
(function(root){
  'use strict';
  function assign(report){
    const {e,multiplicity:m}=report,H=e*m,non=report.nodes.filter(n=>!n.projective),byId=new Map(report.nodes.map(n=>[n.id,n]));
    const ids=new Set(non.map(n=>n.id)),incoming=new Map(non.map(n=>[n.id,[]])),outgoing=new Map(non.map(n=>[n.id,[]]));
    const stable=report.edges.filter(a=>ids.has(a.source)&&ids.has(a.target));
    for(const a of stable){incoming.get(a.target).push(a.source);outgoing.get(a.source).push(a.target);}
    const bottom=non.find(n=>incoming.get(n.id).length===(H===1?0:1)&&outgoing.get(n.id).length===(H===1?0:1));
    if(!bottom)throw Error('稳定 AR 图没有标准圆柱边界，拒绝错误布局。');
    const placed=new Set();let first=bottom;
    for(let row=1;row<=H;row++){
      let n=first;
      for(let col=0;col<e;col++){
        if(!n||placed.has(n.id))throw Error('τ 轨道长度与树的边数不一致。');
        n.column=col;n.row=row;placed.add(n.id);n=byId.get(n.tauId);
      }
      if(n.id!==first.id)throw Error('τ 轨道未闭合。');
      if(row<H){const next=incoming.get(first.id).filter(id=>!placed.has(id));if(next.length!==1)throw Error('无法唯一识别圆柱的下一层。');first=byId.get(next[0]);}
    }
    if(placed.size!==non.length)throw Error('圆柱布局未覆盖全部非投射模。');
    // Verify the entire recovered graph, rather than relying on a visually plausible layout.
    const expected=new Set();
    for(const n of non){if(n.row>1)expected.add(`${n.column},${n.row}>${n.column},${n.row-1}`);if(n.row<H)expected.add(`${n.column},${n.row}>${(n.column-1+e)%e},${n.row+1}`);}
    const actual=new Set(stable.map(a=>{const s=byId.get(a.source),t=byId.get(a.target);return`${s.column},${s.row}>${t.column},${t.row}`;}));
    if(actual.size!==expected.size||[...expected].some(x=>!actual.has(x)))throw Error('真实 AR 箭头与恢复的圆柱坐标不一致。');
    for(const n of report.nodes.filter(n=>n.projective)){
      const attachment=report.projectiveAttachments.find(a=>a.projectiveId===n.id),q=byId.get(attachment.quotientId),r=byId.get(attachment.radicalId);
      if(q.row!==r.row||r.column!==(q.column+1)%e)throw Error('投射附着不满足 τ(P/soc P)=rad P 的坐标。');
      n.column=q.column+.5;n.row=q.row+.43;
    }
    report.cylinderHeight=H;report.n=e;
    return report;
  }
  root.BrauerTreeLayout=Object.freeze({assign});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.BrauerTreeLayout;
})(globalThis);
