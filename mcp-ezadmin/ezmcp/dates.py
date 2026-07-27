"""기간 해석 — KST 기준 (design/04).

엑셀에서 읽은 날짜는 tz 정보가 없는 '한국 시간 벽시계 값'이다.
따라서 기간 경계도 KST로 계산한 뒤 tzinfo를 떼어 naive 값으로 비교한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo

PERIOD_KEYWORDS = (
    "오늘",
    "어제",
    "이번주",
    "지난주",
    "최근7일",
    "최근30일",
    "이번달",
    "지난달",
)

_DATE_INPUT_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y%m%d")


def kst() -> tzinfo:
    """Asia/Seoul. Windows에 tzdata가 없으면 고정 오프셋(+09:00)으로 폴백."""
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo("Asia/Seoul")
    except Exception:  # noqa: BLE001 - tzdata 부재 등 어떤 실패든 폴백
        return timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """현재 시각 (KST, naive)."""
    return datetime.now(kst()).replace(tzinfo=None)


def today_kst() -> date:
    return now_kst().date()


@dataclass
class Period:
    start: datetime | None
    end: datetime | None
    label: str

    def contains(self, value: datetime | None) -> bool:
        if value is None:
            return False
        if self.start is not None and value < self.start:
            return False
        if self.end is not None and value > self.end:
            return False
        return True

    @property
    def is_open(self) -> bool:
        return self.start is None and self.end is None


def _day_start(d: date) -> datetime:
    return datetime.combine(d, time.min)


def _day_end(d: date) -> datetime:
    return datetime.combine(d, time.max)


def _parse_input_date(value: str) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in _DATE_INPUT_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def resolve_period(
    period: str = "",
    start_date: str = "",
    end_date: str = "",
    default: str = "",
) -> Period:
    """기간 파라미터를 해석한다.

    start_date / end_date 가 있으면 period 보다 우선하며, end_date 는 그날을 포함한다.
    셋 다 비어 있으면 `default` 키워드를 사용하고, default 도 비면 기간 제한 없음.
    """
    start_explicit = _parse_input_date(start_date)
    end_explicit = _parse_input_date(end_date)

    if start_explicit or end_explicit:
        start = _day_start(start_explicit) if start_explicit else None
        end = _day_end(end_explicit) if end_explicit else None
        label = "%s ~ %s" % (
            start_explicit.isoformat() if start_explicit else "처음",
            end_explicit.isoformat() if end_explicit else "오늘",
        )
        return Period(start, end, label)

    keyword = str(period or "").strip().replace(" ", "")
    if not keyword:
        keyword = str(default or "").strip().replace(" ", "")
    if not keyword:
        return Period(None, None, "전체")

    today = today_kst()
    aliases = {
        "금일": "오늘",
        "당일": "오늘",
        "전일": "어제",
        "최근7": "최근7일",
        "최근일주일": "최근7일",
        "일주일": "최근7일",
        "최근30": "최근30일",
        "한달": "최근30일",
        "이달": "이번달",
        "당월": "이번달",
        "전월": "지난달",
    }
    keyword = aliases.get(keyword, keyword)

    if keyword == "오늘":
        start, end = _day_start(today), _day_end(today)
    elif keyword == "어제":
        y = today - timedelta(days=1)
        start, end = _day_start(y), _day_end(y)
    elif keyword == "이번주":
        monday = today - timedelta(days=today.weekday())
        start, end = _day_start(monday), _day_end(today)
    elif keyword == "지난주":
        monday = today - timedelta(days=today.weekday())
        last_monday = monday - timedelta(days=7)
        start, end = _day_start(last_monday), _day_end(monday - timedelta(days=1))
    elif keyword == "최근7일":
        start, end = _day_start(today - timedelta(days=6)), _day_end(today)
    elif keyword == "최근30일":
        start, end = _day_start(today - timedelta(days=29)), _day_end(today)
    elif keyword == "이번달":
        start, end = _day_start(today.replace(day=1)), _day_end(today)
    elif keyword == "지난달":
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        start, end = _day_start(last_prev.replace(day=1)), _day_end(last_prev)
    else:
        return Period(
            None,
            None,
            "전체 (알 수 없는 기간 '%s' — 사용 가능: %s)"
            % (keyword, ", ".join(PERIOD_KEYWORDS)),
        )

    return Period(start, end, "%s ~ %s (%s)" % (start.date(), end.date(), keyword))


def fmt_dt(value: datetime | None, with_time: bool = True) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d %H:%M" if with_time else "%Y-%m-%d")


def days_since(value: datetime | None) -> int | None:
    if value is None:
        return None
    return (today_kst() - value.date()).days
