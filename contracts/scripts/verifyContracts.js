const hre = require("hardhat");

async function main() {
  console.log("🔍 Verifying deployed contracts on BaseScan...");
  
  const LIBRARY_ADDRESS = process.env.LIBRARY_CONTRACT_ADDRESS;
  const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_CONTRACT_ADDRESS;
  const ROYALTY_ADDRESS = process.env.ROYALTY_CONTRACT_ADDRESS;
  
  // Verify ClayRoyalty
  if (ROYALTY_ADDRESS && LIBRARY_ADDRESS) {
    console.log("\n📋 Verifying ClayRoyalty...");
    try {
      await hre.run("verify:verify", {
        address: ROYALTY_ADDRESS,
        constructorArguments: [LIBRARY_ADDRESS],
      });
      console.log("✅ ClayRoyalty verified!");
    } catch (error) {
      console.log("⚠️ ClayRoyalty verification failed:", error.message);
    }
  }
  
  // Verify ClayMarketplace
  if (MARKETPLACE_ADDRESS && LIBRARY_ADDRESS && ROYALTY_ADDRESS) {
    console.log("\n📋 Verifying ClayMarketplace...");
    try {
      await hre.run("verify:verify", {
        address: MARKETPLACE_ADDRESS,
        constructorArguments: [LIBRARY_ADDRESS, ROYALTY_ADDRESS],
      });
      console.log("✅ ClayMarketplace verified!");
    } catch (error) {
      console.log("⚠️ ClayMarketplace verification failed:", error.message);
    }
  }
  
  console.log("\n🎉 Verification complete!");
  console.log("\n📊 View on BaseScan:");
  if (LIBRARY_ADDRESS) {
    console.log(`Library: https://basescan.org/address/${LIBRARY_ADDRESS}`);
  }
  if (MARKETPLACE_ADDRESS) {
    console.log(`Marketplace: https://basescan.org/address/${MARKETPLACE_ADDRESS}`);
  }
  if (ROYALTY_ADDRESS) {
    console.log(`Royalty: https://basescan.org/address/${ROYALTY_ADDRESS}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


