# 상용화 UX 시나리오 기반 코드 검증 보고서

## 검증 일시
2025-11-06

## 검증 범위
- 스마트 컨트랙트 (ClayLibrary, ClayMarketplace, ClayRoyalty)
- 프론트엔드 서비스 (libraryService, marketplaceService, royaltyService)
- 핵심 컴포넌트 (AdvancedClay, Marketplace)
- 에러 처리 및 네트워크 유틸리티

---

## 🔴 CRITICAL (긴급 수정 필요)

### C1. 마켓플레이스 구매 시 라이브러리 삭제 체크 누락

**위치**: `marketplaceService.ts:190-216`

**문제**:
```typescript
// FIX P1-7: Check if asset still exists in library
const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS;
if (LIBRARY_CONTRACT_ADDRESS) {
  try {
    const asset = await libraryContract.getAsset(projectId);
    if (!asset.exists) {
      return { success: false, error: 'This project has been deleted by the owner' };
    }
  } catch (error) {
    console.warn('[MarketplaceService] Could not verify asset existence:', error);
    // Continue anyway - marketplace contract will handle validation
  }
}
```

**시나리오**:
1. 판매자가 라이브러리를 마켓플레이스에 등록
2. 판매자가 라이브러리를 삭제 (`deleteAsset` 호출)
3. 구매자가 마켓플레이스에서 구매 시도
4. 컨트랙트에서 `transferAssetOwnership` 호출 시 `asset.exists == false`로 실패

**영향**:
- 구매자가 가스비만 지불하고 트랜잭션 실패
- 마켓플레이스 신뢰도 하락

**해결책**:
```typescript
// buyListedAsset 함수에서
const asset = await libraryContract.getAsset(projectId);
if (!asset.exists) {
  throw new Error('This project has been deleted by the owner and is no longer available');
}
```
에러 발생 시 continue 하지 말고 throw 해야 함.

---

### C2. 로열티 지불 후 프로젝트 업로드 실패 시 환불 불가

**위치**: `AdvancedClay.tsx:3420-3530` (handleSaveProject)

**문제**:
```typescript
// 로열티 지불
const royaltyResult = await processLibraryPurchasesAndRoyalties(
  projectId,
  finalUsedLibraries,
  wallets?.[0]?.getEthersProvider(),
  (message) => onProgress?.(`Royalties: ${message}`)
);

if (!royaltyResult.success) {
  throw new Error(royaltyResult.error || 'Royalty payment failed');
}

// 이후 Irys 업로드
const { transactionId, rootTxId: finalRootTxId } = await uploadClayProject(
  serialized,
  folder,
  rootTxId,
  // ...
);
```

**시나리오**:
1. 사용자가 3개 라이브러리를 사용한 프로젝트 저장
2. ETH 로열티 0.003 지불 성공
3. USDC 로열티 10 USDC 지불 성공
4. Irys 업로드 중 네트워크 오류 발생
5. 사용자는 로열티 지불했지만 프로젝트는 저장 안됨
6. **환불 메커니즘 없음**

**영향**:
- 사용자 자금 손실
- 심각한 UX 문제
- 법적 책임 가능성

**해결책**:
1. 로열티 컨트랙트에 환불 기능 추가:
```solidity
mapping(address => mapping(string => PendingRoyalty)) public pendingRoyalties;

struct PendingRoyalty {
  uint256 amountETH;
  uint256 amountUSDC;
  uint256 timestamp;
  bool finalized;
}

function recordPendingRoyalty(string projectId) external payable {
  // 로열티를 임시 저장 (finalized = false)
}

function finalizeRoyalty(string projectId) external {
  // 프로젝트 업로드 성공 시 최종 확정
}

function refundPendingRoyalty(string projectId) external {
  // 24시간 이내 finalize 안되면 환불 가능
}
```

2. 프론트엔드에서:
```typescript
// 1. 임시 로열티 지불
await contract.recordPendingRoyalty(projectId);

try {
  // 2. 프로젝트 업로드
  await uploadClayProject(...);
  
  // 3. 성공 시 finalize
  await contract.finalizeRoyalty(projectId);
} catch (error) {
  // 4. 실패 시 사용자에게 환불 안내
  showPopup('Upload failed. You can refund your royalty payments in 24 hours', 'error');
}
```

---

