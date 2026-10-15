import type { Metadata } from 'next';
import { BrandLogo } from '@/components/brand-logo';
export const metadata: Metadata = { title: 'Install RepairMe Desktop' };
const download = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL || '/downloads/RepairMeSetup.exe';
export default function Install() {
  return (
    <div className="setup-page install-page">
      <BrandLogo />
      <h1>Install RepairMe Desktop</h1>
      <p>
        The RepairMe Desktop app gives you the same workspace as the website in its own window, with
        your tasks, your work-time watch and coffee-break reminders as Windows notifications. You
        sign in with your normal RepairMe username and password.
      </p>
      <a className="button yellow" href={download} download>
        Download RepairMeSetup.exe
      </a>
      <h2>Install</h2>
      <ol className="agent-steps">
        <li>
          Open <strong>RepairMeSetup.exe</strong> and follow the steps: welcome, privacy, location,
          install.
        </li>
        <li>Leave “Start RepairMe when I sign in to Windows” ticked, then click Finish.</li>
        <li>
          Sign in with your RepairMe username and password. This connects the computer
          automatically.
        </li>
        <li>
          Keep the app running. Closing its window sends it to the tray icon next to the clock.
        </li>
      </ol>
      <h2>What it measures</h2>
      <p className="agent-note">
        Whether the computer is awake and in use (active, idle or locked), seconds since the last
        keyboard or mouse use (never what you type), CPU and memory use, and the names of the
        busiest programs. It never records your screen, keystrokes, window titles, files or web
        pages. When the PC sleeps or the app is closed, no time is counted. If the internet drops,
        work time is kept on the computer and uploaded when it returns.
      </p>
      <h2>Coffee breaks</h2>
      <p className="agent-note">
        After 60 minutes of continuous work you are offered a 10-minute coffee break. Start it, or
        push it back 10 minutes. Break time is not counted as work, and you are notified when the
        break is over.
      </p>
      <h2>Requirements</h2>
      <p className="agent-note">
        Windows 10 or 11 (64-bit) and Microsoft Edge WebView2, which is already part of Windows 11
        and up-to-date Windows 10. To remove the app, use Settings → Apps → RepairMe Desktop →
        Uninstall.
      </p>
    </div>
  );
}
