# 🚨 치명적 버그 발견 보고서

## ⚠️ 배포 전 필수 수정 사항

실제 코드를 검증한 결과, **8개의 심각한 버그**를 발견했습니다. 배포 전 반드시 수정이 필요합니다.

---

## 🔴 버그 1: 삭제된 Library 로열티가 컨트랙트에 영구 갇힘

### 재현 시나리오
```
1. Library A (1.0 ETH, 10 USDC)
2. User가 Library A import → Project X 저장
   → registerProjectRoyalties("project-X", ["lib-A"])
   → dependencies[0] = {fixedRoyaltyETH: 1.0 ETH, fixedRoyaltyUSDC: 10 USDC}
   
3. Library A owner가 deleteAsset("lib-A")
   → exists = false
   → getCurrentOwner("lib-A") = address(0)
   
4. 다른 사용자가 Project X import
   → recordRoyalties("project-X", 0, USDC) 호출
```

### 코드 분석

**컨트랙트**: `contracts/ClayRoyalty.sol:173-201`

```solidity
// USDC 총액 계산
uint256 totalUSDC = 0;
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
    // 삭제된 library도 포함! totalUSDC = 10 USDC
}

require(totalUSDC > 0, "No USDC royalties for this project");

// 사용자로부터 전송
require(
    usdcToken.transferFrom(msg.sender, address(this), totalUSDC),
    "USDC transfer to contract failed"
);
// ✅ 사용자는 10 USDC 지불

// 배분
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    address owner = libraryContract.getCurrentOwner("lib-A");
    // owner = address(0) ❌
    
    if (royaltyAmount > 0 && owner != address(0)) {
        // false - 실행 안됨 ❌
        pendingRoyaltiesUSDC[owner] += royaltyAmount;
    }
}

// 결과: 10 USDC가 컨트랙트에 남음 (아무도 claim 못함)
```

**ETH도 동일**:
```solidity
// 라인 152-169
require(msg.value > 0, "No ETH sent");
// 사용자가 1.0 ETH 보냄

for (...) {
    if (royaltyAmount > 0 && owner != address(0)) {
        // false - 기록 안됨
    }
}
// 1.0 ETH가 컨트랙트에 갇힘
```

### 영향
- 🔴 **사용자 자금 손실**: 지불했지만 아무도 못받음
- 🔴 **컨트랙트 잔액 누적**: 회수 불가능한 자금 증가
- 🔴 **신뢰 손상**: 사용자가 손해

### 근본 원인
- `totalUSDC` 계산 시 owner 체크 없음
- 사용자가 과다 지불
- 배분 시에만 owner 체크

---

## 🔴 버그 2: Library 가격 변경 시 파생작 가격 역전 (TOCTOU)

### 재현 시나리오
```
T0: Library A 등록 (1.0 ETH)

T1: User가 Library A import
    → usedLibraries = [{projectId: "lib-A", royaltyPerImportETH: "1.0"}]
    
T2: User가 작업 중... (1시간 소요)

T3: Alice가 updateRoyaltyFee("lib-A", 5.0 ETH, 0)
    → Library A: 5.0 ETH 이제!
    
T4: User가 저장 (Library B로 등록하기 위해)
    → projectData.usedLibraries = [{royaltyPerImportETH: "1.0"}] (T1 시점 값)
    
T5: User가 Library B 등록 시도 (2.0 ETH)
    → 클라이언트 최소 가격 체크:
       minETH = 1.0 ETH (projectData.usedLibraries 사용)
       2.0 > 1.0 → ✅ 통과!
    
    → 컨트랙트 등록:
       registerProjectRoyalties("lib-B", ["lib-A"])
       getRoyaltyFee("lib-A") = 5.0 ETH (T3 시점 값!)
       dependencies[0].fixedRoyaltyETH = 5.0 ETH 저장
       
T6: 다른 사용자가 import 고려
    Library A: 5.0 ETH
    Library B: 2.0 ETH
    → Library B가 3 ETH 싸다! 🚨
    → 모두 Library B만 사용
    → Alice는 수익 못받음 ❌
```

### 코드 위치

**클라이언트**: `app/components/AdvancedClay.tsx:2462-2494`
```typescript
// projectData.usedLibraries 사용 (과거 값)
const { minETH, minUSDC } = await calculateMinimumPrice(dependencyLibraries)
```

