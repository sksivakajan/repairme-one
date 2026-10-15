"""Decides whether the computer is really being used. Pure logic, no operating-system calls."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from statistics import pstdev

SAMPLE_SECONDS = 5  # how often the PC is looked at
SLEEP_GAP_SECONDS = 30  # a longer gap between two looks means the PC slept or the app was paused
MAX_COUNTED_STEP = SAMPLE_SECONDS * 3
RECENT_INPUT_SECONDS = 300  # keyboard or mouse used in the last 5 minutes means someone is at the PC
MAX_NO_INPUT_SECONDS = 1800  # after 30 minutes without keyboard or mouse nothing counts, whatever the PC is doing
WINDOW_SAMPLES = 60  # the "is the PC busy?" window is the last 5 minutes
MIN_WINDOW_SAMPLES = 36  # at least 3 minutes of looks before the PC can be judged
BUSY_CPU_MEAN = 20.0  # sustained, changing load (building, rendering) counts as work without input
BUSY_CPU_STDEV = 3.0


@dataclass
class Sample:
    wall: float  # wall-clock seconds (time.time())
    cpu: float  # whole-PC CPU percent
    ram: float  # whole-PC memory percent
    input_idle: float  # seconds since the last keyboard or mouse use
    locked: bool
    foreground: str  # program name in front, never its window title


class ActivityTracker:
    """Feed it one Sample every few seconds. It keeps counts of active and idle seconds."""

    def __init__(self) -> None:
        self.window: deque[Sample] = deque(maxlen=WINDOW_SAMPLES)
        self.last_wall: float | None = None
        self.active = 0.0
        self.idle = 0.0
        self.state = 'idle'
        self.slept = False

    def feed(self, sample: Sample) -> str:
        step = 0.0 if self.last_wall is None else sample.wall - self.last_wall
        self.last_wall = sample.wall
        self.slept = False
        if step > SLEEP_GAP_SECONDS or step < 0:
            # The PC was asleep, the app was suspended, or the clock jumped: nothing is counted for that gap.
            self.window.clear()
            self.slept = True
            step = 0.0
        step = min(step, MAX_COUNTED_STEP)
        self.window.append(sample)
        self.state = self._classify(sample)
        if self.state == 'active':
            self.active += step
        else:
            self.idle += step
        return self.state

    def _classify(self, sample: Sample) -> str:
        if sample.locked:
            return 'locked'
        if sample.input_idle <= RECENT_INPUT_SECONDS:
            return 'active'
        if sample.input_idle > MAX_NO_INPUT_SECONDS:
            return 'idle'  # someone left: a background program or a changing window is not work
        return 'active' if self.busy() else 'idle'

    def busy(self) -> bool:
        """True when, with no recent input, the PC is under sustained heavy load (a build or a render)."""
        if len(self.window) < MIN_WINDOW_SAMPLES:
            return False
        cpu = [s.cpu for s in self.window]
        return sum(cpu) / len(cpu) >= BUSY_CPU_MEAN and pstdev(cpu) >= BUSY_CPU_STDEV

    def take(self) -> tuple[int, int]:
        """Whole seconds counted since the last call; the fractional rest is kept for next time."""
        active, idle = int(self.active), int(self.idle)
        self.active -= active
        self.idle -= idle
        return active, idle
