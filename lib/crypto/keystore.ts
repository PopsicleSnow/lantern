import { openDB, type IDBPDatabase } from 'idb';
import type { EncryptedKeyBlob } from './passphrase';

const DB_NAME = 'lantern-keystore';
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

export async function saveKeystore(entry: KeystoreEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORE, entry);
}

export async function loadKeystore(journalist_id: string): Promise<KeystoreEntry | null> {
  const db = await getDB();
  const entry = await db.get(STORE, journalist_id);
  return (entry as KeystoreEntry | undefined) ?? null;
}

export async function clearKeystore(journalist_id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, journalist_id);
}
