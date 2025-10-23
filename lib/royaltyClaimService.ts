import { ethers } from 'ethers';
import { getErrorMessage } from './errorHandler';

async function getWalletProvider() {
  if (typeof window === 'undefined') {
    throw new Error('Window not available');
  }
  
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) {
    throw new Error('No wallet connected. Please connect your wallet first.');
  }
  
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  
  return { provider, signer };
}

const ROYALTY_CONTRACT_ABI = [
  'function getPendingRoyalties(address account) external view returns (uint256 eth, uint256 usdc)',
  'function claimRoyaltiesETH() external',
  'function claimRoyaltiesUSDC() external',
  'function pendingRoyaltiesETH(address) external view returns (uint256)',
  'function pendingRoyaltiesUSDC(address) external view returns (uint256)',
  'event RoyaltyRecorded(string indexed projectId, address indexed recipient, uint256 amountETH, uint256 amountUSDC)',
  'event RoyaltyClaimed(address indexed claimant, uint256 amountETH, uint256 amountUSDC)'
];

export interface PendingRoyalties {
  eth: string; // in ETH
  usdc: string; // in USDC
}

export interface RoyaltyEvent {
  projectId: string;
  recipient: string;
  amountETH: string;
  amountUSDC: string;
  timestamp: number;
  txHash: string;
  type: 'recorded' | 'claimed';
}

/**
 * Get pending royalties for a user
 */
export async function getPendingRoyalties(userAddress: string): Promise<PendingRoyalties> {
  try {
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    
    console.log('[RoyaltyClaimService] Getting pending royalties for:', userAddress);
    console.log('[RoyaltyClaimService] Royalty contract address:', ROYALTY_CONTRACT_ADDRESS);
    
    if (!ROYALTY_CONTRACT_ADDRESS) {
      console.error('[RoyaltyClaimService] ❌ Royalty contract address not configured');
      return { eth: '0', usdc: '0' };
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      console.error('[RoyaltyClaimService] ❌ No ethereum provider available');
      return { eth: '0', usdc: '0' };
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
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
export async function claimETHRoyalties(): Promise<string> {
  try {
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    
    if (!ROYALTY_CONTRACT_ADDRESS) {
      throw new Error('Contract not configured');
    }
    
    const { signer } = await getWalletProvider();
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
export async function claimUSDCRoyalties(): Promise<string> {
  try {
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    
    if (!ROYALTY_CONTRACT_ADDRESS) {
      throw new Error('Contract not configured');
    }
    
    const { signer } = await getWalletProvider();
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
 * Get royalty events for a user (last 100)
 */
export async function getRoyaltyEvents(userAddress: string): Promise<RoyaltyEvent[]> {
  try {
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    
    if (!ROYALTY_CONTRACT_ADDRESS || typeof window === 'undefined' || !window.ethereum) {
      return [];
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(ROYALTY_CONTRACT_ADDRESS, ROYALTY_CONTRACT_ABI, provider);
    
    // Get recent blocks (last ~7 days on Base, ~2 blocks/sec)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 604800); // ~7 days
    
    // Query RoyaltyRecorded events
    const recordedFilter = contract.filters.RoyaltyRecorded(null, userAddress);
    const recordedEvents = await contract.queryFilter(recordedFilter, fromBlock, 'latest');
    
    // Query RoyaltyClaimed events
    const claimedFilter = contract.filters.RoyaltyClaimed(userAddress);
    const claimedEvents = await contract.queryFilter(claimedFilter, fromBlock, 'latest');
    
    const events: RoyaltyEvent[] = [];
    
    // Process recorded events
    for (const event of recordedEvents) {
      if ('args' in event) {
        const block = await event.getBlock();
        const args = event.args;
        
        events.push({
          projectId: args[0],
          recipient: args[1],
          amountETH: ethers.formatEther(args[2]),
          amountUSDC: ethers.formatUnits(args[3], 6),
          timestamp: block.timestamp * 1000,
          txHash: event.transactionHash,
          type: 'recorded'
        });
      }
    }
    
    // Process claimed events
    for (const event of claimedEvents) {
      if ('args' in event) {
        const block = await event.getBlock();
        const args = event.args;
        
        events.push({
          projectId: '', // Claimed events don't have projectId
          recipient: args[0],
          amountETH: ethers.formatEther(args[1]),
          amountUSDC: ethers.formatUnits(args[2], 6),
          timestamp: block.timestamp * 1000,
          txHash: event.transactionHash,
          type: 'claimed'
        });
      }
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    return events.slice(0, 100); // Return last 100 events
  } catch (error) {
    console.error('[RoyaltyService] Error getting royalty events:', error);
    return [];
  }
}

