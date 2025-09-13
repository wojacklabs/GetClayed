# 동적 OG 이미지 구현 완료

## 개요

GetClayed의 모든 페이지에 동적 Open Graph 이미지를 성공적으로 구현했습니다. 이제 Farcaster 및 모든 소셜 미디어에서 공유 시 각 페이지별로 맞춤형 이미지가 표시됩니다.

## 완료된 작업

### 1. @vercel/og 패키지 설치 ✅
- 동적 OG 이미지 생성을 위한 Vercel OG 라이브러리 설치
- Edge Runtime에서 실행되어 빠른 이미지 생성

### 2. API 라우트 생성 ✅

#### 메인 페이지 (`/api/og`)
- GetClayed 브랜딩 이미지
- 앱 로고, 이름, 태그라인 표시
- 주요 기능 아이콘 (Create, Sculpt, Share)
- 그라데이션 배경 (보라색)

#### 프로젝트 페이지 (`/api/og/project/[id]`)
- 프로젝트 정보 표시 (이름, 작가, 좋아요, 조회수)
- 프로젝트 ID 기반 동적 생성
- URL params를 통해 정보 전달 가능
- 그라데이션 배경 (보라색)

#### 라이브러리 페이지 (`/api/og/library/[id]`)
- 라이브러리 자산 정보 표시 (이름, 작가, 로열티)
- ETH 및 USDC 로열티 정보 표시
- 재사용 가능한 컴포넌트 강조
- 그라데이션 배경 (핑크-레드)

#### 마켓플레이스 페이지 (`/api/og/marketplace/[id]`)
- 판매 중인 자산 정보 표시 (이름, 가격, 판매자)
- "FOR SALE" 뱃지 표시
- 가격 정보 강조
- 그라데이션 배경 (핑크-옐로우)

### 3. Opengraph-image 파일 생성 ✅

Next.js의 특별한 파일 컨벤션을 사용하여 각 동적 경로에 자동 OG 이미지 생성:
- `app/project/[id]/opengraph-image.tsx`
- `app/library/[id]/opengraph-image.tsx`
- `app/marketplace/[id]/opengraph-image.tsx`

### 4. 메타데이터 업데이트 ✅
- 메인 레이아웃의 메타데이터를 동적 이미지 API로 변경
- Farcaster Mini App 메타 태그도 새 이미지 사용

## 생성된 파일

### API Routes
1. `app/api/og/route.tsx` - 메인 페이지 OG 이미지
2. `app/api/og/project/[id]/route.tsx` - 프로젝트 OG 이미지
3. `app/api/og/library/[id]/route.tsx` - 라이브러리 OG 이미지
4. `app/api/og/marketplace/[id]/route.tsx` - 마켓플레이스 OG 이미지

### Opengraph Images
1. `app/project/[id]/opengraph-image.tsx`
2. `app/library/[id]/opengraph-image.tsx`
3. `app/marketplace/[id]/opengraph-image.tsx`

### 수정된 파일
1. `app/layout.tsx` - 메타데이터에 동적 OG 이미지 URL 추가
2. `package.json` - @vercel/og 의존성 추가

## 사용 방법

### 기본 사용

각 페이지는 자동으로 해당하는 OG 이미지를 사용합니다:

- **메인 페이지**: `https://getclayed.vercel.app` → `/api/og`
- **프로젝트**: `https://getclayed.vercel.app/project/123` → `/project/123/opengraph-image`
- **라이브러리**: `https://getclayed.vercel.app/library/456` → `/library/456/opengraph-image`
- **마켓플레이스**: `https://getclayed.vercel.app/marketplace/789` → `/marketplace/789/opengraph-image`

### 추가 정보와 함께 API 사용

API 엔드포인트에 쿼리 파라미터를 추가하여 더 많은 정보를 표시할 수 있습니다:

```typescript
// 프로젝트 OG 이미지 (상세 정보 포함)
const ogImageUrl = `/api/og/project/${projectId}?name=${encodeURIComponent(projectName)}&author=${author}&likes=${likes}&views=${views}`;

// 라이브러리 OG 이미지 (로열티 정보 포함)
const ogImageUrl = `/api/og/library/${libraryId}?name=${encodeURIComponent(name)}&author=${author}&royaltyETH=${royaltyETH}&royaltyUSDC=${royaltyUSDC}&description=${encodeURIComponent(description)}`;

// 마켓플레이스 OG 이미지 (가격 정보 포함)
const ogImageUrl = `/api/og/marketplace/${listingId}?name=${encodeURIComponent(name)}&seller=${seller}&price=${price}&description=${encodeURIComponent(description)}`;
```

## 기술 세부 사항

### Edge Runtime
모든 OG 이미지 API는 Edge Runtime에서 실행되어:
- 빠른 응답 시간
- 전 세계적으로 분산된 생성
- 낮은 지연 시간

