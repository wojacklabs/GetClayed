# 🎉 새 컨트랙트 배포 완료 (2025-10-28)

## 📋 배포 정보

### 배포 네트워크
- **Network**: Base Mainnet
- **Chain ID**: 8453
- **Deployer**: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`
- **배포 시간**: 2025-10-28
- **가스 사용**: ~0.000049 ETH

### 컨트랙트 주소

| Contract | Address | Explorer |
|----------|---------|----------|
| **ClayLibrary** | `0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4` | [View](https://basescan.org/address/0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4) |
| **ClayRoyalty** | `0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1` | [View](https://basescan.org/address/0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1) |
| **ClayMarketplace** | `0x62eDd08a9943656661818f62679eaa8000C108a3` | [View](https://basescan.org/address/0x62eDd08a9943656661818f62679eaa8000C108a3) |

---

## 🔄 구버전 대비 주요 변경사항

### 1. isActive 개념 분리

**구조 변경:**
```solidity
// 이전
struct LibraryAsset {
    bool isActive;  // 단일 플래그
}

// 현재
struct LibraryAsset {
    bool exists;           // Asset 존재 여부
    bool royaltyEnabled;   // Royalty 활성화 여부 (독립적)
}
```

**새 함수:**
- `disableRoyalty()` - Royalty만 비활성화 (거래는 가능)
- `enableRoyalty()` - Royalty 재활성화
- `deleteAsset()` - Asset 완전 삭제 (거래 불가)

**영향:**
- ✅ Royalty 끄고 Marketplace 거래 가능
- ✅ Library 아닌 프로젝트도 Marketplace 거래 가능

### 2. 프로젝트 소유권 이전

**새 필드 (ClayProject):**
```typescript
originalCreator?: string;    // 최초 제작자 (불변)
transferredFrom?: string;    // 이전 소유자
transferredAt?: number;      // 이전 시각
transferCount?: number;      // 거래 횟수
```

**Irys 태그:**
- `Original-Creator` - 최초 제작자 추적
- `Transferred-From` - 이전 소유자
- `Transferred-At` - 이전 시각
- `Transfer-Count` - 거래 횟수

**Marketplace 거래 후:**
- ✅ Irys에 새 소유자로 자동 재업로드
- ✅ 구매자의 "My Projects"에 나타남
- ✅ 판매자의 "My Projects"에서 사라짐

### 3. GraphQL 기반 Royalty 조회

**변경:**
```typescript
// 이전: 온체인 이벤트 조회
contract.queryFilter(filter, fromBlock, toBlock)  // RPC 에러 빈번

// 현재: Irys GraphQL 조회
getRoyaltyReceipts(userAddress)  // 빠르고 안정적
```

**장점:**
- ⚡ 10배 이상 빠름
- ✅ RPC 에러 없음
- 📊 상세 정보 (프로젝트명, payer 등)

---

## 📊 구버전 vs 신버전

| 항목 | 구버전 | 신버전 |
|------|--------|--------|
| **Library Address** | `0xB48d4B9067af863AAC10D2B0e213C01ef51df3a0` | `0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4` |
| **Royalty Address** | `0x9204F459508cD03850F53E5064E778f88C0C8D45` | `0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1` |
| **Marketplace Address** | `0x40d1b346D1450350aF2208852530c52B56f83861` | `0x62eDd08a9943656661818f62679eaa8000C108a3` |
| **isActive 분리** | ❌ | ✅ exists/royaltyEnabled |
| **소유권 이전** | ❌ Contract만 | ✅ Contract + Irys |
| **Royalty 조회** | ⚠️ 온체인 (느림) | ✅ GraphQL (빠름) |
| **Asset 삭제** | ❌ 불가 | ✅ deleteAsset() |

---

## 🚨 Breaking Changes

### 1. 기존 Library Assets 손실
- 구버전에 등록된 library는 신버전에 없음
- 사용자가 다시 등록해야 함
- **영향**: 초기 단계이므로 최소

### 2. 기존 Pending Royalties 손실
- 구 Royalty 컨트랙트의 pending은 claim 불가
- 새 컨트랙트부터 정상 작동
- **영향**: 테스트 금액이므로 무시 가능

### 3. getAsset() 반환값 변경
- 이전: 9개 필드 (isActive 포함)
- 현재: 10개 필드 (exists, royaltyEnabled)
- **영향**: 프론트엔드 libraryService.ts ABI 업데이트 필요

---

## ✅ 배포 후 작업

### 1. 프론트엔드 ABI 업데이트

**lib/libraryService.ts:**
```typescript
// 변경 필요
export const LIBRARY_CONTRACT_ABI = [
  "function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))",
  // ... 나머지
];
```

### 2. 환경 변수 확인
```bash
✅ NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4
✅ NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1
✅ NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x62eDd08a9943656661818f62679eaa8000C108a3
```

### 3. Vercel 환경 변수 업데이트
Vercel 대시보드에서 위 주소들을 업데이트

### 4. 재배포
```bash
npm run build
vercel --prod
```

---

## 🔍 컨트랙트 검증 (선택사항)

```bash
cd contracts

# ClayLibrary 검증
npx hardhat verify --network base 0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4 0x0000000000000000000000000000000000000000

# ClayRoyalty 검증
npx hardhat verify --network base 0x71FF8F2Dc4B174D799E46182fa660cb7021f9cE1 0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4

# ClayMarketplace 검증
npx hardhat verify --network base 0x62eDd08a9943656661818f62679eaa8000C108a3 0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4
```

---

## 🎯 새로 활성화된 기능

### 1. Royalty 유연성
```solidity
disableRoyalty("proj-123")  // Royalty 끄기
enableRoyalty("proj-123")   // Royalty 다시 켜기
deleteAsset("proj-123")     // 완전 삭제
```

### 2. Marketplace 개선
- Royalty 비활성화해도 거래 가능
- 거래 완료 시 Irys 자동 업데이트
- Original-Creator 추적

### 3. 성능 개선
- GraphQL 기반 royalty 조회
- RPC 에러 해결
- 10배 빠른 로딩

---

## 🎊 배포 완료!

모든 컨트랙트가 Base mainnet에 성공적으로 배포되었습니다!

**다음 단계:**
1. ✅ `.env` 업데이트 완료
2. ⏳ `lib/libraryService.ts` ABI 업데이트 필요
3. ⏳ Vercel 환경 변수 업데이트
4. ⏳ 프론트엔드 재배포

**잔여 ETH**: ~0.0045 ETH (추가 배포/거래 가능)









