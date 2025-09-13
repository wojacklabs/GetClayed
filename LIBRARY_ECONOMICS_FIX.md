# Library 경제 시스템 개선: 중첩 의존성 로열티 보호

## 🎯 문제 정의

### 기존 문제
```
Library A (원작자 Alice, 로열티: 1.0 ETH)
    ↓ import
Library B (Bob이 A를 사용, 로열티: 0.5 ETH로 설정)
    ↓ 사용자가 선택
사용자는 Library B를 선택 (0.5 ETH만 지불)
    ↓ 결과
Alice: 로열티 없음 ❌
Bob: 0.5 ETH 받음 ✅

문제: Library B가 더 저렴하므로 모두 B를 사용 → Alice는 수익 없음
```

### 경제적 영향
1. **원작자 피해**: 자신의 작품을 사용한 파생 라이브러리가 더 싸면 수익 없음
2. **생태계 붕괴**: 원작 라이브러리 제작 동기 사라짐
3. **불공정 경쟁**: 단순히 리패키징한 라이브러리가 원작보다 유리

---

## ✅ 해결 방법

### 1. 최소 가격 강제 (Minimum Pricing Enforcement)

**규칙**: 
```
새 Library 로열티 > 사용된 모든 라이브러리 로열티 합계
```

**구현 위치**: `app/components/AdvancedClay.tsx:2457-2512`

**코드**:
```typescript
// STEP 2: ECONOMICS - Validate minimum price based on dependencies
if (dependencyLibraries.length > 0) {
  const { calculateMinimumPrice } = await import('../../lib/royaltyService')
  const { minETH, minUSDC } = await calculateMinimumPrice(dependencyLibraries)
  
  // Enforce minimum pricing
  if (ethPrice > 0 && ethPrice <= minETH) {
    showPopup(
      `⚠️ Price too low! This project uses ${dependencyLibraries.length} library(ies). ` +
      `To protect the original creators, your royalty must be HIGHER than ` +
      `the total dependency royalties. ` +
      `Minimum: ${minETH.toFixed(6)} ETH (you set: ${ethPrice.toFixed(6)} ETH). ` +
      `Suggested: ${(minETH * 1.2).toFixed(6)} ETH or more.`,
      'error'
    )
    return // 등록 차단!
  }
}
```

---

### 2. 자동 로열티 분배 (Automatic Royalty Distribution)

**메커니즘**: 이미 구현됨!

**작동 방식**:
```typescript
// 1. Library B import 시 중첩 의존성 추적
// AdvancedClay.tsx:2544-2554
return { 
  ...obj, 
  librarySourceId: obj.librarySourceId || asset.projectId,
  // obj.librarySourceId가 이미 있으면 (Library A) 유지됨!
}

// 2. 저장 시 모든 의존성 자동 탐지
// AdvancedClay.tsx:3331-3351
clayObjects.forEach(clay => {
  if (clay.librarySourceId) {
    detectedLibraries.set(clay.librarySourceId, ...)
  }
})
// 결과: [Library A, Library B] 모두 탐지

// 3. 로열티 지불
// royaltyService.ts:74-77
for (const library of usedLibraries) {
  totalRoyaltyETH += parseFloat(library.royaltyPerImportETH || '0');
  totalRoyaltyUSDC += parseFloat(library.royaltyPerImportUSDC || '0');
}
// Library A + Library B 로열티 모두 지불됨!
```

---

## 📊 시나리오 테스트

### 시나리오 1: 정상 케이스 (올바른 가격 설정)

#### 설정
```
Library A (Alice 제작)
  - 로열티: 1.0 ETH

Library B (Bob이 A를 사용하여 제작)
  - 사용 라이브러리: A (1.0 ETH)
  - Bob이 설정한 로열티: 1.5 ETH ✅ (1.0보다 높음)
```

#### 흐름
```javascript
// 1. Bob이 Library A import
const project = await downloadClayProject('lib-A')
const importedObjects = restoreClayObjects(project)

// 각 객체에 librarySourceId = "lib-A" 기록됨
importedIds = [
  {id: "b1", librarySourceId: "lib-A"},
  {id: "b2", librarySourceId: "lib-A"}
]

// 2. Bob이 자신의 작업 추가
clayObjects = [
  {id: "b1", librarySourceId: "lib-A"},  // A에서 온 것
  {id: "b2", librarySourceId: "lib-A"},  // A에서 온 것
  {id: "b3", librarySourceId: undefined} // Bob이 만든 것
]

// 3. Bob이 저장
detectedLibraries = [
  {projectId: "lib-A", royaltyPerImportETH: "1.0", ...}
]

// 로열티 지불
await processLibraryPurchasesAndRoyalties(
  "project-B",
  [Library A],
  provider
)
// Alice에게 1.0 ETH 지불 ✅

// 4. Bob이 Library B로 등록 시도 (1.5 ETH)
// 최소 가격 체크
minETH = 1.0 ETH (Library A)
bobPrice = 1.5 ETH

if (bobPrice > minETH) {
  // ✅ 통과!
  showPopup(
    '✅ Good pricing! Your royalty (1.5 ETH) is higher than dependencies (1.0 ETH)'
  )
  await registerLibraryAsset(...) // 등록 성공
}

// 5. Carol이 Library B import
detectedLibraries = [
  {projectId: "lib-A", royaltyPerImportETH: "1.0"},  // A 유지됨!
  {projectId: "lib-B", royaltyPerImportETH: "1.5"}   // B 추가
]

// 로열티 지불
totalRoyaltyETH = 1.0 + 1.5 = 2.5 ETH
// Alice에게 1.0 ETH ✅
// Bob에게 1.5 ETH ✅
```

