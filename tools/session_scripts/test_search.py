# -*- coding: utf-8 -*-
"""app.js의 searchGolfDB 로직을 그대로 포팅해 실제 DB로 검증"""
import io, json, re

db = io.open(r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js", encoding="utf-8").read()
GOLF_DB = json.loads(db[db.index("["):db.rindex("]")+1])

KANA = {
 "아":"a","이":"i","우":"u","에":"e","오":"o","카":"ka","키":"ki","쿠":"ku","케":"ke","코":"ko","가":"ga","기":"gi","구":"gu","게":"ge","고":"go",
 "사":"sa","시":"shi","스":"su","세":"se","소":"so","자":"za","지":"ji","즈":"zu","제":"ze","조":"zo","타":"ta","치":"chi","츠":"tsu","테":"te","토":"to","다":"da","디":"di","두":"du","데":"de","도":"do",
 "나":"na","니":"ni","누":"nu","네":"ne","노":"no","하":"ha","히":"hi","후":"fu","헤":"he","호":"ho","바":"ba","비":"bi","부":"bu","베":"be","보":"bo","파":"pa","피":"pi","푸":"pu","페":"pe","포":"po",
 "마":"ma","미":"mi","무":"mu","메":"me","모":"mo","야":"ya","유":"yu","요":"yo","라":"ra","리":"ri","루":"ru","레":"re","로":"ro","와":"wa","워":"wo","응":"n","은":"n",
 "캬":"kya","큐":"kyu","쿄":"kyo","갸":"gya","규":"gyu","교":"gyo","샤":"sha","슈":"shu","쇼":"sho","쟈":"ja","쥬":"ju","죠":"jo","챠":"cha","츄":"chu","쵸":"cho","냐":"nya","뉴":"nyu","뇨":"nyo",
 "햐":"hya","휴":"hyu","효":"hyo","뱌":"bya","뷰":"byu","뵤":"byo","퍄":"pya","퓨":"pyu","표":"pyo","먀":"mya","뮤":"myu","묘":"myo","랴":"rya","류":"ryu","료":"ryo","쓰":"tsu","쯔":"tsu",
 "크":"ku","트":"to","프":"pu","드":"do","그":"gu","브":"bu","르":"ru","므":"mu","흐":"fu",
}
N_FINALS=[4,16,21]; GEM=[1,2,7,17,19,20,22,23,24,25,26]
def romaji(s):
    out=""; gem=False
    for ch in s:
        r=KANA.get(ch); fin=0
        if r is None:
            code=ord(ch)
            if 0xAC00<=code<=0xD7A3:
                idx=code-0xAC00; fin=idx%28; r=KANA.get(chr(0xAC00+(idx-fin)))
        if r:
            if gem: out+=r[0]; gem=False
            out+=r
            if fin in N_FINALS: out+="n"
            elif fin in GEM: gem=True
        elif ch.isalnum(): out+=ch.lower(); gem=False
    return out

def normName(s):
    s=s.lower()
    s=re.sub(r"[\s·.\-()&'’,]","",s)
    s=s.replace("컨트리클럽","cc").replace("칸트리클럽","cc").replace("countryclub","cc")
    s=s.replace("골프클럽","gc").replace("golfclub","gc")
    s=re.sub(r"골프장|골프리조트|golfresort|golf&resort","",s)
    s=re.sub(r"カントリークラブ|カントリー倶楽部|カンツリー倶楽部|カンツリークラブ","cc",s)
    s=re.sub(r"ゴルフクラブ|ゴルフ倶楽部","gc",s)
    s=re.sub(r"ゴルフ場|ゴルフコース|ゴルフパーク|ゴルフ","",s)
    s=re.sub(r"乡村俱乐部|鄉村俱樂部","cc",s)
    s=re.sub(r"高尔夫俱乐部|高爾夫俱樂部|高尔夫球会|高尔夫球俱乐部","gc",s)
    s=re.sub(r"高尔夫球场|高爾夫球場|高尔夫练习场|高尔夫","",s)
    return s
def stripSuffix(s): return re.sub(r"(cc|gc|골프|golf|리조트|resort|倶楽部|俱乐部)+$","",s)
def onlyLetters(s): return re.sub(r"[^a-z0-9]","",(s or "").lower())

for g in GOLF_DB:
    g["_n"]=normName(g["n"]); g["_c"]=stripSuffix(g["_n"]); g["_a"]=normName(g.get("a","")); g["_en"]=onlyLetters(g.get("a",""))

def search(q):
    nq=normName(q)
    if len(nq)<2: return []
    cq=stripSuffix(nq)
    hasH=bool(re.search(r"[가-힣]",q))
    rq=onlyLetters(romaji(stripSuffix(re.sub(r"[\s·.\-()&'’,]","",q.lower())))) if hasH else ""
    scored=[]
    for g in GOLF_DB:
        sc=-1
        if g["_n"]==nq: sc=100
        elif nq in g["_n"]: sc=80-(len(g["_n"])-len(nq))
        elif len(cq)>=2 and g["_c"]==cq: sc=90
        elif len(cq)>=2 and cq in g["_c"]: sc=60-(len(g["_c"])-len(cq))
        elif len(g["_c"])>=3 and g["_c"] in nq: sc=40
        elif g["_a"] and nq in g["_a"]: sc=55
        elif len(rq)>=4 and g["_en"]:
            for cut in (0,2,4):
                sub=rq[:len(rq)-cut] if cut else rq
                if len(sub)>=(4 if cut==0 else 6) and sub in g["_en"]: sc=50-cut*3; break
        if sc>=0: scored.append((sc,g))
    scored.sort(key=lambda x:-x[0])
    return [g for _,g in scored[:5]]

queries=["히츠지가오카cc","삿포로엘름","신치토세","클라크cc","스키삿푸","후지","오사카","나리타","카루이자와","히츠지가오카"]
lines=[]
for q in queries:
    res=search(q)
    lines.append("[%s] rq=%s -> %s" % (q, onlyLetters(romaji(stripSuffix(re.sub(r"[\s·.\-()&'’,]","",q.lower())))), " | ".join(g["n"] for g in res) or "(없음)"))
io.open(r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\search_out.txt","w",encoding="utf-8").write("\n".join(lines))
print("done")

