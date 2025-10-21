const hre = require("hardhat");

async function main() {
  console.log("🛒 Deploying ClayMarketplace only...\n");
  
  const LIBRARY_ADDRESS = "0xB48d4B9067af863AAC10D2B0e213C01ef51df3a0";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("💼 Deploying with account:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  console.log("Deploying ClayMarketplace...");
  const ClayMarketplace = await hre.ethers.getContractFactory("ClayMarketplace");
  const marketplace = await ClayMarketplace.deploy(LIBRARY_ADDRESS);
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
  console.log("   ClayRoyalty     :", "0x9204F459508cD03850F53E5064E778f88C0C8D45");
  console.log("   ClayMarketplace :", marketplaceAddress);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

