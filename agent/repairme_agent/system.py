"""Reads what the operating system shows: idle time, locked screen, program in front, CPU, memory."""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

import psutil

IS_WINDOWS = sys.platform == 'win32'
IGNORED = {'system idle process', 'idle', 'system', 'registry', 'memory compression', ''}


class _LastInput(ctypes.Structure):
    _fields_ = [('cbSize', wintypes.UINT), ('dwTime', wintypes.DWORD)]


def input_idle_seconds() -> float:
    """Seconds since the last keyboard or mouse use. Only the time is read, never what was typed."""
    if not IS_WINDOWS:
        return 0.0
    info = _LastInput()
    info.cbSize = ctypes.sizeof(_LastInput)
    if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
        return 0.0
    ticks = ctypes.windll.kernel32.GetTickCount()
    return ((ticks - info.dwTime) & 0xFFFFFFFF) / 1000.0


def is_locked() -> bool:
    if not IS_WINDOWS:
        return False
    desktop = ctypes.windll.user32.OpenInputDesktop(0, False, 0x0100)
    if not desktop:
        return True  # the lock screen / secure desktop is showing
    ctypes.windll.user32.CloseDesktop(desktop)
    return False


def foreground_app() -> str:
    """Name of the program in front (for example chrome.exe). Window titles are deliberately not read."""
    if not IS_WINDOWS:
        return ''
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        pid = wintypes.DWORD()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        return psutil.Process(pid.value).name()[:60] if pid.value else ''
    except (psutil.Error, OSError):
        return ''


class ProcessWatcher:
    """Totals CPU and memory per program name and reports the busiest few."""

    def __init__(self) -> None:
        self.known: dict[int, psutil.Process] = {}
        self.cpu_count = psutil.cpu_count() or 1

    def snapshot(self, limit: int = 8) -> tuple[int, list[dict]]:
        totals: dict[str, list[float]] = {}
        alive: dict[int, psutil.Process] = {}
        count = 0
        for proc in psutil.process_iter():
            count += 1
            try:
                known = self.known.get(proc.pid)
                if known is None or known.create_time() != proc.create_time():
                    known = proc
                    known.cpu_percent(None)  # the first call only primes the counter
                alive[proc.pid] = known
                name = known.name()
                if name.lower() in IGNORED:
                    continue
                cpu = known.cpu_percent(None) / self.cpu_count
                ram = known.memory_info().rss / 1048576
                entry = totals.setdefault(name[:60], [0.0, 0.0])
                entry[0] += cpu
                entry[1] += ram
            except (psutil.Error, OSError):
                continue
        self.known = alive
        ranked = sorted(totals.items(), key=lambda kv: kv[1][0] + kv[1][1] / 1024, reverse=True)
        return count, [
            {'name': name, 'cpu': round(cpu, 1), 'ram_mb': round(ram, 1)}
            for name, (cpu, ram) in ranked[:limit]
        ]


def machine_totals() -> dict:
    memory = psutil.virtual_memory()
    return {
        'cpu_percent': psutil.cpu_percent(None),
        'ram_percent': memory.percent,
        'ram_used_mb': int(memory.used / 1048576),
        'ram_total_mb': int(memory.total / 1048576),
        'cpu_count': psutil.cpu_count() or 0,
    }
