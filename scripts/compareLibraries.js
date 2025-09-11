const { ethers } = require('ethers');

const OLD_LIBRARY = '0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4';
const NEW_LIBRARY = '0xA742D5B85DE818F4584134717AC18930B6cAFE1e';
const BASE_RPC_URL = 'https://mainnet.base.org';

const LIBRARY_ABI = [
  'function getTotalAssets() external view returns (uint256)',
  'function getAssetIdByIndex(uint256 index) external view returns (string)',
  'function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))'
];

async function compareLibraries() {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    console.log('='.repeat(60));
    console.log('OLD Library (10/28):', OLD_LIBRARY);
    console.log('='.repeat(60));
    
    const oldContract = new ethers.Contract(OLD_LIBRARY, LIBRARY_ABI, provider);
    const oldTotal = await oldContract.getTotalAssets();
    console.log(`Total assets: ${oldTotal}\n`);
    
    for (let i = 0; i < oldTotal; i++) {
      const projectId = await oldContract.getAssetIdByIndex(i);
      const asset = await oldContract.getAsset(projectId);
      if (asset.exists) {
        console.log(`${i + 1}. ${asset.name}`);
        console.log(`   ID: ${projectId}`);
        console.log(`   Owner: ${asset.currentOwner}`);
        console.log(`   Royalty Enabled: ${asset.royaltyEnabled}`);
        console.log('');
      }
    }
    
    console.log('='.repeat(60));
    console.log('NEW Library (11/06):', NEW_LIBRARY);
    console.log('='.repeat(60));
    
    const newContract = new ethers.Contract(NEW_LIBRARY, LIBRARY_ABI, provider);
    const newTotal = await newContract.getTotalAssets();
    console.log(`Total assets: ${newTotal}\n`);
    
    for (let i = 0; i < newTotal; i++) {
      const projectId = await newContract.getAssetIdByIndex(i);
      const asset = await newContract.getAsset(projectId);
      if (asset.exists) {
        console.log(`${i + 1}. ${asset.name}`);
        console.log(`   ID: ${projectId}`);
        console.log(`   Owner: ${asset.currentOwner}`);
        console.log(`   Royalty Enabled: ${asset.royaltyEnabled}`);
        console.log('');
      }
    }
    
    console.log('='.repeat(60));
    console.log('CONCLUSION:');
    console.log('='.repeat(60));
    console.log(`OLD Library has ${oldTotal} libraries`);
    console.log(`NEW Library has ${newTotal} libraries`);
    console.log('');
    console.log('SOLUTION: Migrate data from OLD to NEW Library');
    console.log('OR: Update Royalty/Marketplace to use OLD Library');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

compareLibraries();

<<<<<<< Updated upstream







=======
>>>>>>> Stashed changes


