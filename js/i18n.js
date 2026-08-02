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

  /* 정적 마크업(index.html)에 사전을 입힌다.
     HTML 안에서는 tr() 을 부를 수 없으므로 요소에 표시를 달아 두고 여기서 채운다.
         <h2 data-i18n="ui.hub.title">코스공략</h2>
         <input data-i18n-attr="placeholder:ui.search.ph">
         <button data-i18n-attr="aria-label:ui.a11y.close">
     ⚠️ **한국어에서는 원래 있던 글자와 똑같은 글자로 다시 채워진다** — 화면은 변하지 않는다.
        HTML 에 원문을 그대로 남겨 두는 이유가 이것이다. 사전이 안 실리거나 자바스크립트가
        늦게 와도 화면이 비지 않는다(빈 화면보다 한국어가 낫다).
     ⚠️ 자식 요소가 있는 곳에는 data-i18n 을 달지 말 것 — textContent 로 덮으면 자식이 사라진다. */
  applyDom: function (root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (!k) return;
      const v = tr(k);
      if (v.indexOf("\n") < 0) { el.textContent = v; return; }
      /* 줄바꿈이 든 문구는 <br> 로 끊어 넣는다.
         문장을 "앞줄"·"뒷줄" 두 키로 쪼개면 안 된다 — 일본어는 어순이 달라
         "…검색하고 / 저장해 보세요" 를 줄 단위로 옮기면 문장이 깨진다.
         innerHTML 을 쓰지 않는 이유: 사전 값이 곧 HTML 이 되면 태그가 섞여 들어온다.
         여기서는 우리가 만든 <br> 만 넣으므로 그 위험이 없다. */
      el.textContent = "";
      v.split("\n").forEach((line, i) => {
        if (i) el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode(line));
      });
    });
    /* data-i18n-node — 자식 요소는 그대로 두고 **맨 글자 마디만** 갈아 끼운다.
           <div class="card-title"><span class="ic">🛰️</span> 강수 지도 <small id="radar-updated"></small></div>
       이런 자리가 index.html 에 74줄 있다(2026-08-03 실측). 여기엔
         · data-i18n 을 못 쓴다 — textContent 로 덮으면 <span>·<small> 이 통째로 사라진다.
         · <span> 으로 감싸는 것도 못 쓴다 — 부모가 flex 면 칸이 하나 늘어 배치가 어긋난다
           (이 앱 CSS 에 flex/grid 선택자가 79개다).
       그래서 글자 마디만 바꾼다. 요소가 그대로 남으므로 #radar-updated 같은 참조도 산다.
       앞뒤 빈칸은 원래 것을 지킨다 — "🛰️" 와 글자 사이가 붙어 버리면 안 된다.
       키가 여럿이면 '|' 로 나눠 **빈칸 아닌 글자 마디**와 앞에서부터 짝짓는다. */
    scope.querySelectorAll("[data-i18n-node]").forEach((el) => {
      const keys = el.getAttribute("data-i18n-node").split("|");
      let i = 0;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        const k = (keys[i++] || "").trim();
        if (!k) continue;
        const m = n.nodeValue.match(/^(\s*)[\s\S]*?(\s*)$/);
        n.nodeValue = m[1] + tr(k) + m[2];
      }
    });
    /* data-i18n-html — 안쪽을 통째로 갈아 끼운다(태그까지 사전 값에 들어 있다).
           <li>동의하시면 <b>거리·이동시간</b>이 자동으로 표시됩니다.</li>
       이런 문장은 마디로 쪼개면 안 된다 — "동의하시면"·"이 자동으로 표시됩니다" 를
       따로 옮기면 일본어 어순에서 말이 되지 않는다. 문장 하나를 한 덩이로 옮긴다.
       사전 값은 우리가 만든 파일이고 이용자 입력이 아니므로 innerHTML 로 넣어도 된다
       (js/app.js 가 이미 441개 문구를 같은 방식으로 쓰고 있다).
       ⚠️ 안쪽 요소가 새로 만들어진다 — id 를 붙들고 있는 자리에는 쓰지 않는다. */
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const k = el.getAttribute("data-i18n-html");
      if (k) el.innerHTML = tr(k);
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr").split(";").forEach((pair) => {
        const i = pair.indexOf(":");
        if (i < 0) return;
        const attr = pair.slice(0, i).trim();
        const key = pair.slice(i + 1).trim();
        if (attr && key) el.setAttribute(attr, tr(key));
      });
    });
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

/* 마크업이 다 올라온 뒤 한 번 입힌다. i18n.js 는 <head> 쪽에서 먼저 실리므로
   이 시점에는 아직 body 가 없다 — DOMContentLoaded 를 기다린다. */
document.addEventListener("DOMContentLoaded", function () { I18N.applyDom(); });

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
