# Base Testnet 배포 가이드

Library와 Marketplace 스마트 컨트랙트를 Base Sepolia testnet에 배포하는 방법입니다.

## 1. Base Sepolia Testnet ETH 받기

배포를 위해 지갑에 Base Sepolia ETH가 필요합니다.

### Faucet 사용
1. [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) 접속
2. 지갑 주소 입력: `0x0e8Fa0f817cd3E70a4bc9C18Bef3d6CaD2C2C738`
3. ETH 받기 (배포에 약 0.002 ETH 필요)

또는:
- [Alchemy Faucet](https://sepoliafaucet.com/)
- [QuickNode Faucet](https://faucet.quicknode.com/base/sepolia)

## 2. 컨트랙트 배포

```bash
cd /Users/USER/web3/getclayed/contracts
DEPLOYER_PRIVATE_KEY=0x4382e70551f596c76122075c7f7841ac6e5e5a76ea4ca16d848497d9ce074611 npx hardhat run scripts/deploy.js --network baseSepolia
```

## 3. 배포된 컨트랙트 주소 저장

배포 후 출력되는 주소를 `/Users/USER/web3/getclayed/.env.local`에 업데이트:

```env
# 기존 Irys 주소를 Base 주소로 교체
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0x새로운주소
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x새로운주소
```

## 4. Base Sepolia USDC 주소

컨트랙트에 하드코딩된 USDC 주소:
- Base Sepolia USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## 5. 테스트용 USDC 받기

[Circle Faucet](https://faucet.circle.com/) 또는 [Uniswap](https://app.uniswap.org/)에서 Base Sepolia USDC를 받거나 swap하세요.

## 6. 주요 변경사항

### ETH/USDC 이중 결제 지원
- Library 등록 시 ETH 가격과 USDC 가격을 모두 설정 가능
- 구매 시 ETH 또는 USDC 선택 가능
- Marketplace 리스팅/Offer도 동일하게 지원

### 함수 변경사항

#### ClayLibrary
- `registerAsset(projectId, name, desc, priceETH, priceUSDC)`
- `purchaseAssetWithETH(projectId)` - ETH로 구매
- `purchaseAssetWithUSDC(projectId)` - USDC로 구매
- `withdrawPlatformFeesETH()` - ETH 수수료 인출
- `withdrawPlatformFeesUSDC()` - USDC 수수료 인출

#### ClayMarketplace
- `listAsset(projectId, price, paymentToken)` - paymentToken: 0=ETH, 1=USDC
- `makeOffer(projectId, offerPrice, paymentToken, duration)`
- `buyAsset(projectId)` - 리스팅 paymentToken에 따라 자동 처리

## 7. 네트워크 정보

### Base Sepolia Testnet
- Chain ID: 84532
- RPC URL: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org

### Base Mainnet
- Chain ID: 8453
- RPC URL: https://mainnet.base.org
- Explorer: https://basescan.org

