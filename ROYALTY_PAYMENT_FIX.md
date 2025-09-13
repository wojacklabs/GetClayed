# 🔧 로열티 지불 수정 (방법 A)

## 문제 분석

### 현재 문제
| 단계 | 현재 동작 | 문제 |
|------|----------|------|
| Import | usedLibraries에 추가 | ✅ 정상 |
| 업로드 | ETH로 고정 지불 시도 | ❌ USDC 무시 |
| 지불 확인 | ETH = 0 → skip | ❌ USDC 확인 안 함 |
| 등록 | 로열티 정보만 등록 | ✅ 정상 |
| 결과 | totalCost = 0 | ❌ 지불 안 됨 |

---

## 해결 방법 (방법 A: ClayRoyalty 직접 호출)

### 1. lib/royaltyService.ts 수정

**processLibraryPurchasesAndRoyalties 함수 전체 교체**:

```typescript
export async function processLibraryPurchasesAndRoyalties(
  projectId: string,
  usedLibraries: LibraryDependency[],
  customProvider?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (usedLibraries.length === 0) {
      return { success: true };
    }
    
    // ETH와 USDC 로열티 합산
    let totalRoyaltyETH = 0;
    let totalRoyaltyUSDC = 0;
    
    for (const library of usedLibraries) {
      totalRoyaltyETH += parseFloat(library.royaltyPerImportETH || '0');
      totalRoyaltyUSDC += parseFloat(library.royaltyPerImportUSDC || '0');
    }
    
    const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS;
    
    if (!ROYALTY_CONTRACT_ADDRESS) {
      throw new Error('Royalty contract not deployed');
    }
    
    // Privy provider 사용
    let provider, signer;
    if (customProvider) {
      provider = new ethers.BrowserProvider(customProvider);
      signer = await provider.getSigner();
    } else {
      if (!window.ethereum) {
        throw new Error('No wallet connected');
      }
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
    }
    
    const contract = new ethers.Contract(
      ROYALTY_CONTRACT_ADDRESS,
      ['function recordRoyalties(string projectId, uint256 price, uint8 paymentToken) external payable'],
      signer
    );
    
    // ETH 로열티 지불
    if (totalRoyaltyETH > 0) {
      const royaltyWei = ethers.parseEther(totalRoyaltyETH.toFixed(18));
      const tx = await contract.recordRoyalties(
        projectId,
        0,  // price unused
        0,  // ETH
        { value: royaltyW
