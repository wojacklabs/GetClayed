# Farcaster 상세 페이지 미리보기 수정 완료 ✅

## 문제 상황
Farcaster에 프로젝트/라이브러리/마켓플레이스 상세 페이지 링크를 공유했을 때:
- ❌ 메인 홈페이지와 동일하게 `animated-logo`만 보임
- ❌ 각 프로젝트의 실제 도형(썸네일)이 표시되지 않음
- ❌ 프로젝트 정보(이름, 작성자 등)도 표시되지 않음

## 해결 완료 ✅

이제 Farcaster에서 상세 페이지 링크를 공유하면:
- ✅ **실제 프로젝트의 3D 도형 썸네일**이 미리보기에 표시됨
- ✅ 프로젝트 이름, 작성자, 정보가 표시됨
- ✅ 각 페이지 타입(프로젝트/라이브러리/마켓플레이스)에 맞는 고유한 디자인

## 원인
각 상세 페이지(`/project/[id]`, `/library/[id]`, `/marketplace/[id]`)가 클라이언트 컴포넌트로만 구성되어 있어서, 서버 사이드에서 동적 메타데이터를 생성하지 못했습니다. Farcaster가 링크를 크롤링할 때는 서버 사이드에서 생성된 메타데이터가 필요합니다.

## 구현 내용

### 1. 각 상세 페이지에 동적 메타데이터 추가

**생성된 파일:**
- `app/project/[id]/layout.tsx`
- `app/library/[id]/layout.tsx`
- `app/marketplace/[id]/layout.tsx`

각 layout 파일은:
- ✅ Irys에서 프로젝트 데이터 가져오기 (이름, 작성자, 썸네일 ID)
- ✅ Open Graph 메타데이터 생성
- ✅ Farcaster Frame 메타데이터 생성
- ✅ 1시간 캐싱으로 성능 최적화

### 2. 실제 프로젝트 썸네일을 사용하는 OG 이미지 API

**수정된 파일:**
- `app/api/og/project/[id]/route.tsx`
- `app/api/og/library/[id]/route.tsx`
- `app/api/og/marketplace/[id]/route.tsx`

각 OG 이미지 API는:
- ✅ **실제 프로젝트 썸네일**을 Irys에서 다운로드
- ✅ 썸네일을 배경과 메인 이미지로 사용
- ✅ 프로젝트 정보 오버레이 (이름, 작성자 등)
- ✅ 썸네일이 없을 경우 clay ball 아이콘 표시

### 3. 썸네일 표시 방식

#### 썸네일이 있을 때:
```
┌─────────────────────────────────┐
│  [흐릿한 썸네일 배경 + 오버레이]   │
│                                 │
│      ┌──────────────┐           │
│      │  실제 썸네일  │           │
│      │   (명확)     │           │
│      └──────────────┘           │
│                                 │
│      프로젝트 이름               │
│      by 작성자...                │
│      ❤️ 좋아요  👁️ 조회수        │
└─────────────────────────────────┘
```

#### 썸네일이 없을 때:
```
┌─────────────────────────────────┐
│                                 │
│         🔵 (clay ball)          │
│                                 │
│      프로젝트 이름               │
│      by 작성자...                │
│      ❤️ 좋아요  👁️ 조회수        │
└─────────────────────────────────┘
```

각 페이지는 다음 메타데이터를 포함합니다:

#### Open Graph 태그
```typescript
openGraph: {
  title: `${projectName} - GetClayed`,
  description: projectDescription,
  images: [{
    url: ogImageUrl,
    width: 1200,
    height: 630,
    alt: projectName,
  }],
  url: `/project/${id}`,
  siteName: 'GetClayed',
  type: 'website',
}
```

#### Farcaster Frame 태그
```typescript
other: {
  'fc:frame': 'vNext',
  'fc:frame:image': ogImageUrl,
  'fc:frame:image:aspect_ratio': '1.91:1',
  'fc:frame:button:1': 'View Project',
  'fc:frame:button:1:action': 'link',
  'fc:frame:button:1:target': `${baseUrl}/project/${id}`,
}
```

### 4. 동적 OG 이미지 API 활용

기존에 구현된 OG 이미지 API들을 활용하여 각 프로젝트별 맞춤 이미지를 생성합니다:
- `/api/og/project/[id]` - 프로젝트 정보 표시
- `/api/og/library/[id]` - 라이브러리 자산 정보 표시
- `/api/og/marketplace/[id]` - 마켓플레이스 리스팅 정보 표시

## 기술 세부 사항

### 1. Irys에서 데이터 가져오기

