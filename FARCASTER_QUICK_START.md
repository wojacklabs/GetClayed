# 🚀 Farcaster Mini App 빠른 시작

## ✅ 이미 완료됨!

모든 설정이 완료되었습니다. **환경 변수 필요 없이 바로 배포하면 됩니다!**

## 3가지 핵심 기능

### 1. 로딩 ✅
- 스플래시 스크린 자동 관리
- 제스처 충돌 방지

### 2. 공유 ✅
- Warpcast에서 URL 공유하면 Rich Embed 표시
- "🎨 Launch GetClayed" 버튼으로 바로 실행

### 3. 알림 ✅
- 로열티 지급 알림
- 좋아요, 댓글 알림
- 전체 공지 기능

## 사용 예시

```typescript
import { 
  notifyRoyaltyPayment,
  notifyProjectLike,
  broadcastAnnouncement 
} from '@/lib/farcasterNotifications';

// 로열티 지급 시
await notifyRoyaltyPayment(userFid, '0.05 ETH', projectId);

// 좋아요 시
await notifyProjectLike(creatorFid, projectId, likerName);

// 전체 공지
await broadcastAnnouncement('🎉 New Feature', 'Check it out!');
```

## 테스트하기

### 1. 공유 테스트
1. Warpcast 앱 열기
2. 새 캐스트 작성
3. `https://getclayed.vercel.app` 입력
4. Rich embed 카드 확인 ✨

### 2. 앱 실행 테스트
1. Embed 카드에서 "🎨 Launch GetClayed" 클릭
2. 스플래시 스크린 표시
3. 앱 로드 완료 후 자동 숨김

### 3. 알림 테스트
1. Mini App 추가
2. 알림 권한 허용
3. API로 테스트:

```bash
curl -X POST https://getclayed.vercel.app/api/farcaster/notify \
  -H "Content-Type: application/json" \
  -d '{
    "fid": 123456,
    "title": "Test 🎨",
    "body": "This is a test!",
    "targetUrl": "https://getclayed.vercel.app",
    "notificationId": "test-123"
  }'
```

## 상세 문서

- **전체 가이드**: `FARCASTER_COMPLETE_INTEGRATION.md`
- **알림 사용법**: `FARCASTER_NOTIFICATIONS_GUIDE.md`
- **환경 설정**: `FARCASTER_SETUP_ENV.md` (선택사항)

## 바로 배포하세요! 🎉

```bash
git add .
git commit -m "Add Farcaster Mini App integration"
git push
```

Vercel이 자동으로 배포하고, 모든 기능이 바로 작동합니다!

