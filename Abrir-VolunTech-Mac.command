#!/bin/bash

# VolunTech - macOS
# Duplo clique neste arquivo. O projeto prepara um ambiente Node local
# e instala as dependencias automaticamente quando necessario.

set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME="$ROOT/.voluntech-runtime"
NODE_VERSION="22.14.0"
PNPM_VERSION="11.25.0"
LOG="$RUNTIME/install.log"
APP_LOG="$RUNTIME/app.log"
mkdir -p "$RUNTIME"

show_error() {
    local message="$1"
    osascript -e "display dialog \"$message\" buttons {\"OK\"} default button \"OK\" with title \"VolunTech\"" >/dev/null 2>&1 || true
}
open_log() { [ -f "$1" ] && open -a TextEdit "$1" >/dev/null 2>&1 || true; }

arch="$(uname -m)"
case "$arch" in
  arm64) NODE_ARCH="arm64" ;;
  x86_64) NODE_ARCH="x64" ;;
  *) show_error "Arquitetura do Mac nao suportada automaticamente pelo VolunTech."; exit 1 ;;
esac

NODE_DIR="$RUNTIME/node"
NODE_BIN="$NODE_DIR/bin/node"
NPM_BIN="$NODE_DIR/bin/npm"
COREPACK="$NODE_DIR/bin/corepack"

if [ ! -x "$NODE_BIN" ]; then
    TMP_TGZ="$RUNTIME/node.tar.gz"
    URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"
    echo "[VolunTech] Baixando Node.js $NODE_VERSION ($NODE_ARCH)" > "$LOG"
    echo "[VolunTech] URL: $URL" >> "$LOG"
    if ! curl -fL --connect-timeout 20 --max-time 180 --retry 3 --retry-delay 2 "$URL" -o "$TMP_TGZ" >>"$LOG" 2>&1; then
        echo "[VolunTech] Falha ao baixar Node.js." >> "$LOG"
        open_log "$LOG"
        show_error "Nao foi possivel baixar o ambiente necessario do VolunTech. Verifique a internet e tente novamente."
        exit 1
    fi
    rm -rf "$NODE_DIR"
    if ! tar -xzf "$TMP_TGZ" -C "$RUNTIME" >>"$LOG" 2>&1; then
        echo "[VolunTech] Falha ao extrair Node.js." >> "$LOG"
        open_log "$LOG"
        show_error "Nao foi possivel preparar o ambiente do VolunTech. Consulte o log."
        exit 1
    fi
    EXTRACTED="$RUNTIME/node-v${NODE_VERSION}-darwin-${NODE_ARCH}"
    mv "$EXTRACTED" "$NODE_DIR"
    rm -f "$TMP_TGZ"
fi

cd "$ROOT"
ELECTRON_BIN=""
if [ -x "$ROOT/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]; then
    ELECTRON_BIN="$ROOT/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
elif [ -x "$ROOT/node_modules/electron/Electron.app/Contents/MacOS/Electron" ]; then
    ELECTRON_BIN="$ROOT/node_modules/electron/Electron.app/Contents/MacOS/Electron"
fi

if [ -z "$ELECTRON_BIN" ]; then
    osascript -e 'display notification "Primeira abertura: preparando o ambiente. Pode levar alguns minutos, aguarde." with title "VolunTech"' >/dev/null 2>&1 || true
    : > "$LOG"
    echo "[VolunTech] Preparacao das dependencias" >> "$LOG"
    echo "[VolunTech] Node: $NODE_VERSION / pnpm: $PNPM_VERSION" >> "$LOG"
    echo "[VolunTech] Sistema: $(uname -s) / arquitetura: $arch" >> "$LOG"
    echo "[VolunTech] Instalando exatamente as versoes registradas no pnpm-lock.yaml." >> "$LOG"
    echo "[VolunTech] Instalacao: --frozen-lockfile (segue o pnpm-lock.yaml)" >> "$LOG"

    install_ok=0

    # Prefer the bundled Corepack/pnpm when available.
    if [ -x "$COREPACK" ]; then
        if "$COREPACK" pnpm --version >>"$LOG" 2>&1 && \
           "$COREPACK" pnpm install --frozen-lockfile --prefer-offline --fetch-retries 5 --fetch-timeout 120000 >>"$LOG" 2>&1; then
            install_ok=1
        fi
    fi

    # Reliable fallback: npm downloads exactly the pinned pnpm version.
    if [ "$install_ok" -ne 1 ]; then
        echo "[VolunTech] Fallback: npm exec + pnpm@$PNPM_VERSION" >> "$LOG"
        if "$NPM_BIN" exec --yes --package="pnpm@$PNPM_VERSION" -- pnpm install --frozen-lockfile --prefer-offline --fetch-retries 5 --fetch-timeout 120000 >>"$LOG" 2>&1; then
            install_ok=1
        fi
    fi

    if [ "$install_ok" -ne 1 ]; then
        echo "[VolunTech] Instalacao das dependencias falhou." >> "$LOG"
        open_log "$LOG"
        show_error "Nao foi possivel instalar as dependencias do VolunTech. O log foi aberto automaticamente."
        exit 1
    fi

    # pnpm 11 may leave Electron's binary download to its postinstall policy.
    # Run Electron's official installer explicitly as a final verification.
    if [ -f "$ROOT/node_modules/electron/install.js" ]; then
        echo "[VolunTech] Verificando/preparando binario do Electron" >> "$LOG"
        if ! "$NODE_BIN" "$ROOT/node_modules/electron/install.js" >>"$LOG" 2>&1; then
            echo "[VolunTech] Falha ao preparar o binario do Electron." >> "$LOG"
            open_log "$LOG"
            show_error "O Electron nao conseguiu preparar o binario necessario. Consulte o log."
            exit 1
        fi
    fi

    if [ -x "$ROOT/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]; then
        ELECTRON_BIN="$ROOT/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
    elif [ -x "$ROOT/node_modules/electron/Electron.app/Contents/MacOS/Electron" ]; then
        ELECTRON_BIN="$ROOT/node_modules/electron/Electron.app/Contents/MacOS/Electron"
    fi
fi

if [ -z "$ELECTRON_BIN" ]; then
    echo "[VolunTech] Electron nao encontrado apos a preparacao." >> "$LOG"
    open_log "$LOG"
    show_error "O Electron nao foi preparado corretamente. Consulte o log."
    exit 1
fi

: > "$APP_LOG"
export ELECTRON_ENABLE_LOGGING=true
export ELECTRON_LOG_FILE="$APP_LOG"
nohup "$ELECTRON_BIN" "$ROOT" >>"$APP_LOG" 2>&1 &
APP_PID=$!
echo "[VolunTech] Electron iniciado (PID $APP_PID)." >> "$APP_LOG"

osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 || true
exit 0
