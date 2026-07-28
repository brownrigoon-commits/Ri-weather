# -*- coding: utf-8 -*-
"""publish.py 가 **원격이 앞서 있을 때** 제대로 합쳐 보내는지 확인합니다.

2026-07-28 첫 실제 수집이 정확히 여기서 멈췄습니다.
미국·한국 수집도, 출고 점검도 전부 통과했는데 —
같은 시각 사장님이 골프앱을 push 하신 탓에 푸시가 거부되고,
이어진 리베이스가 `fatal: empty ident name` 으로 죽어 하루치 데이터가 날아갔습니다.

원인은 한 줄이었습니다. `git commit` 에는 `-c user.name=…` 을 넘겼는데
**리베이스에는 넘기지 않았습니다.** 리베이스도 커밋을 새로 만드는 작업이라
신원이 필요합니다. 깃허브 러너에는 user.name/user.email 이 비어 있습니다.

이 테스트는 그 상황을 진짜 git 저장소로 재현합니다 — 신원이 비어 있는 로컬 저장소,
원격이 한 발 앞선 상태, 그리고 우리 데이터 커밋. 네트워크는 쓰지 않습니다.
"""
import json
import os
import subprocess
import sys

import pytest

여기 = os.path.dirname(os.path.abspath(__file__))
저장소루트 = os.path.dirname(os.path.dirname(os.path.dirname(여기)))


def 실행(*args, cwd, env=None, check=True):
    # 값이 None 인 키는 **환경에서 지웁니다.**
    # 빈 문자열로 두면 git 은 "설정은 됐는데 비어 있다"로 보고 `-c user.name=…` 보다
    # 그쪽을 우선해서, 신원을 제대로 넘겨도 `empty ident name` 이 납니다.
    합침 = {**os.environ, **(env or {})}
    합침 = {k: v for k, v in 합침.items() if v is not None}
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', env=합침)
    if check and r.returncode != 0:
        raise AssertionError(f"{' '.join(args)}\n{r.stdout}\n{r.stderr}")
    return r


def git(*args, cwd, **kw):
    return 실행('git', *args, cwd=cwd, **kw)


def 신원없는환경():
    """깃허브 러너처럼 user.name/user.email 이 **어디에도** 없는 상태를 만든다.

    HOME 을 빈 폴더로 돌려 전역 설정을 못 읽게 하고, git 이 호스트 이름으로
    이름을 지어내는 것도 막습니다(EMAIL 계열 변수 제거).
    """
    env = {'GIT_CONFIG_NOSYSTEM': '1', 'GIT_TERMINAL_PROMPT': '0',
           'LC_ALL': 'C.UTF-8', 'PYTHONUTF8': '1'}
    for k in ('GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME',
              'GIT_COMMITTER_EMAIL', 'EMAIL', 'GIT_CONFIG_PARAMETERS'):
        env[k] = None                      # None = 환경에서 제거 (위 실행() 참고)
    return env


def 데이터쓰기(작업, 기준일, 표시):
    d = os.path.join(작업, 'ristock', 'data')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'기준일': 기준일, '생성시각': 표시, '시장': {}}, f, ensure_ascii=False)
    with open(os.path.join(d, 'stocks_KR.json'), 'w', encoding='utf-8') as f:
        json.dump({'기준일': 기준일, '종목': [{'티커': '005930', '표시': 표시}]},
                  f, ensure_ascii=False)


@pytest.fixture
def 무대(tmp_path):
    """원격 1개 + 작업 저장소 1개. 둘 다 신원이 비어 있다."""
    env = 신원없는환경()
    홈 = tmp_path / 'home'
    홈.mkdir()
    env['HOME'] = str(홈)
    env['USERPROFILE'] = str(홈)

    원격 = tmp_path / 'remote.git'
    원격.mkdir()
    git('init', '--bare', '--initial-branch=main', cwd=str(원격), env=env)

    작업 = tmp_path / 'work'
    작업.mkdir()
    git('init', '--initial-branch=main', cwd=str(작업), env=env)
    git('remote', 'add', 'origin', str(원격), cwd=str(작업), env=env)

    # 첫 커밋만 신원을 명시해 만든다 (저장소 설정에는 남기지 않는다)
    (작업 / 'index.html').write_text('골프앱\n', encoding='utf-8')
    데이터쓰기(str(작업), '20260727', '어제')
    git('add', '-A', cwd=str(작업), env=env)
    git('-c', 'user.name=씨앗', '-c', 'user.email=seed@x',
        'commit', '-m', '첫 커밋', cwd=str(작업), env=env)
    git('push', '-u', 'origin', 'main', cwd=str(작업), env=env)

    # 확인: 이 저장소에는 신원이 정말 없다
    r = git('config', 'user.email', cwd=str(작업), env=env, check=False)
    assert not (r.stdout or '').strip(), '테스트 전제가 깨졌습니다 — 신원이 설정돼 있습니다'
    return {'작업': str(작업), '원격': str(원격), 'env': env, 'tmp': tmp_path}


