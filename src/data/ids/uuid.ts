import { sha1 } from './sha1';

/**
 * Every identifier in the diary is chosen on the device. Postgres never
 * generates one, so it needs no extension and no default; it accepts the
 * identifier the phone already picked (AC-4).
 *
 * Two shapes, for two reasons:
 *
 *   version 7  for rows that record an event (a meal, an item, a scan).
 *              Time ordered, so inserts stay local in the index.
 *   version 5  for rows keyed by a day (a target, a weigh in). Derived from
 *              the user and the date, so two offline devices that each create
 *              Tuesday's row produce the *same* identifier. The clash then
 *              lands on the primary key, where newest write wins can see it,
 *              instead of on a unique index, where it cannot.
 *
 * Nothing here reads a clock or a random source of its own. Both are passed
 * in, which keeps this file pure and runnable without a phone, and keeps the
 * effect at the edge where the project's rules put it.
 */

const HEX = '0123456789abcdef';

const format = (bytes: Uint8Array): string => {
  let out = '';
  for (const [index, byte] of bytes.entries()) {
    if (index === 4 || index === 6 || index === 8 || index === 10) out += '-';
    out += (HEX[byte >> 4] ?? '0') + (HEX[byte & 0x0f] ?? '0');
  }
  return out;
};

const parse = (uuid: string): Uint8Array => {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

/** Sets the four version bits and the two variant bits RFC 9562 requires. */
const stamp = (bytes: Uint8Array, version: number): Uint8Array => {
  const stamped = Uint8Array.from(bytes);
  stamped[6] = ((stamped[6] ?? 0) & 0x0f) | (version << 4);
  stamped[8] = ((stamped[8] ?? 0) & 0x3f) | 0x80;
  return stamped;
};

/** A source of random bytes. The device supplies one; a check can supply its own. */
export type RandomBytes = (count: number) => Uint8Array;

/**
 * How the data layer asks for a new identifier. Passed in rather than
 * imported, so a caller with no phone can hand over a deterministic one.
 */
export type IdSource = { readonly newId: () => string };

/** A millisecond timestamp and ten random bytes in, a version 7 identifier out. */
export const uuidV7From = (epochMs: number, random: Uint8Array): string => {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);

  // 48 bits of timestamp, big endian, split because a millisecond count
  // exceeds what a single 32 bit write can carry.
  view.setUint16(0, Math.floor(epochMs / 0x100000000), false);
  view.setUint32(2, epochMs >>> 0, false);
  bytes.set(random.slice(0, 10), 6);

  return format(stamp(bytes, 7));
};

/** An `IdSource` built from a random source and a clock. */
export const createIdSource = (random: RandomBytes, now: () => number = Date.now): IdSource => ({
  newId: () => uuidV7From(now(), random(10)),
});

/**
 * The project namespace for every derived identifier. Frozen: changing it
 * would rename every existing day keyed row and break the whole point of
 * deriving them.
 */
export const CALSNAP_NAMESPACE = '6f1a8c2e-9b47-5d3a-8e10-4c7b2f9a5d63';

/** UUID version 5: SHA-1 over the namespace bytes followed by the name. */
export const uuidV5 = (name: string, namespace: string = CALSNAP_NAMESPACE): string => {
  const nameBytes = new TextEncoder().encode(name);
  const namespaceBytes = parse(namespace);

  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);

  return format(stamp(sha1(input).slice(0, 16), 5));
};

/**
 * The identifier for a row keyed by a user and a local date, the same on
 * every device that person signs in to.
 */
export const dayScopedId = (table: string, userId: string, onDate: string): string =>
  uuidV5(`${table}:${userId}:${onDate}`);
