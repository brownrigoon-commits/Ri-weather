# -*- coding: utf-8 -*-
"""일본어/중국어 골프장 이름 → 한글 표기 생성"""
import re
import pykakasi
from opencc import OpenCC
import hanja as hanja_mod

_kks = pykakasi.kakasi()
_s2t = OpenCC("s2t")

# ---------- 로마자 → 한글 ----------
R2H = {
    "a":"아","i":"이","u":"우","e":"에","o":"오",
    "ka":"카","ki":"키","ku":"쿠","ke":"케","ko":"코",
    "ga":"가","gi":"기","gu":"구","ge":"게","go":"고",
    "sa":"사","si":"시","su":"스","se":"세","so":"소",
    "za":"자","zi":"지","zu":"즈","ze":"제","zo":"조",
    "ta":"타","ti":"치","tu":"츠","te":"테","to":"토",
    "da":"다","di":"지","du":"즈","de":"데","do":"도",
    "na":"나","ni":"니","nu":"누","ne":"네","no":"노",
    "ha":"하","hi":"히","hu":"후","he":"헤","ho":"호",
    "ba":"바","bi":"비","bu":"부","be":"베","bo":"보",
    "pa":"파","pi":"피","pu":"푸","pe":"페","po":"포",
    "ma":"마","mi":"미","mu":"무","me":"메","mo":"모",
    "ya":"야","yu":"유","yo":"요",
    "ra":"라","ri":"리","ru":"루","re":"레","ro":"로",
    "wa":"와","wo":"오",
    "shi":"시","chi":"치","tsu":"츠","fu":"후","ji":"지",
    "sha":"샤","shu":"슈","sho":"쇼","sya":"샤","syu":"슈","syo":"쇼",
    "cha":"차","chu":"추","cho":"초","tya":"차","tyu":"추","tyo":"초",
    "ja":"자","ju":"주","jo":"조","jya":"자","jyu":"주","jyo":"조",
    "kya":"캬","kyu":"큐","kyo":"쿄","gya":"갸","gyu":"규","gyo":"교",
    "nya":"냐","nyu":"뉴","nyo":"뇨","hya":"햐","hyu":"휴","hyo":"효",
    "bya":"뱌","byu":"뷰","byo":"뵤","pya":"퍄","pyu":"퓨","pyo":"표",
    "mya":"먀","myu":"뮤","myo":"묘","rya":"랴","ryu":"류","ryo":"료",
    "va":"바","vi":"비","vu":"부","ve":"베","vo":"보",
    "fa":"파","fi":"피","fe":"페","fo":"포",
}
CONSONANTS = set("kgsztdnhbpmyrwfjcv")
JONG_N = 4    # ㄴ
JONG_S = 19   # ㅅ

def _add_jong(syll, jong):
    code = ord(syll)
    if 0xAC00 <= code <= 0xD7A3 and (code - 0xAC00) % 28 == 0:
        return chr(code + jong)
    return syll

def _collapse_long(s):
    s = s.replace("ō","o").replace("ū","u").replace("ā","a").replace("ī","i").replace("ē","e")
    s = re.sub(r"ou","o",s)
    s = re.sub(r"([aiueo])\1+", r"\1", s)
    return s

def romaji_to_hangul(r):
    r = _collapse_long(r.lower())
    out = []
    i = 0
    n = len(r)
    while i < n:
        ch = r[i]
        # 촉음(겹자음): 앞 음절에 ㅅ 받침
        if ch in CONSONANTS and i+1 < n and r[i+1] == ch and ch not in "ny":
            if out: out[-1] = _add_jong(out[-1], JONG_S)
            i += 1
            continue
        # ん: n 뒤가 모음/y가 아니면 앞 음절 ㄴ 받침
        if ch == "n" and (i+1 >= n or (r[i+1] not in "aiueoy")):
            if out: out[-1] = _add_jong(out[-1], JONG_N)
            else: out.append("ㄴ")
            i += 1
            continue
        matched = False
        for L in (3, 2, 1):
            tok = r[i:i+L]
            if tok in R2H:
                out.append(R2H[tok]); i += L; matched = True
                break
        if not matched:
            out.append(ch); i += 1
    return "".join(out)

