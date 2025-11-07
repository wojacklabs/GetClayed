const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying ClayRoyalty contract...");
  
  const LIBRARY_CONTRACT_ADDRESS = process.env.LIBRARY_CONTRACT_ADDRESS;
  
  if (!LIBRARY_CONTRACT_ADDRESS) {
    throw new Error("LIBRARY_CONTRACT_ADDRESS not set in environment");
  }
  
  console.log("Library Contract:", LIBRARY_CONTRACT_ADDRESS);
  
  // Deploy ClayRoyalty
  const ClayRoyalty = await hre.ethers.getContractFactory("ClayRoyalty");
  const royalty = await ClayRoyalty.deploy(LIBRARY_CONTRACT_ADDRESS);
  
  await royalty.waitForDeployment();
  
  const royaltyAddress = await royalty.getAddress();
  
  console.log("✅ ClayRoyalty deployed to:", royaltyAddress);
  console.log("");
  console.log("📋 Next steps:");
  console.log("1. Update .env:");
  console.log(`   NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=${royaltyAddress}`);
  console.log("");
  console.log("2. Deploy ClayMarketplace with this new address");
  console.log("3. Update ClayLibrary's royaltyContract:");
  console.log(`   await library.setRoyaltyContract("${royaltyAddress}")`);
  console.log("");
  console.log("🔍 Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${royaltyAddress} ${LIBRARY_CONTRACT_ADDRESS}`);
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    contract: "ClayRoyalty",
    address: royaltyAddress,
    libraryContract: LIBRARY_CONTRACT_ADDRESS,
    deployedAt: new Date().toISOString(),
    deployer: (await hre.ethers.getSigners())[0].address,
    network: hre.network.name,
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };
  
  fs.writeFileSync(
    'deployments/ClayRoyalty_latest.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("");
  console.log("💾 Deployment info saved to deployments/ClayRoyalty_latest.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


