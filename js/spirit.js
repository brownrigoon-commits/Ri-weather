/* 골프 정신 — 매너 · 세계 골프 룰 · 오늘의 한마디
 *
 * 설계: docs/골프정신_설계.md (2026-07-31)
 * 콘텐츠는 js/spiritdb.js (SPIRIT_DB · QUOTES_DB)
 *
 * 서버를 쓰지 않는다. 명언은 날짜로 계산하므로 앱을 여는 것만으로 매일 바뀌고,
 * 자동 업데이트가 죽어도 명언은 계속 바뀐다. 개인정보는 아무것도 수집·전송하지 않는다.
 */
"use strict";

/* 시작 탭은 **맨 앞 섹션**을 따라간다 — 탭 순서를 바꿔도 저절로 맞는다.
   (탭을 재배치하면서 여기를 "mind" 로 놔둬 '공식 룰'을 앞으로 뺀 의미가 없어진 적이 있다) */
const SPIRIT_VIEW = {
  tab: (typeof SPIRIT_DB !== "undefined" && SPIRIT_DB.sections[0].key) || "rules",
  checked: null,                                      // 최근 점검일(스냅샷에서 읽음)
};

const QUOTE_KEY = "riweather.quote";                  // "on" | "off" | 없음(아직 안 물어봄)

const spQ = (sel) => document.querySelector(sel);
const spEsc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── 오늘의 한마디 ─────────────────────────────────────────────
   같은 날에는 모두 같은 명언을 본다(라운드 대화 소재가 되는 부수 효과).
   서버가 필요 없고, 기기 시계만 맞으면 자정에 자연히 바뀐다. */
function todayQuote(when) {
  const now = when || new Date();
  const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);  // 1~366
  return QUOTES_DB[day % QUOTES_DB.length];
}

/* 이름 끝 글자의 받침에 따라 '이/가' 를 고른다.
   ("박세리이 남긴" 처럼 나오면 읽는 사람이 먼저 어색함을 느낀다) */
function josaIGa(name) {
  const c = String(name || "").charCodeAt(String(name).length - 1);
  const hasBatchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return hasBatchim ? "이" : "가";
}

/* 출처가 확실하지 않으면 단정하지 않는다 — "전해지는 말"로 적는다 */
function quoteWho(q) {
  return q.sure ? q.who : q.who + josaIGa(q.who) + " 남긴 것으로 전해지는 말";
}

function quotePref() {
  try { return localStorage.getItem(QUOTE_KEY) || ""; } catch (_) { return ""; }
}
function setQuotePref(v) {
  try {
    if (v) localStorage.setItem(QUOTE_KEY, v);
    else localStorage.removeItem(QUOTE_KEY);
  } catch (_) {}
  if (typeof STATS !== "undefined") STATS.hit("feature", v === "on" ? "spirit_quote_on" : "spirit_quote_off");
}

/* ── 홈 화면 카드 ──────────────────────────────────────────────
   승락(on)한 분에게만 매일 보여준다. 아직 안 물어본 분에게는 안내 카드를 띄운다.
   ⚠️ 여기서 "보내드립니다" 같은 문구를 쓰지 않는다 — 푸시 알림은 지금 불가능하다. */
function renderQuoteCard() {
  const el = spQ("#quote-card");
  if (!el) return;
  const pref = quotePref();

  /* 약관 동의 전에는 아무것도 띄우지 않는다 — 동의 화면이 먼저다.
     get() 이 아니라 done() 을 쓴다: 옛 판번호로 동의한 기록이 남아 있으면
     get() 은 참이지만 실제로는 재동의를 받아야 하는 상태다. */
  let agreed = true;
  try { agreed = !(typeof CONSENT !== "undefined" && !CONSENT.done()); } catch (_) {}
  if (!agreed) { el.hidden = true; el.innerHTML = ""; return; }

  if (!pref) {                       // 아직 안 물어봄 → 승락 요청 카드 1회
    el.hidden = false;
    el.innerHTML =
      '<div class="sp-ask">' +
      '<div class="sp-ask-t">⛳ 매일 한 문장, 받아보시겠어요?</div>' +
      '<div class="sp-ask-d">세계 명선수들이 남긴 짧은 말과 조언을 홈 화면에 하루 하나씩 보여드립니다.</div>' +
      '<div class="sp-ask-btns">' +
      '<button class="sp-btn on" data-q="on">좋아요</button>' +
      '<button class="sp-btn" data-q="off">괜찮아요</button>' +
      "</div></div>";
    return;
  }
  if (pref !== "on") { el.hidden = true; el.innerHTML = ""; return; }

  const q = todayQuote();
  el.hidden = false;
  el.innerHTML =
    '<div class="sp-home" role="button" tabindex="0">' +
    '<button class="sp-home-x" data-q="off" aria-label="오늘의 한마디 끄기">&times;</button>' +
    '<div class="sp-home-h">⛳ 오늘의 한마디</div>' +
    '<div class="sp-home-q">' + spEsc(q.ko) + "</div>" +
    '<div class="sp-home-w">— ' + spEsc(quoteWho(q)) + "</div>" +
    (q.tip ? '<div class="sp-home-t">' + spEsc(q.tip) + "</div>" : "") +
    "</div>";
}

