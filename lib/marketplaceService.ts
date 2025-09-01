import { ethers } from 'ethers';
import { saveMutableReference, getMutableReference } from './mutableStorageService';
import { getErrorMessage } from './errorHandler';
import { fixedKeyUploader } from './fixedKeyUploadService';

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
 * @param assetName Optional asset name (defaults to project name)
 * @param description Optional description for the listing
 */
export async function listAssetForSale(
  projectId: string,
  price: number,
  paymentToken: 'ETH' | 'USDC' = 'ETH',
  customProvider?: any,
  assetName?: string,
  description?: string
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
      assetName,
      description,
      priceInUnits: priceInUnits.toString()
    });
    
    const tx = await contract.listAsset(projectId, priceInUnits, paymentTokenEnum);
    await tx.wait();
    
    // Save listing metadata to Irys for fast querying
    try {
      const sellerAddress = await signer.getAddress();
      const listingMetadata = {
        projectId,
        seller: sellerAddress.toLowerCase(),
        price: price.toString(),
        paymentToken,
        assetName: assetName || '',
        description: description || '',
        listedAt: Date.now()
      };
      
      const data = Buffer.from(JSON.stringify(listingMetadata), 'utf-8');
      const tags = [
        { name: 'App-Name', value: 'GetClayed' },
        { name: 'Data-Type', value: 'marketplace-listing' },
        { name: 'Project-ID', value: projectId },
        { name: 'Seller', value: sellerAddress.toLowerCase() },
        { name: 'Price', value: price.toString() },
        { name: 'Payment-Token', value: paymentToken },
        { name: 'Asset-Name', value: assetName || '' },
        { name: 'Description', value: description || '' },
        { name: 'Listed-At', value: Date.now().toString() }
      ];
      
      await fixedKeyUploader.upload(data, tags);
      console.log('[MarketplaceService] Listing metadata saved to Irys');
    } catch (irysError) {
      console.warn('[MarketplaceService] Failed to save listing to Irys (non-critical):', irysError);
      // Don't fail the operation - blockchain listing succeeded
    }
    
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
    
    // Save cancellation marker to Irys for fast querying
    try {
      const sellerAddress = await signer.getAddress();
      const cancellationData = {
        projectId,
        cancelledBy: sellerAddress.toLowerCase(),
        cancelledAt: Date.now()
      };
      
      const data = Buffer.from(JSON.stringify(cancellationData), 'utf-8');
      const tags = [
        { name: 'App-Name', value: 'GetClayed' },
        { name: 'Data-Type', value: 'marketplace-listing-cancelled' },
        { name: 'Project-ID', value: projectId },
        { name: 'Cancelled-By', value: sellerAddress.toLowerCase() },
        { name: 'Cancelled-At', value: Date.now().toString() }
      ];
      
      await fixedKeyUploader.upload(data, tags);
      console.log('[MarketplaceService] Cancellation marker saved to Irys');
    } catch (irysError) {
      console.warn('[MarketplaceService] Failed to save cancellation to Irys (non-critical):', irysError);
    }
    
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
 * Uses raw call to avoid tuple decoding issues with ethers.js
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
    const iface = new ethers.Interface(MARKETPLACE_CONTRACT_ABI);
    
    // First get offer IDs for this project
    const getOffersCallData = iface.encodeFunctionData('getProjectOffers', [projectId]);
    const rawOfferIds = await provider.call({
      to: MARKETPLACE_CONTRACT_ADDRESS,
      data: getOffersCallData
    });
    
    // Decode offer IDs array
    const decodedOfferIds = iface.decodeFunctionResult('getProjectOffers', rawOfferIds);
    const offerIds: bigint[] = decodedOfferIds[0];
    
    console.log('[MarketplaceService] Found', offerIds.length, 'offers for project:', projectId);
    
    const offers: MarketplaceOffer[] = [];
    const currentTime = Math.floor(Date.now() / 1000);
    
    for (const offerId of offerIds) {
      try {
        // Use raw call to get offer data to avoid tuple decoding issues
        const offerCallData = iface.encodeFunctionData('offers', [offerId]);
        const rawOfferResult = await provider.call({
          to: MARKETPLACE_CONTRACT_ADDRESS,
          data: offerCallData
        });
        
        // Parse raw result manually
        // Struct Offer { string projectId, address buyer, uint256 offerPrice, uint8 paymentToken, uint256 offeredAt, uint256 expiresAt, bool isActive }
        // Raw format:
        // word 0: offset to string data (projectId)
        // word 1: buyer address (last 40 chars)
        // word 2: offerPrice
        // word 3: paymentToken
        // word 4: offeredAt
        // word 5: expiresAt
        // word 6: isActive
        // word 7+: string length and data
        
        const buyer = '0x' + rawOfferResult.slice(90, 130).toLowerCase();
        const offerPrice = BigInt('0x' + rawOfferResult.slice(130, 194));
        const paymentTokenVal = parseInt(rawOfferResult.slice(194, 258), 16);
        const offeredAt = Number(BigInt('0x' + rawOfferResult.slice(258, 322)));
        const expiresAt = Number(BigInt('0x' + rawOfferResult.slice(322, 386)));
        const isActive = parseInt(rawOfferResult.slice(386, 450), 16) === 1;
        
        // Extract projectId string from the dynamic data section
        const stringOffset = Number(BigInt('0x' + rawOfferResult.slice(2, 66)));
        const stringLengthStart = 2 + (stringOffset * 2);
        const stringLength = Number(BigInt('0x' + rawOfferResult.slice(stringLengthStart, stringLengthStart + 64)));
        const stringDataStart = stringLengthStart + 64;
        const stringDataHex = rawOfferResult.slice(stringDataStart, stringDataStart + (stringLength * 2));
        const offerProjectId = Buffer.from(stringDataHex, 'hex').toString('utf-8');
        
        console.log('[MarketplaceService] Offer', Number(offerId), '- isActive:', isActive, 'buyer:', buyer, 'price:', offerPrice.toString(), 'expiresAt:', expiresAt, 'currentTime:', currentTime);
        
        if (isActive && expiresAt > currentTime) {
          // Format price based on payment token
          const formattedPrice = paymentTokenVal === 0
            ? ethers.formatEther(offerPrice)
            : ethers.formatUnits(offerPrice, 6);
          
          offers.push({
            offerId: Number(offerId),
            projectId: offerProjectId,
            buyer,
            offerPrice: formattedPrice,
            paymentToken: paymentTokenVal === 0 ? 'ETH' : 'USDC',
            offeredAt,
            expiresAt,
            isActive
          });
        }
      } catch (offerError) {
        console.error('[MarketplaceService] Error parsing offer', Number(offerId), ':', offerError);
      }
    }
    
    return offers;
  } catch (error) {
    console.error('[MarketplaceService] Error getting offers:', error);
    return [];
  }
}

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

