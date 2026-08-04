# -*- coding: utf-8 -*-
"""집·회사 동시 작업 동기화 엔진

사용법 (이것만 기억하면 됩니다)
  .\tourist.cmd tools\sync.py                  받기   — 상대 PC 작업 가져오기
  .\tourist.cmd tools\sync.py "무엇을 했는지"    저장   — 커밋 + 받기 + 보내기 (한 번에)
  .\tourist.cmd tools\sync.py --status         현황   — 양쪽 PC가 뭘 하고 있는지
  .\tourist.cmd tools\sync.py --start "작업명"  시작   — 내가 뭘 작업하는지 상대에게 알림
  .\tourist.cmd tools\sync.py --no-artifacts   코드만 — 원본 작업이 전혀 없을 때만 사용

Git 제외 원본(img/pages_v2)은 artifact_sync.py로 먼저 안전하게 주고받는다.
핵심: 안전하다고 증명된 충돌만 자동 해결한다.
  · js/holeimgdb.js  → 조립 산출물이므로 재생성
  · APP_VER / sw.js  → 두 버전 중 큰 값 채택
  · 구장 자료 같은 파일 → 자동 선택하지 않고 중단 (자료 유실 방지)
자동 해결이 불가능한 진짜 충돌만 사람에게 보고한다.
"""
import json, os, re, socket, subprocess, sys, time
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNCDIR = os.path.join(ROOT, ".sync")
HOST = os.environ.get("COMPUTERNAME") or socket.gethostname()
MYFILE = os.path.join(SYNCDIR, f"{HOST}.json")
ARTIFACT_SCRIPT = os.path.join(ROOT, "tools", "artifact_sync.py")
PENDING_STASH_FILE = os.path.join(ROOT, ".sync-pending-stash.json")

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


def ensure_main_branch():
    """다른 브랜치 커밋을 main 전송 성공으로 오인하지 않게 mutation 전에 확인."""
    result = git("symbolic-ref", "--quiet", "--short", "HEAD", check=False)
    branch = result.stdout.strip() if result.returncode == 0 else ""
    if branch != "main":
        print(f"✖ sync.py는 main 브랜치 전용입니다. 현재: {branch or 'detached HEAD'}")
        print("  · 이 브랜치 변경은 먼저 main에 병합한 뒤 동기화하세요.")
        return False
    return True


def stash_entries():
    result = git(
        "stash",
        "list",
        "--format=%H%x09%gd%x09%gs",
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "원인 정보 없음").strip()
        raise RuntimeError(f"git stash list 실패: {detail[:400]}")
    entries = []
    for line in result.stdout.splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3:
            entries.append({"commit": parts[0], "ref": parts[1], "subject": parts[2]})
    return entries


def sync_stash_entries():
    return [
        entry
        for entry in stash_entries()
        if entry["subject"].endswith(": sync-temp")
        or ": sync-temp-" in entry["subject"]
    ]


def has_pending_sync_work():
    return os.path.isfile(PENDING_STASH_FILE) or bool(sync_stash_entries())


