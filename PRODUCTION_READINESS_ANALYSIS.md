# 🏭 상용화 준비 완전 분석 - 실제 사용자 시나리오

## 📅 분석 일자
2025-01-06

## 🎯 분석 범위
실제 상용화 환경에서 발생 가능한 모든 UX 시나리오, 에러 케이스, 동시성, 복구 메커니즘

---

## 🔍 발견된 추가 문제

### 🔴 버그 21: 로열티 지불 성공 후 Irys 업로드 실패 시 재시도 메커니즘

**시나리오**:
```
1. User가 Library A import → 저장 시도
2. processLibraryPurchasesAndRoyalties 성공
   - registerProjectRoyalties: 블록체인에 기록됨 ✅
   - recordRoyalties: 1.0 ETH 지불됨 ✅
3. Irys 업로드 시도 → 네트워크 오류로 실패 ❌
4. 사용자 상태:
   - 로열티 1.0 ETH 지불함 ✅
   - 프로젝트는 저장 안됨 ❌
   - 손실: 1.0 ETH 💸
```

**코드 확인**: `app/components/AdvancedClay.tsx:3510-3621`

```typescript
// Step 2: 로열티 처리
if (!result.success) {
  throw new Error(...)  // 여기서 중단 → Irys 업로드 안함 ✅
}

// Step 3: Irys 업로드
try {
  uploadResult = await uploadClayProject(...)
} catch (uploadError) {
  throw new Error('Failed to upload project to Irys. Please try again.')
  return
}
```

**재시도 시**:
```typescript
// 같은 projectId로 재시도
getProjectDependencies(projectId) → [Library A] (이미 등록됨!)
needsRegistration = false
→ return { totalCostETH: 0 } ✅
// 로열티 재지불 안함!

// Irys 업로드만 재시도
await uploadClayProject(...) ✅
```

**현재 동작**: ✅ **안전함**
- 재시도하면 로열티 재지불 안함
- Irys 업로드만 재시도
- 사용자 자금 손실 없음

**검증**: ✅ PASS

---

### 🟡 버그 22: Irys 업로드 실패 시 사용자 안내 부족

**현재 에러 메시지**:
```typescript
throw new Error('Failed to upload project to Irys. Please try again.')
```

**문제**:
- 로열티를 이미 지불했다는 정보 없음
- 재시도하면 무료라는 안내 없음

**개선 필요**:
```typescript
// 로열티 지불 성공 여부 추적
let royaltiesPaid = false;

if (finalUsedLibraries.length > 0) {
  const result = await processLibraryPurchasesAndRoyalties(...);
  if (result.totalCostETH > 0 || result.totalCostUSDC > 0) {
    royaltiesPaid = true;
  }
}

// Irys 업로드 실패 시
catch (uploadError) {
  if (royaltiesPaid) {
    throw new Error(
      'Project upload failed but royalties were paid successfully. ' +
      'When you retry, you won\'t be charged again. Please try saving again.'
    );
  } else {
    throw new Error('Failed to upload project to Irys. Please try again.');
  }
}
```

**심각도**: 🟡 **낮음-중간** (UX 개선)

---

### 🔴 버그 23: Library 가격이 0일 때 등록 불가

**위치**: `contracts/ClayLibrary.sol:125`

**컨트랙트 코드**:
```solidity
function registerAsset(...) external {
    require(
        royaltyPerImportETH > 0 || royaltyPerImportUSDC > 0, 
        "At least one royalty must be set"
    );
}
```

**시나리오**:
```
User가 무료 Library 제공하고 싶음
→ registerAsset(projectId, name, desc, 0, 0)
→ ❌ REVERT: "At least one royalty must be set"
```

**문제**:
- 무료 Library 등록 불가능
- 교육용, 오픈소스 프로젝트 공유 불가

**해결책 (선택적)**:
```solidity
// 0도 허용하려면
require(
    royaltyPerImportETH >= 0 || royaltyPerImportUSDC >= 0,
    "Invalid royalty values"
);
```

**또는 설계상 의도된 것**:
- Library는 유료만
- 무료 공유는 일반 프로젝트로

**심각도**: 🟡 **낮음** (설계 결정)

