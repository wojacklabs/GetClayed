# 🔍 상용화 코드 리뷰 - 최종 검증

## 📅 분석 일자
2025-11-06

## 🎯 분석 목적
상용화 환경에서 발생 가능한 모든 UX 시나리오를 코드 레벨에서 직접 검증하고 누락된 결함 발견

---

## 📋 검증 항목

### 1. 스마트 컨트랙트 검증 ✅
### 2. 프론트엔드 서비스 레이어 검증 ⏳
### 3. 메인 컴포넌트 UX 플로우 검증 ⏳
### 4. 에러 처리 및 복구 메커니즘 검증 ⏳
### 5. 동시성 및 트랜잭션 안전성 검증 ⏳
### 6. 네트워크 및 지갑 연결 관리 검증 ⏳

---

## 🔴 발견된 새로운 이슈

### 이슈 #1: ClayMarketplace - 가스 부족 시 사용자 자금 손실 위험

**파일**: `contracts/ClayMarketplace.sol:200-248`

**시나리오**:
```solidity
function buyAsset(string memory projectId) external payable nonReentrant {
    // ...
    if (listing.paymentToken == PaymentToken.ETH) {
        require(msg.value >= listing.price, "Insufficient ETH payment");
        
        // 1. 판매자에게 지불
        (bool success, ) = listing.seller.call{value: sellerPayment}("");
        require(success, "Payment to seller failed");
        
        // 2. 초과 금액 환불
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - listing.price}("");
            require(refundSuccess, "Refund failed");  // ❌ 위험!
        }
    }
    
    // 3. 소유권 이전
    libraryContract.transferAssetOwnership(projectId, msg.sender);  // 가스 많이 소모
    
    // 4. 리스팅 비활성화
    listing.isActive = false;
    _removeFromActiveListings(projectId);  // 가스 많이 소모
    
    // 5. 오퍼 취소
    _cancelAllOffers(projectId);  // 가스 많이 소모 + 여러 refund 호출
}
```

**문제**:
1. 사용자가 정확한 가격보다 많은 ETH 전송
2. 판매자 지불 성공
3. 환불 시도 → 남은 가스 부족으로 실패
4. 전체 트랜잭션 revert
5. 결과: 사용자 ETH는 차감됐지만 구매 실패!

**영향도**: 🔴 높음 (자금 손실)

**해결 방안**:
```solidity
function buyAsset(string memory projectId) external payable nonReentrant {
    // ...
    
    // ✅ FIX: 정확한 금액만 받기
    if (listing.paymentToken == PaymentToken.ETH) {
        require(msg.value == listing.price, "Exact ETH amount required");
        
        // 환불 로직 제거 → 가스 절약 + 안전
        (bool success, ) = listing.seller.call{value: sellerPayment}("");
        require(success, "Payment to seller failed");
    }
    
    // ... 나머지 로직
}
```

---

### 이슈 #2: ClayRoyalty - 삭제된 라이브러리 재활성화 시 로열티 중복 청구

**파일**: `contracts/ClayRoyalty.sol:122-144`

**시나리오**:
```
1. User가 Library A import → Project X 저장
   - registerProjectRoyalties(projectX, [A])
   - recordRoyalties 1.0 ETH 지불
   
2. Library A 소유자가 deleteAsset() 호출
   - exists = false
   
3. User가 Project X 업데이트
   - calculateTotalRoyalties(projectX):
     - Library A owner = address(0) (삭제됨)
     - return totalETH = 0 ✅
   - needsRoyaltyPayment = false (이벤트 있음)
   - return early { totalCostETH: 0 } ✅
   
4. Library A 소유자가 Library 재등록 (같은 projectId)
   - exists = true
   - 같은 owner address
   
5. User가 Project X 다시 업데이트
   - calculateTotalRoyalties(projectX):
     - Library A owner = 0x123... (재활성화!)
     - return totalETH = 1.0 ETH ❌❌❌
   - needsRoyaltyPayment = false (이벤트 있음)
   - BUT calculateTotalRoyalties는 1.0 ETH 반환!
```

**문제**: 
- `calculateTotalRoyalties`는 현재 블록체인 상태만 봄
- 이미 지불한 로열티인지 확인 안함
- 재활성화된 라이브러리에 대해 중복 청구 가능

