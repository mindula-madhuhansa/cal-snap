/**
 * SHA-1, written out in full so that UUID version 5 stays a pure synchronous
 * function that runs without a phone. The alternative, `expo-crypto`'s
 * digest, is asynchronous and native, which would make deriving a day's
 * identifier an effect rather than a calculation.
 *
 * SHA-1 is used here only as the identifier derivation RFC 9562 specifies for
 * version 5. It is never used for anything security bearing.
 */

const rotateLeft = (value: number, bits: number): number =>
  ((value << bits) | (value >>> (32 - bits))) >>> 0;

export const sha1 = (message: Uint8Array): Uint8Array => {
  const bitLength = message.length * 8;

  // Pad to a multiple of 64 bytes: a 0x80 byte, then zeroes, then the
  // original length as a 64 bit big endian integer.
  const paddedLength = (((message.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const words = new Uint32Array(80);

  for (let block = 0; block < paddedLength; block += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(block + index * 4, false);
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] = rotateLeft(
        (words[index - 3] ?? 0) ^
          (words[index - 8] ?? 0) ^
          (words[index - 14] ?? 0) ^
          (words[index - 16] ?? 0),
        1,
      );
    }

    let [a = 0, b = 0, c = 0, d = 0, e = 0] = state;

    for (let index = 0; index < 80; index += 1) {
      const round = Math.floor(index / 20);
      const mixed =
        round === 0 ? (b & c) | (~b & d) : round === 2 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const constant = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6][round] ?? 0;

      const next = (rotateLeft(a, 5) + mixed + e + constant + (words[index] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = next;
    }

    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
  }

  const digest = new Uint8Array(20);
  const digestView = new DataView(digest.buffer);
  for (const [index, word] of state.entries()) {
    digestView.setUint32(index * 4, word, false);
  }
  return digest;
};
