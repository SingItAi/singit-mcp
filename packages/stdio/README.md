# @singitai/mcp — local wallet mode

A Node 20+ stdio MCP server named `singit-local`, titled **SingIt (local wallet)**.
It provides exactly four tools: `chat_free`, `chat`, `get_limits`, and `get_receipts`.
Paid chat uses your own wallet through the SingIt SDK, with no app login and no SingIt API key.
Wallet creation is not part of this package; a wallet-creation command is separate work.

## Install in Claude Code

Once published:

```bash
claude mcp add singit -- npx -y @singitai/mcp
```

Configure the launching process's environment. For explicit configuration, use this
`mcpServers` JSON form (environment references are expanded by Claude Code):

```json
{
  "mcpServers": {
    "singit": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@singitai/mcp"],
      "env": {
        "SINGIT_NETWORK": "base",
        "SINGIT_EVM_PRIVATE_KEY": "${SINGIT_EVM_PRIVATE_KEY}",
        "SINGIT_MAX_PER_CALL_USD": "0.01",
        "SINGIT_MAX_PER_DAY_USD": "0.10"
      }
    }
  }
}
```

Secrets belong in the environment, never command arguments. The JSON example avoids
copying a literal private key into client configuration. Use a different entry name if
you also connect to the remote `singit` server. The local process can sign payments
from the wallet you give it; keep that environment restricted to trusted processes.

**Release prerequisite:** this package requires `@singitai/sdk ^0.1.2`, which is not yet
published. `PersistentDailyLimiter`, `readSpend` and `spendSummary` currently exist only
on singit-js main. Release that SDK version before publishing this package. The installed
development SDK is a local copy/link; CI checks out singit-js main until the release.
No package was published as part of this work.

## Environment

| Variable | Default / accepted values |
|---|---|
| `SINGIT_NETWORK` | `base` (default) or `solana` |
| `SINGIT_EVM_PRIVATE_KEY` | Base: valid `0x` plus 64 hex digits; no default |
| `SINGIT_SOLANA_PRIVATE_KEY` | Solana: base58 64-byte secret key, or JSON array of 64 bytes (solana-keygen format) |
| `SINGIT_MAX_PER_CALL_USD` | `0.01`; finite non-negative USD amount |
| `SINGIT_MAX_PER_DAY_USD` | `0.10`; finite non-negative USD amount |
| `SINGIT_HOME` | `~/.singit`; local spend directory, file `spend.jsonl` |
| `SINGIT_BASE_URL` | `https://ask.singitai.app`; HTTP(S), no credentials/query/fragment |
| `SINGIT_RPC_URL` | Optional Solana RPC URL; otherwise SDK network default |

There is no payee override: network, USDC asset and SingIt payee are pinned by the SDK.
A missing wallet or invalid payment configuration does not prevent startup: `chat`
returns an actionable error, while free chat and local inspection remain available.
A bad base URL naturally also prevents free chat from reaching its endpoint.
`--help` and `--version` print and exit; `--check` prints a shortened, redacted config
summary and exits 0 for a usable wallet/config, or 2 for missing wallet/invalid config.
No secret is accepted as a CLI argument.

## Tools and limits

| Tool | Behavior |
|---|---|
| `chat_free` | Plain unpaid POST; never invokes the signing client. Prompt or text messages, default `free/deepseek-v4.1-flash`; adds `free/` if missing. 1–400 tokens (default 400). Returns answer and server billing/remaining info. 429 includes retry/next-window information; 402 is an error, never a payment attempt. |
| `chat` | Prompt or text messages; optional system with prompt only. Model without `free/`, omitted for SingIt's default. 1–8192 tokens (default 1024). SDK `upto` on `/v1/chat/completions`. Returns answer, model, usage, atomic/USDC charge, network, merchant transaction reference and remaining local allowance. |
| `get_limits` | No network. Wallet shortened to first 6/last 4 characters, caps, today's spend and remaining, unresolved count, log path. |
| `get_receipts` | No network. Last 1–50 payments (default 10), newest first, scoped to this wallet/network. Settled/released/unresolved, ceiling and spend in USDC, transaction reference, resource path; no full payer addresses. |

| Limit | Default | Enforcement |
|---|---|---|
| Per call | $0.01 | Offered worst-case charge checked before signing or reserving |
| Per UTC day | $0.10 | Settled amounts plus unresolved ceilings in persistent SDK log; checked before signing |

A refusal may send an **unpaid probe** to obtain the merchant's offer. It sends no
payment signature and adds no reservation when over a limit. A signed payment is sent
once, never automatically repeated. Merchant refusal (402) releases the reservation;
uncertain outcomes remain counted at their ceiling. Processes sharing the same local
log preserve caps across restarts and coordinate reservations with the SDK's lock.
Use local POSIX storage; editing/deleting the log or using another machine bypasses it.
The SDK log contains full public payer addresses; tool results shorten or omit them.
It contains no private keys, prompts, answers or signed payment payloads.

This is a LOCAL client-side limit on this machine for the wallet given to this process:
it is not on-chain enforcement and does not protect other wallets or agents.

## Local and remote comparison

| | Local stdio | Remote keyed server |
|---|---|---|
| Authentication/payment | Own wallet key in local environment; no login/API key | SingIt API key |
| Limits | Client-side bookkeeping for the supplied wallet and processes sharing this log on this machine | SingIt's server checks limits for calls made with that key |
| On-chain owner limits | None provided by this local mode | Base AgentAllowance contract, only for the remote key path |
| Tools | Four chat/bookkeeping tools | Existing remote tool catalog, unchanged |
| Installation | Node process/package | URL connection; nothing to install locally |

`chat` accurately advertises `readOnlyHint:false` and `destructiveHint:true` because it
spends money. This differs from the current remote snapshot's read-only chat annotation.
Other tools advertise read-only behavior; free chat still sends its conversation upstream.
All diagnostics go to stderr: one startup summary and one message per error class.
The stdout protocol and tool text pass through a central secret redactor. Generic
key-shaped strings may also be redacted, including some transaction hashes.

## Validation and limitations

Run `npm test` here. Tests generate throwaway keys in memory and use mock merchants and
Solana RPC on `127.0.0.1`; they never fund wallets, broadcast transactions or pay anything.
No live SingIt call or real paid call was made. Merchant receipts are not independent
on-chain confirmation. Loopback integration execution is blocked in the implementation
sandbox (`listen EPERM`); the suite remains enabled for CI/a host permitting loopback.
Unit and in-process SDK tests cover configuration, redaction and mocked payment flows.
See the implementation notes for exact execution results. Contact: contact@singitai.app.
