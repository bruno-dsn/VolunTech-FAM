#!/bin/bash
cd "$(dirname "$0")" || exit 1
APP_SRC="VolunTech.app"
APP_DST="/Applications/VolunTech.app"

if [ ! -d "$APP_SRC" ]; then
  echo "ERRO: nao encontrei $APP_SRC ao lado deste arquivo."
  echo "Abra o DMG e execute este arquivo de dentro dele."
  read -n 1 -s -r -p "Tecla para fechar..."
  exit 1
fi

echo "Instalando VolunTech em /Applications..."
rm -rf "$APP_DST"
cp -R "$APP_SRC" "$APP_DST" || { echo "ERRO ao copiar o app."; read -n 1 -s -r -p "Tecla para fechar..."; exit 1; }
# Sem "set -e" de proposito: se o xattr reclamar de algum arquivo, o app ainda deve abrir.
xattr -dr com.apple.quarantine "$APP_DST" || echo "Aviso: xattr retornou erro (seguindo mesmo assim)."
open "$APP_DST"