---

## 🔍 상용화 시나리오 깊이 분석

### 시나리오 1: 대량 Library 사용 (가스비)

**상황**:
```
User가 30개 Library import → 프로젝트 저장
```

**코드 흐름**:
```typescript
finalUsedLibraries = [Lib1, Lib2, ..., Lib30]
activeLibraries = 30개

// 블록체인 상태 확인
getLibraryCurrentRoyalties([...30개 projectId])
// 30번 RPC 호출! ⚠️

// 로열티 등록
registerProjectRoyalties(projectId, [...30개])
// Loop 30번
for (i = 0; i < 30; i++) {
    getRoyaltyFee(dependencyProjectIds[i])
    dependencies.push(...)
}
// 가스비: 매우 높음! 💰
```

**컨트랙트**: `ClayRoyalty.sol:98-110`
```solidity
for (uint256 i = 0; i < dependencyProjectIds.length; i++) {
    (uint256 feeETH, uint256 feeUSDC) = libraryContract.getRoyaltyFee(dependencyProjectIds[i]);
    // 30번 external call! 가스비 증가
    
    royalty.dependencies.push(dep);
    // 30번 storage write! 가스비 많이 증가
}
```

**가스비 추정**:
```
Library 1개: ~50,000 gas
Library 30개: ~1,500,000 gas

Base 기준:
1,500,000 * 0.1 gwei * $3000/ETH = $0.45
→ 저렴함 ✅

하지만 Ethereum 메인넷이라면:
1,500,000 * 30 gwei * $3000/ETH = $135
→ 매우 비쌈! 🔴
```

**현재 네트워크**: Base Mainnet
**평가**: ✅ 괜찮음 (Base 가스비 저렴)

---

### 시나리오 2: 사용자가 트랜잭션 거부

**상황**:
```
1. Library A import → 저장
2. registerProjectRoyalties 서명 요청
3. User가 거부 ❌
```

**코드**: `lib/royaltyService.ts:169-176`
```typescript
const regTx = await contract.registerProjectRoyalties(projectId, dependencyIds);
// 사용자 거부 시 throw됨

// 호출한 곳
catch (error: any) {
  console.error('[RoyaltyService] Error:', error);
  return { success: false, ..., error: error.message };
}
```

**상위 호출**: `AdvancedClay.tsx:3510-3512`
```typescript
if (!result.success) {
  throw new Error(result.error || 'Failed to process library purchases')
}
// 여기서 전체 저장 중단 ✅
```

**결과**:
- ✅ 저장 중단됨
- ✅ 다시 시도 가능
- ✅ 자금 손실 없음

**검증**: ✅ PASS

---

### 시나리오 3: 네트워크 중단 (중간에)

**상황**:
```
1. registerProjectRoyalties 성공 ✅
2. recordRoyalties (ETH) 진행 중...
3. 네트워크 중단! 🔌
```

**코드**:
```typescript
const ethTx = await contract.recordRoyalties(projectId, 0, 0, { value: royaltyWei });
// 네트워크 중단 → pending 상태

await ethTx.wait();
// timeout 또는 error throw
```

**에러 처리**:
```typescript
catch (error: any) {
  console.error('[RoyaltyService] Error:', error);
  return { success: false, ..., error: error.message };
}

// 상위
if (!result.success) {
  throw new Error(...)  // 저장 중단
}
```

**재시도 시**:
```
A. 트랜잭션이 실제로 성공했다면:
   → getProjectDependencies: 등록됨
   → needsRegistration = false
   → recordRoyalties 재호출 시도
   → ❌ REVERT: "No royalties for this project"?
   
   아니다! needsRegistration = false면:
   → return early { totalCostETH: 0 }
   → recordRoyalties 호출 안함 ✅

B. 트랜잭션이 실패했다면:
   → getProjectDependencies: 등록됨 (registerProjectRoyalties는 성공)
   → recordRoyalties 재시도
   → ✅ 성공
```

**문제 발견**: 
- registerProjectRoyalties 성공
- recordRoyalties 실패
- 재시도 시 둘 다 건너뜀!
- 로열티 지불 안됨! 🚨

**심각도**: 🔴 **높음**

---

