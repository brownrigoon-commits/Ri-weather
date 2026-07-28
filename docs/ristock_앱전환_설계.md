# Ri_Stock 앱 전환 설계 (v1) — PWA → 설치형 앱

> **이 문서는 구현 지시서입니다.** 구현 담당(Opus 5)은 이 문서와
> `docs/ristock_설계.md`(데이터·전략 계약서), `CLAUDE.md`(프로젝트 원칙)를 먼저 읽고 시작합니다.
> 여기 적힌 파일 목록·검증 기준을 벗어나는 작업은 하지 않습니다.

## 0. 지금 어디까지 와 있나 (구현 전에 반드시 이해할 것)

Ri_Stock 은 이미 **동작하는 PWA** 입니다. 이 작업은 앱을 새로 만드는 것이 아니라
**"홈 화면에 추가하는 웹앱"을 "설치되는 앱"으로 포장**하는 것입니다.

이미 되어 있는 것 (다시 만들지 마라):

| 항목 | 상태 |
|---|---|
| `ristock/manifest.webmanifest` | `display: standalone`, 아이콘 192/512(maskable), 세로 고정 |
| iOS 메타 | `apple-touch-icon`(180), `apple-mobile-web-app-capable`, 상태바, 앱 타이틀 |
| 서비스워커 `ristock/sw.js` | 네트워크 우선 + 오프라인 캐시 (`ristock-v1`), `?reset` 탈출구 |
| 화면·전략·데이터 | 전부 완성. 회귀 4종 통과 상태 (아래 §6) |

**절대 바뀌면 안 되는 것**: `ristock/js/` 의 전략 계산과 `ristock/data/` 규격.
이 작업은 포장이지 기능 변경이 아닙니다. 회귀 4종이 하나라도 깨지면 실패입니다.

## 1. "앱으로 만든다"의 세 단계 — 무엇을 어디까지 하나

| 단계 | 결과물 | 폰 | 비용·계정 | 이번 작업 |
|---|---|---|---|---|
| **A. 홈 화면 앱 완성도** | 지금 PWA 를 아이폰·안드로이드에서 진짜 앱처럼 보이게 다듬기 | 둘 다 | 0원 | ✅ 한다 |
| **B. 안드로이드 APK** | 설치 파일(APK). 파일을 받아 설치하면 앱 서랍에 들어감 | 안드로이드 | 서명키(무료) | ✅ 한다 |
| **C. 스토어 등록** | Play 스토어 / App Store 배포 | 둘 다 | Play $25 · Apple $99/년 + 심사 | ❌ 안 한다 (아래 §7) |

**아이폰은 A 가 곧 최종형입니다.** iOS 는 사이드로드가 없고 App Store 심사는
개인 개발자 계정($99/년)·Mac·금융정보 앱 심사 정책이 걸립니다. 사장님 확인 전에는 진행하지 않습니다.
아이폰에서 Safari → 공유 → "홈 화면에 추가"가 설치이며, A 단계가 그 경험을 앱과 구분 안 되게 만듭니다.

**안드로이드는 B(TWA)로 진짜 APK 를 만듭니다.** WebView 래퍼(Capacitor)가 아니라
TWA(Trusted Web Activity)를 쓰는 이유:
- 앱 껍데기만 설치되고 **내용은 항상 웹 최신판** — 웹을 고치면 앱도 그대로 갱신, 앱 재배포 불필요
- 서비스워커·캐시·localStorage 를 Chrome 이 그대로 씀 — 관심종목·내 전략이 브라우저와 공유됨
- Capacitor 는 번들 동기화·업데이트 이중화 관리가 생기므로 이 프로젝트 규모에 과합니다

## 2. A단계 — 홈 화면 앱 완성도 (아이폰 중심)

### 2-1. iOS 스플래시 화면 (지금 없음 → 추가)

iOS 는 `apple-touch-startup-image` 가 없으면 앱 실행 순간 **흰 화면**이 번쩍입니다.

- `ristock/icons/make_icons.py` 를 확장해 스플래시 PNG 를 생성한다 (PIL, 외부 다운로드 금지).
  배경 `#f2f4f6`, 중앙에 앱 아이콘 + "Ri Stock" 워드마크. 다크 변형은 만들지 않는다(앱이 라이트 고정).
- 기기별 해상도를 전부 나열하면 파일이 십수 개가 된다. **많이 쓰는 6종만** 만든다:
  iPhone SE(750×1334), 8+(1242×2208), X/11 Pro(1125×2436), 11/XR(828×1792),
  12~15(1170×2532), Pro Max(1290×2796). `media` 쿼리(device-width/height, -webkit-device-pixel-ratio)로 연결.
- `index.html` `<head>` 에 `<link rel="apple-touch-startup-image" …>` 6줄 추가.
- 파일은 `ristock/icons/splash/` 아래. 총합 300KB 를 넘기지 않는다(단색 배경 PNG 라 충분).

### 2-2. 설치 안내 배너 (아이폰은 설치 버튼이 없다)

iOS Safari 는 설치 프롬프트 API 가 없어서 사장님이 "공유 → 홈 화면에 추가"를 알아야 합니다.

