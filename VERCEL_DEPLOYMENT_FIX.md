# Vercel 배포 문제 해결 가이드

## 🚨 "Unexpected internal error" 해결 방법

### 1. Vercel 환경변수 설정 (필수!)

Vercel Dashboard → Settings → Environment Variables에서 다음 변수들을 추가하세요:

```
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xA742D5B85DE818F4584134717AC18930B6cAFE1e

NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784

NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x1509b7F1F6FE754C16E9d0875ed324fad0d43779
```

**중요**: `NEXT_PUBLIC_` 접두사가 있는 변수만 브라우저에서 사용 가능합니다.

---

### 2. contracts 폴더 빌드 제외

contracts 폴더가 Next.js 빌드에 포함되어 문제를 일으킬 수 있습니다.

`.vercelignore` 파일을 생성하세요:

```
contracts/
*.md
DEPLOY.md
DEPLOYMENT_INFO.md
FINAL_*.md
```

---

### 3. 빌드 커맨드 확인

`vercel.json` 확인:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

---

### 4. 배포 재시도

```bash
# 로컬에서 빌드 확인
npm run build  # 성공하는지 확인

# Vercel 재배포
git add .
git commit -m "fix: vercel deployment"
git push origin main
```

또는 Vercel CLI:
```bash
vercel --prod
```

---

### 5. Vercel 로그 확인

Vercel Dashboard → Deployments → Failed Deployment → Logs

에서 실제 에러 메시지를 확인하세요.

---

## 🔍 체크리스트

- [ ] Vercel 환경변수 4개 설정됨
- [ ] `.vercelignore` 생성됨
- [ ] 로컬 빌드 성공
- [ ] `.env` 파일이 git에 커밋 안 됨 (gitignore 확인)
- [ ] contracts 폴더가 빌드에 포함 안 됨

---

## 💡 추가 해결 방법

### Option 1: Fresh deployment
```bash
vercel --prod --force
```

### Option 2: 캐시 클리어 후 배포
Vercel Dashboard → Settings → Clear Build Cache

### Option 3: Node.js 버전 명시
`package.json`에 추가:
```json
"engines": {
  "node": ">=18.0.0"
}
```

---

## 🎯 가장 가능성 높은 원인

**환경변수 미설정**

Vercel에서 `NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS` 등이 없으면 빌드 시 문제가 발생할 수 있습니다.

반드시 Vercel Dashboard에서 환경변수를 설정하세요!

