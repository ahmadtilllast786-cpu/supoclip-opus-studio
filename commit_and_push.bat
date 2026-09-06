@echo off
set "PATH=C:\Users\PC\AppData\Local\GitHubDesktop\app-3.6.5\resources\app\git\cmd;%PATH%"
git branch -M main
git add .
git commit -m "feat: SupoClip x Opus autonomous short-form video studio"
gh repo create supoclip-opus-studio --public --source=. --remote=origin --push
