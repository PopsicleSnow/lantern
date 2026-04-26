import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = 'SHA-256';
const SALT_BYTES = 16;

export interface EncryptedKeyBlob {
  version: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: PBKDF2_HASH },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

export async function encryptSecretKey(secret_key: Uint8Array, passphrase: string): Promise<EncryptedKeyBlob> {
  const salt = nacl.randomBytes(SALT_BYTES);
  const wrap_key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(secret_key, nonce, wrap_key);
  return {
    version: 1,
    kdf: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
}

export async function decryptSecretKey(blob: EncryptedKeyBlob, passphrase: string): Promise<Uint8Array> {
  const salt = decodeBase64(blob.salt);
  const wrap_key = await deriveKey(passphrase, salt, blob.iterations);
  const nonce = decodeBase64(blob.nonce);
  const ciphertext = decodeBase64(blob.ciphertext);
  const plaintext = nacl.secretbox.open(ciphertext, nonce, wrap_key);
  if (!plaintext) {
    throw new Error('Wrong passphrase');
  }
  return plaintext;
}
