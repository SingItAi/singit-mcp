import test from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadConfig } from '../src/config.mjs';
import { registerTools } from '../src/tools.mjs';
import { fixture, text } from './helpers.mjs';
test('MCP SDK protocol/schema checks without sockets or child pipes', async t => {
  const f = await fixture(t), c = await loadConfig(f.env);
  const server = new McpServer({ name: 'singit-local', title: 'SingIt (local wallet)', version: '0.1.0' });
  registerTools(server, c, () => {});
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(a); await client.connect(b);
  const tools = (await client.listTools()).tools; f.outputs.push(JSON.stringify(tools));
  assert.deepEqual(tools.map(t => t.name), ['chat_free', 'chat', 'get_limits', 'get_receipts']);
  assert.equal(client.getServerVersion().name, 'singit-local');
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, tool.name !== 'chat');
    assert.equal(tool.annotations.destructiveHint, tool.name === 'chat');
    assert.equal(tool.inputSchema.type, 'object');
  }
  for (const [name, args] of [['chat', { prompt: 'hi' }], ['chat', { prompt: 'hi', messages: [{ role: 'user', content: 'hi' }] }], ['chat', { messages: [{ role: 'user', content: 'hi' }], system: 'hi' }], ['chat', { prompt: 'hi', max_tokens: 8193 }], ['chat_free', { prompt: 'hi', max_tokens: 401 }], ['get_receipts', { limit: 51 }]]) {
    const r = await client.callTool({ name, arguments: args }); f.outputs.push(JSON.stringify(r)); assert.equal(r.isError, true);
  }
  const limits = await client.callTool({ name: 'get_limits', arguments: {} }); f.outputs.push(JSON.stringify(limits)); assert.match(text(limits), /no wallet configured/);
  const receipts = await client.callTool({ name: 'get_receipts', arguments: {} }); f.outputs.push(JSON.stringify(receipts)); assert.equal(text(receipts), '[]');
  await f.check();
});
