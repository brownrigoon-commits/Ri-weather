# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 점수 계산 (sector_pick_top10.py v2 체계)

원본 `기업분석표_생성.py` 의 점수 함수를 **한 줄도 바꾸지 않고** 그대로 옮겼습니다.
계산 결과가 달라지면 그건 버그입니다. (검증: tests/test_scoring_parity.py)

여기 있는 함수는 네트워크를 쓰지 않습니다. 오프라인에서 그대로 테스트할 수 있습니다.
"""

import re

import pandas as pd

from .config import LOOKBACK_DAYS, MA_NEAR_PCT, MIN_PULLBACK, YEARS


# =========================
# 공통 유틸
# =========================
def to_float(x):
    if x is None:
        return None
    s = str(x).strip().replace(',', '').replace('%', '')
    if s in ['', '-', 'N/A', 'nan', 'None']:
        return None
    s = re.sub(r'\(.*?\)', '', s).strip()
    try:
        v = float(s)
        return None if v != v else v      # NaN 방지
    except Exception:
        return None


# =========================
# 가격 지표 (연도별 종가 / 평균수익률 / 점수용)
# =========================
def yearly_closes(close):
    """연도별 마지막 종가 {2015: xx, ...}"""
    out = {}
    if close is None or len(close) == 0:
        return out
    grp = close.groupby(close.index.year).last()
    for y in YEARS:
        if y in grp.index:
            v = grp.loc[y]
            out[y] = round(float(v), 2) if pd.notna(v) else None
    return out


def avg_return(close, years):
    """N년 평균(CAGR) 주가 수익률 — 소수 (예: 0.386 = 연 38.6%)"""
    need = years * 252
    if close is None or len(close) < need + 1:
        return None
    past = float(close.iloc[-need - 1])
    now = float(close.iloc[-1])
    if past <= 0:
        return None
    return round((now / past) ** (1 / years) - 1, 3)


# =========================
# sector_pick_top10.py v2 점수체계 (동일 기준)
# =========================
def score_momentum(close):
    """⭐ 12개월 모멘텀(12-1) 12점"""
    if len(close) < 253:
        return 4, '데이터부족'
    mom = float((close.iloc[-21] / close.iloc[-253] - 1) * 100)
    if mom >= 60:
        pts = 12
    elif mom >= 30:
        pts = 9
    elif mom >= 0:
        pts = 5
    else:
        pts = 0
    return pts, f'12개월 {mom:+.0f}%'


def score_chart(close):
    """① 눌림목·차트 12점 — 최근 10일 고점 대비 드로다운으로 눌림 판정 후
    1차 눌림(MA20 근접) / 2차 눌림(MA120·240·448 근접) 구분"""
    if len(close) < 245:
        return 4, '데이터부족'
    c = float(close.iloc[-1])
    ma20 = float(close.rolling(20).mean().iloc[-1])
    ma60 = float(close.rolling(60).mean().iloc[-1])
    ma120 = float(close.rolling(120).mean().iloc[-1])
    ma240 = float(close.rolling(240).mean().iloc[-1])
    ma448 = float(close.rolling(448).mean().iloc[-1]) if len(close) >= 448 else None
    bull_order = ma60 > ma120 > ma240
    trend = '정배열' if bull_order else '역배열'

    high10 = float(close.iloc[-(LOOKBACK_DAYS + 1):-1].max())
    drawdown = (c / high10 - 1) * 100          # 10일 고점 대비 하락률

    if drawdown >= MIN_PULLBACK:
        pts = 4 if bull_order else 1
        return pts, f'미눌림({trend}, 10일고점比 {drawdown:.1f}%)'

    def near(ma):
        return ma is not None and ma > 0 and abs(c - ma) / ma * 100 <= MA_NEAR_PCT

    if near(ma20):
        pts = 12 if bull_order else 8
        stage = '1차 눌림(MA20 근접)'
    elif near(ma120) or near(ma240) or near(ma448):
        which = 'MA120' if near(ma120) else ('MA240' if near(ma240) else 'MA448')
        pts = 8 if bull_order else 6
        stage = f'2차 눌림({which} 근접)'
    else:
        pts = 5
        stage = '눌림(지지선 미근접)'
    return pts, f'{stage}, 10일고점比 {drawdown:.1f}%, {trend}'


def score_roe(roe):
    """⭐ ROE(수익성) 8점"""
    if roe is None:
        return 2, '데이터없음'
    if roe >= 15:
        pts = 8
    elif roe >= 10:
        pts = 6
    elif roe >= 5:
        pts = 4
    elif roe > 0:
        pts = 2
    else:
        pts = 0
    return pts, f'ROE {roe:.1f}%'


def score_growth(vals):
    """②③ 성장 8점 — 3년 값 중 증가 구간 수"""
    vals = [v for v in vals if v is not None]
    if len(vals) < 3:
        return 3, '데이터부족'
    inc = (vals[0] < vals[1]) + (vals[1] < vals[2])
    pts = {2: 8, 1: 5, 0: 0}[inc]
    return pts, f'{inc}/2구간 증가'


def score_mcap(mcap_eok):
    """④ 시총 5점 (억원 기준)"""
    if mcap_eok >= 100000:
        return 5
    if mcap_eok >= 10000:
        return 4
    if mcap_eok >= 5000:
        return 3
    if mcap_eok >= 1200:
        return 2
    return 0


def score_finance(debt, net_3y):
    """⑤ 재무(부채+흑자) 12점"""
    if debt is None:
        pts_d = 2
    elif debt <= 50:
        pts_d = 7
    elif debt <= 100:
        pts_d = 5
    elif debt <= 150:
        pts_d = 3
    elif debt <= 250:
        pts_d = 1
    else:
        pts_d = 0
    nets = [v for v in net_3y if v is not None]
    profit = len(nets) >= 1 and nets[-1] > 0
    pts = pts_d + (5 if profit else 0)
    detail = f'부채 {debt:.0f}%' if debt is not None else '부채 미확인'
    detail += ', 흑자' if profit else ', 적자'
    return pts, detail


def score_52w(close, high):
    """⑨ 52주 위치 5점 — 고점 근처 우대"""
    if len(close) == 0:
        return 2, '데이터없음'
    h = high if high is not None else close
    high_52w = float(h.iloc[-252:].max()) if len(h) >= 252 else float(h.max())
    c = float(close.iloc[-1])
    pos = c / high_52w * 100
    if pos >= 75:
        pts = 5
    elif pos < 40:
        pts = 2
    elif pos < 55:
        pts = 1
    else:
        pts = 0
    return pts, f'고점대비 {pos:.0f}%'


def score_volatility(close):
    """⭐ 저변동성 5점"""
    if len(close) < 21:
        return 2, '데이터없음'
    vol = float(close.pct_change().iloc[-20:].std() * 100)
    if vol <= 2:
        pts = 5
    elif vol <= 3:
        pts = 4
    elif vol <= 4:
        pts = 2
    else:
        pts = 0
    return pts, f'변동성 {vol:.1f}%'


def minervini_stats(close, high, low):
    """미네르비니 트렌드 템플릿 정적 조건 5개 (RS 조건은 전체 순위 산출 후 별도 판정)
    ① 현재가 > MA120 > MA200  ② MA50 > MA120, 현재가 > MA50
    ③ MA200 1개월 상승 추세  ④ 52주 저가 대비 +30%↑  ⑤ 52주 고가 대비 -25% 이내"""
    if len(close) < 221:
        return None, '데이터부족'
    c = float(close.iloc[-1])
    ma50 = float(close.rolling(50).mean().iloc[-1])
    ma120 = float(close.rolling(120).mean().iloc[-1])
    ma200 = close.rolling(200).mean()
    ma200_now = float(ma200.iloc[-1])
    ma200_1m = float(ma200.iloc[-22])
    lows = low if low is not None else close
    highs = high if high is not None else close
    low52 = float(lows.iloc[-252:].min())
    high52 = float(highs.iloc[-252:].max())

    conds = [
        c > ma120 > ma200_now,
        ma50 > ma120 and c > ma50,
        ma200_now > ma200_1m,
        low52 > 0 and c >= low52 * 1.3,
        c >= high52 * 0.75,
    ]
    cnt = sum(conds)
    up_from_low = (c / low52 - 1) * 100 if low52 > 0 else 0
    from_high = (c / high52 - 1) * 100 if high52 > 0 else 0
    detail = f'저가+{up_from_low:.0f}%, 고점{from_high:.0f}%'
    return cnt, detail


def score_value(per, pbr):
    """⭐ 밸류(저평가) 8점 — Fama-French(1992) 가치 팩터 (저PER 4 + 저PBR 4)"""
    if per is None and pbr is None:
        return 2, '데이터없음'
    p = 0
    if per is not None and per > 0:
        if per <= 10:
            p = 4
        elif per <= 15:
            p = 3
        elif per <= 25:
            p = 2
        elif per <= 40:
            p = 1
    b = 0
    if pbr is not None and pbr > 0:
        if pbr <= 1:
            b = 4
        elif pbr <= 2:
            b = 3
        elif pbr <= 4:
            b = 2
        elif pbr <= 8:
            b = 1
    detail = (f'PER {per:.1f}' if per is not None else 'PER -')
    detail += (f', PBR {pbr:.1f}' if pbr is not None else ', PBR -')
    return p + b, detail


def score_dividend(dy):
    """배당수익률 4점 — 배당 프리미엄 팩터"""
    if dy is None or dy <= 0:
        return 0, '무배당/데이터없음'
    if dy >= 4:
        pts = 4
    elif dy >= 2:
        pts = 3
    elif dy >= 1:
        pts = 2
    else:
        pts = 1
    return pts, f'배당 {dy:.1f}%'


def score_supply(sd):
    """⑧ 수급 13점 — 한국만 (미국은 중립 4점)"""
    if sd is None:
        return 4, '데이터없음(중립)'
    ratio, inst, frgn = sd
    if ratio >= 3:
        pts = 13
    elif ratio >= 1:
        pts = 10
    elif ratio > 0:
        pts = 7
    elif ratio > -1:
        pts = 3
    else:
        pts = 0
    who = []
    if inst > 0:
        who.append('기관 순매수')
    if frgn > 0:
        who.append('외인 순매수')
    return pts, f"{ratio:+.1f}% ({', '.join(who) if who else '순매도 우위'})"


# =========================
# 숫자 지표 추출 (점수에는 영향 없음 — 저장용)
# =========================
# 기존 대시보드는 "고점대비 92%" 같은 한글 문장을 정규식으로 파싱해 필터에 썼습니다.
# 문장이 조금만 바뀌면 전략이 조용히 빈 결과를 냅니다.
# 아래 두 함수는 점수 함수가 이미 계산하고 있던 값을 **같은 식·같은 자릿수**로 다시 내놓습니다.
#   - 자릿수를 근거 문장과 똑같이 맞춘 이유: 기존 결과(정답지)를 그대로 재현하기 위해서입니다.
#     기존 필터는 '고점대비 {pos:.0f}%' 를 파싱했으므로 84.7 이 아니라 85 로 판정했습니다.
#     여기서 반올림하지 않으면 경계값 종목의 통과 여부와 동점 정렬 순서가 달라집니다.

def pos_52w(close, high):
    """52주 고가 대비 현재가 위치(%) — score_52w 의 pos 와 동일. 값이 없으면 None."""
    if close is None or len(close) == 0:
        return None
    h = high if high is not None else close
    high_52w = float(h.iloc[-252:].max()) if len(h) >= 252 else float(h.max())
    if not high_52w:
        return None
    c = float(close.iloc[-1])
    pos = c / high_52w * 100
    return round(pos, 0)          # 근거 문장 '고점대비 {pos:.0f}%' 와 같은 자릿수


def drawdown_10d(close):
    """최근 10일 고점 대비 등락(%) — score_chart 의 drawdown 과 동일. 값이 없으면 None.
    (양수면 10일 고점을 넘어 상승 중이라는 뜻)"""
    if close is None or len(close) < 245:
        return None               # score_chart 가 '데이터부족'을 내는 구간
    c = float(close.iloc[-1])
    high10 = float(close.iloc[-(LOOKBACK_DAYS + 1):-1].max())
    if not high10:
        return None
    drawdown = (c / high10 - 1) * 100
    return round(drawdown, 1)     # 근거 문장 '10일고점比 {drawdown:.1f}%' 와 같은 자릿수