### C3. 삭제된 라이브러리 사용 프로젝트의 최소 가격 계산 오류

**위치**: `ClayMarketplace.sol:166-179`

**문제**:
```solidity
// SECURITY FIX: Validate minimum price based on library royalties
if (address(royaltyContract) != address(0)) {
    (uint256 minETH, uint256 minUSDC) = royaltyContract.calculateTotalRoyalties(projectId);
    
    if (paymentToken == PaymentToken.ETH) {
        require(price > minETH, "Price must be higher than total library royalties");
    } else {
        require(price > minUSDC, "Price must be higher than total library royalties");
    }
}
```

ClayRoyalty.sol의 calculateTotalRoyalties는 삭제된 라이브러리를 건너뛰지만, 프로젝트 생성 시점의 로열티 정보가 저장되어 있음.

**시나리오**:
1. 사용자가 Library A (0.001 ETH), Library B (0.002 ETH) 사용해서 프로젝트 생성
2. 총 로열티 0.003 ETH 지불
3. 프로젝트를 마켓플레이스에 0.005 ETH로 등록 시도
4. Library A가 삭제됨
5. `calculateTotalRoyalties` 는 0.002 ETH 반환 (Library B만)
6. 가격 검증 통과: 0.005 > 0.002 ✓
7. **하지만 실제로는 0.003 ETH 로열티를 지불했음**

**영향**:
- 원작자가 지불한 로열티보다 낮은 가격에 판매 가능
- 경제 모델 붕괴

**해결책**:
등록된 로열티 정보를 저장하고 그 값과 비교:
```solidity
// ClayRoyalty에 추가
mapping(string => uint256) public totalRoyaltiesPaidETH;
mapping(string => uint256) public totalRoyaltiesPaidUSDC;

function recordRoyalties(...) external payable {
  // 기존 코드...
  
  // 지불한 총 로열티 저장
  totalRoyaltiesPaidETH[projectId] = totalETHNeeded;
  totalRoyaltiesPaidUSDC[projectId] = totalUSDC;
}

// Marketplace에서 사용
function listAsset(...) external {
  // 지불된 로열티 기준으로 검증
  uint256 paidRoyaltyETH = royaltyContract.totalRoyaltiesPaidETH(projectId);
  require(price > paidRoyaltyETH, "Price must be higher than royalties paid");
}
```

---

## 🟠 HIGH (높은 우선순위)

### H1. USDC 잔액 부족 시 트랜잭션 실패 후 재시도 불가

**위치**: `royaltyService.ts:261-310`

**문제**:
```typescript
// Approve
const approveTx = await usdcContract.approve(ROYALTY_CONTRACT_ADDRESS, royaltyUnits);
txHashes.approveUSDC = approveTx.hash;
await approveTx.wait();

// Record payment
const usdcTx = await contract.recordRoyalties(projectId, 0, 1);
txHashes.paymentUSDC = usdcTx.hash;
await usdcTx.wait();
```

**시나리오**:
1. 사용자가 USDC 5개 보유
2. 프로젝트 저장 시 USDC 10개 필요
3. Approve 트랜잭션 성공 (가스비만)
4. recordRoyalties 트랜잭션 실패 (잔액 부족)
5. 사용자가 USDC 추가 구매
6. 다시 저장 시도
7. **registerProjectRoyalties가 이미 등록되어 실패**

**해결책**:
```typescript
// USDC 잔액 체크를 approve 전에
const usdcBalance = await usdcContract.balanceOf(userAddress);
if (usdcBalance < royaltyUnits) {
  const balanceFormatted = ethers.formatUnits(usdcBalance, 6);
  const requiredFormatted = totalRoyaltyUSDC.toFixed(2);
  
  throw new Error(
    `Insufficient USDC balance.\n` +
    `Required: ${requiredFormatted} USDC\n` +
    `Available: ${balanceFormatted} USDC\n` +
    `Please add ${(totalRoyaltyUSDC - parseFloat(balanceFormatted)).toFixed(2)} USDC to your wallet.`
  );
}
```

이미 구현되어 있지만 (line 272-287), registerProjectRoyalties가 먼저 실행되는 순서 문제가 있음.