**계산 함수**: `lib/royaltyService.ts:437-443`
```typescript
const minETH = usedLibraries.reduce((sum, lib) => {
  return sum + parseFloat(lib.royaltyPerImportETH || '0');
  // 저장된 문자열 값 사용 (블록체인 상태 확인 안함!)
}, 0);
```

**컨트랙트**: `contracts/ClayRoyalty.sol:100`
```solidity
(uint256 feeETH, uint256 feeUSDC) = libraryContract.getRoyaltyFee(dependencyProjectIds[i]);
// 현재 블록체인 값 사용!
```

### 영향
- 🔴 **경제 시스템 붕괴**: 원작 가격 인상 시 파생작이 더 싸짐
- 🔴 **원작자 손해**: 가격을 올릴수록 불리해짐
- 🔴 **생태계 파괴**: 품질 개선 동기 사라짐

### 근본 원인
- **Time-of-Check (클라이언트)**: 저장 시점 값
- **Time-of-Use (컨트랙트)**: 등록 시점 현재 값
- 둘 사이의 시간차가 문제

---

## 🔴 버그 3: Royalty 비활성화 후 등록 시 무의미한 최소 가격

### 재현 시나리오
```
1. Library A (1.0 ETH, royaltyEnabled = true)
2. User가 Library A import → Project B 저장
   → usedLibraries = [{royaltyPerImportETH: "1.0"}]
   
3. Library A owner가 disableRoyalty("lib-A")
   → royaltyEnabled = false
   → getRoyaltyFee("lib-A") = (0, 0) 이제!
   
4. User가 Library B 등록 시도 (0.5 ETH)
   → 클라이언트 체크:
      minETH = 1.0 ETH (저장된 값)
      0.5 <= 1.0 → ❌ 차단!
   
5. User가 1.2 ETH로 재시도
   → 통과 ✅
   
6. 컨트랙트 등록:
   → getRoyaltyFee("lib-A") = 0 (비활성화됨)
   → dependencies[0].fixedRoyaltyETH = 0
   
7. Library B import 시:
   → lib-A: 0 ETH 로열티
   → lib-B: 1.2 ETH 로열티
   → Library A 원작자는 로열티 못받음 ❌
```

### 영향
- 🟠 **불필요한 제약**: 비활성화된 library 때문에 높은 가격 강제
- 🟠 **사용자 불만**: 이유 없이 높은 가격 요구
- 🟠 **원작자 무수익**: 높은 가격 강제했지만 로열티 0

---

## 🔴 버그 4: 중첩 의존성 체인 중간 삭제 시 자금 손실

### 재현 시나리오
```
Library A (1.0 ETH) ✅
    ↓
Library B (1.5 ETH, uses A) ✅
    ↓
Library C (2.5 ETH, uses B, A) ✅
    ↓ Library B 삭제! 🗑️
Project D (uses C)
```

**Project D import 시**:
```typescript
// 클라이언트 자동 탐지
clayObjects = [
  {librarySourceId: "lib-A"},  // A
  {librarySourceId: "lib-B"},  // B (삭제됨!)
  {librarySourceId: "lib-C"}   // C
]

detectedLibraries = ["lib-A", "lib-B", "lib-C"]

// 로열티 지불
totalRoyaltyETH = 1.0 + 1.5 + 2.5 = 5.0 ETH
```

**컨트랙트 등록**:
```solidity
registerProjectRoyalties("project-D", ["lib-A", "lib-B", "lib-C"])

// lib-A: getRoyaltyFee = 1.0 ETH ✅
// lib-B: getRoyaltyFee = 0 (삭제됨) ❌
// lib-C: getRoyaltyFee = 2.5 ETH ✅

dependencies = [
  {projectId: "lib-A", fixedRoyaltyETH: 1.0 ETH},
  {projectId: "lib-B", fixedRoyaltyETH: 0},
  {projectId: "lib-C", fixedRoyaltyETH: 2.5 ETH}
]
```

