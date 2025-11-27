const hre = require("hardhat");

async function main() {
  console.log("🛒 Deploying ClayMarketplace V3 (with direct ownership support)...\n");
  
  // Current production addresses (from .env)
  const LIBRARY_ADDRESS = "0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4";
  const ROYALTY_ADDRESS = "0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("💼 Deploying with account:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  console.log("Deploying ClayMarketplace (SECURITY FIX: with royalty contract)...");
  const ClayMarketplace = await hre.ethers.getContractFactory("ClayMarketplace");
  const marketplace = await ClayMarketplace.deploy(LIBRARY_ADDRESS, ROYALTY_ADDRESS);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("✅ ClayMarketplace deployed to:", marketplaceAddress);
  
  console.log("\nApproving Marketplace in ClayLibrary...");
  const ClayLibrary = await hre.ethers.getContractAt("ClayLibrary", LIBRARY_ADDRESS);
  const approveTx = await ClayLibrary.setApprovedMarketplace(marketplaceAddress, true);
  await approveTx.wait();
  console.log("✅ Marketplace approved\n");
  
  console.log("═".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("═".repeat(60));
  console.log("\n📋 All Addresses:");
  console.log("   ClayLibrary     :", LIBRARY_ADDRESS);
  console.log("   ClayRoyalty     :", ROYALTY_ADDRESS);
  console.log("   ClayMarketplace :", marketplaceAddress);
  console.log("\n📝 Update .env with:");
  console.log(`   NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

