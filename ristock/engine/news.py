# -*- coding: utf-8 -*-
"""Ri_Stock 수집 엔진 — 뉴스

두 가지를 담당합니다.

1) **종목 뉴스 규칙분석** — 원본 `기업분석표_생성.py` 의 규칙(pullback_free_5.py 유래)을 그대로 옮김.
   호재/악재 키워드 목록과 점수 계산식은 한 글자도 바꾸지 않았습니다.
2) **10개국 시장요약** — 원본 `주식_대시보드/app.py` 의 뉴스 수집·분석을 그대로 옮김.
   결과는 설계서 2.3 `market.json` 규격과 동일한 dict 입니다.

모듈을 import 하는 것만으로는 네트워크를 건드리지 않습니다(호출은 함수 안에서만).
"""

import re
import time
import urllib.parse

import feedparser
import requests
from bs4 import BeautifulSoup

from .config import UA

# =========================
# 종목 뉴스 — 규칙 키워드 (원본 그대로)
# =========================
BAD_STRONG = [
    '상장폐지', '상폐', '거래정지', '매매거래정지', '횡령', '배임', '분식회계', '분식',
    '감사의견 거절', '의견거절', '부도', '법정관리', '기업회생', '회생절차',
    '파산', '영업정지', '불성실공시', '감자', '압류', '환매중단',
]
BAD_WEAK = [
    '유상증자', '소송', '제재', '검찰', '압수수색', '경영권 분쟁',
    '최대주주 변경', '실적 부진', '어닝쇼크', '적자 전환', '적자전환', '리콜',
]
GOOD_STRONG = [
    '수주', '공급계약', '계약 체결', '계약체결', '납품', '양산', '초도물량',
    '흑자전환', '흑자 전환', '턴어라운드', '어닝서프라이즈', '어닝 서프라이즈',
    '최대 실적', '사상 최대', '실적 개선', '목표가 상향', '목표주가 상향',
    '수출 계약', '인수', 'FDA 승인', '품목허가', '특허 취득',
]
GOOD_THEME = [
    'AI', '인공지능', '데이터센터', '클라우드', 'HBM', 'GPU', '반도체',
    '로봇', '자동화', '전기차', '2차전지', '배터리', 'ESS',
    '방산', '원전', '전력', '수소', '해외 진출', '해외진출', '글로벌', '신제품', '신사업',
]

# 네트워크 재시도 (원본의 재시도 정신을 유지 + 뉴스 쪽도 동일하게 강화)
RETRY = 2
RETRY_SLEEP = 1.0


def _name_tokens(name):
    tokens = [name]
    short = re.sub(r'(주식회사|홀딩스|우$)', '', name).strip()
    if short and short != name:
        tokens.append(short)
    if len(name) >= 4:
        tokens.append(name[:3])
    return tokens


def rule_analyze_news(name, headlines):
    tokens = _name_tokens(name)

    def is_about_company(source, title):
        if source == 'stock':
            return True
        return any(t in title for t in tokens)

    bad_hits, weak_bad_hits, good_hits = [], [], []
    good_score = 0
    for source, title in headlines:
        if not is_about_company(source, title):
            continue
        for kw in BAD_STRONG:
            if kw in title:
                bad_hits.append((kw, title))
                break
        for kw in BAD_WEAK:
            if kw in title:
                weak_bad_hits.append((kw, title))
                break
        matched_strong = False
        for kw in GOOD_STRONG:
            if kw in title:
                good_score += 3
                good_hits.append((kw, title))
                matched_strong = True
                break
        if not matched_strong:
            for kw in GOOD_THEME:
                if kw in title:
                    good_score += 1
                    good_hits.append((kw, title))
                    break

    good_score = min(10, max(0, good_score - 2 * len(weak_bad_hits)))
    is_bad = len(bad_hits) > 0
    reason = f'[{bad_hits[0][0]}] {bad_hits[0][1][:50]}' if is_bad else ''
    summary = ' / '.join(f'[{kw}] {t[:35]}' for kw, t in good_hits[:3])
    return {'is_bad_news': is_bad, 'bad_news_reason': reason,
            'good_news_score': good_score, 'good_news_summary': summary}


def google_news_titles(query, limit=20):
    """구글 뉴스 RSS 제목 (실패해도 빈 목록 — 수집 전체를 멈추지 않는다)"""
    q = urllib.parse.quote(query)
    url = f'https://news.google.com/rss/search?q={q}&hl=ko&gl=KR&ceid=KR:ko'
    for attempt in range(RETRY + 1):
        try:
            feed = feedparser.parse(url)
            entries = getattr(feed, 'entries', None) or []
            if entries:
                return [(getattr(e, 'title', '') or '').strip()
                        for e in entries[:limit] if getattr(e, 'title', '')]
            # 결과가 비었는데 파싱 오류 흔적이 없으면 '해당 뉴스 없음' — 재시도하지 않는다
            if not getattr(feed, 'bozo', 0):
                return []
        except Exception:
            pass
        if attempt < RETRY:
            time.sleep(RETRY_SLEEP)
    return []


def naver_stock_news_titles(code6, limit=20):
    """네이버 종목뉴스 제목 (실패해도 빈 목록)"""
    headers = dict(UA)
    headers['Referer'] = f'https://finance.naver.com/item/news.naver?code={code6}'
    url = (f'https://finance.naver.com/item/news_news.naver?code={code6}'
           f'&page=1&sm=title_entity_id.basic&clusterId=')
    for attempt in range(RETRY + 1):
        try:
            res = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(res.text, 'html.parser')
            return [t.text.strip() for t in soup.select('a.tit')][:limit]
        except Exception:
            if attempt < RETRY:
                time.sleep(RETRY_SLEEP)
    return []


def collect_headlines(name, code6=None):
    """한국: 네이버 종목뉴스 + 구글뉴스 / 미국: 구글뉴스(한글 기사)"""
    headlines = []
    if code6:
        for t in naver_stock_news_titles(code6):
            headlines.append(('stock', t))
    q = re.sub(r'\b(Inc|Corp|Corporation|Company|Co|Ltd|plc|Incorporated|Holdings)\.?\b',
               '', name).strip().rstrip(',').strip()
    for t in google_news_titles(q or name):
        headlines.append(('search', t))
    return headlines


# =========================
# 10개국 시장요약 (원본 app.py 그대로) → market.json
# =========================
GN = 'https://news.google.com/rss/headlines/section/topic/BUSINESS'
FEEDS = [
    ('미국',  f'{GN}?hl=en-US&gl=US&ceid=US:en'),
    ('한국',  f'{GN}?hl=ko&gl=KR&ceid=KR:ko'),
    ('일본',  f'{GN}?hl=ja&gl=JP&ceid=JP:ja'),
    ('중국',  f'{GN}?hl=zh-CN&gl=CN&ceid=CN:zh-Hans'),
    ('홍콩',  f'{GN}?hl=zh-HK&gl=HK&ceid=HK:zh-Hant'),
    ('대만',  f'{GN}?hl=zh-TW&gl=TW&ceid=TW:zh-Hant'),
    ('인도',  f'{GN}?hl=en-IN&gl=IN&ceid=IN:en'),
    ('영국',  f'{GN}?hl=en-GB&gl=GB&ceid=GB:en'),
    ('독일',  f'{GN}?hl=de&gl=DE&ceid=DE:de'),
    ('프랑스', f'{GN}?hl=fr&gl=FR&ceid=FR:fr'),
]

SECTORS = {
    'AI·반도체': ['AI', 'artificial intelligence', 'semiconductor', 'chip', 'chips', 'HBM',
                  'GPU', 'data center', 'datacenter', 'Nvidia', 'TSMC', 'foundry', 'OpenAI',
                  '반도체', '인공지능', '데이터센터', '엔비디아', '파운드리',
                  '半導体', '人工知能', '半导体', '人工智能', '芯片', '数据中心', 'Halbleiter'],
    '로봇·자동화': ['robot', 'robots', 'robotics', 'automation', 'humanoid',
                    '로봇', '휴머노이드', '자동화', 'ロボット', '机器人', '自动化'],
    '방산·우주': ['defense', 'defence', 'military', 'missile', 'weapons', 'space', 'satellite',
                  'rocket', 'NATO', '방산', '국방', '우주', '위성', '防衛', '軍事', '国防',
                  '军工', '航天', 'Rüstung'],
    '원전·전력인프라': ['nuclear', 'reactor', 'SMR', 'power grid', 'grid', 'electricity',
                        'utility', 'transformer', '원전', '원자력', '전력', '송전', '변압기',
                        '原発', '原子力', '電力', '核电', '电网'],
    '2차전지·전기차': ['battery', 'batteries', 'EV', 'electric vehicle', 'lithium', 'Tesla',
                       '배터리', '2차전지', '전기차', '테슬라', '電気自動車', '電池', '电动车', '锂'],
    '바이오·제약': ['biotech', 'pharma', 'pharmaceutical', 'drug', 'FDA', 'vaccine', 'obesity',
                    'clinical trial', '바이오', '제약', '신약', '임상', '医薬', '製薬', '创新药', '医药'],
    '조선·해운': ['shipbuilding', 'shipyard', 'shipping', 'LNG carrier', 'vessel', 'tanker',
                  '조선', '조선소', '해운', '선박', '造船', '海運', '航运'],
    '금융·은행': ['bank', 'banks', 'banking', 'brokerage', 'insurance', 'insurer',
                  '은행', '증권', '보험', '금융지주', '銀行', '証券', '银行', '券商'],
    '에너지·정유': ['oil', 'crude', 'OPEC', 'LNG', 'natural gas', 'refinery', 'refining',
                    '유가', '원유', '정유', '가스', '原油', '石油', '天然气', '油价'],
    '소비·유통': ['retail', 'retailer', 'consumer', 'e-commerce', 'ecommerce', 'luxury',
                  '소비', '유통', '이커머스', '백화점', '小売', '消費', '零售', '电商'],
    '엔터·게임·콘텐츠': ['entertainment', 'streaming', 'game', 'gaming', 'K-pop', 'box office',
                         '엔터', '게임', '콘텐츠', '웹툰', 'ゲーム', '游戏', '娱乐'],
    '수소·신재생에너지': ['hydrogen', 'solar', 'wind power', 'offshore wind', 'renewable',
                          '수소', '태양광', '풍력', '신재생', '水素', '太陽光', '氢能', '光伏'],
    '철강·소재': ['steel', 'copper', 'aluminum', 'aluminium', 'rare earth', 'nickel',
                  '철강', '구리', '희토류', '니켈', '鉄鋼', '钢铁', '稀土'],
}

POSITIVE_WORDS = [
    'surge', 'surges', 'soar', 'soars', 'record', 'rally', 'boom', 'jump', 'jumps',
    'rise', 'rises', 'gain', 'gains', 'growth', 'invest', 'investment', 'expand',
    'expansion', 'order', 'orders', 'deal', 'breakthrough', 'approval', 'approves',
    'beat', 'beats', 'strong', 'upgrade', 'raises', 'profit', 'wins', 'high', 'demand',
    '급등', '상승', '사상 최대', '최대 실적', '호황', '수주', '계약', '증설', '성장',
    '개선', '돌파', '승인', '호조', '확대', '반등', '신기록', '투자', '흑자',
    '最高', '好調', '増益', '受注', '拡大', '上昇', '急伸', '成長', '投資', '反発',
    '增长', '上涨', '大涨', '突破', '扩大', '创新高', '订单', '利好', '飙升', '回升',
]
NEGATIVE_WORDS = [
    'slump', 'plunge', 'plunges', 'fall', 'falls', 'drop', 'drops', 'crash',
    'decline', 'cut', 'cuts', 'ban', 'bans', 'tariff', 'tariffs', 'lawsuit',
    'probe', 'warning', 'warns', 'weak', 'loss', 'losses', 'layoff', 'layoffs',
    'downgrade', 'glut', 'oversupply', 'recall', 'bankruptcy', 'fears',
    '급락', '하락', '부진', '적자', '규제', '감산', '파산', '리콜', '우려', '쇼크',
    '침체', '위기', '폭락', '제재',
    '減益', '下落', '急落', '赤字', '懸念', '規制', '低迷', '暴落',
    '下跌', '大跌', '走低', '亏损', '下滑', '监管', '暴跌', '利空',
]


def contains_keyword(title, title_lower, kw):
    if kw.isascii():
        return re.search(r'(?<![a-z0-9])' + re.escape(kw.lower()) + r'(?![a-z0-9])',
                         title_lower) is not None
    return kw in title


