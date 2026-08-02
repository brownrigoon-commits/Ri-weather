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
// I18N 은 jppack 이 언어 판정에 쓴다 — 최소한만 흉내낸다
const src = "var I18N = { lang: 'ko' };\n" + files.map(load).join("\n") +
            "\n;return { GOLF_DB, JPPACK, HOLEIMG_DB_JP, HOLESTATS_JP, HOLETEXT_JP };";
let env;
try {
  env = new Function(src)();
} catch (e) {
  console.log("✖ 앱 파일을 불러오지 못했습니다 —", e.message);
  process.exit(1);
}
const { GOLF_DB, JPPACK, HOLEIMG_DB_JP, HOLESTATS_JP, HOLETEXT_JP } = env;

// 화면이 쓰는 이름 = 검색 결과가 만드는 이름 (k 가 있으면 k, 없으면 n)
const jp = GOLF_DB.filter((g) => g.c === "JP");
const shown = jp.map((g) => g.k || g.n);
const aliasDiff = jp.filter((g) => g.k && g.k !== g.n).length;
console.log(`■ golfdb 일본 구장 ${jp.length}곳 · 화면이름이 원문과 다른 곳 ${aliasDiff}곳`);

const PACKS = [
  ["홀맵",     HOLEIMG_DB_JP, (n) => JPPACK.imgdb(n)],
  ["통계",     HOLESTATS_JP,  (n) => JPPACK.stats(n)],
  ["한줄공략", HOLETEXT_JP,   (n) => JPPACK.text(n, 0) !== "" || !!JPPACK._pick(HOLETEXT_JP, n)],
];

const problems = [];
for (const [label, db, get] of PACKS) {
  const total = Object.keys(db).length;
  let hit = 0;
  const reached = new Set();
  for (const name of shown) {
    if (!get(name)) continue;
    hit++;
    // 어떤 키에 닿았는지 — 고아 자료를 세려면 필요하다
    for (const c of JPPACK.origNames(name)) if (db[c]) { reached.add(c); break; }
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
