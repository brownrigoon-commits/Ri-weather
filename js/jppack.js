/* 일본 자료 꾸러미 — 필요할 때만 싣는다 (2026-08-02 신설)
 * ============================================================
 * 왜 따로 싣나
 *   js/holeimgdb_jp.js 2.4MB · js/holestats_jp.js 2.6MB — 합쳐서 5MB 다.
 *   앱을 켤 때마다 받으면 한국 이용자는 쓰지도 않을 5MB 를 매번 받는다.
 *   그래서 **일본 구장을 실제로 열 때**만 받는다. 한 번 받으면 그 세션 동안 다시 안 받는다.
 *
 * 여기서 하는 일
 *   1. 꾸러미 지연 로드 (holeimgdb_jp · holestats_jp · holeimgdb_ja)
 *   2. 홀별 실전 통계 카드 그리기 (스코어대 5벌 중 하나)
 *   3. 내 평균 타수에 맞는 스코어대 **자동 선택** (설계문서 §2-8-1)
 *   4. 한국 구장 TIP 의 일본어 오버레이 (lang=ja 일 때만)
 *   5. 일본 구장 주변 맛집 (Google Places New — 설계 §3)
 *
 * ⚠️ 못 받아도 화면이 비지 않게 한다 — 통계는 '있으면 더 좋은 것'이지 성립 조건이 아니다.
 *    받기 실패는 조용히 넘어가고 홀맵만 보여준다.
 */
"use strict";

