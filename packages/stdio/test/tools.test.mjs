// Additional in-process coverage, runnable even where loopback listeners are forbidden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NETWORKS } from '@singitai/sdk';
import { loadConfig } from '../src/config.mjs';
import { registerTools } from '../src/tools.mjs';
import { fixture, text } from './helpers.mjs';
const encode = o => Buffer.from(JSON.stringify(o)).toString('base64');
test('real SDK Base signing, persistence, daily restart refusal, per-call refusal and release with mocked HTTP transport', async t => {
  const f = await fixture(t);
  const c = await loadConfig({ ...f.env, SINGIT_EVM_PRIVATE_KEY: f.key, SINGIT_MAX_PER_DAY_USD: '0.01' });
  let signed = 0, probes = 0, amount = '8000', refuse = false;
  const pin = NETWORKS.base;
  const payloads = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, `${f.env.SINGIT_BASE_URL}/v1/chat/completions`);
    const header = new Headers(init.headers).get('payment-signature');
    if (!header) {
      probes++;
      return new Response('{}', { status: 402, headers: { 'payment-required': encode({ x402Version: 2, resource: { url }, accepts: [{ scheme: 'upto', network: pin.caip, asset: pin.asset, payTo: pin.payTo, amount, maxTimeoutSeconds: 120, extra: { facilitatorAddress: pin.payTo, assetTransferMethod: 'permit2' } }] }) } });
    }
    signed++;
    const p = JSON.parse(Buffer.from(header, 'base64')); payloads.push(p);
    if (refuse) return new Response('{}', { status: 402 });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'answer' } }], billing: { totalAtomic: '4000' }, model: 'mock' }), { headers: { 'payment-response': encode({ success: true, network: pin.caip, payer: p.payload.permit2Authorization.from, transaction: 'mock-tx' }) } });
  });
  const make = c => {
    const calls = new Map(); registerTools({ registerTool: (name, meta, call) => calls.set(name, call) }, c, () => {});
    return async (name, args = {}) => { const r = await calls.get(name)({ max_tokens: 1024, limit: 10, ...args }); f.outputs.push(JSON.stringify(r)); await f.check(); return r; };
  };
  let call = make(c);
  assert.ok(!(await call('chat', { prompt: 'hello' })).isError);
  assert.equal(signed, 1); assert.equal(probes, 1);
  assert.equal(payloads[0].accepted.payTo, pin.payTo); assert.match(payloads[0].payload.signature, /^0x/);
  const originalLog = await f.check(); assert.equal(originalLog.split('\n').filter(Boolean).length, 2);
  assert.equal(JSON.parse(text(await call('get_limits'))).remainingTodayUsd, '0.006000');
  assert.equal(JSON.parse(text(await call('get_receipts')))[0].status, 'settled');
  assert.equal((await call('chat', { prompt: 'again' })).isError, true);
  call = make(await loadConfig({ ...f.env, SINGIT_EVM_PRIVATE_KEY: f.key, SINGIT_MAX_PER_DAY_USD: '0.01' }));
  assert.equal((await call('chat', { prompt: 'restart' })).isError, true);
  assert.equal(signed, 1); assert.equal(await f.check(), originalLog);
  amount = '10001'; assert.equal((await call('chat', { prompt: 'over call' })).isError, true); assert.equal(await f.check(), originalLog);
  amount = '5000'; refuse = true; assert.equal((await call('chat', { prompt: 'refusal' })).isError, true);
  assert.equal(signed, 2); assert.equal(JSON.parse(text(await call('get_receipts')))[0].status, 'released');
  assert.equal(JSON.parse(text(await call('get_limits'))).spentTodayUsd, '0.004000'); await f.check();
});
test('free uses plain fetch and redacts error echoes; invalid config never probes paid chat', async t => {
  const f = await fixture(t);
  const c = await loadConfig({ ...f.env, SINGIT_EVM_PRIVATE_KEY: f.key, SINGIT_MAX_PER_DAY_USD: '-1' });
  const calls = new Map(); registerTools({ registerTool: (name, meta, call) => calls.set(name, call) }, c, () => {});
  let status = 200, requests = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests++; assert.equal(new Headers(init.headers).has('payment-signature'), false);
    assert.equal(JSON.parse(init.body).model, 'free/model');
    return new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content: f.key } }], billing: { remainingToday: 3 } }) : f.key, { status, headers: { 'retry-after': '60' } });
  });
  const call = async (name, args = {}) => { const r = await calls.get(name)({ prompt: 'hello', model: 'model', max_tokens: 100, ...args }); f.outputs.push(JSON.stringify(r)); await f.check(); return r; };
  assert.equal((await call('chat')).isError, true); assert.equal(requests, 0);
  for (const code of [200, 429, 402, 500]) { status = code; const r = await call('chat_free'); assert.equal(!!r.isError, code !== 200); assert.match(text(r), /REDACTED/); }
  await call('get_limits'); await call('get_receipts', { limit: 10 }); await f.check();
});

