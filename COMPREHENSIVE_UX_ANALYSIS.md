# 포괄적 UX 시나리오 분석 및 코드 검증

## 📋 검증 범위
기존 엣지 케이스 + 실제 사용자 UX 흐름 + 컨트랙트/프론트 함수 오류

---

## 🔍 발견된 추가 문제들

### 🔴 문제 9: activeLibraries가 빈 배열일 때 registerProjectRoyalties 호출

**위치**: `lib/royaltyService.ts:137-150`

**시나리오**:
```
1. User가 Library A import
2. Library A 삭제됨 (또는 비활성화)
3. User가 저장

코드 흐름:
  usedLibraries = [Library A]
  
  → activeLibraries = []  // 필터링됨
  
  → dependencyIds = []  // 빈 배열!
  
  → contract.registerProjectRoyalties(projectId, [])
```

**컨트랙트 코드**: `contracts/ClayRoyalty.sol:88-113`
```solidity
function registerProjectRoyalties(
    string memory projectId,
    string[] memory dependencyProjectIds  // 빈 배열이 들어옴
) external {
    require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
    
    ProjectRoyalties storage royalty = projectRoyalties[projectId];
    royalty.projectId = projectId;
    royalty.hasRoyalties = true;  // ✅ true로 설정됨
    
    for (uint256 i = 0; i < dependencyProjectIds.length; i++) {
        // 빈 배열이므로 실행 안됨
    }
    
    emit RoyaltiesRegistered(projectId, dependencyProjectIds.length);
    // RoyaltiesRegistered(projectId, 0)
}

// 결과: hasRoyalties = true이지만 dependencies = [] (빈 배열)
```

**나중에 import 시**:
```solidity
recordRoyalties(projectId, ...) {
    ProjectRoyalties storage royalty = projectRoyalties[projectId];
    require(royalty.hasRoyalties, "No royalties for this project");
    // ✅ true이므로 통과
    
    if (paymentToken == PaymentToken.USDC) {
        uint256 totalUSDC = 0;
        for (uint256 i = 0; i < royalty.dependencies.length; i++) {
            // dependencies = [] 이므로 실행 안됨
        }
        
        require(totalUSDC > 0, "No USDC royalties for this project");
        // ❌ 실패! totalUSDC = 0
    }
}
```

**문제**:
- registerProjectRoyalties 성공했지만
- recordRoyalties는 "No USDC royalties" 에러
- 사용자 혼란

**심각도**: 🟠 **중간** (트랜잭션 실패하지만 재시도 가능)

---

### 🔴 문제 10: 프로젝트 업데이트 시 로열티 재지불

**위치**: `app/components/AdvancedClay.tsx:3387-3397`

**시나리오**:
```
1. User가 Library A import → Project X 저장
   - 로열티 1.0 ETH 지불 ✅
   - registerProjectRoyalties("project-X", ["lib-A"])
   
2. User가 Project X 로드
   - clayObjects에 librarySourceId 유지됨
   
3. User가 약간 수정 (색상 변경)

4. User가 Update 저장
   - finalUsedLibraries = [Library A] (자동 탐지)
   - processLibraryPurchasesAndRoyalties 호출
   - 로열티 1.0 ETH 다시 지불? 🚨
   
5. registerProjectRoyalties("project-X", ["lib-A"])
   - require(!hasRoyalties) ❌ 실패!
   - 이미 등록되어 있음
```

**코드 분석**:

**저장 시**: `AdvancedClay.tsx:3387-3397`
```typescript
if (currentProjectInfo && !saveAs) {
  // Update existing project
  projectId = currentProjectInfo.projectId;  // 같은 ID
  rootTxId = currentProjectInfo.rootTxId;
}

// 자동 탐지
finalUsedLibraries = [Library A]

// 로열티 처리
if (finalUsedLibraries.length > 0) {
  await processLibraryPurchasesAndRoyalties(
    serialized.id,  // 같은 projectId!
    finalUsedLibraries,
    ...
  )
}
```

**컨트랙트**: `ClayRoyalty.sol:92`
```solidity
require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
// ❌ 실패! 이미 등록되어 있음
```

**문제**:
- 프로젝트 업데이트 시 로열티 재등록 시도
- 컨트랙트 revert
- 저장 실패!

**심각도**: 🔴 **매우 높음** (프로젝트 업데이트 불가능!)

