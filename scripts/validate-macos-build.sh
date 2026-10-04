#!/bin/bash
# Valida os DMGs gerados pelo electron-builder. Rodar no macOS.
# Uso: bash scripts/validate-macos-build.sh [pasta]  (padrao: release)
set -uo pipefail

OUT_DIR="${1:-release}"
FAIL=0
CURRENT_MOUNT=""
VERIFY_LOG=""

cleanup_mount() {
  if [ -n "$CURRENT_MOUNT" ] && [ -d "$CURRENT_MOUNT" ]; then
    hdiutil detach "$CURRENT_MOUNT" -quiet >/dev/null 2>&1 || \
      hdiutil detach "$CURRENT_MOUNT" -force -quiet >/dev/null 2>&1 || true
    rmdir "$CURRENT_MOUNT" 2>/dev/null || true
  fi
  CURRENT_MOUNT=""
}
trap cleanup_mount EXIT INT TERM

shopt -s nullglob
DMGS=("$OUT_DIR"/*.dmg)
if [ ${#DMGS[@]} -eq 0 ]; then
  echo "ERRO: nenhum .dmg em $OUT_DIR"
  exit 1
fi

for DMG in "${DMGS[@]}"; do
  cleanup_mount
  echo "=== Validando: $DMG"
  CURRENT_MOUNT="$(mktemp -d)"

  if ! hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$CURRENT_MOUNT" >/dev/null; then
    echo "ERRO: nao consegui montar $DMG"
    FAIL=1
    cleanup_mount
    continue
  fi

  APP="$CURRENT_MOUNT/VolunTech.app"
  CMD="$CURRENT_MOUNT/Instalar VolunTech.command"

  if [ -d "$APP" ]; then
    echo "OK  VolunTech.app presente"
  else
    echo "ERRO VolunTech.app ausente"
    FAIL=1
  fi

  if [ -f "$CMD" ] && [ -x "$CMD" ]; then
    echo "OK  Instalar VolunTech.command presente e executavel"
  else
    echo "ERRO Instalar VolunTech.command ausente ou sem permissao de execucao"
    FAIL=1
  fi

  if [ -d "$APP" ]; then
    SIG="$(codesign -dv --verbose=2 "$APP" 2>&1 || true)"
    if echo "$SIG" | grep -q "Signature=adhoc"; then
      echo "OK  assinatura ad-hoc"
    else
      echo "ERRO app nao esta com assinatura ad-hoc:"
      echo "$SIG"
      FAIL=1
    fi

    VERIFY_LOG="$(mktemp)"
    if codesign --verify --deep --strict "$APP" >"$VERIFY_LOG" 2>&1; then
      echo "OK  codesign --verify --deep --strict"
    else
      echo "ERRO integridade do bundle:"
      cat "$VERIFY_LOG"
      FAIL=1
    fi
    rm -f "$VERIFY_LOG"
    VERIFY_LOG=""
  fi

done

cleanup_mount
if [ "$FAIL" -eq 0 ]; then
  echo "TUDO OK"
else
  echo "FALHOU"
fi
exit "$FAIL"
