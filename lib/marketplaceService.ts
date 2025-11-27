import { ethers } from 'ethers';
import { saveMutableReference, getMutableReference } from './mutableStorageService';
import { getErrorMessage } from './errorHandler';

// USDC token address on Base Mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// USDC ERC20 ABI (minimal for approve)
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

/**
 * Get wallet provider - supports Privy and MetaMask
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
async function getWalletProvider(customProvider?: any) {
  if (typeof window === 'undefined' && !customProvider) {
    throw new Error('Window not available');
  }
  
  // Use custom provider if provided (Privy), otherwise fallback to window.ethereum
  const ethereum = customProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
  
  if (!ethereum) {
    throw new Error('No wallet connected. Please connect your wallet first.');
  }
  
  console.log('[MarketplaceService] Using provider:', customProvider ? 'Privy' : 'window.ethereum');
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  
  return { provider, signer };
}

// Marketplace contract address (to be deployed)
export const MARKETPLACE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS || '';

// Marketplace contract ABI
export const MARKETPLACE_CONTRACT_ABI = [
  "function listAsset(string projectId, uint256 price, uint8 paymentToken) external",
  "function buyAsset(string projectId) external payable",
  "function cancelListing(string projectId) external",
  "function makeOffer(string projectId, uint256 offerPrice, uint8 paymentToken, uint256 duration) external payable",
  "function acceptOffer(uint256 offerId) external",
  "function cancelOffer(uint256 offerId) external",
  "function listings(string projectId) external view returns (tuple(string projectId, address seller, uint256 price, uint8 paymentToken, uint256 listedAt, bool isActive))",
  "function offers(uint256 offerId) external view returns (tuple(string projectId, address buyer, uint256 offerPrice, uint8 paymentToken, uint256 offeredAt, uint256 expiresAt, bool isActive))",
  "function getProjectOffers(string projectId) external view returns (uint256[])",
  "function getActiveListingsCount() external view returns (uint256)",
  "event AssetListed(string indexed projectId, address indexed seller, uint256 price, uint256 timestamp)",
  "event AssetSold(string indexed projectId, address indexed seller, address indexed buyer, uint256 price, uint256 platformFee)",
  "event OfferCreated(uint256 indexed offerId, string indexed projectId, address indexed buyer, uint256 offerPrice, uint256 expiresAt)",
  "event OfferAccepted(uint256 indexed offerId, string indexed projectId, address indexed seller, address buyer, uint256 price)"
];

export interface MarketplaceListing {
  projectId: string;
  seller: string;
  price: string; // in ETH or USDC
  paymentToken: 'ETH' | 'USDC';
  listedAt: number;
  isActive: boolean;
  assetName?: string;
  description?: string;
  thumbnailId?: string;
}

export interface MarketplaceOffer {
  offerId: number;
  projectId: string;
  buyer: string;
  offerPrice: string; // in ETH or USDC
  paymentToken: 'ETH' | 'USDC';
  offeredAt: number;
  expiresAt: number;
  isActive: boolean;
}

/**
 * List an asset for sale
 * @param paymentToken 'ETH' or 'USDC' (defaults to 'ETH')
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
export async function listAssetForSale(
  projectId: string,
  price: number,
  paymentToken: 'ETH' | 'USDC' = 'ETH',
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    const { signer } = await getWalletProvider(customProvider);
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    // Convert price based on token type
    const priceInUnits = paymentToken === 'ETH' 
      ? ethers.parseEther(price.toString())
      : ethers.parseUnits(price.toString(), 6); // USDC has 6 decimals
    
    // PaymentToken enum: 0 = ETH, 1 = USDC
    const paymentTokenEnum = paymentToken === 'ETH' ? 0 : 1;
    
    console.log('[MarketplaceService] Listing asset:', {
      projectId,
      price,
      paymentToken,
      priceInUnits: priceInUnits.toString()
    });
    
    const tx = await contract.listAsset(projectId, priceInUnits, paymentTokenEnum);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error listing asset:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Cancel marketplace listing (for project deletion)
 */
