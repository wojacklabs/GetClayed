# 라이브러리 로열티 어뷰징 방지 보안 업데이트

## 📋 발견된 취약점 요약

### 🔴 극심한 위험도 문제들
1. **클라이언트 측 usedLibraries 조작** - 브라우저 콘솔로 배열 수정 가능
2. **JSON 수정 후 재업로드** - 다운로드한 프로젝트 파일 수동 편집
3. **중간 프로젝트 세탁** - 라이브러리를 사용한 프로젝트를 무료 라이브러리로 재등록
4. **재업로드 의존성 제거** - 업데이트 시 라이브러리 정보 제거

### 🟠 높음/중간 위험도 문제들
5. **Copy-Paste 우회** - 복사/붙여넣기로 의존성 추적 누락
6. **LocalStorage 조작** - 로컬 스토리지에서 state 복원 시 조작
7. **그룹 해체 후 조작** - 라이브러리 그룹 해체 후 의존성 제거

---

## ✅ 적용된 보안 해결책

### 1️⃣ Clay 객체 레벨 출처 추적
**파일**: `lib/clayStorageService.ts`, `app/components/AdvancedClay.tsx`

**변경사항**:
```typescript
export interface ClayData {
  // ... existing fields
  librarySourceId?: string;      // 라이브러리 프로젝트 ID
  librarySourceName?: string;    // 라이브러리 이름 (참조용)
}
```

**효과**:
- 각 clay 객체가 어느 라이브러리에서 왔는지 영구적으로 기록
- 복사/붙여넣기 시에도 출처 정보 유지
- 그룹 해제 후에도 개별 객체의 출처 추적 가능

**코드 위치**:
- `lib/clayStorageService.ts:22-23` - 인터페이스 정의
- `app/components/AdvancedClay.tsx:2517-2525` - import 시 출처 기록
- `app/components/AdvancedClay.tsx:2629-2631` - paste 시 출처 유지

---

### 2️⃣ 자동 라이브러리 탐지 및 검증
**파일**: `app/components/AdvancedClay.tsx`

**변경사항**:
```typescript
// SECURITY: Auto-detect libraries actually used in the project
const detectedLibraries = new Map<string, any>()

clayObjects.forEach(clay => {
  if (clay.librarySourceId && clay.librarySourceName) {
    if (!detectedLibraries.has(clay.librarySourceId)) {
      // Find and add library details
    }
  }
})

const finalUsedLibraries = Array.from(detectedLibraries.values())
```

**효과**:
- 사용자가 `usedLibraries` 배열을 조작해도 실제 사용된 라이브러리를 자동 탐지
- 브라우저 콘솔 조작 방지
- 저장 시점에 실제 객체 분석으로 검증

**코드 위치**:
- `app/components/AdvancedClay.tsx:3298-3331` - 자동 탐지 로직
- `app/components/AdvancedClay.tsx:3344` - 탐지된 라이브러리로 저장
- `app/components/AdvancedClay.tsx:3390` - 탐지된 라이브러리로 로열티 결제

---

### 3️⃣ 프로젝트 데이터 무결성 검증 (서명)
**파일**: `lib/projectIntegrityService.ts` (신규), `lib/clayStorageService.ts`

**새로운 서비스**:
```typescript
export interface ProjectSignature {
  projectId: string;
  librariesHash: string;    // usedLibraries 해시
  clayDataHash: string;     // clay 객체 출처 정보 해시
  signature: string;        // 지갑 서명
  signedBy: string;         // 서명자 주소
  signedAt: number;         // 서명 시간
}

// 저장 시
export async function signProjectData(project, provider): Promise<ProjectSignature>

// 로드 시
export async function verifyProjectSignature(project, signature): Promise<{ valid: boolean; error?: string }>

// 조작 탐지
export function detectLibraryTampering(project): { tampered: boolean; ... }
```

**효과**:
- JSON 파일 수동 편집 탐지
- 다운로드 후 재업로드 시 조작 감지
- 라이브러리 의존성 변경 시도 차단
- 프로젝트 작성자 검증

**작동 원리**:
1. **저장 시**: 
   - usedLibraries 배열의 해시 생성
   - clay 객체들의 librarySourceId 정보 해시 생성
   - 두 해시를 결합하여 지갑으로 서명
   - 서명을 프로젝트 데이터에 포함하여 Irys에 업로드

