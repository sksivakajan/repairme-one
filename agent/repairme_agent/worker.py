"""The background loop: look at the PC every few seconds, report to the portal every 30 seconds."""
from __future__ import annotations

import threading
import time
from typing import Callable

from . import __version__, api, system
from .activity import SAMPLE_SECONDS, ActivityTracker, Sample
from .ledger import Ledger

HEARTBEAT_SECONDS = 30
MAX_REPORTED_SECONDS = 120  # the portal never credits more than this per live report


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
        ledger: Ledger | None = None,
        on_update: Callable[[], None] | None = None,
        on_event: Callable[[str], None] | None = None,
    ) -> None:
        self.server, self.token = server, token
        self.tracker = ActivityTracker()
        self.sampler, self.machine, self.send, self.clock = sampler, machine, send, clock
        self.processes = processes or system.ProcessWatcher().snapshot
        self.ledger = ledger or Ledger()
        self.on_update = on_update or (lambda: None)
        self.on_event = on_event or (lambda _event: None)
        self.cpu_seen: list[float] = []
        self.last_report = clock()
        self.online = False
        self.revoked = False
        self.today_seconds: int | None = None
        self.last_error = ''
        self.last_sample: Sample | None = None
        self.work: dict = {}
        self.stop = threading.Event()

    @property
    def state(self) -> str:
        return 'break' if self.work.get('on_break') else self.tracker.state

    def step(self) -> None:
        sample = self.sampler()
        self.last_sample = sample
        self.cpu_seen.append(sample.cpu)
        before = self.tracker.active
        self.tracker.feed(sample)
        self.ledger.add(sample.wall, self.tracker.active - before)
        if self.clock() - self.last_report >= HEARTBEAT_SECONDS:
            self.report()
        self.on_update()

    def build_report(self, backlog: list[dict]) -> dict:
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
            'backlog': backlog,
            'top_apps': top,
        }

    def report(self) -> None:
        # Time is counted once: this window is either credited now or stored for a later upload.
        self.last_report = self.clock()
        backlog = self.ledger.pending()
        payload = self.build_report(backlog)
        try:
            result = self.send(self.server, self.token, payload)
        except api.ApiError as error:
            self.online = False
            self.last_error = str(error)
            if error.revoked:
                self.revoked = True
            else:
                self.ledger.commit_window(credited=False)
            return
        self.online = True
        self.last_error = ''
        self.ledger.commit_window(credited=True)
        self.ledger.acknowledge(backlog)
        self.today_seconds = result.get('today_active_seconds', self.today_seconds)
        self._work_events(result.get('work') or {})

    def _work_events(self, work: dict) -> None:
        before = self.work
        self.work = work
        if work.get('break_due') and not before.get('break_due'):
            self.on_event('break_due')
        if before.get('on_break') and not work.get('on_break'):
            self.on_event('break_over')

    def run(self) -> None:
        while not self.stop.is_set() and not self.revoked:
            try:
                self.step()
            except Exception as error:  # keep running; one bad reading must not stop tracking
                self.last_error = f'Reading failed: {error}'
            self.stop.wait(SAMPLE_SECONDS)
