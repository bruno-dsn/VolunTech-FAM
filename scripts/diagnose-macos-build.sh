#!/bin/bash
# Diagnostico do DMG/app macOS. Rodar no macOS.
# Uso: bash scripts/diagnose-macos-build.sh [pasta]  (padrao: release)
set -uo pipefail

OUT_DIR="${1:-release}"
CURRENT_MOUNT=""
FAIL=0

cleanup_mount() {
  if [ -n "$CURRENT_MOUNT" ] && [ -d "$CURRENT_MOUNT" ]; then
    hdiutil detach "$CURRENT_MOUNT" -quiet >/dev/null 2>&1 || \
      hdiutil detach "$CURRENT_MOUNT" -force -quiet >/dev/null 2>&1 || true
    rmdir "$CURRENT_MOUNT" 2>/dev/null || true
  fi
  CURRENT_MOUNT=""
}
trap cleanup_mount EXIT INT TERM

report_app() {
  local app="$1"
  local label="$2"
  local unpacked="$app/Contents/Resources/app.asar.unpacked"

  echo
  echo "===== APP: $label ====="
  echo "PATH=$app"

  echo "-- codesign -dv --verbose=2 --"
  if ! codesign -dv --verbose=2 "$app" 2>&1; then
    echo "codesign -dv retornou erro"
    FAIL=1
  fi

  echo "-- codesign --verify --deep --strict --"
  if codesign --verify --deep --strict "$app" 2>&1; then
    echo "VERIFY=OK"
  else
    echo "VERIFY=FAIL"
    FAIL=1
  fi

  echo "-- Mach-O em app.asar.unpacked --"
  if [ ! -d "$unpacked" ]; then
    echo "NENHUM app.asar.unpacked encontrado"
    return
  fi

  local found=0
  while IFS= read -r -d '' file_path; do
    local description
    description="$(file -b "$file_path" 2>/dev/null || true)"
    case "$description" in
      *Mach-O*)
        found=1
        echo "MACH-O: $file_path"
        echo "FILE: $description"
        echo "SIGNATURE:"
        if codesign --verify --strict "$file_path" >/dev/null 2>&1; then
          echo "  SIGNATURE=valid"
        else
          echo "  SIGNATURE=invalid-or-unsigned"
          FAIL=1
        fi
        echo "DETAILS:"
        codesign -dv --verbose=2 "$file_path" 2>&1 || true
        ;;
    esac
  done < <(find "$unpacked" -type f -print0)

  if [ "$found" -eq 0 ]; then
    echo "NENHUM Mach-O encontrado em app.asar.unpacked"
  fi
}

shopt -s nullglob
DMGS=("$OUT_DIR"/*.dmg)
if [ ${#DMGS[@]} -gt 0 ]; then
  for dmg in "${DMGS[@]}"; do
    cleanup_mount
    echo "===== DMG: $dmg ====="
    CURRENT_MOUNT="$(mktemp -d)"
    if ! hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$CURRENT_MOUNT" >/dev/null; then
      echo "MOUNT=FAIL"
      FAIL=1
      cleanup_mount
      continue
    fi

    echo "MOUNT=OK"
    if [ -f "$CURRENT_MOUNT/Instalar VolunTech.command" ] && [ -x "$CURRENT_MOUNT/Instalar VolunTech.command" ]; then
      echo "DMG_COMMAND=present-executable"
    else
      echo "DMG_COMMAND=missing-or-not-executable"
      FAIL=1
    fi

    if [ -d "$CURRENT_MOUNT/VolunTech.app" ] && \
       [ -n "$(find "$CURRENT_MOUNT/VolunTech.app" -name 'Instalar VolunTech.command' -print -quit 2>/dev/null)" ]; then
      echo "COMMAND_INSIDE_APP=ERROR"
      FAIL=1
    else
      echo "COMMAND_INSIDE_APP=absent"
    fi

    if [ -d "$CURRENT_MOUNT/VolunTech.app" ]; then
      report_app "$CURRENT_MOUNT/VolunTech.app" "DMG"
    else
      echo "APP=missing"
      FAIL=1
    fi
  done
else
  APPS=("$OUT_DIR"/mac-*/*.app)
  if [ ${#APPS[@]} -eq 0 ]; then
    echo "ERRO: nenhum .dmg nem .app em $OUT_DIR"
    exit 1
  fi
  for app in "${APPS[@]}"; do
    report_app "$app" "release"
  done
fi

cleanup_mount
echo
echo "===== RESULTADO ====="
if [ "$FAIL" -eq 0 ]; then
  echo "DIAGNOSTICO=OK"
else
  echo "DIAGNOSTICO=FAIL"
fi
exit "$FAIL"
