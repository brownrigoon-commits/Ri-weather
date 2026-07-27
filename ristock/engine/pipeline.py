# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 실행 진입점

    python -m ristock.engine.pipeline                       # 미국 + 한국 전체
    python -m ristock.engine.pipeline --market kr           # 한국만
    python -m ristock.engine.pipeline --sample 10 --no-news # 빠른 검증
    python -m ristock.engine.pipeline --archive --runner github-actions

산출물은 `--out`(기본 `ristock/data`) 아래에 만듭니다.
  manifest.json · market.json · stocks_KR.json · stocks_US.json
  (+ `--archive` 지정 시 archive/YYYYMMDD/ 에 같은 이름으로 보관)

**부분 실패 처리** — 시장 하나가 실패해도 다른 시장은 정상 산출합니다.
실패한 시장의 `stocks_XX.json` 은 **덮어쓰지 않고 그대로 두고**, manifest 에 사유만 남깁니다.
멀쩡한 어제 데이터를 빈 파일로 날려버리는 것이 가장 나쁜 결과이기 때문입니다.

※ 스크리닝 참고자료일 뿐 투자 권유가 아닙니다.
"""

import argparse
import os
import sys
import time
import traceback

from . import emit
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
def run_us(top_n, sample, no_news, excel_dir, skip_excel):
    """미국 수집 → 평가 → (엑셀) → DataFrame 반환"""
    # 무거운 의존성(fdr·yfinance)은 실제로 쓸 때만 불러온다
    from .excelout import build_workbook, unique_path
    from .sources_us import (build_us_universe, fetch_prices_batch,
                             fetch_us_korean_names, get_usdkrw, to_yahoo_symbol)

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


def run_kr(top_n, sample, no_news, excel_dir, skip_excel):
    """한국 수집 → 평가 → (엑셀) → DataFrame 반환"""
    from .excelout import build_workbook, unique_path
    from .sources_kr import build_kr_universe, fetch_kr_net_by_year_all
    from .sources_us import fetch_prices_batch

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
                    help='뉴스 분석 생략 — 종목 뉴스·수급과 10개국 시장요약을 모두 건너뜁니다')
    ap.add_argument('--out', default=DATA_DIR, help='JSON 산출 경로 (기본 ristock/data)')
    ap.add_argument('--skip-excel', action='store_true', help='엑셀 파일을 만들지 않음')
    ap.add_argument('--excel-dir', default=None, help='엑셀 저장 경로 (기본 <out>/xlsx)')
    ap.add_argument('--archive', action='store_true',
                    help='산출물을 <out>/archive/YYYYMMDD/ 에도 보관')
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
    if args.no_news:
        print('\n[시장요약] --no-news → 건너뜀 (기존 market.json 유지)')
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
    for key in targets:
        name, runner = RUNNERS[key]
        try:
            df, xlsx = runner(args.top, args.sample, args.no_news, excel_dir, args.skip_excel)
            수집시각 = _now()
            path, n_all, n_eval = emit.write_stocks(
                df, name, out_dir, 기준일, 수집시각, 원본=xlsx)
            시장[name] = emit.market_entry(STOCKS_FILE[name], n_all, n_eval, xlsx, 수집시각)
            성공한시장.append(name)
            print(f'  저장 완료: {path} (종목 {n_all}, 평가 {n_eval})')
        except Exception as e:
            traceback.print_exc()
            메모.append(f'{name} 실패({type(e).__name__}: {e}) → 기존 {STOCKS_FILE[name]} 유지')
            print(f'\n  ⛔ {name} 수집 실패 — 기존 {STOCKS_FILE[name]} 을 그대로 둡니다')
            if name in prev_markets:
                시장[name] = prev_markets[name]      # 이전 데이터 정보를 그대로 물려받음

    # 이번에 손대지 않은 시장 정보도 manifest 에서 잃지 않도록 이어붙인다
    for name, entry in prev_markets.items():
        시장.setdefault(name, entry)

    성공 = len(성공한시장) == len(targets) and not 메모
    emit.write_manifest(out_dir, 시장, 기준일, _now(), args.runner,
                        성공, ' / '.join(메모))

    if args.archive:
        names = [MANIFEST_FILE, MARKET_FILE] + list(STOCKS_FILE.values())
        dst, saved = emit.archive(out_dir, 기준일, names)
        print(f'\n보관: {dst} ({len(saved)}개 파일)')

    print(f'\n총 소요: {(time.time() - t0) / 60:.1f}분')
    print(f'성공한 시장: {", ".join(성공한시장) if 성공한시장 else "없음"}')
    for m in 메모:
        print(f'메모: {m}')
    print('\n※ 스크리닝 참고자료일 뿐 투자 권유가 아니며, 투자 판단과 책임은 본인에게 있습니다.')

    # 요청한 시장이 전부 실패했을 때만 실패로 끝냅니다 (부분 성공은 정상 종료)
    return 0 if 성공한시장 else 1


if __name__ == '__main__':
    sys.exit(main())
