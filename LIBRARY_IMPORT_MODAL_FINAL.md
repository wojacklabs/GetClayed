# Library Import 경고 모달 - 최종 버전

## 최종 디자인

### Project Switch Warning Modal

```
┌─────────────────────────────────────┐
│ Switch Project?                     │
│                                     │
│ You have 2 unsaved library imports. │
│ Switching now will lose them and    │
│ require re-importing with new       │
│ royalty payments.                   │
│                                     │
│                 [Cancel] [Switch Anyway]│
└─────────────────────────────────────┘
```

**코드** (Line 5293-5317):
```tsx
{showProjectSwitchModal && (
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
)}
```

---

### New File Modal (개선됨)

**Before**:
```
Creating a new project will reset all current work.

Warning: You have imported 2 library asset(s) that are not saved yet.
You will need to import them again and pay royalties again.

Are you sure you want to continue?
```
❌ 3문장, 불필요하게 길고 반복적

**After**:
```
You have 2 unsaved library imports. Creating a new project will lose all current work.
```
✅ 1문장, 간결하고 명확

**코드** (Line 5265-5270):
```tsx
<p className="text-gray-600 mb-6">
  {usedLibraries.length > 0 
    ? `You have ${usedLibraries.length} unsaved library import${usedLibraries.length > 1 ? 's' : ''}. Creating a new project will lose all current work.`
    : 'Creating a new project will reset all current work. Are you sure you want to continue?'
  }
</p>
```

---

## 디자인 원칙

### ✅ 적용된 원칙
1. **미니멀**: 불필요한 장식 제거 (아이콘, 색상 박스, 리스트 등)
2. **간결한 텍스트**: 핵심만 전달 (1-2문장)
3. **일관성**: 기존 모달과 동일한 스타일
4. **명확성**: 짧지만 필요한 정보는 모두 포함

### ❌ 제거된 요소
- 노란색/빨간색 배경 박스
- 이모지 (⚠️, 💡)
- 불릿 포인트 리스트
- "Tip" 섹션
- 장황한 설명
- 과도한 색상 사용

---

## 기존 모달과의 일관성

| 속성 | 값 | 설명 |
|------|-----|------|
| Background | `pointer-events-none` | 배경 클릭 방지 |
| Container | `pointer-events-auto` | 모달만 클릭 가능 |
| Width | `w-96` (384px) | 모든 모달 동일 |
| Padding | `p-6` | 모든 모달 동일 |
| Shadow | `shadow-xl` | 모든 모달 동일 |
| Title | `text-lg font-semibold mb-4` | 모든 모달 동일 |
| Text | `text-gray-600 mb-6` | 모든 모달 동일 |
| Cancel Button | `text-gray-600 hover:text-gray-800` | 모든 모달 동일 |
| Action Button | `bg-gray-800 text-white rounded-lg hover:bg-blue-600` | 모든 모달 동일 |

---

## 텍스트 비교

### Project Switch Modal

**Before (너무 김)**:
```
You have imported 2 library asset(s) that are not saved yet.

⚠️ If you switch projects now without saving:
• You will lose all imported library assets
• You will need to import them again
• You will need to pay royalties again when you save

💡 Tip: Save your current project first to preserve the library imports 
and avoid duplicate royalty payments.
```
**문자 수**: ~280자

**After (간결)**:
```
You have 2 unsaved library imports. Switching now will lose them 
and require re-importing with new royalty payments.
```
**문자 수**: ~110자 (60% 감소)

---

### New File Modal

**Before (반복적)**:
```
Creating a new project will reset all current work.

Warning: You have imported 2 library asset(s) that are not saved yet. 
You will need to import them again and pay royalties again.

Are you sure you want to continue?
```
**문자 수**: ~180자

**After (간결)**:
```
You have 2 unsaved library imports. Creating a new project will lose all current work.
```
**문자 수**: ~85자 (53% 감소)

---

## 핵심 정보 유지

### 필수 정보 (모두 포함됨)
1. ✅ 몇 개의 library import가 있는지
2. ✅ 저장되지 않았다는 사실
3. ✅ 전환/생성 시 손실된다는 경고
4. ✅ 재구매 필요성

### 제거된 불필요한 정보
- ❌ "without saving" (이미 "unsaved"로 표현됨)
- ❌ "when you save" (자명함)
- ❌ "library assets" → "library imports" (더 정확)
- ❌ Tip 섹션 (행동 강요하지 않음)
- ❌ 3단계 리스트 (중복)

---

## 코드 구조

```typescript
// State (2개만 필요)
const [showProjectSwitchModal, setShowProjectSwitchModal] = useState(false)
const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)

// Logic (3개 함수)
const handleProjectSelect = async (projectId: string) => {
  if (currentProjectInfo?.isDirty && usedLibraries.length > 0) {
    setPendingProjectId(projectId);
    setShowProjectSwitchModal(true);
    return;
  }
  await loadProjectById(projectId);
}

const confirmProjectSwitch = async () => {
  if (pendingProjectId) {
    setShowProjectSwitchModal(false);
    await loadProjectById(pendingProjectId);
    setPendingProjectId(null);
  }
}

const cancelProjectSwitch = () => {
  setShowProjectSwitchModal(false);
  setPendingProjectId(null);
}
```

---

## 최종 체크리스트

- [x] window.confirm 제거
- [x] 커스텀 모달 구현
- [x] 기존 디자인과 일치
- [x] 텍스트 간결화
- [x] 불필요한 장식 제거
- [x] 핵심 정보 유지
- [x] 일관된 스타일
- [x] 반응형 디자인

---

## 결론

✅ **미니멀하고 깔끔한 디자인**  
✅ **간결하지만 명확한 메시지**  
✅ **기존 UI와 완벽한 일관성**  
✅ **핵심 정보는 모두 유지**  

**날짜**: 2025-11-07  
**최종 버전**: v2.0 (Minimal Design)

