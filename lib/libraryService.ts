import { ethers } from 'ethers';
import { fixedKeyUploader } from './fixedKeyUploadService';
import { getErrorMessage } from './errorHandler';
import { uploadInChunks, uploadChunkManifest } from './chunkUploadService';
import { downloadClayProject, ClayProject } from './clayStorageService';

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

// Library contract address (to be deployed)
export const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS || '';

// USDC token address on Base Mainnet
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Library contract ABI
export const LIBRARY_CONTRACT_ABI = [
  "function registerAsset(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC) external",
  "function purchaseAssetWithETH(string projectId) external payable",
  "function purchaseAssetWithUSDC(string projectId) external",
  "function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))",
  "function getRoyaltyFee(string projectId) external view returns (uint256 royaltyETH, uint256 royaltyUSDC)",
  "function getCurrentOwner(string projectId) external view returns (address)",
  "function getUserAssets(address user) external view returns (string[])",
  "function getTotalAssets() external view returns (uint256)",
  "function getAssetIdByIndex(uint256 index) external view returns (string)",
  "function updateRoyaltyFee(string projectId, uint256 newRoyaltyETH, uint256 newRoyaltyUSDC) external",
  "function disableRoyalty(string projectId) external",
  "function enableRoyalty(string projectId) external",
  "function deleteAsset(string projectId) external"
];

// USDC ERC20 ABI (minimal)
export const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

export interface LibraryAsset {
  projectId: string;
  name: string;
  description: string;
  royaltyPerImportETH: string;
  royaltyPerImportUSDC: string;
  currentOwner: string;
  originalCreator: string;
  listedAt: number;
  isActive: boolean;  // Maps to 'exists' from contract
  royaltyEnabled?: boolean;  // New field from contract
  thumbnailId?: string;
  tags?: Record<string, string>;
}

/**
 * Register a project as a library asset
 * Get wallet provider - supports Privy and MetaMask
 * @param customProvider Optional Privy provider (from wallets[0].getEthereumProvider())
 */
async function getWalletProvider(customProvider?: any) {
  if (typeof window === 'undefined' && !customProvider) {
    throw new Error('Window not available');
  }
  
  console.log('[LibraryService] Checking for wallet provider...');
  
  // Use custom provider if provided (Privy), otherwise fallback to window.ethereum
  const ethereum = customProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
  
  if (!ethereum) {
    console.error('[LibraryService] No ethereum provider found');
    throw new Error('No wallet connected. Please connect your wallet first using the Connect Wallet button.');
  }
  
  console.log('[LibraryService] Using provider:', customProvider ? 'Privy' : 'window.ethereum');
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  
  return { provider, signer };
}

