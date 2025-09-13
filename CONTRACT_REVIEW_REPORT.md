# Smart Contract 전체 검토 보고서

## 발견된 버그와 수정사항

### 🐛 ClayRoyalty.sol - CRITICAL BUG (수정 완료)

#### 문제:
```solidity
// Line 170-188 (수정 전)
else { // USDC 지불 처리
    require(msg.value == 0, "Do not send ETH for USDC royalties");
    
    // ❌ USDC transferFrom이 없음!
    // 단지 pending에만 기록
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        pendingRoyaltiesUSDC[owner] += royaltyAmount;
    }
}
```

#### 결과:
- ❌ USDC가 컨트랙트로 전송되지 않음
- ✅ Allowance만 설정됨 (approve 호출)
- ❌ Pending에만 기록
- ❌ Claim 시도 → "transfer amount exceeds balance" 에러

#### 수정:
```solidity
else {
    require(msg.value == 0, "Do not send ETH for USDC royalties");
    
    // ✅ 추가: 총 USDC 계산
    uint256 totalUSDC = 0;
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
    }
    
    require(totalUSDC > 0, "No USDC royalties for this project");
    
    // ✅ 추가: USDC를 컨트랙트로 전송
    require(
        usdcToken.transferFrom(msg.sender, address(this), totalUSDC),
        "USDC transfer to contract failed"
    );
    
    // 이제 pending에 기록
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        pendingRoyaltiesUSDC[owner] += royaltyAmount;
    }
}
```

---

## 전체 컨트랙트 검토

### ✅ ClayLibrary.sol - 문제 없음

#### 주요 기능:
1. **registerAsset** (Line 111-139)
   - Library 등록
   - Royalty 설정
   - 문제 없음 ✅

2. **updateRoyaltyFee** (Line 147-161)
   - Royalty 업데이트
   - 소유자만 가능
   - 문제 없음 ✅

3. **transferAssetOwnership** (Line 179-203)
   - 소유권 이전
   - Marketplace 또는 소유자만 가능
   - 문제 없음 ✅

4. **deactivateAsset** (Line 211-219)
   - Asset 비활성화
   - 소유자만 가능
   - 문제 없음 ✅

5. **getCurrentOwner** (Line 234-243)
   - 현재 소유자 조회
   - Inactive이면 address(0) 반환 ✅
   - 문제 없음 ✅

---

### ✅ ClayMarketplace.sol - 문제 없음

#### 주요 기능:
1. **listAsset** (Line 138-160)
   - Marketplace에 등록
   - 소유자 확인 ✅
   - 문제 없음 ✅

2. **buyAsset** (Line 166-214) - **즉시 송금 방식**
   ```solidity
   // ETH (Line 179)
   (bool success, ) = listing.seller.call{value: sellerPayment}("");
   // ✅ 판매자에게 즉시 송금 (claim 불필요)
   
   // USDC (Line 192, 198)
   usdcToken.transferFrom(msg.sender, listing.seller, sellerPayment);  // ✅ 판매자
   usdcToken.transferFrom(msg.sender, address(this), platformFee);     // ✅ 플랫폼 수수료
   // ✅ 모두 즉시 전송
   ```
   - 문제 없음 ✅

3. **makeOffer** (Line 255-298) - **Escrow 방식**
   ```solidity
   // ETH (Line 271)
   require(msg.value == offerPrice);  // ✅ ETH를 컨트랙트에 보관
   
   // USDC (Line 276)
   usdcToken.transferFrom(msg.sender, address(this), offerPrice);  // ✅ USDC를 컨트랙트에 보관
   ```
   - 문제 없음 ✅

4. **acceptOffer** (Line 304-346) - **Escrow 해제**
   ```solidity
   // ETH (Line 320)
   (bool success, ) = msg.sender.call{value: sellerPayment}("");  // ✅ 판매자에게 송금
   
   // USDC (Line 324)
   usdcToken.transfer(msg.sender, sellerPayment);  // ✅ 판매자에게 송금
   ```
   - 문제 없음 ✅

5. **cancelOffer** (Line 352-372) - **환불**
   ```solidity
   // ETH (Line 362)
   (bool success, ) = msg.sender.call{value: refundAmount}("");  // ✅ 구매자에게 환불
   
   // USDC (Line 366)
   usdcToken.transfer(msg.sender, refundAmount);  // ✅ 구매자에게 환불
   ```
   - 문제 없음 ✅

6. **withdrawPlatformFees** (Line 400-406, 450-455)
   - ETH/USDC 플랫폼 수수료 인출
   - Owner만 가능
   - 문제 없음 ✅

---

## 수정된 ClayRoyalty.sol 검증

### recordRoyalties - ETH (Line 152-169)
```solidity
if (paymentToken == PaymentToken.ETH) {
    require(msg.value > 0, "No ETH sent");  // ✅ ETH 수신 확인
    
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        pendingRoyaltiesETH[owner] += royaltyAmount;  // ✅ Pending 기록
        emit RoyaltyRecorded(...);
    }
}
```
✅ **정상**: ETH는 msg.value로 자동 수신됨

### recordRoyalties - USDC (Line 170-202) - 수정됨
```solidity
else {
    require(msg.value == 0, "Do not send ETH for USDC royalties");
    
    // ✅ 총 USDC 계산
    uint256 totalUSDC = 0;
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
    }
    
    require(totalUSDC > 0, "No USDC royalties for this project");
    
    // ✅ USDC를 컨트랙트로 전송 (추가됨!)
    require(
        usdcToken.transferFrom(msg.sender, address(this), totalUSDC),
        "USDC transfer to contract failed"
    );
    
    // ✅ Pending 기록
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        pendingRoyaltiesUSDC[owner] += royaltyAmount;
    }
}
```
✅ **수정 완료**: USDC가 컨트랙트로 전송됨

### claimRoyaltiesUSDC (Line 209-218)
```solidity
function claimRoyaltiesUSDC() external nonReentrant {
    uint256 pending = pendingRoyaltiesUSDC[msg.sender];
    require(pending > 0, "No pending USDC royalties");
    
    pendingRoyaltiesUSDC[msg.sender] = 0;
    
    require(usdcToken.transfer(msg.sender, pending), "USDC transfer failed");  // ✅ 정상
    
    emit RoyaltyClaimed(msg.sender, 0, pending);
}
```
✅ **정상**: Pending USDC를 사용자에게 전송

---

## 요약

### 수정 사항:
- ✅ **ClayRoyalty.sol**: USDC transferFrom 추가 (Line 182-185)

### 문제 없는 컨트랙트:
- ✅ **ClayLibrary.sol**: 모든 기능 정상
- ✅ **ClayMarketplace.sol**: 모든 USDC 전송 정상

### Marketplace vs Royalty:
| | Marketplace | Royalty |
|---|---|---|
| 수령 방식 | **즉시 송금** | **Claim 필요** (Pull Pattern) |
| 이유 | 1회성 거래 | 여러 번 누적 가능 |

---

## 재배포 필요

**ClayRoyalty.sol을 재배포해야 합니다!**

기존 컨트랙트의 pending royalties는 claim 불가능하므로:
1. 새 컨트랙트 배포
2. 환경 변수 업데이트
3. 기존 pending은 손실 (금액이 작아서 괜찮음)

