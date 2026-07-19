import * as Crypto from 'expo-crypto';

/** UUID for new rows — sync-safe identity across devices (see schema.ts). */
export const newId = (): string => Crypto.randomUUID();
