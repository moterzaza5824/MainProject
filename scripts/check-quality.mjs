import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = join(root, "src");
const relativePath = file => relative(root, file).replaceAll("\\", "/");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const sourceFiles = walk(sourceRoot).filter(file => extname(file) === ".ts" && !file.endsWith(".d.ts"));
const pageEntries = sourceFiles.filter(file => /\/pages\/.*\/page\.ts$/.test(file.replaceAll("\\", "/")));
const entries = [join(sourceRoot, "entry.ts"), ...pageEntries];
const sourceSet = new Set(sourceFiles.map(file => resolve(file)));

function importsFor(file) {
  const source = readFileSync(file, "utf8");
  const specifiers = [];
  const staticImport = /(?:import|export)\s+(?:type\s+)?(?:[^"'();]*?\s+from\s*)?["']([^"']+)["']/g;
  const dynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (const pattern of [staticImport, dynamicImport]) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers.flatMap(specifier => {
    if (!specifier.startsWith(".")) return [];
    const base = resolve(dirname(file), specifier);
    const candidates = [base, `${base}.ts`, join(base, "index.ts")];
    const match = candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
    return match && sourceSet.has(resolve(match)) ? [resolve(match)] : [];
  });
}

const graph = new Map(sourceFiles.map(file => [resolve(file), importsFor(file)]));
const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency);
}
entries.forEach(entry => visit(resolve(entry)));

const unreachable = sourceFiles.filter(file => !reachable.has(resolve(file)));
if (unreachable.length) {
  throw new Error(`Unreachable TypeScript modules:\n${unreachable.map(relativePath).join("\n")}`);
}

const active = new Set();
const complete = new Set();
const cycles = [];
function findCycles(file, trail = []) {
  if (active.has(file)) {
    const start = trail.indexOf(file);
    cycles.push([...trail.slice(start), file].map(relativePath).join(" -> "));
    return;
  }
  if (complete.has(file)) return;
  active.add(file);
  for (const dependency of graph.get(file) ?? []) findCycles(dependency, [...trail, file]);
  active.delete(file);
  complete.add(file);
}
entries.forEach(entry => findCycles(resolve(entry)));
if (cycles.length) throw new Error(`Circular imports:\n${[...new Set(cycles)].join("\n")}`);

const oversized = sourceFiles.filter(file => statSync(file).size > 30_000);
if (oversized.length) {
  throw new Error(`TypeScript modules over 30 KB:\n${oversized.map(file => `${relativePath(file)} (${statSync(file).size} bytes)`).join("\n")}`);
}

console.log(`Quality checks passed: ${sourceFiles.length} TypeScript modules are reachable, acyclic, and within the size limit.`);