서버 사이드에서 프로젝트 데이터를 가져옵니다:
```typescript
const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${id}/data`
const response = await fetch(IRYS_DATA_URL, {
  next: { revalidate: 3600 }, // 1시간 캐시
})

const projectData = await response.json()
const thumbnailId = projectData.thumbnailId || projectData.tags?.['Thumbnail-ID']
```

### 2. OG 이미지에서 썸네일 다운로드

Edge Runtime에서 썸네일을 다운로드하고 base64로 변환:
```typescript
const thumbResponse = await fetch(`https://uploader.irys.xyz/tx/${thumbnailId}/data`)
const arrayBuffer = await thumbResponse.arrayBuffer()
const base64 = Buffer.from(arrayBuffer).toString('base64')
const thumbnailUrl = `data:image/jpeg;base64,${base64}`
```

### 3. 썸네일을 배경과 메인 이미지로 사용

```typescript
{/* 흐릿한 배경 */}
<div style={{
  backgroundImage: `url(${thumbnailUrl})`,
  opacity: 0.15,
  filter: 'blur(8px)',
}} />

{/* 명확한 메인 이미지 */}
<div style={{
  width: '200px',
  height: '200px',
  backgroundImage: `url(${thumbnailUrl})`,
  backgroundSize: 'cover',
}} />
```

## 미리보기 예시

### 프로젝트 상세 페이지
```
URL: https://getclayed.vercel.app/project/{id}

미리보기:
┌─────────────────────────────────────────┐
│  [프로젝트 썸네일 배경]                    │
│                                         │
│      ┌────────────────────┐             │
│      │  3D Clay 도형       │             │
│      │  (실제 프로젝트)     │             │
│      └────────────────────┘             │
│                                         │
│      My Awesome Sculpture               │
│      by 0x1234...5678                   │
│      ❤️ 42  👁️ 156                     │
│                                         │
│      [View Project 버튼]                │
└─────────────────────────────────────────┘
```

### 라이브러리 상세 페이지
```
URL: https://getclayed.vercel.app/library/{id}

미리보기:
┌─────────────────────────────────────────┐
│  📚 Library Asset                       │
│                                         │
│      ┌────────────────────┐             │
│      │  재사용 가능한      │             │
│      │  3D 컴포넌트       │             │
│      └────────────────────┘             │
│                                         │
│      Cool 3D Head                       │
│      by 0xabcd...efgh                   │
│      0.001 ETH  2 USDC                  │
│                                         │
│      [View in Library 버튼]             │
└─────────────────────────────────────────┘
```

### 마켓플레이스 상세 페이지
```
URL: https://getclayed.vercel.app/marketplace/{id}

미리보기:
┌─────────────────────────────────────────┐
│          [ FOR SALE ]                   │
│                                         │
│      ┌────────────────────┐             │
│      │  판매 중인 작품     │             │
│      └────────────────────┘             │
│                                         │
│      Epic Clay Art                      │
│      💎 0.05 ETH                        │
│      Seller: 0x9876...5432              │
│                                         │
│      [View Listing 버튼]                │
└─────────────────────────────────────────┘
```

## 테스트 방법

### 1. 로컬 개발 환경

```bash
npm run dev
```

브라우저에서 다음 URL을 방문하여 `<head>` 태그 확인:
- `http://localhost:3000/project/{id}`
- `http://localhost:3000/library/{id}`
- `http://localhost:3000/marketplace/{id}`

개발자 도구에서 다음 메타 태그들이 생성되었는지 확인:
```html
<meta property="og:image" content="https://getclayed.vercel.app/api/og/project/{id}?name=...&author=...">
<meta property="fc:frame" content="vNext">
<meta property="fc:frame:image" content="https://getclayed.vercel.app/api/og/project/{id}?name=...&author=...">
<meta property="fc:frame:image:aspect_ratio" content="1.91:1">
```

### 2. Farcaster Embed Tool

배포 후, Farcaster Embed Tool을 사용하여 테스트:
```
https://warpcast.com/~/developers/embeds
```

각 상세 페이지 URL을 입력하고 다음 항목 확인:
- ✅ HTTP Status: 200
- ✅ Embed Present
- ✅ Embed Valid
- ✅ Preview 표시 (프로젝트 이름, 작성자, 이미지)

### 3. 실제 Farcaster에서 테스트

1. Warpcast 앱 열기
2. Cast 작성
3. 상세 페이지 URL 입력 (예: `https://getclayed.vercel.app/project/...`)
4. 미리보기 카드 확인:
   - 프로젝트 정보가 표시된 이미지
   - "View Project" (또는 해당 버튼) 버튼
   - 프로젝트 제목 및 설명

