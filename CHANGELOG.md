# Changelog

This repository was split from [SingItAi/SingItAI](https://github.com/SingItAi/SingItAI) with its
history for `server.json`, `llms-install.md` and `.mcp.json` kept. It has no releases of its own: the
server version is the one the live server reports (`serverInfo.version`).

## Unreleased

- README, client guide, tool reference generated from a `tools.json` snapshot, and a free live check.
- CI, issue and pull request templates, security policy, Dependabot.
- `server.json` now points at this repository. The MCP Registry only picks that up after a new
  version of the manifest is published.
