/**
 * Devnet helper: transfer SOL from the server claim authority (loaded from
 * .env.local SOLANA_CLAIM_AUTHORITY_KEYPAIR) to any pubkey. Useful when the
 * faucet is rate-limited and you need to fund a fresh Phantom wallet for
 * testing the journalist `create_bounty` flow.
 *
 * Usage:
 *   node scripts/devnet-transfer.js <recipient_pubkey> <amount_sol>
 *
 * Example:
 *   node scripts/devnet-transfer.js 7Np3Pr...XYZ 0.05
 */
const fs = require('fs');
const path = require('path');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const bs58 = require('bs58').default ?? require('bs58');

function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(?:#.*)?$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnvLocal();

  const [, , recipientArg, amountArg] = process.argv;
  if (!recipientArg || !amountArg) {
    console.error('Usage: node scripts/devnet-transfer.js <recipient_pubkey> <amount_sol>');
    process.exit(1);
  }

  const secret = process.env.SOLANA_CLAIM_AUTHORITY_KEYPAIR;
  if (!secret) {
    console.error('SOLANA_CLAIM_AUTHORITY_KEYPAIR not set in .env.local');
    process.exit(1);
  }

  const rpc = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpc, 'confirmed');

  const sender = Keypair.fromSecretKey(bs58.decode(secret));
  const recipient = new PublicKey(recipientArg);
  const lamports = Math.round(parseFloat(amountArg) * LAMPORTS_PER_SOL);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    console.error('amount_sol must be a positive number');
    process.exit(1);
  }

  const senderBalance = await connection.getBalance(sender.publicKey);
  console.log('From  :', sender.publicKey.toBase58());
  console.log('Bal   :', (senderBalance / LAMPORTS_PER_SOL).toFixed(6), 'SOL');
  console.log('To    :', recipient.toBase58());
  console.log('Amount:', (lamports / LAMPORTS_PER_SOL).toFixed(6), 'SOL');

  if (senderBalance < lamports + 5_000) {
    console.error('Insufficient balance (need amount + ~5000 lamports for fees).');
    process.exit(1);
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [sender], {
    commitment: 'confirmed',
  });
  console.log('');
  console.log('Sent  :', sig);
  console.log('Explorer:', `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
