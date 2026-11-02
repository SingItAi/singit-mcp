---
name: singit-receipts
description: "List the latest charges made with the user's SingIt key (time, model, USDC charged, tokens). Use when the user asks what they spent with SingIt or wants their SingIt receipts."
---

Call the `get_receipts` tool of the SingIt MCP server (free and read-only) with `kind` set to `charge`. If the user gave a number from 1 to 50, pass it as `limit`; otherwise use the default.

Show the result as a short table, newest first: time (UTC), model, USDC charged, input and output tokens, and the total charged across the rows shown. If the result has a `next` value, say older receipts exist and offer to fetch them (pass it as `before`).

If the SingIt tools are not available (Codex does not start the server when SINGIT_API_KEY is unset) or the tool says it needs an API key, tell the user that no key is configured: they need to create an MCP key with limits in the SingIt app (https://app.singitai.app/app/, Settings -> API keys), export it as `SINGIT_API_KEY` before starting Codex, and restart. Never ask them to paste the key into the chat.

These are the charges for this key only. Do not call any paid tool.
