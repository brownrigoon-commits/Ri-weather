/* 베타 의견 — 사용자 경로 검사 (브라우저에서 붙여 실행)
 *
 * 실제 화면의 버튼을 실제로 눌러서, 이용자가 보는 문구까지 확인한다.
 * 서버는 가짜로 물린다(운영 시트에 시험 글을 남기지 않기 위해).
 * 서버 쪽은 tools/verify_backend.js 가 따로 확인한다.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  let pass = 0, fail = 0;
  const ok = (c, what, detail) => {
    if (c) { pass++; out.push("  ✔ " + what); }
    else { fail++; out.push("  ✖ " + what + (detail ? "  → " + detail : "")); }
  };
  const $ = (id) => document.getElementById(id);
  const msg = () => ($("fb-msg").hidden ? "" : $("fb-msg").textContent);

  /* ── 가짜 서버 ── */
  const realFetch = window.fetch;
  let script = null, sent = [];
  window.fetch = function (url, opt) {
    const u = String(url);
    if (u.indexOf("script.google.com") >= 0 && opt && opt.method === "POST") {
      let body = {};
      try { body = JSON.parse(opt.body); } catch (_) {}
      if (body.fn === "feedback") {
        sent.push(body);
        if (script === "offline") return Promise.reject(new Error("오프라인"));
        if (script === "limit") return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false, err: "limit" }) });
        if (script === "oldbackend") return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false }) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, mailed: true }) });
      }
    }
    return realFetch.apply(window, arguments);
  };
  const reset = () => { sent = []; localStorage.removeItem("riweather.fbq"); };
  const q = () => { try { return JSON.parse(localStorage.getItem("riweather.fbq")) || []; } catch (_) { return []; } };
  const type = (t) => {
    const el = $("fb-text");
    el.value = t;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  try {
    out.push("\n■ 1. 들어가는 길 세 갈래");
    reset();
    $("fb-close").click();
    $("fb-open").click();
    ok(!$("fb-sheet").hidden, "홈의 '의견 보내기' 버튼으로 열린다");
    $("fb-close").click();
    ok($("fb-sheet").hidden, "닫기가 동작한다");
    $("fb-open-foot").click();
    ok(!$("fb-sheet").hidden, "푸터 '🧪 베타 의견' 으로 열린다");
    $("fb-close").click();
    document.querySelector(".beta-badge").click();
    ok(!$("fb-sheet").hidden, "BETA 배지를 눌러도 열린다");

    out.push("\n■ 2. 무엇이 함께 가는지 이용자에게 보여주는가");
    const note = $("fb-note").textContent;
    ok(/앱 v\d+/.test(note), "앱 버전을 알려준다", note.slice(0, 40));
    ok(/아이폰|안드로이드|PC/.test(note), "기기 종류를 알려준다");
    ok(/방금 있던 화면/.test(note), "어느 화면이었는지 알려준다");
    ok(/이름·전화번호·위치는 보내지 않습니다/.test(note), "안 보내는 것도 분명히 적혀 있다");

    out.push("\n■ 3. 일부러 고장 내기 — 빠뜨리고 보내기");
    $("fb-send").click();
    await sleep(60);
    ok(/하나 골라/.test(msg()), "분류를 안 고르면 짚어준다", msg());
    document.querySelector('#fb-cats [data-cat="오류"]').click();
    ok(document.querySelector('#fb-cats [data-cat="오류"]').classList.contains("on"), "고른 분류에 표시가 남는다");
    type("짧음");
    $("fb-send").click();
    await sleep(60);
    ok(/조금만 더/.test(msg()), "너무 짧으면 짚어준다", msg());
    ok(sent.length === 0, "여기까지 서버로 나간 것이 없다");

    out.push("\n■ 4. 제대로 보내기");
    reset();
    script = null;
    document.querySelector('#fb-stars [data-s="4"]').click();
    type("코스 공략에서 홀 그림이 늦게 떠요");
    $("fb-send").click();
    await sleep(200);
    ok(/고맙습니다/.test(msg()), "고맙다고 답한다", msg());
    ok(sent.length === 1, "서버로 한 번 나갔다");
    const b = sent[0] || {};
    ok(b.fn === "feedback" && b.cat === "오류" && b.stars === 4, "분류·별점이 실려 간다", JSON.stringify([b.cat, b.stars]));
    ok(b.text === "코스 공략에서 홀 그림이 늦게 떠요", "내용이 그대로 간다");
    ok(!!b.ver && !!b.dev && !!b.cid, "앱 버전·기기·기기ID 가 실린다", JSON.stringify([b.ver, b.dev]));
    ok(typeof b.screen === "string", "어느 화면이었는지 실린다", b.screen);
    ok(!/lat|lon|coord|위도|경도/i.test(JSON.stringify(b)), "좌표는 어디에도 실리지 않는다");
    ok(q().length === 0, "보냈으면 대기열은 비어 있다");
    await sleep(1900);
    ok($("fb-sheet").hidden, "잠시 뒤 저절로 닫힌다");

    out.push("\n■ 5. 일부러 고장 내기 — 하루 5건을 넘겼을 때");
    reset();
    script = "limit";
    $("fb-open").click();
    document.querySelector('#fb-cats [data-cat="불편"]').click();
    type("여섯 번째로 보내는 의견입니다");
    $("fb-send").click();
    await sleep(200);
    ok(/오늘은 여기까지/.test(msg()), "내일 다시 오라고 안내한다", msg());
    ok(q().length === 0, "서버가 분명히 거절한 것은 쌓아두지 않는다", "대기열=" + q().length);

    out.push("\n■ 6. 일부러 고장 내기 — 인터넷이 끊겼을 때");
    reset();
    script = "offline";
    type("비행기 모드에서 쓴 의견입니다");
    $("fb-send").click();
    await sleep(200);
    ok(/폰에 보관했습니다/.test(msg()), "사라진 게 아니라 보관했다고 말한다", msg());
    ok(q().length === 1, "대기열에 남아 있다", "대기열=" + q().length);
    ok(q()[0].text === "비행기 모드에서 쓴 의견입니다", "내용이 그대로 보관된다");

    out.push("\n■ 7. 다시 연결되면 저절로 보내지는가");
    script = null;
    sent = [];
    window.dispatchEvent(new Event("online"));
    await sleep(300);
    ok(sent.length === 1 && sent[0].text === "비행기 모드에서 쓴 의견입니다", "연결되자 보관분이 자동 전송된다", "보낸수=" + sent.length);
    ok(q().length === 0, "보내고 나면 대기열이 비워진다", "대기열=" + q().length);

    out.push("\n■ 8. 일부러 고장 내기 — 백엔드가 아직 옛 버전일 때");
    reset();
    script = "oldbackend";
    $("fb-open").click();
    document.querySelector('#fb-cats [data-cat="아이디어"]').click();
    type("백엔드 배포 전에 보낸 의견입니다");
    $("fb-send").click();
    await sleep(200);
    ok(/폰에 보관했습니다/.test(msg()), "이용자 탓으로 돌리지 않고 보관한다", msg());
    ok(q().length === 1, "재배포 뒤 자동으로 다시 보낼 수 있게 남는다");

    out.push("\n■ 9. 지역 통계 — 골프장을 열었을 때 무엇이 기록되나");
    {
      const realHit = STATS.hit, realGeo = window.reverseGeocode;
      const hits = [];
      STATS.hit = (ev, name, reg) => { hits.push([ev, name, reg]); };
      try {
        // (가) 주소를 이미 아는 골프장 — 바로 기록된다
        openHub({ id: "t1", name: "시험CC", addr: "경기도 파주시 법원읍", lat: 37.8, lon: 126.8, c: "KR" });
        await sleep(50);
        const a = hits.find((h) => h[1] === "시험CC");
        ok(!!a && a[0] === "course" && a[2] === "경기", "주소를 아는 곳은 시/도까지 함께 기록", JSON.stringify(a));

        // (나) 주소를 모르는 골프장 — 주소가 온 뒤에 기록한다(지역이 빈칸으로 새지 않게)
        hits.length = 0;
        let resolve;
        window.reverseGeocode = () => new Promise((r) => { resolve = r; });
        openHub({ id: "t2", name: "주소없는CC", lat: 33.4, lon: 126.5, c: "KR" });
        await sleep(50);
        ok(hits.length === 0, "주소를 모르면 아직 기록하지 않는다", JSON.stringify(hits));
        resolve("제주특별자치도 서귀포시");
        await sleep(80);
        ok(hits.length === 1 && hits[0][2] === "제주", "주소가 오면 그때 지역과 함께 기록", JSON.stringify(hits));

        // (다) 주소 조회가 실패해도 방문 자체는 세야 한다
        hits.length = 0;
        window.reverseGeocode = () => Promise.reject(new Error("주소 서버 없음"));
        openHub({ id: "t3", name: "주소실패CC", lat: 35, lon: 128, c: "KR" });
        await sleep(120);
        ok(hits.length === 1 && hits[0][1] === "주소실패CC" && hits[0][2] === "",
           "주소를 못 받아도 방문은 세되 지역만 비운다", JSON.stringify(hits));

        // (라) 좌표는 어떤 경로로도 나가지 않는다
        ok(!hits.some((h) => /\d{2}\.\d{3}/.test(String(h[2]))), "지역 칸에 좌표가 들어갈 수 없다");
      } finally {
        STATS.hit = realHit;
        window.reverseGeocode = realGeo;
      }
    }

    out.push("\n■ 10. 개발용 접속은 통계에 섞이지 않는가");
    {
      // 이 검사는 localhost 에서 돌아간다 — 여기서 보낸 것이 운영 통계에 쌓이면 안 된다
      const before = localStorage.getItem("riweather.statq");
      STATS.hit("feature", "이건_검사용_이라_쌓이면_안_됨");
      const after = localStorage.getItem("riweather.statq");
      ok(before === after, "localhost 에서는 통계를 만들지도 않는다",
         "전=" + String(before).slice(0, 30) + " 후=" + String(after).slice(0, 30));
      ok(/^(localhost|127\.0\.0\.1)$/.test(location.hostname), "(지금 검사 중인 곳이 localhost 가 맞다)", location.hostname);
    }

    out.push("\n■ 11. 뒷정리");
    reset();
    $("fb-close").click();
    ok(q().length === 0 && $("fb-sheet").hidden, "시험 흔적을 남기지 않는다");
  } catch (e) {
    fail++;
    out.push("  ✖ 검사 도중 오류: " + (e && e.message));
  } finally {
    window.fetch = realFetch;
    localStorage.removeItem("riweather.fbq");
  }

  out.push("");
  out.push(fail ? "✖ 실패 " + fail + "건 / 통과 " + pass + "건" : "✅ 전부 통과 (" + pass + "건)");
  return out.join("\n");
})()
