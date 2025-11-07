const hre = require("hardhat");

async function main() {
  console.log("🔧 Setting approved marketplace in ClayLibrary...");
  
  const LIBRARY_CONTRACT_ADDRESS = process.env.LIBRARY_CONTRACT_ADDRESS;
  const MARKETPLACE_CONTRACT_ADDRESS = process.env.MARKETPLACE_CONTRACT_ADDRESS;
  
  if (!LIBRARY_CONTRACT_ADDRESS) {
    throw new Error("LIBRARY_CONTRACT_ADDRESS not set");
  }
  
  if (!MARKETPLACE_CONTRACT_ADDRESS) {
    throw new Error("MARKETPLACE_CONTRACT_ADDRESS not set");
  }
  
  console.log("Library Contract:", LIBRARY_CONTRACT_ADDRESS);
  console.log("Marketplace Contract:", MARKETPLACE_CONTRACT_ADDRESS);
  
  const library = await hre.ethers.getContractAt("ClayLibrary", LIBRARY_CONTRACT_ADDRESS);
  
  // Check current approval status
  const currentApproval = await library.approvedMarketplaces(MARKETPLACE_CONTRACT_ADDRESS);
  console.log("Current approval status:", currentApproval);
  
  if (currentApproval) {
    console.log("✅ Marketplace is already approved!");
    return;
  }
  
  // Approve marketplace
  console.log("Approving marketplace...");
  const tx = await library.setApprovedMarketplace(MARKETPLACE_CONTRACT_ADDRESS, true);
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  
  console.log("✅ Marketplace approved successfully!");
  
  // Verify
  const newApproval = await library.approvedMarketplaces(MARKETPLACE_CONTRACT_ADDRESS);
  console.log("New approval status:", newApproval);
  
  if (!newApproval) {
    throw new Error("Approval verification failed!");
  }
  
  console.log("");
  console.log("🎉 All done! Marketplace can now transfer asset ownership.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


