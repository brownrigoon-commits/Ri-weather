# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 한국 (KRX 전종목 + 네이버금융 크롤링)

원본 `기업분석표_생성.py` 의 한국 수집부를 그대로 옮겼습니다.

⚠ 네이버금융은 해외(깃허브 액션) IP를 차단할 수 있습니다.
   재무가 **한 종목도** 수집되지 않으면 빈 데이터를 만들지 않고 예외를 던집니다.
   pipeline 이 이를 받아 기존 `stocks_KR.json` 을 그대로 두고 manifest 에 사유만 남깁니다.

import 시점에는 네트워크를 쓰지 않습니다(호출은 함수 안에서만).
"""

import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import FinanceDataReader as fdr
import pandas as pd
import requests
import yfinance as yf
from bs4 import BeautifulSoup

from .config import KR_SECTOR_OVERRIDE, KR_SECTOR_RULES, UA
from .scoring import to_float


def map_kr_sector(krx_sector, name=''):
    if name in KR_SECTOR_OVERRIDE:
        return KR_SECTOR_OVERRIDE[name]
    s = str(krx_sector) + ' ' + str(name)
    for label, kws in KR_SECTOR_RULES:
        if any(kw in s for kw in kws):
            return label
    return '기타'


def naver_fundamentals(code6):
    """네이버 종목 메인 페이지: PER/PBR/배당수익률/ROE/부채비율/매출·순이익 3년"""
    url = f'https://finance.naver.com/item/main.nhn?code={code6}'
    try:
        res = requests.get(url, headers=UA, timeout=10)
        if res.status_code != 200:
            return None
        soup = BeautifulSoup(res.text, 'html.parser')
    except Exception:
        return None

    def em_val(em_id):
        node = soup.select_one(f'em#{em_id}')
        return to_float(node.text) if node else None

    per = em_val('_per')
    pbr = em_val('_pbr')
    dvr = em_val('_dvr')

    roe = debt = None
    sales_vals, net_vals = [], []
    try:
        cop = soup.select_one('div.section.cop_analysis')
        if cop:
            rows = cop.select('table')[0].select('tr')

            def find_row(keyword):
                for r in rows:
                    th = r.select_one('th')
                    if th and keyword in th.get_text(strip=True):
                        vals = [to_float(td.get_text(strip=True)) for td in r.select('td')]
                        return [v for v in vals if v is not None]
                return []

            sales_vals = find_row('매출액')
            net_vals = find_row('당기순이익') or find_row('순이익')
            d = find_row('부채비율')
            if d:
                debt = d[-1]
            r_ = find_row('ROE')
            if r_:
                roe = r_[-1]
    except Exception:
        pass

    return {'PER': per, 'PBR': pbr, '배당수익률': dvr, 'ROE': roe, '부채비율': debt,
            '매출_3y': sales_vals[:3], '순이익_3y': net_vals[:3]}


def supply_demand_5d(code6):
    """한국: 최근 5일 기관+외국인 순매수/거래량 비율"""
    try:
        r = requests.get(f'https://finance.naver.com/item/frgn.naver?code={code6}',
                         headers=UA, timeout=10)
        soup = BeautifulSoup(r.text, 'html.parser')
        tables = soup.select('table.type2')
        if not tables:
            return None
        days = 0
        vol_sum = inst_sum = frgn_sum = 0.0
        for tr in tables[-1].select('tr'):
            tds = [td.get_text(strip=True) for td in tr.select('td')]
            if len(tds) >= 9 and tds[0] and '.' in tds[0]:
                vol_sum += to_float(tds[4].replace('+', '')) or 0
                inst_sum += to_float(tds[5].replace('+', '')) or 0
                frgn_sum += to_float(tds[6].replace('+', '')) or 0
                days += 1
                if days >= 5:
                    break
        if days == 0 or vol_sum <= 0:
            return None
        return (inst_sum + frgn_sum) / vol_sum * 100, inst_sum, frgn_sum
    except Exception:
        return None


def fetch_kr_net_by_year(ysym):
    """한국 종목 연도별 순이익 (야후, KRW → 억원)"""
    try:
        inc = yf.Ticker(ysym).income_stmt
        if inc is None or inc.empty:
            return {}
        for key in ['Net Income', 'Net Income Common Stockholders']:
            if key in inc.index:
                ser = inc.loc[key].dropna()
                return {c.year: to_float(v) / 1e8 for c, v in ser.items()
                        if to_float(v) is not None}
    except Exception:
        pass
    return {}


def fetch_kr_net_by_year_all(ysymbols):
    """연도별 순이익 병렬 수집 → {야후심볼: {연도: 억원}}"""
    print('  연도별 순이익 수집 (야후, 병렬)...')
    nets = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(fetch_kr_net_by_year, s): s for s in ysymbols}
        for fut in as_completed(futs):
            try:
                nets[futs[fut]] = fut.result()
            except Exception:
                nets[futs[fut]] = {}
    return nets


def build_kr_universe(top_n, sample=None):
    print('\n[한국 1/4] KRX 전종목 로딩...')
    krx = fdr.StockListing('KRX')
    krx['Code6'] = krx['Code'].astype(str).str.zfill(6)

    # 우선주/스팩 제외 (기업 단위 분석)
    mask = ~krx['Name'].str.contains('스팩', na=False)
    mask &= ~krx['Name'].str.match(r'.*\d+우(B|C)?$', na=False)
    mask &= ~krx['Name'].str.endswith(('우', '우B', '우C'), na=False)
    mask &= krx['Market'].isin(['KOSPI', 'KOSDAQ', 'KOSDAQ GLOBAL'])
    krx = krx[mask].copy()

    krx = krx.sort_values('Marcap', ascending=False).head(top_n if not sample else sample)
    krx = krx.reset_index(drop=True)

    # 업종 정보 병합 (KRX-DESC의 'Industry'가 업종명, 'Sector'는 소속부)
    try:
        desc = fdr.StockListing('KRX-DESC')
        desc['Code6'] = desc['Code'].astype(str).str.zfill(6)
        sec_map = dict(zip(desc['Code6'], desc['Industry'].fillna('').astype(str)))
    except Exception as e:
        print(f'  (경고) KRX-DESC 업종 로딩 실패: {e}')
        sec_map = {}

    n = len(krx)
    if n == 0:
        raise RuntimeError('KRX 종목 목록이 비어 있습니다 (FinanceDataReader 응답 확인 필요)')
    print(f'  시총 상위 {n}종목 → 네이버 재무 크롤링...')
    rows = []
    fund_ok = 0
    for i, r in krx.iterrows():
        if (i + 1) % 50 == 0:
            print(f'  진행: {i + 1}/{n}')
        code6 = r['Code6']
        f = naver_fundamentals(code6) or {}
        if any(f.get(k) is not None for k in ('PER', 'PBR', 'ROE', '부채비율')) \
                or f.get('매출_3y') or f.get('순이익_3y'):
            fund_ok += 1
        industry = sec_map.get(code6, '')
        mcap_eok = float(r['Marcap']) / 1e8
        sales3 = f.get('매출_3y', [])
        psr = None
        if sales3 and sales3[-1]:
            psr = round(mcap_eok / sales3[-1], 2)
        rows.append({
            '시총순위': i + 1,
            '티커': code6,
            '기업명': r['Name'],
            '거래소': r['Market'],
            '국가': '한국',
            '섹터': map_kr_sector(industry, r['Name']),
            '산업': industry,
            '시총_KRW': float(r['Marcap']),
            'PER': f.get('PER'),
            'PBR': f.get('PBR'),
            'ROE': f.get('ROE'),
            'PEG': None,
            'EV/EBITDA': None,
            'PSR': psr,
            '배당수익률': f.get('배당수익률'),
            '부채비율': f.get('부채비율'),
            '매출_3y': sales3,
            '순이익_3y': f.get('순이익_3y', []),
        })
        time.sleep(0.1)

    # 네이버가 통째로 막힌 경우 — 빈 데이터로 기존 결과를 덮어쓰지 않도록 여기서 멈춘다
    if fund_ok == 0:
        raise RuntimeError(
            f'네이버금융 재무를 한 종목도 읽지 못했습니다 ({n}종목 시도). '
            '해외 IP 차단으로 보입니다 — 기존 한국 데이터를 유지합니다.')
    if fund_ok < n * 0.5:
        print(f'  (경고) 재무 수집 성공 {fund_ok}/{n}종목 — 네이버 응답이 불안정합니다')

    return pd.DataFrame(rows), dict(zip(krx['Code6'], krx['Market']))
