# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 평가 (1차 점수 → 뉴스·수급 → 총점)

원본 `기업분석표_생성.py` 의 `evaluate_stocks` / `news_supply_stage` 를 그대로 옮겼습니다.
계산은 한 줄도 바꾸지 않았고, **숫자 지표 두 개만 추가로 저장**합니다.

  · `고점대비(%)`   = score_52w 가 쓰는 pos (현재가 ÷ 52주고가 × 100)
  · `10일고점비(%)` = score_chart 가 쓰는 drawdown (최근 10일 고점 대비 %)

기존 대시보드는 이 값을 "고점대비 92%" 같은 한글 문장에서 정규식으로 뽑아 썼습니다.
문장이 조금만 바뀌면 전략이 조용히 빈 결과를 냈으므로, 이제 값 자체를 저장합니다.
점수 계산에는 아무 영향이 없습니다(읽기만 함).
"""

import time

import pandas as pd

from .config import (ITEMS_1ST, NET5_LABELS, PICK_PER_SECTOR, TOTAL_MAX,
                     W1_MAX, WEIGHTS, YEARS)
from .news import collect_headlines, rule_analyze_news
from .scoring import (avg_return, drawdown_10d, minervini_stats, pos_52w,
                      score_52w, score_chart, score_dividend, score_finance,
                      score_growth, score_mcap, score_momentum, score_roe,
                      score_supply, score_value, score_volatility,
                      yearly_closes)


def evaluate_stocks(df, prices, mcap_eok_col, is_kr):
    """모든 종목에 1차 점수(원점수 87점) 계산.
    항목별 점수는 10점 만점으로 환산해 저장하고, 총점은 가중치로 재합산."""
    recs = []
    mnv_cnts, mnv_details = [], []
    for _, r in df.iterrows():
        d = prices.get(r['_yf'])
        close = d['Close'] if d is not None else pd.Series(dtype=float)
        high = d['High'] if d is not None else None
        low = d['Low'] if d is not None and 'Low' in d.columns else None
        volume = d['Volume'] if d is not None and 'Volume' in d.columns else None

        raw, det = {}, {}
        raw['모멘텀'], det['모멘텀'] = score_momentum(close)
        raw['차트'], det['차트'] = score_chart(close)
        raw['ROE'], det['ROE'] = score_roe(r['ROE'])
        raw['매출성장'], det['매출성장'] = score_growth(r['매출_3y'])
        raw['순익성장'], det['순익성장'] = score_growth(r['순이익_3y'])
        raw['시총'], det['시총'] = score_mcap(r[mcap_eok_col]), ''
        raw['재무'], det['재무'] = score_finance(r['부채비율'], r['순이익_3y'])
        raw['52주'], det['52주'] = score_52w(close, high)
        raw['저변동'], det['저변동'] = score_volatility(close)
        raw['밸류'], det['밸류'] = score_value(r['PER'], r['PBR'])
        raw['배당'], det['배당'] = score_dividend(r['배당수익률'])
        raw_total = sum(raw.values())

        rec = {}
        for it in ITEMS_1ST:                       # 10점 만점 환산 표시값
            rec[f'점수_{it}'] = round(raw[it] / WEIGHTS[it] * 10, 1)
        rec.update({
            '모멘텀근거': det['모멘텀'], '차트근거': det['차트'],
            '매출근거': det['매출성장'], '순익근거': det['순익성장'],
            '재무근거': det['재무'], '52주근거': det['52주'], '변동근거': det['저변동'],
            '밸류근거': det['밸류'], '배당근거': det['배당'],
            '1차원점수': raw_total,
            '평가점수(1차)': round(raw_total / W1_MAX * 100, 1),
            '3년수익률': avg_return(close, 3),
            '5년수익률': avg_return(close, 5),
            '10년수익률': avg_return(close, 10),
        })
        # 추가 지표 — 미네르비니/CANSLIM/마법공식/거래량 전략용
        cnt, mnv_d = minervini_stats(close, high, low)
        mnv_cnts.append(cnt)
        mnv_details.append(mnv_d)

        mom_raw = None
        if len(close) >= 253:
            mom_raw = round(float((close.iloc[-21] / close.iloc[-253] - 1) * 100), 1)
        vol_ratio = None
        if volume is not None:
            v = volume.dropna()
            if len(v) >= 2 and float(v.iloc[-2]) > 0:
                vol_ratio = round(float(v.iloc[-1]) / float(v.iloc[-2]) * 100, 0)
        nets = [v for v in r['순이익_3y'] if v is not None]
        growth = None
        if len(nets) >= 2:
            prev, last = nets[-2], nets[-1]
            if prev > 0:
                growth = round((last / prev - 1) * 100, 1)
            elif last > 0:
                growth = 999.0            # 흑자전환
        rec.update({
            '모멘텀12M(%)': mom_raw,
            '거래량비(%)': vol_ratio,
            '순익성장률(%)': growth,
            'ROE(%)': r['ROE'],
            'PER(배)': r['PER'],
        })

        # ▼ 숫자 지표 (점수에는 영향 없음 — 필터·정렬이 문장 대신 이 값을 본다)
        rec.update({
            '고점대비(%)': pos_52w(close, high),
            '10일고점비(%)': drawdown_10d(close),
        })

        yc = yearly_closes(close)
        for y in YEARS:
            rec[str(y)] = yc.get(y)

        # 순이익 최근 회계연도 5칸 (억원, 오래된→최근. 소스가 4개년이면 첫 칸 공란)
        nets = r.get('순익연도별') or {}
        ys = sorted(y for y in nets.keys() if nets[y] is not None)[-5:]
        rec['순익연도'] = f'{ys[0]}~{ys[-1]}' if ys else ''
        vals5 = [None] * (5 - len(ys)) + [round(nets[y]) for y in ys]
        for lab, v in zip(NET5_LABELS, vals5):
            rec[lab] = v
        recs.append(rec)

    if recs:
        for c in recs[0].keys():
            df[c] = [rec[c] for rec in recs]
        # 미네르비니 확정: 정적 5조건 + RS(12개월 모멘텀) 시장 내 상위 30%
        rs_pct = df['모멘텀12M(%)'].rank(pct=True)
        flags, details = [], []
        for i in range(len(df)):
            cnt = mnv_cnts[i]
            p = rs_pct.iloc[i]
            rs_ok = pd.notna(p) and p >= 0.7
            ok = (cnt == 5) and rs_ok
            flags.append('O' if ok else 'X')
            rs_txt = f', RS {p * 100:.0f}pct' if pd.notna(p) else ''
            details.append(f'{cnt if cnt is not None else "-"}/5조건{rs_txt} ({mnv_details[i]})')
        df['미네르비니'] = flags
        df['미네르비니근거'] = details
    return df


def news_supply_stage(df, is_kr, no_news):
    """섹터별 1차점수 상위 PICK_PER_SECTOR 종목에 뉴스(+한국 수급) 분석 → 총점.
    점수_뉴스/점수_수급은 10점 만점 표시값, 총점(100)은 가중치 합산 후 100점 환산."""
    df['점수_뉴스'] = None
    df['호재요약'] = ''
    df['악재탐지'] = False
    df['악재사유'] = ''
    df['점수_수급'] = None
    df['수급근거'] = ''
    df['총점(100)'] = None

    def set_total(i, news_raw, sup_raw):
        total_raw = df.loc[i, '1차원점수'] + news_raw + sup_raw
        df.loc[i, '총점(100)'] = round(total_raw / TOTAL_MAX * 100, 1)

    cand_idx = []
    for sec, g in df.groupby('섹터'):
        cand_idx += list(g.sort_values('1차원점수', ascending=False).head(PICK_PER_SECTOR).index)

    n = len(cand_idx)
    if no_news:
        print(f'  뉴스/수급 생략(--no-news) → 1차점수만 사용 ({n}종목)')
        for i in cand_idx:
            sup_raw, sup_d = score_supply(None)
            df.loc[i, '점수_뉴스'] = 0.0
            df.loc[i, '점수_수급'] = round(sup_raw / WEIGHTS['수급'] * 10, 1)
            df.loc[i, '수급근거'] = sup_d
            set_total(i, 0, sup_raw)
        return df

    # 수급은 실제로 쓸 때만 불러온다 (--no-news 는 fdr/yfinance 없이도 돌아가도록)
    from .sources_kr import supply_demand_5d

    print(f'  섹터별 상위 후보 {n}종목 뉴스{"·수급" if is_kr else ""} 분석...')
    for k, i in enumerate(cand_idx, 1):
        r = df.loc[i]
        name = r['기업명']
        code6 = r['티커'] if is_kr else None
        try:
            headlines = collect_headlines(name, code6)
            na = rule_analyze_news(name, headlines)
        except Exception:
            na = {'is_bad_news': False, 'bad_news_reason': '',
                  'good_news_score': 0, 'good_news_summary': ''}
        news_raw = round(min(10, na['good_news_score']) * 1.2, 1)   # 원점수 0~12

        sd = supply_demand_5d(code6) if is_kr else None
        sup_raw, sup_d = score_supply(sd)                            # 원점수 0~13

        df.loc[i, '점수_뉴스'] = round(news_raw / WEIGHTS['뉴스'] * 10, 1)
        df.loc[i, '호재요약'] = na['good_news_summary']
        df.loc[i, '악재탐지'] = na['is_bad_news']
        df.loc[i, '악재사유'] = na['bad_news_reason']
        df.loc[i, '점수_수급'] = round(sup_raw / WEIGHTS['수급'] * 10, 1)
        df.loc[i, '수급근거'] = sup_d
        set_total(i, news_raw, sup_raw)
        if k % 20 == 0:
            print(f'  진행: {k}/{n}')
        time.sleep(0.25)
    return df
