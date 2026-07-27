# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 실행 진입점

    python -m ristock.engine.pipeline                       # 미국 + 한국 전체
    python -m ristock.engine.pipeline --market kr           # 한국만
    python -m ristock.engine.pipeline --sample 10 --no-news # 빠른 검증
    python -m ristock.engine.pipeline --archive --runner github-actions

산출물은 `--out`(기본 `ristock/data`) 아래에 만듭니다.
  manifest.json · market.json · stocks_KR.json · stocks_US.json · changes.json
  + picks_baseline.json (어제 대비 변화를 계산하는 기준선 — 설계서 2.6, 약 10~30KB)
  (+ `--archive` 지정 시 archive/YYYYMMDD/ 에 같은 이름으로 보관.
     archive/ 는 **저장소에 올리지 않습니다**(.gitignore) — 내 PC 에서 되짚어 볼 때만 씁니다.
     변화 계산은 archive 를 읽지 않으므로 없어도 아무 문제가 없습니다)

**부분 실패 처리** — 시장 하나가 실패해도 다른 시장은 정상 산출합니다.
실패한 시장의 `stocks_XX.json` 은 **덮어쓰지 않고 그대로 두고**, manifest 에 사유만 남깁니다.
멀쩡한 어제 데이터를 빈 파일로 날려버리는 것이 가장 나쁜 결과이기 때문입니다.
이때 `기준일` 도 **시장마다 따로** 유지합니다. 최상단 `기준일` 에 오늘을 찍어 버리면
한국 데이터가 일주일 멈춰 있어도 앱은 "오늘 데이터입니다"라고 말합니다(설계서 2.1).

