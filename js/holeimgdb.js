/* Ri-Weather 공식 홀맵 이미지 DB
 * 각 골프장 공식 홈페이지의 홀맵을 그대로 표시 (출처 표기).
 * 파·거리는 골프존 실측 데이터 기준.
 */
const HOLEIMG_DB = {
  "서서울CC": {
    source: "서서울CC(H1클럽) 공식 홈페이지",
    sourceUrl: "https://www.h1club.co.kr/html/course.asp",
    courses: [
      { name: "레이크", holes: [
        { no: 1, par: 4, len: 367, img: "holeimg/seoseoul/n_L1.jpg" },
        { no: 2, par: 5, len: 440, img: "holeimg/seoseoul/n_L2.jpg" },
        { no: 3, par: 4, len: 339, img: "holeimg/seoseoul/n_L3.jpg" },
        { no: 4, par: 3, len: 159, img: "holeimg/seoseoul/n_L4.jpg" },
        { no: 5, par: 4, len: 287, img: "holeimg/seoseoul/n_L5.jpg" },
        { no: 6, par: 5, len: 441, img: "holeimg/seoseoul/n_L6.jpg" },
        { no: 7, par: 4, len: 238, img: "holeimg/seoseoul/n_L7.jpg" },
        { no: 8, par: 3, len: 131, img: "holeimg/seoseoul/n_L8.jpg" },
        { no: 9, par: 4, len: 302, img: "holeimg/seoseoul/n_L9.jpg" },
      ]},
      { name: "마운틴", holes: [
        { no: 1, par: 4, len: 326, img: "holeimg/seoseoul/n_M1.jpg" },
        { no: 2, par: 5, len: 436, img: "holeimg/seoseoul/n_M2.jpg" },
        { no: 3, par: 4, len: 386, img: "holeimg/seoseoul/n_M3.jpg" },
        { no: 4, par: 3, len: 150, img: "holeimg/seoseoul/n_M4.jpg" },
        { no: 5, par: 4, len: 353, img: "holeimg/seoseoul/n_M5.jpg" },
        { no: 6, par: 5, len: 435, img: "holeimg/seoseoul/n_M6.jpg" },
        { no: 7, par: 4, len: 316, img: "holeimg/seoseoul/n_M7.jpg" },
        { no: 8, par: 3, len: 167, img: "holeimg/seoseoul/n_M8.jpg" },
        { no: 9, par: 4, len: 319, img: "holeimg/seoseoul/n_M9.jpg" },
      ]},
    ],
  },
};
