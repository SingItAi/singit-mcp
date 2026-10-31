// Compares the live MCP server with the snapshot in tools.json. Free: initialize and tools/list need no
// key and spend nothing. Exit code 1 on drift. `--update` rewrites tools.json from the live server.
import { writeFileSync } from "node:fs";
import { ENDPOINT, readJson } from "./lib.mjs";

const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };

async function rpc(id, method, params) {
  const res = await fetch(ENDPOINT, { method: "POST", headers: HEADERS, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

const init = await rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "singit-mcp-check", version: "1.0" } });
const { tools } = await rpc(2, "tools/list");
const live = { serverInfo: { name: init.serverInfo.name, title: init.serverInfo.title, version: init.serverInfo.version }, protocolVersion: init.protocolVersion, tools };

if (process.argv.includes("--update")) {
  const snap = { _note: "Snapshot of the keyless tools/list response from " + ENDPOINT + ". Refresh with: npm run check:live -- --update", ...live };
  writeFileSync(new URL("../tools.json", import.meta.url), JSON.stringify(snap, null, 2) + "\n");
  console.log(`tools.json updated: ${tools.length} tools, server ${live.serverInfo.version}. Now run: npm run docs`);
  process.exit(0);
}

const snap = readJson("tools.json");
const problems = [];
if (live.serverInfo.version !== snap.serverInfo.version) problems.push(`server version: snapshot ${snap.serverInfo.version}, live ${live.serverInfo.version}`);
if (live.protocolVersion !== snap.protocolVersion) problems.push(`protocol version: snapshot ${snap.protocolVersion}, live ${live.protocolVersion}`);
const snapByName = new Map(snap.tools.map((t) => [t.name, t]));
const liveByName = new Map(tools.map((t) => [t.name, t]));
for (const n of liveByName.keys()) if (!snapByName.has(n)) problems.push(`new tool on the server: ${n}`);
for (const n of snapByName.keys()) if (!liveByName.has(n)) problems.push(`tool missing on the server: ${n}`);
for (const [n, t] of liveByName) {
  const s = snapByName.get(n);
  if (!s) continue;
  if (JSON.stringify(s.inputSchema) !== JSON.stringify(t.inputSchema)) problems.push(`${n}: input schema changed`);
  if (JSON.stringify(s.annotations) !== JSON.stringify(t.annotations)) problems.push(`${n}: annotations changed`);
  if (s.description !== t.description) problems.push(`${n}: description changed`);
}
if (problems.length) {
  console.error("Live server differs from tools.json:\n- " + problems.join("\n- "));
  console.error("If the change is intended, run: npm run check:live -- --update && npm run docs");
  process.exit(1);
}
console.log(`live server matches tools.json: ${tools.length} tools, server ${live.serverInfo.version}`);