※ 스크리닝 참고자료일 뿐 투자 권유가 아닙니다.
"""

import argparse
import os
import sys
import time
import traceback

from . import emit, news
from .analyze import evaluate_stocks, news_supply_stage
from .config import (DATA_DIR, EXCEL_DIRNAME, EXCEL_PREFIX, MANIFEST_FILE,
                     MARKET_FILE, MARKET_LABEL, STOCKS_FILE, TOP_N)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def _now():
    return time.strftime('%Y-%m-%d %H:%M')


def _today():
    return time.strftime('%Y%m%d')


# =========================
# 시장별 실행 (원본 run_us / run_kr 과 동일한 순서)
# =========================
def _야후재시도설정(retry, backoff):
    """`--retry` · `--backoff` 를 야후 수집기(sources_us)에 실제로 반영합니다.

    무거운 의존성(fdr·yfinance)을 import 해야 해서 **시장 수집 직전에만** 부릅니다.
    (`--no-news` 만으로 돌리는 검증 경로가 이 패키지 없이도 살아 있어야 합니다)
    """
    from . import sources_us
    r, b = sources_us.set_retry(retry, backoff)
    print(f'  야후 재시도 설정: 최대 {r}회, 대기 {b:g}초')
    return r, b


def run_us(top_n, sample, no_news, excel_dir, skip_excel, retry=None, backoff=None):
    """미국 수집 → 평가 → (엑셀) → DataFrame 반환"""
    # 무거운 의존성(fdr·yfinance)은 실제로 쓸 때만 불러온다
    from .excelout import build_workbook, unique_path
    from .sources_us import (build_us_universe, fetch_prices_batch,
                             fetch_us_korean_names, get_usdkrw, to_yahoo_symbol)

    _야후재시도설정(retry, backoff)
    fx = get_usdkrw()
    print(f'\n적용 환율: 1 USD = {fx:,.0f} KRW')

    df = build_us_universe(top_n, sample)
    df = fetch_us_korean_names(df)
    df['_yf'] = df['티커'].map(to_yahoo_symbol)
    df['시총_조원'] = df['시총_USD'] * fx / 1e12
    df['시총_억원'] = df['시총_USD'] * fx / 1e8
    # 순이익 USD → 억원 환산
    df['순익연도별'] = df['순익연도별'].map(
        lambda d: {y: v * fx / 1e8 for y, v in (d or {}).items() if v is not None})

    print('[미국 2/4] 주가 데이터 수집...')
    prices = fetch_prices_batch(list(df['_yf']), '미국')

    print('[미국 3/4] sector_pick v2 점수 계산...')
    df = evaluate_stocks(df, prices, '시총_억원', is_kr=False)

    print('[미국 4/4] 뉴스 분석...')
    df = news_supply_stage(df, is_kr=False, no_news=no_news)

    xlsx = ''
    if not skip_excel:
        out = unique_path(EXCEL_PREFIX['미국'] + ('_샘플' if sample else ''), excel_dir)
        build_workbook(df, MARKET_LABEL['미국'], out)
        xlsx = os.path.basename(out)
    return df, xlsx


def run_kr(top_n, sample, no_news, excel_dir, skip_excel, retry=None, backoff=None):
    """한국 수집 → 평가 → (엑셀) → DataFrame 반환"""
    from .excelout import build_workbook, unique_path
    from .sources_kr import build_kr_universe, fetch_kr_net_by_year_all
    from .sources_us import fetch_prices_batch

    _야후재시도설정(retry, backoff)      # 한국 주가도 야후에서 받습니다
    df, _market_map = build_kr_universe(top_n, sample)
    df['한글명'] = ''                      # 한국 종목은 기업명이 이미 한글
    df['_yf'] = df['티커'] + df['거래소'].map(
        lambda m: '.KS' if m == 'KOSPI' else '.KQ')
    df['시총_조원'] = df['시총_KRW'] / 1e12
    df['시총_억원'] = df['시총_KRW'] / 1e8

    df['순익연도별'] = df['_yf'].map(fetch_kr_net_by_year_all(list(df['_yf'])))

    print('[한국 2/4] 주가 데이터 수집...')
    prices = fetch_prices_batch(list(df['_yf']), '한국')

    print('[한국 3/4] sector_pick v2 점수 계산...')
    df = evaluate_stocks(df, prices, '시총_억원', is_kr=True)

    print('[한국 4/4] 뉴스·수급 분석...')
    df = news_supply_stage(df, is_kr=True, no_news=no_news)

    xlsx = ''
    if not skip_excel:
        out = unique_path(EXCEL_PREFIX['한국'] + ('_샘플' if sample else ''), excel_dir)
        build_workbook(df, MARKET_LABEL['한국'], out)
        xlsx = os.path.basename(out)
    return df, xlsx


RUNNERS = {'us': ('미국', run_us), 'kr': ('한국', run_kr)}


# =========================
# 전일 대비 변화 (설계서 2.5 · changes.json / 2.6 · picks_baseline.json)
# =========================
# 예전에는 어제 **스냅샷 전체**(0.6MB)를 비교 대상으로 삼아 `archive/YYYYMMDD/` 에 남기고
# 매 회차 통째로 커밋했습니다. git 이력은 지워도 남기 때문에 그것만으로 연 40MB 씩
# 저장소가 무거워졌고, 집·회사 두 PC 의 clone·pull 이 함께 느려졌습니다.
# 변화 계산에 정말 필요한 것은 **전략이 뽑은 티커 목록**(≈10KB)뿐이라,
# 지금은 `picks_baseline.json` 하나만 보고 계산합니다(설계서 2.6).
def 갱신된시장(out_dir, 기준일):
    """`stocks_XX.json` 의 기준일이 오늘인 시장 = **오늘 자료가 들어온 시장**.

    이번 회차에서 성공한 시장만이 아니라, 같은 날 **앞선 회차**가 이미 채워 둔 시장도
    포함합니다(CI 는 `--market us` 와 `--market kr` 을 따로 돕니다).
    그래야 나중 회차의 changes.json 에서 아침에 계산해 둔 다른 시장의 변화가
    통째로 사라지지 않습니다.

    수집이 실패해 어제 파일이 그대로 남은 시장은 기준일이 오늘이 아니므로 저절로 빠집니다.
    (그런 시장을 넣으면 자기 자신과 비교해 "변화 없음"이 나오는데, 그것은
     "오늘 갱신됐는데 변화가 없다"와 전혀 다른 이야기입니다)
    """
    시장 = []
    for 이름, 파일 in STOCKS_FILE.items():
        snap = emit.load_json(os.path.join(out_dir, 파일))
        if isinstance(snap, dict) and str(snap.get('기준일') or '') == 기준일:
            시장.append(이름)
    return 시장


def 오늘선정(out_dir, 대상시장, 전략목록, 섹터매핑):
    """오늘 스냅샷으로 전략 8종을 돌려 `{전략id: {시장: [뽑힌 종목…]}}` 를 만듭니다.

    시장은 서로 독립이라(전략은 시장마다 따로 돕니다) 한쪽만 넘겨도 나머지 시장의
    결과가 달라지지 않습니다. 그래서 갱신된 시장만 계산해도 안전합니다.
    """
    from . import strategies as S

    시장데이터 = {}
    for 시장 in 대상시장:
        snap = emit.load_json(os.path.join(out_dir, STOCKS_FILE[시장]))
        if isinstance(snap, dict):
            시장데이터[시장] = S.시장준비(snap)
    if not 시장데이터:
        return {}

    요약 = emit.load_json(os.path.join(out_dir, MARKET_FILE)) or {}
    결과 = S.전체전략실행(전략목록, 시장데이터, 요약, 섹터매핑)
    # 계산하지 않은 시장은 키 자체를 빼 둡니다 (빈 목록으로 남기면 '오늘 아무것도
    # 못 뽑았다'와 구분되지 않아, 다음 비교에서 전부 이탈로 잡힙니다)
    return {전략id: {시장: 목록 for 시장, 목록 in 시장별.items() if 시장 in 시장데이터}
            for 전략id, 시장별 in S.선정요약(결과).items()}


def 변화쓰기(out_dir, 기준일):
    """오늘 뽑은 종목을 `picks_baseline.json`(어제 몫)과 견줘 `changes.json` 을 만듭니다.

    1. 오늘 갱신된 시장으로 전략 8종을 돌려 오늘 picks 를 얻고
    2. 기준선의 날짜가 **오늘보다 이전인 시장만** 비교해 changes.json 을 쓰고
    3. 오늘 picks 를 기준선의 `대기` 칸에 적어 둡니다 (날짜가 바뀌면 비교 기준으로 승격)

    기준선이 없으면(첫 실행) changes.json 을 만들지 않고 manifest 에도 키를 넣지 않습니다.
    전부 '신규'로 표시하면 첫날 화면이 통째로 새 종목처럼 보이기 때문입니다.

    반환: {'변화파일': 'changes.json', '이전기준일': 'YYYYMMDD'} (못 만들면 빈 dict)
    """
    from . import strategies as S

    정의 = emit.load_json(os.path.join(out_dir, emit.STRATEGIES_FILE)) or {}
    전략목록 = 정의.get('전략') or []
    if not 전략목록:
        print(f'\n[변화] {emit.STRATEGIES_FILE} 이 없어 전일 대비 변화를 건너뜁니다')
        return {}

    대상시장 = 갱신된시장(out_dir, 기준일)
    오늘몫 = 오늘선정(out_dir, 대상시장, 전략목록, 정의.get('섹터매핑') or {})
    if not 오늘몫:
        print('\n[변화] 오늘 갱신된 시장이 없어 전일 대비 변화를 건너뜁니다')
        return {}

    기준선 = emit.기준선승격(emit.load_picks_baseline(out_dir), 기준일)
    기준picks = 기준선.get('전략별') or {}

    # 비교할 수 있는 시장 = 기준선에 있고, 그 기준 날짜가 오늘보다 **이전**인 시장
    비교시장 = [시장 for 시장 in 대상시장
              if any(시장 in (시장별 or {}) for 시장별 in 기준picks.values())
              and emit.기준선시장기준일(기준선, 시장) < 기준일]

    변화정보 = {}
    if 비교시장:
        이전기준일 = max(emit.기준선시장기준일(기준선, 시장) for 시장 in 비교시장)
        이전몫 = {전략id: {시장: 목록 for 시장, 목록 in (시장별 or {}).items()
                        if 시장 in 비교시장}
                for 전략id, 시장별 in 기준picks.items()}
        변화 = S.변화계산_선정(오늘몫, 이전몫, 기준일, 이전기준일)

        신규수 = sum(len(m.get('신규') or [])
                  for 시장별 in (변화.get('전략별') or {}).values() for m in 시장별.values())
        이탈수 = sum(len(m.get('이탈') or [])
                  for 시장별 in (변화.get('전략별') or {}).values() for m in 시장별.values())
        경로 = emit.write_changes(변화, out_dir)
        print(f'\n[변화] {경로} — {이전기준일} → {기준일}, '
              f'전략 {len(변화.get("전략별") or {})}종 · 신규 {신규수}건 · 이탈 {이탈수}건 '
              f'(대상: {", ".join(비교시장)})')
        변화정보 = {'변화파일': emit.CHANGES_FILE, '이전기준일': 이전기준일}
    else:
        까닭 = ('이번에 처음 만듭니다' if not 기준picks
              else f'{", ".join(대상시장)} 의 어제 몫이 없습니다')
        print(f'\n[변화] 비교할 직전 자료가 없어 changes.json 을 만들지 않았습니다 '
              f'({emit.PICKS_BASELINE_FILE} — {까닭})')

    경로 = emit.write_picks_baseline(out_dir, emit.기준선반영(기준선, 기준일, 오늘몫))
    print(f'[변화] 다음 비교용 기준선 저장: {경로} '
          f'({os.path.getsize(경로) / 1024:.1f}KB · 오늘 {", ".join(대상시장)})')
    return 변화정보


# =========================
# CLI
# =========================
def build_parser():
    ap = argparse.ArgumentParser(
        prog='ristock-engine',
        description='Ri_Stock 수집 엔진 — 시총 상위 종목 수집·평가 후 JSON/엑셀 산출')
    ap.add_argument('--market', choices=['all', 'us', 'kr'], default='all',
                    help='수집 대상 시장 (기본 all)')
    ap.add_argument('--top', type=int, default=TOP_N, help=f'시총 상위 N종목 (기본 {TOP_N})')
    ap.add_argument('--sample', type=int, default=None, help='샘플 N종목만 (검증용)')
    ap.add_argument('--no-news', action='store_true',
                    help='종목 뉴스·수급 분석만 생략 (10개국 시장요약 market.json 은 그대로 수집)')
    ap.add_argument('--no-market-news', action='store_true',
                    help='10개국 시장요약(market.json) 수집만 생략 — 기존 market.json 을 그대로 둡니다')
    ap.add_argument('--out', default=DATA_DIR, help='JSON 산출 경로 (기본 ristock/data)')
    ap.add_argument('--skip-excel', action='store_true', help='엑셀 파일을 만들지 않음')
    ap.add_argument('--excel-dir', default=None, help='엑셀 저장 경로 (기본 <out>/xlsx)')
    ap.add_argument('--archive', action='store_true',
                    help='산출물을 <out>/archive/YYYYMMDD/ 에도 보관 '
                         '(내 PC 확인용 — 저장소에는 올라가지 않습니다)')
    ap.add_argument('--archive-keep', type=int, default=emit.ARCHIVE_KEEP,
                    help=f'archive/ 에 남길 날짜 폴더 수 (기본 {emit.ARCHIVE_KEEP}, '
                         f'0 이면 정리하지 않음). 오래된 것 중 각 달의 마지막 거래일은 남깁니다')
    ap.add_argument('--retry', type=int, default=2,
                    help='야후 수집 실패 종목 재시도 횟수 (기본 2)')
    ap.add_argument('--backoff', type=float, default=3.0,
                    help='야후 재시도 전 대기 초 (기본 3.0)')
    ap.add_argument('--runner', choices=['pc', 'github-actions'], default='pc',
                    help='manifest.실행.주체 에 기록할 실행 주체 (기본 pc)')
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)

    out_dir = os.path.abspath(args.out)
    excel_dir = os.path.abspath(args.excel_dir or os.path.join(out_dir, EXCEL_DIRNAME))
    os.makedirs(out_dir, exist_ok=True)

    targets = ['us', 'kr'] if args.market == 'all' else [args.market]
    기준일 = _today()
    prev = emit.previous_manifest(out_dir)
    prev_markets = (prev.get('시장') or {}) if isinstance(prev, dict) else {}
    prev_기준일 = (prev.get('기준일') or '') if isinstance(prev, dict) else ''

    news.뉴스수집초기화()

    label = {'all': '미국+한국', 'us': '미국', 'kr': '한국'}[args.market]
    print('=' * 66)
    print(f' Ri_Stock 수집 엔진 — 시총 상위 {args.sample or args.top}종목 ({label})')
    print(f' 산출 경로: {out_dir}')
    print('=' * 66)

    t0 = time.time()
    시장 = {}
    메모 = []
    성공한시장 = []

    # ---- 10개국 시장요약 (market.json) ----
    # ⚠ `--no-news` 는 **종목 뉴스·수급만** 끕니다(원본 `기업분석표_생성.py` 와 같은 뜻).
    #   시장요약까지 끄려면 `--no-market-news` 를 따로 씁니다. 예전처럼 둘을 묶어 두면
    #   빠른 점검 한 번에 market.json 이 조용히 어제 값으로 남고, 섹터 순위가 굳습니다.
    if args.no_market_news:
        print('\n[시장요약] --no-market-news → 건너뜀 (기존 market.json 유지)')
    else:
        print('\n[시장요약] 10개국 비즈니스 뉴스 수집...')
        try:
            from .news import collect_market_summary
            summary = collect_market_summary()
            total = sum(c.get('수집', 0) for c in (summary.get('국가별') or {}).values())
            if total == 0:
                raise RuntimeError('뉴스를 한 건도 받지 못했습니다')
            emit.write_market(summary, out_dir)
            print(f'  저장 완료: {os.path.join(out_dir, MARKET_FILE)} '
                  f'(뉴스 {total}건, 섹터 {len(summary.get("섹터순위") or [])}개)')
        except Exception as e:
            메모.append(f'시장요약 실패({e}) → 기존 market.json 유지')
            print(f'  (실패) 시장요약: {e} — 기존 market.json 을 그대로 둡니다')

    # ---- 시장별 수집 ----
    def 물려받기(name):
        """실패했거나 이번에 손대지 않은 시장 — 이전 정보를 그대로 유지합니다.
        옛 manifest 에는 시장별 `기준일` 이 없었으므로 그때는 최상단 값으로 채웁니다."""
        entry = dict(prev_markets.get(name) or {})
        if entry:
            if not entry.get('기준일'):
                entry['기준일'] = prev_기준일
            return entry
        # manifest 가 없거나(첫 도입·손상) 그 시장을 모르던 경우 —
        # 디스크에 남아 있는 stocks 파일에서 최소 정보를 되살립니다.
        # 파일은 멀쩡한데 manifest 에서만 사라지면 앱이 그 시장의 신선도를 못 읽습니다.
        snap = emit.load_json(os.path.join(out_dir, STOCKS_FILE[name]))
        if isinstance(snap, dict) and isinstance(snap.get('종목'), list):
            종목 = snap['종목']
            return emit.market_entry(
                STOCKS_FILE[name], len(종목), sum(1 for s in 종목 if s.get('평가')),
                snap.get('원본', ''), snap.get('생성시각', ''), snap.get('기준일', ''))
        return {}

    for key in targets:
        name, runner = RUNNERS[key]
        try:
            df, xlsx = runner(args.top, args.sample, args.no_news, excel_dir,
                              args.skip_excel, args.retry, args.backoff)
            수집시각 = _now()
            path, n_all, n_eval = emit.write_stocks(
                df, name, out_dir, 기준일, 수집시각, 원본=xlsx)
            시장[name] = emit.market_entry(STOCKS_FILE[name], n_all, n_eval, xlsx,
                                          수집시각, 기준일)
            성공한시장.append(name)
            print(f'  저장 완료: {path} (종목 {n_all}, 평가 {n_eval})')
        except Exception as e:
            traceback.print_exc()
            메모.append(f'{name} 실패({type(e).__name__}: {e}) → 기존 {STOCKS_FILE[name]} 유지')
            print(f'\n  ⛔ {name} 수집 실패 — 기존 {STOCKS_FILE[name]} 을 그대로 둡니다')
            물려받은 = 물려받기(name)
            if 물려받은:
                시장[name] = 물려받은          # 기준일까지 이전 값 그대로
                print(f'     (manifest 의 {name} 기준일은 {물려받은.get("기준일") or "-"} 로 둡니다)')

    # 이번에 손대지 않은 시장 정보도 manifest 에서 잃지 않도록 이어붙인다
    for name in prev_markets:
        if name not in 시장:
            시장[name] = 물려받기(name)

    # 뉴스가 통째로 막혔으면(⑤) 왜 뉴스 점수가 0인지 반드시 남긴다
    뉴스메모 = news.뉴스포기메모()
    if 뉴스메모:
        메모.append(뉴스메모)

    성공 = len(성공한시장) == len(targets) and not 메모

    # 최상단 기준일 = 시장별 기준일 중 가장 오래된 값 (emit.대표기준일 주석 참고)
    대표기준일 = emit.대표기준일(시장, 기본=기준일)

    # ---- 전일 대비 변화 (changes.json) ----
    # 여기서 무슨 일이 나더라도 **오늘 수집한 데이터는 이미 저장돼 있습니다.**
    # 부가 정보 하나 때문에 회차 전체를 실패로 끝내지 않습니다.
    변화정보 = {}
    if 성공한시장:
        try:
            변화정보 = 변화쓰기(out_dir, 기준일)
        except Exception as e:
            traceback.print_exc()
            메모.append(f'전일 대비 변화 계산 실패({type(e).__name__}: {e})')
            성공 = False

    emit.write_manifest(out_dir, 시장, 대표기준일, _now(), args.runner,
                        성공, ' / '.join(메모),
                        변화정보.get('변화파일', ''), 변화정보.get('이전기준일', ''))

    if args.archive:
        names = ([MANIFEST_FILE, MARKET_FILE] + list(STOCKS_FILE.values())
                 + [emit.CHANGES_FILE])
        dst, saved = emit.archive(out_dir, 기준일, names)
        print(f'\n보관: {dst} ({len(saved)}개 파일)')
        # 보관 직후 바로 정리합니다 (publish 는 커밋만 합니다)
        지운날짜 = emit.cleanup_archive(out_dir, args.archive_keep)
        if 지운날짜:
            print(f'보관 정리: {len(지운날짜)}개 날짜 폴더 삭제 '
                  f'(최근 {args.archive_keep}개 + 각 달 마지막 거래일은 유지)')
            print(f'  삭제: {", ".join(지운날짜[:12])}'
                  + (f' … 외 {len(지운날짜) - 12}개' if len(지운날짜) > 12 else ''))
        elif args.archive_keep and args.archive_keep > 0:
            남은 = emit.archive_dates(out_dir)
            print(f'보관 정리: 지울 것 없음 (보관 {len(남은)}개 / 한도 {args.archive_keep}개)')

    print(f'\n총 소요: {(time.time() - t0) / 60:.1f}분')
    print(f'성공한 시장: {", ".join(성공한시장) if 성공한시장 else "없음"}')
    for m in 메모:
        print(f'메모: {m}')
    print('\n※ 스크리닝 참고자료일 뿐 투자 권유가 아니며, 투자 판단과 책임은 본인에게 있습니다.')

    # 요청한 시장이 전부 실패했을 때만 실패로 끝냅니다 (부분 성공은 정상 종료)
    return 0 if 성공한시장 else 1


if __name__ == '__main__':
    sys.exit(main())
