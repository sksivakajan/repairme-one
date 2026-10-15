"""Tray icon, first-run pairing window, and start-with-Windows."""
from __future__ import annotations

import ctypes
import os
import platform
import socket
import sys
import threading
import tkinter as tk
import webbrowser
from tkinter import ttk

from . import __version__, api, storage
from .worker import Worker

DEFAULT_SERVER = os.environ.get('REPAIRME_SERVER', 'https://extraordinary-semolina-40421d.netlify.app')
PRIVACY = (
    'This app tells the portal whether this computer is awake and in use, so your work time is '
    'counted accurately. It sends: active / idle / locked, seconds since your last keyboard or mouse '
    'use (never what you type), CPU and memory use, and the names of the busiest programs and the '
    'program in front. It never records your screen, keystrokes, window titles, files or web pages. '
    'While the PC sleeps or this app is closed, no time is counted.'
)


def already_running() -> bool:
    if sys.platform != 'win32':
        return False
    ctypes.windll.kernel32.CreateMutexW(None, False, 'Local\\RepairMeAgentSingleInstance')
    return ctypes.windll.kernel32.GetLastError() == 183  # ERROR_ALREADY_EXISTS


def enable_autostart() -> None:
    if sys.platform != 'win32' or not getattr(sys, 'frozen', False):
        return
    import winreg

    with winreg.OpenKey(
        winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Run', 0, winreg.KEY_SET_VALUE
    ) as key:
        winreg.SetValueEx(key, 'RepairMeAgent', 0, winreg.REG_SZ, f'"{sys.executable}"')


def ask_to_pair() -> tuple[str, str] | None:
    result: dict[str, tuple[str, str]] = {}
    root = tk.Tk()
    root.title('Connect RepairMe Agent')
    root.resizable(False, False)
    frame = ttk.Frame(root, padding=16)
    frame.grid()
    ttk.Label(frame, text='Connect this computer to RepairMe', font=('Segoe UI', 13, 'bold')).grid(
        sticky='w', pady=(0, 8)
    )
    ttk.Label(frame, text=PRIVACY, wraplength=420, justify='left').grid(sticky='w', pady=(0, 10))
    ttk.Label(frame, text='Portal address').grid(sticky='w')
    server = tk.StringVar(value=DEFAULT_SERVER)
    ttk.Entry(frame, textvariable=server, width=52).grid(sticky='we', pady=(0, 8))
    ttk.Label(frame, text='Connection code (from Attendance → Desktop agent → Connect this PC)').grid(sticky='w')
    code = tk.StringVar()
    entry = ttk.Entry(frame, textvariable=code, width=24, font=('Consolas', 13))
    entry.grid(sticky='w', pady=(0, 8))
    status = tk.StringVar()
    ttk.Label(frame, textvariable=status, foreground='#b23a3a', wraplength=420).grid(sticky='w')

    def connect() -> None:
        try:
            address = api.normalize_server(server.get())
            token = api.pair(address, code.get(), socket.gethostname(), platform.platform()[:80], __version__)
            storage.save(address, token)
            result['ok'] = (address, token)
            root.destroy()
        except api.ApiError as error:
            status.set(str(error))

    buttons = ttk.Frame(frame)
    buttons.grid(sticky='e', pady=(10, 0))
    ttk.Button(buttons, text='Cancel', command=root.destroy).grid(row=0, column=0, padx=6)
    ttk.Button(buttons, text='Connect', command=connect).grid(row=0, column=1)
    root.bind('<Return>', lambda _e: connect())
    entry.focus_set()
    root.mainloop()
    return result.get('ok')


def make_icon(color: str):
    from PIL import Image, ImageDraw

    image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((4, 4, 60, 60), 14, fill='#ffcc00')
    draw.ellipse((14, 14, 50, 50), outline='#101820', width=5)
    draw.line((32, 32, 32, 21), fill='#101820', width=5)
    draw.line((32, 32, 41, 32), fill='#101820', width=5)
    draw.ellipse((40, 40, 60, 60), fill=color, outline='white', width=3)
    return image


COLORS = {'active': '#2db86b', 'idle': '#f2b01e', 'locked': '#f2b01e', 'offline': '#7b8794'}


def run_tray(server: str, token: str) -> None:
    import pystray

    stop = threading.Event()
    holder: dict[str, object] = {}

    def status_line() -> str:
        worker: Worker = holder['worker']  # type: ignore[assignment]
        if worker.revoked:
            return 'Disconnected by the portal'
        if not worker.online:
            return f'Offline · {worker.last_error or "waiting for the portal"}'
        label = {'active': 'Working', 'idle': 'Idle', 'locked': 'PC locked'}[worker.state]
        today = worker.today_seconds
        return f'{label}' + (f' · {today // 3600}h {today % 3600 // 60:02d}m today' if today is not None else '')

    def refresh() -> None:
        worker: Worker = holder['worker']  # type: ignore[assignment]
        icon: pystray.Icon = holder['icon']  # type: ignore[assignment]
        key = worker.state if worker.online else 'offline'
        if holder.get('shown') != key:
            icon.icon = make_icon(COLORS[key])
            holder['shown'] = key
        icon.title = 'RepairMe Agent · ' + status_line()
        if worker.revoked:
            storage.clear()
            icon.notify('This computer was disconnected from the portal.', 'RepairMe Agent')
            stop.set()
            icon.stop()

    worker = Worker(server, token, on_update=refresh)
    holder['worker'] = worker
    menu = pystray.Menu(
        pystray.MenuItem(lambda _i: status_line(), None, enabled=False),
        pystray.MenuItem('Open portal', lambda _i, _m=None: webbrowser.open(server)),
        pystray.MenuItem(
            'Disconnect this PC',
            lambda i, _m=None: (storage.clear(), stop.set(), i.stop()),
        ),
    )
    icon = pystray.Icon('RepairMeAgent', make_icon(COLORS['offline']), 'RepairMe Agent', menu)
    holder['icon'] = icon

    def setup(icon: pystray.Icon) -> None:
        icon.visible = True
        threading.Thread(target=worker.run, args=(stop,), daemon=True).start()

    icon.run(setup)
    stop.set()


def main(argv: list[str]) -> int:
    if already_running():
        return 0
    saved = storage.load()
    if saved is None:
        saved = ask_to_pair()
        if saved is None:
            return 1
        enable_autostart()
    run_tray(*saved)
    return 0
