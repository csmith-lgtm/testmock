#!/usr/bin/env node
/* Assemble the deploy tree.

   Three parts, two of them public:

     site/public/tools/     the interactive tools
     site/public/parents/   the parent guide
     site/staff/            the staff hub

   /tools/ and /parents/ are siblings, so the guide's tool links are rewritten
   from the repository's Interactive_Maths_Tools_v40_1/ to ../tools/. The staff
   hub is built separately and is not part of the public tree: it links out to
   the public site, so its own links become absolute if PUBLIC_BASE is given.

   Usage:  node build_site.js [outDir] [--base https://example.org]

   The repository layout is left alone. The tools folder keeps its
   Interactive_Maths_Tools_* name there because tools.test.js finds it by that
   name; only the deploy copy is called tools/.
*/
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const baseIx = args.indexOf('--base');
const PUBLIC_BASE = baseIx >= 0 ? String(args[baseIx + 1] || '').replace(/\/+$/, '') : '';
const positional = args.filter((a, i) => !a.startsWith('--') && !(baseIx >= 0 && i === baseIx + 1));
const OUT = path.resolve(positional[0] || 'site');
const ROOT = __dirname;

const TOOLS_SRC = fs.readdirSync(ROOT).find(n =>
  /^Interactive_Maths_Tools/.test(n) && fs.statSync(path.join(ROOT, n)).isDirectory());
const HUB = fs.readdirSync(ROOT).find(n => /^Primary_Maths_Curriculum_Navigator.*\.html$/.test(n));
const GUIDE = fs.readdirSync(ROOT).find(n => /^Parent_Maths_Guide.*\.html$/.test(n));
if (!TOOLS_SRC || !HUB || !GUIDE) {
  console.error('build_site: expected the tools folder, the hub and the parent guide at ' + ROOT);
  process.exit(1);
}

const rm = p => fs.existsSync(p) && fs.rmSync(p, { recursive: true, force: true });
const mk = p => fs.mkdirSync(p, { recursive: true });

rm(OUT);
const PUB = path.join(OUT, 'public');
const TOOLS = path.join(PUB, 'tools');
const PARENTS = path.join(PUB, 'parents');
const STAFF = path.join(OUT, 'staff');
[TOOLS, PARENTS, STAFF].forEach(mk);

// tools, copied verbatim
let nTools = 0;
for (const f of fs.readdirSync(path.join(ROOT, TOOLS_SRC))) {
  fs.copyFileSync(path.join(ROOT, TOOLS_SRC, f), path.join(TOOLS, f));
  nTools++;
}

// the parent guide, with its tool links pointed at the sibling folder
let guide = fs.readFileSync(path.join(ROOT, GUIDE), 'utf8');
const before = (guide.match(new RegExp(TOOLS_SRC + '/', 'g')) || []).length;
guide = guide.split(TOOLS_SRC + '/').join('../tools/');
if (/Primary_Maths_Curriculum_Navigator/.test(guide)) {
  console.error('build_site: the parent guide links to the staff hub; it must not.');
  process.exit(1);
}
fs.writeFileSync(path.join(PARENTS, GUIDE), guide);

// the staff hub, which links out to the public site
let hub = fs.readFileSync(path.join(ROOT, HUB), 'utf8');
const toolHref = PUBLIC_BASE ? PUBLIC_BASE + '/tools/' : '../public/tools/';
const guideHref = (PUBLIC_BASE ? PUBLIC_BASE + '/parents/' : '../public/parents/') + GUIDE;
hub = hub.split(TOOLS_SRC + '/').join(toolHref).split('"' + GUIDE + '"').join('"' + guideHref + '"');
fs.writeFileSync(path.join(STAFF, HUB), hub);

fs.writeFileSync(path.join(OUT, 'DEPLOY.md'), `# Deploy layout

Built by \`npm run build:site\`. Three parts, two of them public.

## public/  — upload to the public host

    public/tools/     ${nTools} interactive tools
    public/parents/   ${GUIDE}

\`tools/\` and \`parents/\` are siblings. The guide reaches a tool as
\`../tools/<file>\`, so the two folders must stay siblings wherever they land.
There is nothing staff-only in either: no diagnostic bands, no misconceptions,
no assessment codes.

## staff/  — put behind whatever restricts it to staff accounts

    staff/${HUB}

${PUBLIC_BASE
  ? 'Its links to the tools and to the parent guide are absolute, at ' + PUBLIC_BASE + '.'
  : 'Its links to the tools and to the parent guide are relative, which only works\nif staff/ sits beside public/. Rebuild with `--base https://your-domain` to\nmake them absolute, which is what you want if the hub is on a different site.'}

The parent guide does not link to the staff hub, and nothing in the public tree
does. The link only travels in the safe direction.
`);

console.log(`build_site: ${nTools} tools -> public/tools/`);
console.log(`build_site: ${GUIDE} -> public/parents/ (${before} tool links rewritten to ../tools/)`);
console.log(`build_site: ${HUB} -> staff/ (links ${PUBLIC_BASE ? 'absolute at ' + PUBLIC_BASE : 'relative to ../public/'})`);
console.log('build_site: wrote ' + OUT);