**로열티 지불 시**:
```solidity
recordRoyalties("project-D", ..., ETH) { value: 5.0 ETH }

// lib-A: owner ✅, royalty 1.0 ETH → Alice 수령 ✅
// lib-B: owner = address(0) ❌ → 1.5 ETH 기록 안됨
// lib-C: owner ✅, royalty 2.5 ETH → Carol 수령 ✅

// 결과:
// - Alice: 1.0 ETH ✅
// - Bob: 0 ETH (library 삭제했으므로)
// - Carol: 2.5 ETH ✅
// - 컨트랙트: 0.5 ETH 갇힘 ❌ (5.0 - 1.0 - 2.5)
```

**실제 문제**:
- 사용자는 5.0 ETH 보냈는데 4.5 ETH만 배분됨
- 0.5 ETH는 어디로? 컨트랙트에 갇힘!

---

## 🟠 버그 5: 클라이언트의 usedLibraries가 삭제된 Library 포함

### 재현 시나리오
```
1. User가 Library A import
   → usedLibraries = [lib-A]
   
2. Library A 삭제됨
   
3. User가 저장
   → usedLibraries는 여전히 [lib-A]
   → processLibraryPurchasesAndRoyalties([lib-A])
```

**코드**: `lib/royaltyService.ts:74-77`
```typescript
for (const library of usedLibraries) {
  totalRoyaltyETH += parseFloat(library.royaltyPerImportETH || '0');
}
// library.royaltyPerImportETH = "1.0" (저장된 값)
// totalRoyaltyETH = 1.0 ETH
```

**컨트랙트**: `contracts/ClayRoyalty.sol:100`
```solidity
getRoyaltyFee("lib-A") = (0, 0)  // 삭제되었으므로
dependencies[0].fixedRoyaltyETH = 0
```

**결과**:
- 클라이언트는 1.0 ETH 보내려 함
- 컨트랙트는 0으로 기록
- 1.0 ETH가 컨트랙트에 갇힘

---

## 🔴 버그 6: Library 가격 인하 시 경제 붕괴

### 재현 시나리오
```
T0: Library A (5.0 ETH)

T1: Bob이 Library A import → Library B 생성
    usedLibraries = [{royaltyPerImportETH: "5.0"}]
    
T2: Bob이 Library B 등록 시도 (6.0 ETH)
    minETH = 5.0 ETH
    6.0 > 5.0 → ✅ 통과
    registerProjectRoyalties: fixedRoyaltyETH = 5.0 ETH (현재 값)
    
T3: Alice가 가격 인하! updateRoyaltyFee("lib-A", 1.0 ETH, 0)
    Library A: 1.0 ETH 이제
    
T4: 사용자들 선택
    Library A: 1.0 ETH
    Library B: 6.0 ETH (의존성 5.0 ETH 포함)
    → 당연히 Library A 직접 구매! (5 ETH 절약)
    → Library B는 아무도 안씀
    → Bob 손해 ❌
```

**문제**:
- 원작자가 가격을 내리면 파생작이 불리해짐
- 파생작 제작자 보호 안됨

---

## 🔴 버그 7: 최소 가격이 블록체인 상태와 동기화 안됨

### 핵심 문제
**클라이언트**: `lib/royaltyService.ts:437-443`
```typescript
export async function calculateMinimumPrice(
  usedLibraries: LibraryDependency[]
): Promise<{ minETH: number; minUSDC: number }> {
  
  const minETH = usedLibraries.reduce((sum, lib) => {
    return sum + parseFloat(lib.royaltyPerImportETH || '0');
    // ❌ 문자열 값 사용! 블록체인 체크 없음!
  }, 0);
  
  return { minETH, minUSDC };
}
```

**필요한 것**:
```typescript
export async function calculateMinimumPrice(
  usedLibraries: LibraryDependency[]
): Promise<{ minETH: number; minUSDC: number }> {
  
  let minETH = 0;
  
  for (const lib of usedLibraries) {
    // ✅ 블록체인에서 현재 값 확인
    const currentRoyalty = await getLibraryCurrentRoyalty(lib.projectId);
    
    if (currentRoyalty.exists && currentRoyalty.enabled) {
      minETH += currentRoyalty.ethAmount;
    }
    // 삭제/비활성화된 library는 제외
  }
  
  return { minETH, minUSDC };
}
```

