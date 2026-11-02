---
name: price-before-paid-call
description: Use before calling a paid SingIt tool (chat, web_search, read_page or the market data tools), so the user hears the cost and the key's remaining limit first.
---

SingIt's paid tools charge the user's key in USDC on every call, and repeating a call charges again.

Before the first paid SingIt call in a task, and before any repeat or large batch:

1. Tell the user in one line which tool you will call and roughly what it costs. For `chat`, read the model's price with `list_models` and say it; do not guess a price. For `chat_free` there is no charge: prefer it for a short answer when a free model is enough.
2. Call `get_limits` and say what remains today under the key's daily limit and its per-request limit.
3. If the call would not fit, or the user did not ask for a paid call, do not make it: say so and offer `chat_free` or a smaller request.

This is guidance for you. The key's daily and per-request limits are checked by SingIt's server for calls made with that key to SingIt's MCP and /v1: a call over a limit is refused before anything is charged. They do not limit anything the user spends elsewhere. If a limit refuses a call, stop and report it; do not try to get around it.
