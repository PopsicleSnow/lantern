// Generates a fresh Solana keypair for the server claim authority.
// Run: `node scripts/keygen-claim-authority.js`
// Then airdrop devnet SOL to the printed pubkey to cover claim tx fees.
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default ?? require('bs58');

const kp = Keypair.generate();
console.log('Public key  :', kp.publicKey.toBase58());
console.log('Secret (b58):', bs58.encode(kp.secretKey));
console.log('');
console.log('Add to .env.local:');
console.log('  SOLANA_CLAIM_AUTHORITY_KEYPAIR=' + bs58.encode(kp.secretKey));
console.log('  NEXT_PUBLIC_SOLANA_CLAIM_AUTHORITY_PUBKEY=' + kp.publicKey.toBase58());