---

### 🔴 문제 11: calculateTotalRoyalties는 삭제된 library 포함

**위치**: `contracts/ClayRoyalty.sol:121-136`

**코드**:
```solidity
function calculateTotalRoyalties(string memory projectId) public view returns (uint256 totalETH, uint256 totalUSDC) {
    ProjectRoyalties storage royalty = projectRoyalties[projectId];
    
    if (!royalty.hasRoyalties) {
        return (0, 0);
    }
    
    // Sum up fixed royalties
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        LibraryDependency memory dep = royalty.dependencies[i];
        totalETH += dep.fixedRoyaltyETH;  // ❌ owner 체크 없음!
        totalUSDC += dep.fixedRoyaltyUSDC;
    }
    
    return (totalETH, totalUSDC);
}
```

**문제**:
- 삭제된 library의 royalty도 포함
- view 함수라 실제 지불과 다름
- 사용자에게 잘못된 정보 제공

**사용 위치 확인 필요**:
- 이 함수를 어디서 호출하는가?
- UI에서 표시하는가?

**심각도**: 🟡 **낮음-중간** (정보 표시 부정확)

---

### 🔴 문제 12: Library import 후 다른 library 추가 import

**시나리오**:
```
1. User가 Library A import
   - usedLibraries = [A]
   
2. User가 작업 중

3. User가 Library B import
   - usedLibraries = [A, B]
   
4. Library A 삭제됨

5. User가 저장
   - activeLibraries = [B]  // A 필터링됨
   - registerProjectRoyalties(projectId, ["lib-B"])
   
6. 문제: clay 객체 중 일부는 여전히 librarySourceId = "lib-A"
   - 서명 시 clayDataHash에 "lib-A" 포함
   - usedLibraries에는 "lib-B"만
   - 서명 검증 시 불일치 발생 가능?
```

**코드 확인**: `lib/projectIntegrityService.ts:46-62`
```typescript
function hashClayData(clays: any[]): string {
  const librarySources = clays
    .filter(clay => clay.librarySourceId)
    .map(clay => ({
      id: clay.id,
      librarySourceId: clay.librarySourceId,  // "lib-A" 포함
      librarySourceName: clay.librarySourceName
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  
  const json = JSON.stringify(librarySources);
  return ethers.keccak256(ethers.toUtf8Bytes(json));
}

function hashLibraries(libraries: any[]): string {
  const canonical = sorted.map(lib => ({
    projectId: lib.projectId,  // "lib-B"만 포함
    ...
  }));
  
  return ethers.keccak256(ethers.toUtf8Bytes(json));
}
```

**문제**:
- clayDataHash: lib-A, lib-B 포함
- librariesHash: lib-B만 포함
- 나중에 로드 시:
  - usedLibraries = [B] (activeLibraries만 저장됨)
  - clays = [librarySourceId: A, librarySourceId: B]
  - detectLibraryTampering: missing = [A] 🚨

**심각도**: 🟠 **중간** (서명 검증 실패, 하지만 정상 동작)

---

### 🟡 문제 13: Marketplace 거래 시 Library import 로열티 없음

**시나리오**:
```
1. Alice가 Library A 소유
2. Alice가 Marketplace에 판매 (10 ETH)
3. Bob이 구매
   - 10 ETH 지불
   - Library A 소유권 이전
   
4. Bob이 Library A import
   - 로열티 지불? ❌ 없음!
   - 이미 소유자이므로
```

**코드 확인 필요**: 
- Marketplace 구매자는 library를 공짜로 import?
- 아니면 import 시에도 로열티 지불?

**위치**: `lib/libraryService.ts` - 구매 함수가 제거되어 있음
```typescript
// Purchase functions removed - all transactions through Marketplace only
```

**문제**:
- Marketplace 가격에 library import 로열티가 포함되어야 하는가?
- 현재는 순수 소유권만 거래
- Library import는 별도 개념

**심각도**: 💭 **설계 이슈** (버그는 아니지만 명확화 필요)

---

### 🔴 문제 14: 삭제된 library 객체 제거 시 usedLibraries 불일치

