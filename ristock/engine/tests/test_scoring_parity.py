# -*- coding: utf-8 -*-
"""점수 함수 이식 검증 — 원본과 새 scoring.py 가 완전히 같은 값을 내는지 확인

이 파일에는 원본 `기업분석표_생성.py` 의 점수 함수를 **그대로 복사한 참조 구현**이 들어 있습니다.
(원본 파일 경로에 의존하지 않도록 복사해 넣었습니다. 사장님 PC·깃허브 액션 어디서나 돌아갑니다.)

합성 가격 시계열 여러 개에 대해 모든 점수 함수의 반환값(점수 + 근거 문장)이
원본과 **완전히 동일한지** 비교합니다. 하나라도 다르면 이식 중 뭔가 바뀐 것입니다.

추가로, 새로 넣은 숫자 지표(`고점대비` · `10일고점비`)가
기존 대시보드가 근거 문장을 정규식으로 파싱해 쓰던 값과 **정확히 같은지** 확인합니다.
이 값이 어긋나면 전략 필터(전고점돌파만·신고가근접만)의 결과가 조용히 달라집니다.

    실행:  python -m pytest ristock/engine/tests/test_scoring_parity.py -q
    또는:  python ristock/engine/tests/test_scoring_parity.py
"""

import os
import re
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))))

from ristock.engine import scoring  # noqa: E402

# =====================================================================
# 참조 구현 — 원본 기업분석표_생성.py 에서 그대로 복사 (수정 금지)
# =====================================================================
REF_LOOKBACK_DAYS = 10
REF_MIN_PULLBACK = -1.5
REF_MA_NEAR_PCT = 3.0
REF_YEARS = list(range(2015, 2026))


def ref_to_float(x):
    if x is None:
        return None
    s = str(x).strip().replace(',', '').replace('%', '')
    if s in ['', '-', 'N/A', 'nan', 'None']:
        return None
    s = re.sub(r'\(.*?\)', '', s).strip()
    try:
        v = float(s)
        return None if v != v else v
    except Exception:
        return None


def ref_yearly_closes(close):
    out = {}
    if close is None or len(close) == 0:
        return out
    grp = close.groupby(close.index.year).last()
    for y in REF_YEARS:
        if y in grp.index:
            v = grp.loc[y]
            out[y] = round(float(v), 2) if pd.notna(v) else None
    return out


def ref_avg_return(close, years):
    need = years * 252
    if close is None or len(close) < need + 1:
        return None
    past = float(close.iloc[-need - 1])
    now = float(close.iloc[-1])
    if past <= 0:
        return None
    return round((now / past) ** (1 / years) - 1, 3)


def ref_score_momentum(close):
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


def ref_score_chart(close):
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

    high10 = float(close.iloc[-(REF_LOOKBACK_DAYS + 1):-1].max())
    drawdown = (c / high10 - 1) * 100

    if drawdown >= REF_MIN_PULLBACK:
        pts = 4 if bull_order else 1
        return pts, f'미눌림({trend}, 10일고점比 {drawdown:.1f}%)'

    def near(ma):
        return ma is not None and ma > 0 and abs(c - ma) / ma * 100 <= REF_MA_NEAR_PCT

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


def ref_score_roe(roe):
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


def ref_score_growth(vals):
    vals = [v for v in vals if v is not None]
    if len(vals) < 3:
        return 3, '데이터부족'
    inc = (vals[0] < vals[1]) + (vals[1] < vals[2])
    pts = {2: 8, 1: 5, 0: 0}[inc]
    return pts, f'{inc}/2구간 증가'


def ref_score_mcap(mcap_eok):
    if mcap_eok >= 100000:
        return 5
    if mcap_eok >= 10000:
        return 4
    if mcap_eok >= 5000:
        return 3
    if mcap_eok >= 1200:
        return 2
    return 0


def ref_score_finance(debt, net_3y):
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


def ref_score_52w(close, high):
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


def ref_score_volatility(close):
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


def ref_minervini_stats(close, high, low):
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


def ref_score_value(per, pbr):
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


def ref_score_dividend(dy):
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


