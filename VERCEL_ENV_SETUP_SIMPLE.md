# ⚡ Vercel 환경변수 설정 (간단 가이드)

## 🎯 Vercel Dashboard에서 설정

### 1단계: Vercel 접속
https://vercel.com → 로그인 → GetClayed 프로젝트 선택

### 2단계: Settings → Environment Variables
왼쪽 메뉴에서 "Environment Variables" 클릭

### 3단계: 4개 변수 추가

#### ① NEXT_PUBLIC_PRIVY_APP_ID
```
Name: NEXT_PUBLIC_PRIVY_APP_ID
Value: cmeweacxn014qlg0c61fthp1h
Environment: Production, Preview, Development 모두 체크
```

#### ② NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS
```
Name: NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS
Value: 0xA742D5B85DE818F4584134717AC18930B6cAFE1e
Environment: Production, Preview, Development 모두 체크
```

#### ③ NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS
```
Name: NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS
Value: 0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784
Environment: Production, Preview, Development 모두 체크
```

#### ④ NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS
```
Name: NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS
Value: 0x1509b7F1F6FE754C16E9d0875ed324fad0d43779
Environment: Production, Preview, Development 모두 체크
```

### 4단계: 재배포
환경변수 추가 후 → Deployments 탭 → "Redeploy" 버튼 클릭

---

## ✅ 완료 확인

배포된 사이트 접속 → F12 (개발자 도구) → Console:
```javascript
console.log(process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS)
// "0xA742D5B85DE818F4584134717AC18930B6cAFE1e" 출력되면 성공!
```

---

## 🚨 주의

- Privy App ID는 실제 사용하는 ID로 변경하세요
- 컨트랙트 주소는 위 주소 그대로 사용
- 변수 추가 후 반드시 재배포 필요!