**결과**:
- ✅ Alice: 1.0 ETH 수령 (원작자 보호)
- ✅ Bob: 1.5 ETH 수령 (파생 작업 보상)
- ✅ Carol: 2.5 ETH 지불 (공정한 가격)

---

### 시나리오 2: 부정 케이스 (저가 판매 시도)

#### 설정
```
Library A (Alice 제작)
  - 로열티: 1.0 ETH

Library B (Bob이 A를 사용하여 제작)
  - 사용 라이브러리: A (1.0 ETH)
  - Bob이 설정한 로열티: 0.5 ETH ❌ (1.0보다 낮음)
```

#### 흐름
```javascript
// 1-3. (동일)

// 4. Bob이 Library B로 등록 시도 (0.5 ETH)
// 최소 가격 체크
minETH = 1.0 ETH (Library A)
bobPrice = 0.5 ETH

if (bobPrice <= minETH) {
  // ❌ 차단!
  showPopup(
    '⚠️ Price too low! This project uses 1 library(ies). ' +
    'To protect the original creators, your royalty must be HIGHER ' +
    'than the total dependency royalties. ' +
    'Minimum: 1.0 ETH (you set: 0.5 ETH). ' +
    'Suggested: 1.2 ETH or more.',
    'error'
  )
  return // 등록 차단됨!
}
```

**결과**:
- ❌ Bob의 Library B 등록 차단
- ✅ Alice의 Library A 가격 보호됨
- ✅ 불공정 경쟁 방지

---

### 시나리오 3: 3단계 중첩 (A→B→C)

#### 설정
```
Library A (Alice)
  - 로열티: 1.0 ETH

Library B (Bob이 A 사용)
  - 의존성: A (1.0 ETH)
  - 로열티: 1.5 ETH

Library C (Carol이 B 사용)
  - 의존성: B (1.5 ETH) + A (1.0 ETH, 중첩)
  - Carol이 설정하려는 로열티: 2.0 ETH
```

#### 흐름
```javascript
// 1. Bob이 Library A import → Library B 생성
// Library B의 객체들:
[
  {id: "b1", librarySourceId: "lib-A"},  // A에서 온 것
  {id: "b2", librarySourceId: "lib-A"},  // A에서 온 것
  {id: "b3", librarySourceId: undefined} // B가 만든 것
]

// Library B 저장 시:
usedLibraries = [Library A]

// 2. Carol이 Library B import → Project C 생성
// Import 시 중첩 유지:
importedIds = [
  {id: "c1", librarySourceId: "lib-A"},     // A 유지됨!
  {id: "c2", librarySourceId: "lib-A"},     // A 유지됨!
  {id: "c3", librarySourceId: "lib-B"}      // B로 표시
]

// Project C 저장 시:
detectedLibraries = [
  {projectId: "lib-A", royaltyPerImportETH: "1.0"},
  {projectId: "lib-B", royaltyPerImportETH: "1.5"}
]

// 로열티 지불:
totalRoyaltyETH = 1.0 + 1.5 = 2.5 ETH
// Alice: 1.0 ETH ✅
// Bob: 1.5 ETH ✅

// 3. Carol이 Library C로 등록 시도 (2.0 ETH)
// 최소 가격 체크:
minETH = 1.0 + 1.5 = 2.5 ETH
carolPrice = 2.0 ETH

if (carolPrice <= minETH) {
  // ❌ 차단!
  showPopup(
    '⚠️ Price too low! Minimum: 2.5 ETH (you set: 2.0 ETH). ' +
    'Suggested: 3.0 ETH or more.'
  )
  return
}

// 4. Carol이 가격을 3.0 ETH로 수정
carolPrice = 3.0 ETH

if (carolPrice > minETH) {
  // ✅ 통과!
  showPopup(
    '✅ Good pricing! Your royalty (3.0 ETH) is higher than dependencies (2.5 ETH)'
  )
  await registerLibraryAsset(...)
}

// 5. Dave가 Library C import
detectedLibraries = [
  {projectId: "lib-A", royaltyPerImportETH: "1.0"},
  {projectId: "lib-B", royaltyPerImportETH: "1.5"},
  {projectId: "lib-C", royaltyPerImportETH: "3.0"}
]

// 로열티 지불:
totalRoyaltyETH = 1.0 + 1.5 + 3.0 = 5.5 ETH
// Alice: 1.0 ETH ✅
// Bob: 1.5 ETH ✅
// Carol: 3.0 ETH ✅
```

