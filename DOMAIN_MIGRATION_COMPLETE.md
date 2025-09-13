# GetClayed.io 도메인 마이그레이션 완료 ✅

## 변경 사항

도메인이 `getclayed.vercel.app`에서 **`getclayed.io`**로 변경되었습니다.

## 업데이트된 파일들

### 🎯 핵심 설정 파일

1. **`public/.well-known/farcaster.json`** ✅
   - 모든 URL을 `getclayed.io`로 변경
   - `accountAssociation` 제거 (도메인 변경으로 서명 무효화됨)
   - miniapp, frame 설정 유지

2. **`app/layout.tsx`** ✅
   - metadataBase: `https://getclayed.io`
   - miniAppEmbed URLs 업데이트
   - frameEmbed URLs 업데이트

### 📄 상세 페이지 메타데이터

3. **`app/project/[id]/layout.tsx`** ✅
   - baseUrl: `https://getclayed.io`
   - OG 이미지 URLs
   - Farcaster frame target URLs

4. **`app/library/[id]/layout.tsx`** ✅
   - baseUrl: `https://getclayed.io`
   - OG 이미지 URLs
   - Farcaster frame target URLs

5. **`app/marketplace/[id]/layout.tsx`** ✅
   - baseUrl: `https://getclayed.io`
   - OG 이미지 URLs
   - Farcaster frame target URLs

### 📢 알림 시스템

6. **`lib/farcasterNotifications.ts`** ✅
   - 모든 targetUrl을 `getclayed.io`로 업데이트
   - notifyRoyaltyPayment
   - notifyProjectLike
   - broadcastAnnouncement
   - notifyNewComment
   - notifyProjectFeatured

7. **`app/api/farcaster/notify/route.ts`** ✅
   - 예시 URL 업데이트

### 🎨 UI/브랜딩

8. **`app/api/og/route.tsx`** ✅
   - OG 이미지 하단 텍스트: `getclayed.io`

9. **`lib/farcasterMetadata.ts`** ✅
   - DEFAULT_APP_URL: `https://getclayed.io`
   - DEFAULT_APP_IMAGE: `https://getclayed.io/clay.png`

## 검증 결과

### ✅ 빌드 성공
```bash
npm run build
# ✓ Compiled successfully
```

### ✅ 코드에서 구 URL 제거 확인
```bash
grep -r "getclayed.vercel.app" app/ lib/ components/ public/
# 결과: 0개
```

## 🚨 추가 작업 필요

### 1. Farcaster Account Association 재생성

**왜 필요한가?**
- 도메인이 변경되었으므로 새로운 서명이 필요
- 없으면 Farcaster에서 도메인 소유권을 인증할 수 없음

**어떻게?**
- Warpcast Developer Console: https://warpcast.com/~/developers
- GetClayed 앱 설정에서 도메인을 `getclayed.io`로 변경
- 자동 생성된 `accountAssociation`을 복사해서 `farcaster.json`에 붙여넣기

**또는:**
- 임시로 accountAssociation 없이 사용 (현재 상태)
- 대부분의 기능은 작동하지만 공식 인증은 안됨

### 2. 도메인 DNS 설정 확인

- `getclayed.io`가 Vercel에 제대로 연결되어 있는지 확인
- SSL 인증서 발급 확인
- `www.getclayed.io` 리다이렉트 설정

### 3. Vercel 프로젝트 설정

Vercel 대시보드에서:
- Production Domain을 `getclayed.io`로 설정
- `getclayed.vercel.app`은 자동 리다이렉트 설정

## 테스트 체크리스트

### 기본 기능
- [ ] `https://getclayed.io` 접속 확인
- [ ] `https://getclayed.io/.well-known/farcaster.json` 접근 확인
- [ ] SSL 인증서 확인 (🔒 표시)

### Farcaster 통합
- [ ] Farcaster Embed Tool: https://warpcast.com/~/developers/embeds
  - URL 입력: `https://getclayed.io`
  - Embed Valid 확인
- [ ] Warpcast에서 링크 공유 테스트
  - `https://getclayed.io`
  - `https://getclayed.io/project/{id}`
  - `https://getclayed.io/library/{id}`
  - `https://getclayed.io/marketplace/{id}`

### 메타데이터
```bash
# 메타 태그 확인
curl https://getclayed.io | grep "fc:frame"
curl https://getclayed.io | grep "og:image"

# Farcaster 설정 확인
curl https://getclayed.io/.well-known/farcaster.json
```

### 알림 시스템
```bash
# 알림 API 테스트
curl -X POST https://getclayed.io/api/farcaster/notify \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "body": "Testing new domain",
    "targetUrl": "https://getclayed.io",
    "notificationId": "test-domain-change"
  }'
```

## 배포 준비

모든 코드 변경이 완료되었습니다. 배포하세요:

```bash
git add .
git commit -m "Migrate all URLs from getclayed.vercel.app to getclayed.io"
git push
```

## 변경 요약

| 항목 | 이전 | 이후 | 상태 |
|-----|-----|-----|------|
| 도메인 | getclayed.vercel.app | getclayed.io | ✅ |
| 메인 메타데이터 | ✗ | ✅ | 완료 |
| 프로젝트 페이지 | ✗ | ✅ | 완료 |
| 라이브러리 페이지 | ✗ | ✅ | 완료 |
| 마켓플레이스 페이지 | ✗ | ✅ | 완료 |
| 알림 URLs | ✗ | ✅ | 완료 |
| Farcaster 설정 | ✗ | ✅ | 완료 |
| Account Association | ✗ | ⚠️ | 재생성 필요 |
| 빌드 | ✗ | ✅ | 성공 |

---

**모든 URL이 `getclayed.io`로 변경 완료!** 🎉

다음 단계: Farcaster Developer Console에서 account association 재생성 후 배포

