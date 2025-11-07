# Critical Fixes Applied - November 6, 2025

## Summary
5개의 critical 및 high-priority 이슈를 수정했습니다.

---

## 1. 마켓플레이스 구매 시 삭제된 라이브러리 체크 강화 ✅

**파일**: `lib/marketplaceService.ts`

**변경 사항**:
```typescript
// BEFORE: 
// Continue anyway - marketplace contract will handle validation

// AFTER:
// SECURITY: Do NOT continue if we can't verify - could be deleted
return { success: false, error: 'Unable to verify project status. Please try again later.' };
```

**영향**:
- 삭제된 프로젝트 구매 시 가스비만 날리는 상황 방지
- 사용자에게 명확한 에러 메시지 제공

---

## 2. USDC 잔액 사전 검증 ✅

**파일**: `lib/royaltyService.ts`

**변경 사항**:
- registerProjectRoyalties 호출 **전에** USDC 잔액 체크
- 잔액 부족 시 즉시 fail하여 불필요한 컨트랙트 호출 방지

**Before Flow**:
1. registerProjectRoyalties 호출 ✓
2. ETH 로열티 지불 ✓
3. USDC approve ✓
4. USDC recordRoyalties ❌ (잔액 부족)
5. **이미 등록되어 재시도 불가**

**After Flow**:
1. USDC 잔액 체크 먼저
2. 부족하면 즉시 에러 반환
3. 충분하면 정상 진행

**코드**:
```typescript
// CRITICAL FIX: Pre-validate USDC balance BEFORE any contract calls
if (totalRoyaltyUSDC > 0 && customProvider) {
  const usdcBalance = await usdcContract.balanceOf(userAddress);
  const royaltyUnits = ethers.parseUnits(totalRoyaltyUSDC.toFixed(6), 6);
  
  if (usdcBalance < royaltyUnits) {
    throw new Error(`Insufficient USDC balance...`);
  }
}
```

---

## 3. 마켓플레이스 리스팅 취소 시 Offer 자동 환불 ✅

**파일**: `contracts/ClayMarketplace.sol`

**변경 사항**:
```solidity
function cancelListing(string memory projectId) external {
    // ... 기존 코드
    
    // CRITICAL FIX: Cancel all active offers for this asset and refund buyers
    _cancelAllOffers(projectId);
    
    emit ListingCancelled(projectId, msg.sender);
}
```

**영향**:
- 판매자가 리스팅 취소 시 구매자들의 offer가 자동 환불됨
- 구매자 자금이 불필요하게 lock되는 상황 방지

---

## 4. 지불된 로열티 총액 저장 (경제 모델 보호) ✅

**파일**: `contracts/ClayRoyalty.sol`

**변경 사항**:
```solidity
// CRITICAL FIX: Track total royalties actually paid
mapping(string => uint256) public totalRoyaltiesPaidETH;
mapping(string => uint256) public totalRoyaltiesPaidUSDC;

function recordRoyalties(...) {
    // ... 로열티 지불 로직
    
    // Store total paid
    totalRoyaltiesPaidETH[projectId] = totalETHNeeded;
    totalRoyaltiesPaidUSDC[projectId] = totalUSDC;
}
```

**영향**:
- 프로젝트 생성 시 지불한 로열티 총액이 영구 저장됨
- 나중에 라이브러리가 삭제되어도 최소 가격 검증 가능

---

## 5. 마켓플레이스 가격 검증 개선 (삭제된 라이브러리 대응) ✅

**파일**: `contracts/ClayMarketplace.sol`

**Before**:
```solidity
// 현재 라이브러리 상태 기준 검증
(uint256 minETH, uint256 minUSDC) = royaltyContract.calculateTotalRoyalties(projectId);
require(price > minETH, "Price must be higher than total library royalties");
```

**문제**:
- Library A + B 사용 → 0.003 ETH 지불
- Library A 삭제됨
- calculateTotalRoyalties → 0.002 ETH (B만)
- **0.0025 ETH에 판매 가능 (지불한 금액보다 낮음!)**

**After**:
```solidity
// 실제 지불한 로열티 기준 검증
uint256 paidETH = royaltyContract.totalRoyaltiesPaidETH(projectId);
require(price > paidETH, "Price must be higher than royalties paid");
```

**영향**:
- 삭제된 라이브러리 사용 프로젝트도 정확한 최소 가격 검증
- 경제 모델 보호

---

## 6. 프로젝트 삭제 시 마켓플레이스 리스팅 경고 강화 ✅

