// Loopback SPL-mint/blockhash RPC, modeled on singit-js/test/solana-sign.test.mjs.
import http from 'node:http';
import assert from 'node:assert/strict';
import { NETWORKS } from '@singitai/sdk';
const PIN = NETWORKS.solana;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const BLOCKHASH = '11111111111111111111111111111111';
const SLOT = 123456789;
export async function startRpc(t) {
  // Legacy SPL mint layout: two COption<Pubkey>s, supply, decimals, initialized.
  // USDC has 6 decimals. Neither client needs actual supply or mint authorities.
  const mint = Buffer.alloc(82);
  mint[44] = 6;
  mint[45] = 1;
  const calls = [];
  const errors = [];
  const server = http.createServer(async (req, res) => {
    let id = null;
    try {
      assert.equal(req.method, "POST");
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      id = request.id;
      assert.equal(request.jsonrpc, "2.0");
      calls.push(request.method);
      let result;
      switch (request.method) {
        case "getAccountInfo":
          assert.equal(request.params[0], PIN.asset);
          assert.equal(request.params[1].encoding, "base64");
          result = { context: { slot: SLOT }, value: {
            data: [mint.toString("base64"), "base64"], executable: false,
            lamports: 1461600, owner: TOKEN_PROGRAM, rentEpoch: 0, space: mint.length,
          } };
          break;
        case "getLatestBlockhash":
          result = { context: { slot: SLOT }, value: { blockhash: BLOCKHASH, lastValidBlockHeight: SLOT + 150 } };
          break;
        case "getSlot":
          result = SLOT;
          break;
        default:
          assert.fail(`Unexpected RPC method: ${request.method}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    } catch (error) {
      errors.push(error);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: error.message } }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return { url: `http://127.0.0.1:${server.address().port}`, calls, errors };
}
