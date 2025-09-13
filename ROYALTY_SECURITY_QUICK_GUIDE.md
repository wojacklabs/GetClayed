# Royalty Receipt 보안 - 빠른 가이드

## 🔍 보안 검증 결과

### ✅ 현재 상태
1. **재정적 보안**: 완벽 (스마트 컨트랙트로 보호됨)
2. **UI 보안**: 개선 가능 (악의적 사용자가 가짜 receipt 업로드 가능)

### ⚠️ 발견된 취약점
- 누구나 Irys에 올바른 태그로 가짜 receipt 업로드 가능
- UI에 가짜 royalty 정보가 표시될 수 있음
- **하지만 실제 돈은 안전**: claim은 온체인 데이터에만 의존

---

## ✨ 해결 방법 (이미 적용 완료)

### 고정 Solana 키로 업로드 검증
- 모든 정상 receipt는 **고정된 Solana 주소**로 업로드됨
- Irys GraphQL의 `address` 필드로 업로더 확인 가능
- 신뢰할 수 있는 주소의 receipt만 표시

### 업로더 주소
```
AfcWKLP89g1DxMvuKzPizt8yFP61JJCNsLyLYqFFRKqs
```

---

## 📋 설정 방법 (3단계)

### 1. 환경변수 추가
`.env.local`에 다음 추가:
```bash
NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS=AfcWKLP89g1DxMvuKzPizt8yFP61JJCNsLyLYqFFRKqs
```

### 2. Vercel 환경변수 설정
- Vercel 프로젝트 → Settings → Environment Variables
- 새 변수 추가:
  - **Name**: `NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS`
  - **Value**: `AfcWKLP89g1DxMvuKzPizt8yFP61JJCNsLyLYqFFRKqs`
  - **Environment**: Production, Preview, Development 모두 체크

### 3. 검증
```bash
# 설정 확인
node scripts/verifyReceiptSecurity.js

# ✅ 모든 체크가 통과하면 완료!
```

---

## 🛡️ 보안 효과

### 차단되는 공격
- ✅ 가짜 receipt 업로드 → **무시됨**
- ✅ UI 스팸 공격 → **필터링됨**
- ✅ 허위 royalty 정보 → **표시 안됨**

### 여전히 안전한 이유
- 💰 **실제 claim**: 온체인 `pendingRoyalties` 값만 사용
- 🔒 **이중 검증**: UI는 참고용, 실제 지급은 스마트 컨트랙트
- 🛡️ **최소 권한**: Receipt는 읽기 전용

---

## 🚀 배포 전 체크리스트

- [ ] `.env.local`에 `NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS` 추가
- [ ] Vercel 환경변수 설정
- [ ] `node scripts/verifyReceiptSecurity.js` 실행하여 ✅ 확인
- [ ] Vercel 재배포
- [ ] 프로덕션에서 royalty 알림 정상 작동 확인

---

## 📚 관련 파일

### 수정된 파일
- `lib/royaltyService.ts` - `getRoyaltyReceipts()` 함수에 검증 로직 추가
- `env.example` - 환경변수 예시 추가

### 추가된 스크립트
- `scripts/getIrysUploaderAddress.js` - Solana 공개키 추출
- `scripts/verifyReceiptSecurity.js` - 보안 설정 검증

### 문서
- `ROYALTY_RECEIPT_SECURITY.md` - 상세 기술 문서
- `ROYALTY_SECURITY_QUICK_GUIDE.md` - 이 파일

---

## ❓ FAQ

### Q: 환경변수가 `NEXT_PUBLIC_*`인데 안전한가요?
A: 네, 안전합니다. 이 값은 **공개키**(Solana 주소)이므로 노출되어도 문제없습니다. 프라이빗 키는 별도로 안전하게 보관됩니다.

### Q: 공격자가 같은 주소로 업로드하면?
A: 불가능합니다. 해당 Solana 프라이빗 키를 소유한 사람만 이 주소로 업로드할 수 있습니다.

### Q: 환경변수를 설정하지 않으면?
A: 검증을 건너뛰고 모든 receipt를 표시합니다 (이전 동작과 동일). 하지만 보안을 위해 설정을 권장합니다.

### Q: 재정적 손실 가능성은?
A: **없습니다**. 실제 claim은 스마트 컨트랙트의 `pendingRoyaltiesETH/USDC` 값으로만 처리되며, 이는 온체인에서 검증됩니다.

---

## 📞 도움이 필요하면

1. `ROYALTY_RECEIPT_SECURITY.md` 상세 문서 참고
2. `node scripts/verifyReceiptSecurity.js` 실행하여 문제 확인
3. 로그 확인: 브라우저 콘솔에서 `[RoyaltyService]` 검색

