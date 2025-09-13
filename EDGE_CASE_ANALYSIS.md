# Library & Marketplace 엣지 케이스 완전 분석

## 📋 검증 범위
1. Library가 제거된 경우
2. 의존성 중첩이 있는 경우
3. Library 가격이 변경된 경우
4. 중첩 중 일부 의존성이 사라진 경우
5. Royalty 비활성화된 경우
6. 시간차 공격 (TOCTOU)

---

## 🔴 발견된 문제들

### 문제 1: 삭제된 Library의 USDC 로열티가 컨트랙트에 갇힘

**위치**: `contracts/ClayRoyalty.sol:170-202`

**시나리오**:
```
1. Library A (1.0 ETH, 5 USDC)
2. User가 Library A import → Project B 저장
   - registerProjectRoyalties("project-B", ["lib-A"])
   - dependencies[0] = {projectId: "lib-A", fixedRoyaltyUSDC: 5 USDC}
3. Library A owner가 deleteAsset("lib-A") 실행
   - asset.exists = false
   - asset.royaltyEnabled = false
4. 나중에 누군가 Project B import
   - recordRoyalties("project-B", 0, USDC) 호출
```

**컨트랙트 코드 분석**:
```solidity
// 라인 173-177: 총 USDC 계산
uint256 totalUSDC = 0;
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
}
// totalUSDC = 5 USDC (삭제된 library 포함!)

// 라인 182-185: 사용자로부터 전송
require(
    usdcToken.transferFrom(msg.sender, address(this), totalUSDC),
    "USDC transfer to contract failed"
);
// 사용자는 5 USDC 지불함

// 라인 188-201: 배분
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
    // owner = address(0) (삭제되었으므로)
    
    if (royaltyAmount > 0 && owner != address(0)) {
        // ❌ false - 기록 안됨!
        pendingRoyaltiesUSDC[owner] += royaltyAmount;
    }
}
// 5 USDC가 컨트랙트에 갇힘! 아무도 claim 못함!
```

**문제 심각도**: 🔴 **높음**
- 사용자 자금 손실
- 삭제된 library 수만큼 누적

**ETH의 경우**:
```solidity
// 라인 152-169: ETH는 다름
if (paymentToken == PaymentToken.ETH) {
    require(msg.value > 0, "No ETH sent");
    // msg.value는 사용자가 보낸 양 (클라이언트 계산)
    
    for (...) {
        if (royaltyAmount > 0 && owner != address(0)) {
            pendingRoyaltiesETH[owner] += royaltyAmount;
        }
        // owner가 0이면 그냥 기록 안됨
        // 남은 ETH는? 컨트랙트에 갇힘!
    }
}
```

**ETH도 같은 문제**: 사용자가 보낸 ETH 중 일부가 컨트랙트에 갇힘

---

### 문제 2: Royalty 비활성화 시 최소 가격 불일치

**시나리오**:
```
1. Library A (1.0 ETH, royaltyEnabled = true)
2. User가 Library A import → Project B 저장
   - usedLibraries = [{projectId: "lib-A", royaltyPerImportETH: "1.0"}]
   - registerProjectRoyalties 실행
     - getRoyaltyFee("lib-A") = (1.0 ETH, 0) ✅
     - dependencies[0].fixedRoyaltyETH = 1.0 ETH
3. Library A owner가 disableRoyalty("lib-A") 실행
   - royaltyEnabled = false
   - getRoyaltyFee("lib-A") = (0, 0) 이제!
4. User가 Library B 등록 시도
   - projectData.usedLibraries = [{royaltyPerImportETH: "1.0"}]
   - calculateMinimumPrice = 1.0 ETH
   - User의 가격이 1.2 ETH면 통과
5. 실제로는?
   - getRoyaltyFee("lib-A") = 0
   - 새 프로젝트가 lib-B import 시 lib-A에 로열티 0!
```

**코드 분석**:

**클라이언트 (AdvancedClay.tsx:2462-2494)**:
```typescript
// 프로젝트 저장 시점의 usedLibraries 사용
const { minETH, minUSDC } = await calculateMinimumPrice(dependencyLibraries)
// dependencyLibraries = projectData.usedLibraries (저장된 값)
```

