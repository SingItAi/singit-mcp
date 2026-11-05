import { z } from 'zod';
import { SingIt, readSpend, spendSummary } from '@singitai/sdk';
import { shorten } from './config.mjs';
export const LIMIT_NOTICE = 'This is a LOCAL client-side limit on this machine for the wallet given to this process: it is not on-chain enforcement and does not protect other wallets or agents.';
const usd = n => (Number(n) / 1e6).toFixed(6);
const message = z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() });
const inputs = max => ({ prompt: z.string().min(1).max(max).optional(), messages: z.array(message).min(1).optional(), model: z.string().min(1).optional() });
export function registerTools(server, c, log) {
  let sdk;
  const result = (text, isError = false) => ({ content: [{ type: 'text', text: c.redact(typeof text === 'string' ? text : JSON.stringify(text)) }], ...(isError ? { isError: true } : {}) });
  const scoped = () => readSpend(c.file).payments.filter(p => p.network === c.network && p.payer === c.payer);
  const limits = () => {
    const summary = spendSummary({ file: c.file, days: 1 }).days.find(p => p.network === c.network && p.payer === c.payer);
    const spent = BigInt(summary?.spentAtomic ?? '0');
    const remaining = c.maxPerDayUsd === null ? null : BigInt(Math.round(c.maxPerDayUsd * 1e6)) - spent;
    return { network: c.network, payer: shorten(c.payer), maxPerCallUsd: c.maxPerCallUsd, maxPerDayUsd: c.maxPerDayUsd,
      spentTodayUsd: usd(spent), remainingTodayUsd: remaining === null ? null : usd(remaining > 0n ? remaining : 0n),
      unresolvedPayments: scoped().filter(p => p.status === 'unresolved').length, spendLog: c.file, configErrors: c.errors, notice: LIMIT_NOTICE };
  };
  const wrap = fn => async args => {
    try { return await fn(args); }
    catch (e) {
      // Diagnostics contain only the error class, never upstream bodies or user text.
      const kind = e?.name === 'SingItPaymentError' || e?.constructor?.name === 'SingItPaymentError' ? 'payment' : 'tool';
      log(kind, 'Call refused or failed; see the tool result.');
      return result(e instanceof Error ? e.message : 'Call failed; check local configuration and try again.', true);
    }
  };
  const conversation = a => {
    if ((a.prompt !== undefined) === (a.messages !== undefined)) throw Error('Send exactly one of prompt or messages.');
    if (a.system !== undefined && a.prompt === undefined) throw Error('system is only supported with prompt.');
    return a.messages ?? [...(a.system === undefined ? [] : [{ role: 'system', content: a.system }]), { role: 'user', content: a.prompt }];
  };
  const register = (name, description, inputSchema, fn, local = false) => server.registerTool(name, {
    title: name === 'chat' ? 'Chat (local wallet)' : `${name} (local)`, description, inputSchema,
    annotations: { readOnlyHint: name !== 'chat', destructiveHint: name === 'chat', idempotentHint: local, openWorldHint: !local },
  }, wrap(fn));
  register('chat_free', 'LOCAL free model answers, no wallet or key needed. Short answers (400 tokens), with a shared daily allowance. Cannot sign payments. Drop free/ and use chat to pay from your own wallet.',
    { ...inputs(4000), max_tokens: z.number().int().min(1).max(400).default(400) }, async a => {
      const model = a.model ?? 'free/deepseek-v4.1-flash';
      const response = await fetch(`${c.baseUrl}/v1/chat/completions`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: conversation(a), model: model.startsWith('free/') ? model : `free/${model}`, max_tokens: a.max_tokens, stream: false }) });
      if (response.status !== 200) {
        const body = await response.text();
        throw Error(`Free chat HTTP ${response.status}. Nothing was signed. ${response.status === 429 ? `Retry-After: ${response.headers.get('retry-after') ?? 'not supplied'}; next window: ` : ''}${body}`);
      }
      const data = await response.json();
      return result(`${data.choices?.[0]?.message?.content ?? ''}\n${JSON.stringify({ billing: data.billing, remainingToday: data.remainingToday, resetsAt: data.resetsAt })}\nDrop free/ from the model and use chat to pay from your own wallet.`);
    });
  register('chat', 'LOCAL paid chat from your own wallet in USDC, with per-call and persistent daily caps checked before signing. Spends money. No app login or SingIt API key. Use get_limits and get_receipts for local bookkeeping.',
    { ...inputs(24000), system: z.string().optional(), max_tokens: z.number().int().min(1).max(8192).default(1024) }, async a => {
      const messages = conversation(a);
      if (a.model?.startsWith('free/')) throw Error('Use chat_free for a free/ model, or remove the free/ prefix.');
      if (c.errors.length) throw Error(`Configuration error: ${c.errors.join(' ')}`);
      if (!c.payer) throw Error(`No wallet configured. Set ${c.keyName} in the environment. This package does not create wallets.`);
      sdk ??= new SingIt({ network: c.network, evmPrivateKey: c.evmPrivateKey, solanaSigner: c.solanaSigner,
        maxPerCallUsd: c.maxPerCallUsd, maxPerDayUsd: c.maxPerDayUsd, baseUrl: c.baseUrl, rpcUrl: c.rpcUrl, spendLog: c.file,
        fetchImpl: async (...args) => {
          const response = await fetch(...args);
          // The merchant's transaction reference is persisted by the SDK. Redact it before that write.
          const header = response.headers.get('payment-response');
          if (!header) return response;
          try {
            const receipt = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
            if (typeof receipt.transaction === 'string') receipt.transaction = c.redact(receipt.transaction);
            const headers = new Headers(response.headers);
            headers.set('payment-response', Buffer.from(JSON.stringify(receipt)).toString('base64'));
            return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
          } catch { return response; }
        } });
      const data = await sdk.chat({ messages, model: a.model, max_tokens: a.max_tokens, scheme: 'upto', route: 'completions' });
      return result(`${data.choices?.[0]?.message?.content ?? ''}\n${JSON.stringify({ model: data.model, usage: data.usage, billing: { totalAtomic: data.billing?.totalAtomic, chargedUSDC: usd(data.billing?.totalAtomic ?? '0') }, network: c.network, tx: data.payment?.txHash, remainingTodayUsd: limits().remainingTodayUsd })}`);
    });
  register('get_limits', 'LOCAL only: configured caps, spent today (settled plus unresolved at ceiling), remaining daily allowance and spend log path for this wallet/network. No network request; no on-chain enforcement.', {}, () => result(limits()), true);
  register('get_receipts', 'LOCAL only: recent spend-log payments for this wallet/network, newest first. Includes settled, released and unresolved reservations; this is local bookkeeping, not proof of on-chain settlement.',
    { limit: z.number().int().min(1).max(50).default(10) }, a => result(scoped().reverse().slice(0, a.limit).map(p => ({ id: p.id, time: p.t, network: p.network, status: p.status, ceilingUSDC: usd(p.ceilingAtomic), spentUSDC: usd(p.spentAtomic), ...(p.tx ? { tx: p.tx } : {}), resource: new URL(p.resource).pathname }))), true);
}
