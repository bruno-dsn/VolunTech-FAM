@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem VolunTech - Windows
rem Duplo clique neste arquivo. Nenhum comando e necessario.
rem Para colegas, a distribuicao principal e o instalador .exe
rem publicado nas Releases do GitHub.
rem ============================================================

if /I not "%~1"=="__VOLUNTECH_HIDDEN__" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
      "Start-Process -WindowStyle Hidden -FilePath '%ComSpec%' -ArgumentList '/d /c ""%~f0"" __VOLUNTECH_HIDDEN__'"
    exit /b 0
)

cd /d "%~dp0"
set "ROOT=%~dp0"
set "RUNTIME=%ROOT%.voluntech-runtime"
set "NODE_VERSION=22.14.0"
set "PNPM_VERSION=11.25.0"
set "NODE_DIR=%RUNTIME%\node"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"
set "COREPACK_CMD=%NODE_DIR%\corepack.cmd"
set "LOG=%RUNTIME%\install.log"

if not exist "%NODE_EXE%" (
    if not exist "%RUNTIME%" mkdir "%RUNTIME%" >nul 2>&1
    set "NODE_ZIP=%TEMP%\voluntech-node-%NODE_VERSION%.zip"
    >"%LOG%" echo [VolunTech] Baixando Node.js %NODE_VERSION%

    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop'; $url='https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip'; Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile '!NODE_ZIP!'; Expand-Archive -Force '!NODE_ZIP!' '%RUNTIME%'; if (Test-Path '%NODE_DIR%') { Remove-Item -Recurse -Force '%NODE_DIR%' }; Rename-Item '%RUNTIME%\node-v%NODE_VERSION%-win-x64' 'node'; Remove-Item '!NODE_ZIP!' -Force" >>"%LOG%" 2>&1

    if not exist "%NODE_EXE%" (
        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Nao foi possivel preparar o ambiente do VolunTech. Consulte .voluntech-runtime\\install.log.','VolunTech')" 
        exit /b 1
    )
)

if not exist "%ROOT%node_modules\electron\dist\electron.exe" (
    >"%LOG%" echo [VolunTech] Inicio da preparacao das dependencias
    >>"%LOG%" echo [VolunTech] Node: %NODE_VERSION% / pnpm: %PNPM_VERSION%
    set "INSTALL_OK=0"

    rem Instalacao completa: o lockfile e atualizado quando necessario; os scripts de pos-instalacao sao necessarios
    rem para preparar o Electron e outros binarios nativos.
    >>"%LOG%" echo [VolunTech] Tentativa 1: Corepack + pnpm (instalacao completa)
    "%COREPACK_CMD%" pnpm --version >>"%LOG%" 2>&1
    if not errorlevel 1 (
        "%COREPACK_CMD%" pnpm install --frozen-lockfile --prefer-offline --fetch-retries 5 --fetch-timeout 120000 >>"%LOG%" 2>&1
        if not errorlevel 1 set "INSTALL_OK=1"
    )

    if "!INSTALL_OK!"=="0" (
        >>"%LOG%" echo [VolunTech] Tentativa 2: npm exec + pnpm (instalacao completa)
        call "%NPM_CMD%" exec --yes --package=pnpm@%PNPM_VERSION% -- pnpm install --frozen-lockfile --prefer-offline --fetch-retries 5 --fetch-timeout 120000 >>"%LOG%" 2>&1
        if not errorlevel 1 set "INSTALL_OK=1"
    )

    if "!INSTALL_OK!"=="0" (
        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Nao foi possivel preparar as dependencias. Consulte .voluntech-runtime\\install.log para detalhes.','VolunTech')"
        exit /b 1
    )
)

if not exist "%ROOT%node_modules\electron\dist\electron.exe" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('O Electron nao foi instalado corretamente. Consulte .voluntech-runtime\\install.log.','VolunTech')"
    exit /b 1
)

start "" /b "%ROOT%node_modules\electron\dist\electron.exe" "%ROOT%"
exit /b 0
