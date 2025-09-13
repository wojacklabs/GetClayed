# 배포 설정 가이드

## 필요한 환경 변수

`.env` 파일에 다음 변수를 추가해야 합니다:

```bash
# 배포자 개인키 (0x 없이)
DEPLOYER_PRIVATE_KEY=your_private_key_here
```

## 개인키 얻는 방법

1. **MetaMask 사용자**:
   - MetaMask 열기
   - 계정 메뉴 > 계정 세부 정보
   - 개인키 내보내기 (비밀번호 입력)
   - 0x를 제외한 나머지 부분 복사

2. **주의사항**:
   - 절대 GitHub에 커밋하지 마세요
   - 배포 전용 계정 사용 권장
   - 충분한 ETH 잔액 필요 (Base mainnet)

## 배포 명령어

환경 변수 설정 후:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network base
```

## 예상 가스비

- ClayLibrary: ~0.01 ETH
- ClayRoyalty: ~0.008 ETH  
- ClayMarketplace: ~0.01 ETH
- 총합: ~0.03 ETH (Base mainnet 기준)
