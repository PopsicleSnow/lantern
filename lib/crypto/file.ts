import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

export interface WrappedKeyMaterial {
  key_ciphertext: string;
  key_nonce: string;
  ephemeral_pubkey: string;
}

export interface WrappedKey extends WrappedKeyMaterial {
  journalist_id: string;
}

export interface EncryptedFile {
  file_ciphertext: Uint8Array;
  file_nonce: string;
  filename_ciphertext: string;
  filename_nonce: string;
  wrapped_keys: WrappedKey[];
}

interface Recipient {
  journalist_id: string;
  public_key: string;
}

export function encryptFileForRecipients(
  file_bytes: Uint8Array,
  filename: string,
  recipients: Recipient[]
): EncryptedFile {
  const content_key = nacl.randomBytes(nacl.secretbox.keyLength);
  const file_nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const file_ciphertext = nacl.secretbox(file_bytes, file_nonce, content_key);

  const filename_nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const filename_ciphertext = nacl.secretbox(decodeUTF8(filename), filename_nonce, content_key);

  const wrapped_keys: WrappedKey[] = recipients.map((r) => {
    const ephemeral = nacl.box.keyPair();
    const key_nonce = nacl.randomBytes(nacl.box.nonceLength);
    const key_ciphertext = nacl.box(
      content_key,
      key_nonce,
      decodeBase64(r.public_key),
      ephemeral.secretKey
    );
    return {
      journalist_id: r.journalist_id,
      key_ciphertext: encodeBase64(key_ciphertext),
      key_nonce: encodeBase64(key_nonce),
      ephemeral_pubkey: encodeBase64(ephemeral.publicKey),
    };
  });

  return {
    file_ciphertext,
    file_nonce: encodeBase64(file_nonce),
    filename_ciphertext: encodeBase64(filename_ciphertext),
    filename_nonce: encodeBase64(filename_nonce),
    wrapped_keys,
  };
}

export function unwrapContentKey(
  wrapped: WrappedKeyMaterial,
  our_secret_key: Uint8Array
): Uint8Array {
  const key_ciphertext = decodeBase64(wrapped.key_ciphertext);
  const key_nonce = decodeBase64(wrapped.key_nonce);
  const sender_pub = decodeBase64(wrapped.ephemeral_pubkey);
  const content_key = nacl.box.open(key_ciphertext, key_nonce, sender_pub, our_secret_key);
  if (!content_key) throw new Error('Failed to unwrap content key');
  return content_key;
}

export function decryptFilename(
  filename_ciphertext_b64: string,
  filename_nonce_b64: string,
  content_key: Uint8Array
): string {
  const ct = decodeBase64(filename_ciphertext_b64);
  const nonce = decodeBase64(filename_nonce_b64);
  const plain = nacl.secretbox.open(ct, nonce, content_key);
  if (!plain) throw new Error('Filename decryption failed');
  return encodeUTF8(plain);
}

export function decryptFileBytes(
  file_ciphertext: Uint8Array,
  file_nonce_b64: string,
  content_key: Uint8Array
): Uint8Array {
  const nonce = decodeBase64(file_nonce_b64);
  const plain = nacl.secretbox.open(file_ciphertext, nonce, content_key);
  if (!plain) throw new Error('File decryption failed');
  return plain;
}
