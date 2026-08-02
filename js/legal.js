/* 투어리스트(구 골프라이프) 약관·방침 문서
   ※ 개인정보보호법 제15조제2항(목적·항목·기간·거부권), 제30조(처리방침 기재사항),
      위치정보법 제15조·제18조, 약관규제법 제7조(면책 한계)를 반영해 작성.
      회사 정보(사업자번호·주소·전화)는 확정 후 COMPANY 값만 바꾸면 전 문서에 반영됨. */

const LEGAL_VERSION = "1.0";          // 약관 버전 — 내용이 바뀌면 올릴 것 (재동의 트리거)
const LEGAL_DATE = "2026년 7월 22일";

const COMPANY = {
  service: "투어리스트(TOURLIST, 구 골프라이프·Ri-Weather)",   // 브랜드명 변경 2026-07-31(상표 출원 진행) — 동일 서비스이므로 재동의는 트리거하지 않음(LEGAL_VERSION 유지)
  name: "주식회사 리플래시",
  ceo: "이보미",
  dpo: "이성민",    // 개인정보 보호책임자 (사장님 지정 2026-07-22)
  email: "brown.rigoon@gmail.com",
  bizno: "",        // 사업자등록번호 (확인 후 입력)
  addr: "",         // 주소 (확인 후 입력)
  tel: "",          // 전화 (확인 후 입력)
};

