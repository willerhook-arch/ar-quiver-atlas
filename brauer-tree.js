/* General split Brauer tree algebras over GF(5).
 * Nonprojectives: every finite string of A/soc(A), modulo inversion.
 * AR arrows: exact rad/rad^2 over GF(5), followed by the projective attachments.
 * No dimension-vector or graph-neighbourhood guess is used to identify tau.
 */
(function (root) {
  'use strict';
  const PRIME = 5;
  const mod = x => ((x % PRIME) + PRIME) % PRIME;
  const inverse = [0, 1, 3, 2, 4];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  const arrayEqual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  function compare(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  }
  const reverseWord = word => word.slice().reverse().map(x => -x);
  class UnionFind {
    constructor(n) { this.p = Array.from({length: n}, (_, i) => i); this.size = Array(n).fill(1); }
    find(x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; }
    union(a, b) { a = this.find(a); b = this.find(b); if (a === b) return; if (this.size[a] < this.size[b]) [a, b] = [b, a]; this.p[b] = a; this.size[a] += this.size[b]; }
  }
  // Incremental exact row-space basis; used for both rank and rad^2.
  class RowSpace {
    constructor(n) { this.n = n; this.rows = new Map(); }
    add(vector) {
      const row = vector.map(mod);
      for (let p = 0; p < this.n; p++) {
        if (!row[p]) continue;
        const old = this.rows.get(p);
        if (old) { const c = row[p]; for (let j = p; j < this.n; j++) row[j] = mod(row[j] - c * old[j]); }
        else { const c = inverse[row[p]]; for (let j = p; j < this.n; j++) row[j] = mod(c * row[j]); this.rows.set(p, row); return true; }
      }
      return false;
    }
    get rank() { return this.rows.size; }
  }
  function rank(rows, columns) { const space = new RowSpace(columns); rows.forEach(row => space.add(row)); return space.rank; }
  function normalizedInput(input) {
    assert(input && Array.isArray(input.edges), '需要树的边列表。');
    const edges = input.edges.map(edge => {
      assert(Array.isArray(edge) && edge.length === 2, '每条边必须恰有两个端点。');
      return edge.map(String);
    });
    const e = edges.length, m = input.multiplicity === undefined ? 1 : Number(input.multiplicity);
    assert(Number.isInteger(e) && e >= 1 && e <= 10, '当前精确引擎支持 1–10 条边。');
    assert(Number.isInteger(m) && m >= 1 && m <= 8, '当前精确引擎支持异常重数 1–8。');
    assert(e * (e * m + 1) <= 150, '当前资源上限是 150 个不可分解模；请减少边数或重数。');
    assert(input.field === undefined || Number(input.field) === PRIME, '当前精确线性代数使用 GF(5)。');
    const vertices = [...new Set(edges.flat())], vertexIndex = new Map(vertices.map((v, i) => [v, i]));
    assert(vertices.length === e + 1, '输入必须是树：顶点数应为边数加一。');
    const uf = new UnionFind(vertices.length), incident = Object.fromEntries(vertices.map(v => [v, []]));
    edges.forEach(([u, v], i) => {
      assert(u !== v, '树不允许自环。');
      assert(uf.find(vertexIndex.get(u)) !== uf.find(vertexIndex.get(v)), '输入包含环或重复边。');
      uf.union(vertexIndex.get(u), vertexIndex.get(v)); incident[u].push(i); incident[v].push(i);
    });
    assert(vertices.every(v => uf.find(vertexIndex.get(v)) === uf.find(0)), '树必须连通。');
    const exceptionalVertex = input.exceptionalVertex === undefined || input.exceptionalVertex === null ? vertices[0] : String(input.exceptionalVertex);
    assert(vertices.includes(exceptionalVertex), '异常顶点必须是树中的顶点。');
    const orders = Object.create(null), multiplicities = Object.create(null);
    for (const v of vertices) {
      const supplied = input.orders && Object.prototype.hasOwnProperty.call(input.orders, v) ? input.orders[v] : incident[v];
      assert(Array.isArray(supplied), `顶点 ${v} 的循环序必须是数组。`);
      const order = supplied.slice();
      assert(order.every(Number.isInteger) && arrayEqual(order.slice().sort((a, b) => a - b), incident[v].slice().sort((a, b) => a - b)), `顶点 ${v} 的循环序必须恰含其所有关联边一次（边 ID 从 0 开始）。`);
      orders[v] = order; multiplicities[v] = v === exceptionalVertex ? m : 1;
    }
    return {edges, vertices, orders, multiplicities, exceptionalVertex, multiplicity: m, field: PRIME};
  }
  function algebraFromTree(tree) {
    const arrows = [], byVertex = Object.create(null), powers = new Map(), e = tree.edges.length;
    for (const v of tree.vertices) {
      const order = tree.orders[v], weight = tree.multiplicities[v];
      if (order.length * weight === 1) continue;
      byVertex[v] = order.map((source, j) => {
        const id = arrows.length; arrows.push({id, label: 'a' + (id + 1), source, target: order[(j + 1) % order.length], treeVertex: v}); return id;
      });
      order.forEach((edge, j) => powers.set(edge + '|' + v, Array.from({length: weight * order.length}, (_, s) => byVertex[v][(j + s) % order.length])));
    }
    const special = e === 1 && tree.multiplicity === 1;
    if (special) arrows.push({id: 0, label: 'a1', source: 0, target: 0, treeVertex: tree.vertices[0]});
    const zeroPaths = [], quotientZeroPaths = [], commutativity = [], allowed = new Set();
    for (const ids of Object.values(byVertex)) ids.forEach((a, i) => allowed.add(a + ',' + ids[(i + 1) % ids.length]));
    if (special) allowed.add('0,0');
    for (const a of arrows) for (const b of arrows) if (a.target === b.source && !allowed.has(a.id + ',' + b.id)) {
      zeroPaths.push([a.id, b.id]); quotientZeroPaths.push([a.id, b.id]);
    }
    if (special) { zeroPaths.push([0, 0]); quotientZeroPaths.push([0]); }
    else tree.edges.forEach(([u, v], edge) => {
      const left = powers.get(edge + '|' + u), right = powers.get(edge + '|' + v);
      if (left && right) commutativity.push({left: left.slice(), right: right.slice()});
      for (const p of [left, right]) if (p) { quotientZeroPaths.push(p.slice()); zeroPaths.push(p.concat(p[0])); }
    });
    return {quiver: {vertices: e, arrows, edges: arrows.map(a => [a.source, a.target])},
      relations: {zeroPaths, commutativity}, quotientRelations: {zeroPaths: quotientZeroPaths}, powers, special};
  }
  function canonicalWord(word, startVertex) {
    if (!word.length) return {id: 'S' + (startVertex + 1), word: [], reversed: false};
    const reverse = reverseWord(word), reversed = compare(reverse, word) < 0, result = reversed ? reverse : word.slice();
    return {id: 'W:' + result.join(','), word: result, reversed};
  }
  function nodeFromWord(word, startVertex, quiver) {
    const basisVertices = [startVertex], arrowMaps = quiver.arrows.map(() => []);
    let vertex = startVertex;
    word.forEach((letter, j) => {
      const a = quiver.arrows[Math.abs(letter) - 1];
      assert(vertex === (letter > 0 ? a.source : a.target), '字符串连接失败。');
      vertex = letter > 0 ? a.target : a.source;
      basisVertices.push(vertex); arrowMaps[a.id].push(letter > 0 ? [j, j + 1] : [j + 1, j]);
    });
    const key = canonicalWord(word, startVertex);
    return enrichNode({id: key.id, label: word.length ? word.map(x => (x < 0 ? 'a' + (-x) + '⁻¹' : 'a' + x)).join('·') : 'S' + (startVertex + 1),
      word: word.slice(), startVertex, basisVertices, arrowMaps, projective: false, injective: false, kind: 'brauer-tree-string'}, quiver);
  }
  function enrichNode(node, quiver) {
    const e = quiver.vertices, d = node.basisVertices.length;
    node.dimension = Array(e).fill(0); node.top = Array(e).fill(0); node.socle = Array(e).fill(0);
    node.compositionLength = d; node.length = d; node.tauId = null;
    const incoming = new Set(), outgoing = new Set();
    node.basisVertices.forEach(v => node.dimension[v]++);
    node.arrowMaps.forEach(pairs => pairs.forEach(([s, t]) => { outgoing.add(s); incoming.add(t); }));
    node.basisVertices.forEach((v, i) => { if (!incoming.has(i)) node.top[v]++; if (!outgoing.has(i)) node.socle[v]++; });
    node._vertices = Array.from({length: e}, () => []); node.basisVertices.forEach((v, i) => node._vertices[v].push(i));
    node._out = node.arrowMaps.map(pairs => new Map(pairs));
    node._in = node.arrowMaps.map(pairs => new Map(pairs.map(([s, t]) => [t, s])));
    node.arrowMaps.forEach((pairs, i) => assert(node._out[i].size === pairs.length && node._in[i].size === pairs.length, '箭头矩阵不是 partial permutation，不能使用此 Hom 求解器。'));
    return node;
  }
  function enumerateStrings(algebra, expected, progress) {
    const {quiver} = algebra, extensions = Array.from({length: quiver.vertices}, () => []), forbidden = [];
    for (const a of quiver.arrows) { extensions[a.source].push(a.id + 1); extensions[a.target].push(-(a.id + 1)); }
    for (const path of algebra.quotientRelations.zeroPaths) { const w = path.map(a => a + 1); forbidden.push(w, reverseWord(w)); }
    const valid = (word, letter) => {
      if (word.length && word[word.length - 1] === -letter) return false;
      const candidate = word.concat(letter);
      return !forbidden.some(p => p.length <= candidate.length && p.every((x, j) => candidate[candidate.length - p.length + j] === x));
    };
    const nodes = new Map(); let frontier = Array.from({length: quiver.vertices}, (_, v) => ({word: [], start: v, end: v})), maxStringLength = 0;
    while (frontier.length) {
      const next = [];
      for (const state of frontier) {
        const canonical = canonicalWord(state.word, state.start);
        if (!nodes.has(canonical.id)) {
          const start = canonical.reversed ? state.end : state.start;
          nodes.set(canonical.id, nodeFromWord(canonical.word, start, quiver));
          assert(nodes.size <= expected, '字符串数超过 Brauer tree 分类计数；输入或关系构造不一致。');
        }
        for (const letter of extensions[state.end]) if (valid(state.word, letter)) {
          const a = quiver.arrows[Math.abs(letter) - 1];
          next.push({word: state.word.concat(letter), start: state.start, end: letter > 0 ? a.target : a.source});
        }
      }
      maxStringLength = Math.max(maxStringLength, frontier[0].word.length);
      progress('strings', nodes.size, expected); frontier = next;
      // A word of length r has r+1 pairwise nonisomorphic prefix string modules
      // (their dimensions differ), so r < the total number of indecomposables.
      assert(!frontier.length || frontier[0].word.length < expected, '字符串长度超过已证明的有限型上界，拒绝输出不完整列表。');
    }
    assert(nodes.size === expected, `非投射字符串应有 ${expected} 个，实际为 ${nodes.size}。`);
    return {nodes: [...nodes.values()], maxStringLength};
  }
  function projectiveNodes(tree, algebra) {
    const nodes = [], {quiver, powers, special} = algebra;
    tree.edges.forEach((ends, edge) => {
      const basisVertices = [edge], arrowMaps = quiver.arrows.map(() => []), final = [];
      if (special) { basisVertices.push(edge); arrowMaps[0].push([0, 1]); }
      else {
        for (const v of ends) {
          const path = powers.get(edge + '|' + v); if (!path) continue;
          let previous = 0;
          path.forEach((a, j) => {
            if (j === path.length - 1) final.push([a, previous]);
            else { const next = basisVertices.length; basisVertices.push(quiver.arrows[a].target); arrowMaps[a].push([previous, next]); previous = next; }
          });
        }
        const socle = basisVertices.length; basisVertices.push(edge); final.forEach(([a, previous]) => arrowMaps[a].push([previous, socle]));
      }
      nodes.push(enrichNode({id: 'P' + (edge + 1), label: 'P' + (edge + 1), projective: true, injective: true,
        projectiveVertex: edge, word: null, basisVertices, arrowMaps, kind: 'brauer-tree-projective'}, quiver));
    });
    return nodes;
  }
  function pathStringOfSubquotient(P, removed, quiver) {
    const keep = P.basisVertices.map((_, i) => i).filter(i => i !== removed), neighbors = new Map(keep.map(i => [i, []]));
    P.arrowMaps.forEach((pairs, a) => pairs.forEach(([s, t]) => {
      if (!neighbors.has(s) || !neighbors.has(t)) return;
      neighbors.get(s).push([t, a + 1]); neighbors.get(t).push([s, -(a + 1)]);
    }));
    assert(keep.length && [...neighbors.values()].every(xs => xs.length <= 2), '投射的 radical/顶商不是字符串图。');
    let at = keep.find(i => neighbors.get(i).length <= 1), previous = null;
    assert(at !== undefined, '投射的 radical/顶商出现环。');
    const sequence = [], word = [];
    while (true) {
      sequence.push(at); const extension = neighbors.get(at).find(([j]) => j !== previous);
      if (!extension) break;
      word.push(extension[1]); previous = at; at = extension[0];
    }
    assert(sequence.length === keep.length, '投射的 radical/顶商不连通。');
    const canonical = canonicalWord(word, P.basisVertices[sequence[0]]);
    if (canonical.reversed) sequence.reverse();
    return {id: canonical.id, sequence};
  }
  function sparseMap(source, target, pairs) {
    const rows = Array.from({length: source.compositionLength}, () => []), entries = new Map();
    pairs.forEach(([x, y, coefficient = 1]) => { const c = mod(coefficient); if (c) { rows[x].push([y, c]); entries.set(x * target.compositionLength + y, c); } });
    return {pairs, rows, entries, source, target};
  }
  function homSpace(source, target, quiver) {
    const pairs = [], index = new Map(), width = target.compositionLength;
    for (let v = 0; v < quiver.vertices; v++) for (const x of source._vertices[v]) for (const y of target._vertices[v]) { index.set(x * width + y, pairs.length); pairs.push([x, y]); }
    const zero = pairs.length, uf = new UnionFind(zero + 1);
    for (const a of quiver.arrows) for (const x of source._vertices[a.source]) for (const y of target._vertices[a.target]) {
      const before = target._in[a.id].get(y), after = source._out[a.id].get(x);
      const left = before === undefined ? zero : index.get(x * width + before);
      const right = after === undefined ? zero : index.get(after * width + y);
      assert(left !== undefined && right !== undefined, 'Hom 交换方程坐标不一致。'); uf.union(left, right);
    }
    const groups = new Map(), zeroRoot = uf.find(zero);
    pairs.forEach((pair, i) => { const key = uf.find(i); if (key === zeroRoot) return; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(pair); });
    const bases = [...groups.values()].map(group => sparseMap(source, target, group)), pivots = bases.map(b => b.pairs[0]);
    let identity = -1;
    if (source === target) {
      identity = bases.findIndex(b => b.entries.has(0));
      assert(identity >= 0 && bases[identity].pairs.length === source.compositionLength && bases[identity].pairs.every(([x, y]) => x === y), 'End 的对角分量不是 identity；拒绝未经认证的 radical。');
      for (let i = 0; i < bases.length; i++) if (i !== identity) {
        const matrix = Array.from({length: source.compositionLength}, () => Array(source.compositionLength).fill(0));
        bases[i].pairs.forEach(([x, y, c = 1]) => { matrix[x][y] = c; });
        assert(rank(matrix, source.compositionLength) < source.compositionLength, 'End 非对角基出现单位，radical 认证失败。');
      }
    }
    return {bases, pivots, identity, radical: bases.map((_, i) => i).filter(i => i !== identity)};
  }
  function compositionCoordinates(f, g, targetHom) {
    const width = g.target.compositionLength;
    return targetHom.pivots.map(([x, y]) => {
      let value = 0; for (const [z, c] of f.rows[x]) value += c * (g.entries.get(z * width + y) || 0); return mod(value);
    });
  }
  function irreducibleMaps(nonProjectiveCount, nodes, hom, progress) {
    // For nonprojective X,Y, Hom_A(X,Y)=Hom_{A/soc A}(X,Y).
    // Any factorization through a projective P factors through rad(P)/soc(P)
    // by two radical maps. Thus it already lies in rad^2 of the subcategory
    // of nonprojectives, and omitting projectives here does not change Irr.
    const edges = []; let done = 0;
    for (let x = 0; x < nonProjectiveCount; x++) for (let y = 0; y < nonProjectiveCount; y++) {
      const h = hom[x][y], ambient = h.bases.length, radicalDimension = h.radical.length;
      if (!radicalDimension) { done++; continue; }
      const span = new RowSpace(ambient);
      loop: for (let z = 0; z < nonProjectiveCount; z++) {
        const left = hom[x][z], right = hom[z][y];
        for (const f of left.radical) for (const g of right.radical) {
          const vector = compositionCoordinates(left.bases[f], right.bases[g], h);
          if (h.identity >= 0) assert(vector[h.identity] === 0, 'rad² 含有 identity 分量。');
          span.add(vector); if (span.rank === radicalDimension) break loop;
        }
      }
      const quotientDimension = radicalDimension - span.rank, representatives = [];
      for (const b of h.radical) { const vector = Array(ambient).fill(0); vector[b] = 1; if (span.add(vector)) representatives.push(h.bases[b]); }
      assert(representatives.length === quotientDimension, 'rad/rad² 补空间维数不一致。');
      if (quotientDimension) edges.push({source: nodes[x].id, target: nodes[y].id, multiplicity: quotientDimension, kind: 'irreducible', _representatives: representatives});
      done++; if (done % nonProjectiveCount === 0) progress('radical-square', done, nonProjectiveCount * nonProjectiveCount);
    }
    progress('radical-square', nonProjectiveCount * nonProjectiveCount, nonProjectiveCount * nonProjectiveCount); return edges;
  }
  function verifyRelations(nodes, algebra) {
    function action(node, path) {
      let image = new Map(node.basisVertices.map((_, i) => [i, i]));
      for (const a of path) { const next = new Map(); for (const [start, at] of image) { const end = node._out[a].get(at); if (end !== undefined) next.set(start, end); } image = next; }
      return image;
    }
    for (const node of nodes) {
      for (const path of algebra.relations.zeroPaths) assert(!action(node, path).size, `${node.id} 不满足零关系。`);
      for (const relation of algebra.relations.commutativity) {
        const left = action(node, relation.left), right = action(node, relation.right);
        assert(left.size === right.size && [...left].every(([a, b]) => right.get(a) === b), `${node.id} 不满足循环幂相等关系。`);
      }
    }
  }
  function translateFromHomProfiles(nodes, edges, homDimensions, projectiveAttachments, e, progress) {
    // Applying Hom(X,-) to an almost split sequence ending in M gives
    // H[X,tau M] = sum_Y Irr(Y,M) H[X,Y] - H[X,M] + delta[X,M].
    // Full Hom columns distinguish modules: the AS relations and
    // H[:,P]-H[:,rad P]=e_P span all unit vectors, so H is invertible.
    const count = nodes.length, index = new Map(nodes.map((n, i) => [n.id, i])), columns = new Map();
    for (let y = 0; y < count; y++) {
      const key = homDimensions.map(row => row[y]).join(',');
      assert(!columns.has(key), '完整目录出现重复 Hom profile，无法可靠识别同构类。'); columns.set(key, y);
    }
    const incoming = Array.from({length: count}, () => []);
    edges.forEach(edge => incoming[index.get(edge.target)].push([index.get(edge.source), edge.multiplicity]));
    for (let y = 0; y < count; y++) {
      if (nodes[y].projective) continue;
      const profile = homDimensions.map((row, x) => sum(incoming[y].map(([z, multiplicity]) => multiplicity * row[z])) - row[y] + (x === y ? 1 : 0));
      const found = columns.get(profile.join(','));
      assert(found !== undefined && !nodes[found].projective, `τ(${nodes[y].id}) 的精确 Hom profile 没有唯一非投射匹配。`);
      nodes[y].tauId = nodes[found].id; progress('translation', y + 1, count - e);
    }
    for (const attachment of projectiveAttachments) assert(nodes[index.get(attachment.quotientId)].tauId === attachment.radicalId, 'τ(P/soc P) ≠ rad P，投射附着校验失败。');
    for (const node of nodes) if (!node.projective) {
      let at = node; for (let j = 0; j < e; j++) at = nodes[index.get(at.tauId)];
      assert(at.id === node.id, 'Brauer tree 的 τ^e 周期校验失败。');
    }
  }
  function build(input, options = {}) {
    const progress = typeof options.progress === 'function' ? options.progress : () => {};
    const tree = normalizedInput(input), algebra = algebraFromTree(tree), e = tree.edges.length, m = tree.multiplicity;
    const expectedNonProjective = e * e * m, expectedTotal = expectedNonProjective + e;
    progress('algebra', 1, 1);
    const enumeration = enumerateStrings(algebra, expectedNonProjective, progress);
    const nonProjectiveCount = enumeration.nodes.length, projectives = projectiveNodes(tree, algebra), nodes = enumeration.nodes.concat(projectives);
    assert(nodes.length === expectedTotal, '不可分解模总数不符。'); verifyRelations(nodes, algebra);
    const byId = new Map(nodes.map(n => [n.id, n])), attachments = [];
    for (const P of projectives) {
      const radical = pathStringOfSubquotient(P, 0, algebra.quiver), quotient = pathStringOfSubquotient(P, P.compositionLength - 1, algebra.quiver);
      assert(byId.has(radical.id) && byId.has(quotient.id), '投射的 radical 或顶商不在完整字符串目录中。');
      P.radicalId = radical.id; P.socleQuotientId = quotient.id;
      attachments.push({projectiveId: P.id, radicalId: radical.id, quotientId: quotient.id});
    }
    const hom = Array.from({length: nodes.length}, () => []);
    for (let x = 0; x < nodes.length; x++) {
      for (let y = 0; y < nodes.length; y++) hom[x][y] = homSpace(nodes[x], nodes[y], algebra.quiver);
      nodes[x].endDimension = hom[x][x].bases.length; nodes[x].endomorphismRadicalDimension = nodes[x].endDimension - 1;
      progress('hom', x + 1, nodes.length);
    }
    const homMatrix = hom.map(row => row.map(h => h.bases.length));
    const stableEdges = irreducibleMaps(nonProjectiveCount, nodes, hom, progress);
    assert(sum(stableEdges.map(edge => edge.multiplicity)) === 2 * e * (e * m - 1), '稳定 AR 箭头计数失败。');
    const edges = stableEdges.concat(attachments.flatMap(a => [
      {source: a.radicalId, target: a.projectiveId, multiplicity: 1, kind: 'projective-inclusion'},
      {source: a.projectiveId, target: a.quotientId, multiplicity: 1, kind: 'projective-quotient'}
    ]));
    assert(sum(edges.map(edge => edge.multiplicity)) === 2 * e * e * m, '完整 AR 箭头计数失败。');
    assert(edges.every(edge => edge.multiplicity === 1), 'Brauer tree 中出现意外的不可约重数。');
    translateFromHomProfiles(nodes, edges, homMatrix, attachments, e, progress);
    const algebraDimension = sum(projectives.map(P => P.compositionLength));
    const expectedDimension = sum(tree.vertices.map(v => tree.multiplicities[v] * tree.orders[v].length ** 2));
    assert(algebraDimension === expectedDimension, '代数维数与加权顶点度数公式不一致。');
    const cleanNodes = nodes.map(node => Object.fromEntries(Object.entries(node).filter(([key]) => !key.startsWith('_'))));
    const cleanEdges = edges.map(edge => Object.fromEntries(Object.entries(edge).filter(([key]) => !key.startsWith('_'))));
    progress('complete', 1, 1);
    return {schema: 'brauer-tree-atlas-1', family: 'brauer-tree', field: 'GF(5)', characteristic: PRIME,
      treeInput: tree, quiver: algebra.quiver, relations: algebra.relations, socleQuotientRelations: algebra.quotientRelations,
      nodes: cleanNodes, edges: cleanEdges, homMatrix, projectiveAttachments: attachments,
      e, multiplicity: m, algebraDimension, fullCount: expectedTotal, stableCount: expectedNonProjective,
      fullArrowCount: sum(edges.map(edge => edge.multiplicity)), stableArrowCount: sum(stableEdges.map(edge => edge.multiplicity)),
      maxStringLength: enumeration.maxStringLength, complete: true, stable: false,
      completeness: 'All strings of A/soc(A), modulo inversion, plus all indecomposable projectives; frontier exhausted and e(em+1) count verified.',
      validation: {relations: true, endRadicalsCertified: true, exactRadicalSquare: true, tauByUniqueHomProfiles: true, projectiveAttachments: true, tauPeriod: true},
      conventions: {moduleSide: 'right', pathMultiplication: 'left-to-right', vertexIndex: '0-based edge IDs', wordLetters: 'signed (arrowID+1)', arrowMaps: 'For each arrow, pairs of global source/target basis indices, coefficient 1.', fieldScope: 'Exact arithmetic over GF(5); no claim of tests in every characteristic.'}};
  }
  root.BrauerTreeAtlas = Object.freeze({build, version: '1.0.0', limits: {edges: 10, multiplicity: 8, maxModules: 150, field: PRIME}});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BrauerTreeAtlas;
})(globalThis);
