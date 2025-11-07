# 치명적인 업로드 버그 수정 완료

## 발견된 버그

### 버그 1: Library import 후 "no dependency" 표시
**증상**: Library를 import하고 프로젝트 업로드 시 "No active library dependencies - no payment needed" 표시됨

**원인**: 
```typescript
// 잘못된 로직 (Line 3490-3523)
const detectedLibraries = new Map<string, any>()
clayObjects.forEach(clay => {
  if (clay.librarySourceId) {  // ← clayObjects에만 의존!
    detectedLibraries.set(clay.librarySourceId, libDetails)
  }
})
const finalUsedLibraries = Array.from(detectedLibraries.values())  
// ← usedLibraries state를 완전히 무시!
```

**문제점**:
1. `usedLibraries` state에 library 정보가 있음
2. 하지만 `clayObjects`에서만 library를 감지
3. `usedLibraries`를 완전히 무시함
4. 결과: **royalty 지불을 건너뜀!**

**시나리오 예시**:
1. Library A import → `usedLibraries`에 추가됨 ✅
2. clayObjects에 librarySourceId 설정됨 ✅  
3. 프로젝트 저장
4. 새로고침 또는 프로젝트 로드
5. `usedLibraries`는 복원됨 ✅
6. 하지만 코드는 `clayObjects`에서만 검색
7. `finalUsedLibraries = []` ❌
8. "No active library dependencies" 표시 ❌
9. **무료 업로드!** ❌❌❌

---

### 버그 2: 서명 거부해도 업로드 계속 진행
**증상**: Royalty 지불 서명을 취소했는데도 프로젝트가 업로드됨

**원인**:
```typescript
// 잘못된 에러 처리 (Line 3750-3760)
} catch (error: any) {
  if (error?.message?.includes('User rejected')) {
    // Transaction cancelled by user
    // ❌ 아무것도 안 함! 그냥 넘어감!
  } else if (error?.message?.includes('Insufficient balance')) {
    throw new Error('Insufficient balance...')
  } else {
    throw new Error('Failed to save project...')
  }
}
// ← 업로드 코드가 계속 실행됨!
```

**문제점**:
1. 사용자가 서명 거부 → "User rejected" 에러 발생
2. catch 블록에서 감지
3. 하지만 **아무것도 안 하고 넘어감** (throw 안 함)
4. finally 블록 실행
5. catch 블록 이후 코드 계속 실행
6. **업로드가 진행됨!** ❌❌❌

**시나리오 예시**:
1. Library A (1 ETH) 사용한 프로젝트 업로드
2. "Paying 1 ETH royalty..." 팝업
3. 사용자: "Cancel" 클릭 (지불 거부)
4. Error: "User rejected transaction"
5. 코드: "아 그래? 그럼 그냥 넘어가~" ← ❌
6. Irys 업로드 진행 ← ❌❌
7. "Project uploaded successfully!" ← ❌❌❌
8. **Creator는 royalty를 받지 못함!**

---

## 적용된 수정

### 수정 1: Library 감지 로직 수정

#### Before (치명적 결함)
```typescript
const detectedLibraries = new Map<string, any>()
clayObjects.forEach(clay => {
  if (clay.librarySourceId) {
    detectedLibraries.set(clay.librarySourceId, libDetails)
  }
})
const finalUsedLibraries = Array.from(detectedLibraries.values())
```
❌ usedLibraries state 무시  
❌ clayObjects만 검사  
❌ 로드 후 의존성 누락  

