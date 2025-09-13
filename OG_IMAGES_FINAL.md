# 🎨 GetClayed OG 이미지 최종 완성

## ✅ 완료된 작업

### 1. 디자인 컨셉
- **이전**: 화려한 그라데이션 배경 + 이모지 아이콘
- **현재**: 미니멀 화이트 배경 + 실제 지점토 구체 로고

### 2. 변경 사항

#### 배경
- `#f9fafb` (light gray) - 웹사이트와 동일

#### 로고
- **실제 앱의 지점토 구체 사용**
- 색상: `#B8C5D6` (회색빛 파란색)
- 그라데이션으로 입체감 표현
- inset 그림자로 지점토 질감

#### 레이아웃
- 80px 외부 패딩 추가
- 화이트 카드에 컨텐츠 담기
- 중앙 정렬 + 적절한 여백
- 크기 축소로 embed에서 꽉 차지 않게

### 3. 적용된 페이지

✅ **메인** (`/api/og`)
- 지점토 구체 로고
- "Sculpt like a 5-year-old genius"
- Easy / On-Chain / 3D 배지

✅ **프로젝트** (`/api/og/project/[id]`)
- 프로젝트 정보 + 통계 (좋아요, 조회수)
- 작가 정보
- 작은 화이트 카드

✅ **라이브러리** (`/api/og/library/[id]`)
- "📚 Library Asset" 배지
- 로열티 정보 (ETH/USDC)
- 작가 정보

✅ **마켓플레이스** (`/api/og/marketplace/[id]`)
- "FOR SALE" 다크 배지
- 가격 정보
- 판매자 정보

---

## 🎨 디자인 특징

### 색상 팔레트
```css
배경: #f9fafb (light gray)
카드: #ffffff (white)
보더: #e5e7eb (gray-200)
텍스트(주): #111827 (gray-900)
텍스트(부): #6b7280 (gray-500)
로고: #B8C5D6 (지점토 회색빛 파란색)
```

### 지점토 구체 로고
- 완벽한 원형
- 이중 그라데이션 (입체감)
- inset 그림자 (말랑한 질감)
- 화이트 보더 (깔끔함)

### 레이아웃
- 외부 패딩: 80px (상하좌우)
- 카드 패딩: 50-70px
- 최대 너비: 700-800px
- 중앙 정렬

---

## 📐 이미지 크기

| 페이지 | 너비 | 높이 | 비율 |
|--------|------|------|------|
| 메인 | 1200px | 800px | 3:2 |
| 프로젝트 | 1200px | 630px | 1.9:1 |
| 라이브러리 | 1200px | 630px | 1.9:1 |
| 마켓플레이스 | 1200px | 630px | 1.9:1 |

---

## 🔍 미리보기 URL

배포 후 다음 URL에서 확인:

### 메인
```
https://getclayed.vercel.app/api/og
```

### 프로젝트 (예시)
```
https://getclayed.vercel.app/api/og/project/test?name=My+Amazing+Project&author=0x1234567890&likes=42&views=100
```

### 라이브러리 (예시)
```
https://getclayed.vercel.app/api/og/library/test?name=Clay+Pot&author=0x1234567890&royaltyETH=0.01&royaltyUSDC=5
```

### 마켓플레이스 (예시)
```
https://getclayed.vercel.app/api/og/marketplace/test?name=Unique+Art&seller=0x1234567890&price=1.5
```

---

## ✨ Farcaster 통합

### farcaster.json 업데이트됨

모든 이미지 URL이 동적 OG로 변경:
- ✅ `iconUrl`: `clay.png`
- ✅ `imageUrl`: `/api/og`
- ✅ `splashImageUrl`: `/api/og`
- ✅ `splashBackgroundColor`: `#f9fafb`
- ✅ `heroImageUrl`: `/api/og`
- ✅ `ogImageUrl`: `/api/og`

### Manifests 설정

모든 이미지 항목에:
```
https://getclayed.vercel.app/api/og
```

배경색:
```
#f9fafb
```

---

## 📊 개선 효과

### Before (문제점)
- ❌ Farcaster embed에서 이미지가 화면 꽉 참
- ❌ 화려한 그라데이션이 웹사이트와 안 맞음
- ❌ 항아리 이모지가 앱 로고와 다름

### After (해결)
- ✅ **여백이 있어 embed에서 보기 좋음**
- ✅ **웹사이트의 미니멀 디자인과 완벽히 매칭**
- ✅ **실제 지점토 구체 로고 사용**
- ✅ **일관된 브랜딩**

---

## 🚀 배포 후 확인사항

### 1. OG 이미지 테스트
```bash
# 브라우저에서 직접 확인
open https://getclayed.vercel.app/api/og
```

### 2. Farcaster에서 공유 테스트
1. Warpcast 앱 열기
2. 새 캐스트 작성
3. URL 입력: `https://getclayed.vercel.app`
4. **이미지 미리보기 확인:**
   - 지점토 구체 로고 표시
   - 주변에 여백 있음
   - 화이트 카드 안에 컨텐츠
   - 깔끔하고 읽기 쉬움

### 3. 소셜 미디어 검증
- [Open Graph Preview](https://www.opengraph.xyz/)
- URL 입력: `https://getclayed.vercel.app`
- 이미지 프리뷰 확인

---

## 💡 최종 Manifests 입력 정보

### Visuals & Branding

| 항목 | 값 |
|------|-----|
| Screenshots | `https://getclayed.vercel.app/api/og` |
| Preview Image | `https://getclayed.vercel.app/api/og` |
| Hero Image | `https://getclayed.vercel.app/api/og` |
| Splash Screen Image | `https://getclayed.vercel.app/api/og` |
| **Splash Background Color** | `#f9fafb` |
| Icon URL | `https://getclayed.vercel.app/clay.png` |

---

## 🎯 결과

### Embed Preview 개선
- ✅ 이미지가 적절한 크기로 중앙에 표시
- ✅ 주변 여백으로 편안한 느낌
- ✅ 텍스트가 선명하고 읽기 쉬움
- ✅ 웹사이트와 일관된 디자인

### 브랜딩 일관성
- ✅ 모든 이미지에 실제 지점토 구체 로고
- ✅ 웹사이트와 동일한 색상 팔레트
- ✅ 미니멀하고 전문적인 느낌
- ✅ Farcaster에서 돋보이는 깔끔한 디자인

---

**상태**: ✅ 프로덕션 준비 완료  
**빌드**: ✅ 성공  
**디자인**: ✅ 웹사이트와 완벽히 매칭  
**마지막 업데이트**: 2025-11-17

---

이제 Vercel에 배포하고 Farcaster에서 공유해보세요! 🚀

