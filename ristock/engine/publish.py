# -*- coding: utf-8 -*-
"""Ri_Stock 자동 배포 — **생성된 데이터만** 안전하게 커밋·푸시

    python -m ristock.engine.publish --sync                   # (엔진 실행 전) 원격 상태로 정렬
    python -m ristock.engine.publish --push                   # (엔진 실행 후) 변경분만 커밋·푸시
    python -m ristock.engine.publish --push -m "메시지"
    python -m ristock.engine.publish --sync --push --dry-run  # 무엇을 할지 보기만 (아무것도 안 바꿈)
    python -m ristock.engine.publish --status                 # 지금 무엇이 바뀌었는지만 확인

이 저장소는 사장님이 **집 PC와 회사 PC 두 곳에서 동시에** 씁니다(`tools/sync.py` 참고).
그래서 이 스크립트에는 지켜야 할 선이 있습니다.

1. **손대는 경로는 `ristock/data/` 하나뿐입니다.**
   다른 경로는 스테이징도, 커밋도, 되돌리기도 하지 않습니다.
   사장님이 같은 시각에 `index.html` 을 고치고 있어도 그 작업은 건드리지 않습니다.
2. **강제 푸시(force push)는 어떤 경우에도 하지 않습니다.** 상대 PC 작업이 사라지기 때문입니다.
3. 원격이 앞서 있어 푸시가 거부되면 `origin/<브랜치>` 위로 **리베이스**해 다시 보냅니다.
   이때 충돌이 `ristock/data/` 안에서만 났다면 **새로 생성한 데이터**를 채택합니다
   (데이터는 매번 전량 재생성되므로 합칠 필요가 없습니다).
   `ristock/data/` **밖에서** 충돌이 나면 즉시 중단하고 사람에게 보고합니다.

동작 순서(설계서 4.2)
    fetch → `git checkout origin/<브랜치> -- ristock/data`  (= --sync)
          → 엔진이 데이터 재생성
          → add → commit → push                            (= --push)

※ 스크리닝 참고자료일 뿐 투자 권유가 아닙니다.
"""

import argparse
import json
import os
import subprocess
import sys
import time

try:                                     # 패키지로 실행: python -m ristock.engine.publish
    from .config import DATA_DIR, MANIFEST_FILE, REPO_DIR
except ImportError:                      # 파일로 직접 실행: python ristock/engine/publish.py
    sys.path.insert(0, os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__)))))
    from ristock.engine.config import DATA_DIR, MANIFEST_FILE, REPO_DIR

if hasattr(sys.stdout, 'reconfigure'):   # 윈도우 cp949 콘솔에서 한글이 깨지지 않도록
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# =========================
# 상수 — 이 스크립트가 다루는 유일한 경로
# =========================
DATA_REL = os.path.relpath(DATA_DIR, REPO_DIR).replace(os.sep, '/')   # 'ristock/data'
PUSH_BACKOFF = (2, 4, 8, 16)          # 네트워크 실패 시 재시도 간격(초) — 최대 4회
REBASE_STEPS = 12                     # 리베이스 중 충돌 자동 해결 반복 한도
MAX_MB = 40                           # 이만큼보다 큰 데이터를 올리려 하면 멈춘다
CONFLICT_CODES = ('UU', 'AA', 'DU', 'UD', 'AU', 'UA', 'DD')
FALLBACK_AUTHOR = 'Ri_Stock 자동실행 <ristock@local>'


# =========================
# git 얇은 껍데기
# =========================
def git(*args, check=False):
    """항상 저장소 루트에서 실행한다. 실패해도 예외 대신 결과를 돌려준다."""
    r = subprocess.run(['git', '-C', REPO_DIR] + [a for a in args],
                       capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}\n{(r.stderr or '').strip()[:500]}")
    return r


def _out(*args):
    return (git(*args).stdout or '').strip()


