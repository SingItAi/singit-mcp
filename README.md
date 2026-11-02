<div align="center">

# SingIt MCP

**Give an agent SingIt tools with an MCP key with limits your owner sets: a daily limit, a per-request limit and an expiry, signed by the owner's wallet.**

[![CI](https://img.shields.io/github/actions/workflow/status/SingItAi/singit-mcp/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/SingItAi/singit-mcp/actions/workflows/ci.yml)
[![Live check](https://img.shields.io/github/actions/workflow/status/SingItAi/singit-mcp/live-check.yml?branch=main&style=flat-square&label=live%20check)](https://github.com/SingItAi/singit-mcp/actions/workflows/live-check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-000000?style=flat-square)](https://modelcontextprotocol.io)
[![x402](https://img.shields.io/badge/x402-USDC-purple?style=flat-square)](https://x402.org)

[Docs](https://singitai.app/docs/mcp/) · [Tools reference](https://singitai.app/docs/mcp-tools/) · [Developers](https://singitai.app/developers/) · [Main repository](https://github.com/SingItAi/SingItAI)

</div>

SingIt runs a **remote** MCP server. There is nothing to install and no local process: your client
connects to one URL.

```text
https://app.singitai.app/mcp
```

Streamable HTTP, JSON responses only (no SSE, no sessions). MCP Registry name: `app.singitai/singit`.
Server `singit` "SingIt x402", version 0.1.5 once deployed (the live server reports 0.1.3 until then); protocol 2025-06-18.

## Claude Code in 60 seconds

Configuration examples, not run live. The chat tools require the gateway deployment of 0.1.5.

1. Add the server without a key:

   ```bash
   claude mcp add --transport http --scope user singit https://app.singitai.app/mcp
   claude mcp list
   ```

   The list should show `singit: https://app.singitai.app/mcp (HTTP) - ✔ Connected`.

2. Ask: "Use the SingIt chat_free tool to explain x402 in two sentences."

   Free, no key, short answers (up to 400 tokens), using `free/deepseek-v4.1-flash` by default.
   The result includes `billing.remainingToday` and `billing.resetsAt`. A small daily allowance
   is counted per network, and a shared daily budget can run out. The result also hints to
   drop the `free/` prefix to pay with `chat`.

3. For paid answers, [create an MCP key with limits](#mcp-key-with-limits), then export it
   before starting Claude Code and replace the keyless configuration:

   ```bash
   export SINGIT_API_KEY=sk_singit_...
   claude mcp remove singit --scope user
   claude mcp add --transport http --scope user singit https://app.singitai.app/mcp --header 'Authorization: Bearer ${SINGIT_API_KEY}'
   ```

   Ask: "Use the SingIt chat tool to explain x402 in detail." Then use `get_limits` to
   check the remaining budget and `get_receipts` to check the charge.

See the [Claude Code guide](https://singitai.app/docs/claude-code/).

## Plugins for Claude Code and Codex

Claude Code (adds the MCP server plus `/singit:limits`, `/singit:receipts` and a "price before a paid call" skill):

```text
/plugin marketplace add SingItAi/singit-mcp
/plugin install singit@singit
```

Codex (adds the MCP server plus the `singit-limits`, `singit-receipts` and `price-before-paid-call` skills):

```bash
codex plugin marketplace add SingItAi/singit-mcp
codex plugin add singit@singit
```

Both work without a key (free tools, `chat_free`). To use paid tools and see your limits, create an
[MCP key with limits](#mcp-key-with-limits) and export `SINGIT_API_KEY` in the environment that starts the client; the
plugins read it from there and never store it. `/singit:limits` and `/singit:receipts` call the free, read-only
`get_limits` and `get_receipts`. The limits they show are the ones SingIt's server checks for calls made with that key to
SingIt's MCP and /v1; they do not limit anything an agent spends elsewhere. The plugin files live in
[`plugins/claude`](plugins/claude) and [`plugins/codex`](plugins/codex); the marketplace manifests are
`.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.

## MCP key with limits

Suggested terms: **$1 a day, $0.05 a request, 7 days**. In the SingIt app, the
“Agent via MCP” preset fills these in. The server's own defaults when you do not
change anything are $5 a day, $0.25 a request, 90 days. The minimum daily cap is
$0.01 and the maximum is $1000.

1. Open the [SingIt app](https://app.singitai.app/app/) and set up a SingIt allowance
   from your wallet: a Base limiter or Solana delegation. Paid MCP search and data
   tools need it. Without it, the tool says “Set up your allowance first.”
2. Open Settings → API keys. Your wallet signs the name, daily limit,
   per-request limit and duration. The key is shown once.
3. Export `SINGIT_API_KEY` securely in the environment that launches your client.
   Never put the key in chat, logs or a file.

## Quick start

Configuration examples, not run live.

The free tools and `tools/list` work **without a key**, so you can add the server and look around first.

**Claude Code**

```bash
claude mcp add --transport http singit https://app.singitai.app/mcp --header 'Authorization: Bearer ${SINGIT_API_KEY}'
```

Single quotes keep ${SINGIT_API_KEY} as a reference so the key is not written into Claude Code's configuration.

**Codex**

```bash
codex mcp add singit --url https://app.singitai.app/mcp --bearer-token-env-var SINGIT_API_KEY
```

**Cursor and other clients with a `url` and `headers` JSON config** (see [`.mcp.json`](.mcp.json); Windsurf uses `serverUrl`, see [docs/clients.md](docs/clients.md)):

```json
{
  "mcpServers": {
    "singit": {
      "url": "https://app.singitai.app/mcp",
      "headers": { "Authorization": "Bearer ${env:SINGIT_API_KEY}" }
    }
  }
}
```

More clients and per-client notes: [docs/clients.md](docs/clients.md).

## What the limits do and do not do

The key's daily and per-request caps are enforced by SingIt's server for calls made with that key to SingIt's MCP and the same key's /v1 endpoint. They do not limit what an agent spends anywhere else. SingIt's contracts do not protect other people's agents' own wallets.

On Base the owner's allowance limiter is an on-chain contract the owner can pause. On Solana key caps are checked by SingIt's server; the owner can revoke the delegation. There is no on-chain emergency stop. A paused Solana account is unpaused only by a new grant signed after the pause.

For a $0.01 daily cap, the refusal from `web_api_keys.py` is:

> This key's daily limit of 0.01 USDC is used up, counting requests still running. It starts again at 00:00 UTC, or raise it with a new key.

This quote comes from the code, not run live. The server counts today's spend,
held amounts for running calls and the most the next call may cost before allowing
it. A refused call returns `isError true`; nothing is bought or charged for it.
Stop when a limit refuses; do not try to bypass it.

Revoke immediately in Settings → API keys; no wallet signature is needed.
A wrong or revoked key returns HTTP 401. A missing, empty or unexpanded key is
keyless: free tools only. MCP allows 60 requests a minute per key.
A key cannot move funds or change limits.

See the [MCP key guide](https://singitai.app/docs/mcp-key/) and
[SingIt skill](https://singitai.app/SKILL.md).

## Tools

18 tools. The full reference with every parameter, allowed value, key scope and network is on the website, https://singitai.app/docs/mcp-tools/; [docs/tools.md](docs/tools.md) is the generated offline copy checked against the live server.

| Group | Tools | Key |
|---|---|---|
| Free lookups | `get_price`, `list_price_symbols`, `list_models` | none |
| Free answers | `chat_free` | none |
| Chat (paid per call) | `chat` | yes, no extra scope |
| Your account (free, read-only) | `get_balance`, `get_limits`, `get_receipts` | yes |
| Web (paid per call) | `web_search`, `read_page` | yes, `search` scope |
| Market and data (paid per call) | `get_weather`, `get_singit_risk_check`, `get_x_profile`, `get_crypto_news`, `get_hyperliquid_market`, `get_funding_rates`, `resolve_ens`, `get_token_price` | yes, `tools` scope |

Paid calls are charged to the key's own limits, in USDC, including `chat`. Chat and web tools work on Base or Solana accounts; the
market and data tools need a Base account for now. Read-only tools can still cost money, and repeating
a paid call charges again. `get_limits` shows what the key has spent and what is left today.

Chat needs any valid key, with no extra scope. Send exactly one of `prompt` or `messages`;
optional `model` is an ID from `list_models` without the `free/` prefix. With `prompt`,
you can also send `system`. `max_tokens` defaults to 1024 and can be up to 8192;
reasoning models think inside that budget. SingIt's server enforces the key's daily
and per-request caps for calls with that key to SingIt's MCP and /v1 only; a call
over a cap is refused before anything is charged.

## Check that it works

Configuration examples, not run live. Neither request needs a key and neither spends anything:

```bash
curl -sS https://app.singitai.app/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"1.0"}}}'

curl -sS https://app.singitai.app/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Then ask the agent to call `get_limits`: it is free, read-only, and requires a key.
It shows spent today, held amounts for running calls, remaining daily budget and expiry.

Or run the bundled check, which compares the live server with [`tools.json`](tools.json) (Node 20+, no dependencies):

```bash
npm run check:live
```

## What is in this repository

| Path | What |
|---|---|
| `server.json` | The MCP Registry manifest for `app.singitai/singit` |
| `.mcp.json`, `llms-install.md` | Ready-made client config and an install guide meant for LLM clients |
| `tools.json` | Gateway-source snapshot pending deployment; refresh from live after deployment |
| `docs/tools.md` | Offline copy of the website's tools reference, generated from `tools.json` |
| `scripts/check-live.mjs` | Free check of the live server against the snapshot |

The server itself runs inside the SingIt gateway and shares code with the rest of the payment stack, so
its source lives in the [main repository](https://github.com/SingItAi/SingItAI) (`sign402-gateway`).
This repository is where you find out how to connect and what the server offers.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). Security problems: email contact@singitai.app, not a public
issue ([SECURITY.md](SECURITY.md)). MIT licensed.
