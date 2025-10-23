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
  customProvider?: any
): Promise<{ success: boolean; totalCost: number; alreadyOwned: number; error?: string }> {
  try {
    if (usedLibraries.length === 0) {
      return { success: true, totalCost: 0, alreadyOwned: 0 };
    }
    
    let totalCost = 0;
    
    // Calculate total royalties (both ETH and USDC)
    let totalRoyaltyETH = 0;
    let totalRoyaltyUSDC = 0;
    
    for (const library of usedLibraries) {
      totalRoyaltyETH += parseFloat(library.royaltyPerImportETH || '0');
      totalRoyaltyUSDC += parseFloat(library.royaltyPerImportUSDC || '0');
    }
    
    console.log('[RoyaltyService] Total royalties - ETH:', totalRoyaltyETH, 'USDC:', totalRoyaltyUSDC);
    
    // Pay royalties via ClayRoyalty contract
    if (ROYALTY_CONTRACT_ADDRESS) {
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
      const dependencyIds = usedLibraries.map(lib => lib.projectId);
      console.log('[RoyaltyService] Registering project royalties...', { projectId, dependencyIds });
      const regTx = await contract.registerProjectRoyalties(projectId, dependencyIds);
      await regTx.wait();
      console.log('[RoyaltyService] Project royalties registered');
      
      // STEP 2: Pay ETH royalties
      if (totalRoyaltyETH > 0) {
        console.log('[RoyaltyService] Paying ETH royalties...');
        const royaltyWei = ethers.parseEther(totalRoyaltyETH.toFixed(18));
        const tx = await contract.recordRoyalties(projectId, 0, 0, { value: royaltyWei });
        await tx.wait();
        console.log('[RoyaltyService] Paid', totalRoyaltyETH, 'ETH in royalties');
        totalCost += totalRoyaltyETH;
      }
      
      // STEP 3: Pay USDC royalties
      if (totalRoyaltyUSDC > 0) {
        console.log('[RoyaltyService] Paying USDC royalties...');
        const royaltyUnits = ethers.parseUnits(totalRoyaltyUSDC.toFixed(6), 6);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
        
        const approveTx = await usdcContract.approve(ROYALTY_CONTRACT_ADDRESS, royaltyUnits);
        await approveTx.wait();
        
        const tx = await contract.recordRoyalties(projectId, 0, 1);
        await tx.wait();
        console.log('[RoyaltyService] Paid', totalRoyaltyUSDC, 'USDC');
        totalCost += totalRoyaltyUSDC;
      }
    }
    
    return { success: true, totalCost, alreadyOwned: 0 };
  } catch (error: any) {
    console.error('[RoyaltyService] Error:', error);
    return { success: false, totalCost: 0, alreadyOwned: 0, error: error.message };
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