def write_pending_stash(commit, label):
    temp = PENDING_STASH_FILE + f".{os.getpid()}.tmp"
    with open(temp, "w", encoding="utf-8", newline="\n") as handle:
        json.dump({"commit": commit, "label": label}, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(temp, PENDING_STASH_FILE)


def clear_pending_stash():
    try:
        os.remove(PENDING_STASH_FILE)
    except FileNotFoundError:
        pass


def pending_stash_ref(commit=None):
    """기록한 stash commit의 현재 stash@{n}을 찾는다. 모호하면 절대 추측하지 않는다."""
    if commit is None and os.path.isfile(PENDING_STASH_FILE):
        with open(PENDING_STASH_FILE, encoding="utf-8") as handle:
            value = json.load(handle)
        commit = value.get("commit")
    entries = stash_entries()
    if commit:
        matches = [entry for entry in entries if entry["commit"] == commit]
        if len(matches) == 1:
            return matches[0]["ref"]
        return None
    legacy = sync_stash_entries()
    return legacy[0]["ref"] if len(legacy) == 1 else None


def pop_pending_stash(commit=None):
    ref = pending_stash_ref(commit)
    if not ref:
        print("✖ 복구할 sync stash를 정확히 식별하지 못했습니다. stash를 그대로 보존합니다.")
        return False
    restored = git("stash", "pop", ref, check=False)
    if restored.returncode != 0:
        detail = (restored.stderr or restored.stdout or "원인 정보 없음").strip()
        print(f"✖ {ref} 복구 실패(원본 stash 보존): {detail[:400]}")
        return False
    clear_pending_stash()
    return True


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


def sync_artifacts(action):
    """Git에서 제외된 투어리스트 원본을 동기화한다.

    보관소 미설정도 실패로 처리해 원본 없이 작업을 시작하거나 저장하지 않게 한다.
    원본과 무관한 작업의 명시적인 --no-artifacts만 우회한다.
    """
    if not os.path.isfile(ARTIFACT_SCRIPT):
        print("✖ 원본 동기화 도구가 없습니다:", ARTIFACT_SCRIPT)
        return False
    r = subprocess.run(
        [sys.executable, ARTIFACT_SCRIPT, action],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.stdout.strip():
        print(r.stdout.rstrip())
    if r.stderr.strip():
        print(r.stderr.rstrip())
    if r.returncode == 0:
        return True
    print("✖ 홀맵 원본 동기화가 끝나지 않아 Git 동기화를 중단했습니다.")
    print("  · 원인을 해결한 뒤 같은 명령을 다시 실행하세요.")
    print("  · 원본과 무관한 코드/Ri_Stock 작업만 저장하려면 --no-artifacts")
    return False


# ── 충돌 자동 해결 ────────────────────────────────────────────────────
VER_LINE = re.compile(r'(APP_VER\s*=\s*"v\d+"|riweather-v\d+)')


def pick_larger_version(path):
    """배포 버전 줄의 충돌만 '큰 값'으로 해결한다.
    ⚠ 버전 줄이 아닌 충돌(실제 코드 수정)은 절대 건드리지 않는다 —
      한쪽 작업이 조용히 사라지는 것을 막기 위함."""
    full = os.path.join(ROOT, path)
    with open(full, encoding="utf-8") as handle:
        txt = handle.read()
    pat = re.compile(r"<<<<<<<[^\n]*\n(.*?)\n?=======\n(.*?)\n?>>>>>>>[^\n]*\n", re.S)

    def choose(m):
        a, b = m.group(1), m.group(2)
        matches_a = list(VER_LINE.finditer(a))
        matches_b = list(VER_LINE.finditer(b))
        if len(matches_a) != 1 or len(matches_b) != 1:
            return m.group(0)                      # 코드 충돌 → 그대로 남겨 사람에게 보고
        match_a, match_b = matches_a[0], matches_b[0]
        normalized_a = a[:match_a.start()] + "<VERSION>" + a[match_a.end():]
        normalized_b = b[:match_b.start()] + "<VERSION>" + b[match_b.end():]
        if normalized_a != normalized_b:
            return m.group(0)                      # 같은 hunk의 다른 코드 변경은 자동 선택 금지
        va = int(re.search(r"v(\d+)", match_a.group(0)).group(1))
        vb = int(re.search(r"v(\d+)", match_b.group(0)).group(1))
        return (a if va >= vb else b) + "\n"

    new, n = pat.subn(choose, txt)
    if n == 0:
        return False
    with open(full, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(new)
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
        print("  → 그래도 올리려면: .\\tourist.cmd tools\\sync.py \"메시지\" --allow-big")
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
    if not in_rebase():
        r = git("pull", "--rebase", "origin", "main", check=False)
        if r.returncode == 0:
            return True, []
        if not in_rebase():
            detail = (r.stderr or r.stdout or "원인 정보 없음").strip()
            print(f"✖ git pull --rebase 실패: {detail[:400]}")
            return False, ["git pull --rebase"]
    for _ in range(12):                       # 커밋마다 충돌할 수 있어 반복
        conflicts = conflicted_files()
        if conflicts:
            fixed, stuck = auto_resolve()
            if fixed:
                print(f"    자동 해결: {', '.join(fixed)}")
            if stuck:
                return False, stuck
        elif not in_rebase():
            return True, []
        c = git("-c", "core.editor=true", "rebase", "--continue", check=False)
        if c.returncode == 0:
            if not in_rebase():
                return True, []
            continue
        remaining = conflicted_files()
        if remaining:
            continue
        if not in_rebase():
            return True, []
        detail = (c.stderr or c.stdout or "원인 정보 없음").strip()
        print(f"✖ git rebase --continue 실패: {detail[:400]}")
        return False, ["git rebase --continue"]
    remaining = conflicted_files()
    return False, remaining or ["git rebase 미완료"]


def in_rebase():
    for name in ("rebase-merge", "rebase-apply"):
        result = git("rev-parse", "--git-path", name, check=False)
        if result.returncode != 0:
            continue
        path = result.stdout.strip()
        if path and not os.path.isabs(path):
            path = os.path.join(ROOT, path)
        if path and os.path.exists(path):
            return True
    return False


# ── 메인 흐름 ─────────────────────────────────────────────────────────
def main():
    args = [a for a in sys.argv[1:]]
    skip_artifacts = "--no-artifacts" in args
    if "--abort" in args:
        had_rebase = in_rebase()
        if had_rebase:
            aborted = git("rebase", "--abort", check=False)
            if aborted.returncode != 0:
                detail = (aborted.stderr or aborted.stdout or "원인 정보 없음").strip()
                print(f"✖ git rebase --abort 실패: {detail[:400]}")
                return 1
        has_pending = os.path.isfile(PENDING_STASH_FILE)
        legacy = [] if has_pending else sync_stash_entries()
        if has_pending or legacy:
            if not pop_pending_stash():
                return 1
        elif not had_rebase:
            print("취소할 rebase 또는 sync stash가 없습니다.")
            return 0
        print("동기화를 취소하고 작업 전 상태로 되돌렸습니다.")
        return 0
    if has_pending_sync_work():
        print("✖ 이전 sync 작업이 stash에 보관된 채 끝나지 않았습니다.")
        print("  · 먼저 .\\tourist.cmd tools\\sync.py --abort 로 정확한 작업을 복구하세요.")
        return 1
    if "--status" in args:
        show_status()
        if not skip_artifacts:
            print()
            return 0 if sync_artifacts("status") else 1
        return 0
    if not ensure_main_branch():
        return 1
    if "--start" in args:
        i = args.index("--start")
        task = args[i + 1] if len(args) > i + 1 else ""
        write_status(working_on=task)
        print(f"작업 시작 기록: {task}")
        print("(다음 저장 때 상대 PC에 전달됩니다)")
        return 0

    msg = next((a for a in args if not a.startswith("--")), None)
    push_mode = msg is not None

    # Git이 보지 못하는 원본부터 보관한다. 여기서 실패하면 코드만 먼저 보내
    # 수집 원본이 한 PC에 남는 불완전한 "동기화 성공"을 만들지 않는다.
    if push_mode and not skip_artifacts:
        if not sync_artifacts("push"):
            return 1

    if in_rebase():
        print("⚠ 이전 동기화가 중단된 상태입니다. 자동 복구를 시도합니다.")
        ok, stuck = rebase_with_autofix()
        if not ok:
            print("복구 실패 — 다음 파일을 사람이 확인해야 합니다:", stuck)
            return 1

    # 1) 내 변경 처리
    dirty = bool(out("status", "--porcelain"))
    stashed_commit = None
    if dirty:
        if push_mode:
            if "--allow-big" not in args and not guard_huge_upload():
                return 1
            git("add", "-A")
            committed = git(
                "commit",
                "-m",
                f"{msg}\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
                check=False,
            )
            if committed.returncode != 0:
                detail = (committed.stderr or committed.stdout or "원인 정보 없음").strip()
                print(f"✖ git commit 실패: {detail[:400]}")
                return 1
            print(f"✔ 커밋: {msg}")
        else:
            stash_label = f"sync-temp-{HOST}-{os.getpid()}-{int(time.time())}"
            before_stash = git(
                "rev-parse", "--quiet", "--verify", "refs/stash", check=False
            ).stdout.strip()
            saved = git("stash", "push", "-u", "-m", stash_label, check=False)
            if saved.returncode != 0:
                detail = (saved.stderr or saved.stdout or "원인 정보 없음").strip()
                print(f"✖ 작업 중 변경 보관 실패: {detail[:400]}")
                return 1
            after_stash = git(
                "rev-parse", "--quiet", "--verify", "refs/stash", check=False
            ).stdout.strip()
            created = [
                entry
                for entry in stash_entries()
                if entry["commit"] == after_stash
                and entry["subject"].endswith(f": {stash_label}")
            ]
            if not after_stash or after_stash == before_stash or len(created) != 1:
                print("✖ 작업 변경을 새 sync stash로 보관하지 못했습니다. 기존 stash는 건드리지 않습니다.")
                return 1
            stashed_commit = after_stash
            write_pending_stash(stashed_commit, stash_label)
            print("· 작업 중인 변경을 잠시 보관")

    # 2) 상대 작업 받기 (+ 3) 보내기, 경쟁하면 재시도)
    for attempt in range(1, 4):
        before = out("rev-parse", "HEAD")
        ok, stuck = rebase_with_autofix()
        if not ok:
            print("✖ Git 받기/병합을 끝내지 못했습니다:", ", ".join(stuck))
            print("  · 이어서 정리하려면 : 해당 파일의 <<<<<<< 부분을 정리 후")
            print("                       git add <파일> && git rebase --continue")
            print("  · 취소하고 되돌리려면: .\\tourist.cmd tools\\sync.py --abort")
            return 1
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
        return 1

    # 4) 보관했던 변경 복구
    if stashed_commit:
        if not pop_pending_stash(stashed_commit):
            print("⚠ 보관한 변경을 자동 복구하지 못했습니다. 위 stash를 확인하세요.")
            return 1
        print("· 작업 중인 변경 복구 완료")

    # 받기 모드에서는 Git 최신화 뒤 원본 스냅샷을 복원한다. 아직 보관소를
    # 연결하지 않은 PC는 안내만 하고, 설정 후 다시 실행하면 이어받는다.
    if not push_mode and not skip_artifacts:
        if not sync_artifacts("pull"):
            return 1

    write_status()
    ver = ""
    try:
        ver = re.search(r'APP_VER = "(v\d+)"',
                        open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()).group(1)
    except Exception:
        pass
    print(f"\n■ 현재 상태: {ver} · {out('rev-parse', '--short', 'HEAD')}")
    show_status()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
