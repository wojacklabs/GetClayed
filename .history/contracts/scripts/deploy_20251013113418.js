const hre = require("hardhat");

async function main() {
  console.log("Deploying Clay Library and Marketplace contracts...");
  
  // Deploy Library contract
  console.log("\n1. Deploying ClayLibrary...");
  const ClayLibrary = await hre.ethers.getContractFactory("ClayLibrary");
  const library = await ClayLibrary.deploy();
  await library.waitForDeployment();
  const libraryAddress = await library.getAddress();
  console.log("ClayLibrary deployed to:", libraryAddress);
  
  // Deploy Marketplace contract
  console.log("\n2. Deploying ClayMarketplace...");
  const ClayMarketplace = await hre.ethers.getContractFactory("ClayMarketplace");
  const marketplace = await ClayMarketplace.deploy(libraryAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("ClayMarketplace deployed to:", marketplaceAddress);
  
  console.log("\n=== Deployment Summary ===");
  console.log("ClayLibrary:", libraryAddress);
  console.log("ClayMarketplace:", marketplaceAddress);
  
  console.log("\n=== Environment Variables ===");
  console.log(`NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=${libraryAddress}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  
  console.log("\n=== Verification Commands ===");
  console.log(`npx hardhat verify --network sepolia ${libraryAddress}`);
  console.log(`npx hardhat verify --network sepolia ${marketplaceAddress} ${libraryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

