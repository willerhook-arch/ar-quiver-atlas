# AR Quiver Atlas

**[打开在线图谱 / Open the atlas](https://willerhook-arch.github.io/ar-quiver-atlas/)**

一个无需登录、无需安装依赖的不可分解模与 Auslander–Reiten quiver 浏览器工具。
下载 `index.html` 后也可直接打开。所有计算在浏览器内完成；没有计算后端或分析追踪。

## 一般 Brauer 树

选择“Brauer 树”，编辑边的端点，更新顶点，再设置每个顶点的循环序、异常顶点和重数。
可以从预设树形开始，或在任意顶点添加／删除叶子。改完后点击“计算完整 AR 图”。

- 当前资源范围：1–10 条边、异常重数 1–8，且全部不可分解模数 `e(em+1) ≤ 150`。
- 树必须连通、无圈，至多一个顶点重数大于 1。异常点可以是叶子。
- 精确基域为 **GF(5)**，采用右模，箭头映射与 quiver 同向。
- 列出全部不可分解模，含真实投射模；可查看顶、底、维数、τ、End 维数、基和箭头作用。
- 可切换完整／稳定 AR 图，导出 SVG、完整 JSON 或单独的树配置。
- 编辑器循环序使用从 **1** 开始的边号；导出的配置和引擎内部使用从 **0** 开始的边号。

合法字符串被枚举至扩展耗尽，按逆词去重，再补入由树两端数据构造的投射模。
程序求出所有 Hom，认证 End radical，计算 socle 商上的 `rad/rad²`，然后补上投射附着。
τ 通过完整 Hom profile 唯一匹配识别。圆柱布局从已算出的真实图恢复；不是星形模板。
超出资源范围会拒绝计算，不会把有限截取标为完整图。

## 其他代数族

- Dynkin A/D/E：整个模范畴 AR 图、正根维数向量、投射／内射及 τ。
- 统一循环 Nakayama 和 Brauer 星：完整有限型图，支持长度、边数与重数参数。
- Kronecker / Euclidean 遗传代数：预投射、正则管族、预内射的结构与有限窗口。
  此部分默认代数闭域；不能把有限域的全部正则管缩成有限个有理点。
- 一般 gentle、Brauer graph、canonical/tubular 的分类范围和未实现部分在页面中说明。

## 验证

需要 Node.js 18 或以上，无 npm 依赖：

```bash
node test-atlas.cjs
```

测试直接读取 `index.html` 内的模型代码，涵盖原有 244 种有限型定向、22,354 个 hereditary
节点、循环 Nakayama 和管，以及一般 Brauer 树的独立直线树 AR/τ 基准和圆柱布局。

一般树另有 **9 例 JavaScript / 独立 Python / 真实 GAP 4.16.1 + QPA 1.37 三方比较**：
200 个模、6,660 对 Hom/Irr、4,266 项 QPA 检查全部通过。
匹配使用实际可逆 Hom 矩阵及 DTr 同构测试，不按维数向量猜同构。
覆盖单边、直线、分叉、异常叶子、非默认循环序。

`brauer-tree-validation.zip` 包含完整 oracle、生成的 QPA 脚本、原始日志及复现说明；
汇总见 `validation.json`。这些是本地实际验证，不声称每个可能输入都已在 QPA 或云端运行。
QPA 1.37 的原生 Brauer 配置构造器在循环序和单边情形有已记录的限制；本工具显式构造关系。

## 修改与重建

```bash
node build.cjs
node test-atlas.cjs
```

源模板、样式、各数学引擎与界面脚本均在仓库根目录；`index.html` 是生成的单文件成品。
GitHub Pages 从 `main` 分支根目录发布。页面不依赖仓库中的 ZIP、测试或其他脚本文件运行。

数学依据见页面的“算法与依据”，包括 Schroll、Duffield、Crawley-Boevey 和 Nakayama 分类文献。
AR quiver 描述不可约态射，不等于所有 Hom；稳定图也不包含投射模。
