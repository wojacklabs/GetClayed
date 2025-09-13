# 계층적 라이브러리 종속성 문제 해결

## 문제 상황

A → B → C 계층 구조에서:
- A 프로젝트를 라이브러리로 등록
- B 프로젝트가 A 라이브러리를 사용하여 제작
- B 프로젝트를 라이브러리로 등록
- C 프로젝트가 B 라이브러리를 사용하여 제작
- C 프로젝트를 라이브러리로 등록하려고 할 때 오류 발생

오류 메시지:
```
Cannot register as library: This project's library dependencies have been tampered with. 
Missing: clay-1763018408687-i58nuqwij
```

## 원인 분석

1. B 라이브러리를 가져올 때:
   - B의 clay objects가 C에 복사됨 (이 중에는 A 라이브러리에서 온 objects도 포함)
   - C의 usedLibraries에는 A와 B가 모두 추가됨
   - 하지만 C의 directImports에는 B만 포함됨

2. C를 라이브러리로 등록하려고 할 때:
   - clay objects를 스캔하여 librarySourceId 수집
   - A와 B의 ID가 모두 감지됨 (A는 B를 통해 간접적으로 포함됨)
   - usedLibraries와 비교하면 A가 누락된 것으로 판단

## 해결 방법

### 1. projectIntegrityService.ts 수정 완료

`detectLibraryTampering` 함수를 수정하여 계층적 종속성을 올바르게 처리:
- directImports를 고려하여 간접 종속성은 무시
- clay objects에 있는 라이브러리만 검증
- 간접 종속성이 usedLibraries에만 있는 것은 정상으로 처리

### 2. 추가 개선사항 (권장)

#### AdvancedClay.tsx의 handleSaveProject 수정
```typescript
// clay object를 복사할 때 간접 종속성의 librarySourceId는 유지하지 않도록 수정
// 또는 librarySourceId에 계층 정보를 추가 (예: "direct:B", "indirect:A")
```

## 테스트 시나리오

1. A 프로젝트 생성 → 라이브러리 등록
2. B 프로젝트에서 A 가져오기 → 라이브러리 등록
3. C 프로젝트에서 B 가져오기 → 라이브러리 등록 (성공해야 함)
4. C 저장 시 B에 대한 로열티만 지불 확인
5. D 프로젝트에서 C 가져오기 시 C 로열티만 지불 확인

## 보안 고려사항

1. **로열티 체인**: 각 레벨에서 직접 import한 라이브러리에 대해서만 로열티 지불
2. **무결성 검증**: clay objects의 librarySourceId가 usedLibraries에 있는지만 확인
3. **계층 추적**: directImports로 직접/간접 종속성 구분

## 장기적 개선 방향

1. **메타데이터 추가**: clay object에 라이브러리 계층 정보 포함
   ```typescript
   interface ClayObject {
     librarySourceId: string;
     librarySourceName: string;
     libraryHierarchy?: {
       direct: string;    // 직접 가져온 라이브러리
       path: string[];    // 전체 경로 (예: ["A", "B", "C"])
     };
   }
   ```

2. **스마트 컨트랙트 개선**: 계층적 로열티 분배 자동화
3. **UI 개선**: 라이브러리 종속성 트리 시각화