export async function registerLibraryAsset(
  projectId: string,
  name: string,
  description: string,
  royaltyETH: number,
  royaltyUSDC: number,
  walletAddress: string,
  customProvider?: any,
  thumbnailId?: string
): Promise<{ success: boolean; txHash?: string; error?: string; requiresConfirmation?: boolean }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    let signer;
    if (customProvider) {
      console.log('[LibraryService] Using custom provider (Privy) for register');
      const provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      console.log('[LibraryService] Signer address:', signerAddress);
    } else {
      console.log('[LibraryService] Using getWalletProvider for register');
      const result = await getWalletProvider();
      signer = result.signer;
      const signerAddress = await signer.getAddress();
      console.log('[LibraryService] Signer address:', signerAddress);
    }
    
    // Create contract instance
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    // Convert royalty amounts
    let royaltyETHWei, royaltyUSDCUnits;
    try {
      royaltyETHWei = royaltyETH > 0 ? ethers.parseEther(royaltyETH.toFixed(18)) : BigInt(0);
      royaltyUSDCUnits = royaltyUSDC > 0 ? ethers.parseUnits(royaltyUSDC.toFixed(6), 6) : BigInt(0);
    } catch (error) {
      throw new Error('Invalid royalty format. Please enter a valid number');
    }
    
    console.log('[LibraryService] Calling registerAsset contract method...');
    
    // CRITICAL FIX: Estimate gas before transaction - don't proceed if estimation fails
    try {
      const { estimateAndConfirmGas } = await import('./gasEstimation');
      const { confirmed, estimate } = await estimateAndConfirmGas(
        contract,
        'registerAsset',
        [projectId, name, description, royaltyETHWei, royaltyUSDCUnits]
      );
      
      if (!confirmed) {
        return { success: false, error: 'Transaction cancelled by user' };
      }
      
      // Use estimated gas limit if available
      if (estimate) {
        console.log('[LibraryService] Using estimated gas limit:', estimate.gasLimit.toString());
        const tx = await contract.registerAsset(
          projectId, name, description, royaltyETHWei, royaltyUSDCUnits,
          { gasLimit: estimate.gasLimit }
        );
        console.log('[LibraryService] Transaction sent, hash:', tx.hash);
        console.log('[LibraryService] Waiting for confirmation...');
        await tx.wait();
        console.log('[LibraryService] Transaction confirmed!');
        
        // Skip the second registerAsset call below
        // Continue to Irys tagging...
        const libraryMetadata = {
          projectId,
          name,
          description,
          royaltyETH,
          royaltyUSDC,
          registeredBy: walletAddress,
          registeredAt: Date.now()
        };
        
        const data = Buffer.from(JSON.stringify(libraryMetadata), 'utf-8');
        const tags = [
          { name: 'App-Name', value: 'GetClayed' },
          { name: 'Data-Type', value: 'library-registration' },
          { name: 'Project-ID', value: projectId },
          { name: 'Asset-Name', value: name },
          { name: 'Royalty-ETH', value: royaltyETH.toString() },
          { name: 'Royalty-USDC', value: royaltyUSDC.toString() },
          { name: 'Registered-By', value: walletAddress.toLowerCase() },
          { name: 'Registered-At', value: Date.now().toString() }
        ];
        
        if (thumbnailId) {
          tags.push({ name: 'Thumbnail-ID', value: thumbnailId });
        }
        
        await fixedKeyUploader.upload(data, tags);
        
        return { success: true, txHash: tx.hash };
      }
    } catch (gasError: any) {
      console.error('[LibraryService] Gas estimation failed:', gasError);
      
      // Ask user if they want to proceed anyway
      const errorMsg = gasError.message || gasError.toString();
      let userFriendlyError = 'Gas estimation failed.';
      
      if (errorMsg.includes('already registered')) {
        userFriendlyError = 'This library is already registered.';
        return { success: false, error: userFriendlyError };
      } else if (errorMsg.includes('insufficient')) {
        userFriendlyError = 'Insufficient balance to complete this transaction.';
        return { success: false, error: userFriendlyError };
      }
      
      // For other errors, return error and let the UI handle confirmation
      // The UI will use showPopup with confirm/cancel buttons
      return { 
        success: false, 
        error: userFriendlyError,
        requiresConfirmation: true
      };
    }
    
    // Register asset on blockchain (royalty amounts, not prices!)
    const tx = await contract.registerAsset(projectId, name, description, royaltyETHWei, royaltyUSDCUnits);
    console.log('[LibraryService] Transaction sent, hash:', tx.hash);
    console.log('[LibraryService] Waiting for confirmation...');
    await tx.wait();
    console.log('[LibraryService] Transaction confirmed!');
    
    // Also tag the project on Irys as a library asset
    const libraryMetadata = {
      projectId,
      name,
      description,
      royaltyETH,
      royaltyUSDC,
      registeredBy: walletAddress,
      registeredAt: Date.now()
    };
    
    const data = Buffer.from(JSON.stringify(libraryMetadata), 'utf-8');
    const tags = [
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'library-registration' },
      { name: 'Project-ID', value: projectId },
      { name: 'Asset-Name', value: name },
      { name: 'Royalty-ETH', value: royaltyETH.toString() },
      { name: 'Royalty-USDC', value: royaltyUSDC.toString() },
      { name: 'Registered-By', value: walletAddress.toLowerCase() },
      { name: 'Registered-At', value: Date.now().toString() }
    ];
    
    if (thumbnailId) {
      tags.push({ name: 'Thumbnail-ID', value: thumbnailId });
    }
    
    await fixedKeyUploader.upload(data, tags);
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error registering asset:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Delete a library asset completely
 * This removes the asset from existence - it cannot be traded or used
 * Use this when deleting a project that was registered as a library
 */
