# RPC 최적화 가이드 (Rate Limit 문제 해결)

## 문제 상황

라이브러리 페이지 로딩 시 많은 프로젝트의 블록체인 데이터를 조회하면서 RPC 엔드포인트에서 429 (Too Many Requests) 오류가 발생하는 문제가 있었습니다.

## 해결 방법

### 1. RPC Provider 시스템 개선

새로운 `rpcProvider.ts` 모듈을 만들어 다음 기능을 구현했습니다:

- **Rate Limiting**: 초당 최대 2개의 요청만 허용
- **Cooldown Period**: 429 오류 발생 시 5초 대기
- **Multiple RPC Endpoints**: 5개의 다른 RPC 엔드포인트를 순환하며 사용
- **Provider Caching**: 성공한 프로바이더를 재사용
- **Batch Processing**: 여러 요청을 배치로 처리

### 2. 구현된 개선사항

#### libraryService.ts
- `queryLibraryAssets`: 개별 쿼리 대신 배치 쿼리 사용
- `getLibraryCurrentRoyalties`: 배치 호출로 블록체인 상태 조회

#### royaltyClaimService.ts
- `getPendingRoyalties`: 새로운 RPC 시스템 사용

### 3. RPC 엔드포인트 목록

```typescript
const RPC_ENDPOINTS = [
  'https://mainnet.base.org',      // Base 공식
  'https://base.meowrpc.com',      // MeowRPC
  'https://base.publicnode.com',   // PublicNode
  'https://1rpc.io/base',          // 1RPC
  'https://base-rpc.publicnode.com' // PublicNode 대체
];
```

## 사용 방법

### 1. 단일 컨트랙트 호출

```typescript
import { executeContractCall } from '@/lib/rpcProvider';

const result = await executeContractCall<ReturnType>(
  contractAddress,
  abi,
  'methodName',
  [arg1, arg2]
);
```

### 2. 배치 컨트랙트 호출

```typescript
import { batchContractCalls } from '@/lib/rpcProvider';

const calls = projectIds.map(id => ({
  contractAddress: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  method: 'getAsset',
  args: [id]
}));

const results = await batchContractCalls<AssetType>(calls);
```

## 성능 개선 결과

- **이전**: 프로젝트당 최대 6번의 RPC 요청 (3개 엔드포인트 × 2번 시도)
- **이후**: 
  - 배치 처리로 요청 수 대폭 감소
  - Rate limiting으로 429 오류 방지
  - 여러 엔드포인트로 안정성 향상

## 추가 권장사항

### 1. 프리미엄 RPC 서비스 사용

무료 RPC 엔드포인트는 속도 제한이 있으므로, 프로덕션 환경에서는 다음 서비스 사용을 고려하세요:

- [Alchemy](https://www.alchemy.com/)
- [Infura](https://infura.io/)
- [QuickNode](https://www.quicknode.com/)
- [Chainstack](https://chainstack.com/)

### 2. 환경변수 설정

`.env.local`에 프리미엄 RPC URL을 설정할 수 있습니다:

```bash
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### 3. 캐싱 전략

자주 조회되는 블록체인 데이터는 프론트엔드에서 캐싱하여 RPC 요청을 줄일 수 있습니다.

## 디버깅

콘솔에서 다음 로그를 확인할 수 있습니다:

- `[RPC] Successfully connected to ...` - 성공적인 연결
- `[RPC] Rate limited on ...` - 속도 제한 감지
- `[RPC] In cooldown period, waiting ...ms` - 대기 중
- `[LibraryService] Batch querying ... assets` - 배치 처리 시작

## 주의사항

1. 사용자의 개인 지갑 프로바이더(Privy)를 사용할 때는 기존 방식을 유지합니다.
2. 읽기 전용 작업에만 공용 RPC를 사용하고, 쓰기 작업은 사용자의 지갑 프로바이더를 사용합니다.
3. 브라우저 환경에서만 작동하므로 서버 사이드 렌더링 시 주의가 필요합니다.
