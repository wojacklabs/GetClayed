# 배포 정보 - 2025년 11월 11일

## 배포된 컨트랙트 (Base Mainnet)

### ClayLibrary v3.0
- **주소**: `0xC27812Eee59FFC15A947efBd55Fc7131eb05DA20`
- **Explorer**: https://basescan.org/address/0xC27812Eee59FFC15A947efBd55Fc7131eb05DA20
- **개선사항**:
  - 소유자가 삭제한 라이브러리 재등록 가능
  - 소유자가 활성 라이브러리 정보 업데이트 가능
  - 다른 사용자의 라이브러리는 여전히 보호

### ClayRoyalty
- **주소**: `0x95D3Ee66435cf3a0Ac4c0725b14E7dF116a5c575`
- **Explorer**: https://basescan.org/address/0x95D3Ee66435cf3a0Ac4c0725b14E7dF116a5c575

### ClayMarketplace
- **주소**: `0x72CD5B6C5A8D466Db9B24c8697a1504C7F3E904b`
- **Explorer**: https://basescan.org/address/0x72CD5B6C5A8D466Db9B24c8697a1504C7F3E904b

## 환경 변수 업데이트 필요

### 로컬 (.env.local)
```bash
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xC27812Eee59FFC15A947efBd55Fc7131eb05DA20
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x95D3Ee66435cf3a0Ac4c0725b14E7dF116a5c575
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x72CD5B6C5A8D466Db9B24c8697a1504C7F3E904b
```

### Vercel 환경 변수
프로덕션 환경에서도 위 값들로 업데이트 필요

## 변경 사항 요약

1. **라이브러리 재등록 가능**
   - 소유자는 자신이 삭제한 라이브러리를 다시 활성화 가능
   - 프로젝트를 새로 만들 필요 없음

2. **라이브러리 업데이트 가능**
   - 소유자는 가격, 설명 등 정보 수정 가능
   - 다른 사용자의 라이브러리는 보호됨

## 테스트 시나리오

1. 라이브러리 등록
2. 라이브러리 삭제 (disable)
3. 같은 프로젝트로 라이브러리 재등록
4. 라이브러리 정보 업데이트
