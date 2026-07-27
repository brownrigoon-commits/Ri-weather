# -*- coding: utf-8 -*-
"""엔진이 만든 `총점` 이 엑셀·정답지의 총점과 같은 식인가

**왜 이 파일이 있는가 (2026-07-27 적대적 검증에서 잡힌 실제 어긋남)**

총점은 두 가지 방법으로 구할 수 있고, 두 값은 다릅니다.

  ① 원점수 방식   : (1차원점수 + 뉴스원점수 + 수급원점수) ÷ 112 × 100
                    — `evaluate_stocks`/`news_supply_stage` 가 DataFrame 에 들고 있는 값
  ② 항목점수 방식 : Σ(항목 10점점수 × 가중치) ÷ 10 ÷ 112 × 100
                    — 엑셀 `기업분석` 시트의 SUMPRODUCT 수식,
                      옛 대시보드 `app.py.parse_analysis_sheet()`,
                      그리고 **정답지(cache/strategy_*.json)** 가 쓰는 값

②는 항목을 10점 만점으로 환산·반올림한 뒤 다시 더하므로 ①과 어긋납니다.
무작위 20,000건으로 재어 보면 **약 절반의 종목에서 최대 0.3점** 차이가 납니다.

총점은 화면에 그대로 보이고, 모든 순위 기준(`총점`·`차트`·`모멘텀`·`전고점`·`마법공식`)의
**2차 정렬 키**입니다. 엔진이 ①을 내보내면 앱 총점 ≠ 엑셀 총점이 되고 전략 순서까지 흔들립니다.
그래서 `emit.stock_record()` 는 ②로 다시 계산해 담습니다.

    실행: python -m pytest ristock/engine/tests/test_emit_total_parity.py -q
"""

import pandas as pd
import pytest

from conftest import 픽스처읽기
from ristock.engine import emit
from ristock.engine.config import SCORE_ITEMS, TOTAL_MAX, WEIGHTS


def 엑셀식_총점(점수):
    """옛 `app.py.parse_analysis_sheet()` 의 총점 계산을 그대로 옮긴 것 (비교 기준)."""
    sp = sum((점수.get(it) or 0) * WEIGHTS[it] for it in SCORE_ITEMS if WEIGHTS[it])
    wsum = sum(w for w in WEIGHTS.values() if w)
    return round(sp / 10 / wsum * 100, 1) if wsum else None


# ---------------------------------------------------------------------
# 1. 식 자체
# ---------------------------------------------------------------------
def test_가중치_합이_112다():
    assert sum(WEIGHTS.values()) == TOTAL_MAX == 112
    assert len(SCORE_ITEMS) == 13


@pytest.mark.parametrize('점수,기대', [
    ({it: 10.0 for it in SCORE_ITEMS}, 100.0),          # 전 항목 만점
    ({it: 0.0 for it in SCORE_ITEMS}, 0.0),             # 전 항목 0점
    ({}, 0.0),                                          # 값이 하나도 없으면 0 취급
    ({it: None for it in SCORE_ITEMS}, 0.0),            # None 은 0 (옛 `(x or 0)`)
])
def test_총점식_경계값(점수, 기대):
    assert emit.total_from_scores(점수) == 기대


def test_총점은_엑셀수식과_같은_값을_낸다():
    """0.0~10.0 을 0.1 단위로 훑어 두 구현이 소수 1자리까지 같은지 본다."""
    for k in range(0, 101):
        점수 = {it: round(k / 10, 1) for it in SCORE_ITEMS}
        assert emit.total_from_scores(점수) == 엑셀식_총점(점수)


def test_원점수_방식과는_실제로_다르다():
    """이 테스트가 깨지면 두 방식이 같아졌다는 뜻이라 위 방어가 무의미해진다 —
    즉 '차이가 있다'는 전제 자체를 지키는 감시탑이다."""
    raw = {'모멘텀': 9, '차트': 8, 'ROE': 6, '매출성장': 5, '순익성장': 5, '시총': 4,
           '재무': 7, '52주': 5, '저변동': 4, '밸류': 5, '배당': 3, '뉴스': 6.0, '수급': 10}
    원점수식 = round(sum(raw.values()) / TOTAL_MAX * 100, 1)
    항목점수 = {it: round(raw[it] / WEIGHTS[it] * 10, 1) for it in SCORE_ITEMS}
    assert emit.total_from_scores(항목점수) != 원점수식


# ---------------------------------------------------------------------
# 2. stock_record 가 실제로 그 값을 담는가
# ---------------------------------------------------------------------
def _행(총점_원점수, 점수):
    d = {'티커': '000000', '기업명': '테스트', '한글명': '', '섹터': '반도체', '산업': '',
         '거래소': 'KOSPI', '시총순위': 1, '시총_조원': 1.0, '총점(100)': 총점_원점수}
    d.update({f'점수_{it}': v for it, v in 점수.items()})
    return pd.Series(d)


def test_stock_record_는_원점수값을_그대로_쓰지_않는다():
    점수 = {it: 7.5 for it in SCORE_ITEMS}
    rec = emit.stock_record(_행(99.9, 점수))          # 일부러 엉뚱한 원점수값을 넣음
    assert rec['평가'] is True
    assert rec['총점'] == 엑셀식_총점(점수) == 75.0
    assert rec['총점'] != 99.9


def test_미평가_종목은_총점_점수_근거가_없다():
    rec = emit.stock_record(_행(None, {it: 5.0 for it in SCORE_ITEMS}))
    assert rec['평가'] is False
    assert '총점' not in rec and '점수' not in rec and '근거' not in rec


# ---------------------------------------------------------------------
# 3. 실데이터 — 시드(xlsx 변환) 스냅샷의 총점이 같은 식으로 재현되는가
# ---------------------------------------------------------------------
@pytest.mark.parametrize('파일', ['snap_KR_20260716.json', 'snap_US_20260716.json',
                                 'snap_KR_20260715_01.json', 'snap_US_20260715_03.json'])
def test_실제_스냅샷의_총점이_항목점수로_재현된다(파일):
    """정답지를 낳은 xlsx 에서 나온 총점 = Σ(항목점수 × 가중치) 여야 한다 (100%)."""
    snap = 픽스처읽기(파일)
    가중치 = snap['가중치']
    어긋남 = []
    for s in snap['종목']:
        if not s.get('평가'):
            continue
        sp = sum((s['점수'].get(k) or 0) * 가중치[k] for k in SCORE_ITEMS if 가중치[k])
        다시 = round(sp / 10 / sum(w for w in 가중치.values() if w) * 100, 1)
        if 다시 != s['총점']:
            어긋남.append(f"{s['티커']}: {s['총점']} ≠ {다시}")
    assert not 어긋남, f'{파일}\n' + '\n'.join(어긋남[:10])
