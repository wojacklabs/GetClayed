const hre = require("hardhat");

async function main() {
  console.log("Deploying Clay Library, Marketplace, and Royalty contracts...");
  
  // Deploy Royalty contract first
  console.log("\n1. Deploying ClayRoyalty...");
  const ClayRoyalty = await hre.ethers.getContractFactory("ClayRoyalty");
  const royalty = await ClayRoyalty.deploy();
  await royalty.waitForDeployment();
  const royaltyAddress = await royalty.getAddress();
  console.log("ClayRoyalty deployed to:", royaltyAddress);
  
  // Deploy Library contract with royalty address
  console.log("\n2. Deploying ClayLibrary...");
  const ClayLibrary = await hre.ethers.getContractFactory("ClayLibrary");
  const library = await ClayLibrary.deploy(royaltyAddress);
  await library.waitForDeployment();
  const libraryAddress = await library.getAddress();
  console.log("ClayLibrary deployed to:", libraryAddress);
  
  // Deploy Marketplace contract
  console.log("\n3. Deploying ClayMarketplace...");
  const ClayMarketplace = await hre.ethers.getContractFactory("ClayMarketplace");
  const marketplace = await ClayMarketplace.deploy(libraryAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("ClayMarketplace deployed to:", marketplaceAddress);
  
  console.log("\n=== Deployment Summary ===");
  console.log("ClayRoyalty:", royaltyAddress);
  console.log("ClayLibrary:", libraryAddress);
  console.log("ClayMarketplace:", marketplaceAddress);
  
  console.log("\n=== Environment Variables ===");
  console.log(`NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=${royaltyAddress}`);
  console.log(`NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=${libraryAddress}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  
  console.log("\n=== Verification Commands ===");
  console.log(`npx hardhat verify --network base ${royaltyAddress}`);
  console.log(`npx hardhat verify --network base ${libraryAddress} ${royaltyAddress}`);
  console.log(`npx hardhat verify --network base ${marketplaceAddress} ${libraryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