const JPPACK = {
  _loading: {},

  /* 파일 하나를 한 번만 싣는다. → 성공하면 true, 실패해도 false 로 끝난다(던지지 않는다)
     ⚠️ 있는지 판정은 **함수로 받는다.** 생성물들이 `const HOLEIMG_DB_JP = …` 로 선언돼 있는데
        const 전역은 window 에 붙지 않는다 — `window[이름]` 으로 보면 실려 있어도 늘 '없음'이다.
        (처음엔 그렇게 짰다가 로더가 항상 실패를 돌려주는 것을 배선 검증에서 잡았다) */
  _load: function (file, has) {
    if (has()) return Promise.resolve(true);
    if (this._loading[file]) return this._loading[file];
    this._loading[file] = new Promise(function (resolve) {
      const s = document.createElement("script");
      s.src = "js/" + file + ".js";
      s.onload = function () { resolve(has()); };
      s.onerror = function () { resolve(false); };   // 없으면 없는 대로
      document.head.appendChild(s);
    });
    return this._loading[file];
  },

  /* 이 구장을 그리기 전에 필요한 꾸러미를 갖춘다.
     ⚠️ 반드시 await 할 것 — 안 기다리면 첫 진입에서만 자료가 없는 것처럼 보인다. */
  need: async function (course) {
    const jobs = [];
    if (course && course.c === "JP") {
      jobs.push(this._load("holeimgdb_jp", () => typeof HOLEIMG_DB_JP !== "undefined"));
      jobs.push(this._load("holestats_jp", () => typeof HOLESTATS_JP !== "undefined"));
      jobs.push(this._load("holetext_jp", () => typeof HOLETEXT_JP !== "undefined"));
    } else if (typeof I18N !== "undefined" && I18N.lang === "ja") {
      // 일본인이 한국 구장을 볼 때 — 한국 TIP 의 일본어판
      jobs.push(this._load("holeimgdb_ja", () => typeof HOLETIP_JA !== "undefined"));
    }
    await Promise.all(jobs);
  },

  /* 🔴 화면이 부르는 이름 → 자료가 쓰는 이름
     검색으로 들어오면 course.name 이 **한글 별칭**이다("G8후지 CC").
     그런데 우리 자료는 전부 일본어 원문("G8富士カントリークラブ")으로 키를 잡는다.
     golfdb 의 일본 구장 2,014곳 중 **1,911곳**이 별칭과 원문이 다르다 —
     맞춰 주지 않으면 화면은 거의 전부 "홀별 공략 준비 중" 이 된다.

     ⚠️ 이건 배포본을 **검색창부터 눌러 보고** 잡았다. 프로그램으로 원문 이름을 넣어
        열면 멀쩡히 보이기 때문에, 그 방식으로만 확인하면 끝까지 모른다.

     ⚠️ 별칭 하나에 원문이 **여럿일 수 있다.** golfdb 에 '스소노 CC' 가 두 곳이다
        (裾野カンツリー倶楽部 / 裾野カントリークラブ). 하나로 덮으면 나머지는 영영 안 보인다 —
        실제로 그렇게 한 곳이 사라졌고 관문(check_applink_jp)이 찾아냈다.
        그래서 후보를 모두 들고 있다가 자료가 있는 쪽을 쓴다. */
  _alias: null,
  origNames: function (name) {
    if (typeof GOLF_DB === "undefined") return [name];
    if (!this._alias) {
      this._alias = {};
      for (const g of GOLF_DB) {
        if (g.c !== "JP" || !g.k || g.k === g.n) continue;
        (this._alias[g.k] = this._alias[g.k] || []).push(g.n);
      }
    }
    return [name].concat(this._alias[name] || []);
  },

  _pick: function (db, name) {
    if (!db) return null;
    for (const n of this.origNames(name)) {
      if (db[n]) return db[n];
    }
    return null;
  },

  imgdb: function (name) {
    return typeof HOLEIMG_DB_JP === "undefined" ? null : this._pick(HOLEIMG_DB_JP, name);
  },

  stats: function (name) {
    return typeof HOLESTATS_JP === "undefined" ? null : this._pick(HOLESTATS_JP, name);
  },

  /* 🔴 우리 문장에는 '공식' 딱지를 붙이지 않는다.
     이 줄은 구장이 쓴 글이 아니라 じゃらん 공개 통계와 사실 토큰에서 우리가 끌어낸 요약이다.
     '⛳ 공식 코스공략 TIP' 아래에 넣었더니 구장이 하지도 않은 말이 공식이 됐다 —
     배선 검증에서 화면을 보고 잡았다. 출처를 속이는 것은 틀린 숫자보다 나쁘다. */
  textLabel: function () {
    return this._ja() ? "📊 記録から見たこのホール<br>" : "📊 기록으로 본 이 홀<br>";
  },

  /* 홀별 한 줄 공략 — 지어낸 문장이 아니라 통계·사실 토큰에서 끌어낸 말이다
     (tools/jp/gen_hole_text.py, 관문 check_holetext_jp.py 가 자료로 되짚는다).
     할 말이 없는 홀은 빈 문자열이고, 그러면 이 줄을 아예 그리지 않는다. */
  text: function (name, holeIdx) {
    if (typeof HOLETEXT_JP === "undefined") return "";
    const list = this._pick(HOLETEXT_JP, name);
    const it = list && list[holeIdx];
    if (!it) return "";
    return (this._ja() ? it.j : it.k) || "";
  },

  /* 한국 구장 TIP 의 일본어판. 없으면 null → 부르는 쪽이 한국어 원문을 그대로 쓴다.
     (어색한 기계 번역보다 원문이 낫다 — 설계 D6) */
  tipJa: function (courseName, cname, no) {
    if (typeof I18N === "undefined" || I18N.lang !== "ja") return null;
    if (typeof HOLETIP_JA === "undefined") return null;
    const c = HOLETIP_JA[courseName];
    if (!c) return null;
    const list = c[cname] || c[""] || null;
    return (list && list[String(no)]) || null;
  },

  /* ───────── 스코어대 ───────── */
  BAND_KO: ["전체", "79타 이하", "80~99타", "100~119타", "120타~"],
  BAND_JA: ["全スコア", "～79", "80～99", "100～119", "120～"],
  FIELD_KO: ["난이도", "평균 스코어", "평균 퍼트", "버디율", "파온율", "FW 안착", "벙커율", "OB율"],
  FIELD_JA: ["難易度", "平均スコア", "平均パット", "バーディ率", "パーオン率",
             "FWキープ率", "バンカー率", "OB率"],
  SUF_KO: ["", "타", "개", "%", "%", "%", "%", "%"],
  SUF_JA: ["", "打", "", "%", "%", "%", "%", "%"],

  _ja: function () { return typeof I18N !== "undefined" && I18N.lang === "ja"; },
  bands: function () { return this._ja() ? this.BAND_JA : this.BAND_KO; },
  fields: function () { return this._ja() ? this.FIELD_JA : this.FIELD_KO; },
  sufs: function () { return this._ja() ? this.SUF_JA : this.SUF_KO; },

  /* 내 평균 타수 → 처음 열리는 스코어대 (설계문서 §2-8-1)
     기록이 없으면 0(전체). 값이 없는 밴드면 부르는 쪽이 말없이 전체로 내린다. */
  autoBand: function () {
    let avg = null;
    try {
      const recs = (typeof loadScores === "function" ? loadScores() : [])
        .filter((r) => r && r.score > 50 && r.score < 160).slice(0, 10);
      if (recs.length >= 3)
        avg = Math.round(recs.reduce((a, r) => a + r.score, 0) / recs.length);
    } catch (_) {}
    if (avg === null && typeof loadProfile === "function") {
      // 프로필의 평균타수 칩("90대" 같은 값) — 기록이 아직 없는 이용자
      const a = (loadProfile() || {}).avg || "";
      if (/^7/.test(a)) avg = 79; else if (/^8/.test(a)) avg = 85;
      else if (/^9/.test(a)) avg = 95; else if (/^1[01]/.test(a)) avg = 105;
    }
    if (avg === null) return 0;
    if (avg <= 79) return 1;
    if (avg <= 99) return 2;
    if (avg <= 119) return 3;
    return 4;
  },

  /* 이 홀·이 스코어대에 값이 있나 — 없으면 전체(0)로 내리기 위해 쓴다 */
  _has: function (st, holeIdx, band) {
    const h = st && st.h && st.h[holeIdx];
    const v = h && h[band];
    return !!(v && v.some((x) => x !== null && x !== undefined));
  },

  /* 통계 카드 HTML. 자료가 없으면 빈 문자열 → 부르는 쪽이 영역을 감춘다.
     ⚠️ null 은 '0' 이 아니라 '자료 없음' 이다. 그 줄은 아예 빼야 한다.
        0% 로 보이면 이용자가 "벙커에 절대 안 빠지는 홀"로 읽는다. */
  statHtml: function (courseName, holeIdx, band) {
    const st = this.stats(courseName);
    if (!st || !st.h || !st.h[holeIdx]) return "";
    let use = band;
    if (!this._has(st, holeIdx, use)) use = 0;        // 말없이 전체로 내린다
    const v = st.h[holeIdx][use];
    if (!v) return "";
    const F = this.fields(), S = this.sufs(), nH = st.h.length;
    let rows = "";
    for (let i = 0; i < F.length; i++) {
      const x = v[i];
      if (x === null || x === undefined) continue;    // 자료 없음 — 줄을 뺀다
      const val = i === 0 ? (this._ja() ? x + "位/" + nH : x + "위/" + nH) : x + S[i];
      rows += '<div class="jps-row"><span>' + F[i] + "</span><b>" + val + "</b></div>";
    }
    if (!rows) return "";
    const src = (this._ja() ? "出典 " : "출처 ") + (st.s || "") + " " + (st.d || "");
    return '<div class="jps">' + rows + '</div><div class="jps-src">' + src + "</div>";
  },

  /* 스코어대 고르는 단추들 */
  bandHtml: function (band) {
    const label = this._ja() ? "スコア帯" : "스코어대";
    let b = '<div class="jps-band"><span class="jps-band-t">' + label + "</span>";
    this.bands().forEach(function (name, i) {
      b += '<button type="button" class="jps-band-b' + (i === band ? " on" : "") +
           '" data-band="' + i + '">' + name + "</button>";
    });
    return b + "</div>";
  },

  /* ───────── 일본 구장 주변 맛집 (Google Places New · 설계 §3) ─────────
     🔴 이 키는 브라우저에 노출되는 것이 전제다. 보호 장치는 비밀이 아니라
        ① 리퍼러 제한 brownrigoon-commits.github.io/*  ② Places API 전용 제한 이다.
        그래서 localhost 에서는 동작하지 않는다 — 검증은 반드시 배포본에서 한다.
     🔴 결과를 저장하지 않는다. Places 약관상 place 정보는 캐시 금지다
        (placeId 만 예외). 한국 경로의 localStorage 7일 캐시를 여기 끌어오지 말 것. */
  PLACES_KEY_B64: "QUl6YVN5QW9SczJFRkFQQ3l1RVZPMnhhbWRWcmtkZWZsSVI3T3JR",
  _pkey: function () {
    try { return atob(this.PLACES_KEY_B64); } catch (_) { return ""; }
  },

  /* 필드마스크가 과금 등급을 정한다 — 함부로 늘리지 말 것(설계 §3-2). */
  FIELDS: ["places.displayName", "places.rating", "places.userRatingCount",
           "places.formattedAddress", "places.location", "places.photos",
           "places.googleMapsUri", "places.primaryTypeDisplayName"].join(","),

  _nearby: async function (lat, lon, radius) {
    const r = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this._pkey(),
        "X-Goog-FieldMask": this.FIELDS,
      },
      body: JSON.stringify({
        includedTypes: ["restaurant"],
        maxResultCount: 10,                       // 비용 통제 — 늘리지 말 것
        languageCode: typeof I18N !== "undefined" ? I18N.lang : "ko",
        locationRestriction: { circle: {
          center: { latitude: lat, longitude: lon }, radius: radius } },
      }),
    });
    if (!r.ok) throw new Error("places HTTP " + r.status);
    return (await r.json()).places || [];
  },

  /* → 맛집 화면이 그대로 먹는 정규형 목록. 실패하면 던진다(부르는 쪽이 안내한다). */
  food: async function (course) {
    let places = await this._nearby(course.lat, course.lon, 5000);
    // 산속 구장은 5km 에 없을 수 있다. Places 는 반경 상한이 넉넉해 한 번 더 넓히면 된다
    // (라쿠텐 숙박의 3km 하드리밋과 다르다 — 그래서 링을 깔 필요가 없다).
    if (!places.length) places = await this._nearby(course.lat, course.lon, 10000);

    const R = 6371000, rad = (x) => x * Math.PI / 180;
    return places.map((p) => {
      const la = p.location && p.location.latitude, lo = p.location && p.location.longitude;
      const h = Math.sin(rad(la - course.lat) / 2) ** 2 +
                Math.cos(rad(course.lat)) * Math.cos(rad(la)) *
                Math.sin(rad(lo - course.lon) / 2) ** 2;
      return {
        jp: true,                                  // 카드가 내비 단추를 구글맵으로 바꾸는 표시
        name: (p.displayName && p.displayName.text) || "",
        cat: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || "",
        addr: p.formattedAddress || "",
        lat: la, lon: lo,
        dist: Math.round(2 * R * Math.asin(Math.sqrt(h))),
        rating: p.rating || 0,
        reviews: p.userRatingCount || 0,
        mapUri: p.googleMapsUri || "",
        // 사진은 '주소'만 들고 있다가 **눌렀을 때** 받는다 — 사진 호출은 건당 과금이다.
        photoName: (p.photos && p.photos[0] && p.photos[0].name) || "",
        photoCount: (p.photos || []).length,
        attrib: (p.photos && p.photos[0] && p.photos[0].authorAttributions &&
                 p.photos[0].authorAttributions[0] &&
                 p.photos[0].authorAttributions[0].displayName) || "",
      };
    }).filter((x) => x.name && x.lat != null);
  },

  photoUrl: function (name, px) {
    return "https://places.googleapis.com/v1/" + name +
           "/media?maxWidthPx=" + (px || 400) + "&key=" + encodeURIComponent(this._pkey());
  },

  /* 화면 아래에 붙일 출처 문구 — 표기 의무이자, 어디서 온 자료인지 밝히는 우리 원칙 */
  foodCredit: function () {
    return this._ja() ? "飲食店情報: Google" : "맛집 정보: Google";
  },

  /* 목록 위 안내문. 한국판 문구("카카오맵 평점 기준")를 그대로 쓰면 거짓말이 된다. */
  foodSub: function (sort) {
    if (this._ja())
      return sort === "reco" ? "Google の評価・口コミ数による おすすめ順"
                             : "ゴルフ場からの距離順";
    return sort === "reco" ? "구글 평점·리뷰 수 기준 추천순 · 사진은 눌렀을 때 받아옵니다"
                           : "골프장에서 가까운 순";
  },
};
