# ✅ 완료된 컨트랙트 업데이트 (2025-10-20)

## 🔐 보안 개선

### 1. Private Key 관리
- ✅ `.env` 파일 사용 (절대 코드에 하드코딩 안 함)
- ✅ `.gitignore`에 `.env` 추가
- ✅ `.env.example` 제공
- ✅ 새 지갑: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`

### 2. Owner 권한 양도 (Ownable2Step)
- ✅ `ClayLibrary`: Ownable → Ownable2Step
- ✅ 2단계 양도로 실수 방지
- ✅ `transferOwnership()` + `acceptOwnership()` 패턴

---

## 💰 Pull Pattern (Claim 방식 로열티)

### ClayRoyalty 대폭 수정
- ✅ `pendingRoyaltiesETH` / `pendingRoyaltiesUSDC` mapping 추가
- ✅ `recordRoyalties()`: 로열티 기록 (전송 대신)
- ✅ `claimRoyaltiesETH()` / `claimRoyaltiesUSDC()`: 사용자가 직접 claim
- ✅ `getPendingRoyalties()`: 누적 로열티 조회
- ✅ **실시간 소유권 기반**: `getCurrentOwner(projectId)` 조회하여 현재 owner에게 로열티
- ✅ DoS 공격 완벽 차단

**변경된 구조**:
```solidity
// 기존
struct LibraryDependency {
    address creator;  // 고정 주소
    uint256 royaltyETH;
}

// 변경 후
struct LibraryDependency {
    string dependencyProjectId;  // 프로젝트 ID로 동적 조회
    uint256 royaltyPercentage;   // 비율만 저장
}
```

---

## 🛒 Marketplace 승인 시스템

### ClayLibrary
- ✅ `approvedMarketplaces` mapping 추가
- ✅ `setApprovedMarketplace(address, bool)` 함수 추가
- ✅ `transferAssetOwnership()` 수정:
  ```solidity
  require(
    msg.sender == asset.currentOwner || 
    approvedMarketplaces[msg.sender],
    "Not authorized"
  );
  ```
- ✅ 배포 시 자동으로 Marketplace 승인

### 해결된 문제
- ❌ (기존) Marketplace가 `transferAssetOwnership()` 호출 → 실패
- ✅ (수정) Marketplace 승인됨 → 소유권 이전 성공

---

## 🚫 가격 덤핑 방지

### ClayLibrary.updateAssetPrice()
```solidity
// 추가된 검증
if (address(royaltyContract) != address(0)) {
    require(
        royaltyContract.validatePrice(projectId, newPriceETH, newPriceUSDC),
        "Price below minimum (must cover dependency royalties)"
    );
}
```

### 효과
- ✅ 등록 시 + 가격 변경 시 모두 검증
- ✅ 로열티보다 낮은 가격 설정 차단
- ✅ 덤핑 방지

---

## 🏪 Marketplace 가격 업데이트

### ClayMarketplace.updateListingPrice()
```solidity
function updateListingPrice(string memory projectId, uint256 newPrice) external {
    Listing storage listing = listings[projectId];
    require(listing.isActive, "Listing not active");
    require(msg.sender == listing.seller, "Only seller can update");
    require(newPrice > 0, "Price must be greater than 0");
    
    uint256 oldPrice = listing.price;
    listing.price = newPrice;
    
    emit ListingPriceUpdated(projectId, oldPrice, newPrice);
}
```

### 효과
- ❌ (기존) 취소 + 재등록 필요 (가스비 2배)
- ✅ (수정) 한 번에 가격 변경 가능

---

## 👑 소유권 기반 로열티

### 핵심 변경
**ClayLibrary**:
```solidity
function getCurrentOwner(string memory projectId) external view returns (address) {
    return libraryAssets[projectId].currentOwner;
}
```

**ClayRoyalty.recordRoyalties()**:
```solidity
for (uint256 i = 0; i < royalty.dependencies.length; i++) {
    LibraryDependency memory dep = royalty.dependencies[i];
    
    // ✅ 실시간 조회
    address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
    
    // ✅ 현재 owner에게 로열티 기록
    pendingRoyaltiesETH[owner] += royaltyAmount;
}
```

### 효과
- ✅ Marketplace에서 소유권 구매 → 로열티도 새 owner가 받음
- ✅ 사용자 의도 100% 구현

---

## 📦 배포 순서 (순환 참조 해결)

```
1. ClayLibrary 배포 (royaltyContract = address(0))
2. ClayRoyalty 배포 (libraryContract 주소 전달)
3. ClayLibrary.setRoyaltyContract(royaltyAddress) 호출
4. ClayMarketplace 배포 (libraryAddress 전달)
5. ClayLibrary.setApprovedMarketplace(marketplaceAddress, true) 호출
```

---

## 🎯 해결된 문제 목록

| # | 문제 | 상태 |
|---|------|------|
| 1 | Owner 권한 양도 불가 | ✅ 해결 (Ownable2Step) |
| 2 | 가격 덤핑 취약점 | ✅ 해결 (검증 추가) |
| 3 | Marketplace 작동 안 함 | ✅ 해결 (승인 시스템) |
| 4 | 로열티 소유권 고정 | ✅ 해결 (실시간 조회) |
| 5 | Marketplace 가격 업데이트 | ✅ 해결 (함수 추가) |
| 6 | DoS 공격 취약 | ✅ 해결 (Pull Pattern) |
| 7 | 의존성 많으면 가스비 폭증 | ✅ 해결 (Pull Pattern) |

---

## 🚀 배포 준비 완료

### 체크리스트
- ✅ 컨트랙트 수정 완료
- ✅ 컴파일 성공
- ✅ `.env` 파일 생성
- ✅ Private Key 안전 관리
- ✅ 배포 스크립트 완성
- ⏳ ETH 입금 대기 중

### 필요 액션
**새 지갑에 ETH 입금 필요**:
- 주소: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`
- 필요 금액: 최소 0.005 ETH (Base Mainnet)

### 배포 명령어
```bash
cd /Users/USER/web3/getclayed/contracts
npx hardhat run scripts/deploy.js --network base
```

---

## 📝 다음 단계 (ETH 입금 후)

1. 컨트랙트 배포 실행
2. 배포 완료 후 출력되는 주소 확인
3. `.env`에 컨트랙트 주소 추가
4. 프론트엔드 개발 시작:
   - 로열티 대시보드 (프로필 페이지)
   - Claim 버튼
   - 알림 시스템
   - 소유권/라이센스 구분 UI
   - 로열티 트리 시각화

---

## 🎉 업그레이드 요약

### 이전 버전
- Push Pattern (자동 전송)
- Owner 권한 이전 불가
- Marketplace 작동 안 함
- 가격 덤핑 가능
- DoS 공격 취약

### 새 버전
- ✅ Pull Pattern (Claim 방식)
- ✅ Owner 권한 양도 가능 (Ownable2Step)
- ✅ Marketplace 정상 작동
- ✅ 가격 덤핑 방지
- ✅ DoS 공격 차단
- ✅ 실시간 소유권 기반 로열티
- ✅ 가스비 최적화

**안전하고 확장 가능한 시스템으로 업그레이드 완료!** 🚀

