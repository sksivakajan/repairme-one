"""Only one RepairMe Desktop runs per Windows user. A second launch asks the running copy to show its window.

Closing the window only hides it (tracking keeps running in the tray), so opening the app again must bring that
hidden window back instead of quietly doing nothing.
"""
from __future__ import annotations

import ctypes
import os
import sys
import threading
from ctypes import wintypes
from typing import Callable

IS_WINDOWS = sys.platform == 'win32'
ERROR_ALREADY_EXISTS = 183
EVENT_MODIFY_STATE = 0x0002
INFINITE = 0xFFFFFFFF
WAIT_OBJECT_0 = 0


def _kernel32():
    k = ctypes.windll.kernel32
    k.CreateMutexW.restype = wintypes.HANDLE
    k.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    k.CreateEventW.restype = wintypes.HANDLE
    k.CreateEventW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR]
    k.SetEvent.argtypes = [wintypes.HANDLE]
    k.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    k.WaitForSingleObject.restype = wintypes.DWORD
    k.CloseHandle.argtypes = [wintypes.HANDLE]
    return k


class SingleInstance:
    """`first` is True for the first copy. Later copies call `ask_running_copy_to_show()` and exit."""

    def __init__(self, name: str | None = None) -> None:
        suffix = name if name is not None else os.environ.get('REPAIRME_INSTANCE_ID', '')
        self.first = True
        self._stop = threading.Event()
        if not IS_WINDOWS:
            self._k = None
            return
        self._k = _kernel32()
        self._mutex = self._k.CreateMutexW(None, False, f'Local\\RepairMeDesktopSingleInstance{suffix}')
        self.first = ctypes.windll.kernel32.GetLastError() != ERROR_ALREADY_EXISTS
        # Auto-reset event: signalled by a later launch, consumed by the running copy.
        self._event = self._k.CreateEventW(None, False, False, f'Local\\RepairMeDesktopShow{suffix}')

    def ask_running_copy_to_show(self) -> None:
        if self._k is not None and self._event:
            self._k.SetEvent(self._event)

    def watch(self, on_show: Callable[[], None]) -> threading.Thread:
        """In the running copy: call `on_show` each time another launch asks for the window."""

        def loop() -> None:
            while not self._stop.is_set() and self._k is not None:
                if self._k.WaitForSingleObject(self._event, 500) == WAIT_OBJECT_0:
                    try:
                        on_show()
                    except Exception:  # a failed show must not stop the watcher
                        pass

        thread = threading.Thread(target=loop, daemon=True)
        thread.start()
        return thread

    def close(self) -> None:
        self._stop.set()
