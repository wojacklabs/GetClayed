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
    
    // Create signer from provider
    const signer = provider.getSigner ? await provider.getSigner() : provider;
    
    // Connect to payment contract
    const contract = new Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, signer);
    
    // Get required fee
    const requiredFee = await contract.ARTICLE_PRICE();
    console.log(`[ContractService] Required fee: ${ethers.utils.formatEther(requiredFee)} IRYS`);
    
    // Execute payment
    const tx = await contract.payForArticle({
      value: requiredFee
    });
    console.log('[ContractService] Payment transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('[ContractService] Payment confirmed:', receipt.transactionHash);
    
    // Verify payment event
    const paymentEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'ArticlePaymentReceived';
      } catch {
        return false;
      }
    });
    
    if (!paymentEvent) {
      throw new Error('Payment verification failed');
    }
    
    return receipt.transactionHash;
  } catch (error) {
    console.error('[ContractService] Error paying for upload:', error);
    throw error;
  }
}

export async function getUploadPrice(provider: any): Promise<string> {
  try {
    const contract = new Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, provider);
    const price = await contract.ARTICLE_PRICE();
    return ethers.utils.formatEther(price);
  } catch (error) {
    console.error('[ContractService] Error getting upload price:', error);
    return '0.1';
  }
}