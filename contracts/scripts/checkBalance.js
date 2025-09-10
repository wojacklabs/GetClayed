const hre = require("hardhat");

async function main() {
  console.log("💰 Checking wallet balance...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceETH = hre.ethers.formatEther(balance);
  
  console.log("📍 Address:", deployer.address);
  console.log("💵 Balance:", balanceETH, "ETH");
  console.log("");
  
  const requiredETH = 0.005;
  if (parseFloat(balanceETH) >= requiredETH) {
    console.log("✅ Sufficient balance for deployment!");
    console.log(`   Required: ${requiredETH} ETH`);
    console.log(`   Available: ${balanceETH} ETH`);
    console.log("");
    console.log("🚀 Ready to deploy! Run:");
    console.log("   npx hardhat run scripts/deploy.js --network base");
  } else {
    console.log("⚠️  Insufficient balance!");
    console.log(`   Required: ${requiredETH} ETH`);
    console.log(`   Current: ${balanceETH} ETH`);
    console.log(`   Need: ${(requiredETH - parseFloat(balanceETH)).toFixed(6)} ETH more`);
    console.log("");
    console.log("📨 Please send ETH to:");
    console.log(`   ${deployer.address}`);
    console.log("");
    console.log("🔗 Check on BaseScan:");
    console.log(`   https://basescan.org/address/${deployer.address}`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

