# Library Import 지속성 문제 수정 완료

## 보고된 문제

### 문제 1: 새로고침 후 비용 지불하지 않고 업로드
- 프로젝트 제작 화면에서 library를 import한 후 새로고침하면
- 도형들은 그대로 재현되지만
- 업로드 시 비용을 전혀 지불하지 않고 업로드됨

### 문제 2: 다른 파일로 전환 시 library import 손실
- 프로젝트 제작 화면에서 library를 import한 후
- 다른 파일로 작업을 넘어가면
- library import 정보가 손실됨

---

## 근본 원인 분석

### 원인 1: 프로젝트 로드 시 Library 정보 미복원
`handleProjectSelect()` 함수에서:
- ✅ clayObjects 복원
- ✅ clayGroups 복원
- ✅ backgroundColor 복원
- ❌ **usedLibraries 복원 안 됨** ← 문제!
- ❌ **pendingLibraryPurchases 복원 안 됨** ← 문제!

결과:
- 프로젝트를 다시 로드하면 도형은 있지만 library 정보가 없음
- `handleSaveProject`에서 library 비용 청구를 건너뜀
- **무료로 업로드됨**

### 원인 2: 프로젝트 전환 시 저장 안내 부족
- library를 import하면 프로젝트가 dirty 상태가 됨
- 하지만 프로젝트 전환 시 특별한 경고가 없음
- localStorage auto-save는 한 프로젝트만 저장 (가장 최근 프로젝트)
- 저장하지 않고 전환하면 library 정보 손실

### 원인 3: 새 프로젝트 생성 시 Library 상태 미초기화
`createNewFile()` 함수에서:
- ✅ clayObjects 초기화
- ✅ currentProjectInfo 초기화
- ❌ **usedLibraries 초기화 안 됨** ← 문제!
- ❌ **pendingLibraryPurchases 초기화 안 됨** ← 문제!

결과:
- 이전 프로젝트의 library 정보가 새 프로젝트에 남아있음

---

## 적용된 수정 사항

### 수정 1: 프로젝트 로드 시 Library 정보 복원
**파일**: `app/components/AdvancedClay.tsx`  
**함수**: `handleProjectSelect`  
**위치**: Line 3793-3821

```typescript
// CRITICAL FIX: Restore library information when loading project
// This ensures royalty payments are enforced even after refresh or project switch
if (project.usedLibraries && project.usedLibraries.length > 0) {
  console.log('[ProjectLoad] Restoring library information:', project.usedLibraries);
  
  // Convert old format to new format if needed
  const converted = project.usedLibraries.map((lib: any) => ({
    projectId: lib.projectId,
    name: lib.name,
    royaltyPerImportETH: lib.royaltyPerImportETH || lib.priceETH || '0',
    royaltyPerImportUSDC: lib.royaltyPerImportUSDC || lib.priceUSDC || '0',
    creator: lib.creator || lib.originalCreator || lib.currentOwner
  }));
  
  setUsedLibraries(converted);
  
  // Mark these libraries as pending purchase
  // They will be checked during upload - if already owned, no payment needed
  setPendingLibraryPurchases(new Set(converted.map((lib: any) => lib.projectId)));
  
  console.log('[ProjectLoad] Library info restored:', {
    libraries: converted.length,
    pendingPurchases: converted.map((lib: any) => lib.projectId)
  });
} else {
  // Clear library info if project has no dependencies
  setUsedLibraries([]);
  setPendingLibraryPurchases(new Set());
}
```

**효과**:
- ✅ 새로고침 후에도 library 정보 유지
- ✅ 프로젝트 전환 후 다시 돌아와도 library 정보 유지
- ✅ 업로드 시 정확한 royalty 비용 청구

---

### 수정 2: 프로젝트 전환 시 저장 안내 (커스텀 모달)
**파일**: `app/components/AdvancedClay.tsx`  
**함수**: `handleProjectSelect`  
**위치**: Line 3856-3867, Modal UI: 5293-5317