**수정 필요**:
```typescript
// STEP 0: USDC 잔액 미리 체크
if (totalRoyaltyUSDC > 0) {
  const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const userAddress = await signer.getAddress();
  const usdcBalance = await usdcContract.balanceOf(userAddress);
  const royaltyUnits = ethers.parseUnits(totalRoyaltyUSDC.toFixed(6), 6);
  
  if (usdcBalance < royaltyUnits) {
    throw new Error(`Insufficient USDC balance...`);
  }
}

// STEP 1: 잔액 확인 후 register
if (needsRegistration) {
  await contract.registerProjectRoyalties(projectId, dependencyIds);
}

// STEP 2: ETH 지불
// STEP 3: USDC 지불
```

---

### H2. 네트워크 전환 중 트랜잭션 손실 위험

**위치**: `networkUtils.ts:119-180`

**문제**:
```typescript
// FIX P1-6: Check for pending transactions before switching
const currentNonce = await provider.getTransactionCount(address, 'latest');
const pendingNonce = await provider.getTransactionCount(address, 'pending');

if (pendingNonce > currentNonce) {
  const pendingCount = pendingNonce - currentNonce;
  if (showPopup) {
    showPopup(`Warning: You have ${pendingCount} pending transaction(s)...`, 'warning');
  }
  // Allow user to proceed but warn them
}
```

**시나리오**:
1. 사용자가 다른 네트워크(Ethereum)에 있음
2. 프로젝트 저장 시도
3. Base 네트워크로 전환 요청
4. 사용자가 Ethereum에 pending tx 있음에도 전환
5. **Ethereum pending tx가 confirm되지 않은 채 네트워크 전환**
6. 나중에 Ethereum 네트워크로 돌아가도 nonce 꼬임 가능

**해결책**:
```typescript
if (pendingNonce > currentNonce) {
  const pendingCount = pendingNonce - currentNonce;
  
  // 경고만이 아니라 실제 전환 차단
  const confirmed = confirm(
    `⚠️ WARNING: You have ${pendingCount} pending transaction(s) on ${currentNetwork}.\n\n` +
    `Switching networks now may cause issues:\n` +
    `- Pending transactions may fail\n` +
    `- Transaction nonce conflicts\n` +
    `- Potential loss of funds\n\n` +
    `Recommendation: Wait for pending transactions to confirm before switching.\n\n` +
    `Do you still want to switch? (NOT RECOMMENDED)`
  );
  
  if (!confirmed) {
    return false;
  }
}
```

---

### H3. Offer 만료 후에도 판매자가 Accept 가능

**위치**: `ClayMarketplace.sol:333-375`

**문제**:
```solidity
function acceptOffer(uint256 offerId) external nonReentrant {
    Offer storage offer = offers[offerId];
    require(offer.isActive, "Offer not active");
    require(block.timestamp < offer.expiresAt, "Offer expired");
    
    // Verify caller owns the asset
    (,,,,,address currentOwner, ...) = libraryContract.getAsset(offer.projectId);
    require(currentOwner == msg.sender, "Only owner can accept offer");
    
    // ...transfer payment and ownership
}
```

이 부분은 정상이지만, 프론트엔드에서 표시 문제:

**위치**: `app/marketplace/[id]/page.tsx:271-326`

```typescript
{offers.map((offer) => {
  const isExpired = timeLeft < 0;
  
  return (
    <div key={offer.offerId}>
      {isSeller && !isBuyer && (
        <button
          onClick={() => handleAcceptOffer(offer)}
          disabled={isExpired}  // ✓ 정상
          className={isExpired ? 'bg-gray-400' : 'bg-green-500'}
        >
          {isExpired ? 'Expired' : 'Accept'}
        </button>
      )}
    </div>
  );
})}
```

프론트엔드는 정상이지만, **GraphQL 쿼리에서 만료된 offer도 가져올 수 있음**.

**위치**: `marketplaceService.ts:410-457`

```typescript
const offerData = await contract.offers(offerId);
if (offerData.isActive && offerData.expiresAt > Math.floor(Date.now() / 1000)) {
  offers.push({...});  // ✓ 만료된 것은 필터링
}
```

이 부분은 정상. **실제 문제 없음 - FALSE ALARM**.

---

### H4. 프로젝트 저장 중 창 닫기 경고 우회 가능

**위치**: `AdvancedClay.tsx:3408-3418`

