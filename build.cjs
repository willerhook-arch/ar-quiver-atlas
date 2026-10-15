const fs=require('node:fs'),path=require('node:path');
const root=__dirname,src=__dirname;
let s=fs.readFileSync(path.join(src,'atlas-template.html'),'utf8');
const inputs={TREE_CSS:'tree-editor.css',HEREDITARY_MODEL:'hereditary-model.js',ATLAS_MODEL:'atlas-model.js',BRAUER_TREE_MODEL:'brauer-tree.js',BRAUER_TREE_LAYOUT:'tree-layout.js',TREE_EDITOR_UI:'tree-editor-ui.js',ATLAS_UI:'atlas-ui.js'};
for(const[label,file]of Object.entries(inputs))s=s.replace('/* '+label+' */',fs.readFileSync(path.join(src,file),'utf8'));
s=s.replace('<!-- TREE_EDITOR -->',fs.readFileSync(path.join(src,'tree-editor-markup.html'),'utf8'));
for(const name of ['index.html'])fs.writeFileSync(path.join(root,name),s);
console.log('Built self-contained HTML:',Buffer.byteLength(s),'bytes');