**컨트랙트 (ClayRoyalty.sol:98-107)**:
```solidity
// 등록 시점의 실제 royalty 사용
(uint256 feeETH, uint256 feeUSDC) = libraryContract.getRoyaltyFee(dependencyProjectIds[i]);
// 현재 값 (비활성화되었으면 0)

LibraryDependency memory dep = LibraryDependency({
    fixedRoyaltyETH: feeETH,  // 0이 저장됨!
    fixedRoyaltyUSDC: feeUSDC
});
```

**문제 심각도**: 🟠 **중간**
- 최소 가격은 1.0 ETH를 요구
- 실제 로열티는 0
- Library B는 불필요하게 비싸게 설정됨
- 원작자는 로열티 못받음

---

### 문제 3: Library 가격 변경 시 불일치

**시나리오**:
```
1. Library A (1.0 ETH)
2. User가 Library A import → Project B 저장
   - usedLibraries = [{royaltyPerImportETH: "1.0"}]
3. Library A owner가 updateRoyaltyFee("lib-A", 2.0 ETH, 0)
   - royaltyPerImportETH = 2.0 ETH 이제!
4. User가 Library B 등록 시도
   - projectData.usedLibraries = [{royaltyPerImportETH: "1.0"}] (옛날 값)
   - calculateMinimumPrice = 1.0 ETH
   - User가 1.2 ETH로 등록 → 통과!
5. 실제로는?
   - Library B import 시
   - getRoyaltyFee("lib-A") = 2.0 ETH (현재 값)
   - Library B royalty = 1.2 ETH
   - Library B가 Library A보다 싸짐! 🚨
```

**코드 분석**:

**클라이언트 (calculateMinimumPrice)**:
```typescript
// lib/royaltyService.ts:437-443
const minETH = usedLibraries.reduce((sum, lib) => {
  return sum + parseFloat(lib.royaltyPerImportETH || '0');
}, 0);
// 저장된 값 사용 (1.0 ETH)
```

**컨트랙트 (registerProjectRoyalties)**:
```solidity
// ClayRoyalty.sol:100
(uint256 feeETH, uint256 feeUSDC) = libraryContract.getRoyaltyFee(dependencyProjectIds[i]);
// 현재 값 사용 (2.0 ETH)
```

**문제 심각도**: 🔴 **매우 높음**
- 경제 시스템 붕괴 가능
- Library A 가격을 올리면 기존 파생작들이 더 싸짐
- 원작자 보호 실패

---

### 문제 4: 중첩 중 일부 의존성이 삭제된 경우

**시나리오**:
```
1. Library A (1.0 ETH) ✅ 정상
2. Library B (1.5 ETH, uses A) ✅ 정상
3. User가 Library B import → Project C 저장
   - usedLibraries = ["lib-A", "lib-B"]
   - registerProjectRoyalties 등록
4. Library A owner가 deleteAsset("lib-A") 🗑️
5. Library B owner가 disableRoyalty("lib-B") ⚠️
6. 나중에 User가 Project C import
   - recordRoyalties 호출
   - lib-A: owner = address(0) → 로열티 기록 안됨
   - lib-B: owner 있지만 royaltyAmount = 0 (비활성화됨)
   - 결과: 사용자는 돈을 냈지만 아무도 못받음
```

**코드 추적**:

**등록 시점 (과거)**:
```solidity
// ClayRoyalty.sol:100
(uint256 feeETH, uint256 feeUSDC) = libraryContract.getRoyaltyFee("lib-A");
// lib-A가 정상일 때: (1.0 ETH, 0)

dependencies.push({
    dependencyProjectId: "lib-A",
    fixedRoyaltyETH: 1.0 ETH  // 저장됨
});

(feeETH, feeUSDC) = libraryContract.getRoyaltyFee("lib-B");
// lib-B가 정상일 때: (1.5 ETH, 0)

dependencies.push({
    dependencyProjectId: "lib-B",
    fixedRoyaltyETH: 1.5 ETH  // 저장됨
});
```

