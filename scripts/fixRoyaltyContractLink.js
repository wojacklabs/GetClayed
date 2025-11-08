const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.local' });

const ROYALTY_ADDRESS = '0x3Fae9E45FF52aD4338182b82CEC7e3e30F74b929';
const CORRECT_LIBRARY_ADDRESS = '0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4';
const BASE_RPC_URL = 'https://mainnet.base.org';

const ROYALTY_ABI = [
  'function setLibraryContract(address _libraryContract) external',
  'function libraryContract() external view returns (address)',
  'function owner() external view returns (address)'
];

async function fixLink() {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ PRIVATE_KEY not found in .env.local');
      console.log('\n💡 Add to .env.local:');
      console.log('PRIVATE_KEY=your_deployer_private_key');
      return;
    }
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(ROYALTY_ADDRESS, ROYALTY_ABI, wallet);
    
    console.log('🔧 Fixing Royalty Contract linkage...\n');
    console.log('Deployer wallet:', wallet.address);
    
    // Check if wallet is owner
    const owner = await contract.owner();
    console.log('Contract owner:', owner);
    
    if (wallet.address.toLowerCase() !== owner.toLowerCase()) {
      console.log('❌ ERROR: You are not the contract owner!');
      console.log('   Only owner can call setLibraryContract()');
      return;
    }
    
    // Check current library address
    const currentLibrary = await contract.libraryContract();
    console.log('Current Library:', currentLibrary);
    console.log('Correct Library:', CORRECT_LIBRARY_ADDRESS);
    
    if (currentLibrary.toLowerCase() === CORRECT_LIBRARY_ADDRESS.toLowerCase()) {
      console.log('\n✅ Already correctly configured!');
      return;
    }
    
    console.log('\n📝 Updating Library contract address...');
    const tx = await contract.setLibraryContract(CORRECT_LIBRARY_ADDRESS);
    console.log('Transaction hash:', tx.hash);
    
    console.log('⏳ Waiting for confirmation...');
    await tx.wait();
    
    console.log('✅ Library contract address updated!');
    
    // Verify
    const newLibrary = await contract.libraryContract();
    console.log('\n📍 Verification:');
    console.log('New Library address:', newLibrary);
    console.log('Match:', newLibrary.toLowerCase() === CORRECT_LIBRARY_ADDRESS.toLowerCase() ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixLink();

