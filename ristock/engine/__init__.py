# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진

원본 `기업분석표_생성.py`(1,399줄) 를 역할별 모듈로 나눈 것입니다.
**계산 로직은 이식(port)이지 개선이 아닙니다.** 결과가 달라지면 그건 버그입니다.

    config     상수·가중치·섹터 매핑
    scoring    13항목 점수 함수 (네트워크 없음 — 오프라인 테스트 가능)
    news       종목 뉴스 규칙분석 + 10개국 시장요약
    sources_us 미국 유니버스·펀더멘털·주가 (S&P500 / 야후)
    sources_kr 한국 유니버스·펀더멘털·수급 (KRX / 네이버금융)
    analyze    1차 점수 → 뉴스·수급 → 총점
    emit       JSON 산출 (설계서 2.1/2.2/2.3 규격)
    excelout   엑셀 분석표 (사장님이 계속 쓰시는 형식 그대로)
    pipeline   CLI 진입점

import 만으로는 네트워크를 건드리지 않습니다.
"""

__all__ = ['config', 'scoring', 'news', 'sources_us', 'sources_kr',
           'analyze', 'emit', 'excelout', 'pipeline']