### 🔴 버그 24: 부분 실패 시 로열티 미지불

**상세 시나리오**:
```
Day 1: Library A import → 저장 시도

Step 1: registerProjectRoyalties
  → 트랜잭션 전송 ✅
  → 네트워크 불안정
  → timeout으로 실패 표시 ❌
  → 하지만 실제로는 블록체인에 기록됨 ✅

Step 2: recordRoyalties
  → 실행 안됨 (Step 1 에러로 중단)
  
결과:
  → projectRoyalties[projectId].hasRoyalties = true
  → dependencies = [A]
  → 하지만 로열티 미지불!

Day 2: 재시도

Step 1: getProjectDependencies
  → 이미 등록됨!
  → needsRegistration = false
  
Step 2: return early
  → totalCostETH = 0
  → recordRoyalties 호출 안함!
  
최종 결과:
  → 프로젝트는 저장됨
  → Library A 크리에이터는 로열티 못받음 ❌
```

**코드 확인**: `lib/royaltyService.ts:177-205`
```typescript
} else if (!needsRegistration) {
  console.log('✅ Using existing royalty registration (UPDATE mode)');
  console.log('ℹ️ Skipping royalty payment for project update');
  
  // CRITICAL FIX: Don't pay royalties again for project updates!
  return {
    success: true,
    totalCostETH: 0,  // ✅ 업데이트는 맞지만...
    totalCostUSDC: 0,
    alreadyOwned: activeLibraries.length,
    txHashes: { register: 'already-registered' },
    librariesWithOwners: []
  };
}
```

**문제**:
- 최초 저장 시 부분 실패 → 재시도 시 로열티 안냄
- 구분할 방법이 없음 (최초 vs 업데이트)

**해결책**:
```typescript
// hasRoyalties = true이지만 실제 로열티 지불 여부 확인
const existingDeps = await contract.getProjectDependencies(projectId);

if (existingDeps.length > 0) {
  // 이미 등록됨 - 하지만 로열티 지불했는지 확인 필요
  // recordRoyalties 이력 체크?
  
  // 문제: recordRoyalties 이력을 체크할 방법이 없음!
  // RoyaltyRecorded 이벤트? 
}
```

**근본 문제**:
- registerProjectRoyalties와 recordRoyalties가 분리됨
- 둘 중 하나만 성공하면 상태 불일치

**심각도**: 🔴 **높음** (드물지만 치명적)

---

### 🟠 버그 25: 매우 많은 Library 사용 시 RPC 호출 과다

**코드**: `lib/libraryService.ts:543-574`
```typescript
for (const projectId of projectIds) {
  // 각 library마다 2번 RPC 호출!
  const [royaltyETH, royaltyUSDC] = await contract.getRoyaltyFee(projectId);
  const asset = await contract.getAsset(projectId);
}
```

**시나리오**:
```
50개 Library 사용
→ 100번 RPC 호출 (50 * 2)
→ 시간: ~10-30초 ⏱️
→ RPC rate limit 가능성
```

**개선**:
```typescript
// 병렬 처리
const calls = projectIds.map(async (projectId) => {
  return Promise.all([
    contract.getRoyaltyFee(projectId),
    contract.getAsset(projectId)
  ]);
});

const results = await Promise.all(calls);
// 시간: ~2-5초 (병렬)
```

**심각도**: 🟠 **중간** (성능 이슈)

---

### 🔴 버그 26: recordRoyalties에 projectId가 없을 때

**시나리오**:
```
1. User가 직접 recordRoyalties 호출 (악의적)
   contract.recordRoyalties("random-id", 0, 0, { value: 1 ETH })
   
2. 컨트랙트 체크
   require(royalty.hasRoyalties, "No royalties for this project")
   → ❌ REVERT ✅
```

**검증**: ✅ PASS (컨트랙트 보호됨)

---

### 시나리오 4: 동시성 - 같은 Library를 여러 명이 import

**상황**:
```
T0: Library A (1.0 ETH)

T1: User1이 import → 저장 시작
T1: User2도 import → 저장 시작

T2: User1 registerProjectRoyalties("project-1", ["A"])
T2: User2 registerProjectRoyalties("project-2", ["A"])
```

