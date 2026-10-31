# Connecting clients

Endpoint: `https://app.singitai.app/mcp` (Streamable HTTP, JSON responses). Put your key in the
`SINGIT_API_KEY` environment variable of the process that launches the client. Free tools and
`tools/list` also work without it.

Commands and snippets below follow each client's own documentation as of 31 October 2026. The
Codex command was run against codex-cli 0.163.0 on 31 October 2026; the others were not run. Check your client's current docs if one fails.

## Claude Code

```bash
claude mcp add --transport http singit https://app.singitai.app/mcp --header 'Authorization: Bearer ${SINGIT_API_KEY}'
claude mcp list
claude mcp get singit
```

Single quotes keep ${SINGIT_API_KEY} as a reference so the key is not written into Claude Code's configuration.

For a shared project, commit this `.mcp.json` entry. Claude Code needs `type: http` for a URL entry and
expands `${VAR}` in headers:

```json
{
  "mcpServers": {
    "singit": {
      "type": "http",
      "url": "https://app.singitai.app/mcp",
      "headers": { "Authorization": "Bearer ${SINGIT_API_KEY}" }
    }
  }
}
```

## Cursor

Edit `~/.cursor/mcp.json`, then restart Cursor:

```json
{
  "mcpServers": {
    "singit": {
      "url": "https://app.singitai.app/mcp",
      "headers": { "Authorization": "Bearer ${env:SINGIT_API_KEY}" }
    }
  }
}
```

## Codex

```bash
codex mcp add singit --url https://app.singitai.app/mcp --bearer-token-env-var SINGIT_API_KEY
```

This writes the following to `config.toml`:

```toml
[mcp_servers.singit]
url = "https://app.singitai.app/mcp"
bearer_token_env_var = "SINGIT_API_KEY"
```

## Windsurf (Devin Desktop)

Windsurf was renamed Devin Desktop. Use `mcp_config.json`, usually `~/.config/devin/mcp_config.json`
on macOS and Linux and `%APPDATA%\devin\mcp_config.json` on Windows (open the config from the client
to find the active file):

```json
{ "mcpServers": { "singit": { "serverUrl": "https://app.singitai.app/mcp", "headers": { "Authorization": "Bearer ${env:SINGIT_API_KEY}" } } } }
```

## Any other client

Use the generic block from [`.mcp.json`](../.mcp.json). Clients that only support a plain API-key
header can send `x-api-key: <key>` instead of `Authorization: Bearer <key>`. If your client does not
expand environment variables in headers, the unexpanded text is treated as "no key", so only the free
tools will work.
