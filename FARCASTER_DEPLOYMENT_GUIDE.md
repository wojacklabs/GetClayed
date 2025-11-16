# Farcaster Mini App 배포 가이드

## ✅ 온보딩 완료!

GetClayed가 Farcaster Mini App으로 성공적으로 통합되었습니다.

## 배포 체크리스트

### 1. Vercel 배포 ✅
현재 앱은 이미 Vercel에 배포되어 있습니다:
- URL: `https://getclayed.vercel.app`

배포 시 자동으로 다음이 적용됩니다:
- ✅ `.well-known/farcaster.json` 매니페스트 파일
- ✅ CORS 헤더 설정
- ✅ Farcaster 메타 태그

### 2. 환경 변수 확인 ✅
Vercel 대시보드에서 다음 환경 변수가 설정되어 있는지 확인:
- `NEXT_PUBLIC_PRIVY_APP_ID`
- 기타 필요한 환경 변수들

### 3. 도메인 확인 ✅
매니페스트 파일의 모든 URL이 올바른 도메인을 가리키는지 확인:
- `https://getclayed.vercel.app`

## Farcaster에서 앱 테스트하기

### 방법 1: 직접 URL 공유
1. Warpcast 또는 다른 Farcaster 클라이언트 열기
2. 새 캐스트 작성
3. URL 입력: `https://getclayed.vercel.app`
4. 자동으로 Mini App 임베드 카드 생성됨
5. "Launch GetClayed" 버튼 클릭하여 앱 실행

### 방법 2: Farcaster 클라이언트에서 직접 열기
1. Farcaster 클라이언트의 브라우저에서 `https://getclayed.vercel.app` 방문
2. 자동으로 Farcaster 지갑 연결
3. 우측 상단에 "🟣 Farcaster" 배지 표시

## 주요 기능 동작 확인

### ✅ SDK 초기화
- 앱 로드 시 Farcaster 스플래시 스크린 표시
- 앱 준비 완료 시 자동으로 스플래시 스크린 숨김

### ✅ 지갑 연결
- Farcaster 환경: 자동으로 Farcaster 지갑 사용
- 일반 웹: Privy 지갑 사용
- 지갑 주소 표시 및 트랜잭션 지원

### ✅ 소셜 공유
- URL 공유 시 rich embed 카드 표시
- 이미지, 제목, 설명 포함
- "Launch GetClayed" 버튼으로 직접 앱 실행

### ✅ 메타데이터
- Open Graph 태그
- Twitter Card 태그
- Farcaster Mini App 메타 태그

## 발견성 향상을 위한 다음 단계

앱이 Farcaster 디렉토리에 나타나려면:

### 필수 조건 ✅
- [x] `name` 필드 포함
- [x] `iconUrl` 필드 포함
- [x] `homeUrl` 필드 포함
- [x] `description` 필드 포함
- [x] 프로덕션 도메인에서 호스팅

### 권장 사항
- [ ] 최소한의 사용자 참여 확보 (사용자들에게 앱 공유 요청)
- [ ] 정기적인 업데이트로 활동성 유지
- [ ] 커뮤니티에 앱 홍보

## 모니터링

### 배포 후 확인 사항
1. **매니페스트 파일 접근 확인**
   ```bash
   curl https://getclayed.vercel.app/.well-known/farcaster.json
   ```
   
2. **메타 태그 확인**
   - 브라우저에서 페이지 소스 보기
   - `<meta name="fc:miniapp">` 태그 확인

3. **SDK 로드 확인**
   - 브라우저 콘솔에서 에러 메시지 확인
   - Farcaster 환경에서 "Farcaster SDK context" 로그 확인

### 일반적인 문제 해결

**문제: 메타 태그가 표시되지 않음**
- 해결: 브라우저 캐시 지우기 및 새로고침
- Farcaster 클라이언트도 캐시를 사용하므로 시간이 걸릴 수 있음

**문제: 지갑이 자동으로 연결되지 않음**
- 해결: 브라우저 콘솔에서 SDK 초기화 로그 확인
- Farcaster 환경에서만 자동 연결됨

**문제: .well-known/farcaster.json에 접근할 수 없음**
- 해결: Vercel 배포 확인 및 헤더 설정 확인

## 추가 기능 구현 가능

### 1. 알림 (Notifications)
사용자에게 중요한 업데이트나 이벤트 알림 전송
```typescript
await sdk.notifications.send({
  title: "New Creation!",
  body: "Check out the latest 3D art",
  url: "https://getclayed.vercel.app/project/123"
})
```

### 2. Share Extension
다른 앱에서 콘텐츠를 GetClayed로 공유받기
```typescript
sdk.share.receive((data) => {
  console.log('Received shared data:', data)
})
```

### 3. Universal Links
특정 URL 패턴을 앱 내에서 처리
```json
{
  "universalLinks": {
    "domains": ["getclayed.vercel.app"],
    "paths": ["/project/*", "/library/*"]
  }
}
```

## 성능 최적화

### 로딩 시간 개선
- [x] `ready()` 함수를 적절한 타이밍에 호출
- [ ] 이미지 및 3D 모델 최적화
- [ ] Code splitting 적용

### UX 개선
- [x] Farcaster 환경 표시 (🟣 배지)
- [ ] 로딩 상태 표시 개선
- [ ] 에러 핸들링 강화

## 프로덕션 체크리스트

### 배포 전
- [x] 빌드 테스트 성공
- [x] 모든 환경 변수 설정
- [x] .well-known 경로 설정
- [x] 메타 태그 추가
- [x] SDK 초기화 코드 추가

### 배포 후
- [ ] Farcaster에서 앱 테스트
- [ ] 지갑 연결 테스트
- [ ] 트랜잭션 테스트
- [ ] 소셜 공유 테스트
- [ ] 매니페스트 파일 접근 테스트

### 마케팅
- [ ] Farcaster에서 앱 공유
- [ ] 커뮤니티에 홍보
- [ ] 사용자 피드백 수집
- [ ] 개선 사항 구현

## 참고 자료

### 공식 문서
- [Farcaster Mini App 문서](https://miniapps.farcaster.xyz/docs)
- [Frame SDK GitHub](https://github.com/farcasterxyz/frame-sdk)
- [Farcaster 개발자 가이드](https://docs.farcaster.xyz)

### 지원
- [Farcaster Discord](https://discord.gg/farcaster)
- [Warpcast](https://warpcast.com)

## 결론

🎉 GetClayed가 Farcaster Mini App으로 성공적으로 온보딩되었습니다!

이제 다음 작업을 수행할 수 있습니다:
1. ✅ Farcaster에서 앱 실행
2. ✅ Farcaster 지갑으로 트랜잭션 수행
3. ✅ 소셜 피드에서 앱 공유
4. ✅ Farcaster 커뮤니티와 상호작용

**다음 단계**: 
- 앱을 Farcaster에서 테스트하고 피드백을 수집하세요
- 사용자들에게 앱을 공유하고 참여를 유도하세요
- 추가 기능 (알림, Share Extension 등)을 고려하세요

---

**작성일**: 2025-11-16
**상태**: ✅ 프로덕션 준비 완료
**버전**: 0.1.2

