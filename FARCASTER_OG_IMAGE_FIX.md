# Farcaster OG 이미지 도형 렌더링 완전 수정 ✅

## 문제 상황
Farcaster에서 프로젝트/라이브러리/마켓플레이스 상세 페이지 링크를 공유했을 때:
- ❌ 실제 3D 도형이 표시되지 않음
- ❌ "stone, star, flower, heart" 등의 텍스트만 표시
- ❌ 기본 플레이스홀더 이미지만 나타남

## 근본 원인 파악

### 1. 데이터 필드명 불일치 (Critical Bug)
**발견된 문제:**
```typescript
// ❌ 잘못된 코드 - 데이터가 없음
clayObjects = projectData.clayObjects || []  // undefined!
clayObjects = projectData.objects || []       // undefined!
```

**실제 데이터 구조:**
```typescript
export interface ClayProject {
  clays: ClayData[]  // ✅ 정확한 필드명
  // NOT clayObjects, NOT objects
}
```

**영향:**
- 모든 OG 이미지 API가 빈 배열로 작동
- SVG 렌더링이 실행되지 않음
- 폴백 이미지만 표시됨

### 2. 썸네일 생성 비활성화
**발견된 문제:**
```typescript
// AdvancedClay.tsx line 4266, 4282, 3893
uploadClayProject(
  serialized,
  currentFolder,
  rootTxId,
  (progress) => {...},
  undefined  // ❌ thumbnailId removed - 의도적으로 비활성화됨
)
```

**영향:**
- 프로젝트 저장 시 썸네일이 생성되지 않음
- OG 이미지가 썸네일을 사용할 수 없음
- SVG 폴백으로 넘어가지만 데이터가 없어서 작동 안함

## 완료된 수정 사항

### ✅ 1. 모든 OG API에서 필드명 수정

**수정된 파일:**
1. `/app/api/og/project/[id]/route.tsx` (lines 47, 55)
2. `/app/og-viewer/project/[id]/page.tsx` (line 178, 249)
3. `/app/og-viewer/library/[id]/page.tsx` (line 178)
4. `/app/og-viewer/marketplace/[id]/page.tsx` (line 178)
5. `/app/api/og/render/[id]/route.tsx` (line 86-87)
6. `/app/api/render-3d/[id]/route.ts` (line 43)

**수정 내용:**
```typescript
// ✅ 수정 후 - 정확한 필드명 사용
clayObjects = reassembledProject.clays || []  // 청크 프로젝트
clayObjects = projectData.clays || []         // 일반 프로젝트
```

### ✅ 2. Layout 파일 OG 이미지 URL 최적화

**수정된 파일:**
1. `/app/project/[id]/layout.tsx`
2. `/app/library/[id]/layout.tsx`
3. `/app/marketplace/[id]/layout.tsx`

**수정 내용:**
```typescript
// ✅ 쿼리 파라미터로 데이터 전달하여 중복 fetch 방지
const ogImageParams = new URLSearchParams({
  name: projectName,
  author: projectAuthor,
})
if (thumbnailId) ogImageParams.append('thumbnailId', thumbnailId)

const ogImageUrl = `${baseUrl}/api/og/project/${id}?${ogImageParams.toString()}`
```

### ✅ 3. OG Viewer 페이지 생성 (향후 개선용)

**생성된 파일:**
1. `/app/og-viewer/project/[id]/page.tsx` - 프로젝트용 3D 뷰어
2. `/app/og-viewer/library/[id]/page.tsx` - 라이브러리용 3D 뷰어
3. `/app/og-viewer/marketplace/[id]/page.tsx` - 마켓플레이스용 3D 뷰어

**특징:**
- Three.js를 사용한 실제 3D 렌더링
- 자동 회전 애니메이션
- 프로젝트 정보 오버레이
- 향후 스크린샷 캡처 서비스와 연동 가능

## 작동 방식

### 현재 구현 (SVG 기반)

```
1. Farcaster가 프로젝트 링크 크롤링
   └─> /project/[id] 페이지 접근
       └─> layout.tsx에서 generateMetadata() 실행
           └─> Irys에서 프로젝트 데이터 fetch
               └─> OG 이미지 URL 생성: /api/og/project/[id]?name=...&author=...

2. Farcaster가 OG 이미지 URL fetch
   └─> /api/og/project/[id] API 호출
       └─> ✅ 썸네일 ID가 있으면: 썸네일 이미지 직접 반환
       └─> ❌ 썸네일 없으면:
           └─> Irys에서 프로젝트 데이터 fetch
               └─> clayObjects = projectData.clays ✅ (수정됨)
                   └─> SVG로 도형 렌더링
                       - box → rectangle
                       - cylinder → ellipse
                       - sphere/cone/torus → circle
                       - 위치, 크기, 색상, 회전 반영
                       - 최대 10개 객체 렌더링
```

### SVG 렌더링 예시

