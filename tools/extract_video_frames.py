# -*- coding: utf-8 -*-
"""홀 3D 영상에서 핵심 장면 3컷 추출 → AI 캐디 분석용
브라우저는 골프존 CDN 영상을 직접 읽을 수 없으므로(CORS), 여기서 미리 프레임을 뽑아 저장한다.
ffmpeg가 필요한 구간만 스트리밍해서 받으므로 영상 전체를 내려받지 않는다.

프레임: 티 시점(초반) · 중간(IP 지점) · 그린 접근(후반)
출력: holeimg/<slug>/f<코스><홀>_1..3.jpg  (400px, 품질 60 — 용량 최소화)

사용:
  python tools/extract_video_frames.py --limit 20        # 앞 20개 구장만
  python tools/extract_video_frames.py --club 서서울CC   # 특정 구장
  python tools/extract_video_frames.py                   # 전체 (이어하기 지원)
"""
import argparse, glob, json, os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HP = os.path.join(ROOT, "coursedata", "homepages")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126"

def grab(video_url, out_prefix):
    """영상에서 3컷 추출. 이미 있으면 건너뜀. 성공 시 상대경로 리스트 반환"""
    outs = [f"{out_prefix}_{i}.jpg" for i in (1, 2, 3)]
    if all(os.path.exists(o) and os.path.getsize(o) > 3000 for o in outs):
        return outs
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-user_agent", UA, "-i", video_url,
           "-vf", r"select='eq(n\,15)+eq(n\,200)+eq(n\,420)',scale=400:-1",
           "-vsync", "0", "-frames:v", "3", "-q:v", "6", out_prefix + "_%d.jpg"]
    try:
        subprocess.run(cmd, capture_output=True, timeout=90)
    except Exception:
        return None
    got = [o for o in outs if os.path.exists(o) and os.path.getsize(o) > 2000]
    return got or None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--club", type=str, default="")
    a = ap.parse_args()

    files = sorted(glob.glob(os.path.join(HP, "*", "parsed.json")))
    done_clubs = 0
    total_ok = total_fail = 0
    for f in files:
        slug = os.path.basename(os.path.dirname(f))
        d = json.load(open(f, encoding="utf-8"))
        if a.club and a.club not in d["course"]:
            continue
        vids = [(c, h) for c in d["courses"] for h in c["holes"] if h.get("video")]
        if not vids:
            continue
        if a.limit and done_clubs >= a.limit:
            break
        imgdir = os.path.join(ROOT, "holeimg", slug)
        os.makedirs(imgdir, exist_ok=True)
        ok = fail = 0
        changed = False
        for c, h in vids:
            cslug = re.sub(r"[^0-9A-Za-z가-힣]", "", c["name"]).lower() or "c"
            prefix = os.path.join(imgdir, f"f{cslug}{h['no']}")
            got = grab(h["video"], prefix)
            if got:
                rels = [os.path.relpath(g, ROOT).replace("\\", "/") for g in sorted(got)]
                if h.get("frames") != rels:
                    h["frames"] = rels
                    changed = True
                ok += 1
            else:
                fail += 1
        if changed:
            json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        done_clubs += 1
        total_ok += ok
        total_fail += fail
        print(f"[{done_clubs}] {d['course']}: 프레임 {ok}홀 성공 / {fail} 실패", flush=True)
    print(f"\n완료: {done_clubs}구장 · 성공 {total_ok}홀 · 실패 {total_fail}홀")

if __name__ == "__main__":
    main()
