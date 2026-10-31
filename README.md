<div align="center">

# SingIt MCP

**Prices, models, web search and market data for your agent, over MCP. Paid calls are billed to your SingIt API key and stay inside that key's limits.**

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

## Quick start

The free tools and `tools/list` work **without a key**, so you can add the server and look around first.

**Claude Code**

```bash
claude mcp add --transport http singit https://app.singitai.app/mcp \
  --header "Authorization: Bearer $SINGIT_API_KEY"
```

**Codex**

```bash
codex mcp add singit --url https://app.singitai.app/mcp --bearer-token-env-var SINGIT_API_KEY
```

**Cursor, Windsurf and other clients with a JSON config** (see [`.mcp.json`](.mcp.json)):

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

## Get a key (only for paid tools)

Open the [SingIt app](https://app.singitai.app/app/), then Settings, API keys, and export the key as
`SINGIT_API_KEY` in the environment that launches your client. Each key has its own daily and
per-request caps and an expiry. A missing, empty or unexpanded key behaves like no key; a wrong or
revoked key gets HTTP 401.

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

Neither request needs a key and neither spends anything:

```bash
curl -sS https://app.singitai.app/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"1.0"}}}'

curl -sS https://app.singitai.app/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

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
