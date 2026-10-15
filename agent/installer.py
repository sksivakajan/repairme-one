"""RepairMe Desktop installer.

Pages: Welcome, Privacy, Location, Installing, Finish. Also works without a window for IT rollouts:

    RepairMeSetup.exe /S                      silent install for the current user
    RepairMeSetup.exe /S --dir "D:\\Apps\\RepairMe" --no-autostart --no-shortcuts
    RepairMeSetup.exe --uninstall [/S] [--purge]
"""
from __future__ import annotations

import argparse
import ctypes
import os
import shutil
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

from repairme_agent import __version__

IS_WINDOWS = sys.platform == 'win32'
APP_ID = os.environ.get('REPAIRME_INSTALL_ID', 'RepairMeDesktop')
DISPLAY = 'RepairMe Desktop' if APP_ID == 'RepairMeDesktop' else f'RepairMe Desktop ({APP_ID})'
APP_EXE = 'RepairMeDesktop.exe'
SETUP_EXE = 'RepairMeSetup.exe'
UNINSTALL_KEY = rf'Software\Microsoft\Windows\CurrentVersion\Uninstall\{APP_ID}'
RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
WEBVIEW2_URL = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703'
PRIVACY = (
    'RepairMe Desktop shows your company workspace in its own window and measures your work time.\n\n'
    'It sends to your company portal:\n'
    '  • whether this computer is active, idle or locked\n'
    '  • seconds since you last used the keyboard or mouse (never what you type)\n'
    '  • CPU and memory use, the number of running programs, the names of the busiest programs, and the program in front\n\n'
    'It never records your screen, keystrokes, window titles, files or web pages.\n\n'
    'While the computer sleeps or the app is closed, no time is counted. If the internet drops, work time is kept on this computer and uploaded later.\n\n'
    'After 60 minutes of continuous work you are offered a 10-minute coffee break, with a Windows notification.\n\n'
    'You sign in with your normal RepairMe username and password. You can remove the app at any time from Settings → Apps.'
)


def asset(name: str) -> Path:
    base = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
    return base / 'assets' / name


def default_dir() -> Path:
    return Path(os.environ.get('LOCALAPPDATA') or Path.home()) / 'Programs' / 'RepairMe'


def payload() -> Path:
    base = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
    for candidate in (base / 'payload' / APP_EXE, Path(__file__).resolve().parent / 'dist' / APP_EXE):
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f'{APP_EXE} is missing from the installer')


def webview2_installed() -> bool:
    if not IS_WINDOWS:
        return True
    import winreg

    guid = r'Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    for root, path in (
        (winreg.HKEY_LOCAL_MACHINE, rf'SOFTWARE\WOW6432Node\{guid}'),
        (winreg.HKEY_LOCAL_MACHINE, rf'SOFTWARE\{guid}'),
        (winreg.HKEY_CURRENT_USER, rf'Software\{guid}'),
    ):
        try:
            with winreg.OpenKey(root, path) as key:
                if winreg.QueryValueEx(key, 'pv')[0] not in ('', '0.0.0.0'):
                    return True
        except OSError:
            continue
    return False


def start_menu() -> Path:
    return Path(os.environ.get('APPDATA') or Path.home()) / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs'


def desktop_folder() -> Path:
    return Path(os.environ.get('USERPROFILE') or Path.home()) / 'Desktop'


def make_shortcut(link: Path, target: Path, args: str = '') -> None:
    script = (
        '$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:RM_LINK);'
        '$s.TargetPath=$env:RM_TARGET;$s.Arguments=$env:RM_ARGS;'
        '$s.WorkingDirectory=Split-Path $env:RM_TARGET;$s.IconLocation=$env:RM_TARGET;$s.Save()'
    )
    link.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ['powershell', '-NoProfile', '-NonInteractive', '-Command', script],
        env={**os.environ, 'RM_LINK': str(link), 'RM_TARGET': str(target), 'RM_ARGS': args},
        check=True,
        capture_output=True,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )


def stop_running_app() -> None:
    if IS_WINDOWS:
        subprocess.run(['taskkill', '/F', '/IM', APP_EXE], capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))


