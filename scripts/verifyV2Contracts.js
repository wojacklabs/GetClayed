const { ethers } = require('ethers');

// V2 Contract addresses
const LIBRARY_ADDRESS = '0xe90BB6281B7Af6211519e5721A5b4985Ea693a49';
const ROYALTY_ADDRESS = '0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a';
const MARKETPLACE_ADDRESS = '0x7f993C490aA7934A537950dB8b5f22F8B5843884';

// Contract ABIs (minimal)
const LIBRARY_ABI = ['function royaltyContract() view returns (address)', 'function approvedMarketplaces(address) view returns (bool)'];
const MARKETPLACE_ABI = ['function royaltyContract() view returns (address)', 'function libraryContract() view returns (address)'];
const ROYALTY_ABI = ['function libraryContract() view returns (address)'];

async function main() {
  console.log("🔍 Verifying V2 Contract Links...\n");
  
  console.log("📋 Contract Addresses:");
  console.log("   Library    :", LIBRARY_ADDRESS);
  console.log("   Royalty    :", ROYALTY_ADDRESS);
  console.log("   Marketplace:", MARKETPLACE_ADDRESS);
  console.log("");
  
  // Connect to Base network
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  
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
    
    // Check Marketplace approval
    const marketplaceApproved = await library.approvedMarketplaces(MARKETPLACE_ADDRESS);
    console.log("\n5. Marketplace Approved in Library:");
    console.log("   Status  :", marketplaceApproved ? "✅ PASS" : "❌ FAIL");
    
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
