const { ethers } = require("ethers");

async function checkRecentTransactions() {
  const myAddress = "0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738";
  const contractAddress = "0xcEFd26e34d86d07F04D21eDA589b4C81D4f4FcA4"; // IrysPayment contract
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.irys.xyz/v1/execution-rpc");
  
  console.log("=== Checking Recent Activity ===");
  console.log("My Address:", myAddress);
  console.log("Contract Address:", contractAddress);
  console.log("\n");
  
  try {
    // Check current state
    const balance = await provider.getBalance(myAddress);
    console.log("Current balance:", ethers.formatEther(balance), "IRYS");
    
    // Check contract
    const contractABI = [
      "function ARTICLE_PRICE() view returns (uint256)",
      "function totalArticles() view returns (uint256)",
      "function userArticleCount(address) view returns (uint256)",
      "function getBalance() view returns (uint256)",
      "event ArticlePaymentReceived(address indexed payer, uint256 amount, uint256 articleId, uint256 timestamp)"
    ];
    
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    console.log("\nContract Information:");
    const articlePrice = await contract.ARTICLE_PRICE();
    console.log("Article Price:", ethers.formatEther(articlePrice), "IRYS");
    
    const totalArticles = await contract.totalArticles();
    console.log("Total Articles:", totalArticles.toString());
    
    const myArticleCount = await contract.userArticleCount(myAddress);
    console.log("My Article Count:", myArticleCount.toString());
    
    const contractBalance = await contract.getBalance();
    console.log("Contract Balance:", ethers.formatEther(contractBalance), "IRYS");
    
    // Check recent events from this address
    console.log("\nChecking recent payment events from my address...");
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks
    
    const filter = contract.filters.ArticlePaymentReceived(myAddress);
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} payment events from my address`);
    
    if (events.length > 0) {
      console.log("\nRecent payments:");
      for (const event of events.slice(-5)) { // Show last 5
        console.log(`\nBlock ${event.blockNumber}:`);
        console.log(`  TX Hash: ${event.transactionHash}`);
        console.log(`  Article ID: ${event.args[2].toString()}`);
        console.log(`  Amount: ${ethers.formatEther(event.args[1])} IRYS`);
        console.log(`  Timestamp: ${new Date(Number(event.args[3]) * 1000).toISOString()}`);
      }
    }
    
    // Check all recent events to see contract activity
    console.log("\n\nChecking all recent contract activity...");
    const allFilter = contract.filters.ArticlePaymentReceived();
    const allEvents = await contract.queryFilter(allFilter, currentBlock - 1000, currentBlock);
    
    console.log(`Found ${allEvents.length} total payment events in last 1000 blocks`);
    
    if (allEvents.length > 0) {
      console.log("\nLast 3 payments to contract:");
      for (const event of allEvents.slice(-3)) {
        console.log(`\nBlock ${event.blockNumber}:`);
        console.log(`  Payer: ${event.args[0]}`);
        console.log(`  TX Hash: ${event.transactionHash}`);
        console.log(`  Article ID: ${event.args[2].toString()}`);
      }
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

checkRecentTransactions();
