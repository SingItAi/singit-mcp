import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { ENDPOINT, readJson } from "../scripts/lib.mjs";

const text = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const claude = readJson("plugins/claude/.claude-plugin/plugin.json");
const codex = readJson("plugins/codex/.codex-plugin/plugin.json");
const FILES = [
  "plugins/claude/.claude-plugin/plugin.json", "plugins/claude/commands/limits.md", "plugins/claude/commands/receipts.md",
  "plugins/claude/skills/price-before-paid-call/SKILL.md", "plugins/codex/.codex-plugin/plugin.json", "plugins/codex/.mcp.json",
  "plugins/codex/skills/singit-limits/SKILL.md", "plugins/codex/skills/singit-receipts/SKILL.md",
  "plugins/codex/skills/price-before-paid-call/SKILL.md", ".claude-plugin/marketplace.json", ".agents/plugins/marketplace.json",
];

test("Claude Code plugin: manifest, endpoint and key from the environment", () => {
  assert.equal(claude.name, "singit");
  assert.match(claude.version, /^\d+\.\d+\.\d+$/);
  assert.equal(claude.license, "MIT");
  assert.equal(claude.author.email, "contact@singitai.app");
  const server = claude.mcpServers.singit;
  assert.equal(server.type, "http");
  assert.equal(server.url, ENDPOINT);
  assert.equal(server.headers.Authorization, "Bearer ${SINGIT_API_KEY}");
  assert.ok(existsSync(new URL("../plugins/claude/.claude-plugin/icon.png", import.meta.url)));
});

test("Claude Code marketplace lists the plugin from its folder", () => {
  const market = readJson(".claude-plugin/marketplace.json");
  assert.equal(market.name, "singit");
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source]), [["singit", "./plugins/claude"]]);
});

test("slash commands call only the free, read-only account tools", () => {
  const cases = { limits: "get_limits", receipts: "get_receipts" };
  for (const [name, tool] of Object.entries(cases)) {
    const doc = text(`plugins/claude/commands/${name}.md`);
    assert.match(doc, /^---\n[\s\S]*?\n---\n/);
    assert.match(doc, new RegExp(`^allowed-tools: mcp__plugin_singit_singit__${tool}$`, "m"));
    assert.ok(doc.includes(`\`${tool}\``));
    assert.match(doc, /Do not call any paid tool/);
    assert.ok(!/mcp__plugin_singit_singit__(chat|web_search|read_page)/.test(doc));
  }
  assert.deepEqual(readdirSync(new URL("../plugins/claude/commands", import.meta.url)).sort(), ["limits.md", "receipts.md"]);
});

test("Codex plugin: manifest, MCP config and marketplace", () => {
  assert.equal(codex.name, "singit");
  assert.equal(codex.skills, "./skills/");
  assert.equal(codex.mcpServers, "./.mcp.json");
  const server = readJson("plugins/codex/.mcp.json").mcpServers.singit;
  assert.equal(server.url, ENDPOINT);
  assert.equal(server.bearer_token_env_var, "SINGIT_API_KEY");
  assert.ok(!("headers" in server) && !("bearer_token" in server));
  const market = readJson(".agents/plugins/marketplace.json");
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source.path]), [["singit", "./plugins/codex"]]);
});

test("the price-before-paid-call skill is the same in both plugins and has a name and description", () => {
  const a = text("plugins/claude/skills/price-before-paid-call/SKILL.md");
  assert.equal(a, text("plugins/codex/skills/price-before-paid-call/SKILL.md"));
  assert.match(a, /^---\nname: price-before-paid-call\ndescription: .+\n---\n/);
  for (const n of ["singit-limits", "singit-receipts"]) assert.match(text(`plugins/codex/skills/${n}/SKILL.md`), new RegExp(`^---\\nname: ${n}\\ndescription: .+\\n---\\n`));
});

test("plugin copy states only what the server checks, with no claims about other agents, secrets or addresses", () => {
  const boundary = /checked by SingIt's server for calls made with (?:this|that) key to SingIt's MCP and \/v1/;
  for (const f of ["plugins/claude/commands/limits.md", "plugins/claude/skills/price-before-paid-call/SKILL.md", "plugins/codex/skills/singit-limits/SKILL.md"]) {
    assert.match(text(f), boundary, `${f} should state who checks the limits`);
  }
  for (const f of FILES) {
    const doc = text(f);
    assert.doesNotMatch(doc, /protects? (other|your team|every|all) |other teams|any agent|AI team|run by bots|hackathon/i, `${f} makes a forbidden claim`);
    assert.doesNotMatch(doc, /0x[0-9a-fA-F]{40}|sk_singit_[A-Za-z0-9]{8,}/, `${f} contains an address or key`);
    assert.doesNotMatch(doc, /\$\d|per.token|cheaper|\d+ ?%/i, `${f} states a price or percentage`);
  }
});

test("README documents both installs and the key handling", () => {
  const readme = text("README.md");
  assert.match(readme, /Codex does not start the server when the\nvariable is unset/);
  assert.match(readme, /codex mcp add singit --url https:\/\/app\.singitai\.app\/mcp/);
  for (const s of ["/plugin marketplace add SingItAi/singit-mcp", "/plugin install singit@singit", "codex plugin marketplace add SingItAi/singit-mcp",
    "codex plugin add singit@singit", "/singit:limits", "/singit:receipts"]) assert.ok(readme.includes(s), `README missing ${s}`);
});

test("front matter is valid YAML: descriptions are double-quoted strings (an unquoted ': ' breaks loading)", () => {
  const docs = FILES.filter((f) => f.endsWith(".md") && !f.endsWith("README.md"));
  assert.equal(docs.length, 6);
  for (const f of docs) {
    const front = text(f).match(/^---\n([\s\S]*?)\n---\n/)[1];
    for (const line of front.split("\n")) {
      const m = line.match(/^([a-z-]+): (.*)$/);
      assert.ok(m, `${f}: unexpected front matter line ${line}`);
      if (["description", "argument-hint"].includes(m[1])) assert.equal(typeof JSON.parse(m[2]), "string", `${f}: ${m[1]} must be a quoted string`);
      else assert.doesNotMatch(m[2], /: | #/, `${f}: ${m[1]} needs quoting`);
    }
  }
});
