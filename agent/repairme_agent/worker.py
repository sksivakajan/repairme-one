"""The background loop: look at the PC every few seconds, report to the portal every 30 seconds."""
from __future__ import annotations

import threading
import time
from typing import Callable

from . import __version__, api, system
from .activity import SAMPLE_SECONDS, ActivityTracker, Sample

HEARTBEAT_SECONDS = 30
MAX_REPORTED_SECONDS = 120  # the portal never credits more than this per report


def read_sample() -> Sample:
    totals = system.machine_totals()
    locked = system.is_locked()
    return Sample(
        wall=time.time(),
        cpu=totals['cpu_percent'],
        ram=totals['ram_percent'],
        input_idle=system.input_idle_seconds(),
        locked=locked,
        foreground='' if locked else system.foreground_app(),
    )


class Worker:
    def __init__(
        self,
        server: str,
        token: str,
        *,
        sampler: Callable[[], Sample] = read_sample,
        machine: Callable[[], dict] = system.machine_totals,
        processes: Callable[[], tuple[int, list[dict]]] | None = None,
        send: Callable[[str, str, dict], dict] = api.heartbeat,
        clock: Callable[[], float] = time.monotonic,
        on_update: Callable[[], None] | None = None,
    ) -> None:
        self.server, self.token = server, token
        self.tracker = ActivityTracker()
        self.sampler, self.machine, self.send, self.clock = sampler, machine, send, clock
        self.processes = processes or system.ProcessWatcher().snapshot
        self.on_update = on_update or (lambda: None)
        self.cpu_seen: list[float] = []
        self.last_report = clock()
        self.online = False
        self.revoked = False
        self.today_seconds: int | None = None
        self.last_error = ''
        self.last_sample: Sample | None = None

    @property
    def state(self) -> str:
        return self.tracker.state

    def step(self) -> None:
        sample = self.sampler()
        self.last_sample = sample
        self.cpu_seen.append(sample.cpu)
        self.tracker.feed(sample)
        if self.clock() - self.last_report >= HEARTBEAT_SECONDS:
            self.report()
        self.on_update()

    def build_report(self) -> dict:
        active, _idle = self.tracker.take()
        sample = self.last_sample
        totals = self.machine()
        count, top = self.processes()
        cpu = sum(self.cpu_seen) / len(self.cpu_seen) if self.cpu_seen else totals['cpu_percent']
        self.cpu_seen = []
        return {
            'state': self.tracker.state,
            'active_seconds': min(active, MAX_REPORTED_SECONDS),
            'cpu_percent': round(min(max(cpu, 0), 100), 1),
            'ram_percent': round(min(max(totals['ram_percent'], 0), 100), 1),
            'ram_used_mb': totals['ram_used_mb'],
            'ram_total_mb': totals['ram_total_mb'],
            'cpu_count': totals['cpu_count'],
            'process_count': count,
            'foreground_app': sample.foreground if sample else '',
            'input_idle_seconds': int(sample.input_idle) if sample else 0,
            'agent_version': __version__,
            'top_apps': top,
        }

    def report(self) -> None:
        # Time is counted once: whatever happens next, these seconds are not re-sent later.
        self.last_report = self.clock()
        payload = self.build_report()
        try:
            result = self.send(self.server, self.token, payload)
            self.online = True
            self.last_error = ''
            self.today_seconds = result.get('today_active_seconds', self.today_seconds)
        except api.ApiError as error:
            self.online = False
            self.last_error = str(error)
            if error.revoked:
                self.revoked = True

    def run(self, stop: threading.Event) -> None:
        while not stop.is_set() and not self.revoked:
            try:
                self.step()
            except Exception as error:  # keep running; one bad reading must not stop tracking
                self.last_error = f'Reading failed: {error}'
            stop.wait(SAMPLE_SECONDS)