**로열티 지불 시점 (현재)**:
```solidity
// ClayRoyalty.sol:156-169
for (uint i = 0; i < dependencies.length; i++) {
    // dep[0]: lib-A, 1.0 ETH
    address owner = getCurrentOwner("lib-A");
    // owner = address(0) (삭제됨)
    
    if (1.0 ETH > 0 && address(0) != address(0)) {
        // ❌ false - 기록 안됨
    }
    
    // dep[1]: lib-B, 1.5 ETH
    owner = getCurrentOwner("lib-B");
    // owner = 0x123... (Bob 주소)
    
    if (1.5 ETH > 0 && 0x123... != address(0)) {
        // ✅ true
        pendingRoyaltiesETH[Bob] += 1.5 ETH
    }
}
```

**문제**: 
- 사용자는 2.5 ETH를 보냈지만 Bob만 1.5 ETH 받음
- 1.0 ETH는 컨트랙트에 갇힘!

**문제 심각도**: 🔴 **매우 높음**

---

### 문제 5: 클라이언트가 삭제된 Library 정보를 사용

**시나리오**:
```
1. User가 Library A import → 저장
   - projectData.usedLibraries = [{projectId: "lib-A", royaltyPerImportETH: "1.0"}]
2. Library A 삭제됨
3. User가 해당 프로젝트를 Library B로 등록 시도
```

**코드 분석**:

**AdvancedClay.tsx:2422-2453**:
```typescript
try {
  projectData = await downloadClayProject(libraryProjectId);
  
  if (projectData.usedLibraries && projectData.usedLibraries.length > 0) {
    dependencyLibraries = projectData.usedLibraries;
    // dependencyLibraries = [{projectId: "lib-A", royaltyPerImportETH: "1.0"}]
  }
}

// 최소 가격 계산
const { minETH } = await calculateMinimumPrice(dependencyLibraries)
// minETH = 1.0 ETH (삭제된 library 포함!)

if (ethPrice <= minETH) {
  return // 차단
}
```

**문제**:
- lib-A는 이미 삭제되어 존재하지 않음
- 하지만 최소 가격에는 포함됨
- Library B는 불필요하게 비싸야 함
- lib-A의 로열티는 어차피 0인데도

**문제 심각도**: 🟠 **중간**

---

### 문제 6: Library 가격 인상 후 파생작 가격 역전

**시나리오**:
```
Time 0:
  Library A: 1.0 ETH
  
Time 1: (User가 작업)
  User가 Library A import → Project B 저장
  usedLibraries = [{royaltyPerImportETH: "1.0"}]
  
Time 2: (Alice가 가격 인상)
  Alice가 updateRoyaltyFee("lib-A", 3.0 ETH, 0)
  Library A: 3.0 ETH 이제!
  
Time 3: (User가 Library 등록)
  User가 Library B로 등록 시도 (2.0 ETH)
  
  클라이언트 체크:
    minETH = 1.0 ETH (저장 시점 값)
    2.0 > 1.0 → ✅ 통과!
  
  컨트랙트 등록:
    registerProjectRoyalties("lib-B", ["lib-A"])
    getRoyaltyFee("lib-A") = 3.0 ETH (현재 값!)
    dependencies.push({fixedRoyaltyETH: 3.0 ETH})
  
Time 4: (다른 사용자가 Library B import)
  Library A: 3.0 ETH
  Library B: 2.0 ETH
  → Library B가 더 싸다! 🚨
  → 모두 Library B만 사용
  → Alice는 수익 못받음 ❌
```

**코드 위치**:

**클라이언트**: `lib/royaltyService.ts:437-443`
```typescript
const minETH = usedLibraries.reduce((sum, lib) => {
  return sum + parseFloat(lib.royaltyPerImportETH || '0');
  // 저장 시점의 값 사용!
}, 0);
```

**컨트랙트**: `contracts/ClayRoyalty.sol:100`
```solidity
(uint256 feeETH, uint256 feeUSDC) = libraryContract.getRoyaltyFee(dependencyProjectIds[i]);
// 등록 시점의 현재 값 사용!
```

