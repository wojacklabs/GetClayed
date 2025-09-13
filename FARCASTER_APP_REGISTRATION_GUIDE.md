# Farcaster Mini App 등록 가이드 (호스팅된 매니페스트 사용)

## 개요

이 가이드는 Warpcast Developer Portal을 통해 GetClayed를 공식 Farcaster Mini App으로 등록하는 방법을 안내합니다.

## ✅ 사전 준비 완료

1. ✅ `farcaster.json` 파일에서 `accountAssociation` 제거됨
2. ✅ 동적 OG 이미지 (`/api/og`) 적용됨
3. ✅ Farcaster SDK 통합 완료
4. ✅ 메타 태그 설정 완료

## 📱 Step 1: Warpcast 앱 설치 및 계정 준비

### 필요한 것
- **Warpcast 앱** (iOS/Android)
- **Farcaster 계정** (없으면 먼저 가입)
- **컴퓨터 접근** (일부 설정은 웹에서만 가능)

### Farcaster 계정 확인
1. Warpcast 앱 열기
2. 프로필 → Settings
3. 본인의 **FID (Farcaster ID)** 확인 (예: @yourusername)

## 🔧 Step 2: Developer 설정 활성화

### Warpcast 앱에서

1. **Settings** (⚙️) 열기
2. **Advanced** 또는 **Developer** 섹션 찾기
   - 없다면 아래 방법 시도

### Warpcast 웹에서 (warpcast.com)

1. **https://warpcast.com** 접속
2. 로그인
3. 프로필 메뉴 → **Settings**
4. **Developer** 또는 **Apps** 탭 찾기

> **참고**: Developer 메뉴가 보이지 않으면 Farcaster 계정이 활성화되어야 할 수 있습니다. 최소 1개 이상의 캐스트를 올리고 일정 활동을 해야 접근 가능할 수 있습니다.

## 🚀 Step 3: Mini App 등록

### 방법 1: Warpcast Developer Portal (권장)

1. **Developer Portal 접속**
   ```
   https://warpcast.com/~/developers
   ```
   또는
   ```
   Warpcast 앱 → Settings → Developer
   ```

2. **"Create App" 또는 "New Mini App" 클릭**

3. **앱 정보 입력:**

   **기본 정보:**
   - **App Name**: `GetClayed`
   - **App Type**: `Mini App` 또는 `Frame App` 선택
   - **Developer Name**: (당신의 이름 또는 팀명)

   **URL 정보:**
   - **Home URL**: `https://getclayed.vercel.app`
   - **Icon URL**: `https://getclayed.vercel.app/clay.png`
   - **Manifest URL**: `https://getclayed.vercel.app/.well-known/farcaster.json`

   **설명:**
   - **Short Description**: `3D Clay Sculpting Platform`
   - **Full Description**: 
     ```
     Create and sculpt 3D clay objects in your browser. 
     A Web3 3D creation platform with blockchain integration.
     Build, share, and trade your 3D creations on-chain.
     ```

   **스플래시 스크린 (선택사항):**
   - **Splash Image URL**: `https://getclayed.vercel.app/api/og`
   - **Splash Background Color**: `#3b82f6`

4. **카테고리 선택:**
   - Art & Design
   - Creator Tools
   - Web3 / NFT

5. **Save/Submit** 클릭

### 방법 2: 매니페스트 URL 직접 제출

Warpcast에서 매니페스트를 자동으로 읽어오도록 설정:

1. **Developer Portal에서 "Import from Manifest" 선택**
2. **Manifest URL 입력:**
   ```
   https://getclayed.vercel.app/.well-known/farcaster.json
   ```
3. **Verify** 클릭
4. 자동으로 정보가 채워짐
5. **Submit** 클릭

## ✨ Step 4: 앱 ID 확인 및 설정

### 등록 완료 후

Warpcast에서 제공하는 정보:
- **App ID**: 고유 식별자 (예: `getclayed` 또는 UUID)
- **Manifest URL**: Farcaster가 호스팅하는 매니페스트 URL
  ```
  https://manifest.farcaster.xyz/v1/YOUR_APP_ID
  ```

### 호스팅된 매니페스트 사용 (선택사항)

Farcaster의 호스팅된 매니페스트를 사용하려면 리다이렉트 설정:

**vercel.json에 추가:**
```json
{
  "redirects": [
    {
      "source": "/.well-known/farcaster.json",
      "destination": "https://manifest.farcaster.xyz/v1/YOUR_APP_ID",
      "permanent": false
    }
  ]
}
```

> **참고**: 현재는 자체 호스팅 매니페스트를 사용하므로 이 단계는 선택사항입니다.

## 🔍 Step 5: 앱 확인 및 테스트

### 1. 매니페스트 확인
```bash
# 브라우저에서 확인
https://getclayed.vercel.app/.well-known/farcaster.json

# 또는 curl로 확인
curl https://getclayed.vercel.app/.well-known/farcaster.json
```

### 2. Warpcast에서 테스트

**테스트 방법 A: 직접 URL 공유**
1. Warpcast에서 새 캐스트 작성
2. URL 입력: `https://getclayed.vercel.app`
3. Mini App 카드가 표시되는지 확인
4. "Launch GetClayed" 버튼 확인