/**
 * Query all marketplace listings using Irys GraphQL + blockchain verification
 * This is much faster than scanning blockchain events
 */
export async function queryMarketplaceListings(): Promise<MarketplaceListing[]> {
  try {
    console.log('[MarketplaceService] queryMarketplaceListings called (GraphQL method)');
    console.log('[MarketplaceService] Contract address:', MARKETPLACE_CONTRACT_ADDRESS);
    
    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      console.warn('[MarketplaceService] No marketplace contract address configured');
      return [];
    }
    
    // Step 1: Query listing metadata from Irys GraphQL (fast!)
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["marketplace-listing"] }
          ],
          first: 200,
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    const edges = result.data?.transactions?.edges || [];
    
    console.log('[MarketplaceService] Found', edges.length, 'listing records from Irys');
    
    // Step 2: Deduplicate by projectId (keep latest)
    const seenProjects = new Set<string>();
    const projectsToVerify: Array<{ projectId: string; tags: any }> = [];
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const projectId = tags['Project-ID'];
      if (!projectId || seenProjects.has(projectId)) {
        continue;
      }
      seenProjects.add(projectId);
      projectsToVerify.push({ projectId, tags });
    }
    
    console.log('[MarketplaceService] Unique projects to verify:', projectsToVerify.length);
    
    if (projectsToVerify.length === 0) {
      return [];
    }
    
    // Step 3: Verify listing status on blockchain using raw calls
    // (ethers.js has issues decoding the tuple return type)
    const { getProvider } = await import('./rpcProvider');
    const provider = await getProvider();
    
    const listings: MarketplaceListing[] = [];
    const iface = new ethers.Interface(MARKETPLACE_CONTRACT_ABI);
    
    console.log('[MarketplaceService] Verifying', projectsToVerify.length, 'listings on blockchain...');
    
    for (const { projectId, tags } of projectsToVerify) {
      try {
        // Use raw call to avoid tuple decoding issues
        const callData = iface.encodeFunctionData('listings', [projectId]);
        const rawResult = await provider.call({
          to: MARKETPLACE_CONTRACT_ADDRESS,
          data: callData
        });
        
        // Parse raw result manually
        // The contract returns: (string projectId, address seller, uint256 price, uint8 paymentToken, uint256 listedAt, bool isActive)
        // Raw format (0x prefix + hex data):
        // Each word is 64 hex characters (32 bytes)
        // word 0 (chars 2-66): offset to string data
        // word 1 (chars 66-130): seller address (last 40 chars are the address)
        // word 2 (chars 130-194): price
        // word 3 (chars 194-258): paymentToken
        // word 4 (chars 258-322): listedAt
        // word 5 (chars 322-386): isActive
        const seller = '0x' + rawResult.slice(90, 130); // address: last 40 hex chars of word 1
        const price = BigInt('0x' + rawResult.slice(130, 194)); // uint256 word 2
        const paymentTokenVal = parseInt(rawResult.slice(194, 258), 16); // uint8 word 3
        const listedAt = BigInt('0x' + rawResult.slice(258, 322)); // uint256 word 4
        const isActive = parseInt(rawResult.slice(322, 386), 16) === 1; // bool word 5
        
        console.log('[MarketplaceService] Listing data for', projectId, '- isActive:', isActive, 'seller:', seller, 'price:', price.toString());
        
        if (!isActive) {
          console.log('[MarketplaceService] Skipping inactive listing:', projectId);
          continue;
        }
        
        // Format price based on payment token
        const formattedPrice = paymentTokenVal === 0
          ? ethers.formatEther(price)
          : ethers.formatUnits(price, 6);
        
        listings.push({
          projectId,
          seller,
          price: formattedPrice,
          paymentToken: paymentTokenVal === 0 ? 'ETH' : 'USDC',
          listedAt: Number(listedAt),
          isActive: true,
          assetName: tags['Asset-Name'] || '',
          description: tags['Description'] || ''
        });
        
        console.log('[MarketplaceService] Added active listing:', projectId);
      } catch (e) {
        console.error('[MarketplaceService] Error verifying listing:', projectId, e);
      }
    }
    
    console.log('[MarketplaceService] Returning', listings.length, 'verified active listings');
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

