# -*- coding: utf-8 -*-
"""두 창이 한 .git 을 쓸 때 안전하게 커밋한다.

  · 남의 리베이스·머지가 진행 중이면 아예 손대지 않는다
  · add 와 commit 을 붙여 하고, 실패하면 곧바로 스테이징을 내려놓는다
    (남겨두면 남의 `rebase --continue` 가 내 파일을 자기 커밋에 실어간다 — 8/2 실사고)

  사용: python safe_commit.py "제목\n\n본문" 경로1 경로2 ...
"""
import os, subprocess, sys

R = r"C:\Users\디자이너\Desktop\claude\Ri-weather"
sys.stdout.reconfigure(encoding="utf-8")


def git(*a, **kw):
    return subprocess.run(["git", "-C", R, *a], capture_output=True, **kw)


def busy():
    for f in ("rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD"):
        if os.path.exists(os.path.join(R, ".git", f)):
            return f
    return None


def main():
    msg, paths = sys.argv[1], sys.argv[2:]
    if not paths:
        print("경로를 주세요 (git add -A 는 이 기간에 금지)")
        return 2
    b = busy()
    if b:
        print(f"⏸ 다른 창의 작업이 진행 중입니다 (.git/{b}) — 커밋하지 않고 기다립니다")
        return 3
    git("add", "--", *paths)
    if busy():                       # add 하는 사이에 시작됐을 수도 있다
        git("restore", "--staged", "--", *paths)
        print("⏸ add 도중 다른 창이 작업을 시작해 되돌렸습니다 — 나중에 다시 하세요")
        return 3
    r = git("commit", "-m", msg)
    if r.returncode:
        git("restore", "--staged", "--", *paths)
        print("✖ 커밋 실패 — 스테이징은 내려놓았습니다(남의 커밋에 실리지 않게)")
        print(r.stdout.decode("utf-8", "replace")[-800:])
        return 1
    print("✅", git("log", "--oneline", "-1").stdout.decode("utf-8", "replace").strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
