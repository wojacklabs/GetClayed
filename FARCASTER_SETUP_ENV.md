# Farcaster 환경 변수 설정

## ⚠️ 환경 변수 필요 없음!

현재 구현은 **검증 없이 작동**하도록 되어 있어서 별도의 환경 변수가 필요 없습니다.

바로 사용하시면 됩니다!

---

## (선택사항) Webhook 검증 추가하기

보안이 중요한 프로덕션 환경이라면 Neynar를 통한 검증을 추가할 수 있습니다:

```bash
# Neynar API Key (webhook verification용 - 선택사항)
NEYNAR_API_KEY=your_neynar_api_key_here
```

### Neynar API Key 발급 (선택사항)

1. [Neynar](https://neynar.com/) 방문
2. 계정 생성 또는 로그인
3. Dashboard → API Keys
4. "Create API Key" 클릭
5. Free tier 선택 (webhook verification에 충분)
6. API Key 복사

### Vercel 환경 변수 설정 (선택사항)

검증을 추가하려면:

1. Vercel Dashboard 열기
2. 프로젝트 선택 (getclayed)
3. Settings → Environment Variables
4. 다음 추가:
   - **Name**: `NEYNAR_API_KEY`
   - **Value**: 발급받은 API key
   - **Environment**: Production, Preview, Development 모두 선택
5. Save

### 로컬 개발 환경 설정 (선택사항)

검증을 추가하려면 `.env.local` 파일에 추가:

```bash
# Farcaster Notifications (선택사항)
NEYNAR_API_KEY=your_neynar_api_key_here

# 기존 환경 변수들
NEXT_PUBLIC_PRIVY_APP_ID=...
# ... 기타 환경 변수
```

## 테스트

환경 변수 없이 바로 테스트 가능합니다:

```bash
# 로컬 개발 서버 시작
npm run dev

# Webhook 테스트 (서버 실행 후)
curl -X POST http://localhost:3000/api/farcaster/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "miniapp_added",
    "fid": 123456,
    "notificationDetails": {
      "url": "https://api.farcaster.xyz/v1/frame-notifications",
      "token": "test-token-123"
    }
  }'
```

정상 작동하면 `{"success": true}` 응답을 받습니다.

## 선택사항: 데이터베이스 환경 변수

프로덕션에서 notification token을 영구 저장하려면:

### Vercel KV (Redis)

```bash
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

Vercel Dashboard에서 자동으로 추가됩니다 (Storage → Create → KV)

### PostgreSQL / Supabase

```bash
DATABASE_URL=postgresql://...
# 또는
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## 보안 주의사항

⚠️ **절대로** API key를 코드에 하드코딩하거나 git에 커밋하지 마세요!

- ✅ `.env.local` 사용 (로컬)
- ✅ Vercel Environment Variables 사용 (프로덕션)
- ❌ `.env` 파일을 git에 추가
- ❌ 코드에 직접 API key 작성