def 현재브랜치():
    """체크아웃된 브랜치 이름. 분리된 HEAD면 CI 환경변수로 보완한다."""
    name = _out('rev-parse', '--abbrev-ref', 'HEAD')
    if name and name != 'HEAD':
        return name
    return (os.environ.get('GITHUB_REF_NAME')
            or os.environ.get('RISTOCK_BRANCH') or 'main')


def 리베이스중():
    g = os.path.join(REPO_DIR, '.git')
    return (os.path.exists(os.path.join(g, 'rebase-merge'))
            or os.path.exists(os.path.join(g, 'rebase-apply')))


def _포셀린(경로만=True):
    """`ristock/data` 안의 변경 목록 [(상태, 경로), …]"""
    args = ['status', '--porcelain', '--untracked-files=all']
    if 경로만:
        args += ['--', DATA_REL]
    rows = []
    for line in (git(*args).stdout or '').splitlines():
        if len(line) < 4:
            continue
        rows.append((line[:2], line[3:].strip().strip('"')))
    return rows


def 데이터변경있음():
    """`git diff` 기준 판정 — 내용이 진짜 달라졌을 때만 True."""
    return bool(_포셀린())


def 충돌파일():
    rows = _포셀린(경로만=False)
    return [p for st, p in rows if st in CONFLICT_CODES]


# =========================
# 1단계 — 원격 상태로 정렬 (--sync)
# =========================
def sync_data(branch=None, dry_run=False):
    """엔진을 돌리기 **직전에** 원격의 `ristock/data` 를 그대로 받아온다.

    데이터는 매번 전량 재생성되므로 병합이 필요 없습니다.
    원격 상태에서 출발했다가 통째로 다시 쓰면 충돌 자체가 생기지 않습니다.
    반환값: 0 정상 / 1 사람이 봐야 함
    """
    branch = branch or 현재브랜치()
    print(f'■ 원격 상태 정렬 — origin/{branch} 의 {DATA_REL}/')

    if 리베이스중():
        print('  ⛔ 이전 동기화(rebase)가 끝나지 않았습니다.')
        print('     python tools/sync.py --abort 로 정리한 뒤 다시 실행해 주세요.')
        return 1

    if dry_run:
        print(f'  (미리보기) git fetch origin {branch}')
        print(f'  (미리보기) git checkout origin/{branch} -- {DATA_REL}')
        return 0

    f = git('fetch', '--quiet', 'origin', branch)
    if f.returncode != 0:
        # 인터넷이 잠깐 끊겨도 데이터 생성 자체는 계속할 수 있어야 합니다.
        print(f"  ⚠ 원격을 받지 못했습니다 ({(f.stderr or '').strip()[:150]})")
        print('     로컬 데이터로 계속 진행합니다. 푸시할 때 다시 맞춥니다.')
        return 0

    c = git('checkout', f'origin/{branch}', '--', DATA_REL)
    if c.returncode != 0:
        msg = (c.stderr or '').strip()
        if 'did not match' in msg or 'pathspec' in msg:
            # 아직 원격에 데이터가 한 번도 올라간 적 없음 (최초 실행)
            print(f'  · 원격에 {DATA_REL}/ 이 아직 없습니다 — 이번에 처음 만듭니다.')
            return 0
        print(f'  ⛔ 정렬 실패: {msg[:300]}')
        return 1

    print('  ✔ 원격 데이터를 받아왔습니다 (엔진이 곧 전량 재생성합니다)')
    return 0


# =========================
# 2단계 — 커밋·푸시 (--push)
# =========================
def _manifest():
    try:
        with open(os.path.join(DATA_DIR, MANIFEST_FILE), encoding='utf-8') as fp:
            return json.load(fp)
    except Exception:
        return {}