def publish실행(무대, *args):
    """작업 저장소를 REPO_DIR 로 삼아 publish 를 돌린다."""
    env = dict(무대['env'])
    env['RISTOCK_REPO_DIR'] = 무대['작업']
    env['PYTHONPATH'] = 저장소루트
    return 실행(sys.executable, '-m', 'ristock.engine.publish', *args,
                cwd=무대['작업'], env=env, check=False)


def _repo_dir_지원():
    """config.py 가 RISTOCK_REPO_DIR 를 읽지 않으면 이 테스트를 건너뛴다."""
    src = open(os.path.join(여기, '..', 'config.py'), encoding='utf-8').read()
    return 'RISTOCK_REPO_DIR' in src


pytestmark = pytest.mark.skipif(
    not _repo_dir_지원(),
    reason='config.py 가 RISTOCK_REPO_DIR 를 지원해야 다른 저장소로 검증할 수 있습니다')


def test_원격이_앞설_때_신원없이도_합쳐_보낸다(무대):
    """이 테스트가 이번 사고의 재현이자 회귀 방지선입니다."""
    작업, env = 무대['작업'], 무대['env']

    # 1) 다른 사람(사장님)이 골프앱을 먼저 올린다 → 원격이 한 발 앞섬
    딴집 = os.path.join(무대['tmp'], 'other')
    git('clone', 무대['원격'], 딴집, cwd=str(무대['tmp']), env=env)
    with open(os.path.join(딴집, 'index.html'), 'a', encoding='utf-8') as f:
        f.write('클럽 피팅 아이콘 교체 v126\n')
    git('add', '-A', cwd=딴집, env=env)
    git('-c', 'user.name=사장님', '-c', 'user.email=boss@x',
        'commit', '-m', '골프앱 v126', cwd=딴집, env=env)
    git('push', 'origin', 'main', cwd=딴집, env=env)

    # 2) 그 사이 우리 엔진이 오늘 데이터를 새로 만들었다
    데이터쓰기(작업, '20260728', '오늘')

    # 3) 커밋·푸시 — 푸시가 거부되고 리베이스로 이어진다
    r = publish실행(무대, '--push', '--branch', 'main',
                    '--author', 'github-actions[bot] <41898282+bot@users.noreply.github.com>')

    assert 'empty ident name' not in (r.stdout + r.stderr), (
        '리베이스에 git 신원이 전달되지 않았습니다 (2026-07-28 사고 재발)\n' + r.stdout + r.stderr)
    assert r.returncode == 0, f'푸시 실패\n{r.stdout}\n{r.stderr}'

    # 4) 원격에 **둘 다** 살아 있어야 한다 — 사장님 작업도, 오늘 데이터도
    확인 = os.path.join(무대['tmp'], 'verify')
    git('clone', 무대['원격'], 확인, cwd=str(무대['tmp']), env=env)
    골프 = open(os.path.join(확인, 'index.html'), encoding='utf-8').read()
    assert 'v126' in 골프, '사장님 골프앱 작업이 사라졌습니다 (강제 푸시 의심)'
    with open(os.path.join(확인, 'ristock', 'data', 'manifest.json'), encoding='utf-8') as f:
        assert json.load(f)['기준일'] == '20260728', '오늘 데이터가 올라가지 않았습니다'


def test_사장님이_편집중이면_합치지_않는다(무대):
    """데이터 밖에 저장 안 한 파일이 있으면 건드리지 않고 멈춰야 합니다.

    리베이스가 그 파일에 충돌 표시를 박아 넣는 사고를 막는 안전장치입니다.
    """
    작업, env = 무대['작업'], 무대['env']

    딴집 = os.path.join(무대['tmp'], 'other2')
    git('clone', 무대['원격'], 딴집, cwd=str(무대['tmp']), env=env)
    with open(os.path.join(딴집, 'index.html'), 'a', encoding='utf-8') as f:
        f.write('원격 변경\n')
    git('add', '-A', cwd=딴집, env=env)
    git('-c', 'user.name=사장님', '-c', 'user.email=boss@x',
        'commit', '-m', '원격 변경', cwd=딴집, env=env)
    git('push', 'origin', 'main', cwd=딴집, env=env)

    데이터쓰기(작업, '20260728', '오늘')
    # 사장님이 index.html 을 편집 중 (저장 안 함)
    with open(os.path.join(작업, 'index.html'), 'a', encoding='utf-8') as f:
        f.write('작업 중인 내용\n')

    r = publish실행(무대, '--push', '--branch', 'main',
                    '--author', 'github-actions[bot] <41898282+bot@users.noreply.github.com>')

    assert r.returncode != 0, '편집 중인 파일이 있는데도 합쳤습니다'
    assert '<<<<<<<' not in open(os.path.join(작업, 'index.html'), encoding='utf-8').read(), \
        '사장님 편집 파일에 충돌 표시가 박혔습니다'
    assert '작업 중인 내용' in open(os.path.join(작업, 'index.html'), encoding='utf-8').read(), \
        '사장님이 편집 중이던 내용이 사라졌습니다'
