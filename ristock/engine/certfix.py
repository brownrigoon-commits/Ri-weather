# -*- coding: utf-8 -*-
r"""Ri_Stock 수집 엔진 — 한글 경로 인증서 우회 (윈도우 전용)

야후 파이낸스(`yfinance`)는 안에서 `curl_cffi`(libcurl)로 HTTPS 를 겁니다.
libcurl 은 인증서 파일을 열 때 경로를 **윈도우 ANSI 코드페이지**로 다루는데,
파이썬이 넘기는 문자열은 UTF-8 이라 **경로에 한글이 있으면 파일 자체를 못 엽니다.**

    curl: (77) error setting certificate verify locations:
          CAfile: C:\Users\디자이너\AppData\Roaming\Python\Python311\...\cacert.pem

집 PC 는 윈도우 계정 이름이 한글(`C:\Users\디자이너`)이라 파이썬 패키지가 전부
한글 경로 아래에 깔립니다. 그래서 이 PC 에서는 **야후를 쓰는 수집이 통째로** 죽었습니다.
한국 종목도 주가·순이익을 야후에서 받으므로 **국내 분석까지 함께 막혔습니다.**
(2026-07-28 확인: 미국 300종목 0건 수집 → 예외, 한국은 전 종목 주가 실패)

인증서 파일이 없어서 나는 오류가 아닙니다. 파일은 멀쩡히 있는데 못 여는 것이라,
`pip install --upgrade certifi` 로는 낫지 않습니다.

해결: 인증서를 **ASCII 경로로 복사**한 뒤 `certifi.where()` 가 그쪽을 가리키게 합니다.
경로에 한글이 없으면(회사 PC·깃허브 러너·리눅스) **아무것도 하지 않습니다.**

⚠ `curl_cffi.curl` 은 import 하는 순간 `DEFAULT_CACERT = certifi.where()` 로 값을 박아 둡니다.
   그래서 이 우회는 **yfinance 를 import 하기 전에** 걸어야 하고
   (`sources_us` · `sources_kr` 맨 위에서 부릅니다),
   이미 import 된 뒤라도 살아나도록 그 상수도 함께 바꿉니다.

네트워크는 쓰지 않습니다. 파일 복사 한 번뿐이고, 두 번째부터는 그대로 씁니다.
"""

import os
import shutil
import sys

_적용된경로 = None          # 한 번 성공하면 그대로 재사용 (같은 프로세스 안에서 idempotent)


def _아스키인가(경로):
    try:
        경로.encode('ascii')
        return True
    except (UnicodeEncodeError, AttributeError):
        return False


def _보관후보():
    """한글이 섞이지 않은 쓰기 가능한 폴더 후보 — 앞에서부터 시도합니다.

    `%TEMP%` 는 보통 `C:\\Users\\<계정>\\AppData\\Local\\Temp` 라 계정 이름이 한글이면
    똑같이 막힙니다. 그래서 계정 폴더 **바깥**을 먼저 봅니다.
    """
    import tempfile
    for 후보 in (os.environ.get('ProgramData'),
                 os.path.join(os.environ.get('SystemDrive', 'C:') + os.sep, 'Users', 'Public'),
                 tempfile.gettempdir()):
        if 후보 and _아스키인가(후보) and os.path.isdir(후보):
            yield os.path.join(후보, 'Ri_Stock', 'certs')


def _복사(원본):
    """원본 cacert.pem 을 ASCII 경로로 복사하고 그 경로를 돌려줍니다 (실패 시 None)."""
    try:
        크기 = os.path.getsize(원본)
    except OSError:
        return None
    for 폴더 in _보관후보():
        사본 = os.path.join(폴더, 'cacert.pem')
        try:
            # 이미 같은 크기로 놓여 있으면 그대로 씁니다 (certifi 가 갱신되면 크기가 달라짐)
            if os.path.exists(사본) and os.path.getsize(사본) == 크기:
                return 사본
            os.makedirs(폴더, exist_ok=True)
            shutil.copyfile(원본, 사본)
            return 사본
        except OSError:
            continue          # 권한 없는 폴더면 다음 후보로
    return None


def ensure_ascii_cacert(verbose=True):
    """한글 경로 때문에 야후가 막히는 것을 미리 풀어 둡니다.

    반환: 우회에 쓴 ASCII 인증서 경로. 손댈 필요가 없었으면 `None`.
    (리눅스·깃허브 러너에서는 항상 `None` — 동작이 조금도 달라지지 않습니다)
    """
    global _적용된경로
    if _적용된경로:
        return _적용된경로
    try:
        import certifi
    except ImportError:
        return None

    원본 = certifi.where()
    if _아스키인가(원본):
        return None                     # 정상 환경 — 아무것도 하지 않습니다

    사본 = _복사(원본)
    if not 사본:
        if verbose:
            print('  (경고) 인증서를 ASCII 경로로 옮기지 못했습니다 — 야후 수집이 실패할 수 있습니다.')
            print(f'         원본: {원본}')
        return None

    # certifi 를 거쳐 경로를 읽는 쪽(curl_cffi·requests 등)이 모두 사본을 보게 합니다.
    certifi.where = lambda: 사본
    core = getattr(certifi, 'core', None)
    if core is not None:
        core.where = lambda: 사본
    # certifi 를 안 거치고 환경변수만 보는 도구용
    for 변수 in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE'):
        os.environ[변수] = 사본
    # 이미 import 돼 값을 박아 둔 curl_cffi 도 되돌립니다 (없으면 그냥 넘어감)
    박힌모듈 = sys.modules.get('curl_cffi.curl')
    if 박힌모듈 is not None:
        박힌모듈.DEFAULT_CACERT = 사본

    _적용된경로 = 사본
    if verbose:
        print(f'  인증서 우회: 경로에 한글이 있어 사본을 씁니다 → {사본}')
    return 사본
