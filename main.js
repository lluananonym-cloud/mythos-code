const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("fs"); const path = require("path"); const { exec } = require("child_process");
const CFG = () => path.join(app.getPath("userData"), "mythos.json");
const load = () => { try { return JSON.parse(fs.readFileSync(CFG(), "utf8")); } catch { return {}; } };
function win() {
  const w = new BrowserWindow({ width: 1200, height: 820, backgroundColor: "#0a0a0a", title: "Mythos Code",
    autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true } });
  w.loadFile("index.html");
}
app.whenReady().then(win);
app.on("window-all-closed", () => app.quit());
ipcMain.handle("cfg:get", () => load());
ipcMain.handle("cfg:set", (_e, c) => { fs.writeFileSync(CFG(), JSON.stringify(c, null, 2)); return true; });
ipcMain.handle("open", (_e, url) => shell.openExternal(url));
ipcMain.handle("pickFolder", async () => { const r = await dialog.showOpenDialog({ properties: ["openDirectory"] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle("pickFiles", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] });
  if (r.canceled) return [];
  return r.filePaths.map((p) => { let c = ""; try { c = fs.readFileSync(p, "utf8").slice(0, 60000); } catch { c = "(Binärdatei)"; } return { name: path.basename(p), path: p, content: c }; });
});
ipcMain.handle("tool", async (_e, t, cwd) => {
  const P = (p) => path.resolve(cwd || process.cwd(), p || ".");
  try {
    if (t.name === "run") return await new Promise((res) => exec(t.cmd, { cwd, timeout: 180000, maxBuffer: 1e7, shell: true },
      (err, so, se) => res(((so || "") + (se || "") + (err ? "\nExit: " + err.code : "")).slice(-8000) || "(keine Ausgabe)")));
    if (t.name === "read") return fs.readFileSync(P(t.path), "utf8").slice(0, 20000);
    if (t.name === "write") { fs.mkdirSync(path.dirname(P(t.path)), { recursive: true }); fs.writeFileSync(P(t.path), t.content || ""); return "OK geschrieben: " + t.path; }
    if (t.name === "ls") return fs.readdirSync(P(t.path), { withFileTypes: true }).map((e) => (e.isDirectory() ? "[D] " : "    ") + e.name).join("\n");
    return "Unbekanntes Werkzeug";
  } catch (e) { return "FEHLER: " + e.message; }
});
