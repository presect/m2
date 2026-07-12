Building the Xbox .msix on GitHub (no Windows PC needed)
========================================================

1. Create a new GitHub repo (any name, private is fine).
2. Upload the contents of this MaxiCoastRush-UWP folder to the repo root.
   Make sure .github/workflows/xbox.yml is included.
3. Push to main. GitHub Actions runs automatically on a free Windows runner.
   You can also trigger it manually: repo -> Actions tab -> "Build Xbox MSIX"
   -> Run workflow.
4. When the run finishes (~3-5 min), open it and download the
   "MaxiCoastRush-Xbox" artifact from the Summary page.
   It contains MaxiCoastRush.msix and MaxiCoastRush.cer.
5. From your Mac, upload those two files to your Xbox via Dev Home
   at https://<xbox-ip>:11443 (Add -> Upload -> Start), or ask me for a
   Mac install-on-xbox.command script.

Notes:
- The runner creates a fresh self-signed cert each build (the .pfx is not
  committed). If you want a stable cert across builds, commit MaxiCoastRush.pfx
  as a GitHub encrypted secret and add a step to restore it before build.
- Free GitHub Actions minutes for public repos are unlimited; private repos
  get 2000 free min/month.
