import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.mjs';
import { redactValue } from './redact.mjs';
import { configSummary } from './config.mjs';
export async function startServer(c, version, log) {
  const server = new McpServer({ name: 'singit-local', title: 'SingIt (local wallet)', version });
  registerTools(server, c, log);
  const transport = new StdioServerTransport();
  const send = transport.send.bind(transport);
  transport.send = message => send(redactValue(message, c.redact));
  let closing;
  const close = () => closing ??= server.close().finally(() => { process.stdin.pause(); });
  process.once('SIGINT', close); process.once('SIGTERM', close); process.stdin.once('end', close);
  await server.connect(transport);
  log('startup', JSON.stringify({ ...configSummary(c), version }));
  return server;
}
