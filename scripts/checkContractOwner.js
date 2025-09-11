/**
 * Check who deployed/owns the contracts
 */

const { ethers } = require('ethers');

const LIBRARY_ADDRESS = '0xFdF68975e992ca365aF4452f439A726522156Fb2';
const ROYALTY_ADDRESS = '0x9C47413D00799Bd82300131D506576D491EAAf90';
const BASE_RPC = 'https://mainnet.base.org';

const OWNABLE_ABI = [
  "function owner() external view returns (address)"
];

async function checkOwners() {
  try {
    console.log('🔍 Checking contract owners on Base Mainnet');
    console.log('');

    const provider = new ethers.JsonRpcProvider(BASE_RPC);

    // Check Library owner
    console.log('📚 ClayLibrary:', LIBRARY_ADDRESS);
    const libraryContract = new ethers.Contract(LIBRARY_ADDRESS, OWNABLE_ABI, provider);
    const libraryOwner = await libraryContract.owner();
    console.log('   Owner/Deployer:', libraryOwner);
    console.log('');

    // Check Royalty owner
    console.log('💰 ClayRoyalty:', ROYALTY_ADDRESS);
    const royaltyContract = new ethers.Contract(ROYALTY_ADDRESS, OWNABLE_ABI, provider);
    const royaltyOwner = await royaltyContract.owner();
    console.log('   Owner/Deployer:', royaltyOwner);
    console.log('');

    // Check if they're the same
    if (libraryOwner.toLowerCase() === royaltyOwner.toLowerCase()) {
      console.log('✅ Same owner for both contracts');
      console.log('');
      console.log('👛 DEPLOYER WALLET:', libraryOwner);
    } else {
      console.log('⚠️ Different owners!');
      console.log('   Library owner:', libraryOwner);
      console.log('   Royalty owner:', royaltyOwner);
    }

    // Get transaction history to find deployment
    console.log('');
    console.log('📜 Checking deployment transactions...');
    
    // Get contract creation transaction
    const libraryCode = await provider.getCode(LIBRARY_ADDRESS);
    if (libraryCode && libraryCode !== '0x') {
      console.log('   Library contract verified ✅');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkOwners();