### 이미지 크기
- 너비: 1200px
- 높이: 630px
- 포맷: PNG
- Open Graph 및 Twitter Card 표준 준수

### 디자인 요소

#### 색상 스킴
- **메인/프로젝트**: 보라색 그라데이션 (#667eea → #764ba2)
- **라이브러리**: 핑크-레드 그라데이션 (#f093fb → #f5576c)
- **마켓플레이스**: 핑크-옐로우 그라데이션 (#fa709a → #fee140)

#### 공통 요소
- 반투명 화이트 카드 (95% opacity)
- 둥근 모서리 (24px radius)
- 그림자 효과
- 이모지 아이콘
- GetClayed 브랜딩

## Farcaster 통합

### 소셜 공유
Farcaster에서 GetClayed URL을 공유하면:
1. 자동으로 해당 페이지의 OG 이미지 로드
2. Mini App 임베드 카드에 이미지 표시
3. "Launch GetClayed" 버튼으로 앱 실행 가능

### 스플래시 스크린
Farcaster Mini App의 스플래시 스크린도 동적 OG 이미지 사용:
```json
{
  "miniApp": {
    "splashImageUrl": "https://getclayed.vercel.app/api/og",
    "splashBackgroundColor": "#3b82f6"
  }
}
```

## 테스트 방법

### 로컬 테스트
```bash
# 개발 서버 실행
npm run dev

# OG 이미지 확인
open http://localhost:3000/api/og
open http://localhost:3000/api/og/project/test-id
open http://localhost:3000/api/og/library/test-id
open http://localhost:3000/api/og/marketplace/test-id
```

### 프로덕션 테스트
배포 후:
1. URL 공유 시 미리보기 확인
2. [OpenGraph Preview](https://www.opengraph.xyz/) 도구 사용
3. Farcaster에서 직접 공유 테스트

### 디버깅 도구
- [Open Graph Preview](https://www.opengraph.xyz/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)

## 향후 개선 가능 사항

### 1. 실제 썸네일 이미지 통합
현재는 이모지 아이콘을 사용하지만, 실제 프로젝트 썸네일을 배경으로 사용 가능:
```typescript
// Irys에서 썸네일 가져오기
const thumbnailUrl = await downloadProjectThumbnail(thumbnailId);
// OG 이미지에 배경으로 사용
```

### 2. 캐싱 개선
자주 요청되는 이미지는 CDN 캐싱으로 성능 향상:
```typescript
export const revalidate = 3600; // 1시간 캐싱
```

### 3. 다국어 지원
사용자 언어에 따라 다른 텍스트 표시:
```typescript
const locale = searchParams.get('locale') || 'en';
const title = translations[locale].title;
```

### 4. 동적 색상
프로젝트 색상에 따라 그라데이션 동적 생성:
```typescript
const primaryColor = searchParams.get('color') || '#667eea';
```

### 5. 통계 오버레이
프로젝트의 실시간 통계 표시:
```typescript
const stats = await getProjectStats(projectId);
// 좋아요, 조회수, 댓글 수 등
```

## 성능 메트릭

### 빌드 결과
```
Route (app)                                 Size  First Load JS
├ ƒ /api/og                                146 B         104 kB
├ ƒ /api/og/library/[id]                   146 B         104 kB
├ ƒ /api/og/marketplace/[id]               146 B         104 kB
├ ƒ /api/og/project/[id]                   146 B         104 kB
├ ƒ /library/[id]/opengraph-image          146 B         104 kB
├ ƒ /marketplace/[id]/opengraph-image      146 B         104 kB
├ ƒ /project/[id]/opengraph-image          146 B         104 kB
```

- **번들 크기**: 매우 작음 (146 B)
- **Edge Runtime**: 전 세계 빠른 응답
- **동적 생성**: 매 요청마다 새로운 이미지

## 문제 해결

### 일반적인 문제

**Q: OG 이미지가 표시되지 않음**
A: 브라우저 및 소셜 미디어 캐시를 지우고 다시 시도

**Q: Farcaster에서 이미지가 깨짐**
A: 이미지 크기가 1200x630인지 확인하고, Content-Type이 image/png인지 확인

**Q: Edge Runtime 에러**
A: 외부 API 호출은 제한적이므로, searchParams로 데이터 전달 권장

**Q: 한글/특수문자가 표시되지 않음**
A: @vercel/og는 제한된 폰트만 지원. 필요시 커스텀 폰트 추가 가능

## 참고 자료

- [@vercel/og 문서](https://vercel.com/docs/functions/edge-functions/og-image-generation)
- [Next.js Metadata 문서](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Farcaster Mini App 가이드](https://miniapps.farcaster.xyz/docs/guides/sharing)

---

**상태**: ✅ 프로덕션 준비 완료  
**빌드**: ✅ 성공  
**마지막 업데이트**: 2025-11-16

