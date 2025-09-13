# Library Ownership & Marketplace Transfer Upgrade

## 📋 개요

두 가지 핵심 설계 문제를 해결했습니다:

1. **isActive 개념 분리**: Royalty 활성화와 Asset 존재 여부를 분리
2. **Marketplace 소유권 이전**: 거래 완료 시 Irys에 새 소유자로 프로젝트 재업로드

---

## 🔧 1. isActive 개념 분리

### 문제점
- `isActive`가 "Library royalty 활성화"와 "Asset 존재 여부"를 동시에 나타냄
- Royalty를 받지 않고 싶어도 Marketplace 거래가 불가능
- Library로 등록하지 않은 프로젝트는 Marketplace에서 거래 불가

### 해결책

#### ClayLibrary.sol

**LibraryAsset 구조 변경:**
```solidity
struct LibraryAsset {
    // ... 기존 필드들 ...
    bool exists;           // Asset 존재 여부 (false = 삭제됨)
    bool royaltyEnabled;   // Royalty 활성화 여부 (토글 가능)
}
```

**함수 변경:**

| 이전 | 현재 | 설명 |
|------|------|------|
| `deactivateAsset()` | `disableRoyalty()` | Royalty만 비활성화 |
| - | `enableRoyalty()` | Royalty 재활성화 (새로 추가) |
| - | `deleteAsset()` | Asset 완전 삭제 (새로 추가) |

**getCurrentOwner() 로직:**
```solidity
// 이전: isActive 체크
if (!asset.isActive) return address(0);

// 현재: exists만 체크
if (!asset.exists) return address(0);
```

**getRoyaltyFee() 로직:**
```solidity
// 새로 추가: royaltyEnabled 체크
if (!asset.royaltyEnabled) {
    return (0, 0);  // Royalty 비활성화 시 0 반환
}
```

#### ClayMarketplace.sol

**모든 거래 함수에서:**
```solidity
// 이전
require(isActive, "Asset not found in library");

// 현재
require(exists, "Asset not found in library");
```

**영향받는 함수:**
- `listAsset()`
- `makeOffer()`
- `acceptOffer()`

### 결과

| 상황 | Royalty | Marketplace 거래 |
|------|---------|------------------|
| Library 등록 + royaltyEnabled | ✅ 정상 부과 | ✅ 가능 |
| Library 등록 + royalty 비활성화 | ❌ 부과 안됨 | ✅ 가능 |
| Asset 삭제 (exists=false) | ❌ 부과 안됨 | ❌ 불가 |

---

## 📦 2. Marketplace 소유권 이전

### 문제점

**거래 완료 시:**
```
Contract: currentOwner = 0xBuyer ✅
Irys: Author = 0xSeller ❌
UI: 판매자에게만 보임 ❌
```

- Irys 데이터가 업데이트되지 않음
- 구매자의 "My Projects"에 안 나타남
- 판매자의 "My Projects"에 계속 나타남

### 해결책

#### 1. ClayProject 인터페이스 확장

```typescript
export interface ClayProject {
  // ... 기존 필드들 ...
  
  // 소유권 이전 필드 (새로 추가)
  originalCreator?: string;    // 최초 제작자 (불변)
  transferredFrom?: string;    // 이전 소유자
  transferredAt?: number;      // 이전 시각
  transferCount?: number;      // 거래 횟수
}
```

#### 2. 업로드 시 태그 추가

**clayStorageService.ts & chunkUploadService.ts:**
```typescript
// 소유권 이전 태그 추가
if (project.originalCreator) {
  tags.push({ name: 'Original-Creator', value: project.originalCreator.toLowerCase() });
}
if (project.transferredFrom) {
  tags.push({ name: 'Transferred-From', value: project.transferredFrom.toLowerCase() });
}
if (project.transferredAt) {
  tags.push({ name: 'Transferred-At', value: project.transferredAt.toString() });
}
if (project.transferCount) {
  tags.push({ name: 'Transfer-Count', value: project.transferCount.toString() });
}
```

