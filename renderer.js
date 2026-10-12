const CFG = {"site":"https://mythos-ai-final-version.lovable.app","fn":"https://rdxaqiacoitzeowehdts.supabase.co/functions/v1"};
CFG.site = location.protocol === "file:" ? CFG.site : CFG.site;
const $ = (id) => document.getElementById(id);
let cfg = {}, history = [], attach = [], busy = false;
const fmt = (ms) => { const s = Math.floor(ms / 1000); return (s >= 60 ? Math.floor(s / 60) + "m " : "") + (s % 60) + "s"; };
const post = (fn, body, h) => fetch(CFG.fn + "/" + fn, { method: "POST", headers: Object.assign({ "content-type": "application/json" }, h || {}), body: JSON.stringify(body) });
function add(cls, text) { const d = document.createElement("div"); d.className = "m glass " + cls; d.textContent = text; $("log").appendChild(d); $("log").scrollTop = 1e9; return d; }
const SYSTEM = () => "Du bist Mythos Code, ein autonomer Coding-Agent als Desktop-App (Windows). Arbeitsordner: " + (cfg.folder || "(keiner)") +
  ". Werkzeuge – antworte mit GENAU EINEM Block:\n<tool>{\"name\":\"run\",\"cmd\":\"...\"}</tool>\n<tool>{\"name\":\"read\",\"path\":\"...\"}</tool>\n<tool>{\"name\":\"write\",\"path\":\"...\",\"content\":\"...\"}</tool>\n<tool>{\"name\":\"ls\",\"path\":\".\"}</tool>\nPfade relativ zum Arbeitsordner. Arbeite Schritt für Schritt, am Ende normal ohne <tool> antworten.";
const shorten = (s, max) => s.length <= max ? s : s.slice(0, Math.floor(max * 0.7)) + "\n…[gekürzt]…\n" + s.slice(s.length - Math.floor(max * 0.3));
function compact(h, level) {
  const keep = [6, 8, 4][level], recentMax = [20000, 3000, 1500][level], oldMax = [1500, 800, 400][level];
  const cut = Math.max(0, h.length - keep);
  const older = level === 0 ? h.slice(0, cut) : h.slice(0, Math.min(1, cut));
  return older.map((m) => ({ role: m.role, content: shorten(m.content, oldMax) }))
    .concat(h.slice(cut).map((m) => ({ role: m.role, content: shorten(m.content, recentMax) })));
}
async function once(messages) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 170000);
  try {
    const r = await fetch(CFG.fn + "/v1-messages", { method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "mythos-code", max_tokens: 8000, system: SYSTEM(), messages, stream: true }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error((j.error && j.error.message) || ("HTTP " + r.status)); e.status = r.status; throw e; }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", out = "";
    for (;;) { const x = await rd.read(); if (x.done) break; buf += dec.decode(x.value, { stream: true }); let i;
      while ((i = buf.indexOf("\n")) !== -1) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!l.startsWith("data:")) continue; let p; try { p = JSON.parse(l.slice(5)); } catch (e) { continue; }
        if (p.type === "error") { const e = new Error((p.error && p.error.message) || "Überlastet"); e.status = 529; throw e; }
        if (p.delta && p.delta.text) out += p.delta.text; } }
    if (!out.trim()) throw new Error("Leere Antwort"); return out;
  } finally { clearTimeout(to); }
}
async function call(h) {
  for (let a = 0; a < 6; a++) {
    try { return await once(compact(h, Math.min(2, Math.floor(a / 2)))); }
    catch (e) {
      if (e.status === 401) throw new Error("Anmeldung abgelaufen – bitte abmelden und neu anmelden.");
      if (/Daily limit/i.test(e.message)) throw new Error("Tageslimit erreicht – mit Pro unbegrenzt.");
      await new Promise((r) => setTimeout(r, Math.min(8000, 1500 * (a + 1))));
    }
  }
  throw new Error("Mythos ist gerade nicht erreichbar – bitte gleich nochmal versuchen.");
}
async function usage() { try { const j = await (await post("cli-auth", { action: "usage", api_key: cfg.key })).json();
  $("usage").textContent = j.limit == null ? "Usage " + j.used + " / ∞ (Pro)" : "Usage " + j.used + " / " + j.limit; } catch (e) {} }
