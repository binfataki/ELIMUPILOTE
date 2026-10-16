/* ELIMU Control — couche UI. Chargé APRÈS app.js, ne modifie pas sa logique.
   API explicite (recommandée) : ElimuUI.saveStart() / saveSuccess(msg) / saveError(msg) / toast(msg, 'ok'|'error') */
(() => {
  const $ = (id) => document.getElementById(id);
  const dlg = $('editDialog'), form = $('editForm'), btn = $('save-edit'), lbl = btn.querySelector('.lbl');
  const fb = $('feedback'), diff = $('diff'), status = $('editStatus'), date = $('editDate');
  const verifyRow = $('verifyRow'), verify = $('verify'), toasts = $('toasts');
  const LABELS = { EN_ATTENTE: 'En attente', ACTIF: 'Actif', DESACTIVE: 'Désactivé' };
  const TIMEOUT = 20000;
  let initial = null, saving = false, timer = null, allowClose = false;

  /* ---------- Toasts ---------- */
  function toast(msg, type = '') {
    if (!msg) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = msg; toasts.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'error' ? 6000 : 3500);
  }

  /* ---------- Formulaire : changements détectés ---------- */
  const fmt = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'aucune');
  const current = () => ({ status: status.value, date: date.value });
  const changes = () => {
    if (!initial) return [];
    const c = current(), out = [];
    if (c.status !== initial.status) out.push(['Accès', LABELS[initial.status] || initial.status, LABELS[c.status]]);
    if (c.date !== initial.date) out.push(['Expiration', fmt(initial.date), fmt(c.date)]);
    return out;
  };
  function needsVerify() { return initial && initial.status !== 'ACTIF' && status.value === 'ACTIF'; }

  function refresh() {
    if (saving) return;
    const list = changes();
    diff.innerHTML = list.map(([k, a, b]) => `<div><em>${k}</em><s>${a}</s><span>→</span><b>${b}</b></div>`).join('');
    verifyRow.hidden = !needsVerify();
    if (verifyRow.hidden) verify.checked = false;
    const ok = list.length > 0 && (!needsVerify() || verify.checked);
    btn.disabled = !ok;
    btn.title = !list.length ? 'Aucune modification à enregistrer' : (!ok ? "Confirmez la vérification avant d'activer" : '');
    setBtn('idle');
  }

  function setBtn(s, text) {
    btn.dataset.s = s === 'idle' ? '' : s;
    lbl.textContent = text || ({ saving: 'Enregistrement…', success: 'Accès enregistré', error: 'Réessayer' }[s] || "Enregistrer l'accès");
  }
  function setFb(type, text) {
    fb.hidden = !text; fb.className = 'feedback ' + type; fb.textContent = text || '';
  }
  const lock = (v) => form.querySelectorAll('input,select,button').forEach((el) => {
    if (el !== btn) el.disabled = v;
  });

  /* ---------- Cycle de sauvegarde ---------- */
  function saveStart() {
    saving = true; btn.disabled = true; lock(true); setBtn('saving'); setFb('busy', 'Application des changements en cours…');
    clearTimeout(timer);
    timer = setTimeout(() => saveError("Le serveur n'a pas répondu. Vérifiez la connexion et réessayez."), TIMEOUT);
  }
  function end() { clearTimeout(timer); saving = false; lock(false); }
  function saveSuccess(msg) {
    if (!saving) return; end();
    setBtn('success'); setFb('ok', msg || 'Changements appliqués. Le registre est à jour.');
    toast(msg || `Accès mis à jour : ${$('editIdentity').textContent.split('\n')[0]}`, 'ok');
    document.getElementById('refresh')?.click();
    setTimeout(() => { allowClose = true; dlg.open && dlg.close(); allowClose = false; }, 1300);
  }
  function saveError(msg) {
    if (!saving) return; end();
    btn.disabled = false; setBtn('error'); setFb('error', msg || "L'enregistrement a échoué. Aucun changement n'a été appliqué.");
    toast("Échec de l'enregistrement", 'error');
  }

  // Empêche app.js / method="dialog" de fermer la fenêtre avant la confirmation.
  const nativeClose = dlg.close.bind(dlg);
  dlg.close = (v) => { if (saving && !allowClose) return; nativeClose(v); };
  dlg.addEventListener('cancel', (e) => { if (saving) e.preventDefault(); });

  form.addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();               // garde la fenêtre ouverte (les autres handlers s'exécutent quand même)
    if (btn.disabled || saving) { e.stopImmediatePropagation(); return; }
    saveStart();
  }, true);

  // Repli automatique si app.js ne appelle pas l'API : on lit le message de statut qu'il publie.
  const msg = $('message');
  new MutationObserver(() => {
    const t = msg.textContent.trim(); if (!t) return;
    if (!saving) { toast(t, /erreur|échec|echec|impossible|invalide/i.test(t) ? 'error' : ''); return; }
    /erreur|échec|echec|impossible|invalide|refus/i.test(t) ? saveError(t) : saveSuccess(t);
  }).observe(msg, { childList: true, characterData: true, subtree: true });

  /* ---------- Ouverture de la fenêtre ---------- */
  new MutationObserver(() => {
    if (!dlg.open) { initial = null; return; }
    setTimeout(() => {
      initial = current(); setFb('', ''); saving = false; refresh();
      const id = $('editIdentity'); if (id && !id.querySelector('b') && id.textContent.trim()) {
        const [a, ...r] = id.textContent.trim().split(/\s*[·•\-—|]\s*/); id.innerHTML = `<b></b><span></span>`;
        id.firstChild.textContent = a; id.lastChild.textContent = r.join(' · ');
      }
    }, 0);
  }).observe(dlg, { attributes: true, attributeFilter: ['open'] });

  [status, date].forEach((el) => el.addEventListener('input', refresh));
  verify.addEventListener('change', refresh);
  $('dateChips').addEventListener('click', (e) => {
    const d = +e.target.dataset?.days; if (!d) return;
    const base = date.value && new Date(date.value) > new Date() ? new Date(date.value) : new Date();
    base.setDate(base.getDate() + d); date.value = base.toISOString().slice(0, 10); refresh();
  });

  /* ---------- Tableau : badges, état vide, compteur ---------- */
  const rows = $('rows'), empty = $('empty');
  function decorate() {
    rows.querySelectorAll('td').forEach((td) => {
      const t = td.textContent.trim();
      if (LABELS[t] && !td.querySelector('.badge')) td.innerHTML = `<span class="badge ${t}">${LABELS[t]}</span>`;
    });
    const n = rows.querySelectorAll('tr').length;
    empty.hidden = n > 0; $('count').textContent = n ? `${n} installation${n > 1 ? 's' : ''} affichée${n > 1 ? 's' : ''}` : '';
    const st = $('state'); st.classList.toggle('ok', /connect|à jour|synchron/i.test(st.textContent) && !/non|erreur/i.test(st.textContent));
    st.classList.toggle('error', /erreur|échec|impossible/i.test(st.textContent));
    $('railDot').classList.toggle('on', st.classList.contains('ok'));
    const r = $('refresh'); if (r.getAttribute('aria-busy')) r.removeAttribute('aria-busy');
  }
  const mo = new MutationObserver(decorate);
  mo.observe(rows, { childList: true, subtree: true }); mo.observe($('state'), { childList: true, characterData: true, subtree: true });
  $('refresh').addEventListener('click', function () { this.setAttribute('aria-busy', 'true'); setTimeout(() => this.removeAttribute('aria-busy'), 8000); });
  decorate();

  window.ElimuUI = { saveStart, saveSuccess, saveError, toast };
})();