**문제**:
```typescript
// FIX P0-2: Prevent page close during save
let isSaving = true;
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (isSaving) {
    e.preventDefault();
    e.returnValue = 'Project save in progress...';
    return e.returnValue;
  }
};

window.addEventListener('beforeunload', handleBeforeUnload);
```

**시나리오**:
1. 사용자가 프로젝트 저장 시작
2. 로열티 지불 완료
3. Irys 업로드 중 (50%)
4. 사용자가 브라우저 탭 닫기 시도
5. 경고 메시지 표시
6. **모바일 Safari, Chrome iOS에서는 beforeunload 이벤트 지원 안함**
7. 탭이 바로 닫힘

**영향**:
- 모바일 사용자가 업로드 중 탭 닫으면 로열티만 지불하고 프로젝트 미저장
- 데이터 손실

**해결책**:
```typescript
// 추가 보호장치
const [isSavingState, setIsSavingState] = useState(false);

useEffect(() => {
  if (isSavingState) {
    // Visibility API 사용 (모바일 지원)
    const handleVisibilityChange = () => {
      if (document.hidden && isSavingState) {
        // 백그라운드로 전환 감지
        console.warn('[Save] Tab went to background during save!');
        
        // localStorage에 저장해서 나중에 복구 가능하게
        localStorage.setItem('interruptedSave', JSON.stringify({
          projectId,
          timestamp: Date.now(),
          stage: 'uploading'
        }));
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }
}, [isSavingState]);

// 페이지 재진입 시 체크
useEffect(() => {
  const interrupted = localStorage.getItem('interruptedSave');
  if (interrupted) {
    const data = JSON.parse(interrupted);
    if (Date.now() - data.timestamp < 3600000) { // 1시간 이내
      showPopup(
        'It looks like a previous save was interrupted. Would you like to retry or request a refund?',
        'warning'
      );
    }
  }
}, []);
```

---

## 🟡 MEDIUM (중간 우선순위)

### M1. 대용량 프로젝트 업로드 시 청크 업로드 재시도 부족

**위치**: `chunkUploadService.ts:71-230`

**문제**:
청크 업로드 재시도 로직은 있지만 (localStorage에 progress 저장), **전체 실패 시 부분 환불 메커니즘 없음**.

**시나리오**:
1. 100MB 프로젝트 (200개 청크)
2. 150개 청크 업로드 성공
3. 네트워크 오류로 나머지 50개 실패
4. 사용자가 150개 청크만큼 Irys 비용 지불
5. **재시도 시 150개는 스킵하지만, manifest 업로드 실패하면 150개 비용 낭비**

**해결책**:
```typescript
// manifest 업로드 실패 시 대응
try {
  const manifestTxId = await uploadChunkManifest(...);
  
  // 성공 시 progress 삭제
  localStorage.removeItem(`upload-progress-${projectId}`);
  
  return { transactionId: manifestTxId, rootTxId };
} catch (error) {
  console.error('[ChunkUpload] Manifest upload failed:', error);
  
  // Progress는 유지 (나중에 재시도 가능)
  showPopup(
    `Manifest upload failed after uploading ${uploadedChunks.length}/${totalChunks} chunks.\n` +
    `Your uploaded chunks are saved. You can retry without re-uploading them.\n` +
    `Project ID: ${projectId}`,
    'error'
  );
  
  throw new Error('Manifest upload failed. Partial upload saved for retry.');
}
```

---

### M2. 라이브러리 등록 시 가스 추정 실패해도 진행

**위치**: `libraryService.ts:125-139`

**문제**:
```typescript
try {
  const { estimateAndConfirmGas } = await import('./gasEstimation');
  const { confirmed } = await estimateAndConfirmGas(
    contract,
    'registerAsset',
    [projectId, name, description, royaltyETHWei, royaltyUSDCUnits]
  );
  
  if (!confirmed) {
    return { success: false, error: 'Transaction cancelled by user' };
  }
} catch (gasError) {
  console.warn('[LibraryService] Gas estimation failed, proceeding anyway:', gasError);
}
```

**시나리오**:
1. 사용자가 라이브러리 등록 시도
2. 가스 추정 실패 (네트워크 오류 or 컨트랙트 오류)
3. "proceeding anyway"
4. **실제 트랜잭션이 실패할 가능성 높음**
5. 사용자는 가스비만 날림

