/**
 * Convert contract error to user-friendly message
 */
export function getErrorMessage(error: any): string {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // User rejected transaction
  if (
    errorMessage.includes('user rejected') ||
    errorMessage.includes('User denied') ||
    errorMessage.includes('rejected') ||
    errorMessage.includes('ACTION_REJECTED') ||
    error?.code === 'ACTION_REJECTED' ||
    error?.code === 4001
  ) {
    return 'Transaction cancelled';
  }
  
  // Insufficient funds
  if (
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('insufficient balance')
  ) {
    return 'Insufficient balance';
  }
  
  // Gas estimation failed
  if (
    errorMessage.includes('gas required exceeds') ||
    errorMessage.includes('gas estimation failed')
  ) {
    return 'Gas estimation failed. Transaction cannot be executed';
  }
  
  // Nonce too low
  if (errorMessage.includes('nonce too low')) {
    return 'Previous transaction pending. Please wait and try again';
  }
  
  // Already registered
  if (errorMessage.includes('already registered')) {
    return 'Asset already registered';
  }
  
  // Not authorized
  if (
    errorMessage.includes('Only owner') ||
    errorMessage.includes('Only current owner') ||
    errorMessage.includes('Not authorized')
  ) {
    return 'Not authorized. Only owner can perform this action';
  }
  
  // Price too low
  if (errorMessage.includes('Price below minimum')) {
    return 'Price too low. Must meet minimum royalty requirement';
  }
  
  // Asset not available
  if (errorMessage.includes('Asset not available')) {
    return 'Asset not found or deactivated';
  }
  
  // Contract not deployed
  if (errorMessage.includes('contract not deployed')) {
    return 'Contract not deployed';
  }
  
  // No wallet connected
  if (errorMessage.includes('No wallet connected')) {
    return 'Please connect your wallet first';
  }
  
  // FIX P1-5: Wallet disconnection errors
  if (
    errorMessage.includes('No signer') ||
    errorMessage.includes('Provider is not connected') ||
    errorMessage.includes('provider disconnected') ||
    errorMessage.includes('Signer not available')
  ) {
    return 'Wallet connection lost. Please reconnect your wallet.';
  }
  
  // Network error
  if (errorMessage.includes('network') || errorMessage.includes('NETWORK')) {
    return 'Network error. Please try again';
  }
  
  // Invalid number format
  if (
    errorMessage.includes('invalid FixedNumber') ||
    errorMessage.includes('INVALID_ARGUMENT')
  ) {
    return 'Invalid price format. Please enter a valid number';
  }
  
  // Generic fallback
  return 'An error occurred. Please try again';
}

