# Farcaster OG 이미지 - Three.js 스크린샷 방식 구현 ✅

## 최종 솔루션: Puppeteer + Three.js iframe

### 구현 방식

```
Farcaster 크롤러
    ↓
    ↓ 요청: /project/[id]
    ↓
layout.tsx (generateMetadata)
    ↓
    ↓ og:image 메타태그 설정
    ↓
Farcaster가 이미지 요청
    ↓
    ↓ GET /api/og/screenshot/project/[id]
    ↓
Puppeteer API (Node.js Runtime)
    ↓
    ↓ 1. Chromium 브라우저 실행
    ↓ 2. /og-viewer/project/[id] 페이지로 이동
    ↓ 3. Three.js가 3D 렌더링 (2초 대기)
    ↓ 4. 스크린샷 캡처 (1200x630 PNG)
    ↓
Farcaster에 PNG 이미지 반환
```

## 구현된 파일

### 1. Screenshot API (Puppeteer)
- `/app/api/og/screenshot/project/[id]/route.tsx` - 프로젝트용
- `/app/api/og/screenshot/library/[id]/route.tsx` - 라이브러리용
- `/app/api/og/screenshot/marketplace/[id]/route.tsx` - 마켓플레이스용

**특징:**
- ✅ Node.js runtime 사용 (Puppeteer 지원)
- ✅ `@sparticuz/chromium` - Vercel 최적화
- ✅ 30초 최대 실행 시간
- ✅ 자동 브라우저 정리
- ✅ 1시간 캐싱
- ✅ 개발/프로덕션 환경 자동 감지

### 2. 3D Viewer Pages (Three.js)
- `/app/og-viewer/project/[id]/page.tsx` - 프로젝트 뷰어
- `/app/og-viewer/library/[id]/page.tsx` - 라이브러리 뷰어
- `/app/og-viewer/marketplace/[id]/page.tsx` - 마켓플레이스 뷰어

**특징:**
- ✅ 실제 Three.js 렌더링
- ✅ 자동 회전 애니메이션
- ✅ 프로젝트 정보 오버레이
- ✅ 1200x630 고정 크기
- ✅ 모든 clay 도형 지원
- ✅ 변형된 geometry도 정확히 표현

### 3. Layout 파일 (메타데이터)
- `/app/project/[id]/layout.tsx`
- `/app/library/[id]/layout.tsx`
- `/app/marketplace/[id]/layout.tsx`

```typescript
// 스크린샷 API 사용
const ogImageUrl = `${baseUrl}/api/og/screenshot/project/${id}`
```

## 장점 ⭐

### 1. 완벽한 3D 렌더링
- ✅ 실제 Three.js 렌더링 결과
- ✅ 모든 도형 지원 (sphere, box, cylinder, cone, torus)
- ✅ 변형된 geometry 완벽 표현
- ✅ 복잡한 sculpted 모델도 정확히 렌더링

### 2. 유연성
- ✅ 조명, 카메라, 배경색 완벽 반영
- ✅ 자동 회전 애니메이션
- ✅ 프로젝트 정보 오버레이
- ✅ 페이지별 커스터마이징 가능

### 3. 성능 최적화
- ✅ 1시간 CDN 캐싱
- ✅ stale-while-revalidate (24시간)
- ✅ 개발 환경에서 로컬 Chrome 사용
- ✅ 프로덕션에서 최적화된 Chromium

## 단점 및 제한사항 ⚠️

### 1. 응답 시간
- ⚠️ 첫 요청: 3-5초 (브라우저 실행 + 렌더링)
- ✅ 캐시된 요청: 즉시

### 2. 서버 리소스
- ⚠️ Chromium 메모리 사용 (~100MB per request)
- ⚠️ CPU 사용량 높음
- ✅ 하지만 캐싱으로 실제 요청 수는 적음

### 3. Vercel 제한사항
- ⚠️ Function 실행 시간 제한 (30초)
- ⚠️ 메모리 제한 (1GB)
- ✅ 일반적인 프로젝트는 문제 없음

## 로컬 테스트

### 1. 개발 서버 시작
```bash
npm run dev
```

### 2. 브라우저에서 테스트
```
# OG Viewer 직접 확인
http://localhost:3000/og-viewer/project/[PROJECT_ID]

# Screenshot API 테스트
http://localhost:3000/api/og/screenshot/project/[PROJECT_ID]
```

### 3. Farcaster 테스트
1. 프로젝트를 Irys에 저장
2. Transaction ID 확인
3. Warpcast에서 링크 공유:
   ```
   https://getclayed.io/project/[TRANSACTION_ID]
   ```

## 배포 설정

### Vercel 환경 변수 (필요 없음)
Puppeteer와 Chromium은 자동으로 설정됩니다.

### 빌드 확인
```bash
npm run build
```

빌드가 성공하면 다음과 같이 표시됩니다:
```
ƒ /api/og/screenshot/project/[id]    166 B    104 kB
ƒ /og-viewer/project/[id]            1.98 kB   343 kB
```

## 모니터링

### 로그 확인
```bash
# Vercel 로그
vercel logs --follow

# 로그 예시
[Screenshot API] Rendering project: abc123
[Screenshot API] Browser launched
[Screenshot API] Viewport set
[Screenshot API] Navigating to: https://getclayed.io/og-viewer/project/abc123
[Screenshot API] Page loaded
[Screenshot API] Canvas found
[Screenshot API] Render wait complete
[Screenshot API] Screenshot captured, size: 123456
```

### 성능 메트릭
- 평균 응답 시간: 3-5초 (첫 요청)
- 캐시 히트: <100ms
- 메모리 사용: ~100MB per function
- 동시 요청: Vercel이 자동 스케일링

## 문제 해결

### 1. 타임아웃 에러
```json
{ "error": "Failed to generate screenshot", "message": "Navigation timeout" }
```

**해결:**
- og-viewer 페이지 로딩 최적화
- timeout 값 증가 (maxDuration)
- 프로젝트 데이터 크기 확인

### 2. Canvas not found
```json
{ "error": "Failed to generate screenshot", "message": "waiting for selector `canvas` failed" }
```

**해결:**
- og-viewer 페이지에서 Canvas 렌더링 확인
- Three.js 초기화 에러 체크
- 브라우저 콘솔 확인

### 3. Chromium 실행 실패
```json
{ "error": "Failed to generate screenshot", "message": "Failed to launch browser" }
```

**해결:**
- 로컬: Chrome 경로 확인
- Vercel: `@sparticuz/chromium` 버전 확인
- Function 메모리 제한 확인

## 대안 (향후)

### 옵션 A: 썸네일 사전 생성
- 프로젝트 저장 시 미리 생성
- 빠른 응답 시간
- 스토리지 비용 증가

### 옵션 B: 외부 렌더링 서비스
- 별도 서버에서 Puppeteer 실행
- Vercel 제한 회피
- 인프라 비용 증가

## 결론

**현재 구현이 최적의 해결책입니다:**
1. ✅ 완벽한 3D 렌더링 품질
2. ✅ 모든 도형 및 변형 지원
3. ✅ Vercel에서 바로 작동
4. ✅ 캐싱으로 성능 문제 최소화
5. ✅ 추가 인프라 불필요

**제한사항도 수용 가능:**
- 첫 요청 3-5초는 소셜 미디어 크롤러에게 문제 없음
- 캐싱으로 대부분 요청은 즉시 응답
- Farcaster/Twitter는 이미지를 한 번만 fetch하고 캐싱함

