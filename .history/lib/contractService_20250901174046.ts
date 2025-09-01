import { ethers, Contract } from 'ethers';

// Payment Contract for Irys uploads
const PAYMENT_CONTRACT_ADDRESS = '0xcEFd26e34d86d07F04D21eDA589b4C81D4f4FcA4';
const IRYS_TESTNET_RPC = 'https://testnet-rpc.irys.xyz/v1/execution-rpc';
const PAYMENT_CONTRACT_ABI = [
  'function payForArticle() payable',
  'function ARTICLE_PRICE() view returns (uint256)',
  'event ArticlePaymentReceived(address indexed payer, uint256 amount, uint256 articleId, uint256 timestamp)',
  'function totalArticles() view returns (uint256)',
  'function userArticleCount(address user) view returns (uint256)'
];

async function switchToIrysTestnet(provider: any): Promise<void> {
  try {
    console.log('[ContractService] Switching to Irys testnet...');
    console.log('[ContractService] Provider for switching:', provider);
    const result = await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x4F6' }], // 1270 in hex
    });
    console.log('[ContractService] Switch result:', result);
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      // Chain not added, add it
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x4F6',
          chainName: 'Irys Testnet',
          nativeCurrency: {
            name: 'IRYS',
            symbol: 'IRYS',
            decimals: 18
          },
          rpcUrls: [IRYS_TESTNET_RPC],
          blockExplorerUrls: []
        }]
      });
    } else {
      throw switchError;
    }
  }
}

export async function payForUpload(rawProvider: any): Promise<string> {
  try {
    console.log('[ContractService] Paying service fee for upload');
    console.log('[ContractService] Raw provider:', rawProvider);
    console.log('[ContractService] Provider type:', typeof rawProvider);
    console.log('[ContractService] Has request method:', typeof rawProvider?.request);
    
    // Make sure we have a raw provider (not ethers provider)
    if (!rawProvider || typeof rawProvider.request !== 'function') {
      console.log('[ContractService] Provider does not have request method, checking for nested provider...');
      // If it's an ethers provider, try to get the underlying provider
      if (rawProvider && rawProvider.provider && typeof rawProvider.provider.request === 'function') {
        console.log('[ContractService] Found nested provider');
        rawProvider = rawProvider.provider;
      } else {
        console.log('[ContractService] No valid provider found');
        throw new Error('Invalid wallet provider - request method not found');
      }
    }
    
    // Switch to Irys testnet first
    await switchToIrysTestnet(rawProvider);
    
    // Create ethers provider after network switch
    const provider = new ethers.BrowserProvider(rawProvider);
    
    // Check network after switch
    const network = await provider.getNetwork();
    console.log('[ContractService] Current network after switch:', network);
    console.log('[ContractService] Network chainId type:', typeof network.chainId);
    console.log('[ContractService] Network chainId value:', network.chainId);
    
    if (network.chainId !== 1270n) {
      throw new Error('Not connected to Irys testnet. Please switch networks.');
    }
    
    // Create signer from provider
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    console.log('[ContractService] Signer address:', signerAddress);
    
    // Check balance before transaction
    const balance = await provider.getBalance(signerAddress);
    console.log(`[ContractService] Account balance: ${ethers.formatEther(balance)} IRYS`);
    
    // Connect to payment contract
    const contract = new Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, signer);
    
    // Get service fee from contract
    const requiredFee = await contract.ARTICLE_PRICE();
    console.log(`[ContractService] Service fee: ${ethers.formatEther(requiredFee)} IRYS`);
    
    // Check if balance is sufficient
    if (balance < requiredFee) {
      throw new Error(`Insufficient funds. You need at least ${ethers.formatEther(requiredFee)} IRYS but have ${ethers.formatEther(balance)} IRYS`);
    }
    
    // Execute payment
    const tx = await contract.payForArticle({
      value: requiredFee
    });
    console.log('[ContractService] Payment transaction sent:', tx.hash);
    console.log('[ContractService] Check transaction status at: https://testnet.irysScan.io/tx/' + tx.hash);
    
    // Wait for confirmation - Simple approach like IrysDune
    console.log('[ContractService] Waiting for transaction confirmation...');
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
  try {
    // Check network
    const network = await provider.getNetwork();
    console.log('[ContractService] Current network:', network);
    
    if (network.chainId !== BigInt(1270)) {
      console.warn('[ContractService] Not on Irys testnet, returning default service fee');
      return '0.1';
    }
    
    // Get service fee from contract
    const contract = new Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, provider);
    const price = await contract.ARTICLE_PRICE();
    const serviceFee = ethers.formatEther(price);
    console.log(`[ContractService] Service fee from contract: ${serviceFee} IRYS`);
    
    // Note: Irys storage is free for data under 100KB
    // This fee is only for the service
    return serviceFee;
  } catch (error) {
    console.error('[ContractService] Error getting service fee:', error);
    return '0.1'; // Default service fee
  }
}