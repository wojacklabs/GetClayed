# V2 계층적 로열티 컨트랙트 업데이트 가이드

## 🎉 Base 메인넷 V2 컨트랙트 배포 완료

### 📋 새로운 컨트랙트 주소 (2025-01-11)
```
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xe90BB6281B7Af6211519e5721A5b4985Ea693a49
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x7f993C490aA7934A537950dB8b5f22F8B5843884
```

### ✅ 새로운 기능
- 계층적 로열티 자동 분배
- 직접/간접 의존성 구분
- 지불 시점 자동 분배
- 라이브러리 의존성 추적
- 삭제된 의존성 보호

## 🔧 로컬 환경 업데이트

### 1. `.env.local` 파일 수정
```bash
# 기존 컨트랙트 주소를 모두 삭제하고 새 주소로 교체
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xe90BB6281B7Af6211519e5721A5b4985Ea693a49
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x7f993C490aA7934A537950dB8b5f22F8B5843884

# 다른 설정은 그대로 유지
NEXT_PUBLIC_BASE_CHAIN_ID=8453
NEXT_PUBLIC_ALCHEMY_API_KEY=<your-key>
NEXT_PUBLIC_PRIVY_APP_ID=<your-app-id>
NEXT_PUBLIC_PRIVY_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_APP_ENV=production
```

### 2. 개발 서버 재시작
```bash
# 서버 중지 (Ctrl+C) 후
npm run dev
```

### 3. 브라우저 캐시 클리어
- Chrome DevTools > Application > Storage > Clear site data
- 또는 시크릿/프라이빗 모드에서 테스트

## 🚀 프로덕션 배포 (Vercel)

### 1. Vercel 환경 변수 업데이트
```bash
vercel env pull  # 현재 설정 백업

# 각 변수 업데이트
vercel env add NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS production
# 값: 0xe90BB6281B7Af6211519e5721A5b4985Ea693a49

vercel env add NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS production
# 값: 0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a

vercel env add NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS production
# 값: 0x7f993C490aA7934A537950dB8b5f22F8B5843884
```

### 2. 재배포
```bash
vercel --prod
```

## 📍 하드코딩된 주소 확인

현재 코드베이스에서 하드코딩된 컨트랙트 주소는 없습니다:
- ✅ 모든 컨트랙트 주소는 환경 변수로 관리됨
- ✅ `lib/royaltyService.ts`, `lib/libraryService.ts`, `lib/marketplaceService.ts` 등 모두 환경 변수 사용
- ✅ 컴포넌트들도 모두 환경 변수 참조

유일하게 하드코딩된 주소:
- USDC 토큰 주소: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base 메인넷 USDC)
- Irys 관련 Payment 컨트랙트: `0xcEFd26e34d86d07F04D21eDA589b4C81D4f4FcA4` (별도 네트워크)

## 🔍 배포 검증

### 컨트랙트 연결 확인
```bash
node scripts/verifyV2Contracts.js
```

### Basescan 검증 (선택사항)
```bash
chmod +x verify_on_basescan.sh
./verify_on_basescan.sh
```

## ⚠️ 주의사항
- 이전 V1 컨트랙트에 등록된 프로젝트/라이브러리는 V2에서 새로 등록 필요
- V2는 계층적 로열티를 지원하므로 라이브러리 가격 설정 시 의존성 비용 고려 필요
- 자동 분배 기능으로 인해 가스비가 약간 증가할 수 있음

## 📞 문제 발생 시
1. 콘솔에서 에러 메시지 확인
2. 네트워크가 Base 메인넷(Chain ID: 8453)인지 확인
3. 지갑에 충분한 ETH/USDC가 있는지 확인
4. 환경 변수가 올바르게 설정되었는지 재확인

---

배포 시간: 2025-01-11
배포자: 0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00
