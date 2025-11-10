# 환경 변수 업데이트 필요

## 문제
- **프로덕션 환경 (Vercel)**: 새 컨트랙트 사용 (`0xA742D5B85DE818F4584134717AC18930B6cAFE1e`)
- **로컬 환경 (.env.local)**: 이전 컨트랙트 사용 (`0xFdF68975e992ca365aF4452f439A726522156Fb2`)

이로 인해 이전 컨트랙트에 등록된 라이브러리가 새 컨트랙트에서 "Already registered" 에러를 발생시킴.

## 해결 방법

### 1. 로컬 환경 변수 업데이트
`.env.local` 파일에서:
```
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xA742D5B85DE818F4584134717AC18930B6cAFE1e
```

### 2. 개발 서버 재시작
```bash
npm run dev
```

### 3. 브라우저 캐시 클리어
- 개발자 도구 > Application > Clear Storage

## 참고사항
- 이전 컨트랙트에 등록된 프로젝트들은 새 컨트랙트에서 새로 등록 가능
- 각 컨트랙트는 독립적인 상태를 유지