**검증**:
```solidity
// ClayRoyalty.sol:92
require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
// projectId가 다르므로 충돌 없음 ✅

// project-1: hasRoyalties = true, dependencies = [A]
// project-2: hasRoyalties = true, dependencies = [A]
// 각각 독립적 ✅
```

**결과**: ✅ PASS (문제 없음)

---

### 시나리오 5: Library owner가 삭제 직전에 import

**타임라인**:
```
T1: User가 Library A import (다운로드 ✅)
T2: Library A owner가 deleteAsset
    → exists = false
T3: User가 저장 시도
```

**코드 흐름**:
```typescript
// 저장 시
usedLibraries = [A]

// 블록체인 체크
currentStates.get("A") = { exists: false }  // 삭제됨!

// 필터링
activeLibraries = []  // A 제외됨

// 등록
if (activeLibraries.length > 0) → false
→ 로열티 처리 건너뜀 ✅

// Irys 업로드
clays = [librarySourceId: "A"] // 여전히 기록됨
usedLibraries = []  // 비어있음

// 결과
프로젝트는 저장되지만 Library A 정보는 유지됨
(출처 표시 목적)
```

**검증**: ✅ PASS (정상 동작)

---

### 시나리오 6: Marketplace listing 중 가격 변경

**타임라인**:
```
T1: Alice, Library A listing (100 ETH)
T2: Bob이 구매 화면 열기
T3: Alice, updateListingPrice(200 ETH)
T4: Bob이 구매 버튼 클릭 (100 ETH로 알고 있음)
```

**코드**: `lib/marketplaceService.ts:190-206`
```typescript
// Get listing to check payment token and price
const listingData = await contract.listings(projectId);

if (!listingData.isActive) {
  throw new Error('Listing is not active');
}

// Call buyAsset with current listing price
const tx = listingData.paymentToken === 0
  ? await contract.buyAsset(projectId, { value: listingData.price })
  : await contract.buyAsset(projectId);
```

**컨트랙트**: `ClayMarketplace.sol:164-175`
```solidity
function buyAsset(string memory projectId) external payable {
    Listing storage listing = listings[projectId];
    
    if (listing.paymentToken == PaymentToken.ETH) {
        require(msg.value >= listing.price, "Insufficient ETH payment");
        // msg.value = 100 ETH (Bob이 보낸 것)
        // listing.price = 200 ETH (현재 가격)
        // 100 >= 200 → ❌ REVERT!
    }
}
```

**결과**: ✅ PASS
- 가격 변경되면 구매 실패
- Bob 보호됨 (예상보다 비싸면 실패)

---

### 시나리오 7: 매우 큰 프로젝트 (성능)

**상황**:
```
User가 10,000개 clay 객체 생성
```

**코드**: `AdvancedClay.tsx:3331-3351`
```typescript
clayObjects.forEach(clay => {
  if (clay.librarySourceId) {
    detectedLibraries.set(...)
  }
})
// O(n), n = 10,000
// 시간: ~1-10ms ✅
```

**직렬화**: `clayStorageService.ts:75-175`
```typescript
const serializedClays = clays.map((clay) => {
  // 각 객체 처리
})
// O(n), n = 10,000
// 시간: ~10-50ms ✅
```

**JSON 크기**:
```
10,000 객체 * ~500 bytes = 5 MB
→ Chunked upload 필요 ✅
```

**검증**: ✅ PASS (청크 시스템 있음)

---

### 시나리오 8: 매우 작은 값 (로열티 0.000001 ETH)

**코드**: `lib/royaltyService.ts:95-96`
```typescript
for (const library of activeLibraries) {
  const state = currentStates.get(library.projectId);
  if (state) {
    totalRoyaltyETH += state.ethAmount;  // 0.000001
  }
}
```

**컨트랙트**:
```solidity
if (dep.fixedRoyaltyETH > 0 && owner != address(0)) {
    pendingRoyaltiesETH[owner] += dep.fixedRoyaltyETH;
    // 0.000001 ETH도 기록됨 ✅
}
```

**검증**: ✅ PASS (wei 단위로 정확)

---

### 시나리오 9: 로열티 0 + 의존성 있음

