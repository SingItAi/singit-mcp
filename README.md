<div align="center">

# SingIt MCP

**Give an agent SingIt tools with an MCP key with limits your owner sets: a daily limit, a per-request limit and an expiry, signed by the owner's wallet.**

[![CI](https://img.shields.io/github/actions/workflow/status/SingItAi/singit-mcp/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/SingItAi/singit-mcp/actions/workflows/ci.yml)
[![Live check](https://img.shields.io/github/actions/workflow/status/SingItAi/singit-mcp/live-check.yml?branch=main&style=flat-square&label=live%20check)](https://github.com/SingItAi/singit-mcp/actions/workflows/live-check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-000000?style=flat-square)](https://modelcontextprotocol.io)
[![x402](https://img.shields.io/badge/x402-USDC-purple?style=flat-square)](https://x402.org)

[Docs](https://singitai.app/docs/mcp/) · [Developers](https://singitai.app/developers/) · [Main repository](https://github.com/SingItAi/SingItAI)

</div>

SingIt runs a **remote** MCP server. There is nothing to install and no local process: your client
connects to one URL.

```text
https://app.singitai.app/mcp
```

Streamable HTTP, JSON responses only (no SSE, no sessions). MCP Registry name: `app.singitai/singit`.
Server `singit` "SingIt x402", version 0.1.3, protocol 2025-06-18.

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

16 tools. The full table, with parameters, key scope and network, is in [docs/tools.md](docs/tools.md).

| Group | Tools | Key |
|---|---|---|
| Free lookups | `get_price`, `list_price_symbols`, `list_models` | none |
| Your account (free, read-only) | `get_balance`, `get_limits`, `get_receipts` | yes |
| Web (paid per call) | `web_search`, `read_page` | yes, `search` scope |
| Market and data (paid per call) | `get_weather`, `get_singit_risk_check`, `get_x_profile`, `get_crypto_news`, `get_hyperliquid_market`, `get_funding_rates`, `resolve_ens`, `get_token_price` | yes, `tools` scope |

Paid calls are charged to the key's own limits, in USDC. Web tools work on Base or Solana accounts; the
market and data tools need a Base account for now. Read-only tools can still cost money, and repeating
a paid call charges again. `get_limits` shows what the key has spent and what is left today.

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
| `tools.json` | Snapshot of the live `tools/list` response |
| `docs/tools.md` | Tool reference, generated from `tools.json` |
| `scripts/check-live.mjs` | Free check of the live server against the snapshot |

The server itself runs inside the SingIt gateway and shares code with the rest of the payment stack, so
its source lives in the [main repository](https://github.com/SingItAi/SingItAI) (`sign402-gateway`).
This repository is where you find out how to connect and what the server offers.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). Security problems: email contact@singitai.app, not a public
issue ([SECURITY.md](SECURITY.md)). MIT licensed.
