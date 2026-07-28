# -*- coding: utf-8 -*-
"""차트 데이터(일·주·월·연) — 값과 **날짜**가 정직한지 봅니다.

앱은 정적 페이지라 브라우저에서 주가 API 를 직접 부를 수 없습니다
(2026-07-28 확인: 야후·stooq 모두 CORS 차단). 그래서 엔진이 담아 주는 이 블록이
화면 그래프의 유일한 근거입니다.

가장 조심할 것은 **날짜**입니다. `resample().last()` 로 만들면 값은 맞아도 날짜가
구간 끝으로 바뀌어, 7/28 종가가 `2026-12-31`(연말)이나 일요일 날짜로 찍힙니다.
아직 오지도 않은 날짜가 툴팁에 뜨면 그건 틀린 정보입니다.

네트워크는 쓰지 않습니다 — 만들어 둔 시계열로만 확인합니다.
"""
import pandas as pd
import pytest

from ristock.engine import charts


def 가짜주가(시작='2024-01-01', 일수=700, 시작가=1000):
    """평일만 있는 종가 시리즈 (거래일처럼)."""
    날짜 = pd.bdate_range(시작, periods=일수)
    값 = [시작가 + i for i in range(일수)]
    return pd.DataFrame({'Close': 값}, index=날짜)


def test_구간별_점_개수는_설정대로():
    prices = {'AAA.KS': 가짜주가()}
    차트 = charts.build_charts(prices, {'AAA.KS': 'AAA'}, is_kr=True)
    assert len(차트['일']['날짜']) == 60
    assert len(차트['주']['날짜']) == 52
    assert len(차트['월']['날짜']) <= 24 and len(차트['월']['날짜']) >= 20
    assert 1 <= len(차트['연']['날짜']) <= 10


@pytest.mark.parametrize('구간', ['일', '주', '월', '연'])
def test_날짜는_실제_거래일이며_미래가_없다(구간):
    """`resample().last()` 로 만들면 여기서 잡힙니다 (월말·연말·일요일 날짜가 섞임)."""
    df = 가짜주가()
    거래일 = {d.strftime('%Y%m%d') for d in df.index}
    prices = {'AAA.KS': df}
    차트 = charts.build_charts(prices, {'AAA.KS': 'AAA'}, is_kr=True)

    날짜들 = 차트[구간]['날짜']
    assert 날짜들 == sorted(날짜들)                       # 오름차순
    for d in 날짜들:
        assert d in 거래일, f'{구간}: {d} 는 거래일이 아닙니다(구간 끝 날짜가 새어 나왔습니다)'
    마지막거래일 = max(거래일)
    assert 날짜들[-1] == 마지막거래일                      # 마지막 점은 항상 최신 거래일


def test_마지막_값은_최신_종가와_같다():
    df = 가짜주가()
    최신 = float(df['Close'].iloc[-1])
    차트 = charts.build_charts({'AAA.KS': df}, {'AAA.KS': 'AAA'}, is_kr=True)
    for 구간 in ('일', '주', '월', '연'):
        assert 차트[구간]['종목']['AAA'][-1] == pytest.approx(최신, abs=1)


def test_한국은_정수_미국은_소수두자리():
    df = 가짜주가()
    df['Close'] = df['Close'] + 0.456
    한국 = charts.build_charts({'A.KS': df}, {'A.KS': 'A'}, is_kr=True)
    미국 = charts.build_charts({'A': df}, {'A': 'AAPL'}, is_kr=False)
    assert all(isinstance(v, int) for v in 한국['일']['종목']['A'])
    assert 미국['일']['종목']['AAPL'][-1] == round(float(df['Close'].iloc[-1]), 2)


def test_날짜축은_한_번만_담는다():
    """종목마다 날짜를 되풀이하면 하루 두 번 커밋되는 파일이 그만큼 무거워집니다."""
    prices = {f'{i}.KS': 가짜주가(시작가=1000 + i * 10) for i in range(5)}
    심볼 = {f'{i}.KS': f'{i:06d}' for i in range(5)}
    차트 = charts.build_charts(prices, 심볼, is_kr=True)
    블록 = 차트['일']
    assert set(블록.keys()) == {'날짜', '종목'}          # 종목별 날짜 사본이 없음
    assert len(블록['종목']) == 5
    for 줄 in 블록['종목'].values():
        assert len(줄) == len(블록['날짜'])              # 축에 자리를 맞춰 담김


def test_거래가_없던_날은_빈칸으로_남는다():
    """상장 전·거래정지 구간을 0 으로 채우면 그래프가 바닥까지 떨어진 것처럼 보입니다.

    (실제로는 같은 시장 종목들의 마지막 거래일이 같지만, 상장이 늦은 종목은
     앞쪽이 비고 상장폐지·거래정지 종목은 뒤쪽이 빕니다 — 어느 쪽이든 0 이 아니라 빈칸)
    """
    긴것 = 가짜주가(일수=700)
    짧은것 = 가짜주가(시작='2026-06-01', 일수=20, 시작가=5000)
    차트 = charts.build_charts({'A.KS': 긴것, 'B.KS': 짧은것},
                              {'A.KS': 'A', 'B.KS': 'B'}, is_kr=True)
    b = 차트['일']['종목']['B']
    값들 = [v for v in b if v is not None]
    assert None in b                                    # 자기 자료가 없는 날은 빈칸
    assert 값들, '자기 거래일에는 값이 있어야 합니다'
    assert 0 not in 값들                                 # 0 으로 메우지 않았다
    assert 값들[-1] == int(짧은것['Close'].iloc[-1])       # 마지막 값은 그 종목의 최신 종가


def test_주가가_아예_없으면_빈_dict():
    assert charts.build_charts({}, {'A.KS': 'A'}, is_kr=True) == {}
    assert charts.build_charts({'A.KS': None}, {'A.KS': 'A'}, is_kr=True) == {}
