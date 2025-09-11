const { ethers } = require('ethers');

async function check() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const usdcContract = new ethers.Contract(
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    [
      'function balanceOf(address) view returns (uint256)', 
      'function allowance(address,address) view returns (uint256)'
    ],
    provider
  );
  
  console.log('🔍 Checking USDC balances and allowances');
  console.log('');
  
  const contractBalance = await usdcContract.balanceOf('0x9C47413D00799Bd82300131D506576D491EAAf90');
  console.log('💰 Royalty Contract USDC Balance:', ethers.formatUnits(contractBalance, 6), 'USDC');
  
  const payerAddress = '0xad6c8211dfbb44b090926f6143f8daf98fc35aaa';
  const allowance = await usdcContract.allowance(payerAddress, '0x9C47413D00799Bd82300131D506576D491EAAf90');
  console.log('');
  console.log('✅ Payer (0xad6c82...) Allowance:', ethers.formatUnits(allowance, 6), 'USDC');
  console.log('   → This means approve() was called but transferFrom() was NOT');
  console.log('');
  
  const payerBalance = await usdcContract.balanceOf(payerAddress);
  console.log('💵 Payer USDC Balance:', ethers.formatUnits(payerBalance, 6), 'USDC');
}

check();