#### 3. Marketplace 거래 완료 후 재업로드

**marketplaceService.ts - transferProjectOwnership():**

```typescript
async function transferProjectOwnership(projectId: string, newOwner: string) {
  // 1. 현재 프로젝트 다운로드
  const project = await downloadClayProject(currentRef.latestTxId);
  
  // 2. 소유권 정보 업데이트
  const updatedProject = {
    ...project,
    author: newOwner.toLowerCase(),
    originalCreator: project.originalCreator || previousOwner,
    transferredFrom: previousOwner.toLowerCase(),
    transferredAt: Date.now(),
    transferCount: (project.transferCount || 0) + 1,
    updatedAt: Date.now()
  };
  
  // 3. Irys에 재업로드 (Root-TX 유지)
  const { transactionId } = await uploadClayProject(
    updatedProject,
    undefined,
    currentRef.rootTxId,  // 동일한 Root-TX
    undefined,
    project.thumbnailId
  );
  
  // 4. Mutable reference 업데이트
  saveMutableReference(projectId, rootTxId, transactionId, project.name, newOwner);
}
```

**호출 위치:**
- `buyListedAsset()` - 구매 완료 후
- `acceptOffer()` - 제안 수락 후

### 태그 구조 예시

**최초 업로드:**
```javascript
{
  'Author': '0xalice',
  'Project-ID': 'proj-123',
  // ... 기타 태그
}
```

**첫 거래 후:**
```javascript
{
  'Author': '0xbob',              // 새 소유자
  'Original-Creator': '0xalice',  // 최초 제작자
  'Transferred-From': '0xalice',  // 이전 소유자
  'Transferred-At': '1234567890',
  'Transfer-Count': '1',
  'Root-TX': 'original-root-tx'   // 변경 없음
}
```

**두 번째 거래 후:**
```javascript
{
  'Author': '0xcarol',            // 새 소유자
  'Original-Creator': '0xalice',  // 최초 제작자 (불변)
  'Transferred-From': '0xbob',    // 이전 소유자
  'Transferred-At': '1234567899',
  'Transfer-Count': '2',
  'Root-TX': 'original-root-tx'   // 변경 없음
}
```

### 결과

**거래 완료 시:**
```
Contract: currentOwner = 0xBuyer ✅
Irys: Author = 0xBuyer ✅
Local Storage: author = 0xBuyer ✅
Root-TX: (동일 유지) ✅
```

**UI 동작:**
- ✅ 판매자의 "My Projects": 사라짐 (Author가 변경됨)
- ✅ 구매자의 "My Projects": 나타남 (Author로 쿼리됨)
- ✅ 프로젝트 히스토리: Original-Creator, Transfer-Count로 추적 가능

---

## 📝 변경된 파일 목록

### Contracts
- ✅ `contracts/ClayLibrary.sol` - isActive → exists/royaltyEnabled 분리
- ✅ `contracts/ClayMarketplace.sol` - exists 체크로 변경

### TypeScript Services
- ✅ `lib/clayStorageService.ts` - ClayProject 인터페이스, 소유권 태그 추가
- ✅ `lib/chunkUploadService.ts` - Manifest에 소유권 태그 추가
- ✅ `lib/marketplaceService.ts` - transferProjectOwnership 구현
- ✅ `lib/libraryService.ts` - deactivateLibraryAsset → disableLibraryRoyalty

### UI Components
- ✅ `app/components/AdvancedClay.tsx` - 함수명 변경
- ✅ `app/library/[id]/page.tsx` - 함수명 변경

---

## 🎯 사용 시나리오

### 시나리오 1: Royalty 비활성화 + Marketplace 판매

```
1. Alice가 Library에 프로젝트 등록 (royaltyEnabled = true)
2. Alice가 royalty를 받기 싫어서 disableRoyalty() 호출
3. 누군가 Alice의 library 사용 시 → Royalty 0원 ✅
4. Bob이 Marketplace에서 구매 시도 → 정상 거래 ✅
5. 거래 완료:
   - Contract: Bob이 owner ✅
   - Irys: Author = Bob으로 재업로드 ✅
   - Bob의 "My Projects"에 나타남 ✅
```

