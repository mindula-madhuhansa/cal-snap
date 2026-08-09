import { getRandomBytes } from 'expo-crypto';

import { createIdSource, type IdSource } from './uuid';

/**
 * The device's identifier source: the one place the app reaches for real
 * randomness and the real clock. Everything downstream takes an `IdSource`
 * as an argument, so this module is the only thing that needs a phone.
 */
export const deviceIdSource: IdSource = createIdSource(getRandomBytes);
