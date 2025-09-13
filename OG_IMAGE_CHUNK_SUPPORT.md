# 프로젝트 OG 이미지 - 청크 프로젝트 3D 렌더링 지원

## 🎯 문제
- 프로젝트와 라이브러리 상세 링크 공유 시 3D 도형이 안 보이고 기본 clay ball이 표시됨
- 청크로 저장된 프로젝트는 clayObjects 데이터를 직접 가져올 수 없었음

## 📊 현재 상황 분석

### 테스트 프로젝트 (ID: 9zYAicDJoCZXaVTAAS47WiLhzspDgCUWL8jemeHPAmzz)
```json
{
  "thumbnailId": 없음 ❌,
  "clayObjects": 없음 ❌,
  "chunkSetId": "있음" ✅,
  "totalChunks": 9,
  "chunks": ["chunk1-id", "chunk2-id", ...]
}
```

## ✅ 해결책

### 1. 청크 재조합 로직 추가

**프로젝트 OG 이미지** (`/api/og/project/[id]/route.tsx`):

```typescript
// 청크 매니페스트 감지
if (projectData.chunkSetId && projectData.totalChunks) {
  // 모든 청크 가져오기
  const chunkPromises = chunks.map(chunkId =>
    fetch(`https://uploader.irys.xyz/tx/${chunkId}/data`)
  );
  
  const chunkData = await Promise.all(chunkPromises);
  const fullData = chunkData.join(''); // 청크 조합
  const reassembledProject = JSON.parse(fullData);
  
  // clayObjects 추출
  clayObjects = reassembledProject.clayObjects || [];
  backgroundColor = reassembledProject.backgroundColor || '#000000';
}
```

### 2. OG 이미지 생성 우선순위

```
1순위: Thumbnail ID 있음
  ↓ → 썸네일 이미지 반환 (PNG/JPEG)

2순위: clayObjects 있음 (일반 또는 청크 재조합)
  ↓ → SVG로 3D 렌더링 (최대 10개 객체)
  ├─ box → 사각형
  ├─ cylinder → 타원
  └─ sphere/cone/torus → 원

3순위: 둘 다 없음
  └ → 기본 clay ball + 프로젝트명
```

## 🎨 SVG 3D 렌더링

### 지원하는 객체 타입:
- **Box**: 회전 가능한 사각형
- **Cylinder**: 타원형으로 표현
- **Sphere/Cone/Torus**: 원형으로 표현

### 렌더링 특징:
- 위치(x, y, z) 반영
- 크기(scale) 반영
- 색상(color) 반영
- 회전(rotation.z) 반영
- Z축 깊이감 (opacity 조정)
- 최대 10개 객체까지

## ⚡ 성능 고려사항

### Edge Runtime 타임아웃:
- Vercel Edge: 30초 제한
- 청크가 많을 경우 타임아웃 가능

### 최적화:
```typescript
// 병렬 청크 로드
const chunkPromises = chunks.map(chunkId => fetch(...));
await Promise.all(chunkPromises);

// 캐싱
headers: {
  'Cache-Control': 'public, max-age=3600, s-maxage=3600'
}
```

## 📋 Library OG 이미지

**현재 상태**:
- ✅ Thumbnail ID 있으면 base64로 표시
- ⚠️ 없으면 기본 clay ball

**향후 개선**:
- Library도 청크 재조합 지원 추가 필요
- 현재는 프로젝트만 지원

## 🧪 테스트 방법

### 1. 로컬 테스트
```bash
npm run dev

# 브라우저에서:
http://localhost:3000/api/og/project/9zYAicDJoCZXaVTAAS47WiLhzspDgCUWL8jemeHPAmzz?name=stone,%20star,%20flower,%20heart&author=Unknown
```

### 2. Farcaster 테스트
```
https://warpcast.com/~/developers/embeds

URL 입력:
https://getclayed.io/project/9zYAicDJoCZXaVTAAS47WiLhzspDgCUWL8jemeHPAmzz
```

### 3. 직접 OG 이미지 확인
```bash
curl -I "https://getclayed.io/api/og/project/[ID]"
# Content-Type: image/png
```

## 📌 주의사항

1. **청크 수 제한**
   - 너무 많은 청크는 타임아웃 발생 가능
   - 현재는 제한 없음 (필요시 추가)

2. **복잡한 3D 모델**
   - SVG는 간단한 2D 표현만 가능
   - 복잡한 모델은 단순화됨

3. **최적의 방법**
   - **프로젝트 저장 시 썸네일 자동 생성** ← 가장 권장!
   - OG 이미지 생성 시간 단축
   - 더 정확한 프리뷰 제공

## 🔜 향후 개선사항

1. **자동 썸네일 생성**
   - 프로젝트 저장/업데이트 시 캔버스 스크린샷
   - Irys에 썸네일 업로드
   - thumbnailId를 프로젝트 메타데이터에 포함

2. **Library 청크 재조합**
   - 현재는 Project만 지원
   - Library도 동일한 로직 적용

3. **더 나은 3D 표현**
   - Three.js를 사용한 서버사이드 렌더링
   - 또는 Puppeteer로 실제 3D 스크린샷

## ✅ 결과

이제 청크로 저장된 대용량 프로젝트도:
- ✅ OG 이미지에서 3D 객체 표시
- ✅ SVG로 간단한 2D 표현
- ✅ 프로젝트명 + 작성자 정보 표시
- ✅ 기본 clay ball 대신 실제 도형 표시




