# -*- coding: utf-8 -*-
"""일본 등록본 청소 — 같은 그림·같은 티 열이 두 코스에 걸친 것을 걷어낸다 (2026-08-03 신설)

무엇이 잘못됐나 (2026-08-03 전수 감사)
  · 糸魚川カントリークラブ · 滝のカントリークラブ — 뒤 9홀 홀맵 9장이 앞 9홀과 **픽셀까지 같다**.
    코스명이 'OUT/OUT2', 'C1/C2' 이고 파일명이 OUT21.jpg… 인 것부터가 '앞 나인을 두 번 긁었다'는
    흔적이다. 파가 서로 다른 홀에 같은 그림이 붙었으니 뒤 나인은 확실히 틀린 그림이다.
  · 島根ゴルフ倶楽部 · 青森スプリングGC · 足利城ゴルフ倶楽部 — IN 코스의 티 거리열이
    OUT 코스 것과 **자릿수까지 완전히 같다**. 그 결과 레이디 티가 백 티보다 길어지는 홀이 나온다.

무엇을 하나
  ① 한 구장 안에서 다른 코스의 홀과 그림(md5)이 같으면 → 뒤에 나온 쪽 img 를 뺀다.
     (앱은 img 가 없으면 위성 뷰로 떨어진다 — 남의 홀 그림을 보여 주는 것보다 낫다)
  ② 한 구장 안에서 티 거리열이 다른 홀과 완전히 같으면 → 뒤에 나온 쪽 tees·len 을 뺀다.
  둘 다 '지우기'만 한다 — 없는 값을 지어내지 않는다.

사용
  python tools/jp/clean_jp_holes.py           무엇이 바뀌는지만 보여 준다
  python tools/jp/clean_jp_holes.py --write   parsed.json 을 실제로 고친다
"""
import argparse, glob, hashlib, json, os, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HP_JP = os.path.join(ROOT, "coursedata", "homepages_jp")


def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def tee_key(h):
    t = h.get("tees") or []
    return tuple((x.get("name"), x.get("y") or x.get("m")) for x in t) if len(t) >= 2 else None


# 티 이름 → 긴 쪽이 앞인 순서 (일본 표기 다양성 실측 반영)
LONG = ("バック", "back", "black", "黒", "champ", "チャンピオン", "トーナメント", "青", "blue")
SHORT = ("レディ", "lady", "ladies", "赤", "red", "フロント", "front", "ピンク", "pink", "シニア", "senior")


def tee_dist(t):
    return t.get("y") or t.get("m") or 0


def kind(name):
    n = (name or "").lower()
    if any(k.lower() in n for k in LONG):
        return "long"
    if any(k.lower() in n for k in SHORT):
        return "short"
    return None


def ladder_fix(h):
    """**이름으로** 짧은 티인데 긴 티보다 길면 그 값은 남의 홀 것이다 — 그 티만 뺀다.

    ⚠️ '목록 정렬이 내림차순이 아니다'로 판정하면 안 된다. 일본 자료는 티를 거리순이 아니라
    사이트 표기 순서(バック·レギュラー1·レギュラー2·レディース…)로 싣는 곳이 많아서
    461홀이 걸렸다 — 대부분 순서만 다를 뿐 값은 맞다(2026-08-03 실측).
    """
    ts = h.get("tees") or []
    if len(ts) < 2:
        return None
    longs = [tee_dist(t) for t in ts if kind(t.get("name")) == "long"]
    if not longs:
        return None
    top = max(longs)
    keep = [t for t in ts if not (kind(t.get("name")) == "short" and tee_dist(t) > top)]
    return keep if len(keep) != len(ts) else None