def 기본커밋메시지(runner=None):
    """기준일·주체가 한눈에 보이는 메시지를 manifest 에서 만든다."""
    m = _manifest()
    기준일 = m.get('기준일') or time.strftime('%Y%m%d')
    주체 = runner or ((m.get('실행') or {}).get('주체')) or 'pc'
    조각 = []
    for 시장, info in (m.get('시장') or {}).items():
        if isinstance(info, dict):
            조각.append(f"{시장} {info.get('종목수', 0)}종목"
                        f"(평가 {info.get('평가종목수', 0)})")
    본문 = ', '.join(조각) or '데이터 갱신'
    메모 = ((m.get('실행') or {}).get('메모') or '').strip()
    제목 = f'Ri_Stock 데이터 자동 갱신 {기준일} ({주체})'
    줄 = [제목, '', 본문]
    if 메모:
        줄.append(f'메모: {메모}')
    줄.append('')
    줄.append('※ 스크리닝 참고자료일 뿐 투자 권유가 아닙니다.')
    return '\n'.join(줄)


def _신원인자(author):
    """author('이름 <메일>') → git -c 인자. 작성자와 커밋터를 함께 맞춘다."""
    이름, 메일 = '', ''
    if author and '<' in author and author.rstrip().endswith('>'):
        이름 = author.split('<', 1)[0].strip()
        메일 = author.split('<', 1)[1].rstrip().rstrip('>').strip()
    if not 메일:
        if _out('config', 'user.email'):
            return []                     # 이미 설정된 사장님 계정을 그대로 쓴다
        이름 = FALLBACK_AUTHOR.split('<', 1)[0].strip()
        메일 = FALLBACK_AUTHOR.split('<', 1)[1].rstrip('>').strip()
    return ['-c', f'user.name={이름}', '-c', f'user.email={메일}']


def 용량점검(max_mb=MAX_MB):
    """실수로 큰 파일이 올라가면 저장소가 무거워져 양쪽 PC가 모두 느려진다."""
    총 = 0
    큰것 = []
    for _, rel in _포셀린():
        p = os.path.join(REPO_DIR, rel)
        if os.path.isdir(p):
            for root, _dirs, files in os.walk(p):
                for x in files:
                    try:
                        총 += os.path.getsize(os.path.join(root, x))
                    except OSError:
                        pass
        elif os.path.isfile(p):
            try:
                sz = os.path.getsize(p)
            except OSError:
                continue
            총 += sz
            if sz > 10 * 1024 * 1024:
                큰것.append(f'{rel} ({sz / 1048576:.0f}MB)')
    mb = 총 / 1048576
    if mb > max_mb:
        print(f'  ⛔ 올리려는 데이터가 {mb:.0f}MB 입니다 (기준 {max_mb}MB).')
        if 큰것:
            print('     큰 파일: ' + ', '.join(큰것[:5]))
        print('     엑셀 산출물이 ristock/data 안에 들어갔는지 확인하세요.')
        print('     (엔진 실행 시 --excel-dir 로 저장소 밖에 저장하는 것이 정답입니다)')
        print('     그래도 올리려면: --allow-big')
        return False
    return True


def _충돌해결_데이터만():
    """리베이스 충돌을 자동 해결한다.

    `ristock/data` 밖에서 난 충돌은 **절대 손대지 않고** False 를 돌려줍니다.
    (리베이스 중에는 `--theirs` 가 '지금 적용 중인 내 커밋' 쪽을 가리킵니다 — 새로 만든 데이터)
    """
    남은 = 충돌파일()
    바깥 = [f for f in 남은 if not f.replace('\\', '/').startswith(DATA_REL + '/')]
    if 바깥:
        print('  ⛔ 데이터 밖에서 충돌이 났습니다 — 자동으로 손대지 않습니다:')
        for f in 바깥[:10]:
            print(f'     · {f}')
        return False
    for f in 남은:
        if git('checkout', '--theirs', '--', f).returncode == 0:
            git('add', '--', f)
        elif os.path.exists(os.path.join(REPO_DIR, f)):
            git('add', '--', f)
        else:
            git('rm', '-f', '--quiet', '--', f)
    return True


