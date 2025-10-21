const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying ClayRoyalty and ClayMarketplace...\n");
  
  const LIBRARY_ADDRESS = "0xFdF68975e992ca365aF4452f439A726522156Fb2";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("💼 Account:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  //Step 1: Deploy ClayRoyalty
  console.log("1️⃣  Deploying ClayRoyalty...");
  const ClayRoyalty = await hre.ethers.getContractFactory("ClayRoyalty");
  const royalty = await ClayRoyalty.deploy(LIBRARY_ADDRESS);
  await royalty.waitForDeployment();
  const royaltyAddress = await royalty.getAddress();
  console.log("   ✅ ClayRoyalty deployed to:", royaltyAddress);
  
  // Step 2: Set royalty in Library
  console.log("\n2️⃣  Setting royalty contract in ClayLibrary...");
  const ClayLibrary = await hre.ethers.getContractAt("ClayLibrary", LIBRARY_ADDRESS);
  const setRoyaltyTx = await ClayLibrary.setRoyaltyContract(royaltyAddress);
  await setRoyaltyTx.wait();
  console.log("   ✅ Royalty contract set");
  
  // Step 3: Deploy Marketplace
  console.log("\n3️⃣  Deploying ClayMarketplace...");
  const ClayMarketplace = await hre.ethers.getContractFactory("ClayMarketplace");
  const marketplace = await ClayMarketplace.deploy(LIBRARY_ADDRESS);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   ✅ ClayMarketplace deployed to:", marketplaceAddress);
  
  // Step 4: Approve Marketplace
  console.log("\n4️⃣  Approving Marketplace...");
  const approveTx = await ClayLibrary.setApprovedMarketplace(marketplaceAddress, true);
  await approveTx.wait();
  console.log("   ✅ Marketplace approved\n");
  
  console.log("═".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE (v3.0 - Royalty Only)!");
  console.log("═".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("   ClayLibrary     :", LIBRARY_ADDRESS);
  console.log("   ClayRoyalty     :", royaltyAddress);
  console.log("   ClayMarketplace :", marketplaceAddress);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

