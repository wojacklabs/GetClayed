/**
 * Check if a library asset is active or deactivated
 * Usage: node scripts/checkLibraryAsset.js <projectId>
 */

const { ethers } = require('ethers');
require('dotenv').config();

const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS;
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const LIBRARY_CONTRACT_ABI = [
  "function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool isActive))"
];

async function checkLibraryAsset(projectId) {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      console.error('❌ LIBRARY_CONTRACT_ADDRESS not found in environment');
      process.exit(1);
    }

    console.log('🔍 Checking library asset...');
    console.log('📝 Project ID:', projectId);
    console.log('📍 Contract Address:', LIBRARY_CONTRACT_ADDRESS);
    console.log('🌐 RPC URL:', BASE_RPC_URL);
    console.log('');

    // Connect to Base network
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Create contract instance
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      provider
    );

    // Get asset data
    console.log('📡 Fetching asset data from blockchain...');
    const asset = await contract.getAsset(projectId);
    
    console.log('');
    console.log('✅ Asset found!');
    console.log('═══════════════════════════════════════');
    console.log('Project ID:', asset.projectId);
    console.log('Name:', asset.name);
    console.log('Description:', asset.description);
    console.log('Royalty (ETH):', ethers.formatEther(asset.royaltyPerImportETH), 'ETH');
    console.log('Royalty (USDC):', ethers.formatUnits(asset.royaltyPerImportUSDC, 6), 'USDC');
    console.log('Current Owner:', asset.currentOwner);
    console.log('Original Creator:', asset.originalCreator);
    console.log('Listed At:', new Date(Number(asset.listedAt) * 1000).toLocaleString());
    console.log('');
    console.log('🔴 IS ACTIVE:', asset.isActive ? '✅ YES (Active)' : '❌ NO (Deactivated)');
    console.log('═══════════════════════════════════════');
    
  } catch (error) {
    if (error.message.includes('Asset not found')) {
      console.error('❌ Asset not found in library contract');
      console.error('   This project was never registered in the library');
    } else {
      console.error('❌ Error checking asset:', error.message);
      console.error('');
      console.error('Full error:', error);
    }
    process.exit(1);
  }
}

// Get project ID from command line
const projectId = process.argv[2];

if (!projectId) {
  console.error('❌ Usage: node scripts/checkLibraryAsset.js <projectId>');
  console.error('');
  console.error('Example: node scripts/checkLibraryAsset.js clay-1761027754657-ednld6n0i');
  process.exit(1);
}

checkLibraryAsset(projectId);