**테스트 방법 B: Developer Portal에서 테스트**
1. Developer Portal → Your Apps
2. GetClayed 선택
3. "Test App" 또는 "Preview" 클릭
4. Mini App이 정상 작동하는지 확인

### 3. 지갑 연결 테스트

Farcaster 환경에서:
1. 앱 실행
2. 자동으로 Farcaster 지갑 연결되는지 확인
3. 우측 상단에 "🟣 Farcaster" 배지 표시되는지 확인
4. 트랜잭션 테스트 (3D 객체 생성 등)

## 📊 Step 6: 앱 발견성 향상

### Discovery 설정

앱이 Farcaster 디렉토리에 나타나도록:

1. **Developer Portal → Your Apps → GetClayed**
2. **"Submit for Review"** 클릭
3. **Review 체크리스트:**
   - ✅ 앱이 정상 작동함
   - ✅ 매니페스트 파일이 올바름
   - ✅ 아이콘/이미지가 적절함
   - ✅ 설명이 명확함
   - ✅ 카테고리가 정확함

4. **제출 후 대기:**
   - 승인까지 1-3일 소요
   - 이메일로 결과 통보

### 승인 후

✅ **Warpcast 앱 디렉토리에 표시**
✅ **검색 가능**
✅ **추천 앱 목록에 포함 가능**
✅ **다른 사용자가 발견 가능**

## 🎯 Step 7: 앱 프로모션

### 초기 사용자 확보

1. **본인의 Farcaster에서 공유:**
   ```
   🎨 Introducing GetClayed! 
   
   Create and sculpt 3D clay objects right in your browser.
   Built with Web3 - your creations are truly yours.
   
   Try it now: https://getclayed.vercel.app
   ```

2. **관련 채널에 공유:**
   - /creative
   - /web3
   - /nft
   - /builders

3. **데모 작품 공유:**
   - 멋진 3D 작품 만들기
   - 스크린샷/동영상과 함께 공유
   - 다른 사용자들이 시도해보도록 유도

## 📈 Step 8: 분석 및 모니터링

### Warpcast Analytics

Developer Portal에서 확인 가능:
- **앱 실행 횟수**
- **고유 사용자 수**
- **공유 횟수**
- **사용자 참여도**

### 자체 분석

앱 내에서 추적:
```typescript
// Farcaster 환경에서 온 사용자 추적
const { isInFarcaster } = useFarcasterWallet();

if (isInFarcaster) {
  // 분석 이벤트 기록
  analytics.track('farcaster_user_visit');
}
```

## 🔧 문제 해결

### 일반적인 문제

**Q: "App not found" 에러**
- A: 매니페스트 URL 확인
- A: CORS 헤더 확인 (vercel.json)
- A: 앱 ID가 올바른지 확인

**Q: 아이콘이 표시되지 않음**
- A: 이미지 URL이 HTTPS인지 확인
- A: 이미지 크기가 적절한지 확인 (최소 256x256)
- A: 이미지가 공개 접근 가능한지 확인

**Q: "Launch" 버튼이 작동하지 않음**
- A: `homeUrl`이 올바른지 확인
- A: 앱이 실제로 배포되었는지 확인
- A: HTTPS 사용 확인

**Q: Developer 메뉴가 보이지 않음**
- A: Farcaster 계정 활성화 필요
- A: 최소 1개 이상의 캐스트 작성
- A: 일정 시간 대기 (신규 계정의 경우)

## 📞 지원

### 공식 지원
- **Farcaster Docs**: https://docs.farcaster.xyz
- **Warpcast Support**: support@warpcast.com
- **Discord**: https://discord.gg/farcaster

### 커뮤니티
- Farcaster 채널: /dev
- Warpcast 질문: /help

## ✅ 체크리스트

등록 전 최종 확인:

- [ ] Farcaster 계정 준비됨
- [ ] 앱이 https://getclayed.vercel.app 에 배포됨
- [ ] `/.well-known/farcaster.json` 접근 가능
- [ ] 아이콘 이미지 준비됨 (`/clay.png`)
- [ ] OG 이미지 작동 확인 (`/api/og`)
- [ ] Farcaster SDK 통합 완료
- [ ] 지갑 연결 테스트 완료
- [ ] Developer Portal 접근 가능
- [ ] 앱 설명 작성 완료

등록 후 확인:

- [ ] 앱 ID 받음
- [ ] 테스트 실행 성공
- [ ] URL 공유 시 Mini App 카드 표시
- [ ] "Launch" 버튼 작동
- [ ] Farcaster 지갑 자동 연결
- [ ] Review 제출 완료

## 🎉 다음 단계

등록 완료 후:

1. **사용자 피드백 수집**
   - 초기 사용자 의견 청취
   - 개선사항 파악

2. **기능 개선**
   - Farcaster 알림 추가
   - Share Extension 구현
   - Universal Links 설정

3. **커뮤니티 구축**
   - 정기적인 업데이트 공유
   - 사용자 작품 피처링
   - 튜토리얼 제공

4. **마케팅**
   - Farcaster 채널 활용
   - 크리에이터 협업
   - 이벤트/콘테스트 개최

---

**준비 완료!** 🚀

이제 Warpcast Developer Portal에서 앱을 등록하면 됩니다. 질문이나 문제가 있으면 언제든 도움을 요청하세요!

**작성일**: 2025-11-16  
**상태**: ✅ 등록 준비 완료

