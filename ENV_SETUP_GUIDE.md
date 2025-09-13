# 🔧 환경변수 설정 가이드

## 📋 설정해야 할 환경변수 (최신 버전)

### 🚀 배포 정보
- **최신 배포**: 2025-10-28
- **네트워크**: Base Mainnet (Chain ID: 8453)
- **배포자**: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`

---

## 1️⃣ 스마트 컨트랙트 주소 (필수) - V2

```bash
# ClayLibrary - Library 등록 및 라이센스
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xe90BB6281B7Af6211519e5721A5b4985Ea693a49

# ClayRoyalty - Royalty 추적 및 분배
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a

# ClayMarketplace - 소유권 거래
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x7f993C490aA7934A537950dB8b5f22F8B5843884
```

### 📍 BaseScan 링크
- **ClayLibrary**: https://basescan.org/address/0xe90BB6281B7Af6211519e5721A5b4985Ea693a49
- **ClayRoyalty**: https://basescan.org/address/0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a
- **ClayMarketplace**: https://basescan.org/address/0x7f993C490aA7934A537950dB8b5f22F8B5843884

---

## 2️⃣ 네트워크 설정 (필수)

```bash
# Base Mainnet RPC
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org

# Chain ID
NEXT_PUBLIC_CHAIN_ID=8453

# USDC 토큰 주소 (Base 공식 USDC)
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

---

## 3️⃣ 보안 설정 (강력 권장)

```bash
# 신뢰할 수 있는 업로더 주소 (Royalty Receipt 검증용)
# 이 주소로 업로드된 receipt만 UI에 표시됨
NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS=AfcWKLP89g1DxMvuKzPizt8yFP61JJCNsLyLYqFFRKqs
```

**보안 효과**:
- ✅ 가짜 royalty receipt 차단
- ✅ UI 스팸 방지
- ✅ 사용자 신뢰도 향상

> 💡 **주의**: 이 값이 없으면 누구나 임의의 receipt를 업로드하여 UI에 표시할 수 있습니다.

---

## 4️⃣ Privy 설정 (필수)

```bash
# Privy App ID (Wallet 인증용)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
```

**Privy App ID 확인 방법**:
1. https://dashboard.privy.io 로그인
2. 프로젝트 선택
3. Settings → App ID 복사

---

## 5️⃣ Irys 설정 (선택사항)

```bash
# Irys 고정 프라이빗 키 (Solana, 서버 측 업로드용)
# 형식: 쉼표로 구분된 숫자 배열
# NEXT_PUBLIC_IRYS_PRIVATE_KEY=123,456,789,...

# Irys 네트워크 설정 (기본값 사용 시 생략 가능)
# NEXT_PUBLIC_IRYS_NETWORK=devnet
# NEXT_PUBLIC_IRYS_TOKEN=matic
# NEXT_PUBLIC_IRYS_RPC_URL=https://rpc-mumbai.maticvigil.com
```

---

## 📦 .env.local 설정 (로컬 개발)

### 1. 파일 생성
```bash
# 프로젝트 루트에서
cp env.example .env.local
```

### 2. 환경변수 입력
`.env.local` 파일을 열고 아래 값들을 **모두** 입력:

```bash
# Privy
NEXT_PUBLIC_PRIVY_APP_ID=clxxxxxxxxxx  # 실제 값으로 교체

# Contracts (아래 값 그대로 사용)
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x62eDd08a9943656661818f62679eaa8000C108a3

# Network (아래 값 그대로 사용)
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Security (아래 값 그대로 사용)
NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS=AfcWKLP89g1DxMvuKzPizt8yFP61JJCNsLyLYqFFRKqs

# Irys (있는 경우만 추가)
# NEXT_PUBLIC_IRYS_PRIVATE_KEY=...
```

### 3. 검증
```bash
# 보안 설정 확인
node scripts/verifyReceiptSecurity.js

# ✅ 모든 체크가 통과하면 성공!
```

