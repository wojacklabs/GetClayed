import { ethers } from 'ethers';
import { getErrorMessage } from './errorHandler';

async function getWalletProvider() {
  if (typeof window === 'undefined') {
    throw new Error('Window not available');
  }
  
  // Try window.ethereum first (works with Privy)
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) {
    console.error('[RoyaltyClaimService] No ethereum provider found');
    throw new Error('Please connect your wallet first.');
  }
  
  console.log('[RoyaltyClaimService] Using window.ethereum provider');
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  
  return { provider, signer };
}

const ROYALTY_CONTRACT_ABI = [
  'function getPendingRoyalties(address account) external view returns (uint256 eth, uint256 usdc)',
  'function claimRoyaltiesETH() external',
  'function claimRoyaltiesUSDC() external',
  'function pendingRoyaltiesETH(address) external view returns (uint256)',
  'function pendingRoyaltiesUSDC(address) external view returns (uint256)'
];

export interface PendingRoyalties {
  eth: string; // in ETH
  usdc: string; // in USDC
}

export interface RoyaltyEvent {
  projectId: string;
  projectName: string;
  recipient: string;
  amountETH: string;
  amountUSDC: string;
  timestamp: number;
  txHash?: string;
  type: 'earned' | 'paid';
  payer?: string;
}

/**
 * Get pending royalties for a user
 */
export async function getPendingRoyalties(userAddress: string): Promise<PendingRoyalties> {
  try {
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
    
    console.log('[RoyaltyClaimService] Getting pending royalties for:', userAddress);
    console.log('[RoyaltyClaimService] Royalty contract address:', ROYALTY_CONTRACT_ADDRESS);
    
    if (!ROYALTY_CONTRACT_ADDRESS) {
      console.error('[RoyaltyClaimService] ❌ Royalty contract address not configured');
      return { eth: '0', usdc: '0' };
    }
    
    if (typeof window === 'undefined') {
      console.error('[RoyaltyClaimService] ❌ Window not available');
      return { eth: '0', usdc: '0' };
    }
    
    // Use public RPC provider (no wallet needed for reading)
    console.log('[RoyaltyClaimService] Using public RPC provider:', BASE_RPC_URL);
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(ROYALTY_CONTRACT_ADDRESS, ROYALTY_CONTRACT_ABI, provider);
    
    console.log('[RoyaltyClaimService] Calling getPendingRoyalties...');
    const [ethWei, usdcRaw] = await contract.getPendingRoyalties(userAddress);
    
    // Convert from wei to ETH (18 decimals)
    const eth = ethers.formatEther(ethWei);
    
    // Convert from raw USDC (6 decimals)
    const usdc = ethers.formatUnits(usdcRaw, 6);
    
    console.log('[RoyaltyClaimService] ✅ Pending royalties - ETH:', eth, 'USDC:', usdc);
    
    return { eth, usdc };
  } catch (error) {
    console.error('[RoyaltyClaimService] ❌ Error getting pending royalties:', error);
    return { eth: '0', usdc: '0' };
  }
}

/**
 * Claim pending ETH royalties
 */
export async function claimETHRoyalties(customProvider?: any): Promise<string> {
  try {
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    
    if (!ROYALTY_CONTRACT_ADDRESS) {
      throw new Error('Contract not configured');
    }
    
    let signer;
    if (customProvider) {
      console.log('[RoyaltyClaimService] Using custom provider (Privy) for ETH claim');
      const provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
    } else {
      const result = await getWalletProvider();
      signer = result.signer;
    }
    
    const contract = new ethers.Contract(ROYALTY_CONTRACT_ADDRESS, ROYALTY_CONTRACT_ABI, signer);
    
    const tx = await contract.claimRoyaltiesETH();
    await tx.wait();
    
    return tx.hash;
  } catch (error: any) {
    console.error('[RoyaltyService] Error claiming ETH royalties:', error);
    const message = getErrorMessage(error);
    throw new Error(message);
  }
}

/**
 * Claim pending USDC royalties
 */
export async function claimUSDCRoyalties(customProvider?: any): Promise<string> {
  try {
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    
    if (!ROYALTY_CONTRACT_ADDRESS) {
      throw new Error('Contract not configured');
    }
    
    let signer;
    if (customProvider) {
      console.log('[RoyaltyClaimService] Using custom provider (Privy) for USDC claim');
      const provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
    } else {
      const result = await getWalletProvider();
      signer = result.signer;
    }
    
    const contract = new ethers.Contract(ROYALTY_CONTRACT_ADDRESS, ROYALTY_CONTRACT_ABI, signer);
    
    const tx = await contract.claimRoyaltiesUSDC();
    await tx.wait();
    
    return tx.hash;
  } catch (error: any) {
    console.error('[RoyaltyService] Error claiming USDC royalties:', error);
    const message = getErrorMessage(error);
    throw new Error(message);
  }
}

/**
 * Get royalty events for a user from Irys (GraphQL-based, fast and reliable)
 * @param userAddress User wallet address
 * @param hoursAgo Filter events from this many hours ago (default 24h)
 * @param limit Maximum number of events to return
 */
export async function getRoyaltyEvents(userAddress: string, hoursAgo: number = 24, limit: number = 100): Promise<RoyaltyEvent[]> {
  try {
    console.log(`[RoyaltyClaimService] Getting royalty events from Irys for: ${userAddress} (last ${hoursAgo}h)`);
    
    // Import getRoyaltyReceipts from royaltyService
    const { getRoyaltyReceipts } = await import('./royaltyService');
    
    // Get receipts from Irys (much faster than blockchain events)
    const receipts = await getRoyaltyReceipts(userAddress, limit * 2);
    
    console.log(`[RoyaltyClaimService] Found ${receipts.length} receipts from Irys`);
    
    // Convert receipts to events
    const events: RoyaltyEvent[] = [];
    const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
    
    for (const receipt of receipts) {
      // Skip old receipts
      if (receipt.timestamp < cutoffTime) continue;
      
      // Check if user is the payer (paid royalties)
      if (receipt.payer.toLowerCase() === userAddress.toLowerCase()) {
        events.push({
          projectId: receipt.projectId,
          projectName: receipt.projectName,
          recipient: userAddress,
          amountETH: receipt.totalPaidETH,
          amountUSDC: receipt.totalPaidUSDC,
          timestamp: receipt.timestamp,
          txHash: receipt.txHashes?.paymentETH || receipt.txHashes?.paymentUSDC,
          type: 'paid',
          payer: receipt.payer
        });
      }
      
      // Check if user is a library owner (earned royalties)
      for (const lib of receipt.libraries) {
        if (lib.owner.toLowerCase() === userAddress.toLowerCase()) {
          events.push({
            projectId: receipt.projectId,
            projectName: receipt.projectName,
            recipient: lib.owner,
            amountETH: lib.royaltyETH,
            amountUSDC: lib.royaltyUSDC,
            timestamp: receipt.timestamp,
            txHash: receipt.txHashes?.paymentETH || receipt.txHashes?.paymentUSDC,
            type: 'earned',
            payer: receipt.payer
          });
          break; // Only add once per receipt even if user owns multiple libraries
        }
      }
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`[RoyaltyClaimService] ✅ Converted to ${events.length} events`);
    return events.slice(0, limit);
  } catch (error: any) {
    console.error('[RoyaltyClaimService] ❌ Error getting royalty events from Irys:', error?.message || error);
    return [];
  }
}

