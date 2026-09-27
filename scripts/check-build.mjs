import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
const root=path.resolve("dist");
async function walk(dir) {
  const result=[];
  for(const item of await readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())result.push(...await walk(p));
    else result.push(p);
  }
  return result;
}
const html=(await walk(root)).filter(p=>p.endsWith(".html"));
const sourceRoot=path.resolve("src");
const sourceHtml=(await walk(sourceRoot)).filter(p=>p.endsWith(".html"));
const expected=new Set(sourceHtml.map(file=>path.relative(sourceRoot,file)));
const built=new Set(html.map(file=>path.relative(root,file)));
const missing=[...expected].filter(file=>!built.has(file));
const unexpected=[...built].filter(file=>!expected.has(file));
if(missing.length||unexpected.length)throw new Error(`HTML entry mismatch. Missing: ${missing.join(", ")||"none"}; unexpected: ${unexpected.join(", ")||"none"}`);
for(const file of html){
  const text=await readFile(file,"utf8");
  if(!text.includes('lang="th"')||!text.includes("<title>"))throw new Error("Missing metadata: "+file);
  for(const match of text.matchAll(/(?:src|href)="([^"]+)"/g)){
    if(/^(?:https?:|data:|#)/.test(match[1]))continue;
    const target=match[1].startsWith("/")?path.join(root,match[1]):path.resolve(path.dirname(file),match[1]);
    await access(target);
  }
}
console.log("Validated "+html.length+" HTML entries and all their local asset references.");
