const { Keypair } = require('@solana/web3.js');

// Generate a new Solana keypair
const keypair = Keypair.generate();

// Get the secret key (private key) as Uint8Array
const secretKey = keypair.secretKey;

// Convert to comma-separated string for .env.local
const secretKeyString = Array.from(secretKey).join(',');

console.log('=== Solana Keypair Generated ===');
console.log('\nPublic Key (Address):');
console.log(keypair.publicKey.toBase58());
console.log('\nPrivate Key (for .env.local):');
console.log(`NEXT_PUBLIC_IRYS_PRIVATE_KEY=${secretKeyString}`);
console.log('\n=== IMPORTANT ===');
console.log('1. Copy the above line to your .env.local file');
console.log('2. Fund the public key address with SOL if needed for uploads > 90KB');
console.log('3. Keep the private key secure and never commit it to git');