# ---------- 일본어 이름 → 한글 ----------
JP_SUFFIX = [
    (re.compile(r"カントリー\s*(クラブ|倶楽部)|カンツリー\s*(クラブ|倶楽部)"), "CC"),
    (re.compile(r"ゴルフ\s*(クラブ|倶楽部)"), "GC"),
    (re.compile(r"ゴルフ場"), "골프장"),
    (re.compile(r"ゴルフコース"), "골프코스"),
    (re.compile(r"ゴルフパーク"), "골프파크"),
    (re.compile(r"ゴルフガーデン"), "골프가든"),
    (re.compile(r"ゴルフリゾート"), "골프리조트"),
    (re.compile(r"ゴルフ"), "골프"),
    (re.compile(r"倶楽部|クラブ"), "클럽"),
    (re.compile(r"リゾート"), "리조트"),
]

def jp_to_korean(name):
    if re.fullmatch(r"[\x00-\x7F]+", name):  # 영문 전용 이름은 그대로
        return ""
    s = name.replace("ヶ", "が").replace("ケ丘", "が丘")  # 〜ヶ丘 = 가오카
    for pat, rep in JP_SUFFIX:
        s = pat.sub(" " + rep + " ", s)
    parts = []
    for seg in s.split():
        if re.fullmatch(r"[A-Za-z0-9&'.\-·【】()]+", seg) or re.fullmatch(r"[가-힣A-Za-z0-9]+", seg):
            parts.append(seg)
            continue
        try:
            conv = _kks.convert(seg)
        except Exception:
            parts.append(seg); continue
        buf = ""
        for item in conv:
            orig = item["orig"]
            if re.fullmatch(r"[A-Za-z0-9\s&'.\-·【】()]+", orig):
                buf += orig
            else:
                buf += romaji_to_hangul(item["hepburn"])
        parts.append(buf)
    out = " ".join(parts)
    out = re.sub(r"\s+", " ", out).strip()
    # 남은 일본어 문자가 있으면 실패로 간주
    if re.search(r"[぀-ヿ一-鿿]", out):
        return ""
    return out

# ---------- 중국어 이름 → 한글 (한국 한자음) ----------
CN_PRE = [
    ("高尔夫球场", " 골프장 "), ("高尔夫练习场", " 골프연습장 "),
    ("乡村俱乐部", " CC "), ("高尔夫俱乐部", " GC "), ("高尔夫球会", " GC "),
    ("高尔夫球俱乐部", " GC "), ("高尔夫", " 골프 "), ("俱乐部", " 클럽 "),
    ("球会", " 클럽 "), ("球场", " 구장 "),
]

def cn_to_korean(name):
    if re.fullmatch(r"[\x00-\x7F]+", name):
        return ""
    s = name
    for a, b in CN_PRE:
        s = s.replace(a, b)
    try:
        t = _s2t.convert(s)
        r = hanja_mod.translate(t, "substitution")
    except Exception:
        return ""
    r = re.sub(r"\s+", " ", r).strip()
    if re.search(r"[一-鿿぀-ヿ]", r):
        return ""
    return r

if __name__ == "__main__":
    import io
    tests_jp = ["羊ヶ丘カントリークラブ", "新千歳カントリークラブ【PGM】", "札幌エルムカントリークラブ",
                "ツキサップゴルフクラブ", "軽井沢ゴルフ倶楽部", "富士カントリークラブ", "太平洋クラブ 成田コース"]
    tests_cn = ["观澜湖高尔夫球会", "太湖国际高尔夫俱乐部", "华彬国际高尔夫俱乐部", "金厦高尔夫俱乐部"]
    lines = []
    for t in tests_jp: lines.append("JP %s -> %s" % (t, jp_to_korean(t)))
    for t in tests_cn: lines.append("CN %s -> %s" % (t, cn_to_korean(t)))
    io.open(r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\koreanize_out.txt", "w", encoding="utf-8").write("\n".join(lines))
    print("done")
