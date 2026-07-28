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
import re
import shutil

import pandas as pd

from .config import (ARCHIVE_DIRNAME, DATA_VERSION, MANIFEST_FILE, MARKET_FILE,
                     METRIC_COLS, NET5_LABELS, REASON_COLS, SCORE_ITEMS,
                     STOCKS_FILE, WEIGHTS, YEARS)

# 전일 대비 변화 (설계서 2.5) · 전략 정의 — 앱이 이 이름으로 읽습니다(`js/data.js`)
CHANGES_FILE = 'changes.json'
STRATEGIES_FILE = 'strategies.json'

# 변화 계산의 비교 대상 (설계서 2.6). 앱은 읽지 않습니다 — 엔진 전용입니다.
PICKS_BASELINE_FILE = 'picks_baseline.json'

# `ristock/data/*.json` 은 GitHub Pages 로 **누구나 열 수 있는 주소**에 서빙됩니다.
# 앱 화면을 거치지 않고 파일만 곧바로 열면 화면 하단 고지가 따라가지 않으므로
# 데이터 자체에도 한 줄 심어 둡니다 (설계서 5장 — 앱·데이터 양쪽에 고지).
고지문 = ('본 자료는 공개 데이터를 기계적으로 집계한 스크리닝 참고자료일 뿐이며, '
        '투자 권유가 아닙니다. 투자 판단과 그 결과는 이용자 본인에게 있습니다.')


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
    """뉴스·수급 분석을 돌린 종목인가 (= `기업분석` 시트에 실린 종목인가)."""
    v = r.get('총점(100)')
    return v is not None and pd.notna(v)