/* 홈 카드의 버튼들 — 카드를 다시 그려도 살아 있도록 컨테이너에 한 번만 건다 */
function bindQuoteCard() {
  const el = spQ("#quote-card");
  if (!el || el.dataset.bound) return;
  el.dataset.bound = "1";
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (b) {
      e.stopPropagation();
      setQuotePref(b.dataset.q);
      renderQuoteCard();
      return;
    }
    if (e.target.closest(".sp-home")) openSpiritView();
  });
}

/* ── 골프 정신 화면 ────────────────────────────────────────────── */
function paintSpirit() {
  const body = spQ("#spirit-body");
  if (!body || typeof SPIRIT_DB === "undefined") return;

  const q = todayQuote();
  const on = quotePref() === "on";

  // 오늘의 한마디 카드
  let html =
    '<div class="sp-quote">' +
    '<div class="sp-q-h">⛳ 오늘의 한마디</div>' +
    '<div class="sp-q-ko">' + spEsc(q.ko) + "</div>" +
    '<div class="sp-q-who">— ' + spEsc(quoteWho(q)) + "</div>" +
    (q.tip ? '<div class="sp-q-tip">' + spEsc(q.tip) + "</div>" : "") +
    '<button class="sp-toggle' + (on ? " on" : "") + '" id="sp-toggle">' +
    '<span class="sp-tg-t">홈에서도 매일 보기</span>' +
    '<span class="sp-tg-s">' + (on ? "켜짐" : "꺼짐") + "</span></button>" +
    "</div>";

  // 탭
  html += '<div class="sp-tabs">' +
    SPIRIT_DB.sections.map((s) =>
      '<button class="sp-tab' + (s.key === SPIRIT_VIEW.tab ? " on" : "") +
      '" data-tab="' + s.key + '">' + spEsc(s.title) + "</button>").join("") +
    "</div>";

  const sec = SPIRIT_DB.sections.find((s) => s.key === SPIRIT_VIEW.tab) || SPIRIT_DB.sections[0];

  if (sec.intro) html += '<p class="sp-intro">' + spEsc(sec.intro) + "</p>";

  // 룰 탭이 대개정 반영 중이면 먼저 알린다
  if (sec.key === "rules" && SPIRIT_DB.rulesNotice)
    html += '<p class="sp-notice">' + spEsc(SPIRIT_DB.rulesNotice) + "</p>";

  /* 카드
     · g(소그룹)가 바뀔 때마다 소제목을 굵게 넣는다 (동반자 배려 탭)
     · num 섹션(공식 룰·동호회 룰)은 번호를 붙인다 — "공식 4번"처럼 서로 가리킬 수 있어야
       두 탭을 오가며 비교가 된다 (사장님 지시 2026-07-31) */
  let lastG = null;
  html += '<div class="sp-list">';
  sec.items.forEach((it, i) => {
    if (it.g && it.g !== lastG) {
      html += '<h3 class="sp-group">' + spEsc(it.g) + "</h3>";
      lastG = it.g;
    }
    html += '<div class="sp-item">' +
      '<div class="sp-t">' +
      (sec.num ? '<span class="sp-no">' + (i + 1) + "</span>" : "") +
      spEsc(it.t) + "</div>" +
      '<div class="sp-d">' + spEsc(it.d) + "</div>" +
      (it.see ? '<button class="sp-see" data-see="' + it.see + '">공식 룰 ' + it.see +
                "번과 비교해 보기</button>" : "") +
      (it.ref ? '<div class="sp-ref">' + spEsc(it.ref) + "</div>" : "") +
      "</div>";
  });
  html += "</div>";

  // 공식 룰 탭 맨 아래 — 출처와 신선도를 밝힌다
  if (sec.key === "rules") {
    html += '<div class="sp-foot">' +
      "<p>이 코너는 R&amp;A·USGA " + spEsc(SPIRIT_DB.rulesEdition) +
      "년판 규칙을 우리말로 풀어 쓴 요약입니다. 대회나 분쟁에서는 공식 규칙이 우선합니다.</p>" +
      "<p>최근 점검 " + spEsc(SPIRIT_VIEW.checked || "확인 중") +
      " · 내용 반영 " + spEsc(SPIRIT_DB.updated) + "</p>" +
      '<a class="sp-link" href="' + spEsc(SPIRIT_DB.rulesLink) +
      '" target="_blank" rel="noopener">공식 규칙 보기 (대한골프협회)</a></div>';
  }
  // 동호회 룰 탭 — 규칙이 아니라는 것을 화면 안에서도 못 박는다
  if (sec.key === "club") {
    html += '<div class="sp-foot">' +
      "<p>여기 있는 것은 <b>공식 규칙이 아니라 모임의 약속</b>입니다. " +
      "대회나 공식 경기에서는 왼쪽 '공식 룰' 탭이 기준입니다.</p>" +
      "<p>모임마다 다르니, 그날 함께 치는 분들과 시작 전에 맞춰 보세요.</p></div>";
  }

  body.innerHTML = html;

  // 리스너 재바인딩 (그릴 때마다)
  body.querySelectorAll(".sp-tab").forEach((b) => {
    b.addEventListener("click", () => {
      SPIRIT_VIEW.tab = b.dataset.tab;
      if (typeof STATS !== "undefined") STATS.hit("feature", "spirit_tab_" + b.dataset.tab);
      paintSpirit();
      const sc = spQ("#spirit-view");
      if (sc) sc.scrollTop = 0;
    });
  });
  /* "공식 룰 n번과 비교해 보기" — 공식 룰 탭으로 건너가 그 카드를 잠깐 강조한다.
     탭만 바꾸고 끝내면 27장 중 어느 것인지 스스로 찾아야 해서 비교가 되지 않는다. */
  body.querySelectorAll(".sp-see").forEach((b) => {
    b.addEventListener("click", () => {
      const no = parseInt(b.dataset.see, 10);
      SPIRIT_VIEW.tab = "rules";
      if (typeof STATS !== "undefined") STATS.hit("feature", "spirit_compare");
      paintSpirit();
      const target = body.querySelectorAll(".sp-item")[no - 1];
      if (target) {
        target.classList.add("focus");
        target.scrollIntoView({ block: "center" });
      }
    });
  });

  const tg = spQ("#sp-toggle");
  if (tg) tg.addEventListener("click", () => {
    setQuotePref(quotePref() === "on" ? "off" : "on");
    paintSpirit();
    renderQuoteCard();
  });
}