### 영향
- 🔴 **모든 최소 가격 계산이 부정확**
- 🔴 **가격 역전 가능**
- 🔴 **경제 시스템 신뢰성 0**

---

## 🟡 버그 8: Library 등록 시 컨트랙트 레벨 검증 없음

### 현재 상태
**클라이언트만 체크**: `app/components/AdvancedClay.tsx:2472-2494`
```typescript
if (ethPrice <= minETH) {
  // 클라이언트에서 차단
  return
}
```

**컨트랙트는?**: `contracts/ClayLibrary.sol:117-146`
```solidity
function registerAsset(
    string memory projectId,
    string memory name,
    string memory description,
    uint256 royaltyPerImportETH,
    uint256 royaltyPerImportUSDC
) external {
    require(bytes(projectId).length > 0, "Project ID cannot be empty");
    require(royaltyPerImportETH > 0 || royaltyPerImportUSDC > 0, "At least one royalty must be set");
    require(!libraryAssets[projectId].exists, "Asset already registered");
    
    // ❌ 의존성 체크 없음!
    // ❌ 최소 가격 검증 없음!
    
    // 그냥 등록함
}
```

### 문제
- 악의적 사용자가 컨트랙트를 직접 호출하면 우회 가능
- 클라이언트 검증만으로는 불충분

---

## 📊 버그 심각도 정리

| # | 버그 | 심각도 | 자금 손실 | 경제 영향 | 즉시 수정 |
|---|------|--------|---------|---------|---------|
| 1 | 삭제된 library USDC 갇힘 | 🔴 매우 높음 | ✅ | ✅ | 필수 |
| 2 | 가격 변경 시 역전 (TOCTOU) | 🔴 매우 높음 | ❌ | ✅ | 필수 |
| 3 | Royalty 비활성화 불일치 | 🟠 중간 | ❌ | ✅ | 권장 |
| 4 | 중첩 체인 중간 삭제 | 🔴 높음 | ✅ | ✅ | 필수 |
| 5 | 삭제된 library 클라이언트 | 🟠 중간 | ✅ | ❌ | 권장 |
| 6 | 가격 인하 시 파생작 손해 | 🟡 낮음 | ❌ | ✅ | 선택 |
| 7 | 블록체인 동기화 없음 | 🔴 매우 높음 | ✅ | ✅ | 필수 |
| 8 | 컨트랙트 검증 없음 | 🟠 중간 | ❌ | ✅ | 권장 |

---

## 💰 자금 손실 시뮬레이션

### 시나리오: 인기 Library 삭제
```
Library Popular (10 USDC)
→ 1000개 프로젝트가 의존성으로 등록

Library owner가 deleteAsset 실행

각 프로젝트 import 시:
- 사용자 지불: 10 USDC
- 실제 배분: 0 USDC (owner = address(0))
- 갇힌 금액: 10 USDC

1000명이 import하면:
→ 10,000 USDC가 컨트랙트에 영구 갇힘! 💸
```

---

## 🎯 필수 수정 사항

### 1. 컨트랙트 수정 (ClayRoyalty.sol) - 긴급!

#### Before
```solidity
// totalUSDC에 모든 dependency 포함
uint256 totalUSDC = 0;
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
}
```

#### After
```solidity
// owner 있는 것만 카운트
uint256 totalUSDC = 0;
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    address owner = libraryContract.getCurrentOwner(
        royalty.dependencies[i].dependencyProjectId
    );
    
    if (owner != address(0)) {
        totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
    }
}
```

### 2. 클라이언트에서 현재 블록체인 상태 확인 - 긴급!

**새 함수 필요**:
```typescript
// lib/libraryService.ts
export async function getLibraryCurrentRoyalties(
  projectIds: string[]
): Promise<Map<string, {ethAmount: number, usdcAmount: number, exists: boolean, enabled: boolean}>> {
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(LIBRARY_CONTRACT_ADDRESS, ABI, provider);
  
  const results = new Map();
  
  for (const projectId of projectIds) {
    try {
      const [royaltyETH, royaltyUSDC] = await contract.getRoyaltyFee(projectId);
      const asset = await contract.getAsset(projectId);
      
      results.set(projectId, {
        ethAmount: parseFloat(ethers.formatEther(royaltyETH)),
        usdcAmount: parseFloat(ethers.formatUnits(royaltyUSDC, 6)),
        exists: asset.exists,
        enabled: asset.royaltyEnabled
      });
    } catch (error) {
      results.set(projectId, {
        ethAmount: 0,
        usdcAmount: 0,
        exists: false,
        enabled: false
      });
    }
  }
  
  return results;
}
```

