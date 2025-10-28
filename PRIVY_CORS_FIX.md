# Privy CORS Error 해결 가이드

## 문제 설명
```
Access to fetch at 'https://auth.privy.io/api/v1/apps/...' from origin 'https://getclayed.vercel.app' 
has been blocked by CORS policy
```

## 원인
Privy 대시보드에서 배포된 도메인이 허용된 도메인(Allowed Origins) 목록에 없어서 발생하는 문제입니다.

## 해결 방법

### 1. Privy Dashboard 설정 (필수!)

1. [Privy Dashboard](https://dashboard.privy.io/) 로그인
2. 앱 선택 (App ID: `cmeweacxn014qlg0c61fthp1h`)
3. 왼쪽 메뉴에서 **Settings** 클릭
4. **Domains** 또는 **Allowed Origins** 섹션 찾기
5. 다음 도메인들을 추가:

```
https://getclayed.vercel.app
http://localhost:3000
https://*.vercel.app
```

**중요**: 
- 프로토콜(`https://` 또는 `http://`)을 정확히 입력해야 합니다
- 와일드카드(`*.vercel.app`)를 지원하는지 확인하세요
- 지원하지 않으면 각 preview URL을 개별적으로 추가해야 합니다

### 2. Vercel 환경 변수 설정

1. [Vercel Dashboard](https://vercel.com/) 로그인
2. 프로젝트 선택 (getclayed)
3. **Settings** → **Environment Variables** 이동
4. 다음 환경 변수 추가:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | `cmeweacxn014qlg0c61fthp1h` | Production, Preview, Development |

**저장 후 재배포**가 필요합니다!

### 3. 로컬 개발 환경 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# .env.local
NEXT_PUBLIC_PRIVY_APP_ID=cmeweacxn014qlg0c61fthp1h
```

### 4. 변경사항 확인

코드가 이미 업데이트되었습니다:
- `components/PrivyProvider.tsx`에서 환경 변수 사용
- 추가 설정 옵션 추가 (loginMethods, embeddedWallets)

## 테스트 방법

### 1. 로컬 테스트
```bash
# .env.local 파일 생성 후
npm run dev
# 브라우저에서 http://localhost:3000 접속
# 콘솔에서 CORS 에러가 없는지 확인
```

### 2. 배포 후 테스트
1. Vercel에서 재배포
2. https://getclayed.vercel.app 접속
3. 브라우저 개발자 도구 콘솔 확인
4. "Connect Wallet" 버튼 클릭하여 Privy 로그인 모달이 정상 작동하는지 확인

## 추가 문제 해결

### CORS 에러가 계속되는 경우

1. **Privy Dashboard 확인**:
   - 도메인이 정확히 입력되었는지 확인
   - 설정 저장 후 5-10분 대기 (전파 시간)

2. **브라우저 캐시 삭제**:
   - Hard Reload: `Cmd + Shift + R` (Mac) / `Ctrl + Shift + R` (Windows)
   - 또는 시크릿 모드에서 테스트

3. **Vercel 환경 변수 확인**:
   ```bash
   # Vercel CLI로 확인
   vercel env pull
   ```

4. **재배포**:
   - Vercel Dashboard → Deployments → 최신 배포 → Redeploy

### Privy 초기화 에러

콘솔에서 다음 로그 확인:
```javascript
// 정상적인 경우
[Privy] Initialized successfully

// 에러가 있는 경우
[Privy] Failed to initialize
```

## 참고 자료

- [Privy Documentation - CORS](https://docs.privy.io/guide/troubleshooting/cors)
- [Privy Documentation - Allowed Origins](https://docs.privy.io/guide/configuration/allowed-origins)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

## 체크리스트

- [ ] Privy Dashboard에서 도메인 추가
- [ ] Vercel 환경 변수 설정
- [ ] `.env.local` 파일 생성 (로컬 개발)
- [ ] Vercel 재배포
- [ ] 브라우저 캐시 삭제 후 테스트
- [ ] 지갑 연결 기능 테스트

