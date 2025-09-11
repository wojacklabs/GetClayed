const { ethers } = require('ethers');

const NEW_LIBRARY = '0xA742D5B85DE818F4584134717AC18930B6cAFE1e';
const BASE_RPC_URL = 'https://mainnet.base.org';

async function checkContract() {
  try {
    console.log('Checking NEW Library Contract...');
    console.log('Address:', NEW_LIBRARY);
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const code = await provider.getCode(NEW_LIBRARY);
    console.log('Contract code length:', code.length);
    
    if (code === '0x') {
      console.log('ERROR: No contract deployed!');
      return;
    }
    
    console.log('Contract exists');
    
    const testABI = [
      'function getTotalAssets() external view returns (uint256)',
      'function owner() external view returns (address)'
    ];
    
    const contract = new ethers.Contract(NEW_LIBRARY, testABI, provider);
    
    try {
      const total = await contract.getTotalAssets();
      console.log('getTotalAssets:', total.toString());
    } catch (e) {
      console.log('getTotalAssets failed:', e.message);
    }
    
    try {
      const owner = await contract.owner();
      console.log('owner:', owner);
    } catch (e) {
      console.log('owner failed:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkContract();

<<<<<<< Updated upstream







=======
>>>>>>> Stashed changes