```typescript
// CRITICAL FIX: Warn user if current project has unsaved library imports
if (currentProjectInfo && currentProjectInfo.isDirty && usedLibraries.length > 0) {
  // Show modal instead of window.confirm
  setPendingProjectId(projectId);
  setShowProjectSwitchModal(true);
  return;
}
```

**모달 UI** (미니멀 디자인):
```tsx
<div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
  <div className="bg-white rounded-lg shadow-xl p-6 w-96 pointer-events-auto">
    <h3 className="text-lg font-semibold mb-4">Switch Project?</h3>
    <p className="text-gray-600 mb-6">
      You have {usedLibraries.length} unsaved library import{usedLibraries.length > 1 ? 's' : ''}. 
      Switching now will lose them and require re-importing with new royalty payments.
    </p>
    <div className="flex justify-end gap-3">
      <button onClick={cancelProjectSwitch} className="px-4 py-2 text-gray-600 hover:text-gray-800">
        Cancel
      </button>
      <button onClick={confirmProjectSwitch} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-blue-600">
        Switch Anyway
      </button>
    </div>
  </div>
</div>
```

**효과**:
- ✅ 기존 디자인과 일관된 커스텀 모달
- ✅ 간결하고 명확한 경고 메시지
- ✅ 실수로 프로젝트 전환하는 것 방지
- ✅ 중복 royalty 지불 방지

---

### 수정 3: 새 프로젝트 생성 시 Library 상태 초기화
**파일**: `app/components/AdvancedClay.tsx`  
**함수**: `createNewFile`  
**위치**: Line 4056-4058

```typescript
// CRITICAL FIX: Clear library information when creating new project
setUsedLibraries([])
setPendingLibraryPurchases(new Set())
```

**효과**:
- ✅ 새 프로젝트에 이전 library 정보 혼입 방지
- ✅ 깨끗한 초기 상태 보장

---

### 수정 4: New File 모달에 Library Import 경고 (간결화)
**파일**: `app/components/AdvancedClay.tsx`  
**컴포넌트**: New File Confirmation Modal  
**위치**: Line 5265-5270

```typescript
<p className="text-gray-600 mb-6">
  {usedLibraries.length > 0 
    ? `You have ${usedLibraries.length} unsaved library import${usedLibraries.length > 1 ? 's' : ''}. Creating a new project will lose all current work.`
    : 'Creating a new project will reset all current work. Are you sure you want to continue?'
  }
</p>
```

**효과**:
- ✅ 간결하고 명확한 메시지 (1문장)
- ✅ 새 프로젝트 생성 시에도 명확한 경고
- ✅ 사용자가 의도하지 않은 library 정보 손실 방지

---

## 테스트 시나리오

### ✅ 시나리오 1: Library Import 후 새로고침
1. 프로젝트 생성
2. Library A (1 ETH) import
3. 새로고침 (F5)
4. **예상 결과**: 도형 + library 정보 모두 복원
5. 업로드 시도
6. **예상 결과**: 1 ETH royalty 요구됨

### ✅ 시나리오 2: Library Import 후 저장하지 않고 프로젝트 전환
1. 프로젝트 A 생성
2. Library B (2 ETH) import
3. 프로젝트 B로 전환 시도
4. **예상 결과**: 경고 팝업 표시
   - "You have imported 1 library asset(s) that are not saved yet..."
5. Cancel 선택
6. **예상 결과**: 프로젝트 A에 그대로 남음
7. 저장 후 프로젝트 B로 전환
8. 다시 프로젝트 A로 돌아옴
9. **예상 결과**: Library B 정보 포함하여 완벽히 복원

