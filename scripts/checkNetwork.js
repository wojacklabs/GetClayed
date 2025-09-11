const { ethers } = require("ethers");

async function checkNetworkStatus() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.irys.xyz/v1/execution-rpc");
  
  console.log("=== Irys Testnet Status ===\n");
  
  try {
    // Network info
    const network = await provider.getNetwork();
    console.log("Network:");
    console.log("  Chain ID:", network.chainId.toString());
    console.log("  Name:", network.name || "Irys Testnet");
    
    // Current block
    const currentBlock = await provider.getBlockNumber();
    console.log("\nCurrent block number:", currentBlock);
    
    // Get latest block info
    const latestBlock = await provider.getBlock(currentBlock);
    console.log("\nLatest block:");
    console.log("  Number:", latestBlock.number);
    console.log("  Timestamp:", new Date(latestBlock.timestamp * 1000).toISOString());
    console.log("  Transactions:", latestBlock.transactions.length);
    
    // Check a few recent blocks
    console.log("\nRecent blocks:");
    for (let i = 0; i < 5; i++) {
      const blockNum = currentBlock - i;
      if (blockNum < 0) break;
      
      const block = await provider.getBlock(blockNum);
      if (block) {
        console.log(`  Block ${blockNum}: ${block.transactions.length} txs, ${new Date(block.timestamp * 1000).toLocaleTimeString()}`);
      }
    }
    
    // Test transaction
    console.log("\n\nTesting transaction lookup...");
    const testTxs = [
      "0x24f11a4b354123f455fdaff3cae504d719cdccd120bcb0db95ddaeb6e82c9831", // Our failed tx
      "0x380513d267be37b70cd9efdbe7246cc42b887866a67494d8ebf65503665132bd", // Last successful tx
      "0xe651cd9c365724e65ef1d93998c6b950ec5715833d90643b2a8c931bc9c3c005"  // Another attempted tx
    ];
    
    for (const txHash of testTxs) {
      console.log(`\nChecking ${txHash.slice(0, 10)}...`);
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (tx) {
        console.log("  ✅ Transaction found in mempool/blockchain");
        console.log("  Block:", tx.blockNumber || "pending");
      } else {
        console.log("  ❌ Transaction not found");
      }
      
      if (receipt) {
        console.log("  ✅ Receipt found");
        console.log("  Status:", receipt.status === 1 ? "Success" : "Failed");
        console.log("  Block:", receipt.blockNumber);
      } else {
        console.log("  ❌ No receipt (pending or not sent)");
      }
    }
    
    // Gas price
    console.log("\n\nGas Information:");
    const feeData = await provider.getFeeData();
    console.log("  Gas Price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "N/A");
    console.log("  Max Fee Per Gas:", feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : "N/A");
    console.log("  Max Priority Fee:", feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

checkNetworkStatus();
