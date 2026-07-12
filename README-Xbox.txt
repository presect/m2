Maxi Coast Rush - Xbox (UWP) build
===================================

WHAT'S IN THIS FOLDER
  default.html            - UWP shell page (hosts the game in a WebView, wires the gamepad)
  Package.appxmanifest    - UWP app manifest (targets Xbox / Windows.Universal)
  Assets\                 - App icons + splash (44/150/310, wide 310x150, splash 620x300)
  game\                   - The full offline game (index.html, three.js, GLBs, audio, painted art)
  Build-Xbox.ps1          - Packages + signs the .msix on any Windows PC


A. BUILD THE PACKAGE (one time, on a Windows PC)
------------------------------------------------
  1. Install Windows 10 SDK (once):
       https://developer.microsoft.com/windows/downloads/windows-sdk/
     Make sure "Signing tools for desktop apps" is checked.

  2. Copy this whole folder to your Windows PC.

  3. Right-click Build-Xbox.ps1 -> Run with PowerShell.
     (or from PowerShell:  Set-ExecutionPolicy -Scope Process Bypass ; .\Build-Xbox.ps1 )

  You will get:
       dist\MaxiCoastRush.msix
       dist\MaxiCoastRush.cer


B. PUT THE XBOX INTO DEVELOPER MODE (one time)
----------------------------------------------
  Follow: https://learn.microsoft.com/windows/uwp/xbox-apps/devkit-activation
  (Install "Xbox Dev Mode" from the Store, activate, reboot to Dev Home.)


C. INSTALL THE GAME ON YOUR XBOX
--------------------------------
  1. On the Xbox in Dev Mode, note the IP shown at the top of Dev Home,
     e.g.  https://192.168.1.42:11443
  2. On any PC on the same network, open that URL in a browser.
     Accept the self-signed warning; sign in with the Dev Home username/password.
  3. Click "Add".
  4. Upload MaxiCoastRush.msix   (App package)
     Upload MaxiCoastRush.cer    (Certificate - only needed the first time)
  5. Click "Start" -> "Deploy".
  6. The Xbox now shows "Maxi Coast Rush" in the Dev Home game list.
     Launch it. It plays fullscreen, offline, with an Xbox controller.


CONTROLLER MAPPING (built in)
-----------------------------
  Left stick / D-pad   -> arrow keys (steer / dive / surface)
  A                    -> Space  (boost / jump)
  B                    -> Esc    (menu / back)
  X / Y / LB / RB      -> X / Y / Q / E
  Start                -> Enter  (start match / confirm)
  Back                 -> Tab


TROUBLESHOOTING
---------------
  * "Package could not be registered" on Xbox
       -> The .cer wasn't installed. Upload it once via Dev Home.
  * Game screen is black
       -> Wait ~10s on first launch (three.js + GLBs decoding); Xbox One S is slow.
  * Controller does nothing
       -> Press A once to give the WebView focus, then it takes gamepad input.


REBUILDING AFTER A GAME UPDATE
------------------------------
  Just replace the contents of the game\ folder and rerun Build-Xbox.ps1.
  Bump Version="1.0.0.0" in Package.appxmanifest to Version="1.0.0.1" etc.
  so Xbox Dev Home installs it as an update rather than rejecting it.

============================================================
ONE-CLICK INSTALL (Install-OnXbox.cmd / .ps1)
============================================================
Prereqs on Xbox:
  1. Xbox in Developer Mode.
  2. Settings > Remote access > Enable device portal.
     Set a username + password (you'll enter them here).
  3. Note the "Web address" shown, e.g. https://192.168.1.42:11443
     -> the IP is 192.168.1.42

Then on Windows:
  1. Double-click Install-OnXbox.cmd
  2. Enter the Xbox IP.
  3. Enter the Device Portal username/password when prompted.
The script will:
  - Build the .msix if not already built (uses Build-Xbox.ps1)
  - Upload the .msix + .cer to the Xbox
  - Wait for install to finish
  - Launch the game on the console

Advanced (PowerShell):
  .\Install-OnXbox.ps1 -XboxIP 192.168.1.42 -Username devuser -Password devpass
  .\Install-OnXbox.ps1 -XboxIP 192.168.1.42 -Rebuild        # force rebuild
  .\Install-OnXbox.ps1 -XboxIP 192.168.1.42 -SkipCert       # skip .cer upload

---
Note on manifest naming:
The source file is Package.appxmanifest (Visual Studio convention), but
makeappx.exe requires it to be named AppxManifest.xml inside the content
folder it packs. Build-Xbox.ps1 handles this automatically by staging the
payload into build\pkg\ and copying Package.appxmanifest -> AppxManifest.xml
there. Do NOT rename the source file.
