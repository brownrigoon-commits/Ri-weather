# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 종목 주가 차트 데이터 (일·주·월·연)

**왜 파일로 만들어 두는가**

앱은 깃허브 페이지에 올라간 정적 화면이라 브라우저에서 야후·네이버를 직접 부를 수 없습니다.
(2026-07-28 실제 확인: 야후 chart API·stooq 모두 CORS 로 막힘 — `Failed to fetch`)
그래서 화면에 그래프를 그리려면 **엔진이 미리 담아 올리는 수밖에** 없습니다.
엔진은 어차피 점수 계산을 위해 2015년부터의 일별 종가를 이미 받아 두므로,
그것을 네 구간으로 줄여 담습니다.

**용량을 어떻게 줄였나** (이 저장소는 하루 두 번 데이터를 커밋합니다 — 크기가 곧 부담)

  · 날짜를 종목마다 적지 않고 **시장이 공유하는 날짜축**에 한 번만 적습니다.
    종목별로는 숫자 배열만 담습니다(그 날 거래가 없었으면 null).
  · 담는 종목은 **평가 종목만**입니다(전략에 오르는 종목 — 한국 144 · 미국 110 안팎).
  · 종가는 한국은 정수(원), 미국은 소수 둘째 자리에서 끊습니다.

구간(설계서 2.2 `차트`)

  | 구간 | 점 개수 | 무엇 |
  |---|---|---|
  | 일 | 60 | 최근 60거래일 (약 3개월) |
  | 주 | 52 | 최근 52주 — 주의 마지막 거래일 종가 |
  | 월 | 24 | 최근 24개월 — 월의 마지막 거래일 종가 |
  | 연 | 10 | 최근 10년 — 해의 마지막 거래일 종가 |

import 시점에는 네트워크를 쓰지 않습니다. 이미 받아 둔 값만 다룹니다.
"""

import pandas as pd

# 구간별로 남길 점 개수 — 화면(app.js 차트카드)과 같은 구간 이름을 씁니다.
구간설정 = [('일', 'D', 60), ('주', 'W', 52), ('월', 'M', 24), ('연', 'Y', 10)]


def _정리(close):
    """종가 시리즈 → 날짜 오름차순, 결측 제거."""
    if close is None or len(close) == 0:
        return None
    s = pd.Series(close).dropna()
    if s.empty:
        return None
    s.index = pd.to_datetime(s.index)
    return s.sort_index()


def _구간줄이기(s, 주기):
    """일별 종가 → 구간별 **마지막 거래일 종가**. 날짜는 그 거래일 **그대로** 남깁니다.

    ⚠ `resample().last()` 를 쓰면 값은 맞지만 **날짜가 구간 끝으로 바뀝니다.**
       7월 28일 종가가 `2026-07-31`(월말), 심지어 올해 값이 `2026-12-31`(연말),
       이번 주 값이 일요일(`2026-08-02`)로 찍혔습니다 — 아직 오지도 않은 날짜입니다.
       화면 툴팁에 그 날짜가 그대로 나가면 "그날 종가"로 읽히므로 쓰면 안 됩니다.
       그래서 구간별 마지막 **행**을 집어(`tail(1)`) 원래 거래일을 지킵니다.
    """
    if 주기 == 'D':
        return s
    기간 = s.index.to_period({'W': 'W', 'M': 'M', 'Y': 'Y'}[주기])
    return s.groupby(기간, sort=True).tail(1)


def _자리수(is_kr):
    """한국 주가는 원 단위 정수, 미국은 소수 둘째 자리."""
    return 0 if is_kr else 2


def build_charts(prices, symbols, is_kr):
    """설계서 2.2 `차트` 블록을 만듭니다.

    prices  : {야후심볼: DataFrame(Close…)} — 이미 받아 둔 주가
    symbols : {야후심볼: 티커} — 담을 종목만 (평가 종목)
    반환    : {구간: {'날짜': [...], '종목': {티커: [값|null, ...]}}}
    """
    나눔 = _자리수(is_kr)
    시리즈 = {}
    for ysym, 티커 in symbols.items():
        d = prices.get(ysym)
        if d is None or 'Close' not in getattr(d, 'columns', []):
            continue
        s = _정리(d['Close'])
        if s is not None:
            시리즈[티커] = s
    if not 시리즈:
        return {}

    차트 = {}
    for 이름, 주기, 개수 in 구간설정:
        줄인것 = {티커: _구간줄이기(s, 주기) for 티커, s in 시리즈.items()}
        # 날짜축 = 담긴 종목들이 실제로 가진 날짜의 합집합 중 **최근 N개**
        모든날짜 = set()
        for s in 줄인것.values():
            모든날짜.update(s.index)
        축 = sorted(모든날짜)[-개수:]
        if not 축:
            continue
        축키 = [d.strftime('%Y%m%d') for d in 축]

        종목별 = {}
        for 티커, s in 줄인것.items():
            값 = s.reindex(축)
            줄 = [None if pd.isna(v) else round(float(v), 나눔) for v in 값]
            if 나눔 == 0:
                줄 = [None if v is None else int(v) for v in 줄]
            if any(v is not None for v in 줄):
                종목별[티커] = 줄
        if 종목별:
            차트[이름] = {'날짜': 축키, '종목': 종목별}
    return 차트
