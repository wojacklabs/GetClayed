import { ethers, Contract } from 'ethers';

// Irys Testnet Faucet Contract
const FAUCET_CONTRACT_ADDRESS = '0x65b7fd9237df3c64461825f0c722a777d7a53804';
const FAUCET_ABI = [
  'function claim() external',
  'function canClaim(address user) external view returns (bool)',
  'function claimAmount() external view returns (uint256)',
  'function lastClaimTime(address user) external view returns (uint256)',
  'event Claimed(address indexed user, uint256 amount)'
];

export async function claimIrysTokens(provider: any): Promise<string> {
  try {
    console.log('[ContractService] Claiming IRYS tokens from faucet');
    
    // Create signer from provider
    const signer = provider.getSigner ? await provider.getSigner() : provider;
    const address = await signer.getAddress();
    
    // Connect to faucet contract
    const contract = new Contract(FAUCET_CONTRACT_ADDRESS, FAUCET_ABI, signer);
    
    // Check if user can claim
    const canClaim = await contract.canClaim(address);
    if (!canClaim) {
      const lastClaim = await contract.lastClaimTime(address);
      const lastClaimDate = new Date(Number(lastClaim) * 1000);
      throw new Error(`You can only claim once per day. Last claim: ${lastClaimDate.toLocaleString()}`);
    }
    
    // Get claim amount
    const claimAmount = await contract.claimAmount();
    console.log(`[ContractService] Claiming ${ethers.utils.formatEther(claimAmount)} IRYS`);
    
    // Execute claim
    const tx = await contract.claim();
    console.log('[ContractService] Claim transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('[ContractService] Claim confirmed:', receipt.transactionHash);
    
    return receipt.transactionHash;
  } catch (error) {
    console.error('[ContractService] Error claiming IRYS tokens:', error);
    throw error;
  }
}

export async function checkCanClaim(provider: any): Promise<boolean> {
  try {
    const signer = provider.getSigner ? await provider.getSigner() : provider;
    const address = await signer.getAddress();
    
    const contract = new Contract(FAUCET_CONTRACT_ADDRESS, FAUCET_ABI, provider);
    return await contract.canClaim(address);
  } catch (error) {
    console.error('[ContractService] Error checking claim status:', error);
    return false;
  }
}