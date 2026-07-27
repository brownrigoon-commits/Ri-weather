"""ezadmin-mcp — 이지어드민 조회 전용 MCP 서버 (stdio).

⛔ 조회 전용. 쓰기·수정·삭제 도구를 추가하지 않는다.
⛔ stdout 출력 금지 (print 금지) — MCP stdio 전송이 오염되어 연결이 조용히 끊긴다.

실행은 Claude Desktop / Claude Code 가 자동으로 한다. 수동 점검은
`python scripts/selftest.py` 를 사용한다.
"""

from __future__ import annotations

import logging
import sys

from mcp.server.fastmcp import FastMCP

from ezmcp import service

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

mcp = FastMCP(
    "ezadmin",
    instructions=(
        "이지어드민 WMS의 재고·주문·배송 데이터를 조회하는 읽기 전용 서버입니다. "
        "답변할 때는 meta.데이터기준(데이터 시점)과 meta.warnings를 함께 확인해서, "
        "데이터가 오래되었으면 그 사실을 사용자에게 알려 주세요. "
        "고객 개인정보는 서버에서 이미 마스킹되어 있습니다."
    ),
)


@mcp.tool()
def data_status() -> dict:
    """이지어드민 MCP 서버의 연결·데이터 상태를 확인한다.

    언제 쓰나: "이지어드민 연결 됐어?", "데이터 언제 기준이야?", "MCP 상태 확인" 같은 질문.
    또는 다른 조회 결과가 이상할 때 원인을 찾기 위해.

    반환: 데이터 폴더 위치, 주문·재고·반품 파일 수와 최신 수정시각·행수·기간,
    분류되지 않은 상태값 목록(기타상태값), API 설정 상태, 등록된 브랜드 목록, 개인정보 모드.
    """
    return service.data_status()


@mcp.tool()
def inventory_lookup(
    query: str = "",
    brand: str = "",
    low_stock_only: bool = False,
    limit: int = 50,
) -> dict:
    """재고조회 — SKU·상품명·브랜드로 현재 재고 수량과 재고 위치를 조회한다.

    언제 쓰나: "A브랜드 재고 얼마 남았어?", "LM-001 재고 어디 있어?",
    "재고 부족한 것만 보여줘".

    Args:
        query: 상품코드(SKU)·상품명·옵션 부분 검색어. 예: "LM-001", "니트"
        brand: 브랜드명. 등록된 브랜드명이나 별칭. 예: "루미네"
        low_stock_only: True면 가용재고가 안전재고 이하인 품목만 반환
        limit: 최대 표시 건수 (기본 50, 최대 100)

    주의: 재고는 현재 시점 스냅샷이라 기간 개념이 없다. "이번주 재고"를 물어도
    기준 시각(meta.데이터기준)을 함께 안내할 것.
    """
    return service.inventory_lookup(
        query=query, brand=brand, low_stock_only=low_stock_only, limit=limit
    )


@mcp.tool()
def order_lookup(
    order_no: str = "",
    period: str = "",
    start_date: str = "",
    end_date: str = "",
    brand: str = "",
    status: str = "",
    query: str = "",
    limit: int = 20,
) -> dict:
    """주문조회 — 주문번호 단건 상세 또는 기간별 주문 내역을 조회한다.

    언제 쓰나: "이번주 주문 몇 건이야?", "주문번호 20260727-0012 상세 보여줘",
    "루미네 어제 주문", "취소된 주문만".

    Args:
        order_no: 주문번호. 주면 단건 상세(품목·수취인·송장·반품정보)를 반환한다
        period: 기간 키워드 — 오늘/어제/이번주/지난주/최근7일/최근30일/이번달/지난달.
            생략하면 최근7일
        start_date: 시작일 YYYY-MM-DD (period보다 우선)
        end_date: 종료일 YYYY-MM-DD (그날 포함)
        brand: 브랜드명
        status: 상태 필터 — 신규주문/배송준비/배송중/배송완료/취소/반품/교환/보류
        query: 상품명·수취인·주문번호 부분 검색어
        limit: 최대 표시 건수 (기본 20, 최대 100)

    반환의 집계 블록에 총건수·상태별 건수·총수량·총금액이 들어 있으니,
    "몇 건"류 질문은 목록이 아니라 집계로 답할 것.
    """
    return service.order_lookup(
        order_no=order_no,
        period=period,
        start_date=start_date,
        end_date=end_date,
        brand=brand,
        status=status,
        query=query,
        limit=limit,
    )


@mcp.tool()
def unshipped_list(period: str = "", brand: str = "", limit: int = 50) -> dict:
    """미출고목록 — 접수됐지만 아직 출고(송장 등록)되지 않은 주문을 조회한다.

    언제 쓰나: "미출고 몇 건이야?", "출고 안 된 것 오래된 순으로",
    "베르디 미출고 중에 지연된 것".

    Args:
        period: 기간 키워드. 생략하면 전체 기간(오래 방치된 건을 놓치지 않기 위함)
        brand: 브랜드명
        limit: 최대 표시 건수 (기본 50, 최대 100)

    판정 기준: 송장번호가 없고, 상태가 배송중·배송완료·취소·반품·교환이 아닌 건.
    오래된 순으로 정렬되며 경과일과 지연 여부가 함께 나온다.
    """
    return service.unshipped_list(period=period, brand=brand, limit=limit)


@mcp.tool()
def shipping_lookup(
    order_no: str = "",
    tracking_no: str = "",
    period: str = "",
    brand: str = "",
    direction: str = "전체",
    limit: int = 20,
) -> dict:
    """배송조회 — 출고·반품 배송이 어떤 상황인지와 택배사 송장 조회 링크를 준다.

    언제 쓰나: "송장 123456789 지금 어디쯤이야?", "반품 수거 진행 상황",
    "이번주 배송 현황", "주문번호 …의 배송 어떻게 됐어?".

    Args:
        order_no: 주문번호로 단건 검색
        tracking_no: 송장번호로 단건 검색
        period: 기간 키워드. 단건 검색이 아니면 기본 최근7일
        brand: 브랜드명
        direction: "출고" | "반품" | "전체"(기본)
        limit: 최대 표시 건수 (기본 20, 최대 100)

    상태는 이지어드민 파일 기준이다. 실시간 배송 위치는 각 행의 조회링크를
    사용자가 눌러 확인해야 하므로, 답변할 때 링크를 함께 안내할 것.
    """
    return service.shipping_lookup(
        order_no=order_no,
        tracking_no=tracking_no,
        period=period,
        brand=brand,
        direction=direction,
        limit=limit,
    )


if __name__ == "__main__":
    mcp.run()
