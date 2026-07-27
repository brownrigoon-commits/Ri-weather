"""개인정보 마스킹 (design/06).

기본 모드는 항상 `masked`. 코드 기본값을 `full` 로 바꾸지 않는다.
"""

from __future__ import annotations

import re

MASKED_PLACEHOLDER = "(마스킹됨)"

# extras(미매핑 컬럼) 중 개인정보로 취급할 헤더 키워드
PII_HEADER_KEYWORDS = (
    "전화",
    "휴대폰",
    "핸드폰",
    "연락처",
    "주소",
    "이메일",
    "메일",
    "메모",
    "배송메시지",
    "배송메세지",
    "요청사항",
    "수취인",
    "수령인",
    "수하인",
    "주문자",
    "구매자",
    "받는사람",
    "받는분",
    "우편번호",
)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+$")


def mask_name(value) -> str:
    """홍길동 → 홍*동, 남궁민수 → 남**수, 김민 → 김*, 김 → *"""
    text = str(value or "").strip()
    if not text:
        return ""
    if len(text) == 1:
        return "*"
    if len(text) == 2:
        return text[0] + "*"
    return text[0] + "*" * (len(text) - 2) + text[-1]


def mask_phone(value) -> str:
    """010-1234-5678 → 010-****-5678 (하이픈 등 원래 서식 유지)."""
    text = str(value or "").strip()
    if not text:
        return ""
    positions = [i for i, ch in enumerate(text) if ch.isdigit()]
    total = len(positions)
    if total == 0:
        return text
    if total >= 8:
        lo, hi = total - 8, total - 5
    elif total > 3:
        lo, hi = 1, total - 3
    else:
        lo, hi = 0, total - 1
    chars = list(text)
    for idx in range(lo, hi + 1):
        chars[positions[idx]] = "*"
    return "".join(chars)


def mask_address(value) -> str:
    """서울 강남구 역삼동 123-4 5층 → 서울 강남구 역삼동 ***"""
    text = str(value or "").strip()
    if not text:
        return ""
    tokens = text.split()
    return " ".join(tokens[:3]) + " ***"


def mask_email(value) -> str:
    text = str(value or "").strip()
    if not text or "@" not in text:
        return text
    local, _, domain = text.partition("@")
    return "%s***@%s" % (local[:2], domain)


def is_pii_header(header: str) -> bool:
    text = str(header or "")
    return any(word in text for word in PII_HEADER_KEYWORDS)


class Masker:
    """pii_mode 에 따라 개인정보 항목을 마스킹/제거/원본 처리."""

    def __init__(self, mode: str = "masked"):
        self.mode = mode if mode in ("masked", "summary", "full") else "masked"

    @property
    def hide(self) -> bool:
        """summary 모드 — 개인정보 항목을 응답에서 아예 제거."""
        return self.mode == "summary"

    @property
    def raw(self) -> bool:
        return self.mode == "full"

    def name(self, value) -> str:
        text = str(value or "").strip()
        return text if self.raw else mask_name(text)

    def phone(self, value) -> str:
        text = str(value or "").strip()
        return text if self.raw else mask_phone(text)

    def address(self, value) -> str:
        text = str(value or "").strip()
        return text if self.raw else mask_address(text)

    def email(self, value) -> str:
        text = str(value or "").strip()
        return text if self.raw else mask_email(text)

    def put(self, row: dict, key: str, value, kind: str = "name") -> None:
        """summary 모드면 키 자체를 넣지 않고, 그 외에는 모드에 맞게 변환해 넣는다."""
        if self.hide:
            return
        fn = {
            "name": self.name,
            "phone": self.phone,
            "address": self.address,
            "email": self.email,
        }.get(kind, self.name)
        row[key] = fn(value)

    def extras(self, extras: dict | None) -> dict:
        """미매핑 컬럼 처리 (design/06)."""
        result: dict[str, str] = {}
        for header, value in (extras or {}).items():
            if not is_pii_header(header):
                result[header] = value
                continue
            if self.hide:
                continue
            if self.raw:
                result[header] = value
            elif _EMAIL_RE.match(str(value or "").strip()):
                result[header] = mask_email(value)
            else:
                result[header] = MASKED_PLACEHOLDER
        return result
