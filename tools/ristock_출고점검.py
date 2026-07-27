# -*- coding: utf-8 -*-
"""Ri_Stock 출고 점검 — **사용자에게 도달했는지**까지 확인한다.

CLAUDE.md 의 2026-07-22 사고가 이 파일이 생긴 이유입니다.
그날 `js/legal.js` 하나가 배포 목록에서 빠져 서버에 404 가 서빙됐고,
로컬 테스트는 전부 통과했습니다. **로컬에서 되는 것과 사용자에게 도달하는 것은 다릅니다.**
골프앱은 `tools/verify_deploy.py` 가 지키고 있지만 Ri_Stock(`ristock/`)은 무방비였습니다.

두 단계로 나눠 씁니다.

    python tools/ristock_출고점검.py                        # ① 올리기 전 — 로컬 산출물 점검
    python tools/ristock_출고점검.py --markets 미국,한국     # 이번에 수집 성공한 시장만 엄격 검사
    python tools/ristock_출고점검.py --url --wait            # ② 올린 뒤 — 공개 주소 확인

① 은 **빈 껍데기·반쯤 쓰인 JSON 을 커밋하기 전에** 잡습니다.
② 는 **GitHub Pages 가 조용히 실패했는지**를 잡습니다.

종료코드 0 = 통과. 1 = 사람이 봐야 함. (경고만 있으면 0)

※ 스크리닝 참고자료일 뿐 투자 권유가 아닙니다.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.join(ROOT, 'ristock')
DATA_DIR = os.path.join(APP_DIR, 'data')
BASE_URL = 'https://brownrigoon-commits.github.io/Ri-weather/ristock'

STOCKS_FILE = {'한국': 'stocks_KR.json', '미국': 'stocks_US.json'}

# 종목이 이보다 적으면 "수집이 반쯤 죽었다"고 봅니다.
# 상위 300 종목을 노리는 수집이 50 종목만 담고 성공했다고 우기는 것이 가장 위험합니다.
최소종목수 = 50
최소평가종목수 = 10

문제 = []
경고 = []


def 실패(글):
    문제.append(글)
    print(f'  ✗ {글}')


def 주의(글):
    경고.append(글)
    print(f'  ! {글}')


def 통과(글):
    print(f'  ✓ {글}')


# =========================================================
# 공통 — JSON 읽기
# =========================================================
def _잘못된상수(이름):
    # json 표준 파서는 NaN·Infinity 를 기본으로 받아 줍니다.
    # 하지만 브라우저 JSON.parse 는 그 자리에서 죽습니다 → 앱이 백지가 됩니다.
    raise ValueError(f'JSON 에 {이름} 이 들어 있습니다 (브라우저가 읽지 못합니다)')


def json읽기(text):
    return json.loads(text, parse_constant=_잘못된상수)


# =========================================================
# ① 로컬 점검
# =========================================================
def 참조자산():
    """index.html 과 sw.js 가 요구하는 파일 목록 (상대경로).

    배포 목록에서 파일이 빠지는 사고를 여기서 잡습니다.
    """
    필요 = ['index.html', 'sw.js', 'manifest.webmanifest']
    try:
        html = open(os.path.join(APP_DIR, 'index.html'), encoding='utf-8').read()
    except OSError as e:
        실패(f'ristock/index.html 을 읽지 못했습니다: {e}')
        return 필요
    필요 += re.findall(r'<script[^>]+src="([^"?#]+)"', html)
    필요 += re.findall(r'<link[^>]+href="([^"?#]+)"', html)
    try:
        sw = open(os.path.join(APP_DIR, 'sw.js'), encoding='utf-8').read()
        블록 = re.search(r'const\s+CORE\s*=\s*\[(.*?)\]', sw, re.S)
        if 블록:
            필요 += re.findall(r'"\./([^"]+)"', 블록.group(1))
    except OSError:
        pass

    정리 = []
    for p in 필요:
        p = p.strip().lstrip('./')
        # 외부 주소·데이터 URI 는 건너뜁니다(캐시 정책상 있으면 안 되지만 점검 대상은 아닙니다)
        if not p or '://' in p or p.startswith('data:'):
            continue
        if p not in 정리:
            정리.append(p)
    return 정리


def 로컬점검(markets, 최소=최소종목수):
    print('■ ① 로컬 산출물 점검')

    # --- 반쯤 쓰인 파일이 남아 있는가 -------------------------------
    if os.path.isdir(DATA_DIR):
        찌꺼기 = [f for f in os.listdir(DATA_DIR) if f.endswith('.tmp')]
        if 찌꺼기:
            실패(f'쓰다 만 임시 파일이 남아 있습니다: {", ".join(찌꺼기[:5])}')
    else:
        실패('ristock/data/ 폴더가 없습니다')
        return

    # --- 앱이 요구하는 파일이 전부 있는가 ---------------------------
    빠짐 = [p for p in 참조자산() if not os.path.isfile(os.path.join(APP_DIR, p))]
    if 빠짐:
        실패('앱이 부르는 파일이 없습니다 (배포되면 404): ' + ', '.join(빠짐))
    else:
        통과('앱 구성 파일 전부 존재')

    # --- JSON 이 전부 읽히는가 --------------------------------------
    문서 = {}
    for 이름 in ('manifest.json', 'market.json', 'strategies.json',
                 'stocks_KR.json', 'stocks_US.json'):
        경로 = os.path.join(DATA_DIR, 이름)
        if not os.path.isfile(경로):
            실패(f'{이름} 이 없습니다')
            continue
        try:
            문서[이름] = json읽기(open(경로, encoding='utf-8').read())
        except Exception as e:
            실패(f'{이름} 을 읽지 못했습니다: {e}')
    if 'manifest.json' not in 문서:
        return

    m = 문서['manifest.json']
    기준일 = str(m.get('기준일') or '')
    if not re.fullmatch(r'\d{8}', 기준일):
        실패(f'manifest.기준일 이 YYYYMMDD 가 아닙니다: {기준일!r}')
    else:
        통과(f'기준일 {기준일}')
    if not (m.get('시장') or {}):
        실패('manifest.시장 이 비어 있습니다 (앱이 보여 줄 것이 없습니다)')

    실행 = m.get('실행') or {}
    if 실행.get('메모'):
        주의(f"실행 메모: {실행['메모']}")
    if 실행.get('성공') is False:
        주의('manifest.실행.성공 = false — 일부만 갱신됐습니다')

    # --- 이번에 수집한 시장은 엄격하게 -------------------------------
    #   요청하지 않은 시장은 '어제 데이터 유지'가 정상이므로 검사하지 않습니다.
    대상 = [x for x in (markets or list(STOCKS_FILE)) if x in STOCKS_FILE]
    if markets and not 대상:
        실패(f'알 수 없는 시장 이름: {markets}')
    for 시장 in 대상:
        파일 = STOCKS_FILE[시장]
        d = 문서.get(파일)
        if d is None:
            실패(f'{시장}: {파일} 을 읽지 못했습니다')
            continue
        종목 = d.get('종목') or []
        평가 = [s for s in 종목 if s.get('평가')]
        if len(종목) < 최소:
            실패(f'{시장}: 종목이 {len(종목)}개뿐입니다 (최소 {최소}) — 수집이 반만 됐습니다')
        elif len(평가) < 최소평가종목수:
            실패(f'{시장}: 평가 종목이 {len(평가)}개뿐입니다 (최소 {최소평가종목수})')
        else:
            통과(f'{시장}: 종목 {len(종목)} / 평가 {len(평가)}')

        if str(d.get('기준일') or '') != 기준일:
            실패(f"{시장}: {파일} 기준일({d.get('기준일')}) 이 manifest({기준일}) 와 다릅니다")
        빈티커 = sum(1 for s in 종목 if not s.get('티커'))
        if 빈티커:
            실패(f'{시장}: 티커가 빈 종목이 {빈티커}개 있습니다')

    # --- 실수로 올라가면 안 되는 것이 데이터 폴더에 있는가 -------------
    for 금지 in ('last_run.log', 'xlsx'):
        if os.path.exists(os.path.join(DATA_DIR, 금지)):
            주의(f'ristock/data/{금지} 이(가) 있습니다 — .gitignore 로 걸러집니다')


# =========================================================
# ② 공개 주소 점검
# =========================================================
def 받기(base, 경로, timeout=20):
    url = f'{base}/{경로}' + ('&' if '?' in 경로 else '?') + f't={int(time.time() * 1000)}'
    req = urllib.request.Request(url, headers={
        'Cache-Control': 'no-cache', 'Pragma': 'no-cache',
        'User-Agent': 'ristock-release-check'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read(2_000_000).decode('utf-8', errors='replace')


def 공개점검(base, 기대기준일):
    """공개 주소가 실제로 오늘 데이터를 내주는지. 하나라도 어긋나면 False."""
    자산 = 참조자산() + ['data/manifest.json', 'data/strategies.json',
                        'data/market.json', 'data/stocks_KR.json', 'data/stocks_US.json']
    나쁨 = []
    for 경로 in 자산:
        try:
            code, body = 받기(base, 경로)
        except urllib.error.HTTPError as e:
            나쁨.append(f'{경로} → HTTP {e.code}')
            continue
        except Exception as e:
            나쁨.append(f'{경로} → {type(e).__name__}: {str(e)[:60]}')
            continue
        if code != 200:
            나쁨.append(f'{경로} → HTTP {code}')
        elif 경로.endswith('.json'):
            # GitHub Pages 는 없는 경로에 404 페이지(HTML)를 내주기도 합니다.
            # 상태코드만 보면 놓치므로 실제로 JSON 으로 읽히는지까지 확인합니다.
            try:
                doc = json읽기(body)
            except Exception as e:
                나쁨.append(f'{경로} → JSON 아님 ({str(e)[:50]})')
                continue
            if 경로.endswith('manifest.json') and 기대기준일:
                올라간것 = str(doc.get('기준일') or '')
                if 올라간것 != 기대기준일:
                    나쁨.append(f'manifest 기준일 {올라간것 or "(없음)"} '
                                f'≠ 방금 만든 {기대기준일} (아직 반영 전이거나 빌드 실패)')
    if 나쁨:
        for x in 나쁨:
            print(f'  ✗ {x}')
        return False
    통과(f'공개 주소 {len(자산)}개 파일 전부 정상 — {base}')
    return True


def 공개점검_대기(base, 기대기준일, wait, 간격=20, 최대=12):
    print(f'\n■ ② 공개 주소 확인 — {base}')
    회수 = 최대 if wait else 1
    for i in range(회수):
        if 공개점검(base, 기대기준일):
            return True
        if i < 회수 - 1:
            print(f'  · 아직입니다 — {간격}초 뒤 다시 확인 ({i + 1}/{회수 - 1})')
            time.sleep(간격)
    실패('공개 주소에서 오늘 데이터를 확인하지 못했습니다 '
         '(GitHub Pages 빌드 실패 또는 파일 누락 — "배포 완료"라고 말하면 안 됩니다)')
    return False


# =========================================================
# CLI
# =========================================================
def main(argv=None):
    ap = argparse.ArgumentParser(
        prog='ristock-출고점검',
        description='Ri_Stock 산출물이 멀쩡한지, 그리고 공개 주소에 실제로 도달했는지 확인')
    ap.add_argument('--markets', default='',
                    help='이번에 수집 성공한 시장 (예: "미국,한국"). 비우면 둘 다 검사')
    ap.add_argument('--min-stocks', type=int, default=최소종목수,
                    help=f'시장별 최소 종목 수 (기본 {최소종목수})')
    ap.add_argument('--url', action='store_true', help='공개 주소까지 확인')
    ap.add_argument('--base', default=BASE_URL, help='확인할 주소 (기본 GitHub Pages)')
    ap.add_argument('--wait', action='store_true',
                    help='공개 주소에 반영될 때까지 최대 4분 기다림')
    ap.add_argument('--skip-local', action='store_true', help='로컬 점검 건너뛰기')
    args = ap.parse_args(argv)

    시장들 = [x.strip() for x in args.markets.split(',') if x.strip()]

    if not args.skip_local:
        로컬점검(시장들, args.min_stocks)

    if args.url:
        기준일 = ''
        try:
            with open(os.path.join(DATA_DIR, 'manifest.json'), encoding='utf-8') as f:
                기준일 = str(json.load(f).get('기준일') or '')
        except Exception:
            pass
        공개점검_대기(args.base.rstrip('/'), 기준일, args.wait)

    print()
    if 문제:
        print(f'⛔ 출고 점검 실패 — {len(문제)}건')
        for x in 문제:
            print(f'   · {x}')
        print('   데이터를 올리거나 "배포 완료"라고 말하기 전에 이것부터 해결해야 합니다.')
        return 1
    if 경고:
        print(f'⚠ 통과했지만 봐 둘 것 {len(경고)}건')
        for x in 경고:
            print(f'   · {x}')
    print('✅ 출고 점검 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
