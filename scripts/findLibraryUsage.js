/**
 * Find projects that use a specific library
 */

const { ethers } = require('ethers');
require('dotenv').config();

const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const ROYALTY_CONTRACT_ABI = [
  "function getProjectDependencies(string projectId) external view returns (tuple(string dependencyProjectId, uint256 royaltyPercentage, uint256 fixedRoyaltyETH, uint256 fixedRoyaltyUSDC)[])",
  "event RoyaltiesRegistered(string indexed projectId, uint256 dependencyCount)",
  "event RoyaltyRecorded(string indexed projectId, address indexed recipient, uint256 amountETH, uint256 amountUSDC)"
];

async function findLibraryUsage(libraryProjectId) {
  try {
    if (!ROYALTY_CONTRACT_ADDRESS) {
      console.error('❌ ROYALTY_CONTRACT_ADDRESS not found');
      process.exit(1);
    }

    console.log('🔍 Finding projects that use library:', libraryProjectId);
    console.log('📍 Royalty Contract:', ROYALTY_CONTRACT_ADDRESS);
    console.log('');

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(
      ROYALTY_CONTRACT_ADDRESS,
      ROYALTY_CONTRACT_ABI,
      provider
    );

    // Get recent blocks (last 24 hours)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 43200); // ~24 hours on Base
    
    console.log('📡 Scanning blocks', fromBlock, 'to', currentBlock);
    console.log('');

    // Get all RoyaltiesRegistered events
    const registeredFilter = contract.filters.RoyaltiesRegistered();
    console.log('Fetching registration events...');
    const registeredEvents = await contract.queryFilter(registeredFilter, fromBlock, 'latest');
    
    console.log('Found', registeredEvents.length, 'project registrations in last 24h');
    console.log('═══════════════════════════════════════');
    console.log('');

    // Check each registered project
    for (const event of registeredEvents) {
      if ('args' in event) {
        const projectId = event.args[0];
        const depCount = Number(event.args[1]);
        const block = await event.getBlock();
        
        console.log('📦 Project:', projectId);
        console.log('   Registered at:', new Date(block.timestamp * 1000).toLocaleString());
        console.log('   Dependencies:', depCount);
        console.log('   TX:', event.transactionHash);
        
        // Get dependencies
        try {
          const dependencies = await contract.getProjectDependencies(projectId);
          
          let usesTargetLibrary = false;
          dependencies.forEach((dep, idx) => {
            console.log(`   ${idx + 1}. ${dep.dependencyProjectId}`);
            console.log(`      Royalty: ${ethers.formatEther(dep.fixedRoyaltyETH)} ETH, ${ethers.formatUnits(dep.fixedRoyaltyUSDC, 6)} USDC`);
            
            if (dep.dependencyProjectId === libraryProjectId) {
              usesTargetLibrary = true;
            }
          });
          
          if (usesTargetLibrary) {
            console.log('   ✅ ✅ ✅ USES TARGET LIBRARY! ✅ ✅ ✅');
            
            // Get RoyaltyRecorded events for this project
            const recordedFilter = contract.filters.RoyaltyRecorded(projectId);
            const recordedEvents = await contract.queryFilter(recordedFilter, fromBlock, 'latest');
            
            if (recordedEvents.length > 0) {
              console.log('\n   💰 ROYALTY PAYMENTS:');
              for (const payEvent of recordedEvents) {
                if ('args' in payEvent) {
                  const recipient = payEvent.args[1];
                  const amountETH = ethers.formatEther(payEvent.args[2]);
                  const amountUSDC = ethers.formatUnits(payEvent.args[3], 6);
                  
                  console.log(`      Recipient: ${recipient}`);
                  console.log(`      Amount: ${amountETH} ETH, ${amountUSDC} USDC`);
                  console.log(`      TX: ${payEvent.transactionHash}`);
                }
              }
            } else {
              console.log('\n   ⚠️ NO ROYALTY PAYMENT RECORDED!');
              console.log('      registerProjectRoyalties was called,');
              console.log('      but recordRoyalties was NOT called.');
            }
          }
        } catch (error) {
          console.log('   ❌ Error getting dependencies:', error.message);
        }
        
        console.log('');
      }
    }
    
    if (registeredEvents.length === 0) {
      console.log('⚠️ No project registrations found in the last 24 hours');
      console.log('   This could mean:');
      console.log('   1. No projects with libraries were uploaded');
      console.log('   2. registerProjectRoyalties transactions failed');
      console.log('   3. Need to check earlier blocks');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

const libraryProjectId = process.argv[2];

if (!libraryProjectId) {
  console.error('❌ Usage: node scripts/findLibraryUsage.js <libraryProjectId>');
  console.error('');
  console.error('Example: node scripts/findLibraryUsage.js clay-1761027754657-ednld6n0i');
  process.exit(1);
}

findLibraryUsage(libraryProjectId);