def ref_score_supply(sd):
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


# =====================================================================
# 합성 가격 시계열 (난수 시드 고정 — 매번 같은 데이터)
# =====================================================================
def _lcg(seed):
    """의존성 없이 재현 가능한 난수 (선형 합동법)"""
    x = seed
    while True:
        x = (1103515245 * x + 12345) % (1 << 31)
        yield x / (1 << 31)


def make_series(n, seed, drift, vol, shape='random'):
    """길이 n 짜리 OHLC 유사 DataFrame (Close/High/Low/Volume)"""
    rnd = _lcg(seed)
    price = 100.0
    closes, highs, lows, vols = [], [], [], []
    for i in range(n):
        r = next(rnd) - 0.5
        if shape == 'up':
            step = drift + vol * r * 0.3
        elif shape == 'down':
            step = -drift + vol * r * 0.3
        elif shape == 'flat':
            step = 0.0
        elif shape == 'spike':                       # 마지막 15일만 급등
            step = (drift * 6 if i >= n - 15 else drift * 0.2) + vol * r * 0.2
        elif shape == 'dip':                         # 마지막 8일만 눌림
            step = (-drift * 5 if i >= n - 8 else drift) + vol * r * 0.2
        else:
            step = drift + vol * r
        price = max(1.0, price * (1 + step))
        closes.append(price)
        highs.append(price * (1 + abs(vol * next(rnd)) * 0.5))
        lows.append(price * (1 - abs(vol * next(rnd)) * 0.5))
        vols.append(1_000_000 * (0.5 + next(rnd)))
    idx = pd.bdate_range(end='2026-07-16', periods=n)
    return pd.DataFrame({'Close': closes, 'High': highs, 'Low': lows, 'Volume': vols},
                        index=idx)


# 상승 후 하락 — 차트 점수의 '2차 눌림'·'지지선 미근접' 분기까지 밟기 위한 국면 전환형
PHASES = {
    'crash':  lambda i, n, r: (0.0020 + 0.004 * r) if i < n - 25 else (-0.012 + 0.002 * r),
    'deep':   lambda i, n, r: (0.0025 + 0.004 * r) if i < n - 40 else (-0.010 + 0.002 * r),
    'mid':    lambda i, n, r: (0.0018 + 0.003 * r) if i < n - 14 else (-0.008 + 0.001 * r),
    'slow':   lambda i, n, r: (0.0012 + 0.003 * r) if i < n - 12 else (-0.004 + 0.001 * r),
    'plunge': lambda i, n, r: (0.0030 + 0.004 * r) if i < n - 6 else (-0.030 + 0.002 * r),
}


def make_phase_series(n, seed, plan):
    rnd = _lcg(seed)
    price = 100.0
    closes, highs, lows, vols = [], [], [], []
    for i in range(n):
        price = max(1.0, price * (1 + plan(i, n, next(rnd) - 0.5)))
        closes.append(price)
        highs.append(price * (1 + abs(0.01 * next(rnd)) * 0.5))
        lows.append(price * (1 - abs(0.01 * next(rnd)) * 0.5))
        vols.append(1_000_000 * (0.5 + next(rnd)))
    idx = pd.bdate_range(end='2026-07-16', periods=n)
    return pd.DataFrame({'Close': closes, 'High': highs, 'Low': lows, 'Volume': vols},
                        index=idx)


CASES = []
for _n in (0, 5, 20, 21, 100, 220, 221, 244, 245, 252, 253, 300, 447, 448, 900, 2800):
    for _i, (_shape, _drift, _vol) in enumerate([
        ('random', 0.0006, 0.02),
        ('up', 0.0020, 0.01),
        ('down', 0.0015, 0.01),
        ('flat', 0.0000, 0.00),
        ('spike', 0.0008, 0.01),
        ('dip', 0.0010, 0.01),
    ]):
        CASES.append((f'n{_n}_{_shape}', make_series(_n, 7919 + _n * 13 + _i, _drift, _vol, _shape)))

