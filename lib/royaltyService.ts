import { ethers } from 'ethers';
import { USDC_ADDRESS, USDC_ABI, purchaseLibraryAssetWithETH, purchaseLibraryAssetWithUSDC } from './libraryService';

export const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS || '';

export const ROYALTY_CONTRACT_ABI = [
  "function registerProjectRoyalties(string projectId, string[] dependencyIds) external",
  "function validatePrice(string projectId, uint256 priceETH, uint256 priceUSDC) external view returns (bool)",
  "function getTotalRoyalties(string projectId) external view returns (uint256 totalETH, uint256 totalUSDC)",
  "function getProjectDependencies(string projectId) external view returns (tuple(string projectId, address creator, uint256 royaltyETH, uint256 royaltyUSDC)[])"
];

export interface LibraryDependency {
  projectId: string;
  name: string;
  royaltyPerImportETH: string;
  royaltyPerImportUSDC: string;
  creator?: string;
}

/**
 * Process library purchases and register royalties
 * @param projectId The project being uploaded
 * @param usedLibraries Array of libraries used in this project
 * @param paymentToken Payment token preference (ETH or USDC)
 * @returns Total cost including all library purchases
 */
export async function processLibraryPurchasesAndRoyalties(
  projectId: string,
  usedLibraries: LibraryDependency[],
  customProvider?: any,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; totalCostETH: number; totalCostUSDC: number; alreadyOwned: number; error?: string }> {
  try {
    if (usedLibraries.length === 0) {
      return { success: true, totalCostETH: 0, totalCostUSDC: 0, alreadyOwned: 0 };
    }
    
    // Calculate total royalties (both ETH and USDC)
    let totalRoyaltyETH = 0;
    let totalRoyaltyUSDC = 0;
    
    for (const library of usedLibraries) {
      totalRoyaltyETH += parseFloat(library.royaltyPerImportETH || '0');
      totalRoyaltyUSDC += parseFloat(library.royaltyPerImportUSDC || '0');
    }
    
    console.log('[RoyaltyService] Used libraries:', usedLibraries.length);
    usedLibraries.forEach((lib, idx) => {
      console.log(`  ${idx + 1}. ${lib.name}: ${lib.royaltyPerImportETH} ETH, ${lib.royaltyPerImportUSDC} USDC`);
    });
    console.log('[RoyaltyService] Total royalties - ETH:', totalRoyaltyETH, 'USDC:', totalRoyaltyUSDC);
    
    // Check if royalty contract is deployed
    if (!ROYALTY_CONTRACT_ADDRESS) {
      console.error('[RoyaltyService] ❌ ROYALTY_CONTRACT_ADDRESS not configured!');
      throw new Error('Royalty contract not deployed. Cannot process library royalties.');
    }
    
    // Calculate total number of transactions needed
    const totalTransactions = 1 + (totalRoyaltyETH > 0 ? 1 : 0) + (totalRoyaltyUSDC > 0 ? 2 : 0);
    let currentTransaction = 0;
    
    // Pay royalties via ClayRoyalty contract
    {
      let provider, signer;
      if (customProvider) {
        provider = new ethers.BrowserProvider(customProvider);
        signer = await provider.getSigner();
      } else {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      }
      
      const contract = new ethers.Contract(
        ROYALTY_CONTRACT_ADDRESS,
        [
          'function recordRoyalties(string projectId, uint256 price, uint8 paymentToken) external payable',
          'function registerProjectRoyalties(string projectId, string[] dependencyIds) external'
        ],
        signer
      );
      
      // STEP 1: Register dependencies first (required before paying royalties)
      currentTransaction++;
      const dependencyIds = usedLibraries.map(lib => lib.projectId);
      const libraryNames = usedLibraries.map(lib => lib.name).join(', ');
      
      onProgress?.(`[${currentTransaction}/${totalTransactions}] Registering ${usedLibraries.length} library dependencies (${libraryNames}). Please sign...`);
      console.log('[RoyaltyService] Registering project royalties...', { projectId, dependencyIds });
      
      const regTx = await contract.registerProjectRoyalties(projectId, dependencyIds);
      
      onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for registration confirmation...`);
      await regTx.wait();
      console.log('[RoyaltyService] Project royalties registered');
      
      // STEP 2: Pay ETH royalties
      if (totalRoyaltyETH > 0) {
        currentTransaction++;
        const ethLibraries = usedLibraries.filter(lib => parseFloat(lib.royaltyPerImportETH || '0') > 0);
        const ethLibraryNames = ethLibraries.map(lib => `${lib.name} (${lib.royaltyPerImportETH} ETH)`).join(', ');
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Paying ${totalRoyaltyETH.toFixed(6)} ETH royalty for: ${ethLibraryNames}. Please sign...`);
        console.log('[RoyaltyService] Paying ETH royalties...');
        
        const royaltyWei = ethers.parseEther(totalRoyaltyETH.toFixed(18));
        const tx = await contract.recordRoyalties(projectId, 0, 0, { value: royaltyWei });
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for ETH payment confirmation...`);
        await tx.wait();
        console.log('[RoyaltyService] ✅ Paid', totalRoyaltyETH, 'ETH in royalties');
      }
      
      // STEP 3: Pay USDC royalties
      if (totalRoyaltyUSDC > 0) {
        const usdcLibraries = usedLibraries.filter(lib => parseFloat(lib.royaltyPerImportUSDC || '0') > 0);
        const usdcLibraryNames = usdcLibraries.map(lib => `${lib.name} (${lib.royaltyPerImportUSDC} USDC)`).join(', ');
        
        // Approve
        currentTransaction++;
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Approving ${totalRoyaltyUSDC.toFixed(2)} USDC for royalty payment. Please sign...`);
        console.log('[RoyaltyService] Approving USDC...');
        
        const royaltyUnits = ethers.parseUnits(totalRoyaltyUSDC.toFixed(6), 6);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
        
        const approveTx = await usdcContract.approve(ROYALTY_CONTRACT_ADDRESS, royaltyUnits);
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for USDC approval confirmation...`);
        await approveTx.wait();
        
        // Record payment
        currentTransaction++;
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Paying ${totalRoyaltyUSDC.toFixed(2)} USDC royalty for: ${usdcLibraryNames}. Please sign...`);
        console.log('[RoyaltyService] Paying USDC royalties...');
        
        const tx = await contract.recordRoyalties(projectId, 0, 1);
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for USDC payment confirmation...`);
        await tx.wait();
        console.log('[RoyaltyService] ✅ Paid', totalRoyaltyUSDC, 'USDC in royalties');
      }
    }
    
    console.log('[RoyaltyService] ✅ All royalty transactions completed successfully');
    console.log('[RoyaltyService] Total paid - ETH:', totalRoyaltyETH, 'USDC:', totalRoyaltyUSDC);
    return { success: true, totalCostETH: totalRoyaltyETH, totalCostUSDC: totalRoyaltyUSDC, alreadyOwned: 0 };
  } catch (error: any) {
    console.error('[RoyaltyService] Error:', error);
    return { success: false, totalCostETH: 0, totalCostUSDC: 0, alreadyOwned: 0, error: error.message };
  }
}

/**
 * Calculate minimum price based on royalties
 */
export async function calculateMinimumPrice(
  usedLibraries: LibraryDependency[]
): Promise<{ minETH: number; minUSDC: number }> {
  if (usedLibraries.length === 0) {
    return { minETH: 0, minUSDC: 0 };
  }
  
  // Sum up direct royalty amounts
  const minETH = usedLibraries.reduce((sum, lib) => {
    return sum + parseFloat(lib.royaltyPerImportETH || '0');
  }, 0);
  
  const minUSDC = usedLibraries.reduce((sum, lib) => {
    return sum + parseFloat(lib.royaltyPerImportUSDC || '0');
  }, 0);
  
  return { minETH, minUSDC };
}

