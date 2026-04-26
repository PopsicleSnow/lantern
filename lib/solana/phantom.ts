'use client';

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// Minimal Phantom (and most other Solana wallet) interface — we don't need the
// wallet-adapter ecosystem for our small surface area.
export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey | null;
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

export function getPhantom(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

export async function connectPhantom(): Promise<PublicKey> {
  const provider = getPhantom();
  if (!provider) {
    throw new Error('Phantom wallet not detected. Install it from https://phantom.app.');
  }
  const { publicKey } = await provider.connect();
  return publicKey;
}

export async function signAndSendInstruction(
  connection: Connection,
  ix: TransactionInstruction,
  feePayer: PublicKey
): Promise<string> {
  const provider = getPhantom();
  if (!provider) throw new Error('Phantom wallet not detected.');

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction().add(ix);
  tx.feePayer = feePayer;
  tx.recentBlockhash = blockhash;

  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  return sig;
}