export async function cancelMarketplaceListing(
  projectId: string,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string; warning?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      // Marketplace not deployed, skip silently
      return { success: true };
    }
    
    let signer;
    if (customProvider) {
      const provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
    } else {
      // Try to get wallet provider
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        return { success: true }; // Skip if no wallet
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      signer = await provider.getSigner();
    }
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      [...MARKETPLACE_CONTRACT_ABI, 'function cancelListing(string projectId) external'],
      signer
    );
    
    // Check if listing exists
    let hasActiveListing = false;
    try {
      const listing = await contract.listings(projectId);
      hasActiveListing = listing.isActive;
      
      if (!listing.isActive) {
        // No active listing, skip
        return { success: true };
      }
    } catch (error) {
      // Not listed, skip
      return { success: true };
    }
    
    // IMPORTANT: Try to cancel listing before deleting project
    try {
      const tx = await contract.cancelListing(projectId);
      await tx.wait();
      
      console.log('[MarketplaceService] Listing cancelled:', projectId);
      return { success: true, txHash: tx.hash };
    } catch (cancelError: any) {
      console.error('[MarketplaceService] Failed to cancel listing:', cancelError);
      
      // CRITICAL WARNING: Listing still active but project will be deleted
      return { 
        success: false, 
        error: getErrorMessage(cancelError),
        warning: 'Failed to cancel marketplace listing. If you proceed with deletion, the project will remain listed but cannot be purchased, which may confuse buyers. Please try again or contact support.'
      };
    }
  } catch (error: any) {
    console.error('[MarketplaceService] Error in cancelMarketplaceListing:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Buy an asset at listed price
 * NOTE: Payment token is determined by the listing
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
export async function buyListedAsset(
  projectId: string,
  buyerAddress: string,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    const { signer } = await getWalletProvider(customProvider);
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    // FIX P1-7: Verify listing is still active (prevent race condition)
    const listingData = await contract.listings(projectId);
    
    if (!listingData.isActive) {
      return { success: false, error: 'This listing is no longer available' };
    }
    
    // Check asset status - supports both library-based and direct ownership
    // Only verify library for library-based assets (they could be deleted)
    const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS;
    if (LIBRARY_CONTRACT_ADDRESS) {
      try {
        const provider = await signer.provider;
        
        // First check if this is a library-based asset
        const marketplaceContract = new ethers.Contract(
          MARKETPLACE_CONTRACT_ADDRESS,
          [...MARKETPLACE_CONTRACT_ABI, 'function isAssetLibraryBased(string projectId) external view returns (bool)'],
          provider
        );
        
        const isLibraryAsset = await marketplaceContract.isAssetLibraryBased(projectId);
        
        // Only check library existence for library-based assets
        if (isLibraryAsset) {
          const libraryContract = new ethers.Contract(
            LIBRARY_CONTRACT_ADDRESS,
            ['function getAsset(string projectId) external view returns (string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled)'],
            provider
          );
          
          const asset = await libraryContract.getAsset(projectId);
          if (!asset.exists) {
            return { success: false, error: 'This project has been deleted by the owner and is no longer available for purchase' };
          }
        }
        // Direct ownership assets don't need library check
      } catch (error) {
        console.error('[MarketplaceService] Failed to verify asset status:', error);
        // For non-critical errors, allow the transaction to proceed
        // The contract will revert if there's a real issue
      }
    }
    
    console.log('[MarketplaceService] Buying asset:', {
      projectId,
      price: listingData.price.toString(),
      paymentToken: listingData.paymentToken === 0 ? 'ETH' : 'USDC'
    });
    
    // For USDC purchases, approve the exact amount first
    if (listingData.paymentToken === 1) {
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const userAddress = await signer.getAddress();
      
      // Check current allowance
      const currentAllowance = await usdcContract.allowance(userAddress, MARKETPLACE_CONTRACT_ADDRESS);
      
      if (currentAllowance < listingData.price) {
        console.log('[MarketplaceService] Approving USDC:', ethers.formatUnits(listingData.price, 6));
        const approveTx = await usdcContract.approve(MARKETPLACE_CONTRACT_ADDRESS, listingData.price);
        await approveTx.wait();
        console.log('[MarketplaceService] USDC approved');
      }
    }
    
    // Call buyAsset with ETH if payment token is ETH
    const tx = listingData.paymentToken === 0
      ? await contract.buyAsset(projectId, { value: listingData.price })
      : await contract.buyAsset(projectId);
    
    const receipt = await tx.wait();
    
    // Transfer ownership on Irys by re-uploading with new owner
    console.log('[MarketplaceService] Transferring project ownership on Irys...');
    await transferProjectOwnership(projectId, buyerAddress);
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error buying asset:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Make an offer for an asset
 * @param paymentToken 'ETH' or 'USDC' (defaults to 'ETH')
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
export async function makeAssetOffer(
  projectId: string,
  offerPrice: number,
  paymentToken: 'ETH' | 'USDC' = 'ETH',
  durationInHours: number = 24,
  customProvider?: any
): Promise<{ success: boolean; offerId?: number; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    const { signer } = await getWalletProvider(customProvider);
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    // Convert price based on token type
    const priceInUnits = paymentToken === 'ETH'
      ? ethers.parseEther(offerPrice.toString())
      : ethers.parseUnits(offerPrice.toString(), 6);
    
    const durationInSeconds = durationInHours * 3600;
    
    // PaymentToken enum: 0 = ETH, 1 = USDC
    const paymentTokenEnum = paymentToken === 'ETH' ? 0 : 1;
    
    console.log('[MarketplaceService] Making offer:', {
      projectId,
      offerPrice,
      paymentToken,
      durationInHours,
      priceInUnits: priceInUnits.toString()
    });
    
    // For USDC offers, approve the exact amount first
    if (paymentToken === 'USDC') {
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const userAddress = await signer.getAddress();
      
      // Check current allowance
      const currentAllowance = await usdcContract.allowance(userAddress, MARKETPLACE_CONTRACT_ADDRESS);
      
      if (currentAllowance < priceInUnits) {
        console.log('[MarketplaceService] Approving USDC for offer:', ethers.formatUnits(priceInUnits, 6));
        const approveTx = await usdcContract.approve(MARKETPLACE_CONTRACT_ADDRESS, priceInUnits);
        await approveTx.wait();
        console.log('[MarketplaceService] USDC approved for offer');
      }
    }
    
    const tx = await contract.makeOffer(
      projectId, 
      priceInUnits,        // offerPrice (2번째)
      paymentTokenEnum,    // paymentToken (3번째)
      durationInSeconds,   // duration (4번째)
      paymentToken === 'ETH' ? { value: priceInUnits } : {}
    );
    const receipt = await tx.wait();
    
    // Extract offer ID from event logs
    let offerId: number | undefined;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log as any);
        if (parsed && parsed.name === 'OfferCreated') {
          offerId = Number(parsed.args.offerId);
          break;
        }
      } catch (e) {
        // Skip logs that don't match
      }
    }
    
    return { success: true, offerId, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error making offer:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Accept an offer
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
export async function acceptOffer(
  offerId: number,
  projectId: string,
  buyerAddress: string,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    const { signer } = await getWalletProvider(customProvider);
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    const tx = await contract.acceptOffer(offerId);
    const receipt = await tx.wait();
    
    // Transfer ownership on Irys by re-uploading with new owner
    console.log('[MarketplaceService] Transferring project ownership on Irys...');
    await transferProjectOwnership(projectId, buyerAddress);
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error accepting offer:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Cancel a listing
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
export async function cancelListing(
  projectId: string,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    const { signer } = await getWalletProvider(customProvider);
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    const tx = await contract.cancelListing(projectId);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error cancelling listing:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Cancel an offer and get refund
 * FIX P1-11: Allow buyers to cancel their expired offers
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
export async function cancelOfferById(
  offerId: number,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    const { signer } = await getWalletProvider(customProvider);
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    const tx = await contract.cancelOffer(offerId);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error cancelling offer:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Get offers for a project
 */
export async function getProjectOffers(
  projectId: string
): Promise<MarketplaceOffer[]> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      return [];
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      return [];
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      provider
    );
    
    const offerIds = await contract.getProjectOffers(projectId);
    const offers: MarketplaceOffer[] = [];
    
    for (const offerId of offerIds) {
      const offerData = await contract.offers(offerId);
      if (offerData.isActive && offerData.expiresAt > Math.floor(Date.now() / 1000)) {
        // Format price based on payment token
        const formattedPrice = offerData.paymentToken === 0
          ? ethers.formatEther(offerData.offerPrice)
          : ethers.formatUnits(offerData.offerPrice, 6);
        
        offers.push({
          offerId: Number(offerId),
          projectId: offerData.projectId,
          buyer: offerData.buyer,
          offerPrice: formattedPrice,
          paymentToken: offerData.paymentToken === 0 ? 'ETH' : 'USDC',
          offeredAt: Number(offerData.offeredAt),
          expiresAt: Number(offerData.expiresAt),
          isActive: offerData.isActive
        });
      }
    }
    
    return offers;
  } catch (error) {
    console.error('[MarketplaceService] Error getting offers:', error);
    return [];
  }
}

/**
 * Query all marketplace listings
 */
export async function queryMarketplaceListings(): Promise<MarketplaceListing[]> {
  try {
    console.log('[MarketplaceService] queryMarketplaceListings called');
    console.log('[MarketplaceService] Contract address:', MARKETPLACE_CONTRACT_ADDRESS);
    
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      console.warn('[MarketplaceService] No marketplace contract address configured');
      return [];
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      console.warn('[MarketplaceService] No window.ethereum available');
      return [];
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      provider
    );
    
    // Get past AssetListed events
    console.log('[MarketplaceService] Querying AssetListed events...');
    const filter = contract.filters.AssetListed();
    const events = await contract.queryFilter(filter, -10000); // Last ~10000 blocks
    console.log('[MarketplaceService] Found', events.length, 'events');
    
    const listings: MarketplaceListing[] = [];
    
    for (const event of events) {
      try {
        const parsedLog = contract.interface.parseLog(event as any);
        if (parsedLog && parsedLog.args) {
          const projectId = parsedLog.args.projectId;
          console.log('[MarketplaceService] Processing listing for project:', projectId);
          
          // Check if listing is still active
          const listingData = await contract.listings(projectId);
          if (listingData.isActive) {
            // Format price based on payment token
            const formattedPrice = listingData.paymentToken === 0
              ? ethers.formatEther(listingData.price)
              : ethers.formatUnits(listingData.price, 6);
            
            listings.push({
              projectId,
              seller: listingData.seller,
              price: formattedPrice,
              paymentToken: listingData.paymentToken === 0 ? 'ETH' : 'USDC',
              listedAt: Number(listingData.listedAt),
              isActive: listingData.isActive
            });
            console.log('[MarketplaceService] Added active listing:', projectId);
          }
        }
      } catch (e) {
        console.error('[MarketplaceService] Error parsing event:', e);
      }
    }
    
    console.log('[MarketplaceService] Returning', listings.length, 'listings');
    return listings;
  } catch (error) {
    console.error('[MarketplaceService] Error querying listings:', error);
    return [];
  }
}

/**
 * Transfer project ownership on Irys by re-uploading with new owner
 * @param projectId The project ID
 * @param newOwner New owner's wallet address
 */
async function transferProjectOwnership(projectId: string, newOwner: string): Promise<void> {
  try {
    console.log('[MarketplaceService] Starting ownership transfer for project:', projectId);
    console.log('[MarketplaceService] New owner:', newOwner);
    
    // Import necessary functions
    const { downloadClayProject, uploadClayProject } = await import('./clayStorageService');
    const { getMutableReference, saveMutableReference } = await import('./mutableStorageService');
    
    // 1. Download current project
    const currentRef = getMutableReference(projectId);
    if (!currentRef) {
      console.error('[MarketplaceService] No mutable reference found for project:', projectId);
      throw new Error('Project not found in local storage');
    }
    
    console.log('[MarketplaceService] Downloading project from:', currentRef.latestTxId);
    const project = await downloadClayProject(currentRef.latestTxId);
    
    // 2. Update ownership data
    const previousOwner = project.author;
    const originalCreator = project.originalCreator || previousOwner; // First transfer sets original creator
    const transferCount = (project.transferCount || 0) + 1;
    
    const updatedProject = {
      ...project,
      author: newOwner.toLowerCase(),
      originalCreator: originalCreator.toLowerCase(),
      transferredFrom: previousOwner.toLowerCase(),
      transferredAt: Date.now(),
      transferCount: transferCount,
      updatedAt: Date.now()
    };
    
    console.log('[MarketplaceService] Updated project ownership:');
    console.log('  - Previous owner:', previousOwner);
    console.log('  - New owner:', newOwner);
    console.log('  - Original creator:', originalCreator);
    console.log('  - Transfer count:', transferCount);
    
    // 3. Re-upload with new owner (keeping same Root-TX)
    const { transactionId, rootTxId } = await uploadClayProject(
      updatedProject,
      undefined, // No folder change
      currentRef.rootTxId, // Keep same root
      undefined, // No progress callback needed
      project.thumbnailId // Keep same thumbnail
    );
    
    console.log('[MarketplaceService] Project re-uploaded:');
    console.log('  - New transaction:', transactionId);
    console.log('  - Root TX (unchanged):', rootTxId);
    
    // 4. Update mutable reference with new owner
    saveMutableReference(
      projectId,
      rootTxId,
      transactionId,
      project.name,
      newOwner.toLowerCase()
    );
    
    console.log('[MarketplaceService] ✅ Ownership transfer complete on Irys');
  } catch (error) {
    console.error('[MarketplaceService] ❌ Error transferring ownership on Irys:', error);
    // Don't throw - contract transfer already succeeded
    // This is just metadata update on Irys
  }
}

