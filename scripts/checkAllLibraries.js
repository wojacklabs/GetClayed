const { ethers } = require('ethers');

const OLD_LIBRARY = '0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4';
const NEW_LIBRARY = '0xA742D5B85DE818F4584134717AC18930B6cAFE1e';
const BASE_RPC_URL = 'https://mainnet.base.org';

const LIBRARY_ABI = [
  'function getTotalAssets() external view returns (uint256)',
  'function getAssetIdByIndex(uint256 index) external view returns (string)',
  'function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))'
];

async function checkLibraries(address, label) {
  try {
    console.log(`\n📍 ${label}: ${address}`);
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(address, LIBRARY_ABI, provider);
    
    const totalAssets = await contract.getTotalAssets();
    console.log(`   Total assets: ${totalAssets}`);
    
    console.log(`   Active libraries:`);
    let activeCount = 0;
    for (let i = 0; i < totalAssets; i++) {
      const projectId = await contract.getAssetIdByIndex(i);
      const asset = await contract.getAsset(projectId);
      if (asset.exists && asset.royaltyEnabled) {
        activeCount++;
        console.log(`   ${activeCount}. ${asset.name} (${projectId})`);
        console.log(`      ETH: ${ethers.formatEther(asset.royaltyPerImportETH)}, USDC: ${ethers.formatUnits(asset.royaltyPerImportUSDC, 6)}`);
      }
    }
    
    console.log(`   Total active: ${activeCount}/${totalAssets}`);
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Checking library contracts...\n');
  
  await checkLibraries(OLD_LIBRARY, 'OLD Library (10/28)');
  await checkLibraries(NEW_LIBRARY, 'NEW Library (11/06)');
  
  console.log('\n\n📊 Summary:');
  console.log('The frontend is currently using OLD Library (10/28)');
  console.log('But Royalty Contract is using NEW Library (11/06)');
  console.log('This mismatch causes the "missing revert data" error!');
}

main();