**시나리오**:
```
1. User가 Library A, B import
   - usedLibraries = [A, B]
   - clayObjects = [A 객체들..., B 객체들...]
   
2. Library A 삭제됨

3. User가 Library A의 모든 객체 삭제 (수동으로)
   - clayObjects = [B 객체들...]
   
4. 저장
   - 자동 탐지: finalUsedLibraries = [B]
   - projectData.usedLibraries = [B]
   - clays = [librarySourceId: B만]
   
5. 정상 ✅
   
BUT, User가 Library A 객체를 하나라도 남기면?

3b. User가 A 객체 일부만 삭제
    - clayObjects = [A 객체 1개, B 객체들...]
    
4b. 저장
    - 자동 탐지: finalUsedLibraries = [A, B]
    - 블록체인 체크: A 삭제됨
    - activeLibraries = [B]
    - registerProjectRoyalties(projectId, ["lib-B"])
    
    BUT: clays = [
      {librarySourceId: "lib-A"},  // A 객체 남음
      {librarySourceId: "lib-B"}, ...
    ]
    
5b. 나중에 로드
    - usedLibraries = [B]
    - clays = [A, B]
    - detectLibraryTampering: missing = [A] 🚨
    - 서명 검증 실패? (A가 clayDataHash에 있지만 usedLibraries에 없음)
```

**문제**:
- 삭제된 library의 객체가 남아있으면
- 서명 불일치 발생

**심각도**: 🟠 **중간** (사용자가 수동으로 객체 정리해야 함)

---

## 📊 새로운 UX 시나리오 테스트

### UX 1: 프로젝트 업데이트 (가장 중요!)

**시나리오**:
```
Day 1: User가 Library A import → Project X 저장
  - registerProjectRoyalties("project-X", ["lib-A"])
  - hasRoyalties = true
  
Day 2: User가 Project X 로드 후 수정
  - 색상 변경
  - Library는 그대로
  
Day 3: User가 Update 저장
```

**코드 흐름**:

**AdvancedClay.tsx:3387-3397**:
```typescript
if (currentProjectInfo && !saveAs) {
  // Update existing project
  projectId = currentProjectInfo.projectId;  // ✅ 같은 ID
  rootTxId = currentProjectInfo.rootTxId;
  console.log('Updating existing project:', projectId);
}

// 자동 탐지 (업데이트든 신규든 실행됨)
finalUsedLibraries = detectFromClayObjects()  // [Library A]

// 로열티 처리
if (finalUsedLibraries.length > 0) {
  await processLibraryPurchasesAndRoyalties(
    serialized.id,  // project-X (같은 ID!)
    finalUsedLibraries,
    ...
  )
}
```

**royaltyService.ts:146**:
```typescript
const regTx = await contract.registerProjectRoyalties(projectId, dependencyIds);
// projectId = "project-X" (이미 등록됨!)
```

**컨트랙트**:
```solidity
require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
// ❌ REVERT! 이미 등록되어 있음!
```

**결과**: ❌ **프로젝트 업데이트 완전히 불가능!**

**심각도**: 🔴 **치명적** (핵심 기능 작동 안함)

---

### UX 2: Library import 후 제거 후 다시 import

**시나리오**:
```
1. User가 Library A import
   - clayObjects += [A 객체들]
   - usedLibraries = [A]
   
2. User가 마음에 안들어서 A 객체들 모두 삭제
   - clayObjects = [] (A 제거)
   
3. User가 Library B import
   - clayObjects = [B 객체들]
   - usedLibraries = [A, B]  // A가 남아있음!
   
4. 저장
   - 자동 탐지: finalUsedLibraries = [B]  // A 제거됨 ✅
   - 로열티: B만 지불 ✅
```

**결과**: ✅ 정상 작동 (자동 탐지가 해결)

---

### UX 3: Marketplace 구매 후 Library import

**시나리오**:
```
1. Alice가 Library A 소유 (1.0 ETH 로열티)
2. Alice가 Marketplace에 판매 (100 ETH)
3. Bob이 구매 (100 ETH 지불)
   - Library A 소유권 → Bob
   
4. Bob이 자신의 프로젝트에 Library A import
   - 로열티 지불? 아니면 무료? 🤔
```

**코드 분석 필요**:

현재 시스템에서는 **구매 개념이 없음**:
- `lib/libraryService.ts`에 purchase 함수 제거됨
- "all transactions through Marketplace only"
- Marketplace는 소유권만 거래

