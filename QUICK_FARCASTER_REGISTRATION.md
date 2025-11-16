# GetClayed - Farcaster 앱 등록 빠른 가이드

## 🚀 5분 안에 등록하기

### 1단계: Warpcast Developer Portal 접속

**웹 브라우저에서:**
```
https://warpcast.com/~/developers
```

또는

**Warpcast 앱에서:**
```
Settings → Developer → Create App
```

---

### 2단계: 앱 정보 입력

#### 필수 정보 (복사해서 붙여넣기)

| 항목 | 값 |
|------|-----|
| **App Name** | `GetClayed` |
| **Home URL** | `https://getclayed.vercel.app` |
| **Icon URL** | `https://getclayed.vercel.app/clay.png` |
| **Manifest URL** | `https://getclayed.vercel.app/.well-known/farcaster.json` |

#### 설명

**Short Description:**
```
3D Clay Sculpting Platform
```

**Full Description:**
```
Create and sculpt 3D clay objects in your browser. 
A Web3 3D creation platform with blockchain integration.
Build, share, and trade your 3D creations on-chain.
```

#### 추가 정보 (선택사항)

| 항목 | 값 |
|------|-----|
| **Splash Image** | `https://getclayed.vercel.app/api/og` |
| **Splash Color** | `#3b82f6` |
| **Category** | Art & Design, Creator Tools, Web3 |

---

### 3단계: 제출 및 테스트

1. **"Save" 또는 "Submit" 클릭**
2. **앱 ID 확인 및 저장**
3. **테스트:**
   ```
   Warpcast에서 새 캐스트 작성
   → https://getclayed.vercel.app 입력
   → Mini App 카드 확인
   → "Launch GetClayed" 클릭
   ```

---

## ✅ 등록 완료 확인사항

- [ ] Mini App 카드가 표시됨
- [ ] "Launch GetClayed" 버튼이 작동함
- [ ] 앱이 Farcaster 환경에서 실행됨
- [ ] Farcaster 지갑이 자동으로 연결됨 (🟣 배지 표시)

---

## 📱 첫 공유 샘플

```
🎨 Introducing GetClayed!

Create stunning 3D clay sculptures right in your browser.
Your creations, your ownership - powered by Web3.

Try it now 👇
https://getclayed.vercel.app
```

---

## 🔧 문제 발생시

### 매니페스트 확인
```bash
curl https://getclayed.vercel.app/.well-known/farcaster.json
```

### Developer Portal 문제
- Farcaster 계정 활성화 필요 (최소 1개 캐스트)
- 일정 시간 대기 (신규 계정)

### 지원
- Discord: https://discord.gg/farcaster
- Docs: https://docs.farcaster.xyz

---

## 🎯 다음 단계

1. **Review 제출:** Developer Portal → Submit for Review
2. **커뮤니티 공유:** Farcaster 채널에 앱 소개
3. **피드백 수집:** 초기 사용자 의견 청취

---

**전체 가이드:** `FARCASTER_APP_REGISTRATION_GUIDE.md` 참조

**준비 완료!** 🚀

