# Library & Marketplace 메타데이터 수정 완료

## 🔧 수정 내용

### Library 상세 페이지 (`/library/[id]`)

**문제**: Library asset의 이름이 "Library Asset - GetClayed Library"로 고정되어 표시됨 (예: "red stone"이 표시되지 않음)

**원인**: 
- Library asset 메타데이터가 Irys에 `Asset-Name` 태그로 저장됨
- 하지만 layout.tsx에서는 `Name` 태그를 찾고 있었음

**해결책**:
1. GraphQL 쿼리로 library-registration 트랜잭션 검색
2. `Asset-Name` 또는 `Name` 태그에서 이름 가져오기
3. `Registered-By` 또는 `Original-Creator` 태그에서 작성자 가져오기
4. Fallback으로 Irys 프로젝트 데이터 사용

### Marketplace 상세 페이지 (`/marketplace/[id]`)

**동일한 로직 적용**:
1. GraphQL 쿼리로 marketplace-listing 트랜잭션 검색
2. `Asset-Name` 또는 `Name` 태그에서 이름 가져오기
3. Fallback으로 Irys 프로젝트 데이터 사용

## 📋 메타데이터 우선순위

### Library:
1. **Irys GraphQL** (library-registration tags)
   - `Asset-Name` → 라이브러리 이름
   - `Registered-By` → 작성자
   - `Royalty-ETH`, `Royalty-USDC` → 로열티
   - `Thumbnail-ID` → 썸네일

2. **Irys Direct Data** (프로젝트 JSON)
   - `name` / `projectName` → 이름
   - `author` / `creator` → 작성자
   - Chunk manifest 지원

### Marketplace:
1. **Irys GraphQL** (marketplace-listing tags)
   - `Asset-Name` / `Name` → 아이템 이름
   - `Seller` → 판매자
   - `Price` → 가격
   - `Thumbnail-ID` → 썸네일

2. **Irys Direct Data** (프로젝트 JSON)
   - 동일한 폴백 로직

## ✅ 결과

이제 각 페이지의 타이틀이 실제 asset/listing 이름으로 표시됩니다:

- **Library**: "red stone - GetClayed Library"
- **Marketplace**: "[실제 아이템 이름] - For Sale on GetClayed"
- **Project**: "[실제 프로젝트 이름] - GetClayed"

## 🧪 테스트 방법

```bash
npm run dev
```

브라우저에서:
1. Library asset 페이지 열기
2. 브라우저 탭 제목 확인
3. 페이지 소스 보기 (`Cmd+Option+U`)
4. `<title>` 태그 확인

또는 curl로 확인:
```bash
curl -s https://getclayed.io/library/[ID] | grep -i '<title>'
```

## 📝 캐싱

- 메타데이터는 1시간 동안 캐싱됨 (`revalidate: 3600`)
- 변경사항이 즉시 반영되지 않으면 브라우저 캐시 지우기 필요