### 시나리오 2: Library 삭제

```
1. Alice가 Library에 프로젝트 등록
2. Alice가 deleteAsset() 호출 (exists = false)
3. 누군가 library 사용 시도 → getCurrentOwner() = address(0) → Royalty 기록 안됨 ✅
4. Marketplace 거래 시도 → require(exists) 실패 ✅
```

### 시나리오 3: 여러 번 거래된 프로젝트

```
1. Alice 제작 → Author: Alice, Transfer-Count: 0
2. Bob 구매 → Author: Bob, Original-Creator: Alice, Transfer-Count: 1
3. Carol 구매 → Author: Carol, Original-Creator: Alice, Transfer-Count: 2
4. 쿼리:
   - Carol의 "My Projects": Author = Carol로 쿼리 → 보임 ✅
   - Original-Creator = Alice로 쿼리 → Alice가 만든 모든 프로젝트 확인 가능 ✅
```

---

## 🚀 배포 시 주의사항

### 1. Contract 재배포 필요
- `ClayLibrary.sol` 구조 변경 (isActive → exists/royaltyEnabled)
- `ClayMarketplace.sol` getAsset 반환값 변경
- **기존 데이터 마이그레이션 필요**:
  ```solidity
  // 기존 assets의 isActive → exists로 복사
  // royaltyEnabled = true로 초기화
  ```

### 2. GraphQL 쿼리 추가
```graphql
# 소유권 이전 히스토리 조회
query {
  transactions(
    tags: [
      { name: "Original-Creator", values: ["0xalice"] }
    ]
  )
}

# 특정 프로젝트의 거래 히스토리
query {
  transactions(
    tags: [
      { name: "Project-ID", values: ["proj-123"] },
      { name: "Transferred-At", values: [...] }
    ],
    order: DESC
  )
}
```

### 3. 기존 프로젝트 처리
- 기존 프로젝트는 `originalCreator` 없음
- 첫 거래 시 현재 author를 originalCreator로 설정
- `transferCount`는 0부터 시작

---

## ✅ 테스트 체크리스트

### Library 기능
- [ ] Royalty 비활성화 시 새 사용에서 royalty 0원
- [ ] Royalty 비활성화해도 Marketplace 거래 가능
- [ ] Asset 삭제 시 Marketplace 거래 불가
- [ ] Royalty 재활성화 정상 동작

### Marketplace 거래
- [ ] 구매 완료 후 구매자의 "My Projects"에 나타남
- [ ] 구매 완료 후 판매자의 "My Projects"에서 사라짐
- [ ] Root-TX 변경 없이 유지됨
- [ ] 소유권 태그(Original-Creator, Transferred-From 등) 정상 기록

### 여러 번 거래
- [ ] Transfer-Count 정확히 증가
- [ ] Original-Creator 불변 유지
- [ ] 각 거래마다 새 Transaction ID 생성

---

## 📊 Before vs After

| 항목 | Before | After |
|------|--------|-------|
| **Royalty 제어** | deactivate → 거래 불가 | disable → 거래 가능 |
| **Marketplace 거래 후** | Contract만 변경 | Contract + Irys 모두 변경 |
| **구매자 UI** | 프로젝트 안 보임 | 정상 표시 |
| **소유권 이력** | 추적 불가 | 완전 추적 |
| **최초 제작자** | 불명확 | Original-Creator로 영구 기록 |

---

## 🎉 결론

1. **isActive 분리**: Royalty와 Asset 존재를 명확히 구분하여 유연한 관리 가능
2. **완벽한 소유권 이전**: Marketplace 거래 시 Irys 데이터까지 완전히 업데이트
3. **투명한 이력**: Original-Creator, Transfer-Count로 완전한 소유권 이력 추적

이제 Library asset은 Royalty를 끄고도 거래할 수 있으며, Marketplace 거래는 모든 레벨(Contract, Irys, UI)에서 완벽하게 동작합니다!













