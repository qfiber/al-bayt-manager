// Web Worker: brute-force PoW nonce
// Receives { prefix, difficulty }, posts back { nonce }

const ctx = self as unknown as Worker;

ctx.onmessage = async (e: MessageEvent<{ prefix: string; difficulty: number }>) => {
  const { prefix, difficulty } = e.data;
  const encoder = new TextEncoder();
  let nonce = 0;

  while (true) {
    const data = encoder.encode(prefix + nonce);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hash = new Uint8Array(hashBuf);

    if (hasLeadingZeroBits(hash, difficulty)) {
      ctx.postMessage({ nonce: String(nonce) });
      return;
    }

    nonce++;

    // Yield every 10k iterations to stay responsive
    if (nonce % 10_000 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
};

function hasLeadingZeroBits(hash: Uint8Array, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  const remainingBits = bits % 8;

  for (let i = 0; i < fullBytes; i++) {
    if (hash[i] !== 0) return false;
  }

  if (remainingBits > 0) {
    const mask = 0xff << (8 - remainingBits);
    if ((hash[fullBytes] & mask) !== 0) return false;
  }

  return true;
}
