'use client';

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// Minimal interface shared by Phantom, Solflare, Backpack, etc. We don't need
// the wallet-adapter ecosystem for our small surface area.
export interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: PublicKey | null;
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}
// Back-compat alias.
export type PhantomProvider = SolanaProvider;

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
  }
}

export type WalletKind = 'phantom' | 'solflare' | 'backpack';

export interface DetectedWallet {
  kind: WalletKind;
  provider: SolanaProvider;
  label: string;
}

export function detectWallets(): DetectedWallet[] {
  if (typeof window === 'undefined') return [];
  const out: DetectedWallet[] = [];
  const phantom = window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null);
  if (phantom) out.push({ kind: 'phantom', provider: phantom, label: 'Phantom' });
  if (window.solflare?.isSolflare) {
    out.push({ kind: 'solflare', provider: window.solflare, label: 'Solflare' });
  }
  if (window.backpack?.isBackpack) {
    out.push({ kind: 'backpack', provider: window.backpack, label: 'Backpack' });
  }
  // Last-resort: an ambiguous window.solana injected by another wallet (e.g. Glow).
  if (out.length === 0 && window.solana) {
    out.push({ kind: 'phantom', provider: window.solana, label: 'Solana wallet' });
  }
  return out;
}

export function getProvider(preferred?: WalletKind): SolanaProvider | null {
  const wallets = detectWallets();
  if (preferred) {
    const match = wallets.find((w) => w.kind === preferred);
    if (match) return match.provider;
  }
  return wallets[0]?.provider ?? null;
}
export const getPhantom = (preferred?: WalletKind) => getProvider(preferred);

export async function connectWallet(preferred?: WalletKind): Promise<PublicKey> {
  const provider = getProvider(preferred);
  if (!provider) {
    throw new Error(
      'No Solana wallet detected. Install Phantom (phantom.app), Solflare (solflare.com), or Backpack (backpack.app).'
    );
  }
  const { publicKey } = await provider.connect();
  return publicKey;
}
export const connectPhantom = (preferred?: WalletKind) => connectWallet(preferred);

export async function signAndSendInstruction(
  connection: Connection,
  ix: TransactionInstruction,
  feePayer: PublicKey,
  preferred?: WalletKind
): Promise<string> {
  const provider = getProvider(preferred);
  if (!provider) throw new Error('No Solana wallet detected.');

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
