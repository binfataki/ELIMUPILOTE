(function () {
  const cfg = window.PILOT_CONFIG || {};
  const state = { rows: [], selected: null };
  const $ = (id) => document.getElementById(id);
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
  function render() { const q = $("search").value.toLowerCase(); const s = $("status").value; const rows = state.rows.filter(x => (!s || String(x.license_status).toUpperCase() === s) && [x.school_name, x.school_id, x.pc_id].join(" ").toLowerCase().includes(q)); $("rows").innerHTML = rows.map(x => `<tr><td><b>${escapeHtml(x.school_name || "Établissement sans nom")}</b><small>${escapeHtml(x.school_id || "—")}</small></td><td><code title="${escapeHtml(x.pc_id || "")}">${escapeHtml(compactPc(x.pc_id))}</code></td><td>${escapeHtml(formatDate(x.last_seen_at))}</td><td>${escapeHtml(formatDate(x.date_out))}</td><td><span class="badge ${escapeHtml(String(x.license_status || "EN_ATTENTE").toLowerCase())}">${escapeHtml(x.license_status || "EN_ATTENTE")}</span></td><td><button class="edit" data-school="${escapeHtml(x.school_id)}" data-pc="${escapeHtml(x.pc_id)}">Gérer</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">Aucune installation ne correspond à la recherche.</td></tr>`; $("total").textContent = state.rows.length; $("active").textContent = state.rows.filter(x => String(x.license_status).toUpperCase() === "ACTIF").length; $("pending").textContent = state.rows.filter(x => !String(x.license_status || "").trim() || String(x.license_status).toUpperCase() === "EN_ATTENTE").length; $("renew").textContent = state.rows.filter(x => { const d = new Date(x.date_out); return d > new Date() && d < new Date(Date.now() + 7 * 86400000); }).length; document.querySelectorAll(".edit").forEach(b => b.onclick = () => openEdit(b.dataset.school, b.dataset.pc)); }
  function load() { if (!cfg.apiUrl) { $("state").textContent = "Connexion non configurée"; $("configDialog").showModal(); return Promise.resolve(); } $("state").textContent = "Synchronisation…"; return api("listInstallations").then(r => { if (!r.ok) throw new Error(r.message || r.error); state.rows = r.installations || []; $("state").textContent = "Pilote connecté"; render(); }).catch(e => { $("state").textContent = "Connexion indisponible"; show(e.message, true); throw e; }); }
  function openEdit(school, pc) { const x = state.rows.find(r => r.school_id === school && r.pc_id === pc); if (!x) return; state.selected = x; $("editSchool").value = school; $("editPc").value = pc; $("editIdentity").textContent = `${x.school_name || school} · ${pc}`; $("editDate").value = x.date_out ? new Date(x.date_out).toISOString().slice(0, 10) : ""; $("editStatus").value = x.license_status || "EN_ATTENTE"; $("editDialog").showModal(); }
  $("configForm").onsubmit = (e) => { e.preventDefault(); cfg.apiUrl = $("apiUrl").value.trim(); cfg.apiKey = $("apiKey").value; localStorage.setItem("elimu-pilot-config", JSON.stringify({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, configVersion: cfg.configVersion })); $("configDialog").close(); load(); };
  $("editForm").onsubmit = (e) => { e.preventDefault(); const button = $("save-edit"); const status = $("editStatus").value; button.disabled = true; button.textContent = "Enregistrement…"; show("Enregistrement de l'autorisation…"); api("updateLicense", { school_id: $("editSchool").value, pc_id: $("editPc").value, date_out: $("editDate").value, license_status: status }).then(r => { if (!r.ok) throw new Error(r.message || r.error); $("editDialog").close(); return load().then(() => show("Autorisation enregistrée : " + status + ".")); }).catch(e => show("Échec de l'enregistrement : " + e.message, true)).finally(() => { button.disabled = false; button.textContent = "Enregistrer l'accès"; }); };
  $("settings").onclick = () => { $("apiUrl").value = cfg.apiUrl || ""; $("apiKey").value = cfg.apiKey || ""; $("configDialog").showModal(); }; $("refresh").onclick = load; $("search").oninput = render; $("status").onchange = render; load();
})();
