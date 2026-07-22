# -*- coding: utf-8 -*-
"""집·회사 동시 작업 동기화 엔진

사용법 (이것만 기억하면 됩니다)
  python tools/sync.py                  받기   — 상대 PC 작업 가져오기
  python tools/sync.py "무엇을 했는지"    저장   — 커밋 + 받기 + 보내기 (한 번에)
  python tools/sync.py --status         현황   — 양쪽 PC가 뭘 하고 있는지
  python tools/sync.py --start "작업명"  시작   — 내가 뭘 작업하는지 상대에게 알림

핵심: 충돌을 사람이 손대지 않도록 자동 해결한다.
  · js/holeimgdb.js  → 조립 산출물이므로 재생성
  · APP_VER / sw.js  → 두 버전 중 큰 값 채택
  · 구장 폴더        → 양쪽 모두 보존 (서로 다른 구장이므로)
자동 해결이 불가능한 진짜 충돌만 사람에게 보고한다.
"""
import json, os, re, socket, subprocess, sys, time
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNCDIR = os.path.join(ROOT, ".sync")
HOST = os.environ.get("COMPUTERNAME") or socket.gethostname()
MYFILE = os.path.join(SYNCDIR, f"{HOST}.json")

# 자동 재생성으로 해결하는 조립 산출물
REGEN = {"js/holeimgdb.js": ["tools/build_holeimgdb.py"]}
# 두 값 중 큰 버전을 채택하는 파일
VERSIONED = {"js/app.js", "sw.js"}


def git(*args, check=True):
    r = subprocess.run(["git", "-C", ROOT] + list(args),
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}\n{r.stderr.strip()[:400]}")
    return r


def out(*args):
    return git(*args).stdout.strip()


