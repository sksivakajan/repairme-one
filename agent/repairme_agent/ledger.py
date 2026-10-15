"""Stores work time on this computer so nothing is lost when the portal cannot be reached.

Seconds counted since the last report are kept in `window`. When a report reaches the portal they were already
credited live and are dropped. When it fails they move to `backlog` (kept on disk) and are uploaded, minute by
minute, with the next report that gets through. The portal credits each minute once.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

MAX_BACKLOG_MINUTES = 3 * 24 * 60  # the portal accepts the last 3 days
CHUNK = 120


def ledger_path() -> Path:
    base = os.environ.get('APPDATA') or str(Path.home())
    return Path(base) / 'RepairMeAgent' / 'worklog.json'


def minute_key(wall: float) -> str:
    stamp = datetime.fromtimestamp(wall - wall % 60, tz=timezone.utc)
    return stamp.strftime('%Y-%m-%dT%H:%M:00Z')


def day_key(wall: float) -> str:
    return time.strftime('%Y-%m-%d', time.localtime(wall))


class Ledger:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or ledger_path()
        self.window: dict[str, float] = {}
        self.backlog: dict[str, int] = {}
        self.days: dict[str, int] = {}
        try:
            raw = json.loads(self.path.read_text())
            self.backlog = {k: int(v) for k, v in raw.get('backlog', {}).items()}
            self.days = {k: int(v) for k, v in raw.get('days', {}).items()}
        except (OSError, ValueError, AttributeError):
            pass

    def add(self, wall: float, seconds: float) -> None:
        """Count active seconds at a moment in time."""
        if seconds <= 0:
            return
        key = minute_key(wall)
        self.window[key] = min(60.0, self.window.get(key, 0.0) + seconds)
        day = day_key(wall)
        self.days[day] = self.days.get(day, 0) + round(seconds)

    def commit_window(self, credited: bool) -> None:
        """Call after a report. Credited seconds are done; uncredited ones wait in the backlog."""
        if not credited:
            for key, seconds in self.window.items():
                whole = round(seconds)
                if whole > 0:
                    self.backlog[key] = min(60, self.backlog.get(key, 0) + whole)
        self.window = {}
        for key in sorted(self.backlog)[: max(0, len(self.backlog) - MAX_BACKLOG_MINUTES)]:
            del self.backlog[key]
        for key in sorted(self.days)[:-60]:
            del self.days[key]
        self.save()

    def pending(self, limit: int = CHUNK) -> list[dict]:
        return [{'minute': key, 'seconds': self.backlog[key]} for key in sorted(self.backlog)[:limit]]

    def acknowledge(self, sent: list[dict]) -> None:
        for item in sent:
            self.backlog.pop(item['minute'], None)
        self.save()

    def today_seconds(self, now: float | None = None) -> int:
        return self.days.get(day_key(now or time.time()), 0)

    def unsent_seconds(self) -> int:
        return sum(self.backlog.values())

    def save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temp = self.path.with_suffix('.tmp')
            temp.write_text(json.dumps({'backlog': self.backlog, 'days': self.days}))
            temp.replace(self.path)
        except OSError:
            pass
