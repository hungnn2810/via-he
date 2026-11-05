// Compares message names, payload keys and HTTP routes between the Colyseus server and the Unity client.
// Run from anywhere: node .agents/skills/verify-protocol/scripts/check-protocol.mjs
// Exits 1 when it finds a mismatch.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const read = (...parts) => readFileSync(join(root, ...parts), "utf8");
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

const room = read("server", "src", "rooms", "StreetRoom.ts");
const serverIndex = read("server", "src", "index.ts");
const scriptDir = join(root, "client", "Assets", "Scripts");
const clientFiles = readdirSync(scriptDir)
  .filter((name) => name.endsWith(".cs"))
  .map((name) => ({ name: relative(root, join(scriptDir, name)).replaceAll("\\", "/"), text: readFileSync(join(scriptDir, name), "utf8") }));

// Server: messages it accepts, with the keys of an inline payload type when there is one
const accepted = new Map();
for (const match of room.matchAll(/this\.(?:handle|onMessage)(?:<[^>]*>)?\('([A-Za-z]\w*)'\s*,\s*\(([^)]*)\)/g)) {
  const payload = /\bm:\s*\{([^}]*)\}/.exec(match[2]);
  const keys = payload && payload[1].split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const [, name, optional] = /^(\w+)(\?)?:/.exec(part) ?? [];
    return { name, optional: Boolean(optional) };
  }).filter((key) => key.name);
  accepted.set(match[1], { keys, line: lineOf(room, match.index) });
}

// Server: messages it pushes to clients
const pushed = new Map();
for (const match of room.matchAll(/\.(?:send|broadcast)\('([A-Za-z]\w*)'/g)) {
  if (!pushed.has(match[1])) pushed.set(match[1], lineOf(room, match.index));
}

// Text of the call argument that starts at index, up to its closing bracket
function argumentAt(text, index) {
  let depth = 1;
  for (let i = index; i < text.length; i++) {
    if ("([{".includes(text[i])) depth++;
    if (")]}".includes(text[i]) && --depth === 0) return text.slice(index, i);
  }
  return text.slice(index);
}

const keysIn = (code) => new Set([...code.matchAll(/\["(\w+)"\]\s*=/g), ...code.matchAll(/\bMsg\("(\w+)"/g)].map((m) => m[1]));

// Client: messages it sends, requests and listens for
const sent = [];
const listened = new Map();
const requested = new Map();
const routes = [];
for (const { name, text } of clientFiles) {
  for (const match of text.matchAll(/_net\.Send\("(\w+)"\s*(,?)/g)) {
    const argument = match[2] ? argumentAt(text, match.index + match[0].length).trim() : "";
    let keys = keysIn(argument);
    let exact = true;
    if (/^\w+$/.test(argument)) {
      // A local variable: read the keys set on it in the lines just before the call
      const before = text.slice(0, match.index).split("\n").slice(-6).join("\n");
      keys = keysIn(before);
      exact = keys.size > 0;
    } else if (argument.includes("WithDressTarget")) {
      exact = false;
    } else if (argument && keys.size === 0) {
      exact = false;
    }
    sent.push({ type: match[1], keys, exact, where: `${name}:${lineOf(text, match.index)}` });
  }
  for (const match of text.matchAll(/\.OnMessage<[^>]*>\("(\w+)"/g)) listened.set(match[1], `${name}:${lineOf(text, match.index)}`);
  for (const match of text.matchAll(/\.Request<.*?>\("(\w+)"/g)) requested.set(match[1], `${name}:${lineOf(text, match.index)}`);
  for (const match of text.matchAll(/Http\.(Get|Post)<.*?>\("(api\/[\w/]+)/g)) routes.push({ method: match[1].toLowerCase(), path: `/${match[2]}`, where: `${name}:${lineOf(text, match.index)}` });
}

const problems = [];
const notes = [];

for (const message of sent) {
  const handler = accepted.get(message.type);
  if (!handler) { problems.push(`${message.where}: client sends "${message.type}", server has no handler`); continue; }
  if (!handler.keys) continue;
  if (!message.exact) { notes.push(`${message.where}: "${message.type}" payload is built elsewhere, keys not checked`); continue; }
  for (const key of handler.keys) {
    if (!key.optional && !message.keys.has(key.name)) problems.push(`${message.where}: "${message.type}" is missing key "${key.name}"`);
  }
  for (const key of message.keys) {
    if (!handler.keys.some((k) => k.name === key)) problems.push(`${message.where}: "${message.type}" sends unknown key "${key}"`);
  }
}
for (const [type, where] of requested) {
  if (!accepted.has(type)) problems.push(`${where}: client requests "${type}", server has no handler`);
}
for (const [type, line] of pushed) {
  if (!listened.has(type)) problems.push(`StreetRoom.ts:${line}: server sends "${type}", client does not listen for it`);
}
for (const [type, where] of listened) {
  if (!pushed.has(type)) problems.push(`${where}: client listens for "${type}", server never sends it`);
}
for (const route of routes) {
  if (!serverIndex.includes(`app.${route.method}('${route.path}'`)) problems.push(`${route.where}: client calls ${route.method.toUpperCase()} ${route.path}, server has no such route`);
}
const used = new Set([...sent.map((m) => m.type), ...requested.keys()]);
for (const [type, { line }] of accepted) {
  if (!used.has(type)) notes.push(`StreetRoom.ts:${line}: server accepts "${type}", no client code sends it`);
}

console.log(`Server accepts ${accepted.size} messages and pushes ${pushed.size}. Client has ${sent.length} send calls, ${requested.size} requests, ${listened.size} listeners, ${routes.length} HTTP calls.`);
for (const note of notes) console.log(`note: ${note}`);
for (const problem of problems) console.error(`MISMATCH: ${problem}`);
console.log(problems.length ? `${problems.length} mismatches found.` : "No mismatches found.");
process.exit(problems.length ? 1 : 0);
