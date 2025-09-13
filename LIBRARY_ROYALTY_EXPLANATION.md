# Library Royalty 지불 방식 설명

## 여러 Library를 Import했을 때 Royalty 지불 방식

### 시나리오

다음과 같이 3개의 library를 import한 프로젝트를 업로드하는 경우:

```
Library A: 0.001 ETH royalty
Library B: 0.002 ETH royalty  
Library C: 5 USDC royalty
```

---

## 처리 과정

### 1. Import 단계 (무료)
```typescript
handleImportFromLibrary(Library A) → usedLibraries에 추가
handleImportFromLibrary(Library B) → usedLibraries에 추가
handleImportFromLibrary(Library C) → usedLibraries에 추가
```
- ✅ 프로젝트 데이터 다운로드 (Irys에서 무료로 다운로드)
- ✅ 캔버스에 3D 객체로 추가
- ✅ `usedLibraries` 배열에 추적
- ❌ **비용 지불 없음** (아직 사용하지 않음)

### 2. 업로드 단계 (Royalty 지불)

사용자는 각 트랜잭션마다 명확한 안내 팝업을 보게 됩니다:

#### Transaction 1/4: 프로젝트 등록
```
팝업: [1/4] Registering 3 library dependencies (Library A, Library B, Library C). Please sign...
      ↓ (서명 후)
팝업: [1/4] Waiting for registration confirmation...
```
```solidity
registerProjectRoyalties(
  projectId: "clay-1234567890",
  dependencyIds: ["Library A ID", "Library B ID", "Library C ID"]
)
```

#### Transaction 2/4: ETH Royalty 지불
```
팝업: [2/4] Paying 0.003000 ETH royalty for: Library A (0.001 ETH), Library B (0.002 ETH). Please sign...
      ↓ (서명 후)
팝업: [2/4] Waiting for ETH payment confirmation...
```
```solidity
recordRoyalties(
  projectId: "clay-1234567890",
  price: 0,
  paymentToken: 0 (ETH)
) { value: 0.003 ETH }
```

#### Transaction 3/4: USDC Approve
```
팝업: [3/4] Approving 5.00 USDC for royalty payment. Please sign...
      ↓ (서명 후)
팝업: [3/4] Waiting for USDC approval confirmation...
```
```solidity
approve(RoyaltyContract, 5 USDC)
```

#### Transaction 4/4: USDC Royalty 지불
```
팝업: [4/4] Paying 5.00 USDC royalty for: Library C (5 USDC). Please sign...
      ↓ (서명 후)
팝업: [4/4] Waiting for USDC payment confirmation...
```
```solidity
recordRoyalties(
  projectId: "clay-1234567890",
  price: 0,
  paymentToken: 1 (USDC)
)
```

#### Step 5: Irys 업로드
```typescript
uploadClayProject(projectData, tags)
```
- 프로젝트 데이터를 Irys에 업로드
- `usedLibraries` 정보 포함

---

## Royalty 분배 방식

### Smart Contract에서 자동 분배

`ClayRoyalty.sol`의 `recordRoyalties` 함수:

```solidity
// ETH 지불 시
for (uint256 i = 0; i < dependencies.length; i++) {
    address owner = libraryContract.getCurrentOwner(dependencyId);
    uint256 royaltyAmount = fixedRoyaltyETH; // 각 library의 고정 royalty
    
    pendingRoyaltiesETH[owner] += royaltyAmount;
}
```

### 예시: 위 시나리오의 경우

**사용자가 지불:**
- 1회 ETH 트랜잭션: 0.003 ETH
- 2회 USDC 트랜잭션: approve + 5 USDC 

**Library 소유자가 받는 금액 (pending):**
- Library A 소유자: 0.001 ETH
- Library B 소유자: 0.002 ETH
- Library C 소유자: 5 USDC

**나중에 claim:**
각 소유자는 자신의 dashboard에서 누적된 royalty를 claim할 수 있음

---

## 중첩 Library (Nested Dependencies)

### 시나리오
```
Library A (2 USDC) → Library B (1 ETH) → 내 프로젝트
```

### 처리
Library B를 import하면:
1. Library B의 데이터 다운로드
2. Library B의 `usedLibraries` 확인
3. Library A도 자동으로 `usedLibraries`에 추가

### 업로드 시 지불
```
내 프로젝트의 usedLibraries = [Library B, Library A]
→ 1 ETH (B) + 2 USDC (A) 지불
```

**모든 nested dependencies를 자동으로 추적하고 royalty 지불**

---

## 가스비 (Gas Fees)

### 일반적인 경우 (ETH만)
1. `registerProjectRoyalties`: ~50,000 gas
2. `recordRoyalties` (ETH): ~100,000 gas
3. **Total: ~150,000 gas**

### USDC 포함 시
1. `registerProjectRoyalties`: ~50,000 gas
2. `recordRoyalties` (ETH): ~100,000 gas
3. `approve` (USDC): ~50,000 gas
4. `recordRoyalties` (USDC): ~120,000 gas
5. **Total: ~320,000 gas**

---

## 요약

### ✅ 장점
- **한 번에 지불**: 여러 library를 사용해도 currency별로 1회 트랜잭션
- **자동 분배**: 컨트랙트가 각 library 소유자에게 자동 분배
- **중첩 지원**: Nested dependencies 자동 추적
- **동적 소유권**: Library 소유권이 바뀌어도 최신 소유자가 royalty 받음

### 📊 비용 예시
```
3개 Library (2 ETH, 1 ETH, 10 USDC) import
→ ETH: 1회 트랜잭션으로 3 ETH 지불
→ USDC: 2회 트랜잭션으로 10 USDC 지불
→ 총 3회 트랜잭션 (library 개수와 무관)
```

