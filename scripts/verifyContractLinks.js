const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABIs (minimal)
const LIBRARY_ABI = ['function royaltyContract() view returns (address)'];
const MARKETPLACE_ABI = ['function royaltyContract() view returns (address)', 'function libraryContract() view returns (address)'];
const ROYALTY_ABI = ['function libraryContract() view returns (address)'];

async function main() {
  console.log("🔍 Verifying Contract Links...\n");
  
  const LIBRARY_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS;
  const ROYALTY_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
  const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS;
  
  if (!LIBRARY_ADDRESS || !ROYALTY_ADDRESS || !MARKETPLACE_ADDRESS) {
    console.error("❌ Missing contract addresses in environment");
    return;
  }
  
  console.log("📋 Contract Addresses:");
  console.log("   Library    :", LIBRARY_ADDRESS);
  console.log("   Royalty    :", ROYALTY_ADDRESS);
  console.log("   Marketplace:", MARKETPLACE_ADDRESS);
  console.log("");
  
  // Connect to Base network
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  
  // Create contract instances
  const library = new ethers.Contract(LIBRARY_ADDRESS, LIBRARY_ABI, provider);
  const royalty = new ethers.Contract(ROYALTY_ADDRESS, ROYALTY_ABI, provider);
  const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);
  
  console.log("🔗 Verifying Contract Links:");
  
  try {
    // Check Library -> Royalty link
    const libraryRoyaltyLink = await library.royaltyContract();
    console.log("\n1. Library -> Royalty:");
    console.log("   Expected:", ROYALTY_ADDRESS);
    console.log("   Actual  :", libraryRoyaltyLink);
    console.log("   Status  :", libraryRoyaltyLink.toLowerCase() === ROYALTY_ADDRESS.toLowerCase() ? "✅ PASS" : "❌ FAIL");
    
    // Check Royalty -> Library link
    const royaltyLibraryLink = await royalty.libraryContract();
    console.log("\n2. Royalty -> Library:");
    console.log("   Expected:", LIBRARY_ADDRESS);
    console.log("   Actual  :", royaltyLibraryLink);
    console.log("   Status  :", royaltyLibraryLink.toLowerCase() === LIBRARY_ADDRESS.toLowerCase() ? "✅ PASS" : "❌ FAIL");
    
    // Check Marketplace -> Library link
    const marketplaceLibraryLink = await marketplace.libraryContract();
    console.log("\n3. Marketplace -> Library:");
    console.log("   Expected:", LIBRARY_ADDRESS);
    console.log("   Actual  :", marketplaceLibraryLink);
    console.log("   Status  :", marketplaceLibraryLink.toLowerCase() === LIBRARY_ADDRESS.toLowerCase() ? "✅ PASS" : "❌ FAIL");
    
    // Check Marketplace -> Royalty link
    const marketplaceRoyaltyLink = await marketplace.royaltyContract();
    console.log("\n4. Marketplace -> Royalty:");
    console.log("   Expected:", ROYALTY_ADDRESS);
    console.log("   Actual  :", marketplaceRoyaltyLink);
    console.log("   Status  :", marketplaceRoyaltyLink.toLowerCase() === ROYALTY_ADDRESS.toLowerCase() ? "✅ PASS" : "❌ FAIL");
    
    console.log("\n✨ Verification complete!");
    
  } catch (error) {
    console.error("\n❌ Error verifying contracts:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });