# -*- coding: utf-8 -*-
import io
KANA = {
 "아":"a","이":"i","우":"u","에":"e","오":"o",
 "카":"ka","키":"ki","쿠":"ku","케":"ke","코":"ko","가":"ga","기":"gi","구":"gu","게":"ge","고":"go",
 "사":"sa","시":"shi","스":"su","세":"se","소":"so","자":"za","지":"ji","즈":"zu","제":"ze","조":"zo",
 "타":"ta","치":"chi","츠":"tsu","테":"te","토":"to","다":"da","디":"di","두":"du","데":"de","도":"do",
 "나":"na","니":"ni","누":"nu","네":"ne","노":"no",
 "하":"ha","히":"hi","후":"fu","헤":"he","호":"ho","바":"ba","비":"bi","부":"bu","베":"be","보":"bo","파":"pa","피":"pi","푸":"pu","페":"pe","포":"po",
 "마":"ma","미":"mi","무":"mu","메":"me","모":"mo",
 "야":"ya","유":"yu","요":"yo",
 "라":"ra","리":"ri","루":"ru","레":"re","로":"ro",
 "와":"wa","워":"wo","응":"n","은":"n",
 "캬":"kya","큐":"kyu","쿄":"kyo","갸":"gya","규":"gyu","교":"gyo",
 "샤":"sha","슈":"shu","쇼":"sho","쟈":"ja","쥬":"ju","죠":"jo",
 "챠":"cha","츄":"chu","쵸":"cho","냐":"nya","뉴":"nyu","뇨":"nyo",
 "햐":"hya","휴":"hyu","효":"hyo","뱌":"bya","뷰":"byu","뵤":"byo","퍄":"pya","퓨":"pyu","표":"pyo",
 "먀":"mya","뮤":"myu","묘":"myo","랴":"rya","류":"ryu","료":"ryo","쓰":"tsu","쯔":"tsu",
}
N_FINALS=[4,16,21]; GEM=[1,2,7,17,19,20,22,23,24,25,26]
def romaji(s):
    out=""; gem=False
    for ch in s:
        r=KANA.get(ch); fin=0
        if r is None:
            code=ord(ch)
            if 0xAC00<=code<=0xD7A3:
                idx=code-0xAC00; fin=idx%28
                r=KANA.get(chr(0xAC00+(idx-fin)))
        if r:
            if gem: out+=r[0]; gem=False
            out+=r
            if fin in N_FINALS: out+="n"
            elif fin in GEM: gem=True
        elif ch.isalnum():
            out+=ch.lower(); gem=False
    return out

tests=["히츠지가오카","삿포로","신치토세","나리타","오사카","하네다","카루이자와","후지","치토세","센다이","삿포로엘름","스키삿푸"]
lines=["%s -> %s"%(t,romaji(t)) for t in tests]
io.open(r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\romaji_out.txt","w",encoding="utf-8").write("\n".join(lines))
print("done")