**문제 심각도**: 🔴 **매우 높음**
- Time-of-check vs Time-of-use (TOCTOU) 취약점
- 경제 시스템 붕괴
- 원작자 손해

---

### 문제 7: Royalty 비활성화 후 재활성화

**시나리오**:
```
1. Library A (1.0 ETH)
2. User가 Library A import → Project B 저장
   - registerProjectRoyalties: fixedRoyaltyETH = 1.0 ETH
3. Library A owner가 disableRoyalty("lib-A")
   - getRoyaltyFee = 0
4. User2가 Library A import → Project C 저장
   - registerProjectRoyalties: fixedRoyaltyETH = 0
5. Library A owner가 enableRoyalty("lib-A")
   - getRoyaltyFee = 1.0 ETH 다시
6. 결과:
   - Project B import 시: 1.0 ETH 로열티 ✅
   - Project C import 시: 0 ETH 로열티 ❌
   - 같은 Library A를 사용했는데 다른 로열티!
```

**문제 심각도**: 🟡 **중간**
- 일관성 없음
- Project C import가 유리함 (무료)

---

### 문제 8: 중첩 의존성 중간이 삭제된 경우

**시나리오**:
```
Library A (1.0 ETH)
    ↓
Library B (1.5 ETH, uses A)
    ↓
Library C (2.0 ETH, uses B)
    ↓ (Library B 삭제!)
Library D (uses C)
```

**저장된 상태**:
```javascript
// Library C의 프로젝트 데이터
projectC.usedLibraries = [
  {projectId: "lib-A", royaltyPerImportETH: "1.0"},
  {projectId: "lib-B", royaltyPerImportETH: "1.5"}
]

projectC.clays = [
  {id: "c1", librarySourceId: "lib-A"},  // A에서 온 것
  {id: "c2", librarySourceId: "lib-B"},  // B에서 온 것
  {id: "c3", librarySourceId: undefined} // C 작품
]
```

**Library D 등록 시**:
```typescript
// 1. 최소 가격 계산
projectData = await downloadClayProject("lib-C")
dependencyLibraries = [lib-A (1.0), lib-B (1.5)]
minETH = 2.5 ETH

// 2. User가 3.0 ETH로 등록 → 통과

// 3. Library D import 시
// clayObjects = [
//   {librarySourceId: "lib-A"},  // A
//   {librarySourceId: "lib-B"},  // B (삭제됨!)
//   {librarySourceId: "lib-C"},  // C
// ]

// 4. 자동 탐지
detectedLibraries = [
  {projectId: "lib-A", royaltyPerImportETH: "1.0"},
  {projectId: "lib-B", royaltyPerImportETH: "1.5"},  // 삭제된 library!
  {projectId: "lib-C", royaltyPerImportETH: "2.0"}
]

// 5. 로열티 지불
totalRoyaltyETH = 1.0 + 1.5 + 2.0 = 4.5 ETH

// 6. registerProjectRoyalties
getRoyaltyFee("lib-A") = 1.0 ETH ✅
getRoyaltyFee("lib-B") = 0 (삭제되었으므로)  ❌
getRoyaltyFee("lib-C") = 2.0 ETH ✅

// 7. recordRoyalties 시
getCurrentOwner("lib-B") = address(0)
→ lib-B의 1.5 ETH는 컨트랙트에 갇힘!
```

**문제 심각도**: 🔴 **높음**
- 사용자 자금 손실
- 의존성 체인 깨짐

---

### 문제 9: 클라이언트가 현재 Library 상태를 모름

**위치**: `app/components/AdvancedClay.tsx:2462-2494`

**현재 로직**:
```typescript
// projectData.usedLibraries 사용 (과거 데이터)
const { minETH, minUSDC } = await calculateMinimumPrice(dependencyLibraries)
```

**필요한 것**:
```typescript
// 각 library의 현재 블록체인 상태 확인
for (const lib of dependencyLibraries) {
  const currentRoyalty = await getLibraryCurrentRoyalty(lib.projectId)
  // 현재 getRoyaltyFee 값
}
```

