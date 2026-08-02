/* 구장별 유튜브 공략 영상 — tools/build_coursevideos.py 산출물. 손으로 고치지 말 것.
 * ⓒ TOURLIST — 구장·영상 매칭 색인은 데이터베이스제작자 권리 보호 대상.
 *   무단 수집·복제·재배포 금지(이용약관 제5조·제7조).
 *
 * ⚠️ 조회수는 유튜브 정책상 30일 이상 보관하면 안 된다(Non-Authorized Data).
 *    화면에 FETCHED_AT 을 기준일로 함께 찍고, 2주마다 다시 수집할 것.
 * ⚠️ 정렬은 조회수 그대로 — 조회수·좋아요를 섞은 자체 점수를 화면에 쓰지 않는다.
 */
const COURSE_VIDEOS_AT = "2026-08-02";
const COURSE_VIDEOS = {
 "360도CC": [
  {
   "channel": "리보플TV",
   "likes": 41,
   "publishedAt": "2023-05-29",
   "title": "360도 CC Out 코스 (1~9번) 5분 공략",
   "videoId": "zdwQLY8ivng",
   "views": 11269
  },
  {
   "channel": "리보플TV",
   "likes": 42,
   "publishedAt": "2023-06-05",
   "title": "360도 CC IN코스 (10~18번) 5분 공략",
   "videoId": "2YB97DuAlk4",
   "views": 7470
  },
  {
   "channel": "밀떡아재",
   "likes": 28,
   "publishedAt": "2022-04-24",
   "title": "360도CC/인코스",
   "videoId": "blhpX65xktg",
   "views": 4848
  },
  {
   "channel": "밀떡아재",
   "likes": 31,
   "publishedAt": "2022-04-19",
   "title": "360도CC/아웃코스",
   "videoId": "mJTzQ9ndoyw",
   "views": 4479
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-09-11",
   "title": "360도 인 코스. 1~9홀. 한번에 보기.",
   "videoId": "YlZGxP0zvCA",
   "views": 1282
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-11",
   "title": "360도 아웃 코스. 1~9홀 한번에 보기.",
   "videoId": "zGc_FeJxnZ4",
   "views": 999
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-10-10",
   "title": "360도 골프장 코스 보기",
   "videoId": "1kh4tqS-fpM",
   "views": 820
  },
  {
   "channel": "밀떡아재",
   "likes": 6,
   "publishedAt": "2025-09-08",
   "title": "360도 CC 코스영상 #코스설명#백돌이시점#360도CC#아웃코스#인코스",
   "videoId": "aKeSfCHW4pg",
   "views": 471
  }
 ],
 "JNJ골프리조트": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-07-22",
   "title": "jnj 컨트리클럽 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "_uynbQqgqk4",
   "views": 6168
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-11",
   "title": "JNJcc 진코스. 라운드전 한번에 파악하기.",
   "videoId": "N2_5ohmuNqI",
   "views": 4315
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-09-11",
   "title": "JNJ cc 정코스. 1~9홀.",
   "videoId": "PsNLKFqvYck",
   "views": 3728
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-09-11",
   "title": "JNJ 남코스 코스. 1~9홀. 라운드전 한번에 보기.",
   "videoId": "RQtuWGl1nIY",
   "views": 3134
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-10-11",
   "title": "jnj 진코스 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙",
   "videoId": "WpZ0Q_Ho2z0",
   "views": 870
  }
 ],
 "OK CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-09-11",
   "title": "OK cc OUT 코스. 라운드전 한번에 파악하기.",
   "videoId": "871i6Py-pvk",
   "views": 2341
  }
 ],
 "SG아름다운CC": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-07-23",
   "title": "#SG아름다운 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "99YeTopLAJY",
   "views": 3270
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-12",
   "title": "SG아름다운골프. LAKE(레이크)코스. 라운드전 한번에 파악하기.",
   "videoId": "kxARH7SVipw",
   "views": 2882
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-09-12",
   "title": "SG아름다운골프. HILL(힐)코스. 라운드전 한번에 파악하기.",
   "videoId": "1Jgv-ON1XLg",
   "views": 1870
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-09-12",
   "title": "SG아름다운골프. ROCK(락)코스. 라운드전 한번에 파악하기.",
   "videoId": "3VlxTwx8Wsk",
   "views": 1734
  }
 ],
 "YJC골프클럽": [
  {
   "channel": "리보플TV",
   "likes": 5,
   "publishedAt": "2026-04-20",
   "title": "여주 YJC 골프클럽 에이스 코스 5분 공략",
   "videoId": "wu3x0zk5iRw",
   "views": 1229
  },
  {
   "channel": "리보플TV",
   "likes": 5,
   "publishedAt": "2026-04-27",
   "title": "여주 YJC 골프클럽 드림 코스 5분 공략",
   "videoId": "sEJP4QHts78",
   "views": 525
  }
 ],
 "가야CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-09-13",
   "title": "가야cc 김해코스. 라운드전 한번에 파악하기.",
   "videoId": "LFZr6LkUJX8",
   "views": 5090
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-13",
   "title": "가야cc 가락코스. 라운드전 한번에 파악하기.",
   "videoId": "O7fNhw2jL4w",
   "views": 3932
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-16",
   "title": "가야cc 퍼블릭 OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "pzaz7tx5l7I",
   "views": 3888
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-13",
   "title": "가야cc 낙동코스. 라운드전 한번에 파악하기.",
   "videoId": "JLhr6smJrqI",
   "views": 2957
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-09-13",
   "title": "가야cc 신어코스. 라운드전 한번에 파악하기.",
   "videoId": "gUgBbK4wrMc",
   "views": 2949
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-09-13",
   "title": "가야cc 수로코스. 라운드전 한번에 파악하기.",
   "videoId": "_YwgdWGakII",
   "views": 1396
  }
 ],
 "가평베네스트GC": [
  {
   "channel": "리보플TV",
   "likes": 56,
   "publishedAt": "2022-10-10",
   "title": "가평베네스트 GC 메이플 코스 5분 공략",
   "videoId": "6n0f48lLbvE",
   "views": 15963
  },
  {
   "channel": "리보플TV",
   "likes": 47,
   "publishedAt": "2022-10-17",
   "title": "가평베네스트 GC 파인 코스 5분 공략",
   "videoId": "3asfZ0x7t2A",
   "views": 10846
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-09-16",
   "title": "가평베네스트GC 버치코스. 라운드전 한번에 파악하기.",
   "videoId": "n8Q12Z5CB40",
   "views": 4720
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-07-24",
   "title": "#가평베네스트 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "waLeaY7x5jU",
   "views": 4482
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-16",
   "title": "가평베네스트GC 메이플코스. 라운드전 한번에 파악하기.",
   "videoId": "FZmlVBjVDSI",
   "views": 3626
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-09-16",
   "title": "가평베네스트GC 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "LDXRHXyEnAA",
   "views": 2936
  }
 ],
 "감곡CC": [
  {
   "channel": "리보플TV",
   "likes": 109,
   "publishedAt": "2022-12-26",
   "title": "충북 음성 감곡CC 피치코스 5분 공략",
   "videoId": "O_GZE33ex0U",
   "views": 29535
  },
  {
   "channel": "리보플TV",
   "likes": 82,
   "publishedAt": "2023-01-02",
   "title": "충북 음성 감곡CC 글렌코스 5분 공략",
   "videoId": "ATDseWCgPOE",
   "views": 16691
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-09-15",
   "title": "감곡cc PEACH(피치) 코스. 라운드전 한번에 파악하기.",
   "videoId": "7N-bwoGkL8Q",
   "views": 5918
  },
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2024-09-15",
   "title": "감곡cc GLEN(글렌) 코스. 라운드전 한번에 파악하기.",
   "videoId": "9yBlOsoyn8o",
   "views": 5454
  },
  {
   "channel": "밀떡아재",
   "likes": 18,
   "publishedAt": "2023-03-13",
   "title": "[3분코트요리] 감곡CC / 피치코스(수정본)",
   "videoId": "ZnN1e4GAMMM",
   "views": 2799
  }
 ],
 "강남300CC": [
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-09-13",
   "title": "강남300cc IN코스. 라운드전 한번에 파악하기.",
   "videoId": "p8D2KRV66Bg",
   "views": 6103
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-13",
   "title": "강남300cc OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "j-K3FTPLULI",
   "views": 4208
  }
 ],
 "거제뷰CC": [
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2024-09-18",
   "title": "거제뷰cc 해돋이 코스. 라운드전 한번에 파악하기.",
   "videoId": "bZ7ksHT36aU",
   "views": 6199
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-18",
   "title": "거제뷰cc 해넘이 코스. 라운드전 한번에 파악하기.",
   "videoId": "verDv5hcrS8",
   "views": 4219
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-08-01",
   "title": "#거제뷰 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "YxziV1cBaxc",
   "views": 3746
  }
 ],
 "경주CC": [
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2024-10-26",
   "title": "경주 CC 씨코스. 라운드전 한번에 파악하기.",
   "videoId": "Xh3PrcnYlI8",
   "views": 8136
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-10-26",
   "title": "경주 CC 썬코스. 라운드전 한번에 파악하기.",
   "videoId": "kb6R9I2lGzQ",
   "views": 6625
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-10-26",
   "title": "경주 CC 문코스. 라운드전 한번에 파악하기.",
   "videoId": "x-P0yoBGJ-g",
   "views": 6255
  }
 ],
 "경주신라CC": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-12-20",
   "title": "경주신라CC 천마 IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "9N1QVe2fIc0",
   "views": 4239
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-12-20",
   "title": "경주신라CC 천마 OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "KBHjd9czfzE",
   "views": 3500
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-12-20",
   "title": "경주신라CC 화랑 IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "aBaDYUHJVVQ",
   "views": 2634
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-12-20",
   "title": "경주신라CC 화랑 OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "FU8qSi1RQMg",
   "views": 2326
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2025-08-07",
   "title": "#경주신라 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "DSojaHczSN0",
   "views": 1146
  }
 ],
 "고성노벨CC": [
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-10-26",
   "title": "노벨 CC 가야코스. 라운드전 한번에 파악하기.",
   "videoId": "JiCNNLzKyrI",
   "views": 3008
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-26",
   "title": "노벨 CC 공룡코스. 라운드전 한번에 파악하기.",
   "videoId": "_h1nMih3Jlc",
   "views": 2968
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-26",
   "title": "노벨 CC 충무코스. 라운드전 한번에 파악하기.",
   "videoId": "FiuxyRJLPCc",
   "views": 2085
  },
  {
   "channel": "맵가이더",
   "likes": 2,
   "publishedAt": "2025-08-08",
   "title": "#고성노벨 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "eCek9wKnSac",
   "views": 1310
  }
 ],
 "고양 CC": [
  {
   "channel": "리보플TV",
   "likes": 31,
   "publishedAt": "2025-05-26",
   "title": "고양CC 1~9번 코스 공략",
   "videoId": "3jO4Kk2n5Uk",
   "views": 4476
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-12-22",
   "title": "고양CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "97crzN0m4qw",
   "views": 2822
  }
 ],
 "고창CC": [
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-12-13",
   "title": "고창CC 블루코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "u0Aa2UcudPM",
   "views": 3283
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-12-13",
   "title": "고창CC 비치코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "OP3zi3et3CA",
   "views": 2594
  },
  {
   "channel": "맵가이더",
   "likes": 1,
   "publishedAt": "2024-12-13",
   "title": "고창CC 스카이코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "1PPdVLs6uFw",
   "views": 482
  }
 ],
 "골드그린GC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-27",
   "title": "골드그린 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "OODNR86Bsyk",
   "views": 3166
  }
 ],
 "골드나인CC": [
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-12-22",
   "title": "골드나인CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "m2xmYzpu0JY",
   "views": 1447
  }
 ],
 "골드레이크CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-12-22",
   "title": "골드레이크CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "8pdC1sQWVBg",
   "views": 3727
  },
  {
   "channel": "맵가이더",
   "likes": 105,
   "publishedAt": "2025-08-13",
   "title": "#골드레이크 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "YogGP-olINU",
   "views": 3368
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-12-22",
   "title": "골드레이크CC 골드코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "nzXvZRs080Q",
   "views": 3006
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-12-22",
   "title": "골드레이크CC 힐코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Wn9YLLFV6vQ",
   "views": 2543
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-12-22",
   "title": "골드레이크CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wCDAn6N7yiQ",
   "views": 2462
  }
 ],
 "골든베이골프&리조트": [
  {
   "channel": "밀떡아재",
   "likes": 41,
   "publishedAt": "2021-09-15",
   "title": "[전백시]골든베이CC / 오션코스",
   "videoId": "uhy5BUOgT8k",
   "views": 12474
  },
  {
   "channel": "밀떡아재",
   "likes": 21,
   "publishedAt": "2021-09-13",
   "title": "[전백시]골든베이CC/밸리코스",
   "videoId": "MooIziHKFvE",
   "views": 7811
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-11",
   "title": "골든베이 CC 오션코스. 라운드전 한번에 파악하기.",
   "videoId": "u9xio2OABws",
   "views": 3221
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-11",
   "title": "골든베이 CC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "z2yCQT6nBXg",
   "views": 2616
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-11",
   "title": "골든베이 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "qrlpLuHcvSs",
   "views": 1970
  }
 ],
 "골프존카운티 더골프": [
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2025-03-21",
   "title": "[골프] 골프존카운티 더골프CC 오션코스공략. 라운드전 한번에 파악하기.",
   "videoId": "5AhBNjdYp3U",
   "views": 4684
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-03-21",
   "title": "[골프] 골프존카운티 더골프CC 로키코스공략. 라운드전 한번에 파악하기.",
   "videoId": "V570ksCGtgs",
   "views": 4348
  }
 ],
 "골프존카운티 사천": [
  {
   "channel": "밀떡아재",
   "likes": 51,
   "publishedAt": "2023-01-02",
   "title": "골프존카운티 사천CC 캐디님의 코스설명과 함께 진행되는 2022년 파이널 대결",
   "videoId": "jJyGX6tqu1g",
   "views": 11825
  },
  {
   "channel": "밀떡아재",
   "likes": 39,
   "publishedAt": "2023-01-13",
   "title": "골프존카운티 사천CC / 다솔코스",
   "videoId": "sOYKujOyLOk",
   "views": 9742
  },
  {
   "channel": "밀떡아재",
   "likes": 7,
   "publishedAt": "2025-10-31",
   "title": "골프존카운티 사천CC / 다솔코스 #골프존카운티사천CC#골프존카운티#다솔코스#사천골프장#남해골프#코스설명",
   "videoId": "-6C1k1igjKA",
   "views": 2547
  },
  {
   "channel": "밀떡아재",
   "likes": 6,
   "publishedAt": "2025-10-29",
   "title": "골프존카운티 사천CC / 다솔코스 #골프존카운티사천CC#골프존카운티#비토코스#사천골프장#남해골프#코스설명",
   "videoId": "Ls001jZBZiA",
   "views": 1954
  },
  {
   "channel": "밀떡아재",
   "likes": 5,
   "publishedAt": "2025-10-30",
   "title": "골프존카운티 사천CC / 비룡코스 #골프존카운티사천CC#비룡코스#캐디설명#남해골프",
   "videoId": "BwwZRFFDOw0",
   "views": 1901
  }
 ],
 "골프존카운티 순천": [
  {
   "channel": "맵가이더",
   "likes": 65,
   "publishedAt": "2025-08-13",
   "title": "#골프존카운티 순천 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "513kFWZle4A",
   "views": 3449
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-순천 다이아몬드코스. 라운드전 한번에 파악하기.",
   "videoId": "Y5B7-V2s7mM",
   "views": 3121
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-순천 루비코스. 라운드전 한번에 파악하기.",
   "videoId": "QKWni0Vah7k",
   "views": 2388
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-순천 토파즈코스. 라운드전 한번에 파악하기.",
   "videoId": "B3hdxo2sr5Y",
   "views": 2095
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-순천 에메랄드코스. 라운드전 한번에 파악하기.",
   "videoId": "CYT0giJ-99g",
   "views": 2084
  }
 ],
 "골프존카운티 안성H": [
  {
   "channel": "리보플TV",
   "likes": 51,
   "publishedAt": "2023-10-23",
   "title": "골프존카운티 안성H 레이크 코스 5분 공략",
   "videoId": "4DKnK29Pm04",
   "views": 13609
  },
  {
   "channel": "리보플TV",
   "likes": 50,
   "publishedAt": "2023-10-16",
   "title": "골프존카운티 안성H 힐코스 5분 공략",
   "videoId": "UX8NA5uXr4Q",
   "views": 11566
  }
 ],
 "골프존카운티 안성W": [
  {
   "channel": "리보플TV",
   "likes": 144,
   "publishedAt": "2021-08-06",
   "title": "골프존카운티 안성W In코스 공략",
   "videoId": "IbJuCfxCqnc",
   "views": 46590
  },
  {
   "channel": "리보플TV",
   "likes": 129,
   "publishedAt": "2021-08-01",
   "title": "골프존카운티 안성W Out코스 공략",
   "videoId": "rbR9ysXAJjA",
   "views": 32730
  }
 ],
 "골프존카운티 진천": [
  {
   "channel": "밀떡아재",
   "likes": 116,
   "publishedAt": "2020-10-04",
   "title": "[전백시]골프존카운티 진천CC 캐디에게 듣는 레이크 코스설명",
   "videoId": "nsRDLuA02TE",
   "views": 31601
  },
  {
   "channel": "밀떡아재",
   "likes": 93,
   "publishedAt": "2022-09-30",
   "title": "[전백시]골프존카운티진천CC/밸리코스",
   "videoId": "lWuBVlVgJy4",
   "views": 19069
  },
  {
   "channel": "리보플TV",
   "likes": 73,
   "publishedAt": "2021-11-06",
   "title": "골프존카운티 진천 (구 아트밸리) 마운틴 코스 공략",
   "videoId": "hkAryiIPROI",
   "views": 16348
  },
  {
   "channel": "리보플TV",
   "likes": 67,
   "publishedAt": "2021-11-03",
   "title": "골프존카운티 진천 (구 아트밸리) 레이크 코스 공략",
   "videoId": "LaRIljhMThA",
   "views": 12566
  },
  {
   "channel": "리보플TV",
   "likes": 41,
   "publishedAt": "2022-06-27",
   "title": "골프존카운티 진천 (구 아트밸리) 밸리코스 5분 공략",
   "videoId": "T6j5R4GIOHY",
   "views": 9033
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-08-14",
   "title": "#골프존카운티 진천 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "1owzXmysYH0",
   "views": 7872
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-진천 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "hpgtGfpWf_o",
   "views": 2777
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-진천 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "m66JhufQs2Y",
   "views": 2548
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-진천 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "6o8eEQkoHyM",
   "views": 2401
  },
  {
   "channel": "밀떡아재",
   "likes": 8,
   "publishedAt": "2025-08-26",
   "title": "\"캐디님 티박스설명\" 골프존카운티진천CC/밸리코스",
   "videoId": "u12oOfxj1SQ",
   "views": 1080
  }
 ],
 "골프존카운티 천안": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-천안 IN(인)코스. 라운드전 한번에 파악하기.",
   "videoId": "jwWWlpa-coU",
   "views": 3914
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-04",
   "title": "골프존카운티-천안 OUT(아웃)코스. 라운드전 한번에 파악하기.",
   "videoId": "RnbTKgkCYBU",
   "views": 2463
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2025-08-15",
   "title": "#골프존카운티 천안 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "zvX-dxom7h8",
   "views": 1141
  }
 ],
 "골프존카운티 화랑": [
  {
   "channel": "리보플TV",
   "likes": 92,
   "publishedAt": "2022-07-18",
   "title": "진천 골프존카운티 화랑 원화랑 코스 5분 공략",
   "videoId": "Gy48tGa8ssE",
   "views": 21792
  },
  {
   "channel": "리보플TV",
   "likes": 57,
   "publishedAt": "2022-07-18",
   "title": "진천 골프존카운티 화랑 원낭자 코스 5분 공략",
   "videoId": "sPjfQL-4uAA",
   "views": 14882
  }
 ],
 "광양CC": [
  {
   "channel": "맵가이더",
   "likes": 2,
   "publishedAt": "2024-12-23",
   "title": "광양 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Bba5ZNGXfuI",
   "views": 1160
  }
 ],
 "구니컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-10-14",
   "title": "구니 CC 이스트코스. 라운드전 한번에 파악하기.",
   "videoId": "PVXXBk4S-ZQ",
   "views": 6438
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-14",
   "title": "구니 CC 웨스트코스. 라운드전 한번에 파악하기.",
   "videoId": "z_0KAwecubM",
   "views": 4934
  }
 ],
 "구미CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-18",
   "title": "[골프] 구미CC 청룡코스공략. 라운드전 한번에 파악하기.",
   "videoId": "OmZHJ5wiEaw",
   "views": 4280
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-18",
   "title": "[골프] 구미CC 백호코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ce5LSzeXNIk",
   "views": 3356
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-18",
   "title": "[골프] 구미CC 거북코스공략. 라운드전 한번에 파악하기.",
   "videoId": "fFXHat_fCOA",
   "views": 3169
  }
 ],
 "군위오펠GC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-26",
   "title": "군위오펠 GC 산울코스. 라운드전 한번에 파악하기.",
   "videoId": "ZSrHyyNTWvg",
   "views": 5335
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-26",
   "title": "군위오펠 GC 여울코스. 라운드전 한번에 파악하기.",
   "videoId": "Bs-PPqUzcBg",
   "views": 3437
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-16",
   "title": "#군위오펠 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "FVPLV86VNOM",
   "views": 776
  }
 ],
 "그랜드 골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-12-23",
   "title": "그랜드 CC 동코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "KBcAHx7ks9o",
   "views": 3903
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-12-23",
   "title": "그랜드 CC 남코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "OTOZFbkXXQc",
   "views": 3645
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-12-23",
   "title": "그랜드 CC 서코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "IQ7Hg5ARqyc",
   "views": 3572
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2025-07-25",
   "title": "#그랜드 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "ErVagzZOxq0",
   "views": 2836
  }
 ],
 "그린필드 CC": [
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-02",
   "title": "#그린필드 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf #제주도",
   "videoId": "Qh1cxrKbb_s",
   "views": 1899
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-12-24",
   "title": "그린필드 GC 씨코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ptNMyOb0RBo",
   "views": 1535
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-12-24",
   "title": "그린필드 GC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "JnztJeSc4V0",
   "views": 1106
  }
 ],
 "그린힐CC": [
  {
   "channel": "맵가이더",
   "likes": 28,
   "publishedAt": "2024-12-27",
   "title": "그린힐 CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "3UtDrIZ0dFk",
   "views": 7796
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-12-27",
   "title": "그린힐 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "CqWBbDqJK2Y",
   "views": 5642
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-17",
   "title": "#그린힐 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "rVaFDAVIUIQ",
   "views": 975
  }
 ],
 "글렌로스CC": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-14",
   "title": "글렌로스 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "2FSLOHIdvOQ",
   "views": 3478
  }
 ],
 "금강CC": [
  {
   "channel": "리보플TV",
   "likes": 82,
   "publishedAt": "2021-06-05",
   "title": "여주 금강cc 동코스 공략",
   "videoId": "3245wuQ_33s",
   "views": 21002
  },
  {
   "channel": "리보플TV",
   "likes": 64,
   "publishedAt": "2021-06-05",
   "title": "여주 금강CC 남코스 공략",
   "videoId": "Ep4u4ZNeAgU",
   "views": 16652
  },
  {
   "channel": "밀떡아재",
   "likes": 49,
   "publishedAt": "2023-07-20",
   "title": "금강CC / 서코스 \"구장이 넓다고 쉬운건 아니다\"",
   "videoId": "YL54VFpV_Vo",
   "views": 13298
  },
  {
   "channel": "리보플TV",
   "likes": 53,
   "publishedAt": "2021-10-22",
   "title": "여주 금강CC 서코스 공략",
   "videoId": "3cL7JMybeUA",
   "views": 12068
  },
  {
   "channel": "밀떡아재",
   "likes": 33,
   "publishedAt": "2023-07-25",
   "title": "금강CC / 남코스 \"코스는 넓어 보이나 페어웨이는 생각보다 좁다\"",
   "videoId": "4VnrtjPAafg",
   "views": 8628
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-11-23",
   "title": "금강 CC 동코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "U5xUtbVe2Dk",
   "views": 4750
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-11-23",
   "title": "금강 CC 남코스. 라운드전 한번에 파악하기.",
   "videoId": "Nl0p2US--uQ",
   "views": 2804
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-11-23",
   "title": "금강 CC 서코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "GF9jl68bIM8",
   "views": 2799
  }
 ],
 "기장동원로얄컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-27",
   "title": "기장동원로얄 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "pVLKcSsU57g",
   "views": 3605
  }
 ],
 "기흥CC": [
  {
   "channel": "밀떡아재",
   "likes": 27,
   "publishedAt": "2025-09-01",
   "title": "기흥CC / 북코스 \"싱글치기 딱 좋은 골프장\"(1부)",
   "videoId": "KIsKh0hASlk",
   "views": 4258
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-18",
   "title": "기흥 cc  EAST(동)코스. 라운드전 한번에 파악하기.",
   "videoId": "WxW8wTHsWdg",
   "views": 4223
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-09-18",
   "title": "기흥 cc  SOUTH(남)코스. 라운드전 한번에 파악하기.",
   "videoId": "9k96PQxHfKE",
   "views": 4030
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-18",
   "title": "기흥 cc  WEST(서)코스. 라운드전 한번에 파악하기.",
   "videoId": "gHDkRpfx8Hw",
   "views": 3579
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-18",
   "title": "기흥 cc  NOUTH(북)코스. 라운드전 한번에 파악하기.",
   "videoId": "9nGOG57o3rA",
   "views": 3397
  },
  {
   "channel": "밀떡아재",
   "likes": 15,
   "publishedAt": "2025-08-12",
   "title": "기흥CC / 북코스 코스설명 #기흥CC#북코스#편안한골프장",
   "videoId": "t62dFM2Xie4",
   "views": 2373
  },
  {
   "channel": "밀떡아재",
   "likes": 20,
   "publishedAt": "2025-09-04",
   "title": "기흥CC / 북코스 \"싱글은 운도 따라야한다\"(2부)",
   "videoId": "GOFquXHFuw0",
   "views": 1913
  },
  {
   "channel": "밀떡아재",
   "likes": 8,
   "publishedAt": "2025-08-19",
   "title": "기흥CC/서코스 코스설명 #기흥CC#코스#회원제골프장",
   "videoId": "fFqO3R-tg-k",
   "views": 1301
  }
 ],
 "김제스파힐스CC": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-11-01",
   "title": "김제스파힐스 CC 힐스코스. 라운드전 한번에 파악하기.",
   "videoId": "lu0wBhf-Hgc",
   "views": 3831
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-11-01",
   "title": "김제스파힐스 CC 스파코스. 라운드전 한번에 파악하기.",
   "videoId": "WG1LyUc5gZg",
   "views": 3387
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-08-18",
   "title": "#김제 스파힐스 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "z_D0OBLROqM",
   "views": 3140
  }
 ],
 "김포 씨사이드 CC": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-09-19",
   "title": "김포씨사이드 cc 서코스. 라운드전 한번에 파악하기.",
   "videoId": "lubqW5oKKSo",
   "views": 4916
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-19",
   "title": "김포씨사이드 cc 남코스. 라운드전 한번에 파악하기.",
   "videoId": "BNduOzeUyv0",
   "views": 3620
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-08-18",
   "title": "#김포씨사이드 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "yRg4TUAv-pE",
   "views": 2645
  }
 ],
 "김해상록GC": [
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-09-26",
   "title": "김해상록 GC 황새코스. 라운드전 한번에 파악하기.",
   "videoId": "IWyfZY2aijU",
   "views": 4171
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-26",
   "title": "김해상록 GC 여의코스. 라운드전 한번에 파악하기.",
   "videoId": "Ckb4YzEF_uk",
   "views": 3708
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-03",
   "title": "#김해상록 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "I9JneAwOdKw",
   "views": 1074
  }
 ],
 "나인브릿지CC": [
  {
   "channel": "리보플TV",
   "likes": 21,
   "publishedAt": "2021-05-01",
   "title": "세계 100대 코스 제주 나인브릿지 Creek 코스 공략",
   "videoId": "gT_MdOrZL7s",
   "views": 8110
  },
  {
   "channel": "리보플TV",
   "likes": 18,
   "publishedAt": "2021-05-01",
   "title": "세계 100대 골프장 제주 나인브릿지 Highland 코스 공략",
   "videoId": "QwI80zB2IGs",
   "views": 3615
  }
 ],
 "나주컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-14",
   "title": "나주 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "4BIAqUVacbY",
   "views": 1833
  }
 ],
 "남안동컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2024-12-29",
   "title": "남안동 CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "41gqbZMj6lc",
   "views": 5563
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-12-29",
   "title": "남안동 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Zjr5DqzpMas",
   "views": 4354
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-04",
   "title": "#남안동 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "I_6oNvYl2as",
   "views": 1657
  }
 ],
 "남양주CC": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-08-19",
   "title": "#남양주 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "V1cIjSPSxkE",
   "views": 4805
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-10-14",
   "title": "남양주 CC 파랑새코스. 라운드전 한번에 파악하기.",
   "videoId": "zcb4806VNo8",
   "views": 4332
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-10-14",
   "title": "남양주 CC 포시즌코스. 라운드전 한번에 파악하기.",
   "videoId": "8TaU-l_qRAw",
   "views": 1034
  }
 ],
 "남여주GC": [
  {
   "channel": "리보플TV",
   "likes": 92,
   "publishedAt": "2021-11-09",
   "title": "남여주CC 누리코스 공략",
   "videoId": "QLB86WfOpS8",
   "views": 22976
  },
  {
   "channel": "리보플TV",
   "likes": 91,
   "publishedAt": "2021-11-10",
   "title": "남여주CC 가람코스 공략",
   "videoId": "yleeS_EZNGM",
   "views": 21807
  },
  {
   "channel": "리보플TV",
   "likes": 84,
   "publishedAt": "2021-11-07",
   "title": "남여주CC 마루코스 공략",
   "videoId": "Cn8Embm2dbg",
   "views": 17960
  },
  {
   "channel": "밀떡아재",
   "likes": 55,
   "publishedAt": "2022-08-28",
   "title": "[전백시]가성비 쩌는 골프장 남여주CC / 마루코스",
   "videoId": "nI2A_ZTES4E",
   "views": 12222
  },
  {
   "channel": "밀떡아재",
   "likes": 57,
   "publishedAt": "2022-09-02",
   "title": "[전백시]스코어가 고프면? 남여주 CC / 누리코스",
   "videoId": "vJgibLTv_MQ",
   "views": 9042
  },
  {
   "channel": "밀떡아재",
   "likes": 25,
   "publishedAt": "2022-01-11",
   "title": "[전백시] 남여주CC 가람코스",
   "videoId": "Qz174lQw4Do",
   "views": 4937
  },
  {
   "channel": "밀떡아재",
   "likes": 16,
   "publishedAt": "2022-01-18",
   "title": "[전백시]남여주CC 마루코스",
   "videoId": "WBIC9LFk0kA",
   "views": 2345
  }
 ],
 "남원상록GC": [
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-12-15",
   "title": "남원상록CC 춘향코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ueeUW2zJ4Cg",
   "views": 4359
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-12-15",
   "title": "남원상록CC 몽룡코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "C2ahG_K0EqM",
   "views": 4134
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-08-04",
   "title": "#남원상록 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "R3XixplRtxg",
   "views": 1468
  }
 ],
 "남촌CC": [
  {
   "channel": "밀떡아재",
   "likes": 28,
   "publishedAt": "2022-08-04",
   "title": "[3분코스요리]남촌CC/동코스",
   "videoId": "9Ry04gq2mmo",
   "views": 5403
  },
  {
   "channel": "밀떡아재",
   "likes": 26,
   "publishedAt": "2022-08-01",
   "title": "[3분코스요리]남촌CC/서코스",
   "videoId": "T3mH2oP45wc",
   "views": 4132
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-11-29",
   "title": "[골프] 남촌CC (2025.ver) 서 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "NRo9CrGth0c",
   "views": 738
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-11-29",
   "title": "[골프] 남촌CC (2025.ver) 동 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "rxzqFULMzNc",
   "views": 614
  }
 ],
 "남춘천CC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-12-29",
   "title": "남춘천 CC 챌린지코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Yxeu7PE3wiE",
   "views": 4662
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-12-29",
   "title": "남춘천 CC 빅토리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "pOewvcEcQFQ",
   "views": 4347
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2025-08-05",
   "title": "#남춘천 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "TNIbgJ_XKgA",
   "views": 1165
  }
 ],
 "내장산골프&리조트": [
  {
   "channel": "리보플TV",
   "likes": 43,
   "publishedAt": "2023-06-12",
   "title": "내장산CC 홍단풍 코스 5분 공략",
   "videoId": "7i5In4siXbo",
   "views": 10076
  },
  {
   "channel": "리보플TV",
   "likes": 34,
   "publishedAt": "2023-06-19",
   "title": "내장산CC 청단풍 코스 5분 공략",
   "videoId": "mo1LD-hr40E",
   "views": 6376
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-30",
   "title": "내장산 cc 홍단풍코스. 라운드전 한번에 파악하기.",
   "videoId": "TDkQEKwJBe8",
   "views": 2292
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-09-30",
   "title": "내장산 cc 청단풍코스. 라운드전 한번에 파악하기.",
   "videoId": "VhrCbwJR9Fg",
   "views": 1988
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-08-05",
   "title": "#내장산 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "vDRNmTRVRdg",
   "views": 1430
  }
 ],
 "노스팜CC": [
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-12-29",
   "title": "노스팜 CC 이스트코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "rk-tt8ggkeQ",
   "views": 6922
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-12-29",
   "title": "노스팜 CC 웨스트코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "di1Q-B1JJDQ",
   "views": 4212
  },
  {
   "channel": "밀떡아재",
   "likes": 9,
   "publishedAt": "2026-04-20",
   "title": "노스팜CC/웨스트코스#노스팜CC#웨스트코스#티박스#golf#골프",
   "videoId": "8Xi2r0w5lrM",
   "views": 1604
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-06",
   "title": "#노스팜 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "K4SeVlwkB5w",
   "views": 1576
  }
 ],
 "뉴서울CC": [
  {
   "channel": "리보플TV",
   "likes": 60,
   "publishedAt": "2021-07-14",
   "title": "뉴서울CC 예술 OUT 코스 공략",
   "videoId": "zd00ppH5Z8Y",
   "views": 17487
  },
  {
   "channel": "리보플TV",
   "likes": 59,
   "publishedAt": "2021-07-14",
   "title": "뉴서울CC 예술 IN 코스 공략",
   "videoId": "N1wfoXSx72I",
   "views": 15806
  },
  {
   "channel": "리보플TV",
   "likes": 20,
   "publishedAt": "2024-09-02",
   "title": "경기 광주 뉴서울CC 문화 Out 코스 (1~9번) 5분 공략",
   "videoId": "65cQ_P4pyU0",
   "views": 7137
  },
  {
   "channel": "리보플TV",
   "likes": 19,
   "publishedAt": "2024-09-09",
   "title": "경기 광주 뉴서울CC 문화 In 코스 (10~18번) 5분 공략",
   "videoId": "orDz3yhSPPQ",
   "views": 4533
  }
 ],
 "뉴스프링빌CC 이천": [
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-11-23",
   "title": "뉴스프링빌 CC 록키코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "321Q5hixhrM",
   "views": 1431
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-11-23",
   "title": "뉴스프링빌 CC 몽블랑코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "RCH2sTwGZlQ",
   "views": 1394
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-12-03",
   "title": "[골프] 뉴스프링빌CC (2025.ver) 몽블랑 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "yfVqqg567cA",
   "views": 1354
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-11-23",
   "title": "뉴스프링빌 CC 올림푸스코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "eO3Af1T49xs",
   "views": 1262
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-11-23",
   "title": "뉴스프링빌 CC 알프스코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "NsL3ZT9ulqg",
   "views": 1238
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-12-03",
   "title": "[골프] 뉴스프링빌CC (2025.ver) 올림푸스 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "mvgt03UR_-M",
   "views": 465
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-12-03",
   "title": "[골프] 뉴스프링빌CC (2025.ver) 록키 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "0T36hk7iMZ0",
   "views": 354
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-12-03",
   "title": "[골프] 뉴스프링빌CC (2025.ver) 알프스 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "1BUWhF1XhHM",
   "views": 164
  }
 ],
 "뉴코리아 CC": [
  {
   "channel": "리보플TV",
   "likes": 40,
   "publishedAt": "2022-08-22",
   "title": "고양 뉴코리아CC Out 코스 (1~9번) 5분 공략",
   "videoId": "veBZar3l6BI",
   "views": 11862
  },
  {
   "channel": "리보플TV",
   "likes": 32,
   "publishedAt": "2022-08-22",
   "title": "고양 뉴코리아CC In코스 (10~18번) 5분 공략",
   "videoId": "NaOpfn4vFx0",
   "views": 7479
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-08-20",
   "title": "#뉴코리아 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "mFZPXk1PtM4",
   "views": 4684
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-12-29",
   "title": "뉴코리아 CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wm3QXGIBNfQ",
   "views": 1523
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-12-29",
   "title": "뉴코리아 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "DHzsCTLhU3w",
   "views": 1406
  }
 ],
 "다산베아채CC": [
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-08-20",
   "title": "#다산베아채 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "rECuY58Qq-s",
   "views": 3934
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-27",
   "title": "다산베아채 CC 다산코스. 라운드전 한번에 파악하기.",
   "videoId": "XkeNipFBHis",
   "views": 3628
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-27",
   "title": "다산베아채 CC 장보고코스. 라운드전 한번에 파악하기.",
   "videoId": "Q5uiiksdFfI",
   "views": 2911
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-27",
   "title": "다산베아채 CC 베아채코스. 라운드전 한번에 파악하기.",
   "videoId": "XvA1zSjFygc",
   "views": 2802
  }
 ],
 "다이아몬드CC": [
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-01-10",
   "title": "다이아몬드 CC northcape코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "VZ0elafWjEo",
   "views": 4722
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-08-21",
   "title": "#다이아몬드 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "BJTu6algj2s",
   "views": 4268
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-01-10",
   "title": "다이아몬드 CC southcape코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wX8YMIbbmo0",
   "views": 4036
  }
 ],
 "대가야CC": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-20",
   "title": "대가야cc OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "0peACw-7j7I",
   "views": 4443
  }
 ],
 "대영베이스컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 48,
   "publishedAt": "2024-09-20",
   "title": "대영베이스cc IN코스. 라운드전 한번에 파악하기.",
   "videoId": "uenX0t7YFlk",
   "views": 9516
  },
  {
   "channel": "맵가이더",
   "likes": 33,
   "publishedAt": "2024-09-20",
   "title": "대영베이스cc OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "61rwl55cvrk",
   "views": 7006
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-08-22",
   "title": "#대영베이스 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "gczF-OVXY34",
   "views": 6048
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2026-02-23",
   "title": "[골프] 대영베이스 CC (2026.ver) IN 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "MKYgnsXbS9Q",
   "views": 3633
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2026-02-23",
   "title": "[골프] 대영베이스 CC (2026.ver) OUT 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "yGJmYF3B0ss",
   "views": 2931
  }
 ],
 "대영힐스컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-02-28",
   "title": "대영힐스 CC 미코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "75NLLG2OG6M",
   "views": 7405
  },
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2025-02-28",
   "title": "대영힐스 CC 력코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "69XIiTgo7wk",
   "views": 7369
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-02-28",
   "title": "대영힐스 CC 청코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "xdj-jREd8IE",
   "views": 6516
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2026-02-26",
   "title": "[골프] 대영힐스 CC (2026.ver) 청 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "o0zjBO0hR44",
   "views": 4263
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2026-02-26",
   "title": "[골프] 대영힐스 CC (2026.ver) 미 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "uI0ICvr5d2Y",
   "views": 3122
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2026-02-26",
   "title": "[골프] 대영힐스 CC (2026.ver) 력 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "F2RYQboUaZc",
   "views": 2374
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-22",
   "title": "#대영힐스 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "ggs7bh_sJY4",
   "views": 1423
  }
 ],
 "대호단양CC": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-01-09",
   "title": "대호단양 CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "pXal0M2xgd0",
   "views": 3964
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-01-09",
   "title": "대호단양 CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "2s8bxRzjTik",
   "views": 3076
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-08-23",
   "title": "#대호단양 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "AtscUx6GnU4",
   "views": 2014
  }
 ],
 "더 시에나 CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-27",
   "title": "더 시에나 CC(구.제주cc) 서코스. 라운드전 한번에 파악하기.",
   "videoId": "DkSEJ3ENZXA",
   "views": 2865
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-27",
   "title": "더 시에나 CC(구.제주cc) 동코스. 라운드전 한번에 파악하기.",
   "videoId": "Gr8UvCtxZzQ",
   "views": 2700
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2025-07-18",
   "title": "더시에나 골프장 #골프 #아름다운골프장 #골프장 #더시에나 #골프스윙  #골프코스 #golf",
   "videoId": "9CDqqIcIcoU",
   "views": 2203
  }
 ],
 "더나인골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-10-15",
   "title": "더나인 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "hxK89o7vRIw",
   "views": 2220
  }
 ],
 "더스타휴 골프앤리조트": [
  {
   "channel": "리보플TV",
   "likes": 25,
   "publishedAt": "2022-09-19",
   "title": "양평 더스타휴CC 휴코스 5분 공략",
   "videoId": "s0FXOzO4two",
   "views": 8349
  },
  {
   "channel": "리보플TV",
   "likes": 27,
   "publishedAt": "2022-09-12",
   "title": "양평 더스타휴CC 스타코스 5분 공략",
   "videoId": "pJj6EbIIxJo",
   "views": 6692
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-01-10",
   "title": "더스타휴 CC 휴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "iDzskYMrd6Y",
   "views": 1840
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-01-10",
   "title": "더스타휴 CC 스타코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "oYvHiQGBtr4",
   "views": 1583
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-08-14",
   "title": "#더스타휴 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "uDyBe5KDWcU",
   "views": 1168
  }
 ],
 "더크로스비 골프클럽": [
  {
   "channel": "리보플TV",
   "likes": 125,
   "publishedAt": "2021-06-12",
   "title": "이천 더크로스비 GC 아리아코스 공략",
   "videoId": "FLawnZVrhHI",
   "views": 29325
  },
  {
   "channel": "리보플TV",
   "likes": 112,
   "publishedAt": "2021-06-12",
   "title": "이천 더크로스비 GC 빌리코스 공략",
   "videoId": "s3selPAeifA",
   "views": 22679
  },
  {
   "channel": "맵가이더",
   "likes": 29,
   "publishedAt": "2024-09-30",
   "title": "더크로스비 GC 샬롯코스. 라운드전 한번에 파악하기.",
   "videoId": "8gG6JCW7bUI",
   "views": 7512
  },
  {
   "channel": "맵가이더",
   "likes": 29,
   "publishedAt": "2024-09-30",
   "title": "더크로스비 GC 아리아코스. 라운드전 한번에 파악하기.",
   "videoId": "xcu6N-0IMUA",
   "views": 5982
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-09-30",
   "title": "더크로스비 GC 빌리코스. 라운드전 한번에 파악하기.",
   "videoId": "Oazd9wlK6fY",
   "views": 3683
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-08-23",
   "title": "#더크로스비 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "pK16TXwjZkU",
   "views": 1243
  }
 ],
 "더플레이어스GC": [
  {
   "channel": "밀떡아재",
   "likes": 45,
   "publishedAt": "2022-07-13",
   "title": "[전백시]더플레이어스CC / 밸리코스[캐디님티박스설명]",
   "videoId": "-W3EODqVRCs",
   "views": 11018
  },
  {
   "channel": "밀떡아재",
   "likes": 37,
   "publishedAt": "2022-07-18",
   "title": "[전백시]더플레이어스CC / 레이크 코스[캐디님티박스설명]",
   "videoId": "kzWDmsq31mM",
   "views": 9379
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-03-17",
   "title": "[골프] 클럽디 더플레이어스 CC 레이크 공략. 라운드전 한번에 파악하기.",
   "videoId": "r8p-9pCpqJY",
   "views": 5026
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-17",
   "title": "[골프] 클럽디 더플레이어스 CC 마운틴 공략. 라운드전 한번에 파악하기.",
   "videoId": "aFncfD_vnZU",
   "views": 4048
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-03-17",
   "title": "[골프] 클럽디 더플레이어스 CC 밸리 공략. 라운드전 한번에 파악하기.",
   "videoId": "5l5I_JoxfGI",
   "views": 3825
  }
 ],
 "더힐컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2025-01-12",
   "title": "더힐 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "5R3XiYxt0Mc",
   "views": 5049
  }
 ],
 "동부산컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-26",
   "title": "동부산 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "th52zre4wi0",
   "views": 4492
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-09-26",
   "title": "동부산 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "yTcPmJCUjtU",
   "views": 4458
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-09-26",
   "title": "동부산 CC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "m8CbXNpQys4",
   "views": 3272
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-08-26",
   "title": "#동부산 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "rKtwWzC05LE",
   "views": 1791
  }
 ],
 "동원썬밸리CC": [
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-01-13",
   "title": "동원썬밸리 CC 썬코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wvd2heIwKQg",
   "views": 6073
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-01-13",
   "title": "동원썬밸리 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "VTNFNoW1OIQ",
   "views": 5587
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-08-26",
   "title": "#동원썬밸리 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "4Gujtuct7wE",
   "views": 2677
  }
 ],
 "동촌GC": [
  {
   "channel": "리보플TV",
   "likes": 130,
   "publishedAt": "2021-08-13",
   "title": "충주 동촌GC 동코스 공략",
   "videoId": "Bi8wKgc7fN0",
   "views": 29472
  },
  {
   "channel": "리보플TV",
   "likes": 106,
   "publishedAt": "2021-08-15",
   "title": "충주 동촌GC 서코스 공략",
   "videoId": "M6H2gzsLn-E",
   "views": 22419
  },
  {
   "channel": "밀떡아재",
   "likes": 43,
   "publishedAt": "2023-06-16",
   "title": "동촌CC / 동코스 \"코스레이아웃 최강의 충주골프장\"",
   "videoId": "orVWFVOAjuc",
   "views": 12453
  },
  {
   "channel": "밀떡아재",
   "likes": 38,
   "publishedAt": "2023-06-12",
   "title": "동촌CC / 서코스 \"코스는 정말 재미있는데...그린은 왜 이렇게 느린겨\"",
   "videoId": "fOkBMz8Dcvk",
   "views": 6685
  },
  {
   "channel": "맵가이더",
   "likes": 32,
   "publishedAt": "2024-09-28",
   "title": "동촌 GC 동코스. 라운드전 한번에 파악하기.",
   "videoId": "kslZyqxgYXk",
   "views": 5342
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-09-28",
   "title": "동촌 GC 서코스. 라운드전 한번에 파악하기.",
   "videoId": "_9FE9kR2i_o",
   "views": 3335
  }
 ],
 "동훈힐마루CC": [
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-11-28",
   "title": "동훈힐마루 CC 동코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "7u76N0qC0mg",
   "views": 6788
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-11-28",
   "title": "동훈힐마루 CC 서코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Lhl7aAm1mIA",
   "views": 4812
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-11-28",
   "title": "동훈힐마루 CC 북코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "PYiEkCbeB1g",
   "views": 4108
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-11-28",
   "title": "동훈힐마루 CC 남코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "cN23emSPKwQ",
   "views": 3420
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-08-27",
   "title": "#동훈힐마루 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "q49hwnfNBpk",
   "views": 3147
  }
 ],
 "드비치GC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-01",
   "title": "드비치 GC IN코스. 라운드전 한번에 파악하기.",
   "videoId": "HlwfD1dIjnE",
   "views": 1970
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2026-01-27",
   "title": "[골프] 드비치CC (2026.ver) IN 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "GUzHqav_Ngk",
   "views": 1689
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2026-01-27",
   "title": "[골프] 드비치CC (2026.ver) OUT 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "gdLGaZ87XOg",
   "views": 1227
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-10-01",
   "title": "드비치 GC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "XrJKtMXqxh8",
   "views": 1159
  }
 ],
 "디오션CC": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-12-15",
   "title": "디오션CC 이스트코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "-LtKT42cUsY",
   "views": 3234
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-09-07",
   "title": "#디오션 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf #홀인원 #holeinone #골린이",
   "videoId": "kGwqyLRTjV0",
   "views": 2869
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-12-15",
   "title": "디오션CC 웨스트코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "FnHlobMpdrY",
   "views": 2659
  }
 ],
 "떼제베 골프장(TGV CC)": [
  {
   "channel": "리보플TV",
   "likes": 59,
   "publishedAt": "2021-05-05",
   "title": "청주 떼제베cc 서코스 (구 힐링 In) 공략",
   "videoId": "4Jnvh0tYpeU",
   "views": 17206
  },
  {
   "channel": "리보플TV",
   "likes": 39,
   "publishedAt": "2021-05-03",
   "title": "청주 떼제베cc 동코스 (구 힐링 Out) 공략",
   "videoId": "5AT6DwGNMBI",
   "views": 10751
  }
 ],
 "라비돌CC": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-19",
   "title": "[골프] 라비돌CC OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "_x--c82wua0",
   "views": 3141
  }
 ],
 "라비에벨CC": [
  {
   "channel": "밀떡아재",
   "likes": 55,
   "publishedAt": "2021-12-29",
   "title": "[전백시]춘천 라비에벨CC 올드코스 캐디님 티박스설명",
   "videoId": "7WT1BPmoY5M",
   "views": 8567
  },
  {
   "channel": "리보플TV",
   "likes": 22,
   "publishedAt": "2023-09-25",
   "title": "춘천 라비에벨 올드 Out 코스 (1~9번) 5분 공략",
   "videoId": "PXmeuYo_w6s",
   "views": 3867
  },
  {
   "channel": "밀떡아재",
   "likes": 36,
   "publishedAt": "2022-09-15",
   "title": "[전백시]춘천 라비에벨CC/OUT코스",
   "videoId": "cc1gbwZ7pQA",
   "views": 2836
  },
  {
   "channel": "리보플TV",
   "likes": 16,
   "publishedAt": "2023-09-25",
   "title": "춘천 라비에벨 올드 In 코스 (10~18번) 5분 공략",
   "videoId": "u-8_is5aEns",
   "views": 2676
  },
  {
   "channel": "리보플TV",
   "likes": 3,
   "publishedAt": "2026-06-29",
   "title": "춘천 라비에벨 듄스 Out 코스 (1~9번) 5분 공략",
   "videoId": "TN74Z1-crS4",
   "views": 42
  },
  {
   "channel": "리보플TV",
   "likes": 1,
   "publishedAt": "2026-07-06",
   "title": "춘천 라비에벨 듄스 IN 코스 (10~18번) 5분 공략",
   "videoId": "W4ZEVKp3eqs",
   "views": 32
  }
 ],
 "라싸 GC": [
  {
   "channel": "리보플TV",
   "likes": 59,
   "publishedAt": "2023-09-04",
   "title": "포천 라싸GC 마운틴 코스 5분 공략",
   "videoId": "L4vIM5wsAIU",
   "views": 14719
  },
  {
   "channel": "리보플TV",
   "likes": 31,
   "publishedAt": "2023-08-28",
   "title": "포천 라싸GC 밸리코스 5분 공략",
   "videoId": "_NQp2_EKtHA",
   "views": 13040
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-09-25",
   "title": "라싸 GC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "p_peAVnfknY",
   "views": 6737
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-25",
   "title": "라싸 GC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "Y0kSTcmpd4Y",
   "views": 2825
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-25",
   "title": "라싸 GC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "-8OBYnx6Ehs",
   "views": 2798
  }
 ],
 "라온GC": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-12-15",
   "title": "라온CC 스톤코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Dis5xoirw5g",
   "views": 2427
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-12-15",
   "title": "라온CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "bKL8UD9-0XQ",
   "views": 2319
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-12-15",
   "title": "라온CC 파인코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "nLSdHribnFk",
   "views": 1433
  }
 ],
 "라헨느골프리조트": [
  {
   "channel": "리보플TV",
   "likes": 11,
   "publishedAt": "2024-11-30",
   "title": "제주 라헨느CC 레이크 코스 5분 공략",
   "videoId": "SrBgBMKaSWU",
   "views": 2806
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-09-09",
   "title": "#라헨느 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf #홀인원 #holeinone #골린이",
   "videoId": "0buJcrnLUhc",
   "views": 2788
  },
  {
   "channel": "리보플TV",
   "likes": 10,
   "publishedAt": "2024-11-12",
   "title": "제주 라헨느CC 오션코스 5분 공략",
   "videoId": "zVQe0oX6ihw",
   "views": 1552
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-10-15",
   "title": "라헨느 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "CsHrxp_FIPM",
   "views": 833
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-10-15",
   "title": "라헨느 CC 오션코스. 라운드전 한번에 파악하기.",
   "videoId": "oyN8GA2n6OY",
   "views": 810
  }
 ],
 "레이크사이드CC": [
  {
   "channel": "리보플TV",
   "likes": 67,
   "publishedAt": "2021-11-17",
   "title": "용인 레이크사이드CC 동코스 Out (1~9번) 공략",
   "videoId": "VwTrQJXBAhE",
   "views": 21915
  },
  {
   "channel": "리보플TV",
   "likes": 57,
   "publishedAt": "2021-11-18",
   "title": "용인 레이크사이드CC 동코스 In (10~18번) 코스 공략",
   "videoId": "32oh_VhKmro",
   "views": 15220
  },
  {
   "channel": "리보플TV",
   "likes": 45,
   "publishedAt": "2022-03-04",
   "title": "용인 레이크사이드CC 남코스 In (10~18번) 5분 공략",
   "videoId": "j--Gw4cA6Rc",
   "views": 14098
  },
  {
   "channel": "리보플TV",
   "likes": 30,
   "publishedAt": "2024-07-09",
   "title": "레이크사이드CC 남코스 Out (1~9번) 공략",
   "videoId": "ynAKIrpiLY8",
   "views": 8275
  }
 ],
 "레이크우드컨트리클럽": [
  {
   "channel": "리보플TV",
   "likes": 57,
   "publishedAt": "2021-07-08",
   "title": "양주 레이크우드cc 물길코스 공략",
   "videoId": "jwxO0sXBrfg",
   "views": 14852
  },
  {
   "channel": "리보플TV",
   "likes": 55,
   "publishedAt": "2021-07-08",
   "title": "양주 레이크우드cc 꽃길코스 공략",
   "videoId": "dbIm3j2ymsY",
   "views": 12833
  }
 ],
 "레인보우힐스CC": [
  {
   "channel": "밀떡아재",
   "likes": 54,
   "publishedAt": "2021-05-29",
   "title": "[전백시]레인보우힐스CC 남코스/최고의 캐디님 코스설명",
   "videoId": "64XYmHBSakI",
   "views": 21296
  },
  {
   "channel": "리보플TV",
   "likes": 85,
   "publishedAt": "2021-07-28",
   "title": "음성 레인보우힐스 서코스 공략",
   "videoId": "dqzLLNqqZes",
   "views": 20690
  },
  {
   "channel": "리보플TV",
   "likes": 85,
   "publishedAt": "2021-07-28",
   "title": "음성 레인보우힐스 남코스 공략",
   "videoId": "j2D32Jvyaf4",
   "views": 19155
  }
 ],
 "렉스필드CC": [
  {
   "channel": "리보플TV",
   "likes": 60,
   "publishedAt": "2022-10-03",
   "title": "곤지암 렉스필드CC 레이크 코스 5분 공략",
   "videoId": "UT6t7LgBKYM",
   "views": 19427
  },
  {
   "channel": "리보플TV",
   "likes": 65,
   "publishedAt": "2022-01-28",
   "title": "곤지암 렉스필드CC 밸리코스 5분 공략",
   "videoId": "Jdr3_U9EHbs",
   "views": 16079
  },
  {
   "channel": "리보플TV",
   "likes": 58,
   "publishedAt": "2022-01-15",
   "title": "곤지암 렉스필드CC 마운틴 코스 5분 공략",
   "videoId": "eldSENEPk2o",
   "views": 15693
  },
  {
   "channel": "밀떡아재",
   "likes": 27,
   "publishedAt": "2023-04-04",
   "title": "렉스필드 CC / 마운틴코스 \"곤지암 3대 회원제 골프장\"",
   "videoId": "HaEXo2MZbto",
   "views": 7049
  },
  {
   "channel": "밀떡아재",
   "likes": 22,
   "publishedAt": "2023-04-09",
   "title": "렉스필드 CC / 밸리코스 \"좌우 폭이 좁은 페어웨이\"",
   "videoId": "Pz1A3qvvasw",
   "views": 5116
  }
 ],
 "로드힐스CC": [
  {
   "channel": "밀떡아재",
   "likes": 45,
   "publishedAt": "2023-09-21",
   "title": "로드힐스CC / 레이크코스 \"코스 모르고 가면 눈뜨고 코베이는\"",
   "videoId": "cnjIO7pFjqw",
   "views": 13234
  },
  {
   "channel": "리보플TV",
   "likes": 38,
   "publishedAt": "2021-12-11",
   "title": "남춘천 로드힐스CC 로드코스 공략",
   "videoId": "KJcI-LEgwbc",
   "views": 9884
  },
  {
   "channel": "리보플TV",
   "likes": 24,
   "publishedAt": "2021-12-08",
   "title": "남춘천 로드힐스CC 힐스코스 공략",
   "videoId": "dO03pNMj4bA",
   "views": 7555
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-09-09",
   "title": "#로드힐스 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf #홀인원 #holeinone #골린이",
   "videoId": "g2ZoDZoEb7M",
   "views": 4117
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-05",
   "title": "로드힐스 GC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "RvJpVqBMFFs",
   "views": 2676
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-10-05",
   "title": "로드힐스 GC 로드코스. 라운드전 한번에 파악하기.",
   "videoId": "VFEmif-0zc4",
   "views": 2587
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-05",
   "title": "로드힐스 GC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "iyRGWkNF0HA",
   "views": 2476
  }
 ],
 "로얄링스 CC": [
  {
   "channel": "맵가이더",
   "likes": 27,
   "publishedAt": "2024-09-19",
   "title": "로얄링스 cc 퀸즈 IN코스. 라운드전 한번에 파악하기.",
   "videoId": "3wauAB5nLv0",
   "views": 6659
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-09-19",
   "title": "로얄링스 cc 킹스 IN코스. 라운드전 한번에 파악하기.",
   "videoId": "G0ZEpTbfC7E",
   "views": 3790
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-19",
   "title": "로얄링스 cc 퀸즈 OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "CKUT2lNnzgw",
   "views": 3567
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-19",
   "title": "로얄링스 cc 킹스 OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "9R9Ivs2XUs0",
   "views": 3432
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-09-10",
   "title": "#로얄링스 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf #홀인원 #holeinone #골린이",
   "videoId": "DYd-2Z8G_qU",
   "views": 2299
  }
 ],
 "로얄포레컨트리클럽": [
  {
   "channel": "밀떡아재",
   "likes": 60,
   "publishedAt": "2020-03-12",
   "title": "[전백시] 로얄포레 CC 로얄코스 / 초보 캐디에게 듣는 풋풋한 코스 설명 (Part 1)",
   "videoId": "3a3VpW60kbk",
   "views": 17341
  },
  {
   "channel": "밀떡아재",
   "likes": 39,
   "publishedAt": "2020-03-12",
   "title": "[전백시]로얄포레CC 포레코스 / 초보 캐디에게 듣는 풋풋한 코스 설명 (Part 2)",
   "videoId": "E6o9osGKONo",
   "views": 8978
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-09-29",
   "title": "로얄포레 cc 포레코스. 라운드전 한번에 파악하기.",
   "videoId": "e0ZKVUM009E",
   "views": 5847
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-09-29",
   "title": "로얄포레 cc 로얄코스. 라운드전 한번에 파악하기.",
   "videoId": "eOF0dLJpkxA",
   "views": 4588
  },
  {
   "channel": "밀떡아재",
   "likes": 30,
   "publishedAt": "2026-04-30",
   "title": "2026년 과연 \"올데이\"는 \"올데이\"이 할까? 1부 \"로얄포레CC / 로얄코스\"",
   "videoId": "3CD2ErLwLpM",
   "views": 3771
  },
  {
   "channel": "밀떡아재",
   "likes": 18,
   "publishedAt": "2026-05-04",
   "title": "7월까진 참으세요. 아직 로얄포레 갈 때가 아닙니다? \"로얄포레CC / 포레코스\"",
   "videoId": "X2dEMEdPjOA",
   "views": 2871
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-09-10",
   "title": "#로얄포레 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf #홀인원 #holeinone #골린이",
   "videoId": "vJ7aUuoE_b8",
   "views": 2672
  }
 ],
 "롯데스카이힐 제주C.C. (Lotte Sky Hill jeju)": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-05",
   "title": "롯데스카이힐 제주 CC 스카이코스. 라운드전 한번에 파악하기.",
   "videoId": "k5LvVMgIPKw",
   "views": 2856
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-10-05",
   "title": "롯데스카이힐 제주 CC 오션코스. 라운드전 한번에 파악하기.",
   "videoId": "kwlUBmjqLc0",
   "views": 2049
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-10-05",
   "title": "롯데스카이힐 제주 CC힐코스. 라운드전 한번에 파악하기.",
   "videoId": "MAshcXE-c2s",
   "views": 1922
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-10-05",
   "title": "롯데스카이힐 제주 CC 포레스트코스. 라운드전 한번에 파악하기.",
   "videoId": "yRe8an46lS8",
   "views": 1566
  }
 ],
 "롯데스카이힐CC": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-07-23",
   "title": "#롯데스카이힐 부여 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "vnuTF5PObyU",
   "views": 5485
  }
 ],
 "루트52컨트리클럽": [
  {
   "channel": "리보플TV",
   "likes": 74,
   "publishedAt": "2021-11-26",
   "title": "여주 루트52 A코스 (1~9번) 공략",
   "videoId": "KPrXVG6P8yw",
   "views": 20475
  },
  {
   "channel": "리보플TV",
   "likes": 61,
   "publishedAt": "2021-12-03",
   "title": "여주 루트52 B코스 (10~18번) 공략",
   "videoId": "Lx4QJrJ0-d4",
   "views": 11497
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-25",
   "title": "루트52 CC A코스. 라운드전 한번에 파악하기.",
   "videoId": "27OzM5kmtSs",
   "views": 5087
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-09-25",
   "title": "루트52 CC B코스. 라운드전 한번에 파악하기.",
   "videoId": "Xhoa5i4wgZU",
   "views": 4819
  }
 ],
 "리더스컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-10-14",
   "title": "리더스 CC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "tepKWZ3DOqo",
   "views": 5608
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-10-14",
   "title": "리더스 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "sxOlbtI_H_8",
   "views": 5133
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-10-14",
   "title": "리더스 CC 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "qVNL7VE8iCo",
   "views": 4991
  }
 ],
 "리베라CC": [
  {
   "channel": "밀떡아재",
   "likes": 26,
   "publishedAt": "2023-01-23",
   "title": "동탄 리베라CC / 파인힐코스",
   "videoId": "mjcbvbuIpAs",
   "views": 6288
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-10-01",
   "title": "리베라 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "xQF5QVgj_NI",
   "views": 4975
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-10-01",
   "title": "리베라 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "rai2S0Ce43c",
   "views": 3863
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-10-01",
   "title": "리베라 CC 체리코스. 라운드전 한번에 파악하기.",
   "videoId": "62kSsUjGpEA",
   "views": 3537
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-10-01",
   "title": "리베라 CC 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "8Jr3UOfYNz8",
   "views": 2349
  },
  {
   "channel": "리보플TV",
   "likes": 11,
   "publishedAt": "2026-02-23",
   "title": "화성 리베라CC 파인힐 코스 5분 공략",
   "videoId": "gZMbCHCsIrM",
   "views": 1906
  },
  {
   "channel": "리보플TV",
   "likes": 9,
   "publishedAt": "2026-03-02",
   "title": "화성 리베라CC 체리힐 코스 5분 공략",
   "videoId": "pU7HXeLddWk",
   "views": 1398
  }
 ],
 "링크나인 골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-09-28",
   "title": "링크나인 GC  OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "WImvLgBtpnM",
   "views": 3562
  }
 ],
 "마론뉴데이CC": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-12-15",
   "title": "마론뉴데이CC 비전코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ZZhBcBZKsSc",
   "views": 6271
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-12-15",
   "title": "마론뉴데이CC 드림코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "RoTrLnIlwLQ",
   "views": 5822
  }
 ],
 "마스터피스컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-10-11",
   "title": "마스터피스 CC 마스터코스. 라운드전 한번에 파악하기.",
   "videoId": "SYyAgd6_-ak",
   "views": 5532
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-10-11",
   "title": "마스터피스 CC 피스코스. 라운드전 한번에 파악하기.",
   "videoId": "KfF3HrCZAcc",
   "views": 4724
  }
 ],
 "마에스트로CC": [
  {
   "channel": "리보플TV",
   "likes": 58,
   "publishedAt": "2023-04-03",
   "title": "마에스트로CC 레이크코스 5분 공략",
   "videoId": "KihZB5NeIwg",
   "views": 11535
  },
  {
   "channel": "리보플TV",
   "likes": 56,
   "publishedAt": "2023-04-10",
   "title": "마에스트로CC 밸리코스 5분 공략",
   "videoId": "qo_PM1R8db8",
   "views": 10649
  }
 ],
 "마우나오션CC": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-01-14",
   "title": "마우나오션 CC 마우나코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "pnwXywnNyp8",
   "views": 3415
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-01-14",
   "title": "마우나오션 CC 오션코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "v44_fNLZYj0",
   "views": 2476
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-07-24",
   "title": "#마우나오션 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "13DCweOecVk",
   "views": 1942
  }
 ],
 "마이다스레이크이천 골프앤리조트": [
  {
   "channel": "리보플TV",
   "likes": 54,
   "publishedAt": "2022-04-22",
   "title": "마이다스 레이크 이천 G.C (구 이천 마이다스) 마이다스 코스 5분 공략",
   "videoId": "GKN-67UrsMY",
   "views": 14634
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-03-09",
   "title": "마이다스레이크 이천 CC 마이다스코스. 코스공략. 라운드전 한번에 파악하기",
   "videoId": "kWMQNQ1p8rY",
   "views": 3599
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-09",
   "title": "마이다스레이크 이천 CC 타이탄코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "uHpe98eIJmY",
   "views": 3297
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-09",
   "title": "마이다스레이크 이천 CC 올림푸스코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "0bdVNHN93j4",
   "views": 2932
  }
 ],
 "마이다스밸리 청평 GC": [
  {
   "channel": "리보플TV",
   "likes": 14,
   "publishedAt": "2025-01-27",
   "title": "마이다스밸리 청평 골프클럽 밸리 코스 5분 공략",
   "videoId": "1-QAyrjcJ-E",
   "views": 3610
  },
  {
   "channel": "리보플TV",
   "likes": 13,
   "publishedAt": "2025-01-20",
   "title": "마이다스밸리 청평 골프클립 마이다스 코스 5분 공략",
   "videoId": "SXT32zFmo5M",
   "views": 3202
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-03-09",
   "title": "마이다스밸리 청평 CC 마이다스코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "hDFDWhwB5vU",
   "views": 1757
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-03-09",
   "title": "마이다스밸리 청평 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "1ay-zleeCLY",
   "views": 1273
  }
 ],
 "메이플비치": [
  {
   "channel": "리보플TV",
   "likes": 41,
   "publishedAt": "2023-05-15",
   "title": "강릉 메이플비치 CC 비치코스 5분 공략",
   "videoId": "Uvjv92w1Dck",
   "views": 12616
  },
  {
   "channel": "리보플TV",
   "likes": 22,
   "publishedAt": "2023-05-22",
   "title": "강릉 메이플비치CC 메이플 코스 5분 공략",
   "videoId": "_Fxgzzb0LlQ",
   "views": 5523
  }
 ],
 "모나크CC": [
  {
   "channel": "밀떡아재",
   "likes": 98,
   "publishedAt": "2023-09-25",
   "title": "모나크CC/마운틴코스 \"비거리를 늘리고 정확도를 잃어버린 80돌이\"",
   "videoId": "aw1-F8-zU9s",
   "views": 27852
  },
  {
   "channel": "밀떡아재",
   "likes": 53,
   "publishedAt": "2023-09-27",
   "title": "모나크CC/그랜드코스 \"각성한 골퍼, 과연 평균비거리를 얼마나 늘릴 수 있을까?",
   "videoId": "pGmMyFWxMYg",
   "views": 14595
  }
 ],
 "몽베르CC": [
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-09-25",
   "title": "몽베르 CC 오똔코스. 라운드전 한번에 파악하기.",
   "videoId": "iMbCh3KuG2Y",
   "views": 4329
  },
  {
   "channel": "밀떡아재",
   "likes": 19,
   "publishedAt": "2026-06-24",
   "title": "환골탈태 골프장 \"몽베르CC / 망무봉 아웃코스\"",
   "videoId": "R7FfGst8_yA",
   "views": 3749
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-09-25",
   "title": "몽베르 CC 이베르코스. 라운드전 한번에 파악하기.",
   "videoId": "yNQbhnzH8GY",
   "views": 3688
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2024-09-25",
   "title": "몽베르 CC 브렝땅코스. 라운드전 한번에 파악하기.",
   "videoId": "OdI2tA2rH0k",
   "views": 3641
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-09-25",
   "title": "몽베르 CC 에떼코스. 라운드전 한번에 파악하기.",
   "videoId": "AzOjJEV7yVQ",
   "views": 2999
  },
  {
   "channel": "밀떡아재",
   "likes": 15,
   "publishedAt": "2026-06-29",
   "title": "자신있게 추천하는 골프장  \"몽베르CC / 망무봉 인코스\"",
   "videoId": "PNx5fgQktNE",
   "views": 1302
  }
 ],
 "무등산CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2026-01-30",
   "title": "[골프] 무등산CC (2026.ver) 인왕봉 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "UZ86uvR2f8Y",
   "views": 1800
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2026-01-30",
   "title": "[골프] 무등산CC (2026.ver) 지왕봉 코스 공략. 라운드전 한번에 파악하기.무등산 지왕봉 유튜브",
   "videoId": "OkDkC_a19ag",
   "views": 1563
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2026-01-30",
   "title": "[골프] 무등산CC (2026.ver) 천왕봉 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "c9Jbtu0x9Lw",
   "views": 1249
  }
 ],
 "무안CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-01-14",
   "title": "무안 CC 동A코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "srEXTpMQRRs",
   "views": 3210
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-01-14",
   "title": "무안 CC 동B코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "0mizTqGpRe4",
   "views": 1924
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-01-14",
   "title": "무안 CC 서A코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "aGdzLEnlHRk",
   "views": 1887
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-01-14",
   "title": "무안 CC 남A코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Ri8NB_t2SX0",
   "views": 1601
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-01-14",
   "title": "무안 CC 서B코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "VaxDreOF6Lg",
   "views": 1388
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-01-14",
   "title": "무안 CC 남B코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "2pCG80C4nUw",
   "views": 981
  }
 ],
 "무안클린밸리CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-14",
   "title": "무안클린밸리 CC 클린코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "rp-ImGAJ7rg",
   "views": 2707
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-14",
   "title": "무안클린밸리 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "JPDlIuMEdhY",
   "views": 2210
  }
 ],
 "무주덕유산CC": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-10-15",
   "title": "덕유산 CC IN코스. 라운드전 한번에 파악하기.",
   "videoId": "oMhyJRaasUQ",
   "views": 4650
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-15",
   "title": "덕유산 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "2sSPWMJg3Pk",
   "views": 2772
  }
 ],
 "문경GC": [
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-01-15",
   "title": "문경 CC 문희코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "l8-rXJNdM-4",
   "views": 4834
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-01-15",
   "title": "문경 CC 경서코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "65FfSkISk2I",
   "views": 3660
  }
 ],
 "밀양노벨CC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-26",
   "title": "밀양노벨 CC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "6H9cMs9N9Fg",
   "views": 4441
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-25",
   "title": "밀양노벨 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "4KU30p_00Ys",
   "views": 3902
  }
 ],
 "밀양에스파크컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-03-22",
   "title": "[골프] 에스파크CC(밀양) S코스공략. 라운드전 한번에 파악하기.",
   "videoId": "eFnjHjig2rE",
   "views": 4708
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-22",
   "title": "[골프] 에스파크CC(밀양) R코스공략. 라운드전 한번에 파악하기.",
   "videoId": "jh63-RjCQ-I",
   "views": 3550
  }
 ],
 "발리오스CC": [
  {
   "channel": "리보플TV",
   "likes": 43,
   "publishedAt": "2022-09-26",
   "title": "발리오스CC (구 발안CC) 남코스 5분 공략",
   "videoId": "7Gd3nAofE8g",
   "views": 13344
  },
  {
   "channel": "리보플TV",
   "likes": 31,
   "publishedAt": "2022-09-26",
   "title": "발리오스CC (구 발안CC) 동코스 5분 공략",
   "videoId": "eLvo87r2f04",
   "views": 11563
  },
  {
   "channel": "리보플TV",
   "likes": 34,
   "publishedAt": "2023-04-02",
   "title": "발리오스CC (구 발안CC) 서코스 5분 공략",
   "videoId": "-CJqSwdcnms",
   "views": 8548
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-15",
   "title": "발리오스 CC 서코스. 라운드전 한번에 파악하기.",
   "videoId": "YajLVrihZPA",
   "views": 2452
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-15",
   "title": "발리오스 CC 동코스. 라운드전 한번에 파악하기.",
   "videoId": "Ai2OOxMy-40",
   "views": 2070
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-10-15",
   "title": "발리오스 CC 남코스. 라운드전 한번에 파악하기.",
   "videoId": "HD5-d7eVD3Y",
   "views": 2060
  }
 ],
 "백양우리컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-16",
   "title": "백양우리 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "89RnZwownwg",
   "views": 2078
  }
 ],
 "백제컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2024-10-07",
   "title": "백제 CC 웅진코스. 라운드전 한번에 파악하기.",
   "videoId": "9wYCBJ0mGQo",
   "views": 7725
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2024-10-07",
   "title": "백제 CC 사비코스. 라운드전 한번에 파악하기.",
   "videoId": "kUFlzAQrPw8",
   "views": 6614
  },
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2024-10-07",
   "title": "백제 CC 한성코스. 라운드전 한번에 파악하기.",
   "videoId": "asS8kN5XxOY",
   "views": 6465
  }
 ],
 "버치힐CC": [
  {
   "channel": "밀떡아재",
   "likes": 48,
   "publishedAt": "2023-04-24",
   "title": "버치힐 GC / 힐코스 \"80돌이도 힘들게 하는 벙커지옥\"",
   "videoId": "xx2mf1Agxu8",
   "views": 7969
  },
  {
   "channel": "밀떡아재",
   "likes": 38,
   "publishedAt": "2023-04-28",
   "title": "버치힐 GC / 버치코스 \"구노쓰 이러다 90돌이 된다!\"",
   "videoId": "i4f1BMqFwYw",
   "views": 7898
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-01",
   "title": "버치힐 GC 버치코스. 라운드전 한번에 파악하기.",
   "videoId": "SYMbB9iJ644",
   "views": 1904
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-01",
   "title": "버치힐 GC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "1o1tDfDqH5Q",
   "views": 1817
  }
 ],
 "베뉴지CC": [
  {
   "channel": "밀떡아재",
   "likes": 74,
   "publishedAt": "2020-08-21",
   "title": "[전백시]베뉴지CC 힐코스 캐디코스설명",
   "videoId": "Vcqp60dypdg",
   "views": 25114
  },
  {
   "channel": "리보플TV",
   "likes": 65,
   "publishedAt": "2022-08-15",
   "title": "가평 베뉴지CC 힐코스 5분 공략",
   "videoId": "tPTLiq_ZVE0",
   "views": 19379
  },
  {
   "channel": "리보플TV",
   "likes": 54,
   "publishedAt": "2022-08-15",
   "title": "가평 베뉴지CC G코스 5분 공략",
   "videoId": "1_LhmtU2UfU",
   "views": 14825
  },
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2024-10-03",
   "title": "베뉴지 CC 휴코스. 라운드전 한번에 파악하기.",
   "videoId": "YoN-pRLZhLQ",
   "views": 5396
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-03",
   "title": "베뉴지 CC 지코스. 라운드전 한번에 파악하기.",
   "videoId": "NE2uMTo6vIo",
   "views": 3267
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-03",
   "title": "베뉴지 CC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "783xQNTzBwU",
   "views": 2688
  }
 ],
 "베스트밸리GC": [
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-09-25",
   "title": "베스트밸리 GC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "bQklaiYzLLk",
   "views": 4322
  },
  {
   "channel": "밀떡아재",
   "likes": 20,
   "publishedAt": "2025-09-05",
   "title": "베스트밸리CC 캐디님 코스설명#베스트밸리CC#9홀골프장#코스설명",
   "videoId": "GxqZP8R5d4Y",
   "views": 3470
  }
 ],
 "베어즈베스트청라GC": [
  {
   "channel": "리보플TV",
   "likes": 57,
   "publishedAt": "2021-07-22",
   "title": "인천 베어즈베스트청라 GC 미국코스 공략",
   "videoId": "Dcuw_94YyUg",
   "views": 15935
  },
  {
   "channel": "리보플TV",
   "likes": 50,
   "publishedAt": "2021-07-22",
   "title": "인천 베어즈베스트청라 GC 오스트랄아시아 코스 공략",
   "videoId": "UtHlIWFRX0E",
   "views": 12189
  }
 ],
 "베어크리크G.C": [
  {
   "channel": "밀떡아재",
   "likes": 78,
   "publishedAt": "2020-06-16",
   "title": "[전백시]베어크리크 CC 캐디가 직접 설명해 주는 베어코스 설명 Part. 1 / 근데 서브 캐디님께서 내 채널을 안다구?",
   "videoId": "KZVJ5rpWepM",
   "views": 15412
  },
  {
   "channel": "리보플TV",
   "likes": 73,
   "publishedAt": "2022-07-11",
   "title": "베어크리크 포천 베어코스 Out (1~9번) 5분 공략",
   "videoId": "YSEig562zBk",
   "views": 13635
  },
  {
   "channel": "리보플TV",
   "likes": 68,
   "publishedAt": "2022-07-11",
   "title": "베어크리크 포천 베어코스 In (10~18번) 5분 공략",
   "videoId": "139z0iX0Pl4",
   "views": 11842
  },
  {
   "channel": "밀떡아재",
   "likes": 35,
   "publishedAt": "2020-06-19",
   "title": "[전백시]포천 베어크리크CC 캐디님의 베어코스 후반 설명. Part. 2",
   "videoId": "0oql3ft0ROc",
   "views": 6255
  },
  {
   "channel": "밀떡아재",
   "likes": 25,
   "publishedAt": "2024-01-19",
   "title": "\"역시 포천 1등 골프장\" 베어크리크 포천 CC / 크리크아웃코스",
   "videoId": "gGnLmhk6miQ",
   "views": 5607
  },
  {
   "channel": "리보플TV",
   "likes": 20,
   "publishedAt": "2025-06-30",
   "title": "포천 베어크리크GC 크리크 Out코스 (1~9번) 5분 공략",
   "videoId": "HiBmHa14NxE",
   "views": 2956
  },
  {
   "channel": "리보플TV",
   "likes": 14,
   "publishedAt": "2025-07-07",
   "title": "포천 베어크리크GC 크리크 In코스 (10~18번) 5분 공략",
   "videoId": "mu7OsDQjXaU",
   "views": 2805
  },
  {
   "channel": "밀떡아재",
   "likes": 17,
   "publishedAt": "2024-01-15",
   "title": "\"겨울골프는 날씨와의 눈치싸움\" 베어크리크 포천 CC / 크리크인코스",
   "videoId": "qMbLxDEnE18",
   "views": 1897
  }
 ],
 "베어크리크GC 춘천": [
  {
   "channel": "리보플TV",
   "likes": 50,
   "publishedAt": "2021-09-27",
   "title": "베어크리크 춘천 Out 코스 (1~9번홀) 공략",
   "videoId": "UE1guOc8tgs",
   "views": 10944
  },
  {
   "channel": "리보플TV",
   "likes": 49,
   "publishedAt": "2021-09-26",
   "title": "베어크리크 춘천 In코스 (10~18번홀) 공략",
   "videoId": "nv51w3RslX4",
   "views": 7425
  }
 ],
 "베이스타즈CC": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-17",
   "title": "베이스타즈cc BAY(베이)코스. 라운드전 한번에 파악하기.",
   "videoId": "f67V9GIZx7c",
   "views": 4120
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-09-17",
   "title": "베이스타즈cc STARS(스타즈)코스. 라운드전 한번에 파악하기.",
   "videoId": "eVNYHvncQGw",
   "views": 3465
  }
 ],
 "벨라 45 CC": [
  {
   "channel": "리보플TV",
   "likes": 28,
   "publishedAt": "2025-02-24",
   "title": "벨라45 마스터즈 D코스 5분 공략",
   "videoId": "2hGKEjkHOvg",
   "views": 6967
  },
  {
   "channel": "리보플TV",
   "likes": 17,
   "publishedAt": "2025-02-17",
   "title": "벨라45 마스터즈 C코스 5분 공략",
   "videoId": "uJOtnSHuIyE",
   "views": 5390
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2026-02-10",
   "title": "[골프] 벨라45 CC (2026.ver) 마스터E 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "ehyEm5FzNUs",
   "views": 2395
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2026-02-10",
   "title": "[골프] 벨라45 CC (2026.ver) 마스터C 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "7nWnRNPAWJg",
   "views": 2281
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2026-02-10",
   "title": "[골프] 벨라45 CC (2026.ver) 오너스A 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "DP7_OLwVx4Y",
   "views": 2261
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2026-02-10",
   "title": "[골프] 벨라45 CC (2026.ver) 마스터D 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "s7rkI_AbQzE",
   "views": 1883
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2026-02-10",
   "title": "[골프] 벨라45 CC (2026.ver) 오너스B 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "Zif03eK-1Nw",
   "views": 1839
  }
 ],
 "벨라스톤 CC": [
  {
   "channel": "리보플TV",
   "likes": 125,
   "publishedAt": "2021-10-06",
   "title": "횡성 벨라스톤CC 스톤코스 (1~9번) 공략",
   "videoId": "G6NHARIqDnU",
   "views": 31189
  },
  {
   "channel": "리보플TV",
   "likes": 67,
   "publishedAt": "2021-10-13",
   "title": "횡성 벨라스톤CC 벨라코스 (10~18번) 공략",
   "videoId": "FzIT2Xs5838",
   "views": 17224
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-12-15",
   "title": "벨라스톤CC 벨라코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "jN5F19TDD8k",
   "views": 4032
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-12-15",
   "title": "벨라스톤CC 스톤코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "g6ISmabWOUA",
   "views": 3112
  }
 ],
 "보라컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2024-10-29",
   "title": "보라 CC 헨리코스. 라운드전 한번에 파악하기.",
   "videoId": "_PF3xeupA6Q",
   "views": 4891
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-29",
   "title": "보라 CC 윌리엄코스. 라운드전 한번에 파악하기.",
   "videoId": "1JdVr-03n_4",
   "views": 3276
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-29",
   "title": "보라 CC 애드워드코스. 라운드전 한번에 파악하기.",
   "videoId": "sGzL_k53o3c",
   "views": 3027
  }
 ],
 "보령베이스CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-09-20",
   "title": "보령베이스 cc OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "Upts7fniIDA",
   "views": 3679
  }
 ],
 "보문골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2025-01-15",
   "title": "보문 CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "h5DjB10wtZc",
   "views": 6510
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-01-15",
   "title": "보문 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "xU30lJx47dA",
   "views": 5092
  }
 ],
 "보성CC": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-01-15",
   "title": "보성 CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "99Yy_H0qaRs",
   "views": 3960
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-01-15",
   "title": "보성 CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "u043dGFU0Sk",
   "views": 3094
  }
 ],
 "볼카노골프앤리조트 CC": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-01-15",
   "title": "볼카노 CC 에메랄드코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "FLYxm8-ICE8",
   "views": 2618
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-01-15",
   "title": "볼카노 CC 토파즈코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "LEc8du3yS9E",
   "views": 1843
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2025-01-15",
   "title": "볼카노 CC 아쿠아마린코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Zw49IRl0kdQ",
   "views": 1512
  }
 ],
 "부산컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-16",
   "title": "부산 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "f6LHnKhzkOs",
   "views": 4117
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-16",
   "title": "부산 CC IN코스. 라운드전 한번에 파악하기.",
   "videoId": "mK8egjCCqVw",
   "views": 2813
  }
 ],
 "블랙밸리CC": [
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-09-25",
   "title": "블랙밸리 CC 블랙코스. 라운드전 한번에 파악하기.",
   "videoId": "dGnfv41aHWM",
   "views": 5297
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-09-25",
   "title": "블랙밸리 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "57p4VtJ00AA",
   "views": 3838
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-07-20",
   "title": "블랙밸리cc #golf #골프스윙 #골프장 #골프연습 #아이언스윙 #드라이브",
   "videoId": "SHcm8B4Nk2w",
   "views": 3135
  }
 ],
 "블랙스톤 벨포레CC": [
  {
   "channel": "맵가이더",
   "likes": 36,
   "publishedAt": "2025-01-17",
   "title": "블랙스톤벨포레 CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wUH4hyTeKTE",
   "views": 7353
  },
  {
   "channel": "맵가이더",
   "likes": 28,
   "publishedAt": "2025-01-17",
   "title": "블랙스톤벨포레 CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "149JQKbZRhM",
   "views": 5325
  }
 ],
 "블랙스톤CC": [
  {
   "channel": "리보플TV",
   "likes": 50,
   "publishedAt": "2021-05-22",
   "title": "이천 블랙스톤 서코스 공략",
   "videoId": "GumavbMCOCI",
   "views": 10893
  },
  {
   "channel": "리보플TV",
   "likes": 59,
   "publishedAt": "2021-05-23",
   "title": "이천 블랙스톤 동코스 공략",
   "videoId": "5W0jem8oZ2c",
   "views": 8745
  }
 ],
 "블랙스톤이천GC": [
  {
   "channel": "밀떡아재",
   "likes": 54,
   "publishedAt": "2022-04-09",
   "title": "블랙스톤 이천 CC / 동코스",
   "videoId": "Ew-cjQFVMmI",
   "views": 18377
  },
  {
   "channel": "밀떡아재",
   "likes": 45,
   "publishedAt": "2022-04-13",
   "title": "블랙스톤 이천 CC / 북코스",
   "videoId": "gN0m5EbLDVE",
   "views": 13677
  },
  {
   "channel": "리보플TV",
   "likes": 32,
   "publishedAt": "2023-04-17",
   "title": "블랙스톤 이천 북코스 5분 공략",
   "videoId": "3NJ2eBcku90",
   "views": 8039
  },
  {
   "channel": "리보플TV",
   "likes": 22,
   "publishedAt": "2023-04-24",
   "title": "블랙스톤이천 서코스 5분 공략 (재업)",
   "videoId": "jZBwDM5Ga5o",
   "views": 3245
  }
 ],
 "블루원 용인CC": [
  {
   "channel": "맵가이더",
   "likes": 35,
   "publishedAt": "2024-09-20",
   "title": "블루원 용인 cc WEST(서)코스. 라운드전 한번에 파악하기.",
   "videoId": "jfgBxJhQvsU",
   "views": 7317
  },
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2024-09-20",
   "title": "블루원 용인 cc EAST(동)코스. 라운드전 한번에 파악하기.",
   "videoId": "oCH5fd2oPBg",
   "views": 5385
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-10-30",
   "title": "블루원용인 cc MIDDLE(중앙)코스. 라운드전 한번에 파악하기.",
   "videoId": "EYrIpDWXEAY",
   "views": 5100
  }
 ],
 "블루원상주CC": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-01-17",
   "title": "블루원상주 CC 동코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "CZJf4nPOww8",
   "views": 4681
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-01-17",
   "title": "블루원상주 CC 서코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wjkf6nEllqA",
   "views": 3911
  }
 ],
 "비콘힐스골프클럽": [
  {
   "channel": "밀떡아재",
   "likes": 63,
   "publishedAt": "2022-05-10",
   "title": "비콘힐스CC / 하늘코스",
   "videoId": "ysEVqgVsYbA",
   "views": 17997
  },
  {
   "channel": "밀떡아재",
   "likes": 56,
   "publishedAt": "2022-05-14",
   "title": "비콘힐스CC / 누리코스",
   "videoId": "FZ7rJhM4flE",
   "views": 11136
  },
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2024-10-07",
   "title": "비콘힐스 CC 하늘코스. 라운드전 한번에 파악하기.",
   "videoId": "FgkSBpCaM1s",
   "views": 7337
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-10-07",
   "title": "비콘힐스 CC 누리코스. 라운드전 한번에 파악하기.",
   "videoId": "zxKQcxOryT8",
   "views": 4651
  },
  {
   "channel": "밀떡아재",
   "likes": 10,
   "publishedAt": "2025-10-13",
   "title": "라베 도전이 가능한 골프장 비콘힐스CC / 하늘코스 #비콘힐스#하늘코스#강원도골프장",
   "videoId": "iZWquQ73bPQ",
   "views": 2912
  },
  {
   "channel": "밀떡아재",
   "likes": 15,
   "publishedAt": "2025-10-14",
   "title": "요즘 스코어가 안나온다면 여기로 가보세요. 비콘힐스 CC / 누리코스 #비콘힐스CC#누리코스#라베가능",
   "videoId": "PYwhhGxjl9M",
   "views": 2517
  }
 ],
 "빅토리아CC": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-07",
   "title": "빅토리아 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "1KikP4ZALxU",
   "views": 3143
  }
 ],
 "빛고을CC": [
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-01-18",
   "title": "빛고을 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "aW1oyLBo9tE",
   "views": 1389
  }
 ],
 "사우스스프링스CC": [
  {
   "channel": "밀떡아재",
   "likes": 30,
   "publishedAt": "2021-10-22",
   "title": "[전백시]사우스스프링스CC / 마운틴코스",
   "videoId": "Fx9YGHX5nQE",
   "views": 6672
  },
  {
   "channel": "밀떡아재",
   "likes": 27,
   "publishedAt": "2021-10-19",
   "title": "[전백시]사우스스프링스CC / 레이크코스",
   "videoId": "oBD34rubQEo",
   "views": 5771
  },
  {
   "channel": "리보플TV",
   "likes": 19,
   "publishedAt": "2021-12-16",
   "title": "[3분 공략] 이천 사우스스프링스CC 마운틴코스 (영상으로 보는 야디지북)",
   "videoId": "RHvbBbR9ItE",
   "views": 3723
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-03-18",
   "title": "[골프] 사우스스프링스CC 레이크코스공략. 라운드전 한번에 파악하기",
   "videoId": "-t4u38bQllI",
   "views": 3496
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-03-18",
   "title": "[골프] 사우스스프링스CC 마운틴코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ZRIf3rc7qz0",
   "views": 2979
  },
  {
   "channel": "리보플TV",
   "likes": 11,
   "publishedAt": "2021-12-23",
   "title": "[3분 공략] 이천 사우스스프링스CC 레이크 코스 (영상으로 보는 야디지북)",
   "videoId": "-O9IURZ3-3U",
   "views": 1978
  }
 ],
 "삼삼컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-09-22",
   "title": "삼삼cc OUT 코스. 라운드전 한번에 파악하기.",
   "videoId": "QzVfJfflhIE",
   "views": 2750
  }
 ],
 "샌드파인GC": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-17",
   "title": "샌드파인 CC IN코스. 라운드전 한번에 파악하기.",
   "videoId": "Nn3ZXUpX8h0",
   "views": 3723
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-10-17",
   "title": "샌드파인 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "S8qA-erUtQA",
   "views": 2514
  },
  {
   "channel": "리보플TV",
   "likes": 4,
   "publishedAt": "2026-01-26",
   "title": "강릉 샌드파인GC In코스 (10~18번) 5분 공략",
   "videoId": "ynAgLFnaMZw",
   "views": 833
  },
  {
   "channel": "리보플TV",
   "likes": 5,
   "publishedAt": "2026-01-19",
   "title": "강른 샌드파인 GC Out 코스 (1~9번) 5분 공략",
   "videoId": "x9h2GA2HQxw",
   "views": 505
  }
 ],
 "샤인데일골프리조트": [
  {
   "channel": "리보플TV",
   "likes": 95,
   "publishedAt": "2021-05-28",
   "title": "홍천 샤인데일cc 샤인코스 공략",
   "videoId": "A3LTEt8RRMI",
   "views": 24948
  },
  {
   "channel": "밀떡아재",
   "likes": 75,
   "publishedAt": "2020-05-31",
   "title": "[전백시]샤인데일CC / 김영호 캐디님과 함께 하는 데일코스 완전정복",
   "videoId": "zMfAiGgLlQg",
   "views": 19767
  },
  {
   "channel": "리보플TV",
   "likes": 79,
   "publishedAt": "2021-06-02",
   "title": "홍천 샤인데일cc 레이크코스 공략",
   "videoId": "2NBXz640caA",
   "views": 16324
  },
  {
   "channel": "리보플TV",
   "likes": 54,
   "publishedAt": "2022-11-07",
   "title": "홍천 샤인데일CC 데일코스 5분 공략",
   "videoId": "WkAZqYylUSQ",
   "views": 13841
  },
  {
   "channel": "밀떡아재",
   "likes": 47,
   "publishedAt": "2020-06-03",
   "title": "[전백시]샤인데일CC 최고 전장... 열정과 패기의 김영호 캐디의 설명으로 직접 듣는 샤인코스 완전정복!!!",
   "videoId": "GAiac3PKbLQ",
   "views": 13408
  },
  {
   "channel": "밀떡아재",
   "likes": 44,
   "publishedAt": "2024-06-03",
   "title": "샤인데일CC/레이크코스 \"짜증나게 어렵다\"",
   "videoId": "A1YxQh1hAmU",
   "views": 10178
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-01-19",
   "title": "샤인데일 CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "uMiajVZdAB0",
   "views": 4687
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-01-19",
   "title": "샤인데일 CC 샤인코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "L8Zn_SREK8Q",
   "views": 4095
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-01-19",
   "title": "샤인데일 CC 데일코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "t_-y_wK3EMQ",
   "views": 3767
  }
 ],
 "샴발라CC": [
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-10-30",
   "title": "샴발라 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "LdD-B7PmqAU",
   "views": 5420
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2024-10-30",
   "title": "샴발라 CC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "HB_SP1TXI8s",
   "views": 5106
  }
 ],
 "서경타니CC": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-03-14",
   "title": "서경 타니 CC 주작코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "PW6IJgcxnTc",
   "views": 4124
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-03-14",
   "title": "서경 타니 CC 현무코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "NF2MALBNNJA",
   "views": 3081
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-03-14",
   "title": "서경 타니 CC 청룡코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "jLe1HmcwKyA",
   "views": 2459
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-14",
   "title": "서경 타니 CC 백호코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Uw_fOO3eSuM",
   "views": 2126
  }
 ],
 "서산수컨트리클럽": [
  {
   "channel": "밀떡아재",
   "likes": 43,
   "publishedAt": "2023-12-08",
   "title": "서산수CC/산수코스 \"산수코스는 매우 재미있던데\"",
   "videoId": "x5r5pxhlaXw",
   "views": 9768
  },
  {
   "channel": "밀떡아재",
   "likes": 39,
   "publishedAt": "2023-12-03",
   "title": "서산수CC/서산코스 \"국찌니형 여기 좋은 골프장 아니었어?",
   "videoId": "Quu9-bL_EAw",
   "views": 6430
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-10-29",
   "title": "서산수 CC 산수코스. 라운드전 한번에 파악하기.",
   "videoId": "-oQ2E4q2_4k",
   "views": 4910
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-10-29",
   "title": "서산수 CC 서산코스. 라운드전 한번에 파악하기.",
   "videoId": "yYg_Z_8Qzwc",
   "views": 3432
  }
 ],
 "서서울CC": [
  {
   "channel": "밀떡아재",
   "likes": 70,
   "publishedAt": "2020-04-11",
   "title": "[전지적백돌이시점]서서울CC 레이크코스 / 현직 캐디의 생생한 코스 설명(1)",
   "videoId": "UGn9BlOy4i8",
   "views": 24970
  },
  {
   "channel": "밀떡아재",
   "likes": 52,
   "publishedAt": "2020-04-10",
   "title": "[전지적백돌이시점] 서서울CC 힐코스 현직 캐디의 생생한 코스설명(2)",
   "videoId": "_O8My53mC9g",
   "views": 15161
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-09-15",
   "title": "서서울cc HILL(힐)코스. 라운드전 한번에 파악하기.",
   "videoId": "7xZZ-JP6I94",
   "views": 6152
  },
  {
   "channel": "맵가이더",
   "likes": 27,
   "publishedAt": "2024-09-15",
   "title": "서서울cc LAKE(레이크)코스. 라운드전 한번에 파악하기.",
   "videoId": "dkpUhFwMNiY",
   "views": 6048
  }
 ],
 "서원밸리CC": [
  {
   "channel": "리보플TV",
   "likes": 41,
   "publishedAt": "2022-06-20",
   "title": "파주 서원밸리CC 밸리코스 5분 공략",
   "videoId": "c4rUVdd1q_Y",
   "views": 9669
  },
  {
   "channel": "리보플TV",
   "likes": 36,
   "publishedAt": "2022-06-20",
   "title": "파주 서원밸리CC 서원코스 5분 공략",
   "videoId": "wcJZ2kHVlac",
   "views": 7894
  }
 ],
 "서원힐스CC": [
  {
   "channel": "리보플TV",
   "likes": 26,
   "publishedAt": "2024-07-29",
   "title": "파주 서원힐스 CC 이스트 코스 5분 공략",
   "videoId": "_hAOGSaaPZA",
   "views": 11239
  }
 ],
 "석정힐CC": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-21",
   "title": "석정힐cc 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "dRXHYoTZdjI",
   "views": 4858
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-21",
   "title": "석정힐cc 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "4GF4Wd10-QA",
   "views": 4172
  }
 ],
 "선리치GC": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-10-30",
   "title": "선리치 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "m5OPa8UB9Y0",
   "views": 1967
  }
 ],
 "설악썬밸리CC": [
  {
   "channel": "밀떡아재",
   "likes": 26,
   "publishedAt": "2025-05-31",
   "title": "설악썬밸리CC/썬코스 \"가장 재미있는 코스레이아웃\"",
   "videoId": "707DEGt9Kxo",
   "views": 3344
  },
  {
   "channel": "밀떡아재",
   "likes": 20,
   "publishedAt": "2025-05-23",
   "title": "설악썬밸리CC/설악코스 \"장타자 친화 코스\"",
   "videoId": "b4ZpnB-PZ1o",
   "views": 3236
  },
  {
   "channel": "밀떡아재",
   "likes": 24,
   "publishedAt": "2025-05-18",
   "title": "설악썬밸리CC/밸리코스 \"90돌이에겐 어렵지 않은 코스 하지만...골프장 상태가 왜 이런거지?",
   "videoId": "MZyDMfCBvz8",
   "views": 2447
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-21",
   "title": "설악썬밸리cc 썬코스. 라운드전 한번에 파악하기.",
   "videoId": "MPOeXK7FSSI",
   "views": 2146
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-09-21",
   "title": "설악썬밸리cc 설악코스. 라운드전 한번에 파악하기.",
   "videoId": "5Ml4TvY3U7E",
   "views": 1921
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-09-21",
   "title": "설악썬밸리cc 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "bLmPKmYQ4RI",
   "views": 1485
  }
 ],
 "설해원": [
  {
   "channel": "밀떡아재",
   "likes": 40,
   "publishedAt": "2022-10-07",
   "title": "[전백시]양탄자위를 걷는 느낌의 골프장 \"설해원GC\" 레전드 아웃코스",
   "videoId": "R5_Jgi6yiC4",
   "views": 6023
  }
 ],
 "성문안 컨트리클럽": [
  {
   "channel": "밀떡아재",
   "likes": 46,
   "publishedAt": "2023-04-13",
   "title": "성문안 CC / 인코스 \"그린피31만원\" 그런데 왜 돈이 안아깝지?",
   "videoId": "64fbsCrz_5g",
   "views": 9676
  },
  {
   "channel": "밀떡아재",
   "likes": 31,
   "publishedAt": "2023-04-18",
   "title": "성문안 CC / 아웃코스 \"재방문 의사 100%\" 프리미엄 퍼블릭 골프장",
   "videoId": "-SXsz5TIiu8",
   "views": 4863
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-11-28",
   "title": "성문안 CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "trnPHRjdIbA",
   "views": 1919
  },
  {
   "channel": "리보플TV",
   "likes": 7,
   "publishedAt": "2025-06-16",
   "title": "원주 성문안cc OUT 코스 (1~9번) 5분 공략",
   "videoId": "awnKteH7VoE",
   "views": 1856
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-11-28",
   "title": "성문안 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "lxNKSObAtcc",
   "views": 1531
  },
  {
   "channel": "리보플TV",
   "likes": 5,
   "publishedAt": "2025-06-23",
   "title": "원주에 위치한 성문안cc IN 코스 (10~18번) 5분 공략 입니다",
   "videoId": "ue0jN95_xTs",
   "views": 495
  }
 ],
 "세라지오CC": [
  {
   "channel": "리보플TV",
   "likes": 89,
   "publishedAt": "2021-10-17",
   "title": "여주 세라지오GC 세라코스 공략",
   "videoId": "Dnf6L9RzDAU",
   "views": 20521
  },
  {
   "channel": "리보플TV",
   "likes": 87,
   "publishedAt": "2021-10-20",
   "title": "여주 세라지오GC 지오코스 (10~18번) 공략",
   "videoId": "jFFMORDglAs",
   "views": 17308
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-01-19",
   "title": "세라지오 GC 세라코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "fNQ68WqtZAM",
   "views": 3125
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-01-19",
   "title": "세라지오 GC 지오코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "uFweOb_PmQY",
   "views": 2635
  }
 ],
 "세레니티CC": [
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2025-01-22",
   "title": "세레니티 CC(구.실크리버) 블루코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "UWu4F8Nh3Vc",
   "views": 6663
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-01-22",
   "title": "세레니티 CC(구.실크리버) 리버코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "aM-vGF8V0ow",
   "views": 4891
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-01-22",
   "title": "세레니티 CC(구.실크리버) 실크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "b2z_8HJjMrE",
   "views": 4777
  }
 ],
 "세븐밸리CC": [
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2024-12-15",
   "title": "세븐밸리CC 세븐코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "92-A1bwrRFI",
   "views": 7188
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-12-15",
   "title": "세븐밸리CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "x9XPaWEyKZ4",
   "views": 4972
  }
 ],
 "세이지우드CC 홍천": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-01-23",
   "title": "세이지우드 홍천 CC 드림코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "tPCKbVnAKdQ",
   "views": 3066
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-01-23",
   "title": "세이지우드 홍천 CC 비전코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Q06GXkmnxV8",
   "views": 2432
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-01-23",
   "title": "세이지우드 홍천 CC 챌린지코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Y1W2dytse0I",
   "views": 1797
  }
 ],
 "세종레이캐슬CC": [
  {
   "channel": "리보플TV",
   "likes": 73,
   "publishedAt": "2021-07-01",
   "title": "세종 레이캐슬CC 세종코스 공략",
   "videoId": "x90OAJVOENA",
   "views": 19396
  },
  {
   "channel": "리보플TV",
   "likes": 87,
   "publishedAt": "2021-07-03",
   "title": "세종 레이캐슬CC 레이코스 공략",
   "videoId": "BKxZpDqE9Z4",
   "views": 17207
  },
  {
   "channel": "리보플TV",
   "likes": 55,
   "publishedAt": "2022-04-04",
   "title": "세종 레이캐슬 CC 캐슬코스 5분 공략",
   "videoId": "dNK518Pz75Q",
   "views": 15253
  },
  {
   "channel": "밀떡아재",
   "likes": 56,
   "publishedAt": "2022-07-05",
   "title": "[전백시]세종레이캐슬CC/세종코스",
   "videoId": "mmsb2kNNRcY",
   "views": 11565
  },
  {
   "channel": "밀떡아재",
   "likes": 35,
   "publishedAt": "2022-07-09",
   "title": "[전백시]세종레이캐슬CC/레이코스",
   "videoId": "NUv2z4aNfXM",
   "views": 7595
  },
  {
   "channel": "밀떡아재",
   "likes": 11,
   "publishedAt": "2025-08-27",
   "title": "세종레이캐슬CC 1~9홀 #세종레이코스CC#코스영상#코스설명",
   "videoId": "6lklF9htptw",
   "views": 2210
  }
 ],
 "세종에머슨컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-17",
   "title": "세종에머슨 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "Ek-xFm499Wo",
   "views": 3822
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-10-17",
   "title": "세종에머슨 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "X56mtp_RdtU",
   "views": 3491
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-10-17",
   "title": "세종에머슨 CC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "j3TF8dazdS0",
   "views": 3480
  }
 ],
 "세종필드골프클럽": [
  {
   "channel": "리보플TV",
   "likes": 76,
   "publishedAt": "2021-06-21",
   "title": "세종필드GC 세종코스 공략",
   "videoId": "wCRGe1TxBnY",
   "views": 18657
  },
  {
   "channel": "리보플TV",
   "likes": 62,
   "publishedAt": "2021-06-24",
   "title": "세종필드GC 행복코스 공략",
   "videoId": "b0IFVCrZo6Y",
   "views": 12870
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-09-20",
   "title": "세종필드 GC 세종코스. 라운드전 한번에 파악하기.",
   "videoId": "bYDwlUp6WbM",
   "views": 3517
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-09-20",
   "title": "세종필드 GC 행복코스. 라운드전 한번에 파악하기.",
   "videoId": "8Jiqh4unFY0",
   "views": 1839
  }
 ],
 "세현CC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-01-23",
   "title": "세현 CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "-8oY3cswVD4",
   "views": 8177
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2025-01-23",
   "title": "세현 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "WNM92UwXmpA",
   "views": 6744
  },
  {
   "channel": "리보플TV",
   "likes": 2,
   "publishedAt": "2026-07-27",
   "title": "용인 세현CC 밸리코스 5분 공략",
   "videoId": "-itkBzIs0xk",
   "views": 54
  }
 ],
 "센추리21CC": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-09-11",
   "title": "센추리21 cc 레이크 코스. 라운드전 한번에 파악하기.",
   "videoId": "5CNsx_N-38g",
   "views": 5985
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-09-11",
   "title": "센추리21 cc 파인 코스. 라운드전 한번에 파악하기.",
   "videoId": "kJXMoJsNdO0",
   "views": 4316
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-09-11",
   "title": "센추리21 cc 마운틴 코스. 라운드전 한번에 파악하기.",
   "videoId": "yYQZtTHHLJ4",
   "views": 3773
  },
  {
   "channel": "리보플TV",
   "likes": 17,
   "publishedAt": "2025-08-04",
   "title": "원주 센추리21 밸리 코스 5분 공략",
   "videoId": "tmYr4dPmUCA",
   "views": 2949
  },
  {
   "channel": "리보플TV",
   "likes": 21,
   "publishedAt": "2025-08-11",
   "title": "원주 센추리21 필드 코스 5분 공략",
   "videoId": "5z5_0X0RGWU",
   "views": 2908
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-11",
   "title": "센추리21 cc 밸리 코스. 라운드전 한번에 파악하기.",
   "videoId": "qxR9VFlIAe0",
   "views": 2729
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-09-11",
   "title": "센추리21 cc 필드 코스. 라운드전 한번에 파악하기.",
   "videoId": "BwYytkwrSg8",
   "views": 2375
  }
 ],
 "센테리움": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-01-25",
   "title": "센테리움 CC 웨일즈코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "3DKznPQOYeo",
   "views": 7216
  },
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2025-01-25",
   "title": "센테리움 CC 스코틀랜드코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "TqenQaOFjCo",
   "views": 5635
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-01-25",
   "title": "센테리움 CC 잉글랜드코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "LGCO8XfMySo",
   "views": 4929
  },
  {
   "channel": "리보플TV",
   "likes": 19,
   "publishedAt": "2025-08-25",
   "title": "충주 센테리움CC 스코틀랜드 코스 5분 공략",
   "videoId": "jbCh_bGCjM0",
   "views": 3358
  },
  {
   "channel": "리보플TV",
   "likes": 15,
   "publishedAt": "2025-08-18",
   "title": "충주 센테리움CC 잉글랜드 코스 5분 공략",
   "videoId": "xYABJEnWTl8",
   "views": 3237
  }
 ],
 "소노펠리체CC 델피노": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-19",
   "title": "[골프] 소노펠리체CC 델피노 IN(마운틴)코스공략. 라운드전 한번에 파악하기.",
   "videoId": "syjBzZrvgzc",
   "views": 3579
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-19",
   "title": "[골프] 소노펠리체CC 델피노 OUT(오션)코스공략. 라운드전 한번에 파악하기.",
   "videoId": "PtoF7FNzEzw",
   "views": 2407
  }
 ],
 "소노펠리체CC 비발디파크 WEST": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-03-18",
   "title": "[골프] 소노펠리체CC비발디파크WEST IN코스공략. 라운드전 한번에 파악하기.",
   "videoId": "6HF8Dgj4ogU",
   "views": 6243
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-18",
   "title": "[골프] 소노펠리체CC 비발디파크WEST OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "4WhNxZsdeNw",
   "views": 3885
  }
 ],
 "소피아그린CC": [
  {
   "channel": "밀떡아재",
   "likes": 39,
   "publishedAt": "2023-08-27",
   "title": "소피아그린CC / 세종코스 \"매우 강추 골프장\"",
   "videoId": "U_awJNzEXBU",
   "views": 9252
  },
  {
   "channel": "리보플TV",
   "likes": 42,
   "publishedAt": "2021-12-30",
   "title": "여주 소피아그린CC 황학코스 5분 공략",
   "videoId": "3kQudlZJqJo",
   "views": 8732
  },
  {
   "channel": "밀떡아재",
   "likes": 43,
   "publishedAt": "2023-08-22",
   "title": "소피아그린CC / 황학코스 \"어쩜 이렇게 관리가 잘 되어 있지\"",
   "videoId": "9_furZtx4B0",
   "views": 7405
  },
  {
   "channel": "리보플TV",
   "likes": 34,
   "publishedAt": "2022-01-04",
   "title": "여주 소피아그린CC 세종코스 5분 공략",
   "videoId": "V0B-9Jf6Vfg",
   "views": 7305
  },
  {
   "channel": "리보플TV",
   "likes": 39,
   "publishedAt": "2022-03-23",
   "title": "여주 소피아그린CC 여강코스 5분 공략",
   "videoId": "qRcEMMlp34A",
   "views": 6730
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-01-25",
   "title": "소피아그린 CC 여강코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "xTQ3MUGl6aY",
   "views": 3108
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-01-25",
   "title": "소피아그린 CC 황학코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "FtSl-3TPmxw",
   "views": 2179
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-01-25",
   "title": "소피아그린 CC 세종코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "93SmkNKqSEM",
   "views": 2007
  }
 ],
 "솔라고컨트리클럽": [
  {
   "channel": "리보플TV",
   "likes": 23,
   "publishedAt": "2024-06-05",
   "title": "태안 솔라고CC 솔 In코스 5분 공략",
   "videoId": "d6v3_sPD7Bk",
   "views": 7043
  },
  {
   "channel": "리보플TV",
   "likes": 30,
   "publishedAt": "2024-06-13",
   "title": "태안 솔라고CC 라고 In 코스 5분 공략",
   "videoId": "NzgvPSZAKok",
   "views": 6806
  },
  {
   "channel": "리보플TV",
   "likes": 20,
   "publishedAt": "2024-06-03",
   "title": "태안 솔라고CC 솔 Out 코스 5분 공략",
   "videoId": "k_9trmXqg_o",
   "views": 4359
  },
  {
   "channel": "리보플TV",
   "likes": 22,
   "publishedAt": "2024-06-10",
   "title": "태안 솔라고CC 라고 Out코스 5분 공략",
   "videoId": "Akq9JZIM1qM",
   "views": 3882
  }
 ],
 "솔모로CC": [
  {
   "channel": "리보플TV",
   "likes": 28,
   "publishedAt": "2022-02-07",
   "title": "여주 솔모로CC 체리코스 5분 공략",
   "videoId": "055ycI9Y4kA",
   "views": 10113
  },
  {
   "channel": "리보플TV",
   "likes": 35,
   "publishedAt": "2022-02-02",
   "title": "여주 솔모로CC 퍼시몬코스 5분 공략",
   "videoId": "701bkxC750c",
   "views": 9333
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2025-03-20",
   "title": "[골프] 솔모로CC 파인코스공략. 라운드전 한번에 파악하기.",
   "videoId": "QED6981e1QQ",
   "views": 5012
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-03-20",
   "title": "[골프] 솔모로CC 메이플코스공략. 라운드전 한번에 파악하기.",
   "videoId": "oj5iWzqNLiY",
   "views": 4583
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-03-20",
   "title": "[골프] 솔모로CC 퍼시몬코스공략. 라운드전 한번에 파악하기.",
   "videoId": "p6Xc63GZFb8",
   "views": 4382
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-03-20",
   "title": "[골프] 솔모로CC 체리코스공략. 라운드전 한번에 파악하기.",
   "videoId": "-8L91nuvwI8",
   "views": 4275
  }
 ],
 "송추CC": [
  {
   "channel": "밀떡아재",
   "likes": 33,
   "publishedAt": "2020-07-20",
   "title": "[전백시]송추CC / 캐디님의 서코스 설명",
   "videoId": "pry1PiLmrx0",
   "views": 7808
  },
  {
   "channel": "밀떡아재",
   "likes": 28,
   "publishedAt": "2020-07-16",
   "title": "[전백시]송추CC / 캐디님의 동코스 설명",
   "videoId": "gV8qM_wUcYU",
   "views": 6420
  }
 ],
 "수원CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-09-15",
   "title": "수원cc NEW(뉴) IN코스. 라운드전 한번에 파악하기.",
   "videoId": "8K40soAnd8Q",
   "views": 4321
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-15",
   "title": "수원cc NEW(뉴) OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "NXQ1dklwp_k",
   "views": 3261
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-09-15",
   "title": "수원cc OLD(올드) IN코스. 라운드전 한번에 파악하기.",
   "videoId": "hvybgmRchfI",
   "views": 3073
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-15",
   "title": "수원cc OLD(올드) OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "SN0z-OyT5KE",
   "views": 2715
  }
 ],
 "순천CC": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-29",
   "title": "순천 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "BGime27ZaC0",
   "views": 3034
  }
 ],
 "스카이밸리CC": [
  {
   "channel": "밀떡아재",
   "likes": 71,
   "publishedAt": "2023-05-18",
   "title": "스카이밸리CC / 스카이코스 \"밸리코스보다는 재미있다\"",
   "videoId": "SF8UWebKKXk",
   "views": 19400
  },
  {
   "channel": "밀떡아재",
   "likes": 81,
   "publishedAt": "2023-05-13",
   "title": "스카이밸리CC / 밸리코스 \"코스는 쉬워 보이는데 스코어는 개판인날\"",
   "videoId": "VxgpylgTJQo",
   "views": 16283
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-10-30",
   "title": "스카이밸리 CC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "rZwqyzvtW-c",
   "views": 5457
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-10-30",
   "title": "스카이밸리 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "RRCZ28japDM",
   "views": 4744
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-30",
   "title": "스카이밸리 CC 스카이코스. 라운드전 한번에 파악하기.",
   "videoId": "ghP3YtmaHug",
   "views": 2673
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-30",
   "title": "스카이밸리 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "TZtlSFRfhAs",
   "views": 2592
  },
  {
   "channel": "리보플TV",
   "likes": 8,
   "publishedAt": "2025-10-20",
   "title": "여주 스카이밸리CC 밸리 코스 5분 공략",
   "videoId": "d-XYGYKuNBI",
   "views": 2137
  },
  {
   "channel": "리보플TV",
   "likes": 13,
   "publishedAt": "2025-10-13",
   "title": "여주 스카이밸리CC 스카이 코스 5분 공략",
   "videoId": "FmESePnT-eA",
   "views": 1494
  }
 ],
 "스카이뷰CC": [
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2025-03-20",
   "title": "[골프] 스카이뷰CC IN코스공략. 라운드전 한번에 파악하기.",
   "videoId": "4AhoD9ZKyQE",
   "views": 4717
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-03-19",
   "title": "[골프] 스카이뷰CC OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "mcBVEqLFV54",
   "views": 3271
  }
 ],
 "스톤게이트CC": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-09-11",
   "title": "스톤게이트 컨트리클럽 스톤 코스. 라운드전 한번에 파악하기.",
   "videoId": "aqbjQ94Lauw",
   "views": 5662
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-09-11",
   "title": "스톤게이트 컨트리클럽 게이트 코스. 라운드전 한번에 파악하기.",
   "videoId": "YfEcXtIueyg",
   "views": 3811
  }
 ],
 "스프링데일CC": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-09-22",
   "title": "스프링데일cc 스프링(편백림) 코스. 라운드전 한번에 파악하기.",
   "videoId": "JgYhWpiu2bQ",
   "views": 2561
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-09-22",
   "title": "스프링데일cc 데일(자연림) 코스. 라운드전 한번에 파악하기.",
   "videoId": "3PgVbrk4rWE",
   "views": 1556
  }
 ],
 "시그너스CC": [
  {
   "channel": "리보플TV",
   "likes": 126,
   "publishedAt": "2021-06-26",
   "title": "충주 시그너스cc 코튼코스 공략",
   "videoId": "OqyE16nynj0",
   "views": 28894
  },
  {
   "channel": "리보플TV",
   "likes": 98,
   "publishedAt": "2021-06-29",
   "title": "충주 시그너스 실크코스 공략",
   "videoId": "dxaxHe5pI8Q",
   "views": 21873
  },
  {
   "channel": "리보플TV",
   "likes": 77,
   "publishedAt": "2022-08-29",
   "title": "충주 시그너스CC 라미코스 5분 공략",
   "videoId": "SVJNcF6zuFo",
   "views": 19819
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-01-25",
   "title": "시그너스 CC 코튼코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "4Z9CyKefmXQ",
   "views": 3116
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-01-25",
   "title": "시그너스 CC 실크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "eg2HtHgIoFo",
   "views": 2543
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-01-25",
   "title": "시그너스 CC 라미코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "31D4w04kuYQ",
   "views": 2498
  }
 ],
 "시엘골프클럽 (Ciel Golf Club)": [
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-03-18",
   "title": "[골프] 시엘GC 마운틴코스공략. 라운드전 한번에 파악하기.",
   "videoId": "PaIoB8_iTB4",
   "views": 3577
  }
 ],
 "신라CC": [
  {
   "channel": "리보플TV",
   "likes": 39,
   "publishedAt": "2024-10-28",
   "title": "여주 신라CC 남코스 5분 공략",
   "videoId": "j7PqpT-X7I8",
   "views": 10511
  },
  {
   "channel": "리보플TV",
   "likes": 39,
   "publishedAt": "2024-11-04",
   "title": "여주 신라CC 동코스 5분 공략",
   "videoId": "10RCl3y1NbA",
   "views": 7771
  },
  {
   "channel": "리보플TV",
   "likes": 25,
   "publishedAt": "2025-07-14",
   "title": "여주 신라CC 서코스 5분 공략",
   "videoId": "mEUBq4CXwsg",
   "views": 6111
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-10-18",
   "title": "신라 CC 서코스. 라운드전 한번에 파악하기.",
   "videoId": "jZTs3lsb4QU",
   "views": 5191
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-10-18",
   "title": "신라 CC 동코스. 라운드전 한번에 파악하기.",
   "videoId": "03Npw3GyziI",
   "views": 3185
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-18",
   "title": "신라 CC 남코스. 라운드전 한번에 파악하기.",
   "videoId": "MYicbLmJh_o",
   "views": 2502
  }
 ],
 "신안CC": [
  {
   "channel": "밀떡아재",
   "likes": 23,
   "publishedAt": "2025-02-08",
   "title": "\"공사판 아님 골프장임\" 신안CC / 토마토코스",
   "videoId": "uwOGoSaZpxI",
   "views": 9411
  },
  {
   "channel": "맵가이더",
   "likes": 28,
   "publishedAt": "2025-01-27",
   "title": "신안 CC 오렌지코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "K8HdXOCNKFY",
   "views": 8648
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-01-27",
   "title": "신안 CC 토마토코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "2pxg53tnCms",
   "views": 8503
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-01-27",
   "title": "신안 CC 애플코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "cRKk5ZWP2kg",
   "views": 7281
  },
  {
   "channel": "밀떡아재",
   "likes": 32,
   "publishedAt": "2025-02-03",
   "title": "\"겨울 골프는 날씨와의 눈치싸움\" 신안CC / 오렌지코스",
   "videoId": "2ldMTfQSzWc",
   "views": 5485
  }
 ],
 "신원CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-01-27",
   "title": "신원 CC 솔로몬코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "eCu9dCiUHb4",
   "views": 2142
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-01-27",
   "title": "신원 CC 데이비드코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "AUQPy55llBA",
   "views": 1791
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-01-27",
   "title": "신원 CC 에벤에셀코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "3m6gjHt3hRQ",
   "views": 1484
  },
  {
   "channel": "리보플TV",
   "likes": 4,
   "publishedAt": "2025-12-01",
   "title": "용인 신원CC 데이비드 코스 5분 공략",
   "videoId": "1zVxOqCCZSE",
   "views": 772
  },
  {
   "channel": "리보플TV",
   "likes": 2,
   "publishedAt": "2025-11-24",
   "title": "용인 신원CC 에벤에셀 코스 5분 공략",
   "videoId": "Px8y3BTJFwY",
   "views": 554
  }
 ],
 "써닝포인트CC": [
  {
   "channel": "리보플TV",
   "likes": 5,
   "publishedAt": "2026-06-22",
   "title": "용인 써닝포인트CC 포인트 코스 5분 공략",
   "videoId": "S7SejkM15rE",
   "views": 1058
  },
  {
   "channel": "리보플TV",
   "likes": 5,
   "publishedAt": "2026-06-15",
   "title": "용인 써닝포인트CC 썬코스 5분 공략",
   "videoId": "PT1BrnQ_ys0",
   "views": 968
  }
 ],
 "써미트컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-01-27",
   "title": "써미트CC M코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Fpon7aX2gz8",
   "views": 4723
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-01-27",
   "title": "써미트CC S코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "IDR8ZsKOy9o",
   "views": 4066
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-01-27",
   "title": "써미트CC K코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wi0TCoeu_O4",
   "views": 3954
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-08-28",
   "title": "#써미트 #골프장 #드론 #드론촬영 #골프연습 #추천골프장 #골프스윙 #golf",
   "videoId": "vKplv39wGpg",
   "views": 3445
  }
 ],
 "썬밸리CC": [
  {
   "channel": "리보플TV",
   "likes": 71,
   "publishedAt": "2021-08-22",
   "title": "일죽 썬밸리CC 썬코스 공략",
   "videoId": "frTEv21jXeo",
   "views": 21449
  },
  {
   "channel": "리보플TV",
   "likes": 63,
   "publishedAt": "2021-08-20",
   "title": "일죽 썬밸리 밸리코스 공략",
   "videoId": "Rn0PQuR8Vdw",
   "views": 13784
  },
  {
   "channel": "밀떡아재",
   "likes": 50,
   "publishedAt": "2021-02-05",
   "title": "[전백시]일죽 썬밸리CC / 밸리코스",
   "videoId": "X7tzyCWpb3M",
   "views": 11220
  },
  {
   "channel": "밀떡아재",
   "likes": 48,
   "publishedAt": "2021-02-01",
   "title": "[전백시]일죽 썬밸리CC / 썬코스",
   "videoId": "8pRpaOfLZ8I",
   "views": 10530
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-03-12",
   "title": "일죽 썬밸리 CC 썬코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ZqnTBhBEg78",
   "views": 5665
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-03-12",
   "title": "일죽 썬밸리 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "jyd9P3eJmc8",
   "views": 4023
  }
 ],
 "썬힐GC": [
  {
   "channel": "리보플TV",
   "likes": 28,
   "publishedAt": "2025-05-05",
   "title": "가평 썬힐GC 힐 코스 5분 공략",
   "videoId": "NgLt5CpAuzg",
   "views": 6419
  },
  {
   "channel": "리보플TV",
   "likes": 26,
   "publishedAt": "2025-05-19",
   "title": "가평 썬힐GC 썬 코스 5분 공략",
   "videoId": "XL6WH9vPxCs",
   "views": 4456
  },
  {
   "channel": "리보플TV",
   "likes": 9,
   "publishedAt": "2026-02-16",
   "title": "가평 썬힐GC 밸리 코스 5분 공략",
   "videoId": "XrHniSV-k3o",
   "views": 2165
  }
 ],
 "아난티 남해 골프클럽": [
  {
   "channel": "밀떡아재",
   "likes": 54,
   "publishedAt": "2021-04-02",
   "title": "[전백시]남해 아난티 CC 캐디의 아웃(OUT)코스 설명",
   "videoId": "vQOZ9stuTLw",
   "views": 12020
  },
  {
   "channel": "밀떡아재",
   "likes": 26,
   "publishedAt": "2021-04-08",
   "title": "[전백시]남해 아난티 CC 캐디의 인(IN)코스 설명",
   "videoId": "XNhegj7nnyw",
   "views": 7625
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2025-01-29",
   "title": "아난티남해CC IN 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "_bndnQCfzK4",
   "views": 6505
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-01-29",
   "title": "아난티남해CC OUT 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "KL2g4ak0dPo",
   "views": 3793
  }
 ],
 "아난티 중앙 골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-01-29",
   "title": "아난티중앙CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "uhQOcLEXK9o",
   "views": 4270
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-01-29",
   "title": "아난티중앙CC 스카이코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "1K3ZSkujZJw",
   "views": 3701
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-01-29",
   "title": "아난티중앙CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "k5A3Jwh8WEM",
   "views": 3294
  }
 ],
 "아네스빌CC": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-01-29",
   "title": "아네스빌CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "-Z4B8sytkmk",
   "views": 1786
  }
 ],
 "아델스코트CC": [
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-10-07",
   "title": "아델스코트 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "4KBFilUIEA0",
   "views": 4848
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2024-10-07",
   "title": "아델스코트 CC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "ZlBq-PJH6BM",
   "views": 4212
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-10-07",
   "title": "아델스코트 CC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "wb9YUOujaLI",
   "views": 3532
  }
 ],
 "아리스타CC": [
  {
   "channel": "맵가이더",
   "likes": 27,
   "publishedAt": "2025-01-29",
   "title": "아리스타CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "igCH-X3tgWk",
   "views": 5898
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-01-29",
   "title": "아리스타CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ibtbarJlaNw",
   "views": 5077
  }
 ],
 "아리지CC": [
  {
   "channel": "리보플TV",
   "likes": 31,
   "publishedAt": "2025-02-03",
   "title": "여주 아리지CC 달님 코스 5분 공략",
   "videoId": "9fqiKpsnf8Y",
   "views": 7199
  },
  {
   "channel": "리보플TV",
   "likes": 24,
   "publishedAt": "2025-02-10",
   "title": "여주 아리지CC 별님 코스 5분 공략",
   "videoId": "hmYZ1wQ4THQ",
   "views": 5869
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-10-18",
   "title": "아리지 CC 햇님코스. 라운드전 한번에 파악하기.",
   "videoId": "St0hwzO0phs",
   "views": 3787
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-10-18",
   "title": "아리지 CC 별님코스. 라운드전 한번에 파악하기.",
   "videoId": "7ry4Eikn4js",
   "views": 2721
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-10-18",
   "title": "아리지 CC 달님코스. 라운드전 한번에 파악하기.",
   "videoId": "Llw9EZrl4Po",
   "views": 2364
  }
 ],
 "아시아나CC": [
  {
   "channel": "밀떡아재",
   "likes": 51,
   "publishedAt": "2023-06-19",
   "title": "아시아나CC / 서코스 1~9번홀 \"언듈레이션 심한 회원제 골프장\"",
   "videoId": "Ym_rkpZ5KW0",
   "views": 12120
  },
  {
   "channel": "리보플TV",
   "likes": 36,
   "publishedAt": "2023-07-17",
   "title": "아시아나CC 서코스 Out (1~9번) 5분 공략",
   "videoId": "KgbNCg-AdkQ",
   "views": 7531
  },
  {
   "channel": "밀떡아재",
   "likes": 36,
   "publishedAt": "2023-06-26",
   "title": "아시아나CC / 서코스 후반전 \"확실히 늘어난 전장\"",
   "videoId": "KvhcvLG0Stg",
   "views": 4727
  },
  {
   "channel": "리보플TV",
   "likes": 13,
   "publishedAt": "2023-07-24",
   "title": "아시아나CC 서코스 In (10~18번) 5분 공략",
   "videoId": "IcWp-jLr0P8",
   "views": 3397
  }
 ],
 "아시아드CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-01-29",
   "title": "아시아드CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "E1MPd5vQE8I",
   "views": 3125
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-01-29",
   "title": "아시아드CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "iVLAkviUup4",
   "views": 2840
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-01-29",
   "title": "아시아드CC 파인코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "DIpCeNMFoH8",
   "views": 2186
  }
 ],
 "아크로 컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-01-31",
   "title": "아크로CC 마스터코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "PFHDNYeuqWk",
   "views": 3742
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-01-31",
   "title": "아크로CC 챌린지코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "eUrg9sGmFzQ",
   "views": 2690
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-01-31",
   "title": "아크로CC 스카이코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "kdESziPJBOM",
   "views": 2636
  }
 ],
 "안강레전드골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-01-31",
   "title": "안강레전드GC 킹코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "NBxnAnfNdI4",
   "views": 2977
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-01-31",
   "title": "안강레전드GC 퀸코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "6jM54lBZ6Vs",
   "views": 1626
  }
 ],
 "안동레이크골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-01-31",
   "title": "안동레이크GC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "vNaQwFp1HNA",
   "views": 2970
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-01-31",
   "title": "안동레이크GC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "4O4Nahbz9qw",
   "views": 2509
  }
 ],
 "안동리버힐 컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-11-29",
   "title": "안동리버힐 CC IN 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "8gpqaHttpAA",
   "views": 5114
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-11-29",
   "title": "안동리버힐 CC OUT 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "X-Pj4-99EVo",
   "views": 3824
  }
 ],
 "안성CC": [
  {
   "channel": "리보플TV",
   "likes": 90,
   "publishedAt": "2021-07-17",
   "title": "안성 골프클럽Q 밸리코스 공략",
   "videoId": "mLpTnKJZnjQ",
   "views": 24520
  },
  {
   "channel": "리보플TV",
   "likes": 65,
   "publishedAt": "2023-10-02",
   "title": "안성CC Out코스 (1~9번) 5분 공략",
   "videoId": "gJ8os5e5ek8",
   "views": 12941
  },
  {
   "channel": "리보플TV",
   "likes": 56,
   "publishedAt": "2023-10-02",
   "title": "안성CC In코스 (10~18번) 5분 공략",
   "videoId": "l0iwcuuhq-I",
   "views": 9984
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-01-31",
   "title": "안성CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "osJmSxpOp3Y",
   "views": 4059
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-01-31",
   "title": "안성CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "f0UBOWcdX_Y",
   "views": 3135
  }
 ],
 "안성베네스트골프클럽": [
  {
   "channel": "밀떡아재",
   "likes": 45,
   "publishedAt": "2020-04-17",
   "title": "[전백시 ]안성베네스트 CC 북코스!!!",
   "videoId": "7f1jmbENXtY",
   "views": 11754
  },
  {
   "channel": "밀떡아재",
   "likes": 39,
   "publishedAt": "2020-04-15",
   "title": "[전백시] 안성베네스트 CC 서코스!!!",
   "videoId": "-WJjXFAHFVg",
   "views": 10786
  },
  {
   "channel": "리보플TV",
   "likes": 45,
   "publishedAt": "2024-03-11",
   "title": "안성 베네스트 GC 서코스 5분 공략",
   "videoId": "q9sT4NGicCs",
   "views": 9965
  },
  {
   "channel": "리보플TV",
   "likes": 43,
   "publishedAt": "2024-12-30",
   "title": "안성 베네스트 남코스 5분 공략",
   "videoId": "T0X9ytAc3-A",
   "views": 9371
  },
  {
   "channel": "리보플TV",
   "likes": 38,
   "publishedAt": "2024-02-26",
   "title": "안성 베네스트 GC 북코스 5분 공략",
   "videoId": "2jiSuZcQlro",
   "views": 9158
  },
  {
   "channel": "리보플TV",
   "likes": 30,
   "publishedAt": "2024-12-22",
   "title": "안성 베네스트 동코스 5분 공략",
   "videoId": "7UZhC0rrhHY",
   "views": 7477
  }
 ],
 "알펜시아700GC": [
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-02-11",
   "title": "알펜시아700 GC 알프스코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "TO2F_HpO3IU",
   "views": 4464
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-02-11",
   "title": "알펜시아700 GC 아시아코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "lDkzzvRXChs",
   "views": 4346
  }
 ],
 "알프스대영CC": [
  {
   "channel": "맵가이더",
   "likes": 39,
   "publishedAt": "2025-02-11",
   "title": "알프스대영 CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "RPgfodEHXZo",
   "views": 10648
  },
  {
   "channel": "맵가이더",
   "likes": 40,
   "publishedAt": "2025-02-11",
   "title": "알프스대영 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "C3JZgmJElqU",
   "views": 7863
  }
 ],
 "애플밸리컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-02-11",
   "title": "애플밸리 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "_o-zx1kr5ao",
   "views": 1483
  }
 ],
 "양산CC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-12",
   "title": "양산cc 누리코스. 라운드전 한번에 파악하기.",
   "videoId": "O1Gd82mTCTQ",
   "views": 8051
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-12",
   "title": "양산cc 마루코스. 라운드전 한번에 파악하기.",
   "videoId": "FHktMtrIwdM",
   "views": 6540
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-09-12",
   "title": "양산cc 가온코스. 라운드전 한번에 파악하기.",
   "videoId": "B7zrJm3Ugrc",
   "views": 5860
  }
 ],
 "양산동원로얄컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-02-11",
   "title": "양산동원로얄 CC 듀크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "uNDTHQ-kmVo",
   "views": 4917
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-02-11",
   "title": "양산동원로얄 CC 비스타코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "5Frx1RTSFgo",
   "views": 4425
  }
 ],
 "양지파인CC": [
  {
   "channel": "밀떡아재",
   "likes": 46,
   "publishedAt": "2023-02-13",
   "title": "양지파인CC / 남코스 \"가격은 굿, 상태는 배드\"",
   "videoId": "Zc2bFDvf6v4",
   "views": 12396
  },
  {
   "channel": "밀떡아재",
   "likes": 36,
   "publishedAt": "2023-02-17",
   "title": "양지파인CC / 동코스 \"엄청난 오르막 코스에 도가니 나갈판\"",
   "videoId": "_i1AZQKf0YE",
   "views": 10398
  },
  {
   "channel": "맵가이더",
   "likes": 32,
   "publishedAt": "2024-10-20",
   "title": "양지파인 CC 동코스. 라운드전 한번에 파악하기.",
   "videoId": "6IYE8OEDxIQ",
   "views": 6843
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-20",
   "title": "양지파인 CC 서코스. 라운드전 한번에 파악하기.",
   "videoId": "HC5swsdLLlI",
   "views": 4873
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-20",
   "title": "양지파인 CC 남코스. 라운드전 한번에 파악하기.",
   "videoId": "3irsDYOc12k",
   "views": 4326
  }
 ],
 "양평TPC골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-11-08",
   "title": "양평TPC GC 루나코스. 라운드전 한번에 파악하기.",
   "videoId": "t9aNQAmSHgM",
   "views": 5514
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-11-08",
   "title": "양평TPC GC 스텔라코스. 라운드전 한번에 파악하기.",
   "videoId": "zqDW12LJ3Tk",
   "views": 5487
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-11-08",
   "title": "양평TPC GC 솔라코스. 라운드전 한번에 파악하기.",
   "videoId": "bT0RkOk57LY",
   "views": 4361
  }
 ],
 "에덴블루CC": [
  {
   "channel": "리보플TV",
   "likes": 92,
   "publishedAt": "2021-08-25",
   "title": "안성 에덴블루CC 밸리코스 공략",
   "videoId": "Nm1QAbpm6gg",
   "views": 30293
  },
  {
   "channel": "리보플TV",
   "likes": 115,
   "publishedAt": "2021-09-04",
   "title": "안성 에덴블루CC 레이크코스 공략",
   "videoId": "5kyTwSakn54",
   "views": 30057
  },
  {
   "channel": "리보플TV",
   "likes": 70,
   "publishedAt": "2021-08-28",
   "title": "안성 에덴블루cc 마운틴코스 공략",
   "videoId": "nzDhwvvNQDI",
   "views": 27577
  },
  {
   "channel": "밀떡아재",
   "likes": 63,
   "publishedAt": "2023-02-23",
   "title": "에덴블루 CC / 벨리코스 \"긴 전장, 버라이어티한 코스설계\"",
   "videoId": "au7PDavEIWg",
   "views": 20989
  },
  {
   "channel": "밀떡아재",
   "likes": 36,
   "publishedAt": "2023-02-27",
   "title": "에덴블루CC / 마운틴코스 \"좌우폭이 좁은 내리막 설계\" 좌측 OB에 유의",
   "videoId": "53F1sjI9gng",
   "views": 8248
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-22",
   "title": "에덴블루cc 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "1KjjJd0Wamk",
   "views": 5754
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-09-22",
   "title": "에덴블루cc 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "uVgrtJ5LyNU",
   "views": 4012
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-09-22",
   "title": "에덴블루cc 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "tfoPiwQnaJI",
   "views": 3627
  }
 ],
 "에버리스CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-11-03",
   "title": "에버리스 GR 새별코스. 라운드전 한번에 파악하기.",
   "videoId": "BnhxCwiXEoU",
   "views": 1670
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-11-03",
   "title": "에버리스 GR 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "0W_qFw2JOkQ",
   "views": 1352
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-11-03",
   "title": "에버리스 GR 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "xhHOAZ6vHio",
   "views": 1000
  }
 ],
 "에스앤골프리조트": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-02-13",
   "title": "에스앤 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "xc1WoymWO4s",
   "views": 2866
  }
 ],
 "에코랜드 CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-07-21",
   "title": "에코랜드CC #에코랜드 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "iiS0VnkKb_w",
   "views": 3481
  },
  {
   "channel": "맵가이더",
   "likes": 2,
   "publishedAt": "2024-10-09",
   "title": "에코랜드 GC 비치힐스코스. 라운드전 한번에 파악하기.",
   "videoId": "itfypmg2Zfc",
   "views": 733
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-10-09",
   "title": "에코랜드 GC 에코코스. 라운드전 한번에 파악하기.",
   "videoId": "X2Cz2Rf8V_U",
   "views": 564
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-10-09",
   "title": "에코랜드 GC 와일드코스. 라운드전 한번에 파악하기.",
   "videoId": "5uMjJea7bKY",
   "views": 423
  }
 ],
 "에콜리안 정선CC": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-02-13",
   "title": "에콜리안정선 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "FUU-4FoK8Q4",
   "views": 1190
  }
 ],
 "에콜리안CC 거창": [
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-02-13",
   "title": "에콜리안거창 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "XAPIN3FjBlU",
   "views": 2140
  }
 ],
 "에콜리안영광CC": [
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-12-16",
   "title": "에콜리안영광CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "qNEYNXAFdh8",
   "views": 1377
  }
 ],
 "엠스클럽의성컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-12-16",
   "title": "엠스클럽의성CC 챌린지코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "9fVsigzx_EE",
   "views": 4388
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-12-16",
   "title": "엠스클럽의성CC 챔피언코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "cdm4xl0hKlk",
   "views": 3537
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-12-16",
   "title": "엠스클럽의성CC 마스터코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "dWBAdfZnt98",
   "views": 3522
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2026-03-05",
   "title": "[골프] 엠스클럽 의성 CC (2026.ver) 챌린지 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "1iWmPFuK6XI",
   "views": 1407
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2026-03-05",
   "title": "[골프] 엠스클럽 의성 CC (2026.ver) 챔피언 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "aHtM0maBRWs",
   "views": 1320
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2026-03-05",
   "title": "[골프] 엠스클럽 의성 CC (2026.ver) 마스터 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "hwk-GzSB7Ks",
   "views": 1124
  }
 ],
 "여수경도골프앤리조트CC": [
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2025-01-23",
   "title": "세이지우드 여수경도 CC 오동도코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "qodFCu2uiRg",
   "views": 3506
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-01-23",
   "title": "세이지우드 여수경도 CC 금오도코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "dTzm_sAd9mg",
   "views": 3177
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-01-23",
   "title": "세이지우드 여수경도 CC 돌산도코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "gkGZubehLk4",
   "views": 3149
  }
 ],
 "여수시티파크리조트": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-02-13",
   "title": "여수시티파크 CC 시티코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "gaPCSfyqhI8",
   "views": 2830
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-02-13",
   "title": "여수시티파크 CC 파크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "LGucQeMKGyo",
   "views": 2827
  }
 ],
 "여주썬밸리CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-15",
   "title": "여주썬밸리 CC 썬코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "n5Jk2_TvLuI",
   "views": 3072
  }
 ],
 "오너스GC": [
  {
   "channel": "밀떡아재",
   "likes": 74,
   "publishedAt": "2020-04-04",
   "title": "[전백시] 오너스CC 힐코스 / 현장 캐디가 알려주는 생생한 공략법(1)",
   "videoId": "f3ZngwUs8OM",
   "views": 24747
  },
  {
   "channel": "밀떡아재",
   "likes": 60,
   "publishedAt": "2020-04-05",
   "title": "[전백시] 오너스CC 레이크 코스 현장 캐디가 알려주는 생생한 공략법(2)",
   "videoId": "v2ThY_y7qsI",
   "views": 21021
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-11-05",
   "title": "오너스 GC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "I6A2nU3Iiy4",
   "views": 5568
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-11-05",
   "title": "오너스 GC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "W5_rUO3xwek",
   "views": 5307
  }
 ],
 "오렌지듄스 GC": [
  {
   "channel": "맵가이더",
   "likes": 31,
   "publishedAt": "2024-10-22",
   "title": "오렌지듄스 GC 웨스트코스. 라운드전 한번에 파악하기.",
   "videoId": "Dn-cLTEq_ao",
   "views": 8316
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-10-22",
   "title": "오렌지듄스 GC 이스트코스. 라운드전 한번에 파악하기.",
   "videoId": "VINnG8kZKvk",
   "views": 4246
  }
 ],
 "오렌지듄스영종GC": [
  {
   "channel": "밀떡아재",
   "likes": 13,
   "publishedAt": "2026-04-07",
   "title": "오렌지듄스 영종 GC/웨스트코스 \"클럽72 손님 많이 뺏어가겠는데\"",
   "videoId": "nYckqD3c59M",
   "views": 1230
  },
  {
   "channel": "밀떡아재",
   "likes": 12,
   "publishedAt": "2026-04-13",
   "title": "오렌지듄스 영종 GC/이스트코스 \"스코어는 안나오는데 비행기는 실컷 보고 있는 중\"",
   "videoId": "vIw5fFL3qJs",
   "views": 973
  }
 ],
 "오르비스GC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2026-03-26",
   "title": "[골프] 오르비스CC (2026.ver) IN 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "CZr__gi4pHM",
   "views": 1630
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2026-03-26",
   "title": "[골프] 오르비스CC (2026.ver) OUT 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "UG9fo5Tz04w",
   "views": 1459
  }
 ],
 "오션비치CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-20",
   "title": "[골프] 오션비치CC 오션코스공략. 라운드전 한번에 파악하기.",
   "videoId": "6P6BI1ExFps",
   "views": 4124
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-20",
   "title": "[골프] 오션비치CC 비치코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Ngteh8tuMC4",
   "views": 4055
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-20",
   "title": "[골프] 오션비치CC 밸리코스공략. 라운드전 한번에 파악하기.",
   "videoId": "zvWBpsJpAHo",
   "views": 2759
  }
 ],
 "오창에딘버러컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-02-16",
   "title": "오창에딘버러 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "7-6wrrqBaSM",
   "views": 4190
  }
 ],
 "오크밸리CC": [
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-10-09",
   "title": "오크밸리 CC 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "r31WbyU-x4w",
   "views": 2688
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-09",
   "title": "오크밸리 CC 오크코스. 라운드전 한번에 파악하기.",
   "videoId": "pr9p18CJUQo",
   "views": 2192
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-09",
   "title": "오크밸리 CC 메이플코스. 라운드전 한번에 파악하기.",
   "videoId": "F2wdVLqQtW8",
   "views": 1485
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-10-09",
   "title": "오크밸리 CC 체리코스. 라운드전 한번에 파악하기.",
   "videoId": "WC0Vfdr7uHU",
   "views": 1153
  }
 ],
 "오크힐스CC": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-02-16",
   "title": "오크힐스 CC 힐코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "__HT-bcH4pw",
   "views": 3648
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-02-16",
   "title": "오크힐스 CC 브릿지코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "VprPaKNqEPE",
   "views": 3563
  }
 ],
 "오투리조트 CC": [
  {
   "channel": "밀떡아재",
   "likes": 33,
   "publishedAt": "2022-05-25",
   "title": "[전백시] 오투리조트CC / 함백스카이코스",
   "videoId": "kxelKAnEiCA",
   "views": 8580
  },
  {
   "channel": "밀떡아재",
   "likes": 33,
   "publishedAt": "2022-05-28",
   "title": "[전백시] 오투리조트CC / 태백스카이코스",
   "videoId": "MXFq_Rsy4J0",
   "views": 8450
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-02-16",
   "title": "오투리조트(O2) CC 태백코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "z3IzKQuIVFI",
   "views": 4191
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-02-16",
   "title": "오투리조트(O2) CC 함백코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wFVpiaTQSos",
   "views": 2936
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-02-16",
   "title": "오투리조트(O2) CC 백두코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "oUTQOrF53NI",
   "views": 2701
  },
  {
   "channel": "밀떡아재",
   "likes": 7,
   "publishedAt": "2025-11-02",
   "title": "오투CC/태백스카이코스 #오투CC#강원도골프장#태백골프장",
   "videoId": "EBnLEGuoYFY",
   "views": 1186
  }
 ],
 "옥스필드CC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-10-22",
   "title": "옥스필드 CC 필드코스. 라운드전 한번에 파악하기.",
   "videoId": "PYRUqGIUGgY",
   "views": 4290
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-10-22",
   "title": "옥스필드 CC 옥스코스. 라운드전 한번에 파악하기.",
   "videoId": "Px-HP-F0KOY",
   "views": 4108
  },
  {
   "channel": "리보플TV",
   "likes": 13,
   "publishedAt": "2025-11-03",
   "title": "강원도 횡성 옥스필드CC 필드코스 5분 공략",
   "videoId": "bHoz-gnMjGc",
   "views": 2760
  },
  {
   "channel": "리보플TV",
   "likes": 9,
   "publishedAt": "2025-10-27",
   "title": "강원도 횡싱 옥스필드CC 옥스코스 5분 공략",
   "videoId": "_l_7Qf9Bvz0",
   "views": 1523
  }
 ],
 "올림픽CC": [
  {
   "channel": "밀떡아재",
   "likes": 98,
   "publishedAt": "2020-03-11",
   "title": "[전백시] 올림픽CC / 현장 캐디에게 듣는 생생한 코스설명",
   "videoId": "daZsYA6jeOg",
   "views": 17926
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-15",
   "title": "올림픽 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "HlbBoDTX8SA",
   "views": 3679
  }
 ],
 "용원 GC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-02-16",
   "title": "용원 CC 무학코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "t2JwWNAH-5o",
   "views": 3888
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-02-16",
   "title": "용원 CC 백구코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "6cY7UGNP0Q8",
   "views": 3570
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-02-16",
   "title": "용원 CC 백로코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "sQ2b4w5t3-E",
   "views": 3263
  }
 ],
 "용인CC": [
  {
   "channel": "맵가이더",
   "likes": 38,
   "publishedAt": "2024-09-24",
   "title": "용인cc 용인코스. 라운드전 한번에 파악하기.",
   "videoId": "fBrfZpXURyY",
   "views": 10907
  },
  {
   "channel": "맵가이더",
   "likes": 32,
   "publishedAt": "2024-09-24",
   "title": "용인cc 석천코스. 라운드전 한번에 파악하기.",
   "videoId": "LovnJUz43F8",
   "views": 7632
  }
 ],
 "용인플라자CC": [
  {
   "channel": "리보플TV",
   "likes": 13,
   "publishedAt": "2026-05-04",
   "title": "용인 플라자CC 타이거 Out 코스 (1~9번) 5분 공략",
   "videoId": "SmyoLqZyKMY",
   "views": 1077
  },
  {
   "channel": "리보플TV",
   "likes": 8,
   "publishedAt": "2026-05-11",
   "title": "용인 플라자CC 타이거 In 코스 (10~18번) 5분 공략",
   "videoId": "9v3sM2uN9YQ",
   "views": 800
  }
 ],
 "용평CC": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-02-16",
   "title": "용평 CC 산마루코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "eLyb9ZPDclI",
   "views": 2993
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-02-16",
   "title": "용평 CC 강마루코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "cHoIECADvVU",
   "views": 2036
  }
 ],
 "용평나인GC": [
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2025-02-16",
   "title": "용평나인 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "2ORticIBvjE",
   "views": 869
  }
 ],
 "우리들 CC": [
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-11-04",
   "title": "우리들CC North(북)코스. 라운드전 한번에 파악하기",
   "videoId": "Oc7lkVR7WwA",
   "views": 1142
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-11-04",
   "title": "우리들CC South(남)코스. 라운드전 한번에 파악하기.",
   "videoId": "RcQKICbZEik",
   "views": 1021
  }
 ],
 "우정힐스CC": [
  {
   "channel": "밀떡아재",
   "likes": 41,
   "publishedAt": "2024-08-20",
   "title": "우정힐스CC/인코스 \"회원제의 품격이 느껴진다.\"",
   "videoId": "VtfIMN1NnOY",
   "views": 6464
  },
  {
   "channel": "밀떡아재",
   "likes": 28,
   "publishedAt": "2024-09-07",
   "title": "우정힐스CC/아웃코스 \"우정힐스 회원과 친해져야 하는 이유\"",
   "videoId": "lADlV6m2Kvw",
   "views": 3790
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-10-22",
   "title": "우정힐스 CC IN코스. 라운드전 한번에 파악하기.",
   "videoId": "63_qbr9zGYI",
   "views": 1295
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-10-22",
   "title": "우정힐스 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "__hGp8OWx_k",
   "views": 1128
  },
  {
   "channel": "리보플TV",
   "likes": 6,
   "publishedAt": "2026-04-06",
   "title": "천안 우정힐스CC Out 코스 (1~9번) 5분 공략",
   "videoId": "zveb_g9saXA",
   "views": 926
  },
  {
   "channel": "리보플TV",
   "likes": 6,
   "publishedAt": "2026-04-13",
   "title": "천안 우정힐스CC In 코스 (10~18번) 5분 공략",
   "videoId": "CPyL1MNlBBI",
   "views": 319
  }
 ],
 "울산컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-11-04",
   "title": "울산CC 동코스. 라운드전 한번에 파악하기.",
   "videoId": "W3bbmaSMTCY",
   "views": 4282
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-11-04",
   "title": "울산CC 서코스. 라운드전 한번에 파악하기.",
   "videoId": "esS3CFamz1o",
   "views": 3486
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-11-04",
   "title": "울산CC 남코스. 라운드전 한번에 파악하기.",
   "videoId": "fJGo9ncElvM",
   "views": 3372
  }
 ],
 "울진마린CC": [
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2026-02-13",
   "title": "[골프] 울진마린 CC (2026.ver) 힐링 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "Cps0qldPWq0",
   "views": 1600
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2026-02-13",
   "title": "[골프] 울진마린 CC (2026.ver) 마린 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "ZFGie5thG-g",
   "views": 1579
  }
 ],
 "웅포골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-11-06",
   "title": "웅포 CC RIVER IN코스. 라운드전 한번에 파악하기.",
   "videoId": "Va5WkKacYFY",
   "views": 4695
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-11-06",
   "title": "웅포 CC RIVER OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "Iv3L4NB6GTY",
   "views": 3290
  }
 ],
 "웨스트오션CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-03",
   "title": "웨스트오션 CC 오션코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ZkLm_3qyPqw",
   "views": 2811
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-03",
   "title": "웨스트오션 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "6c60FaHHYKY",
   "views": 1665
  }
 ],
 "웰리힐리CC": [
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-03-03",
   "title": "웰리힐리 CC 남 IN 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ii6R-46A4rE",
   "views": 4709
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-03",
   "title": "웰리힐리 CC 북 IN 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "NSndwmzkoSo",
   "views": 3770
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-07-21",
   "title": "웰리힐리 #웰리힐리 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "ixOzZdTL-gc",
   "views": 3728
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-03",
   "title": "웰리힐리 CC 남 OUT 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ok7Ls-7F9cs",
   "views": 3719
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-03",
   "title": "웰리힐리 CC 북 OUT 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "HAf5yWPAb1Y",
   "views": 2331
  }
 ],
 "윈체스트GC": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-09",
   "title": "윈체스트 GC 로맨틱코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "-12CXvetvAM",
   "views": 4022
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-09",
   "title": "윈체스트 GC 클래식코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "L4hwMQxGk14",
   "views": 3275
  }
 ],
 "유니밸리컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-11",
   "title": "유니밸리 CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "roe17n7Co7I",
   "views": 1766
  }
 ],
 "유성컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-09",
   "title": "유성 CC 인(IN)코스. 라운드전 한번에 파악하기.",
   "videoId": "MnsmI8s1dPg",
   "views": 3653
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-10-09",
   "title": "유성 CC 아웃(OUT)코스. 라운드전 한번에 파악하기.",
   "videoId": "wUMKTt5tbyY",
   "views": 2611
  }
 ],
 "은화삼CC": [
  {
   "channel": "리보플TV",
   "likes": 74,
   "publishedAt": "2022-04-29",
   "title": "용인 은화삼CC 동코스 5분 공략",
   "videoId": "9NV33cTobPw",
   "views": 20675
  },
  {
   "channel": "리보플TV",
   "likes": 42,
   "publishedAt": "2022-04-26",
   "title": "용인 은화삼CC 서코스 5분 공략",
   "videoId": "E1ULgI9BlhI",
   "views": 10226
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-23",
   "title": "은화삼 CC 동(EAST)코스. 라운드전 한번에 파악하기.",
   "videoId": "bBihpA6chw8",
   "views": 3428
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-23",
   "title": "은화삼 CC 서(WEST)코스. 라운드전 한번에 파악하기.",
   "videoId": "cjyiO8iHueE",
   "views": 1951
  }
 ],
 "의령리온CC": [
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-12-16",
   "title": "의령리온CC 길정코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ufT-N7OAbL0",
   "views": 6364
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-12-16",
   "title": "의령리온CC 리온코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "sQ_W6gZrtzk",
   "views": 5178
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-12-16",
   "title": "의령리온CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Jmzb4aJZEvQ",
   "views": 4178
  }
 ],
 "이글몬트CC": [
  {
   "channel": "리보플TV",
   "likes": 73,
   "publishedAt": "2022-10-31",
   "title": "안성 이글몬트CC 히든코스 5분 공략",
   "videoId": "o0hBi-DjUB0",
   "views": 19263
  },
  {
   "channel": "리보플TV",
   "likes": 57,
   "publishedAt": "2022-10-24",
   "title": "안성 이글몬트 CC 몬트코스 5분 공략",
   "videoId": "jilzFNWHzhc",
   "views": 13321
  },
  {
   "channel": "맵가이더",
   "likes": 28,
   "publishedAt": "2025-03-15",
   "title": "이글몬트 CC 이글코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "SUW0NWkJwcs",
   "views": 7356
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-03-15",
   "title": "이글몬트 CC 히든코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "8LbcMxzg1XY",
   "views": 6083
  },
  {
   "channel": "밀떡아재",
   "likes": 24,
   "publishedAt": "2022-11-07",
   "title": "[3분코스요리]이글몬트CC / 히든코스",
   "videoId": "O6IR3uZ3aNM",
   "views": 5503
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-03-15",
   "title": "이글몬트 CC 몬트코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "58c4CuDc1Rk",
   "views": 4198
  },
  {
   "channel": "밀떡아재",
   "likes": 26,
   "publishedAt": "2022-11-02",
   "title": "[3분코스요리]이글몬트CC / 몬트코스",
   "videoId": "_JVu015G-Eg",
   "views": 2061
  },
  {
   "channel": "밀떡아재",
   "likes": 4,
   "publishedAt": "2025-10-10",
   "title": "코스공략이 재미있는 골프장 이글몬트CC / 몬트코스 #이글몬트CC#몬트코스#안성골프장",
   "videoId": "JO0wXn1VBrk",
   "views": 1297
  }
 ],
 "이븐데일CC": [
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2024-10-23",
   "title": "이븐데일 CC 이븐코스. 라운드전 한번에 파악하기.",
   "videoId": "D-B5rV5Cj3g",
   "views": 5053
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-23",
   "title": "이븐데일 CC 데일코스. 라운드전 한번에 파악하기.",
   "videoId": "urgVKlau83s",
   "views": 2965
  },
  {
   "channel": "리보플TV",
   "likes": 6,
   "publishedAt": "2026-03-09",
   "title": "청주 이븐데일 GC 이븐 코스 5분 공략",
   "videoId": "XB46fj-Dros",
   "views": 1347
  },
  {
   "channel": "리보플TV",
   "likes": 8,
   "publishedAt": "2026-03-16",
   "title": "청주 이븐데일 GC 데일코스 5분 공략",
   "videoId": "hjGDnB1vs5Y",
   "views": 888
  }
 ],
 "이스턴컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-09",
   "title": "이스턴 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "MVWR7-RUU5o",
   "views": 1608
  }
 ],
 "이스트힐CC": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-09",
   "title": "이스트힐 CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "E8QJVomB8F8",
   "views": 2913
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-09",
   "title": "이스트힐 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ujiMWc943wg",
   "views": 2845
  }
 ],
 "이지스카이CC": [
  {
   "channel": "맵가이더",
   "likes": 41,
   "publishedAt": "2024-10-09",
   "title": "이지스카이 CC 이지코스. 라운드전 한번에 파악하기.",
   "videoId": "JItJO0GK2Tc",
   "views": 11675
  },
  {
   "channel": "맵가이더",
   "likes": 27,
   "publishedAt": "2024-10-09",
   "title": "이지스카이 CC 스카이코스. 라운드전 한번에 파악하기.",
   "videoId": "susB0CljZQY",
   "views": 7680
  }
 ],
 "이천실크밸리GC": [
  {
   "channel": "리보플TV",
   "likes": 43,
   "publishedAt": "2023-11-27",
   "title": "이천 실크밸리GC 밸리코스 5분 공략",
   "videoId": "SGeT98J8OX0",
   "views": 12316
  },
  {
   "channel": "리보플TV",
   "likes": 37,
   "publishedAt": "2023-12-04",
   "title": "이천 실크밸리GC 레이크코스 5분 공략",
   "videoId": "bDjbYdT1SOw",
   "views": 10170
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-01-27",
   "title": "이천 실크밸리 CC 실크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "UcuZHwDRlxc",
   "views": 4649
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-01-27",
   "title": "이천 실크밸리 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "nU_LSCtGO58",
   "views": 4157
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-01-27",
   "title": "이천 실크밸리 CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "zZUBzL2QFQ8",
   "views": 3734
  }
 ],
 "이포CC": [
  {
   "channel": "리보플TV",
   "likes": 61,
   "publishedAt": "2022-04-11",
   "title": "여주 이포CC Out 코스 (1~9번) 5분 공략",
   "videoId": "BopI4HE_DxI",
   "views": 17426
  },
  {
   "channel": "리보플TV",
   "likes": 52,
   "publishedAt": "2022-04-18",
   "title": "여주 이포CC In코스 (10~18번) 5분 공략",
   "videoId": "OXcut0XK4XM",
   "views": 9099
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-03-11",
   "title": "이포 CC IN코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "RpPg58_LF4o",
   "views": 4547
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-11",
   "title": "이포 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "186sPbUOYCM",
   "views": 3287
  }
 ],
 "인서울27골프클럽": [
  {
   "channel": "리보플TV",
   "likes": 50,
   "publishedAt": "2022-08-01",
   "title": "인서울27 웨스트 코스 5분 공략",
   "videoId": "MWEB3meXNZQ",
   "views": 17924
  },
  {
   "channel": "리보플TV",
   "likes": 44,
   "publishedAt": "2022-08-01",
   "title": "인서울27 이스트 코스 5분 공략",
   "videoId": "mHBA6Nx2ygA",
   "views": 15601
  }
 ],
 "인천그랜드CC": [
  {
   "channel": "리보플TV",
   "likes": 34,
   "publishedAt": "2024-07-15",
   "title": "인천 그랜드CC Out코스 (1~9번) 5분 공략",
   "videoId": "MfjW5b0RDZM",
   "views": 12036
  }
 ],
 "인터불고 CC": [
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-18",
   "title": "[골프] 인터불고 원주CC OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "c7VSaTlN6g8",
   "views": 3140
  }
 ],
 "일동레이크GC": [
  {
   "channel": "리보플TV",
   "likes": 18,
   "publishedAt": "2025-01-06",
   "title": "포천 일동레이크 GC 마운틴 코스 5분 공략",
   "videoId": "4pzwOIh3RSI",
   "views": 3654
  },
  {
   "channel": "리보플TV",
   "likes": 14,
   "publishedAt": "2025-01-13",
   "title": "포천 일동레이크 GC 힐코스 5분 공략",
   "videoId": "9kNrGH9ZRL0",
   "views": 2683
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-12-16",
   "title": "일동레이크CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "_GgktTokACY",
   "views": 1401
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-12-16",
   "title": "일동레이크CC 힐코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "Go6qvS3h6Io",
   "views": 1083
  }
 ],
 "일라이트CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2026-03-19",
   "title": "[골프] 일라이트CC (2026.ver) G 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "y6T_pqe4BSU",
   "views": 1679
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2026-03-19",
   "title": "[골프] 일라이트CC (2026.ver) S 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "RcSS_m91F0s",
   "views": 1556
  }
 ],
 "일레븐CC": [
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-03-11",
   "title": "일레븐 CC 파크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "uX4rG_zkKqE",
   "views": 6162
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-11",
   "title": "일레븐 CC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "w0memoBHWQY",
   "views": 4438
  }
 ],
 "자유CC": [
  {
   "channel": "리보플TV",
   "likes": 61,
   "publishedAt": "2022-09-05",
   "title": "여주 자유CC Out 코스 (1~9번) 5분 공략",
   "videoId": "TqswMlAWen8",
   "views": 14910
  },
  {
   "channel": "리보플TV",
   "likes": 39,
   "publishedAt": "2022-09-05",
   "title": "여주 자유CC In 코스 (10~18번) 5분 공략",
   "videoId": "rYL7TFhGWFY",
   "views": 10611
  }
 ],
 "자유로CC": [
  {
   "channel": "밀떡아재",
   "likes": 36,
   "publishedAt": "2022-03-04",
   "title": "자유로CC/민국코스(화이트티)",
   "videoId": "tDmFIWNzZ-M",
   "views": 10224
  },
  {
   "channel": "밀떡아재",
   "likes": 22,
   "publishedAt": "2022-03-09",
   "title": "자유로CC / 통일코스 (화이트티)",
   "videoId": "NOX9fakJIJ8",
   "views": 6660
  },
  {
   "channel": "밀떡아재",
   "likes": 18,
   "publishedAt": "2022-02-17",
   "title": "[전지적백순이시점]자유로CC / 민국코스(레이디티)",
   "videoId": "ZxiULAvmWzg",
   "views": 1712
  },
  {
   "channel": "밀떡아재",
   "likes": 11,
   "publishedAt": "2022-02-25",
   "title": "[전지적백순이시점]자유로CC/통일코스(레이디티)",
   "videoId": "5B42H-jxQkc",
   "views": 988
  }
 ],
 "장수골프리조트": [
  {
   "channel": "리보플TV",
   "likes": 34,
   "publishedAt": "2023-11-13",
   "title": "전북 장수CC 사과 코스 5분 공략",
   "videoId": "r6LIluR9mvk",
   "views": 7739
  },
  {
   "channel": "리보플TV",
   "likes": 24,
   "publishedAt": "2023-11-20",
   "title": "전북 장수CC 나무 코스 5분 공략",
   "videoId": "YjReyFI5Lfo",
   "views": 4880
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-24",
   "title": "장수 CC 나무코스. 라운드전 한번에 파악하기.",
   "videoId": "CVTefVSj5P8",
   "views": 1684
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-10-24",
   "title": "장수 CC 사과코스. 라운드전 한번에 파악하기.",
   "videoId": "DAbDDyKNJbY",
   "views": 1215
  }
 ],
 "전주샹그릴라CC": [
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-09-24",
   "title": "전주샹그릴라cc 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "6pumwfLnSfw",
   "views": 3288
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-09-24",
   "title": "전주샹그릴라cc 드림코스. 라운드전 한번에 파악하기.",
   "videoId": "oionnb-qucc",
   "views": 3199
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-09-24",
   "title": "전주샹그릴라cc 엔젤코스. 라운드전 한번에 파악하기.",
   "videoId": "7f8FLdadU_M",
   "views": 2959
  }
 ],
 "정산컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-12",
   "title": "정산 CC 해우(SUN)코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "7LndoeNe80s",
   "views": 3450
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-12",
   "title": "정산 CC 별우(STAR)코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "5o5ygFg85ZM",
   "views": 3343
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-03-12",
   "title": "정산 CC 달우(MOON)코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "kJQO67HMq3M",
   "views": 3235
  }
 ],
 "제이퍼블릭골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-12",
   "title": "파주 제이퍼블릭 CC 6홀코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "53lr44O9xAY",
   "views": 2932
  }
 ],
 "제일컨트리클럽": [
  {
   "channel": "리보플TV",
   "likes": 29,
   "publishedAt": "2022-11-21",
   "title": "안산 제일CC 남코스 5분 공략",
   "videoId": "-Qq_Lu7jTpw",
   "views": 11206
  },
  {
   "channel": "리보플TV",
   "likes": 33,
   "publishedAt": "2022-11-14",
   "title": "안산 제일CC 동코스 5분 공략",
   "videoId": "hV0nNzSr6qQ",
   "views": 9554
  }
 ],
 "젠스필드CC": [
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-03-12",
   "title": "젠스필드 CC 드래곤코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "KdGMVMIM5nU",
   "views": 6300
  },
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2025-03-12",
   "title": "젠스필드 CC 힐코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "RzI2Cx_n4I8",
   "views": 5247
  },
  {
   "channel": "리보플TV",
   "likes": 21,
   "publishedAt": "2025-12-08",
   "title": "충북 음성 젠스필드CC 드래곤 코스 5분 공략",
   "videoId": "R3Bs8C2JdKE",
   "views": 2886
  },
  {
   "channel": "리보플TV",
   "likes": 14,
   "publishedAt": "2025-12-15",
   "title": "충북 음성 젠스필드CC 힐 코스.5분 공략",
   "videoId": "kT30gM3KYeY",
   "views": 1813
  }
 ],
 "죽향CC": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-12",
   "title": "죽향 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "51fCIMJbSno",
   "views": 2572
  }
 ],
 "중문골프클럽 (Joong-Moon Country Club)": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-09-25",
   "title": "중문 CC 해안코스. 라운드전 한번에 파악하기.",
   "videoId": "Dko-yM5kexs",
   "views": 2664
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-25",
   "title": "중문 CC 한라코스. 라운드전 한번에 파악하기.",
   "videoId": "AC5STa-XA7Q",
   "views": 1596
  }
 ],
 "중부CC": [
  {
   "channel": "리보플TV",
   "likes": 38,
   "publishedAt": "2022-07-04",
   "title": "곤지암 중부CC 동코스 5분 공략",
   "videoId": "ALeXORmkaXY",
   "views": 9205
  },
  {
   "channel": "리보플TV",
   "likes": 38,
   "publishedAt": "2022-07-04",
   "title": "곤지암 중부CC 서코스 5분 공략",
   "videoId": "rBfz8UVZlCg",
   "views": 8418
  },
  {
   "channel": "밀떡아재",
   "likes": 30,
   "publishedAt": "2021-12-20",
   "title": "[전백시]중부CC 서코스",
   "videoId": "VeHEXE7OT1w",
   "views": 2913
  },
  {
   "channel": "밀떡아재",
   "likes": 19,
   "publishedAt": "2022-01-07",
   "title": "[전백시]중부CC 동코스",
   "videoId": "87daYaMsavU",
   "views": 2704
  }
 ],
 "중원GC": [
  {
   "channel": "밀떡아재",
   "likes": 98,
   "publishedAt": "2020-05-03",
   "title": "[전백시] 중원 CC, 현지 캐디에게 직접 듣는 고구려 코스설명",
   "videoId": "f2K2-Ku6fn4",
   "views": 28723
  },
  {
   "channel": "밀떡아재",
   "likes": 101,
   "publishedAt": "2020-05-10",
   "title": "[전백시] 중원 CC 베테랑 캐디에게 직접 듣는 백제코스 설명",
   "videoId": "wPoXep-tdgI",
   "views": 27577
  },
  {
   "channel": "밀떡아재",
   "likes": 83,
   "publishedAt": "2020-05-13",
   "title": "[전백시] 중원CC 베테랑 캐디에게 직접듣는 신라코스 설명",
   "videoId": "0vENZjxXzDM",
   "views": 25952
  },
  {
   "channel": "맵가이더",
   "likes": 29,
   "publishedAt": "2025-03-12",
   "title": "중원 CC 신라코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "MOyR3q2ljsA",
   "views": 7830
  },
  {
   "channel": "맵가이더",
   "likes": 28,
   "publishedAt": "2025-03-12",
   "title": "중원 CC 백제코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "2xA6SQYh4Bc",
   "views": 7588
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-03-12",
   "title": "중원 CC 고구려코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ypleIqf9Or4",
   "views": 6709
  }
 ],
 "지산CC": [
  {
   "channel": "리보플TV",
   "likes": 34,
   "publishedAt": "2022-07-25",
   "title": "용인 지산CC 남코스 5분 공략",
   "videoId": "2UOE4NH-45Q",
   "views": 9504
  },
  {
   "channel": "리보플TV",
   "likes": 39,
   "publishedAt": "2022-07-25",
   "title": "용인 지산CC 서코스 5분 공략",
   "videoId": "1EUgVuph0lw",
   "views": 8770
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-03-12",
   "title": "지산 CC 동코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "kzWhyoIODaE",
   "views": 2556
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-03-12",
   "title": "지산 CC 남코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "502OVQ925HI",
   "views": 1284
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-12",
   "title": "지산 CC 서코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "XBGL1wHzZ7M",
   "views": 1001
  }
 ],
 "진양밸리GC": [
  {
   "channel": "리보플TV",
   "likes": 130,
   "publishedAt": "2021-06-08",
   "title": "음성 진양밸리cc 밸리코스 공략",
   "videoId": "Aer0JY1tUnk",
   "views": 24974
  },
  {
   "channel": "리보플TV",
   "likes": 18,
   "publishedAt": "2025-03-17",
   "title": "진양밸리 CC 힐코스 5분 공략",
   "videoId": "Lb_a7mnNrac",
   "views": 8622
  },
  {
   "channel": "맵가이더",
   "likes": 30,
   "publishedAt": "2025-03-13",
   "title": "진양밸리 CC 크리크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "_dk_CtfPlx4",
   "views": 6949
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-13",
   "title": "진양밸리 CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "soOQvlaWci8",
   "views": 3930
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-13",
   "title": "진양밸리 CC 힐코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "4aRV1fpCGWI",
   "views": 3821
  }
 ],
 "진주컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-10-24",
   "title": "진주 CC 촉석코스. 라운드전 한번에 파악하기.",
   "videoId": "MQm9q-rQPF8",
   "views": 3777
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-24",
   "title": "진주 CC 남강코스. 라운드전 한번에 파악하기.",
   "videoId": "NO9xL3E8A7E",
   "views": 3560
  }
 ],
 "창원컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-11-10",
   "title": "창원 CC 동코스. 라운드전 한번에 파악하기.",
   "videoId": "q2YxJjmVd9Q",
   "views": 2854
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-11-10",
   "title": "창원 CC 서코스. 라운드전 한번에 파악하기.",
   "videoId": "xlWow0n7Onk",
   "views": 2103
  }
 ],
 "천룡CC": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-11-10",
   "title": "천룡(P) CC OUT코스(퍼블릭). 라운드전 한번에 파악하기.",
   "videoId": "G-VsBLPpQnA",
   "views": 3028
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-18",
   "title": "천룡CC 청룡코스공략. 라운드전 한번에 파악하기.",
   "videoId": "B3vA-obiwyM",
   "views": 2427
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-18",
   "title": "[골프] 천룡CC 황룡코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ZY9T19Lc7nI",
   "views": 1833
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-03-18",
   "title": "[골프] 천룡CC 흑룡코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ZkYjOBNWYAA",
   "views": 1140
  }
 ],
 "천안상록CC": [
  {
   "channel": "밀떡아재",
   "likes": 74,
   "publishedAt": "2023-05-03",
   "title": "천안상록CC / 중코스 \"멀더라도 화성상록 보다는 천안상록으로\"",
   "videoId": "Najx4TZ-ing",
   "views": 21116
  },
  {
   "channel": "밀떡아재",
   "likes": 78,
   "publishedAt": "2023-05-08",
   "title": "천안상록CC / 남코스 \"좌우 폭이 넓은 페어웨이, 장타자에겐 천국\"",
   "videoId": "5r-RKErNzWc",
   "views": 19465
  },
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2025-03-18",
   "title": "천안상록CC 동코스공략. 라운드전 한번에 파악하기.",
   "videoId": "9rsqJc-PME8",
   "views": 5330
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-03-18",
   "title": "[골프] 천안상록CC 남코스공략. 라운드전 한번에 파악하기.",
   "videoId": "mhtmIVeKfPw",
   "views": 4022
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-18",
   "title": "[골프] 천안상록CC 중코스공략. 라운드전 한번에 파악하기.",
   "videoId": "k7L3R0u8clA",
   "views": 3714
  }
 ],
 "칠곡아이위시CC": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-11-13",
   "title": "칠곡아이위시 CC OUT코스(퍼블릭). 라운드전 한번에 파악하기.",
   "videoId": "AEoEsjiKCQg",
   "views": 3641
  }
 ],
 "칼레이트CC": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2024-12-15",
   "title": "군위 칼레이트CC 루비코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "GMXTvQJIyUw",
   "views": 1348
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-12-15",
   "title": "군위 칼레이트CC 사파이어코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "hdgNaE6QeiA",
   "views": 577
  }
 ],
 "캐슬렉스서울GC": [
  {
   "channel": "리보플TV",
   "likes": 15,
   "publishedAt": "2025-09-01",
   "title": "캐슬렉스서울CC Out 코스 (1~9번) 5분 공략",
   "videoId": "vW1hojVTWqI",
   "views": 3596
  },
  {
   "channel": "리보플TV",
   "likes": 6,
   "publishedAt": "2025-09-08",
   "title": "캐슬렉스서울CC In 코스 (10~18번) 5분 공략",
   "videoId": "nrQ2SPU5dgQ",
   "views": 1896
  }
 ],
 "캐슬파인GC": [
  {
   "channel": "리보플TV",
   "likes": 77,
   "publishedAt": "2022-12-19",
   "title": "여주 캐슬파인GC 밸리 코스 5분 공략",
   "videoId": "M-DCRYNHzPk",
   "views": 21013
  },
  {
   "channel": "리보플TV",
   "likes": 77,
   "publishedAt": "2022-12-12",
   "title": "여주 캐슬파인GC 레이크 코스 5분 공략",
   "videoId": "VmX9E1i77nw",
   "views": 17400
  },
  {
   "channel": "밀떡아재",
   "likes": 36,
   "publishedAt": "2022-07-29",
   "title": "[전팔시]결국 테니스 프로도 닝겐이었다! / 캐슬파인CC / 밸리코스",
   "videoId": "bqfrM26GURc",
   "views": 5568
  },
  {
   "channel": "밀떡아재",
   "likes": 38,
   "publishedAt": "2022-07-27",
   "title": "[전팔시]테니스 프로가 골프채를 잡으면 생기는일? / 캐슬파인CC / 레이크코스",
   "videoId": "dBhFhCh8GnY",
   "views": 4384
  },
  {
   "channel": "밀떡아재",
   "likes": 7,
   "publishedAt": "2025-11-12",
   "title": "캐슬파인GC / 밸리코스 \"레이코 코스보단 넓다\" #캐슬파인#코스공략#밸리코스",
   "videoId": "KtcIOxIDRmk",
   "views": 1698
  },
  {
   "channel": "밀떡아재",
   "likes": 8,
   "publishedAt": "2025-11-10",
   "title": "캐슬파인CC / 레이크코스 \"장타자들에겐 까다로운 코스레이아웃\" #파인캐슬GC#코스레이아웃#여주골프장",
   "videoId": "vNdTzQwQ3_Y",
   "views": 549
  }
 ],
 "코리아CC": [
  {
   "channel": "리보플TV",
   "likes": 29,
   "publishedAt": "2024-09-23",
   "title": "용인 코리아CC 챌린지 코스 5분 공략",
   "videoId": "d7ju1zRTW98",
   "views": 7665
  },
  {
   "channel": "리보플TV",
   "likes": 26,
   "publishedAt": "2024-09-16",
   "title": "용인 코리아CC 레이크 코스 5분 공략",
   "videoId": "AFGYySkmqEg",
   "views": 6254
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-09-29",
   "title": "코리아 cc 크리크코스. 라운드전 한번에 파악하기.",
   "videoId": "DN4KstCTXm8",
   "views": 5866
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-09-29",
   "title": "코리아 cc 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "CFs9rXcVMt0",
   "views": 3099
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-09-29",
   "title": "코리아 cc 챌린지코스. 라운드전 한번에 파악하기.",
   "videoId": "Q4cIK0TWJgg",
   "views": 2390
  }
 ],
 "코스카CC": [
  {
   "channel": "밀떡아재",
   "likes": 66,
   "publishedAt": "2023-11-23",
   "title": "코스카CC/릴리코스 \"역시 90돌이 개싸움이 제일 재미있음\"",
   "videoId": "SWKxnF_H5hk",
   "views": 15646
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-03-13",
   "title": "코스카 CC 파인코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "KffJ20ELwJo",
   "views": 4353
  },
  {
   "channel": "밀떡아재",
   "likes": 28,
   "publishedAt": "2023-11-28",
   "title": "코스카CC/파크코스 \"17홀까지 동타. 90돌이의 찐 승자는? \"",
   "videoId": "NQ0L_1CqARQ",
   "views": 4346
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-03-13",
   "title": "코스카 CC 릴리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "cyC_d2bNlmU",
   "views": 3901
  },
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-03-13",
   "title": "코스카 CC 메이플코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "5UKizUcQuhY",
   "views": 3805
  }
 ],
 "크라운 CC": [
  {
   "channel": "밀떡아재",
   "likes": 22,
   "publishedAt": "2021-06-07",
   "title": "[전백시]제주 크라운CC 캐디님 코스설명(동코스)",
   "videoId": "n-Kpvw_ewpk",
   "views": 6197
  },
  {
   "channel": "밀떡아재",
   "likes": 11,
   "publishedAt": "2021-06-16",
   "title": "[전백시]제주 크라운CC 캐디님의 코스설명(서코스)",
   "videoId": "t-RZEvOdCXg",
   "views": 4455
  },
  {
   "channel": "리보플TV",
   "likes": 9,
   "publishedAt": "2024-09-30",
   "title": "제주 크라운CC 서코스 5분 공략",
   "videoId": "qF6zbJCsheY",
   "views": 2595
  },
  {
   "channel": "리보플TV",
   "likes": 4,
   "publishedAt": "2024-10-07",
   "title": "제주 크라운CC 동코스 5분 공략",
   "videoId": "iomjHQ1kTJQ",
   "views": 1639
  }
 ],
 "크리스밸리 CC": [
  {
   "channel": "밀떡아재",
   "likes": 10,
   "publishedAt": "2026-05-26",
   "title": "크리스밸리CC / 마운틴코스 \"좌우폭이 좁은 산악형 코스\"",
   "videoId": "VNDzZyEdhUw",
   "views": 1212
  }
 ],
 "크리스탈밸리 골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-10-24",
   "title": "크리스탈밸리 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "Gm0WPDFdLw4",
   "views": 2838
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-24",
   "title": "크리스탈밸리 CC 크리스탈코스. 라운드전 한번에 파악하기.",
   "videoId": "3BR5R4aJkGM",
   "views": 2740
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2025-07-24",
   "title": "#크리스탈밸리 #골프 #골프스윙 #아이언 #드라이버 #golfswing #golf",
   "videoId": "83uTqNULB1Q",
   "views": 1908
  }
 ],
 "클럽디보은CC": [
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-03-13",
   "title": "클럽디 보은 CC 동코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "YeiyemtQNic",
   "views": 7768
  },
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2025-03-13",
   "title": "클럽디 보은 CC 서코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "EL5IYgCEpvk",
   "views": 7616
  }
 ],
 "클럽모우CC": [
  {
   "channel": "리보플TV",
   "likes": 84,
   "publishedAt": "2021-09-19",
   "title": "홍천 클럽모우 와일드코스 공략",
   "videoId": "q2HGGCoDKGE",
   "views": 24174
  },
  {
   "channel": "리보플TV",
   "likes": 44,
   "publishedAt": "2024-08-05",
   "title": "홍천 클럽모우 오아시스 코스 5분 공략 (재업)",
   "videoId": "6Hyg9dfPpVs",
   "views": 13115
  },
  {
   "channel": "리보플TV",
   "likes": 44,
   "publishedAt": "2021-09-18",
   "title": "홍천 클럽모우 오아시스 코스 공략",
   "videoId": "Amg4gQF6oto",
   "views": 11595
  },
  {
   "channel": "리보플TV",
   "likes": 36,
   "publishedAt": "2024-07-22",
   "title": "홍천 클럽 모우 마운틴코스 5분 공략",
   "videoId": "Vd-Che1gpak",
   "views": 9491
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-26",
   "title": "클럽모우 CC 와일드코스. 라운드전 한번에 파악하기.",
   "videoId": "O2zbPaZa-z0",
   "views": 4391
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-26",
   "title": "클럽모우 CC 오아시스코스. 라운드전 한번에 파악하기.",
   "videoId": "Cu_UMEHkl1E",
   "views": 3510
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-26",
   "title": "클럽모우 CC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "lnvG7t2bd8A",
   "views": 3429
  }
 ],
 "킹스데일CC": [
  {
   "channel": "밀떡아재",
   "likes": 56,
   "publishedAt": "2022-05-20",
   "title": "[3분코스요리]킹스데일CC / 힐코스(캐디님코스설명포함)",
   "videoId": "_pi92Gp9lz0",
   "views": 14688
  },
  {
   "channel": "밀떡아재",
   "likes": 63,
   "publishedAt": "2022-05-18",
   "title": "[3분코스요리]킹스데일CC / 레이크코스(캐디님코스설명포함)",
   "videoId": "_DGNZitPOcw",
   "views": 11478
  }
 ],
 "킹즈락 CC": [
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2025-03-14",
   "title": "킹즈락 CC 웨스트코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "LQyDNeVJrus",
   "views": 6004
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2025-03-14",
   "title": "킹즈락 CC 사우스코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "GC4px0rUZdo",
   "views": 4873
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-14",
   "title": "킹즈락 CC 이스트코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "cSh22nqW-ew",
   "views": 4474
  },
  {
   "channel": "밀떡아재",
   "likes": 5,
   "publishedAt": "2025-12-06",
   "title": "킹즈락CC/웨스트코스 #eat_it_up_spaghetti#킹즈락CC#웨스트코스",
   "videoId": "tJW9fR2Tg9I",
   "views": 362
  },
  {
   "channel": "밀떡아재",
   "likes": 6,
   "publishedAt": "2025-12-08",
   "title": "킹즈락CC/사우스코스 #킹즈락CC#(구)힐데스하임#사우스코스 #golf",
   "videoId": "iRZbUsDnPmY",
   "views": 282
  }
 ],
 "타미우스 골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-10-24",
   "title": "타미우스 CC 우드코스. 라운드전 한번에 파악하기.",
   "videoId": "OQOnhru2pkQ",
   "views": 1558
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-24",
   "title": "타미우스 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "3Zm138U5hn8",
   "views": 1516
  },
  {
   "channel": "맵가이더",
   "likes": 5,
   "publishedAt": "2024-10-24",
   "title": "타미우스 CC 마운틴코스. 라운드전 한번에 파악하기.",
   "videoId": "H3ExYkbcojU",
   "views": 942
  }
 ],
 "타이거CC": [
  {
   "channel": "밀떡아재",
   "likes": 36,
   "publishedAt": "2021-03-02",
   "title": "[전백시]타이거CC 캐디님이 설명해주는 가온코스",
   "videoId": "5lClnURfI-8",
   "views": 13939
  },
  {
   "channel": "밀떡아재",
   "likes": 33,
   "publishedAt": "2021-02-27",
   "title": "[전백시]타이거CC 캐디님이 설명해 주는 누리코스",
   "videoId": "kp25R9ZhcV4",
   "views": 11992
  },
  {
   "channel": "맵가이더",
   "likes": 27,
   "publishedAt": "2025-03-14",
   "title": "타이거 CC 가온코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ikPqXP9yt14",
   "views": 7986
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2025-03-14",
   "title": "타이거 CC 누리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "_HrxW4SUC2M",
   "views": 5310
  }
 ],
 "태기산CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-15",
   "title": "태기산 CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "V1rTZPMxW3U",
   "views": 1790
  }
 ],
 "태인컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-16",
   "title": "태인 CC 레이크코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "Zh2YBwAsgKg",
   "views": 2593
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-16",
   "title": "태인 CC 마운틴코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "xfSu3JAXaAo",
   "views": 2044
  }
 ],
 "테디밸리 골프&리조트": [
  {
   "channel": "밀떡아재",
   "likes": 9,
   "publishedAt": "2025-11-29",
   "title": "테디밸리CC 밸리코스영상 #테디밸리CC#제주도골프장#코스설명",
   "videoId": "eK4kCYCuDxY",
   "views": 1972
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-11-13",
   "title": "테디밸리 CC 테디코스. 라운드전 한번에 파악하기.",
   "videoId": "ZjlWV_ITHHY",
   "views": 1939
  },
  {
   "channel": "밀떡아재",
   "likes": 10,
   "publishedAt": "2025-11-24",
   "title": "테디밸리CC / 테디코스 #테디밸리CC#제주도골프장#테디코스",
   "videoId": "Zrs32tigYYs",
   "views": 1931
  },
  {
   "channel": "밀떡아재",
   "likes": 8,
   "publishedAt": "2022-02-10",
   "title": "[전팔시]테디밸리CC/테디코스",
   "videoId": "vARp48cNstw",
   "views": 1720
  },
  {
   "channel": "밀떡아재",
   "likes": 12,
   "publishedAt": "2022-01-29",
   "title": "테디밸리CC / 밸리코스",
   "videoId": "JVjXThIAFEw",
   "views": 1494
  },
  {
   "channel": "맵가이더",
   "likes": 3,
   "publishedAt": "2024-11-13",
   "title": "테디밸리 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "Ttg9otGdp0M",
   "views": 1026
  }
 ],
 "통도 파인이스트 컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-03-16",
   "title": "통도파인이스트 CC 남 IN코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "55j-ucKCGCA",
   "views": 3147
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-16",
   "title": "통도파인이스트 CC 북 IN코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "q4aNaOrKiR0",
   "views": 2516
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-16",
   "title": "통도파인이스트 CC 북 OUT코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "l18AzkB0Pn8",
   "views": 2395
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-03-16",
   "title": "통도파인이스트 CC 남 OUT코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "LBbNRJkDOvQ",
   "views": 2287
  }
 ],
 "티클라우드CC": [
  {
   "channel": "리보플TV",
   "likes": 46,
   "publishedAt": "2021-09-08",
   "title": "동두천 티클라우드CC 해밀코스 공략",
   "videoId": "BbH9Mmuwvmg",
   "views": 12855
  },
  {
   "channel": "리보플TV",
   "likes": 32,
   "publishedAt": "2021-09-09",
   "title": "동두천 티클라우드CC 비체코스 공략",
   "videoId": "WuFJXvTrdeo",
   "views": 7457
  }
 ],
 "파라지오 컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 24,
   "publishedAt": "2024-10-24",
   "title": "파라지오 CC 레이크코스. 라운드전 한번에 파악하기.",
   "videoId": "cZ9h1mRh3XY",
   "views": 6455
  },
  {
   "channel": "맵가이더",
   "likes": 27,
   "publishedAt": "2024-10-24",
   "title": "파라지오 CC 힐코스. 라운드전 한번에 파악하기.",
   "videoId": "Wr9r91ijKuU",
   "views": 5247
  }
 ],
 "파인리즈CC": [
  {
   "channel": "리보플TV",
   "likes": 47,
   "publishedAt": "2022-05-16",
   "title": "고성 파인리즈CC 리즈코스 5분 공략",
   "videoId": "fhKm6fToFp0",
   "views": 11797
  },
  {
   "channel": "리보플TV",
   "likes": 33,
   "publishedAt": "2022-05-23",
   "title": "고성 파인리즈CC 파인코스 5분 공략",
   "videoId": "rTFJGEA7KB8",
   "views": 7652
  },
  {
   "channel": "리보플TV",
   "likes": 37,
   "publishedAt": "2022-05-30",
   "title": "고성 파인리즈CC 레이크 코스 5분 공략",
   "videoId": "lBiJvcgzn4k",
   "views": 7437
  },
  {
   "channel": "밀떡아재",
   "likes": 35,
   "publishedAt": "2025-07-30",
   "title": "파인리즈CC/리즈코스 \"니가 고성에서 가장 좋은 골프장이었구나?\"",
   "videoId": "BZHeZAy4oVE",
   "views": 4633
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-12-17",
   "title": "파인리즈CC 리즈코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "sfHpWMu6gY0",
   "views": 3514
  },
  {
   "channel": "밀떡아재",
   "likes": 25,
   "publishedAt": "2025-08-04",
   "title": "파인리즈CC/레이크코스 \"여긴 무조건 쳐야하는 코스!\"",
   "videoId": "cfQVG33mm8M",
   "views": 3360
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-12-17",
   "title": "파인리즈CC 파인코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "F9WzsZT4Qyk",
   "views": 3289
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2024-12-17",
   "title": "파인리즈CC 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "GfB7FZ08OR4",
   "views": 2674
  },
  {
   "channel": "밀떡아재",
   "likes": 21,
   "publishedAt": "2025-08-01",
   "title": "파인리즈CC/파인코스 \"블라인드 코스가 너무 많아!\"",
   "videoId": "g78vjc1T_-4",
   "views": 1877
  },
  {
   "channel": "밀떡아재",
   "likes": 7,
   "publishedAt": "2025-08-17",
   "title": "대부분이 블라인드 코스 \"파인리즈CC / 파인코스\"",
   "videoId": "wN1mCf2bS8Y",
   "views": 861
  }
 ],
 "파인밸리CC": [
  {
   "channel": "리보플TV",
   "likes": 41,
   "publishedAt": "2022-12-05",
   "title": "삼척 파인밸리CC 밸리코스 5분 공략",
   "videoId": "SFrgKIlP7Gw",
   "views": 9752
  },
  {
   "channel": "리보플TV",
   "likes": 24,
   "publishedAt": "2022-11-28",
   "title": "삼척 파인밸리CC 파인코스 5분 공략",
   "videoId": "_v7eIz84dbA",
   "views": 7033
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-10-29",
   "title": "파인밸리 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "Z2duAKzgC50",
   "views": 1698
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-10-29",
   "title": "파인밸리 CC 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "d3Da7FFL7TY",
   "views": 1564
  }
 ],
 "파인스톤 CC": [
  {
   "channel": "밀떡아재",
   "likes": 70,
   "publishedAt": "2020-06-05",
   "title": "[전백시]파인스톤CC(파인코스) 현직 캐디에게 듣는 생생한 코스 설명",
   "videoId": "4ndh34ZGMwU",
   "views": 21330
  },
  {
   "channel": "밀떡아재",
   "likes": 46,
   "publishedAt": "2023-10-27",
   "title": "파인스톤CC / 스톤코스 \"화이트티가 이렇게 길었나?\"",
   "videoId": "wa2Anpv538w",
   "views": 12241
  },
  {
   "channel": "밀떡아재",
   "likes": 22,
   "publishedAt": "2023-10-31",
   "title": "파인스톤CC / 파인코스 \"이 골프장 사장이 앞팀이었어?\"",
   "videoId": "CPAcaRxCEko",
   "views": 5001
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2024-11-14",
   "title": "파인스톤 CC 스톤코스. 라운드전 한번에 파악하기.",
   "videoId": "osYbIWLFMOg",
   "views": 4439
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-11-14",
   "title": "파인스톤 CC 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "zfSzlBVgVxI",
   "views": 2930
  }
 ],
 "파인크리크CC": [
  {
   "channel": "리보플TV",
   "likes": 47,
   "publishedAt": "2023-08-21",
   "title": "파인크리크CC 파인코스 5분 공략",
   "videoId": "luHZJ6YFg6E",
   "views": 13513
  },
  {
   "channel": "리보플TV",
   "likes": 43,
   "publishedAt": "2024-07-01",
   "title": "파인크리크CC 크리크 코스 5분 공략",
   "videoId": "dWxT4r-TngA",
   "views": 12176
  },
  {
   "channel": "리보플TV",
   "likes": 39,
   "publishedAt": "2023-08-14",
   "title": "파인크리크CC 밸리코스 5분 공략",
   "videoId": "Hmrnh14pIVo",
   "views": 8988
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-11-16",
   "title": "파인크리크 CC 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "s16dBm6C5PA",
   "views": 2668
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-11-16",
   "title": "파인크리크 CC 크리크코스. 라운드전 한번에 파악하기.",
   "videoId": "1UfSua9frds",
   "views": 2432
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2024-11-16",
   "title": "파인크리크 CC 밸리코스. 라운드전 한번에 파악하기.",
   "videoId": "Hgg2cIgDrbg",
   "views": 1923
  }
 ],
 "파인힐스CC": [
  {
   "channel": "밀떡아재",
   "likes": 50,
   "publishedAt": "2022-01-24",
   "title": "[전백시]순천 파인힐스CC / 파인코스 설명[캐디 티박스 설명포함]",
   "videoId": "Gf_tIVFPlUg",
   "views": 16456
  },
  {
   "channel": "밀떡아재",
   "likes": 31,
   "publishedAt": "2021-09-23",
   "title": "[전백시]순천 파인힐스 CC / 힐코스",
   "videoId": "UmSVAdjC3aY",
   "views": 8730
  },
  {
   "channel": "밀떡아재",
   "likes": 26,
   "publishedAt": "2021-09-19",
   "title": "[전백시]순천 파인힐스CC / 레이크코스",
   "videoId": "N5Pr-B8E13U",
   "views": 5787
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-03-16",
   "title": "파인힐스 CC 파인코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "Klr9oMOL-WE",
   "views": 4872
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2025-03-16",
   "title": "파인힐스 CC 힐스코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "oj0HldOc3QA",
   "views": 3636
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-16",
   "title": "파인힐스 CC 레이크코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "Cj6X75OETUI",
   "views": 2907
  }
 ],
 "파주CC": [
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-10-26",
   "title": "원더클럽 파주 CC 이스트코스. 라운드전 한번에 파악하기.",
   "videoId": "wjeuLxytXzw",
   "views": 6127
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-10-26",
   "title": "원더클럽 파주 CC 웨스트코스. 라운드전 한번에 파악하기.",
   "videoId": "83CqPDl5H3o",
   "views": 4048
  }
 ],
 "파크밸리GC": [
  {
   "channel": "밀떡아재",
   "likes": 58,
   "publishedAt": "2020-06-03",
   "title": "[전백시]파크밸리CC/밸리코스 설명. 캐디보다 더 완벽한 전지적 백돌이가 나타났다.",
   "videoId": "P8mzEt_62YM",
   "views": 18921
  },
  {
   "channel": "밀떡아재",
   "likes": 49,
   "publishedAt": "2020-05-23",
   "title": "[전백시] 파크밸리 CC 현직 캐디에게 듣는 파크코스 공략법",
   "videoId": "a2H0BhrzG44",
   "views": 16878
  },
  {
   "channel": "밀떡아재",
   "likes": 12,
   "publishedAt": "2025-11-17",
   "title": "파크밸리CC 밸리코스 #파크밸리CC#코스설명#코스레이아웃",
   "videoId": "UPRUHoCnlO8",
   "views": 2145
  },
  {
   "channel": "밀떡아재",
   "likes": 5,
   "publishedAt": "2025-11-20",
   "title": "파크밸리CC/파크코스 \"포대그린으로 난이도를 높여놓은 골프장\" #파크밸리#코스영성#코스레이아웃",
   "videoId": "sjDdKOai9Dg",
   "views": 391
  }
 ],
 "팔공컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-03-16",
   "title": "팔공 CC IN 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "dN-ngM7pBn0",
   "views": 3456
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-16",
   "title": "팔공 CC OUT 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "G31itHMVP44",
   "views": 2099
  }
 ],
 "페럼클럽": [
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2025-03-16",
   "title": "페럼클럽 CC 동코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "yvFXLxgheFY",
   "views": 5877
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-03-16",
   "title": "페럼클럽 CC 서코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "g9Jt3v2CNcQ",
   "views": 4217
  }
 ],
 "펜타뷰골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2025-03-22",
   "title": "[골프] 펜타뷰CC OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "rFnPglpW_00",
   "views": 2862
  }
 ],
 "포도CC": [
  {
   "channel": "맵가이더",
   "likes": 32,
   "publishedAt": "2026-04-03",
   "title": "[골프] 포도CC (2026.ver) 샤인 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "gPUJcgKqtFU",
   "views": 3625
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2026-04-03",
   "title": "[골프] 포도CC (2026.ver) 포도 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "Vttp3XqFAcw",
   "views": 1660
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2026-04-03",
   "title": "[골프] 포도CC (2026.ver) 자두 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "LTzFNyyHJbU",
   "views": 1105
  }
 ],
 "포웰CC": [
  {
   "channel": "맵가이더",
   "likes": 39,
   "publishedAt": "2025-03-16",
   "title": "포웰CC안성 오크힐코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "vpOm5yQgpxY",
   "views": 9554
  },
  {
   "channel": "맵가이더",
   "likes": 32,
   "publishedAt": "2025-03-16",
   "title": "포웰CC안성 버치힐코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "sBOJoahdqSQ",
   "views": 8596
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-03-16",
   "title": "포웰CC 김해 힐코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "F0-J9PPQW2k",
   "views": 5844
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-03-16",
   "title": "포웰CC 김해 스카이코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "J4GGtBTuvE8",
   "views": 4795
  }
 ],
 "포천 아도니스CC": [
  {
   "channel": "리보플TV",
   "likes": 25,
   "publishedAt": "2023-09-18",
   "title": "포천 아도니스CC 동코스 5분 공략",
   "videoId": "1av8oDqLpX4",
   "views": 10121
  },
  {
   "channel": "밀떡아재",
   "likes": 34,
   "publishedAt": "2021-12-13",
   "title": "[전백시]포천 아도니스 CC 캐디님 서코스 설명",
   "videoId": "tdLB7mobEw8",
   "views": 9905
  },
  {
   "channel": "밀떡아재",
   "likes": 26,
   "publishedAt": "2021-12-06",
   "title": "[전백시]포천 아도니스 CC 캐디님 동코스 설명",
   "videoId": "AKt_IzGvtQ0",
   "views": 6676
  },
  {
   "channel": "리보플TV",
   "likes": 18,
   "publishedAt": "2023-09-18",
   "title": "포천 아도니스CC 중코스 5분 공략",
   "videoId": "aWO9M-h_DOw",
   "views": 5642
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2026-03-01",
   "title": "[골프] 아도니스 CC (2026.ver) 서 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "EyocfL13Qig",
   "views": 1630
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2026-03-12",
   "title": "[골프] 아도니스CC 퍼블릭 (2026.ver) OUT 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "LdIs8cvApPY",
   "views": 1177
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2026-03-01",
   "title": "[골프] 아도니스 CC (2026.ver) 동 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "StK4Z7PXjWw",
   "views": 819
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2026-03-01",
   "title": "[골프] 아도니스 CC (2026.ver) 중 코스 공략. 라운드전 한번에 파악하기.",
   "videoId": "Vkgf9KPf9vs",
   "views": 651
  }
 ],
 "포천힐스 CC": [
  {
   "channel": "밀떡아재",
   "likes": 21,
   "publishedAt": "2021-08-11",
   "title": "[당골]포천힐스CC/팰리스코스, 마포오픈 4차전(전반전)",
   "videoId": "mvpAkqW3x4k",
   "views": 3411
  },
  {
   "channel": "밀떡아재",
   "likes": 19,
   "publishedAt": "2021-08-14",
   "title": "[당골]포천힐스CC/캐슬코스, 마포오픈 4차전(후반전)",
   "videoId": "IFmEzjQqTBs",
   "views": 3249
  }
 ],
 "포항CC": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-16",
   "title": "[골프] 포항CC 동해 공략. 라운드전 한번에 파악하기.",
   "videoId": "nuIbEj7ZExA",
   "views": 4514
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-03-16",
   "title": "[골프] 포항CC 태백 공략. 라운드전 한번에 파악하기.",
   "videoId": "m5i_pBe_g1U",
   "views": 3572
  }
 ],
 "푸른솔GC 장성": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-12-18",
   "title": "푸른솔GC 장성 레이크코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "DnZATWYdjyM",
   "views": 1577
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-12-18",
   "title": "푸른솔GC 장성 힐코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "lIAoMTOgdiw",
   "views": 1250
  },
  {
   "channel": "맵가이더",
   "likes": 4,
   "publishedAt": "2024-12-18",
   "title": "푸른솔GC 장성 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "B97PdBV3z7w",
   "views": 1050
  }
 ],
 "프린세스GC": [
  {
   "channel": "맵가이더",
   "likes": 29,
   "publishedAt": "2025-03-16",
   "title": "[골프] 프린세스CC 밸리 공략. 라운드전 한번에 파악하기.",
   "videoId": "SnlqUd1M8QI",
   "views": 8136
  },
  {
   "channel": "맵가이더",
   "likes": 29,
   "publishedAt": "2025-03-16",
   "title": "[골프] 프린세스CC 파인 공략. 라운드전 한번에 파악하기.",
   "videoId": "zUIl_pQ30kU",
   "views": 7117
  }
 ],
 "플라밍고 CC": [
  {
   "channel": "밀떡아재",
   "likes": 61,
   "publishedAt": "2023-10-22",
   "title": "플라밍고CC / 듄스코스 \"날 \"좁밥\"이라 부른 너에게...큰 선물을 드리리오.\"",
   "videoId": "KE9u_plwuCA",
   "views": 11413
  },
  {
   "channel": "밀떡아재",
   "likes": 42,
   "publishedAt": "2023-10-19",
   "title": "플라밍고CC / 파크코스 \"나 링크스코스 잘치는 골퍼였던거야?\"",
   "videoId": "F6aT4up8d9s",
   "views": 10240
  },
  {
   "channel": "맵가이더",
   "likes": 40,
   "publishedAt": "2024-10-11",
   "title": "플라밍고 CC 링크스코스. 라운드전 한번에 파악하기.",
   "videoId": "qZlqxJDV_RM",
   "views": 8799
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2024-10-11",
   "title": "플라밍고 CC 파크코스. 라운드전 한번에 파악하기.",
   "videoId": "iNo1CzpbIRc",
   "views": 6130
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-10-11",
   "title": "플라밍고 CC 듄스코스. 라운드전 한번에 파악하기.",
   "videoId": "3RoOFVMG3-o",
   "views": 4319
  }
 ],
 "플라자CC제주": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-03-16",
   "title": "[골프] 플라자CC제주 OUT 공략. 라운드전 한번에 파악하기.",
   "videoId": "J_AWnxm4qgM",
   "views": 858
  }
 ],
 "핀크스 GC": [
  {
   "channel": "리보플TV",
   "likes": 6,
   "publishedAt": "2024-05-13",
   "title": "제주 핀크스GC 동코스 5분 공략",
   "videoId": "v0-1Rgjpnyc",
   "views": 3483
  },
  {
   "channel": "리보플TV",
   "likes": 6,
   "publishedAt": "2025-03-10",
   "title": "제주 핀크스GC 서코스 5분 공략",
   "videoId": "RA7yp4uKTDs",
   "views": 1437
  },
  {
   "channel": "리보플TV",
   "likes": 3,
   "publishedAt": "2024-05-05",
   "title": "제주 핀크스 GC 북코스 5분 공략",
   "videoId": "rGpQaW6KSvA",
   "views": 1373
  },
  {
   "channel": "리보플TV",
   "likes": 2,
   "publishedAt": "2025-03-24",
   "title": "제주 핀크스 GC 북코스 5분 공략 (재업)",
   "videoId": "gqIeYnDDZIg",
   "views": 629
  },
  {
   "channel": "리보플TV",
   "likes": 2,
   "publishedAt": "2025-04-07",
   "title": "제주 핀크스 GC 동코스 5분 공략 (재업)",
   "videoId": "8UyFl2Uf1X8",
   "views": 368
  }
 ],
 "필로스CC": [
  {
   "channel": "밀떡아재",
   "likes": 47,
   "publishedAt": "2023-03-10",
   "title": "필로스CC / 동코스 \"캐디님도 설명할께 없는 단조로운 코스\"",
   "videoId": "CKnEh1BStZs",
   "views": 13843
  },
  {
   "channel": "밀떡아재",
   "likes": 50,
   "publishedAt": "2023-03-15",
   "title": "필로스CC / 서코스 \"동코스보다는 재미있는 코스 레이아웃\"",
   "videoId": "9aqThO2icqk",
   "views": 13042
  }
 ],
 "하이원CC": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-17",
   "title": "[골프] 하이원 CC 밸리 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "7y9VqyY7Ut8",
   "views": 4163
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-17",
   "title": "[골프] 하이원 CC 마운틴 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "GzkySjV3k4A",
   "views": 2909
  }
 ],
 "한라산CC": [
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-03-17",
   "title": "[골프] 한라산 CC 마운틴 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "wyxJ0S2EcYM",
   "views": 1387
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2025-03-17",
   "title": "[골프] 한라산 CC 오션 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "LZsw623oIjE",
   "views": 927
  }
 ],
 "한미르대덕CC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-17",
   "title": "[골프] 한미르대덕 CC OUT 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "lmQmujmJDPE",
   "views": 3646
  }
 ],
 "한성CC": [
  {
   "channel": "밀떡아재",
   "likes": 63,
   "publishedAt": "2023-09-01",
   "title": "한성CC / 오렌지코스 \"태어나 가본 가장 가까운 회원제 골프장\"",
   "videoId": "iU4sr7-GrtE",
   "views": 12902
  },
  {
   "channel": "밀떡아재",
   "likes": 44,
   "publishedAt": "2023-09-05",
   "title": "한성CC / 그린코스 \"품격가득한 골프장 하지만 비싼 그늘집은 어쩔\"",
   "videoId": "qO7Y_mUnhwc",
   "views": 10526
  }
 ],
 "한양파인 CC": [
  {
   "channel": "맵가이더",
   "likes": 30,
   "publishedAt": "2025-03-17",
   "title": "[골프] 한양파인 CC OUT 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "0sWvc56YFMY",
   "views": 5341
  }
 ],
 "한원컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2024-12-20",
   "title": "한원CC 신라코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "54Uwyg8gOcA",
   "views": 5217
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-12-20",
   "title": "한원CC 백제코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "KwxlH_IO2Ls",
   "views": 5206
  },
  {
   "channel": "맵가이더",
   "likes": 19,
   "publishedAt": "2024-12-20",
   "title": "한원CC 고구려코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "b1i_vw_X70w",
   "views": 4413
  }
 ],
 "한탄강CC": [
  {
   "channel": "밀떡아재",
   "likes": 42,
   "publishedAt": "2021-11-02",
   "title": "[전백시]한탄강CC. 이곳은 장타자들의 무덤",
   "videoId": "kjiztvkoBhU",
   "views": 10160
  },
  {
   "channel": "밀떡아재",
   "likes": 42,
   "publishedAt": "2023-12-13",
   "title": "한탄강CC/밸리코스 \"적과의동침 1부\"",
   "videoId": "gz5lJOG4AC4",
   "views": 7715
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-17",
   "title": "[골프] 한탄강 CC 마운틴코스공략. 라운드전 한번에 파악하기.",
   "videoId": "p39Z29rChCQ",
   "views": 5423
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-03-17",
   "title": "[골프] 한탄강 CC 밸리코스공략. 라운드전 한번에 파악하기.",
   "videoId": "TGC9LL_ZXWU",
   "views": 4051
  },
  {
   "channel": "밀떡아재",
   "likes": 23,
   "publishedAt": "2022-06-02",
   "title": "[3분코스요리]한탄강CC/마운틴코스",
   "videoId": "FxZ9wMwyn5k",
   "views": 3303
  },
  {
   "channel": "밀떡아재",
   "likes": 18,
   "publishedAt": "2023-12-19",
   "title": "한탄강CC/마운틴코스 \"적과의동침 2부\"",
   "videoId": "fwsLtr4d9r4",
   "views": 2396
  },
  {
   "channel": "밀떡아재",
   "likes": 23,
   "publishedAt": "2022-06-06",
   "title": "[3분코스요리]한탄강CC / 밸리코스",
   "videoId": "UBM6-CcOm6c",
   "views": 2034
  }
 ],
 "함평천지CC": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-17",
   "title": "[골프] 함평천지 CC OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "cl1bKUvMu8w",
   "views": 2234
  }
 ],
 "해내다 CC": [
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-17",
   "title": "[골프] 해내다 CC 스카이코스공략. 라운드전 한번에 파악하기.",
   "videoId": "xR0Kg6ODjLA",
   "views": 3696
  },
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-17",
   "title": "[골프] 해내다 CC 밸리코스공략. 라운드전 한번에 파악하기.",
   "videoId": "dUF1mlQ7G08",
   "views": 3283
  },
  {
   "channel": "맵가이더",
   "likes": 14,
   "publishedAt": "2025-03-17",
   "title": "[골프] 해내다 CC 마운틴코스공략. 라운드전 한번에 파악하기.",
   "videoId": "OKXvvelWBEk",
   "views": 2947
  }
 ],
 "해병대체력단련장": [
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2025-01-12",
   "title": "해병대체력단련장(덕산대) CC OUT코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "-1CmBRVwZ4Q",
   "views": 3437
  }
 ],
 "해비치CC": [
  {
   "channel": "리보플TV",
   "likes": 28,
   "publishedAt": "2023-11-06",
   "title": "남양주 해비치CC서울 Out 코스 (1~9번) 공략",
   "videoId": "FOB_G9X7VEc",
   "views": 7448
  },
  {
   "channel": "리보플TV",
   "likes": 20,
   "publishedAt": "2023-10-30",
   "title": "남양주 해비치CC서울 In코스 (10~18번) 공략",
   "videoId": "4y0zpBk2vkk",
   "views": 5192
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-03-21",
   "title": "[골프] 해비치CC 서울(남양주) IN코스공략. 라운드전 한번에 파악하기.",
   "videoId": "oMFvyzbOjKc",
   "views": 1120
  },
  {
   "channel": "맵가이더",
   "likes": 7,
   "publishedAt": "2025-03-17",
   "title": "[골프] 해비치CC서울(남양주) OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "P_bh6NJioe4",
   "views": 973
  },
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2025-03-17",
   "title": "[골프] 해비치CC서울(남양주) IN코스공략. 라운드전 한번에 파악하기.",
   "videoId": "JJqVV5SI9qY",
   "views": 665
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2025-03-21",
   "title": "[골프] 해비치CC 서울(남양주) OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "0ptADNJk0d4",
   "views": 528
  }
 ],
 "해솔리아CC": [
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2025-03-17",
   "title": "[골프] 해솔리아CC 솔코스공략. 라운드전 한번에 파악하기.",
   "videoId": "JXx6arSg9E4",
   "views": 6290
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-03-17",
   "title": "해솔리아CC 해코스공략. 라운드전 한번에 파악하기.",
   "videoId": "27v-rHvPww4",
   "views": 5490
  },
  {
   "channel": "맵가이더",
   "likes": 21,
   "publishedAt": "2025-03-17",
   "title": "[골프] 해솔리아CC 리아코스공략. 라운드전 한번에 파악하기.",
   "videoId": "2hwsqYMEAOE",
   "views": 5459
  }
 ],
 "해운대비치골프&리조트": [
  {
   "channel": "맵가이더",
   "likes": 23,
   "publishedAt": "2024-12-24",
   "title": "해운대비치 GC 마운틴코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "FkUPMiXYPK4",
   "views": 7348
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-12-24",
   "title": "해운대비치 GC 오션코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "YVD_SeMDOxQ",
   "views": 6064
  }
 ],
 "해운대컨트리클럽": [
  {
   "channel": "맵가이더",
   "likes": 15,
   "publishedAt": "2024-10-11",
   "title": "해운대 CC 로얄코스. 라운드전 한번에 파악하기.",
   "videoId": "8MnvQnDyuVE",
   "views": 6197
  },
  {
   "channel": "맵가이더",
   "likes": 20,
   "publishedAt": "2024-10-11",
   "title": "해운대 CC 실크코스. 라운드전 한번에 파악하기.",
   "videoId": "bq3U3Lm8uaM",
   "views": 5868
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-10-11",
   "title": "해운대 CC 골드코스. 라운드전 한번에 파악하기.",
   "videoId": "t2WBbdHGpUY",
   "views": 4576
  }
 ],
 "해피니스CC": [
  {
   "channel": "맵가이더",
   "likes": 17,
   "publishedAt": "2025-03-18",
   "title": "[골프] 해피니스CC 힐링코스공략. 라운드전 한번에 파악하기.",
   "videoId": "6c0TAmcPCgM",
   "views": 5593
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2025-03-18",
   "title": "[골프] 해피니스CC 하트코스공략. 라운드전 한번에 파악하기.",
   "videoId": "kkeP8d3VTT8",
   "views": 4947
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-18",
   "title": "[골프] 해피니스CC 해피코스공략. 라운드전 한번에 파악하기.",
   "videoId": "-I-klGD7rc4",
   "views": 2178
  },
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2025-03-18",
   "title": "[골프] 해피니스CC 휴먼코스공략. 라운드전 한번에 파악하기.",
   "videoId": "aB1SSIiV99Q",
   "views": 2055
  }
 ],
 "화산CC": [
  {
   "channel": "리보플TV",
   "likes": 31,
   "publishedAt": "2023-05-01",
   "title": "화산CC Out 코스 (1~9번) 5분 공략",
   "videoId": "1KVL5wIUqsA",
   "views": 6545
  },
  {
   "channel": "밀떡아재",
   "likes": 40,
   "publishedAt": "2023-09-09",
   "title": "화산CC / 인코스 \"그린피 28만원의 회원제 골프장의 코스관리가?\"",
   "videoId": "dXaHtOQeR18",
   "views": 5198
  },
  {
   "channel": "밀떡아재",
   "likes": 32,
   "publishedAt": "2023-09-13",
   "title": "화산CC / 아웃코스 \"캐디님이 살린 화산CC\"",
   "videoId": "S-LLR6F8y1c",
   "views": 4620
  },
  {
   "channel": "리보플TV",
   "likes": 16,
   "publishedAt": "2023-05-08",
   "title": "화산CC In 코스 (10~18번) 5분 공략",
   "videoId": "RI0YA0K8NMQ",
   "views": 3158
  },
  {
   "channel": "맵가이더",
   "likes": 13,
   "publishedAt": "2025-03-18",
   "title": "[골프] 화산CC IN코스공략. 라운드전 한번에 파악하기.",
   "videoId": "GjmaP-nDPL0",
   "views": 2098
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2025-03-18",
   "title": "[골프] 화산CC OUT코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ou3lKjKMr0U",
   "views": 2031
  }
 ],
 "화성골프클럽": [
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-11-19",
   "title": "화성CC OUT코스. 라운드전 한번에 파악하기.",
   "videoId": "bt7HXJXD-9E",
   "views": 3501
  }
 ],
 "화성상록GC": [
  {
   "channel": "맵가이더",
   "likes": 28,
   "publishedAt": "2024-11-19",
   "title": "화성상록 GC 서코스. 라운드전 한번에 파악하기.",
   "videoId": "ZHethBGRy_Y",
   "views": 7448
  },
  {
   "channel": "맵가이더",
   "likes": 26,
   "publishedAt": "2024-11-19",
   "title": "화성상록 GC 동코스. 라운드전 한번에 파악하기.",
   "videoId": "qmUd_F6ZckU",
   "views": 7065
  },
  {
   "channel": "맵가이더",
   "likes": 25,
   "publishedAt": "2024-11-19",
   "title": "화성상록 GC 남코스. 라운드전 한번에 파악하기.",
   "videoId": "30mcZkRTHts",
   "views": 6808
  },
  {
   "channel": "리보플TV",
   "likes": 1,
   "publishedAt": "2026-07-13",
   "title": "동탄 화성상록GC 남코스 5분 공략",
   "videoId": "oKTjcX-KMCc",
   "views": 146
  },
  {
   "channel": "리보플TV",
   "likes": 1,
   "publishedAt": "2026-07-20",
   "title": "동탄 화성상록GC 동코스 5분 공략",
   "videoId": "3oufAPGZ9sI",
   "views": 98
  }
 ],
 "화순CC": [
  {
   "channel": "맵가이더",
   "likes": 6,
   "publishedAt": "2024-11-19",
   "title": "화순 CC 여름코스. 라운드전 한번에 파악하기.",
   "videoId": "PqzuAOhaS-M",
   "views": 2698
  },
  {
   "channel": "맵가이더",
   "likes": 10,
   "publishedAt": "2024-11-19",
   "title": "화순 CC 봄코스. 라운드전 한번에 파악하기.",
   "videoId": "Da6nxnvRHu4",
   "views": 2055
  },
  {
   "channel": "맵가이더",
   "likes": 2,
   "publishedAt": "2024-11-19",
   "title": "화순 CC 가을코스. 라운드전 한번에 파악하기.",
   "videoId": "BRnILcraIrs",
   "views": 1909
  }
 ],
 "휘닉스평창 CC": [
  {
   "channel": "맵가이더",
   "likes": 8,
   "publishedAt": "2024-12-02",
   "title": "휘닉스CC 레이크 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "jtI_OfffdzE",
   "views": 1374
  },
  {
   "channel": "맵가이더",
   "likes": 9,
   "publishedAt": "2024-12-02",
   "title": "휘닉스CC 마운틴 코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "piJlYaEa47U",
   "views": 1118
  }
 ],
 "휘슬링락CC": [
  {
   "channel": "리보플TV",
   "likes": 21,
   "publishedAt": "2024-10-21",
   "title": "춘천 휘슬링락CC 클라우드 코스 5분 공략",
   "videoId": "IZxX4oPvi3E",
   "views": 4916
  },
  {
   "channel": "리보플TV",
   "likes": 13,
   "publishedAt": "2024-10-14",
   "title": "춘천 휘슬링락CC 템플 코스 5분 공략",
   "videoId": "VHqzFU4beu0",
   "views": 4132
  }
 ],
 "히든밸리골프클럽": [
  {
   "channel": "리보플TV",
   "likes": 129,
   "publishedAt": "2021-09-30",
   "title": "진천 히든밸리CC 밸리코스 공략",
   "videoId": "LUo9SfjRmls",
   "views": 33210
  },
  {
   "channel": "리보플TV",
   "likes": 73,
   "publishedAt": "2021-10-01",
   "title": "진천 히든밸리CC 히든코스 공략",
   "videoId": "5PDoaVQpQy8",
   "views": 16161
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2025-07-18",
   "title": "히든밸리 골프장 #골프 #히든밸리 #골프스윙 #아이언 #드라이버 #golf",
   "videoId": "KlPzPWk7c5c",
   "views": 8731
  },
  {
   "channel": "맵가이더",
   "likes": 22,
   "publishedAt": "2024-12-02",
   "title": "히든밸리CC 스카이코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "FvcIpWEnnHo",
   "views": 4845
  },
  {
   "channel": "맵가이더",
   "likes": 16,
   "publishedAt": "2024-12-02",
   "title": "히든밸리CC 밸리코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "ornQoqnqVMw",
   "views": 4107
  },
  {
   "channel": "맵가이더",
   "likes": 18,
   "publishedAt": "2024-12-02",
   "title": "히든밸리CC 히든코스. 코스공략. 라운드전 한번에 파악하기.",
   "videoId": "DrSw7xeXk1o",
   "views": 3747
  }
 ],
 "힐데스하임 CC": [
  {
   "channel": "맵가이더",
   "likes": 37,
   "publishedAt": "2025-03-22",
   "title": "[골프] 힐데스하임CC 힐코스공략. 라운드전 한번에 파악하기.",
   "videoId": "LwO7VldeNbI",
   "views": 9369
  },
  {
   "channel": "맵가이더",
   "likes": 39,
   "publishedAt": "2025-03-22",
   "title": "[골프] 힐데스하임CC 밸리코스공략. 라운드전 한번에 파악하기.",
   "videoId": "K4vxlx1-gxs",
   "views": 9063
  },
  {
   "channel": "맵가이더",
   "likes": 30,
   "publishedAt": "2025-03-22",
   "title": "[골프] 힐데스하임CC 레이크코스공략. 라운드전 한번에 파악하기.",
   "videoId": "lG6hWgOfqHA",
   "views": 6918
  }
 ],
 "힐드로사이CC": [
  {
   "channel": "리보플TV",
   "likes": 46,
   "publishedAt": "2021-09-22",
   "title": "홍천 힐드로사이CC 파인코스 공략",
   "videoId": "GpsK3Kl4BcI",
   "views": 10339
  },
  {
   "channel": "리보플TV",
   "likes": 46,
   "publishedAt": "2021-09-22",
   "title": "홍천 힐드로사이CC 버치코스 공략",
   "videoId": "36l2q2f8-Gw",
   "views": 10332
  },
  {
   "channel": "밀떡아재",
   "likes": 61,
   "publishedAt": "2022-09-20",
   "title": "[전팔시]힐드로사이CC / 버치코스",
   "videoId": "jAEyc8QMBLE",
   "views": 9342
  },
  {
   "channel": "밀떡아재",
   "likes": 43,
   "publishedAt": "2022-09-26",
   "title": "[전팔시]힐드로사이CC / 파인코스",
   "videoId": "eu3wL2cYqys",
   "views": 6523
  },
  {
   "channel": "맵가이더",
   "likes": 11,
   "publishedAt": "2024-09-15",
   "title": "힐드로사이cc 파인코스. 라운드전 한번에 파악하기.",
   "videoId": "ovUjoYPyLos",
   "views": 2380
  },
  {
   "channel": "맵가이더",
   "likes": 12,
   "publishedAt": "2024-09-15",
   "title": "힐드로사이cc 버치코스. 라운드전 한번에 파악하기.",
   "videoId": "RpI0YlbVS5w",
   "views": 2095
  }
 ]
};