**Library import**는:
- 항상 무료 다운로드
- 로열티는 **사용(import)**할 때 지불
- 소유권과 무관

**결과**: 
```
Bob이 Library A를 100 ETH에 구매했어도
다른 사용자가 Library A import 시:
  - Bob에게 1.0 ETH 로열티 지불 ✅
  
Bob 본인이 Library A import 시:
  - Bob에게 1.0 ETH 로열티 지불?
  - 자기 자신에게? 🤔
```

**확인 필요**: 소유자 본인의 library import 체크가 있는가?

---

### UX 4: Library 소유권 변경 후 로열티

**시나리오**:
```
T1: User가 Library A (Alice 소유) import → Project X 저장
    - registerProjectRoyalties("project-X", ["lib-A"])
    - dependencies[0] = {projectId: "lib-A", fixedRoyaltyETH: 1.0}
    
T2: Alice가 Library A를 Marketplace에서 Bob에게 판매
    - transferAssetOwnership("lib-A", Bob)
    
T3: Carol이 Project X import
    - recordRoyalties("project-X", ..., ETH) { value: 1.0 }
    - getCurrentOwner("lib-A") = Bob
    - pendingRoyaltiesETH[Bob] += 1.0 ETH ✅
```

**결과**: ✅ 정상 (Bob이 로열티 받음 - Pull Pattern 작동)

---

### UX 5: 모든 의존성이 삭제/비활성화됨

**시나리오**:
```
Project X uses [Library A, Library B, Library C]
→ 모두 삭제됨

User가 Project X import 시:

코드 흐름:
  usedLibraries = [A, B, C]
  
  → currentStates: 모두 exists = false
  
  → activeLibraries = []  // 빈 배열
  
  → if (activeLibraries.length === 0) ?
```

**코드 확인**: `lib/royaltyService.ts:66-68`
```typescript
if (usedLibraries.length === 0) {
  return { success: true, totalCostETH: 0, totalCostUSDC: 0, alreadyOwned: 0 };
}

// activeLibraries 체크는? ❌ 없음!
```

**실제 흐름**:
```typescript
activeLibraries = []
totalRoyaltyETH = 0
totalRoyaltyUSDC = 0

// STEP 1: Register
dependencyIds = []  // 빈 배열
await contract.registerProjectRoyalties(projectId, [])
// hasRoyalties = true, dependencies = []

// STEP 2: Pay ETH
if (totalRoyaltyETH > 0) {  // false - 건너뜀
}

// STEP 3: Pay USDC  
if (totalRoyaltyUSDC > 0) {  // false - 건너뜀
}

// 결과
return { success: true, totalCostETH: 0, totalCostUSDC: 0 }
```

**나중에 import 시**:
```solidity
recordRoyalties("project-X", ..., ETH) {
    require(royalty.hasRoyalties)  // ✅ true
    
    uint256 totalETHNeeded = 0;
    for (... royalty.dependencies ...) {
        // dependencies = [] 이므로 실행 안됨
    }
    // totalETHNeeded = 0
    
    require(msg.value >= totalETHNeeded)  // 0 >= 0 ✅
    
    // 아무것도 배분 안함
    // msg.value는? 환불됨 ✅
}
```

**문제**:
- 빈 배열로 registerProjectRoyalties 호출은 괜찮음
- 하지만 불필요한 트랜잭션 (가스 낭비)

**심각도**: 🟡 **낮음** (작동은 하지만 비효율적)

---

### UX 6: Library import 중복 (같은 library 2번 import)

**시나리오**:
```
1. User가 Library A import
2. User가 또 Library A import (실수로)
```

**코드**: `AdvancedClay.tsx:2593-2603`
```typescript
// Avoid duplicates
setUsedLibraries(prev => {
  const existing = new Set(prev.map(lib => lib.projectId))
  const newLibs = librariesToAdd.filter(lib => !existing.has(lib.projectId))
  return [...prev, ...newLibs]
})
```

**결과**: ✅ 중복 방지됨

---

### UX 7: Library 로열티 0으로 설정 (무료 library)

**시나리오**:
```
1. Alice가 Library A 등록 (0 ETH, 0 USDC)
   - 무료 library로 제공
   
2. User가 Library A import → Project X 저장
   - finalUsedLibraries = [A]
   - activeLibraries = [A] (exists, enabled이지만 royalty = 0)
   - totalRoyaltyETH = 0
   - totalRoyaltyUSDC = 0
```

