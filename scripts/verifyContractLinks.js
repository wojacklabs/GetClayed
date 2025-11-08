const { ethers } = require('ethers');

const LIBRARY_ADDRESS = '0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4';
const ROYALTY_ADDRESS = '0x3Fae9E45FF52aD4338182b82CEC7e3e30F74b929';
const BASE_RPC_URL = 'https://mainnet.base.org';

const ROYALTY_ABI = [
  'function libraryContract() external view returns (address)',
  'function getProjectDependencies(string projectId) external view returns (tuple(string dependencyProjectId, uint256 royaltyPercentage, uint256 fixedRoyaltyETH, uint256 fixedRoyaltyUSDC)[])'
];

const LIBRARY_ABI = [
  'function getRoyaltyFee(string projectId) external view returns (uint256 royaltyETH, uint256 royaltyUSDC)',
  'function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))'
];

async function verify() {
  try {
    console.log('🔍 Verifying contract configuration...\n');
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Check Royalty Contract
    console.log('📍 Royalty Contract:', ROYALTY_ADDRESS);
    const royaltyContract = new ethers.Contract(ROYALTY_ADDRESS, ROYALTY_ABI, provider);
    
    try {
      const linkedLibraryAddress = await royaltyContract.libraryContract();
      console.log('   → Linked Library Contract:', linkedLibraryAddress);
      
      if (linkedLibraryAddress.toLowerCase() !== LIBRARY_ADDRESS.toLowerCase()) {
        console.log('   ⚠️  WARNING: Royalty contract points to different Library!');
        console.log('   Expected:', LIBRARY_ADDRESS);
        console.log('   Actual:  ', linkedLibraryAddress);
      } else {
        console.log('   ✅ Correctly linked\n');
      }
    } catch (error) {
      console.log('   ❌ Failed to read libraryContract():', error.message);
    }
    
    // Check Library Contract
    console.log('📍 Library Contract:', LIBRARY_ADDRESS);
    const libraryContract = new ethers.Contract(LIBRARY_ADDRESS, LIBRARY_ABI, provider);
    
    try {
      const testProjectId = 'clay-1761204239818-kqn059jib';
      console.log(`   Testing with project: ${testProjectId}`);
      
      const [royaltyETH, royaltyUSDC] = await libraryContract.getRoyaltyFee(testProjectId);
      console.log('   → getRoyaltyFee result:', {
        eth: ethers.formatEther(royaltyETH),
        usdc: ethers.formatUnits(royaltyUSDC, 6)
      });
      
      const asset = await libraryContract.getAsset(testProjectId);
      console.log('   → Asset exists:', asset.exists);
      console.log('   → Royalty enabled:', asset.royaltyEnabled);
      console.log('   ✅ Library contract is accessible\n');
    } catch (error) {
      console.log('   ❌ Failed to call Library contract:', error.message);
    }
    
    // Try to query a test project dependencies
    try {
      const testProjectId = 'clay-1762611003104-lp0s7srqx';
      console.log('📍 Testing registerProjectRoyalties simulation');
      console.log(`   Project: ${testProjectId}`);
      console.log(`   Dependencies: ['clay-1761204239818-kqn059jib']`);
      
      // Check if already registered
      const deps = await royaltyContract.getProjectDependencies(testProjectId);
      console.log('   → Existing dependencies:', deps.length);
      
      if (deps.length > 0) {
        console.log('   ⚠️  Project already registered!');
      } else {
        console.log('   ✅ Project not yet registered (ready for new registration)');
      }
    } catch (error) {
      console.log('   ❌ Failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verify();