**코드 확인**:
```solidity
function calculateTotalRoyalties(string memory projectId) public view returns (uint256 totalETH, uint256 totalUSDC) {
    ProjectRoyalties storage royalty = projectRoyalties[projectId];
    
    if (!royalty.hasRoyalties) {
        return (0, 0);
    }
    
    // FIX: 이미 등록된 dependencies의 FIXED 값을 합산
    // 삭제/재활성화와 무관하게 등록 시점의 값 사용
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        LibraryDependency memory dep = royalty.dependencies[i];
        
        address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
        
        // ❌ 문제: owner가 다시 활성화되면 다시 카운트됨
        if (owner != address(0)) {
            totalETH += dep.fixedRoyaltyETH;
            totalUSDC += dep.fixedRoyaltyUSDC;
        }
    }
    
    return (totalETH, totalUSDC);
}
```

**실제 사용 코드** (`lib/royaltyService.ts:143-180`):
```typescript
// 등록 여부 확인
const existingDeps = await contract.getProjectDependencies(projectId);

if (existingDeps && existingDeps.length >= 0) {
  needsRegistration = false;
  
  // 지불 여부 확인
  const filter = contract.filters.RoyaltyRecorded(projectId);
  const events = await contract.queryFilter(filter, -100000);
  
  if (events.length > 0) {
    // ✅ 이미 지불함
    needsRoyaltyPayment = false;
  } else {
    // ⚠️ 등록만 되고 지불 안함
    needsRoyaltyPayment = true;
  }
}
```

**현재 방어 메커니즘**: ✅ 있음!
- `RoyaltyRecorded` 이벤트 확인
- 이벤트가 있으면 `needsRoyaltyPayment = false`
- 재지불 방지됨

**결론**: ✅ **안전함** (이벤트 기반 체크로 해결됨)

---

### 이슈 #3: Marketplace - 오퍼 만료 후에도 자금 락됨

**파일**: `contracts/ClayMarketplace.sol:289-332`

**시나리오**:
```solidity
function makeOffer(
    string memory projectId,
    uint256 offerPrice,
    PaymentToken paymentToken,
    uint256 duration
) external payable {
    // ...
    uint256 expiresAt = block.timestamp + duration;
    
    // ETH를 컨트랙트에 escrow
    if (paymentToken == PaymentToken.ETH) {
        require(msg.value == offerPrice, "ETH amount mismatch");
    }
    
    Offer memory newOffer = Offer({
        projectId: projectId,
        buyer: msg.sender,
        offerPrice: offerPrice,
        paymentToken: paymentToken,
        offeredAt: block.timestamp,
        expiresAt: expiresAt,  // 만료 시간
        isActive: true
    });
    
    offers[offerId] = newOffer;
    // ❌ 문제: 만료되어도 자동으로 환불 안됨!
}
```

**문제**:
1. User가 오퍼 생성 (1.0 ETH, 24시간)
2. 24시간 경과
3. offer.expiresAt < block.timestamp
4. 하지만 자금은 여전히 컨트랙트에 락됨!
5. User가 수동으로 `cancelOffer()` 호출해야 환불 받음

**사용자 경험**:
```
User: "24시간 지났는데 왜 내 ETH가 안돌아와?"
→ cancelOffer() 직접 호출해야 함
→ 추가 가스비 발생
```

**해결 방안**:
```solidity
// ✅ Option 1: acceptOffer에서 만료 체크 (현재 구현됨)
function acceptOffer(uint256 offerId) external nonReentrant {
    Offer storage offer = offers[offerId];
    require(offer.isActive, "Offer not active");
    require(block.timestamp < offer.expiresAt, "Offer expired");  // ✅ 있음!
    // ...
}

// ✅ Option 2: 사용자에게 명확한 안내
// Frontend에서 만료된 오퍼 자동 감지 및 cancelOffer 버튼 표시
```

**현재 상태**: ⚠️ **부분적으로 안전**
- acceptOffer에서 만료 체크 ✅
- 하지만 자동 환불은 없음 (가스비 이유로 의도적)
- **프론트엔드에서 UX 개선 필요**

---

### 이슈 #4: Library - 무료 라이브러리 등록 가능하지만 검증 누락