def _원격과합치기(branch):
    """푸시가 거부됐을 때 origin/<branch> 위로 리베이스한다. 성공 여부 반환.

    `rebase.autoStash` 를 켜 두어 사장님이 **다른 파일을 편집 중이어도** 그 작업을
    잠시 보관했다가 그대로 되돌려 줍니다(작업이 사라지지 않습니다).
    """
    print(f'  · 원격이 앞서 있습니다 → origin/{branch} 위로 다시 얹는 중')
    if git('fetch', '--quiet', 'origin', branch).returncode != 0:
        print('  ⛔ 원격을 받지 못했습니다 (네트워크 확인)')
        return False

    리베이스 = ('-c', 'core.editor=true', '-c', 'rebase.autoStash=true')
    r = git(*리베이스, 'rebase', f'origin/{branch}')
    for _ in range(REBASE_STEPS):
        if r.returncode == 0 and not 충돌파일():
            return True
        if not 충돌파일():
            # 충돌이 아닌 이유로 실패했다 (예: 작업 트리 문제) — 조용히 성공으로 넘기지 않는다
            if 리베이스중():
                git('rebase', '--abort')
            print('  ⛔ 자동 합치기 실패: '
                  f"{((r.stderr or '') + (r.stdout or '')).strip()[:300]}")
            return False
        if not _충돌해결_데이터만():
            git('rebase', '--abort')
            print('     되돌렸습니다. 사람이 확인한 뒤 다시 실행해 주세요.')
            return False
        r = git(*리베이스, 'rebase', '--continue')
        if 'no rebase in progress' in (r.stderr or ''):
            return True
    if 리베이스중():
        git('rebase', '--abort')
        print('  ⛔ 자동 합치기가 끝나지 않아 원래 상태로 되돌렸습니다.')
        return False
    return not 충돌파일()


def _푸시(branch, retries=len(PUSH_BACKOFF)):
    """푸시 — 강제 푸시는 하지 않는다.

    · 네트워크 실패      → 2s → 4s → 8s → 16s 로 최대 4회 재시도
    · non-fast-forward   → 원격과 다시 합친 뒤 **1회만** 재시도
    """
    재합치기했음 = False
    for i in range(retries + 1):
        r = git('push', 'origin', f'HEAD:refs/heads/{branch}')
        if r.returncode == 0:
            print('  ✔ 보내기 완료')
            return True
        err = ((r.stderr or '') + (r.stdout or '')).strip()
        거부 = any(k in err for k in
                   ('non-fast-forward', 'rejected', 'fetch first', 'Updates were rejected'))
        if 거부:
            if 재합치기했음:
                print(f'  ⛔ 다시 합친 뒤에도 거부됐습니다:\n     {err[:300]}')
                return False
            재합치기했음 = True
            if not _원격과합치기(branch):
                return False
            continue                       # 합쳤으니 곧바로 한 번 더 시도
        if i >= retries:
            print(f'  ⛔ 보내기 실패:\n     {err[:300]}')
            return False
        대기 = PUSH_BACKOFF[i]
        print(f'  · 보내기 실패 — {대기}초 뒤 재시도 ({i + 1}/{retries}) : {err[:120]}')
        time.sleep(대기)
    return False


