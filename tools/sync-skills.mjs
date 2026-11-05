// Copies the shared skills from .agents/skills (read by Codex and Antigravity)
// to .claude/skills (read by Claude Code). Edit skills only in .agents/skills.
//   node tools/sync-skills.mjs          copy
//   node tools/sync-skills.mjs --check  exit 1 if the two folders differ
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, ".agents", "skills");
const target = join(root, ".claude", "skills");

function listFiles(base, dir = base) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(base, path) : [relative(base, path)];
  }).sort();
}

function differences() {
  const sourceFiles = new Set(listFiles(source));
  const targetFiles = new Set(listFiles(target));
  const all = [...new Set([...sourceFiles, ...targetFiles])];
  return all.filter((file) =>
    !sourceFiles.has(file) ||
    !targetFiles.has(file) ||
    !readFileSync(join(source, file)).equals(readFileSync(join(target, file))));
}

if (process.argv.includes("--check")) {
  const changed = differences();
  for (const file of changed) console.error(`out of sync: ${file}`);
  process.exit(changed.length ? 1 : 0);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Synced ${listFiles(source).length} files to .claude/skills`);
