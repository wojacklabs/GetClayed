# Farcaster Embed 수정 완료

## 문제 상황
Farcaster Embed Tool에서 다음 오류 발생:
- ✕ Embed Valid
- "Preview not available"
- "This URL won't show up as a Mini App embed when shared"

## 적용된 수정 사항

### 1. `app/layout.tsx` 메타데이터 개선

#### 변경 전
```typescript
other: {
  'fc:frame': 'vNext',
  'fc:frame:image': 'https://getclayed.vercel.app/api/og',
  'fc:frame:button:1': 'Launch GetClayed',
  'fc:frame:button:1:action': 'link',
  'fc:frame:button:1:target': 'https://getclayed.vercel.app',
}
```

#### 변경 후
```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://getclayed.vercel.app'), // ← 추가
  // ... 기타 설정
  openGraph: {
    // ...
    siteName: 'GetClayed',                               // ← 추가
    type: 'website',                                     // ← 추가
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': 'https://getclayed.vercel.app/api/og',
    'fc:frame:image:aspect_ratio': '1.91:1',            // ← 추가
    'fc:frame:button:1': 'Launch GetClayed',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://getclayed.vercel.app',
  }
}
```

**주요 변경점:**
- `metadataBase` 추가로 상대 URL 자동 처리
- `fc:frame:image:aspect_ratio` 추가 (Farcaster 요구사항)
- OpenGraph `siteName`, `type` 추가

### 2. `public/.well-known/farcaster.json` 개선

#### 변경 전
```json
{
  "frame": {
    "version": "next",
    "splashBackgroundColor": "#3b82f6"
    // button 정의 없음
  }
}
```

#### 변경 후
```json
{
  "frame": {
    "version": "next",
    "splashBackgroundColor": "#B8C5D6",         // ← 브랜드 컬러로 변경
    "button": {                                  // ← 버튼 정의 추가
      "title": "Launch GetClayed",
      "action": {
        "type": "launch_frame"
      }
    }
  }
}
```

**주요 변경점:**
- 버튼 정의 추가 (Farcaster Mini App 필수)
- splash 배경색을 브랜드 컬러(`#B8C5D6`)로 변경
- 버튼 액션 타입 명시

### 3. 버튼 텍스트 통일
모든 설정에서 **"Launch GetClayed"**로 통일:
- ✅ `app/layout.tsx`: `fc:frame:button:1`
- ✅ `public/.well-known/farcaster.json`: `button.title`
- ✅ `lib/farcasterMetadata.ts`: 생성 함수의 기본값

## 검증 방법

### 1. Farcaster Embed Tool 사용
```
URL: https://getclayed.vercel.app
https://warpcast.com/~/developers/embeds
```

확인 사항:
- ✅ HTTP Status: 200
- ✅ Embed Present
- ✅ Embed Valid
- ✅ Preview 표시

### 2. 실제 Farcaster에서 테스트
1. Warpcast 앱 열기
2. Cast 작성
3. URL 입력: `https://getclayed.vercel.app`
4. 임베드 카드 확인:
   - 이미지 표시
   - "Launch GetClayed" 버튼
   - 앱 이름 및 설명

### 3. 개발 환경에서 메타 태그 확인
```bash
npm run dev
```

브라우저에서:
1. `http://localhost:3000` 접속
2. 개발자 도구 → Elements → `<head>` 확인
3. 메타 태그들이 제대로 생성되었는지 확인:
   ```html
   <meta name="fc:frame" content="vNext">
   <meta name="fc:frame:image" content="https://getclayed.vercel.app/api/og">
   <meta name="fc:frame:image:aspect_ratio" content="1.91:1">
   <meta name="fc:frame:button:1" content="Launch GetClayed">
   <meta name="fc:frame:button:1:action" content="link">
   <meta name="fc:frame:button:1:target" content="https://getclayed.vercel.app">
   ```

## 배포 후 확인사항

### Vercel 배포 후
```bash
git add .
git commit -m "Fix Farcaster embed configuration"
git push
```

배포 완료 후:
1. Farcaster Embed Tool에서 "Refetch" 클릭
2. 캐시 무효화 대기 (최대 5분)
3. Embed Valid ✅ 확인

### 캐시 문제 해결
Farcaster가 이전 메타데이터를 캐시하고 있다면:
1. Embed Tool에서 여러 번 "Refetch" 시도
2. 시간 간격을 두고 재시도 (5분 후)
3. 다른 브라우저나 시크릿 모드에서 테스트

## 참고 문서
- [Farcaster Frames Spec](https://docs.farcaster.xyz/reference/frames/spec)
- [Farcaster Mini Apps](https://miniapps.farcaster.xyz/)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

## 문제 해결

### "Embed Valid ✕" 지속
1. `.well-known/farcaster.json` 접근 가능한지 확인:
   ```
   https://getclayed.vercel.app/.well-known/farcaster.json
   ```
2. CORS 헤더 확인 (vercel.json에 이미 설정됨)
3. JSON 형식 유효성 검사

### 버튼이 "open" 으로 표시
- 메타 태그의 `fc:frame:button:1` content 값 확인
- farcaster.json의 `button.title` 값 확인
- 둘 다 "Launch GetClayed"로 설정되어 있어야 함

### 이미지가 표시되지 않음
- `/api/og` 엔드포인트가 200 응답하는지 확인:
  ```
  https://getclayed.vercel.app/api/og
  ```
- 이미지 크기: 1200x630 (1.91:1 비율)
- Content-Type: image/png 확인