async function send() {
  const q = $("inp").value.trim(); if (!q || busy) return; $("inp").value = ""; busy = true;
  let content = q; if (attach.length) content += "\n\nHochgeladene Dateien:\n" + attach.map((f) => "### " + f.name + "\n" + f.content).join("\n\n");
  attach = []; $("files").textContent = ""; add("u", q); history.push({ role: "user", content });
  const t0 = Date.now(); const live = add("t", "⏳ Mythos arbeitet… 0s");
  const tick = setInterval(() => { const s = fmt(Date.now() - t0); $("timer").textContent = "⏱ arbeitet… " + s; live.textContent = "⏳ Mythos arbeitet… " + s; $("log").appendChild(live); }, 250);
  try {
    for (let i = 0; i < 40; i++) {
      const out = await call(history); history.push({ role: "assistant", content: out });
      const m = out.match(/<tool>([\s\S]*?)<\/tool>/); const text = out.replace(/<tool>[\s\S]*?<\/tool>/g, "").trim();
      if (text) add("a", text); if (!m) break;
      let t; try { t = JSON.parse(m[1]); } catch (e) { history.push({ role: "user", content: "Tool-JSON ungültig." }); continue; }
      add("t", "⚙ " + t.name + " " + (t.cmd || t.path || ""));
      let res; if ((t.name === "run" || t.name === "write") && !$("auto").checked && !confirm("Mythos möchte ausführen:\n" + t.name + " " + (t.cmd || t.path))) res = "Vom Nutzer abgelehnt.";
      else res = await window.mythos.tool(t, cfg.folder);
      history.push({ role: "user", content: "Werkzeug-Ergebnis:\n" + res });
    }
  } catch (e) { add("a", "⚠ " + e.message); }
  clearInterval(tick); const took = fmt(Date.now() - t0); $("timer").textContent = "⏱ " + took;
  live.textContent = "✓ Mythos hat " + took + " gearbeitet"; $("log").appendChild(live); $("log").scrollTop = 1e9; busy = false; usage();
}
async function login() {
  $("lstat").textContent = "Browser öffnet sich …";
  const s = await (await post("cli-auth", { action: "start" })).json();
  window.mythos.open(CFG.site + "/cli-auth?code=" + s.code);
  $("lstat").textContent = "Code: " + s.code + " – bestätige im Browser.";
  const iv = setInterval(async () => { const p = await (await post("cli-auth", { action: "poll", code: s.code, poll_secret: s.poll_secret })).json();
    if (p.status === "ok") { clearInterval(iv); cfg.key = p.api_key; cfg.name = p.name; await window.mythos.setCfg(cfg); show(); }
    if (p.status === "expired") { clearInterval(iv); $("lstat").textContent = "Abgelaufen – nochmal versuchen."; } }, 2000);
}
function show() { $("login").style.display = "none"; $("app").style.display = "flex"; $("folder").textContent = cfg.folder || "Kein Ordner"; usage(); }
$("btnLogin").onclick = login; $("btnSend").onclick = send;
$("inp").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
$("btnFolder").onclick = async () => { const f = await window.mythos.pickFolder(); if (f) { cfg.folder = f; await window.mythos.setCfg(cfg); $("folder").textContent = f; } };
$("btnUp").onclick = async () => { const fs = await window.mythos.pickFiles(); attach = attach.concat(fs); $("files").textContent = "📎 " + attach.map((f) => f.name).join(", "); };
$("btnOut").onclick = async () => { cfg = {}; await window.mythos.setCfg(cfg); location.reload(); };
window.mythos.getCfg().then((c) => { cfg = c || {}; if (cfg.key) show(); });
