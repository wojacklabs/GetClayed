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
    return '서명을 취소했습니다';
  }
  
  // Insufficient funds
  if (
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('insufficient balance')
  ) {
    return '잔액이 부족합니다';
  }
  
  // Gas estimation failed
  if (
    errorMessage.includes('gas required exceeds') ||
    errorMessage.includes('gas estimation failed')
  ) {
    return '가스 추정에 실패했습니다. 트랜잭션을 실행할 수 없습니다';
  }
  
  // Nonce too low
  if (errorMessage.includes('nonce too low')) {
    return '이전 트랜잭션이 처리 중입니다. 잠시 후 다시 시도해주세요';
  }
  
  // Already registered
  if (errorMessage.includes('already registered')) {
    return '이미 등록된 프로젝트입니다';
  }
  
  // Not authorized
  if (
    errorMessage.includes('Only owner') ||
    errorMessage.includes('Only current owner') ||
    errorMessage.includes('Not authorized')
  ) {
    return '권한이 없습니다. 소유자만 가능합니다';
  }
  
  // Price too low
  if (errorMessage.includes('Price below minimum')) {
    return '가격이 너무 낮습니다. 로열티 최소 가격을 확인해주세요';
  }
  
  // Asset not available
  if (errorMessage.includes('Asset not available')) {
    return '프로젝트를 찾을 수 없거나 비활성화되었습니다';
  }
  
  // Contract not deployed
  if (errorMessage.includes('contract not deployed')) {
    return '컨트랙트가 배포되지 않았습니다';
  }
  
  // No wallet connected
  if (errorMessage.includes('No wallet connected')) {
    return '지갑을 먼저 연결해주세요';
  }
  
  // Network error
  if (errorMessage.includes('network') || errorMessage.includes('NETWORK')) {
    return '네트워크 오류가 발생했습니다. 다시 시도해주세요';
  }
  
  // Generic fallback
  return '오류가 발생했습니다. 다시 시도해주세요';
}

