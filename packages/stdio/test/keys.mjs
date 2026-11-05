import { generateKeyPairSync } from 'node:crypto';
export function throwawaySolana() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return Buffer.concat([privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32), publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)]);
}