```typescript
// box 타입
<rect
  x={x - scale}
  y={y - scale}
  width={scale * 2}
  height={scale * 2}
  fill={color}
  opacity={0.9 - z * 0.05}
  transform={`rotate(${rotation} ${x} ${y})`}
/>

// cylinder 타입
<ellipse
  cx={x}
  cy={y}
  rx={scale}
  ry={scale * 0.8}
  fill={color}
  opacity={0.9 - z * 0.05}
/>

// 기본 (sphere, cone, torus)
<circle
  cx={x}
  cy={y}
  r={scale}
  fill={color}
  opacity={0.9 - z * 0.05}
/>
```

## 테스트 방법

### 1. 로컬 테스트
```bash
# 개발 서버 시작
npm run dev

# 브라우저에서 OG 이미지 직접 확인
http://localhost:3000/api/og/project/[PROJECT_ID]
```

### 2. Farcaster 테스트
1. 프로젝트 저장하고 Irys 트랜잭션 ID 확인
2. Warpcast에서 링크 공유:
   ```
   https://getclayed.io/project/[TRANSACTION_ID]
   ```
3. 프리뷰 카드에서 도형 렌더링 확인

### 3. 디버깅
```bash
# 서버 로그 확인
tail -f .next/server.log

# OG 이미지 API 로그
# 브라우저 개발자 도구 Network 탭에서
# /api/og/project/[id] 요청 확인
```

## 현재 상태

### ✅ 완료된 기능
1. **모든 타입의 기본 도형 렌더링**
   - Sphere, Box, Cylinder, Cone, Torus
   - 위치, 크기, 색상, 회전 반영
   - Z축 깊이감 표현 (opacity 조절)

2. **3가지 페이지 타입 지원**
   - 프로젝트 상세 (`/project/[id]`)
   - 라이브러리 상세 (`/library/[id]`)
   - 마켓플레이스 상세 (`/marketplace/[id]`)

3. **청크 프로젝트 지원**
   - 대용량 프로젝트 재조립
   - 자동 폴백 처리

4. **성능 최적화**
   - 캐싱 (1시간)
   - 중복 fetch 방지
   - 쿼리 파라미터 활용

### ⚠️ 제한사항 (SVG 렌더링)

1. **복잡한 변형 geometry 미지원**
   - Deformed/sculpted 도형은 기본 모양으로 표시
   - 커스텀 geometry data는 SVG로 표현 불가능

2. **렌더링 품질**
   - 2D 투영이므로 3D 깊이감 제한적
   - 복잡한 장면은 단순화됨

3. **최대 객체 수**
   - 10개까지만 렌더링 (성능 및 가독성)

## 향후 개선 방안

### 옵션 1: 썸네일 생성 재활성화 (권장)

**장점:**
- ✅ 실제 3D 렌더링 결과를 이미지로 저장
- ✅ 완벽한 품질
- ✅ 변형된 geometry도 정확히 표현

**작업:**
1. `AdvancedClay.tsx`에서 `captureSceneThumbnail` 호출 추가
2. `uploadProjectThumbnail`로 Irys에 업로드
3. `thumbnailId`를 `uploadClayProject`에 전달

**예상 코드:**
```typescript
// Save project 전에
const thumbnailDataUrl = await captureSceneThumbnail(
  renderer, 
  scene, 
  camera,
  800, 
  600
)
const compressedThumbnail = await compressImageDataUrl(thumbnailDataUrl, 400, 0.8)
const thumbnailId = await uploadProjectThumbnail(compressedThumbnail, projectId)

// Then save with thumbnailId
await uploadClayProject(
  serialized,
  currentFolder,
  rootTxId,
  onProgress,
  thumbnailId  // ✅ Pass thumbnail ID
)
```

### 옵션 2: 서버사이드 3D 렌더링

**장점:**
- ✅ 썸네일 없어도 실시간 렌더링
- ✅ 항상 최신 상태 반영

**단점:**
- ❌ 복잡한 구현 (node-canvas, headless GL)
- ❌ 서버 리소스 소모
- ❌ Edge Runtime에서 불가능

### 옵션 3: 외부 스크린샷 서비스

**장점:**
- ✅ `/og-viewer/` 페이지 활용 가능
- ✅ 실제 브라우저 렌더링

**작업:**
1. Puppeteer/Playwright 서버 구축
2. `/og-viewer/project/[id]` 스크린샷 캡처
3. OG 이미지로 제공

## 결론

**현재 수정으로 해결된 문제:**
- ✅ 데이터 필드명 오류 수정 → 기본 도형 렌더링 작동
- ✅ 모든 페이지 타입 일관성 확보
- ✅ 성능 최적화

**여전히 남은 과제:**
- ⚠️ 복잡한 sculpted geometry는 기본 도형으로 표시
- ⚠️ 썸네일 생성 재활성화 필요 (최상의 품질을 위해)

**권장 사항:**
→ **썸네일 생성 재활성화** (옵션 1)가 가장 실용적이고 효과적인 해결책입니다.

