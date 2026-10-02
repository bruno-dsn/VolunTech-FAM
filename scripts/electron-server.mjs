import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const scriptsRoot = path.dirname(currentFile);
const projectRoot = path.dirname(scriptsRoot);
const mode = process.argv[2] || "dev";

function log(message) {
  console.log(`[VolunTech Server] ${message}`);
}

// Endereço do computador na rede local (Wi-Fi/cabo), usado para o QR Code abrir no celular.
// Prefere faixas privadas e ignora adaptadores virtuais (Docker, VMware, VirtualBox, VPN, Hyper-V...).
function lanAddress() {
  const virtual = /(vethernet|virtual|vmware|vbox|docker|veth|br-|utun|awdl|llw|bridge|tailscale|zerotier|hyper-v|wsl|loopback)/i;
  const score = (ip) => (ip.startsWith("192.168.") ? 3 : ip.startsWith("10.") ? 2 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 1);
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const item of list ?? []) {
      if (item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254.")) found.push({ ip: item.address, rank: score(item.address) });
    }
  }
  found.sort((a, b) => b.rank - a.rank);
  return found[0]?.ip ?? null;
}

function fail(error) {
  console.error("[VolunTech Server] Falha ao iniciar o servidor.");
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}

process.chdir(projectRoot);
process.env.SITES_RUNTIME_ROOT ??= path.join(projectRoot, ".sites-runtime");
process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
process.env.WRANGLER_SEND_METRICS ??= "false";
process.env.WRANGLER_WRITE_LOGS ??= "false";

process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

log(`Inicializando modo ${mode}.`);
log(`projectRoot=${projectRoot}`);
log(`SITES_RUNTIME_ROOT=${process.env.SITES_RUNTIME_ROOT}`);

// Compartilhamento na rede local (padrão): permite abrir /duvidas e /gesto pelo celular via QR Code.
// VOLUNTECH_LAN=0 mantém o app só neste computador. VOLUNTECH_PUBLIC_URL força um endereço próprio
// (por exemplo, uma hospedagem pública) no lugar do IP da rede.
const port = process.env.VOLUNTECH_PORT || "5173";
const lanEnabled = process.env.VOLUNTECH_LAN !== "0";
const lanIp = lanEnabled ? lanAddress() : null;
const publicUrl = (process.env.VOLUNTECH_PUBLIC_URL || (lanIp ? `http://${lanIp}:${port}` : "")).replace(/\/+$/, "");
log(`Rede local: ${lanEnabled ? "ligada" : "desligada"}${publicUrl ? ` (QR aponta para ${publicUrl})` : ""}`);

try {
  if (mode === "dev") {
    const framework = path.join(scriptsRoot, "run-framework.mjs");
    // vite.config.ts lê estas duas variáveis para abrir a rede local e informar o endereço ao app.
    process.env.VOLUNTECH_SHARE_LAN = lanEnabled ? "1" : "0";
    process.env.VOLUNTECH_SHARE_URL = publicUrl;
    log(`Iniciando Vinext/Vite: ${framework}`);
    process.argv = [process.argv[0], framework, "dev"];
    await import(pathToFileURL(framework).href);
  } else if (mode === "prod") {
    await import(pathToFileURL(path.join(scriptsRoot, "sites-env.mjs")).href);

    // O "bin/wrangler.js" so inicia quando executado diretamente
    // (module === require.main). Importar o arquivo nao faz nada, entao o
    // servidor nunca subia. Por isso iniciamos o CLI real em um processo filho.
    const wranglerCli = path.join(
      projectRoot,
      "node_modules",
      "wrangler",
      "wrangler-dist",
      "cli.js"
    );
    const configPath = path.join(projectRoot, "dist", "server", "wrangler.json");
    const persistPath = path.join(process.env.SITES_RUNTIME_ROOT, "state");

    log(`Wrangler=${wranglerCli}`);
    log(`Config=${configPath}`);
    log(`Persist=${persistPath}`);
    log(`Porta=${port}`);

    const child = spawn(
      process.execPath,
      [
        "--no-warnings",
        "--experimental-vm-modules",
        "--require",
        path.join(scriptsRoot, "electron-node-preload.cjs"),
        wranglerCli,
        "dev",
        "--config",
        configPath,
        "--local",
        "--persist-to",
        persistPath,
        "--ip",
        lanEnabled ? "0.0.0.0" : "127.0.0.1",
        "--port",
        port,
        "--inspector-port",
        "0",
        "--var",
        `VOLUNTECH_LAN:${lanEnabled ? "1" : "0"}`,
        ...(publicUrl ? ["--var", `VOLUNTECH_PUBLIC_URL:${publicUrl}`] : [])
      ],
      {
        cwd: projectRoot,
        stdio: "inherit",
        // Dentro do Electron, process.execPath e o proprio Electron:
        // esta variavel faz ele se comportar como um Node comum.
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
      }
    );

    child.on("error", fail);
    child.on("exit", (code) => process.exit(code ?? 0));
    for (const signal of ["SIGTERM", "SIGINT"]) {
      process.on(signal, () => child.kill());
    }
    process.on("exit", () => {
      try {
        child.kill();
      } catch {}
    });
  } else {
    throw new Error(`Modo de servidor desconhecido: ${mode}`);
  }
} catch (error) {
  fail(error);
}