**파일**: `contracts/ClayLibrary.sol:120-150`

**코드**:
```solidity
function registerAsset(
    string memory projectId,
    string memory name,
    string memory description,
    uint256 royaltyPerImportETH,
    uint256 royaltyPerImportUSDC
) external {
    require(bytes(projectId).length > 0, "Project ID cannot be empty");
    
    // FIX: Allow free libraries (0 ETH, 0 USDC) for community contributions
    // require(royaltyPerImportETH > 0 || royaltyPerImportUSDC > 0, "At least one royalty must be set");
    
    require(!libraryAssets[projectId].exists, "Asset already registered");
    
    // ❌ 문제: 0 ETH, 0 USDC 가능
    // → 하지만 Marketplace에서는?
}
```

**Marketplace 검증** (`contracts/ClayMarketplace.sol:156-179`):
```solidity
function listAsset(string memory projectId, uint256 price, PaymentToken paymentToken) external {
    require(price > 0, "Price must be greater than 0");  // ✅ 가격 필수
    
    // ...
    
    // SECURITY FIX: 최소 가격 검증
    if (address(royaltyContract) != address(0)) {
        (uint256 minETH, uint256 minUSDC) = royaltyContract.calculateTotalRoyalties(projectId);
        
        if (paymentToken == PaymentToken.ETH) {
            require(price > minETH, "Price must be higher than total library royalties");  // ✅
        } else {
            require(price > minUSDC, "Price must be higher than total library royalties");  // ✅
        }
    }
}
```

**시나리오 테스트**:
```
1. User가 무료 Library (0 ETH) 등록 → ✅ 가능
2. 다른 User가 이 Library import하여 Project 생성
3. Marketplace에 리스팅 시도
   - calculateTotalRoyalties = 0 ETH
   - require(price > 0) → ✅ 통과
   - Project 판매 가능!
```

**결론**: ✅ **안전함** (무료 라이브러리는 커뮤니티 기여 목적)

---

### 이슈 #5: 프론트엔드 - 지갑 연결 끊김 시 트랜잭션 실패

**파일**: `lib/libraryService.ts:55-75`, `lib/marketplaceService.ts:5-20`

**코드**:
```typescript
async function getWalletProvider() {
  if (typeof window === 'undefined') {
    throw new Error('Window not available');
  }
  
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) {
    throw new Error('No wallet connected. Please connect your wallet first.');
  }
  
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();  // ❌ 여기서 실패 가능
  
  return { provider, signer };
}
```

**시나리오**:
```
1. User가 지갑 연결
2. Library 페이지 이동
3. 백그라운드에서 지갑 앱 종료 (모바일)
4. registerLibraryAsset() 호출
   → getWalletProvider()
   → await provider.getSigner() ❌ 실패
   → "No signer available"
```

**에러 처리 확인**:
```typescript
export async function registerLibraryAsset(...) {
  try {
    // ...
    const { signer } = await getWalletProvider();
    // ...
  } catch (error: any) {
    console.error('[LibraryService] Error registering asset:', error);
    return { success: false, error: getErrorMessage(error) };  // ✅ 처리됨
  }
}
```

**getErrorMessage 확인** (`lib/errorHandler.ts`):
```typescript
export function getErrorMessage(error: any): string {
  // ...
  
  // No wallet connected
  if (errorMessage.includes('No wallet connected')) {
    return 'Please connect your wallet first';  // ✅ 있음
  }
  
  // ❌ 누락: "No signer available" 케이스
  // ❌ 누락: "Provider is not connected" 케이스
}
```

**개선 필요**:
```typescript
// ✅ errorHandler.ts에 추가
if (
  errorMessage.includes('No signer') ||
  errorMessage.includes('Provider is not connected') ||
  errorMessage.includes('provider disconnected')
) {
  return 'Wallet connection lost. Please reconnect your wallet.';
}
```

**심각도**: 🟡 중간 (UX 개선 필요)

---

### 이슈 #6: 네트워크 전환 시 pending 트랜잭션 처리

**파일**: `lib/networkUtils.ts:119-153`