- `ristock/js/app.js` 에 설치 안내 배너를 추가한다. 노출 조건 **전부 AND**:
  - 아직 standalone 이 아님 (`!matchMedia('(display-mode: standalone)').matches && !navigator.standalone`)
  - 닫은 적 없음 (`localStorage` 에 `설치안내닫음` 없음)
  - 방문 2회째부터 (첫 방문은 데이터 구경이 먼저다)
- iOS 면 "공유 버튼 → 홈 화면에 추가" 그림 안내, 안드로이드면 `beforeinstallprompt` 를 잡아
  "앱으로 설치" 버튼(클릭 시 `prompt()`)을 보여준다.
- 배너는 하단 탭바 위에 붙이고, 닫기(✕)를 누르면 다시 보이지 않는다.
- **터치 검증 규칙(CLAUDE.md 3-1)을 배너 버튼에도 적용**하고 verify_pwa.mjs 에 검사를 추가한다.

### 2-3. manifest 마무리

- `id: "./"` 추가 (설치 정체성 고정 — 나중에 start_url 이 바뀌어도 같은 앱으로 인식).
- `screenshots` 2장 추가 (Android 설치 시트가 풍부해짐): 브리핑·전략 화면을
  기존 검증 하네스(playwright)로 375×812 캡처해 `ristock/icons/shot-1.png`, `shot-2.png` 로 저장.
  **주의**: 스크린샷 안에 실제 데이터가 보여도 된다(이미 공개 데이터), 단 고지 문구가 보이는 화면으로.
- maskable 전용 512 아이콘을 따로 만든다 (`icon-512-maskable.png`, 안전영역 80% 규칙).
  지금은 `any maskable` 겸용이라 안드로이드 런처가 원형으로 자를 때 여백이 부족하다.

## 3. B단계 — 안드로이드 APK (TWA)

### 3-1. 구조

```
ristock-app/                         ← 새 폴더 (저장소 최상단, 골프앱·ristock/ 와 안 겹침)
├── twa-manifest.json                ← Bubblewrap 설정 (아래 값 그대로)
├── .gitignore                       ← 키·빌드 산출물 차단 (*.keystore, build/, app-release-*)
└── README.md                        ← 빌드·서명·설치 안내 (사장님용 아님, 개발용)
```

`twa-manifest.json` 핵심 값:

| 키 | 값 | 이유 |
|---|---|---|
| `packageId` | `io.github.brownrigoon.ristock` | 도메인 역순 관례, 소유 도메인 기준 |
| `host` | `brownrigoon-commits.github.io` | |
| `startUrl` | `/Ri-weather/ristock/` | **경로 오타 = 골프앱이 열림. 반드시 끝 슬래시 포함** |
| `name` / `launcherName` | `Ri Stock` | |
| `display` | `standalone`, `orientation: portrait` | manifest 와 일치 |
| `themeColor`/`backgroundColor` | `#f2f4f6` | |
| `iconUrl` | `https://…/ristock/icons/icon-512.png` | |
| `enableNotifications` | `false` | 푸시는 이번 범위 밖 |
| `fallbackType` | `customtabs` | Chrome 없는 기기 대응 |

### 3-2. assetlinks.json — 주소창 없는 전체화면의 조건

TWA 는 `https://<host>/.well-known/assetlinks.json` 에 서명키 지문이 있어야 주소창이 사라집니다.
**이 파일은 도메인 루트에 있어야 하므로 이 저장소(Ri-weather)로는 불가능합니다.**
`brownrigoon-commits.github.io` 라는 **이름의 저장소를 새로 만들어** 그 안에
`.well-known/assetlinks.json` 을 두어야 합니다(사용자 루트 Pages).

- 구현 담당은 파일 내용(패키지명 + SHA-256 지문 자리)과 저장소 생성 절차를
  `ristock-app/README.md` 와 `docs/ristock_사용안내.md` 에 적는다.
- 저장소 생성·업로드는 **사장님 계정 권한이 필요하므로 사장님이 한다** (안내만 정확히).
- assetlinks 가 없어도 앱은 동작한다(상단에 주소창이 보일 뿐). 그러니 **선택 사항으로 설계**하고,
  없을 때/있을 때 화면 차이를 안내 문서에 그림으로 적는다.

### 3-3. 서명키 — 공개 저장소에서 가장 조심할 부분

- 키스토어(`.keystore`)와 비밀번호는 **절대 커밋 금지**. `.gitignore` 에 먼저 넣고 시작한다.
- CI 빌드용은 GitHub Secrets 3개: `RISTOCK_KEYSTORE_B64`(base64), `RISTOCK_KEYSTORE_PW`, `RISTOCK_KEY_PW`.
- 키 생성은 CI 안에서 하지 않는다(재실행마다 키가 바뀌면 업데이트 설치가 깨진다).
  **키 생성 1회는 사장님 PC 에서** `keytool` 로 하고, 절차를 사용안내에 적는다.
  생성한 키 백업(USB 등) 안내 필수 — 키를 잃으면 같은 앱으로 업데이트를 못 한다.