def install(target: Path, autostart: bool = True, shortcuts: bool = True, desktop_icon: bool = False, register: bool = True, say=print) -> Path:
    say('Closing any running copy…')
    stop_running_app()
    say('Copying files…')
    target.mkdir(parents=True, exist_ok=True)
    app = target / APP_EXE
    shutil.copy2(payload(), app)
    setup = target / SETUP_EXE
    if getattr(sys, 'frozen', False):
        shutil.copy2(sys.executable, setup)  # kept for the uninstaller
    if IS_WINDOWS and register:
        import winreg

        say('Registering the app…')
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as key:
            for name, value in (
                ('DisplayName', DISPLAY),
                ('DisplayVersion', __version__),
                ('Publisher', 'RepairMe'),
                ('InstallLocation', str(target)),
                ('DisplayIcon', str(app)),
                ('UninstallString', f'"{setup}" --uninstall'),
                ('QuietUninstallString', f'"{setup}" --uninstall /S'),
            ):
                winreg.SetValueEx(key, name, 0, winreg.REG_SZ, value)
            winreg.SetValueEx(key, 'NoModify', 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, 'NoRepair', 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, 'EstimatedSize', 0, winreg.REG_DWORD, app.stat().st_size // 1024)
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as run:
            try:
                winreg.DeleteValue(run, 'RepairMeAgent')  # the older tray-only agent
            except OSError:
                pass
            if autostart:
                winreg.SetValueEx(run, APP_ID, 0, winreg.REG_SZ, f'"{app}" --minimized')
            else:
                try:
                    winreg.DeleteValue(run, APP_ID)
                except OSError:
                    pass
    if IS_WINDOWS and shortcuts:
        say('Creating shortcuts…')
        make_shortcut(start_menu() / f'{DISPLAY}.lnk', app)
        if desktop_icon:
            make_shortcut(desktop_folder() / f'{DISPLAY}.lnk', app)
    say('Done.')
    return app


def uninstall(target: Path | None = None, purge: bool = False, say=print) -> None:
    if IS_WINDOWS:
        import winreg

        if target is None:
            try:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as key:
                    target = Path(winreg.QueryValueEx(key, 'InstallLocation')[0])
            except OSError:
                target = default_dir()
        say('Closing the app…')
        stop_running_app()
        for link in (start_menu() / f'{DISPLAY}.lnk', desktop_folder() / f'{DISPLAY}.lnk'):
            link.unlink(missing_ok=True)
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as run:
                winreg.DeleteValue(run, APP_ID)
        except OSError:
            pass
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY)
        except OSError:
            pass
    target = target or default_dir()
    say('Removing files…')
    for name in (APP_EXE,):
        (target / name).unlink(missing_ok=True)
    if purge:
        shutil.rmtree(Path(os.environ.get('APPDATA') or Path.home()) / 'RepairMeAgent', ignore_errors=True)
    # This program may be the installed copy, which cannot delete itself while it runs.
    leftovers = [p for p in target.glob('*') if p.name != SETUP_EXE]
    for item in leftovers:
        shutil.rmtree(item, ignore_errors=True) if item.is_dir() else item.unlink(missing_ok=True)
    if (target / SETUP_EXE).exists():
        if Path(sys.executable).resolve() == (target / SETUP_EXE).resolve():
            # One string, because cmd cannot read the quoting Python adds to an argument list.
            line = f'cmd /c "ping -n 3 127.0.0.1 >nul & del /f /q "{target / SETUP_EXE}" & rmdir "{target}""'
            subprocess.Popen(line, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        else:
            (target / SETUP_EXE).unlink(missing_ok=True)
            try:
                target.rmdir()
            except OSError:
                pass
    else:
        try:
            target.rmdir()
        except OSError:
            pass
    say('Removed.')


def wizard(start: Path) -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    root = tk.Tk()
    root.title(f'{DISPLAY} Setup')
    root.geometry('640x460')
    root.resizable(False, False)
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except (AttributeError, OSError):
        pass
    header = tk.Frame(root, bg='white', height=70, highlightbackground='#ffcc00', highlightthickness=0)
    header.pack(fill='x')
    tk.Frame(root, bg='#ffcc00', height=3).pack(fill='x')
    try:
        root.iconbitmap(str(asset('repairme.ico')))
        logo = tk.PhotoImage(file=str(asset('wordmark-header.png')))
        tk.Label(header, image=logo, bg='white').pack(side='left', padx=20, pady=8)
        header.image = logo  # keep a reference so the picture is not discarded
    except tk.TclError:
        tk.Label(header, text='RepairMe', bg='white', fg='#101820', font=('Segoe UI', 18, 'bold')).pack(side='left', padx=20, pady=12)
    body = ttk.Frame(root, padding=22)
    body.pack(fill='both', expand=True)
    footer = ttk.Frame(root, padding=(22, 0, 22, 18))
    footer.pack(fill='x')

    folder = tk.StringVar(value=str(start))
    autostart = tk.BooleanVar(value=True)
    desktop_icon = tk.BooleanVar(value=False)
    agree = tk.BooleanVar(value=False)
    launch = tk.BooleanVar(value=True)
    log = tk.StringVar(value='Starting…')
    state = {'page': 0, 'installed': None, 'failed': '', 'done': False, 'log': 'Starting…'}
    back = ttk.Button(footer, text='Back')
    nxt = ttk.Button(footer, text='Next')
    cancel = ttk.Button(footer, text='Cancel', command=root.destroy)
    cancel.pack(side='right', padx=(8, 0))
    nxt.pack(side='right')
    back.pack(side='right', padx=8)

    def clear() -> None:
        for child in body.winfo_children():
            child.destroy()

    def heading(text: str) -> None:
        ttk.Label(body, text=text, font=('Segoe UI', 15, 'bold')).pack(anchor='w', pady=(0, 10))

    def render() -> None:
        clear()
        page = state['page']
        back.state(['!disabled' if page in (1, 2) else 'disabled'])
        nxt.state(['!disabled'])
        nxt.configure(text='Next')
        cancel.state(['!disabled'])
        if page == 0:
            heading(f'Welcome to {DISPLAY}')
            ttk.Label(
                body,
                wraplength=580,
                justify='left',
                text='This sets up RepairMe Desktop on this computer: your company workspace in its own window, '
                'your tasks, a work-time watch and coffee-break reminders.\n\nYou sign in with your normal RepairMe '
                'username and password.\n\nClick Next to continue.',
            ).pack(anchor='w')
        elif page == 1:
            heading('What RepairMe Desktop does')
            box = tk.Text(body, height=14, wrap='word', font=('Segoe UI', 10), relief='solid', borderwidth=1)
            box.insert('1.0', PRIVACY)
            box.configure(state='disabled')
            box.pack(fill='both', expand=True)
            ttk.Checkbutton(body, text='I have read this and I agree', variable=agree, command=lambda: nxt.state(['!disabled' if agree.get() else 'disabled'])).pack(anchor='w', pady=(10, 0))
            nxt.state(['!disabled' if agree.get() else 'disabled'])
        elif page == 2:
            heading('Choose where to install')
            row = ttk.Frame(body)
            row.pack(fill='x')
            ttk.Entry(row, textvariable=folder, width=62).pack(side='left', fill='x', expand=True)
            ttk.Button(row, text='Browse…', command=lambda: folder.set(filedialog.askdirectory(initialdir=folder.get()) or folder.get())).pack(side='left', padx=(8, 0))
            ttk.Checkbutton(body, text='Start RepairMe when I sign in to Windows (recommended, so work time is tracked)', variable=autostart).pack(anchor='w', pady=(16, 2))
            ttk.Checkbutton(body, text='Add a shortcut to the desktop', variable=desktop_icon).pack(anchor='w')
            if not webview2_installed():
                ttk.Label(body, foreground='#b23a3a', wraplength=580, justify='left', text='Microsoft Edge WebView2 was not found. RepairMe needs it to show the workspace. It is part of Windows 11; for Windows 10 it will be offered for download when you finish.').pack(anchor='w', pady=(16, 0))
            nxt.configure(text='Install')
        elif page == 3:
            heading('Installing')
            bar = ttk.Progressbar(body, mode='indeterminate', length=560)
            bar.pack(anchor='w', pady=(6, 10))
            bar.start(12)
            ttk.Label(body, textvariable=log).pack(anchor='w')
            nxt.state(['disabled'])
            cancel.state(['disabled'])

            # Window variables are read here, on the main thread; the worker thread must not touch them.
            chosen = (Path(folder.get()), autostart.get(), desktop_icon.get())

            def work() -> None:
                try:
                    state['installed'] = install(chosen[0], chosen[1], True, chosen[2], True, lambda m: state.update(log=m))
                except Exception as error:  # show the reason instead of closing silently
                    state['failed'] = str(error)
                state['done'] = True

            def poll() -> None:
                # The window is only touched from this thread; the installer thread just sets flags.
                log.set(state['log'])
                if state['done']:
                    finish()
                else:
                    root.after(150, poll)

            threading.Thread(target=work, daemon=True).start()
            root.after(150, poll)
        else:
            if state['failed']:
                heading('Installation failed')
                ttk.Label(body, wraplength=580, text=state['failed']).pack(anchor='w')
            else:
                heading('RepairMe Desktop is installed')
                ttk.Label(body, wraplength=580, justify='left', text='Sign in with your RepairMe username and password. This connects the computer automatically, and tracking starts when you check in.').pack(anchor='w')
                ttk.Checkbutton(body, text='Open RepairMe Desktop now', variable=launch).pack(anchor='w', pady=(14, 0))
            back.state(['disabled'])
            cancel.state(['disabled'])
            nxt.configure(text='Finish')
            nxt.state(['!disabled'])

    def finish() -> None:
        state['page'] = 4
        render()

    def advance() -> None:
        if state['page'] == 4:
            if not state['failed'] and launch.get() and state['installed']:
                subprocess.Popen([str(state['installed'])], creationflags=0x00000008)
            if not webview2_installed():
                if messagebox.askyesno(DISPLAY, 'Microsoft Edge WebView2 is needed. Open the download page now?'):
                    webbrowser.open(WEBVIEW2_URL)
            root.destroy()
            return
        state['page'] += 1
        render()

    def previous() -> None:
        state['page'] -= 1
        render()

    nxt.configure(command=advance)
    back.configure(command=previous)
    render()
    root.mainloop()


def main() -> int:
    parser = argparse.ArgumentParser(prog='RepairMeSetup', add_help=True)
    parser.add_argument('--silent', action='store_true')
    parser.add_argument('--dir')
    parser.add_argument('--no-autostart', action='store_true')
    parser.add_argument('--no-shortcuts', action='store_true')
    parser.add_argument('--no-register', action='store_true')
    parser.add_argument('--desktop-icon', action='store_true')
    parser.add_argument('--no-launch', action='store_true')
    parser.add_argument('--uninstall', action='store_true')
    parser.add_argument('--purge', action='store_true')
    argv = ['--silent' if a.lower() in ('/s', '/silent') else a for a in sys.argv[1:]]
    args = parser.parse_args(argv)
    target = Path(args.dir) if args.dir else default_dir()
    if args.uninstall:
        if not args.silent:
            import tkinter as tk
            from tkinter import messagebox

            root = tk.Tk()
            root.withdraw()
            if not messagebox.askyesno(DISPLAY, f'Remove {DISPLAY} from this computer?'):
                return 1
            purge = messagebox.askyesno(DISPLAY, 'Also delete your saved sign-in and the work time stored on this computer?')
            uninstall(Path(args.dir) if args.dir else None, purge, lambda _m: None)
            messagebox.showinfo(DISPLAY, 'RepairMe Desktop was removed.')
            return 0
        uninstall(Path(args.dir) if args.dir else None, args.purge)
        return 0
    if args.silent:
        app = install(target, not args.no_autostart, not args.no_shortcuts, args.desktop_icon, not args.no_register)
        if not args.no_launch and not os.environ.get('REPAIRME_SETUP_TEST'):
            subprocess.Popen([str(app)], creationflags=0x00000008)
        return 0
    wizard(target)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:  # a windowed program has no console, so keep the reason in a file
        import traceback

        Path(os.environ.get('TEMP') or '.').joinpath('RepairMeSetup.log').write_text(traceback.format_exc())
        raise
