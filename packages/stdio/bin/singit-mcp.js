#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createRedactor, diagnostics } from '../src/redact.mjs';
process.title = 'singit-local';
const redact = createRedactor();
// Catch dependency diagnostics too; the protocol stream is redacted at transport.send.
const stderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, callback) => stderrWrite(redact(Buffer.isBuffer(chunk) ? chunk.toString() : chunk), encoding, callback);
const log = diagnostics(redact);
console.warn = () => log('sdk-warning', 'SDK warning; inspect local spend-log reservations.');
console.error = () => log('dependency-error', 'A dependency reported an error; inspect local configuration.');
process.on('uncaughtException', () => { log('uncaught-error', 'Unexpected failure; restarting may be necessary.'); process.exit(2); });
process.on('unhandledRejection', () => { log('unhandled-error', 'Unexpected asynchronous failure; restarting may be necessary.'); process.exit(2); });
try {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--version', '--help', '--check'].includes(args[0]))) {
    log('arguments', 'Use --help, --version or --check. Secrets belong in environment variables.'); process.exitCode = 2;
  } else if (args[0] === '--version') process.stdout.write(redact(version) + '\n');
  else if (args[0] === '--help') process.stdout.write(redact('SingIt local MCP server. Usage: singit-mcp [--help|--version|--check]\nConfigure SINGIT_NETWORK, SINGIT_EVM_PRIVATE_KEY or SINGIT_SOLANA_PRIVATE_KEY, SINGIT_MAX_PER_CALL_USD, SINGIT_MAX_PER_DAY_USD, SINGIT_HOME, SINGIT_BASE_URL, SINGIT_RPC_URL via environment only. No wallet creation.\n'));
  else {
    const { loadConfig, configSummary } = await import('../src/config.mjs');
    const config = await loadConfig();
    if (args[0] === '--check') {
      process.stdout.write(redact(JSON.stringify({ ...configSummary(config), version })) + '\n');
      process.exitCode = config.errors.length || !config.payer ? 2 : 0;
    } else {
      const { startServer } = await import('../src/server.mjs');
      await startServer(config, version, log);
    }
  }
} catch {
  log('startup-error', 'Unable to start. Check installed dependencies and local configuration.'); process.exitCode = 2;
}
