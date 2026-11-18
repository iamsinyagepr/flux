@echo off
rem Publishes a release's eight npm packages, in the order they depend on
rem each other: the six platform binaries, then @upskale/flux (which lists
rem them), then @upskale/create-flux (which uses it).
rem
rem   scripts\publish.cmd 0.1.2            publishes release-0.1.2\npm
rem   scripts\publish.cmd 0.1.2 release    or another folder: release\npm
rem
rem Each publish asks you to approve it in the browser (two-factor
rem authentication). A dropped upload is tried again; a package already
rem published is skipped, so running it again after a failure carries on
rem where it stopped. The same as scripts/publish.sh, for cmd.
setlocal EnableDelayedExpansion

set "VERSION=%~1"
if "%VERSION%"=="" (
  echo usage: scripts\publish.cmd ^<version^> [release folder]
  exit /b 1
)
set "FOLDER=%~2"
if "%FOLDER%"=="" set "FOLDER=release-%VERSION%"

cd /d "%~dp0.."
set "NPMDIR=%CD%\%FOLDER%\npm"
if not exist "%NPMDIR%" (
  echo No %NPMDIR%: build it first with
  echo   set RELEASE_DIR=%FOLDER%
  echo   node scripts\release.mjs %VERSION%
  exit /b 1
)

set "USER="
for /f "delims=" %%u in ('npm whoami 2^>nul') do set "USER=%%u"
if "%USER%"=="" (
  echo Not logged in to npm: run  npm login  first.
  exit /b 1
)
echo Publishing %VERSION% from %NPMDIR% as %USER%

for %%p in (flux-win32-x64 flux-win32-arm64 flux-darwin-x64 flux-darwin-arm64 flux-linux-x64 flux-linux-arm64 flux create-flux) do (
  call :publish %%p
  if errorlevel 1 exit /b 1
)

echo.
echo All eight are published at %VERSION%. Check with:  npm view @upskale/flux version
exit /b 0

:publish
set "PKG=%~1"
set "NAME=@upskale/%PKG%"
set "DIR=%NPMDIR%\%PKG%"

set "BUILT="
for /f "delims=" %%v in ('node -p "require(process.argv[1]).version" "%DIR%\package.json"') do set "BUILT=%%v"
if not "%BUILT%"=="%VERSION%" (
  echo %DIR% is version %BUILT%, not %VERSION%: rebuild the release.
  exit /b 1
)

call :published
if "!FOUND!"=="1" (
  echo [ok] %NAME%@%VERSION% is already published
  exit /b 0
)

for /l %%a in (1,1,5) do (
  echo -- %NAME%@%VERSION% ^(try %%a^)
  pushd "%DIR%"
  call npm publish --access public --auth-type=web
  set "RESULT=!errorlevel!"
  popd
  if "!RESULT!"=="0" (
    echo [ok] %NAME%@%VERSION%
    exit /b 0
  )
  rem It may have gone through even though the connection dropped after.
  call :published
  if "!FOUND!"=="1" (
    echo [ok] %NAME%@%VERSION%
    exit /b 0
  )
  echo   that didn't go through; trying again in 10 seconds...
  timeout /t 10 /nobreak >nul
)
echo [failed] %NAME%@%VERSION% didn't publish after 5 tries. Run the script again to carry on from here.
exit /b 1

:published
set "FOUND="
set "SEEN="
for /f "delims=" %%v in ('npm view "%NAME%@%VERSION%" version --prefer-online 2^>nul') do set "SEEN=%%v"
if "%SEEN%"=="%VERSION%" set "FOUND=1"
exit /b 0
