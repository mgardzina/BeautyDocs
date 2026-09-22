"""Salon working hours shared by consumer and staff booking flows."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

BOOKING_TIME_ZONE = ZoneInfo("Europe/Warsaw")
BOOKING_DURATION_MINUTES = 60
ALLOWED_SLOT_INTERVALS = frozenset({15, 30, 60})
DEFAULT_OPEN_TIME = "09:00"
DEFAULT_CLOSE_TIME = "17:00"


def default_booking_schedule() -> dict[str, Any]:
    return {
        "slotIntervalMinutes": 30,
        "days": [
            {
                "weekday": weekday,
                "enabled": weekday < 5,
                "opensAt": DEFAULT_OPEN_TIME,
                "closesAt": DEFAULT_CLOSE_TIME,
            }
            for weekday in range(7)
        ],
    }


def clock_minutes(value: object) -> int | None:
    if not isinstance(value, str) or len(value) != 5 or value[2] != ":":
        return None
    try:
        hour, minute = (int(part) for part in value.split(":"))
    except ValueError:
        return None
    if not 0 <= hour <= 23 or minute not in {0, 15, 30, 45}:
        return None
    return hour * 60 + minute


def normalize_booking_schedule(value: object) -> dict[str, Any]:
    default = default_booking_schedule()
    if not isinstance(value, dict):
        return default

    raw_interval = value.get("slotIntervalMinutes")
    interval = (
        raw_interval if raw_interval in ALLOWED_SLOT_INTERVALS else default["slotIntervalMinutes"]
    )
    raw_days = value.get("days")
    if not isinstance(raw_days, list):
        return default

    days_by_weekday: dict[int, dict[str, Any]] = {}
    for item in raw_days:
        if not isinstance(item, dict):
            continue
        weekday = item.get("weekday")
        if not isinstance(weekday, int) or isinstance(weekday, bool) or weekday not in range(7):
            continue
        opens_at = item.get("opensAt")
        closes_at = item.get("closesAt")
        opens_minutes = clock_minutes(opens_at)
        closes_minutes = clock_minutes(closes_at)
        if (
            opens_minutes is None
            or closes_minutes is None
            or closes_minutes - opens_minutes < BOOKING_DURATION_MINUTES
        ):
            opens_at = DEFAULT_OPEN_TIME
            closes_at = DEFAULT_CLOSE_TIME
        days_by_weekday[weekday] = {
            "weekday": weekday,
            "enabled": item.get("enabled") is True,
            "opensAt": opens_at,
            "closesAt": closes_at,
        }

    default_days = {item["weekday"]: item for item in default["days"]}
    return {
        "slotIntervalMinutes": interval,
        "days": [days_by_weekday.get(weekday, default_days[weekday]) for weekday in range(7)],
    }


def booking_day_window(
    schedule: object,
    booking_date: date,
) -> tuple[datetime, datetime] | None:
    normalized = normalize_booking_schedule(schedule)
    day = normalized["days"][booking_date.weekday()]
    if not day["enabled"]:
        return None
    opens_minutes = clock_minutes(day["opensAt"])
    closes_minutes = clock_minutes(day["closesAt"])
    if opens_minutes is None or closes_minutes is None:
        return None
    opens_at = datetime.combine(
        booking_date,
        time(hour=opens_minutes // 60, minute=opens_minutes % 60),
        tzinfo=BOOKING_TIME_ZONE,
    )
    closes_at = datetime.combine(
        booking_date,
        time(hour=closes_minutes // 60, minute=closes_minutes % 60),
        tzinfo=BOOKING_TIME_ZONE,
    )
    return opens_at, closes_at


def booking_start_allowed(
    schedule: object,
    starts_at: datetime,
    *,
    duration_minutes: int = BOOKING_DURATION_MINUTES,
) -> bool:
    local_start = starts_at.astimezone(BOOKING_TIME_ZONE)
    window = booking_day_window(schedule, local_start.date())
    if window is None:
        return False
    opens_at, closes_at = window
    ends_at = local_start + timedelta(minutes=duration_minutes)
    normalized = normalize_booking_schedule(schedule)
    interval = int(normalized["slotIntervalMinutes"])
    minutes_from_open = int((local_start - opens_at).total_seconds() // 60)
    return (
        local_start >= opens_at
        and ends_at <= closes_at
        and minutes_from_open % interval == 0
        and local_start.second == 0
        and local_start.microsecond == 0
    )