**코드**:
```typescript
export async function verifyAndSwitchNetwork(
  showPopup?: (message: string, type: 'success' | 'error' | 'warning') => void
): Promise<boolean> {
  const isOnBase = await isOnBaseNetwork();
  
  if (isOnBase) {
    return true;
  }

  const currentNetwork = await getCurrentNetworkName();
  
  showPopup?.(`You are on ${currentNetwork}. Switching to Base Mainnet...`, 'warning');

  const switched = await switchToBaseNetwork();
  
  if (switched) {
    showPopup?.('Successfully switched to Base Mainnet!', 'success');
    return true;
  } else {
    showPopup?.('Please manually switch to Base Mainnet in your wallet', 'error');
    return false;
  }
}
```

**시나리오**:
```
1. User가 Ethereum Mainnet에서 트랜잭션 전송
   - 상태: pending
   
2. 네트워크를 Base로 전환
   - 이전 트랜잭션은?
   
3. 다시 같은 작업 시도
   - ❌ "nonce too low" 에러 발생 가능
```

**문제**:
- 네트워크 전환 시 pending 트랜잭션 추적 안함
- 사용자에게 pending 트랜잭션 경고 없음

**해결 방안**:
```typescript
export async function verifyAndSwitchNetwork(
  showPopup?: (message: string, type: 'success' | 'error' | 'warning') => void
): Promise<boolean> {
  const isOnBase = await isOnBaseNetwork();
  
  if (isOnBase) {
    return true;
  }

  // ✅ FIX: Pending 트랜잭션 체크
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    // 현재 nonce와 pending nonce 비교
    const currentNonce = await provider.getTransactionCount(address, 'latest');
    const pendingNonce = await provider.getTransactionCount(address, 'pending');
    
    if (pendingNonce > currentNonce) {
      showPopup?.(
        `You have ${pendingNonce - currentNonce} pending transaction(s). Please wait or cancel them before switching networks.`,
        'warning'
      );
      // return false;  // 또는 사용자에게 선택권 부여
    }
  } catch (error) {
    console.warn('[NetworkUtils] Could not check pending transactions:', error);
  }

  const currentNetwork = await getCurrentNetworkName();
  showPopup?.(`You are on ${currentNetwork}. Switching to Base Mainnet...`, 'warning');
  
  // ... 나머지 로직
}
```

**심각도**: 🟡 중간 (UX 개선 필요)

---

### 이슈 #7: AdvancedClay - 저장 중 페이지 새로고침/닫기

**파일**: `app/components/AdvancedClay.tsx:3367-3621`

**시나리오**:
```
1. User가 대형 프로젝트 저장 시작
2. Library 로열티 지불 완료 (1.0 ETH)
3. Irys 업로드 중 (50%)
4. User가 실수로 브라우저 탭 닫기
5. 업로드 중단
6. 결과:
   - 로열티 지불됨 ✅
   - 프로젝트 미저장 ❌
```

**현재 보호 메커니즘**: ❌ **없음**

**해결 방안**:
```typescript
const handleSaveProject = async (projectName: string, saveAs: boolean = false, onProgress?: (status: string) => void) => {
  // ... 기존 코드
  
  // ✅ FIX: beforeunload 이벤트 핸들러 추가
  let isSaving = true;
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isSaving) {
      e.preventDefault();
      e.returnValue = 'Project save in progress. Are you sure you want to leave?';
      return e.returnValue;
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  try {
    // ... 저장 로직
  } finally {
    isSaving = false;
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
}
```

**심각도**: 🔴 높음 (자금 손실 가능)

---

### 이슈 #8: Royalty - USDC approve 후 recordRoyalties 실패 시 approve 취소 안됨

**파일**: `lib/royaltyService.ts:289-310`

**코드**:
```typescript
// USDC Approve
const approveTx = await usdcContract.approve(ROYALTY_CONTRACT_ADDRESS, royaltyUnits);
await approveTx.wait();

// USDC 지불
const usdcTx = await contract.recordRoyalties(projectId, 0, 1);
await usdcTx.wait();  // ❌ 여기서 실패하면?
```

**시나리오**:
```
1. User가 USDC approve (10 USDC)
2. approve 성공 ✅
3. recordRoyalties 호출
4. ❌ 네트워크 오류로 실패
5. 결과:
   - approve은 여전히 유효
   - USDC는 지불 안됨
   
6. 재시도 시:
   - needsRoyaltyPayment = true (부분 실패)
   - approve 다시 호출 (불필요)
```