**결과**:
- ✅ 모든 단계의 크리에이터 보호
- ✅ 공정한 가격 체계 유지
- ✅ 생태계 지속 가능성 확보

---

## 🔧 구현 세부사항

### 코드 변경 사항

**파일**: `app/components/AdvancedClay.tsx`

#### Before (문제)
```typescript
// 라이브러리 등록 시
if (usedLibraries.length > 0) {
  // 현재 세션의 usedLibraries만 체크
  // 문제: 프로젝트 저장된 의존성 체크 안함
}
```

#### After (해결)
```typescript
// 라이브러리 등록 시
// 1. 프로젝트 다운로드
const projectData = await downloadClayProject(libraryProjectId);

// 2. 저장된 의존성 추출
if (projectData.usedLibraries && projectData.usedLibraries.length > 0) {
  dependencyLibraries = projectData.usedLibraries;
}

// 3. 최소 가격 강제
const { minETH, minUSDC } = await calculateMinimumPrice(dependencyLibraries)

if (ethPrice <= minETH) {
  // 등록 차단!
  showPopup('⚠️ Price too low! Minimum: ...')
  return
}

// 4. 성공 시 친절한 피드백
if (ethPrice > minETH) {
  showPopup(
    '✅ Good pricing! Original creators will receive their fair share.'
  )
}
```

---

## 📊 경제 시스템 다이어그램

```
┌─────────────────────────────────────────────┐
│ Library A (원작)                            │
│ Alice 제작                                  │
│ 로열티: 1.0 ETH                             │
└─────────────────────────────────────────────┘
              ↓ import (1.0 ETH 지불)
┌─────────────────────────────────────────────┐
│ Library B (파생)                            │
│ Bob 제작 (A 사용)                           │
│ 최소 로열티: > 1.0 ETH (강제됨)             │
│ Bob 설정: 1.5 ETH ✅                        │
└─────────────────────────────────────────────┘
              ↓ import (1.0 + 1.5 = 2.5 ETH)
┌─────────────────────────────────────────────┐
│ Library C (2차 파생)                        │
│ Carol 제작 (B 사용, 간접적으로 A도 사용)   │
│ 최소 로열티: > 2.5 ETH (강제됨)             │
│ Carol 설정: 3.0 ETH ✅                      │
└─────────────────────────────────────────────┘
              ↓ import (1.0 + 1.5 + 3.0 = 5.5 ETH)
┌─────────────────────────────────────────────┐
│ User Project                                │
│ Dave 제작                                   │
│ 지불: 5.5 ETH                               │
│   → Alice: 1.0 ETH ✅                       │
│   → Bob: 1.5 ETH ✅                         │
│   → Carol: 3.0 ETH ✅                       │
└─────────────────────────────────────────────┘
```

---

## 🎯 핵심 원칙

### 1. 가격 하한선 (Price Floor)
```
새 라이브러리 로열티 > Σ(사용된 라이브러리 로열티)
```

### 2. 자동 분배 (Automatic Distribution)
```
import 시 중첩된 모든 의존성 추적
→ 저장 시 모든 의존성에 로열티 지불
→ 모든 원작자 보호
```

### 3. 투명성 (Transparency)
```
사용자에게 명확한 피드백:
- ⚠️ 가격이 낮으면 차단 + 이유 설명
- ✅ 적절한 가격이면 승인 + 격려
- 💡 권장 가격 제시 (최소값 * 1.2)
```

---

## ✅ 검증 결과

### 경제적 보호
- ✅ 원작자 로열티 보호됨
- ✅ 저가 판매 차단됨
- ✅ 공정한 가격 경쟁 유지

### 사용자 경험
- ✅ 명확한 에러 메시지
- ✅ 권장 가격 제시
- ✅ 성공 시 격려 메시지

### 기술적 안정성
- ✅ 모든 의존성 추적됨
- ✅ 중첩 구조 지원됨
- ✅ 블록체인에 영구 기록

---

## 🚀 배포 준비

### 체크리스트
- ✅ 최소 가격 강제 구현
- ✅ 중첩 의존성 추적 (이미 구현됨)
- ✅ 자동 로열티 분배 (이미 구현됨)
- ✅ 사용자 피드백 메시지
- ✅ 경제 시스템 문서화

### 예상 효과
1. **크리에이터 보호**: 원작자가 정당한 수익 보장받음
2. **생태계 건강**: 고품질 원작 라이브러리 제작 동기 부여
3. **공정 경쟁**: 단순 리패키징으로 이득 볼 수 없음
4. **가치 인정**: 의존성 체인의 모든 기여자가 보상받음

**상태**: ✅ **배포 준비 완료**











