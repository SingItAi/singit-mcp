// Loaded in every integration-test child before product code.
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.hostname !== '127.0.0.1') throw Error('Test blocked a non-loopback request');
  return original(input, init);
};
