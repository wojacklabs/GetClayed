# ⏳ 남은 UI 작업 (8개)

## 🎯 빠른 수정 필요 항목

### 1. Library 팝업/페이지 썸네일 표시
**문제**: Library에서 썸네일 안 보임  
**원인**: Irys 쿼리 시 Thumbnail-ID 태그 로드 필요  
**수정**: `queryLibraryAssets()`에 썸네일 로드 추가

### 2. Library 상세 파란색 제거
**위치**: `app/library/[id]/page.tsx`  
**수정**: `bg-blue-500` → `bg-gray-800` 전체 교체

### 3. 프로젝트 상세 헤더 - Library/Marketplace 정보
**위치**: `components/ProjectDetailView.tsx` 헤더 우측  
**추가**:
```tsx
{libraryInfo && marketplaceInfo ? (
  // 토글 버튼
) : libraryInfo ? (
  // 로열티 정보만
) : marketplaceInfo ? (
  // 가격 정보만
) : null}
```

### 4. Library 업로드 로딩 처리
**위치**: `AdvancedClay` handleLibraryUpload  
**수정**: 버튼 disabled + "Registering..." 표시

### 5. Library 팝업 제거 기능
**위치**: `AdvancedClay` Library 검색 팝업  
**추가**: 각 카드에 X 버튼

### 6. 프로젝트 로딩 메시지
**위치**: `AdvancedClay` 파일 열기  
**수정**: `Loading ${projectName} project`

### 7. 홈 화면 섹션별 로딩
**위치**: `app/page.tsx`  
**수정**: 각 섹션 독립 loading state

### 8. Import 감지
**위치**: `AdvancedClay` 저장 시  
**로직**: clayObjects의 originalProjectId 추적

---

## 🚀 현재 상태

**v3.0 배포 완료**: Base Mainnet  
**환경변수**: 로컬 설정 완료  
**Vercel**: 환경변수 설정 후 배포

**핵심 기능 완성, UI만 마무리!** 🎯

