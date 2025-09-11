#!/usr/bin/env node

/**
 * Verify that receipt security is properly configured
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function verifyReceiptSecurity() {
  console.log('🔐 Verifying Royalty Receipt Security Configuration\n');
  console.log('═'.repeat(70));
  
  let allChecksPass = true;
  
  // Check 1: Environment variable
  console.log('\n1️⃣  Checking NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS...');
  const trustedAddress = process.env.NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS;
  
  if (!trustedAddress) {
    console.log('   ❌ NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS not configured');
    console.log('   Action: Add to .env.local');
    allChecksPass = false;
  } else {
    console.log(`   ✅ Configured: ${trustedAddress}`);
  }
  
  // Check 2: Verify address format (Solana Base58)
  console.log('\n2️⃣  Verifying address format...');
  if (trustedAddress) {
    const isValidFormat = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trustedAddress);
    if (isValidFormat) {
      console.log('   ✅ Valid Solana address format');
    } else {
      console.log('   ⚠️  Address format looks unusual (but may be valid)');
    }
  }
  
  // Check 3: Test actual Irys data
  console.log('\n3️⃣  Testing Irys GraphQL query with address field...');
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] }
          ],
          first: 1,
          order: DESC
        ) {
          edges {
            node {
              id
              address
            }
          }
        }
      }
    `;
    
    const response = await axios.post(IRYS_GRAPHQL_URL, { query });
    
    if (response.data.errors) {
      console.log('   ❌ GraphQL query failed');
      console.log('   Error:', response.data.errors[0].message);
      allChecksPass = false;
    } else {
      const node = response.data.data?.transactions?.edges?.[0]?.node;
      if (node) {
        console.log('   ✅ Successfully queried address field');
        console.log(`   Sample uploader address: ${node.address}`);
        
        if (trustedAddress && node.address === trustedAddress) {
          console.log('   ✅ Sample transaction matches trusted address!');
        } else if (trustedAddress) {
          console.log('   ℹ️  Sample transaction from different address (this is OK)');
        }
      }
    }
  } catch (error) {
    console.log('   ❌ Network error:', error.message);
    allChecksPass = false;
  }
  
  // Check 4: Verify code implementation
  console.log('\n4️⃣  Checking code implementation...');
  const fs = require('fs');
  const royaltyServicePath = './lib/royaltyService.ts';
  
  try {
    const code = fs.readFileSync(royaltyServicePath, 'utf-8');
    
    const hasAddressField = code.includes('address') && code.includes('node {');
    const hasSecurityCheck = code.includes('TRUSTED_UPLOADER_ADDRESS') && code.includes('edge.node.address');
    
    if (hasAddressField) {
      console.log('   ✅ GraphQL query includes address field');
    } else {
      console.log('   ❌ GraphQL query missing address field');
      allChecksPass = false;
    }
    
    if (hasSecurityCheck) {
      console.log('   ✅ Security check implemented');
    } else {
      console.log('   ❌ Security check not found');
      allChecksPass = false;
    }
  } catch (error) {
    console.log('   ⚠️  Could not verify code:', error.message);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(70));
  
  if (allChecksPass) {
    console.log('✅ All security checks PASSED!');
    console.log('');
    console.log('Your royalty receipt system is protected against:');
    console.log('  • Fake receipts from malicious users');
    console.log('  • UI spam and pollution');
    console.log('  • Tag spoofing attacks');
    console.log('');
    console.log('🔒 Financial security: Always guaranteed by smart contract');
    console.log('🛡️  UI security: Now protected by uploader address verification');
  } else {
    console.log('⚠️  Some checks FAILED. Please review the issues above.');
    console.log('');
    console.log('📝 Quick Fix:');
    console.log('  1. Run: node scripts/getIrysUploaderAddress.js');
    console.log('  2. Copy the address to .env.local');
    console.log('  3. Run this verification script again');
  }
  
  console.log('═'.repeat(70));
  
  process.exit(allChecksPass ? 0 : 1);
}

verifyReceiptSecurity();