export async function deleteLibraryAsset(
  projectId: string,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      // Library not deployed, skip silently
      return { success: true };
    }
    
    console.log('[LibraryService] Deleting library asset:', projectId);
    
    let signer;
    if (customProvider) {
      console.log('[LibraryService] Using custom provider (Privy) for delete');
      const provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
    } else {
      console.log('[LibraryService] Using getWalletProvider for delete');
      const result = await getWalletProvider();
      signer = result.signer;
    }
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      [...LIBRARY_CONTRACT_ABI, 'function deleteAsset(string projectId) external'],
      signer
    );
    
    // Check if asset is registered
    try {
      const asset = await contract.getAsset(projectId);
      if (!asset.exists) {
        // Already deleted or never registered
        console.log('[LibraryService] Asset not registered in library, skipping');
        return { success: true };
      }
    } catch (error) {
      // Not registered in library, skip
      console.log('[LibraryService] Asset not found in library, skipping');
      return { success: true };
    }
    
    console.log('[LibraryService] Calling deleteAsset contract method...');
    const tx = await contract.deleteAsset(projectId);
    console.log('[LibraryService] Transaction sent, hash:', tx.hash);
    console.log('[LibraryService] Waiting for confirmation...');
    await tx.wait();
    console.log('[LibraryService] Transaction confirmed!');
    
    console.log('[LibraryService] Library asset deleted:', projectId);
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error deleting library asset:', error);
    // Don't fail the entire operation if delete fails
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Disable royalty for a library asset
 * Asset remains tradable but no royalties on new uses
 * Use this when you want to keep the library available but stop collecting royalties
 */
export async function disableLibraryRoyalty(
  projectId: string,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      // Library not deployed, skip silently
      return { success: true };
    }
    
    console.log('[LibraryService] Deactivating asset, customProvider:', !!customProvider);
    
    let signer;
    if (customProvider) {
      console.log('[LibraryService] Using custom provider (Privy) for deactivate');
      const provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      console.log('[LibraryService] Signer address:', signerAddress);
    } else {
      console.log('[LibraryService] Using getWalletProvider for deactivate');
      const result = await getWalletProvider();
      signer = result.signer;
      const signerAddress = await signer.getAddress();
      console.log('[LibraryService] Signer address:', signerAddress);
    }
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      [...LIBRARY_CONTRACT_ABI, 'function disableRoyalty(string projectId) external'],
      signer
    );
    
    // Check if asset is registered
    try {
      console.log('[LibraryService] Checking if asset is registered...');
      const asset = await contract.getAsset(projectId);
      console.log('[LibraryService] Asset found, exists:', asset[8], 'royaltyEnabled:', asset[9]);
      if (!asset[8]) {  // exists field
        // Not found, skip
        console.log('[LibraryService] Asset does not exist, skipping');
        return { success: true };
      }
      if (!asset[9]) {  // royaltyEnabled field
        // Already disabled, skip
        console.log('[LibraryService] Royalty already disabled, skipping');
        return { success: true };
      }
    } catch (error) {
      // Not registered in library, skip
      console.log('[LibraryService] Asset not registered in library, skipping');
      return { success: true };
    }
    
    console.log('[LibraryService] Calling disableRoyalty contract method...');
    const tx = await contract.disableRoyalty(projectId);
    console.log('[LibraryService] Transaction sent, hash:', tx.hash);
    console.log('[LibraryService] Waiting for confirmation...');
    await tx.wait();
    console.log('[LibraryService] Transaction confirmed!');
    
    console.log('[LibraryService] Royalty disabled for asset:', projectId);
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error disabling royalty:', error);
    // Don't fail the entire operation if royalty disable fails
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Update royalty fee for a library asset
 */