/* 최근 점검일 — tools/check_golfrules.py 가 매월 갱신하는 스냅샷에서 읽는다.
   못 읽어도 화면은 그대로 뜬다(내용 반영일만 보인다). */
async function loadRulesChecked() {
  if (SPIRIT_VIEW.checked) return;
  try {
    const r = await fetch("coursedata/workfiles/golfrules_snapshot.json?v=" + Date.now());
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.lastChecked) { SPIRIT_VIEW.checked = String(j.lastChecked).slice(0, 10); paintSpirit(); }
  } catch (_) { /* 점검일을 못 읽어도 룰 내용은 그대로 보여준다 */ }
}

function openSpiritView() {
  if (viewStack[viewStack.length - 1] !== "spirit") pushView("spirit");
  paintSpirit();
  loadRulesChecked();
}

window.openSpiritView = openSpiritView;
window.renderQuoteCard = renderQuoteCard;

bindQuoteCard();

/* 첫 화면을 한 번 그린다.
   ⚠️ app.js 의 renderHome() 은 앱이 뜰 때 **이 파일보다 먼저** 한 번 돈다(script 순서).
      그때는 renderQuoteCard 가 아직 없어 typeof 가드에 걸려 그냥 지나간다.
      그래서 여기서 한 번 불러 줘야 새로고침 직후에도 카드가 보인다.
      (이후 저장 구장을 바꿔 renderHome 이 다시 돌 때는 app.js 쪽 호출이 맡는다) */
renderQuoteCard();
