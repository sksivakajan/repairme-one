"""Packs dist/RepairMeSetup.exe with instructions into dist/RepairMe-Desktop-Setup.zip for employees."""
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
DIST = HERE / 'dist'
INSTALL = """RepairMe Desktop - installation
================================

This is the RepairMe workspace in its own app, with your tasks, a work-time watch and
coffee-break reminders. You sign in with your normal RepairMe username and password.

INSTALL (about one minute)
  1. Unzip this folder (right-click the zip, "Extract All").
  2. Double-click  RepairMeSetup.exe  and follow the pages:
       Welcome > What the app does > Where to install > Installing > Finish
  3. Leave "Start RepairMe when I sign in to Windows" ticked.
  4. Click Finish. RepairMe opens. Sign in with your RepairMe username and password.
     This connects your computer by itself. There is no code to type.

IF WINDOWS BLOCKS IT
  - "Windows protected your PC": click "More info", then "Run anyway".
  - "An Application Control policy has blocked this file" or "Smart App Control blocked
    this app": Smart App Control is switched on for this computer and only lets signed
    apps run. Ask IT to approve RepairMe Desktop (IT: see the Signing section of the
    README in the project, agent/README.md). Please do not look for ways around it
    yourself.

USING IT
  - Closing the window does not stop the app. It keeps running next to the clock
    (the RepairMe icon). Right-click that icon to open RepairMe or to quit.
  - Check in and out on the Attendance page as usual.
  - After one hour of continuous work you get a Windows notification offering a
    10-minute coffee break. Start the break, or push it back 10 minutes.
    Break time is not counted as work. You are told when the break is over.
  - If the internet drops, your work time is kept on this computer and uploaded
    when it comes back.

WHAT IT SENDS TO THE COMPANY
  Whether the computer is active, idle or locked; how long since you last used the
  keyboard or mouse (never what you type); CPU and memory use; and the names of the
  busiest programs and the program in front. It never records your screen,
  keystrokes, window titles, files or web pages. While the computer sleeps or the app
  is closed, no time is counted.

NEEDS
  Windows 10 or 11 (64-bit) and Microsoft Edge WebView2 (already part of Windows 11
  and up-to-date Windows 10). The installer tells you if it is missing.

REMOVE
  Settings > Apps > Installed apps > RepairMe Desktop > Uninstall.
"""
SILENT = r"""@echo off
rem For IT: installs RepairMe Desktop for the current user without any windows, then starts it.
rem Add  --no-autostart  or  --desktop-icon  or  --dir "D:\Apps\RepairMe"  as needed.
"%~dp0RepairMeSetup.exe" /S
"""
UNINSTALL = r"""@echo off
rem For IT: removes RepairMe Desktop for the current user without any windows.
rem Add --purge to also delete the saved sign-in and the work time stored on the computer.
"%LOCALAPPDATA%\Programs\RepairMe\RepairMeSetup.exe" --uninstall /S
"""


def main() -> None:
    setup = DIST / 'RepairMeSetup.exe'
    if not setup.exists():
        raise SystemExit('Build RepairMeSetup.exe first (build.bat).')
    target = DIST / 'RepairMe-Desktop-Setup.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        folder = 'RepairMe-Desktop-Setup/'
        bundle.write(setup, folder + 'RepairMeSetup.exe')
        bundle.writestr(folder + 'INSTALL.txt', INSTALL.replace('\n', '\r\n'))
        bundle.writestr(folder + 'IT-silent-install.bat', SILENT.replace('\n', '\r\n'))
        bundle.writestr(folder + 'IT-silent-uninstall.bat', UNINSTALL.replace('\n', '\r\n'))
    print(f'{target}  ({target.stat().st_size / 1048576:.1f} MB)')


if __name__ == '__main__':
    main()
