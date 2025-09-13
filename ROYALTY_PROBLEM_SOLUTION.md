# Pending Royalty 문제 해결 보고서

## 문제 상황

**지불자**: `0xad6c8211dfbb44b090926f6143f8daf98fc35aaa`  
**Library 소유자**: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`  
**업로드된 프로젝트**: `clay-1761204410573-ifbnln8v7` ("rocks")  
**사용한 Library**: `clay-1761204239818-kqn059jib` ("rock", 0.001 USDC royalty)

---

## CLI 조사 결과

### 1. Pending Royalties 확인
```bash
$ node scripts/checkRoyalties.js 0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00

결과:
💰 PENDING ROYALTIES
ETH: 0.0 ETH
USDC: 0.0 USDC
⚠️ No pending royalties
```

### 2. 프로젝트 Dependency 확인
```bash
$ node scripts/checkRoyalties.js 0xad6c8211... clay-1761204410573-ifbnln8v7

결과:
⚠️ No dependencies registered for this project
   This means registerProjectRoyalties was never called,
   or the registration failed.
```

### 3. Irys 데이터 확인 ✅
```bash
$ curl https://uploader.irys.xyz/tx/Gef1THEeqAiECrxKnsn5nwqhdSLbu1RvPicAhMUzV8Ta/data

결과:
✅ 프로젝트 업로드됨
✅ usedLibraries 포함:
   [{
     "projectId": "clay-1761204239818-kqn059jib",
     "name": "rock",
     "royaltyPerImportETH": "0.0",
     "royaltyPerImportUSDC": "0.001",
     "creator": "0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00"
   }]
```

---

## 원인 규명

### ❌ 문제: `registerProjectRoyalties` 트랜잭션이 실행되지 않음

프로젝트 데이터는 Irys에 업로드되었지만, 블록체인 royalty 등록이 실패했습니다.

### 가능한 원인

#### 1. ROYALTY_CONTRACT_ADDRESS가 undefined (과거 코드)
```typescript
// 과거 코드 (문제)
if (ROYALTY_CONTRACT_ADDRESS) {
  // royalty 처리
}
// ← undefined면 아무것도 안하고 success: true 반환
return { success: true }
```

#### 2. 트랜잭션 서명 거부
- 사용자가 트랜잭션 서명을 거부했지만
- 에러를 catch하고 계속 진행

#### 3. 가스비 부족
- 트랜잭션 전송 시도했지만 가스비 부족으로 실패
- 하지만 에러 처리가 부족해서 계속 진행

---

## 해결 방안 (모두 적용됨)

### 1. Contract Address 필수 체크 ✅
```typescript
// lib/royaltyService.ts
if (!ROYALTY_CONTRACT_ADDRESS) {
  console.error('[RoyaltyService] ❌ ROYALTY_CONTRACT_ADDRESS not configured!');
  throw new Error('Royalty contract not deployed. Cannot process library royalties.');
}
// 이제 contract 주소가 없으면 업로드가 중단됨
```

### 2. 상세한 진행 메시지 ✅
```typescript
onProgress?.(`[1/4] Registering ${usedLibraries.length} library dependencies (${libraryNames}). Please sign...`);
onProgress?.(`[2/4] Paying 0.001000 USDC royalty for: rock (0.001 USDC). Please sign...`);
```

### 3. 트랜잭션 완료 로그 ✅
```typescript
console.log('[RoyaltyService] ✅ All royalty transactions completed successfully');
```

### 4. 실패 시 업로드 차단 ✅
```typescript
if (!result.success) {
  throw new Error(result.error || 'Failed to process library purchases')
}
// throw되면 Irys 업로드 실행 안됨
```

---

## 다음 테스트 시 확인할 사항

### 업로드 시:
1. 각 팝업 메시지 확인:
   ```
   [1/4] Registering 1 library dependencies (rock). Please sign...
   [1/4] Waiting for registration confirmation...
   [2/3] Approving 0.00 USDC for royalty payment. Please sign...
   [2/3] Waiting for USDC approval confirmation...
   [3/3] Paying 0.00 USDC royalty for: rock (0.001 USDC). Please sign...
   [3/3] Waiting for USDC payment confirmation...
   ```

2. 콘솔 로그 확인:
   ```
   [RoyaltyService] Registering project royalties...
   [RoyaltyService] Project royalties registered
   [RoyaltyService] Paying USDC royalties...
   [RoyaltyService] ✅ Paid 0.001 USDC in royalties
   [RoyaltyService] ✅ All royalty transactions completed successfully
   ```

### 업로드 후:
```bash
# 프로젝트 dependency 확인
node scripts/checkRoyalties.js 0xad6c8211... <new-project-id>

# 예상 결과:
# ✅ Has 1 registered dependencies
#    1. Dependency: clay-1761204239818-kqn059jib
#       Fixed Royalty: 0.0 ETH, 0.001 USDC

# Library 소유자 pending 확인
node scripts/checkRoyalties.js 0x356c5AB9...

# 예상 결과:
# ✅ USDC: 0.001 USDC (claim 가능)
```

---

## 과거 프로젝트 문제

현재 조사한 프로젝트 `clay-1761204410573-ifbnln8v7`는:
- ✅ Irys 업로드 완료
- ❌ Royalty 등록 실패
- ❌ Pending royalties 없음

**이유**: 코드 수정 전에 업로드되어 royalty 처리가 실패했습니다.

---

## 현재 코드로 재테스트 필요

수정된 코드로 다시 테스트하면 정상 작동할 것입니다:
1. ✅ Contract 주소 체크 (없으면 에러)
2. ✅ 순서 수정 (register → pay)
3. ✅ 상세한 진행 메시지
4. ✅ 실패 시 업로드 차단

새로운 library를 등록하고 다른 계정에서 import하여 업로드해주세요!