def analyze_title(title):
    tl = title.lower()
    secs = [s for s, kws in SECTORS.items()
            if any(contains_keyword(title, tl, k) for k in kws)]
    pos = sum(1 for w in POSITIVE_WORDS if contains_keyword(title, tl, w))
    neg = sum(1 for w in NEGATIVE_WORDS if contains_keyword(title, tl, w))
    senti = 1 if pos > neg else (-1 if neg > pos else 0)
    return secs, senti


def _parse_feed(url):
    """RSS 1건 파싱 — 일시 오류는 재시도 (원본은 1회 시도 후 통째로 무시했음)"""
    last = None
    for attempt in range(RETRY + 1):
        try:
            d = feedparser.parse(url)
            if getattr(d, 'entries', None):
                return d
            last = d
        except Exception:
            last = None
        if attempt < RETRY:
            time.sleep(RETRY_SLEEP)
    return last


def collect_market_summary():
    """10개국 비즈니스 뉴스 → 시장 분위기·섹터 순위 (설계서 2.3 market.json 규격)"""
    countries = {}
    sector_scores = {}
    all_news = []
    seen = set()

    for country, url in FEEDS:
        n_pos = n_neg = n_tot = 0
        try:
            d = _parse_feed(url)
            for e in (getattr(d, 'entries', None) or [])[:60]:
                title = (getattr(e, 'title', '') or '').strip()
                if not title:
                    continue
                key = re.sub(r'\W', '', title.rsplit(' - ', 1)[0].lower())[:60]
                if key in seen:
                    continue
                seen.add(key)
                core = title.rsplit(' - ', 1)[0]
                secs, senti = analyze_title(core)
                n_tot += 1
                if senti == 1:
                    n_pos += 1
                elif senti == -1:
                    n_neg += 1
                point = {1: 2.0, 0: 0.5, -1: -2.0}[senti]
                for s in secs:
                    d2 = sector_scores.setdefault(
                        s, {'점수': 0.0, '뉴스수': 0, '긍정': 0, '부정': 0, '대표뉴스': []})
                    d2['점수'] += point
                    d2['뉴스수'] += 1
                    if senti == 1:
                        d2['긍정'] += 1
                        if len(d2['대표뉴스']) < 4:
                            d2['대표뉴스'].append(f'({country}) {title[:90]}')
                    elif senti == -1:
                        d2['부정'] += 1
                if secs or senti != 0:
                    all_news.append({'국가': country, '제목': title[:120], '뉘앙스': senti,
                                     '섹터': secs})
        except Exception:
            pass
        countries[country] = {'수집': n_tot, '긍정': n_pos, '부정': n_neg}
        time.sleep(0.15)

    ranked = sorted(sector_scores.items(), key=lambda x: -x[1]['점수'])
    total = sum(c['수집'] for c in countries.values())
    total_pos = sum(c['긍정'] for c in countries.values())
    total_neg = sum(c['부정'] for c in countries.values())

    if total_pos > total_neg * 1.5:
        mood = '위험선호(강세) 분위기'
    elif total_neg > total_pos * 1.5:
        mood = '위험회피(약세) 분위기'
    else:
        mood = '중립·혼조 분위기'
    top3 = [s for s, _ in ranked[:3]]
    summary_text = (f'오늘 10개국 비즈니스 뉴스 {total}건 기준, 전반적으로 {mood}입니다 '
                    f'(호재성 {total_pos}건 vs 악재성 {total_neg}건). '
                    f'호재 뉴스가 몰리는 섹터는 {", ".join(top3) if top3 else "특이 섹터 없음"} 순입니다.')

    return {
        '날짜': time.strftime('%Y-%m-%d %H:%M'),
        '요약': summary_text,
        '국가별': countries,
        '섹터순위': [
            {'순위': i + 1, '섹터': s, '점수': round(v['점수'], 1), '뉴스수': v['뉴스수'],
             '긍정': v['긍정'], '부정': v['부정'], '대표뉴스': v['대표뉴스']}
            for i, (s, v) in enumerate(ranked)
        ],
        '주요뉴스': sorted(all_news, key=lambda x: -abs(x['뉘앙스']))[:30],
    }
