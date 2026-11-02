# Changelog

This repository was split from [SingItAi/SingItAI](https://github.com/SingItAi/SingItAI) with its
history for `server.json`, `llms-install.md` and `.mcp.json` kept. It has no releases of its own: the
server version is the one the live server reports (`serverInfo.version`).

## Unreleased

- README points to the website's tools reference (https://singitai.app/docs/mcp-tools/); the full table stays in docs/tools.md as an offline copy.
- `server.json` description now mentions the owner-set daily limits (98 characters, under the Registry's 100 limit). It reaches the MCP Registry only when a new manifest version is published, which also needs the server's version string bumped in the main repository.

- Single-quote Claude Code install headers to keep the API key reference out of shell expansion and avoid storing the literal key in its configuration.

- Lead with owner-set MCP key limits and rewrite the agent install guide with
  suggested terms, client configuration, free verification and paid-call consent.

- `server.json` version 0.1.4: repository moved to SingItAi, the manifest links to this repository.
  The live server may still report 0.1.3 until the next server deploy; the offline test only requires
  the manifest not to be older than the snapshot.
- README, client guide, tool reference generated from a `tools.json` snapshot, and a free live check.
- CI, issue and pull request templates, security policy, Dependabot.
- `server.json` now points at this repository. The MCP Registry only picks that up after a new
  version of the manifest is published.
