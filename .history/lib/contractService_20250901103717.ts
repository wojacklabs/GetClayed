import { ethers, Contract } from 'ethers';

// Payment Contract for Irys uploads
const PAYMENT_CONTRACT_ADDRESS = '0xcEFd26e34d86d07F04D21eDA589b4C81D4f4FcA4';
const PAYMENT_CONTRACT_ABI = [
  'function payForArticle() payable',
  'function ARTICLE_PRICE() view returns (uint256)',
  'event ArticlePaymentReceived(address indexed payer, uint256 amount, uint256 articleId, uint256 timestamp)',
  'function totalArticles() view returns (uint256)',
  'function userArticleCount(address user) view returns (uint256)'
];

export async function payForUpload(provider: any): Promise<string> {
  try {
    console.log('[ContractService] Paying for Irys upload');
    
    // Check network
    const network = await provider.getNetwork();
    console.log('[ContractService] Current network:', network);
    
    if (network.chainId !== BigInt(1270)) {
      throw new Error('Please switch to Irys testnet (chainId: 1270)');
    }
    
    // Create signer from provider
    const signer = provider.getSigner ? await provider.getSigner() : provider;
    
    // Connect to payment contract
    const contract = new Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, signer);
    
    // Fixed fee: 0.1 IRYS
    const requiredFee = ethers.parseEther('0.1');
    console.log('[ContractService] Contract fee: 0.1 IRYS');
    
    // Execute payment
    const tx = await contract.payForArticle({
      value: requiredFee
    });
    console.log('[ContractService] Payment transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('[ContractService] Payment receipt:', receipt);
    console.log('[ContractService] Payment confirmed:', tx.hash);
    
    // Verify payment event
    const paymentEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        return parsed?.name === 'ArticlePaymentReceived';
      } catch {
        return false;
      }
    });
    
    if (!paymentEvent) {
      throw new Error('Payment verification failed');
    }
    
    return tx.hash;
  } catch (error) {
    console.error('[ContractService] Error paying for upload:', error);
    throw error;
  }
}

export async function getUploadPrice(provider: any): Promise<string> {
  // Irys uploads under 100KB are free
  // We only need to pay the contract fee
  return '0.1';
}