**상황**:
```
Library A (0 ETH, 0 USDC) - 무료
Library B (uses A)
```

**Library B 등록 시**:
```typescript
currentStates.get("A") = { exists: true, enabled: true, ethAmount: 0, usdcAmount: 0 }

if (current.exists && current.enabled) {
  minETH += 0  // 0 추가
  activeLibraries.push("A")  // 포함됨!
}

minETH = 0

if (ethPrice <= 0) → false (0.01 > 0이므로)
// 통과 ✅
```

**저장 시**:
```typescript
activeLibraries = [A]
totalRoyaltyETH = 0

if (needsRegistration && activeLibraries.length > 0) {
  // true
  registerProjectRoyalties(projectId, ["A"]) ✅
}

if (totalRoyaltyETH > 0) → false
// recordRoyalties 건너뜀 ✅
```

**검증**: ✅ PASS (무료 library 정상 작동)

---

### 시나리오 10: Marketplace 구매 중 listing 취소

**타임라인**:
```
T1: Bob이 구매 트랜잭션 전송
T2: Alice가 cancelListing 트랜잭션 전송
T3: 어느 것이 먼저 블록에 포함되는가?
```

**Case A: Bob 먼저**:
```solidity
buyAsset() {
    require(listing.isActive, "Listing not active");  // ✅ true
    // 구매 진행
    listing.isActive = false;
}

// Alice 트랜잭션 실행
cancelListing() {
    require(listing.isActive);  // ❌ false
    // REVERT
}
```

**Case B: Alice 먼저**:
```solidity
cancelListing() {
    listing.isActive = false;
}

// Bob 트랜잭션 실행
buyAsset() {
    require(listing.isActive);  // ❌ false
    // REVERT
}
```

**결과**: ✅ PASS
- 먼저 실행된 것만 성공
- 나중 것은 revert
- 자금 안전

---

### 시나리오 11: 잔액 부족

**상황**:
```
User가 Library A import (1.0 ETH)
User 잔액: 0.5 ETH
→ 저장 시도
```

**코드**:
```typescript
const ethTx = await contract.recordRoyalties(projectId, 0, 0, { value: royaltyWei });
// value = 1.0 ETH
// 잔액 = 0.5 ETH
// → ❌ REVERT: insufficient funds
```

**에러 처리**:
```typescript
catch (error) {
  return { success: false, error: error.message }
}

// 상위
if (!result.success) {
  throw new Error('Library purchase failed: insufficient funds')
}
// 저장 중단 ✅
```

**결과**: ✅ PASS (명확한 에러)

---

## 📊 트랜잭션 순서 분석

### 현재 순서 (신규 저장)

```typescript
1. registerProjectRoyalties(projectId, [dependencies])
   ↓ 성공 (블록체인 기록)
   
2. recordRoyalties (ETH) { value: X ETH }
   ↓ 성공 (로열티 지불)
   
3. approve USDC
   ↓ 성공
   
4. recordRoyalties (USDC)
   ↓ 성공
   
5. uploadClayProject
   ↓ 성공 (Irys)
```

### 부분 실패 케이스

**Case 1: Step 1 실패**
```
→ 전체 중단 ✅
→ 재시도 가능 ✅
→ 자금 손실 없음 ✅
```

**Case 2: Step 2 실패 (registerProjectRoyalties 성공 후)**
```
→ 블록체인: 등록됨
→ 로열티: 미지불 ❌

재시도:
→ needsRegistration = false
→ return early (로열티 안냄) ❌❌❌
→ 프로젝트만 저장됨

결과: Library 크리에이터 손해! 🚨
```

**Case 3: Step 3-4 실패 (ETH는 성공)**
```
→ ETH 로열티: 지불됨 ✅
→ USDC 로열티: 미지불 ❌

재시도:
→ needsRegistration = false
→ return early
→ USDC 로열티 영원히 미지불 ❌
```

**Case 4: Step 5 실패 (로열티 모두 성공)**
```
→ 로열티: 지불됨 ✅
→ Irys: 실패 ❌

재시도:
→ needsRegistration = false
→ return early (로열티 안냄) ✅
→ Irys 업로드만 재시도 ✅

결과: 정상 ✅
```

