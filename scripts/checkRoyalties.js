/**
 * Check royalty payments and pending royalties
 * Usage: node scripts/checkRoyalties.js <walletAddress>
 */

const { ethers } = require('ethers');
require('dotenv').config();

const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS;
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const ROYALTY_CONTRACT_ABI = [
  "function getPendingRoyalties(address account) external view returns (uint256 eth, uint256 usdc)",
  "function pendingRoyaltiesETH(address) external view returns (uint256)",
  "function pendingRoyaltiesUSDC(address) external view returns (uint256)",
  "function getProjectDependencies(string projectId) external view returns (tuple(string dependencyProjectId, uint256 royaltyPercentage, uint256 fixedRoyaltyETH, uint256 fixedRoyaltyUSDC)[])",
  "function projectRoyalties(string projectId) external view returns (string projectId, tuple(string dependencyProjectId, uint256 royaltyPercentage, uint256 fixedRoyaltyETH, uint256 fixedRoyaltyUSDC)[] dependencies, bool hasRoyalties)"
];

const LIBRARY_CONTRACT_ABI = [
  "function getUserAssets(address user) external view returns (string[])",
  "function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool isActive))"
];

async function checkRoyalties(walletAddress) {
  try {
    if (!ROYALTY_CONTRACT_ADDRESS || !LIBRARY_CONTRACT_ADDRESS) {
      console.error('❌ Contract addresses not found in environment');
      process.exit(1);
    }

    console.log('🔍 Checking royalties for wallet:', walletAddress);
    console.log('📍 Royalty Contract:', ROYALTY_CONTRACT_ADDRESS);
    console.log('📍 Library Contract:', LIBRARY_CONTRACT_ADDRESS);
    console.log('🌐 RPC URL:', BASE_RPC_URL);
    console.log('');

    // Connect to Base network
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Create contract instances
    const royaltyContract = new ethers.Contract(
      ROYALTY_CONTRACT_ADDRESS,
      ROYALTY_CONTRACT_ABI,
      provider
    );
    
    const libraryContract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      provider
    );

    // 1. Check pending royalties
    console.log('💰 PENDING ROYALTIES');
    console.log('═══════════════════════════════════════');
    
    const pending = await royaltyContract.getPendingRoyalties(walletAddress);
    
    console.log('ETH:', ethers.formatEther(pending.eth), 'ETH');
    console.log('USDC:', ethers.formatUnits(pending.usdc, 6), 'USDC');
    
    if (pending.eth > 0 || pending.usdc > 0) {
      console.log('✅ Royalties available to claim!');
    } else {
      console.log('⚠️ No pending royalties');
    }
    console.log('');

    // 2. Get user's library assets
    console.log('📚 USER\'S LIBRARY ASSETS');
    console.log('═══════════════════════════════════════');
    
    const assetIds = await libraryContract.getUserAssets(walletAddress);
    console.log('Total library assets owned:', assetIds.length);
    
    for (let i = 0; i < assetIds.length; i++) {
      const assetId = assetIds[i];
      try {
        const asset = await libraryContract.getAsset(assetId);
        console.log(`\n${i + 1}. ${asset.name} (${assetId})`);
        console.log('   Royalty: ETH:', ethers.formatEther(asset.royaltyPerImportETH), 'USDC:', ethers.formatUnits(asset.royaltyPerImportUSDC, 6));
        console.log('   Current Owner:', asset.currentOwner);
        console.log('   Original Creator:', asset.originalCreator);
        console.log('   Active:', asset.isActive);
        
        // Check if this asset was used in any projects
        try {
          const dependencies = await royaltyContract.getProjectDependencies(assetId);
          if (dependencies && dependencies.length > 0) {
            console.log('   ⚠️ This asset ID appears to have dependencies (might be a project that uses libraries)');
          }
        } catch (err) {
          // Normal - this is a library asset, not a project
        }
      } catch (error) {
        console.log(`   ❌ Error fetching asset: ${error.message}`);
      }
    }
    console.log('');

    // 3. Try to check a specific project if provided
    if (process.argv[3]) {
      const projectId = process.argv[3];
      console.log('🔍 CHECKING PROJECT:', projectId);
      console.log('═══════════════════════════════════════');
      
      try {
        const dependencies = await royaltyContract.getProjectDependencies(projectId);
        
        if (dependencies && dependencies.length > 0) {
          console.log('✅ Has', dependencies.length, 'registered dependencies:');
          
          dependencies.forEach((dep, idx) => {
            console.log(`\n${idx + 1}. Dependency: ${dep.dependencyProjectId}`);
            console.log('   Fixed Royalty ETH:', ethers.formatEther(dep.fixedRoyaltyETH));
            console.log('   Fixed Royalty USDC:', ethers.formatUnits(dep.fixedRoyaltyUSDC, 6));
          });
          
          // Now check which library owners should have received royalties
          console.log('\n📊 EXPECTED ROYALTY DISTRIBUTION:');
          console.log('═══════════════════════════════════════');
          
          for (const dep of dependencies) {
            try {
              const owner = await libraryContract.getCurrentOwner(dep.dependencyProjectId);
              console.log(`\nLibrary: ${dep.dependencyProjectId}`);
              console.log('  Current Owner:', owner);
              console.log('  Should receive: ${ethers.formatEther(dep.fixedRoyaltyETH)} ETH, ${ethers.formatUnits(dep.fixedRoyaltyUSDC, 6)} USDC');
              
              // Check if owner has pending royalties
              const ownerPending = await royaltyContract.getPendingRoyalties(owner);
              console.log('  Actually pending: ${ethers.formatEther(ownerPending.eth)} ETH, ${ethers.formatUnits(ownerPending.usdc, 6)} USDC');
            } catch (error) {
              console.log(`  ❌ Error checking owner: ${error.message}`);
            }
          }
        } else {
          console.log('⚠️ No dependencies registered for this project');
          console.log('   This means registerProjectRoyalties was never called,');
          console.log('   or the registration failed.');
        }
      } catch (error) {
        console.log('❌ Error checking project dependencies:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Get wallet address from command line
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Usage: node scripts/checkRoyalties.js <walletAddress> [projectId]');
  console.error('');
  console.error('Example: node scripts/checkRoyalties.js 0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00');
  console.error('Example: node scripts/checkRoyalties.js 0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00 clay-1234567890');
  process.exit(1);
}

checkRoyalties(walletAddress);

