"""RepairMe Desktop: the portal in its own window, plus the work tracker, tray icon and Windows notifications.

The employee signs in on the portal page inside the window with their normal username and password. The portal then
hands this app a one-time code through `DesktopApi.pair`, so the computer is connected without typing a code.
"""
from __future__ import annotations

import ctypes
import os
import platform
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

from . import __version__, api, storage
from .ledger import Ledger
from .worker import Worker

DEFAULT_SERVER = os.environ.get('REPAIRME_SERVER', 'https://extraordinary-semolina-40421d.netlify.app')
COLORS = {'active': '#2db86b', 'idle': '#f2b01e', 'locked': '#f2b01e', 'break': '#8b5cf6', 'offline': '#7b8794'}
NOTICE_GAP_SECONDS = 60

OFFLINE_HTML = """<!doctype html><meta charset="utf-8"><title>RepairMe</title>
<style>
 body{margin:0;font:15px Segoe UI,sans-serif;background:#f7f8fa;color:#101820;display:grid;place-items:center;min-height:100vh}
 main{max-width:460px;background:#fff;border:1px solid #e3e7ee;border-radius:12px;padding:32px;text-align:center}
 h1{margin:0 0 8px;font-size:22px} p{color:#6b7686;line-height:1.6} b{font-size:30px;color:#101820;display:block;margin:10px 0 4px}
 button{background:#ffcc00;border:0;border-radius:8px;padding:11px 22px;font-weight:600;cursor:pointer;font-size:14px}
</style>
<main><h1>You are offline</h1>
<p>RepairMe cannot reach the portal right now. Your work time is still being tracked and is stored on this
computer. It uploads by itself when the internet is back.</p>
<b id="today">…</b><p id="wait"></p>
<button onclick="pywebview.api.retry()">Try again</button></main>
<script>
 const fmt=s=>Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';
 window.addEventListener('pywebviewready',async()=>{const s=await pywebview.api.local_summary();
  document.getElementById('today').textContent=fmt(s.today_seconds)+' worked today';
  document.getElementById('wait').textContent=s.unsent_seconds?fmt(s.unsent_seconds)+' waiting to upload':'Everything is uploaded.'});
</script>"""


def already_running() -> bool:
    if sys.platform != 'win32':
        return False
    ctypes.windll.kernel32.CreateMutexW(None, False, 'Local\\RepairMeDesktopSingleInstance')
    return ctypes.windll.kernel32.GetLastError() == 183  # ERROR_ALREADY_EXISTS


def asset(name: str) -> Path:
    base = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent.parent))
    return base / 'assets' / name


def make_icon(color: str):
    """The RepairMe logo mark with a small dot showing the state: green working, amber idle, purple break, grey offline."""
    from PIL import Image, ImageDraw

    try:
        image = Image.open(asset('repairme-64.png')).convert('RGBA')
    except OSError:
        image = Image.new('RGBA', (64, 64), (255, 204, 0, 255))
    draw = ImageDraw.Draw(image)
    draw.ellipse((40, 40, 62, 62), fill=color, outline='white', width=3)
    return image


def fmt_hours(seconds: int | None) -> str:
    seconds = seconds or 0
    return f'{seconds // 3600}h {seconds % 3600 // 60:02d}m'


class DesktopApi:
    """What the portal page may call. Only these methods are visible to it."""

    def __init__(self, app: 'DesktopApp') -> None:
        self._app = app

    def status(self) -> dict:
        return self._app.status()

    def pair(self, code: str, server: str, user_id: str = '') -> dict:
        return self._app.pair(code, server)

    def notify(self, title: str, body: str) -> None:
        self._app.notify(str(title)[:80], str(body)[:200])

    def retry(self) -> None:
        self._app.retry()

    def local_summary(self) -> dict:
        return self._app.local_summary()


