---
name: singit-limits
description: "Show what the user's SingIt key may still spend today: daily and per-request limits, spent, remaining, expiry. Use when the user asks about their SingIt limits, budget or remaining spend."
---

Call the `get_limits` tool of the SingIt MCP server (free and read-only) and show, in a short table:

- the key's state, name and expiry;
- its daily limit, what is spent today, what is held by answers still running, and what remains today, in USDC;
- its per-request limit and its scopes;
- when the day resets (00:00 UTC);
- the account's balance and, if present, the allowance limiter's state.

If the tool says it needs an API key, tell the user that no key is configured: they need to create an MCP key with limits in the SingIt app (https://app.singitai.app/app/, Settings -> API keys), export it as `SINGIT_API_KEY` before starting Codex, and restart. The guide is https://singitai.app/docs/mcp-key/ . Never ask them to paste the key into the chat.

Say plainly that these limits are checked by SingIt's server for calls made with this key to SingIt's MCP and /v1; they do not limit anything the user spends elsewhere. Do not call any paid tool.
