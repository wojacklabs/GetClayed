# 🚨 중요: Farcaster Account Association 재생성 필요

## 배경
도메인이 `getclayed.vercel.app`에서 `getclayed.io`로 변경되었습니다.

## 필수 작업: Account Association 재생성

`public/.well-known/farcaster.json` 파일의 `accountAssociation` 섹션은 **도메인 소유권 증명**입니다.
현재 파일에는 임시로 `"payload": "eyJkb21haW4iOiJnZXRjbGF5ZWQuaW8ifQ=="`를 입력했지만, **새로운 서명(signature)이 필요**합니다.

## 해결 방법

### 옵션 1: Warpcast Developer Console 사용 (권장)

1. **Warpcast Developer Console 접속**
   ```
   https://warpcast.com/~/developers
   ```

2. **앱 찾기 또는 재등록**
   - 기존 GetClayed 앱을 찾거나
   - 새로운 도메인(`getclayed.io`)으로 재등록

3. **Account Association 생성**
   - Developer Console에서 자동으로 생성해줌
   - `header`, `payload`, `signature` 복사

4. **farcaster.json 업데이트**
   ```json
   {
     "accountAssociation": {
       "header": "GENERATED_HEADER",
       "payload": "GENERATED_PAYLOAD",
       "signature": "GENERATED_SIGNATURE"
     },
     ...
   }
   ```

### 옵션 2: 수동 생성 (복잡함)

필요한 것:
- FID: 1430924 (이미 있음)
- 지갑 개인키 (`0xC2CEf109Eb91BFD7331aDECF2AA9b20384d85ceD`)
- 새 도메인: `getclayed.io`

1. payload 생성:
   ```javascript
   const payload = {
     domain: "getclayed.io"
   };
   const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
   ```

2. header는 기존 것 유지 가능 (FID가 같으면)

3. signature 생성:
   - payload를 지갑 개인키로 서명
   - EIP-191 또는 EIP-712 표준 사용

## 현재 상태

✅ 다음 URL들이 모두 `getclayed.io`로 업데이트됨:
- `/app/layout.tsx` - 메인 메타데이터
- `/app/project/[id]/layout.tsx` - 프로젝트 메타데이터
- `/app/library/[id]/layout.tsx` - 라이브러리 메타데이터
- `/app/marketplace/[id]/layout.tsx` - 마켓플레이스 메타데이터
- `/lib/farcasterNotifications.ts` - 알림 URL들
- `/app/api/farcaster/notify/route.ts` - 알림 API 예시
- `/app/api/og/route.tsx` - OG 이미지 텍스트
- `/public/.well-known/farcaster.json` - Farcaster 설정 (서명 제외)

⚠️ 아직 필요한 작업:
- `public/.well-known/farcaster.json`의 `accountAssociation.signature` 재생성

## 임시 해결책

서명이 없어도 대부분의 기능은 작동하지만, Farcaster에서 공식적으로 도메인 소유권을 인증받으려면 올바른 서명이 필요합니다.

임시로 `accountAssociation` 전체를 제거하고 miniapp/frame만 사용할 수도 있습니다:

```json
{
  "miniapp": { ... },
  "frame": { ... }
}
```

## 다음 단계

1. **Warpcast Developer Console에서 재생성** (가장 빠르고 안전)
2. 또는 accountAssociation 제거하고 테스트
3. 배포 후 Farcaster Embed Tool로 검증

---

**긴급도: 높음**  
Account association 없이도 작동하지만, 공식 인증을 위해 빠른 시일 내에 재생성 필요.

