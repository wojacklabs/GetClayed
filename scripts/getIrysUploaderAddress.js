#!/usr/bin/env node

/**
 * Extract the Solana public key from NEXT_PUBLIC_IRYS_PRIVATE_KEY
 * This is used as the trusted uploader address for receipt verification
 */

require('dotenv').config({ path: '.env.local' });
const { Keypair } = require('@solana/web3.js');

function getUploaderAddress() {
  try {
    const FIXED_PRIVATE_KEY = process.env.NEXT_PUBLIC_IRYS_PRIVATE_KEY;
    
    if (!FIXED_PRIVATE_KEY) {
      console.error('❌ NEXT_PUBLIC_IRYS_PRIVATE_KEY not found in .env.local');
      console.error('');
      console.error('Please make sure your .env.local file contains:');
      console.error('NEXT_PUBLIC_IRYS_PRIVATE_KEY="123,456,789,..."');
      process.exit(1);
    }
    
    console.log('🔍 Extracting Solana public key from NEXT_PUBLIC_IRYS_PRIVATE_KEY...\n');
    
    // Convert comma-separated string to Uint8Array
    const keyArray = FIXED_PRIVATE_KEY.split(',').map(num => parseInt(num.trim()));
    const privateKey = new Uint8Array(keyArray);
    const keypair = Keypair.fromSecretKey(privateKey);
    const publicKey = keypair.publicKey.toBase58();
    
    console.log('✅ SUCCESS!\n');
    console.log('═'.repeat(70));
    console.log('TRUSTED UPLOADER ADDRESS');
    console.log('═'.repeat(70));
    console.log(publicKey);
    console.log('═'.repeat(70));
    console.log('');
    console.log('📝 NEXT STEPS:');
    console.log('');
    console.log('1. Add this to your .env.local file:');
    console.log('');
    console.log(`   NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS="${publicKey}"`);
    console.log('');
    console.log('2. Add to Vercel environment variables:');
    console.log('   - Go to Vercel project settings');
    console.log('   - Environment Variables section');
    console.log('   - Add: NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS');
    console.log(`   - Value: ${publicKey}`);
    console.log('');
    console.log('3. Redeploy your application');
    console.log('');
    console.log('🔒 SECURITY BENEFIT:');
    console.log('   Only receipts uploaded from this address will be displayed.');
    console.log('   This prevents fake receipts from malicious users.');
    console.log('═'.repeat(70));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getUploaderAddress();