**파일**: `lib/marketplaceService.ts`

**변경 사항**:
```typescript
export async function cancelMarketplaceListing(...): Promise<{
  success: boolean;
  warning?: string;  // 새로 추가
}> {
  // ...
  
  if (cancelError) {
    return {
      success: false,
      error: getErrorMessage(cancelError),
      warning: 'Failed to cancel marketplace listing. If you proceed with deletion, the project will remain listed but cannot be purchased...'
    };
  }
}
```

**영향**:
- 리스팅 취소 실패 시 사용자에게 명확한 경고
- 프로젝트 삭제 시 마켓플레이스에 유령 리스팅 남는 상황 방지

---

## 7. 가스 추정 실패 시 사용자 확인 강화 ✅

**파일**: `lib/libraryService.ts`

**Before**:
```typescript
} catch (gasError) {
  console.warn('Gas estimation failed, proceeding anyway:', gasError);
}
// 계속 진행 → 트랜잭션 실패 가능성 높음
```

**After**:
```typescript
} catch (gasError: any) {
  console.error('Gas estimation failed:', gasError);
  
  // 특정 에러는 즉시 fail
  if (errorMsg.includes('already registered')) {
    return { success: false, error: 'This library is already registered.' };
  }
  
  // 나머지는 사용자에게 선택권
  const proceed = confirm(
    'Gas estimation failed. This usually means the transaction will fail.\n' +
    'Do you want to proceed anyway? (You may lose gas fees)'
  );
  
  if (!proceed) {
    return { success: false, error: 'Transaction cancelled...' };
  }
}
```

**영향**:
- 가스 추정 실패 = 트랜잭션 실패 가능성 높음
- 사용자가 informed decision 할 수 있게 함
- 불필요한 가스비 낭비 방지

---

## 배포 필요 사항

### 스마트 컨트랙트 재배포 필요
- ✅ **ClayRoyalty.sol** - totalRoyaltiesPaid 추가
- ✅ **ClayMarketplace.sol** - listAsset 가격 검증 로직 변경, cancelListing 개선

### 프론트엔드 배포 필요
- ✅ `lib/marketplaceService.ts`
- ✅ `lib/royaltyService.ts`
- ✅ `lib/libraryService.ts`

### 배포 순서
1. **ClayRoyalty 재배포** (totalRoyaltiesPaid 추가)
2. **ClayMarketplace 재배포** (새로운 ClayRoyalty 주소 참조)
3. 프론트엔드 배포

---

## 테스트 체크리스트

### ClayRoyalty
- [ ] totalRoyaltiesPaidETH 정상 저장 확인
- [ ] totalRoyaltiesPaidUSDC 정상 저장 확인
- [ ] 기존 registerProjectRoyalties 정상 작동

### ClayMarketplace
- [ ] 삭제된 라이브러리 사용 프로젝트 가격 검증
- [ ] cancelListing 시 offer 자동 환불 확인
- [ ] 정상 프로젝트 리스팅/구매 작동

### 프론트엔드
- [ ] USDC 잔액 부족 시 사전 에러
- [ ] 삭제된 프로젝트 구매 차단
- [ ] 프로젝트 삭제 시 리스팅 경고
- [ ] 가스 추정 실패 시 사용자 확인

---

## 남은 이슈

### 미해결 Critical
**C2. 로열티 지불 후 업로드 실패 시 환불 불가**
- 컨트랙트 구조 변경 필요 (pending royalty 메커니즘)
- 별도 배포 계획 필요

### 미해결 High
**H4. 모바일 저장 중단 보호**
- Visibility API 추가
- 중단된 저장 복구 메커니즘

---

## 성능 영향

### 가스 비용 변화
- **ClayRoyalty.recordRoyalties**: +2 SSTORE (totalRoyaltiesPaid 저장)
  - 추가 가스: ~40,000 gas
- **ClayMarketplace.listAsset**: 변화 없음 (SLOAD만 변경)
- **ClayMarketplace.cancelListing**: +N*CALL (_cancelAllOffers)
  - Offer 1개당 ~50,000 gas 추가

### 프론트엔드 성능
- USDC 잔액 체크: +1 RPC call (빠름)
- 큰 영향 없음

---

## 결론

✅ **7개 critical/high 이슈 수정 완료**
⚠️ **2개 컨트랙트 재배포 필요**
📋 **2개 이슈 별도 계획 필요**

전체적으로 **경제 모델 보호**와 **사용자 자금 안전성**이 크게 개선되었습니다.


