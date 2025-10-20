# 🚀 Deployment Information

## ⚠️ 이전 배포 (해킹됨 - 사용 중지)

배포 일시: 2025-10-13
**상태**: 🔴 **해킹됨 - 사용하지 마세요!**

#### 구 버전 주소 (사용 금지)
- ❌ ClayLibrary (구): `0x75478e703f1b873eB97dD3408aA4F4c8C24685cC`
- ❌ ClayMarketplace (구): `0x91589d6cbE1939dea13F672A4756a39684Cbeb29`
- ❌ 배포 지갑 (해킹됨): `0x0e8Fa0f817cd3E70a4bc9C18Bef3d6CaD2C2C738`

---

## ✅ 새 배포 (안전) - 현재 사용 중

배포 일시: 2025-10-20
**상태**: 🟢 **안전 - 사용 가능**

### 배포된 스마트 컨트랙트

#### ClayLibrary (v2.0)
- **주소**: `0xA742D5B85DE818F4584134717AC18930B6cAFE1e`
- **네트워크**: Base Mainnet (Chain ID: 8453)
- **Explorer**: https://basescan.org/address/0xA742D5B85DE818F4584134717AC18930B6cAFE1e
- **기능**:
  - Library 에셋 등록 (사용 라이센스 판매)
  - ETH/USDC로 구매
  - 소유권 관리 (Marketplace 승인 시스템)
  - 플랫폼 수수료 징수 (2.5%)
  - 가격 덤핑 방지
  - Owner 권한 양도 가능 (Ownable2Step)

#### ClayRoyalty (v2.0)
- **주소**: `0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784`
- **네트워크**: Base Mainnet (Chain ID: 8453)
- **Explorer**: https://basescan.org/address/0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784
- **기능**:
  - Pull Pattern 로열티 (Claim 방식)
  - 실시간 소유권 기반 분배
  - 고정 로열티 (원가 기준 10%)
  - DoS 공격 방어
  - 가스비 최적화

#### ClayMarketplace (v2.0)
- **주소**: `0x1509b7F1F6FE754C16E9d0875ed324fad0d43779`
- **네트워크**: Base Mainnet (Chain ID: 8453)
- **Explorer**: https://basescan.org/address/0x1509b7F1F6FE754C16E9d0875ed324fad0d43779
- **기능**:
  - 소유권 거래 (Library와 통합)
  - 고정가 리스팅
  - 오퍼 시스템
  - 가격 업데이트 기능 (신규!)
  - 자동 소유권 이전

### 배포 지갑 (새 지갑 - 안전)
- **주소**: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`
- **권한**: 
  - 컨트랙트 Owner (Ownable2Step)
  - 플랫폼 수수료 출금 가능
  - Owner 권한 양도 가능
- **보안**:
  - ✅ Private Key는 `.env`로 관리
  - ✅ 절대 코드에 하드코딩 안 함
  - ✅ `.gitignore` 처리됨

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

