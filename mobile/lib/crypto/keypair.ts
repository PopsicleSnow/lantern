import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

export interface Keypair {
  public_key: string;
  secret_key: Uint8Array;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  ephemeral_pubkey: string;
}

export function generateKeypair(): Keypair {
  const kp = nacl.box.keyPair();
  return {
    public_key: encodeBase64(kp.publicKey),
    secret_key: kp.secretKey,
  };
}

export function publicKeyFromSecret(secret_key: Uint8Array): string {
  const pub = nacl.box.keyPair.fromSecretKey(secret_key).publicKey;
  return encodeBase64(pub);
}

export function encryptToRecipient(plaintext: string, recipient_pubkey_b64: string): EncryptedPayload {
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const recipient_pub = decodeBase64(recipient_pubkey_b64);
  const message = decodeUTF8(plaintext);
  const ciphertext = nacl.box(message, nonce, recipient_pub, ephemeral.secretKey);
  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    ephemeral_pubkey: encodeBase64(ephemeral.publicKey),
  };
}

export function decryptFromSender(payload: EncryptedPayload, our_secret_key: Uint8Array): string {
  const ciphertext = decodeBase64(payload.ciphertext);
  const nonce = decodeBase64(payload.nonce);
  const sender_pub = decodeBase64(payload.ephemeral_pubkey);
  const plaintext = nacl.box.open(ciphertext, nonce, sender_pub, our_secret_key);
  if (!plaintext) {
    throw new Error('Decryption failed: invalid ciphertext or wrong key');
  }
  return encodeUTF8(plaintext);
}
