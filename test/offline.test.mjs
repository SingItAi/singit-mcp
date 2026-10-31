import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ENDPOINT, TOOL_META, readJson, renderToolsDoc } from "../scripts/lib.mjs";

const text = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const snap = readJson("tools.json");

test("server.json is the Registry manifest for the remote endpoint", () => {
  const s = readJson("server.json");
  assert.equal(s.name, "app.singitai/singit");
  assert.match(s.version, /^\d+\.\d+\.\d+$/);
  const v = (x) => x.split(".").map(Number);
  const [a, b] = [v(s.version), v(snap.serverInfo.version)];
  const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  assert.ok(cmp >= 0, "manifest version should not be older than the server's reported version");
  assert.equal(s.repository.url, "https://github.com/SingItAi/singit-mcp");
  assert.equal(s.remotes.length, 1);
  assert.equal(s.remotes[0].type, "streamable-http");
  assert.equal(s.remotes[0].url, ENDPOINT);
  assert.equal(s.remotes[0].headers[0].isSecret, true);
  assert.equal(s.remotes[0].headers[0].isRequired, false);
});

test(".mcp.json points at the same endpoint and reads the key from the environment", () => {
  const m = readJson(".mcp.json").mcpServers.singit;
  assert.equal(m.url, ENDPOINT);
  assert.equal(m.headers.Authorization, "Bearer ${env:SINGIT_API_KEY}");
});

test("tools.json: every tool is complete and classified", () => {
  assert.equal(snap.tools.length, 16);
  for (const t of snap.tools) {
    assert.ok(t.name && t.description && t.inputSchema && t.annotations, `${t.name} is incomplete`);
    assert.ok(TOOL_META[t.name], `${t.name} is missing from TOOL_META`);
  }
  const names = new Set(snap.tools.map((t) => t.name));
  for (const n of Object.keys(TOOL_META)) assert.ok(names.has(n), `${n} is in TOOL_META but not in tools.json`);
});

test("tools.json records when it was captured", () => {
  assert.match(snap.capturedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("docs/tools.md is generated from tools.json", () => {
  assert.equal(text("docs/tools.md"), renderToolsDoc(snap));
});

test("README lists exactly the tools in tools.json", () => {
  const readme = text("README.md");
  const mentioned = new Set([...readme.matchAll(/`([a-z][a-z0-9_]+)`/g)].map((m) => m[1]));
  for (const t of snap.tools) assert.ok(mentioned.has(t.name), `README does not mention ${t.name}`);
  assert.match(readme, new RegExp(`\\b${snap.tools.length} tools\\b`));
});

test("no wallet addresses, keys or secrets in tracked docs", () => {
  for (const f of ["README.md", "docs/clients.md", "docs/tools.md", "llms-install.md", "server.json", ".mcp.json", "tools.json"]) {
    assert.doesNotMatch(text(f), /0x[0-9a-fA-F]{40}/, `${f} contains an address`);
    assert.doesNotMatch(text(f), /sk_singit_[A-Za-z0-9]{8,}/, `${f} contains a key`);
  }
});

test("community files exist", () => {
  for (const f of ["LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md", ".github/PULL_REQUEST_TEMPLATE.md", ".github/ISSUE_TEMPLATE/bug_report.yml"]) {
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} is missing`);
  }
});