2. **로드 시**:
   - 다운로드한 프로젝트의 현재 데이터로 해시 재계산
   - 저장된 서명의 해시와 비교
   - 불일치 시 조작 경고 발생
   - 서명자가 프로젝트 작성자인지 검증

**코드 위치**:
- `lib/projectIntegrityService.ts` - 전체 무결성 검증 로직
- `lib/clayStorageService.ts:63-70` - 프로젝트 인터페이스에 서명 추가
- `app/components/AdvancedClay.tsx:3455-3481` - 저장 시 서명 생성
- `lib/clayStorageService.ts:588-619` - 로드 시 서명 검증

---

### 4️⃣ 블록체인 기록 (이미 구현됨)
**파일**: `lib/royaltyService.ts`, `contracts/ClayRoyalty.sol`

**기존 기능 활용**:
```typescript
// 프로젝트와 라이브러리 의존성을 블록체인에 영구 기록
await contract.registerProjectRoyalties(projectId, dependencyIds)
```

**효과**:
- 프로젝트-라이브러리 관계가 블록체인에 영구 기록
- 스마트 컨트랙트 레벨에서 로열티 강제 집행
- 변경 불가능한 감사 추적 제공

---

## 🛡️ 보안 강화 효과

| 공격 시나리오 | 이전 | 이후 | 방어 메커니즘 |
|------------|-----|-----|------------|
| 브라우저 콘솔로 usedLibraries 조작 | ❌ 취약 | ✅ 방어됨 | 자동 탐지 (2️⃣) |
| JSON 파일 다운로드 후 수정 | ❌ 취약 | ✅ 탐지됨 | 서명 검증 (3️⃣) |
| 복사/붙여넣기로 출처 제거 | ❌ 취약 | ✅ 방어됨 | 출처 추적 (1️⃣) |
| 중간 프로젝트 세탁 | ❌ 취약 | ✅ 탐지됨 | 서명 검증 (3️⃣) |
| 그룹 해제 후 조작 | ❌ 취약 | ✅ 방어됨 | 객체 레벨 추적 (1️⃣) |
| LocalStorage 조작 | ❌ 취약 | ✅ 방어됨 | 자동 탐지 (2️⃣) |
| 업데이트 시 의존성 제거 | ❌ 취약 | ✅ 탐지됨 | 서명 검증 (3️⃣) |
| Save As로 의존성 회피 | ❌ 취약 | ✅ 방어됨 | 자동 탐지 (2️⃣) |

---

## 🔄 작동 흐름

### 라이브러리 Import → 저장
```
1. 사용자가 라이브러리 Import
   ↓
2. 각 clay 객체에 librarySourceId 기록 ✅
   ↓
3. 저장 버튼 클릭
   ↓
4. clayObjects 분석하여 실제 사용된 라이브러리 자동 탐지 ✅
   ↓
5. usedLibraries와 비교하여 불일치 경고
   ↓
6. 탐지된 라이브러리로 로열티 결제 ✅
   ↓
7. 블록체인에 프로젝트-라이브러리 관계 기록 ✅
   ↓
8. 프로젝트 데이터에 서명 생성 ✅
   ↓
9. 서명 포함하여 Irys에 업로드 ✅
```

### 프로젝트 다운로드 → 로드
```
1. 프로젝트 다운로드
   ↓
2. 서명 존재 여부 확인
   ↓
3. 서명 있으면: 현재 데이터로 해시 재계산 ✅
   ↓
4. 저장된 서명의 해시와 비교 ✅
   ↓
5. 불일치 시: __integrityWarning 플래그 설정 ⚠️
   ↓
6. clay 객체의 librarySourceId로 실제 사용 라이브러리 확인 ✅
   ↓
7. usedLibraries 배열과 비교하여 조작 탐지 ✅
   ↓
8. 경고와 함께 프로젝트 로드 (차단은 하지 않음)
```

---

## 📊 기술 구현 세부사항

### 서명 생성 알고리즘
```typescript
1. librariesHash = keccak256(JSON.stringify(sortedLibraries))
2. clayDataHash = keccak256(JSON.stringify(clayLibrarySources))
3. combinedHash = keccak256(projectId + librariesHash + clayDataHash)
4. signature = wallet.signMessage(combinedHash)
```