---

## ☁️ Vercel 배포 설정

### 1. Vercel Dashboard 접속
1. https://vercel.com 로그인
2. 프로젝트 선택
3. **Settings** → **Environment Variables**

### 2. 환경변수 추가

각 변수를 **하나씩** 추가:

#### Privy
| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | `clxxxxxxxxxx` | Production, Preview, Development |

#### Contracts
| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS` | `0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4` | Production, Preview, Development |
| `NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS` | `0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1` | Production, Preview, Development |
| `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS` | `0x62eDd08a9943656661818f62679eaa8000C108a3` | Production, Preview, Development |

#### Network
| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_BASE_RPC_URL` | `https://mainnet.base.org` | Production, Preview, Development |
| `NEXT_PUBLIC_CHAIN_ID` | `8453` | Production, Preview, Development |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Production, Preview, Development |

#### Security
| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS` | `AfcWKLP89g1DxMvuKzPizt8yFP61JJCNsLyLYqFFRKqs` | Production, Preview, Development |

> ⚠️ **중요**: 각 변수에 대해 **Production, Preview, Development 모두 체크**해야 합니다!

### 3. 재배포
환경변수 추가 후 자동 재배포되지 않으면:

```bash
# Vercel CLI 사용
vercel --prod

# 또는 Git push (자동 배포)
git add .
git commit -m "Update environment variables"
git push
```

---

## ✅ 설정 완료 체크리스트

### 로컬 환경
- [ ] `.env.local` 파일 생성
- [ ] Privy App ID 입력
- [ ] 컨트랙트 주소 3개 입력
- [ ] 네트워크 설정 3개 입력
- [ ] 보안 설정 입력
- [ ] `node scripts/verifyReceiptSecurity.js` 실행하여 ✅ 확인
- [ ] `npm run dev` 실행하여 정상 작동 확인

### Vercel 배포
- [ ] Vercel Dashboard → Environment Variables 접속
- [ ] Privy App ID 추가 (3개 환경 모두 체크)
- [ ] 컨트랙트 주소 3개 추가 (각각 3개 환경 모두 체크)
- [ ] 네트워크 설정 3개 추가 (각각 3개 환경 모두 체크)
- [ ] 보안 설정 추가 (3개 환경 모두 체크)
- [ ] 재배포 완료
- [ ] 프로덕션 사이트에서 정상 작동 확인

---

## 🔍 문제 해결

### 1. "Contract not configured" 에러
→ 환경변수가 설정되지 않았거나 오타가 있습니다.
```bash
# 환경변수 확인
echo $NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS
echo $NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS
echo $NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS
```

### 2. "Wrong network" 에러
→ Base Mainnet에 연결되어 있는지 확인하세요.
```bash
# Chain ID 확인
echo $NEXT_PUBLIC_CHAIN_ID
# 8453이 출력되어야 함
```

### 3. "Privy not initialized" 에러
→ Privy App ID가 올바른지 확인하세요.

### 4. Royalty receipt가 표시되지 않음
→ `NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS`가 설정되었는지 확인:
```bash
node scripts/verifyReceiptSecurity.js
```

### 5. Vercel 배포 후에도 환경변수가 적용 안됨
→ 재배포가 필요합니다:
```bash
vercel --prod
```

---

## 📚 관련 문서

- `env.example` - 환경변수 템플릿
- `DEPLOYMENT_COMPLETE_20251028.md` - 최신 배포 정보
- `ROYALTY_SECURITY_QUICK_GUIDE.md` - 보안 설정 가이드
- `ROYALTY_RECEIPT_SECURITY.md` - 보안 상세 문서

---

## 🆘 도움이 필요하면

1. `env.example` 파일 참고
2. `node scripts/verifyReceiptSecurity.js` 실행
3. 브라우저 콘솔 확인 (F12 → Console)
4. 에러 메시지 확인 후 위 문제 해결 섹션 참고

