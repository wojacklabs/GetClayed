/**
 * Format ETH amount by removing trailing zeros
 * Shows full precision but removes unnecessary trailing zeros
 * 
 * Examples:
 * - 0 -> "0"
 * - 0.000000 -> "0"
 * - 0.1 -> "0.1"
 * - 0.100000 -> "0.1"
 * - 1.234567890000 -> "1.23456789"
 */
export function formatETH(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || num === 0) {
    return '0';
  }
  
  // Convert to string with maximum precision
  const strValue = num.toString();
  
  // Remove trailing zeros after decimal point
  if (strValue.includes('.')) {
    return strValue.replace(/\.?0+$/, '');
  }
  
  return strValue;
}

/**
 * Format USDC amount by removing trailing zeros
 * Shows full precision but removes unnecessary trailing zeros
 * 
 * Examples:
 * - 0 -> "0"
 * - 0.000000 -> "0"
 * - 1.5 -> "1.5"
 * - 1.500000 -> "1.5"
 * - 123.456000 -> "123.456"
 */
export function formatUSDC(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || num === 0) {
    return '0';
  }
  
  // Convert to string with maximum precision
  const strValue = num.toString();
  
  // Remove trailing zeros after decimal point
  if (strValue.includes('.')) {
    return strValue.replace(/\.?0+$/, '');
  }
  
  return strValue;
}

/**
 * Format combined ETH + USDC display
 * 
 * Examples:
 * - (0.1, 0) -> "0.1 ETH"
 * - (0, 5) -> "5 USDC"
 * - (0.1, 5) -> "0.1 ETH + 5 USDC"
 * - (0, 0) -> "0"
 */
export function formatCombinedCurrency(eth: string | number, usdc: string | number): string {
  const ethNum = typeof eth === 'string' ? parseFloat(eth) : eth;
  const usdcNum = typeof usdc === 'string' ? parseFloat(usdc) : usdc;
  
  const hasETH = !isNaN(ethNum) && ethNum > 0;
  const hasUSDC = !isNaN(usdcNum) && usdcNum > 0;
  
  if (hasETH && hasUSDC) {
    return `${formatETH(ethNum)} ETH + ${formatUSDC(usdcNum)} USDC`;
  } else if (hasETH) {
    return `${formatETH(ethNum)} ETH`;
  } else if (hasUSDC) {
    return `${formatUSDC(usdcNum)} USDC`;
  }
  
  return '0';
}