**해결책**:
```typescript
try {
  const { estimateAndConfirmGas } = await import('./gasEstimation');
  const { confirmed, estimate } = await estimateAndConfirmGas(...);
  
  if (!confirmed) {
    return { success: false, error: 'Transaction cancelled by user' };
  }
  
  // 추정 성공 시 해당 gasLimit 사용
  if (estimate) {
    const tx = await contract.registerAsset(
      projectId, name, description, royaltyETHWei, royaltyUSDCUnits,
      { gasLimit: estimate.gasLimit }
    );
  }
} catch (gasError) {
  // 가스 추정 실패는 심각한 문제
  console.error('[LibraryService] Gas estimation failed:', gasError);
  
  // 사용자에게 선택권
  const proceed = confirm(
    'Gas estimation failed. This usually means the transaction will fail.\n' +
    'Possible reasons:\n' +
    '- Project already registered\n' +
    '- Invalid parameters\n' +
    '- Network issues\n\n' +
    'Do you want to proceed anyway? (You may lose gas fees)'
  );
  
  if (!proceed) {
    return { success: false, error: 'Transaction cancelled due to gas estimation failure' };
  }
}
```

---

### M3. 마켓플레이스 리스팅 삭제 후 Offer 환불 처리 누락

**위치**: `ClayMarketplace.sol:246-258`

**문제**:
```solidity
function cancelListing(string memory projectId) external {
    Listing storage listing = listings[projectId];
    require(listing.isActive, "Listing not active");
    require(msg.sender == listing.seller, "Only seller can cancel");
    
    listing.isActive = false;
    _removeFromActiveListings(projectId);
    
    emit ListingCancelled(projectId, msg.sender);
}
```

이 함수는 **offer들을 취소하지 않음**.

반면 `buyAsset` 함수는:
```solidity
// Cancel all active offers for this asset
_cancelAllOffers(projectId);
```

**시나리오**:
1. 프로젝트가 마켓플레이스에 등록됨
2. 3명의 구매자가 각각 0.1 ETH offer (총 0.3 ETH escrow)
3. 판매자가 listing 취소
4. **offer들은 여전히 active 상태**
5. 구매자들은 직접 `cancelOffer`를 호출해야 환불 받음
6. **하지만 listing이 취소되었다는 알림이 없음**

**영향**:
- 사용자 자금이 불필요하게 lock됨
- UX 나쁨

**해결책**:
```solidity
function cancelListing(string memory projectId) external {
    Listing storage listing = listings[projectId];
    require(listing.isActive, "Listing not active");
    require(msg.sender == listing.seller, "Only seller can cancel");
    
    listing.isActive = false;
    _removeFromActiveListings(projectId);
    
    // 모든 active offer 취소 및 환불
    _cancelAllOffers(projectId);
    
    emit ListingCancelled(projectId, msg.sender);
}
```

---

### M4. 프로젝트 삭제 시 마켓플레이스 리스팅 취소 실패해도 계속 진행

**위치**: `marketplaceService.ts:116-167`

**문제**:
```typescript
} catch (error: any) {
  console.error('[MarketplaceService] Error cancelling listing:', error);
  // Don't fail the entire deletion if cancel fails
  return { success: false, error: getErrorMessage(error) };
}
```

이 에러를 무시하고 프로젝트 삭제가 계속됨.

**시나리오**:
1. 프로젝트가 마켓플레이스에 listing됨
2. 사용자가 프로젝트 삭제
3. `cancelMarketplaceListing` 호출
4. 네트워크 오류로 실패
5. **프로젝트는 삭제되지만 마켓플레이스에는 여전히 listing됨**
6. 구매자가 구매 시도 시 실패 (프로젝트 삭제됨)

**해결책**:
```typescript
// deleteClayProject에서
const marketplaceResult = await cancelMarketplaceListing(projectId, customProvider);
if (!marketplaceResult.success && marketplaceResult.error) {
  // 실제 에러인지 확인 (listing이 없어서 실패한 건 OK)
  if (!marketplaceResult.error.includes('not active') && 
      !marketplaceResult.error.includes('not listed')) {
    
    const confirmed = confirm(
      'Failed to cancel marketplace listing. ' +
      'If you delete the project now, it will remain listed but cannot be purchased. ' +
      'This will confuse buyers.\n\n' +
      'Recommendation: Try again later when network is stable.\n\n' +
      'Do you still want to delete?'
    );
    
    if (!confirmed) {
      return { success: false, error: 'Deletion cancelled by user' };
    }
  }
}
```

