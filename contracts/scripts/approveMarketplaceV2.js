const hre = require("hardhat");

async function main() {
  const LIBRARY_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS || "0xe90BB6281B7Af6211519e5721A5b4985Ea693a49";
  const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS || "0x7f993C490aA7934A537950dB8b5f22F8B5843884";
  
  console.log("🔧 Approving Marketplace in ClayLibrary...");
  console.log("   Library:", LIBRARY_ADDRESS);
  console.log("   Marketplace:", MARKETPLACE_ADDRESS);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("   Using account:", deployer.address);
  
  const library = await hre.ethers.getContractAt("ClayLibrary", LIBRARY_ADDRESS);
  
  // Wait a bit to avoid nonce issues
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    const tx = await library.setApprovedMarketplace(MARKETPLACE_ADDRESS, true);
    console.log("   Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("   ✅ Marketplace approved! Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.error("   ❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
