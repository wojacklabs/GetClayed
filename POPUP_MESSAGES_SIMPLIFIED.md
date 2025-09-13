# Popup Messages Simplified - 2025-11-07

## 변경 사항 요약

팝업 메시지 75개 중 주요 메시지들을 미니멀하게 간결화했습니다.

## Library 관련 메시지

### Before → After

| Before | After |
|--------|-------|
| Remove this project from Library? Users will no longer pay royalties. | Remove from Library? |
| Checking current library prices on blockchain... | Checking prices... |
| ⚠️ Warning: 2 of your dependencies have been deleted: LibA, LibB. These won't receive royalties, so minimum price is reduced. | ⚠️ 2 dependencies deleted: LibA, LibB |
| ⚠️ Warning: 1 of your dependencies have disabled royalties: LibC. These won't receive royalties, so minimum price is reduced. | ⚠️ 1 dependencies disabled: LibC |
| ⚠️ Price too low! This project uses 2 active library(ies). To protect the original creators, your royalty must be HIGHER than their CURRENT total royalties. Current minimum: 1.000000 ETH (you set: 0.500000 ETH). Suggested: 1.200000 ETH or more. | Price too low. Minimum: 1.0000 ETH (you set: 0.5000). Suggested: 1.2000 |
| ⚠️ Price too low! ... Current minimum: 5.00 USDC (you set: 2.00 USDC). Suggested: 6.00 USDC or more. | Price too low. Minimum: 5.00 USDC (you set: 2.00). Suggested: 6.00 |
| ✅ Good pricing! Your royalty (2.000000 ETH) is higher than current dependencies (1.000000 ETH). Original creators will receive their fair share when someone uses your library. | ✅ Price OK (2.0000 ETH > 1.0000 minimum) |
| ✅ This project has no active library dependencies. You can set any price. | ✅ No dependencies - any price OK |
| Asset registered to library! | Registered to library |
| Importing library asset... | Importing... |
| Imported with 2 library dependency(ies). Payment on upload. | Imported (2 dependencies) |
| All 2 libraries already owned - no payment needed | All 2 libraries owned |
| No active library dependencies - no payment needed | No library dependencies |

## Project 관련 메시지

| Before | After |
|--------|-------|
| Project "MyProject" loaded successfully! (with 2 library dependencies) | Loaded: MyProject (with 2 library dependencies) |
| Failed to load project. Please try again. | Failed to load project |
| Project deleted successfully! | Deleted |
| Failed to delete project. Please try again. | Delete failed |
| Project renamed successfully! | Renamed |
| Failed to rename project. Please try again. | Rename failed |
| New project created | New project |
| Failed to restore auto-saved data. Starting fresh. | Auto-save restore failed |

## Upload 관련 메시지

| Before | After |
|--------|-------|
| Warning: Could not sign project data. Project integrity cannot be verified. | Could not sign project data |
| Warning: Project signature failed. This project may not be verifiable for royalty payments. | Project signature failed |
| Insufficient balance. Your project is over 100KB and requires IRYS tokens. | Insufficient IRYS balance (project >100KB) |
| Project size exceeds 100KB free tier. Payment is required. | Project >100KB - payment required |
| Failed to save project. Please try again. | Save failed |

## Group/Object 관련 메시지

| Before | After |
|--------|-------|
| Please select at least 2 objects to group | Select 2+ objects to group |
| Please select a main object for the group | Select main object |
| Created group: MyGroup | Group: MyGroup |
| Group copied | Copied |
| Object copied | Copied |
| Group cut | Cut |
| Object cut | Cut |
| Group pasted | Pasted |
| Object pasted | Pasted |
| Color applied | Color changed |

## Folder 관련 메시지

| Before | After |
|--------|-------|
| Folder and 5 project(s) deleted successfully! | Deleted folder + 5 projects |
| Folder deleted successfully! | Folder deleted |
| Failed to delete folder contents. Please try again. | Delete folder failed |

## Export 관련 메시지

| Before | After |
|--------|-------|
| GLB file exported successfully | Exported |
| Failed to export GLB file | Export failed |

## 간결화 원칙

1. **"Please try again" 제거**: 당연한 말이므로 생략
2. **"Successfully" 제거**: 성공 타입(success)으로 이미 표시
3. **"!" 최소화**: 과도한 감정 표현 제거
4. **경고 아이콘 유지**: ⚠️, ✅는 시각적 정보로 유용하므로 유지
5. **핵심 정보만**: 사용자가 알아야 할 최소한의 정보만 표시
6. **숫자 정밀도 감소**: 6자리 → 4자리 (ETH)

## 메시지 길이 비교

| 카테고리 | 평균 Before | 평균 After | 감소율 |
|----------|-------------|-----------|--------|
| Library 가격 경고 | ~150자 | ~80자 | 47% |
| Library 등록 | ~80자 | ~30자 | 62% |
| Project 작업 | ~40자 | ~20자 | 50% |
| Upload 오류 | ~70자 | ~35자 | 50% |
| Object 작업 | ~25자 | ~10자 | 60% |

**전체 평균 감소**: ~54%

## 사용자 경험 개선

### Before (장황함)
```
⚠️ Price too low! This project uses 2 active library(ies). 
To protect the original creators, your royalty must be HIGHER 
than their CURRENT total royalties. Current minimum: 1.000000 ETH 
(you set: 0.500000 ETH). Suggested: 1.200000 ETH or more.
```
- 읽기 힘듦
- 핵심이 묻힘
- 너무 설명적

### After (간결함)
```
Price too low. Minimum: 1.0000 ETH (you set: 0.5000). Suggested: 1.2000
```
- 한눈에 파악
- 핵심 정보만
- 간결하고 명확

## 코드 플로우 확인 결과

### ✅ Library Import Flow
```
handleImportFromLibrary()
  ↓ Download project
  ↓ Add to clayObjects with librarySourceId
  ↓ Update usedLibraries state
  ↓ Update pendingLibraryPurchases
  ↓ Show: "Imported (N dependencies)"
```
**검증**: ✅ 정상 작동

### ✅ Library Registration Flow
```
handleLibraryUpload()
  ↓ Check if current project (use memory)
  ↓ OR download project (use downloaded data)
  ↓ Get dependencyLibraries
  ↓ Validate minimum price (blockchain)
  ↓ Register to contract
  ↓ Show: "Registered to library"
```
**검증**: ✅ 정상 작동 (수정 후)

### ✅ Royalty Payment Flow
```
handleSaveProject()
  ↓ Detect finalUsedLibraries (from usedLibraries state)
  ↓ Call processLibraryPurchasesAndRoyalties()
  ↓ If totalCost > 0: Show "Royalty paid"
  ↓ If alreadyOwned: Show "All N libraries owned"
  ↓ If no dependencies: Show "No library dependencies"
```
**검증**: ✅ 정상 작동 (수정 후)

### ✅ Error Handling
```
catch (error) {
  if (User rejected) → throw → 업로드 중단
  if (Insufficient balance) → throw → 업로드 중단
  else → throw → 업로드 중단
}
```
**검증**: ✅ 정상 작동 (수정 후)

---

## 변경 파일

- `app/components/AdvancedClay.tsx`: 45개 메시지 간결화

---

## 결론

✅ **팝업 메시지 54% 간결화**  
✅ **코드 플로우 검증 완료**  
✅ **UX 개선 (가독성 향상)**  
✅ **핵심 정보는 유지**  

**날짜**: 2025-11-07  
**영향**: 모든 팝업 메시지

