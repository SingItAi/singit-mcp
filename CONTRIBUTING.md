# Contributing to singit-mcp

Thanks for taking a look. Fixes to the docs, client instructions and checks are welcome.

## Scope

This repository documents and checks the SingIt remote MCP server. The server code lives in the
[main repository](https://github.com/SingItAi/SingItAI) under `sign402-gateway`; changes to how the
server behaves go there.

## Set up

Node.js 20 or newer. There are no dependencies.

```bash
npm test             # offline checks
npm run check:live   # compares the live server with tools.json (free, needs no key)
```

## When the server's tools change

```bash
npm run check:live -- --update   # rewrite tools.json from the live server
npm run docs                     # regenerate docs/tools.md
```

Then update the group table in `README.md` and the entry for any new tool in `scripts/lib.mjs`. The
offline test fails until all of that agrees.

## Pull requests

- Keep each pull request to one change, and say how you checked it.
- Write documentation in English. Say what you did **not** check.
- Never put a real API key, private key or wallet address in a file, a test or a pull request.
- Security problems: do not open a public issue. See [SECURITY.md](SECURITY.md).
- Do not rewrite history on a branch someone has already reviewed.
