import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { generatePrivateKey } from 'viem/accounts';
import { NETWORKS } from '@singitai/sdk';
import { base58Encode } from '../src/redact.mjs';
export const bin = fileURLToPath(new URL('../bin/singit-mcp.js', import.meta.url));
export function encodings(bytes) { const hex = Buffer.from(bytes).toString('hex'); return [hex, '0x' + hex, hex.toUpperCase(), '0x' + hex.toUpperCase(), base58Encode(bytes), Buffer.from(bytes).toString('base64'), JSON.stringify([...bytes]), JSON.stringify([...bytes], null, 2), '[' + [...bytes].join(', ') + ']']; }
export function assertNoSecrets(values, secrets) {
  for (const secret of secrets.filter(Boolean)) for (const value of values) assert.ok(!String(value).includes(secret), 'secret leaked (value suppressed)');
}
export async function fixture(t, extra = {}, existingHome) {
  const home = existingHome ?? await mkdtemp(path.join(os.tmpdir(), 'singit-mcp-'));
  const key = generatePrivateKey();
  const env = { PATH: process.env.PATH, SINGIT_HOME: home, SINGIT_BASE_URL: 'http://127.0.0.1:1', SINGIT_RPC_URL: 'http://127.0.0.1:1', ...extra };
  const secrets = [...encodings(Buffer.from(key.slice(2), 'hex'))];
  for (const name of ['SINGIT_EVM_PRIVATE_KEY', 'SINGIT_SOLANA_PRIVATE_KEY']) if (env[name]) secrets.push(env[name]);
  const outputs = [], sessions = [];
  const check = async () => {
    let spend = ''; try { spend = await readFile(path.join(home, 'spend.jsonl'), 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    assertNoSecrets([...outputs, spend, ...sessions.flatMap(s => [s.stdout, s.stderr])], secrets);
    return spend;
  };
  t.after(async () => {
    for (const s of sessions) await s.client.close();
    try { await check(); } finally { if (!existingHome) await rm(home, { recursive: true, force: true }); }
  });
  return { home, key, env, secrets, outputs, check, async connect(overrides = {}) {
    const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', fileURLToPath(new URL('./loopback-only.mjs', import.meta.url)), bin], env: { ...env, ...overrides }, stderr: 'pipe' });
    const client = new Client({ name: 'offline-test', version: '1' });
    const session = { client, transport, stdout: '', stderr: '' }; sessions.push(session);
    transport.stderr.on('data', b => { session.stderr += b; });
    const start = transport.start.bind(transport);
    transport.start = async () => { await start(); transport._process.stdout.on('data', b => { session.stdout += b; }); };
    await client.connect(transport);
    // Observe the real child's raw protocol stream as well as decoded tool results.
    for (const name of ['SINGIT_EVM_PRIVATE_KEY', 'SINGIT_SOLANA_PRIVATE_KEY']) if (overrides[name]) secrets.push(overrides[name]);
    return { ...session, call: async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); outputs.push(JSON.stringify(r)); await check(); return r; } };
  } };
}
const encode = v => Buffer.from(JSON.stringify(v)).toString('base64');
export async function merchant(t, options = {}) {
  const state = { requests: [], signatures: [], mode: 'normal', amount: '8000', billed: '4000', ...options };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const b of req) chunks.push(b);
    const body = JSON.parse(Buffer.concat(chunks));
    state.requests.push(body);
    const signature = req.headers['payment-signature'];
    if (signature) state.signatures.push(JSON.parse(Buffer.from(signature, 'base64')));
    res.setHeader('content-type', 'application/json');
    if (state.mode === 'echo') { res.writeHead(500).end(state.echo); return; }
    if (body.model?.startsWith('free/')) {
      if (state.mode === '429') { res.setHeader('retry-after', '60'); res.writeHead(429).end(JSON.stringify({ resetsAt: 'next-window' })); return; }
      if (state.mode === '402') { res.writeHead(402).end('Payment required'); return; }
      res.end(JSON.stringify({ choices: [{ message: { content: 'Free answer' } }], billing: { remainingToday: 3, resetsAt: 'tomorrow' } })); return;
    }
    const pin = NETWORKS[state.network ?? 'base'];
    if (!signature) {
      const offer = { scheme: 'upto', network: pin.caip, asset: pin.asset, payTo: pin.payTo, amount: state.amount, maxTimeoutSeconds: 120,
        extra: pin.family === 'evm' ? { facilitatorAddress: pin.payTo, assetTransferMethod: 'permit2', name: 'USD Coin', version: '2' } : { feePayer: state.feePayer, receiverAuthorizer: pin.payTo, withdrawDelay: 300, billing: { maxChargeAtomic: state.amount } } };
      res.setHeader('payment-required', encode({ x402Version: 2, resource: { url: `${state.url}/v1/chat/completions` }, accepts: [offer] }));
      res.writeHead(402).end('{}'); return;
    }
    if (state.mode === 'refuse') { res.writeHead(402).end('{}'); return; }
    const payment = state.signatures.at(-1);
    const payer = payment.payload.permit2Authorization?.from ?? payment.payload.from;
    res.setHeader('payment-response', encode({ success: true, network: pin.caip, payer, transaction: state.tx ?? 'mock-transaction' }));
    res.end(JSON.stringify({ model: 'mock-model', choices: [{ message: { content: 'Paid answer' } }], usage: { total_tokens: 12 }, billing: { totalAtomic: state.billed } }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  state.url = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  return state;
}
export const text = r => r.content.map(c => c.text ?? '').join('\n');
