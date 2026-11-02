# Changelog

This repository was split from [SingItAi/SingItAI](https://github.com/SingItAi/SingItAI) with its
history for `server.json`, `llms-install.md` and `.mcp.json` kept. It has no releases of its own: the
server version is the one the live server reports (`serverInfo.version`).

## Unreleased

- Document `chat_free` and `chat`, bringing the tool reference to 18 tools.
- Add the Claude Code 60-second guide.
- Update `server.json` to 0.1.5 with the description “Chat with AI models, web search, page reading and market data, inside owner-set key limits (USDC).” (98 characters). The old description omitted model chat.
- Not published to the MCP Registry: publishing 0.1.5 needs the owner's OK, the gateway restarted with the new code first, and mcp-publisher.
- The `tools.json` snapshot comes from the gateway source until deployment; refresh with `npm run check:live -- --update` afterward. The scheduled live check stays red until the gateway serves 0.1.5.
- The website's Claude Code guide goes live with the companion PR in SingItAi/SingItAI.

- README points to the website's tools reference (https://singitai.app/docs/mcp-tools/); the full table stays in docs/tools.md as an offline copy.


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