### 3-4. CI 빌드 — `.github/workflows/ristock-apk.yml`

- **`workflow_dispatch` 전용** (매일 돌 이유가 없다 — TWA 는 웹이 곧 앱이다).
- JDK 17 + Node 20 + Bubblewrap CLI 로 `twa-manifest.json` 에서 APK/AAB 빌드.
- Secrets 미설정이면 **친절한 한국어 에러로 즉시 실패** ("키가 아직 없습니다 — 사용안내 X장").
- 산출물은 커밋하지 않고 **GitHub Release 에 업로드** (`ristock-app-v<번호>.apk`).
  버전 번호는 workflow 입력으로 받는다.
- `permissions: contents: write` 는 release 업로드 job 에만.
- 기존 `ristock-daily.yml` 은 **한 줄도 건드리지 않는다.**

### 3-5. 설치 경로 (사용안내에 적을 것)

1. 폰에서 GitHub Release 페이지 → APK 다운로드 → "출처를 알 수 없는 앱" 허용 → 설치
2. 이후 앱 내용 업데이트는 **자동** (웹이 갱신되면 앱도 그대로) — APK 재설치는
   앱 이름·아이콘·주소가 바뀔 때만

## 4. 하지 않는 것 (하고 싶어도 참아라)

- **iOS 네이티브/스토어** — 계정·비용·심사. 사장님 결정 전 진행 금지 (§7)
- **Capacitor/Electron 래퍼** — 업데이트 이중화, 이 규모에 과함
- **푸시 알림** — 데이터 갱신 알림은 다음 단계 후보. 지금 넣으면 서버·권한 설계가 통째로 붙음
- **앱 내 로그인/사용자 관리** — 원본 Flask 의 로그인은 의도적으로 버렸다(공개 데이터 + 폰 로컬 저장).
  다시 들여오지 마라

## 5. 구현 순서와 파일 목록

| 순서 | 작업 | 파일 |
|---|---|---|
| 1 | iOS 스플래시 생성 + 연결 | `ristock/icons/make_icons.py`, `ristock/icons/splash/*`, `ristock/index.html` |
| 2 | maskable 아이콘·manifest 마무리 | `ristock/icons/icon-512-maskable.png`, `ristock/manifest.webmanifest`, 스크린샷 2장 |
| 3 | 설치 안내 배너 | `ristock/js/app.js`, `ristock/css/style.css` |
| 4 | 검증 하네스에 배너·manifest 검사 추가 | `ristock/tests/verify_pwa.mjs` |
| 5 | TWA 프로젝트 | `ristock-app/` 신규 |
| 6 | APK 빌드 워크플로 | `.github/workflows/ristock-apk.yml` 신규 |
| 7 | 문서 | `docs/ristock_사용안내.md`(설치 장 추가), `HANDOFF.md`(진행 상황), `CLAUDE.md`(영역표에 ristock-app 추가) |

`sw.js` 의 `CORE` 목록에 새 정적 파일(스플래시는 제외 — iOS 가 알아서 캐시함, maskable 아이콘만 추가)을
반영하는 것을 잊지 마라. **캐시 이름 `ristock-v1` 은 올리지 않는다** (네트워크 우선이라 불필요, CLAUDE.md 참고).

## 6. 검증 기준 (통과 못 하면 배포 금지)

1. **회귀 4종 유지**: `pytest ristock/engine/tests -q` 277 · `test_js_golden.mjs` 16/16 ·
   `verify_pwa.mjs` 128+α · `verify_phone_e2e.mjs` 297+α — 기존 수치에서 하나도 줄면 안 된다
2. 설치 배너: 노출 3조건, 닫기 영속, standalone 에서 미노출 — 하네스로 검증 (elementFromPoint 포함)
3. manifest: Chrome DevTools 기준 설치 가능 판정(필수 필드·아이콘 크기) — playwright 로 점검
4. 스플래시: 6종 PNG 존재·해상도 일치·총합 300KB 이하를 검사하는 스크립트
5. APK 워크플로: YAML 문법 + Secrets 없는 상태에서 dispatch 시 한국어 안내로 실패하는지
   (실제 APK 빌드는 Secrets 가 생겨야 가능 — HANDOFF 에 "미검증" 으로 정직하게 기록)
6. `tools/ristock_출고점검.py` 통과 + 커밋 전 민감 파일 스캔 (키스토어·비밀번호가 절대 없어야 함)

## 7. 사장님 결정 대기 (구현과 무관하게 먼저 물어볼 것)

1. **안드로이드 폰을 쓰는 사람이 있습니까?** 없으면 B단계(APK)는 만들 이유가 없습니다 — A만 하면 됩니다.
2. **Play 스토어 등록을 원하십니까?** ($25 1회, 심사 있음. 금융정보 앱은 고지 요건 추가)
3. **App Store(아이폰 설치 파일)를 원하십니까?** ($99/년 + Mac + 심사. 지금은 홈 화면 추가로 충분합니다)
4. 앱 이름은 "Ri Stock" 그대로 좋습니까? (스토어에 올릴 경우 상표 충돌 확인 필요)
