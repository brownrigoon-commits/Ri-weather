# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 미국 (S&P500 + 야후 파이낸스 + 네이버 한글명)

원본 `기업분석표_생성.py` 의 미국 수집부를 그대로 옮겼습니다.
재시도 로직(야후 레이트리밋 2회 재시도, 주가 개별 재시도)도 원본 그대로 유지합니다.

import 시점에는 네트워크를 쓰지 않습니다(호출은 함수 안에서만).
"""

import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import FinanceDataReader as fdr
import pandas as pd
import requests
import yfinance as yf

from .config import EXCHANGE_KO, UA, US_SECTOR_KO, US_SYMBOL_FIX
from .scoring import to_float


def to_yahoo_symbol(sym):
    return US_SYMBOL_FIX.get(sym, sym.replace('.', '-'))


def get_usdkrw():
    """달러/원 환율 (시총 조원 환산용)"""
    try:
        df = fdr.DataReader('USD/KRW')
        return float(df['Close'].iloc[-1])
    except Exception:
        try:
            t = yf.Ticker('KRW=X')
            return float(t.fast_info['last_price'])
        except Exception:
            print('  (경고) 환율 조회 실패 → 1,400원 가정')
            return 1400.0


def fetch_us_stock(sym):
    """야후에서 1종목 정보/재무 수집"""
    ysym = to_yahoo_symbol(sym)
    t = yf.Ticker(ysym)
    info = t.info
    mcap = info.get('marketCap')
    if not mcap:
        return None

    rev3, net3 = [], []
    net_by_year = {}                 # {회계연도: 순이익(현지통화)}
    try:
        inc = t.income_stmt          # 연간, 최신 열이 먼저
        if inc is not None and not inc.empty:
            if 'Total Revenue' in inc.index:
                rev3 = [to_float(v) for v in inc.loc['Total Revenue'].dropna().iloc[:3][::-1]]
            for key in ['Net Income', 'Net Income Common Stockholders']:
                if key in inc.index:
                    ser = inc.loc[key].dropna()
                    net3 = [to_float(v) for v in ser.iloc[:3][::-1]]
                    net_by_year = {c.year: to_float(v) for c, v in ser.items()
                                   if to_float(v) is not None}
                    break
    except Exception:
        pass

    roe = info.get('returnOnEquity')
    roe = roe * 100 if roe is not None and abs(roe) < 5 else roe   # 소수→%

    dy = info.get('dividendYield')          # yfinance 신버전은 % 단위
    if dy is not None and dy < 0.35 and info.get('trailingAnnualDividendYield'):
        dy = info['trailingAnnualDividendYield'] * 100

    psr = info.get('priceToSalesTrailing12Months')
    if psr is None and info.get('totalRevenue'):
        psr = mcap / info['totalRevenue']

    return {
        '티커': sym,
        '기업명': info.get('longName') or info.get('shortName') or sym,
        '거래소': EXCHANGE_KO.get(info.get('exchange'), info.get('exchange', '')),
        '국가': info.get('country', ''),
        '산업': info.get('industry', ''),
        '시총_USD': mcap,
        'PER': to_float(info.get('trailingPE')),
        'PBR': to_float(info.get('priceToBook')),
        'ROE': to_float(roe),
        'PEG': to_float(info.get('trailingPegRatio')),
        'EV/EBITDA': to_float(info.get('enterpriseToEbitda')),
        'PSR': to_float(psr),
        '배당수익률': to_float(dy),
        '부채비율': to_float(info.get('debtToEquity')),
        '매출_3y': rev3,
        '순이익_3y': net3,
        '순익연도별': net_by_year,
    }


def naver_us_korean_name(ticker, exchange):
    """네이버 해외증시 API에서 미국 종목 한글명 조회.
    NASDAQ은 '티커.O', NYSE는 티커 그대로, 클래스주(BRKB)는 끝글자 소문자(BRKb)."""
    cands = []
    if exchange == 'NASDAQ':
        cands = [f'{ticker}.O', ticker]
    else:
        cands = [ticker, f'{ticker}.O']
    if len(ticker) >= 3 and ticker[-1].isupper() and ticker in ('BRKB', 'BFB'):
        cands.insert(0, ticker[:-1] + ticker[-1].lower())
    for code in cands:
        try:
            r = requests.get(f'https://api.stock.naver.com/stock/{code}/basic',
                             headers=UA, timeout=8)
            if r.status_code == 200:
                name = (r.json() or {}).get('stockName', '')
                if name:
                    return name
        except Exception:
            pass
    # 폴백: 네이버 자동완성 검색 (일부 종목은 basic이 409를 반환)
    try:
        r = requests.get(f'https://ac.stock.naver.com/ac?q={ticker}&target=stock',
                         headers=UA, timeout=8)
        if r.status_code == 200:
            for it in (r.json() or {}).get('items', []):
                code = str(it.get('code', '')).upper()
                if it.get('nationCode') == 'USA' and code in (c.upper() for c in cands):
                    return it.get('name', '')
    except Exception:
        pass
    return ''


def fetch_us_korean_names(df):
    """상위 300종목 한글명 병렬 수집 → '한글명' 컬럼"""
    print('  한글 종목명 수집 (네이버, 병렬)...')
    names = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(naver_us_korean_name, r['티커'], r['거래소']): r['티커']
                for _, r in df.iterrows()}
        for fut in as_completed(futs):
            try:
                names[futs[fut]] = fut.result()
            except Exception:
                names[futs[fut]] = ''
    df['한글명'] = df['티커'].map(names).fillna('')
    miss = int((df['한글명'] == '').sum())
    if miss:
        print(f'  (참고) 한글명 미확인 {miss}종목 (영문명만 표시)')
    return df


def build_us_universe(top_n, sample=None):
    print('\n[미국 1/4] S&P500 구성종목 로딩...')
    spx = fdr.StockListing('S&P500')
    symbols = list(spx['Symbol'].astype(str))
    sector_map = dict(zip(spx['Symbol'], spx['Sector']))
    if sample:
        symbols = symbols[:max(sample * 3, 30)]
    print(f'  대상 {len(symbols)}종목 → 야후 파이낸스 정보 수집 (병렬)...')

    rows, fails = [], []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(fetch_us_stock, s): s for s in symbols}
        done = 0
        for fut in as_completed(futs):
            s = futs[fut]
            done += 1
            if done % 50 == 0:
                print(f'  진행: {done}/{len(symbols)}')
            try:
                r = fut.result()
                if r:
                    gics = sector_map.get(s, '')
                    r['섹터'] = US_SECTOR_KO.get(gics, gics or '기타')
                    rows.append(r)
                else:
                    fails.append(s)
            except Exception:
                fails.append(s)

    # 일시 오류(레이트리밋 등) 재시도 — 순차, 2회
    for attempt in range(2):
        if not fails:
            break
        time.sleep(3)
        retry, fails = fails, []
        for s in retry:
            try:
                r = fetch_us_stock(s)
                if r:
                    gics = sector_map.get(s, '')
                    r['섹터'] = US_SECTOR_KO.get(gics, gics or '기타')
                    rows.append(r)
                else:
                    fails.append(s)
            except Exception:
                fails.append(s)
            time.sleep(0.5)
    if fails:
        print(f'  (참고) 수집 실패 {len(fails)}종목: {", ".join(fails[:10])}'
              + (' ...' if len(fails) > 10 else ''))
    if not rows:
        raise RuntimeError('미국 종목 정보를 한 건도 수집하지 못했습니다 (야후 차단 또는 네트워크 문제)')
    df = pd.DataFrame(rows).sort_values('시총_USD', ascending=False).head(top_n if not sample else sample)
    df = df.reset_index(drop=True)
    df.insert(0, '시총순위', range(1, len(df) + 1))
    print(f'  시총 상위 {len(df)}종목 확정')
    return df


def fetch_prices_batch(ysymbols, label):
    """야후 배치 다운로드 → {심볼: DataFrame(Close, High)}"""
    print(f'  {label} 주가 일괄 다운로드 ({len(ysymbols)}종목, 2015~현재)...')
    out = {}
    CHUNK = 100
    for i in range(0, len(ysymbols), CHUNK):
        chunk = ysymbols[i:i + CHUNK]
        try:
            data = yf.download(chunk, start='2014-12-01', auto_adjust=True,
                               group_by='ticker', threads=True, progress=False)
        except Exception as e:
            print(f'  (경고) 다운로드 실패 청크 {i//CHUNK + 1}: {e}')
            continue
        for s in chunk:
            try:
                d = data[s][['Close', 'High', 'Low', 'Volume']].dropna(subset=['Close']) \
                    if len(chunk) > 1 \
                    else data[['Close', 'High', 'Low', 'Volume']].dropna(subset=['Close'])
                if len(d):
                    out[s] = d
            except Exception:
                pass
        print(f'  진행: {min(i + CHUNK, len(ysymbols))}/{len(ysymbols)}')

    # 누락 종목 개별 재시도 (야후 캐시 잠금 등 일시 오류 대응)
    missing = [s for s in ysymbols if s not in out]
    for s in missing:
        for _ in range(2):
            try:
                d = yf.download(s, start='2014-12-01', auto_adjust=True,
                                threads=False, progress=False)
                if d is not None and len(d):
                    if isinstance(d.columns, pd.MultiIndex):
                        d.columns = d.columns.get_level_values(0)
                    out[s] = d[['Close', 'High', 'Low', 'Volume']].dropna(subset=['Close'])
                    break
            except Exception:
                pass
            time.sleep(1.5)
    still = [s for s in ysymbols if s not in out]
    if still:
        print(f'  (경고) 주가 수집 실패 {len(still)}종목: {", ".join(still[:10])}')
    return out
