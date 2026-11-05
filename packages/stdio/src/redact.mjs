const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58Encode(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0')), out = '';
  while (n) { out = alphabet[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b) break; out = '1' + out; }
  return out;
}
export function base58Decode(text) {
  let n = 0n;
  for (const c of text) { const i = alphabet.indexOf(c); if (i < 0) throw Error('Invalid base58'); n = n * 58n + BigInt(i); }
  const hex = n.toString(16).padStart(2, '0');
  const bytes = n ? Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex') : Buffer.alloc(0);
  return Buffer.concat([Buffer.alloc(text.match(/^1*/)[0].length), bytes]);
}
export function createRedactor(env = process.env) {
  const secrets = new Set(), arrays = [], hexes = [];
  for (const key of [env.SINGIT_EVM_PRIVATE_KEY, env.SINGIT_SOLANA_PRIVATE_KEY].filter(Boolean)) {
    secrets.add(key);
    try {
      let bytes;
      if (/^(0x)?[a-fA-F0-9]{64}$/.test(key)) bytes = Buffer.from(key.replace(/^0x/, ''), 'hex');
      else if (key.trim().startsWith('[')) {
        const a = JSON.parse(key);
        if (Array.isArray(a) && a.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) bytes = Buffer.from(a);
      } else bytes = base58Decode(key);
      // A 64-byte Solana key also contains its 32-byte signing seed, which is just as sensitive.
      for (const part of bytes?.length ? (bytes.length === 64 ? [bytes, bytes.subarray(0, 32)] : [bytes]) : []) {
        const hex = part.toString('hex');
        hexes.push(new RegExp('(?:0x)?' + hex, 'gi'));
        arrays.push(new RegExp('\\[\\s*' + [...part].join('\\s*,\\s*') + '\\s*\\]', 'g'));
        for (const s of [hex, hex.toUpperCase(), '0x' + hex, '0x' + hex.toUpperCase(), base58Encode(part), part.toString('base64'), JSON.stringify([...part]), JSON.stringify([...part], null, 2), '[' + [...part].join(', ') + ']']) secrets.add(s);
      }
    } catch { /* The raw invalid value is still redacted. */ }
  }
  for (const secret of [...secrets]) secrets.add(JSON.stringify(secret).slice(1, -1));
  const ordered = [...secrets].sort((a, b) => b.length - a.length);
  return value => {
    let text = String(value);
    for (const pattern of arrays) text = text.replace(pattern, '[REDACTED]');
    for (const pattern of hexes) text = text.replace(pattern, '[REDACTED]');
    for (const secret of ordered) text = text.split(secret).join('[REDACTED]');
    return text.replace(/0x[0-9a-fA-F]{64}/g, '[REDACTED]').replace(/[1-9A-HJ-NP-Za-km-z]{80,}/g, '[REDACTED]');
  };
}
export function diagnostics(redact) {
  const seen = new Set();
  return (kind, message) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    process.stderr.write(redact(`singit-local ${kind}: ${message}`).replace(/[\r\n]+/g, ' ') + '\n');
  };
}

// Preserve protocol numbers and JSON structure while redacting every string value.
export function redactValue(value, redact) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(v => redactValue(v, redact));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [redact(k), redactValue(v, redact)]));
  return value;
}
