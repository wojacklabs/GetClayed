# Farcaster Aspect Ratio 수정 완료

## 🎯 문제
- animated-logo.png가 Farcaster embed에서 잘려서 표시됨
- aspectRatio가 설정되지 않아 기본값(16:9 또는 1.91:1)으로 표시됨

## ✅ 해결
animated-logo.png는 정사각형(512x512) 이미지이므로 `aspectRatio: "1:1"`을 추가

### 수정된 파일:

1. **`public/.well-known/farcaster.json`**
   ```json
   {
     "miniapp": {
       "imageUrl": "https://getclayed.io/animated-logo.png?v=2",
       "aspectRatio": "1:1",  // ✅ 추가
       ...
     },
     "frame": {
       "imageUrl": "https://getclayed.io/animated-logo.png?v=2",
       "aspectRatio": "1:1",  // ✅ 추가
       ...
     }
   }
   ```

2. **`app/layout.tsx`**
   ```typescript
   const miniAppEmbed = {
     version: "1",
     imageUrl: "https://getclayed.io/animated-logo.png",
     aspectRatio: "1:1",  // ✅ 추가
     ...
   };

   const frameEmbed = {
     version: "1",
     imageUrl: "https://getclayed.io/animated-logo.png",
     aspectRatio: "1:1",  // ✅ 추가
     ...
   };
   ```

## 📐 Aspect Ratio 옵션

Farcaster에서 지원하는 aspect ratio:
- `"1:1"` - 정사각형 (추천: 로고, 아이콘)
- `"1.91:1"` - 가로형 (추천: OG 이미지, 프로젝트 프리뷰)

## 🔧 추가 수정 사항

- Frame 섹션의 중복된 `?v=2?v=2`를 `?v=2`로 수정

## 📊 결과

이제 Farcaster에서 링크를 공유할 때:
- ✅ animated-logo가 잘리지 않고 전체가 표시됨
- ✅ 정사각형 비율로 올바르게 렌더링됨
- ✅ 로고가 중앙에 배치되어 보기 좋게 표시됨

## 🧪 테스트 방법

1. **Farcaster Embed Validator**
   ```
   https://warpcast.com/~/developers/embeds
   ```
   URL 입력: `https://getclayed.io`

2. **Warpcast에서 직접 테스트**
   - 새 캐스트 작성
   - `https://getclayed.io` 링크 추가
   - 프리뷰 확인

## 💡 참고

- 변경사항은 Farcaster 캐시가 갱신될 때까지 시간이 걸릴 수 있음
- `?v=2` 쿼리 파라미터로 캐시 무효화
- 필요시 Warpcast Developer Console에서 수동으로 재검증




