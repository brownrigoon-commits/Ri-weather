# -*- coding: utf-8 -*-
r"""`certfix.py` — 계정 이름이 한글인 윈도우 PC 에서 야후가 막히는 것을 푸는 우회.

2026-07-28 집 PC 첫 실행이 여기서 통째로 죽었습니다.
미국은 `미국 종목 정보를 한 건도 수집하지 못했습니다` 로 예외,
한국은 300종목 주가가 전부 아래 오류로 실패했습니다.

    curl: (77) error setting certificate verify locations:
          CAfile: C:\Users\디자이너\AppData\Roaming\Python\...\cacert.pem

인증서 파일은 **있는데** libcurl 이 한글 경로를 못 여는 것이 원인이었습니다.
한국 종목도 주가·순이익을 야후에서 받으므로 국내 분석까지 함께 막혔습니다.

네트워크는 쓰지 않습니다 — 경로 판단과 파일 복사만 확인합니다.
"""
import os

import pytest

from ristock.engine import certfix


@pytest.fixture(autouse=True)
def 캐시비우기():
    """모듈이 한 번 성공하면 결과를 기억하므로 테스트마다 지워 줍니다."""
    certfix._적용된경로 = None
    yield
    certfix._적용된경로 = None


def 인증서만들기(폴더, 내용=b'-- test ca --\n'):
    os.makedirs(폴더, exist_ok=True)
    경로 = os.path.join(폴더, 'cacert.pem')
    with open(경로, 'wb') as f:
        f.write(내용)
    return 경로


def test_아스키_경로면_아무것도_하지_않는다(monkeypatch):
    """리눅스·깃허브 러너·영문 계정 PC — 동작이 조금도 달라지면 안 됩니다.

    (경로만 보고 즉시 물러나므로 파일이 실제로 있을 필요가 없습니다.
     집 PC 는 pytest 임시폴더조차 한글 경로라 진짜 폴더로는 이 상황을 못 만듭니다)
    """
    certifi = pytest.importorskip('certifi')
    원본 = r'/usr/lib/python3/dist-packages/certifi/cacert.pem'
    monkeypatch.setattr(certifi, 'where', lambda: 원본)
    monkeypatch.setenv('SSL_CERT_FILE', '표시용_원래값')

    assert certfix.ensure_ascii_cacert(verbose=False) is None
    assert certifi.where() == 원본                     # 바꾸지 않았다
    assert os.environ['SSL_CERT_FILE'] == '표시용_원래값'  # 환경도 건드리지 않았다


def test_한글_경로면_사본을_만들고_certifi가_그것을_가리킨다(tmp_path, monkeypatch):
    certifi = pytest.importorskip('certifi')
    원본 = 인증서만들기(str(tmp_path / '디자이너' / 'certifi'), b'-- real ca --\n')
    보관 = str(tmp_path / 'ascii_store')
    monkeypatch.setattr(certifi, 'where', lambda: 원본)
    monkeypatch.setattr(certfix, '_보관후보', lambda: iter([보관]))
    for 변수 in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE'):
        monkeypatch.delenv(변수, raising=False)

    사본 = certfix.ensure_ascii_cacert(verbose=False)

    assert 사본 == os.path.join(보관, 'cacert.pem')
    assert os.path.exists(사본)
    with open(사본, 'rb') as f:
        assert f.read() == b'-- real ca --\n'          # 내용이 그대로 복사됐다
    assert certifi.where() == 사본                      # certifi 를 보는 쪽(curl_cffi)이 사본을 쓴다
    assert certifi.core.where() == 사본
    for 변수 in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE'):
        assert os.environ[변수] == 사본                 # certifi 를 안 거치는 도구용


def test_이미_import된_curl_cffi의_박힌_상수도_바꾼다(tmp_path, monkeypatch):
    """`curl_cffi.curl` 은 import 시점에 `DEFAULT_CACERT` 를 상수로 박아 둡니다.

    우회를 늦게 걸어도 살아나야 합니다 — 이 한 줄이 없으면 순서가 어긋나는 순간
    증상이 그대로 되돌아옵니다.
    """
    import sys
    import types

    certifi = pytest.importorskip('certifi')
    원본 = 인증서만들기(str(tmp_path / '한글폴더'))
    보관 = str(tmp_path / 'store2')
    가짜 = types.ModuleType('curl_cffi.curl')
    가짜.DEFAULT_CACERT = 원본

    monkeypatch.setattr(certifi, 'where', lambda: 원본)
    monkeypatch.setattr(certfix, '_보관후보', lambda: iter([보관]))
    monkeypatch.setitem(sys.modules, 'curl_cffi.curl', 가짜)

    사본 = certfix.ensure_ascii_cacert(verbose=False)

    assert 가짜.DEFAULT_CACERT == 사본


def test_보관후보는_한글_섞인_폴더를_내놓지_않는다(monkeypatch):
    """`%TEMP%` 는 보통 계정 폴더 아래라 한글이면 똑같이 막힙니다 — 걸러야 합니다."""
    monkeypatch.setenv('ProgramData', r'C:\Users\디자이너\ProgramData')
    monkeypatch.setenv('SystemDrive', 'C:')
    monkeypatch.setattr('tempfile.gettempdir', lambda: r'C:\Users\디자이너\AppData\Local\Temp')

    for 후보 in certfix._보관후보():
        후보.encode('ascii')          # 한글이 섞여 있으면 여기서 실패합니다


def test_쓸_수_있는_폴더가_하나도_없으면_조용히_포기한다(tmp_path, monkeypatch):
    """우회에 실패해도 예외를 던지지 않습니다 — 수집이 죽는 것보다 낫습니다.

    (야후는 어차피 실패하지만, 네이버로 받는 한국 재무는 그대로 살아 있습니다)
    """
    certifi = pytest.importorskip('certifi')
    원본 = 인증서만들기(str(tmp_path / '한글'))
    monkeypatch.setattr(certifi, 'where', lambda: 원본)
    monkeypatch.setattr(certfix, '_보관후보', lambda: iter([]))

    assert certfix.ensure_ascii_cacert(verbose=False) is None
    assert certifi.where() == 원본
