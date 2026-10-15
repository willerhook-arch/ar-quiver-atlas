/* Pure classification models. No finite search is used to infer completeness. */
(function (root) {
  'use strict';
  const integer = (v, min, max, name) => {
    if (!Number.isInteger(v) || v < min || v > max) throw new Error(name + ' 超出范围');
    return v;
  };
  function cyclic(n, L, stable = false) {
    integer(n, 1, 12, 'n'); integer(L, 2, 73, 'L');
    const nodes = [], edges = [], limit = stable ? L - 1 : L;
    const id = (i, l) => `M${((i % n) + n) % n + 1}_${l}`;
    for (let l = 1; l <= limit; l++) for (let i = 0; i < n; i++) {
      const dimension = Array(n).fill(0);
      for (let s = 0; s < l; s++) dimension[(i + s) % n]++;
      nodes.push({id: id(i, l), label: `M(${i + 1},${l})`, top: i, length: l,
        dimension, projective: l === L, injective: l === L,
        tauId: l < L ? id(i + 1, l) : null,
        endDimension: Math.ceil(l / n), column: i, row: l, kind: 'cyclic'});
    }
    for (let l = 2; l <= limit; l++) for (let i = 0; i < n; i++) {
      edges.push({source: id(i, l), target: id(i, l - 1), kind: 'quotient', multiplicity: 1});
      edges.push({source: id(i + 1, l - 1), target: id(i, l), kind: 'inclusion', multiplicity: 1});
    }
    return {nodes, edges, complete: !stable, stable, n, L, family: 'cyclic',
      fullCount: n * L, dimension: n * L,
      quiver: {vertices: n, edges: Array.from({length: n}, (_, i) => [i, (i + 1) % n])}};
  }
  function tube(rank, depth, delta, parameter = 'λ') {
    integer(rank, 1, 12, '管秩'); integer(depth, 2, 16, '截取高度');
    const nodes = [], edges = [];
    const id = (s, l) => `T${(s % rank) + 1}_${l}`;
    for (let l = 1; l <= depth; l++) for (let s = 0; s < rank; s++) {
      const dimension = l % rank === 0 ? delta.map(x => x * l / rank) : null;
      nodes.push({id: id(s, l), label: rank === 1 ? `R(${parameter},${l})` : `E${s + 1}[${l}]`,
        quasiLength: l, length: l, column: s, row: l,
        dimension, tauId: id(s + 1, l), projective: false, injective: false,
        kind: 'tube', rank, parameter, boundary: l === depth});
    }
    for (let l = 2; l <= depth; l++) for (let s = 0; s < rank; s++) {
      edges.push({source: id(s, l), target: id(s, l - 1), kind: 'quotient', multiplicity: 1});
      edges.push({source: id(s + 1, l - 1), target: id(s, l), kind: 'inclusion', multiplicity: 1});
    }
    return {nodes, edges, n: rank, L: depth, family: 'tube', complete: false,
      rank, parameter, delta, boundary: '上方无限延伸；当前只画准长度 1…' + depth};
  }
  function tubeRanks(type, n, p = 1, q = 1) {
    const raw = type === 'A' ? [p, q] : type === 'D' ? [2, 2, n - 2] :
      type === 'E6' ? [2, 3, 3] : type === 'E7' ? [2, 3, 4] : type === 'E8' ? [2, 3, 5] : [];
    return raw.filter(x => x > 1);
  }
  root.QuiverAtlas = Object.freeze({cyclic, tube, tubeRanks, version: '1.0.0'});
})(globalThis);
