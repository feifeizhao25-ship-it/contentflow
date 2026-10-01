/**
 * 国内版界面不得露出英文句子（加载提示、错误页、按钮、占位符……）。
 * 此前 error.tsx 整页英文（「Something went wrong!」「Try Again」），加载页写着「Loading Experience...」，
 * 开放平台页满是英文标题。扫描 tsx 里：独占一行的英文文本、行内 <标签>英文</标签>、
 * placeholder / title / label / message ... 属性里的英文短语。
 * 单个词（PRO、POST）与变量名不算；确有理由的例外写进下面的 ALLOW 并写明原因。
 *   node scripts/test-chinese-ui.mjs
 */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const ALLOW = [
  // { file: 'src/...', text: '...', why: '...' }
];
const CJK=/[㐀-鿿]/;
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const f=path.join(d,e.name);return e.isDirectory()?walk(f):/\.tsx$/.test(e.name)?[f]:[]})}
const out=[];
for(const f of walk('src')){
  const lines=fs.readFileSync(f,'utf8').split('\n');
  let inBlock=false;
  lines.forEach((line,i)=>{
    const t=line.trim();
    if(inBlock){ if(t.includes('*/')) inBlock=false; return; }
    if(t.startsWith('/*')&&!t.includes('*/')){inBlock=true;return;}
    if(t.startsWith('//')||t.startsWith('*')||t.startsWith('/*')) return;
    if(/^[A-Z]\w*(, \w+)+,?$/.test(t)) return; // import 列表里的标识符
    if(/^[A-Z][A-Za-z0-9,.'!?:-]*( [A-Za-z0-9,.'!?:()-]+)+$/.test(t)&&!CJK.test(t)) out.push(`${f}:${i+1}: [text] ${t}`);
    for(const m of line.matchAll(/<[A-Za-z][^<>]*[^=\-]>\s*([^<>{}\n]*[A-Za-z]{3}[^<>{}\n]*?)\s*<\//g)){
      const x=m[1]; if(CJK.test(x)) continue; if(!/[A-Za-z]{3,}\s+[A-Za-z]{2,}|\.\.\./.test(x)) continue; out.push(`${f}:${i+1}: [inline] ${x}`);
    }
    for(const m of line.matchAll(/\b(placeholder|title|label|message|description|alt|okText|cancelText|tooltip)=("([^"]*)"|\{'([^']*)'\})/g)){
      const x=m[3]??m[4]; if(!x||CJK.test(x)||!/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(x)) continue; out.push(`${f}:${i+1}: [${m[1]}] ${x}`);
    }
  });
}
const bad = out.filter((line) => !ALLOW.some((a) => line.includes(a.file) && line.includes(a.text)));
if (ALLOW.some((a) => !a.why)) { console.error('ALLOW 里的例外必须写 why'); process.exit(1); }
const scanned = fs.existsSync('src');
if (!scanned) { console.error('没有找到 src 目录，扫描没有检查任何东西'); process.exit(1); }
if (bad.length) { console.error('界面里有英文文字（国内版必须全中文）：\n' + bad.map((l) => '  - ' + l).join('\n')); process.exit(1); }
console.log('Chinese UI scan passed');
