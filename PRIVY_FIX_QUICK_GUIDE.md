# Privy CORS 에러 빠른 해결 가이드

## 🚨 현재 문제
- Privy CORS 에러: `Access to fetch at 'https://auth.privy.io/api/v1/apps/...' has been blocked`
- 지갑 연결이 제대로 작동하지 않음

## ✅ 해결 완료된 항목
- [x] 코드에서 환경 변수 사용하도록 수정
- [x] `.env` 및 `.env.local` 파일에 Privy App ID 추가
- [x] Privy 설정에 추가 옵션 추가 (loginMethods, embeddedWallets)

## 🔧 **지금 바로 해야 할 작업**

### 1단계: Privy Dashboard 설정 ⭐ **가장 중요!**

1. https://dashboard.privy.io/ 접속 및 로그인
2. 앱 선택 (App ID: `cmeweacxn014qlg0c61fthp1h`)
3. 왼쪽 메뉴에서 **Settings** 클릭
4. **Domains** 또는 **Allowed Origins** 찾기
5. 다음 도메인들을 추가:

```
https://getclayed.vercel.app
http://localhost:3000
```

**선택사항** (Vercel preview 배포를 사용하는 경우):
```
https://*.vercel.app
```

### 2단계: Vercel 환경 변수 확인

1. https://vercel.com/ 접속
2. 프로젝트 `getclayed` 선택
3. **Settings** → **Environment Variables** 이동
4. 다음 변수가 있는지 확인, 없으면 추가:

```
Name: NEXT_PUBLIC_PRIVY_APP_ID
Value: cmeweacxn014qlg0c61fthp1h
Environments: ✓ Production ✓ Preview ✓ Development
```

### 3단계: Vercel 재배포

환경 변수를 추가하거나 수정한 경우:
1. Vercel Dashboard → **Deployments** 탭
2. 최신 배포의 3점 메뉴 (...) 클릭
3. **Redeploy** 선택

또는 GitHub에 push하면 자동 배포됩니다.

### 4단계: 테스트

**배포 후 (5-10분 대기):**
1. https://getclayed.vercel.app 접속
2. 브라우저 개발자 도구 (F12) 열기
3. Console 탭 확인
4. "Connect Wallet" 버튼 클릭
5. Privy 로그인 모달이 나타나는지 확인

**로컬 테스트:**
```bash
# 개발 서버 재시작
npm run dev
# http://localhost:3000 접속하여 테스트
```

## 🐛 문제가 계속되는 경우

### CORS 에러가 여전히 발생하면:

1. **Privy 설정 다시 확인**
   - 도메인에 `https://` 프로토콜 포함되었는지 확인
   - 저장 버튼을 눌렀는지 확인
   - 5-10분 대기 후 다시 시도

2. **브라우저 캐시 삭제**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`
   - 또는 시크릿 모드에서 테스트

3. **콘솔 로그 확인**
   - 브라우저 개발자 도구에서 어떤 에러가 나오는지 확인
   - 스크린샷을 찍어서 공유

## 📝 변경된 파일

- `components/PrivyProvider.tsx` - 환경 변수 사용
- `.env` - Privy App ID 추가
- `.env.local` - 이미 설정되어 있음

## 💡 참고사항

- Privy Dashboard에서 도메인을 추가하는 것이 **가장 중요한 단계**입니다
- 설정 변경 후 전파 시간이 5-10분 정도 걸릴 수 있습니다
- 로컬에서는 문제가 없지만 배포 환경에서만 에러가 발생한다면 Privy Dashboard 설정 문제입니다

## 🆘 추가 도움이 필요하면

다음 정보를 공유해주세요:
1. Privy Dashboard에서 도메인을 추가했는지
2. Vercel 환경 변수를 설정했는지
3. 브라우저 콘솔의 정확한 에러 메시지
4. 로컬과 배포 환경 중 어디서 문제가 발생하는지