def commit_and_push(message=None, branch=None, author=None, runner=None,
                    dry_run=False, allow_big=False, push=True):
    """`ristock/data` 의 변경분만 커밋하고 보낸다.

    반환값: 0 정상(변경 없음 포함) / 1 사람이 봐야 함
    """
    branch = branch or 현재브랜치()

    if 리베이스중():
        print('  ⛔ 이전 동기화(rebase)가 끝나지 않았습니다 — 먼저 정리해 주세요.')
        return 1

    변경 = _포셀린()
    if not 변경:
        print('■ 바뀐 데이터가 없습니다 — 커밋하지 않고 끝냅니다.')
        return 0

    print(f'■ 바뀐 데이터 {len(변경)}건')
    for st, rel in 변경[:20]:
        print(f'   {st} {rel}')
    if len(변경) > 20:
        print(f'   … 외 {len(변경) - 20}건')

    if not allow_big and not 용량점검():
        return 1

    msg = message or 기본커밋메시지(runner)
    if dry_run:
        print('  (미리보기) 아무것도 커밋·푸시하지 않았습니다.')
        print(f'  (미리보기) git add -A -- {DATA_REL}')
        print(f'  (미리보기) git commit -- {DATA_REL}')
        print(f'  (미리보기) 커밋 메시지: {msg.splitlines()[0]}')
        if push:
            print(f'  (미리보기) git push origin HEAD:refs/heads/{branch}')
        return 0

    a = git('add', '-A', '--', DATA_REL)
    if a.returncode != 0:
        print(f"  ⛔ 스테이징 실패: {(a.stderr or '').strip()[:300]}")
        return 1

    # 다른 경로가 이미 스테이징돼 있어도 함께 커밋되지 않도록 경로를 못박는다
    if git('diff', '--cached', '--quiet', '--', DATA_REL).returncode == 0:
        print('■ 내용이 같아 커밋할 것이 없습니다.')
        return 0

    c = git(*_신원인자(author), 'commit', '-m', msg, '--only', '--', DATA_REL)
    if c.returncode != 0:
        print(f"  ⛔ 커밋 실패: {((c.stderr or '') + (c.stdout or '')).strip()[:300]}")
        return 1
    print(f"  ✔ 커밋: {msg.splitlines()[0]}  ({_out('rev-parse', '--short', 'HEAD')})")

    if not push:
        return 0
    return 0 if _푸시(branch) else 1


# =========================
# CLI
# =========================
def build_parser():
    ap = argparse.ArgumentParser(
        prog='ristock-publish',
        description='Ri_Stock 데이터 배포 — ristock/data 만 커밋·푸시합니다 (강제 푸시 안 함)')
    ap.add_argument('--sync', action='store_true',
                    help='엔진 실행 전: origin/<브랜치> 의 ristock/data 를 받아 정렬')
    ap.add_argument('--push', action='store_true',
                    help='엔진 실행 후: 바뀐 데이터만 커밋하고 보냄')
    ap.add_argument('--commit-only', action='store_true',
                    help='커밋만 하고 보내지 않음 (--push 와 함께)')
    ap.add_argument('--status', action='store_true', help='무엇이 바뀌었는지만 보여줌')
    ap.add_argument('-m', '--message', default=None, help='커밋 메시지 (기본: manifest 로 자동 작성)')
    ap.add_argument('--branch', default=None, help='대상 브랜치 (기본: 현재 브랜치)')
    ap.add_argument('--author', default=None, help='커밋 작성자 "이름 <메일>"')
    ap.add_argument('--runner', choices=['pc', 'github-actions'], default=None,
                    help='커밋 메시지에 적을 실행 주체')
    ap.add_argument('--dry-run', action='store_true', help='실제로는 아무것도 바꾸지 않고 보여주기만')
    ap.add_argument('--allow-big', action='store_true',
                    help=f'{MAX_MB}MB 초과여도 강행 (평소에는 쓰지 마세요)')
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)

    if args.status:
        변경 = _포셀린()
        print(f'■ 브랜치: {args.branch or 현재브랜치()}')
        print(f'■ {DATA_REL} 변경 {len(변경)}건')
        for st, rel in 변경:
            print(f'   {st} {rel}')
        return 0

    if not (args.sync or args.push):
        build_parser().print_help()
        print('\n무엇을 할지 정해주세요: --sync (받기) 또는 --push (보내기)')
        return 2

    if args.dry_run:
        print('※ 미리보기(--dry-run) — 저장소를 전혀 바꾸지 않습니다.\n')

    rc = 0
    if args.sync:
        rc = sync_data(args.branch, args.dry_run)
        if rc:
            return rc
    if args.push:
        rc = commit_and_push(message=args.message, branch=args.branch,
                             author=args.author, runner=args.runner,
                             dry_run=args.dry_run, allow_big=args.allow_big,
                             push=not args.commit_only)
    return rc


if __name__ == '__main__':
    sys.exit(main())