**보안 영향**:
- approve가 남아있으면 컨트랙트가 USDC 인출 가능
- 하지만 ClayRoyalty는 신뢰할 수 있는 컨트랙트이므로 문제 없음
- 단, 가스비 낭비 (불필요한 approve 재호출)

**개선 방안**:
```typescript
// ✅ FIX: approve 전에 현재 allowance 확인
const currentAllowance = await usdcContract.allowance(userAddress, ROYALTY_CONTRACT_ADDRESS);

if (currentAllowance < royaltyUnits) {
  // approve 필요
  const approveTx = await usdcContract.approve(ROYALTY_CONTRACT_ADDRESS, royaltyUnits);
  await approveTx.wait();
} else {
  console.log('[RoyaltyService] Sufficient allowance already approved');
}

// USDC 지불
const usdcTx = await contract.recordRoyalties(projectId, 0, 1);
await usdcTx.wait();
```

**심각도**: 🟢 낮음 (가스비 최적화)

---

## 📊 이슈 요약

| 번호 | 이슈 | 심각도 | 상태 | 파일 |
|------|------|--------|------|------|
| #1 | Marketplace 가스 부족 시 자금 손실 | 🔴 높음 | 수정 필요 | ClayMarketplace.sol |
| #2 | 삭제 라이브러리 재활성화 중복 청구 | ✅ 해결됨 | - | ClayRoyalty.sol |
| #3 | 만료 오퍼 자금 락 | 🟡 중간 | UX 개선 필요 | ClayMarketplace.sol + Frontend |
| #4 | 무료 라이브러리 검증 | ✅ 안전함 | - | ClayLibrary.sol |
| #5 | 지갑 연결 끊김 에러 메시지 | 🟡 중간 | 개선 필요 | errorHandler.ts |
| #6 | 네트워크 전환 pending TX | 🟡 중간 | 개선 필요 | networkUtils.ts |
| #7 | 저장 중 페이지 닫기 | 🔴 높음 | 수정 필요 | AdvancedClay.tsx |
| #8 | USDC approve 중복 | 🟢 낮음 | 최적화 권장 | royaltyService.ts |

---

### 이슈 #9: 프로젝트 삭제 중 구매 시도 Race Condition

**파일**: `app/components/AdvancedClay.tsx:3768-3814` + `lib/marketplaceService.ts:116-167`

**시나리오**:
```
시간순서:
1. Alice가 Project X를 Marketplace에 리스팅 (10 ETH)
   - listings[projectX].isActive = true

2. Bob이 구매 시작
   - const listing = await contract.listings(projectX)
   - listing.isActive = true ✅
   - 트랜잭션 서명 중... (10초 소요)

3. 동시에 Alice가 프로젝트 삭제 시작
   - Step 1: deleteLibraryAsset() ✅
   - Step 2: cancelMarketplaceListing() ✅
     → listings[projectX].isActive = false
   - Step 3: deleteClayProject() ✅

4. Bob의 트랜잭션이 블록체인에 도착
   - buyAsset(projectX)
   - require(listing.isActive, "Listing not active") ❌ REVERT!
   
결과:
  - Alice: 프로젝트 삭제 완료
  - Bob: 10 ETH 차감 안됨, 하지만 가스비 손실
  - UX: Bob이 "Listing not active" 에러 받음
```

**문제**:
- 프론트엔드에서 리스팅 상태 실시간 업데이트 안됨
- Bob이 이미 삭제된 리스팅을 보고 구매 시도

**해결 방안**:
```typescript
// ✅ FIX: 프론트엔드에서 구매 전 리스팅 상태 재확인
export async function buyListedAsset(projectId: string, buyerAddress: string) {
  // ... 기존 코드
  
  // 최신 리스팅 상태 다시 가져오기
  const listingData = await contract.listings(projectId);
  
  if (!listingData.isActive) {
    return { success: false, error: 'This listing is no longer available' };
  }
  
  // Check if asset still exists in library
  const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS;
  if (LIBRARY_CONTRACT_ADDRESS) {
    const libraryContract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      ['function getAsset(string projectId) external view returns (...)'],
      provider
    );
    
    const asset = await libraryContract.getAsset(projectId);
    if (!asset.exists) {
      return { success: false, error: 'This project has been deleted' };
    }
  }
  
  // ... 구매 진행
}
```

