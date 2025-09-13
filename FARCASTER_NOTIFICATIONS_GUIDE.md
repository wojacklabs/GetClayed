# Farcaster Notifications 통합 가이드

## 개요

GetClayed에 Farcaster Mini App 알림 시스템이 완전히 통합되었습니다. 사용자가 Mini App을 추가하고 알림을 활성화하면, 앱에서 중요한 이벤트에 대한 알림을 보낼 수 있습니다.

## 구현된 기능

### ✅ 1. Webhook 엔드포인트
- **경로**: `/api/farcaster/webhook`
- **기능**: Farcaster 클라이언트로부터 이벤트를 수신하고 처리
- **지원 이벤트**:
  - `miniapp_added`: 사용자가 앱을 추가했을 때
  - `miniapp_removed`: 사용자가 앱을 제거했을 때
  - `notifications_enabled`: 알림을 활성화했을 때
  - `notifications_disabled`: 알림을 비활성화했을 때

### ✅ 2. Notification 전송 API
- **경로**: `/api/farcaster/notify`
- **기능**: 사용자에게 알림 전송
- **지원 기능**:
  - 특정 사용자에게 알림 전송 (FID 기준)
  - 모든 사용자에게 브로드캐스트
  - 자동 배칭 (최대 100개씩)
  - Rate limit 처리
  - Invalid token 자동 감지 및 제거

### ✅ 3. Helper 함수
**파일**: `lib/farcasterNotifications.ts`

편리한 헬퍼 함수들:
- `sendFarcasterNotification()` - 일반 알림
- `notifyRoyaltyPayment()` - 로열티 지급 알림
- `notifyProjectLike()` - 좋아요 알림
- `notifyNewComment()` - 댓글 알림
- `notifyProjectFeatured()` - 프로젝트 피처링 알림
- `broadcastAnnouncement()` - 전체 공지

## 사용 방법

### 1. 로열티 지급 알림

```typescript
import { notifyRoyaltyPayment } from '@/lib/farcasterNotifications';

// 로열티가 지급되었을 때
const result = await notifyRoyaltyPayment(
  userFid,           // 사용자의 Farcaster ID
  '0.05',            // 금액
  'project-abc-123'  // 프로젝트 ID
);

if (result.success) {
  console.log('Notification sent!');
} else {
  console.error('Failed:', result.error);
}
```

### 2. 프로젝트 좋아요 알림

```typescript
import { notifyProjectLike } from '@/lib/farcasterNotifications';

// 누군가 프로젝트에 좋아요를 눌렀을 때
await notifyProjectLike(
  creatorFid,        // 작성자 FID
  projectId,         // 프로젝트 ID
  likerName          // 좋아요를 누른 사람 이름 (optional)
);
```

### 3. 전체 공지

```typescript
import { broadcastAnnouncement } from '@/lib/farcasterNotifications';

// 모든 사용자에게 공지
await broadcastAnnouncement(
  '🎉 New Feature',
  'Check out our new 3D sculpting tools!',
  'https://getclayed.vercel.app/features'
);
```

### 4. 커스텀 알림

```typescript
import { sendFarcasterNotification } from '@/lib/farcasterNotifications';

await sendFarcasterNotification({
  fid: 123456,                    // optional: 특정 사용자
  title: 'Custom Title',          // max 32 chars
  body: 'Custom message',         // max 128 chars
  targetUrl: 'https://...',       // max 1024 chars
  notificationId: 'unique-id',    // max 128 chars
});
```

## 통합 예시

### 로열티 시스템과 통합

기존 로열티 지급 로직에 Farcaster 알림을 추가:

