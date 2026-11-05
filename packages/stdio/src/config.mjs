import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createRedactor, base58Decode } from './redact.mjs';
// Resolve signer dependencies from the SDK, which owns their compatible versions.
const sdkRequire = createRequire(import.meta.resolve('@singitai/sdk'));
export const signerImport = name => import(sdkRequire.resolve(name));
export const shorten = address => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'no wallet configured';
export async function loadConfig(env = process.env) {
  const redact = createRedactor(env), errors = [];
  const network = env.SINGIT_NETWORK ?? 'base';
  if (!['base', 'solana'].includes(network)) errors.push('SINGIT_NETWORK must be base or solana.');
  const cap = (name, fallback) => {
    const raw = env[name] ?? String(fallback), n = Number(raw);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()) || !Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n * 1e6))) {
      errors.push(`${name} must be a finite non-negative USD amount.`); return null;
    }
    return n;
  };
  const maxPerCallUsd = cap('SINGIT_MAX_PER_CALL_USD', 0.01), maxPerDayUsd = cap('SINGIT_MAX_PER_DAY_USD', 0.10);
  const file = path.resolve(env.SINGIT_HOME || path.join(os.homedir(), '.singit'), 'spend.jsonl');
  const baseUrl = (env.SINGIT_BASE_URL ?? 'https://ask.singitai.app').replace(/\/$/, '');
  const rpcUrl = env.SINGIT_RPC_URL;
  for (const [label, value] of [['SINGIT_BASE_URL', baseUrl], ['SINGIT_RPC_URL', rpcUrl]]) {
    if (value === undefined) continue;
    try { const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || redact(value) !== value) throw Error(); }
    catch { errors.push(`${label} must be an HTTP(S) URL without credentials, query, fragment or secrets.`); }
  }
  if (redact(file) !== file) errors.push('SINGIT_HOME must not contain secrets.');
  const keyName = network === 'solana' ? 'SINGIT_SOLANA_PRIVATE_KEY' : 'SINGIT_EVM_PRIVATE_KEY';
  let payer = '', evmPrivateKey, solanaSigner;
  const key = env[keyName];
  if (key) {
    try {
      if (network === 'base') {
        if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw Error();
        const { privateKeyToAccount } = await signerImport('viem/accounts');
        payer = privateKeyToAccount(key).address.toLowerCase(); evmPrivateKey = key;
      } else if (network === 'solana') {
        let bytes;
        if (key.trim().startsWith('[')) {
          const a = JSON.parse(key);
          if (!Array.isArray(a) || a.length !== 64 || !a.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) throw Error();
          bytes = Uint8Array.from(a);
        } else bytes = base58Decode(key);
        if (bytes.length !== 64) throw Error();
        const { createKeyPairSignerFromBytes } = await signerImport('@solana/kit');
        solanaSigner = await createKeyPairSignerFromBytes(bytes); payer = solanaSigner.address;
      }
    } catch { errors.push(`${keyName} is invalid; use ${network === 'base' ? '0x plus 64 hex digits for a valid EVM key' : 'a base58 or JSON-array 64-byte Solana secret key'}.`); }
  }
  return { network, maxPerCallUsd, maxPerDayUsd, file, baseUrl, rpcUrl, payer, evmPrivateKey, solanaSigner, keyName, errors, redact };
}
export const configSummary = c => ({ name: 'singit-local', network: c.network, maxPerCallUsd: c.maxPerCallUsd, maxPerDayUsd: c.maxPerDayUsd, wallet: shorten(c.payer), spendLog: c.file, errors: c.errors });