const _contact = () => {
  const rows = [
    [tr("legal.contact.service"), COMPANY.service],
    [tr("legal.contact.operator"), COMPANY.name],
    [tr("legal.contact.ceo"), COMPANY.ceo],
    [tr("legal.contact.dpo"), COMPANY.dpo],
    COMPANY.bizno ? [tr("legal.contact.bizno"), COMPANY.bizno] : null,
    COMPANY.addr ? [tr("legal.contact.addr"), COMPANY.addr] : null,
    COMPANY.tel ? [tr("legal.contact.tel"), COMPANY.tel] : null,
    [tr("legal.contact.inquiry"), COMPANY.email],
  ].filter(Boolean);
  return `<table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;
};

const LEGAL_DOCS = {
  /* ─────────────────────────── 이용약관 ─────────────────────────── */
  tos: {
    title: tr("legal.tos.title"),
    body: `
<h4>${tr("legal.tos.a1.h")}</h4>
<p>${tr("legal.tos.a1.p", { company: COMPANY.name, service: COMPANY.service })}</p>

<h4>${tr("legal.tos.a2.h")}</h4>
<ul>
  <li>${tr("legal.tos.a2.li1")}</li>
  <li>${tr("legal.tos.a2.li2")}</li>
  <li>${tr("legal.tos.a2.li3")}</li>
  <li>${tr("legal.tos.a2.li4")}</li>
</ul>

<h4>${tr("legal.tos.a3.h")}</h4>
<p>${tr("legal.tos.a3.p")}</p>
<ul>
  <li>${tr("legal.tos.a3.li1")}</li>
  <li>${tr("legal.tos.a3.li2")}</li>
  <li>${tr("legal.tos.a3.li3")}</li>
  <li>${tr("legal.tos.a3.li4")}</li>
</ul>

<h4>${tr("legal.tos.a4.h")}</h4>
<ul>
  <li>${tr("legal.tos.a4.li1")}</li>
  <li>${tr("legal.tos.a4.li2")}</li>
  <li>${tr("legal.tos.a4.li3")}</li>
</ul>

<h4>${tr("legal.tos.a5.h")}</h4>
<ul>
  <li>${tr("legal.tos.a5.li1")}</li>
  <li>${tr("legal.tos.a5.li2")}</li>
  <li>${tr("legal.tos.a5.li3")}</li>
</ul>

<h4>${tr("legal.tos.a6.h")}</h4>
<ul>
  <li>${tr("legal.tos.a6.li1")}</li>
  <li>${tr("legal.tos.a6.li2")}</li>
  <li>${tr("legal.tos.a6.li3")}</li>
  <li>${tr("legal.tos.a6.li4")}</li>
  <li>${tr("legal.tos.a6.li5")}</li>
  <li>${tr("legal.tos.a6.li6")}</li>
</ul>

<h4>${tr("legal.tos.a7.h")}</h4>
<ul>
  <li>${tr("legal.tos.a7.li1")}</li>
  <li>${tr("legal.tos.a7.li2")}</li>
  <li>${tr("legal.tos.a7.li3")}</li>
  <!-- 차단막 1단계(2026-08-02): 우리 DB의 제작자 권리 명시.
       제5조에 이미 있던 크롤링 금지를 구체화한 것이라 재동의(LEGAL_VERSION)는 안 올린다 -->
  <li>${tr("legal.tos.a7.li4")}</li>
  <li>${tr("legal.tos.a7.li5")}</li>
</ul>

<h4>${tr("legal.tos.a8.h")}</h4>
<ul>
  <li>${tr("legal.tos.a8.li1")}</li>
  <li>${tr("legal.tos.a8.li2")}</li>
</ul>

<h4>${tr("legal.tos.add.h")}</h4>
<p>${tr("legal.tos.add.p", { date: LEGAL_DATE, ver: LEGAL_VERSION })}</p>
${_contact()}
`,
  },

  /* ─────────────────────── 위치정보 이용 동의 ─────────────────────── */
  loc: {
    title: tr("legal.loc.title"),
    body: `
<p>${tr("legal.loc.intro")}</p>

<h4>${tr("legal.loc.s1.h")}</h4>
<p>${tr("legal.loc.s1.p")}</p>

<h4>${tr("legal.loc.s2.h")}</h4>
<p>${tr("legal.loc.s2.p")}</p>

<h4>${tr("legal.loc.s3.h")}</h4>
<ul>
  <li>${tr("legal.loc.s3.li1")}</li>
  <li>${tr("legal.loc.s3.li2")}</li>
  <li>${tr("legal.loc.s3.li3")}</li>
  <li>${tr("legal.loc.s3.li4")}</li>
</ul>

<h4>${tr("legal.loc.s4.h")}</h4>
<p>${tr("legal.loc.s4.p")}</p>

<h4>${tr("legal.loc.s5.h")}</h4>
<p>${tr("legal.loc.s5.p")}</p>

<h4>${tr("legal.loc.s6.h")}</h4>
<p>${tr("legal.loc.s6.p")}</p>

<h4>${tr("legal.loc.s7.h")}</h4>
<p>${tr("legal.loc.s7.p")}</p>
${_contact()}
`,
  },

  /* ────────────────── 연령대·성별 수집 동의 ────────────────── */
  profile: {
    title: tr("legal.profile.title"),
    body: `
<p>${tr("legal.profile.intro")}</p>

<h4>${tr("legal.profile.s1.h")}</h4>
<p>${tr("legal.profile.s1.p")}</p>

<h4>${tr("legal.profile.s2.h")}</h4>
<table>
  <tr><th>${tr("legal.profile.s2.age.th")}</th><td>${tr("legal.profile.s2.age.td")}</td></tr>
  <tr><th>${tr("legal.profile.s2.gender.th")}</th><td>${tr("legal.profile.s2.gender.td")}</td></tr>
</table>
<p>${tr("legal.profile.s2.p")}</p>

<h4>${tr("legal.profile.s3.h")}</h4>
<p>${tr("legal.profile.s3.p")}</p>

<h4>${tr("legal.profile.s4.h")}</h4>
<p>${tr("legal.profile.s4.p")}</p>

<h4>${tr("legal.profile.s5.h")}</h4>
<p>${tr("legal.profile.s5.p")}</p>
${_contact()}
`,
  },

  /* ────────────────────── 개인정보 처리방침 ────────────────────── */
  privacy: {
    title: tr("legal.privacy.title"),
    body: `
<p>${tr("legal.privacy.intro", { company: COMPANY.name })}</p>

<h4>${tr("legal.privacy.s1.h")}</h4>
<ul>
  <li>${tr("legal.privacy.s1.li1")}</li>
  <li>${tr("legal.privacy.s1.li2")}</li>
</ul>

<h4>${tr("legal.privacy.s2.h")}</h4>
<table>
  <tr><th>${tr("legal.privacy.s2.th.item")}</th><th>${tr("legal.privacy.s2.th.purpose")}</th><th>${tr("legal.privacy.s2.th.period")}</th></tr>
  <tr><td>${tr("legal.privacy.s2.r1.item")}</td><td>${tr("legal.privacy.s2.r1.purpose")}</td><td>${tr("legal.privacy.s2.r1.period")}</td></tr>
  <tr><td>${tr("legal.privacy.s2.r2.item")}</td><td>${tr("legal.privacy.s2.r2.purpose")}</td><td>${tr("legal.privacy.s2.r2.period")}</td></tr>
  <tr><td>${tr("legal.privacy.s2.r3.item")}</td><td>${tr("legal.privacy.s2.r3.purpose")}</td><td>${tr("legal.privacy.s2.r3.period")}</td></tr>
  <tr><td>${tr("legal.privacy.s2.r4.item")}<br><small>${tr("legal.privacy.s2.r4.note")}</small></td><td>${tr("legal.privacy.s2.r4.purpose")}</td><td>${tr("legal.privacy.s2.r4.period")}</td></tr>
  <tr><td>${tr("legal.privacy.s2.r5.item")}</td><td>${tr("legal.privacy.s2.r5.purpose")}</td><td>${tr("legal.privacy.s2.r5.period")}</td></tr>
  <tr><td>${tr("legal.privacy.s2.r6.item")}<br><small>${tr("legal.privacy.s2.r6.note")}</small></td><td>${tr("legal.privacy.s2.r6.purpose")}</td><td>${tr("legal.privacy.s2.r6.period")}</td></tr>
</table>
<p>${tr("legal.privacy.s2.p1")}</p>
<p>${tr("legal.privacy.s2.p2")}</p>
<p>${tr("legal.privacy.s2.p3")}</p>
<p>${tr("legal.privacy.s2.p4")}</p>

<h4>${tr("legal.privacy.s3.h")}</h4>
<p>${tr("legal.privacy.s3.p")}</p>

<h4>${tr("legal.privacy.s4.h")}</h4>
<p>${tr("legal.privacy.s4.p")}</p>
<ul>
  <li>${tr("legal.privacy.s4.li1")}</li>
  <li>${tr("legal.privacy.s4.li2")}</li>
  <li>${tr("legal.privacy.s4.li3")}</li>
  <li>${tr("legal.privacy.s4.li4")}</li>
  <li>골프존 — 홀 정보</li>
  <li>${tr("legal.privacy.s4.li6")}</li>
</ul>

<h4>${tr("legal.privacy.s5.h")}</h4>
<p>${tr("legal.privacy.s5.p")}</p>

<h4>${tr("legal.privacy.s6.h")}</h4>
<ul>
  <li>${tr("legal.privacy.s6.li1")}</li>
  <li>${tr("legal.privacy.s6.li2")}</li>
  <li>${tr("legal.privacy.inquiry", { email: COMPANY.email })}</li>
</ul>

<h4>${tr("legal.privacy.s7.h")}</h4>
<p>${tr("legal.privacy.s7.p")}</p>

<h4>${tr("legal.privacy.s8.h")}</h4>
<ul>
  <li>${tr("legal.privacy.s8.li1")}</li>
  <li>${tr("legal.privacy.s8.li2")}</li>
  <li>${tr("legal.privacy.s8.li3")}</li>
</ul>

<h4>${tr("legal.privacy.s9.h")}</h4>
<p>${tr("legal.privacy.s9.p")}</p>
<ul>
  <li>${tr("legal.privacy.s9.li1", { dpo: COMPANY.dpo })}</li>
  <li>${tr("legal.privacy.inquiry", { email: COMPANY.email })}</li>
</ul>
${_contact()}

<h4>${tr("legal.privacy.s10.h")}</h4>
<p>${tr("legal.privacy.s10.p", { date: LEGAL_DATE })}</p>

<h4>${tr("legal.privacy.s11.h")}</h4>
<ul>
  <li>${tr("legal.privacy.s11.li1")}</li>
  <li>${tr("legal.privacy.s11.li2")}</li>
  <li>${tr("legal.privacy.s11.li3")}</li>
</ul>
`,
  },
};
