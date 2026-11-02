---
description: Show what your SingIt key may still spend today (daily and per-request limits, spent, remaining, expiry)
allowed-tools: mcp__plugin_singit_singit__get_limits
---

Call the `get_limits` tool of the SingIt MCP server (it is free and read-only) and show me, in a short table:

- the key's state, name and expiry;
- its daily limit, what is spent today, what is held by answers still running, and what remains today, in USDC;
- its per-request limit and its scopes;
- when the day resets (00:00 UTC);
- the account's balance and, if the result has one, the allowance limiter's state.

If the tool says it needs an API key, tell me that no key is configured: I need to create an MCP key with limits in the SingIt app (https://app.singitai.app/app/, Settings -> API keys), export it as `SINGIT_API_KEY` before starting Claude Code, and restart. The guide is https://singitai.app/docs/mcp-key/ . Never ask me to paste the key into this chat.

Say plainly that these limits are checked by SingIt's server for calls made with this key to SingIt's MCP and /v1; they do not limit anything I spend elsewhere. Do not call any paid tool.
