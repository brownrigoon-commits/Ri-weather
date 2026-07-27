# -*- coding: utf-8 -*-
"""테스트 공통 준비 — 픽스처 로딩 + 임포트 경로

이 폴더의 테스트는 **네트워크를 전혀 쓰지 않습니다**(설계서 6-3).
`fixtures/` 안의 실제 실행 결과만 읽어서 계산 로직을 검증합니다.

    실행: python -m pytest ristock/engine/tests -q
"""

import json
import os
import sys

import pytest

여기 = os.path.dirname(os.path.abspath(__file__))
픽스처 = os.path.join(여기, 'fixtures')
저장소 = os.path.dirname(os.path.dirname(os.path.dirname(여기)))

# `ristock.engine` 을 import 할 수 있도록 저장소 최상위를 경로에 넣습니다.
if 저장소 not in sys.path:
    sys.path.insert(0, 저장소)


def 픽스처읽기(파일명):
    """`tests/fixtures/<파일명>` 을 읽어 돌려줍니다."""
    with open(os.path.join(픽스처, 파일명), encoding='utf-8') as f:
        return json.load(f)


def 데이터읽기(파일명):
    """`ristock/data/<파일명>` 을 읽어 돌려줍니다 (전략 정의·섹터 매핑)."""
    with open(os.path.join(저장소, 'ristock', 'data', 파일명), encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------------
# 스냅샷 — 전략마다 읽어야 할 분석표가 다릅니다 (fixtures/README.md 3절)
# ---------------------------------------------------------------------
스냅샷파일 = {
    '20260715': {'한국': 'snap_KR_20260715_01.json', '미국': 'snap_US_20260715_03.json'},
    '20260716': {'한국': 'snap_KR_20260716.json', '미국': 'snap_US_20260716.json'},
}


@pytest.fixture(scope='session')
def 시장요약():
    """2026-07-16 11:44 기준 10개국 뉴스 요약 (옛 `cache/summary_20260716.json`)."""
    return 픽스처읽기('market_20260716.json')


@pytest.fixture(scope='session')
def 전략정의():
    """`ristock/data/strategies.json` — 전략 8종 + 섹터 매핑표 + 필터 설명."""
    return 데이터읽기('strategies.json')


@pytest.fixture(scope='session')
def 스냅샷원본():
    """{기준일: {시장: 스냅샷JSON}} — 파일에서 읽은 그대로(가공 전)."""
    return {날짜: {시장: 픽스처읽기(파일) for 시장, 파일 in 짝.items()}
            for 날짜, 짝 in 스냅샷파일.items()}