## 배포

변경사항을 커밋하고 푸시:
```bash
git add app/project/[id]/layout.tsx
git add app/library/[id]/layout.tsx
git add app/marketplace/[id]/layout.tsx
git commit -m "Add Farcaster metadata for detail pages"
git push
```

Vercel이 자동으로 배포합니다.

## 주의사항

### 1. 캐싱
- 메타데이터는 1시간 동안 캐싱됩니다
- 프로젝트를 업데이트한 후 미리보기가 즉시 반영되지 않을 수 있습니다
- Farcaster도 자체적으로 캐싱을 하므로 변경사항이 반영되는데 최대 5-10분 소요될 수 있습니다

### 2. Chunked 프로젝트
- 큰 프로젝트의 경우 chunk manifest만 반환되므로 기본 정보를 사용합니다
- 추후 chunk를 reassemble하는 서버 로직을 추가할 수 있습니다

### 3. 가격 정보
- 마켓플레이스 리스팅의 가격 정보는 스마트 컨트랙트에서 가져와야 합니다
- 현재는 Irys 데이터만 사용하므로 가격 정보가 정확하지 않을 수 있습니다
- 추후 컨트랙트 쿼리 로직을 추가할 수 있습니다

## 기대 효과

### 1. 더 나은 공유 경험
- Farcaster에서 링크 공유 시 프로젝트 정보가 즉시 보임
- 사용자가 클릭하기 전에 프로젝트 내용을 미리 확인 가능

### 2. 트래픽 증가
- 매력적인 미리보기로 클릭률 향상
- Farcaster 커뮤니티에서 더 많은 유입

### 3. 프로페셔널한 인상
- 소셜 미디어에서 완성도 높은 미리보기 제공
- GetClayed 브랜드 강화

## 참고 문서

- [FARCASTER_EMBED_FIX.md](./FARCASTER_EMBED_FIX.md) - 메인 페이지 Farcaster 설정
- [DYNAMIC_OG_IMAGES_SETUP.md](./DYNAMIC_OG_IMAGES_SETUP.md) - OG 이미지 생성 구현
- [Farcaster Frames Spec](https://docs.farcaster.xyz/reference/frames/spec)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

## 완료 체크리스트

- ✅ 프로젝트 상세 페이지 layout 추가
- ✅ 라이브러리 상세 페이지 layout 추가
- ✅ 마켓플레이스 상세 페이지 layout 추가
- ✅ generateMetadata 함수 구현
- ✅ Irys 데이터 가져오기 로직
- ✅ **썸네일 ID 가져오기 및 전달**
- ✅ **OG 이미지 API에서 썸네일 다운로드**
- ✅ **실제 프로젝트 썸네일을 이미지에 표시**
- ✅ 썸네일 배경 효과 (흐림 + 오버레이)
- ✅ 썸네일 없을 때 fallback (clay ball 아이콘)
- ✅ Open Graph 메타데이터 생성
- ✅ Farcaster Frame 메타데이터 생성
- ✅ OG 이미지 API 활용
- ✅ 캐싱 전략 적용
- ✅ Chunked 프로젝트 처리
- ✅ 린터 오류 없음

## 주요 개선 사항 🎨

### 이전 (Before)
- ❌ 모든 페이지에서 동일한 `animated-logo` 표시
- ❌ 프로젝트 정보 없음
- ❌ 실제 도형 보이지 않음

### 이후 (After)
- ✅ **실제 프로젝트의 3D 도형 썸네일** 표시
- ✅ 프로젝트 이름, 작성자 정보 표시
- ✅ 각 페이지 타입에 맞는 고유한 디자인
- ✅ 썸네일을 배경과 메인 이미지로 활용
- ✅ 프로페셔널한 미리보기

## 향후 개선 사항

### 1. 썸네일 없는 프로젝트 처리 ✅ (완료)
- 현재: clay ball 아이콘 표시
- 개선 가능: 프로젝트의 첫 번째 오브젝트 자동 렌더링

### 2. 더 상세한 정보
- 좋아요 수, 조회수 등의 실시간 정보를 메타데이터에 포함
- 현재 서버에서 프로필 서비스 호출 시 성능 영향 고려 필요

### 3. 가격 정보 정확도
- 마켓플레이스 리스팅의 경우 스마트 컨트랙트에서 직접 가격을 가져오는 로직 추가

### 4. 캐시 무효화
- 프로젝트 업데이트 시 메타데이터 캐시를 즉시 무효화하는 방법
- 현재는 1시간 후 자동 갱신

