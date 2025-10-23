# Smart Contract 버그 수정 요약

## 발견된 문제

### ClayRoyalty.sol - USDC 전송 누락 🐛

**실제 상황:**
```
사용자가 0.001 USDC Royalty 지불 시도
  ↓
approve(0.001 USDC) ✅ 성공
  ↓
recordRoyalties() 호출
  ↓
❌ transferFrom() 호출 안됨!
  ↓
결과:
- Contract USDC Balance: 0.0 USDC
- User Allowance: 0.001 USDC (그대로)
- User Balance: 3.853484 USDC (돈 안 나감!)
- Pending: 0.001 USDC (기록만 됨)
  ↓
Claim 시도 → "transfer amount exceeds balance" ❌
```

---

## 수정 내용

### ClayRoyalty.sol Line 170-202

#### 수정 전:
```solidity
else {
    // USDC 처리
    // ❌ transferFrom 없음!
    
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        pendingRoyaltiesUSDC[owner] += royaltyAmount;
    }
}
```

#### 수정 후:
```solidity
else {
    require(msg.value == 0, "Do not send ETH for USDC royalties");
    
    // 1. 총 USDC 계산
    uint256 totalUSDC = 0;
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        totalUSDC += royalty.dependencies[i].fixedRoyaltyUSDC;
    }
    
    require(totalUSDC > 0, "No USDC royalties for this project");
    
    // 2. USDC를 컨트랙트로 전송 (추가!)
    require(
        usdcToken.transferFrom(msg.sender, address(this), totalUSDC),
        "USDC transfer to contract failed"
    );
    
    // 3. Pending 기록
    for (uint256 i = 0; i < royalty.dependencies.length; i++) {
        pendingRoyaltiesUSDC[owner] += royaltyAmount;
    }
}
```

---

## 3개 컨트랙트 검토 결과

### ✅ ClayLibrary.sol - 문제 없음
- registerAsset ✅
- updateRoyaltyFee ✅
- transferAssetOwnership ✅
- deactivateAsset ✅
- getCurrentOwner ✅

### ✅ ClayMarketplace.sol - 문제 없음
- listAsset ✅
- buyAsset ✅ (즉시 송금)
- makeOffer ✅ (Escrow)
- acceptOffer ✅ (Escrow 해제)
- cancelOffer ✅ (환불)
- USDC transferFrom 모두 정상 ✅

### ✅ ClayRoyalty.sol - 수정 완료
- registerProjectRoyalties ✅
- recordRoyalties (ETH) ✅
- recordRoyalties (USDC) ✅ **수정됨!**
- claimRoyaltiesETH ✅
- claimRoyaltiesUSDC ✅

---

## 재배포 필요

### ClayRoyalty.sol만 재배포 필요:

```bash
cd contracts
npx hardhat run scripts/deployRoyalty.js --network base
```

### 재배포 후:
1. `.env.local` 업데이트 (새 ROYALTY_CONTRACT_ADDRESS)
2. Frontend 빌드 및 배포
3. 테스트:
   - Library import → Royalty 지불 → USDC 전송 확인
   - Claim → 성공 확인

---

## 기존 Pending Royalties 처리

**현재 컨트랙트 (0x9C47413D...):**
- Pending: 0.001001 USDC
- Balance: 0.0 USDC
- **Claim 불가능**

**옵션:**
1. **새 컨트랙트 배포** (권장)
   - 기존 pending 포기 (금액 작음)
   - 새로운 지불부터 정상 작동
   
2. **수동으로 USDC 입금**
   - 컨트랙트에 0.001001 USDC 전송
   - Claim 가능하게 만듦
   - 하지만 버그는 그대로 남음

**권장: 새 컨트랙트 배포** ✅

---

## 컴파일 확인

```
✅ Compiled 1 Solidity file successfully
```

수정된 컨트랙트가 정상적으로 컴파일되었습니다!