### 3. Library 등록 시 현재 값으로 최소 가격 계산 - 긴급!

```typescript
// AdvancedClay.tsx:2457-2512
if (dependencyLibraries.length > 0) {
  // ✅ 블록체인에서 현재 상태 확인
  const currentRoyalties = await getLibraryCurrentRoyalties(
    dependencyLibraries.map(lib => lib.projectId)
  );
  
  let minETH = 0;
  let minUSDC = 0;
  
  for (const lib of dependencyLibraries) {
    const current = currentRoyalties.get(lib.projectId);
    
    if (current && current.exists && current.enabled) {
      minETH += current.ethAmount;
      minUSDC += current.usdcAmount;
    }
    // 삭제/비활성화된 것은 제외
  }
  
  // 최소 가격 검증
  if (ethPrice <= minETH) {
    return // 차단
  }
}
```

### 4. 컨트랙트에 최소 가격 검증 추가 - 권장

```solidity
// ClayLibrary.sol:registerAsset
function registerAsset(
    string memory projectId,
    string memory name,
    string memory description,
    uint256 royaltyPerImportETH,
    uint256 royaltyPerImportUSDC,
    string[] memory dependencyIds  // 추가!
) external {
    // 기존 체크들...
    
    // 의존성 최소 가격 검증
    uint256 totalDependencyRoyalty = 0;
    for (uint i = 0; i < dependencyIds.length; i++) {
        (uint256 feeETH, ) = getRoyaltyFee(dependencyIds[i]);
        totalDependencyRoyalty += feeETH;
    }
    
    require(
        royaltyPerImportETH > totalDependencyRoyalty,
        "Royalty must be higher than dependencies"
    );
    
    // 등록...
}
```

---

## 🎯 수정 우선순위

### 🔥 즉시 수정 필요 (배포 전 필수)
1. **버그 1**: USDC 자금 갇힘 - 컨트랙트 재배포 필요
2. **버그 2**: TOCTOU 가격 역전 - 클라이언트 수정
3. **버그 7**: 블록체인 동기화 - 새 함수 구현

### 📋 권장 수정 (중요)
4. **버그 3**: Royalty 비활성화 처리
5. **버그 4**: 중첩 체인 삭제 처리
6. **버그 8**: 컨트랙트 검증 추가

### 💭 검토 필요 (선택)
7. **버그 6**: 가격 인하 보호

---

## ⚠️ 배포 위험도 평가

**현재 상태로 배포 시**:
- 🔴 **자금 손실 위험**: 높음 (버그 1, 4, 5)
- 🔴 **경제 붕괴 위험**: 매우 높음 (버그 2, 3)
- 🔴 **사용자 신뢰 손상**: 확실함

**권장 사항**: 
❌ **배포 중단**
🔧 **긴급 수정 후 재검토**

---

## 📝 발견된 오타 및 함수 오류

### 오타
- ✅ 없음

### 함수 시그니처 오류
- ✅ 없음

### 논리 오류
- 🔴 **8개 발견** (위 참조)

### 누락된 기능
- ❌ 현재 블록체인 상태 확인 함수
- ❌ Library 존재 여부 확인
- ❌ 컨트랙트 레벨 최소 가격 검증
- ❌ 삭제된 library 필터링

---

## ✅ 결론

**현재 Library & Marketplace 시스템은 심각한 결함이 있습니다.**

**핵심 문제**:
1. 저장된 데이터 vs 현재 블록체인 상태 불일치
2. 컨트랙트 자금 갇힘 버그
3. TOCTOU 취약점으로 경제 시스템 우회 가능

**다음 단계**:
1. 🔥 컨트랙트 수정 (ClayRoyalty.sol)
2. 🔥 클라이언트에 블록체인 동기화 추가
3. 🔥 최소 가격 계산 로직 재작성
4. ✅ 테스트 후 재배포

**배포 가능 시점**: 위 수정 완료 후