export async function updateLibraryRoyaltyFee(
  projectId: string,
  royaltyETH: number,
  royaltyUSDC: number,
  customProvider?: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    let signer;
    if (customProvider) {
      const provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
    } else {
      const result = await getWalletProvider();
      signer = result.signer;
    }
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    const royaltyETHWei = royaltyETH > 0 ? ethers.parseEther(royaltyETH.toFixed(18)) : BigInt(0);
    const royaltyUSDCUnits = royaltyUSDC > 0 ? ethers.parseUnits(royaltyUSDC.toFixed(6), 6) : BigInt(0);
    
    const tx = await contract.updateRoyaltyFee(projectId, royaltyETHWei, royaltyUSDCUnits);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error updating royalty fee:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Query all library assets from blockchain
 */
export async function queryLibraryAssets(
  limit: number = 100
): Promise<LibraryAsset[]> {
  try {
    // Query from Irys for library registrations
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["library-registration"] }
          ],
          first: ${limit},
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
    
    const assets: LibraryAsset[] = [];
    const seenProjects = new Set<string>();
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const projectId = tags['Project-ID'];
      
      // Skip duplicates (keep only the latest)
      if (seenProjects.has(projectId)) {
        continue;
      }
      seenProjects.add(projectId);
      
      // Get asset data from blockchain if contract is deployed
      let blockchainData: any = null;
      if (LIBRARY_CONTRACT_ADDRESS && typeof window !== 'undefined') {
        try {
          // Use public RPC provider (works without wallet connection)
          const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const contract = new ethers.Contract(
            LIBRARY_CONTRACT_ADDRESS,
            LIBRARY_CONTRACT_ABI,
            provider
          );
          blockchainData = await contract.getAsset(projectId);
          console.log('[LibraryService] Blockchain data for', projectId, '- isActive:', blockchainData.isActive);
        } catch (error) {
          console.warn('[LibraryService] Could not fetch blockchain data for', projectId, error);
        }
      }
      
      // Combine Irys metadata with blockchain data
      const asset: LibraryAsset = {
        projectId,
        name: tags['Asset-Name'] || 'Unnamed Asset',
        description: '',
        royaltyPerImportETH: tags['Royalty-ETH'] || '0',
        royaltyPerImportUSDC: tags['Royalty-USDC'] || '0',
        currentOwner: tags['Registered-By'] || '',
        originalCreator: tags['Registered-By'] || '',
        listedAt: parseInt(tags['Registered-At'] || '0'),
        isActive: true,
        thumbnailId: tags['Thumbnail-ID'],
        tags
      };
      
      // Override with blockchain data if available
      if (blockchainData) {
        asset.projectId = blockchainData.projectId;
        asset.name = blockchainData.name;
        asset.description = blockchainData.description;
        asset.royaltyPerImportETH = ethers.formatEther(blockchainData.royaltyPerImportETH);
        asset.royaltyPerImportUSDC = ethers.formatUnits(blockchainData.royaltyPerImportUSDC, 6);
        asset.currentOwner = blockchainData.currentOwner;
        asset.originalCreator = blockchainData.originalCreator;
        asset.listedAt = Number(blockchainData.listedAt);
        asset.isActive = blockchainData.exists;  // Use 'exists' field
        asset.royaltyEnabled = blockchainData.royaltyEnabled;
      }
      
      // Only add existing assets to the list
      if (asset.isActive) {
        assets.push(asset);
      } else {
        console.log('[LibraryService] Skipping deleted asset:', projectId);
      }
    }
    
    return assets;
  } catch (error) {
    console.error('[LibraryService] Error querying library assets:', error);
    return [];
  }
}

/**
 * Purchase a library asset with ETH
 */
export async function purchaseLibraryAssetWithETH(
  projectId: string,
  priceETH: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    const { signer } = await getWalletProvider();
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    const priceInWei = ethers.parseEther(priceETH.toString());
    
    const tx = await contract.purchaseAssetWithETH(projectId, { value: priceInWei });
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error purchasing asset with ETH:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Purchase a library asset with USDC
 */
export async function purchaseLibraryAssetWithUSDC(
  projectId: string,
  priceUSDC: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    const { signer } = await getWalletProvider();
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      signer
    );
    
    const priceInUnits = ethers.parseUnits(priceUSDC.toString(), 6);
    
    // Check allowance
    const allowance = await usdcContract.allowance(await signer.getAddress(), LIBRARY_CONTRACT_ADDRESS);
    if (allowance < priceInUnits) {
      // Approve USDC spending
      const approveTx = await usdcContract.approve(LIBRARY_CONTRACT_ADDRESS, priceInUnits);
      await approveTx.wait();
    }
    
    const tx = await contract.purchaseAssetWithUSDC(projectId);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error purchasing asset with USDC:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's owned library assets
 */
export async function getUserLibraryAssets(
  walletAddress: string
): Promise<string[]> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      return [];
    }
    
    if (typeof window === 'undefined') {
      return [];
    }
    
    // Use public RPC provider (works without wallet connection)
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      provider
    );
    
    const assetIds = await contract.getUserAssets(walletAddress);
    return assetIds;
  } catch (error) {
    console.error('[LibraryService] Error getting user assets:', error);
    return [];
  }
}

/**
 * Get current blockchain state for library assets
 * CRITICAL: Always check current blockchain state, not stored data
 * This prevents TOCTOU attacks and ensures accurate royalty calculations
 */