test('Solana tools sign with parsed base58 and JSON keys using in-process mock RPC; caps refuse before signing', async t => {
  const { throwawaySolana } = await import('./keys.mjs');
  const { base58Encode } = await import('../src/redact.mjs');
  const { encodings } = await import('./helpers.mjs');
  const { createKeyPairSignerFromBytes, getTransactionDecoder, verifySignature } = await import('@solana/kit');
  const bytes = throwawaySolana(), signer = await createKeyPairSignerFromBytes(bytes);
  const pin = NETWORKS.solana, feePayer = (await createKeyPairSignerFromBytes(throwawaySolana())).address;
  const f = await fixture(t); f.secrets.push(...encodings(bytes));
  const rpcCalls = []; let signatures = 0, amount = '3000', payment;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const body = JSON.parse(init.body);
    if (body.jsonrpc === '2.0') {
      rpcCalls.push(body.method);
      let result;
      if (body.method === 'getAccountInfo') {
        assert.equal(body.params[0], pin.asset);
        const mint = Buffer.alloc(82); mint[44] = 6; mint[45] = 1;
        result = { context: { slot: 123456789 }, value: { data: [mint.toString('base64'), 'base64'], executable: false, lamports: 1461600, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', rentEpoch: 0, space: 82 } };
      } else if (body.method === 'getLatestBlockhash') result = { context: { slot: 123456789 }, value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 123456939 } };
      else if (body.method === 'getSlot') result = 123456789;
      else throw Error('Unexpected RPC method');
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { headers: { 'content-type': 'application/json' } });
    }
    const header = new Headers(init.headers).get('payment-signature');
    if (!header) return new Response('{}', { status: 402, headers: { 'payment-required': encode({ x402Version: 2, resource: { url: String(input) }, accepts: [{ scheme: 'upto', network: pin.caip, asset: pin.asset, payTo: pin.payTo, amount, maxTimeoutSeconds: 120, extra: { feePayer, receiverAuthorizer: pin.payTo, withdrawDelay: 300, billing: { maxChargeAtomic: amount } } }] }) } });
    signatures++; payment = JSON.parse(Buffer.from(header, 'base64'));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Solana answer' } }], billing: { totalAtomic: '1500' } }), { headers: { 'payment-response': encode({ success: true, network: pin.caip, payer: signer.address, transaction: 'mock-sol-tx' }) } });
  });
  for (const key of [base58Encode(bytes), JSON.stringify([...bytes])]) {
    const c = await loadConfig({ ...f.env, SINGIT_NETWORK: 'solana', SINGIT_SOLANA_PRIVATE_KEY: key, SINGIT_MAX_PER_CALL_USD: '0.003', SINGIT_MAX_PER_DAY_USD: '0.01' });
    const calls = new Map(); registerTools({ registerTool: (name, meta, call) => calls.set(name, call) }, c, () => {});
    const call = async (name, args = {}) => { const r = await calls.get(name)({ prompt: 'hello', max_tokens: 100, limit: 10, ...args }); f.outputs.push(JSON.stringify(r)); await f.check(); return r; };
    assert.ok(!(await call('chat')).isError);
    const tx = getTransactionDecoder().decode(Buffer.from(payment.payload.openTransaction, 'base64'));
    assert.equal(await verifySignature(signer.keyPair.publicKey, tx.signatures[signer.address], tx.messageBytes), true);
    const limits = JSON.parse(text(await call('get_limits'))); assert.equal(limits.payer, signer.address.slice(0, 6) + '…' + signer.address.slice(-4));
    amount = '3001'; const before = rpcCalls.length, signedBefore = signatures, log = await f.check();
    assert.equal((await call('chat')).isError, true); assert.equal(rpcCalls.length, before); assert.equal(signatures, signedBefore); assert.equal(await f.check(), log); amount = '3000';
  }
  assert.equal(signatures, 2); assert.deepEqual(rpcCalls, Array(2).fill(['getAccountInfo', 'getLatestBlockhash', 'getSlot']).flat());
  // Same wallet and log, now a lower daily cap: no new RPC or signature or reserve.
  const c = await loadConfig({ ...f.env, SINGIT_NETWORK: 'solana', SINGIT_SOLANA_PRIVATE_KEY: base58Encode(bytes), SINGIT_MAX_PER_DAY_USD: '0.004' });
  const calls = new Map(); registerTools({ registerTool: (name, meta, call) => calls.set(name, call) }, c, () => {});
  const log = await f.check(), r = await calls.get('chat')({ prompt: 'daily refusal', max_tokens: 100 }); f.outputs.push(JSON.stringify(r)); assert.equal(r.isError, true);
  assert.equal(signatures, 2); assert.equal(rpcCalls.length, 6); assert.equal(await f.check(), log);
});
