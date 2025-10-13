import { ethers } from 'ethers';

// Marketplace contract address (to be deployed)
export const MARKETPLACE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS || '';

// Marketplace contract ABI
export const MARKETPLACE_CONTRACT_ABI = [
  "function listAsset(string projectId, uint256 price) external",
  "function buyAsset(string projectId) external payable",
  "function cancelListing(string projectId) external",
  "function makeOffer(string projectId, uint256 duration) external payable",
  "function acceptOffer(uint256 offerId) external",
  "function cancelOffer(uint256 offerId) external",
  "function listings(string projectId) external view returns (tuple(string projectId, address seller, uint256 price, uint256 listedAt, bool isActive))",
  "function offers(uint256 offerId) external view returns (tuple(string projectId, address buyer, uint256 offerPrice, uint256 offeredAt, uint256 expiresAt, bool isActive))",
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
  price: string; // in IRYS tokens
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
  offerPrice: string; // in IRYS tokens
  offeredAt: number;
  expiresAt: number;
  isActive: boolean;
}

/**
 * List an asset for sale
 */
export async function listAssetForSale(
  projectId: string,
  priceInIRYS: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    const priceInWei = ethers.parseEther(priceInIRYS.toString());
    
    const tx = await contract.listAsset(projectId, priceInWei);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error listing asset:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buy an asset at listed price
 */
export async function buyListedAsset(
  projectId: string,
  priceInIRYS: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    const priceInWei = ethers.parseEther(priceInIRYS.toString());
    
    const tx = await contract.buyAsset(projectId, { value: priceInWei });
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error buying asset:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Make an offer for an asset
 */
export async function makeAssetOffer(
  projectId: string,
  offerPriceInIRYS: number,
  durationInHours: number = 24
): Promise<{ success: boolean; offerId?: number; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    const priceInWei = ethers.parseEther(offerPriceInIRYS.toString());
    const durationInSeconds = durationInHours * 3600;
    
    const tx = await contract.makeOffer(projectId, durationInSeconds, { value: priceInWei });
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
    return { success: false, error: error.message };
  }
}

/**
 * Accept an offer
 */
export async function acceptOffer(
  offerId: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const contract = new ethers.Contract(
      MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_CONTRACT_ABI,
      signer
    );
    
    const tx = await contract.acceptOffer(offerId);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[MarketplaceService] Error accepting offer:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a listing
 */
export async function cancelListing(
  projectId: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error('Marketplace contract not deployed');
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
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
    return { success: false, error: error.message };
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
        offers.push({
          offerId: Number(offerId),
          projectId: offerData.projectId,
          buyer: offerData.buyer,
          offerPrice: ethers.formatEther(offerData.offerPrice),
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
    
    // Get past AssetListed events
    const filter = contract.filters.AssetListed();
    const events = await contract.queryFilter(filter, -10000); // Last ~10000 blocks
    
    const listings: MarketplaceListing[] = [];
    
    for (const event of events) {
      try {
        const parsedLog = contract.interface.parseLog(event as any);
        if (parsedLog && parsedLog.args) {
          const projectId = parsedLog.args.projectId;
          
          // Check if listing is still active
          const listingData = await contract.listings(projectId);
          if (listingData.isActive) {
            listings.push({
              projectId,
              seller: listingData.seller,
              price: ethers.formatEther(listingData.price),
              listedAt: Number(listingData.listedAt),
              isActive: listingData.isActive
            });
          }
        }
      } catch (e) {
        // Skip events that can't be parsed
      }
    }
    
    return listings;
  } catch (error) {
    console.error('[MarketplaceService] Error querying listings:', error);
    return [];
  }
}

