# 상용화 UX 및 코드 검증 보고서

## 검증 일시
2025-11-06

## 검증 범위
- 스마트 컨트랙트 (ClayLibrary, ClayMarketplace, ClayRoyalty)
- 프론트엔드 메인 컴포넌트 (AdvancedClay.tsx)
- 서비스 레이어 (lib/*.ts)
- UX 시나리오별 코드 경로
- 에러 처리 및 엣지 케이스

---

## ✅ 잘 구현된 보안 기능들

### 1. 프로젝트 무결성 서명 시스템
**파일**: `lib/projectIntegrityService.ts`

✅ **구현 완료**
```typescript
- signProjectData(): 프로젝트 데이터 서명 생성
- verifyProjectSignature(): 서명 검증
- detectLibraryTampering(): 라이브러리 조작 감지
```

**기능**:
- 라이브러리 의존성 해시 생성 (librariesHash)
- 클레이 객체의 라이브러리 소스 해시 생성 (clayDataHash)
- 지갑 서명으로 무결성 보장
- 다운로드 후 usedLibraries 조작 방지

**영향**: 사용자가 프로젝트 다운로드 후 라이브러리 의존성을 제거하여 로열티를 회피하는 것을 방지

---

### 2. 자동 라이브러리 감지
**파일**: `app/components/AdvancedClay.tsx` (line 3413-3447)

✅ **구현 완료**
```typescript
// SECURITY: Auto-detect libraries actually used in the project
const detectedLibraries = new Map<string, any>()

clayObjects.forEach(clay => {
  if (clay.librarySourceId && clay.librarySourceName) {
    if (!detectedLibraries.has(clay.librarySourceId)) {
      // Add library to enforce royalty payment
    }
  }
})

const finalUsedLibraries = Array.from(detectedLibraries.values())
```

**기능**:
- 실제 clay objects에서 사용된 라이브러리를 자동으로 감지
- 사용자가 제공한 usedLibraries와 비교하여 불일치 시 경고
- 감지된 라이브러리를 기준으로 로열티 결제 강제

**영향**: 프론트엔드에서 usedLibraries 배열 조작 방지

---

### 3. 현재 블록체인 상태 기반 로열티 계산
**파일**: `lib/libraryService.ts` (line 601-676, 682-733)

✅ **구현 완료**
```typescript
export async function getLibraryCurrentRoyalties(projectIds: string[])
export async function calculateMinimumPriceFromBlockchain(usedLibraries)
```

**기능**:
- TOCTOU 공격 방지: 저장된 값이 아닌 현재 블록체인 상태 조회
- 삭제된 라이브러리 (exists = false) 제외
- 비활성화된 라이브러리 (royaltyEnabled = false) 제외
- 병렬 처리로 성능 최적화

**영향**: 
- 라이브러리 소유자가 삭제/비활성화 후 사용자가 저장된 높은 로열티를 내는 것 방지
- 라이브러리 소유자가 가격 올린 후 사용자가 저장된 낮은 로열티를 내는 것 방지

---

### 4. 프로젝트 업데이트 시 로열티 재결제 방지
**파일**: `lib/royaltyService.ts` (line 143-180)

✅ **구현 완료**
```typescript
// Check if project already has registered royalties
let needsRegistration = true;
let needsRoyaltyPayment = true;

try {
  const existingDeps = await contract.getProjectDependencies(projectId);
  if (existingDeps && existingDeps.length >= 0) {
    needsRegistration = false;
    
    // Check if royalties were actually PAID
    const filter = contract.filters.RoyaltyRecorded(projectId);
    const events = await contract.queryFilter(filter, -100000);
    
    if (events.length > 0) {
      needsRoyaltyPayment = false; // Already paid
    }
  }
}
```

**기능**:
- registration 확인: getProjectDependencies 조회
- payment 확인: RoyaltyRecorded 이벤트 조회
- 부분 실패 복구: registration은 있는데 payment 없으면 재시도
- 완전한 업데이트: 둘 다 있으면 skip

**영향**: 프로젝트 수정 후 재저장 시 로열티를 다시 내지 않음

---

### 5. 라이브러리 등록 시 최소 가격 검증
**파일**: `app/components/AdvancedClay.tsx` (line 2387-2577)

✅ **구현 완료**
```typescript
// Validate minimum pricing based on CURRENT blockchain state
const { calculateMinimumPriceFromBlockchain } = await import('../../lib/libraryService')
const priceCheck = await calculateMinimumPriceFromBlockchain(dependencyLibraries)

// Enforce minimum pricing
if (ethPrice > 0 && ethPrice <= priceCheck.minETH) {
  showPopup(`Price too low! Current minimum: ${priceCheck.minETH.toFixed(6)} ETH`, 'error')
  return
}
```

**기능**:
- 의존하는 라이브러리들의 현재 로열티 합계 계산
- 등록하려는 가격이 합계보다 높아야 함 (20% 여유 권장)
- 삭제/비활성화된 라이브러리 제외
- 경고 메시지로 가이드

**영향**: "라이브러리 A+B로 만든 C를 A+B보다 싸게 팔 수 없음" 강제

---

## 🔴 CRITICAL: 발견된 중대한 이슈

### ❌ ISSUE #1: 마켓플레이스 가격 검증 누락

**파일**: `contracts/ClayMarketplace.sol` (line 143-165)

**문제점**:
```solidity
function listAsset(string memory projectId, uint256 price, PaymentToken paymentToken) external {
    require(price > 0, "Price must be greater than 0");  // ⚠️ 단순히 0보다 크기만 체크
    require(!listings[projectId].isActive, "Asset already listed");
    
    // ❌ 라이브러리 기반 프로젝트의 최소 로열티 체크 없음!
}
```

**위험성**:
- 라이브러리 A+B로 만든 프로젝트 C를 마켓플레이스에 0.0001 ETH로 판매 가능
- 프론트엔드 검증은 우회 가능 (직접 컨트랙트 호출)
- 원작자들의 로열티 시스템 무력화

**현재 상태**: 
- ✅ 프론트엔드에서는 검증 (`handleLibraryUpload`)
- ❌ 스마트 컨트랙트에서는 미검증

**해결 방법**:
1. **ClayMarketplace에 최소 가격 검증 추가** (권장):
```solidity
interface IClayRoyalty {
    function calculateTotalRoyalties(string memory projectId) 
        external view returns (uint256 totalETH, uint256 totalUSDC);
}

IClayRoyalty public royaltyContract;

function listAsset(string memory projectId, uint256 price, PaymentToken paymentToken) external {
    require(price > 0, "Price must be greater than 0");
    
    // Check minimum price based on library royalties
    (uint256 minETH, uint256 minUSDC) = royaltyContract.calculateTotalRoyalties(projectId);
    
    if (paymentToken == PaymentToken.ETH) {
        require(price > minETH, "Price must be higher than total library royalties");
    } else {
        require(price > minUSDC, "Price must be higher than total library royalties");
    }
    
    // ... rest of function
}
```

2. **또는 warning 시스템** (차선책):
   - 컨트랙트는 그대로 두고
   - 프론트엔드에서 warning 표시
   - 구매자가 판단하도록 유도

**영향도**: 🔴 HIGH
**우선순위**: 🔥 URGENT - 배포 전 필수 수정

---

## 🟡 MEDIUM: 개선이 필요한 이슈들

### ⚠️ ISSUE #2: Marketplace Offer Refund 실패 처리 불완전

**파일**: `contracts/ClayMarketplace.sol` (line 426-453)

**문제점**:
```solidity
function _cancelAllOffers(string memory projectId) private {
    // ... loop through offers ...
    
    // Refund based on payment token
    bool success = false;
    if (offer.paymentToken == PaymentToken.ETH) {
        (success, ) = offer.buyer.call{value: offer.offerPrice}("");
    } else {
        success = usdcToken.transfer(offer.buyer, offer.offerPrice);
    }
    
    // FIX: Emit event even if refund fails
    if (success) {
        emit OfferCancelled(offerIds[i], projectId, offer.buyer);
    } else {
        emit OfferRefundFailed(offerIds[i], projectId, offer.buyer, offer.offerPrice);
        // ❌ 하지만 사용자가 claim할 방법이 없음!
    }
}
```

**위험성**:
- Offer buyer의 지갑이 컨트랙트를 reject하면 refund 실패
- 자금이 마켓플레이스 컨트랙트에 갇힘
- OfferRefundFailed 이벤트만 발생하고 끝

**해결 방법**:
```solidity
// Add pending refunds mapping
mapping(address => uint256) public pendingRefundsETH;
mapping(address => uint256) public pendingRefundsUSDC;

function _cancelAllOffers(string memory projectId) private {
    // ... existing code ...
    
    if (!success) {
        // Store as pending refund instead of failing
        if (offer.paymentToken == PaymentToken.ETH) {
            pendingRefundsETH[offer.buyer] += offer.offerPrice;
        } else {
            pendingRefundsUSDC[offer.buyer] += offer.offerPrice;
        }
        emit OfferRefundFailed(offerIds[i], projectId, offer.buyer, offer.offerPrice);
    }
}

// Add claim function
function claimPendingRefund() external nonReentrant {
    uint256 ethAmount = pendingRefundsETH[msg.sender];
    uint256 usdcAmount = pendingRefundsUSDC[msg.sender];
    
    if (ethAmount > 0) {
        pendingRefundsETH[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH refund failed");
    }
    
    if (usdcAmount > 0) {
        pendingRefundsUSDC[msg.sender] = 0;
        require(usdcToken.transfer(msg.sender, usdcAmount), "USDC refund failed");
    }
}
```

**영향도**: 🟡 MEDIUM
**우선순위**: 배포 후 v2 업데이트

---

### ⚠️ ISSUE #3: USDC 잔액 체크 누락

**파일**: `lib/royaltyService.ts` (line 260-295)

**문제점**:
```typescript
// Approve USDC
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
const approveTx = await usdcContract.approve(ROYALTY_CONTRACT_ADDRESS, royaltyUnits);
// ❌ USDC 잔액 확인 없음
```

**위험성**:
- USDC 잔액 부족 시 approve는 성공하지만 transfer에서 실패
- 에러 메시지가 불명확

**해결 방법**:
```typescript
// Check USDC balance before approve
const usdcBalance = await usdcContract.balanceOf(await signer.getAddress());
if (usdcBalance < royaltyUnits) {
    throw new Error(
        `Insufficient USDC balance. ` +
        `Required: ${ethers.formatUnits(royaltyUnits, 6)} USDC, ` +
        `Available: ${ethers.formatUnits(usdcBalance, 6)} USDC`
    );
}
```

**영향도**: 🟡 MEDIUM
**우선순위**: 다음 업데이트

---

## 🟢 MINOR: 사소한 개선 사항

### 📝 ISSUE #4: 에러 메시지 일관성

**문제점**:
- 일부 에러 메시지 영어, 일부 한국어 혼재
- 사용자 경험 일관성 부족

**예시**:
- `app/components/AdvancedClay.tsx`: 'Please connect your wallet first'
- `lib/libraryService.ts`: '지갑 연결이 필요합니다'

**해결 방법**:
- 다국어 지원 시스템 (i18n) 도입 또는
- 전체 영어로 통일

---

## 📊 UX 시나리오별 검증 결과

### Scenario 1: 새 프로젝트 저장 (라이브러리 없음)
✅ **정상 동작**
1. 프로젝트 생성 → `generateProjectId()`
2. 직렬화 → `serializeClayProject()`
3. Irys 업로드 → `uploadClayProject()`
4. 참조 저장 → `saveMutableReference()`

**Edge Cases 체크**:
- ✅ 지갑 미연결 시: "Please connect your wallet first"
- ✅ 100KB 초과 시: chunk upload with progress
- ✅ 업로드 실패 시: 자동 재시도 (fixedKeyUploader)

---

### Scenario 2: 라이브러리 사용 프로젝트 저장
✅ **정상 동작**
1. 라이브러리 자동 감지 (line 3413-3447)
2. 현재 블록체인 상태 조회 (`getLibraryCurrentRoyalties`)
3. 로열티 등록 (`registerProjectRoyalties`)
4. ETH/USDC 로열티 결제 (`recordRoyalties`)
5. 영수증 업로드 (`uploadRoyaltyReceipt`)
6. 프로젝트 서명 (`signProjectData`)
7. 프로젝트 업로드

**Edge Cases 체크**:
- ✅ 라이브러리 삭제됨: 로열티에서 제외
- ✅ 로열티 비활성화됨: 로열티에서 제외
- ✅ usedLibraries 조작: 자동 감지로 덮어씀
- ✅ ETH 부족: "Insufficient ETH sent" (contract revert)
- ✅ USDC 부족: "USDC transfer failed" (contract revert)
- ⚠️ USDC 잔액 부족: 에러 메시지 불명확 (ISSUE #3)

---

### Scenario 3: 프로젝트 업데이트 (재저장)
✅ **정상 동작**
1. 기존 projectId 사용
2. RoyaltyRecorded 이벤트 확인
3. 이미 결제됨 → 로열티 skip
4. 프로젝트 업로드 (새 transactionId, 같은 rootTxId)

**Edge Cases 체크**:
- ✅ 로열티 부분 실패 복구: registration O, payment X → 재시도
- ✅ 라이브러리 추가: 경고 후 중단 (새 라이브러리 결제 필요)
- ✅ 라이브러리 제거: 서명 검증으로 감지

---

### Scenario 4: 라이브러리 등록
✅ **정상 동작**
1. 최소 가격 계산 (`calculateMinimumPriceFromBlockchain`)
2. 가격 검증 (의존 라이브러리 합계보다 높아야 함)
3. 컨트랙트 등록 (`registerAsset`)
4. Irys 메타데이터 업로드

**Edge Cases 체크**:
- ✅ 가격 너무 낮음: 에러 + 권장 가격 표시
- ✅ 삭제된 라이브러리 사용: 경고 표시, 최소 가격에서 제외
- ✅ 비활성화된 라이브러리: 경고 표시, 최소 가격에서 제외
- ✅ 무료 라이브러리: 허용 (0 ETH, 0 USDC)

---

### Scenario 5: 마켓플레이스 판매
⚠️ **부분적 문제**
1. 등록: `listAsset()` - ❌ 최소 가격 체크 없음 (ISSUE #1)
2. 구매: `buyAsset()` - ✅ 정상
3. Offer: `makeOffer()` - ✅ escrow 정상
4. Refund: `_cancelAllOffers()` - ⚠️ 실패 시 복구 불가 (ISSUE #2)

**Edge Cases 체크**:
- ✅ 소유자 아닌 사람이 판매: "Only owner can list asset"
- 🔴 라이브러리 기반 프로젝트 저가 판매: 차단 안 됨 (ISSUE #1)
- ✅ 이미 등록됨: "Asset already listed"
- ⚠️ Offer refund 실패: 이벤트만 발생 (ISSUE #2)

---

### Scenario 6: 프로젝트 삭제
✅ **정상 동작**
1. 마켓플레이스 리스팅 취소 (`cancelMarketplaceListing`)
2. 라이브러리에서 삭제 (`deleteLibraryAsset`)
3. Irys 메타데이터는 남음 (immutable)

**Edge Cases 체크**:
- ✅ 등록 안 됨: skip silently
- ✅ 이미 판매됨: owner changed, 삭제 불가
- ✅ 지갑 연결 안 됨: skip (read-only)

---

## 🛡️ 보안 체크리스트

### Smart Contract Security
- ✅ ReentrancyGuard: ClayMarketplace, ClayRoyalty
- ✅ Ownable2Step: ClayLibrary (안전한 소유권 이전)
- ✅ Pull Pattern: ClayRoyalty (royalty claiming)
- ⚠️ Price Validation: ClayMarketplace에 없음 (ISSUE #1)
- ⚠️ Failed Refund Recovery: 메커니즘 없음 (ISSUE #2)

### Frontend Security
- ✅ 자동 라이브러리 감지
- ✅ TOCTOU 방지 (현재 블록체인 상태 조회)
- ✅ 프로젝트 서명
- ✅ 서명 검증
- ✅ 최소 가격 검증 (프론트엔드)

### Blockchain Integrity
- ✅ 삭제된 라이브러리 감지 (`getCurrentOwner` = 0)
- ✅ 비활성화된 라이브러리 제외 (`royaltyEnabled` = false)
- ✅ 동적 소유권 추적 (marketplace 거래 후에도 로열티 정확)
- ✅ Fixed royalty (등록 시점 가격 고정)

---

## 📋 권장 조치 사항

### 🔥 배포 전 필수 (CRITICAL)
1. **마켓플레이스 가격 검증 추가** (ISSUE #1)
   - ClayMarketplace.sol 수정 필요
   - 재배포 필요

### 📅 배포 후 v2 업데이트 (MEDIUM)
1. **Offer refund 복구 메커니즘** (ISSUE #2)
   - ClayMarketplace.sol에 claim 기능 추가
   - 재배포 필요

2. **USDC 잔액 체크** (ISSUE #3)
   - lib/royaltyService.ts 수정
   - 프론트엔드만 업데이트

### 🎨 UX 개선 (MINOR)
1. **에러 메시지 통일** (ISSUE #4)
   - 다국어 지원 또는 영어 통일

---

## ✅ 결론

### 전반적 평가: **우수 (단, 1개 Critical 이슈 수정 필요)**

**강점**:
1. 강력한 보안 메커니즘 (서명, 자동 감지, TOCTOU 방지)
2. 포괄적인 에러 처리
3. 부분 실패 복구 로직
4. 동적 블록체인 상태 추적

**개선 필요**:
1. 🔴 마켓플레이스 가격 검증 추가 (배포 전 필수)
2. 🟡 Offer refund 복구 메커니즘 (v2)
3. 🟡 USDC 잔액 체크 (v2)
4. 🟢 에러 메시지 통일 (UX 개선)

**배포 가능 여부**: 
- ❌ **현재 상태로는 배포 불가**
- ✅ **ISSUE #1 수정 후 배포 가능**

---

## 📝 다음 단계

1. ClayMarketplace.sol 수정 (ISSUE #1)
2. 컨트랙트 재배포
3. 프론트엔드 컨트랙트 주소 업데이트
4. 테스트넷 테스트
5. 메인넷 배포

---

생성일: 2025-11-06
작성자: AI Code Reviewer