for _n in (245, 300, 500, 900):
    for _kind, _plan in PHASES.items():
        CASES.append((f'n{_n}_{_kind}', make_phase_series(_n, 1234 + _n, _plan)))


def _close_high_low(d):
    if len(d) == 0:
        return pd.Series(dtype=float), None, None
    return d['Close'], d['High'], d['Low']


# =====================================================================
# 검증
# =====================================================================
def test_price_score_parity():
    """가격 시계열을 쓰는 점수 함수 — 점수·근거 문장이 원본과 완전히 동일해야 한다"""
    diffs = []
    for name, d in CASES:
        close, high, low = _close_high_low(d)
        checks = [
            ('score_momentum', scoring.score_momentum(close), ref_score_momentum(close)),
            ('score_chart', scoring.score_chart(close), ref_score_chart(close)),
            ('score_52w', scoring.score_52w(close, high), ref_score_52w(close, high)),
            ('score_52w(고가없음)', scoring.score_52w(close, None), ref_score_52w(close, None)),
            ('score_volatility', scoring.score_volatility(close), ref_score_volatility(close)),
            ('minervini_stats', scoring.minervini_stats(close, high, low),
             ref_minervini_stats(close, high, low)),
            ('yearly_closes', scoring.yearly_closes(close), ref_yearly_closes(close)),
            ('avg_return3', scoring.avg_return(close, 3), ref_avg_return(close, 3)),
            ('avg_return5', scoring.avg_return(close, 5), ref_avg_return(close, 5)),
            ('avg_return10', scoring.avg_return(close, 10), ref_avg_return(close, 10)),
        ]
        for fn, got, want in checks:
            if got != want:
                diffs.append(f'{name} / {fn}: 새값={got!r} 원본={want!r}')
    assert not diffs, '원본과 다른 결과:\n' + '\n'.join(diffs)


def test_fundamental_score_parity():
    """펀더멘털 점수 함수 — 경계값 포함 전수 비교"""
    diffs = []

    roes = [None, -30.0, -0.1, 0.0, 0.1, 4.9, 5.0, 9.9, 10.0, 14.9, 15.0, 50.0, 123.456]
    for v in roes:
        if scoring.score_roe(v) != ref_score_roe(v):
            diffs.append(f'score_roe({v})')

    growths = [[], [None], [1, 2], [1, 2, 3], [3, 2, 1], [2, 1, 3], [1, 1, 1],
               [None, 1, 2, 3], [1, None, 3], [-5, -3, -1], [0, 0, 0], [1.5, 1.5, 2.5]]
    for v in growths:
        if scoring.score_growth(v) != ref_score_growth(v):
            diffs.append(f'score_growth({v})')

    mcaps = [0, 1, 1199.9, 1200, 4999, 5000, 9999, 10000, 99999, 100000, 1e7]
    for v in mcaps:
        if scoring.score_mcap(v) != ref_score_mcap(v):
            diffs.append(f'score_mcap({v})')

    debts = [None, 0.0, 50.0, 50.1, 100.0, 150.0, 250.0, 250.1, 999.9]
    nets = [[], [None], [100.0], [-100.0], [None, None, 50.0], [10.0, 20.0, -5.0]]
    for d in debts:
        for n in nets:
            if scoring.score_finance(d, n) != ref_score_finance(d, n):
                diffs.append(f'score_finance({d}, {n})')

    pers = [None, -5.0, 0.0, 9.9, 10.0, 15.0, 25.0, 40.0, 40.1, 100.0]
    pbrs = [None, -1.0, 0.0, 0.9, 1.0, 2.0, 4.0, 8.0, 8.1, 30.0]
    for p in pers:
        for b in pbrs:
            if scoring.score_value(p, b) != ref_score_value(p, b):
                diffs.append(f'score_value({p}, {b})')

    dys = [None, -1.0, 0.0, 0.5, 1.0, 1.9, 2.0, 3.9, 4.0, 12.3]
    for v in dys:
        if scoring.score_dividend(v) != ref_score_dividend(v):
            diffs.append(f'score_dividend({v})')

    sds = [None, (5.0, 100.0, 50.0), (3.0, -1.0, 4.0), (1.0, 0.0, 0.0),
           (0.5, 10.0, -3.0), (0.0, -1.0, -1.0), (-0.5, -2.0, 1.0),
           (-1.0, -5.0, -5.0), (-9.9, -1.0, -1.0)]
    for v in sds:
        if scoring.score_supply(v) != ref_score_supply(v):
            diffs.append(f'score_supply({v})')

    assert not diffs, '원본과 다른 결과: ' + ', '.join(diffs)


