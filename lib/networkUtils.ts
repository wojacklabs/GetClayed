import { ethers } from 'ethers';

/**
 * Base Mainnet Chain ID
 */
export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_ID_HEX = '0x2105';

/**
 * Base Mainnet RPC URL
 */
export const BASE_RPC_URL = 'https://mainnet.base.org';

/**
 * Check if user is on the correct network (Base Mainnet)
 * @returns true if on Base, false otherwise
 */
export async function isOnBaseNetwork(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    
    return network.chainId === BigInt(BASE_CHAIN_ID);
  } catch (error) {
    console.error('[NetworkUtils] Error checking network:', error);
    return false;
  }
}

/**
 * Get current network name
 */
export async function getCurrentNetworkName(): Promise<string> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return 'Unknown';
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    
    switch (Number(network.chainId)) {
      case 8453:
        return 'Base Mainnet';
      case 84532:
        return 'Base Sepolia (Testnet)';
      case 1:
        return 'Ethereum Mainnet';
      case 137:
        return 'Polygon';
      default:
        return `Chain ID ${network.chainId}`;
    }
  } catch (error) {
    console.error('[NetworkUtils] Error getting network name:', error);
    return 'Unknown';
  }
}

/**
 * Switch to Base Mainnet
 * @returns true if successful, false otherwise
 */
export async function switchToBaseNetwork(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet detected');
    }

    // Try to switch to Base Mainnet
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });

    return true;
  } catch (error: any) {
    // Error code 4902 means the chain is not added yet
    if (error.code === 4902) {
      try {
        // Add Base Mainnet to wallet
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base Mainnet',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: [BASE_RPC_URL],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });

        return true;
      } catch (addError) {
        console.error('[NetworkUtils] Error adding Base network:', addError);
        return false;
      }
    }
    
    console.error('[NetworkUtils] Error switching network:', error);
    return false;
  }
}

/**
 * Verify network before transaction
 * Shows warning and attempts to switch if on wrong network
 * @param showPopup Optional popup function to show messages
 * @returns true if on correct network or successfully switched, false otherwise
 */
export async function verifyAndSwitchNetwork(
  showPopup?: (message: string, type: 'success' | 'error' | 'warning') => void
): Promise<boolean> {
  const isOnBase = await isOnBaseNetwork();
  
  if (isOnBase) {
    return true;
  }

  const currentNetwork = await getCurrentNetworkName();
  
  // FIX P1-6: Check for pending transactions before switching
  try {
    if (typeof window !== 'undefined' && window.ethereum) {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      const currentNonce = await provider.getTransactionCount(address, 'latest');
      const pendingNonce = await provider.getTransactionCount(address, 'pending');
      
      if (pendingNonce > currentNonce) {
        const pendingCount = pendingNonce - currentNonce;
        if (showPopup) {
          showPopup(
            `Warning: You have ${pendingCount} pending transaction(s) on ${currentNetwork}. Please wait for confirmation or cancel them before switching networks.`,
            'warning'
          );
        }
        // Allow user to proceed but warn them
        console.warn(`[NetworkUtils] ${pendingCount} pending transactions detected`);
      }
    }
  } catch (error) {
    console.warn('[NetworkUtils] Could not check pending transactions:', error);
  }
  
  if (showPopup) {
    showPopup(
      `You are on ${currentNetwork}. Switching to Base Mainnet...`,
      'warning'
    );
  }

  const switched = await switchToBaseNetwork();
  
  if (switched) {
    if (showPopup) {
      showPopup('Successfully switched to Base Mainnet!', 'success');
    }
    return true;
  } else {
    if (showPopup) {
      showPopup(
        'Please manually switch to Base Mainnet in your wallet',
        'error'
      );
    }
    return false;
  }
}