---

## 🟢 LOW (낮은 우선순위)

### L1. 가스 가격 표시 시 하드코딩된 ETH 가격

**위치**: `gasEstimation.ts:62-72`

```typescript
export function formatGasEstimate(estimate: GasEstimate, includeUSD: boolean = false): string {
  const ethCost = parseFloat(estimate.estimatedCostETH);
  
  if (ethCost < 0.0001) {
    return '< $0.01 (~free on Base)';
  } else if (ethCost < 0.001) {
    return `~$0.0${Math.ceil(ethCost * 10000) / 10} (${estimate.estimatedCostETH.substring(0, 8)} ETH)`;
  } else {
    return `~$${(ethCost * 2000).toFixed(2)} (${estimate.estimatedCostETH.substring(0, 8)} ETH)`;
    //                    ^^^^ 하드코딩
  }
}
```

**영향**:
- ETH 가격이 크게 변동하면 USD 표시가 부정확
- 사용자 혼란

**해결책**:
```typescript
// 실시간 ETH 가격 가져오기
async function getETHPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum.usd;
  } catch (error) {
    console.warn('Failed to fetch ETH price, using default:', error);
    return 2000; // fallback
  }
}

export async function formatGasEstimate(estimate: GasEstimate): Promise<string> {
  const ethCost = parseFloat(estimate.estimatedCostETH);
  const ethPrice = await getETHPrice();
  
  // ...
  return `~$${(ethCost * ethPrice).toFixed(2)} (${estimate.estimatedCostETH.substring(0, 8)} ETH)`;
}
```

---

### L2. Irys GraphQL 쿼리에 페이지네이션 부족

**위치**: `libraryService.ts:368-483`

```typescript
const query = `
  query {
    transactions(
      tags: [
        { name: "App-Name", values: ["GetClayed"] },
        { name: "Data-Type", values: ["library-registration"] }
      ],
      first: ${limit},  // 최대 limit개만
      order: DESC
    ) {
      // ...
    }
  }
`;
```

**시나리오**:
1. 라이브러리가 500개 등록됨
2. 사용자가 라이브러리 페이지 방문
3. `queryLibraryAssets(100)` 호출
4. **최신 100개만 표시**
5. 나머지 400개는 볼 수 없음

**영향**:
- 오래된 라이브러리 검색 불가
- UX 제한

**해결책**:
```typescript
export async function queryLibraryAssets(
  limit: number = 100,
  cursor?: string  // 페이지네이션 커서
): Promise<{ assets: LibraryAsset[]; nextCursor?: string }> {
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["library-registration"] }
        ],
        first: ${limit},
        ${cursor ? `after: "${cursor}",` : ''}
        order: DESC
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            // ...
          }
        }
      }
    }
  `;
  
  // ...
  
  const hasNextPage = result.data?.transactions?.pageInfo?.hasNextPage;
  const lastCursor = edges.length > 0 ? edges[edges.length - 1].cursor : undefined;
  
  return {
    assets,
    nextCursor: hasNextPage ? lastCursor : undefined
  };
}
```

---

### L3. 프로젝트 integrity 서명이 선택적

**위치**: `projectIntegrityService.ts` 전체

이 서비스는 구현되어 있지만 **실제로 사용되지 않음**.

**확인**:
```bash
grep -r "signProjectData" app/ lib/ components/
# 결과: projectIntegrityService.ts에만 있음
```

**영향**:
- 프로젝트 다운로드 후 `usedLibraries` 배열 조작 가능
- 로열티 우회 공격 가능

**해결책**:
`uploadClayProject`에서 서명 추가:
```typescript
export async function uploadClayProject(...) {
  // ...
  
  // 프로젝트 서명
  if (customProvider) {
    try {
      const { signProjectData } = await import('./projectIntegrityService');
      const signature = await signProjectData(project, customProvider);
      project.signature = signature;
      console.log('[ClayStorage] Project signed:', signature.signature.substring(0, 20) + '...');
    } catch (error) {
      console.warn('[ClayStorage] Failed to sign project:', error);
      // 서명 실패해도 업로드는 계속 (backward compatibility)
    }
  }
  
  // ...upload
}