def test_to_float_parity():
    samples = [None, '', '-', 'N/A', 'nan', 'None', '1,234', '12.5%', ' 3.14 ',
               '10(추정)', '(1.5)', 'abc', 0, 1, -2.5, float('nan'), '1e3', '  ',
               '−5', '1,234,567.89', True, [1, 2]]
    diffs = [repr(s) for s in samples if scoring.to_float(s) != ref_to_float(s)]
    assert not diffs, '원본과 다른 결과: ' + ', '.join(diffs)


def test_numeric_metrics_match_reason_text():
    """새 숫자 지표가 '근거 문장을 정규식으로 파싱한 값'과 정확히 같아야 한다.

    기존 대시보드는 아래 두 정규식으로 필터를 걸었습니다.
    숫자 필드가 이 값과 어긋나면 전고점돌파만·신고가근접만 전략 결과가 조용히 달라집니다.
    """
    diffs = []
    for name, d in CASES:
        close, high, low = _close_high_low(d)

        _, txt52 = ref_score_52w(close, high)
        m = re.search(r'고점대비 (-?\d+(?:\.\d+)?)%', txt52)
        want_pos = float(m.group(1)) if m else None
        got_pos = scoring.pos_52w(close, high)
        if want_pos is None:
            if got_pos is not None:
                diffs.append(f'{name} / 고점대비: 문장에 값 없음인데 {got_pos}')
        elif got_pos is None or float(got_pos) != want_pos:
            diffs.append(f'{name} / 고점대비: 새값={got_pos} 문장파싱={want_pos} ({txt52})')

        _, txt_chart = ref_score_chart(close)
        m = re.search(r'10일고점比 (-?\d+(?:\.\d+)?)%', txt_chart)
        want_dd = float(m.group(1)) if m else None
        got_dd = scoring.drawdown_10d(close)
        if want_dd is None:
            if got_dd is not None:
                diffs.append(f'{name} / 10일고점비: 문장에 값 없음인데 {got_dd}')
        elif got_dd is None or float(got_dd) != want_dd:
            diffs.append(f'{name} / 10일고점비: 새값={got_dd} 문장파싱={want_dd} ({txt_chart})')

    assert not diffs, '숫자 지표 불일치:\n' + '\n'.join(diffs)


def test_metrics_do_not_touch_scores():
    """숫자 지표를 뽑아도 점수 함수 결과가 달라지지 않아야 한다 (부작용 없음 확인)"""
    diffs = []
    for name, d in CASES:
        close, high, low = _close_high_low(d)
        before_52w = scoring.score_52w(close, high)
        before_chart = scoring.score_chart(close)
        scoring.pos_52w(close, high)
        scoring.drawdown_10d(close)
        if scoring.score_52w(close, high) != before_52w:
            diffs.append(f'{name} / score_52w')
        if scoring.score_chart(close) != before_chart:
            diffs.append(f'{name} / score_chart')
    assert not diffs, '지표 추출이 점수를 바꿈: ' + ', '.join(diffs)


TESTS = [test_price_score_parity, test_fundamental_score_parity, test_to_float_parity,
         test_numeric_metrics_match_reason_text, test_metrics_do_not_touch_scores]


if __name__ == '__main__':
    failed = 0
    print(f'합성 시계열 {len(CASES)}종으로 비교합니다.')
    for t in TESTS:
        try:
            t()
            print(f'  통과  {t.__name__}')
        except AssertionError as e:
            failed += 1
            print(f'  실패  {t.__name__}\n{e}')
    print(f'\n{len(TESTS) - failed}/{len(TESTS)} 통과')
    sys.exit(1 if failed else 0)