# ── 작업 상태 공유 (각 PC가 자기 파일만 쓰므로 절대 충돌하지 않음) ──────────
def write_status(working_on=None, note=None):
    os.makedirs(SYNCDIR, exist_ok=True)
    prev = {}
    if os.path.exists(MYFILE):
        try:
            prev = json.load(open(MYFILE, encoding="utf-8"))
        except Exception:
            prev = {}
    data = {
        "host": HOST,
        "working_on": working_on if working_on is not None else prev.get("working_on", ""),
        "last_sync": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "head": out("rev-parse", "--short", "HEAD"),
    }
    if note:
        data["note"] = note
    json.dump(data, open(MYFILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def show_status():
    print(f"■ 이 PC: {HOST}")
    if not os.path.isdir(SYNCDIR):
        print("  (아직 동기화 기록 없음)")
        return
    for f in sorted(os.listdir(SYNCDIR)):
        if not f.endswith(".json"):
            continue
        d = json.load(open(os.path.join(SYNCDIR, f), encoding="utf-8"))
        me = " ← 나" if d.get("host") == HOST else ""
        print(f"  · {d.get('host')}{me}")
        print(f"      작업: {d.get('working_on') or '(미지정)'}")
        print(f"      마지막 동기화: {d.get('last_sync')}  ({d.get('head')})")


# ── 충돌 자동 해결 ────────────────────────────────────────────────────
VER_LINE = re.compile(r'(APP_VER\s*=\s*"v\d+"|riweather-v\d+)')


def pick_larger_version(path):
    """배포 버전 줄의 충돌만 '큰 값'으로 해결한다.
    ⚠ 버전 줄이 아닌 충돌(실제 코드 수정)은 절대 건드리지 않는다 —
      한쪽 작업이 조용히 사라지는 것을 막기 위함."""
    full = os.path.join(ROOT, path)
    txt = open(full, encoding="utf-8").read()
    pat = re.compile(r"<<<<<<<[^\n]*\n(.*?)\n?=======\n(.*?)\n?>>>>>>>[^\n]*\n", re.S)

    def choose(m):
        a, b = m.group(1), m.group(2)
        if not (VER_LINE.search(a) and VER_LINE.search(b)):
            return m.group(0)                      # 코드 충돌 → 그대로 남겨 사람에게 보고
        va = max([int(x) for x in re.findall(r"v(\d+)", a)] or [-1])
        vb = max([int(x) for x in re.findall(r"v(\d+)", b)] or [-1])
        return (a if va >= vb else b) + "\n"

    new, n = pat.subn(choose, txt)
    if n == 0:
        return False
    open(full, "w", encoding="utf-8", newline="\n").write(new)
    return "<<<<<<<" not in new                    # 남아 있으면 미해결로 보고


def regenerate(path):
    for script in REGEN[path]:
        r = subprocess.run([sys.executable, os.path.join(ROOT, script)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            print(f"    재생성 실패({script}): {r.stderr[:200]}")
            return False
    return True


def guard_huge_upload(limit_mb=120):
    """대용량 자료가 실수로 저장소에 올라가는 것을 막는다.
    (수집 원본 등은 .gitignore 로 제외하는 것이 정답)"""
    total, big = 0, []
    for line in out("status", "--porcelain").splitlines():
        rel = line[3:].strip().strip('"')
        p = os.path.join(ROOT, rel)
        if os.path.isdir(p):
            for root, _, files in os.walk(p):
                for x in files:
                    try:
                        total += os.path.getsize(os.path.join(root, x))
                    except OSError:
                        pass
        elif os.path.isfile(p):
            try:
                sz = os.path.getsize(p)
            except OSError:
                continue
            total += sz
            if sz > 25 * 1024 * 1024:
                big.append(f"{rel} ({sz/1048576:.0f}MB)")
    mb = total / 1048576
    if mb > limit_mb:
        print(f"⚠ 올리려는 파일이 {mb:.0f}MB 입니다 (기준 {limit_mb}MB).")
        print("  저장소가 무거워지면 양쪽 PC 모두 느려집니다.")
        if big:
            print("  큰 파일:", ", ".join(big[:5]))
        print("  → 재수집 가능한 자료라면 .gitignore 에 추가한 뒤 다시 실행하세요.")
        print("  → 그래도 올리려면: python tools/sync.py \"메시지\" --allow-big")
        return False
    return True


def conflicted_files():
    return [l[3:].strip().strip('"') for l in out("status", "--porcelain").splitlines()
            if l[:2] in ("UU", "AA", "DU", "UD", "AU", "UA")]


def auto_resolve():
    """해결한 파일 목록, 못 푼 파일 목록 반환"""
    fixed, stuck = [], []
    for f in conflicted_files():
        norm = f.replace("\\", "/")
        try:
            if norm in REGEN:
                ok = regenerate(norm)
            elif norm in VERSIONED:
                ok = pick_larger_version(norm)
            elif norm.startswith(("holeimg/", "coursedata/")):
                # 구장 자료(이미지·등록결과)는 사람이 병합할 수 없음 → 내가 방금 만든 쪽 채택.
                # rebase 중에는 --theirs 가 '적용 중인 내 커밋'을 가리킨다.
                ok = git("checkout", "--theirs", "--", f, check=False).returncode == 0
            else:
                ok = False
        except Exception as e:
            print(f"    {norm}: 해결 실패 {str(e)[:80]}")
            ok = False
        if ok:
            git("add", "--", f, check=False)
            fixed.append(norm)
        else:
            stuck.append(norm)
    return fixed, stuck


def rebase_with_autofix():
    """pull --rebase 하면서 충돌은 자동 해결. 성공 여부 반환"""
    r = git("pull", "--rebase", "origin", "main", check=False)
    if r.returncode == 0:
        return True, []
    for _ in range(12):                       # 커밋마다 충돌할 수 있어 반복
        if not conflicted_files():
            break
        fixed, stuck = auto_resolve()
        if fixed:
            print(f"    자동 해결: {', '.join(fixed)}")
        if stuck:
            return False, stuck
        c = git("-c", "core.editor=true", "rebase", "--continue", check=False)
        if c.returncode == 0 and not conflicted_files():
            return True, []
        if "no rebase in progress" in (c.stderr or ""):
            return True, []
    return (not conflicted_files()), conflicted_files()


def in_rebase():
    g = os.path.join(ROOT, ".git")
    return os.path.exists(os.path.join(g, "rebase-merge")) or os.path.exists(os.path.join(g, "rebase-apply"))


# ── 메인 흐름 ─────────────────────────────────────────────────────────
def main():
    args = [a for a in sys.argv[1:]]
    if "--status" in args:
        show_status()
        return
    if "--abort" in args:
        git("rebase", "--abort", check=False)
        if "sync-temp" in git("stash", "list", check=False).stdout:
            git("stash", "pop", check=False)
        print("동기화를 취소하고 작업 전 상태로 되돌렸습니다.")
        return
    if "--start" in args:
        i = args.index("--start")
        task = args[i + 1] if len(args) > i + 1 else ""
        write_status(working_on=task)
        print(f"작업 시작 기록: {task}")
        print("(다음 저장 때 상대 PC에 전달됩니다)")
        return

    msg = next((a for a in args if not a.startswith("--")), None)
    push_mode = msg is not None

    if in_rebase():
        print("⚠ 이전 동기화가 중단된 상태입니다. 자동 복구를 시도합니다.")
        ok, stuck = rebase_with_autofix()
        if not ok:
            print("복구 실패 — 다음 파일을 사람이 확인해야 합니다:", stuck)
            return

    # 1) 내 변경 처리
    dirty = bool(out("status", "--porcelain"))
    stashed = False
    if dirty:
        if push_mode:
            if "--allow-big" not in args and not guard_huge_upload():
                return
            git("add", "-A")
            git("commit", "-m", f"{msg}\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>", check=False)
            print(f"✔ 커밋: {msg}")
        else:
            git("stash", "push", "-u", "-m", "sync-temp", check=False)
            stashed = True
            print("· 작업 중인 변경을 잠시 보관")

    # 2) 상대 작업 받기 (+ 3) 보내기, 경쟁하면 재시도)
    for attempt in range(1, 4):
        before = out("rev-parse", "HEAD")
        ok, stuck = rebase_with_autofix()
        if not ok:
            print("✖ 같은 곳을 양쪽에서 고쳐서 자동 합치기 실패:", ", ".join(stuck))
            print("  · 이어서 정리하려면 : 해당 파일의 <<<<<<< 부분을 정리 후")
            print("                       git add <파일> && git rebase --continue")
            print("  · 취소하고 되돌리려면: python tools/sync.py --abort")
            return
        pulled = out("rev-list", "--count", f"{before}..HEAD")
        if pulled and pulled != "0":
            print(f"✔ 상대 작업 {pulled}개 받음")

        if not push_mode:
            break
        p = git("push", "origin", "main", check=False)
        if p.returncode == 0:
            print("✔ 보내기 완료 (상대 PC에서 받을 수 있습니다)")
            break
        print(f"· 상대가 방금 올림 → 다시 합치는 중 ({attempt}/3)")
        time.sleep(1.5)
    else:
        print("✖ 보내기 실패 — 잠시 후 다시 시도해 주세요")
        return

    # 4) 보관했던 변경 복구
    if stashed:
        r = git("stash", "pop", check=False)
        if r.returncode != 0:
            print("⚠ 보관한 변경 복구 중 충돌 — 'git stash list'로 확인 가능")
        else:
            print("· 작업 중인 변경 복구 완료")

    write_status()
    ver = ""
    try:
        ver = re.search(r'APP_VER = "(v\d+)"',
                        open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()).group(1)
    except Exception:
        pass
    print(f"\n■ 현재 상태: {ver} · {out('rev-parse', '--short', 'HEAD')}")
    show_status()


if __name__ == "__main__":
    main()
