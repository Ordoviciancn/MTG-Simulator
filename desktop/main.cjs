const { app, BrowserWindow, Menu, dialog, utilityProcess } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
let window, server, quitting = false;
app.setName('MTG Simulator');
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
app.on('second-instance', () => { const current = BrowserWindow.getAllWindows()[0]; if (current) { if (current.isMinimized()) current.restore(); current.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; server?.kill(); });
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function configure() {
  const configFile = path.join(app.getPath('userData'), 'runtime.json');
  let config = {};
  try { config = JSON.parse(await fs.readFile(configFile, 'utf8')); } catch {}
  config.workspace = process.env.FORGE_WORKSPACE_ROOT || config.workspace || (!app.isPackaged ? path.resolve(__dirname, '..') : '');
  config.javaHome = process.env.JAVA_HOME || config.javaHome || '';
  for (const [key, marker, title] of [
    ['workspace', '.local-tools/forge/forge-gui/target/runtime-classpath.txt', '选择已构建 Forge 的 MTG-Tabletop 项目目录'],
    ['javaHome', 'bin/javac.exe', '选择 JDK 17 或更高版本目录']
  ]) {
    while (!config[key] || !await exists(path.join(config[key], marker))) {
      const result = await dialog.showOpenDialog({ title, properties: ['openDirectory'] });
      if (result.canceled) return null;
      config[key] = result.filePaths[0];
      if (!await exists(path.join(config[key], marker))) await dialog.showMessageBox({ type: 'error', message: '所选目录缺少所需运行文件', detail: marker });
    }
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(config, null, 2));
  return config;
}
async function start() {
  const config = await configure();
  if (!config) return app.quit();
  const root = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '../.desktop-stage');
  server = utilityProcess.fork(path.join(root, 'server-entry.mjs'), [], {
    cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', JAVA_HOME: config.javaHome, FORGE_WORKSPACE_ROOT: config.workspace },
    stdio: 'pipe', serviceName: 'MTG Rules Server'
  });
  server.stdout?.on('data', data => process.stdout.write(data));
  server.stderr?.on('data', data => process.stderr.write(data));
  server.on('exit', () => {
    if (!quitting) { dialog.showErrorBox('规则服务已停止', '对局已暂停。请重新启动程序；未保存对局暂不支持恢复。'); app.quit(); }
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local server startup timed out.')), 30000);
    server.on('message', message => { if (message.type === 'ready') { clearTimeout(timer); resolve(message.port); } });
    server.once('exit', () => { clearTimeout(timer); reject(new Error('Local server exited before startup.')); });
  });
  const origin = `http://127.0.0.1:${port}`;
  window = new BrowserWindow({ width: 1600, height: 980, minWidth: 1000, minHeight: 700, backgroundColor: '#101719', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '对局', submenu: [{ label: '新窗口（第二位本机玩家）', click: () => {
      const second = new BrowserWindow({ width: 1400, height: 900, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
      second.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      second.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
      second.loadURL(origin + '/?forge');
    } }, { label: '运行环境位置', click: () => dialog.showMessageBox({ message: 'Forge 运行环境', detail: `项目：${config.workspace}\nJDK：${config.javaHome}\n设置文件：${path.join(app.getPath('userData'), 'runtime.json')}` }) }, { type: 'separator' }, { role: 'quit', label: '退出' }] },
    { label: '视图', submenu: [{ role: 'togglefullscreen', label: '全屏' }, { role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }] }
  ]));
  await window.loadURL(origin + '/?forge');
  window.show();
  if (process.env.MTG_DESKTOP_SMOKE) {
    const health = await fetch(origin + '/health');
    if (!health.ok) throw new Error('Health check failed.');
    const rendered = await window.webContents.executeJavaScript('Boolean(document.querySelector("#root")?.firstElementChild)');
    if (!rendered) throw new Error('The application root did not render.');
    await fs.writeFile(process.env.MTG_DESKTOP_SMOKE, JSON.stringify({ executable: process.execPath, packaged: app.isPackaged, health: await health.json(), url: window.webContents.getURL(), loaded: !window.webContents.isLoading(), rendered }));
    app.quit();
  }
}
if (single) app.whenReady().then(start).catch(error => { dialog.showErrorBox('启动失败', error.message); app.quit(); });
