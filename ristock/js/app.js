/* =====================================================================
 * app.js — 화면 라우팅과 렌더링
 *
 * 규칙 세 가지만 지키면 됩니다.
 *   1) 전략 계산은 전부 `RiStrategy` 에 맡깁니다. 필터·정렬을 여기서 다시 구현하지 않습니다.
 *   2) 데이터 로딩 실패는 **정상 상태**입니다. 어떤 경우에도 빈 화면을 두지 않습니다.
 *   3) 화면 하단의 투자권유 아님 고지는 index.html 의 고정 푸터에 항상 붙어 있습니다.
 *
 * 의존: js/strategy.js, js/data.js, js/export.js (전부 자체 파일 — 외부 CDN 없음)
 * ===================================================================== */

(function () {
  'use strict';

  var 탭목록 = ['brief', 'strategy', 'stocks', 'my'];
  var 점수순서 = ['모멘텀', '차트', 'ROE', '매출성장', '순익성장', '시총', '재무',
    '52주', '저변동', '밸류', '배당', '뉴스', '수급'];
  var 필터순서 = ['악재제외', '흑자만', '눌림만', '전고점돌파만', '미네르비니만',
    '거래량150이상', '순익성장25이상', '신고가근접만'];
  var 순위기준목록 = [
    { v: '총점', t: '총점 높은 순' },
    { v: '차트', t: '차트 점수 순' },
    { v: '모멘텀', t: '모멘텀 점수 순' },
    { v: '전고점', t: '52주 고점 근접 순' },
    { v: '마법공식', t: '마법공식(저PER+고ROE) 순' }
  ];

  /* -------------------------------------------------------------
   * 화면 상태
   * ----------------------------------------------------------- */
  var 화면 = {
    탭: 'brief',
    전략id: null,
    전략시장: '한국',
    펼친섹터: {},              // 브리핑 섹터 대표뉴스 펼침
    종목: { 시장: '한국', 검색: '', 섹터: '', 정렬: '시총순위', 관심만: false, 표시수: 50 },
    // 내 전략에서 켜 둔 조건은 앱을 닫았다 열어도 남아 있어야 합니다 (시작() 에서 채웁니다)
    내전략: { 필터: { 악재제외: true }, rank_by: '총점', 시장: '한국', 이름: '' },
    전략캐시: {},
    // 종목 상세 시트에서 보고 있는 차트 구간 — 다음에 열 때도 그대로 둡니다
    차트구간: '일',
    시트종목: null              // {시장, 티커} — 구간만 바꿔 다시 그릴 때 씁니다
  };

  var 요소 = {};
  var 토스트타이머 = null;

  /* -------------------------------------------------------------
   * 0. 작은 도우미
   * ----------------------------------------------------------- */
  function esc(값) {
    if (값 === null || 값 === undefined) return '';
    return String(값)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function 수(값, 자리) {
    if (값 === null || 값 === undefined || 값 === '' || isNaN(Number(값))) return '-';
    var n = Number(값);
    return (자리 === undefined) ? String(n) : n.toFixed(자리);
  }

  /** 한국 관행: 플러스는 빨강, 마이너스는 파랑 */
  function 부호색(값) {
    var n = Number(값);
    if (isNaN(n) || n === 0) return '';
    return n > 0 ? 'up' : 'down';
  }

  function 부호수(값, 자리, 단위) {
    if (값 === null || 값 === undefined || 값 === '' || isNaN(Number(값))) return '-';
    var n = Number(값);
    return (n > 0 ? '+' : '') + n.toFixed(자리 === undefined ? 1 : 자리) + (단위 || '');
  }

  function 토스트(문구) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = 문구;
    t.hidden = false;
    clearTimeout(토스트타이머);
    토스트타이머 = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function 표시이름(종목) {
    if (!종목) return '';
    return (종목.한글명 && 종목.한글명 !== 종목.기업명) ? 종목.한글명 : 종목.기업명;
  }

  /* -------------------------------------------------------------
   * 1. 공통 조각
   * ----------------------------------------------------------- */

  /** 데이터 신선도 배너 — 3일 이상 주의, 7일 이상 경고 (모든 화면 상단) */
  function 신선도배너() {
    var s = RiData.상태;
    if (!s.manifest) return '';
    var f = RiData.신선도();
    if (f.등급 === '정상') return '';

    if (f.등급 === '알수없음') {
      return 배너('info', 'ℹ️', '데이터 기준일을 알 수 없습니다',
        '엔진이 만든 manifest.json 에 기준일이 없습니다.');
    }
    if (f.등급 === '경고') {
      return 배너('danger', '🚨', f.경과일 + '일 전 데이터입니다',
        '기준일 ' + esc(f.표시일) + '. 자동 수집이 멈췄을 수 있습니다. ' +
        '지금 화면의 종목과 점수는 오래된 값이니 그대로 판단하지 마세요.');
    }
    return 배너('warn', '⚠️', f.문구,
      '기준일 ' + esc(f.표시일) + '. 최신 시세가 반영되지 않았을 수 있습니다.');
  }

  /** 시장 하나만 낡았을 때의 배너 — 그 시장을 보고 있는 화면에만 붙습니다.
   *
   *  한국 수집이 네이버 차단으로 며칠 멈춰도 미국은 매일 갱신됩니다. 그러면 최상단 기준일은
   *  새것이라 위의 전체 배너는 뜨지 않고, 한국 종목만 조용히 옛날 값을 보여 줍니다.
   *  (manifest 에 시장별 기준일이 없는 옛 데이터에서는 아무것도 뜨지 않습니다.) */
  function 시장신선도배너(시장) {
    var s = RiData.상태;
    if (!s.manifest || !시장) return '';
    var f = RiData.시장신선도(시장);
    if (!f.뒤처짐 || f.경과일 === null || f.경과일 < 1) return '';

    return 배너(f.등급 === '경고' ? 'danger' : 'warn', '⏳',
      시장 + ' 데이터는 ' + f.경과일 + '일 전 기준입니다',
      '기준일 ' + esc(f.표시일) + '. 다른 시장은 갱신됐지만 ' + esc(시장) +
      ' 수집만 멈춰 있습니다. 이 화면의 ' + esc(시장) + ' 종목·점수는 그날 값입니다.');
  }

  function 배너(종류, 아이콘, 제목, 본문) {
    return '<div class="banner banner-' + 종류 + '">' +
      '<span class="bn-ico">' + 아이콘 + '</span>' +
      '<span><b>' + esc(제목) + '</b>' + (본문 || '') + '</span></div>';
  }

  /**
   * 이 브리핑이 **몇 시에 만들어졌는지** 한 줄 + 다시 받기 버튼.
   *
   * 기준일만 있으면 '오늘 데이터'인 것은 알아도 아침 회차인지 저녁 회차인지 모릅니다.
   * 하루 두 번(16:40 · 07:10) 도는 앱이라 그 차이가 큽니다 —
   * 장 마감 전 회차와 마감 후 회차는 수급·종가가 통째로 다릅니다.
   * 시장마다 수집 시각이 다를 수 있어(한쪽만 실패한 날) 시장별로도 적어 둡니다.
   */
  function 브리핑시각줄() {
    var s = RiData.상태;
    var m = s.manifest || {};
    var 언제 = m.생성시각 || '';
    var 시장 = m.시장 || {};
    var 조각 = ['한국', '미국'].filter(function (k) { return 시장[k] && 시장[k].수집시각; })
      .map(function (k) {
        var v = 시장[k];
        var 곳 = v.수집주체 === 'pc' ? '국내' : (v.수집주체 === 'github-actions' ? '해외서버' : '');
        return esc(k) + ' ' + esc(짧은시각(v.수집시각)) + (곳 ? '(' + 곳 + ')' : '');
      });

    return '<div class="brief-when">' +
      '<span class="bw-main">브리핑 ' + esc(언제 ? 짧은시각(언제) : '시각 알 수 없음') + ' 기준</span>' +
      (조각.length ? '<span class="bw-sub">수집 ' + 조각.join(' · ') + '</span>' : '') +
      '<button type="button" class="bw-btn" data-act="브리핑시작">브리핑 다시 받기</button>' +
      '</div>';
  }

  /** '2026-07-28 22:29' → '07.28 22:29' (오늘 것이면 '22:29') */
  function 짧은시각(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ''));
    if (!m) return String(s || '');
    var 오늘 = new Date();
    var 같은날 = Number(m[1]) === 오늘.getFullYear() &&
      Number(m[2]) === 오늘.getMonth() + 1 && Number(m[3]) === 오늘.getDate();
    return 같은날 ? (m[4] + ':' + m[5]) : (m[2] + '.' + m[3] + ' ' + m[4] + ':' + m[5]);
  }

  /** market.json 의 지수 목록 (없으면 빈 배열) */
  function 지수목록() {
    var mk = RiData.상태.market;
    return (mk && mk.지수 && mk.지수.목록) || [];
  }

  /** 급락으로 볼 등락률 — 엔진(indices.py)이 파일에 함께 담아 준 값을 그대로 씁니다.
   *  양쪽에 숫자를 따로 적으면 한쪽만 고쳤을 때 화면과 요약 문구가 갈라집니다. */
  function 급락기준() {
    var mk = RiData.상태.market;
    var v = mk && mk.지수 && mk.지수.급락기준;
    return typeof v === 'number' ? v : -3;
  }

  /**
   * 지수가 크게 빠진 날 전략 화면에 띄우는 경고.
   *
   * 전략은 '오늘 조건을 통과한 종목'을 뽑을 뿐, 시장 전체가 무너지는 날인지는
   * 따로 알려 주지 않습니다. 2026-07-28 처럼 코스피가 -10.8% 인 날에도
   * 화면에는 평소와 똑같이 매수 후보만 5종목씩 떴습니다.
   */
  function 급락경고배너() {
    var 기준 = 급락기준();
    var 급락 = 지수목록().filter(function (x) { return Number(x.등락률) <= 기준; });
    if (!급락.length) return '';
    var 문구 = 급락.map(function (x) {
      return esc(x.이름) + ' ' + Number(x.등락률).toFixed(1) + '%';
    }).join(' · ');
    return 배너('warn', '📉', '오늘 지수가 크게 빠졌습니다 — ' + 문구,
      '<span>전략은 개별 종목 조건만 봅니다. 시장 전체가 밀리는 날에는 ' +
      '조건을 통과한 종목도 함께 밀릴 수 있으니, 매수 신호로 바로 읽지 마세요.</span>');
  }

  /**
   * 오늘의 지수 카드 — 코스피·코스닥·S&P500·나스닥.
   *
   * 시장 분위기를 뉴스 건수만으로 정하던 때에는, 코스피가 -10.8% 빠진 날에도
   * '중립·혼조' 가 떴습니다. 뉴스는 하루 종일 고르게 쌓이지만 지수는 그날 하루가
   * 그대로 찍히기 때문입니다. 그래서 브리핑 맨 위에 지수를 둡니다.
   *
   * 값 옆의 날짜는 **그 값이 어느 날 종가인지**입니다. 07:00 회차에는 한국 장이
   * 열리기 전이라 코스피가 어제 종가로 담깁니다 — 날짜를 숨기면 어제 값을
   * 오늘 것으로 읽게 됩니다.
   *
   * 색은 한국 증시 관행을 따릅니다 (상승 빨강 / 하락 파랑).
   */
  function 지수카드() {
    var 목록 = 지수목록();
    if (!목록.length) return '';
    return '<div class="card"><div class="card-title">오늘의 지수</div>' +
      '<div class="idx-grid">' + 목록.map(function (x) {
        var 등락 = Number(x.등락률);
        var 방향 = 등락 > 0 ? 'up' : (등락 < 0 ? 'down' : 'flat');
        var 부호 = 등락 > 0 ? '+' : '';
        return '<span class="idx idx-' + 방향 + '">' +
          '<span class="idx-name">' + esc(x.이름) + '</span>' +
          '<span class="idx-close">' + esc(Number(x.종가).toLocaleString('ko-KR')) + '</span>' +
          '<span class="idx-rate">' + 부호 + 등락.toFixed(2) + '%</span>' +
          '<span class="idx-date">' + esc(RiData.날짜표시(x.날짜)) + ' 종가</span>' +
          '</span>';
      }).join('') + '</div></div>';
  }

  /** 데이터가 아예 없을 때 — 절대 빈 화면을 두지 않습니다 */
  function 데이터없음화면(제목) {
    var s = RiData.상태;
    var 마지막 = RiData.마지막수신();

    // ⚠️ 아직 받아오는 중이라면 "데이터가 없다"고 단정하면 안 됩니다.
    //    폰에서 첫 화면이 뜨자마자 다른 탭을 누르면 로딩이 끝나기 전에 이 화면이 그려져,
    //    멀쩡한데도 "엔진이 아직 한 번도 돌지 않았다"는 무서운 안내가 몇 초 동안 보였습니다.
    if (s.로딩중) {
      return '<div class="page-title">' + esc(제목) + '</div>' +
        '<div class="loading"><div class="spinner"></div>데이터를 불러오는 중입니다…</div>' +
        하단고지();
    }
    var 힌트 = '';
    if (마지막 && 마지막.기준일) {
      힌트 = '<p style="margin-top:10px">마지막으로 받았던 데이터는 <b>' +
        esc(RiData.날짜표시(마지막.기준일)) + '</b> 기준입니다.</p>';
    }
    return '<div class="page-title">' + esc(제목) + '</div>' +
      '<div class="empty">' +
      '<span class="em-ico">📭</span>' +
      '<b>' + esc(s.오류 || '아직 데이터가 없습니다') + '</b>' +
      '<p>엔진이 아직 한 번도 돌지 않았거나, 지금 인터넷에 연결되어 있지 않습니다.<br>' +
      '매일 자동 수집이 끝나면 이 화면이 저절로 채워집니다.</p>' +
      힌트 +
      '<button type="button" class="btn" data-act="다시읽기">다시 시도</button>' +
      '</div>' + 하단고지();
  }

  /**
   * 홈 화면에 추가하라는 안내 (아이폰 전용).
   *
   * 아이폰 사파리에는 설치 버튼이 없습니다. 크롬처럼 `beforeinstallprompt` 로
   * "설치" 를 띄울 수도 없습니다. 사장님이 **공유 → 홈 화면에 추가** 를 직접 누르셔야 하는데,
   * 그 경로를 모르면 앱을 영영 주소창으로만 쓰게 됩니다.
   *
   * 보여 줄지 말지의 판단은 전부 RiData.설치안내보일까() 안에 있습니다
   * (이미 앱으로 실행 중 / 닫은 적 있음 / 첫 방문 — 셋 중 하나면 안 띄웁니다).
   */
  function 설치안내카드() {
    if (!RiData.설치안내보일까()) return '';
    return '<div class="install-card">' +
      '<button type="button" class="ins-x" data-act="설치안내닫기" aria-label="안내 닫기">✕</button>' +
      '<div class="ins-head"><span class="ins-ico">📲</span>' +
      '<b>홈 화면에 추가하면 앱처럼 열립니다</b></div>' +
      '<p class="ins-body">주소창 없이 전체 화면으로 열리고, 지하철에서도 마지막 데이터가 보입니다.</p>' +
      '<ol class="ins-steps">' +
      '<li>사파리 아래쪽 가운데 <b>공유 버튼</b> <span class="ins-share" aria-hidden="true">⬆</span> ' +
      '(네모에서 화살표가 위로 나온 모양)을 누릅니다</li>' +
      '<li>목록을 내려 <b>홈 화면에 추가</b>를 누릅니다</li>' +
      '<li>오른쪽 위 <b>추가</b>를 누르면 끝입니다</li>' +
      '</ol>' +
      '</div>';
  }

  function 하단고지() {
    return '<p class="foot-note">' +
      '수집·집계는 자동이며 값이 틀릴 수 있습니다. ' +
      '본 자료는 투자 권유가 아니며, 투자 판단과 그 결과는 이용자 본인에게 있습니다.</p>';
  }

  function 시장세그(선택, 액션) {
    var 있는 = RiData.있는시장();
    if (있는.length === 0) 있는 = ['한국', '미국'];
    return '<div class="seg">' + 있는.map(function (m) {
      return '<button type="button" data-act="' + 액션 + '" data-market="' + m + '" aria-pressed="' +
        (m === 선택 ? 'true' : 'false') + '">' + m + '</button>';
    }).join('') + '</div>';
  }

  /* -------------------------------------------------------------
   * 2. 종목 카드 (전략 화면)
   * ----------------------------------------------------------- */

  /** 13항목 점수 막대. 각 항목은 0~10점이고, 가중치는 참고로 함께 보여 줍니다. */
  function 점수막대(종목) {
    var 점수 = (종목 && 종목.점수) || null;
    if (!점수) return '';
    return '<div class="bars">' + 점수순서.map(function (k) {
      var v = Number(점수[k]);
      if (isNaN(v)) v = 0;
      var 급 = v >= 7 ? '' : (v >= 4 ? ' mid' : ' low');
      return '<span class="bar"><span class="bl">' + esc(k) + '</span>' +
        '<span class="bt"><i class="bf' + 급 + '" style="width:' + Math.max(0, Math.min(100, v * 10)) + '%"></i></span>' +
        '<span class="bv">' + (Math.round(v * 10) / 10) + '</span></span>';
    }).join('') + '</div>';
  }

  function 근거줄(라벨, 값) {
    if (!값) return '';
    return '<span class="reason"><span class="rk2">' + esc(라벨) + '</span>' +
      '<span class="rv">' + esc(값) + '</span></span>';
  }

  /** 전략 화면의 종목 카드.
   *  `카드` 는 RiStrategy 가 만든 표시용 객체, `원본` 은 stocks_*.json 의 전체 레코드입니다.
   *  (점수 막대·섹터·관심 표시는 전체 레코드가 있어야 그릴 수 있습니다.) */
  function 종목카드HTML(카드, 시장, 순번, rank_by) {
    var 원본 = RiData.종목찾기(시장, 카드.티커);
    var 관심 = RiData.관심여부(시장, 카드.티커);
    var 이름 = (카드.한글명 && 카드.한글명 !== 카드.기업명) ? 카드.한글명 : 카드.기업명;
    var 부제 = (카드.한글명 && 카드.한글명 !== 카드.기업명) ? 카드.기업명 : '';

    var 근거들 = 원본 ? (원본.근거 || {}) : {};
    var 기준라벨 = (rank_by && rank_by !== '총점')
      ? (rank_by === '마법공식' ? '마법공식 순위합' : rank_by + ' 기준')
      : '';

    return '<article class="stock-card">' +
      '<div class="sc-head">' +
        '<div class="sc-id">' +
          '<div class="sc-name">' + 순번 + '. ' + esc(이름) + '</div>' +
          (부제 ? '<div class="sc-ko">' + esc(부제) + '</div>' : '') +
          '<div class="sc-meta"><b>' + esc(카드.티커) + '</b>' +
            (카드.시총순위 ? ' · 시총 ' + esc(카드.시총순위) + '위' : '') +
            (원본 && 원본.섹터 ? ' · ' + esc(원본.섹터) : '') + '</div>' +
        '</div>' +
        '<div class="sc-score"><span class="v">' + 수(카드.총점, 1) + '</span>' +
          '<span class="l">총점 100</span>' +
          (기준라벨 ? '<span class="l">' + esc(기준라벨) + ' ' + esc(String(카드.기준점수 === null ? '-' : 카드.기준점수)) + '</span>' : '') +
        '</div>' +
        '<button type="button" class="fav-btn" data-act="관심" data-market="' + 시장 + '" data-ticker="' +
          esc(카드.티커) + '" aria-pressed="' + (관심 ? 'true' : 'false') +
          '" aria-label="관심종목">' + (관심 ? '★' : '☆') + '</button>' +
      '</div>' +
      점수막대(원본) +
      '<div class="reasons">' +
        근거줄('모멘텀', 카드.모멘텀) +
        근거줄('차트', 카드.차트) +
        근거줄('재무', 카드.재무) +
        근거줄('밸류', 카드.밸류) +
        근거줄('수급', 카드.수급) +
        근거줄('추세', 근거들.미네르비니) +
      '</div>' +
      (카드.호재 ? '<div class="good-news">📈 ' + esc(카드.호재) + '</div>' : '') +
      (원본 && 원본.악재 ? '<div class="bad-news">⚠️ ' + esc(원본.악재) + '</div>' : '') +
      '<div style="margin-top:10px"><button type="button" class="btn btn-sub" data-act="상세" data-market="' +
        시장 + '" data-ticker="' + esc(카드.티커) + '">자세히 보기</button></div>' +
      '</article>';
  }

  /* -------------------------------------------------------------
   * 3. 전략 결과 블록
   * ----------------------------------------------------------- */
  function 전략계산(전략) {
    var s = RiData.상태;
    return RiStrategy.전략실행({
      전략: 전략,
      시장데이터: s.시장데이터,
      시장요약: s.market || {},
      섹터매핑전체: s.섹터매핑
    });
  }

  function 결과블록HTML(결과, 시장, rank_by) {
    var m = (결과.시장 || {})[시장];
    if (!m) {
      return '<div class="empty"><span class="em-ico">📭</span><b>' + esc(시장) +
        ' 데이터가 없습니다</b><p>이 시장은 최근 수집에 실패했을 수 있습니다.</p></div>';
    }
    if (m.오류) {
      return '<div class="empty"><span class="em-ico">📭</span><b>' + esc(시장) +
        ' 종목 데이터를 읽지 못했습니다</b><p>' + esc(m.오류) + '</p></div>';
    }
    var 블록들 = m.섹터별 || [];
    if (블록들.length === 0) {
      var 뉴스없음 = !(결과.뉴스섹터 && 결과.뉴스섹터.length);
      return '<div class="empty"><span class="em-ico">🕳️</span><b>조건을 통과한 종목이 없습니다</b><p>' +
        (뉴스없음
          ? '오늘 뉴스에서 뜬 섹터를 찾지 못했습니다. 뉴스 수집이 실패했을 수 있습니다.'
          : '오늘은 이 전략의 조건을 모두 만족하는 종목이 없습니다.<br>조건이 까다로운 전략일수록 자주 있는 일입니다.') +
        '</p></div>';
    }

    return 블록들.map(function (블록) {
      return '<div class="block-head">' +
        '<span class="bh-news">' + esc(블록.뉴스섹터) + '</span>' +
        '<span class="bh-sec">' + esc(블록.섹터) + ' · ' + (블록.종목 || []).length + '종목</span>' +
        '</div>' +
        (블록.종목 || []).map(function (c, i) {
          return 종목카드HTML(c, 시장, i + 1, rank_by);
        }).join('');
    }).join('');
  }

  /* -------------------------------------------------------------
   * 4. 화면 ① 오늘 브리핑
   * ----------------------------------------------------------- */
  function 브리핑그리기() {
    var s = RiData.상태;
    var el = 요소.brief;
    if (!s.준비) { el.innerHTML = 데이터없음화면('오늘 브리핑'); return; }

    var f = RiData.신선도();
    var mk = s.market;
    var h = '';

    h += '<div class="app-header"><h1>Ri Stock</h1><span class="badge">오늘 브리핑</span></div>' +
      '<p class="app-sub">기준일 ' + esc(f.표시일 || '-') + ' · ' + esc(f.문구) + '</p>' +
      브리핑시각줄();
    h += 신선도배너();
    h += 실행메모배너();
    h += 설치안내카드();
    h += 지수카드();          // 오늘 시장이 어땠는지는 지수가 가장 정확합니다

    // ── 시장 분위기 한 줄
    h += '<div class="card"><div class="card-title">오늘의 시장 분위기</div>' +
      '<p class="mood">' + esc((mk && mk.요약) || '뉴스 요약을 만들지 못했습니다.') + '</p>' +
      (mk && mk.날짜 ? '<p style="font-size:11px;color:var(--text-faint);margin-top:8px">뉴스 수집 ' + esc(mk.날짜) + '</p>' : '') +
      '</div>';

    // ── 국가별 긍정·부정
    var 국가별 = (mk && mk.국가별) || {};
    var 국가들 = Object.keys(국가별);
    if (국가들.length) {
      h += '<div class="card"><div class="card-title">국가별 뉴스 <span class="grow" style="font-weight:500;color:var(--text-faint)">호재 / 악재</span></div>' +
        '<div class="country-grid">' + 국가들.map(function (c) {
          var v = 국가별[c] || {};
          return '<span class="country"><span class="cn">' + esc(c) + '</span>' +
            '<span class="cc">' + (v.수집 || 0) + '건</span>' +
            '<span class="cp">+' + (v.긍정 || 0) + '</span>' +
            '<span class="cm">-' + (v.부정 || 0) + '</span></span>';
        }).join('') + '</div></div>';
    }

    // ── 섹터 순위 Top5 (대표뉴스 펼치기)
    var 순위 = (mk && mk.섹터순위) || [];
    if (순위.length) {
      h += '<div class="card"><div class="card-title">호재 뉴스가 몰린 섹터 Top 5</div>';
      h += 순위.slice(0, 5).map(function (r, i) {
        var 열림 = !!화면.펼친섹터[r.섹터];
        var 뉴스 = r.대표뉴스 || [];
        return '<div class="sector-row">' +
          '<button type="button" class="sector-btn' + (i === 0 ? ' top' : '') +
            '" data-act="섹터펼치기" data-sector="' + esc(r.섹터) + '" aria-expanded="' + (열림 ? 'true' : 'false') + '">' +
            '<span class="rk">' + (r.순위 || i + 1) + '</span>' +
            '<span class="nm">' + esc(r.섹터) +
              '<small>뉴스 ' + (r.뉴스수 || 0) + '건 · 호재 ' + (r.긍정 || 0) + ' · 악재 ' + (r.부정 || 0) + '</small></span>' +
            '<span class="sc">' + 수(r.점수, 1) + '</span>' +
            '<span class="ar">' + (열림 ? '▲' : '▼') + '</span>' +
          '</button>' +
          (열림 && 뉴스.length
            ? '<ul class="sector-news">' + 뉴스.slice(0, 5).map(function (n) {
                return '<li>' + esc(n) + '</li>';
              }).join('') + '</ul>'
            : (열림 ? '<ul class="sector-news"><li>대표 뉴스가 없습니다.</li></ul>' : '')) +
          '</div>';
      }).join('');
      h += '</div>';
    } else {
      h += '<div class="card"><div class="card-title">섹터 순위</div>' +
        '<p style="font-size:13px;color:var(--text-dim)">뉴스 데이터를 읽지 못해 섹터 순위를 만들지 못했습니다. ' +
        '전략 화면의 종목 추출도 함께 비어 보일 수 있습니다.</p></div>';
    }

    // ── 전일 대비 신규 편입 / 이탈
    h += 변화카드();

    // ── 주요 뉴스
    var 뉴스 = 나라섞기((mk && mk.주요뉴스) || [], 12);
    if (뉴스.length) {
      h += '<div class="card"><div class="card-title">오늘의 주요 뉴스</div>' +
        뉴스.map(function (n) {
          var 좋음 = Number(n.뉘앙스) > 0;
          return '<div class="news-item"><span class="news-dot ' + (좋음 ? 'news-up' : 'news-down') + '"></span>' +
            '<span class="nt"><span class="nc">(' + esc(n.국가) + ')</span> ' + esc(n.제목) + '</span></div>';
        }).join('') + '</div>';
    }

    h += 하단고지();
    el.innerHTML = h;
  }

  /** 주요 뉴스를 나라별로 돌아가며 뽑습니다.
   *
   *  엔진은 10개국 뉴스를 뉘앙스 세기 순으로 정렬해 넘겨 주는데, 세기가 같으면
   *  **수집한 나라 순서대로 뭉쳐 있습니다**(미국 23건 뒤에 한국 7건 …).
   *  앞에서 12건만 잘라 쓰면 한국 뉴스가 한 건도 안 보이는 날이 생깁니다.
   *
   *  그래서 우리가 실제로 사고파는 **한국·미국을 번갈아** 먼저 채우고,
   *  자리가 남으면 나머지 나라를 한 바퀴씩 돕니다.
   *  (다른 나라 뉴스는 섹터 순위 카드에 이미 반영돼 있습니다.)
   *  나라 안의 순서(엔진이 매긴 중요도)는 그대로 지킵니다. */
  function 나라섞기(뉴스들, 개수) {
    var 순서 = [], 통 = {};
    (뉴스들 || []).forEach(function (n) {
      var c = (n && n.국가) || '기타';
      if (!통[c]) { 통[c] = []; 순서.push(c); }
      통[c].push(n);
    });

    var 우선 = ['한국', '미국'].filter(function (c) { return 통[c]; });
    var 나머지 = 순서.filter(function (c) { return 우선.indexOf(c) === -1; });

    var 결과 = [];
    function 돌기(나라들) {
      for (var 바퀴 = 0; 결과.length < 개수; 바퀴++) {
        var 담았나 = false;
        for (var i = 0; i < 나라들.length && 결과.length < 개수; i++) {
          var 줄 = 통[나라들[i]];
          if (바퀴 < 줄.length) { 결과.push(줄[바퀴]); 담았나 = true; }
        }
        if (!담았나) break;      // 이 무리에서 더 담을 게 없음
      }
    }
    돌기(우선);
    돌기(나머지);
    return 결과;
  }

  /** 엔진이 부분 실패로 남긴 메모 + 이번 로딩에서 빠진 파일 안내 */
  function 실행메모배너() {
    var s = RiData.상태;
    var 실행 = (s.manifest && s.manifest.실행) || {};
    var 조각 = '';
    if (실행.성공 === false) {
      조각 += 배너('warn', '⚠️', '마지막 자동 실행이 완전히 끝나지 않았습니다',
        esc(실행.메모 || '일부 시장의 수집이 실패했습니다. 그 시장은 이전 데이터를 그대로 씁니다.'));
    }
    if (s.경고 && s.경고.length) {
      조각 += 배너('warn', '📡', '일부 데이터를 불러오지 못했습니다',
        esc(s.경고.join(' / ')));
    }
    return 조각;
  }

  function 변화카드() {
    var c = RiData.상태.changes;
    var 전략이름 = {};
    RiData.상태.전략정의.forEach(function (t) { 전략이름[t.id] = t.name; });

    if (!c || !c.전략별) {
      return '<div class="card"><div class="card-title">어제 대비 변화</div>' +
        '<p style="font-size:13px;color:var(--text-dim)">비교할 어제 데이터가 아직 없습니다. ' +
        '내일부터 신규 편입·이탈 종목이 여기 표시됩니다.</p></div>';
    }

    var 조각 = [];
    Object.keys(c.전략별).forEach(function (id) {
      var 시장별 = c.전략별[id] || {};
      var 줄 = [];
      ['한국', '미국'].forEach(function (m) {
        var v = 시장별[m];
        if (!v) return;
        var 신규 = (v.신규 || []).map(function (x) { return x.기업명 || x.티커; });
        var 이탈 = (v.이탈 || []).map(function (x) { return x.기업명 || x.티커; });
        if (!신규.length && !이탈.length) return;
        if (신규.length) {
          줄.push('<span class="chg-line"><span class="chg-tag chg-in">' + esc(m) + ' 신규</span>' +
            '<span class="chg-list">' + esc(신규.join(', ')) + '</span></span>');
        }
        if (이탈.length) {
          줄.push('<span class="chg-line"><span class="chg-tag chg-out">' + esc(m) + ' 이탈</span>' +
            '<span class="chg-list">' + esc(이탈.join(', ')) + '</span></span>');
        }
      });
      if (줄.length) {
        조각.push('<div class="chg-block"><div class="chg-name">' +
          esc(전략이름[id] || id) + '</div>' + 줄.join('') + '</div>');
      }
    });

    var 부제 = c.이전기준일
      ? '<span class="grow" style="font-weight:500;color:var(--text-faint)">' +
        esc(RiData.날짜표시(c.이전기준일)) + ' → ' + esc(RiData.날짜표시(c.기준일)) + '</span>'
      : '';

    return '<div class="card"><div class="card-title">어제 대비 변화 ' + 부제 + '</div>' +
      (조각.length ? 조각.join('')
        : '<p style="font-size:13px;color:var(--text-dim)">어제와 달라진 종목이 없습니다.</p>') +
      '</div>';
  }

  /* -------------------------------------------------------------
   * 5. 화면 ② 전략
   * ----------------------------------------------------------- */
  function 전략그리기() {
    var s = RiData.상태;
    var el = 요소.strategy;
    if (!s.준비) { el.innerHTML = 데이터없음화면('전략'); return; }

    if (화면.전략id) { 전략상세그리기(); return; }

    var h = 신선도배너() + 급락경고배너() +
      '<div class="page-title">전략</div>' +
      '<div class="page-desc">오늘 호재 뉴스가 몰린 섹터에서, 전략별 조건을 통과한 종목을 뽑습니다.</div>';

    if (!s.전략정의.length) {
      h += '<div class="empty"><span class="em-ico">📭</span><b>전략 정의를 읽지 못했습니다</b>' +
        '<p>data/strategies.json 을 불러오지 못했습니다.</p></div>' + 하단고지();
      el.innerHTML = h;
      return;
    }

    h += s.전략정의.map(function (t) {
      var 칩 = 필터순서.filter(function (k) { return t.filters && t.filters[k]; })
        .map(function (k) { return '<span class="chip chip-on">' + esc(k) + '</span>'; }).join('');
      var 기준 = 순위기준목록.filter(function (r) { return r.v === (t.rank_by || '총점'); })[0];
      return '<button type="button" class="strategy-card" data-act="전략열기" data-id="' + esc(t.id) + '">' +
        '<span class="st-top"><span class="st-name">' + esc(t.name) + '</span><span class="st-go">›</span></span>' +
        '<span class="st-desc">' + esc(t.desc || '') + '</span>' +
        '<span class="chips">' + '<span class="chip">' + esc(기준 ? 기준.t : t.rank_by) + '</span>' + 칩 + '</span>' +
        '</button>';
    }).join('');

    h += 하단고지();
    el.innerHTML = h;
  }

  function 전략상세그리기() {
    var el = 요소.strategy;
    var 전략 = RiData.전략찾기(화면.전략id);
    if (!전략) { 화면.전략id = null; 전략그리기(); return; }

    if (!화면.전략캐시[전략.id]) 화면.전략캐시[전략.id] = 전략계산(전략);
    var 결과 = 화면.전략캐시[전략.id];
    var rank_by = 전략.rank_by || '총점';
    var 시장 = 유효시장(화면.전략시장);

    var 칩 = 필터순서.filter(function (k) { return 전략.filters && 전략.filters[k]; })
      .map(function (k) {
        var 설명 = RiData.상태.필터설명[k] || '';
        return '<span class="chip chip-on" title="' + esc(설명) + '">' + esc(k) + '</span>';
      }).join('');

    var h = '<button type="button" class="back-btn" data-act="전략목록">‹ 전략 목록</button>';
    h += 신선도배너();
    h += 급락경고배너();      // 종목 목록 바로 위 — 여기서 봐야 의미가 있습니다
    h += '<div class="page-title">' + esc(전략.name) + '</div>' +
      '<div class="page-desc">' + esc(전략.desc || '') + '</div>' +
      '<div class="chips" style="margin-bottom:12px">' +
        '<span class="chip">정렬: ' + esc(rank_by) + '</span>' + 칩 + '</div>';

    var 뉴스섹터 = 결과.뉴스섹터 || [];
    if (뉴스섹터.length) {
      h += '<div class="card"><div class="card-title">오늘의 뉴스 섹터</div><div class="chips">' +
        뉴스섹터.map(function (x, i) {
          return '<span class="chip' + (i < 3 ? ' chip-on' : '') + '">' + (i + 1) + '. ' + esc(x) + '</span>';
        }).join('') + '</div></div>';
    }

    h += 시장세그(시장, '전략시장');
    h += 시장신선도배너(시장);
    h += 결과블록HTML(결과, 시장, rank_by);
    h += '<button type="button" class="btn btn-sub" data-act="전략CSV" style="margin-top:14px">CSV 로 내려받기</button>';
    h += 하단고지();
    el.innerHTML = h;
  }

  function 유효시장(원하는) {
    var 있는 = RiData.있는시장();
    if (있는.indexOf(원하는) !== -1) return 원하는;
    return 있는[0] || '한국';
  }

  /* -------------------------------------------------------------
   * 6. 화면 ③ 종목
   *    검색창에 타이핑할 때 화면 전체를 다시 그리면 입력 포커스가 날아갑니다.
   *    그래서 껍데기(shell)와 목록(list)을 나눠 그립니다.
   * ----------------------------------------------------------- */
  function 종목그리기(껍데기부터) {
    var s = RiData.상태;
    var el = 요소.stocks;
    if (!s.준비) { el.innerHTML = 데이터없음화면('종목'); return; }

    화면.종목.시장 = 유효시장(화면.종목.시장);

    if (껍데기부터 !== false || !el.querySelector('#stock-list')) {
      화면.종목.표시수 = 표시단위;      // 화면을 새로 열면 처음 50행부터
      var 섹터들 = RiData.섹터목록(화면.종목.시장);
      if (섹터들.indexOf(화면.종목.섹터) === -1) 화면.종목.섹터 = '';

      var h = 신선도배너() +
        '<div class="page-title">종목</div>' +
        '<div class="page-desc">시가총액 상위 300종목. 이름·티커로 찾고, 점수 상세를 볼 수 있습니다.</div>';
      h += 시장세그(화면.종목.시장, '종목시장');
      h += 시장신선도배너(화면.종목.시장);
      // <label> 로 감싸면 돋보기 아이콘이나 칸 가장자리를 눌러도 커서가 들어옵니다.
      // (<div> 였을 때는 글자 줄(18px)만 실제 터치 지점이라 자꾸 헛손질이 났습니다.)
      h += '<label class="search-box"><span class="si">🔎</span>' +
        '<input type="search" id="stock-search" placeholder="기업명 · 한글명 · 티커 검색" ' +
        'value="' + esc(화면.종목.검색) + '" autocomplete="off"></label>';
      h += '<div class="filter-row">' +
        '<select id="stock-sector" aria-label="섹터"><option value="">전체 섹터</option>' +
        섹터들.map(function (x) {
          return '<option value="' + esc(x) + '"' + (x === 화면.종목.섹터 ? ' selected' : '') + '>' + esc(x) + '</option>';
        }).join('') + '</select>' +
        '<select id="stock-sort" aria-label="정렬">' +
        '<option value="시총순위"' + (화면.종목.정렬 === '시총순위' ? ' selected' : '') + '>시총 순</option>' +
        '<option value="총점"' + (화면.종목.정렬 === '총점' ? ' selected' : '') + '>총점 순</option>' +
        '</select></div>';
      h += '<div class="btn-row">' +
        '<button type="button" class="btn btn-sub" data-act="관심만" aria-pressed="' +
        (화면.종목.관심만 ? 'true' : 'false') + '">' +
        (화면.종목.관심만 ? '★ 관심종목만' : '☆ 관심종목만') + '</button>' +
        '<button type="button" class="btn btn-sub" data-act="종목CSV">CSV 내려받기</button></div>';
      h += '<div class="list-count" id="stock-count"></div>';
      h += '<div id="stock-list"></div>';
      h += 하단고지();
      el.innerHTML = h;
    }
    종목목록그리기();
  }

  function 종목걸러내기() {
    var 시장 = 화면.종목.시장;
    var 조건 = 화면.종목;
    var q = (조건.검색 || '').trim().toLowerCase();
    var 관심 = RiData.관심목록();

    var 목록 = RiData.종목배열(시장).filter(function (s) {
      if (조건.섹터 && s.섹터 !== 조건.섹터) return false;
      if (조건.관심만 && 관심.indexOf(RiData.관심키(시장, s.티커)) === -1) return false;
      if (q) {
        var 헤이 = ((s.기업명 || '') + ' ' + (s.한글명 || '') + ' ' + (s.티커 || '')).toLowerCase();
        if (헤이.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (조건.정렬 === '총점') {
      목록 = 목록.slice().sort(function (a, b) {
        var av = a.평가 ? Number(a.총점) || 0 : -1;
        var bv = b.평가 ? Number(b.총점) || 0 : -1;
        if (av !== bv) return bv - av;
        return (Number(a.시총순위) || 9999) - (Number(b.시총순위) || 9999);
      });
    } else {
      목록 = 목록.slice().sort(function (a, b) {
        return (Number(a.시총순위) || 9999) - (Number(b.시총순위) || 9999);
      });
    }
    return 목록;
  }

  /* 한 번에 그리는 행 수.
   *
   * 300행을 한꺼번에 그리면 **구형 폰에서 검색이 뚝뚝 끊깁니다.**
   * 헤드리스 크로미움에 CPU 4배 스로틀링을 걸고 실측한 값 (한국 300종목):
   *     "0" 한 글자 → 300행 렌더 587ms · 검색어를 전부 지워 300행 복귀 529ms
   * 한 글자당 0.5초는 그냥 멈춘 것으로 느껴집니다. 눈에 보이는 만큼만 그리고
   * 나머지는 "더 보기"로 잇습니다.
   *
   * 첫 화면은 50행(같은 조건에서 90ms 아래 — 타이핑이 끊기지 않는 선),
   * "더 보기"는 한 번에 100행씩 덧붙입니다. 사장님이 직접 누른 뒤의 0.2초는 기다릴 만하고,
   * 300종목을 끝까지 펼치는 데 세 번이면 됩니다.
   * 전체 목록이 필요한 CSV 내보내기는 `종목걸러내기()` 를 그대로 쓰므로 영향이 없습니다. */
  var 표시단위 = 50;
  var 더보기단위 = 100;

  function 종목행HTML(s, 시장) {
    var 관심 = RiData.관심여부(시장, s.티커);
    return '<button type="button" class="stock-row" data-act="상세" data-market="' + 시장 +
      '" data-ticker="' + esc(s.티커) + '">' +
      '<span class="rank">' + (s.시총순위 || '-') + '</span>' +
      '<span class="info"><span class="nm">' + (관심 ? '★ ' : '') + esc(표시이름(s)) + '</span>' +
      '<span class="sb">' + esc(s.티커) + ' · ' + esc(s.섹터 || '-') +
      (s.시총조원 ? ' · ' + 수(s.시총조원, 1) + '조' : '') + '</span></span>' +
      (s.평가
        ? '<span class="tot">' + 수(s.총점, 1) + '</span>'
        : '<span class="tot none">미평가</span>') +
      '</button>';
  }

  function 더보기HTML(보인수, 전체) {
    if (보인수 >= 전체) return '';
    return '<button type="button" class="btn btn-sub more-btn" data-act="더보기">' +
      '더 보기 <span class="more-left">' + 보인수 + ' / ' + 전체 + '종목</span></button>';
  }

  /** 검색·필터가 바뀌면 처음 50행부터 다시 봅니다. */
  function 종목처음부터그리기() {
    화면.종목.표시수 = 표시단위;
    종목목록그리기();
  }

  function 종목목록그리기() {
    var 목록 = 종목걸러내기();
    var 시장 = 화면.종목.시장;
    var cnt = document.getElementById('stock-count');
    var list = document.getElementById('stock-list');
    if (!list) return;

    var 평가수 = 목록.filter(function (s) { return s.평가; }).length;
    if (cnt) {
      cnt.innerHTML = '<span>' + 목록.length + '종목</span>' +
        '<span class="grow">점수 있는 종목 ' + 평가수 + '</span>';
    }

    if (!목록.length) {
      list.innerHTML = '<div class="empty"><span class="em-ico">🔍</span><b>찾는 종목이 없습니다</b>' +
        '<p>검색어나 섹터 조건을 바꿔 보세요.</p></div>';
      return;
    }

    var 끝 = Math.min(Math.max(화면.종목.표시수, 표시단위), 목록.length);
    list.innerHTML = 목록.slice(0, 끝).map(function (s) { return 종목행HTML(s, 시장); }).join('') +
      더보기HTML(끝, 목록.length);
  }

  /** 목록에서 그 종목 한 줄의 ★ 표시만 고칩니다.
   *  별표 하나 눌렀다고 보고 있던 수백 행을 통째로 다시 그릴 이유가 없습니다. */
  function 별표행갱신(시장, 티커, 켜짐) {
    var 행들 = document.querySelectorAll('#stock-list .stock-row');
    for (var i = 0; i < 행들.length; i++) {
      if (행들[i].dataset.ticker !== String(티커) || 행들[i].dataset.market !== String(시장)) continue;
      var nm = 행들[i].querySelector('.nm');
      if (nm) nm.textContent = (켜짐 ? '★ ' : '') + nm.textContent.replace(/^★\s*/, '');
      return;
    }
  }

  /** "더 보기" — 이미 그린 행은 그대로 두고 **늘어난 만큼만** 덧붙입니다.
   *  (전체를 다시 그리면 늘어날수록 느려져서 제한을 둔 의미가 없어집니다.) */
  function 종목더그리기() {
    var list = document.getElementById('stock-list');
    if (!list) return;
    var 목록 = 종목걸러내기();
    var 이미 = list.querySelectorAll('.stock-row').length;
    var 끝 = Math.min(화면.종목.표시수, 목록.length);
    if (끝 <= 이미) return;

    var 시장 = 화면.종목.시장;
    var 조각 = 목록.slice(이미, 끝).map(function (s) { return 종목행HTML(s, 시장); }).join('');
    var 더 = list.querySelector('[data-act="더보기"]');
    if (더) 더.insertAdjacentHTML('beforebegin', 조각);
    else list.insertAdjacentHTML('beforeend', 조각);

    if (끝 >= 목록.length) { if (더) 더.parentNode.removeChild(더); }
    else if (더) 더.innerHTML = '더 보기 <span class="more-left">' + 끝 + ' / ' + 목록.length + '종목</span>';
  }

  /* -------------------------------------------------------------
   * 7. 화면 ④ 내 전략
   * ----------------------------------------------------------- */
  function 내전략그리기(껍데기부터) {
    var s = RiData.상태;
    var el = 요소.my;
    if (!s.준비) { el.innerHTML = 데이터없음화면('내 전략'); return; }

    화면.내전략.시장 = 유효시장(화면.내전략.시장);

    if (껍데기부터 !== false || !el.querySelector('#my-result')) {
      var 설명 = s.필터설명 || {};
      var h = 신선도배너() +
        '<div class="page-title">내 전략</div>' +
        '<div class="page-desc">조건을 켜고 끄면 곧바로 다시 계산합니다. 마음에 들면 저장해 두세요.</div>';

      h += '<div class="card"><div class="card-title">조건 (모두 만족해야 통과)</div>' +
        필터순서.map(function (k) {
          var 켬 = !!화면.내전략.필터[k];
          return '<button type="button" class="toggle-row" data-act="내필터" data-key="' + esc(k) +
            '" aria-pressed="' + (켬 ? 'true' : 'false') + '">' +
            '<span class="tg-txt"><span class="tg-name">' + esc(k) + '</span>' +
            '<span class="tg-desc">' + esc(설명[k] || '') + '</span></span>' +
            '<span class="switch"></span></button>';
        }).join('') + '</div>';

      h += '<div class="card"><div class="card-title">순위 기준</div>' +
        '<select id="my-rank" class="name-input" style="margin-bottom:0" aria-label="순위 기준">' +
        순위기준목록.map(function (r) {
          return '<option value="' + r.v + '"' + (r.v === 화면.내전략.rank_by ? ' selected' : '') + '>' +
            esc(r.t) + '</option>';
        }).join('') + '</select></div>';

      h += '<div class="card"><div class="card-title">이 조건 저장하기</div>' +
        '<input type="text" class="name-input" id="my-name" maxlength="30" placeholder="예) 내 눌림목 전략" value="' +
        esc(화면.내전략.이름) + '">' +
        '<button type="button" class="btn" data-act="내전략저장">저장</button>' +
        저장목록HTML() + '</div>';

      h += '<div id="my-result"></div>';
      h += 하단고지();
      el.innerHTML = h;
    }
    내전략결과그리기();
  }

  function 저장목록HTML() {
    var 목록 = RiData.내전략목록();
    if (!목록.length) {
      return '<p style="font-size:12px;color:var(--text-faint);margin-top:10px">저장한 조건이 아직 없습니다.</p>';
    }
    return '<div style="margin-top:12px">' + 목록.map(function (x) {
      var 켠것 = 필터순서.filter(function (k) { return x.filters && x.filters[k]; });
      return '<div class="saved-item"><span class="sv-name">' + esc(x.name) +
        '<span class="sv-sub">' + esc(x.rank_by) + ' 순 · ' +
        (켠것.length ? esc(켠것.join(', ')) : '조건 없음') + '</span></span>' +
        '<button type="button" data-act="내전략불러오기" data-id="' + esc(x.id) + '">불러오기</button>' +
        '<button type="button" class="del" data-act="내전략삭제" data-id="' + esc(x.id) + '">삭제</button></div>';
    }).join('') + '</div>';
  }

  /** 지금 켜 둔 조건을 기기에 남깁니다 — 앱을 닫았다 열어도 그대로여야 합니다. */
  function 내전략상태저장() {
    RiData.내전략상태저장({
      필터: 화면.내전략.필터,
      rank_by: 화면.내전략.rank_by,
      시장: 화면.내전략.시장
    });
  }

  function 내전략계산() {
    return 전략계산({
      id: 'my', name: '내 전략',
      rank_by: 화면.내전략.rank_by,
      filters: 화면.내전략.필터
    });
  }

  function 내전략결과그리기() {
    var box = document.getElementById('my-result');
    if (!box) return;
    var 결과 = 내전략계산();
    var 시장 = 유효시장(화면.내전략.시장);
    box.innerHTML = '<div class="card-title" style="margin:18px 2px 8px">결과</div>' +
      시장세그(시장, '내전략시장') +
      시장신선도배너(시장) +
      결과블록HTML(결과, 시장, 화면.내전략.rank_by) +
      '<button type="button" class="btn btn-sub" data-act="내전략CSV" style="margin-top:14px">CSV 로 내려받기</button>';
  }

  /* -------------------------------------------------------------
   * 8. 종목 상세 시트
   * ----------------------------------------------------------- */

  /** 'YYYYMMDD' → '26.07.28' (좁은 폰 축 라벨용) */
  function 짧은날짜(s) {
    var t = String(s || '');
    return /^\d{8}$/.test(t) ? t.slice(2, 4) + '.' + t.slice(4, 6) + '.' + t.slice(6, 8) : t;
  }

  /**
   * 주가 선 그래프 (SVG, 라이브러리 없음).
   *
   * 앱은 정적 페이지라 브라우저에서 주가 API 를 직접 못 부릅니다(CORS).
   * 그래서 엔진이 담아 준 값만 그립니다 — 여기서 값을 지어내거나 보간하지 않습니다.
   * 빈 구간(상장 전·거래정지)은 선을 끊어 둡니다. 이어 버리면 없던 거래가 있던 것처럼 보입니다.
   *
   * 색은 한국 증시 관행 — 구간 첫 값보다 오르면 빨강, 내리면 파랑.
   */
  function 주가그래프SVG(계열) {
    var 날짜 = 계열.날짜, 값 = 계열.값;
    var W = 320, H = 132, 여백 = { 위: 10, 아래: 18, 좌: 4, 우: 4 };
    var 숫자 = 값.filter(function (v) { return v !== null && v !== undefined; });
    if (숫자.length < 2) return '';

    var 최소 = Math.min.apply(null, 숫자), 최대 = Math.max.apply(null, 숫자);
    var 폭 = 최대 - 최소 || Math.abs(최대) * 0.02 || 1;
    var 안쪽높이 = H - 여백.위 - 여백.아래;
    var x = function (i) { return 여백.좌 + (W - 여백.좌 - 여백.우) * (값.length === 1 ? 0.5 : i / (값.length - 1)); };
    var y = function (v) { return 여백.위 + 안쪽높이 * (1 - (v - 최소) / 폭); };

    var 조각 = [], 현재 = [];
    for (var i = 0; i < 값.length; i++) {
      if (값[i] === null || 값[i] === undefined) {
        if (현재.length > 1) 조각.push(현재);
        현재 = [];
        continue;
      }
      현재.push(x(i).toFixed(1) + ',' + y(값[i]).toFixed(1));
    }
    if (현재.length > 1) 조각.push(현재);
    if (!조각.length) return '';

    var 처음값 = 숫자[0], 끝값 = 숫자[숫자.length - 1];
    var 색 = 끝값 > 처음값 ? 'var(--up)' : (끝값 < 처음값 ? 'var(--down)' : 'var(--text-dim)');
    var 선 = 조각.map(function (p) {
      return '<polyline points="' + p.join(' ') + '" fill="none" stroke="' + 색 +
        '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    }).join('');

    // 마지막 점은 눈에 띄게 — '지금 어디인지'가 가장 먼저 보여야 합니다
    var 끝i = 값.length - 1;
    while (끝i > 0 && (값[끝i] === null || 값[끝i] === undefined)) 끝i--;
    var 끝점 = '<circle cx="' + x(끝i).toFixed(1) + '" cy="' + y(값[끝i]).toFixed(1) +
      '" r="3" fill="' + 색 + '"/>';

    var 라벨 = '<text x="' + 여백.좌 + '" y="' + (H - 4) + '" class="cht-ax">' + esc(짧은날짜(날짜[0])) +
      '</text><text x="' + (W - 여백.우) + '" y="' + (H - 4) + '" class="cht-ax" text-anchor="end">' +
      esc(짧은날짜(날짜[날짜.length - 1])) + '</text>';

    return '<svg class="cht" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'role="img" aria-label="주가 추이 그래프">' + 선 + 끝점 + 라벨 + '</svg>';
  }

  /**
   * 종목 상세 맨 위 주가 카드 — 구간(연·월·주·일) 전환.
   *
   * 구간 버튼은 시트를 통째로 다시 그리지 않고 이 카드만 갈아 끼웁니다
   * (다시 그리면 시트 스크롤이 맨 위로 튑니다).
   */
  function 주가카드HTML(시장, 티커) {
    var 전체 = RiData.차트(시장, 티커);
    if (!전체) {
      return '<div class="card" id="cht-card"><div class="card-title">주가</div>' +
        '<p class="cht-none">이 종목은 그래프 자료가 없습니다. ' +
        '그래프는 전략에 오르는 <b>평가 종목</b>만 담습니다.</p></div>';
    }
    var 구간들 = ['연', '월', '주', '일'].filter(function (k) { return !!전체[k]; });
    var 지금 = 구간들.indexOf(화면.차트구간) >= 0 ? 화면.차트구간 : 구간들[구간들.length - 1];
    화면.차트구간 = 지금;
    var 계열 = 전체[지금];

    var 숫자 = 계열.값.filter(function (v) { return v !== null && v !== undefined; });
    var 처음 = 숫자[0], 끝 = 숫자[숫자.length - 1];
    var 변화 = 처음 ? (끝 / 처음 - 1) * 100 : null;
    var 통화 = 시장 === '한국' ? '원' : '$';
    var 값표시 = 시장 === '한국'
      ? Number(끝).toLocaleString('ko-KR') + '원'
      : '$' + Number(끝).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    var 탭 = 구간들.map(function (k) {
      return '<button type="button" class="cht-tab' + (k === 지금 ? ' on' : '') +
        '" data-act="차트구간" data-range="' + k + '" aria-pressed="' + (k === 지금 ? 'true' : 'false') +
        '">' + k + '</button>';
    }).join('');

    return '<div class="card" id="cht-card">' +
      '<div class="card-title">주가 <span class="grow cht-last">' + esc(값표시) + '</span></div>' +
      '<div class="cht-sub">' +
        '<span class="' + 부호색(변화) + '">' + (변화 === null ? '-' : 부호수(변화, 1, '%')) + '</span>' +
        '<span class="cht-range">' + esc(짧은날짜(계열.날짜[0])) + ' → ' +
        esc(짧은날짜(계열.날짜[계열.날짜.length - 1])) + ' · ' + 계열.값.length + '개 점</span>' +
      '</div>' +
      주가그래프SVG(계열) +
      '<div class="cht-tabs" role="group" aria-label="기간 선택">' + 탭 + '</div>' +
      '<p class="cht-note">' + esc(통화 === '원' ? '종가 기준(원)' : '종가 기준(달러)') +
      ' · 마지막 점 ' + esc(짧은날짜(계열.날짜[계열.날짜.length - 1])) +
      차트지연안내(시장, 계열) + '</p>' +
      '</div>';
  }

  /**
   * 그래프가 기준일보다 뒤처졌을 때 그 사실을 밝힙니다.
   *
   * 주가 원본(야후)이 그날 종가를 아직 안 채웠거나 나중에 비우는 일이 실제로 있습니다
   * (2026-07-28 확인: 저녁에는 220,000 이던 삼성전자 종가가 자정 무렵 빈 값으로 바뀜).
   * 없는 값을 지어내지 않으니 그래프는 하루 짧아지는데, 아무 설명이 없으면
   * "오늘 데이터"라는 머리말과 어긋나 보입니다. 그래서 이유를 함께 적습니다.
   */
  function 차트지연안내(시장, 계열) {
    var 칸 = ((RiData.상태.manifest || {}).시장 || {})[시장] || {};
    var 기준일 = String(칸.기준일 || '');
    var 마지막 = String(계열.날짜[계열.날짜.length - 1] || '');
    if (!/^\d{8}$/.test(기준일) || !/^\d{8}$/.test(마지막) || 마지막 >= 기준일) return '';
    return ' · <b>기준일 ' + esc(RiData.날짜표시(기준일)) + '보다 짧습니다</b> — ' +
      '주가 원본에 그 뒤 종가가 아직 없습니다';
  }

  function 차트다시그리기() {
    var 카드 = document.getElementById('cht-card');
    var s = 화면.시트종목;
    if (!카드 || !s) return;
    카드.outerHTML = 주가카드HTML(s.시장, s.티커);
  }

  function 순익표(종목) {
    var n = 종목.순익 || {};
    var 값 = n.값 || [];
    if (!값.length) return '';
    var 끝해 = null;
    var m = /(\d{4})\s*$/.exec(String(n.연도 || ''));
    if (m) 끝해 = Number(m[1]);

    var 줄 = [];
    for (var i = 0; i < 값.length; i++) {
      if (값[i] === null || 값[i] === undefined) continue;
      var 라벨 = 끝해 ? String(끝해 - (값.length - 1 - i)) : ('최근-' + (값.length - 1 - i));
      줄.push({ 라벨: 라벨, 값: 값[i] });
    }
    if (!줄.length) return '';

    return '<div class="card"><div class="card-title">연간 순이익 (억원 · 백만$)</div>' +
      '<div class="scroll-x"><table class="mini-table"><tr>' +
      줄.map(function (x) { return '<th>' + esc(x.라벨) + '</th>'; }).join('') + '</tr><tr>' +
      줄.map(function (x) {
        var c = 부호색(x.값);
        return '<td class="' + c + '" style="color:' + (c === 'up' ? 'var(--up)' : (c === 'down' ? 'var(--down)' : 'inherit')) + '">' +
          Number(x.값).toLocaleString('ko-KR') + '</td>';
      }).join('') + '</tr></table></div></div>';
  }

  /* 시트가 열려 있는 동안 뒤 화면이 따라 움직이지 않게 잠급니다.
   * (어두운 배경을 쓸어내리면 뒤의 300종목 목록이 스크롤돼, 시트를 닫으면
   *  보고 있던 자리가 아닌 엉뚱한 위치에 가 있었습니다.) */
  var 시트열기전스크롤 = 0;

  /* 뒤로가기로 시트를 닫기 위한 히스토리 항목.
   *
   * 폰에서는 무언가 덮여 있을 때 뒤로가기를 누르면 **덮인 것부터 닫히는 것**이 관례입니다
   * (안드로이드 하드웨어 버튼이 특히 그렇습니다).
   * 이게 없으면 뒤로가기 한 번에 시트가 닫히면서 보던 탭과 스크롤 위치까지 함께 날아갔습니다.
   * 시트를 열 때 같은 주소로 항목을 하나 밀어 넣고, 뒤로가기가 그 항목을 먹으면 시트만 닫습니다. */
  var 시트히스토리 = false;

  function 시트열림() {
    var back = document.getElementById('sheet-back');
    return !!back && !back.hidden;
  }

  function 시트히스토리밀기() {
    if (시트히스토리) return;
    try {
      history.pushState({ ristock시트: true }, '', location.href);
      시트히스토리 = true;
    } catch (e) { /* 히스토리를 못 쓰면 예전처럼 해시 변화로 닫힙니다 */ }
  }

  function 배경잠금(잠글까) {
    var b = document.body;
    var 잠겨있음 = b.classList.contains('sheet-open');
    if (잠글까) {
      if (잠겨있음) return;                     // 이미 잠겨 있으면 위치를 덮어쓰지 않습니다
      시트열기전스크롤 = window.scrollY || window.pageYOffset || 0;
      b.style.top = (-시트열기전스크롤) + 'px';
      b.classList.add('sheet-open');
    } else {
      if (!잠겨있음) return;
      b.classList.remove('sheet-open');
      b.style.top = '';
      window.scrollTo(0, 시트열기전스크롤);      // 보고 있던 자리로 되돌립니다
    }
  }

  function 상세열기(시장, 티커) {
    var s = RiData.종목찾기(시장, 티커);
    var back = document.getElementById('sheet-back');
    var sheet = document.getElementById('sheet');
    if (!sheet) return;

    if (!s) {
      sheet.innerHTML = '<div class="sheet-bar"></div><div class="sheet-title">종목을 찾지 못했습니다</div>' +
        '<p class="sheet-sub">' + esc(시장) + ' ' + esc(티커) + '</p>' +
        '<button type="button" class="btn btn-sub" data-act="시트닫기">닫기</button>';
      시트히스토리밀기();
      back.hidden = false;
      배경잠금(true);
      return;
    }

    var 관심 = RiData.관심여부(시장, 티커);
    var 지표 = s.지표 || {};
    var 근거 = s.근거 || {};
    var 수익 = s.수익률 || {};

    var h = '<div class="sheet-bar"></div>';
    h += '<div style="display:flex;align-items:flex-start;gap:10px">' +
      '<div style="flex:1;min-width:0">' +
      '<div class="sheet-title">' + esc(표시이름(s)) + '</div>' +
      '<p class="sheet-sub">' + esc(s.티커) + ' · ' + esc(s.거래소 || '') + ' · ' + esc(s.섹터 || '') +
      (s.산업 ? '<br>' + esc(s.산업) : '') + '</p></div>' +
      '<button type="button" class="fav-btn" data-act="관심" data-market="' + esc(시장) + '" data-ticker="' +
      esc(s.티커) + '" aria-pressed="' + (관심 ? 'true' : 'false') + '" aria-label="관심종목">' +
      (관심 ? '★' : '☆') + '</button></div>';

    // 주가 그래프를 맨 위에 둡니다 — 종목을 열었을 때 가장 먼저 보고 싶은 것입니다
    화면.시트종목 = { 시장: 시장, 티커: s.티커 };
    h += 주가카드HTML(시장, s.티커);

    if (s.평가) {
      h += '<div class="card"><div class="card-title">종합 점수 <span class="grow" style="font-weight:800;font-size:22px;color:var(--primary-ink)">' +
        수(s.총점, 1) + '</span></div>' + 점수막대(s) + '</div>';
    } else {
      h += 배너('info', 'ℹ️', '점수가 없는 종목입니다',
        '시가총액 상위 300에는 들지만, 이번 회차에 뉴스·수급까지 분석되지 않았습니다.');
    }

    h += '<div class="card"><div class="card-title">주요 지표</div><div class="kv">' +
      [['시총순위', s.시총순위 ? s.시총순위 + '위' : '-', ''],
       ['시가총액', s.시총조원 ? 수(s.시총조원, 1) + '조' : '-', ''],
       ['PER', 수(지표.PER, 1), ''],
       ['PBR', 수(지표.PBR, 2), ''],
       ['ROE', 수(지표.ROE, 1) + '%', 부호색(지표.ROE)],
       ['배당수익률', 수(지표.배당수익률, 2) + '%', ''],
       ['부채비율', 수(지표.부채비율, 1) + '%', ''],
       ['12개월 수익률', 부호수(지표.모멘텀12M, 1, '%'), 부호색(지표.모멘텀12M)],
       ['거래량비', 수(지표.거래량비, 0) + '%', ''],
       ['순익성장률', 부호수(지표.순익성장률, 1, '%'), 부호색(지표.순익성장률)],
       ['52주 고점대비', 수(지표.고점대비, 0) + '%', ''],
       ['10일 고점비', 부호수(지표['10일고점비'], 1, '%'), 부호색(지표['10일고점비'])]
      ].map(function (x) {
        return '<div><div class="k">' + esc(x[0]) + '</div><div class="v ' + x[2] + '">' + esc(x[1]) + '</div></div>';
      }).join('') + '</div></div>';

    if (수익 && (수익['3년'] !== undefined || 수익['5년'] !== undefined)) {
      h += '<div class="card"><div class="card-title">연평균 수익률 (CAGR)</div><div class="kv">' +
        ['3년', '5년', '10년'].map(function (k) {
          var v = 수익[k];
          var p = (v === null || v === undefined) ? null : Number(v) * 100;
          return '<div><div class="k">' + k + '</div><div class="v ' + 부호색(p) + '">' +
            (p === null ? '-' : 부호수(p, 1, '%')) + '</div></div>';
        }).join('') + '</div></div>';
    }

    var 근거키 = ['모멘텀', '차트', '매출', '순익', '재무', '52주', '변동', '밸류', '배당', '수급', '미네르비니'];
    var 근거줄들 = 근거키.map(function (k) { return 근거줄(k, 근거[k]); }).join('');
    if (근거줄들) {
      h += '<div class="card"><div class="card-title">평가 근거</div><div class="reasons">' + 근거줄들 + '</div></div>';
    }

    h += 순익표(s);

    if (s.호재) h += '<div class="good-news" style="margin-bottom:10px">📈 ' + esc(s.호재) + '</div>';
    if (s.악재) h += '<div class="bad-news" style="margin-bottom:10px">⚠️ ' + esc(s.악재) + '</div>';

    h += '<p class="foot-note" style="padding-top:6px">자동 수집·집계 자료이며 투자 권유가 아닙니다.</p>';
    h += '<button type="button" class="btn btn-sub" data-act="시트닫기">닫기</button>';

    sheet.innerHTML = h;
    sheet.scrollTop = 0;
    // 히스토리 항목은 배경을 잠그기 **전에** 밀어 넣습니다
    // (잠근 뒤에 밀면 브라우저가 이 항목의 스크롤을 0으로 기억해, 닫을 때 맨 위로 튑니다)
    시트히스토리밀기();
    back.hidden = false;
    배경잠금(true);
  }

  /** 시트 닫기.
   *  `되돌리기 !== false` 면 시트를 열며 밀어 넣었던 히스토리 항목도 함께 되돌립니다.
   *  뒤로가기로 이미 그 항목이 사라진 경우(popstate·hashchange)에는 `false` 로 불러야
   *  사장님이 누른 뒤로가기가 두 칸 움직이지 않습니다. */
  function 시트닫기(되돌리기) {
    var back = document.getElementById('sheet-back');
    if (back) back.hidden = true;
    배경잠금(false);
    var 밀어둠 = 시트히스토리;
    시트히스토리 = false;
    if (밀어둠 && 되돌리기 !== false) history.back();
  }

  /* -------------------------------------------------------------
   * 9. 라우팅
   * ----------------------------------------------------------- */
  function 해시읽기() {
    var m = /^#\/([a-z]+)(?:\/([^/?#]+))?/.exec(location.hash || '');
    if (!m) return null;
    if (탭목록.indexOf(m[1]) === -1) return null;
    return { 탭: m[1], 인자: m[2] ? decodeURIComponent(m[2]) : null };
  }

  /** 주소창 해시 갱신.
   *  `덮어쓰기` 면 새 항목을 쌓지 않고 지금 항목을 바꿔치웁니다.
   *  시트를 열며 밀어 넣었던 항목이 남아 있을 때 쓰며, 안 그러면 같은 화면이 히스토리에
   *  두 번 들어가 뒤로가기를 눌러도 아무 일도 안 일어나는 것처럼 보입니다. */
  function 해시쓰기(덮어쓰기) {
    var h = '#/' + 화면.탭 + (화면.탭 === 'strategy' && 화면.전략id ? '/' + encodeURIComponent(화면.전략id) : '');
    if (location.hash === h) return;
    if (덮어쓰기 && window.history && history.replaceState) {
      try { history.replaceState(null, '', h); return; } catch (e) { /* 아래 기본 경로로 */ }
    }
    화면._내가바꿈 = true;
    location.hash = h;
  }

  function 탭이동(탭, 해시갱신) {
    if (탭목록.indexOf(탭) === -1) 탭 = 'brief';
    // 상세 시트를 열어 둔 채 화면이 바뀌면 시트가 덩그러니 남았습니다. 폰 관례대로 함께 닫습니다.
    // 여기서는 history.back() 을 부르지 않습니다 — 바로 뒤에 쓰는 해시와 순서가 엉켜
    // 엉뚱한 탭으로 튕깁니다. 대신 남은 항목을 새 해시로 덮어씁니다.
    var 덮어쓰기 = 시트히스토리;
    시트닫기(false);
    화면.탭 = 탭;

    탭목록.forEach(function (t) {
      요소[t].hidden = (t !== 탭);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tabbar button'), function (b) {
      if (b.dataset.tab === 탭) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    그리기(탭);
    if (해시갱신 !== false) 해시쓰기(덮어쓰기);
    window.scrollTo(0, 0);
  }

  function 그리기(탭) {
    if (탭 === 'brief') 브리핑그리기();
    else if (탭 === 'strategy') 전략그리기();
    else if (탭 === 'stocks') 종목그리기(true);
    else if (탭 === 'my') 내전략그리기(true);
  }

  function 전체다시그리기() {
    화면.전략캐시 = {};
    그리기(화면.탭);
  }

  /* -------------------------------------------------------------
   * 9-1. 브리핑 다시 받기
   *
   * 앱은 정적 페이지라 폰에서 수집을 직접 돌릴 수 없습니다(브라우저는 야후·네이버를
   * 부르는 것조차 CORS 로 막힙니다). 그래서 백엔드(Apps Script)에 부탁해
   * 깃허브 워크플로를 `brief` 모드로 눌러 달라고 합니다 — 지수 시황 + 10개국 뉴스만
   * 다시 받는 길이라 1~3분이면 끝나고, 종목 600개는 건드리지 않습니다.
   *
   * 백엔드가 없거나 토큰이 아직 없으면 **거짓말하지 않고** 최신 데이터만 다시 불러온 뒤
   * 무엇이 필요한지 알려 줍니다. 아무 일도 안 하면서 '갱신했다'고 하는 것이 제일 나쁩니다.
   * ----------------------------------------------------------- */
  var 브리핑진행중 = false;

  function 브리핑다시받기(버튼) {
    if (브리핑진행중) return;
    브리핑진행중 = true;
    var 원래 = 버튼 ? 버튼.textContent : '';
    var 되돌리기 = function () {
      브리핑진행중 = false;
      var b = document.querySelector('[data-act="브리핑시작"]');
      if (b) { b.disabled = false; b.textContent = 원래 || '브리핑 다시 받기'; }
    };
    if (버튼) { 버튼.disabled = true; 버튼.textContent = '요청 중…'; }

    var 이전시각 = (RiData.상태.manifest || {}).생성시각 || '';
    var 백엔드 = window.RIW_BACKEND || '';

    if (!백엔드) {
      RiData.초기화().then(function () {
        전체다시그리기();
        토스트('최신 데이터를 다시 불러왔습니다. (서버 재수집은 아직 연결되지 않았습니다)');
        되돌리기();
      });
      return;
    }

    // Apps Script 는 preflight 를 처리하지 못하므로 단순 요청(text/plain)으로 보냅니다
    fetch(백엔드, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ fn: 'ristock_refresh' })
    })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, 사유: '연결실패' }; })
      .then(function (답) {
        if (답 && 답.ok) {
          if (버튼) 버튼.textContent = '만드는 중… 1~3분';
          토스트('브리핑을 다시 만들고 있습니다. 다 되면 화면이 저절로 바뀝니다.');
          브리핑갱신대기(이전시각, 되돌리기);
          return;
        }
        var 사유 = (답 && 답.사유) || '알 수 없음';
        RiData.초기화().then(function () {
          전체다시그리기();
          토스트(사유 === '잠시전실행'
            ? '방금 한 번 돌렸습니다. 3분 뒤에 다시 눌러 주세요.'
            : (사유 === '토큰없음'
              ? '서버 재수집이 아직 연결되지 않아 최신 데이터만 다시 불러왔습니다.'
              : '재수집 요청이 닿지 않아(' + 사유 + ') 최신 데이터만 다시 불러왔습니다.'));
          되돌리기();
        });
      });
  }

  /** 새 브리핑이 올라올 때까지 manifest 를 지켜봅니다 (최대 4분). */
  function 브리핑갱신대기(이전시각, 끝났을때) {
    var 시작 = Date.now();
    var 확인 = function () {
      if (Date.now() - 시작 > 4 * 60 * 1000) {
        토스트('아직 새 브리핑이 올라오지 않았습니다. 잠시 뒤 다시 눌러 주세요.');
        끝났을때();
        return;
      }
      RiData.초기화().then(function () {
        var 지금 = (RiData.상태.manifest || {}).생성시각 || '';
        if (지금 && 지금 !== 이전시각) {
          전체다시그리기();
          토스트('새 브리핑이 도착했습니다.');
          끝났을때();
          return;
        }
        setTimeout(확인, 15000);
      });
    };
    setTimeout(확인, 20000);       // 깃허브가 러너를 띄우는 데 20초쯤 걸립니다
  }

  /* -------------------------------------------------------------
   * 10. 이벤트 (위임 — 화면을 다시 그려도 핸들러가 살아 있습니다)
   * ----------------------------------------------------------- */
  function 클릭처리(e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;

    // 시트 바깥(어두운 배경)을 누르면 닫기
    if (!el && e.target && e.target.id === 'sheet-back') { 시트닫기(); return; }
    if (!el) return;

    var act = el.dataset.act;

    if (act === '탭') {
      // 이미 열려 있는 탭을 다시 누르면 그 탭의 첫 화면으로 돌아갑니다 (아이폰 탭바 관례).
      // 전략 상세를 보다가 '전략'을 다시 누르면 목록으로 나갑니다.
      if (화면.탭 === el.dataset.tab && el.dataset.tab === 'strategy') 화면.전략id = null;
      탭이동(el.dataset.tab);
      return;
    }

    if (act === '다시읽기') {
      el.disabled = true;
      el.textContent = '불러오는 중…';
      RiData.초기화().then(function () { 전체다시그리기(); });
      return;
    }

    if (act === '브리핑시작') { 브리핑다시받기(el); return; }

    if (act === '설치안내닫기') {
      RiData.설치안내닫기();
      브리핑그리기();
      토스트('안내를 닫았습니다. 언제든 사파리 공유 버튼으로 추가하실 수 있습니다.');
      return;
    }

    if (act === '섹터펼치기') {
      var k = el.dataset.sector;
      화면.펼친섹터[k] = !화면.펼친섹터[k];
      브리핑그리기();
      return;
    }

    if (act === '전략열기') { 화면.전략id = el.dataset.id; 전략그리기(); 해시쓰기(); window.scrollTo(0, 0); return; }
    if (act === '전략목록') { 화면.전략id = null; 전략그리기(); 해시쓰기(); window.scrollTo(0, 0); return; }
    if (act === '전략시장') { 화면.전략시장 = el.dataset.market; 전략상세그리기(); return; }
    if (act === '종목시장') { 화면.종목.시장 = el.dataset.market; 종목그리기(true); return; }
    if (act === '내전략시장') { 화면.내전략.시장 = el.dataset.market; 내전략상태저장(); 내전략결과그리기(); return; }

    if (act === '관심') {
      var 추가됨 = RiData.관심토글(el.dataset.market, el.dataset.ticker);
      토스트(추가됨 ? '관심종목에 담았습니다' : '관심종목에서 뺐습니다');
      // 화면 곳곳의 같은 종목 별표를 한꺼번에 갱신
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-act="관심"][data-ticker="' + el.dataset.ticker + '"]'),
        function (b) {
          if (b.dataset.market !== el.dataset.market) return;
          b.setAttribute('aria-pressed', 추가됨 ? 'true' : 'false');
          b.textContent = 추가됨 ? '★' : '☆';
        });
      if (화면.탭 === 'stocks') {
        // 목록에서 빠지거나 들어와야 하는 경우만 다시 그리고, 그 밖에는 그 줄의 ★ 만 고칩니다.
        if (화면.종목.관심만) 종목처음부터그리기();
        else 별표행갱신(el.dataset.market, el.dataset.ticker, 추가됨);
      }
      return;
    }

    if (act === '상세') { 상세열기(el.dataset.market, el.dataset.ticker); return; }
    if (act === '시트닫기') { 시트닫기(); return; }

    // 차트 구간(연·월·주·일) — 시트 전체가 아니라 그 카드만 갈아 끼웁니다.
    // 시트를 다시 그리면 보고 있던 위치가 맨 위로 튑니다.
    if (act === '차트구간') { 화면.차트구간 = el.dataset.range; 차트다시그리기(); return; }

    if (act === '관심만') {
      화면.종목.관심만 = !화면.종목.관심만;
      el.setAttribute('aria-pressed', 화면.종목.관심만 ? 'true' : 'false');
      el.textContent = 화면.종목.관심만 ? '★ 관심종목만' : '☆ 관심종목만';
      종목처음부터그리기();
      return;
    }

    if (act === '더보기') {
      화면.종목.표시수 += 더보기단위;
      종목더그리기();
      return;
    }

    if (act === '내필터') {
      var key = el.dataset.key;
      화면.내전략.필터[key] = !화면.내전략.필터[key];
      el.setAttribute('aria-pressed', 화면.내전략.필터[key] ? 'true' : 'false');
      내전략상태저장();
      내전략결과그리기();
      return;
    }

    if (act === '내전략저장') {
      var 입력 = document.getElementById('my-name');
      var 이름 = (입력 && 입력.value.trim()) || '';
      if (!이름) { 토스트('전략 이름을 먼저 적어 주세요'); if (입력) 입력.focus(); return; }
      RiData.내전략저장(이름, JSON.parse(JSON.stringify(화면.내전략.필터)), 화면.내전략.rank_by);
      화면.내전략.이름 = '';
      토스트('저장했습니다');
      내전략그리기(true);
      return;
    }

    if (act === '내전략불러오기') {
      var 찾음 = RiData.내전략목록().filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!찾음) return;
      화면.내전략.필터 = JSON.parse(JSON.stringify(찾음.filters || {}));
      화면.내전략.rank_by = 찾음.rank_by || '총점';
      내전략상태저장();
      토스트('“' + 찾음.name + '” 을 불러왔습니다');
      내전략그리기(true);
      window.scrollTo(0, 0);
      return;
    }

    if (act === '내전략삭제') {
      RiData.내전략삭제(el.dataset.id);
      토스트('삭제했습니다');
      내전략그리기(true);
      return;
    }

    if (act === '전략CSV') {
      var t = RiData.전략찾기(화면.전략id);
      if (!t) return;
      var 결과 = 화면.전략캐시[t.id] || 전략계산(t);
      var ok = RiExport.전략CSV(결과, t.name, (RiData.상태.manifest || {}).기준일);
      토스트(ok ? 'CSV 를 내려받았습니다' : '내려받기에 실패했습니다');
      return;
    }

    if (act === '내전략CSV') {
      var ok2 = RiExport.전략CSV(내전략계산(), '내전략', (RiData.상태.manifest || {}).기준일);
      토스트(ok2 ? 'CSV 를 내려받았습니다' : '내려받기에 실패했습니다');
      return;
    }

    if (act === '종목CSV') {
      var 목록 = 종목걸러내기();
      var ok3 = RiExport.종목CSV(목록, 화면.종목.시장, (RiData.상태.manifest || {}).기준일,
        화면.종목.시장 + (화면.종목.섹터 ? '_' + 화면.종목.섹터 : ''));
      토스트(ok3 ? 'CSV 를 내려받았습니다 (' + 목록.length + '종목)' : '내려받기에 실패했습니다');
      return;
    }
  }

  function 입력처리(e) {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'stock-search') { 화면.종목.검색 = t.value; 종목처음부터그리기(); return; }
    if (t.id === 'my-name') { 화면.내전략.이름 = t.value; return; }
  }

  function 변경처리(e) {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'stock-sector') { 화면.종목.섹터 = t.value; 종목처음부터그리기(); return; }
    if (t.id === 'stock-sort') { 화면.종목.정렬 = t.value; 종목처음부터그리기(); return; }
    if (t.id === 'my-rank') { 화면.내전략.rank_by = t.value; 내전략상태저장(); 내전략결과그리기(); return; }
  }

  /* -------------------------------------------------------------
   * 11. 시작
   * ----------------------------------------------------------- */
  function 시작() {
    탭목록.forEach(function (t) { 요소[t] = document.getElementById('view-' + t); });

    // 방문 횟수를 먼저 세어 둡니다. 홈 화면 추가 안내는 두 번째 방문부터 뜹니다
    // (첫 방문에 안내부터 들이밀면 데이터를 구경하기도 전에 성가십니다).
    RiData.방문기록();

    // 지난번에 켜 두었던 내 전략 조건을 되살립니다 (설계서 5장 "localStorage 저장").
    var 지난조건 = RiData.내전략상태();
    화면.내전략.필터 = 지난조건.필터;
    화면.내전략.rank_by = 지난조건.rank_by;
    화면.내전략.시장 = 지난조건.시장;

    document.addEventListener('click', 클릭처리);
    document.addEventListener('input', 입력처리);
    document.addEventListener('change', 변경처리);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') 시트닫기();
    });

    // 뒤로가기(안드로이드 하드웨어 버튼 포함)로 히스토리를 되짚을 때,
    // 시트가 덮여 있으면 **시트만** 닫고 보던 화면·스크롤은 그대로 둡니다.
    window.addEventListener('popstate', function () {
      if (!시트열림()) return;
      시트히스토리 = false;      // 방금 뒤로가기가 그 항목을 먹었습니다
      시트닫기(false);
    });

    window.addEventListener('hashchange', function () {
      if (화면._내가바꿈) { 화면._내가바꿈 = false; return; }
      var r = 해시읽기();
      if (!r) {
        // 우리가 모르는 해시(#다른곳 …)로 바뀌어도 덮여 있던 시트는 닫아야 합니다.
        // 안 닫으면 시트가 화면에 남고 배경 잠금이 안 풀려 스크롤이 통째로 죽습니다.
        if (시트열림()) 시트닫기(false);
        return;
      }
      화면.전략id = (r.탭 === 'strategy') ? r.인자 : null;
      탭이동(r.탭, false);
    });

    var 처음 = 해시읽기();
    if (처음) {
      화면.탭 = 처음.탭;
      화면.전략id = (처음.탭 === 'strategy') ? 처음.인자 : null;
    }

    RiData.초기화().then(function () {
      탭이동(화면.탭, true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', 시작);
  else 시작();
})();
