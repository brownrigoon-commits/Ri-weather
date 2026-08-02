/* Apps Script 흉내 껍데기 — tools/apps_script/*.gs 를 PC 에서 그대로 돌려 본다.
 *
 * 왜 필요한가: 백엔드 로직(누굴 빼고 누굴 세는가)이 틀리면 사장님이 보는 숫자가 통째로
 * 틀린다. 그런데 Apps Script 는 구글 서버에서만 돌아서, 고쳐 놓고 "돌려는 봤나?" 를
 * 물으면 답이 없었다. 재배포는 손으로 하는 일이라 되돌리기도 번거롭다.
 * 그래서 구글 서비스(시트·속성·캐시)를 가짜로 만들어 놓고 로직만 여기서 돌린다.
 *
 * 흉내 내는 것: SpreadsheetApp · PropertiesService · CacheService · Utilities ·
 *              ContentService · LockService · MailApp · UrlFetchApp(호출 금지)
 * 흉내 내지 않는 것: 실제 네트워크. UrlFetchApp 을 부르면 일부러 터진다 —
 *              시험이 밖으로 나가는 순간 그건 더 이상 시험이 아니다.
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ── 가짜 시트 ─────────────────────────────────────────────
   getRange(행, 칸, 행수, 칸수) 는 1부터 센다(구글과 같게). */
function makeSheet(name, rows) {
  const data = rows.map((r) => r.slice());   // [[머리글],[값...]]
  const sh = {
    _name: name,
    _data: data,
    getName: () => name,
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    appendRow(r) { data.push(r.slice()); },
    setColumnWidth() {},
    getRange(row, col, nRow, nCol) {
      nRow = nRow || 1; nCol = nCol || 1;
      return {
        getValue() {
          const r = data[row - 1];
          return r ? (r[col - 1] === undefined ? "" : r[col - 1]) : "";
        },
        setValue(v) {
          while (data.length < row) data.push([]);
          data[row - 1][col - 1] = v;
        },
        getValues() {
          const out = [];
          for (let i = 0; i < nRow; i++) {
            const src = data[row - 1 + i] || [];
            const line = [];
            for (let j = 0; j < nCol; j++) line.push(src[col - 1 + j] === undefined ? "" : src[col - 1 + j]);
            out.push(line);
          }
          return out;
        },
        setValues(vals) {
          for (let i = 0; i < vals.length; i++) {
            const r = row - 1 + i;
            while (data.length <= r) data.push([]);
            for (let j = 0; j < vals[i].length; j++) data[r][col - 1 + j] = vals[i][j];
          }
        },
      };
    },
  };
  return sh;
}

/* ── 시각 서식 — Utilities.formatDate 흉내 ───────────────────
   쓰는 서식이 "MM-dd" 와 "M월 d일 HH:mm" 둘뿐이라 그 둘만 정확히 낸다.
   ⚠️ 시간대(Asia/Seoul)를 제대로 적용해야 '오늘'의 경계가 맞는다 —
      이걸 대충 하면 시험은 통과하는데 서버에서는 하루가 밀린다. */
function formatDate(d, tz, fmt) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  // Intl 은 자정을 "24" 로 줄 때가 있다
  const HH = p.hour === "24" ? "00" : p.hour;
  return fmt
    .replace("yyyy", p.year)
    .replace("MM", p.month).replace("dd", p.day)
    .replace("HH", HH).replace("mm", p.minute)
    .replace(/M월/, String(Number(p.month)) + "월")
    .replace(/d일/, String(Number(p.day)) + "일");
}

/* ── 껍데기 만들기 ─────────────────────────────────────────
   sheets: { log:[[...]], fb:[[...]] } · props: { ADMIN_PW:"..." } */
function load(gsFile, opts) {
  opts = opts || {};
  const sheets = {};
  Object.keys(opts.sheets || {}).forEach((k) => { sheets[k] = makeSheet(k, opts.sheets[k]); });

  const props = Object.assign({}, opts.props || {});
  const cache = {};
  const mails = [];

  const sandbox = {
    console,
    Date, Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseInt, parseFloat,

    SpreadsheetApp: {
      openById: () => sandbox.__ss,
      getActiveSpreadsheet: () => sandbox.__ss,
    },
    __ss: {
      getSheetByName: (n) => sheets[n] || null,
      insertSheet(n) { sheets[n] = makeSheet(n, []); return sheets[n]; },
    },

    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
        deleteProperty: (k) => { delete props[k]; },
      }),
    },

    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = String(v); },
        remove: (k) => { delete cache[k]; },
      }),
    },

    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
    },

    Utilities: {
      formatDate,
      base64Encode: (s) => Buffer.from(String(s)).toString("base64"),
      computeDigest: (_a, s) => Buffer.from(String(s)),
      DigestAlgorithm: { MD5: "MD5" },
      Charset: { UTF_8: "UTF-8" },
    },

    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (s) => ({ _text: s, setMimeType() { return this; } }),
    },

    MailApp: {
      sendEmail: (o) => { mails.push(o); },
      getRemainingDailyQuota: () => 100,
    },

    // 시험이 진짜 네트워크로 나가면 그건 시험이 아니다 — 부르는 즉시 터뜨린다
    UrlFetchApp: {
      fetch() { throw new Error("시험 중에는 UrlFetchApp 을 쓸 수 없습니다"); },
      fetchAll() { throw new Error("시험 중에는 UrlFetchApp 을 쓸 수 없습니다"); },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(gsFile, "utf8"), sandbox, { filename: path.basename(gsFile) });

  /* json_() 이 돌려주는 것은 ContentService 객체다 — 시험에서는 알맹이만 본다 */
  sandbox.__json = (out) => JSON.parse(out._text);
  sandbox.__props = props;
  sandbox.__sheets = sheets;
  sandbox.__mails = mails;
  return sandbox;
}

module.exports = { load, makeSheet, formatDate };