def column_copies(courses):
    """나인 사이에 '티 한 줄'이 통째로 복사된 것 찾기.

    島根ゴルフ倶楽部·青森スプリングGC 실측: IN 아홉 홀의 レディース 값이 OUT 아홉 홀과
    자릿수까지 같았다. 홀 전체가 아니라 **한 컬럼만** 베껴서 전체 비교로는 안 잡힌다.
    """
    out = []
    cols = []
    for c in courses:
        by = {}
        for h in c["holes"]:
            for t in h.get("tees") or []:
                by.setdefault(t.get("name"), []).append((h, tee_dist(t)))
        cols.append((c["name"], by))
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            for name, a_items in cols[i][1].items():
                b_items = cols[j][1].get(name)
                if not b_items or len(a_items) != len(b_items) or len(a_items) < 5:
                    continue
                if [v for _, v in a_items] == [v for _, v in b_items]:
                    out.append((cols[i][0], cols[j][0], name, [h for h, _ in b_items]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    imgs = tees = 0
    for f in sorted(glob.glob(os.path.join(HP_JP, "*", "parsed.json"))):
        d = json.load(open(f, encoding="utf-8"))
        seen_img, seen_tee, notes, dup = {}, {}, [], []
        for c in d.get("courses", []):
            for h in c["holes"]:
                rel = h.get("img")
                if rel:
                    p = os.path.join(ROOT, rel.replace("/", os.sep))
                    if os.path.exists(p):
                        k = md5(p)
                        prev = seen_img.get(k)
                        if prev and prev[0] != c["name"]:
                            notes.append(f'  {c["name"]} {h["no"]}번 — 그림이 {prev[0]} {prev[1]}번과 같아 뺌')
                            h.pop("img")
                            imgs += 1
                        else:
                            seen_img.setdefault(k, (c["name"], h["no"]))
                tk = tee_key(h)
                if tk:
                    prev = seen_tee.get(tk)
                    if prev and prev != (c["name"], h["no"]):
                        dup.append((c["name"], h["no"], prev, h))
                    else:
                        seen_tee.setdefault(tk, (c["name"], h["no"]))
        # 티 거리열은 **줄줄이 겹칠 때만** 복제로 본다.
        # 두 홀의 티 값이 우연히 같을 수는 있다(짧은 코스에서 실제로 있다).
        # 한 코스 짝에서 3홀 이상 겹치면 그건 우연이 아니라 한 나인을 통째로 베낀 것이다.
        from collections import defaultdict
        by_pair = defaultdict(list)
        for cname, no, prev, h in dup:
            by_pair[(prev[0], cname)].append((no, prev[1], h))
        for (src_c, dst_c), items in by_pair.items():
            if len(items) < 3:
                notes.append(f"  · {dst_c} {[i[0] for i in items]}번 티가 {src_c} 와 같지만 "
                             f"{len(items)}홀뿐이라 우연으로 보고 두었습니다")
                continue
            for no, src_no, h in items:
                notes.append(f"  {dst_c} {no}번 — 티 거리열이 {src_c} {src_no}번과 같아 뺌")
                h.pop("tees", None)
                h.pop("len", None)
                tees += 1
        # ③ 나인 사이 티 한 줄 통째 복사 — 베낀 쪽에서 그 줄만 뺀다
        for src_c, dst_c, tname, holes in column_copies(d.get("courses", [])):
            for h in holes:
                h["tees"] = [t for t in h.get("tees") or [] if t.get("name") != tname]
                if not h["tees"]:
                    h.pop("tees")
                    h.pop("len", None)
                tees += 1
            notes.append(f"  {dst_c} — '{tname}' 티 {len(holes)}홀이 {src_c} 것과 같아 뺌")

        # ④ 티 사다리가 어긋난 홀 — 어긋난 지점부터 잘라낸다
        for c in d.get("courses", []):
            for h in c["holes"]:
                keep = ladder_fix(h)
                if keep is None:
                    continue
                old = len(h.get("tees") or [])
                if keep:
                    h["tees"] = keep
                    h["len"] = max(tee_dist(t) for t in keep)
                else:
                    h.pop("tees", None)
                    h.pop("len", None)
                notes.append(f'  {c["name"]} {h["no"]}번 — 짧은 티가 긴 티보다 길어 '
                             f'{old - len(keep)}개 뺌')
                tees += 1

        if notes:
            print(f'■ {d["course"]}')
            print("\n".join(notes[:12]))
            if len(notes) > 12:
                print(f"  … 그 외 {len(notes) - 12}건")
            if a.write:
                json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n뺀 그림 {imgs}장 · 뺀 티 거리열 {tees}홀")
    print("다음: python tools/jp/build_holeimgdb_jp.py" if a.write
          else "(미리보기입니다 — 실제로 고치려면 --write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
