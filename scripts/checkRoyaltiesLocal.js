/**
 * Check royalty payments using .env.local addresses
 */

const { ethers } = require('ethers');

// Use .env.local addresses directly
const ROYALTY_CONTRACT_ADDRESS = '0x9C47413D00799Bd82300131D506576D491EAAf90';
const LIBRARY_CONTRACT_ADDRESS = '0xFdF68975e992ca365aF4452f439A726522156Fb2';
const BASE_RPC_URL = 'https://mainnet.base.org';

const ROYALTY_CONTRACT_ABI = [
  "function getPendingRoyalties(address account) external view returns (uint256 eth, uint256 usdc)",
  "function getProjectDependencies(string projectId) external view returns (tuple(string dependencyProjectId, uint256 royaltyPercentage, uint256 fixedRoyaltyETH, uint256 fixedRoyaltyUSDC)[])"
];

const LIBRARY_CONTRACT_ABI = [
  "function getCurrentOwner(string memory projectId) external view returns (address)",
  "function getUserAssets(address user) external view returns (string[])"
];

async function checkRoyalties(walletAddress, projectId) {
  try {
    console.log('🔍 Checking royalties (using .env.local addresses)');
    console.log('📍 Royalty Contract:', ROYALTY_CONTRACT_ADDRESS);
    console.log('📍 Library Contract:', LIBRARY_CONTRACT_ADDRESS);
    console.log('');

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
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

    // Check pending royalties
    console.log('💰 PENDING ROYALTIES for', walletAddress);
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

    // Check project if provided
    if (projectId) {
      console.log('🔍 CHECKING PROJECT:', projectId);
      console.log('═══════════════════════════════════════');
      
      try {
        const dependencies = await royaltyContract.getProjectDependencies(projectId);
        
        if (dependencies && dependencies.length > 0) {
          console.log('✅ Has', dependencies.length, 'registered dependencies:');
          console.log('');
          
          for (let i = 0; i < dependencies.length; i++) {
            const dep = dependencies[i];
            console.log(`${i + 1}. Dependency: ${dep.dependencyProjectId}`);
            console.log(`   Fixed Royalty ETH: ${ethers.formatEther(dep.fixedRoyaltyETH)}`);
            console.log(`   Fixed Royalty USDC: ${ethers.formatUnits(dep.fixedRoyaltyUSDC, 6)}`);
            
            // Get current owner
            try {
              const owner = await libraryContract.getCurrentOwner(dep.dependencyProjectId);
              console.log(`   Current Owner: ${owner}`);
              
              // Check owner's pending
              const ownerPending = await royaltyContract.getPendingRoyalties(owner);
              console.log(`   Owner's Pending: ${ethers.formatEther(ownerPending.eth)} ETH, ${ethers.formatUnits(ownerPending.usdc, 6)} USDC`);
            } catch (err) {
              console.log(`   ❌ Could not get owner: ${err.message}`);
            }
            console.log('');
          }
        } else {
          console.log('⚠️ No dependencies registered for this project');
          console.log('');
          console.log('📋 This means one of the following:');
          console.log('   1. registerProjectRoyalties was NEVER called');
          console.log('   2. Transaction was sent but FAILED');
          console.log('   3. User REJECTED the transaction');
          console.log('   4. ROYALTY_CONTRACT_ADDRESS was undefined in the frontend');
          console.log('');
          console.log('💡 Most likely: The old code had:');
          console.log('   if (ROYALTY_CONTRACT_ADDRESS) { ... }');
          console.log('   If undefined, it skipped royalty processing but returned success!');
        }
      } catch (error) {
        console.log('❌ Error checking project:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const walletAddress = process.argv[2];
const projectId = process.argv[3];

if (!walletAddress) {
  console.error('❌ Usage: node scripts/checkRoyaltiesLocal.js <walletAddress> [projectId]');
  process.exit(1);
}

checkRoyalties(walletAddress, projectId);