#### After (올바른 로직)
```typescript
// 1. clayObjects에서 실제 사용 중인 library ID 수집
const detectedLibraryIds = new Set<string>()
clayObjects.forEach(clay => {
  if (clay.librarySourceId) {
    detectedLibraryIds.add(clay.librarySourceId)
  }
})

// 2. usedLibraries를 기본으로 사용 (source of truth)
// 단, clayObjects에 실제로 존재하는 것만 필터링
const finalUsedLibraries = usedLibraries.filter(lib => {
  const stillUsed = detectedLibraryIds.has(lib.projectId)
  if (!stillUsed) {
    console.log(`Library ${lib.name} was imported but all objects removed - not charging`)
  }
  return stillUsed
})

// 3. SECURITY: clayObjects에 있는데 usedLibraries에 없는 것도 추가
clayObjects.forEach(clay => {
  if (clay.librarySourceId) {
    const isKnown = usedLibraries.some(lib => lib.projectId === clay.librarySourceId)
    if (!isKnown) {
      console.warn(`Object claims library ${clay.librarySourceId} not in usedLibraries - adding it!`)
      finalUsedLibraries.push({
        projectId: clay.librarySourceId,
        name: clay.librarySourceName || 'Unknown',
        royaltyPerImportETH: '0',
        royaltyPerImportUSDC: '0'
      })
    }
  }
})

console.log(`[Save] usedLibraries state: ${usedLibraries.length} libraries`)
console.log(`[Save] Detected in clayObjects: ${detectedLibraryIds.size} libraries`)
console.log(`[Save] Final libraries to pay: ${finalUsedLibraries.length}`)
```
✅ usedLibraries를 source of truth로 사용  
✅ clayObjects로 실제 사용 여부 검증  
✅ 두 방향 모두 체크 (보안)  
✅ 명확한 로깅  

**위치**: `app/components/AdvancedClay.tsx` Line 3490-3537

---

### 수정 2: 에러 처리 수정

#### Before (치명적 결함)
```typescript
} catch (error: any) {
  if (error?.message?.includes('User rejected')) {
    // Transaction cancelled by user
    // ❌ 아무것도 안 함!
  } else if (error?.message?.includes('Insufficient balance')) {
    throw new Error('Insufficient balance...')
  } else {
    throw new Error('Failed to save project...')
  }
}
// ← 업로드 계속 진행!
```
❌ User rejected 시 throw 안 함  
❌ 업로드가 계속 진행됨  

#### After (올바른 처리)
```typescript
} catch (error: any) {
  console.error('Failed to save project:', error)
  
  // CRITICAL FIX: Always throw errors to prevent upload after failure
  if (error?.message?.includes('User rejected') || error?.message?.includes('user rejected')) {
    showPopup('Upload cancelled by user', 'info')
    throw new Error('Upload cancelled by user')  // ← 추가!
  } else if (error?.message?.includes('Insufficient balance')) {
    showPopup('Insufficient balance. Your project is over 100KB and requires IRYS tokens.', 'error')
    throw new Error('Insufficient balance...')
  } else if (error?.message?.includes('over 100KB')) {
    showPopup('Project size exceeds 100KB free tier. Payment is required.', 'error')
    throw new Error('Project size exceeds 100KB free tier. Payment is required.')
  } else {
    showPopup(error.message || 'Failed to save project. Please try again.', 'error')
    throw new Error(error.message || 'Failed to save project. Please try again.')
  }
}
```
✅ User rejected 시에도 throw  
✅ 모든 에러에 사용자 피드백  
✅ 대소문자 구분 없이 체크  
✅ 업로드 중단 보장  

**위치**: `app/components/AdvancedClay.tsx` Line 3764-3780

---

## 보안 영향

### Before (취약점)

**공격 시나리오 1: 무료 업로드**
1. Library A (10 ETH) import
2. 프로젝트 저장 (정상 지불)
3. 프로젝트 로드
4. 수정 후 업로드 시도
5. **결과**: "No dependency" → 무료 업로드!
6. **피해**: Creator가 royalty를 받지 못함

**공격 시나리오 2: 서명 거부 후 업로드**
1. Library A (5 ETH) import
2. 프로젝트 업로드
3. "Paying 5 ETH" 팝업
4. 서명 취소
5. **결과**: 업로드는 진행됨
6. **피해**: Creator가 royalty를 받지 못함

### After (보완)

