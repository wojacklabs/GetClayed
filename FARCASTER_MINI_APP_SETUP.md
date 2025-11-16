# Farcaster Mini App 온보딩 완료

## 개요

GetClayed를 Farcaster Mini App으로 성공적으로 통합했습니다. 이제 Farcaster 생태계에서 앱을 실행하고 공유할 수 있습니다.

## 완료된 작업

### 1. Farcaster SDK 설치 및 설정 ✅
- `@farcaster/frame-sdk` 패키지 설치 완료
- SDK 버전: 0.1.12

### 2. SDK Provider 구성 ✅
- `FarcasterProvider` 컴포넌트 생성 (`components/FarcasterProvider.tsx`)
- 앱 초기화 시 `sdk.actions.ready()` 호출하여 스플래시 스크린 제거
- Root Layout에 Provider 추가

### 3. 메타 태그 추가 ✅
- Farcaster 공유를 위한 `fc:miniapp` 메타 태그 추가
- Open Graph 및 Twitter Card 메타데이터 구성
- 유틸리티 함수 생성 (`lib/farcasterMetadata.ts`)

### 4. Farcaster.json 매니페스트 파일 ✅
- 위치: `public/.well-known/farcaster.json`
- 앱 정보, 아이콘, 설명 포함
- Mini App 및 Frame 메타데이터 정의

### 5. Wallet Provider 통합 ✅
- Farcaster Ethereum Provider 통합
- `useFarcasterWallet` 훅 생성 (`hooks/useFarcasterWallet.ts`)
- ConnectWallet 컴포넌트에 Farcaster 지갑 우선 지원 추가
- Farcaster 환경에서는 자동으로 Farcaster 지갑 사용

### 6. Vercel 설정 업데이트 ✅
- `.well-known/farcaster.json` 경로에 대한 CORS 헤더 설정
- Content-Type 및 Access-Control-Allow-Origin 헤더 추가

## 주요 파일

### 새로 생성된 파일
1. `components/FarcasterProvider.tsx` - Farcaster SDK 초기화 및 관리
2. `hooks/useFarcasterWallet.ts` - Farcaster 지갑 연동 훅
3. `lib/farcasterMetadata.ts` - 메타데이터 생성 유틸리티
4. `public/.well-known/farcaster.json` - Farcaster 매니페스트 파일

### 수정된 파일
1. `app/layout.tsx` - FarcasterProvider 추가, 메타 태그 업데이트
2. `components/ConnectWallet.tsx` - Farcaster 지갑 통합
3. `vercel.json` - .well-known 경로 설정
4. `package.json` - @farcaster/frame-sdk 의존성 추가

## 기능 설명

### 1. SDK 초기화
앱이 로드되면 FarcasterProvider가 SDK를 초기화하고 `ready()` 함수를 호출합니다. 이를 통해:
- Farcaster 스플래시 스크린이 숨겨짐
- 앱이 사용 준비 완료 상태가 됨

### 2. 지갑 통합
- Farcaster 환경에서 실행 시 자동으로 Farcaster 지갑 사용
- 일반 웹 환경에서는 Privy 지갑 사용
- 우선순위: Farcaster Wallet > Privy Wallet

### 3. 소셜 공유
- Farcaster 피드에서 앱 공유 시 특별한 임베드 카드 표시
- "Launch GetClayed" 버튼으로 직접 앱 실행 가능
- 이미지, 제목, 설명이 포함된 rich preview

## 사용 방법

### 개발 환경
```bash
npm run dev
```

앱은 일반 브라우저와 Farcaster 환경 모두에서 작동합니다.

### Farcaster에서 테스트
1. Farcaster 클라이언트 (Warpcast 등) 에서 앱 열기
2. URL: `https://getclayed.vercel.app`
3. Farcaster 지갑이 자동으로 연결됨
4. 우측 상단에 "🟣 Farcaster" 배지 표시

### 앱 공유
1. Farcaster에서 앱 URL 공유
2. 자동으로 Mini App 임베드 카드 생성
3. 사용자가 "Launch GetClayed" 버튼 클릭 시 앱 실행

## 매니페스트 파일 구조

```json
{
  "miniApp": {
    "name": "GetClayed",
    "iconUrl": "https://getclayed.vercel.app/clay.png",
    "homeUrl": "https://getclayed.vercel.app",
    "description": "Create and sculpt 3D clay objects in your browser. A Web3 3D creation platform with blockchain integration.",
    "splashImageUrl": "https://getclayed.vercel.app/clay.png",
    "splashBackgroundColor": "#3b82f6",
    "version": "0.1.2"
  },
  "frame": {
    "version": "1",
    "name": "GetClayed",
    "iconUrl": "https://getclayed.vercel.app/clay.png",
    "homeUrl": "https://getclayed.vercel.app",
    "imageUrl": "https://getclayed.vercel.app/clay.png",
    "button": {
      "title": "Launch GetClayed",
      "action": {
        "type": "launch_miniapp"
      }
    }
  }
}
```

## 다음 단계

### 추천 개선 사항
1. **알림 기능 추가**: Farcaster 알림 API를 사용하여 사용자에게 업데이트 전송
2. **Share Extension**: 다른 앱에서 콘텐츠 공유받기
3. **Universal Links**: 특정 URL 패턴을 앱 내에서 처리
4. **인증 강화**: Farcaster Quick Auth 활용

### 발견성 향상
앱이 Farcaster 디렉토리에 나타나려면:
- ✅ 매니페스트 파일에 필수 필드 포함
- ✅ 프로덕션 도메인에서 호스팅
- 최소한의 사용자 참여 확보
- 최근 활동 유지

## 디버깅

### SDK 컨텍스트 확인
브라우저 콘솔에서:
```javascript
// Farcaster 환경인지 확인
console.log(await sdk.context)
```

### 지갑 연결 확인
```javascript
// 현재 연결된 주소 확인
const provider = sdk.wallet.ethProvider
const accounts = await provider.request({ method: 'eth_requestAccounts' })
console.log(accounts)
```

### 메타 태그 확인
페이지 소스 보기에서 `<meta name="fc:miniapp">` 태그 확인

## 참고 자료

- [Farcaster Mini App 공식 문서](https://miniapps.farcaster.xyz/docs)
- [SDK GitHub](https://github.com/farcasterxyz/frame-sdk)
- [Farcaster 개발자 가이드](https://docs.farcaster.xyz)

## 문제 해결

### 일반적인 문제

**Q: Farcaster에서 지갑이 연결되지 않음**
A: `useFarcasterWallet` 훅이 올바르게 작동하는지 확인하고, 콘솔에서 에러 메시지 확인

**Q: 메타 태그가 제대로 표시되지 않음**
A: 페이지 캐시를 지우고 다시 시도. Farcaster 클라이언트가 메타 태그를 캐시할 수 있음

**Q: /.well-known/farcaster.json 접근 불가**
A: Vercel 배포 후 헤더 설정이 적용되었는지 확인

## 지원

문제가 발생하면:
1. 브라우저 콘솔에서 에러 확인
2. Farcaster SDK 문서 참조
3. GitHub Issues에 문의

---

**상태**: ✅ 프로덕션 준비 완료
**마지막 업데이트**: 2025-11-16

