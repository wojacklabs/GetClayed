const fs = require('fs');
const path = require('path');

// Extract ABIs from artifacts and save to frontend lib directory
async function main() {
  console.log("📋 Extracting ABIs for frontend...");
  
  const contracts = ['ClayLibrary', 'ClayRoyalty', 'ClayMarketplace'];
  const outputDir = path.join(__dirname, '../../lib/abis');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (const contractName of contracts) {
    try {
      const artifactPath = path.join(__dirname, `../artifacts/${contractName}.sol/${contractName}.json`);
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      
      // Save full ABI
      const abiPath = path.join(outputDir, `${contractName}.json`);
      fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
      console.log(`   ✅ ${contractName} ABI saved to ${abiPath}`);
      
      // Also create a simplified ABI for specific functions we use
      if (contractName === 'ClayLibrary') {
        const simplifiedABI = artifact.abi.filter(item => 
          ['registerAsset', 'getAsset', 'getLibraryDependencies', 'getRoyaltyFee', 
           'getCurrentOwner', 'transferAssetOwnership', 'setApprovedMarketplace'].includes(item.name)
        );
        fs.writeFileSync(
          path.join(outputDir, 'ClayLibrarySimplified.json'), 
          JSON.stringify(simplifiedABI, null, 2)
        );
      }
      
      if (contractName === 'ClayRoyalty') {
        const simplifiedABI = artifact.abi.filter(item => 
          ['registerProjectRoyalties', 'recordRoyalties', 'calculateTotalRoyalties',
           'claimRoyalties', 'getPendingRoyalties', 'distributeNestedRoyalties'].includes(item.name)
        );
        fs.writeFileSync(
          path.join(outputDir, 'ClayRoyaltySimplified.json'), 
          JSON.stringify(simplifiedABI, null, 2)
        );
      }
      
    } catch (error) {
      console.error(`   ❌ Error extracting ${contractName} ABI:`, error);
    }
  }
  
  console.log("\n📝 Remember to update the ABI imports in:");
  console.log("   - lib/libraryService.ts");
  console.log("   - lib/royaltyService.ts");
  console.log("   - lib/marketplaceService.ts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
