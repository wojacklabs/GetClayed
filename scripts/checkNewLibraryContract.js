const { ethers } = require('ethers');

const NEW_LIBRARY = '0xA742D5B85DE818F4584134717AC18930B6cAFE1e';
const BASE_RPC_URL = 'https://mainnet.base.org'\;

async function checkContract() {
  try {
    console.log('🔍 Checking NEW Library Contract...\n');
    console.log('Address:', NEW_LIBRARY);
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Check if contract exists
    const code = await provider.getCode(NEW_LIBRARY);
    console.log('Contract code length:', code.length);
    
    if (code === '0x') {
      console.log('❌ No contract deployed at this address!');
      return;
    }
    
    console.log('✅ Contract exists\n');
    
    // Try different function calls
    const testABI = [
      'function getTotalAssets() external view returns (uint256)',
      'function owner() external view returns (address)',
      'function libraryAssets(string) external view returns (string, string, string, uint256, uint256, address, address, uint256, bool, bool)'
    ];
    
    const contract = new ethers.Contract(NEW_LIBRARY, testABI, provider);
    
    // Try getTotalAssets
    try {
      const total = await contract.getTotalAssets();
      console.log('getTotalAssets():', total.toString());
    } catch (e) {
      console.log('getTotalAssets() failed:', e.message);
    }
    
    // Try owner
    try {
      const owner = await contract.owner();
      console.log('owner():', owner);
    } catch (e) {
      console.log('owner() failed:', e.message);
    }
    
    // Try direct storage access
    try {
      const asset = await contract.libraryAssets('clay-1761204239818-kqn059jib');
      console.log('Direct storage read:', asset);
    } catch (e) {
      console.log('Direct storage failed:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkContract();
