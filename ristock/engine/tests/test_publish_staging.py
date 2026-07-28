# -*- coding: utf-8 -*-
"""publish.py 가 **실행 기록 파일이 있는 PC 에서도** 데이터를 올리는지 확인합니다.

2026-07-28 집 PC 실행이 여기서 멈췄습니다. 수집(10분)도 출고 점검도 다 통과했는데
마지막 올리기에서 `git add` 가 통째로 거부됐습니다.

    The following paths are ignored by one of your .gitignore files:
    ristock/data/last_run.log

`:(exclude)` 로 빼려던 파일을 `.gitignore` 가 **이미** 막고 있으면 git 은
"무시되는 파일을 지목했다"며 add 자체를 거부합니다.
깃허브 러너에는 `last_run.log` 가 아예 없어 이 조건이 성립하지 않았고,
그래서 CI 는 멀쩡한데 집 PC 만 죽었습니다.

이 테스트는 그 상황(로그 파일이 있고 .gitignore 가 막는 PC)을 진짜 git 저장소로
재현합니다. 네트워크는 쓰지 않습니다.
"""
import os

from test_publish_rebase import (git, publish실행, 데이터쓰기,  # noqa: F401
                                 무대, pytestmark)  # noqa: F401  (무대=픽스처, pytestmark=건너뛰기 조건)


def 커밋(작업, env, 메시지):
    git('add', '-A', cwd=작업, env=env)
    git('-c', 'user.name=씨앗', '-c', 'user.email=seed@x',
        'commit', '-m', 메시지, cwd=작업, env=env)


def test_무시되는_실행기록이_있어도_데이터를_올린다(무대):
    """집 PC 재현 — `.gitignore` 가 막는 `last_run.log` 가 실제로 놓여 있는 상태."""
    작업, env = 무대['작업'], 무대['env']

    with open(os.path.join(작업, '.gitignore'), 'w', encoding='utf-8') as f:
        f.write('ristock/data/last_run.log\n')
    커밋(작업, env, '.gitignore 추가')

    # PC 는 실행할 때마다 이 파일을 새로 씁니다 (깃허브 러너에는 없습니다)
    로그 = os.path.join(작업, 'ristock', 'data', 'last_run.log')
    with open(로그, 'w', encoding='utf-8') as f:
        f.write('Ri_Stock 실행 기록\n')
    데이터쓰기(작업, '20260728', '오늘')

    r = publish실행(무대, '--push', '--runner', 'pc')
    assert r.returncode == 0, f'올리기가 실패했습니다:\n{r.stdout}\n{r.stderr}'

    # 데이터는 원격까지 올라갔고
    원격 = git('ls-tree', '-r', '--name-only', 'origin/main', cwd=작업, env=env).stdout
    assert 'ristock/data/stocks_KR.json' in 원격
    # 실행 기록은 저장소에 들어가지 않았다 (제외 장치가 살아 있는가)
    assert 'last_run.log' not in 원격
    assert 'last_run.log' not in git('ls-files', cwd=작업, env=env).stdout


def test_gitignore_가_비어_있으면_제외_pathspec_이_대신_막는다(무대):
    """`.gitignore` 규칙이 사라져도 실행 기록이 커밋되면 안 됩니다.

    무시되지 않는 상황에서는 `:(exclude)` 가 그대로 남아야 한다는 뜻입니다
    (`추가경로()` 가 조건에 따라 pathspec 을 바꾸므로 양쪽 다 확인합니다).
    """
    작업, env = 무대['작업'], 무대['env']

    로그 = os.path.join(작업, 'ristock', 'data', 'last_run.log')
    with open(로그, 'w', encoding='utf-8') as f:
        f.write('막아 주는 .gitignore 가 없는 상태\n')
    데이터쓰기(작업, '20260728', '오늘')

    r = publish실행(무대, '--push', '--runner', 'pc')
    assert r.returncode == 0, f'올리기가 실패했습니다:\n{r.stdout}\n{r.stderr}'

    원격 = git('ls-tree', '-r', '--name-only', 'origin/main', cwd=작업, env=env).stdout
    assert 'ristock/data/stocks_KR.json' in 원격
    assert 'last_run.log' not in 원격
