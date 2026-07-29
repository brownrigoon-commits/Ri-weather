/* 부킹 연결용 구장 번호표 — tools/build_booking_ids.py 산출물. 손으로 고치지 말 것.
 *
 * pang/sector/sector3 : 골팡(golfpang.com) 자기 사이트의 골프장 선택 드롭다운 값.
 * mon                 : 골프몬(golfmon.net) golfFk. 그쪽 검색 UI 로 하나씩 확인해 넣는다.
 *
 * 번호가 없으면 앱은 지역 목록·검색 화면으로 보낸다(폴백). 비어 있어도 동작한다.
 * ⚠️ 애매한 이름은 넣지 않는다 — 엉뚱한 구장 티타임을 띄우는 것이 곧 거짓 정보다. */
const BOOKING_IDS = {
 "360도CC": {
  "mon": 403,
  "pang": 1,
  "pangName": "360도",
  "sector": 5
 },
 "가야CC": {
  "mon": 122,
  "pang": 1,
  "pangName": "가야",
  "sector": 16,
  "sector3": 3
 },
 "가평베네스트GC": {
  "mon": 29,
  "pang": 1,
  "pangName": "가평베네스트",
  "sector": 1
 },
 "감곡CC": {
  "mon": 1651,
  "pang": 87,
  "pangName": "감곡",
  "sector": 4
 },
 "고창CC": {
  "mon": 457,
  "pang": 27,
  "pangName": "고창",
  "sector": 16,
  "sector3": 6
 },
 "골드레이크CC": {
  "mon": 177,
  "pang": 1,
  "pangName": "골드레이크",
  "sector": 16,
  "sector3": 6
 },
 "골든베이골프&리조트": {
  "mon": 37,
  "pang": 2,
  "pangName": "골든베이",
  "sector": 4
 },
 "골프클럽Q": {
  "mon": 67,
  "pang": 7,
  "pangName": "골프클럽Q",
  "sector": 5
 },
 "광주CC": {
  "mon": 178,
  "pang": 2,
  "pangName": "광주",
  "sector": 16,
  "sector3": 6
 },
 "구니컨트리클럽": {
  "mon": 1658,
  "pang": 62,
  "pangName": "구니",
  "sector": 16,
  "sector3": 3
 },
 "구미CC": {
  "mon": 2174,
  "pang": 4,
  "pangName": "구미",
  "sector": 16,
  "sector3": 3
 },
 "김제스파힐스CC": {
  "pang": 40,
  "pangName": "김제스파힐스",
  "sector": 16,
  "sector3": 6
 },
 "김포 SEASIDE": {
  "pang": 4,
  "pangName": "김포 SEASIDE",
  "sector": 1
 },
 "남여주GC": {
  "mon": 402,
  "pang": 16,
  "pangName": "남여주",
  "sector": 5
 },
 "남촌CC": {
  "mon": 139,
  "pang": 17,
  "pangName": "남촌",
  "sector": 5
 },
 "노스팜CC": {
  "mon": 305,
  "pang": 51,
  "pangName": "노스팜",
  "sector": 1
 },
 "다이아몬드CC": {
  "mon": 1638,
  "pang": 94,
  "pangName": "다이아몬드cc",
  "sector": 16,
  "sector3": 3
 },
 "대구컨트리클럽 (Daegue Country Club)": {
  "mon": 196,
  "pang": 7,
  "pangName": "대구",
  "sector": 16,
  "sector3": 3
 },
 "대영베이스컨트리클럽": {
  "mon": 421,
  "pang": 5,
  "pangName": "대영베이스",
  "sector": 4
 },
 "대호단양CC": {
  "mon": 433,
  "pang": 7,
  "pangName": "대호단양",
  "sector": 4
 },
 "더스타휴 골프앤리조트": {
  "mon": 148,
  "pang": 21,
  "pangName": "더스타휴",
  "sector": 5
 },
 "더크로스비 골프클럽": {
  "mon": 1535,
  "pang": 156,
  "pangName": "더크로스비",
  "sector": 5
 },
 "동원썬밸리CC": {
  "mon": 251,
  "pang": 508,
  "pangName": "동원썬밸리",
  "sector": 8
 },
 "동촌GC": {
  "mon": 50,
  "pang": 12,
  "pangName": "동촌",
  "sector": 4
 },
 "동훈힐마루CC": {
  "mon": 199,
  "pang": 10,
  "pangName": "동훈힐마루",
  "sector": 16,
  "sector3": 3
 },
 "드림파크CC": {
  "mon": 578,
  "pang": 25,
  "pangName": "드림파크",
  "sector": 5
 },
 "디오션CC": {
  "pang": 24,
  "pangName": "디오션",
  "sector": 16,
  "sector3": 6
 },
 "라싸 GC": {
  "mon": 1567,
  "pang": 91,
  "pangName": "라싸",
  "sector": 1
 },
 "라온GC": {
  "mon": 109,
  "pang": 3,
  "pangName": "라온",
  "sector": 16,
  "sector3": 7
 },
 "라헨느골프리조트": {
  "pang": 4,
  "pangName": "라헨느",
  "sector": 16,
  "sector3": 7
 },
 "로드힐스CC": {
  "mon": 297,
  "pang": 15,
  "pangName": "로드힐스",
  "sector": 1
 },
 "로얄링스 CC": {
  "mon": 420,
  "pang": 60,
  "pangName": "로얄링스",
  "sector": 4
 },
 "로얄포레컨트리클럽": {
  "mon": 69,
  "pang": 15,
  "pangName": "로얄포레",
  "sector": 4
 },
 "롯데스카이힐 성주CC": {
  "mon": 321,
  "pang": 16,
  "pangName": "롯데스카이힐 성주",
  "sector": 16,
  "sector3": 3
 },
 "리베라CC": {
  "mon": 77,
  "pang": 31,
  "pangName": "리베라",
  "sector": 5
 },
 "마스터피스컨트리클럽": {
  "mon": 1595,
  "pang": 82,
  "pangName": "마스터피스",
  "sector": 16,
  "sector3": 3
 },
 "마우나오션CC": {
  "mon": 126,
  "pang": 17,
  "pangName": "마우나오션",
  "sector": 16,
  "sector3": 3
 },
 "마이다스레이크이천 골프앤리조트": {
  "mon": 2061,
  "pang": 178,
  "pangName": "마이다스레이크 이천",
  "sector": 5
 },
 "모나크CC": {
  "mon": 2367,
  "pang": 98,
  "pangName": "모나크",
  "sector": 4
 },
 "모카 CC": {
  "mon": 455,
  "pang": 63,
  "pangName": "모카cc",
  "sector": 4
 },
 "무안CC": {
  "mon": 1645,
  "pang": 28,
  "pangName": "무안",
  "sector": 16,
  "sector3": 6
 },
 "무안클린밸리CC": {
  "mon": 1568,
  "pang": 39,
  "pangName": "무안클린밸리",
  "sector": 16,
  "sector3": 6
 },
 "문경GC": {
  "mon": 1319,
  "pang": 18,
  "pangName": "문경",
  "sector": 16,
  "sector3": 3
 },
 "백제컨트리클럽": {
  "mon": 451,
  "pang": 89,
  "pangName": "백제",
  "sector": 4
 },
 "베뉴지CC": {
  "mon": 1120,
  "pang": 81,
  "pangName": "베뉴지",
  "sector": 1
 },
 "베어크리크G.C": {
  "mon": 306,
  "pang": 22,
  "pangName": "베어크리크",
  "sector": 1
 },
 "베이스타즈CC": {
  "mon": 1678,
  "pang": 73,
  "pangName": "베이스타즈",
  "sector": 16,
  "sector3": 3
 },
 "벨라스톤 CC": {
  "mon": 277,
  "pang": 501,
  "pangName": "벨라스톤",
  "sector": 8
 },
 "보라컨트리클럽": {
  "mon": 127,
  "pang": 21,
  "pangName": "보라",
  "sector": 16,
  "sector3": 3
 },
 "보성CC": {
  "mon": 507,
  "pang": 33,
  "pangName": "보성",
  "sector": 16,
  "sector3": 6
 },
 "볼카노골프앤리조트 CC": {
  "mon": 1604,
  "pang": 53,
  "pangName": "볼카노",
  "sector": 16,
  "sector3": 7
 },
 "부곡컨트리클럽": {
  "mon": 207,
  "pang": 22,
  "pangName": "부곡",
  "sector": 16,
  "sector3": 3
 },
 "부산컨트리클럽": {
  "mon": 208,
  "pang": 23,
  "pangName": "부산",
  "sector": 16,
  "sector3": 3
 },
 "블랙스톤 벨포레CC": {
  "pang": 72,
  "pangName": "블랙스톤벨포레",
  "sector": 4
 },
 "블루원상주CC": {
  "mon": 317,
  "pang": 54,
  "pangName": "블루원상주",
  "sector": 16,
  "sector3": 3
 },
 "사우스스프링스CC": {
  "pang": 160,
  "pangName": "사우스스프링스",
  "sector": 5
 },
 "상떼힐익산CC": {
  "mon": 185,
  "pang": 10,
  "pangName": "상떼힐익산",
  "sector": 16,
  "sector3": 6
 },
 "샤인데일골프리조트": {
  "mon": 462,
  "pang": 27,
  "pangName": "샤인데일",
  "sector": 1
 },
 "샴발라CC": {
  "mon": 1521,
  "pang": 88,
  "pangName": "샴발라",
  "sector": 1
 },
 "서산수컨트리클럽": {
  "mon": 238,
  "pang": 61,
  "pangName": "서산수",
  "sector": 4
 },
 "서서울CC": {
  "pang": 28,
  "pangName": "서서울",
  "sector": 1
 },
 "서원힐스CC": {
  "mon": 411,
  "pang": 31,
  "pangName": "서원힐스",
  "sector": 1
 },
 "석정힐CC": {
  "mon": 430,
  "pang": 25,
  "pangName": "석정힐",
  "sector": 16,
  "sector3": 6
 },
 "세레니티 강촌 CC": {
  "mon": 269,
  "pang": 49,
  "pangName": "세레니티-강촌",
  "sector": 1
 },
 "세레니티CC": {
  "mon": 145,
  "pang": 25,
  "pangName": "세레니티cc",
  "sector": 4
 },
 "세븐밸리CC": {
  "mon": 1780,
  "pang": 27,
  "pangName": "세븐밸리",
  "sector": 16,
  "sector3": 3
 },
 "세종에머슨컨트리클럽": {
  "mon": 744,
  "pang": 20,
  "pangName": "세종에머슨",
  "sector": 4
 },
 "소피아그린CC": {
  "mon": 159,
  "pang": 147,
  "pangName": "소피아그린",
  "sector": 5
 },
 "솔라고컨트리클럽": {
  "mon": 475,
  "pang": 65,
  "pangName": "솔라고",
  "sector": 4
 },
 "솔모로CC": {
  "mon": 160,
  "pang": 47,
  "pangName": "솔모로",
  "sector": 5
 },
 "스카이밸리CC": {
  "mon": 161,
  "pang": 52,
  "pangName": "스카이밸리",
  "sector": 5
 },
 "스카이뷰CC": {
  "mon": 213,
  "pang": 29,
  "pangName": "스카이뷰",
  "sector": 16,
  "sector3": 3
 },
 "스톤게이트CC": {
  "mon": 2159,
  "pang": 95,
  "pangName": "스톤게이트",
  "sector": 16,
  "sector3": 3
 },
 "스톤비치컨트리클럽": {
  "mon": 246,
  "pang": 54,
  "pangName": "스톤비치",
  "sector": 4
 },
 "스프링데일CC": {
  "mon": 533,
  "pang": 11,
  "pangName": "스프링데일",
  "sector": 16,
  "sector3": 7
 },
 "신라CC": {
  "mon": 162,
  "pang": 53,
  "pangName": "신라",
  "sector": 5
 },
 "써닝포인트CC": {
  "mon": 276,
  "pang": 56,
  "pangName": "써닝포인트",
  "sector": 5
 },
 "썬밸리CC": {
  "pang": 57,
  "pangName": "썬밸리(일죽)",
  "sector": 5
 },
 "아난티 중앙 골프클럽": {
  "mon": 1989,
  "pang": 69,
  "pangName": "아난티중앙(야간)",
  "sector": 5
 },
 "아델스코트CC": {
  "mon": 1610,
  "pang": 31,
  "pangName": "아델스코트",
  "sector": 16,
  "sector3": 3
 },
 "아리스타CC": {
  "mon": 1448,
  "pang": 75,
  "pangName": "아리스타",
  "sector": 4
 },
 "아리지CC": {
  "mon": 428,
  "pang": 58,
  "pangName": "아리지",
  "sector": 5
 },
 "아크로 컨트리클럽": {
  "mon": 335,
  "pang": 34,
  "pangName": "아크로",
  "sector": 16,
  "sector3": 6
 },
 "알펜시아700GC": {
  "mon": 685,
  "pang": 518,
  "pangName": "알펜시아700",
  "sector": 8
 },
 "알프스대영CC": {
  "mon": 267,
  "pang": 506,
  "pangName": "알프스대영",
  "sector": 8
 },
 "양산동원로얄컨트리클럽": {
  "mon": 2219,
  "pang": 89,
  "pangName": "양산동원로얄",
  "sector": 16,
  "sector3": 3
 },
 "양평TPC골프클럽": {
  "mon": 165,
  "pang": 67,
  "pangName": "양평TPC",
  "sector": 5
 },
 "어등산CC": {
  "mon": 187,
  "pang": 41,
  "pangName": "어등산",
  "sector": 16,
  "sector3": 6
 },
 "에버리스CC": {
  "mon": 114,
  "pang": 13,
  "pangName": "에버리스",
  "sector": 16,
  "sector3": 7
 },
 "에코랜드 CC": {
  "mon": 1630,
  "pang": 14,
  "pangName": "에코랜드",
  "sector": 16,
  "sector3": 7
 },
 "엠스클럽의성컨트리클럽": {
  "pang": 61,
  "pangName": "엠스클럽 의성",
  "sector": 16,
  "sector3": 3
 },
 "오너스GC": {
  "mon": 260,
  "pang": 40,
  "pangName": "오너스",
  "sector": 1
 },
 "오로라 골프&리조트": {
  "mon": 1982,
  "pang": 531,
  "pangName": "오로라",
  "sector": 8
 },
 "오르비스GC": {
  "pang": 101,
  "pangName": "오르비스",
  "sector": 16,
  "sector3": 3
 },
 "오션비치CC": {
  "mon": 220,
  "pang": 36,
  "pangName": "오션비치",
  "sector": 16,
  "sector3": 3
 },
 "오션힐스 청도GC": {
  "mon": 221,
  "pang": 37,
  "pangName": "오션힐스 청도",
  "sector": 16,
  "sector3": 3
 },
 "오션힐스 포항CC": {
  "mon": 222,
  "pang": 38,
  "pangName": "오션힐스 포항",
  "sector": 16,
  "sector3": 3
 },
 "오투리조트 CC": {
  "mon": 262,
  "pang": 536,
  "pangName": "오투",
  "sector": 8
 },
 "용원 GC": {
  "mon": 133,
  "pang": 40,
  "pangName": "용원",
  "sector": 16,
  "sector3": 3
 },
 "용인CC": {
  "mon": 454,
  "pang": 73,
  "pangName": "용인",
  "sector": 5
 },
 "용인플라자CC": {
  "mon": 106,
  "pang": 95,
  "pangName": "용인플라자",
  "sector": 5
 },
 "울산컨트리클럽": {
  "mon": 225,
  "pang": 41,
  "pangName": "울산",
  "sector": 16,
  "sector3": 3
 },
 "울진마린CC": {
  "mon": 1660,
  "pang": 72,
  "pangName": "울진마린",
  "sector": 16,
  "sector3": 3
 },
 "웨스트오션CC": {
  "mon": 752,
  "pang": 20,
  "pangName": "웨스트오션",
  "sector": 16,
  "sector3": 6
 },
 "윈체스트GC": {
  "pang": 74,
  "pangName": "윈체스트",
  "sector": 5
 },
 "의령리온CC": {
  "mon": 1749,
  "pang": 75,
  "pangName": "의령 리온",
  "sector": 16,
  "sector3": 3
 },
 "이글몬트CC": {
  "mon": 1728,
  "pang": 167,
  "pangName": "이글몬트",
  "sector": 5
 },
 "이븐데일CC": {
  "mon": 240,
  "pang": 42,
  "pangName": "이븐데일",
  "sector": 4
 },
 "이지스카이CC": {
  "mon": 1661,
  "pang": 67,
  "pangName": "이지스카이",
  "sector": 16,
  "sector3": 3
 },
 "인서울27골프클럽": {
  "mon": 1505,
  "pang": 149,
  "pangName": "인서울27",
  "sector": 5
 },
 "일레븐CC": {
  "mon": 1580,
  "pang": 81,
  "pangName": "일레븐",
  "sector": 4
 },
 "임페리얼레이크CC": {
  "mon": 241,
  "pang": 44,
  "pangName": "임페리얼레이크",
  "sector": 4
 },
 "자유로CC": {
  "mon": 543,
  "pang": 83,
  "pangName": "자유로",
  "sector": 1
 },
 "장수골프리조트": {
  "mon": 511,
  "pang": 19,
  "pangName": "장수",
  "sector": 16,
  "sector3": 6
 },
 "중원GC": {
  "mon": 419,
  "pang": 45,
  "pangName": "중원",
  "sector": 4
 },
 "지산CC": {
  "mon": 342,
  "pang": 88,
  "pangName": "지산",
  "sector": 5
 },
 "칼레이트CC": {
  "pang": 81,
  "pangName": "칼레이트",
  "sector": 16,
  "sector3": 3
 },
 "캐슬렉스 제주CC": {
  "mon": 347,
  "pang": 21,
  "pangName": "캐슬렉스제주",
  "sector": 16,
  "sector3": 7
 },
 "캐슬파인GC": {
  "mon": 172,
  "pang": 90,
  "pangName": "캐슬파인",
  "sector": 5
 },
 "코브스윙": {
  "mon": 426,
  "pang": 45,
  "pangName": "코브스윙",
  "sector": 1
 },
 "코스모스 링스": {
  "pang": 48,
  "pangName": "코스모스링스",
  "sector": 16,
  "sector3": 6
 },
 "코스카CC": {
  "mon": 245,
  "pang": 51,
  "pangName": "코스카",
  "sector": 4
 },
 "크리스밸리 CC": {
  "mon": 2341,
  "pang": 183,
  "pangName": "크리스밸리",
  "sector": 5
 },
 "크리스탈밸리 골프클럽": {
  "pang": 46,
  "pangName": "크리스탈밸리",
  "sector": 1
 },
 "클럽모우CC": {
  "mon": 268,
  "pang": 47,
  "pangName": "클럽모우",
  "sector": 1
 },
 "킹즈락 CC": {
  "mon": 248,
  "pang": 59,
  "pangName": "킹즈락",
  "sector": 4
 },
 "타미우스 골프클럽": {
  "mon": 118,
  "pang": 23,
  "pangName": "타미우스",
  "sector": 16,
  "sector3": 7
 },
 "태인컨트리클럽": {
  "mon": 189,
  "pang": 13,
  "pangName": "태인",
  "sector": 16,
  "sector3": 6
 },
 "테디밸리 골프&리조트": {
  "mon": 84,
  "pang": 24,
  "pangName": "테디밸리",
  "sector": 16,
  "sector3": 7
 },
 "통도 파인이스트 컨트리클럽": {
  "mon": 232,
  "pang": 48,
  "pangName": "통도파인이스트",
  "sector": 16,
  "sector3": 3
 },
 "통영 동원로얄 CC": {
  "mon": 508,
  "pang": 53,
  "pangName": "통영동원로얄",
  "sector": 16,
  "sector3": 3
 },
 "티클라우드CC": {
  "mon": 53,
  "pang": 48,
  "pangName": "티클라우드",
  "sector": 1
 },
 "파라지오 컨트리클럽": {
  "mon": 2238,
  "pang": 64,
  "pangName": "파라지오",
  "sector": 16,
  "sector3": 3
 },
 "파인리즈CC": {
  "mon": 322,
  "pang": 535,
  "pangName": "파인리즈",
  "sector": 8
 },
 "파인밸리CC": {
  "mon": 270,
  "pang": 527,
  "pangName": "파인밸리",
  "sector": 8
 },
 "파인스톤 CC": {
  "mon": 312,
  "pang": 56,
  "pangName": "파인스톤",
  "sector": 4
 },
 "파인크리크CC": {
  "mon": 173,
  "pang": 93,
  "pangName": "파인크리크",
  "sector": 5
 },
 "파주CC": {
  "mon": 516,
  "pang": 50,
  "pangName": "파주",
  "sector": 1
 },
 "파크밸리GC": {
  "mon": 447,
  "pang": 510,
  "pangName": "파크밸리",
  "sector": 8
 },
 "팔공컨트리클럽": {
  "pang": 50,
  "pangName": "팔공",
  "sector": 16,
  "sector3": 3
 },
 "포도CC": {
  "pang": 74,
  "pangName": "포도",
  "sector": 16,
  "sector3": 3
 },
 "포라이즌CC": {
  "mon": 186,
  "pang": 11,
  "pangName": "포라이즌",
  "sector": 16,
  "sector3": 6
 },
 "포천힐스 CC": {
  "mon": 303,
  "pang": 57,
  "pangName": "포천힐스",
  "sector": 1
 },
 "포항CC": {
  "mon": 1560,
  "pang": 79,
  "pangName": "포항",
  "sector": 16,
  "sector3": 3
 },
 "푸른솔GC 장성": {
  "mon": 1433,
  "pang": 42,
  "pangName": "푸른솔장성",
  "sector": 16,
  "sector3": 6
 },
 "프린세스GC": {
  "mon": 247,
  "pang": 58,
  "pangName": "프린세스",
  "sector": 4
 },
 "플라밍고 CC": {
  "mon": 1783,
  "pang": 92,
  "pangName": "플라밍고",
  "sector": 4
 },
 "핀크스 GC": {
  "pang": 25,
  "pangName": "핀크스",
  "sector": 16,
  "sector3": 7
 },
 "필로스CC": {
  "mon": 58,
  "pang": 60,
  "pangName": "필로스",
  "sector": 1
 },
 "하이원CC": {
  "mon": 461,
  "pang": 528,
  "pangName": "하이원",
  "sector": 8
 },
 "한림광릉CC(회원제)": {
  "pang": 3,
  "pangName": "한림광릉",
  "sector": 1
 },
 "한림안성CC": {
  "mon": 580,
  "pang": 28,
  "pangName": "한림안성(퍼9)",
  "sector": 5
 },
 "한원컨트리클럽": {
  "mon": 110,
  "pang": 97,
  "pangName": "한원",
  "sector": 5
 },
 "한탄강CC": {
  "mon": 473,
  "pang": 82,
  "pangName": "한탄강",
  "sector": 1
 },
 "해내다 CC": {
  "mon": 226,
  "pang": 103,
  "pangName": "해내다",
  "sector": 16,
  "sector3": 3
 },
 "해비치CC": {
  "pang": 62,
  "pangName": "해비치(서울)",
  "sector": 1
 },
 "해솔리아CC": {
  "mon": 286,
  "pang": 100,
  "pangName": "해솔리아",
  "sector": 5
 },
 "해운대비치골프&리조트": {
  "mon": 1539,
  "pang": 97,
  "pangName": "해운대비치",
  "sector": 16,
  "sector3": 3
 },
 "해운대컨트리클럽": {
  "mon": 234,
  "pang": 52,
  "pangName": "해운대",
  "sector": 16,
  "sector3": 3
 },
 "해피니스CC": {
  "pang": 17,
  "pangName": "해피니스",
  "sector": 16,
  "sector3": 6
 },
 "화순CC": {
  "mon": 193,
  "pang": 18,
  "pangName": "화순",
  "sector": 16,
  "sector3": 6
 },
 "힐데스하임 CC": {
  "mon": 1983,
  "pang": 99,
  "pangName": "힐데스하임",
  "sector": 4
 }
};
