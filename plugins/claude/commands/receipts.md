---
description: "List the latest charges made with your SingIt key (time, model, USDC charged, tokens)"
argument-hint: "[how many, 1-50, default 10]"
allowed-tools: mcp__plugin_singit_singit__get_receipts
---

Call the `get_receipts` tool of the SingIt MCP server (it is free and read-only) with `kind` set to `charge`. If I gave a number in "$ARGUMENTS" (1 to 50), pass it as `limit`; otherwise use the default.

Show the result as a short table, newest first: time (UTC), model, USDC charged, input and output tokens. Add the total charged across the rows shown. If the result has a `next` value, say there are older receipts and offer to fetch them (pass it as `before`).

If the tool says it needs an API key, tell me that no key is configured: I need to create an MCP key with limits in the SingIt app (https://app.singitai.app/app/, Settings -> API keys), export it as `SINGIT_API_KEY` before starting Claude Code, and restart. Never ask me to paste the key into this chat.

These are the charges for this key only. Do not call any paid tool.