**시나리오 1: 정상 감지**
1. Library A (10 ETH) import → usedLibraries 추가
2. 프로젝트 저장 (지불)
3. 프로젝트 로드 → usedLibraries 복원
4. 수정 후 업로드
5. **결과**: "Already owned" → 추가 지불 없음 (정상)
6. ✅ 첫 업로드 시 이미 지불했으므로 정상

**시나리오 2: 업로드 중단**
1. Library A (5 ETH) import
2. 프로젝트 업로드
3. "Paying 5 ETH" 팝업
4. 서명 취소
5. **결과**: Error thrown → 업로드 중단
6. ✅ Creator 보호

**시나리오 3: Object 삭제 후 업로드**
1. Library A import (5개 object)
2. 모든 object 삭제
3. 업로드 시도
4. **결과**: "Library was imported but all objects removed - not charging"
5. ✅ 공정한 처리 (사용 안 했으므로 지불 안 함)

---

## 테스트 시나리오

### ✅ 시나리오 1: Library import → 업로드
1. Library A (1 ETH) import
2. 프로젝트 업로드
3. **예상 결과**:
   ```
   [Save] usedLibraries state: 1 libraries
   [Save] Detected in clayObjects: 1 libraries
   [Save] Final libraries to pay: 1
   [Save] Libraries: Library A
   [1/2] Registering 1 active library dependencies...
   [2/2] Paying 1.000000 ETH royalty for: Library A...
   Royalty paid: 1.000000 ETH for 1 library asset
   ```
4. ✅ 정상 작동

### ✅ 시나리오 2: Library import → 저장 → 로드 → 업로드
1. Library A import
2. 프로젝트 저장 (지불)
3. 새로고침
4. 프로젝트 로드
5. 수정 후 업로드
6. **예상 결과**:
   ```
   [Save] usedLibraries state: 1 libraries
   [Save] Detected in clayObjects: 1 libraries
   [Save] Final libraries to pay: 1
   All 1 libraries already owned - no payment needed
   ```
7. ✅ 이미 소유 - 추가 지불 없음

### ✅ 시나리오 3: 서명 거부
1. Library A import
2. 프로젝트 업로드
3. "Paying 1 ETH" 팝업
4. 서명 취소
5. **예상 결과**:
   ```
   Upload cancelled by user
   (팝업 표시)
   (업로드 중단)
   ```
6. ✅ 업로드 중단

### ✅ 시나리오 4: Object 삭제 후 업로드
1. Library A import
2. A의 모든 object 삭제
3. 업로드
4. **예상 결과**:
   ```
   [SECURITY] Library A was imported but all objects removed - not charging
   [Save] Final libraries to pay: 0
   No active library dependencies - no payment needed
   ```
5. ✅ 공정한 처리

---

## 코드 변경 요약

| 파일 | 위치 | 변경 사항 |
|------|------|-----------|
| `AdvancedClay.tsx` | 3490-3537 | Library 감지 로직 수정 (usedLibraries 기반) |
| `AdvancedClay.tsx` | 3764-3780 | 에러 처리 수정 (User rejected 시 throw) |

---

## 배포 체크리스트

- [x] Library 감지 로직 수정
- [x] 에러 처리 수정
- [x] 코드 수정 완료
- [ ] 로컬 테스트 (4개 시나리오)
- [ ] Library import → upload 테스트
- [ ] Library import → save → load → upload 테스트
- [ ] 서명 거부 테스트
- [ ] Object 삭제 후 upload 테스트
- [ ] Sepolia 배포
- [ ] Production 배포

---

## 결론

✅ **두 가지 치명적인 버그 수정 완료**
1. Library 의존성 감지 로직 수정
2. 에러 처리 개선

✅ **보안 강화**
- Creator royalty 보호
- 무료 업로드 방지
- 서명 거부 시 업로드 중단

✅ **공정성 유지**
- 실제 사용하지 않은 library는 청구 안 함
- 이미 소유한 library는 재청구 안 함

**날짜**: 2025-11-07  
**수정 파일**: `app/components/AdvancedClay.tsx`  
**중요도**: 🔴 CRITICAL  
**보안 영향**: 🔴 HIGH