**문제 심각도**: 🔴 **높음**
- 모든 최소 가격 계산이 부정확
- TOCTOU 취약점

---

### 문제 10: USDC totalUSDC 계산 로직

**위치**: `contracts/ClayRoyalty.sol:173-177`

```solidity
// Calculate total USDC needed
uint256 totalUSDC = 0;
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
}
```

**문제**:
- 삭제된 library의 royalty도 포함
- 비활성화된 library의 royalty도 포함 (fixedRoyalty는 등록 시점 값)
- 사용자가 과다 지불

**ETH는?**:
```solidity
// ETH의 경우는 msg.value 사용 (클라이언트 계산)
if (paymentToken == PaymentToken.ETH) {
    require(msg.value > 0, "No ETH sent");
```

클라이언트가 계산한 값을 보내므로, 같은 문제.

---

## 📊 문제 요약표

| # | 문제 | 위치 | 심각도 | 영향 |
|---|------|-----|-------|-----|
| 1 | 삭제된 library USDC 갇힘 | ClayRoyalty.sol:174-201 | 🔴 높음 | 자금 손실 |
| 2 | Royalty 비활성화 시 불일치 | calculateMinimumPrice | 🟠 중간 | 부정확한 가격 |
| 3 | 가격 변경 시 역전 | TOCTOU | 🔴 매우 높음 | 경제 붕괴 |
| 4 | 중첩 중 삭제 | recordRoyalties | 🔴 높음 | 자금 손실 |
| 5 | 삭제된 library 최소가격 | calculateMinimumPrice | 🟠 중간 | 불필요한 제약 |
| 6 | ETH 로열티도 갇힘 | ClayRoyalty.sol:165 | 🔴 높음 | 자금 손실 |
| 7 | 재활성화 불일치 | 전체 흐름 | 🟡 중간 | 일관성 |
| 8 | 클라이언트-컨트랙트 싱크 | 전체 | 🔴 높음 | 모든 계산 부정확 |

---

## 🔍 근본 원인 분석

### 1. Time-of-Check vs Time-of-Use (TOCTOU)

**체크 시점** (클라이언트):
- 프로젝트 저장 시점의 `usedLibraries` 사용
- 또는 현재 세션의 `usedLibraries` state

**사용 시점** (컨트랙트):
- Library 등록 시: `getRoyaltyFee()` - 현재 값
- 로열티 지불 시: `getCurrentOwner()` - 현재 소유자
- 로열티 지불 시: `fixedRoyaltyETH` - 등록 시점 값

**불일치**:
- 저장 시점 → 등록 시점: 시간차
- 등록 시점 → 사용 시점: 시간차

### 2. 이중 진실의 원천 (Dual Source of Truth)

**클라이언트 진실**:
```typescript
projectData.usedLibraries = [
  {projectId: "lib-A", royaltyPerImportETH: "1.0"}  // 과거
]
```

**블록체인 진실**:
```solidity
libraryAssets["lib-A"].royaltyPerImportETH = 3.0 ETH  // 현재
libraryAssets["lib-A"].exists = false  // 또는 삭제됨
```

**충돌 가능성**:
- 어느 값을 믿어야 하는가?
- 언제 동기화해야 하는가?

### 3. 불변 기록 vs 가변 상태

**불변**:
- Irys에 저장된 `projectData.usedLibraries`
- ClayRoyalty에 저장된 `dependencies[i].fixedRoyaltyETH`

**가변**:
- ClayLibrary의 `royaltyPerImportETH` (updateRoyaltyFee)
- ClayLibrary의 `royaltyEnabled` (disable/enable)
- ClayLibrary의 `exists` (deleteAsset)

**문제**:
- 불변 데이터가 가변 상태를 참조
- 참조가 깨질 수 있음

---

## 💡 필요한 해결책

### 해결책 1: 클라이언트에서 현재 Library 상태 확인
```typescript
// Library 등록 시
for (const lib of dependencyLibraries) {
  const currentRoyalty = await getLibraryCurrentRoyalty(lib.projectId)
  const exists = await checkLibraryExists(lib.projectId)
  
  if (!exists) {
    // 삭제된 library 제외
    continue
  }
  
  if (!currentRoyalty.enabled) {
    // 비활성화된 library는 0으로
    minETH += 0
  } else {
    minETH += currentRoyalty.ethAmount
  }
}
```

