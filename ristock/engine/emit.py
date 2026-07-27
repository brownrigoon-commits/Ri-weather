# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — JSON 산출 (설계서 2.1 / 2.2 / 2.3 규격)

DataFrame(평가 완료) → `stocks_KR.json` / `stocks_US.json` / `manifest.json` / `market.json`.

두 가지를 특히 조심합니다.

1. **정렬 규칙** — `종목` 배열은 `섹터별(시총합 내림차순) → 총점 내림차순` 입니다.
   엑셀 `기업분석` 시트와 **완전히 같은 pandas 호출**을 써서 동점 종목의 순서까지 재현합니다.
   (기존 대시보드는 이 시트를 읽어 전략을 돌렸습니다. 순서가 다르면 정답지가 재현되지 않습니다.)
2. **원자적 쓰기** — 임시 파일에 쓰고 `os.replace` 로 바꿉니다.
   중간에 죽어도 반쯤 쓰인 JSON 이 남지 않습니다.
"""

import json
import math
import os
import shutil

import pandas as pd

from .config import (ARCHIVE_DIRNAME, DATA_VERSION, MANIFEST_FILE, MARKET_FILE,
                     METRIC_COLS, NET5_LABELS, REASON_COLS, SCORE_ITEMS,
                     STOCKS_FILE, WEIGHTS, YEARS)


# =========================
# 파일 입출력
# =========================
def write_json(path, data):
    """임시 파일에 쓰고 교체 (반쯤 쓰인 파일이 남지 않도록)"""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = f'{path}.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)
    return path


def load_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


# =========================
# 값 정리
# =========================
def _num(v):
    """숫자 아니면 None. NaN·inf 도 None (JSON 에 NaN 을 넣으면 앱이 죽습니다)"""
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return int(f) if isinstance(v, int) else f


def _txt(v):
    if v is None:
        return ''
    try:
        if pd.isna(v):
            return ''
    except (TypeError, ValueError):
        pass
    return str(v)


def _is_evaluated(r):
    v = r.get('총점(100)')
    return v is not None and pd.notna(v)


# =========================
# 종목 레코드 (설계서 2.2)
# =========================
def stock_record(r):
    """DataFrame 한 행 → JSON 종목 레코드"""
    rec = {
        '티커': _txt(r.get('티커')),
        '기업명': _txt(r.get('기업명')),
        '한글명': _txt(r.get('한글명')),
        '섹터': _txt(r.get('섹터')),
        '산업': _txt(r.get('산업')),
        '거래소': _txt(r.get('거래소')),
        '시총순위': int(r['시총순위']) if _num(r.get('시총순위')) is not None else None,
        '시총조원': round(float(r['시총_조원']), 1) if _num(r.get('시총_조원')) is not None else None,
        '평가': bool(_is_evaluated(r)),
    }

    # 점수·근거·총점은 평가 종목만 (미평가 종목은 뉴스·수급을 돌리지 않았습니다)
    if rec['평가']:
        rec['총점'] = _num(r.get('총점(100)'))
        rec['점수'] = {it: _num(r.get(f'점수_{it}')) for it in SCORE_ITEMS}
        rec['근거'] = {key: _txt(r.get(col)) for key, col in REASON_COLS.items()}

    rec['지표'] = {key: _num(r.get(col)) for key, col in METRIC_COLS.items()}
    rec['미네르비니'] = _txt(r.get('미네르비니'))
    rec['호재'] = _txt(r.get('호재요약'))
    rec['악재'] = _txt(r.get('악재사유'))
    rec['순익'] = {
        '연도': _txt(r.get('순익연도')),
        '값': [_num(r.get(lab)) for lab in NET5_LABELS],
    }
    rec['연도별종가'] = {str(y): _num(r.get(str(y))) for y in YEARS
                     if _num(r.get(str(y))) is not None}
    rec['수익률'] = {
        '3년': _num(r.get('3년수익률')),
        '5년': _num(r.get('5년수익률')),
        '10년': _num(r.get('10년수익률')),
    }
    return rec


def sector_order(df):
    """섹터 순서 = 섹터별 시총 합계 내림차순 (엑셀 시트2·시트3 과 동일)"""
    return list(df.groupby('섹터')['시총_조원'].sum().sort_values(ascending=False).index)


def ordered_rows(df):
    """섹터별 → 총점 내림차순. 평가 종목을 먼저 놓고 미평가 종목은 시총순위 순으로 뒤에 붙입니다.
    (엑셀 `기업분석` 시트와 같은 정렬 호출을 써서 동점 순서까지 같게 만듭니다)"""
    evaluated = df[df['총점(100)'].notna()]
    rest = df[df['총점(100)'].isna()]
    rows = []
    for sec in sector_order(df):
        g = evaluated[evaluated['섹터'] == sec]
        if not g.empty:
            for _, r in g.sort_values('총점(100)', ascending=False).iterrows():
                rows.append(r)
        g2 = rest[rest['섹터'] == sec]
        if not g2.empty:
            for _, r in g2.sort_values('시총순위').iterrows():
                rows.append(r)
    return rows


def build_stocks_payload(df, market, 기준일, 생성시각, 원본=''):
    """설계서 2.2 규격 dict"""
    return {
        '시장': market,
        '기준일': 기준일,
        '생성시각': 생성시각,
        '원본': 원본,
        '가중치': dict(WEIGHTS),
        '종목': [stock_record(r) for r in ordered_rows(df)],
    }


def write_stocks(df, market, out_dir, 기준일, 생성시각, 원본=''):
    """stocks_KR.json / stocks_US.json 저장 → (경로, 종목수, 평가종목수)"""
    payload = build_stocks_payload(df, market, 기준일, 생성시각, 원본)
    path = os.path.join(out_dir, STOCKS_FILE[market])
    write_json(path, payload)
    n_all = len(payload['종목'])
    n_eval = sum(1 for s in payload['종목'] if s['평가'])
    return path, n_all, n_eval


def write_market(summary, out_dir):
    """market.json 저장 (news.collect_market_summary 결과 그대로)"""
    return write_json(os.path.join(out_dir, MARKET_FILE), summary)


# =========================
# manifest (설계서 2.1)
# =========================
def previous_manifest(out_dir):
    return load_json(os.path.join(out_dir, MANIFEST_FILE), default={}) or {}


def build_manifest(시장, 기준일, 생성시각, 주체, 성공, 메모=''):
    return {
        '데이터버전': DATA_VERSION,
        '생성시각': 생성시각,
        '기준일': 기준일,
        '시장': 시장,
        '실행': {'주체': 주체, '성공': bool(성공), '메모': 메모},
    }


def write_manifest(out_dir, 시장, 기준일, 생성시각, 주체, 성공, 메모=''):
    data = build_manifest(시장, 기준일, 생성시각, 주체, 성공, 메모)
    return write_json(os.path.join(out_dir, MANIFEST_FILE), data)


def market_entry(파일, 종목수, 평가종목수, 원본, 수집시각):
    return {'파일': 파일, '종목수': 종목수, '평가종목수': 평가종목수,
            '원본': 원본, '수집시각': 수집시각}


# =========================
# 날짜별 보관
# =========================
def archive(out_dir, 기준일, filenames):
    """<out>/archive/YYYYMMDD/ 에 같은 이름으로 복사"""
    dst_dir = os.path.join(out_dir, ARCHIVE_DIRNAME, 기준일)
    os.makedirs(dst_dir, exist_ok=True)
    saved = []
    for name in filenames:
        src = os.path.join(out_dir, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(dst_dir, name))
            saved.append(name)
    return dst_dir, saved
