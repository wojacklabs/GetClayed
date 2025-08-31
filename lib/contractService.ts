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

export async function payForUpload(provider: any): Promise<string> {
  try {
    console.log('[ContractService] Paying service fee for upload');
    
    // Try to switch to Irys testnet first (like IrysDune)
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x4F6' }], // 1270 in hex
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        // Network not added, try to add it
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
            rpcUrls: ['https://testnet-rpc.irys.xyz/v1/execution-rpc'],
            blockExplorerUrls: ['https://testnet.irysScan.io']
          }]
        });
      } else {
        throw switchError;
      }
    }
    
    // Create ethers provider (like IrysDune)
    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();
    const signerAddress = await signer.getAddress();
    console.log('[ContractService] Signer address:', signerAddress);
    
    // Check network (like IrysDune)
    const network = await ethersProvider.getNetwork();
    if (network.chainId !== BigInt(1270)) {
      throw new Error('Not connected to Irys testnet. Please switch networks.');
    }
    console.log('[ContractService] Connected to Irys testnet');
    
    // Check balance
    const balance = await ethersProvider.getBalance(signerAddress);
    const contract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, ethersProvider);
    const creationFee = await contract.ARTICLE_PRICE();
    
    console.log(`[ContractService] Account balance: ${ethers.formatEther(balance)} IRYS`);
    console.log(`[ContractService] Required fee: ${ethers.formatEther(creationFee)} IRYS`);
    
    if (balance < creationFee) {
      throw new Error(`Insufficient funds. You need at least ${ethers.formatEther(creationFee)} IRYS but have ${ethers.formatEther(balance)} IRYS`);
    }
    
    // Call contract to pay creation fee (like IrysDune)
    const contractWithSigner = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, signer);
    const tx = await contractWithSigner.payForArticle({
      value: creationFee
    });
    
    console.log('[ContractService] Payment transaction sent:', tx.hash);
    console.log('[ContractService] Check transaction status at: https://testnet.irysScan.io/tx/' + tx.hash);
    
    // Wait for confirmation (like IrysDune)
    console.log('[ContractService] Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    
    // Check if event was emitted (like IrysDune)
    const paymentEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = contractWithSigner.interface.parseLog(log);
        return parsed?.name === 'ArticlePaymentReceived';
      } catch {
        return false;
      }
    });
    
    if (!paymentEvent) {
      throw new Error('Payment verification failed - no payment event found');
    }
    
    console.log('[ContractService] Payment confirmed:', tx.hash);
    console.log('[ContractService] Payment event found:', paymentEvent);
    
    return tx.hash;
  } catch (error: any) {
    console.error('[ContractService] Error paying for upload:', error);
    
    // Handle specific errors
    if (error?.code === 'ACTION_REJECTED' || error?.message?.includes('User rejected')) {
      throw new Error('User rejected the transaction');
    }
    
    throw error;
  }
}

export async function getUploadPrice(): Promise<string> {
  try {
    // Connect to Irys testnet RPC directly
    const provider = new ethers.JsonRpcProvider(IRYS_TESTNET_RPC);
    const contract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_CONTRACT_ABI, provider);
    
    const price = await contract.ARTICLE_PRICE();
    return ethers.formatEther(price);
  } catch (error) {
    console.error('[ContractService] Error getting upload price:', error);
    return '0.1'; // Default price
  }
}