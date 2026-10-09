// Hook afterPack do electron-builder.
// .cjs e intencional porque o projeto usa "type": "module".
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options });
}

// Deteccao por "magic number" (rapida): evita executar `file` em milhares de
// arquivos de node_modules. Cobre Mach-O 32/64 bits (ambas as endianness) e fat.
const MACHO_MAGICS = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe]);
const FAT_MAGICS = new Set([0xcafebabe, 0xcafebabf]);

function isMachO(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(8);
    if (fs.readSync(fd, buf, 0, 8, 0) < 8) return false;
    const magic = buf.readUInt32BE(0);
    if (MACHO_MAGICS.has(magic)) return true;
    // Binario universal (fat). Class files do Java tambem comecam com 0xCAFEBABE,
    // mas o campo seguinte e a versao (>= 45), enquanto em fat e o no. de arquiteturas (< 20).
    if (FAT_MAGICS.has(magic)) {
      const n = buf.readUInt32BE(4);
      return n > 0 && n < 20;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

function hasValidSignature(filePath, exec = run) {
  try {
    exec("codesign", ["--verify", "--strict", filePath], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function signMachO(filePath, exec = run) {
  console.log(`[adhoc-sign] Assinando Mach-O: ${filePath}`);
  exec("codesign", ["--force", "--sign", "-", filePath], { stdio: "inherit" });
}

function collectMachOFiles(root) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && isMachO(fullPath)) {
        found.push(fullPath);
      }
    }
  }

  return found.sort();
}

function signUnpackedMachO(appPath, exec = run) {
  const unpackedRoot = path.join(appPath, "Contents", "Resources", "app.asar.unpacked");
  const machOFiles = collectMachOFiles(unpackedRoot);
  console.log(`[adhoc-sign] Mach-O encontrados em app.asar.unpacked: ${machOFiles.length}`);

  for (const filePath of machOFiles) {
    if (hasValidSignature(filePath, exec)) {
      console.log(`[adhoc-sign] Assinatura existente valida: ${filePath}`);
      continue;
    }
    signMachO(filePath, exec);
  }

  return machOFiles;
}

async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  console.log(`[adhoc-sign] App: ${appPath}`);
  signUnpackedMachO(appPath);
  console.log(`[adhoc-sign] Assinando bundle: ${appPath}`);
  run("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
  run("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "inherit" });
  console.log("[adhoc-sign] Assinatura ad-hoc e verificacao concluidas.");
}

module.exports = {
  default: adhocSign,
  isMachO,
  hasValidSignature,
  collectMachOFiles,
  signUnpackedMachO
};
