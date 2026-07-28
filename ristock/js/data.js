/* =====================================================================
 * data.js — 데이터 로딩·캐시·신선도 판정
 *
 * 앱이 읽는 파일은 전부 `ristock/data/` 밑의 JSON 이고, 엔진이 매일 새로 씁니다.
 * 화면(app.js)은 여기서 준비된 것만 그립니다.
 *
 *   1) manifest.json 을 먼저 읽어 **생성시각**을 얻고
 *   2) 그 값을 `?v=` 로 붙여 나머지 JSON 을 읽습니다 (캐시 무효화)
 *   3) 실패는 **정상 상태**로 다룹니다 — 빈 화면 대신 안내를 띄울 수 있게
 *      `오류`/`경고` 를 채워서 돌려줍니다
 *
 * 전역 `RiData` 를 노출합니다. 외부 라이브러리 의존 0.
 * ===================================================================== */

(function (전역) {
  'use strict';

  var 데이터경로 = './data/';

  var 저장키 = {
    관심: 'ristock.관심종목.v1',
    내전략: 'ristock.내전략.v1',
    내전략상태: 'ristock.내전략상태.v1',  // 지금 켜 둔 조건 — 앱을 닫았다 열어도 그대로여야 합니다
    마지막: 'ristock.마지막수신.v1',  // 전부 실패했을 때 "언제 것까지 받았었는지" 알려주기 위한 흔적
    설치안내: 'ristock.설치안내.v1'   // 홈 화면 추가 안내를 몇 번 봤는지 / 닫았는지
  };

  /* -------------------------------------------------------------
   * 0. 상태 — 화면은 이 객체만 보고 그립니다
   * ----------------------------------------------------------- */
  var 상태 = {
    준비: false,          // 최소한 종목 데이터 한쪽이라도 있는가
    로딩중: false,
    오류: null,           // 치명적: manifest 를 못 읽음 (= 아직 데이터가 없음)
    경고: [],             // 부분 실패 (예: 미국 종목만 실패)
    manifest: null,
    market: null,
    전략정의: [],
    섹터매핑: {},
    필터설명: {},
    시장데이터: { 한국: null, 미국: null },   // stocks_KR.json / stocks_US.json 통째로
    changes: null,
    티커색인: { 한국: null, 미국: null }
  };

  /* -------------------------------------------------------------
   * 1. fetch 도우미 — 항상 네트워크 우선
   *    (서비스워커가 실패 시 캐시로 대신 응답합니다. 여기서는 그냥 기다립니다.)
   * ----------------------------------------------------------- */
  function 읽기(파일명, 버전) {
    var url = 데이터경로 + 파일명 + (버전 ? ('?v=' + encodeURIComponent(버전)) : '');
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) {
        var e = new Error(파일명 + ' 응답 ' + res.status);
        e.상태코드 = res.status;
        throw e;
      }
      return res.json();
    });
  }

  /** 실패해도 앱을 멈추지 않는 읽기 — 실패하면 null 을 돌려주고 사유만 남깁니다. */
  function 조용히읽기(파일명, 버전, 사유모음, 필수아님) {
    return 읽기(파일명, 버전).catch(function (err) {
      if (!필수아님) 사유모음.push(파일명 + ' 을(를) 읽지 못했습니다 (' + err.message + ')');
      return null;
    });
  }

  /* -------------------------------------------------------------
   * 2. 초기화
   * ----------------------------------------------------------- */
  function 초기화() {
    if (상태.로딩중) return 상태._대기;
    상태.로딩중 = true;
    상태.오류 = null;
    상태.경고 = [];

    상태._대기 = 읽기('manifest.json')
      .then(function (manifest) {
        상태.manifest = manifest;
        var 버전 = (manifest && manifest.생성시각) || String(Date.now());
        var 경고 = 상태.경고;

        var 한국파일 = ((manifest.시장 || {}).한국 || {}).파일 || 'stocks_KR.json';
        var 미국파일 = ((manifest.시장 || {}).미국 || {}).파일 || 'stocks_US.json';

        return Promise.all([
          조용히읽기('market.json', 버전, 경고),
          조용히읽기('strategies.json', 버전, 경고),
          조용히읽기(한국파일, 버전, 경고),
          조용히읽기(미국파일, 버전, 경고),
          // 전일 대비 변화 파일은 **manifest 가 있다고 말할 때만** 읽습니다.
          // 없는 파일을 매번 찔러 보면 브라우저 콘솔에 404 가 쌓이고,
          // 진짜 사고가 났을 때 그 404 에 묻혀 안 보입니다.
          변화파일명(manifest) ? 조용히읽기(변화파일명(manifest), 버전, 경고, true) : Promise.resolve(null)
        ]);
      })
      .then(function (묶음) {
        상태.market = 묶음[0];
        var 전략 = 묶음[1] || {};
        상태.전략정의 = 전략.전략 || [];
        상태.섹터매핑 = 전략.섹터매핑 || {};
        상태.필터설명 = 전략.필터설명 || {};
        상태.시장데이터.한국 = 묶음[2];
        상태.시장데이터.미국 = 묶음[3];
        상태.changes = 묶음[4];
        상태.티커색인 = { 한국: null, 미국: null };

        if (!상태.시장데이터.한국 && !상태.시장데이터.미국) {
          상태.오류 = '종목 데이터를 한 곳도 읽지 못했습니다';
        }
        상태.준비 = !!(상태.시장데이터.한국 || 상태.시장데이터.미국);
        기억하기();
        상태.로딩중 = false;
        return 상태;
      })
      .catch(function (err) {
        // manifest 자체를 못 읽음 = 아직 엔진이 한 번도 돌지 않았거나 네트워크가 끊김
        상태.오류 = (err && err.상태코드 === 404)
          ? '아직 데이터가 없습니다'
          : '데이터를 불러오지 못했습니다';
        상태.오류상세 = (err && err.message) || String(err);
        상태.준비 = false;
        상태.로딩중 = false;
        return 상태;
      });

    return 상태._대기;
  }

  /** 전일 대비 변화 파일 이름 — manifest 가 알려 줄 때만 읽습니다.
   *
   *  엔진이 `changes.json` 을 만들기 시작하면 manifest 에 아래 중 **아무거나** 하나만
   *  넣어 주면 화면이 바로 살아납니다 (셋 다 지원합니다).
   *      "변화파일": "changes.json"
   *      "changes":  "changes.json"   또는 true
   *      "이전기준일": "20260715"      ← 이 값이 있으면 changes.json 을 읽습니다
   */
  function 변화파일명(manifest) {
    if (!manifest) return null;
    if (typeof manifest.변화파일 === 'string' && manifest.변화파일) return manifest.변화파일;
    if (typeof manifest.changes === 'string' && manifest.changes) return manifest.changes;
    if (manifest.changes === true) return 'changes.json';
    if (manifest.이전기준일) return 'changes.json';
    return null;
  }

  /** 마지막으로 성공한 기준일을 남겨 둡니다 (다음에 전부 실패해도 안내에 쓸 수 있게). */
  function 기억하기() {
    if (!상태.manifest) return;
    try {
      localStorage.setItem(저장키.마지막, JSON.stringify({
        기준일: 상태.manifest.기준일 || '',
        생성시각: 상태.manifest.생성시각 || '',
        받은시각: new Date().toISOString()
      }));
    } catch (e) { /* 사파리 프라이빗 모드 등 — 무시 */ }
  }

  function 마지막수신() {
    try {
      var v = localStorage.getItem(저장키.마지막);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  /* -------------------------------------------------------------
   * 3. 신선도 — 기준일(YYYYMMDD)이 오늘로부터 며칠 지났는가
   *    3일 이상 → 주의, 7일 이상 → 경고
   * ----------------------------------------------------------- */
  function 날짜파싱(기준일) {
    var s = String(기준일 || '');
    if (!/^\d{8}$/.test(s)) return null;
    var d = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
    return isNaN(d.getTime()) ? null : d;
  }

  function 신선도(기준일) {
    var 기준 = 기준일 !== undefined ? 기준일 : (상태.manifest && 상태.manifest.기준일);
    var d = 날짜파싱(기준);
    if (!d) return { 등급: '알수없음', 경과일: null, 문구: '데이터 기준일을 알 수 없습니다' };

    var 오늘 = new Date();
    오늘.setHours(0, 0, 0, 0);
    var 경과 = Math.round((오늘 - d) / 86400000);

    var 등급 = '정상';
    if (경과 >= 7) 등급 = '경고';
    else if (경과 >= 3) 등급 = '주의';

    var 문구;
    if (경과 <= 0) 문구 = '오늘 데이터입니다';
    else if (경과 === 1) 문구 = '어제 데이터입니다';
    else 문구 = 경과 + '일 지난 데이터입니다';

    return { 등급: 등급, 경과일: 경과, 문구: 문구, 표시일: 날짜표시(기준) };
  }

  function 날짜표시(기준일) {
    var s = String(기준일 || '');
    if (!/^\d{8}$/.test(s)) return s || '-';
    return s.slice(0, 4) + '.' + s.slice(4, 6) + '.' + s.slice(6, 8);
  }

  /** 시장 하나의 신선도 — `manifest.시장.<시장>.기준일` 을 봅니다.
   *
   *  한국만 네이버 차단으로 며칠째 멈추고 미국은 매일 갱신되는 상황이 실제로 생깁니다.
   *  이때 최상단 `기준일` 은 새것이라 전체 배너는 뜨지 않고, 한국 화면만 조용히 낡습니다.
   *  그래서 시장별로 따로 판정합니다.
   *
   *  ⚠️ 구 데이터 호환: manifest 에 시장별 기준일이 **없으면** 예전처럼 최상단 값으로 답합니다
   *     (지금 배포된 manifest 에는 아직 없습니다).
   *
   *  덧붙는 값
   *    `자체기준일` — 이 시장이 자기 기준일을 들고 있었는가 (false 면 최상단 값을 쓴 것)
   *    `뒤처짐`     — **가장 최근에 갱신된 시장**보다 더 오래된가. 화면 배너는 이 값만 봅니다.
   */

  /** 시장별 기준일 중 **가장 새것**. 없으면 ''.
   *
   *  ⚠️ 여기서 최상단 `기준일` 을 비교 기준으로 쓰면 안 됩니다.
   *     엔진(`emit.대표기준일`)은 최상단 값을 **시장별 기준일 중 가장 오래된 것**으로 씁니다.
   *     그래서 "최상단보다 오래됐는가"로 물으면 정의상 **참이 될 수 없고**, 정작 멈춘 시장에
   *     배너가 영영 안 붙습니다(한국만 6일 멈춘 실데이터로 재현 확인).
   *     비교 상대는 '제일 부지런히 갱신된 시장'이어야 합니다.
   */
  function 최신시장기준일(m) {
    var 시장표 = (m && m.시장) || {};
    var 최신 = '';
    for (var k in 시장표) {
      if (!Object.prototype.hasOwnProperty.call(시장표, k)) continue;
      var d = 시장표[k] && 시장표[k].기준일;
      if (/^\d{8}$/.test(String(d || '')) && d > 최신) 최신 = d;
    }
    return 최신;
  }

  function 시장신선도(시장) {
    var m = 상태.manifest;
    var 칸 = (m && m.시장 && m.시장[시장]) || null;
    var 시장기준 = 칸 && 칸.기준일;
    var 자체 = /^\d{8}$/.test(String(시장기준 || ''));
    var f = 신선도(자체 ? 시장기준 : (m && m.기준일));

    f.시장 = 시장;
    f.자체기준일 = 자체;
    f.뒤처짐 = false;
    if (자체 && f.경과일 !== null && f.경과일 >= 1) {
      // 가장 최근에 갱신된 시장을 기준으로 견줍니다 (없으면 최상단 값으로 물러섭니다)
      var 최신 = 최신시장기준일(m);
      var 기준 = 신선도(최신 || (m && m.기준일));
      // 기준을 알 수 없으면(날짜가 통째로 이상하면) 낡은 쪽을 알리는 편이 안전합니다.
      f.뒤처짐 = (기준.경과일 === null) ? true : (f.경과일 > 기준.경과일);
    }
    return f;
  }

  /* -------------------------------------------------------------
   * 4. 조회 도우미
   * ----------------------------------------------------------- */
  function 종목배열(시장) {
    var d = 상태.시장데이터[시장];
    if (!d) return [];
    return Array.isArray(d.종목) ? d.종목 : [];
  }

  function 있는시장() {
    return ['한국', '미국'].filter(function (m) { return !!상태.시장데이터[m]; });
  }

  function 색인(시장) {
    if (!상태.티커색인[시장]) {
      var m = {};
      종목배열(시장).forEach(function (s) { m[String(s.티커)] = s; });
      상태.티커색인[시장] = m;
    }
    return 상태.티커색인[시장];
  }

  function 종목찾기(시장, 티커) {
    return 색인(시장)[String(티커)] || null;
  }

  /**
   * 종목 주가 차트 (설계서 2.2 `차트`) — {구간: {날짜:[], 값:[]}} 형태로 돌려줍니다.
   *
   * 파일에는 날짜축이 **시장마다 한 번만** 담겨 있고(용량), 종목별로는 값 배열만
   * 있습니다. 여기서 둘을 짝지어 화면이 쓰기 좋은 모양으로 만듭니다.
   * 앞뒤로 값이 없는 구간(상장 전·거래정지)은 잘라 냅니다 — 빈 구간을 그리면
   * 선이 허공에서 시작하는 것처럼 보입니다.
   */
  function 차트(시장, 티커) {
    var d = 상태.시장데이터[시장];
    var 원본 = d && d.차트;
    if (!원본) return null;
    var 결과 = {}, 있음 = false;
    ['일', '주', '월', '연'].forEach(function (구간) {
      var 블록 = 원본[구간];
      var 값 = 블록 && 블록.종목 && 블록.종목[String(티커)];
      if (!값 || !블록.날짜) return;
      var 처음 = -1, 끝 = -1;
      for (var i = 0; i < 값.length; i++) {
        if (값[i] === null || 값[i] === undefined) continue;
        if (처음 < 0) 처음 = i;
        끝 = i;
      }
      if (처음 < 0 || 끝 <= 처음) return;          // 점이 하나뿐이면 선이 안 됩니다
      결과[구간] = { 날짜: 블록.날짜.slice(처음, 끝 + 1), 값: 값.slice(처음, 끝 + 1) };
      있음 = true;
    });
    return 있음 ? 결과 : null;
  }

  function 섹터목록(시장) {
    var 본것 = {}, 결과 = [];
    종목배열(시장).forEach(function (s) {
      var k = s.섹터 || '';
      if (k && !본것[k]) { 본것[k] = 1; 결과.push(k); }
    });
    return 결과.sort(function (a, b) { return a.localeCompare(b, 'ko'); });
  }

  function 가중치(시장) {
    var d = 상태.시장데이터[시장];
    return (d && d.가중치) || null;
  }

  function 전략찾기(id) {
    for (var i = 0; i < 상태.전략정의.length; i++) {
      if (상태.전략정의[i].id === id) return 상태.전략정의[i];
    }
    return null;
  }

  /* -------------------------------------------------------------
   * 5. localStorage — 관심종목 / 내 전략
   * ----------------------------------------------------------- */
  function 불러오기(키, 기본값) {
    try {
      var v = localStorage.getItem(키);
      return v ? JSON.parse(v) : 기본값;
    } catch (e) { return 기본값; }
  }

  function 저장하기(키, 값) {
    try { localStorage.setItem(키, JSON.stringify(값)); return true; }
    catch (e) { return false; }
  }

  /* -------------------------------------------------------------
   * 5-1. 홈 화면 추가(설치) 안내
   *
   * 아이폰 사파리에는 설치 버튼도, 설치 프롬프트 API 도 없습니다.
   * "공유 → 홈 화면에 추가" 를 앱이 직접 알려 주는 수밖에 없습니다.
   *
   * 다만 처음 들어오자마자 안내부터 들이밀면 성가십니다.
   * **두 번째 방문부터** 보여 주고, 한 번 닫으면 다시 띄우지 않습니다.
   * ----------------------------------------------------------- */
  function 설치안내상태() {
    var v = 불러오기(저장키.설치안내, null);
    if (!v || typeof v !== 'object') v = {};
    return {
      방문: typeof v.방문 === 'number' && v.방문 >= 0 ? v.방문 : 0,
      닫음: v.닫음 === true
    };
  }

  /** 앱이 열릴 때 한 번 부릅니다. 방문 횟수를 1 늘리고 새 상태를 돌려줍니다. */
  function 방문기록() {
    var s = 설치안내상태();
    if (s.방문 < 99) {            // 무한정 키울 이유가 없습니다
      s.방문 += 1;
      저장하기(저장키.설치안내, s);
    }
    return s;
  }

  function 설치안내닫기() {
    var s = 설치안내상태();
    s.닫음 = true;
    저장하기(저장키.설치안내, s);
    return s;
  }

  /** 이미 홈 화면 앱으로 실행 중인가? (iOS 는 navigator.standalone, 그 외는 display-mode) */
  function 설치됨() {
    try {
      if (navigator.standalone === true) return true;
      if (window.matchMedia &&
          window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { /* 아주 옛 브라우저 */ }
    return false;
  }

  /** 아이폰·아이패드인가? (아이패드는 최신 iPadOS 에서 Mac 으로 위장합니다) */
  function 아이폰류() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  }

  /** 안내를 지금 보여 줄까? — 세 조건이 모두 맞을 때만 */
  function 설치안내보일까() {
    if (설치됨()) return false;              // 이미 앱으로 쓰고 계십니다
    if (!아이폰류()) return false;           // 지금은 아이폰만 안내합니다
    var s = 설치안내상태();
    if (s.닫음) return false;                // 사장님이 닫으셨습니다
    return s.방문 >= 2;                      // 첫 방문은 데이터 구경이 먼저입니다
  }

  function 관심키(시장, 티커) { return 시장 + ':' + 티커; }

  function 관심목록() { return 불러오기(저장키.관심, []); }

  function 관심여부(시장, 티커) {
    return 관심목록().indexOf(관심키(시장, 티커)) !== -1;
  }

  function 관심토글(시장, 티커) {
    var 목록 = 관심목록();
    var k = 관심키(시장, 티커);
    var i = 목록.indexOf(k);
    if (i === -1) 목록.push(k); else 목록.splice(i, 1);
    저장하기(저장키.관심, 목록);
    return i === -1;   // true = 방금 추가됨
  }

  function 내전략목록() { return 불러오기(저장키.내전략, []); }

  function 내전략저장(이름, 필터, rank_by) {
    var 목록 = 내전략목록();
    var 항목 = {
      id: 'my_' + Date.now(),
      name: String(이름 || '내 전략').slice(0, 30),
      rank_by: rank_by || '총점',
      filters: 필터 || {},
      저장시각: new Date().toISOString()
    };
    목록.unshift(항목);
    저장하기(저장키.내전략, 목록.slice(0, 20));
    return 항목;
  }

  function 내전략삭제(id) {
    var 목록 = 내전략목록().filter(function (x) { return x.id !== id; });
    저장하기(저장키.내전략, 목록);
    return 목록;
  }

  /* ── 내 전략의 "지금 켜 둔 조건" ────────────────────────────────
   * 저장 목록(내전략목록)과는 다릅니다. 사장님이 조건을 여덟 개 만지작거려 놓고
   * 앱을 닫았다 열면 그대로 남아 있어야 합니다 (설계서 5장 "localStorage 저장").
   * 저장을 누르지 않은 상태도 기억합니다.
   * ------------------------------------------------------------- */
  var 기본내전략 = { 필터: { 악재제외: true }, rank_by: '총점', 시장: '한국' };

  function 내전략상태() {
    var v = 불러오기(저장키.내전략상태, null);
    if (!v || typeof v !== 'object') {
      return { 필터: { 악재제외: true }, rank_by: 기본내전략.rank_by, 시장: 기본내전략.시장 };
    }
    // 저장된 값이 깨져 있어도 화면이 죽지 않도록 항목별로 확인해 담습니다.
    var 필터 = {};
    if (v.필터 && typeof v.필터 === 'object') {
      Object.keys(v.필터).forEach(function (k) { if (v.필터[k]) 필터[k] = true; });
    }
    return {
      필터: 필터,
      rank_by: (typeof v.rank_by === 'string' && v.rank_by) ? v.rank_by : 기본내전략.rank_by,
      시장: (v.시장 === '미국') ? '미국' : '한국'
    };
  }

  function 내전략상태저장(상태값) {
    var s = 상태값 || {};
    return 저장하기(저장키.내전략상태, {
      필터: s.필터 || {},
      rank_by: s.rank_by || 기본내전략.rank_by,
      시장: s.시장 || 기본내전략.시장
    });
  }

  /* ----------------------------------------------------------- */
  전역.RiData = {
    상태: 상태,
    초기화: 초기화,
    신선도: 신선도,
    시장신선도: 시장신선도,
    날짜표시: 날짜표시,
    마지막수신: 마지막수신,
    종목배열: 종목배열,
    있는시장: 있는시장,
    종목찾기: 종목찾기,
    차트: 차트,
    섹터목록: 섹터목록,
    가중치: 가중치,
    전략찾기: 전략찾기,
    관심목록: 관심목록,
    관심여부: 관심여부,
    관심토글: 관심토글,
    관심키: 관심키,
    내전략목록: 내전략목록,
    내전략저장: 내전략저장,
    내전략삭제: 내전략삭제,
    내전략상태: 내전략상태,
    내전략상태저장: 내전략상태저장,
    설치됨: 설치됨,
    아이폰류: 아이폰류,
    설치안내상태: 설치안내상태,
    설치안내보일까: 설치안내보일까,
    설치안내닫기: 설치안내닫기,
    방문기록: 방문기록,
    버전: '1.0.0'
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