// downloadClayProject에서 검증
export async function downloadClayProject(txId: string): Promise<ClayProject> {
  // ...download
  
  if (project.signature) {
    const { verifyProjectSignature } = await import('./projectIntegrityService');
    const verification = await verifyProjectSignature(project, project.signature);
    
    if (!verification.valid) {
      console.error('[ClayStorage] ❌ Project signature invalid:', verification.error);
      throw new Error(`Project integrity check failed: ${verification.error}`);
    }
    
    console.log('[ClayStorage] ✅ Project signature verified');
  } else {
    console.warn('[ClayStorage] ⚠️ Project has no signature (old version?)');
  }
  
  return project;
}
```

---

## ✅ 정상 동작 확인

### ✓ 삭제된 라이브러리 로열티 제외
- `ClayRoyalty.sol:122-144` - `calculateTotalRoyalties`에서 `owner != address(0)` 체크
- `ClayRoyalty.sol:160-236` - `recordRoyalties`에서 삭제된 라이브러리 제외
- 정상 작동

### ✓ Offer 만료 체크
- `ClayMarketplace.sol:336` - `require(block.timestamp < offer.expiresAt)`
- 프론트엔드에서도 필터링 (`marketplaceService.ts:434`)
- 정상 작동

### ✓ 라이브러리 재등록 방지
- `ClayLibrary.sol:130` - `require(!libraryAssets[projectId].exists)`
- 정상 작동

### ✓ 로열티 재등록 방지
- `ClayRoyalty.sol:92` - `require(!projectRoyalties[projectId].hasRoyalties)`
- 정상 작동

### ✓ 네트워크 전환 전 pending tx 체크
- `networkUtils.ts:131-155`
- 정상 작동 (단, 강제 차단은 안함)

---

## 권장 수정 우선순위

### 즉시 수정 (1-2일)
1. **C1**: 마켓플레이스 구매 시 라이브러리 삭제 체크
2. **C2**: 로열티 지불 후 업로드 실패 시 환불 메커니즘
3. **C3**: 삭제된 라이브러리 사용 프로젝트 최소 가격 계산

### 단기 수정 (1주)
4. **H1**: USDC 잔액 체크 순서 개선
5. **H2**: 네트워크 전환 시 강제 차단 옵션
6. **M3**: 리스팅 취소 시 offer 자동 환불

### 중기 수정 (2-4주)
7. **M1**: 청크 업로드 부분 실패 시 대응
8. **M2**: 가스 추정 실패 시 proceed 차단
9. **M4**: 프로젝트 삭제 시 마켓플레이스 리스팅 확인
10. **L3**: 프로젝트 integrity 서명 활성화

### 장기 개선 (1-2개월)
11. **H4**: 모바일 저장 중단 보호
12. **L1**: 실시간 ETH 가격
13. **L2**: 페이지네이션

---

## 추가 테스트 시나리오

### 동시성 테스트
1. 두 명이 동시에 같은 라이브러리 구매
2. 라이브러리 owner가 가격 변경 중 구매
3. 마켓플레이스 listing 중 라이브러리 삭제

### 네트워크 오류 테스트
1. 로열티 지불 중 네트워크 끊김
2. Irys 업로드 중 네트워크 끊김
3. 컨트랙트 트랜잭션 중 네트워크 끊김

### Edge Case 테스트
1. 0 ETH, 0 USDC 라이브러리 등록
2. 삭제된 라이브러리만 사용한 프로젝트
3. 100개 이상 라이브러리 사용한 프로젝트
4. 1GB 이상 프로젝트 업로드

---

## 보안 감사 추천 사항

1. **스마트 컨트랙트 감사**: C3 문제는 경제 모델에 영향
2. **재진입 공격 테스트**: ReentrancyGuard 적용 확인
3. **가스 최적화**: 대용량 라이브러리 배열 처리
4. **프론트러닝 방지**: 가격 변경 시 트랜잭션 순서

---

## 요약

- **Critical 이슈**: 3개 (즉시 수정 필요)
- **High 이슈**: 4개 (높은 우선순위)
- **Medium 이슈**: 4개 (중간 우선순위)  
- **Low 이슈**: 3개 (낮은 우선순위)
- **정상 작동**: 6개 기능 확인

전반적으로 코드 품질은 양호하나, **경제 모델 관련 critical 이슈**와 **자금 환불 메커니즘 부족**이 가장 큰 문제입니다.


