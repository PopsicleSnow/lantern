import { openDB, type IDBPDatabase } from 'idb';
import type { EncryptedKeyBlob } from './passphrase';

const DB_NAME = 'iceberg-keystore';
const LEGACY_DB_NAME = 'lantern-keystore';
const STORE = 'journalist-keys';
const DB_VERSION = 1;

export interface KeystoreEntry {
  journalist_id: string;
  public_key: string;
  encrypted_secret: EncryptedKeyBlob;
  created_at: number;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'journalist_id' });
      }
    },
  });
}

async function getLegacyDB(): Promise<IDBPDatabase> {
  return openDB(LEGACY_DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'journalist_id' });
      }
    },
  });
}

export async function saveKeystore(entry: KeystoreEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORE, entry);
}

export async function loadKeystore(journalist_id: string): Promise<KeystoreEntry | null> {
  const db = await getDB();
  const entry = await db.get(STORE, journalist_id);
  if (entry) return entry as KeystoreEntry;

  // Backward compatibility for pre-rename installs.
  const legacy = await getLegacyDB();
  const legacyEntry = await legacy.get(STORE, journalist_id);
  if (legacyEntry) {
    const migrated = legacyEntry as KeystoreEntry;
    await db.put(STORE, migrated);
    return migrated;
  }
  return null;
}

export async function clearKeystore(journalist_id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, journalist_id);
  const legacy = await getLegacyDB();
  await legacy.delete(STORE, journalist_id);
}
