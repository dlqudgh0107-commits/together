# Together 프로젝트 — Claude 작업 가이드

## 스택
- Vanilla HTML + CSS + JavaScript + jQuery
- 프레임워크 없음 (React, Vue 등 사용 안 함)
- CSS 프레임워크 없음 (Tailwind, Bootstrap 등 사용 안 함)
- CSS 변수(Custom Properties) 사용 안 함 — 값 직접 작성
- TypeScript 사용 안 함
- Firebase (Auth, Firestore) 백엔드
- Claude API (AI 요약 기능)

## CSS 규칙
- 모든 속성은 한 줄로 작성: `.btn {display: flex; align-items: center; background: #1677ff;}`
- 클래스/셀렉터별 줄바꿈 유지
- BEM 네이밍: `.block__element--modifier`
- PC 기본 폰트: 16px / 모바일 기본 폰트: 14px
- 기본 폰트: Pretendard
- 브레이크포인트: PC 1280px 이상 / 태블릿 768~1279px / 모바일 767px 이하
- 모바일 웹 기준으로 개발 (max-width 기준 디자인)

## 디자인 시스템

### 컬러
- Primary: #1677ff
- Success: #52c41a
- Warning: #faad14
- Error: #ff4d4f
- Border: #d9d9d9
- Text: #000000e0
- Text secondary: #00000073
- Text disabled: #00000040
- Background: #f8f9ff
- Surface: #ffffff
- Surface secondary: #f5f5f5

### 스페이싱 (8px 그리드)
- 4px / 8px / 12px / 16px / 20px / 24px / 32px / 48px

### 보더 라디우스
- Small: 4px
- Medium: 8px
- Large: 12px
- XLarge: 16px
- Round: 20px
- Circle: 50%

### 타이포그래피
- 앱 제목: 22~28px / font-weight: 700 / letter-spacing: -0.5px
- 섹션 제목: 18px / font-weight: 700
- 본문 강조: 15~16px / font-weight: 600
- 본문: 14px / font-weight: 400~500
- 보조: 12~13px / font-weight: 400~500
- 캡션: 10~11px / font-weight: 500~600

### 그림자
- Card: 0 2px 8px rgba(0,0,0,0.06)
- Modal: 0 8px 32px rgba(0,0,0,0.12)
- FAB: 0 4px 16px rgba(22,119,255,0.4)
- Icon active: 0 8px 24px rgba(22,119,255,0.3)

## 파일 구조
```
project/
├── index.html
├── CLAUDE.md
├── firebase.json
└── resource/
    ├── images/
    ├── font/
    ├── js/
    │   ├── firebase.js   — Firebase 초기화·Auth·CRUD
    │   ├── app.js        — 라우팅·이벤트·렌더링
    │   └── ai.js         — Claude API 연동
    └── css/
        ├── reset.css
        ├── font.css
        ├── mobile.css    — 메인 스타일
        └── pc.css        — PC 중앙정렬
```

## JS 규칙
- const/let 사용 (var 사용 안 함)
- 요소 선택은 data-* 속성 사용: `document.querySelector('[data-btn]')`
- 이벤트는 addEventListener 사용
- ES Module 방식 (import/export)

## HTML 규칙
- 시맨틱 태그 사용
- img alt 필수
- data-* 속성으로 JS 훅 연결

## 화면 구성
- 로딩 화면 (.loading-screen)
- 로그인 화면 (#screen-login) — Google 로그인
- 그룹 설정 화면 (#screen-group) — 생성/참여
- 홈 화면 (#screen-home) — 하단 탭 네비

## 하단 탭 네비 (5개)
- 홈 (home) — 대시보드
- 일정 (schedule) — 일정 리스트
- + FAB — 일정/할일 빠른 등록
- 할 일 (todo) — ToDo 리스트
- 알림장 (feed) — 활동 타임라인

## 주요 컴포넌트 패턴

### 버튼
```css
.btn-primary {width: 100%; height: 52px; background: #1677ff; border-radius: 12px; font-size: 16px; font-weight: 600; color: #ffffff; cursor: pointer; transition: all 0.15s;}
.btn-primary:active {transform: scale(0.98); opacity: 0.9;}
```

### 입력 필드
```css
.form-input {width: 100%; height: 48px; background: #f5f5f5; border-radius: 10px; padding: 0 16px; font-size: 15px; color: #000000e0; border: 1.5px solid transparent; transition: border-color 0.15s;}
.form-input:focus {border-color: #1677ff; background: #ffffff;}
```

### 카드
```css
.card {background: #ffffff; border-radius: 12px; padding: 14px 16px; margin-bottom: 8px;}
```

### 모달 (바텀시트)
```css
.modal-overlay {position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 200; display: none; align-items: flex-end;}
.modal {background: #ffffff; border-radius: 20px 20px 0 0; width: 100%; padding: 20px 24px 40px;}
```

### AI 카드
```css
.ai-card {background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%); border-radius: 16px; padding: 16px 20px;}
```

### FAB
```css
.bottom-nav__fab {width: 52px; height: 52px; background: #1677ff; border-radius: 50%; box-shadow: 0 4px 16px rgba(22,119,255,0.4);}
```

## 코드 작성 원칙
- 항상 완성된 전체 코드 제공 (부분 코드 X)
- 설명은 간결하게
- 수정 시 해당 파일 전체를 다시 작성
- PC에서는 390px 중앙정렬로 모바일 앱처럼 보이게