### 해결책 2: 컨트랙트에서 삭제된 library 필터링
```solidity
// recordRoyalties에서
uint256 totalUSDC = 0;
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
    
    // owner가 있는 경우만 카운트
    if (owner != address(0)) {
        totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
    }
}

require(
    usdcToken.transferFrom(msg.sender, address(this), totalUSDC),
    "USDC transfer to contract failed"
);
```

### 해결책 3: Library 삭제 시 경고
```solidity
function deleteAsset(string memory projectId) external {
    // 이 library를 의존성으로 가진 프로젝트가 있는지 체크
    // 또는 삭제만 하고 royalty는 유지 (soft delete)
}
```

### 해결책 4: 최소 가격 계산을 블록체인에서
```solidity
// Library 등록 시 최소 가격 검증을 컨트랙트에서
function registerAsset(..., string[] memory dependencyIds) external {
    uint256 totalDependencyRoyalty = 0;
    
    for (uint i = 0; i < dependencyIds.length; i++) {
        (uint256 feeETH, ) = getRoyaltyFee(dependencyIds[i]);
        totalDependencyRoyalty += feeETH;
    }
    
    require(
        royaltyPerImportETH > totalDependencyRoyalty,
        "Royalty must be higher than dependencies"
    );
}
```

---

## 🎯 UX 시나리오 테스트 결과

### ✅ 정상 작동하는 경우
1. **Library 정상 등록 및 사용** - ✅ 완벽
2. **중첩 의존성 (모두 정상)** - ✅ 완벽
3. **Marketplace 거래** - ✅ 문제 없음 (royalty와 무관)

### ⚠️ 문제 있는 경우
1. **Library 삭제 후 import** - 🔴 자금 손실
2. **Royalty 비활성화 후 등록** - 🟠 부정확한 가격
3. **가격 변경 후 파생작** - 🔴 가격 역전
4. **중첩 중 일부 삭제** - 🔴 자금 손실

### ❌ 치명적인 경우
1. **가격 인상 후 저가 파생작** - 🔴 경제 붕괴
2. **삭제된 library USDC** - 🔴 자금 컨트랙트에 영구 갇힘

---

## 📝 발견된 오타 및 함수 오류

### 오타는 없음
- ✅ 모든 변수명 일관성 있음
- ✅ 함수 시그니처 일치

### 논리 오류
- 🔴 **TOCTOU 취약점**: 저장 시점 vs 등록 시점 vs 사용 시점
- 🔴 **자금 갇힘**: totalUSDC 계산에 삭제된 library 포함
- 🔴 **가격 역전**: 원작 가격 인상 시 파생작이 더 싸짐

### 누락된 검증
- ❌ Library 존재 여부 확인 (클라이언트)
- ❌ Library royalty 활성화 여부 확인 (클라이언트)
- ❌ 현재 블록체인 상태와 동기화 (클라이언트)
- ❌ 삭제된 library 필터링 (컨트랙트)

---

## 🎯 최종 진단

**현재 상태**: ❌ **심각한 결함 있음**

**주요 문제**:
1. 🔴 **자금 손실**: 삭제/비활성화된 library의 로열티가 컨트랙트에 갇힘
2. 🔴 **경제 붕괴**: 가격 변경 시 최소 가격 검증 우회 가능
3. 🔴 **TOCTOU**: 저장-등록-사용 시점 간 상태 불일치

**배포 가능 여부**: ❌ **수정 필요**

**우선순위**:
1. 🔥 긴급: 자금 갇힘 문제 해결 (컨트랙트 수정 필요)
2. 🔥 긴급: 현재 블록체인 상태 기반 최소 가격 계산
3. 🔥 긴급: Library 등록 시 컨트랙트 레벨 가격 검증

**권장 사항**: 
이 문제들을 해결하기 전에는 **배포하지 않는 것이 좋습니다**.