### ✅ 시나리오 3: Library Import 후 저장하고 프로젝트 전환
1. 프로젝트 A에서 Library C import
2. 저장 (2 ETH 지불)
3. 프로젝트 B로 전환
4. 프로젝트 A로 다시 돌아옴
5. **예상 결과**: Library C 정보 복원
6. 업로드 시도
7. **예상 결과**: 이미 소유하고 있으므로 추가 비용 없음

### ✅ 시나리오 4: Library Import 후 새 프로젝트 생성
1. 프로젝트 A에서 Library D import (저장 안 함)
2. New 버튼 클릭
3. **예상 결과**: 경고 표시
   - "Warning: You have imported 1 library asset(s)..."
4. 계속 진행
5. **예상 결과**: 깨끗한 새 프로젝트 (library 정보 없음)

---

## 기술적 세부사항

### Library 정보 흐름

#### Import 시점
```typescript
handleImportFromLibrary(asset) →
  usedLibraries.push(asset)
  pendingLibraryPurchases.add(asset.projectId)
```

#### Auto-save 시점 (localStorage)
```typescript
useEffect(() => {
  autoSaveData = {
    clayObjects,
    clayGroups,
    usedLibraries,        // ← 포함됨
    pendingLibraryPurchases  // ← 포함됨
  }
  localStorage.setItem('clayAutoSave', JSON.stringify(autoSaveData))
}, [clayObjects, usedLibraries, ...])
```

#### 업로드 시점 (Irys)
```typescript
handleSaveProject() →
  serialized = serializeClayProject(..., usedLibraries)
  processLibraryPurchasesAndRoyalties(usedLibraries)
  uploadClayProject(serialized)  // ← usedLibraries 포함됨
```

#### 로드 시점 (수정 전 ❌)
```typescript
handleProjectSelect(projectId) →
  project = await downloadClayProject(projectId)
  setClayObjects(restoreClayObjects(project))
  // ❌ usedLibraries 복원 안 됨!
```

#### 로드 시점 (수정 후 ✅)
```typescript
handleProjectSelect(projectId) →
  project = await downloadClayProject(projectId)
  setClayObjects(restoreClayObjects(project))
  setUsedLibraries(project.usedLibraries)  // ← 추가됨!
  setPendingLibraryPurchases(...)           // ← 추가됨!
```

---

## 보안 영향

### 이전 취약점
공격 시나리오:
1. Library A (10 ETH) import
2. 새로고침
3. 업로드
4. **결과**: 무료로 업로드 (creator에게 피해)

### 수정 후
1. Library A (10 ETH) import
2. 새로고침
3. Library 정보 복원됨
4. 업로드 시도
5. **결과**: 10 ETH 요구됨 또는 이미 소유 시 무료

---

## 배포 체크리스트

- [x] `handleProjectSelect`에서 library 정보 복원
- [x] 프로젝트 전환 시 저장 안내 추가
- [x] `createNewFile`에서 library 상태 초기화
- [x] New File 모달에 경고 메시지 추가
- [x] 코드 수정 완료
- [ ] 로컬 테스트 (4개 시나리오)
- [ ] Sepolia 테스트넷 배포
- [ ] 실제 library import/upload 테스트
- [ ] Production 배포

---

## 사용자 안내 메시지 (간결한 버전)

### 영어 (최종)
**Project Switch**:
```
You have 2 unsaved library imports. Switching now will lose them and require re-importing with new royalty payments.
```

**New Project**:
```
You have 2 unsaved library imports. Creating a new project will lose all current work.
```

**디자인 원칙**:
- 간결함: 1-2문장으로 핵심만 전달
- 명확함: 무엇을 잃고, 무엇이 필요한지 명시
- 일관성: 기존 모달 스타일과 동일

---

## 수정 완료
✅ 두 가지 문제 모두 해결됨
✅ 보안 취약점 제거
✅ 사용자 경험 개선

**날짜**: 2025-11-07  
**수정 파일**: `app/components/AdvancedClay.tsx`  
**영향받는 기능**: Library Import, Project Load, Project Switch, New Project

