const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.local' });

const OLD_LIBRARY = '0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4';
const NEW_LIBRARY = '0xA742D5B85DE818F4584134717AC18930B6cAFE1e';
const BASE_RPC_URL = 'https://mainnet.base.org';

const OLD_LIBRARY_ABI = [
  'function getTotalAssets() external view returns (uint256)',
  'function getAssetIdByIndex(uint256 index) external view returns (string)',
  'function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))'
];

const NEW_LIBRARY_ABI = [
  'function registerAsset(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC) external',
  'function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))',
  'function getTotalAssets() external view returns (uint256)'
];

async function migrateLibraries() {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ PRIVATE_KEY not found in .env.local');
      return;
    }
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('🔄 Migrating libraries from OLD to NEW contract...\n');
    console.log('Deployer wallet:', wallet.address);
    console.log('');
    
    // Read from OLD
    const oldContract = new ethers.Contract(OLD_LIBRARY, OLD_LIBRARY_ABI, provider);
    const totalAssets = await oldContract.getTotalAssets();
    console.log(`📚 Found ${totalAssets} libraries in OLD contract\n`);
    
    // Write to NEW
    const newContract = new ethers.Contract(NEW_LIBRARY, NEW_LIBRARY_ABI, wallet);
    
    for (let i = 0; i < totalAssets; i++) {
      const projectId = await oldContract.getAssetIdByIndex(i);
      const asset = await oldContract.getAsset(projectId);
      
      if (!asset.exists) {
        console.log(`⏭️  Skipping deleted: ${projectId}`);
        continue;
      }
      
      // Check if already exists in NEW
      try {
        const existingAsset = await newContract.getAsset(projectId);
        if (existingAsset.exists) {
          console.log(`✅ Already migrated: ${asset.name} (${projectId})`);
          continue;
        }
      } catch (e) {
        // Doesn't exist, proceed with migration
      }
      
      console.log(`\n📝 Migrating: ${asset.name}`);
      console.log(`   ID: ${projectId}`);
      console.log(`   ETH: ${ethers.formatEther(asset.royaltyPerImportETH)}`);
      console.log(`   USDC: ${ethers.formatUnits(asset.royaltyPerImportUSDC, 6)}`);
      
      // Register in NEW contract
      try {
        const tx = await newContract.registerAsset(
          projectId,
          asset.name,
          asset.description,
          asset.royaltyPerImportETH,
          asset.royaltyPerImportUSDC
        );
        
        console.log(`   TX: ${tx.hash}`);
        console.log(`   ⏳ Waiting for confirmation...`);
        
        await tx.wait();
        console.log(`   ✅ Migrated successfully`);
        
      } catch (error) {
        console.error(`   ❌ Migration failed:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete!');
    console.log('='.repeat(60));
    
    // Verify
    const newTotal = await newContract.getTotalAssets();
    console.log(`\nNEW Library now has ${newTotal} libraries`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

migrateLibraries();

<<<<<<< Updated upstream







=======
>>>>>>> Stashed changes