**심각도**: 🟡 중간 (가스비 낭비 + UX 저하)

---

### 이슈 #10: 여러 탭에서 동시 프로젝트 수정

**파일**: `lib/mutableStorageService.ts:89-130`

**시나리오**:
```
Tab 1과 Tab 2에서 같은 프로젝트 열림
  → localStorage 공유
  → currentProject도 공유

Tab 1: User가 오브젝트 추가
  → setCurrentProject({ isDirty: true })
  → localStorage 업데이트

Tab 2: User가 동시에 오브젝트 삭제
  → setCurrentProject({ isDirty: true })
  → localStorage 업데이트

Tab 1: 저장 클릭
  → Tab 1의 상태로 저장 (Tab 2 변경 덮어씀!)

결과: Tab 2의 변경사항 손실!
```

**현재 방어 메커니즘**: ❌ **없음**

**해결 방안**:
```typescript
// ✅ FIX: Storage event listener로 충돌 감지
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === CURRENT_PROJECT_KEY && e.newValue !== e.oldValue) {
      // 다른 탭에서 프로젝트 변경됨
      const newProject = e.newValue ? JSON.parse(e.newValue) : null;
      const currentProject = getCurrentProject();
      
      if (currentProject && newProject && 
          currentProject.projectId === newProject.projectId &&
          currentProject.isDirty && newProject.isDirty) {
        // 충돌 발생!
        showPopup(
          'This project is being edited in another tab. Please save there first or refresh this tab.',
          'warning'
        );
      }
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

**심각도**: 🔴 높음 (데이터 손실)

---

### 이슈 #11: localStorage quota 초과

**파일**: `lib/mutableStorageService.ts:40-63`

**시나리오**:
```
User가 100개 프로젝트 저장
  → mutableReferences가 계속 누적
  → localStorage 5MB 제한 도달
  → saveMutableReference() 실패
  → 새 프로젝트 저장 불가!
```

**현재 코드**:
```typescript
export function saveMutableReference(...) {
  try {
    const refs = getAllMutableReferences();
    refs[projectId] = { ... };  // 계속 추가만 함
    localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
  } catch (error) {
    console.error('[MutableStorage] Error saving reference:', error);
    // ❌ 에러만 로그, 사용자에게 알림 없음
  }
}
```

**해결 방안**:
```typescript
export function saveMutableReference(...) {
  try {
    const refs = getAllMutableReferences();
    
    // ✅ FIX: 오래된 참조 자동 정리 (100개 제한)
    const refArray = Object.values(refs);
    if (refArray.length >= 100) {
      // 가장 오래된 20개 삭제
      refArray.sort((a, b) => a.updatedAt - b.updatedAt);
      const toDelete = refArray.slice(0, 20);
      toDelete.forEach(ref => delete refs[ref.projectId]);
      console.log(`[MutableStorage] Cleaned up ${toDelete.length} old references`);
    }
    
    refs[projectId] = { ... };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
  } catch (error) {
    // ✅ FIX: localStorage quota 에러 처리
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // 강제 정리 후 재시도
      const refs = getAllMutableReferences();
      const refArray = Object.values(refs).sort((a, b) => a.updatedAt - b.updatedAt);
      const toKeep = refArray.slice(-50); // 최근 50개만 유지
      
      const newRefs: Record<string, MutableReference> = {};
      toKeep.forEach(ref => newRefs[ref.projectId] = ref);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRefs));
      
      // 현재 프로젝트 다시 추가
      newRefs[projectId] = { ... };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRefs));
      
      throw new Error('Storage quota exceeded. Cleaned up old projects and retried.');
    }
    
    console.error('[MutableStorage] Error saving reference:', error);
    throw error; // 상위로 전파
  }
}
```

**심각도**: 🟡 중간 (기능 정지)

---

### 이슈 #12: 대용량 프로젝트 다운로드 시 메모리 부족

**파일**: `lib/clayStorageService.ts:525-626`

**시나리오**:
```
User가 10MB 프로젝트 다운로드
  → 100개 청크로 분할됨
  → downloadChunks()가 모든 청크를 메모리에 로드
  → 브라우저 메모리 부족
  → 탭 크래시 💥