class DesktopApp:
    def __init__(self, server: str | None = None, hidden: bool = False) -> None:
        self.config = storage.load_config()
        self.server = api.normalize_server(server or (self.config or {}).get('server') or DEFAULT_SERVER)
        self.hidden = hidden
        self.ledger = Ledger()
        self.worker: Worker | None = None
        self.window = None
        self.icon = None
        self.quitting = False
        self.shown_color = ''
        self.last_notice: tuple[str, float] = ('', 0.0)
        self.js_api = DesktopApi(self)
        if self.config:
            self.start_worker(self.config['server'], self.config['token'])

    # ----- tracking -----
    def start_worker(self, server: str, token: str) -> None:
        self.stop_worker()
        worker = Worker(server, token, ledger=self.ledger, on_update=self.refresh_tray, on_event=self.on_event)
        self.worker = worker
        threading.Thread(target=worker.run, daemon=True).start()

    def stop_worker(self) -> None:
        if self.worker:
            self.worker.stop.set()
            self.worker = None

    def status(self) -> dict:
        config = self.config or {}
        return {
            'paired': bool(self.config),
            'user_id': config.get('user_id') or None,
            'version': __version__,
            'today_seconds': self.ledger.today_seconds(),
        }

    def local_summary(self) -> dict:
        return {'today_seconds': self.ledger.today_seconds(), 'unsent_seconds': self.ledger.unsent_seconds()}

    def pair(self, code: str, server: str) -> dict:
        try:
            address = api.normalize_server(server)
            result = api.pair_full(address, code, socket.gethostname(), platform.platform()[:80], __version__)
        except api.ApiError as error:
            return {'ok': False, 'error': str(error)}
        storage.save(address, result['token'], user_id=result.get('user_id') or '', employee=result.get('employee') or '')
        self.config = storage.load_config()
        self.start_worker(address, result['token'])
        return {'ok': True}

    # ----- notifications and tray -----
    def notify(self, title: str, body: str) -> None:
        key, at = self.last_notice
        if key == title and time.time() - at < NOTICE_GAP_SECONDS:
            return  # the portal page and the tracker can both ask for the same message
        self.last_notice = (title, time.time())
        if self.icon is not None:
            self.icon.notify(body, title)

    def on_event(self, kind: str) -> None:
        if kind == 'break_due':
            self.notify('Time for a coffee break ☕', 'You have worked for an hour. Take a 10-minute break, or push it back.')
            self.show_window()
        elif kind == 'break_over':
            self.notify('Break over', 'Welcome back! Your work time is counting again.')

    def status_line(self) -> str:
        worker = self.worker
        if worker is None:
            return 'Sign in to start tracking'
        if worker.revoked:
            return 'Disconnected by the portal'
        if not worker.online:
            return f'Offline · {fmt_hours(self.ledger.today_seconds())} stored on this PC'
        label = {'active': 'Working', 'idle': 'Idle', 'locked': 'PC locked', 'break': 'Coffee break'}[worker.state]
        return f'{label} · {fmt_hours(worker.today_seconds)} today'

    def refresh_tray(self) -> None:
        if self.icon is None:
            return
        worker = self.worker
        color = COLORS[worker.state if worker and worker.online else 'offline']
        if color != self.shown_color:
            self.icon.icon = make_icon(color)
            self.shown_color = color
        self.icon.title = 'RepairMe · ' + self.status_line()
        if worker and worker.revoked:
            storage.clear()
            self.config = None
            self.notify('Disconnected', 'This computer was disconnected from the portal. Sign in again to reconnect.')
            self.stop_worker()

    def start_tray(self) -> None:
        import pystray

        menu = pystray.Menu(
            pystray.MenuItem(lambda _i: self.status_line(), None, enabled=False),
            pystray.MenuItem('Open RepairMe', lambda _i, _m=None: self.show_window(), default=True),
            pystray.MenuItem('Quit RepairMe', lambda _i, _m=None: self.quit()),
        )
        self.icon = pystray.Icon('RepairMeDesktop', make_icon(COLORS['offline']), 'RepairMe', menu)
        self.icon.run_detached()

    # ----- window -----
    def show_window(self) -> None:
        if self.window is not None:
            self.window.show()
            self.window.restore()

    def on_closing(self) -> bool:
        if self.quitting:
            return True
        if self.window is not None:
            self.window.hide()  # keep tracking: closing the window only sends the app to the tray
        return False

    def quit(self) -> None:
        self.quitting = True
        self.stop_worker()
        if self.icon is not None:
            self.icon.stop()
        if self.window is not None:
            self.window.destroy()

    def reachable(self) -> bool:
        try:
            with urllib.request.urlopen(self.server + '/login', timeout=6):
                return True
        except (urllib.error.URLError, OSError, ValueError):
            return False

    def retry(self) -> None:
        if self.window is not None and self.reachable():
            self.window.load_url(self.server + '/dashboard')

    def run(self) -> None:
        import webview

        self.start_tray()
        online = self.reachable()
        self.window = webview.create_window(
            'RepairMe',
            url=self.server + '/dashboard' if online else None,
            html=None if online else OFFLINE_HTML,
            js_api=self.js_api,
            width=1360,
            height=860,
            min_size=(900, 600),
            hidden=self.hidden,
        )
        self.window.events.closing += self.on_closing
        data = Path(os.environ.get('APPDATA') or Path.home()) / 'RepairMeAgent' / 'webview'
        data.mkdir(parents=True, exist_ok=True)
        icon = asset('repairme.ico')
        webview.start(private_mode=False, storage_path=str(data), icon=str(icon) if icon.exists() else None)
        self.stop_worker()


def main(server: str | None = None, hidden: bool = False) -> int:
    if already_running():
        return 0
    DesktopApp(server, hidden).run()
    return 0
