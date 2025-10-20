const hre = require("hardhat");

async function main() {
  console.log("🔓 Approving Marketplace in ClayLibrary...\n");
  
  const LIBRARY_ADDRESS = "0xA742D5B85DE818F4584134717AC18930B6cAFE1e";
  const MARKETPLACE_ADDRESS = "0x1509b7F1F6FE754C16E9d0875ed324fad0d43779";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("💼 Using account:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  const ClayLibrary = await hre.ethers.getContractAt("ClayLibrary", LIBRARY_ADDRESS);
  
  console.log("Setting approval...");
  const tx = await ClayLibrary.setApprovedMarketplace(MARKETPLACE_ADDRESS, true);
  console.log("Transaction sent:", tx.hash);
  
  console.log("Waiting for confirmation...");
  await tx.wait();
  
  console.log("\n✅ Marketplace approved!");
  console.log("\n🎉 All setup complete!");
  console.log("\nContract addresses:");
  console.log("  ClayLibrary     :", LIBRARY_ADDRESS);
  console.log("  ClayRoyalty     :", "0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784");
  console.log("  ClayMarketplace :", MARKETPLACE_ADDRESS);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

