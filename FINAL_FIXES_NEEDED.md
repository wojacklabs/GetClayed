# 🔧 최종 수정 필요 사항 (3개)

## 1. AdvancedClay.tsx Line 2165-2171

**현재**:
```typescript
const [usedLibraries, setUsedLibraries] = useState<Array<{
  projectId: string;
  name: string;
  priceETH: string;        // ❌ 제거
  priceUSDC: string;       // ❌ 제거
  creator: string;
}>>([])
```

**수정**:
```typescript
const [usedLibraries, setUsedLibraries] = useState<Array<{
  projectId: string;
  name: string;
  royaltyPerImportETH: string;  // ✅ 추가
  royaltyPerImportUSDC: string; // ✅ 추가
  creator?: string;
}>>([])
```

---

## 2. royaltyService.ts - LibraryDependency 인터페이스

**파일**: `lib/royaltyService.ts`  
**찾기**: `interface LibraryDependency` 또는 `type LibraryDependency`

**수정**:
```typescript
interface LibraryDependency {
  projectId: string;
  name: string;
  royaltyPerImportETH: string;  // priceETH 대신
  royaltyPerImportUSDC: string; // priceUSDC 대신
  creator?: string;
}
```

---

## 3. AdvancedClay.tsx Line 3948-3956 - ThumbnailCapture 제거

**현재**:
```tsx
<ThumbnailCapture 
  captureRequested={captureRequested}
  onCapture={(dataUrl) => {
    setCapturedThumbnail(dataUrl)
    setCaptureRequested(false)
    thumbnailResolveRef.current?.(dataUrl)
    thumbnailResolveRef.current = null
  }}
/>
```

**삭제 또는 주석 처리**

---

## ✅ 완료 후 빌드

```bash
npm run build
```

성공하면 완성! 🚀

---

## 📋 v3.0 최종 컨트랙트 (Vercel 환경변수)

```
NEXT_PUBLIC_PRIVY_APP_ID=cmeweacxn014qlg0c61fthp1h
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xFdF68975e992ca365aF4452f439A726522156Fb2
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x9C47413D00799Bd82300131D506576D491EAAf90
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0xD773D9cB49a170c6C04A46f2C88b343664035511
```

