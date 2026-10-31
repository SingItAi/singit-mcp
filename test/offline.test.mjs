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
  for (const f of ["README.md", "docs/clients.md", "docs/tools.md", "llms-install.md", "CHANGELOG.md", "server.json", ".mcp.json", "tools.json"]) {
    assert.doesNotMatch(text(f), /0x[0-9a-fA-F]{40}/, `${f} contains an address`);
    assert.doesNotMatch(text(f), /sk_singit_[A-Za-z0-9]{8,}/, `${f} contains a key`);
  }
});

test("community files exist", () => {
  for (const f of ["LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md", ".github/PULL_REQUEST_TEMPLATE.md", ".github/ISSUE_TEMPLATE/bug_report.yml"]) {
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} is missing`);
  }
});

test("key offer and agent installation retain terms, clients and spending boundary", () => {
  const boundary = "The key's daily and per-request caps are enforced by SingIt's server for calls made with that key to SingIt's MCP and the same key's /v1 endpoint. They do not limit what an agent spends anywhere else. SingIt's contracts do not protect other people's agents' own wallets.";
  const snippets = [
    'claude mcp add --transport http singit https://app.singitai.app/mcp \\\n  --header "Authorization: Bearer $SINGIT_API_KEY"',
    'codex mcp add singit --url https://app.singitai.app/mcp --bearer-token-env-var SINGIT_API_KEY',
    JSON.stringify(readJson(".mcp.json"), null, 2),
  ];
  for (const f of ["README.md", "llms-install.md"]) {
    const doc = text(f);
    for (const term of ["get_limits", "$1 a day", "$0.05 a request", "SINGIT_API_KEY", boundary, "https://singitai.app/docs/mcp-key/", "https://singitai.app/SKILL.md", "configuration examples, not run live"]) {
      assert.ok(doc.toLowerCase().includes(term.toLowerCase()), `${f} missing ${term}`);
    }
    for (const snippet of snippets.slice(0, 2)) assert.ok(doc.includes(snippet), `${f} missing client command`);
    const json = JSON.parse(doc.match(/```json\n([\s\S]*?)\n```/)[1]);
    assert.deepEqual(json, JSON.parse(snippets[2]), `${f} client JSON differs`);
    assert.match(doc, /new grant signed after the pause/);
    assert.match(doc, /no on-chain emergency stop/);
    assert.doesNotMatch(doc, /no admin|\bvideos?\b|\bimages?\b|cheaper|price.per.token|hackathon|AI team|run by bots|\/\.well-known\/agent-card\.json|sk_singit_/i);
  }
});

test("README quotes the daily limit refusal", () => {
  const quote = text("README.md").match(/^> (This key's daily limit.*)$/m)?.[1];
  assert.ok(quote);
  for (const words of ["0.01 USDC", "used up", "counting requests still running", "00:00 UTC", "raise it with a new key"]) {
    assert.ok(quote.includes(words), `refusal missing ${words}`);
  }
});
