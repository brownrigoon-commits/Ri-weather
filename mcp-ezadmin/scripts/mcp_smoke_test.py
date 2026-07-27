"""MCP stdio 프로토콜 왕복 확인 (design/08).

server.py 를 실제로 기동해 initialize → list_tools → 도구 호출까지 해 본다.
Claude Desktop 이 하는 일과 같은 절차라서, 이게 통과하면 연결 문제는 설정 파일 쪽이다.

사용법:
    python scripts/mcp_smoke_test.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 한국 Windows에서 출력을 파일로 리다이렉트할 때의 cp949 인코딩 오류 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from mcp import ClientSession, StdioServerParameters  # noqa: E402
from mcp.client.stdio import stdio_client  # noqa: E402

EXPECTED_TOOLS = {
    "data_status",
    "inventory_lookup",
    "order_lookup",
    "unshipped_list",
    "shipping_lookup",
}

RESULTS: list[tuple[bool, str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    RESULTS.append((bool(ok), name, detail))
    return bool(ok)


def payload_of(result) -> dict:
    """도구 응답에서 dict 를 꺼낸다 (structuredContent 우선, 없으면 텍스트 JSON)."""
    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        return structured.get("result", structured)
    for item in getattr(result, "content", []) or []:
        text = getattr(item, "text", None)
        if not text:
            continue
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            continue
    return {}


async def run() -> int:
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(ROOT / "server.py")],
        cwd=str(ROOT),
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            init = await session.initialize()
            check("서버 기동 및 initialize", bool(init.serverInfo.name), str(init.serverInfo))

            listed = await session.list_tools()
            names = {tool.name for tool in listed.tools}
            check("도구 5개 등록", names == EXPECTED_TOOLS, str(sorted(names)))
            check(
                "도구 설명(한국어) 존재",
                all(tool.description and tool.description.strip() for tool in listed.tools),
            )

            status = payload_of(await session.call_tool("data_status", {}))
            check("data_status 호출", status.get("서버") == "ezadmin-mcp", str(status)[:120])
            check("data_status meta 포함", "meta" in status)

            inventory = payload_of(
                await session.call_tool("inventory_lookup", {"limit": 5})
            )
            check(
                "inventory_lookup 호출",
                "목록" in inventory and "meta" in inventory,
                str(inventory)[:120],
            )

            orders = payload_of(
                await session.call_tool("order_lookup", {"period": "최근7일", "limit": 3})
            )
            check("order_lookup 호출", "집계" in orders or "안내" in orders, str(orders)[:120])

            unshipped = payload_of(await session.call_tool("unshipped_list", {"limit": 3}))
            check("unshipped_list 호출", "총건수" in unshipped, str(unshipped)[:120])

            shipping = payload_of(
                await session.call_tool("shipping_lookup", {"direction": "전체", "limit": 3})
            )
            check("shipping_lookup 호출", "총건수" in shipping, str(shipping)[:120])

    print("")
    failed = 0
    for ok, name, detail in RESULTS:
        mark = "PASS" if ok else "FAIL"
        line = "  [%s] %s" % (mark, name)
        if not ok:
            failed += 1
            line += "  → %s" % (detail or "조건 불만족")
        print(line)
    print("")
    print("-" * 60)
    print("MCP 스모크 테스트: 통과 %d · 실패 %d" % (len(RESULTS) - failed, failed))
    print("-" * 60)
    return 1 if failed else 0


def main() -> int:
    try:
        return asyncio.run(run())
    except Exception as exc:  # noqa: BLE001
        print("MCP 서버 연결 실패: %s: %s" % (type(exc).__name__, exc))
        print("→ python scripts/selftest.py 를 먼저 돌려 서버 로직부터 확인하세요.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
