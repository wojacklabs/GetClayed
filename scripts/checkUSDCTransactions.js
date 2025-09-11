/**
 * Check USDC transactions for royalty contract and user
 */

const { ethers } = require('ethers');

const ROYALTY_CONTRACT = '0x9C47413D00799Bd82300131D506576D491EAAf90';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = 'https://mainnet.base.org';

const USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

async function checkUSDC(userAddress) {
  try {
    console.log('🔍 Checking USDC for royalty system');
    console.log('👤 User:', userAddress);
    console.log('📍 Royalty Contract:', ROYALTY_CONTRACT);
    console.log('💵 USDC Token:', USDC_ADDRESS);
    console.log('');

    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

    // 1. Check USDC balance of royalty contract
    console.log('💰 ROYALTY CONTRACT USDC BALANCE');
    console.log('═══════════════════════════════════════');
    const contractBalance = await usdcContract.balanceOf(ROYALTY_CONTRACT);
    console.log('Balance:', ethers.formatUnits(contractBalance, 6), 'USDC');
    console.log('');

    // 2. Check user's allowance to royalty contract
    console.log('✅ USER ALLOWANCE TO ROYALTY CONTRACT');
    console.log('═══════════════════════════════════════');
    const allowance = await usdcContract.allowance(userAddress, ROYALTY_CONTRACT);
    console.log('Allowance:', ethers.formatUnits(allowance, 6), 'USDC');
    console.log('');

    // 3. Check recent USDC transfers involving royalty contract
    console.log('📋 RECENT USDC TRANSFERS (last 24h)');
    console.log('═══════════════════════════════════════');
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 43200; // ~24 hours

    // Transfers TO royalty contract
    const toFilter = usdcContract.filters.Transfer(null, ROYALTY_CONTRACT);
    const toEvents = await usdcContract.queryFilter(toFilter, fromBlock, 'latest');
    
    console.log('Transfers TO royalty contract:', toEvents.length);
    for (const event of toEvents) {
      if ('args' in event) {
        const from = event.args[0];
        const to = event.args[1];
        const amount = ethers.formatUnits(event.args[2], 6);
        console.log(`  From ${from} → ${amount} USDC`);
        console.log(`  TX: ${event.transactionHash}`);
      }
    }
    console.log('');

    // Transfers FROM royalty contract
    const fromFilter = usdcContract.filters.Transfer(ROYALTY_CONTRACT);
    const fromEvents = await usdcContract.queryFilter(fromFilter, fromBlock, 'latest');
    
    console.log('Transfers FROM royalty contract:', fromEvents.length);
    for (const event of fromEvents) {
      if ('args' in event) {
        const from = event.args[0];
        const to = event.args[1];
        const amount = ethers.formatUnits(event.args[2], 6);
        console.log(`  To ${to} → ${amount} USDC`);
        console.log(`  TX: ${event.transactionHash}`);
      }
    }
    console.log('');

    // 4. Check USDC approvals from user
    console.log('🔐 USER APPROVALS TO ROYALTY CONTRACT');
    console.log('═══════════════════════════════════════');
    const approvalFilter = usdcContract.filters.Approval(userAddress, ROYALTY_CONTRACT);
    const approvals = await usdcContract.queryFilter(approvalFilter, fromBlock, 'latest');
    
    console.log('Approvals:', approvals.length);
    for (const event of approvals) {
      if ('args' in event) {
        const owner = event.args[0];
        const spender = event.args[1];
        const amount = ethers.formatUnits(event.args[2], 6);
        console.log(`  Approved ${amount} USDC`);
        console.log(`  TX: ${event.transactionHash}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const userAddress = process.argv[2];

if (!userAddress) {
  console.error('❌ Usage: node scripts/checkUSDCTransactions.js <userAddress>');
  console.error('');
  console.error('Example: node scripts/checkUSDCTransactions.js 0xad6c8211dfbb44b090926f6143f8daf98fc35aaa');
  process.exit(1);
}

checkUSDC(userAddress);

