# Library & Marketplace Setup Guide

이 가이드는 GetClayed의 Library와 Marketplace 기능을 활성화하기 위한 스마트 컨트랙트 배포 및 설정 방법을 설명합니다.

## 1. 사전 요구사항

```bash
# Hardhat 설치
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# OpenZeppelin 설치
npm install @openzeppelin/contracts
```

## 2. 환경 변수 설정

루트 디렉토리의 `.env.local` 파일에 다음 변수를 추가하세요:

```env
# 배포용 지갑 Private Key (Irys testnet 배포용)
DEPLOYER_PRIVATE_KEY=your_private_key_here
```

## 3. 스마트 컨트랙트 컴파일

```bash
cd contracts
npx hardhat compile
```

## 4. 스마트 컨트랙트 배포

### Irys Testnet 배포
```bash
cd contracts
npx hardhat run scripts/deploy.js --network irysTestnet
```

### Irys Mainnet 배포 (나중에)
```bash
npx hardhat run scripts/deploy.js --network irysMainnet
```

배포 후 출력되는 컨트랙트 주소를 복사하세요.

## 5. 환경 변수에 컨트랙트 주소 추가

배포 결과로 출력된 주소를 `.env.local`에 추가:

```env
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x...
```

## 6. 컨트랙트 검증 (선택사항)

Irys testnet에서는 Etherscan 검증이 필요하지 않습니다.
컨트랙트 코드는 배포 시 자동으로 검증됩니다.

## 7. 기능 설명

### Library
- **등록**: 사용자가 자신의 프로젝트를 Library에 등록하고 가격 설정
- **구매**: 다른 사용자가 IRYS 토큰을 지불하고 재사용 가능한 에셋 구매
- **수익 추적**: 총 수익과 구매 횟수 자동 추적
- **소유권 관리**: Mutable address를 통한 소유권 변경 지원

### Marketplace
- **고정가 리스팅**: Library 에셋을 고정 가격으로 판매
- **Offer 시스템**: 구매자가 가격 제안, 판매자가 수락/거부
- **자동 소유권 이전**: 판매 시 Library 소유권도 함께 이전
- **수수료**: 플랫폼 수수료 (기본 2.5%) 자동 정산

## 8. 사용 흐름

### Library에 등록
1. 프로젝트 제작 페이지에서 파일 우클릭
2. "Add to Library" 선택
3. 이름, 설명, 가격 입력
4. 스마트 컨트랙트에 등록 트랜잭션 전송

### Library에서 가져오기
1. 프로젝트 제작 페이지에서 Library 버튼 클릭
2. 검색하여 원하는 에셋 찾기
3. Import 버튼 클릭 → 결제 진행
4. 자동으로 프로젝트에 그룹으로 추가됨

### Marketplace 판매
1. Library에 등록된 에셋이 있어야 함
2. Marketplace에서 리스팅 또는 Offer 수락
3. 판매 시 소유권과 수익 대상이 새 소유자로 이전

## 9. 주의사항

- 스마트 컨트랙트 배포는 가스비가 발생합니다
- Testnet에서 먼저 테스트 후 Mainnet 배포 권장
- 컨트랙트 주소는 배포 후 변경 불가능하므로 신중하게 관리
- Platform owner만 수수료 비율 변경 및 수수료 인출 가능

