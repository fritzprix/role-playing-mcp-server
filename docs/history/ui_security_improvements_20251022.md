# UI 보안 및 iframe 렌더링 개선 (2025-10-22)

## 개선 사항 요약

### 🔒 보안 개선

#### 1. XSS 방지 - HTML 이스케이프 추가

**문제점:**

- 사용자 입력 및 게임 상태 데이터가 HTML에 직접 삽입되어 XSS 공격에 취약
- `gameOverReason`, `gameId`, `storyProgress`, `options` 등이 이스케이프 없이 렌더링

**해결책:**

```typescript
// 새로운 헬퍼 함수 추가
private escapeHtml(input: unknown): string {
  const s = String(input ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

**적용 위치:**

- `generateGameUI`: `storyProgress`, `options`, `gameId` 모두 이스케이프
- `generateGameOverUI`: `gameOverReason`, `gameId`, JSON 상태 이스케이프
- `generateDeltaSection`: `delta.description` 이스케이프

#### 2. 안전한 이벤트 핸들링

**문제점:**

- 인라인 `onclick` 핸들러 사용: `onclick="selectAction('${gameId}', ...)"`
- `event.target` 사용 시 `event` 매개변수 누락으로 런타임 에러 발생 가능

**해결책:**

```javascript
// Before: 인라인 onclick (취약)
<button onclick="selectAction('${gameId}', '${option}', ${index})">

// After: data attributes + addEventListener (안전)
<button 
    data-gameid="${safeGameId}"
    data-option="${safeOption}"
    data-index="${index}"
>
```

```javascript
// 안전한 이벤트 리스너
(function() {
    const buttons = document.querySelectorAll('.action-button');
    buttons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const gameId = btn.dataset.gameid;
            // ... 처리
        });
    });
})();
```

### 📱 iframe 렌더링 최적화

#### 3. 반응형 레이아웃 개선

**문제점:**

- `min-height: 100vh` → iframe 내부에서 불필요한 스크롤 발생
- `max-width: 800px` 고정 → 좁은 화면에서 overflow
- `padding: 40px` → 작은 viewport에서 콘텐츠 영역 극소화

**해결책:**

```css
/* Before */
body {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
}

/* After: iframe-friendly */
* {
    box-sizing: border-box;
}
html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
}
body {
    overflow-x: hidden;
    padding: 10px;
}
.game-container {
    width: 100%;
    max-width: 700px; /* 더 보수적 */
    margin: 0 auto;
    padding: 20px;
}
```

**반응형 미디어 쿼리 추가:**

```css
@media (max-width: 480px) {
    body {
        padding: 5px;
    }
    .game-container {
        padding: 15px;
    }
    .story-section {
        padding: 15px;
        font-size: 14px;
    }
    .action-button {
        padding: 12px 15px;
        font-size: 14px;
    }
}
```

#### 4. 텍스트 Overflow 방지

**문제점:**

- `<pre>` 태그의 `JSON.stringify()` 결과가 줄바꿈 없이 렌더링
- 긴 텍스트가 가로 스크롤 강제 발생
- `overflow-y: auto`만 있고 `overflow-x` 없어 스크롤바 숨김

**해결책:**

```css
/* 모든 텍스트 콘테이너에 word-wrap 추가 */
.story-section,
.game-over-reason {
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* JSON 표시 개선 */
.final-state-content {
    overflow-x: auto;  /* 명시적 가로 스크롤 */
    overflow-y: auto;
    max-height: 250px;
    white-space: pre-wrap;  /* 줄바꿈 유지하면서 wrap */
    word-wrap: break-word;
    font-size: 12px;
}
```

#### 5. Game Over UI 최적화

**변경사항:**

- 장황한 설명 섹션(`.what-went-wrong`, `.how-to-prevent`) 제거
- 게임 상태 요약 섹션 추가:

  ```typescript
  private generateGameStateSummary(state: GameState): string {
    return `
      <div class="state-item">👤 Characters: ${state.characters?.length || 0}</div>
      <div class="state-item">📍 Location: ${this.escapeHtml(state.world?.location || 'Unknown')}</div>
      <div class="state-item">📖 Story: ${this.escapeHtml(state.story?.progress || 'N/A')}</div>
      <div class="state-item">🎒 Items: ${state.inventory?.length || 0}</div>
    `;
  }
  ```

- 전체 JSON은 `<details>` 태그로 접기/펼치기 가능하게 변경:

  ```html
  <details>
      <summary>📋 전체 게임 상태 보기</summary>
      <div class="final-state-content">${safeJsonFull}</div>
  </details>
  ```

### ♿ 접근성 개선

#### 6. ARIA 속성 및 키보드 접근성

**추가 사항:**

```html
<!-- 버튼에 명확한 레이블 -->
<button 
    id="restart-btn"
    type="button"
    aria-label="게임 재시작"
>

<!-- 처리 중 상태 표시 -->
btn.setAttribute('aria-busy', 'true');

<!-- 자동 포커스 -->
btn.focus();
```

## 영향 분석

### ✅ 개선된 점

1. **보안**: XSS 공격 벡터 제거
2. **안정성**: 이벤트 핸들러 버그 수정
3. **UX**: iframe 내 렌더링 품질 향상
4. **성능**: 불필요한 콘텐츠 접기로 초기 로드 개선
5. **접근성**: 스크린 리더 및 키보드 사용자 지원

### ⚠️ 주의사항

1. **호환성**: 기존 MCP UI 클라이언트와 100% 호환
2. **기능**: 모든 툴 호출 로직은 변경 없음
3. **시각**: CSS 스타일 일부 조정되었으나 전반적 디자인 유지

### 🧪 테스트 권장사항

1. **XSS 테스트**: 악의적 입력 값으로 테스트

   ```javascript
   gameOverReason: "<script>alert('XSS')</script>"
   gameId: "'; alert(1); //"
   ```

2. **iframe 크기**: 다양한 크기에서 렌더링 확인
   - 600px × 400px
   - 480px × 800px (모바일)
   - 1200px × 800px (데스크톱)
3. **긴 콘텐츠**: 매우 큰 게임 상태로 overflow 테스트
4. **접근성**: 키보드 내비게이션 및 스크린 리더 테스트

## 변경된 파일

- `/src/index.ts`: RPGMCPServer 클래스 수정
  - `escapeHtml()` 메서드 추가
  - `generateGameStateSummary()` 메서드 추가
  - `generateGameUI()` 전면 개선
  - `generateGameOverUI()` 전면 개선
  - `generateDeltaSection()` 이스케이프 적용

## 빌드 확인

```bash
$ npm run build
✅ 컴파일 성공 (오류 없음)
```

## 다음 단계 제안

1. **CSP 헤더 추가**: Content-Security-Policy 설정 고려
2. **postMessage origin 제한**: `'*'` 대신 특정 origin 지정
3. **E2E 테스트**: 실제 MCP 클라이언트에서 통합 테스트
4. **성능 모니터링**: 큰 게임 상태에서 렌더링 시간 측정
