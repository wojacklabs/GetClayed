import { ethers, Contract } from 'ethers';

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCostWei: bigint;
  estimatedCostETH: string;
  estimatedCostUSD?: number;
}

/**
 * Estimate gas for a contract transaction
 * @param contract Contract instance
 * @param method Method name
 * @param args Method arguments
 * @param value Optional ETH value to send
 * @returns Gas estimate details
 */
export async function estimateGas(
  contract: Contract,
  method: string,
  args: any[],
  value?: bigint
): Promise<GasEstimate> {
  try {
    const provider = contract.runner?.provider;
    if (!provider) {
      throw new Error('No provider available');
    }

    // Estimate gas limit
    const gasLimit = await contract[method].estimateGas(...args, value ? { value } : {});
    
    // Get current fee data
    const feeData = await provider.getFeeData();
    
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error('Unable to fetch fee data');
    }

    // Calculate estimated cost (gas * maxFeePerGas)
    const estimatedCostWei = gasLimit * feeData.maxFeePerGas;
    const estimatedCostETH = ethers.formatEther(estimatedCostWei);

    return {
      gasLimit,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      estimatedCostWei,
      estimatedCostETH,
    };
  } catch (error: any) {
    console.error('[GasEstimation] Error estimating gas:', error);
    throw new Error(`Gas estimation failed: ${error.message}`);
  }
}

/**
 * Format gas estimate for display
 */
export function formatGasEstimate(estimate: GasEstimate, includeUSD: boolean = false): string {
  const ethCost = parseFloat(estimate.estimatedCostETH);
  
  if (ethCost < 0.0001) {
    return '< $0.01 (~free on Base)';
  } else if (ethCost < 0.001) {
    return `~$0.0${Math.ceil(ethCost * 10000) / 10} (${estimate.estimatedCostETH.substring(0, 8)} ETH)`;
  } else {
    return `~$${(ethCost * 2000).toFixed(2)} (${estimate.estimatedCostETH.substring(0, 8)} ETH)`;
  }
}

/**
 * Check if gas cost is reasonable and warn if too high
 * @param estimate Gas estimate
 * @param warningThresholdETH Threshold in ETH (default: 0.01 ETH)
 * @returns true if cost is reasonable, false if too high
 */
export function isGasCostReasonable(
  estimate: GasEstimate,
  warningThresholdETH: number = 0.01
): { reasonable: boolean; message?: string } {
  const ethCost = parseFloat(estimate.estimatedCostETH);
  
  if (ethCost > warningThresholdETH) {
    return {
      reasonable: false,
      message: `Gas cost is high (${estimate.estimatedCostETH} ETH). This is unusual for Base network. Please verify the transaction.`
    };
  }
  
  return { reasonable: true };
}

/**
 * Estimate and warn about gas before transaction
 * Shows confirmation dialog if gas is high
 * @param contract Contract instance
 * @param method Method name
 * @param args Method arguments
 * @param value Optional ETH value
 * @param showWarning Function to show warning (optional)
 * @returns true if user confirmed or gas is reasonable, false if user cancelled
 */
export async function estimateAndConfirmGas(
  contract: Contract,
  method: string,
  args: any[],
  value?: bigint,
  showWarning?: (message: string) => Promise<boolean>
): Promise<{ confirmed: boolean; estimate?: GasEstimate }> {
  try {
    console.log(`[GasEstimation] Estimating gas for ${method}...`);
    
    const estimate = await estimateGas(contract, method, args, value);
    const reasonableCheck = isGasCostReasonable(estimate);
    
    console.log(`[GasEstimation] Gas estimate:`, {
      gasLimit: estimate.gasLimit.toString(),
      maxFeePerGas: estimate.maxFeePerGas.toString(),
      estimatedCostETH: estimate.estimatedCostETH,
      formatted: formatGasEstimate(estimate)
    });
    
    if (!reasonableCheck.reasonable) {
      console.warn(`[GasEstimation] High gas cost detected:`, reasonableCheck.message);
      
      if (showWarning) {
        const confirmed = await showWarning(
          `${reasonableCheck.message}\n\nEstimated cost: ${formatGasEstimate(estimate)}\n\nDo you want to continue?`
        );
        
        return { confirmed, estimate };
      } else {
        // No warning function provided, use browser confirm
        const confirmed = confirm(
          `${reasonableCheck.message}\n\nEstimated cost: ${formatGasEstimate(estimate)}\n\nDo you want to continue?`
        );
        
        return { confirmed, estimate };
      }
    }
    
    // Gas is reasonable, proceed
    return { confirmed: true, estimate };
  } catch (error: any) {
    console.error('[GasEstimation] Gas estimation failed:', error);
    
    // Ask user if they want to proceed without gas estimate
    if (showWarning) {
      const confirmed = await showWarning(
        `Unable to estimate gas cost. The transaction might fail or cost more than expected.\n\nDo you want to continue anyway?`
      );
      return { confirmed };
    } else {
      const confirmed = confirm(
        `Unable to estimate gas cost. The transaction might fail or cost more than expected.\n\nDo you want to continue anyway?`
      );
      return { confirmed };
    }
  }
}


