# 라이브러리 중첩 의존성 로열티 이중 계산 버그 보고서

## 발생 일시
2025년 11월 11일

## 문제 요약
사용자가 라이브러리를 사용하여 프로젝트를 저장할 때, 예상 비용보다 2배의 금액이 청구되는 버그가 발견되었습니다.

## 상세 내용

### 시나리오
1. 사용자가 `star and rock` 라이브러리 (0.002 USDC) 사용
2. `star and rock` 라이브러리는 내부적으로 `star` 라이브러리 (0.001 USDC)를 import함
3. 프로젝트 저장 시:
   - 예상 비용: 0.002 USDC (최상위 라이브러리만 지불)
   - 실제 청구: 0.006 USDC

### 콘솔 로그 분석
```
[LibraryService] Current blockchain state for clay-1762778027561-uipsn5co1: {eth: '0.0', usdc: '0.002', exists: true, enabled: true}
[LibraryService] Current blockchain state for clay-1762611903384-mmvp7omtn: {eth: '0.0', usdc: '0.001', exists: true, enabled: true}
[RoyaltyService] Total libraries: 2
[RoyaltyService] Active libraries: 2
[RoyaltyService] Active libraries:
  1. star and rock: 0 ETH, 0.002 USDC
  2. star: 0 ETH, 0.001 USDC
[RoyaltyService] Total royalties (current blockchain values) - ETH: 0 USDC: 0.006
```

## 근본 원인

### 1. 코드 중복 계산 버그
`lib/royaltyService.ts`의 91-98번째 줄과 128-135번째 줄에서 동일한 로열티 계산이 두 번 수행되고 있음:

```typescript
// 첫 번째 계산 (91-98줄)
for (const library of activeLibraries) {
  const state = currentStates.get(library.projectId);
  if (state) {
    totalRoyaltyETH += state.ethAmount;
    totalRoyaltyUSDC += state.usdcAmount;
  }
}

// ... 중간 코드 ...

// 두 번째 계산 (128-135줄) - 중복!
for (const library of activeLibraries) {
  const state = currentStates.get(library.projectId);
  if (state) {
    totalRoyaltyETH += state.ethAmount;
    totalRoyaltyUSDC += state.usdcAmount;
  }
}
```

### 2. 중첩 의존성 처리 문제
- 사용자가 직접 import한 라이브러리만 비용을 지불해야 함
- 라이브러리가 내부적으로 사용하는 다른 라이브러리는 이미 해당 라이브러리 제작자가 지불했음
- 현재는 모든 중첩된 의존성에 대해서도 비용을 청구하는 것으로 보임

## 영향도
- **심각도**: 높음
- **영향 범위**: 중첩된 라이브러리를 사용하는 모든 사용자
- **재정적 영향**: 사용자가 예상보다 2배 이상의 비용을 지불하게 됨

## 해결 방안

### 즉시 수정 (완료)
1. `lib/royaltyService.ts`에서 중복된 계산 루프 제거

### 추가 확인 필요
1. 중첩 의존성 처리 로직 검토
   - 직접 import한 라이브러리만 비용 청구
   - 간접 의존성은 비용 청구하지 않도록 수정

2. 스마트 컨트랙트 검증
   - 컨트랙트 레벨에서도 중복 계산이 있는지 확인 필요

## 사용자 대응
1. 이미 과다 청구된 사용자들에 대한 보상 방안 검토
2. 버그 수정 공지 및 사과문 게시
3. 향후 유사한 문제 방지를 위한 테스트 케이스 추가

## 테스트 시나리오
1. 단일 라이브러리 사용 시 정확한 비용 청구 확인
2. 중첩 의존성이 있는 라이브러리 사용 시 최상위 라이브러리 비용만 청구 확인
3. 여러 독립 라이브러리 사용 시 정확한 합계 계산 확인
