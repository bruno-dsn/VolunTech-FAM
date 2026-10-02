import path from "node:path";
import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const sourceRoot = path.dirname(currentFile);

async function startElectron() {
  const { app, BrowserWindow, Menu, utilityProcess, shell, dialog } = await import("electron");

  // Mesma variável lida por scripts/electron-server.mjs (o processo filho herda o ambiente).
  const PORT = Number(process.env.VOLUNTECH_PORT) || 5173;
  const APP_URL = `http://127.0.0.1:${PORT}/?demo=1`;

  let mainWindow = null;
  let serverProcess = null;
  let shuttingDown = false;
  let logPath = null;
  let splashWindow = null;

  function log(message, error) {
    const line = `[${new Date().toISOString()}] ${message}${error ? `\n${error instanceof Error ? error.stack : String(error)}` : ""}\n`;
    try {
      if (logPath) appendFileSync(logPath, line);
    } catch {}
    console.log(line.trimEnd());
  }

  process.on("uncaughtException", (error) => log("[VolunTech] Exceção não tratada.", error));
  process.on("unhandledRejection", (reason) => log("[VolunTech] Promise rejeitada.", reason));

  Menu.setApplicationMenu(null);
  await app.whenReady();

  const runtimeRoot = path.join(app.getPath("userData"), "runtime");
  mkdirSync(runtimeRoot, { recursive: true });
  logPath = path.join(runtimeRoot, "app.log");
  log(`[VolunTech] Electron pronto. isPackaged=${app.isPackaged}`);
  log(`[VolunTech] resourcesPath=${process.resourcesPath}`);
  log(`[VolunTech] sourceRoot=${sourceRoot}`);

  // Se algo já responde nessa porta, não carregamos "outro site" achando que é o VolunTech.
  if (await isPortInUse(`http://127.0.0.1:${PORT}/`)) {
    log(`[VolunTech] A porta ${PORT} já está em uso.`);
    dialog.showErrorBox(
      "VolunTech não conseguiu iniciar",
      `A porta ${PORT} já está sendo usada por outro programa (ou por outra janela do VolunTech).\n\nFeche o outro programa ou defina a variável VOLUNTECH_PORT com uma porta livre.`
    );
    app.quit();
    return;
  }

  showSplash();

  const serverRoot = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked")
    : sourceRoot;
  const serverEntry = path.join(serverRoot, "scripts", "electron-server.mjs");
  const serverMode = app.isPackaged ? "prod" : "dev";
  const serverRuntimeRoot = app.isPackaged
    ? runtimeRoot
    : path.join(sourceRoot, ".sites-runtime");

  log(`[VolunTech] Preparando servidor: ${serverEntry}`);
  log(`[VolunTech] serverRoot=${serverRoot}`);
  log(`[VolunTech] serverMode=${serverMode}`);
  log(`[VolunTech] runtimeRoot=${serverRuntimeRoot}`);

  try {
    serverProcess = utilityProcess.fork(
      serverEntry,
      [serverMode],
      {
        cwd: serverRoot,
        env: {
          ...process.env,
          SITES_RUNTIME_ROOT: serverRuntimeRoot,
          NODE_ENV: app.isPackaged ? "production" : "development"
        },
        stdio: "pipe",
        serviceName: "VolunTech Server"
      }
    );
  } catch (error) {
    log("[VolunTech] Falha imediata ao criar o processo do servidor.", error);
    closeSplash();
    dialog.showErrorBox(
      "VolunTech não conseguiu iniciar",
      `Não foi possível iniciar o servidor interno.\n\n${error instanceof Error ? error.message : String(error)}\n\nO log está em:\n${logPath}`
    );
    app.quit();
    return;
  }

  serverProcess.on("spawn", () => log(`[VolunTech] Servidor criado. PID=${serverProcess?.pid ?? "?"}`));
  serverProcess.stdout?.on("data", (data) => log(`[Servidor][stdout] ${String(data).trimEnd()}`));
  serverProcess.stderr?.on("data", (data) => log(`[Servidor][stderr] ${String(data).trimEnd()}`));
  serverProcess.on("error", (error) => log("[VolunTech] Erro no processo do servidor.", error));
  serverProcess.on("exit", (code) => {
    log(`[VolunTech] Servidor encerrado. código=${code}`);
    if (!shuttingDown) {
      closeSplash();
    dialog.showErrorBox(
        "VolunTech encerrou o servidor",
        `O servidor interno terminou inesperadamente (código ${code}).\n\nConsulte o log em:\n${logPath}`
      );
    }
  });

  try {
    log(`[VolunTech] Aguardando http://127.0.0.1:${PORT}/ ...`);
    await waitForServer(`http://127.0.0.1:${PORT}/`, 120000, (message) => log(message));
    log("[VolunTech] Servidor respondeu. Criando a janela.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`[VolunTech] ${message}`, error);
    closeSplash();
    dialog.showErrorBox(
      "VolunTech não conseguiu iniciar",
      `${message}\n\nO log está em:\n${logPath}`
    );
    shutdownServer();
    app.quit();
    return;
  }

  createWindow();
  try {
    log(`[VolunTech] Abrindo ${APP_URL}`);
    await mainWindow.loadURL(APP_URL);
    log("[VolunTech] Interface carregada.");
  } catch (error) {
    log("[VolunTech] Erro ao carregar a interface.", error);
    closeSplash();
    dialog.showErrorBox(
      "VolunTech não conseguiu abrir a interface",
      `${error instanceof Error ? error.message : String(error)}\n\nO log está em:\n${logPath}`
    );
    shutdownServer();
    app.quit();
    return;
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${PORT}`)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  app.on("before-quit", () => {
    shuttingDown = true;
    shutdownServer();
  });

  app.on("window-all-closed", () => {
    shutdownServer();
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      mainWindow.loadURL(APP_URL).catch((error) => log("[VolunTech] Erro ao reabrir a interface.", error));
    }
  });

  process.once("SIGTERM", () => {
    shuttingDown = true;
    shutdownServer();
    app.quit();
  });

  process.once("SIGINT", () => {
    shuttingDown = true;
    shutdownServer();
    app.quit();
  });

  function showSplash() {
    try {
      splashWindow = new BrowserWindow({
        width: 440,
        height: 260,
        frame: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        center: true,
        backgroundColor: "#ffffff",
        title: "VolunTech",
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
      });
      const html = `<!doctype html><meta charset="utf-8"><style>
        body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
        font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2937;background:#fff}
        h1{font-size:26px;margin:0 0 6px}p{margin:0;color:#6b7280;font-size:14px}
        .bar{margin-top:22px;width:220px;height:5px;border-radius:5px;background:#e5e7eb;overflow:hidden}
        .bar i{display:block;width:40%;height:100%;background:#2563eb;border-radius:5px;animation:m 1.2s ease-in-out infinite}
        @keyframes m{0%{margin-left:-40%}100%{margin-left:100%}}</style>
        <h1>VolunTech</h1><p>Iniciando o sistema, aguarde alguns segundos…</p><div class="bar"><i></i></div>`;
      splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    } catch (error) {
      log("[VolunTech] Não foi possível mostrar a tela de carregamento.", error);
    }
  }

  function closeSplash() {
    if (!splashWindow) return;
    const win = splashWindow;
    splashWindow = null;
    try {
      win.destroy();
    } catch {}
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1100,
      minHeight: 700,
      show: false,
      title: "VolunTech",
      backgroundColor: "#ffffff",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    mainWindow.once("ready-to-show", () => {
      log("[VolunTech] Janela pronta para exibição.");
      mainWindow?.show();
      closeSplash();
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
      shutdownServer();
    });
  }

  function shutdownServer() {
    if (!serverProcess) return;
    const processToKill = serverProcess;
    serverProcess = null;
    try {
      log(`[VolunTech] Encerrando servidor PID=${processToKill.pid ?? "?"}.`);
      processToKill.kill();
    } catch (error) {
      log("[VolunTech] Não foi possível encerrar o servidor.", error);
    }
  }
}

async function isPortInUse(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs, onProgress) {
  const startedAt = Date.now();
  let lastReport = 0;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}

    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    if (elapsed >= lastReport + 10) {
      lastReport = elapsed;
      onProgress?.(`[VolunTech] Servidor ainda iniciando (${elapsed}s)...`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`O servidor do VolunTech não respondeu em ${timeoutMs / 1000}s.`);
}

// IMPORTANTE: NAO usar "await" aqui no nivel superior.
// Em um main.js ESM, o Electron so dispara o evento "ready" depois que o modulo
// termina de carregar. Com "await startElectron()" (que espera app.whenReady()),
// o app trava para sempre: o icone fica pulando no Dock e nenhuma janela abre.
startElectron().catch((error) => {
  console.error("[VolunTech] Falha fatal ao iniciar:", error);
  process.exit(1);
});
