(function () {
  const cfg = window.PILOT_CONFIG || {};
  const state = { rows: [], selected: null, loaded: false, lastAlertKey: "", refreshTimer: null, loading: false };
  const AUTO_REFRESH_MS = 30 * 1000;
  const $ = (id) => document.getElementById(id);
  let deferredInstallPrompt = null;
  const saved = JSON.parse(localStorage.getItem("elimu-pilot-config") || "null");
  // Ne pas réutiliser silencieusement une ancienne URL Apps Script après
  // remplacement du déploiement. Une configuration explicitement enregistrée
  // par l'utilisateur reste prioritaire, mais les anciennes configurations
  // sans version sont invalidées.
  if (saved && saved.configVersion === cfg.configVersion) { cfg.apiUrl = saved.apiUrl; cfg.apiKey = saved.apiKey; }
  function show(msg, error) { $("message").textContent = msg || ""; $("message").className = "message " + (error ? "error" : "ok"); }
  function formatDate(v) { if (!v) return "—"; const d = new Date(v); if (Number.isNaN(d.getTime())) return v; const p = n => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
  function compactPc(value) { const text = String(value || "—"); return text.length > 22 ? `${text.slice(0, 10)}…${text.slice(-10)}` : text; }
  async function api(action, data) {
    const params = Object.assign({ action }, data || {}); if (cfg.apiKey) params.api_key = cfg.apiKey;
    const method = data && action === "updateLicense" ? "POST" : "GET";
    const response = await fetch(cfg.apiUrl + (method === "GET" ? "?" + new URLSearchParams(params) : ""), method === "POST" ? { method, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(params) } : {});
    const raw = await response.text(); let json;
    try { json = JSON.parse(raw); } catch (_) { throw new Error("Le pilote a renvoyé une réponse invalide. Vérifiez l'URL /exec et le déploiement Apps Script."); }
    if (!response.ok) throw new Error(`Erreur réseau (${response.status})`);
    return json;
  }
  function render() { const q = $("search").value.toLowerCase(); const s = $("status").value; const rows = state.rows.filter(x => (!s || String(x.license_status).toUpperCase() === s) && [x.school_name, x.school_id, x.pc_id].join(" ").toLowerCase().includes(q)); $("rows").innerHTML = rows.map(x => `<tr><td data-label="Établissement"><b>${escapeHtml(x.school_name || "Établissement sans nom")}</b><small>${escapeHtml(x.school_id || "—")}</small></td><td data-label="Empreinte PC"><code title="${escapeHtml(x.pc_id || "")}">${escapeHtml(compactPc(x.pc_id))}</code></td><td data-label="Dernier contact">${escapeHtml(formatDate(x.last_seen_at))}</td><td data-label="Expiration">${escapeHtml(formatDate(x.date_out))}</td><td data-label="État"><span class="badge ${escapeHtml(String(x.license_status || "EN_ATTENTE").toLowerCase())}">${escapeHtml(x.license_status || "EN_ATTENTE")}</span></td><td data-label="Actions"><button class="edit" data-school="${escapeHtml(x.school_id)}" data-pc="${escapeHtml(x.pc_id)}">Gérer</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">Aucune installation ne correspond à la recherche.</td></tr>`; $("total").textContent = state.rows.length; $("active").textContent = state.rows.filter(x => String(x.license_status).toUpperCase() === "ACTIF").length; $("pending").textContent = state.rows.filter(x => !String(x.license_status || "").trim() || String(x.license_status).toUpperCase() === "EN_ATTENTE").length; $("renew").textContent = state.rows.filter(x => { const d = new Date(x.date_out); return d > new Date() && d < new Date(Date.now() + 7 * 86400000); }).length; document.querySelectorAll(".edit").forEach(b => b.onclick = () => openEdit(b.dataset.school, b.dataset.pc)); }
  function installationKey(x) { return `${x.school_id || ""}|${x.pc_id || ""}`; }
  function alertStatuses(rows) {
    const alerts = rows.filter(x => ["EN_ATTENTE", "DESACTIVE"].includes(String(x.license_status || "EN_ATTENTE").toUpperCase()));
    if (!alerts.length) { state.lastAlertKey = ""; return; }
    const key = alerts.map(x => `${installationKey(x)}=${String(x.license_status || "EN_ATTENTE").toUpperCase()}`).sort().join("|");
    if (key === state.lastAlertKey) return;
    state.lastAlertKey = key;
    const pending = alerts.filter(x => String(x.license_status || "EN_ATTENTE").toUpperCase() === "EN_ATTENTE");
    const disabled = alerts.filter(x => String(x.license_status || "").toUpperCase() === "DESACTIVE");
    const parts = [];
    if (pending.length) parts.push(`${pending.length} installation${pending.length > 1 ? "s" : ""} en attente`);
    if (disabled.length) parts.push(`${disabled.length} installation${disabled.length > 1 ? "s" : ""} désactivée${disabled.length > 1 ? "s" : ""}`);
    const message = "Alerte licence : " + parts.join(" · ");
    if (window.ElimuUI && typeof window.ElimuUI.toast === "function") window.ElimuUI.toast(message, disabled.length ? "error" : "");
    else show(message, Boolean(disabled.length));
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification("ELIMU Control", { body: message }); } catch (_) {}
    }
  }
  function scheduleAutoRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
      if (!document.hidden && navigator.onLine) load(true).catch(() => {});
    }, AUTO_REFRESH_MS);
  }
  function load(silent = false) { if (!cfg.apiUrl) { $("state").textContent = "Connexion non configurée"; $("configDialog").showModal(); return Promise.resolve(); } if (state.loading) return Promise.resolve(); state.loading = true; if (!silent) $("state").textContent = "Synchronisation…"; return api("listInstallations").then(r => { if (!r.ok) throw new Error(r.message || r.error); state.rows = r.installations || []; $("state").textContent = "Pilote connecté"; render(); alertStatuses(state.rows); state.loaded = true; }).catch(e => { $("state").textContent = "Connexion indisponible"; if (!silent) show(e.message, true); throw e; }).finally(() => { state.loading = false; }); }
  function openEdit(school, pc) { const x = state.rows.find(r => r.school_id === school && r.pc_id === pc); if (!x) return; state.selected = x; $("editSchool").value = school; $("editPc").value = pc; $("editIdentity").textContent = `${x.school_name || school} · ${pc}`; $("editDate").value = x.date_out ? new Date(x.date_out).toISOString().slice(0, 10) : ""; $("editStatus").value = x.license_status || "EN_ATTENTE"; $("editDialog").showModal(); }
  $("configForm").onsubmit = (e) => { e.preventDefault(); cfg.apiUrl = $("apiUrl").value.trim(); cfg.apiKey = $("apiKey").value; localStorage.setItem("elimu-pilot-config", JSON.stringify({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, configVersion: cfg.configVersion })); $("configDialog").close(); load(); };
  $("editForm").onsubmit = (e) => { e.preventDefault(); const button = $("save-edit"); const status = $("editStatus").value; button.disabled = true; button.textContent = "Enregistrement…"; show("Enregistrement de l'autorisation…"); api("updateLicense", { school_id: $("editSchool").value, pc_id: $("editPc").value, date_out: $("editDate").value, license_status: status }).then(r => { if (!r.ok) throw new Error(r.message || r.error); $("editDialog").close(); return load().then(() => show("Autorisation enregistrée : " + status + ".")); }).catch(e => show("Échec de l'enregistrement : " + e.message, true)).finally(() => { button.disabled = false; button.textContent = "Enregistrer l'accès"; }); };
  $("settings").onclick = () => { $("apiUrl").value = cfg.apiUrl || ""; $("apiKey").value = cfg.apiKey || ""; $("configDialog").showModal(); }; $("refresh").onclick = () => load(false); $("search").oninput = render; $("status").onchange = render;
  const install = $("install");
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; install.classList.add("ready"); });
  install.onclick = async () => {
    if (!deferredInstallPrompt) {
      show("Sur téléphone : ouvrez le menu du navigateur puis choisissez « Ajouter à l'écran d'accueil » ou « Installer l'application »." );
      return;
    }
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === "accepted") show("ELIMU Control est en cours d'installation.");
    deferredInstallPrompt = null;
    install.classList.remove("ready");
  };
  window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; install.hidden = true; });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  scheduleAutoRefresh(); load();
})();
