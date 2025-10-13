# 🚀 Deployment Information

## Base Mainnet 배포 완료

배포 일시: 2025-10-13

### 배포된 스마트 컨트랙트

#### ClayLibrary
- **주소**: `0x75478e703f1b873eB97dD3408aA4F4c8C24685cC`
- **네트워크**: Base Mainnet (Chain ID: 8453)
- **Explorer**: https://basescan.org/address/0x75478e703f1b873eB97dD3408aA4F4c8C24685cC
- **기능**:
  - Library 에셋 등록 (ETH/USDC 가격 설정)
  - ETH로 구매: `purchaseAssetWithETH()`
  - USDC로 구매: `purchaseAssetWithUSDC()`
  - 소유권 관리 및 이전
  - 플랫폼 수수료 징수 (2.5%)

#### ClayMarketplace
- **주소**: `0x91589d6cbE1939dea13F672A4756a39684Cbeb29`
- **네트워크**: Base Mainnet (Chain ID: 8453)
- **Explorer**: https://basescan.org/address/0x91589d6cbE1939dea13F672A4756a39684Cbeb29
- **기능**:
  - 고정가 리스팅 (ETH/USDC 선택)
  - Offer 시스템 (ETH/USDC 선택)
  - Offer 수락/거절
  - 자동 소유권 이전

### 배포 지갑
- **주소**: `0x0e8Fa0f817cd3E70a4bc9C18Bef3d6CaD2C2C738`
- **권한**: 
  - 컨트랙트 Owner
  - 플랫폼 수수료 출금 가능

### USDC Token
- **Base Mainnet USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Decimals**: 6

### 주요 기능

#### Library 에셋 등록
```solidity
registerAsset(
  string projectId,
  string name,
  string description,
  uint256 priceETH,    // ETH price in wei
  uint256 priceUSDC    // USDC price (6 decimals)
)
```

#### 구매
- ETH: `purchaseAssetWithETH(projectId)` - msg.value 필요
- USDC: `purchaseAssetWithUSDC(projectId)` - approve 필요

#### Marketplace 리스팅
```solidity
listAsset(
  string projectId,
  uint256 price,
  PaymentToken paymentToken  // 0: ETH, 1: USDC
)
```

#### Offer
```solidity
makeOffer(
  string projectId,
  uint256 offerPrice,
  PaymentToken paymentToken,
  uint256 duration
)
```

### 플랫폼 수수료 출금 (Owner만 가능)

#### ETH 수수료 출금
```solidity
withdrawPlatformFeesETH()
```

#### USDC 수수료 출금
```solidity
withdrawPlatformFeesUSDC()
```

### 보안 기능
- ✅ ReentrancyGuard: 재진입 공격 방지
- ✅ Ownable: Owner 권한 관리
- ✅ 플랫폼 수수료 상한선: 최대 10%

### 네트워크 정보
- **Chain**: Base
- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Explorer**: https://basescan.org
- **Native Token**: ETH
- **USDC**: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

### 비용 정보
- **프로젝트 업로드**: 무료 (Irys 고정 키 사용)
- **Library 등록**: 가스비만 필요
- **구매**: 에셋 가격 + 가스비
- **플랫폼 수수료**: 2.5% (에셋 가격에서 자동 차감)

