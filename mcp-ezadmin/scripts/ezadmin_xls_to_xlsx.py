"""이지어드민 다운로드 파일(.xls)을 서버가 읽는 .xlsx 로 변환한다 — 읽기 전용 도구.

이지어드민의 '엑셀 다운로드'는 확장자만 .xls 이고 내용은 HTML <table> 이다.
openpyxl 은 이 파일을 못 읽으므로(구형 .xls 로 인식) 여기서 진짜 .xlsx 로 바꿔 넣는다.
원본 파일은 건드리지 않는다.

사용법:
    python scripts/ezadmin_xls_to_xlsx.py <파일 또는 폴더> --out data/orders
    python scripts/ezadmin_xls_to_xlsx.py "%USERPROFILE%/Downloads" --out data/orders --since 3

    --since N : 최근 N일 안에 받은 파일만 변환 (생략하면 전부)
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 한국 Windows에서 출력을 파일로 리다이렉트할 때의 cp949 인코딩 오류 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from openpyxl import Workbook  # noqa: E402
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE  # noqa: E402

SRC_EXTS = {".xls", ".xlsx", ".htm", ".html", ".csv"}

# 이지어드민 컬럼명 → 표준 컬럼명 (design/02 의 헤더 후보에 맞춘다)
#
# 왜 필요한가: 이지어드민 주문 엑셀에는 진행단계가 '상태'(접수/송장/배송), 클레임이
# 'CS'(정상/배송전 전체 취소/…) 로 들어온다. '상태' 는 표준 후보에서 '주문상태' 로
# 잡히기 때문에, 그대로 두면 취소·교환 주문의 CS 값이 버려지고 취소분까지 미출고로
# 집계된다(실제 2026-06 데이터에서 587건이 1253건으로 부풀었다).
# 클레임 = 주문상태, 진행단계 = 배송상태 로 옮겨야 버킷이 맞는다.
HEADER_ALIASES = {
    "CS": "주문상태",
    "상태": "배송상태",
}

_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
_CELL_RE = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S | re.I)
_TAG_RE = re.compile(r"<[^>]+>")
_BR_RE = re.compile(r"<br\s*/?>", re.I)


def looks_like_html(path: Path) -> bool:
    with open(path, "rb") as f:
        head = f.read(512).lstrip()
    return head[:1] == b"<"


def read_text(path: Path) -> str:
    for enc in ("utf-8-sig", "cp949"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def cell_text(raw: str) -> str:
    raw = _BR_RE.sub("\n", raw)
    text = html.unescape(_TAG_RE.sub("", raw)).replace("\xa0", " ")
    # 상품명 등에 섞여 오는 제어문자는 xlsx 에 쓸 수 없다(실제 export 에서 발견됨)
    return ILLEGAL_CHARACTERS_RE.sub("", text).strip()


def parse_html_table(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in _ROW_RE.findall(text):
        cells = [cell_text(c) for c in _CELL_RE.findall(row)]
        if any(c for c in cells):
            rows.append(cells)
    return rows


def apply_header_aliases(rows: list[list[str]]) -> list[str]:
    """헤더 행을 찾아 이지어드민 컬럼명을 표준명으로 바꾼다. 바꾼 내역을 돌려준다."""
    changed: list[str] = []
    for row in rows[:10]:
        if "주문번호" not in row:
            continue
        for i, cell in enumerate(row):
            if cell in HEADER_ALIASES:
                row[i] = HEADER_ALIASES[cell]
                changed.append("%s→%s" % (cell, row[i]))
        break
    return changed


def write_xlsx(rows: list[list[str]], dest: Path) -> None:
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Sheet1")
    for row in rows:
        ws.append(row)
    dest.parent.mkdir(parents=True, exist_ok=True)
    wb.save(dest)


def convert(src: Path, out_dir: Path) -> tuple[bool, str]:
    if not looks_like_html(src):
        return False, "HTML 형식이 아님 (이지어드민 다운로드 파일이 아니거나 이미 정상 엑셀)"
    rows = parse_html_table(read_text(src))
    if len(rows) < 2:
        return False, "표를 찾지 못함 (행 %d개)" % len(rows)
    renamed = apply_header_aliases(rows)
    dest = out_dir / (src.stem + ".xlsx")
    write_xlsx(rows, dest)
    # 원본 다운로드 시각을 그대로 물려준다.
    # 서버는 파일 mtime 으로 '데이터기준'과 신선도 경고를 판단하는데, 변환 시각이 찍히면
    # 몇 주 지난 데이터도 방금 받은 것처럼 보여 경고가 뜨지 않는다.
    st = src.stat()
    os.utime(dest, (st.st_atime, st.st_mtime))
    note = ("  [컬럼명 정리: %s]" % ", ".join(renamed)) if renamed else ""
    return True, "%s  (%d행 × %d칸)%s" % (dest, len(rows) - 1, len(rows[0]), note)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="변환할 파일 또는 폴더")
    ap.add_argument("--out", required=True, help="결과 .xlsx 를 넣을 폴더")
    ap.add_argument("--since", type=int, default=0, help="최근 N일 안에 받은 파일만")
    ap.add_argument(
        "--name",
        action="append",
        default=[],
        help="파일명에 이 글자가 든 것만 (여러 번 지정 가능). 다운로드 폴더의 다른 엑셀을 건드리지 않으려면 지정할 것",
    )
    args = ap.parse_args()

    src = Path(args.src).expanduser()
    out_dir = Path(args.out).expanduser()
    if not out_dir.is_absolute():
        out_dir = (ROOT / out_dir).resolve()

    if src.is_dir():
        targets = [p for p in sorted(src.iterdir()) if p.suffix.lower() in SRC_EXTS]
    else:
        targets = [src]
    if args.name:
        targets = [p for p in targets if any(n in p.name for n in args.name)]
    if args.since:
        cutoff = datetime.now() - timedelta(days=args.since)
        targets = [p for p in targets if datetime.fromtimestamp(p.stat().st_mtime) >= cutoff]

    if not targets:
        print("변환할 파일이 없습니다: %s" % src)
        return 1

    done = 0
    for path in targets:
        try:
            ok, msg = convert(path, out_dir)
        except Exception as exc:  # 한 파일이 실패해도 나머지는 계속 변환한다
            ok, msg = False, "변환 실패: %s" % exc
        print(("[변환] " if ok else "[건너뜀] ") + path.name + " -> " + msg)
        done += int(ok)

    print("\n총 %d개 중 %d개 변환 완료 → %s" % (len(targets), done, out_dir))
    return 0 if done else 1


if __name__ == "__main__":
    raise SystemExit(main())