---

### 🔴 버그 27: 부분 실패 후 재시도 시 로열티 미지불

**근본 원인**:
```typescript
// 업데이트와 부분 실패를 구분 못함
if (!needsRegistration) {
  // 업데이트? 아니면 부분 실패?
  // 알 수 없음!
  return { totalCostETH: 0 }
}
```

**해결 필요**:
```typescript
// 옵션 1: 블록체인에서 로열티 지불 여부 확인
const events = await contract.queryFilter(
  contract.filters.RoyaltyRecorded(projectId)
);

if (events.length === 0) {
  // 등록은 됐지만 로열티 미지불
  // 로열티만 재시도
}

// 옵션 2: 항상 최초 저장 시 모든 단계 완료 보장
// (원자성)
```

**심각도**: 🔴 **매우 높음** (크리에이터 손해)

---

## 🔍 더 많은 상용화 시나리오

### 시나리오 12: 가스비 급등

```
평소: 0.1 gwei
급등: 100 gwei (1000배)

registerProjectRoyalties (30 libraries):
  가스: 1,500,000
  비용: 1,500,000 * 100 gwei * $3000 = $450
  
사용자: ❌ 거부 가능성 높음
```

**현재 처리**: 
- 거부 시 전체 저장 실패
- 재시도 가능 ✅

---

### 시나리오 13: Irys 서비스 중단

```
Irys가 일시적으로 다운
→ fixedKeyUploader.upload() → timeout
```

**현재 처리**:
```typescript
catch (uploadError) {
  throw new Error('Failed to upload project to Irys. Please try again.')
}
// 저장 실패, 재시도 가능 ✅
```

**재시도 시**:
- 로열티 재지불 안함 ✅

---

### 시나리오 14: 매우 긴 프로젝트 이름

```
projectName = "A".repeat(10000)  // 10,000자
```

**Irys**:
```typescript
tags.push({ name: 'Project-Name', value: projectName });
// Irys tag 크기 제한?
```

**검증 필요**: Tag 크기 제한 체크

**현재**: ❌ 검증 없음

**심각도**: 🟡 **낮음**

---

### 시나리오 15: 음수 가격

```
Library 등록 시 가격 -1 ETH
```

**클라이언트**: `AdvancedClay.tsx:2393`
```typescript
const price = parseFloat(libraryPrice || '0')

if (price === 0) {
  showPopup('Please set a royalty amount', 'warning')
  return
}
// ❌ 음수 체크 없음!
```

**컨트랙트**: `ClayLibrary.sol:125`
```solidity
require(
    royaltyPerImportETH > 0 || royaltyPerImportUSDC > 0,
    "At least one royalty must be set"
);
// uint256이므로 음수 불가 (컴파일 에러) ✅
```

**결과**: ✅ PASS (Solidity 타입 보호)

---

## 📊 종합 문제 리스트

| # | 문제 | 심각도 | 상태 |
|---|------|--------|------|
| 1-20 | (이전 버그들) | 🔴-🟡 | ✅ 수정 |
| 21 | 로열티 성공 Irys 실패 재시도 | ✅ | 안전 |
| 22 | 사용자 안내 부족 | 🟡 | 개선 권장 |
| 23 | 무료 Library 등록 불가 | 🟡 | 설계 |
| 24 | **부분 실패 로열티 미지불** | 🔴 | **치명적** |
| 25 | RPC 호출 과다 | 🟠 | 성능 |
| 26 | 직접 호출 보호 | ✅ | 안전 |
| 27 | **부분 실패 재시도** | 🔴 | **치명적** |

---

## 🚨 새로 발견된 치명적 문제

### 버그 24/27: 부분 실패 시 로열티 미지불

**시나리오**:
```
registerProjectRoyalties ✅ (블록체인 기록)
recordRoyalties ❌ (네트워크 실패)

재시도:
→ needsRegistration = false
→ return early
→ recordRoyalties 영원히 실행 안됨! 🚨
```

**영향**:
- Library 크리에이터 로열티 못받음
- 드물게 발생하지만 치명적
- 네트워크 불안정 시 발생 가능

**해결 필요**: Yes

계속 수정할까요?










