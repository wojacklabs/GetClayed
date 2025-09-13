# 애니메이션 로고 생성 가이드

## 개요
헤더에 사용되는 꿈틀거리는 지점토 로고를 APNG (Animated PNG)로 변환하여 favicon, Farcaster 아이콘 등으로 사용하는 방법입니다.

## 1. APNG 생성 방법

### 자동 생성 (권장)
```bash
# 한 번에 프레임 캡처 + APNG 생성
npm run create-logo
```

### 단계별 생성
```bash
# 1단계: AnimatedClayLogo의 30개 프레임 캡처
npm run generate-frames

# 2단계: 캡처한 프레임을 APNG로 합치기  
npm run generate-apng
```

## 2. 생성 과정 설명

### 프레임 캡처 (`generateLogoFrames.js`)
- Puppeteer로 브라우저 자동화
- Three.js AnimatedClayLogo를 512x512px로 렌더링
- 30 프레임을 10 FPS로 캡처
- `temp_frames/` 디렉토리에 PNG 파일 저장

### APNG 생성 (`createAPNG.js`)
- `temp_frames/`의 PNG 파일들을 읽기
- UPNG.js로 APNG 인코딩
- `public/animated-logo.png`로 저장
- 루프 애니메이션, 투명 배경 지원

## 3. 생성된 파일 위치
```
/public/animated-logo.png
```

## 4. 사용 방법

### favicon으로 사용
`app/layout.tsx`에서:
```typescript
icons: {
  icon: [
    { url: '/animated-logo.png', type: 'image/png' }
  ],
}
```

### Farcaster 아이콘으로 사용
`public/.well-known/farcaster.json`에서:
```json
{
  "frame": {
    "iconUrl": "https://getclayed.vercel.app/animated-logo.png",
    "splashImageUrl": "https://getclayed.vercel.app/animated-logo.png"
  }
}
```

### manifest.json에서 사용
`public/manifest.json`에서:
```json
{
  "icons": [
    {
      "src": "/animated-logo.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## 5. 브라우저 지원

### APNG 지원 브라우저
- ✅ Firefox
- ✅ Safari (iOS/macOS)
- ✅ Chrome (90+)
- ✅ Edge (90+)
- ✅ Opera

### Favicon 애니메이션
- ⚠️ 일부 브라우저는 favicon 애니메이션을 지원하지 않을 수 있습니다
- 지원하지 않는 경우 첫 프레임만 표시됩니다

## 6. 파일 정보
- **프레임 수**: 30개
- **FPS**: 10 (1 프레임당 100ms)
- **총 애니메이션 길이**: 3초
- **루프**: 무한 반복
- **크기**: 512x512px
- **배경**: 투명

## 7. 커스터마이징

### 프레임 수 변경
`scripts/generateLogoFrames.js`:
```javascript
const FRAME_COUNT = 60; // 30 → 60으로 변경
```

### FPS 변경
`scripts/generateLogoFrames.js`:
```javascript
const FRAME_RATE = 20; // 10 → 20으로 변경
```

`scripts/createAPNG.js`:
```javascript
const FRAME_DELAY = 50; // 100 → 50으로 변경 (1000/FPS)
```

### 이미지 크기 변경
`scripts/generateLogoFrames.js`:
```javascript
const SIZE = 1024; // 512 → 1024로 변경
```

## 8. 임시 파일 정리
```bash
# 프레임 캡처 후 생성되는 임시 파일 삭제
rm -rf temp_frames
```

## 9. 트러블슈팅

### Puppeteer 설치 오류
```bash
# Puppeteer 재설치
npm install --save-dev puppeteer
```

### 생성된 APNG 파일이 너무 큼
- 프레임 수 줄이기 (FRAME_COUNT)
- 이미지 크기 줄이기 (SIZE)
- FPS 낮추기 (FRAME_RATE)

### 애니메이션이 부자연스러움
- FPS 높이기 (FRAME_RATE)
- 프레임 수 늘리기 (FRAME_COUNT)

## 10. 대안: 정적 이미지

APNG 대신 대표 스냅샷을 사용하고 싶다면:
1. `npm run generate-frames` 실행
2. `temp_frames/`에서 마음에 드는 프레임 선택
3. 해당 파일을 `public/logo.png`로 복사
4. 설정 파일에서 `animated-logo.png` 대신 `logo.png` 사용

