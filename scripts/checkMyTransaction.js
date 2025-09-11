const { ethers } = require("ethers");

async function checkMyTransactions() {
  const myAddress = "0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738";
  const txHash = "0x24f11a4b354123f455fdaff3cae504d719cdccd120bcb0db95ddaeb6e82c9831";
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.irys.xyz/v1/execution-rpc");
  
  console.log("=== Checking Transaction Status ===");
  console.log("Address:", myAddress);
  console.log("Transaction Hash:", txHash);
  console.log("\n");
  
  try {
    // 1. Check address balance and nonce
    console.log("1. Address Information:");
    const balance = await provider.getBalance(myAddress);
    console.log("   Balance:", ethers.formatEther(balance), "IRYS");
    
    const nonce = await provider.getTransactionCount(myAddress);
    console.log("   Total transactions sent:", nonce);
    
    // 2. Check specific transaction
    console.log("\n2. Transaction Details:");
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      console.log("   ❌ Transaction not found in mempool or blockchain!");
      console.log("   This could mean:");
      console.log("   - Transaction was never sent");
      console.log("   - Transaction was rejected by the network");
      console.log("   - Wrong RPC endpoint");
      return;
    }
    
    console.log("   From:", tx.from);
    console.log("   To:", tx.to);
    console.log("   Value:", ethers.formatEther(tx.value), "IRYS");
    console.log("   Gas limit:", tx.gasLimit.toString());
    console.log("   Block number:", tx.blockNumber || "pending");
    
    // 3. Check transaction receipt
    console.log("\n3. Transaction Receipt:");
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (receipt) {
      console.log("   Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
      console.log("   Block number:", receipt.blockNumber);
      console.log("   Gas used:", receipt.gasUsed.toString());
      console.log("   Transaction index:", receipt.transactionIndex);
      
      // Check events
      console.log("\n4. Events emitted:");
      if (receipt.logs && receipt.logs.length > 0) {
        console.log(`   Found ${receipt.logs.length} events`);
        
        // Try to decode ArticlePaymentReceived event
        const eventABI = ["event ArticlePaymentReceived(address indexed payer, uint256 amount, uint256 articleId, uint256 timestamp)"];
        const iface = new ethers.Interface(eventABI);
        
        for (const log of receipt.logs) {
          try {
            const decoded = iface.parseLog(log);
            if (decoded && decoded.name === "ArticlePaymentReceived") {
              console.log("\n   ✅ ArticlePaymentReceived event found!");
              console.log("      Payer:", decoded.args[0]);
              console.log("      Amount:", ethers.formatEther(decoded.args[1]), "IRYS");
              console.log("      Article ID:", decoded.args[2].toString());
              console.log("      Timestamp:", new Date(Number(decoded.args[3]) * 1000).toISOString());
            }
          } catch (e) {
            // Not our event
          }
        }
      } else {
        console.log("   No events found");
      }
    } else {
      console.log("   ⏳ Transaction is still pending...");
      console.log("   The transaction was sent but not yet included in a block");
    }
    
    // 4. Check network status
    console.log("\n5. Network Status:");
    const currentBlock = await provider.getBlockNumber();
    console.log("   Current block number:", currentBlock);
    
    const network = await provider.getNetwork();
    console.log("   Network chain ID:", network.chainId.toString());
    console.log("   Network name:", network.name || "unknown");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.code === 'NETWORK_ERROR') {
      console.log("\n⚠️  Network error - RPC might be down or unreachable");
    }
  }
}

checkMyTransactions();