**처리**:
```typescript
if (totalRoyaltyETH > 0) {  // false
}
if (totalRoyaltyUSDC > 0) {  // false
}

// registerProjectRoyalties는? ✅ 호출됨!
await contract.registerProjectRoyalties(projectId, ["lib-A"])
```

**컨트랙트**:
```solidity
getRoyaltyFee("lib-A") = (0, 0)
dependencies.push({
  projectId: "lib-A",
  fixedRoyaltyETH: 0,
  fixedRoyaltyUSDC: 0
})
```

**나중에 import**:
```solidity
recordRoyalties(..., ETH) {
    totalETHNeeded = 0
    require(msg.value >= 0)  // ✅
    // 0 ETH로 import 가능
}
```

**결과**: ✅ 정상 작동 (무료 library 지원)

---

### 🔴 문제 15: 프로젝트 Save As 후 원본 수정

**시나리오**:
```
1. User가 Library A import → Project X 저장
   - registerProjectRoyalties("project-X", ["lib-A"])
   
2. User가 Project X 로드
   
3. User가 Save As "Project Y"
   - saveAs = true
   - projectId = 새로운 ID 생성 ✅
   - finalUsedLibraries = [A]
   - registerProjectRoyalties("project-Y", ["lib-A"]) ✅
   
4. User가 다시 Project X 로드 후 수정
   
5. User가 Update 저장
   - projectId = "project-X" (기존)
   - registerProjectRoyalties("project-X", ...) ❌ 이미 등록됨!
```

**결과**: 🔴 **문제 10과 동일** (업데이트 불가)

---

## 🔍 컨트랙트 함수 누락 확인

### ClayRoyalty.sol 검토

**있는 함수**:
- ✅ `registerProjectRoyalties`
- ✅ `calculateTotalRoyalties` (삭제된 library 포함 문제)
- ✅ `recordRoyalties`
- ✅ `claimRoyaltiesETH`
- ✅ `claimRoyaltiesUSDC`
- ✅ `getPendingRoyalties`
- ✅ `getProjectDependencies`

**누락된 함수**:
- ❌ `updateProjectRoyalties` (프로젝트 업데이트 용)
- ❌ `isOwner(projectId, address)` (본인 소유 체크)

---

### ClayLibrary.sol 검토

**있는 함수**:
- ✅ `registerAsset`
- ✅ `updateRoyaltyFee`
- ✅ `disableRoyalty`
- ✅ `enableRoyalty`
- ✅ `deleteAsset`
- ✅ `getAsset`
- ✅ `getCurrentOwner`
- ✅ `getUserAssets`
- ✅ `transferAssetOwnership`
- ✅ `getRoyaltyFee`

**누락된 함수**:
- ⚠️ `isOwner(projectId, address)` helper
- ⚠️ dependency 기반 최소 가격 검증 (TODO로 표시됨)

---

## 🚨 치명적 발견: 프로젝트 업데이트 불가

### 문제 분석

**근본 원인**:
```solidity
// ClayRoyalty.sol:92
require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
```

**영향**:
```
사용자가 library를 사용한 프로젝트를 저장 후
→ 단 한 번도 업데이트할 수 없음! 🚨
```

**해결 방법 필요**:

**방법 1**: 프로젝트 ID를 매번 새로 생성
```typescript
// 항상 새 projectId
projectId = generateProjectId()
rootTxId = previousRootTxId  // mutable reference
```

**방법 2**: 컨트랙트에 업데이트 함수 추가
```solidity
function updateProjectRoyalties(
    string memory projectId,
    string[] memory dependencyProjectIds
) external {
    require(projectRoyalties[projectId].hasRoyalties, "Not registered");
    // 업데이트 허용
}
```

**방법 3**: hasRoyalties 체크 후 건너뛰기
```typescript
// 클라이언트에서
const alreadyRegistered = await contract.projectRoyalties(projectId).hasRoyalties
if (!alreadyRegistered) {
  await contract.registerProjectRoyalties(...)
}
```

---

### UX 8: 프로젝트 업데이트 + Library 추가