def total_from_scores(점수):
    """총점(100) — 엑셀 `기업분석` 시트의 총점 수식과 **글자 그대로 같은 식**.

        총점 = round( Σ(항목 10점점수 × 가중치) ÷ 10 ÷ Σ가중치 × 100 , 1 )

    옛 대시보드 `app.py.parse_analysis_sheet()` 가 쓰던 식이 바로 이것이고,
    전략 결과(정답지)의 총점도 전부 이 값입니다.

    ⚠ `evaluate_stocks` 가 DataFrame 에 들고 있는 `총점(100)` 을 그대로 쓰면 안 됩니다.
       그 값은 **반올림 전 원점수**(1차원점수 + 뉴스 + 수급)로 계산한 것이라,
       항목을 10점 만점으로 환산·반올림한 뒤 다시 가중합한 이 값과 어긋납니다
       (실측: 종목의 약 절반에서 최대 0.3점 차이).
       총점은 화면에 그대로 보이고 모든 순위 기준의 2차 정렬 키이므로,
       한쪽만 달라지면 앱 총점 ≠ 엑셀 총점이 되고 전략 순서까지 바뀝니다.
    """
    wsum = sum(w for w in WEIGHTS.values() if w)
    if not wsum:
        return None
    sp = sum((점수.get(it) or 0) * WEIGHTS[it] for it in SCORE_ITEMS if WEIGHTS[it])
    return round(sp / 10 / wsum * 100, 1)


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
        점수 = {it: _num(r.get(f'점수_{it}')) for it in SCORE_ITEMS}
        rec['총점'] = total_from_scores(점수)      # 엑셀·정답지와 같은 식으로 재계산
        rec['점수'] = 점수
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
    (엑셀 `기업분석` 시트와 같은 정렬 호출을 써서 동점 순서까지 같게 만듭니다)

    ⚠ 정렬 키는 DataFrame 의 `총점(100)`(원점수 기반) 그대로 두어야 합니다.
       엑셀 시트3 의 **행 순서**가 바로 이 값으로 정해졌고, 옛 대시보드는 그 행 순서를
       읽어 전략을 돌렸기 때문입니다. 화면에 내보내는 `총점` 값만
       `total_from_scores()` 로 다시 계산합니다(엑셀 수식과 같은 식).
       그래서 JSON 안에서 이웃한 두 종목의 `총점` 이 아주 드물게 뒤집혀 보일 수 있는데,
       이는 옛 엑셀·정답지와 **똑같은** 현상입니다. 고치면 오히려 어긋납니다."""
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


def build_stocks_payload(df, market, 기준일, 생성시각, 원본='', 차트=None):
    """설계서 2.2 규격 dict

    `차트` 는 종목 레코드가 아니라 **파일 맨 위에 한 번만** 담습니다(설계서 2.2).
    날짜축을 종목마다 되풀이하지 않으려는 것입니다 — 하루 두 번 커밋되는 파일이라
    같은 날짜 문자열 254벌이면 그대로 저장소 무게가 됩니다.
    """
    payload = {
        '시장': market,
        '기준일': 기준일,
        '생성시각': 생성시각,
        '원본': 원본,
        '고지': 고지문,
        '가중치': dict(WEIGHTS),
        '종목': [stock_record(r) for r in ordered_rows(df)],
    }
    if 차트:
        payload['차트'] = 차트
    return payload


def write_stocks(df, market, out_dir, 기준일, 생성시각, 원본='', 차트=None):
    """stocks_KR.json / stocks_US.json 저장 → (경로, 종목수, 평가종목수)"""
    payload = build_stocks_payload(df, market, 기준일, 생성시각, 원본, 차트)
    path = os.path.join(out_dir, STOCKS_FILE[market])
    write_json(path, payload)
    n_all = len(payload['종목'])
    n_eval = sum(1 for s in payload['종목'] if s['평가'])
    return path, n_all, n_eval


def write_market(summary, out_dir):
    """market.json 저장 (news.collect_market_summary 결과 그대로)"""
    return write_json(os.path.join(out_dir, MARKET_FILE), summary)


def write_changes(변화, out_dir):
    """changes.json 저장 (설계서 2.5 — strategies.변화계산 결과 그대로)"""
    return write_json(os.path.join(out_dir, CHANGES_FILE), 변화)


# =========================
# 전략 선정 기준선 (설계서 2.6 · picks_baseline.json)
# =========================
# **왜 이 파일이 생겼는가**
#
# `changes.json`(어제 대비 신규 편입/이탈)을 만들려면 어제 무엇을 뽑았는지 알아야 합니다.
# 예전에는 그 비교 대상으로 **어제 스냅샷 전체**(stocks_KR/US.json, 약 0.6MB)를 썼고,
# 그것을 `archive/YYYYMMDD/` 에 남겨 매 회차 통째로 커밋했습니다.
# git 이력은 append-only 라 지워도 영원히 남습니다 — 연 40MB 가까이 불어나고,
# 집·회사 두 PC 의 clone·pull 이 그만큼 느려집니다(CLAUDE.md 동시 작업 프로토콜).
#
# 그런데 변화 계산에 **필요한 것은 전략이 뽑은 티커 목록뿐**입니다(≈10KB).
# 그래서 스냅샷 대신 이 파일 하나만 두고 비교합니다.
#
# ── 파일 모양 ────────────────────────────────────────────────────────────
#   {"기준일": "20260726",                     ← 비교 기준(= 어제) 날짜
#    "전략별": {"total": {"한국": [{티커,기업명,섹터}, …], "미국": […]}, …},
#    "시장기준일": {"한국": "20260726", "미국": "20260726"},
#    "대기": {"기준일": "20260727", "전략별": {…}, "시장기준일": {…}}}
#
# `대기` 는 **오늘 뽑은 몫**입니다. 오늘 것을 곧바로 비교 기준에 덮어쓰면,
# 하루에 두 번 도는 날(CI 는 미국·한국을 따로 돌고, 사장님 PC 도 따로 돕니다)의
# 두 번째 회차가 '어제'가 아니라 '오늘 아침'과 비교하게 됩니다.
# 사장님이 보고 싶은 것은 언제나 **어제 대비**이므로, 오늘 몫은 `대기` 에 모아 두었다가
# 날짜가 바뀐 다음 회차에서 비교 기준으로 올립니다(`기준선승격`).
#
# `시장기준일` 을 시장마다 따로 두는 이유는 manifest 와 같습니다 —
# 한국만 며칠 멈춘 날에도 "며칠 전과 비교한 것인지"를 정직하게 적기 위해서입니다.
def load_picks_baseline(out_dir):
    """picks_baseline.json 읽기. 없거나 깨졌으면 빈 dict (첫 실행과 같은 취급)."""
    자료 = load_json(os.path.join(out_dir, PICKS_BASELINE_FILE), default={})
    return 자료 if isinstance(자료, dict) else {}


def write_picks_baseline(out_dir, 기준선):
    return write_json(os.path.join(out_dir, PICKS_BASELINE_FILE), 기준선)


def _칸(값):
    """기준선 안의 한 칸을 dict 로 봅니다 — 모양이 어긋나면 **빈 칸으로 취급**합니다.

    ⚠ 이 방어가 없으면 파일이 **반쯤만** 망가졌을 때가 통째로 망가졌을 때보다 나쁩니다.
      JSON 자체가 깨지면 `load_picks_baseline` 이 빈 dict 를 돌려주어 그날 회차가
      기준선을 새로 만들고 다음 날부터 정상으로 돌아옵니다. 그런데 `대기` 나 `전략별`
      한 칸만 엉뚱한 타입이면 `.get`·`.values` 에서 예외가 나고,
      **그 예외 때문에 기준선을 다시 쓰지 못해** 손상이 영원히 굳습니다
      (= '어제 대비 변화' 카드가 사람이 파일을 지울 때까지 다시는 안 뜹니다).
      그래서 어긋난 칸은 버리고 그 자리를 새로 채웁니다.
    """
    return 값 if isinstance(값, dict) else {}


def 기준선시장기준일(기준선, 시장):
    """그 시장의 비교 기준 날짜. 옛 파일처럼 `시장기준일` 이 없으면 최상단 값으로 봅니다."""
    표 = _칸(_칸(기준선).get('시장기준일'))
    return str(표.get(시장) or _칸(기준선).get('기준일') or '')


def _선정병합(바탕, 새것):
    """`{전략id: {시장: [...]}}` 두 벌을 **시장 단위로** 겹칩니다 (새것 우선).

    한국 수집만 실패한 날 미국 몫만 새로 들어오는데, 통째로 바꿔 버리면
    한국의 비교 기준이 사라져 다음에 한국이 성공해도 비교할 것이 없어집니다.
    """
    합 = {전략id: dict(_칸(시장별)) for 전략id, 시장별 in _칸(바탕).items()}
    for 전략id, 시장별 in _칸(새것).items():
        합.setdefault(전략id, {}).update(_칸(시장별))
    return 합


def 기준선승격(기준선, 기준일):
    """`대기`(지난 회차가 남긴 몫)가 오늘보다 이전이면 비교 기준으로 올립니다.

    - 대기가 오늘 날짜면 그대로 둡니다 → 같은 날 두 번째 회차도 **어제와 비교**합니다.
    - 승격은 시장 단위로 겹칩니다 → 그날 실패했던 시장의 옛 기준은 그대로 살아남습니다.
    """
    기준선 = dict(_칸(기준선))
    대기 = _칸(기준선.get('대기'))
    대기일 = str(대기.get('기준일') or '')
    if not 대기일 or 대기일 >= str(기준일 or ''):
        # 승격은 안 하더라도 **모양은 바로잡아** 돌려줍니다. 그래야 반쯤 망가진 파일이
        # 이 회차에서 정상 모양으로 다시 쓰이고, 손상이 다음 날로 이어지지 않습니다.
        기준선['전략별'] = _선정병합(기준선.get('전략별'), None)
        기준선['시장기준일'] = {k: str(v) for k, v in _칸(기준선.get('시장기준일')).items()}
        기준선['대기'] = 대기
        return 기준선

    시장기준일 = {k: str(v) for k, v in _칸(기준선.get('시장기준일')).items()}
    시장기준일.update({k: str(v) for k, v in _칸(대기.get('시장기준일')).items()})
    전략별 = _선정병합(기준선.get('전략별'), 대기.get('전략별'))

    올라간것 = {'기준일': max(시장기준일.values()) if 시장기준일 else 대기일,
              '전략별': 전략별,
              '시장기준일': 시장기준일}
    return 올라간것


def 기준선반영(기준선, 기준일, 오늘선정):
    """오늘 뽑은 몫을 `대기` 에 모읍니다 (같은 날 여러 회차면 시장 단위로 겹칩니다)."""
    기준선 = dict(_칸(기준선))
    대기 = dict(_칸(기준선.get('대기')))
    if str(대기.get('기준일') or '') != str(기준일 or ''):
        대기 = {'기준일': 기준일, '전략별': {}, '시장기준일': {}}

    대기['전략별'] = _선정병합(대기.get('전략별'), 오늘선정)
    시장기준일 = dict(_칸(대기.get('시장기준일')))
    for 시장별 in _칸(오늘선정).values():
        for 시장 in _칸(시장별):
            시장기준일[시장] = 기준일
    대기['시장기준일'] = 시장기준일

    기준선['대기'] = 대기
    return 기준선


# =========================
# manifest (설계서 2.1)
# =========================
def previous_manifest(out_dir):
    return load_json(os.path.join(out_dir, MANIFEST_FILE), default={}) or {}


def build_manifest(시장, 기준일, 생성시각, 주체, 성공, 메모='',
                   변화파일='', 이전기준일=''):
    data = {
        '데이터버전': DATA_VERSION,
        '생성시각': 생성시각,
        '기준일': 기준일,
        '고지': 고지문,
        '시장': 시장,
        '실행': {'주체': 주체, '성공': bool(성공), '메모': 메모},
    }
    # 전일 대비 변화 — **파일을 실제로 만든 회차에만** 넣습니다.
    # 앱(`js/data.js` 변화파일명)은 이 키가 있을 때만 changes.json 을 읽으므로,
    # 첫 실행처럼 비교 대상이 없을 때는 넣지 않아야 404 가 쌓이지 않습니다.
    if 변화파일:
        data['변화파일'] = 변화파일
    if 이전기준일:
        data['이전기준일'] = 이전기준일
    return data


def write_manifest(out_dir, 시장, 기준일, 생성시각, 주체, 성공, 메모='',
                   변화파일='', 이전기준일=''):
    data = build_manifest(시장, 기준일, 생성시각, 주체, 성공, 메모,
                          변화파일, 이전기준일)
    return write_json(os.path.join(out_dir, MANIFEST_FILE), data)


def market_entry(파일, 종목수, 평가종목수, 원본, 수집시각, 기준일='', 수집주체=''):
    """manifest.시장.<시장> 한 칸.

    `기준일` 을 **시장마다 따로** 들고 있는 것이 핵심입니다.
    한국 수집만 실패한 날에도 한국 칸은 옛 기준일을 그대로 유지해야
    "한국 데이터는 5일 전 것"이라고 정직하게 말할 수 있습니다.

    `수집주체` 는 그 시장을 **누가 받아왔는지**입니다(`pc` / `github-actions`).
    한국 재무·수급은 네이버에서 받는데 네이버는 해외(깃허브) IP 를 막을 수 있어
    한국은 국내 PC 가 주담당, 미국은 깃허브가 주담당입니다.
    이 값이 있어야 깃허브가 "오늘 한국은 이미 국내 PC 가 받았다"를 알고 양보할 수 있습니다.
    """
    return {'파일': 파일, '종목수': 종목수, '평가종목수': 평가종목수,
            '기준일': 기준일, '원본': 원본, '수집시각': 수집시각,
            '수집주체': 수집주체}


def 대표기준일(시장, 기본=''):
    """최상단 `기준일` — **시장별 기준일 중 가장 오래된 값**.

    앱의 신선도 판정(`js/data.js` 신선도)은 이 값 하나만 봅니다.
    그래서 여기에 '오늘'을 그냥 찍어 버리면, 한국 수집이 일주일 멈춰 있어도
    화면에는 "오늘 데이터입니다"라고 나옵니다(2026-07 검증에서 잡힌 사고).
    가장 오래된 시장을 대표값으로 두면 최소한 **낡은 쪽을 기준으로** 경고가 뜹니다.
    """
    날짜 = [(e or {}).get('기준일') for e in (시장 or {}).values()
           if isinstance(e, dict) and (e or {}).get('기준일')]
    return min(날짜) if 날짜 else 기본


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


ARCHIVE_KEEP = 60          # 기본 보관 개수 (--archive-keep 로 바꿉니다)


def archive_dates(out_dir):
    """`archive/` 안의 날짜 폴더 이름 오름차순. YYYYMMDD 형태만 셉니다."""
    root = os.path.join(out_dir, ARCHIVE_DIRNAME)
    if not os.path.isdir(root):
        return []
    return sorted(n for n in os.listdir(root)
                  if re.fullmatch(r'\d{8}', n) and os.path.isdir(os.path.join(root, n)))


def archive_보관대상(날짜목록, keep=ARCHIVE_KEEP):
    """남길 날짜 / 지울 날짜를 나눕니다 (파일은 건드리지 않음 — 계산만).

    · 최근 `keep` 개 날짜 폴더는 무조건 남깁니다.
    · 그보다 오래된 것 중 **각 달의 마지막 날짜 폴더**(= 그 달의 마지막 거래일)는 남깁니다.
      월별 추이를 나중에 되짚어 볼 수 있어야 하기 때문입니다.
    """
    날짜 = sorted(날짜목록)
    if keep is None or keep <= 0 or len(날짜) <= keep:
        return 날짜, []
    남김 = set(날짜[-keep:])
    월별마지막 = {}
    for d in 날짜:
        월별마지막[d[:6]] = d              # 오름차순이라 마지막에 남는 값이 그 달의 마지막
    남김.update(월별마지막.values())
    return [d for d in 날짜 if d in 남김], [d for d in 날짜 if d not in 남김]


def cleanup_archive(out_dir, keep=ARCHIVE_KEEP):
    """보관 기간을 넘긴 날짜 폴더를 지웁니다 → 지운 날짜 목록.

    `--archive` 는 매 거래일 약 0.6MB 를 남깁니다. `archive/` 는 **저장소에 올리지 않고**
    (`.gitignore`) 사장님 PC 의 로컬 사본으로만 둡니다. 그래도 1년이면 185MB 라
    디스크가 계속 불어나므로 여기서 정리합니다.
    앱도 변화 계산도 이 폴더를 읽지 않습니다 — 앱은 **날짜 없는 최신 파일만** 읽고(설계서 1장),
    어제 대비 변화는 `picks_baseline.json` 하나로 계산합니다(설계서 2.6).
    그래서 지워도 화면·산출물에 아무 영향이 없습니다.
    """
    남김, 지움 = archive_보관대상(archive_dates(out_dir), keep)
    root = os.path.join(out_dir, ARCHIVE_DIRNAME)
    지운것 = []
    for d in 지움:
        try:
            shutil.rmtree(os.path.join(root, d))
            지운것.append(d)
        except OSError:
            pass
    return 지운것
