/* 일본 자료가 화면에서 실제로 닿는가 — **앱 코드를 그대로 돌려서** 확인한다
 * (2026-08-02 신설)
 *
 * 🔴 왜 파이썬이 아니라 여기서 하나
 *    처음엔 파이썬으로 같은 규칙을 다시 짜서 검사했다. 그런데 이번에 난 사고는
 *    **자료가 아니라 앱 코드(js/jppack.js)** 에 있었다 — 자료는 멀쩡했고,
 *    앱이 한글 별칭("G8후지 CC")을 일본어 원문으로 풀지 못해 2,014곳 중
 *    1,911곳이 "홀별 공략 준비 중" 으로 떴다.
 *    규칙을 다시 짠 검사는 **앱이 틀려도 자기는 맞으니까 통과**라고 말한다.
 *    그래서 여기서는 js/jppack.js 를 진짜로 불러서 JPPACK.imgdb() 를 호출한다.
 *    앱이 고장 나면 이 관문이 같이 고장 난다 — 그게 목적이다.
 *
 * 보는 것
 *   1. golfdb 의 일본 구장 이름(=화면이 쓰는 이름)으로 JPPACK 을 불러 자료가 나오나
 *   2. 아무 구장에서도 안 나오는 자료가 있나 (있으면 영원히 안 보인다)
 *   3. 홀맵 없이 통계·공략만 있는 구장이 있나 (붙을 자리가 없다)
 *
 * 사용: node tools/jp/check_applink_jp.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const load = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// 앱이 쓰는 파일을 그대로 평가한다 (const 전역이므로 한 스코프에 모아 넣는다)
const sandbox = {};
const files = ["js/golfdb.js", "js/holeimgdb_jp.js", "js/holestats_jp.js",
               "js/holetext_jp.js", "js/jppack.js"];
for (const f of files) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.log(`✖ ${f} 가 없습니다`);
    process.exit(1);
  }
}
// staydb_jp.js 는 배치가 끝나야 생긴다 — 없으면 그 항목만 건너뛴다(관문 자체는 돌아야 한다)
const STAY_FILE = "js/staydb_jp.js";
const hasStay = fs.existsSync(path.join(ROOT, STAY_FILE));

// I18N 은 jppack 이 언어 판정에 쓴다 — 최소한만 흉내낸다
const src = "var I18N = { lang: 'ko' };\n" +
            files.map(load).join("\n") +
            (hasStay ? "\n" + load(STAY_FILE) : "\nvar STAYDB_JP = null;") +
            "\n;return { GOLF_DB, JPPACK, HOLEIMG_DB_JP, HOLESTATS_JP, HOLETEXT_JP, STAYDB_JP };";
let env;
try {
  env = new Function(src)();
} catch (e) {
  console.log("✖ 앱 파일을 불러오지 못했습니다 —", e.message);
  process.exit(1);
}
const { GOLF_DB, JPPACK, HOLEIMG_DB_JP, HOLESTATS_JP, HOLETEXT_JP, STAYDB_JP } = env;

// 화면이 쓰는 이름 = 검색 결과가 만드는 이름 (k 가 있으면 k, 없으면 n)
const jp = GOLF_DB.filter((g) => g.c === "JP");
// 앱은 검색 결과에서 이름과 **좌표를 함께** 들고 화면을 연다.
// 별칭이 겹치는 구장(조요 CC = 城陽/常陽, 400km 거리)은 좌표가 있어야 갈린다 —
// 관문도 같은 것을 넘겨야 앱과 같은 판정을 한다.
const shown = jp.map((g) => ({ name: g.k || g.n, lat: g.lat, lon: g.lon }));
const aliasDiff = jp.filter((g) => g.k && g.k !== g.n).length;
console.log(`■ golfdb 일본 구장 ${jp.length}곳 · 화면이름이 원문과 다른 곳 ${aliasDiff}곳`);

const PACKS = [
  ["홀맵",     HOLEIMG_DB_JP, (n) => JPPACK.imgdb(n)],
  ["통계",     HOLESTATS_JP,  (n) => JPPACK.stats(n)],
  ["한줄공략", HOLETEXT_JP,   (n) => JPPACK.text(n, 0) !== "" || !!JPPACK._pick(HOLETEXT_JP, n)],
];
// 숙박도 같은 관문에 태운다 — 별칭 사고(§2-9-2)를 숙박에서 다시 겪지 않기 위해서다.
// 자료를 아무리 잘 모아도 앱이 그 이름으로 못 찾으면 화면은 비어 있다.
if (STAYDB_JP) PACKS.push(["숙박", STAYDB_JP, (n) => JPPACK.stay(n)]);
else console.log("   (숙박: js/staydb_jp.js 가 아직 없어 건너뜁니다 — 배치 후 생깁니다)");

const problems = [];
for (const [label, db, get] of PACKS) {
  const total = Object.keys(db).length;
  let hit = 0;
  const reached = new Set();
  for (const name of shown) {
    if (!get(name)) continue;
    hit++;
    // 어떤 키에 닿았는지 — 고아 자료를 세려면 필요하다
    for (const c of JPPACK.origNames(name.name, name.lat, name.lon))
      if (db[c]) { reached.add(c); break; }
  }
  console.log(`   ${label.padEnd(8)} 자료 ${String(total).padStart(4)}곳 · ` +
              `화면에서 닿음 ${String(hit).padStart(4)}곳`);
  if (total && hit === 0)
    problems.push(`${label}: 자료가 ${total}곳 있는데 화면에서 **한 곳도** 닿지 않습니다`);
  const orphan = Object.keys(db).filter((k) => !reached.has(k));
  if (orphan.length)
    problems.push(`${label}: 아무 구장에서도 닿지 않는 자료 ${orphan.length}곳 ` +
                  `(예: ${orphan.slice(0, 3).join(", ")})`);
}

// 3-1) 숙박 값 관문 — 번호가 정수인가, 거리가 링 설계로 나올 수 있는 값인가
if (STAYDB_JP) {
  const bad = [];
  for (const [name, list] of Object.entries(STAYDB_JP)) {
    if (list.length > 12) bad.push(`${name}: 숙소 ${list.length}곳 (12곳 넘음)`);
    for (const [no, km] of list) {
      if (!Number.isInteger(no) || no <= 0) bad.push(`${name}: 숙소번호 ${no} 가 양의 정수가 아님`);
      // 3km 반경 + 9km 링 = 이론 최대 12km. 넘으면 거리 계산이 틀린 것이다
      if (typeof km !== "number" || km < 0 || km > 12)
        bad.push(`${name}: 거리 ${km}km 가 0~12km 밖 (거리 계산이 틀렸다)`);
    }
  }
  if (bad.length) problems.push(...bad.slice(0, 6).map((s) => "숙박 값: " + s));
}

// 3) 홀맵이 없으면 통계·공략은 화면에 붙을 자리가 없다
for (const [label, db] of [["통계", HOLESTATS_JP], ["한줄공략", HOLETEXT_JP]]) {
  const extra = Object.keys(db).filter((k) => !HOLEIMG_DB_JP[k]);
  if (extra.length)
    problems.push(`${label}: 홀맵 없는 구장에 자료만 ${extra.length}곳 — 붙을 자리가 없습니다`);
}

if (problems.length) {
  console.log(`\n✖ 화면 도달 관문 — 문제 ${problems.length}건`);
  problems.slice(0, 20).forEach((p) => console.log("  -", p));
  process.exit(1);
}
console.log("\n✅ 화면 도달 관문 통과 — 앱 코드로 불러 자료가 실제로 닿습니다");
