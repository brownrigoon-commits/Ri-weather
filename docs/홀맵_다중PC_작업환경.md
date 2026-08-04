# 투어리스트 홀맵 다중 PC 작업환경

최종 갱신: 2026-08-04

## 결론

투어리스트 자료는 두 저장소로 나눈다.

1. **GitHub Ri-weather**
   코드, 문서, URL·출처 메타데이터, 파싱 결과, 앱에 실제 배포되는 holeimg/
2. **비공개 Google Drive 원본 보관소**
   Git에서 제외된 홈페이지 수집 원본 이미지(공식·후보 출처 혼재)와 향후 렌더링 DOM

Google Drive 기본 위치:

~~~text
내 드라이브/Tourlist/Ri-weather-artifacts
~~~

Google Drive for desktop은 **파일 스트리밍**으로 사용한다. 원본은 클라우드에
보관하고 필요할 때만 내려받아 미러링보다 로컬 저장 공간을 적게 쓴다.

## 최초 백업 완료 기준값

2026-08-04 최초 백업과 전체 SHA-256 검증을 완료했다.

- 논리 원본: 4,929개 · 1,728,979,192바이트
- 중복 제거 CAS: 4,049개 · 1,445,687,325바이트
- dataset SHA-256: `55d8e446c6185d746f4a77631b26b13fdbf064acce7591a8e006338836106c94`
- snapshot: `18ecb67324e1125b4c89654fd6b9e19c4f12f2c10f8eb6fc836af0863f9792c4`
- vault UUID 원문은 로컬·Drive에만 두고 Git에는 SHA-256 지문만 고정

Google Drive 웹에서 위 snapshot head가 보이는 것과 Drive 원격 메타데이터의
CAS 4,049개·바이트 합계가 로컬 보관소와 같은 것을 확인했다.
`tools/artifact_vault_canonical.json`이 UUID 지문과 최초 snapshot/dataset을
고정하므로 같은 이름의 다른 보관소나 불완전한 사본에는 연결하지 않는다.
Google Drive 웹 공유 설정도 소유자 1명, 일반 액세스 **제한됨**으로 확인했다.
별도의 완전히 빈 작업 루트에서도 실제 Drive 보관소를 연결해 4,929개·
1,728,979,192바이트를 복원하고 같은 dataset SHA-256으로 전체 검증했다.

## 왜 별도 보관소가 필요한가

2026-08-04 전수 감사 결과:

- coursedata/homepages_auto/*/img/: 4,929개, 1,648.9MiB
- 위 파일은 .gitignore 대상이라 이전에는 이 PC에만 있었다.
- 그중 4,915개는 URL 장부가 있지만 재다운로드 시 동일 바이트를 보장할 수 없다.
- 감곡CC 이미지 14개는 원본 URL도 없어 이 PC 사본이 특히 중요하다.
- pages_v2/는 현재 0개지만 앞으로 같은 보관소 범위에 들어간다.
- 일본 scan/parsed 데이터와 앱용 holeimg/는 이미 Git 추적 중이다.

현재 공개 Git 저장소 자체도 이미 크므로 원본 1.65GB를 일반 Git에 더 넣지 않는다.

## 보관 범위

tools/artifact_sync.py는 아래 경로만 스캔한다.

~~~text
coursedata/homepages_auto/<구장>/img/**
coursedata/homepages_auto/<구장>/pages_v2/**
~~~

다음은 절대로 원본 보관소에 넣지 않는다.

- .secrets/, .env, Gemini·CSE·YouTube 키
- 실행 로그와 Gemini 예산 파일
- 앱용 holeimg/
- 이미 Git이 관리하는 meta*.json, parsed.json, 진행상태, 문서
- Ri_Stock 자료

현재 베타 단계 자료의 보관 분류는 private-beta-internal-research다. 사용자가
확정한 사업 순서는 **투자 유치 → 제휴 체결 → 스토어 등록 → 마케팅**이며,
현 자료는 삭제하지 않고 비공개 내부 연구 상태로 유지한다.

## 최초 원본 PC에서 한 번

Google Drive for desktop에 로그인하고 파일 스트리밍을 선택한 뒤:

~~~powershell
.\tourist.cmd tools\artifact_sync.py init --create
.\tourist.cmd tools\artifact_sync.py push
.\tourist.cmd tools\artifact_sync.py verify
~~~

push 성공은 Google Drive 가상 폴더에 안전하게 기록됐다는 뜻이다. 작업 표시줄의
Google Drive 아이콘이 **동기화 완료**가 될 때까지 PC를 끄지 않는다.

## 새 PC에서 한 번

1. GitHub 저장소를 clone한다.
2. Google Drive for desktop에 같은 계정으로 로그인한다.
3. 파일 스트리밍을 유지한다.
4. 저장소 루트에서 실행한다.

~~~powershell
powershell -ExecutionPolicy Bypass -File tools/setup_tourist_pc.ps1
~~~

이 명령은 Python 가상환경, 고정 의존성, npm ci, Google Drive 보관소 연결,
원본 복원, 환경 검사를 순서대로 수행한다.
Git 저장소 루트·main 브랜치·정확한 origin·커밋 신원·GitHub 쓰기 인증(dry-run)도
검사하며, 커밋 신원이 비어 있으면 이 저장소에 기존 Ri-weather 신원을 설정한다.

설치 후 모든 투어리스트 Python 명령은 전용 가상환경 래퍼로 실행한다.

~~~powershell
.\tourist.cmd tools\sync.py
.\tourist.cmd tools\collect_v2_selenium.py --help
~~~

`-SkipNode`는 Node가 이미 설치되고 `node_modules`도 준비된 경우 npm 재설치만
건너뛰는 옵션이다. Node 20+, playwright-core, Chrome 검사는 그대로 수행한다.

Google Drive 경로 자동 발견이 안 되면 한 줄로 실행한다.

~~~powershell
powershell -ExecutionPolicy Bypass -File tools/setup_tourist_pc.ps1 -Vault "G:\내 드라이브\Tourlist\Ri-weather-artifacts"
~~~

## 매일 작업

기존 명령은 그대로 사용한다.

~~~powershell
.\tourist.cmd tools\sync.py --start "한국 공식 홀맵 수집"
.\tourist.cmd tools\sync.py

# 작업

.\tourist.cmd tools\sync.py "한국 공식 홀맵 10개 수집"
~~~

sync.py가 Git과 Google Drive 원본을 함께 처리한다.

~~~powershell
.\tourist.cmd tools\sync.py --status
~~~

원본과 무관한 코드 또는 Ri_Stock 작업만 처리하고 Google Drive를 의도적으로
건너뛸 때만 다음 옵션을 쓴다.

~~~powershell
.\tourist.cmd tools\sync.py "Ri_Stock 문서 수정" --no-artifacts
~~~

홀맵 수집 작업에 --no-artifacts를 쓰면 안 된다.

## 안전장치

- 모든 원본은 SHA-256으로 식별하고 같은 내용은 한 번만 저장한다.
- 업로드 전·복원 전 실제 파일 전체를 다시 해시한다.
- 삭제는 다른 PC로 전파하지 않고 원격 사본을 복원한다.
- 두 PC가 같은 파일을 서로 다르게 바꾸면 어느 쪽도 자동 선택하지 않는다.
- 복원할 파일을 전부 staging하고 검증한 뒤에만 기존 경로로 교체한다.
- 교체 준비 중 로컬 파일이 바뀌면 중단하고 보존한다.
- 프로세스 lock으로 한 PC에서 동기화 두 개가 동시에 실행되지 않게 한다.
- Windows 예약명, ADS, 경로 탈출, junction·심볼릭 링크를 거부한다.
- 허용 폴더 안이라도 `.env`, 키·인증서 이름의 파일은 동기화를 중단한다.
- canonical 보관소를 로컬 디스크에 복사한 가짜 경로는 거부하고 실제 DriveFS
  파일 스트리밍 볼륨만 허용한다.
- Google Drive에 원자적 latest 포인터가 없으므로 단일 포인터를 쓰지 않는다.
  각 PC가 불변 head를 추가하고 다음 실행이 공통 조상 기준으로 병합한다.
- 서로 다른 구장/파일 변경은 합치고 같은 파일의 분기는 충돌로 보고한다.
- sync.py는 main 브랜치에서만 변경을 저장하며 commit/pull/push 실패를 모두
  비정상 종료로 전달한다.
- 임시 stash는 commit hash를 기록해 정확한 항목만 복원하고 사용자 stash는
  최신 항목이라는 이유로 선택하지 않는다.

충돌 보고서는 Git에서 제외된 .artifact-conflicts/에 남는다. 충돌이 났을 때
ours, theirs, 최신 시각으로 임의 선택하지 않는다.

## 개별 명령

~~~powershell
.\tourist.cmd tools\artifact_sync.py doctor
.\tourist.cmd tools\artifact_sync.py status
.\tourist.cmd tools\artifact_sync.py pull
.\tourist.cmd tools\artifact_sync.py push
.\tourist.cmd tools\artifact_sync.py verify
~~~

직접 경로 지정:

~~~powershell
.\tourist.cmd tools\artifact_sync.py --vault "G:\내 드라이브\Tourlist\Ri-weather-artifacts" status
~~~

환경 변수로 고정할 수도 있다.

~~~powershell
[Environment]::SetEnvironmentVariable(
  "TOURLIST_ARTIFACT_VAULT",
  "G:\내 드라이브\Tourlist\Ri-weather-artifacts",
  "User"
)
~~~

## 비밀키

새 PC용 안내서는 .secrets/README.example.txt다. 실제 키는 필요한 PC에서만
직접 만들며 Git과 Google Drive 보관소 어느 쪽에도 저장하지 않는다.

## 확인 기준

새 PC 인수 완료라고 말하려면 모두 통과해야 한다.

~~~powershell
.\tourist.cmd -B -m unittest tools.test_artifact_sync tools.test_sync -v
.\tourist.cmd tools\artifact_sync.py verify
.\tourist.cmd tools\check_tourist_environment.py
npm ci
~~~

그리고 새 PC에서 원본 4,929개와 dataset SHA-256이 원본 PC와 같아야 한다.

Google Drive 웹의 `Tourlist/Ri-weather-artifacts` 공유 설정도 **제한됨**인지
확인한다. 링크가 있는 모든 사용자 공개로 바꾸지 않는다.

현재 push/status는 안전을 위해 로컬 원본 전체를 SHA-256으로 다시 읽으므로
현재 1.65GB 기준 수십 초가 걸릴 수 있다. 장기 누적량이 크게 늘면 무결성 관문을
유지한 채 증분 journal/checkpoint를 도입한다.
