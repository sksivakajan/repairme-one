# RepairMe Desktop: installation guide

RepairMe Desktop is the RepairMe workspace in its own Windows app. It shows the employee's tasks and a work-time
watch, tracks real work time, and offers a coffee break after an hour of continuous work. Employees sign in with
the same username and password they use on the website.

---

## Part 1. One-time setup (you, the administrator)

Do these once, in this order.

**1. Update the database.** In Supabase, open **SQL Editor** and run the migration files from `supabase/migrations`
that you have not run yet, one at a time, oldest first. The newest are:

| File                                            | Adds                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| `202610130014_desktop_agent.sql`                | connecting a computer, worked time from the app           |
| `202610130015_project_leader_visibility.sql`    | choose a project leader; members see only their own tasks |
| `202610130016_breaks_and_offline_sync.sql`      | coffee breaks, offline work-time sync                     |
| `202610130017_project_leader_change_delete.sql` | change a project's leader, delete a project               |

Each should end with "Success". "already exists" means that file was already run, so skip it.

**2. Deploy the website.** Pushing to GitHub deploys it automatically through Netlify. Check that the newest deploy in
Netlify says **Published**.

**3. Check the site settings in Netlify** (Site configuration, Environment variables):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`APP_ORIGIN` set to exactly `https://extraordinary-semolina-40421d.netlify.app` (no trailing slash).

**4. Get the installer.** Use `RepairMe-Desktop-Setup.zip`. It is on your Desktop, and also at
`agent\dist\RepairMe-Desktop-Setup.zip`. To rebuild it, run `agent\build.bat` (needs Python 3.10 or newer).

**5. Sign the installer (strongly recommended).** Windows 11 PCs with _Smart App Control_ only run signed programs.
An unsigned build can show "An Application Control policy has blocked this file".

1. Get a code-signing certificate (a `.pfx` file) from a certificate authority, or use Microsoft Trusted Signing.
2. In a Command Prompt: `set REPAIRME_SIGN_PFX=C:\path\to\certificate.pfx` and `set REPAIRME_SIGN_PASSWORD=your-password`.
3. Run `agent\build.bat`. It signs the app and the installer and rebuilds the ZIP.

On a PC with Smart App Control off, the unsigned installer still works. Windows may ask "Windows protected your PC";
click **More info**, then **Run anyway**.

**6. Tell your employees first.** The app measures work time. It sends only: active, idle or locked; seconds since the
last keyboard or mouse use (never what is typed); CPU and memory use; and the names of the busiest programs. It never
records the screen, keystrokes, window titles, files or web pages. Local law may require notice or consent.

---

## Part 2. Installing on an employee's PC

Send the employee `RepairMe-Desktop-Setup.zip`. The steps below are the same as the `INSTALL.txt` inside it.

**Needs:** Windows 10 or 11 (64-bit), internet access, and Microsoft Edge WebView2 (already part of Windows 11 and
up-to-date Windows 10; the installer warns if it is missing).

1. **Unzip.** Right-click the ZIP, choose **Extract All**.
2. **Run the installer.** Double-click `RepairMeSetup.exe`.
3. **Follow the five pages.**
   - _Welcome_: click Next.
   - _What the app does_: read it, tick "I have read this and I agree", click Next.
   - _Where to install_: keep the suggested folder. Leave "Start RepairMe when I sign in to Windows" ticked.
     Optional: add a desktop shortcut. Click **Install**.
   - _Installing_: wait a few seconds.
   - _Finish_: leave "Open RepairMe Desktop now" ticked and click **Finish**.
4. **Sign in.** The RepairMe window opens. Enter your normal RepairMe username and password (and your authenticator
   code if you have one). This connects the computer automatically. There is no code to type.
5. **Check in** on the **Attendance** page as usual. The **Work time today** watch runs while you really work.

**Everyday use**

- Closing the window does not stop the app. It keeps running by the clock (RepairMe icon, bottom right; it may be under
  the small "^" arrow). To see the window again, open RepairMe from the Start menu or the desktop shortcut, or
  double-click the icon. Right-click the icon to open RepairMe or to quit. Quitting stops time tracking.
- To update the app, run the new `RepairMeSetup.exe`. It closes the old copy by itself and keeps your sign-in.
- After one hour of continuous work you get a Windows notification: **Start a 10-minute break**, or **Not now**
  (it asks again in 10 minutes). Break time is not counted as work, and you are told when the break is over.
- If the internet drops, work time is kept on the computer and uploaded when it comes back.
- Only one sign-in is allowed at a time. Signing in on the website while the app is signed in signs the other out.

---

## Part 3. If something goes wrong

| What you see                                                                                 | What to do                                                                                                        |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| "Windows protected your PC"                                                                  | Click **More info**, then **Run anyway**.                                                                         |
| "An Application Control policy has blocked this file" / "Smart App Control blocked this app" | The PC only runs signed apps. Sign the installer (Part 1, step 5), or ask IT to add an allow rule.                |
| The installer says WebView2 is missing                                                       | Accept the download link it offers (Microsoft Edge WebView2 Runtime), then run the installer again.               |
| "Code is not valid or has expired"                                                           | Not needed in the app. If you connected by code, make a new one under Attendance, Desktop agent, Connect this PC. |
| "This account already has 5 connected computers"                                             | Disconnect one under Attendance, Desktop agent.                                                                   |
| You were signed out                                                                          | Someone (or you) signed in on another device. Sign in again.                                                      |
| Shows "Offline"                                                                              | Check the internet. Tracking continues and uploads later.                                                         |
| Worked time stays at 0                                                                       | You must be **checked in** on the Attendance page. Check the tray icon is not grey.                               |

---

## Part 4. Removing or managing

- **Remove from one PC:** Settings, Apps, Installed apps, **RepairMe Desktop**, Uninstall. It asks whether to also
  delete the saved sign-in and the work time stored on the PC.
- **Disconnect a PC from the website:** Attendance, Desktop agent, **Disconnect**. The CEO and HR can disconnect any
  employee's PC. The app then stops tracking and asks the employee to sign in again.
- **Install on many PCs (IT):** run `IT-silent-install.bat` from the ZIP, or `RepairMeSetup.exe /S`. Options:
  `--dir "D:\Apps\RepairMe"`, `--no-autostart`, `--desktop-icon`. Silent uninstall: `IT-silent-uninstall.bat`
  (add `--purge` to also delete saved data).
