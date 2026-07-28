/* ============================================================
 * Ri_Stock 백엔드 — Google Apps Script (주식 앱 전용)
 *
 * 하는 일은 딱 하나입니다.
 *   앱의 '브리핑 다시 받기' 버튼 → 깃허브 수집 워크플로를 brief 모드로 실행
 *
 * ⚠️ 골프라이프 백엔드와 **일부러 분리했습니다.**
 *    골프앱은 통계·백업·맛집 사진이 걸려 있는 훨씬 중요한 서비스입니다.
 *    주식 앱 기능을 거기에 얹으면, 주식 쪽을 고칠 때마다 골프 백엔드를 재배포해야 하고
 *    그때마다 골프 기능이 함께 위험해집니다. 서로 아무 상관 없는 두 앱이므로
 *    프로젝트도 따로 둡니다. 이쪽이 죽어도 골프앱은 아무 영향을 받지 않습니다.
 *
 * 설치법: docs/ristock_브리핑버튼_설치.md
 * ============================================================ */

var BACKEND_VER = "ristock-2026-07-29a";

/* 이 백엔드가 눌러 줄 깃허브 워크플로 */
var REPO = "brownrigoon-commits/Ri-weather";
var WORKFLOW = "ristock-daily.yml";

/* 남용 방지 — 한 번 누르면 이 시간 동안은 다시 받지 않습니다.
   (같은 회차가 겹쳐 돌면 서로 밀어내며 데이터가 반쪽이 됩니다) */
var 쿨다운초 = 180;

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 브리핑 다시 받기 ----------
 * 주식 앱은 깃허브 페이지에 올라간 정적 화면이라 폰에서 수집을 직접 못 돌립니다
 * (브라우저에서 야후·네이버를 부르는 것조차 CORS 로 막힙니다 — 2026-07-28 확인).
 * 그래서 이 백엔드가 대신 깃허브를 눌러 줍니다.
 *
 * 받는 것은 지수 시황 + 10개국 뉴스뿐입니다(18초~3분).
 * 종목 600개는 다시 받지 않으므로 전략·종목 화면은 그대로 유지됩니다.
 *
 * ⚠ 깃허브 토큰은 **코드에 적지 않습니다.**
 *   프로젝트 설정 → 스크립트 속성 에 `GITHUB_TOKEN` 으로 넣어 주세요.
 *   토큰이 없으면 앱에 그 사실을 그대로 돌려줍니다(거짓말하지 않습니다).
 */
function ristockRefresh_() {
  var 토큰 = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!토큰) {
    return json_({ ok: false, 사유: "토큰없음",
                   안내: "Apps Script 스크립트 속성에 GITHUB_TOKEN 을 넣어 주세요" });
  }

  var 캐시 = CacheService.getScriptCache();
  if (캐시.get("ristock_refresh")) {
    return json_({ ok: false, 사유: "잠시전실행", 남은초: 쿨다운초 });
  }

  var url = "https://api.github.com/repos/" + REPO +
            "/actions/workflows/" + WORKFLOW + "/dispatches";
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + 토큰,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    payload: JSON.stringify({ ref: "main", inputs: { mode: "brief" } }),
    muteHttpExceptions: true,
  });

  var 코드 = res.getResponseCode();
  if (코드 === 204) {                      // 깃허브는 성공하면 본문 없이 204 를 줍니다
    캐시.put("ristock_refresh", "1", 쿨다운초);
    return json_({ ok: true, 걸리는시간: "1~3분" });
  }
  return json_({ ok: false, 사유: "깃허브거부", 코드: 코드,
                 본문: String(res.getContentText()).slice(0, 200) });
}

/* 앱은 preflight 를 피하려고 text/plain 으로 보냅니다(Apps Script 가 preflight 를 못 받습니다) */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.fn === "ristock_refresh") return ristockRefresh_();
    return json_({ ok: false, 사유: "모르는요청" });
  } catch (err) {
    return json_({ ok: false, 사유: "오류", 내용: String(err).slice(0, 200) });
  }
}

/* 살아 있는지 확인용 — 주소를 브라우저로 열면 이 값이 보입니다 */
function doGet() {
  var 토큰있음 = !!PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  return json_({ ok: true, service: "ristock-backend", ver: BACKEND_VER, 토큰등록됨: 토큰있음 });
}