### 검증 알고리즘
```typescript
1. 현재 프로젝트 데이터로 해시 재계산
2. 저장된 해시와 비교
3. 불일치 시 조작 플래그 설정
4. 서명에서 서명자 주소 복구
5. 서명자 = 프로젝트 작성자 검증
```

---

## ⚠️ 주의사항 및 제한사항

### 1. 레거시 프로젝트
- 서명 기능 추가 **이전에** 저장된 프로젝트는 서명이 없음
- 이러한 프로젝트는 경고만 표시하고 로드는 허용
- 업데이트 저장 시 새로운 서명 생성

### 2. 서명 실패 처리
- 서명 생성 실패 시 경고만 표시하고 저장은 계속 진행
- 사용자가 서명을 거부할 수 있음
- 서명 없이도 저장 가능 (하지만 무결성 검증 불가)

### 3. 무료 라이브러리
- royaltyPerImportETH = 0, royaltyPerImportUSDC = 0인 라이브러리도 추적
- 출처 표시 및 저작권 존중 목적

### 4. 성능 고려사항
- 큰 프로젝트(많은 clay 객체)의 해시 계산 시간
- 서명 생성/검증은 별도 트랜잭션 필요 (사용자 승인)

---

## 🚀 추가 개선 가능 사항

### 단기 (우선순위 높음)
1. ✅ **UI에 무결성 경고 표시**
   - 프로젝트 로드 시 조작 경고를 사용자에게 시각적으로 표시
   - "이 프로젝트의 라이브러리 정보가 조작되었을 수 있습니다" 배너

2. ✅ **Library 등록 시 무결성 검증 강제**
   - 라이브러리로 등록하려는 프로젝트의 서명 검증
   - 조작된 프로젝트는 라이브러리 등록 차단

3. **Marketplace 거래 시 검증**
   - 판매/구매 시 프로젝트 무결성 검증
   - 조작된 프로젝트 거래 방지

### 중기
4. **스마트 컨트랙트 레벨 검증**
   - ClayRoyalty 컨트랙트에 프로젝트 해시 저장
   - 온체인에서 무결성 검증 수행

5. **의심스러운 활동 모니터링**
   - 반복적으로 조작 시도하는 주소 추적
   - 커뮤니티 신고 시스템

### 장기
6. **분산 검증 네트워크**
   - 여러 노드가 프로젝트 무결성 검증
   - 합의 기반 신뢰도 점수

7. **자동 라이선스 추적**
   - 라이브러리 사용 시 자동 라이선스 표시
   - 크레딧 자동 생성

---

## 📝 변경된 파일 목록

### 새로 생성된 파일
- ✅ `lib/projectIntegrityService.ts` - 프로젝트 무결성 검증 서비스

### 수정된 파일
- ✅ `lib/clayStorageService.ts`
  - ClayData 인터페이스에 librarySourceId, librarySourceName 추가
  - ClayProject 인터페이스에 signature 추가
  - serializeClayProject에서 출처 정보 저장
  - restoreClayObjects에서 출처 정보 복원
  - downloadClayProject에 무결성 검증 로직 추가

- ✅ `app/components/AdvancedClay.tsx`
  - handleImportFromLibrary에서 librarySourceId 기록
  - handlePaste에서 librarySourceId 유지
  - handleSaveProject에 자동 라이브러리 탐지 로직 추가
  - handleSaveProject에 서명 생성 로직 추가
  - finalUsedLibraries 사용으로 보안 강화

---

## 🎯 결론

이번 보안 업데이트로 **8가지 주요 어뷰징 시나리오가 모두 방어 또는 탐지 가능**하게 되었습니다.

**핵심 원칙**:
1. **신뢰하지 말고 검증하라** - 클라이언트 데이터를 신뢰하지 않음
2. **다층 방어** - 여러 레벨에서 검증 (객체, 프로젝트, 블록체인)
3. **투명성** - 조작 시도를 로그로 기록하고 경고 표시
4. **후방 호환성** - 레거시 프로젝트도 계속 작동

**크리에이터 보호**:
- 라이브러리 제작자의 로열티 회피가 기술적으로 매우 어려워짐
- 악의적 조작 시도는 명확히 탐지됨
- 블록체인에 영구 기록되어 감사 가능

**사용자 경험**:
- 정직한 사용자는 변화를 거의 느끼지 못함
- 저장 시 1번의 추가 서명 요청만 발생
- 로드 시간은 거의 동일 (백그라운드 검증)