export async function getLibraryCurrentRoyalties(
  projectIds: string[],
  customProvider?: any
): Promise<Map<string, {
  ethAmount: number;
  usdcAmount: number;
  exists: boolean;
  enabled: boolean;
}>> {
  const results = new Map();
  
  if (!LIBRARY_CONTRACT_ADDRESS) {
    console.warn('[LibraryService] Library contract not deployed');
    return results;
  }
  
  try {
    // Use Privy provider if available (avoids CORS issues)
    let provider;
    if (customProvider) {
      provider = new ethers.BrowserProvider(customProvider);
    } else {
      const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
      provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      provider
    );
    
    // PERFORMANCE: Fetch all libraries in parallel
    const promises = projectIds.map(async (projectId) => {
      try {
        // Get current royalty fee from blockchain
        const [royaltyETH, royaltyUSDC] = await contract.getRoyaltyFee(projectId);
        
        // Get asset info
        const asset = await contract.getAsset(projectId);
        
        const state = {
          ethAmount: parseFloat(ethers.formatEther(royaltyETH)),
          usdcAmount: parseFloat(ethers.formatUnits(royaltyUSDC, 6)),
          exists: asset.exists,
          enabled: asset.royaltyEnabled
        };
        
        console.log(`[LibraryService] Current blockchain state for ${projectId}:`, {
          eth: ethers.formatEther(royaltyETH),
          usdc: ethers.formatUnits(royaltyUSDC, 6),
          exists: asset.exists,
          enabled: asset.royaltyEnabled
        });
        
        return { projectId, state };
      } catch (error) {
        console.error(`[LibraryService] Failed to get current state for ${projectId}:`, error);
        // Library doesn't exist or error - treat as deleted
        return {
          projectId,
          state: {
            ethAmount: 0,
            usdcAmount: 0,
            exists: false,
            enabled: false
          }
        };
      }
    });
    
    const allResults = await Promise.all(promises);
    
    // Build results map
    for (const { projectId, state } of allResults) {
      results.set(projectId, state);
    }
    
    return results;
  } catch (error) {
    console.error('[LibraryService] Error getting library current royalties:', error);
    return results;
  }
}

/**
 * Calculate minimum price based on CURRENT blockchain state
 * SECURITY: This prevents TOCTOU attacks and ensures accurate pricing
 */
export async function calculateMinimumPriceFromBlockchain(
  usedLibraries: { projectId: string; name: string; royaltyPerImportETH?: string; royaltyPerImportUSDC?: string }[]
): Promise<{ 
  minETH: number; 
  minUSDC: number; 
  activeLibraries: string[]; 
  deletedLibraries: string[];
  disabledLibraries: string[];
}> {
  if (usedLibraries.length === 0) {
    return { minETH: 0, minUSDC: 0, activeLibraries: [], deletedLibraries: [], disabledLibraries: [] };
  }
  
  // Get current blockchain state for all libraries
  const projectIds = usedLibraries.map(lib => lib.projectId);
  const currentStates = await getLibraryCurrentRoyalties(projectIds);
  
  let minETH = 0;
  let minUSDC = 0;
  const activeLibraries: string[] = [];
  const deletedLibraries: string[] = [];
  const disabledLibraries: string[] = [];
  
  for (const lib of usedLibraries) {
    const current = currentStates.get(lib.projectId);
    
    if (current && current.exists && current.enabled) {
      // Use CURRENT blockchain values, not stored values
      minETH += current.ethAmount;
      minUSDC += current.usdcAmount;
      activeLibraries.push(lib.projectId);
      
      console.log(`[LibraryService] Including ${lib.name}: ${current.ethAmount} ETH, ${current.usdcAmount} USDC`);
    } else if (current && !current.exists) {
      deletedLibraries.push(lib.projectId);
      console.warn(`[LibraryService] Library ${lib.projectId} (${lib.name}) has been DELETED - excluding from minimum price`);
    } else if (current && !current.enabled) {
      disabledLibraries.push(lib.projectId);
      console.warn(`[LibraryService] Library ${lib.projectId} (${lib.name}) has royalty DISABLED - excluding from minimum price`);
    }
  }
  
  console.log(`[LibraryService] Minimum price calculation:`, {
    totalETH: minETH,
    totalUSDC: minUSDC,
    active: activeLibraries.length,
    deleted: deletedLibraries.length,
    disabled: disabledLibraries.length
  });
  
  return { minETH, minUSDC, activeLibraries, deletedLibraries, disabledLibraries };
}

