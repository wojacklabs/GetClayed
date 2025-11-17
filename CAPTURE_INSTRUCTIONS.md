# 애니메이션 로고 캡처 방법

## 방법: 브라우저 개발자 도구에서 직접 캡처

1. **http://localhost:3000** 접속 (개발 서버가 실행 중이어야 함)

2. **개발자 도구 열기**: `Cmd+Option+I`

3. **Console 탭**에서 다음 코드 복사/붙여넣기:

```javascript
// 프레임 캡처 함수
async function captureLogoFrames() {
  const canvas = document.querySelector('header canvas');
  if (!canvas) {
    console.error('Canvas not found!');
    return;
  }
  
  console.log('Capturing 30 frames...');
  
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `frame_${String(i).padStart(3, '0')}.png`;
    link.href = dataURL;
    link.click();
    
    console.log(`Frame ${i + 1}/30 captured`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('✅ All 30 frames captured!');
  console.log('Check your Downloads folder for frame_000.png ~ frame_029.png');
}

// 실행
captureLogoFrames();
```

4. **엔터** 눌러서 실행

5. 자동으로 30개 프레임이 다운로드됨

6. 다운로드 완료되면 채팅창에 **"캡처완료"** 입력