```

**현재 코드**:
```typescript
// chunkUploadService.ts
export async function downloadChunks(...) {
  const chunkPromises = chunkIds.map(chunkId => 
    fetch(`https://uploader.irys.xyz/tx/${chunkId}/data`)
      .then(res => res.text())  // ❌ 모든 청크를 동시에 메모리에 로드
  );
  
  const chunks = await Promise.all(chunkPromises);  // ❌ 메모리 폭발!
  return chunks.join('');
}
```

**해결 방안**:
```typescript
// ✅ FIX: 순차적 다운로드 + 스트리밍
export async function downloadChunks(...) {
  const chunks: string[] = [];
  
  // 5개씩 배치로 다운로드 (메모리 절약)
  const BATCH_SIZE = 5;
  for (let i = 0; i < chunkIds.length; i += BATCH_SIZE) {
    const batch = chunkIds.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(chunkId => 
      fetch(`https://uploader.irys.xyz/tx/${chunkId}/data`)
        .then(res => res.text())
    );
    
    const batchChunks = await Promise.all(batchPromises);
    chunks.push(...batchChunks);
    
    // 진행상황 업데이트
    onProgress?.({
      currentChunk: i + batch.length,
      totalChunks: chunkIds.length,
      percentage: Math.round(((i + batch.length) / chunkIds.length) * 100)
    });
    
    // 가비지 컬렉션 힌트
    if (i % 20 === 0 && typeof window !== 'undefined') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return chunks.join('');
}
```

**심각도**: 🟡 중간 (대용량 프로젝트 사용 불가)

---

### 이슈 #13: 네트워크 오류 시 부분 업로드 복구 불가

**파일**: `lib/clayStorageService.ts:358-520`

**시나리오**:
```
User가 5MB 프로젝트 저장
  → 50개 청크로 분할
  → 청크 1-40 업로드 성공
  → 청크 41 업로드 중 네트워크 끊김
  → 전체 실패! ❌
  → 재시도 시 처음부터 다시 업로드 (청크 1-40 중복!)
```

**현재 코드**:
```typescript
export async function uploadInChunks(...) {
  const { transactionIds, chunkMetadata } = await uploadInChunks(...);
  // ❌ 실패 시 이미 업로드된 청크 정보 손실
  
  const manifestTxId = await uploadChunkManifest(...);
  // ❌ 여기서 실패하면 모든 청크 고아됨
}
```

**해결 방안**:
```typescript
// ✅ FIX: 업로드 진행상황 localStorage에 저장
interface UploadProgress {
  projectId: string;
  chunkSetId: string;
  uploadedChunks: Array<{ index: number; txId: string }>;
  totalChunks: number;
  startedAt: number;
}

export async function uploadInChunks(...) {
  const progressKey = `upload-progress-${projectId}`;
  
  // 이전 진행상황 확인
  const savedProgress = localStorage.getItem(progressKey);
  let progress: UploadProgress;
  
  if (savedProgress) {
    progress = JSON.parse(savedProgress);
    console.log(`[Upload] Resuming upload: ${progress.uploadedChunks.length}/${progress.totalChunks} chunks already uploaded`);
  } else {
    progress = {
      projectId,
      chunkSetId: uuidv4(),
      uploadedChunks: [],
      totalChunks: chunks.length,
      startedAt: Date.now()
    };
  }
  
  // 이미 업로드된 청크 건너뛰기
  const uploadedIndices = new Set(progress.uploadedChunks.map(c => c.index));
  
  for (let i = 0; i < chunks.length; i++) {
    if (uploadedIndices.has(i)) {
      console.log(`[Upload] Skipping chunk ${i} (already uploaded)`);
      continue;
    }
    
    try {
      const txId = await uploadChunk(chunks[i], i);
      progress.uploadedChunks.push({ index: i, txId });
      
      // 진행상황 저장
      localStorage.setItem(progressKey, JSON.stringify(progress));
    } catch (error) {
      console.error(`[Upload] Chunk ${i} failed, progress saved for resume`);
      throw error; // 재시도 가능하도록 에러 전파
    }
  }
  
  // 완료 후 진행상황 삭제
  localStorage.removeItem(progressKey);
  
  return { transactionIds: progress.uploadedChunks.map(c => c.txId), ... };
}
```

**심각도**: 🟡 중간 (대용량 프로젝트 업로드 어려움)

---

### 이슈 #14: 프로젝트 무결성 서명 누락 (보안)

**파일**: `lib/clayStorageService.ts:76-237`

**코드 확인**:
```typescript
export function serializeClayProject(..., usedLibraries?: UsedLibrary[]): ClayProject {
  const project: ClayProject = {
    id: `clay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: projectName,
    // ...
    usedLibraries: usedLibraries && usedLibraries.length > 0 ? usedLibraries : undefined
    // ❌ signature 필드 없음!
  };
  
  return project;
}
```

**다운로드 시 검증**:
```typescript
export async function downloadClayProject(...) {
  // SECURITY: Verify project integrity if signature exists
  if (!skipIntegrityCheck && project.signature) {
    // ✅ 검증 로직 있음
  } else if (!skipIntegrityCheck && !project.signature && (project.usedLibraries && project.usedLibraries.length > 0)) {
    console.warn('[downloadClayProject] ⚠️ Project has libraries but no signature (legacy project)');
    // ⚠️ 경고만 하고 계속 진행
  }
}
```

**문제**:
- 새 프로젝트에 서명이 추가되지 않음
- 악의적 사용자가 usedLibraries 조작 가능
- 로열티 회피 가능!

**해결 필요**: 
```typescript
// ✅ FIX: 프로젝트 저장 시 서명 추가
export async function uploadClayProject(...) {
  // 서명 생성 및 추가
  if (project.usedLibraries && project.usedLibraries.length > 0) {
    const { signProject } = await import('./projectIntegrityService');
    project.signature = await signProject(project, walletProvider);
  }
  
  // 업로드 진행...
}
```

**심각도**: 🔴 높음 (보안 취약점)

---

## 📊 이슈 요약 (업데이트)

| 번호 | 이슈 | 심각도 | 상태 | 파일 |
|------|------|--------|------|------|
| #1 | Marketplace 가스 부족 시 자금 손실 | 🔴 높음 | 수정 필요 | ClayMarketplace.sol |
| #2 | 삭제 라이브러리 재활성화 중복 청구 | ✅ 해결됨 | - | ClayRoyalty.sol |
| #3 | 만료 오퍼 자금 락 | 🟡 중간 | UX 개선 필요 | ClayMarketplace.sol + Frontend |
| #4 | 무료 라이브러리 검증 | ✅ 안전함 | - | ClayLibrary.sol |
| #5 | 지갑 연결 끊김 에러 메시지 | 🟡 중간 | 개선 필요 | errorHandler.ts |
| #6 | 네트워크 전환 pending TX | 🟡 중간 | 개선 필요 | networkUtils.ts |
| #7 | 저장 중 페이지 닫기 | 🔴 높음 | 수정 필요 | AdvancedClay.tsx |
| #8 | USDC approve 중복 | 🟢 낮음 | 최적화 권장 | royaltyService.ts |
| #9 | 삭제 중 구매 race condition | 🟡 중간 | 개선 필요 | marketplaceService.ts |
| #10 | 여러 탭 동시 수정 | 🔴 높음 | 수정 필요 | mutableStorageService.ts |
| #11 | localStorage quota 초과 | 🟡 중간 | 개선 필요 | mutableStorageService.ts |
| #12 | 대용량 프로젝트 메모리 부족 | 🟡 중간 | 개선 필요 | clayStorageService.ts |
| #13 | 부분 업로드 복구 불가 | 🟡 중간 | 개선 필요 | clayStorageService.ts |
| #14 | 프로젝트 서명 누락 | 🔴 높음 | 수정 필요 | clayStorageService.ts |

**총 발견**: 14개
- 🔴 높음: 4개 (29%)
- 🟡 중간: 8개 (57%)
- 🟢 낮음: 1개 (7%)
- ✅ 안전함: 1개 (7%)

---

## 🔍 계속 검증 중...

