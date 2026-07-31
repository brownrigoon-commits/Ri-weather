/* 화면 문구 사전 (2026-07-31 신설) — 한·일 다국어의 뼈대
 * ============================================================
 * 쓰는 법:  tr("booking.title")            → "부킹/조인"
 *           tr("home.hello", { name: n })  → 사전 문구 안의 {name} 자리를 채운다
 *
 * ⚠️ 함수 이름이 왜 `t` 가 아니라 `tr` 인가
 *    이 저장소에는 `const t = ...` 같은 **지역변수 t 가 27곳** 있다(app.js 22 · clubfit 4 · stats 1).
 *    전역 `t()` 를 만들면 그 함수들 안에서 가려져(shadowing) 조용히 터진다. 그래서 `tr` 이다.
 *
 * ⚠️ 번역하면 안 되는 것 — '값'과 '라벨'은 다른 존재다
 *    아래는 화면에 보이더라도 **절대 사전으로 옮기지 않는다.** 옮기는 순간 조용히 깨진다:
 *      · 베타 의견 분류값 "오류/불편/아이디어/칭찬"  → 서버가 이 문자열로 검증한다(Code.gs)
 *      · 클럽 브랜드값 "타이틀리스트" 등             → 피팅 엔진이 이 문자열로 매칭한다
 *      · 프로필·동의 값 "여성", "60대 이상", "1년 미만" → 문자열 동치로 분기한다
 *      · 캐디 샷 라벨 "티샷/세컨샷/서드샷/그린"        → AI 응답을 이 라벨로 파싱한다
 *      · 통계 지역명, localStorage 에 저장되는 값      → 기존 이용자 기록·집계와 이어져 있다
 *    화면에 보여줄 때만 tr() 로 바꾸고, **보내고·저장하고·비교하는 값은 한국어 원문 그대로** 둔다.
 *    자세한 규칙은 docs/i18n_규칙.md.
 *
 * 사전 파일은 생성물이다 — `js/i18n/ko.js` 를 직접 고치지 말고
 * `js/i18n/src/*.json` 을 고친 뒤 `python tools/build_i18n.py` 로 다시 만든다.
 */
"use strict";

const I18N = {
  lang: "ko",
  dicts: {},

  /* 사전 조각을 등록한다 (생성된 ko.js·ja.js 가 부른다) */
  add: function (lang, obj) {
    if (!this.dicts[lang]) this.dicts[lang] = {};
    for (const k in obj) this.dicts[lang][k] = obj[k];
  },

  /* 지금 언어 → 없으면 한국어 → 그래도 없으면 키를 그대로.
     키가 그대로 화면에 나오면 눈에 확 띄고, sweep·스냅샷 게이트가 잡는다.
     (조용히 빈칸이 되는 것보다 시끄럽게 틀리는 편이 낫다) */
  get: function (key) {
    const d = this.dicts[this.lang];
    if (d && Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    const ko = this.dicts.ko;
    if (ko && Object.prototype.hasOwnProperty.call(ko, key)) return ko[key];
    return key;
  },

  /* 언어를 바꾸고 화면을 다시 그린다. Phase 3(일본어) 에서 설정 화면이 부른다. */
  setLang: function (lang) {
    if (lang !== "ko" && lang !== "ja") return;
    this.lang = lang;
    try { localStorage.setItem("riweather.lang", lang); } catch (_) {}
    document.documentElement.lang = lang;
  },

  /* 처음 켤 때 언어 결정: 저장된 설정 > 기기 언어 > 한국어 */
  init: function () {
    let saved = null;
    try { saved = localStorage.getItem("riweather.lang"); } catch (_) {}
    const dev = (navigator.language || "ko").toLowerCase();
    const lang = saved || (dev.indexOf("ja") === 0 ? "ja" : "ko");
    this.lang = (lang === "ja") ? "ja" : "ko";
    document.documentElement.lang = this.lang;
  },
};

/* 문구 하나 꺼내기. vars 를 주면 {이름} 자리를 채운다.
   숫자·구장명처럼 매번 달라지는 값은 문구에 박지 말고 반드시 vars 로 넘길 것 —
   그래야 일본어에서 어순이 달라도 같은 문구 하나로 감당된다. */
function tr(key, vars) {
  let s = I18N.get(key);
  if (vars && typeof s === "string") {
    for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
  }
  return s;
}

I18N.init();