**시나리오**:
```
Day 1: Library A import → Project X 저장
  - registerProjectRoyalties("project-X", ["lib-A"])
  
Day 2: Library B import → Project X 업데이트
  - 기존: [A]
  - 추가: [B]
  - 총: [A, B]
  
  registerProjectRoyalties("project-X", ["lib-A", "lib-B"])?
  → ❌ 이미 등록되어 있음!
```

**문제**: 의존성 추가 불가!

---

## 🔍 추가 검증 필요 사항

### 1. getCurrentOwner 반환값 처리

**컨트랙트**: `ClayLibrary.sol:280-289`
```solidity
function getCurrentOwner(string memory projectId) external view returns (address) {
    LibraryAsset storage asset = libraryAssets[projectId];
    
    if (!asset.exists) {
        return address(0);  // 삭제된 경우
    }
    
    return asset.currentOwner;
}
```

**사용**: `ClayRoyalty.sol:160, 192`
```solidity
address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);

if (royaltyAmount > 0 && owner != address(0)) {
    pendingRoyaltiesETH[owner] += royaltyAmount;
}
```

**검증**: ✅ 올바름

---

### 2. getRoyaltyFee 비활성화 처리

**컨트랙트**: `ClayLibrary.sol:174-183`
```solidity
function getRoyaltyFee(string memory projectId) external view returns (uint256, uint256) {
    LibraryAsset storage asset = libraryAssets[projectId];
    
    // Return 0 if royalty is disabled
    if (!asset.royaltyEnabled) {
        return (0, 0);
    }
    
    return (asset.royaltyPerImportETH, asset.royaltyPerImportUSDC);
}
```

**검증**: ✅ 올바름 (비활성화 시 0 반환)

**BUT**: 삭제된 경우는?
```solidity
if (!asset.exists) {
    // 체크 없음!
    // asset은 기본값: royaltyPerImportETH = 0
    return (0, 0)  // 결과적으로 0 반환됨
}
```

**검증**: ✅ 안전 (기본값이 0이므로)

---

## 📊 종합 문제 리스트

| # | 문제 | 심각도 | 상태 |
|---|------|--------|------|
| 1-8 | (이전 버그들) | 🔴-🟡 | ✅ 수정됨 |
| 9 | activeLibraries = [] 일 때 빈 배열 등록 | 🟡 | 미수정 |
| 10 | **프로젝트 업데이트 불가** | 🔴🔴🔴 | **치명적** |
| 11 | calculateTotalRoyalties 부정확 | 🟡 | 미수정 |
| 12 | 삭제된 library 객체 남음 시 서명 불일치 | 🟠 | 미수정 |
| 13 | Marketplace vs Import 개념 | 💭 | 설계 |
| 14 | 삭제된 객체 제거 안내 없음 | 🟡 | UX |
| 15 | 프로젝트 업데이트 + Library 추가 불가 | 🔴 | **치명적** |

---

## 🔥 즉시 수정 필요

### 1. 프로젝트 업데이트 시 로열티 재등록 문제 (치명적!)

**현재 상황**:
- library 사용 프로젝트는 단 한 번도 업데이트 불가
- registerProjectRoyalties의 중복 등록 체크 때문

**해결 필요**:
1. 클라이언트에서 이미 등록됐는지 체크
2. 등록 안된 경우만 registerProjectRoyalties 호출
3. 또는 mutable reference 활용

---

## 📝 함수 오류 체크

### 타입 불일치
- ✅ 없음

### 시그니처 불일치
- ✅ 컨트랙트 - 클라이언트 일치

### 누락된 에러 처리
- ⚠️ activeLibraries.length === 0 처리
- ⚠️ hasRoyalties 중복 등록 체크

### 누락된 검증
- 🔴 프로젝트 업데이트 시 hasRoyalties 체크
- 🟡 본인 소유 library import 시 로열티 면제?

---

## ✅ 정상 작동 확인

- ✅ Library 삭제 시 자금 갇힘: 수정됨
- ✅ TOCTOU 가격 역전: 수정됨
- ✅ 중첩 의존성 추적: 정상
- ✅ Marketplace 소유권 변경: 정상
- ✅ 중복 import 방지: 정상
- ✅ 무료 library: 지원됨

---

## 🎯 최종 진단

**심각한 문제**: 🔴🔴🔴 **문제 10번 - 프로젝트 업데이트 완전 불가능**

이 문제는 **즉시 수정이 필요**합니다!

계속 수정할까요?