```typescript
// 예: 로열티 claim 성공 후
async function handleRoyaltyClaim(walletAddress: string, amount: string, projectId: string) {
  try {
    // 1. 기존 로열티 claim 처리
    await claimRoyalty(walletAddress, amount);
    
    // 2. Farcaster FID 조회 (wallet address -> FID 매핑 필요)
    const fid = await getFarcasterFidFromWallet(walletAddress);
    
    if (fid) {
      // 3. Farcaster 알림 전송
      await notifyRoyaltyPayment(fid, amount, projectId);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### 좋아요 시스템과 통합

```typescript
async function handleProjectLike(projectId: string, likerWallet: string, creatorWallet: string) {
  try {
    // 1. 좋아요 저장
    await saveLike(projectId, likerWallet);
    
    // 2. 작성자 FID 조회
    const creatorFid = await getFarcasterFidFromWallet(creatorWallet);
    const likerName = await getUserName(likerWallet);
    
    if (creatorFid) {
      // 3. 알림 전송
      await notifyProjectLike(creatorFid, projectId, likerName);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Rate Limits (Warpcast 기준)

- **1개 알림 / 30초** per token
- **100개 알림 / 일** per token

## 데이터 저장

현재는 **메모리 기반** 저장소를 사용합니다 (서버 재시작 시 데이터 손실).

### 프로덕션 환경 권장사항

프로덕션에서는 영구 저장소 사용을 권장합니다:

#### Option 1: Vercel KV (Redis)

```typescript
// lib/notificationStorage.ts
import { kv } from '@vercel/kv';

export async function saveNotificationToken(fid: number, token: string, url: string) {
  await kv.set(`farcaster:token:${fid}`, { token, url, addedAt: new Date() });
}

export async function getNotificationToken(fid: number) {
  return await kv.get(`farcaster:token:${fid}`);
}

export async function removeNotificationToken(fid: number) {
  await kv.del(`farcaster:token:${fid}`);
}
```

#### Option 2: PostgreSQL

```sql
CREATE TABLE farcaster_notification_tokens (
  fid BIGINT PRIMARY KEY,
  url TEXT NOT NULL,
  token TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Option 3: Supabase

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export async function saveNotificationToken(fid: number, token: string, url: string) {
  await supabase
    .from('notification_tokens')
    .upsert({ fid, token, url });
}
```

## Wallet Address ↔ Farcaster FID 매핑

Farcaster 알림을 보내려면 사용자의 FID가 필요합니다. 다음 방법으로 매핑할 수 있습니다:

### 1. Farcaster SDK 사용

```typescript
import sdk from '@farcaster/frame-sdk';

// Mini App 내에서 사용자 정보 가져오기
const context = await sdk.context;
const fid = context.user?.fid;
const walletAddress = context.user?.custodyAddress;

// 매핑 저장
await saveUserMapping(walletAddress, fid);
```

### 2. Neynar API 사용

```typescript
async function getFidFromAddress(address: string): Promise<number | null> {
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/by_verification?address=${address}`,
    {
      headers: {
        'api_key': process.env.NEYNAR_API_KEY!,
      },
    }
  );
  
  if (response.ok) {
    const data = await response.json();
    return data.user?.fid || null;
  }
  
  return null;
}
```

## 테스트

### 로컬 테스트

```bash
# Webhook 테스트
curl -X POST http://localhost:3000/api/farcaster/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "miniapp_added",
    "untrustedData": { "fid": 123456 },
    "notificationDetails": {
      "url": "https://api.farcaster.xyz/v1/frame-notifications",
      "token": "test-token-123"
    }
  }'

# 알림 전송 테스트
curl -X POST http://localhost:3000/api/farcaster/notify \
  -H "Content-Type: application/json" \
  -d '{
    "fid": 123456,
    "title": "Test 🎨",
    "body": "This is a test notification",
    "targetUrl": "https://getclayed.vercel.app",
    "notificationId": "test-123"
  }'
```

### 프로덕션 테스트

1. Warpcast 앱에서 GetClayed Mini App 추가
2. 알림 권한 허용
3. 위 API를 통해 알림 전송
4. Warpcast에서 알림 확인

## 모니터링

Webhook 이벤트와 알림 전송을 모니터링하려면:

```typescript
// Vercel Functions 로그 확인
// https://vercel.com/{your-project}/logs

// 또는 로컬에서:
console.log('[Webhook] Received event:', event);
console.log('[Notify] Sent to', successfulTokens.length, 'users');
```

## Next Steps

1. **Wallet ↔ FID 매핑 구현**
   - 사용자가 Mini App을 사용할 때 매핑 저장
   - Neynar API를 통한 역조회

2. **영구 저장소 설정**
   - Vercel KV 또는 PostgreSQL 연결
   - 현재 메모리 기반 저장소를 교체

3. **알림 통합**
   - 로열티 지급 시 자동 알림
   - 프로젝트 interaction 시 알림
   - 새 기능 출시 시 브로드캐스트

4. **Analytics**
   - 알림 전송 성공률 추적
   - 사용자 engagement 측정

## 참고 자료

- [Farcaster Mini App Docs](https://docs.farcaster.xyz/developers/guides/apps/notifications)
- [Notification Spec](https://docs.farcaster.xyz/developers/guides/apps/notifications#notifications-spec)
- [@farcaster/miniapp-node](https://www.npmjs.com/package/@farcaster/miniapp-node)

