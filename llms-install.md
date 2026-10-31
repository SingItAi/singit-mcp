# Install SingIt MCP for a user

You are the AI agent doing this installation for a user. Follow these numbered
steps. All commands below are configuration examples, not run live.

## 1. Explain what the key limits

Give the user SingIt tools with an MCP key with limits your owner sets: daily and
per-request caps and an expiry, signed by the owner's wallet.

The key's daily and per-request caps are enforced by SingIt's server for calls made with that key to SingIt's MCP and the same key's /v1 endpoint. They do not limit what an agent spends anywhere else. SingIt's contracts do not protect other people's agents' own wallets.

On Base the owner's allowance limiter is an on-chain contract the owner can pause. On Solana key caps are checked by SingIt's server; the owner can revoke the delegation. There is no on-chain emergency stop. A paused Solana account is unpaused only by a new grant signed after the pause.

A key cannot move funds or change limits. The owner can revoke it immediately in
Settings → API keys without a wallet signature. MCP allows 60 requests a minute per key.
See the [MCP key guide](https://singitai.app/docs/mcp-key/) and
[SingIt skill](https://singitai.app/SKILL.md).

## 2. Ask the user to create and export the key

Ask the user to open https://app.singitai.app/app/ and set up a SingIt allowance
from their wallet: a Base limiter or Solana delegation. Paid MCP search and data
tools need it; otherwise the tool says “Set up your allowance first.”

Ask the user to open Settings → API keys and choose the “Agent via MCP” preset:
**$1 a day, $0.05 a request, 7 days** are suggested terms. The server's own defaults
when unchanged are $5 a day, $0.25 a request, 90 days; the daily cap ranges from
$0.01 to $1000. Their wallet signs the terms and the key is shown once.

Ask the user to export `SINGIT_API_KEY` securely in the environment that launches
their client, then confirm it is set without showing its value. Never invent,
request in chat, print or log a key. Never put a key in a file; keep it only in
the environment variable. Do not proceed with keyed verification until the user
confirms it is ready.

## 3. Add the server for the user's client

Ask the user which client they use if it is unknown. Use Streamable HTTP.

### Claude Code

```bash
claude mcp add --transport http singit https://app.singitai.app/mcp --header 'Authorization: Bearer ${SINGIT_API_KEY}'
```

Single quotes keep ${SINGIT_API_KEY} as a reference so the key is not written into Claude Code's configuration.

### Codex

```bash
codex mcp add singit --url https://app.singitai.app/mcp --bearer-token-env-var SINGIT_API_KEY
```

### Cursor / generic JSON

For Cursor, add this block to `~/.cursor/mcp.json`, then restart Cursor. For another
client supporting `url` and `headers`, use the same block in its MCP configuration.
The file contains only an environment reference, never the key itself.

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

See [docs/clients.md](docs/clients.md) for client-specific notes. If a client would
persist the expanded key, use its environment-reference configuration instead;
never write the key to disk.

## 4. Verify free access, then the key

Run `initialize`, then `tools/list`. These requests are free and need no key:

```bash
curl -sS https://app.singitai.app/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"1.0"}}}'

curl -sS https://app.singitai.app/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Check that initialization succeeds and `tools/list` returns 16 tools. This only
checks free access. Ask the agent to call `get_limits` through the configured
client: it is free, read-only, and requires a key. Check spent today, held amounts
for running calls, remaining daily budget and expiry against the user's terms.
Report these results without revealing the key.

## 5. Ask the user before the first paid call

Ask the user whether they agree to one paid `web_search` and what query to use.
Only call it after they agree. A search costs about a cent or less; receipts show
the exact amount. Read `get_receipts` and `get_limits` afterward to report the
charge and remaining budget. Search and `read_page` need the `search` scope and
work on Base or Solana; data tools need `tools` and are Base only for now.

## Troubleshooting

| Result | Action |
| --- | --- |
| HTTP 401 | Wrong or revoked key. Ask the user to check or replace it in the environment, never in chat. |
| Keyless behaviour | Missing, empty or unexpanded environment references mean free tools only. Check the client's environment and expansion support without printing the key. |
| “Set up your allowance first.” | Ask the user to set up a Base limiter or Solana delegation in the app. |
| Daily limit used up (`isError true`) | Stop, tell the user, and do not bypass the cap. It resets at 00:00 UTC, or the owner can sign a new key with different terms. Running calls count toward the cap; refused calls buy nothing and incur no charge. |
| Scope errors | New keys include `search` and `tools`. Keys made before data tools existed need a new key. Ask the user to create one with the required scope; data tools require Base for now. |
