const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Clay Library, Marketplace, and Royalty contracts (Pull Pattern)...");
  console.log("📝 Using deployer from .env file (never hardcoded!)");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n💼 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  
  // Step 1: Deploy Library contract first (with zero address for royalty temporarily)
  console.log("\n1️⃣  Deploying ClayLibrary (with temporary zero royalty address)...");
  const ClayLibrary = await hre.ethers.getContractFactory("ClayLibrary");
  const library = await ClayLibrary.deploy(hre.ethers.ZeroAddress);
  await library.waitForDeployment();
  const libraryAddress = await library.getAddress();
  console.log("   ✅ ClayLibrary deployed to:", libraryAddress);
  
  // Step 2: Deploy Royalty contract with library address
  console.log("\n2️⃣  Deploying ClayRoyalty (with library address)...");
  const ClayRoyalty = await hre.ethers.getContractFactory("ClayRoyalty");
  const royalty = await ClayRoyalty.deploy(libraryAddress);
  await royalty.waitForDeployment();
  const royaltyAddress = await royalty.getAddress();
  console.log("   ✅ ClayRoyalty deployed to:", royaltyAddress);
  
  // Step 3: Update Library's royalty contract address
  console.log("\n3️⃣  Setting royalty contract in ClayLibrary...");
  const setRoyaltyTx = await library.setRoyaltyContract(royaltyAddress);
  await setRoyaltyTx.wait();
  console.log("   ✅ ClayLibrary.royaltyContract set to:", royaltyAddress);
  
  // Step 4: Deploy Marketplace contract
  console.log("\n4️⃣  Deploying ClayMarketplace...");
  const ClayMarketplace = await hre.ethers.getContractFactory("ClayMarketplace");
  const marketplace = await ClayMarketplace.deploy(libraryAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   ✅ ClayMarketplace deployed to:", marketplaceAddress);
  
  // Step 5: Approve Marketplace in Library
  console.log("\n5️⃣  Approving Marketplace in ClayLibrary...");
  const approveTx = await library.setApprovedMarketplace(marketplaceAddress, true);
  await approveTx.wait();
  console.log("   ✅ ClayMarketplace approved for ownership transfers");
  
  console.log("\n");
  console.log("═".repeat(60));
  console.log("   🎉 DEPLOYMENT COMPLETE!");
  console.log("═".repeat(60));
  
  console.log("\n📋 Contract Addresses:");
  console.log("   ClayLibrary     :", libraryAddress);
  console.log("   ClayRoyalty     :", royaltyAddress);
  console.log("   ClayMarketplace :", marketplaceAddress);
  
  console.log("\n🔧 Environment Variables (add to .env):");
  console.log(`NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=${libraryAddress}`);
  console.log(`NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=${royaltyAddress}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  
  console.log("\n📝 Verification Commands (run later):");
  console.log(`npx hardhat verify --network base ${libraryAddress} ${hre.ethers.ZeroAddress}`);
  console.log(`npx hardhat verify --network base ${royaltyAddress} ${libraryAddress}`);
  console.log(`npx hardhat verify --network base ${marketplaceAddress} ${libraryAddress}`);
  
  console.log("\n✨ Features Enabled:");
  console.log("   ✅ Pull Pattern (Claim-based royalties)");
  console.log("   ✅ Owner권한 양도 (Ownable2Step)");
  console.log("   ✅ Marketplace 승인 시스템");
  console.log("   ✅ 가격 덤핑 방지 (로열티 검증)");
  console.log("   ✅ 실시간 소유권 기반 로열티");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

