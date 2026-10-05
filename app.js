/* Décodeur Q-code NOTAM — interface.
   IMPORTANT : à chaque modification de l'appli, augmenter APP_VERSION ici
   ET VERSION dans sw.js (mêmes valeurs). C'est ce changement qui déclenche
   la mise à jour automatique sur les téléphones. */
const APP_VERSION = "3.2";

const $ = (s) => document.querySelector(s);
document.getElementById("version").textContent = "Version " + APP_VERSION;
let jsPDFpret = null; // déclaré ici : le tri peut être lancé dès le démarrage
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- Dates en heure de Paris ---------- */
const TZ = "Europe/Paris";
const fJour = (ms) => new Date(ms).toLocaleDateString("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const fHeure = (ms) => new Date(ms).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fUTC = (ms) => new Date(ms).toISOString().slice(11, 16);
const fDate = (ms) => ms === Infinity ? "permanent" : `${fJour(ms)} ${fHeure(ms)}`;
const fDateLongue = (ms) => new Date(ms).toLocaleDateString("fr-FR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }) + " à " + fHeure(ms);
function fPlage(a, b) {
  if (b === Infinity) return `${fDate(a)} → permanent`;
  return fJour(a) === fJour(b - 1) ? `${fJour(a)} · ${fHeure(a)} → ${fHeure(b)}` : `${fDate(a)} → ${fDate(b)}`;
}

/* ---------- Onglets ---------- */
document.querySelectorAll(".onglets button").forEach((b) => {
  b.addEventListener("click", () => ouvrirOnglet(b.dataset.tab));
});
function ouvrirOnglet(nom) {
  if (!document.getElementById("tab-" + nom)) nom = "decoder";
  document.querySelectorAll(".onglets button").forEach((x) => x.classList.toggle("actif", x.dataset.tab === nom));
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("actif", x.id === "tab-" + nom));
  try { localStorage.setItem("onglet", nom); } catch (e) {}
  if (nom === "carte" && window.majCarte) window.majCarte();
}

/* ---------- Saisie ---------- */
const saisie = $("#saisie");
const EXEMPLES = ["QRRCA", "QRTTT", "QRTCA", "QWBLW", "QWPLW", "QOLAS", "QACAH", "QATCH", "QMRLC", "QOBCE"];
const EXEMPLE_NOTAM = `LFFA-W1750/26
DU: 19 08 2026 04:31 AU: 24 10 2026 16:26
A) LFGB
Q) LFEE / QWBLW / IV / M / AW / 025/050 / 4744N00726E005
D) SR-1000 1200-SS
E) VOLTIGE SUR AD MULHOUSE-HABSHEIM:
AXE 020/200 LONGUEUR 2000M CENTRE SUR ARP: 474414N 0072547E
INFO: BALE INFO 130.905MHZ
HABSHEIM A/A 125.255MHZ
F) 2500FT AMSL
G) 5000FT AMSL`;

$("#exemples").innerHTML = EXEMPLES.map((c) => `<button data-c="${c}">${c}</button>`).join("") +
  `<button data-ex="1">Exemple NOTAM complet</button>`;
$("#exemples").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  saisie.value = b.dataset.ex ? EXEMPLE_NOTAM : b.dataset.c;
  afficher();
});
saisie.addEventListener("input", afficher);
$("#effacer").addEventListener("click", () => { saisie.value = ""; afficher(); saisie.focus(); });
$("#coller").addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) { saisie.value = t; afficher(); }
  } catch (e) { toast("Touchez la bulle « Coller » qui apparaît, ou appui long dans le champ → Coller", 4500); saisie.focus(); }
});

function ajusterChamp() {
  const long = saisie.value.length > 14 || saisie.value.includes("\n");
  saisie.classList.toggle("long", long);
  saisie.style.height = "auto";
  saisie.style.height = Math.min(saisie.scrollHeight + 2, long ? 220 : 80) + "px";
  saisie.style.overflowY = saisie.scrollHeight > 220 ? "auto" : "hidden";
}

let minuterie = null;
function afficher() {
  const v = saisie.value;
  ajusterChamp();
  try { localStorage.setItem("derniere", v); } catch (e) {}
  clearInterval(minuterie);
  const zone = $("#resultat");
  if (!v.trim()) { zone.innerHTML = ""; return; }

  if (estNotamComplet(v)) {
    const blocs = decouperBriefing(v);
    if (blocs.length > 1) {
      zone.innerHTML = "";
      saisie.value = "";
      try { localStorage.setItem("derniere", ""); } catch (e) {}
      tTexte.value = v;
      ouvrirOnglet("trier");
      trier();
      window.scrollTo(0, 0);
      toast(`${blocs.length} NOTAM collés : je les trie pour vous`, 3000);
      return;
    }
    const un = blocs.length === 1 ? blocs[0] : v;
    zone.innerHTML = htmlNotam(un);
    minuterie = setInterval(() => { if (!document.hidden) zone.innerHTML = htmlNotam(un); }, 60000);
    return;
  }
  const r = decoder(v);
  if (!r) { zone.innerHTML = `<div class="erreur">Code non reconnu. Tapez 2 à 4 lettres (avec ou sans Q), ou collez le NOTAM entier.</div>`; return; }
  zone.innerHTML = htmlCode(r) + htmlLigneQ(r);
}

/* ---------- Carte du code Q ---------- */
function htmlCode(r) {
  if (r.erreur) return `<div class="erreur">${esc(r.erreur)}</div>`;
  const s = r.sujet, e = r.etat;
  const etatMin = r.etatTxt && !/^[A-Z]{2}/.test(r.etatTxt) ? r.etatTxt.charAt(0).toLowerCase() + r.etatTxt.slice(1) : r.etatTxt;
  const resume = r.sujetTxt && r.etatTxt ? `${esc(r.sujetTxt)} — ${esc(etatMin)}` : esc(r.sujetTxt || "");
  let html = `<div class="carte">
    <div class="code"><span class="q">Q</span><span class="s">${esc(s)}</span><span class="e">${esc(e || "··")}</span></div>
    <p class="resume">${resume}</p>
    <div class="ligne"><div class="k f">${esc(s[0] || "")}</div><div class="v">${esc(r.famille || "Famille inconnue")}<small>1re lettre : la grande famille</small></div></div>
    <div class="ligne"><div class="k s">${esc(s)}</div><div class="v">${esc(r.sujetTxt || "—")}<small>2e et 3e lettres : de quoi parle le NOTAM</small></div></div>`;
  if (e.length === 2) {
    html += `<div class="ligne"><div class="k e">${esc(e)}</div><div class="v">${esc(r.etatTxt)}<small>4e et 5e lettres : ce qui se passe</small></div></div>`;
  }
  if (r.conseil) {
    const alerte = e === "CA" || e === "LC" || e === "AS" || e === "AU";
    html += `<div class="conseil${alerte ? " alerte" : ""}">${esc(r.conseil)}</div>`;
  }
  return html + `</div>`;
}

function htmlLigneQ(r) {
  if (!r || !r.ligne) return "";
  const L = r.ligne;
  return `<div class="carte details"><h3>Reste de la ligne Q)</h3><dl>
    ${L.fir ? `<dt>FIR</dt><dd>${esc(L.fir)}</dd>` : ""}
    ${L.trafic ? `<dt>Trafic concerné</dt><dd>${esc(L.trafic)}</dd>` : ""}
    ${L.objet.length ? `<dt>Objet</dt><dd>${L.objet.map(esc).join("<br>")}</dd>` : ""}
    ${L.portee ? `<dt>Portée</dt><dd>${esc(L.portee)}</dd>` : ""}
    ${L.bas || L.haut ? `<dt>Limites (indicatives, voir F et G)</dt><dd>${esc(L.bas)} → ${esc(L.haut)}</dd>` : ""}
    ${L.position ? `<dt>Centre${L.rayon ? " et rayon" : ""}</dt><dd>${esc(L.position)}${L.rayon ? " — rayon " + esc(L.rayon) : ""}</dd>` : ""}
  </dl></div>`;
}

/* ---------- NOTAM complet ---------- */
function htmlNotam(texte) {
  const n = lireChamps(texte);
  const st = evaluerNotam(n);
  const renvoi = n.q && n.q.etat === "TT";
  let html = "";

  // 1. Statut
  let cls = st.etat, gros = "", detail = "";
  const prochaine = st.prochaines && st.prochaines[0];
  if (st.etat === "inconnu") {
    gros = "DATES NON TROUVÉES";
    detail = "Collez le NOTAM avec ses dates (DU / AU, ou champs B et C).";
  } else if (st.etat === "expire") {
    gros = "EXPIRÉ";
    detail = `Fin de validité : ${fDate(st.fin)}`;
  } else if (renvoi && st.etat !== "futur") {
    cls = "renvoi";
    gros = "SIMPLE RENVOI (TRIGGER)";
    detail = "Ce NOTAM est valide mais n'active rien : cherchez le NOTAM d'activation (état CA) de la zone.";
  } else if (st.etat === "actif") {
    gros = "EN VIGUEUR MAINTENANT";
    detail = st.courante[1] === Infinity ? "Permanent" : `Jusqu'à ${fDate(st.courante[1])}`;
    if (n.horaires && prochaine) detail += `<br>Plage suivante : ${fPlage(prochaine[0], prochaine[1])}`;
  } else if (st.etat === "futur") {
    gros = "PAS ENCORE EN VIGUEUR";
    detail = prochaine ? `Début : ${fPlage(prochaine[0], prochaine[1])}` : `Début : ${fDate(st.debut)}`;
  } else {
    gros = "PAS EN VIGUEUR EN CE MOMENT";
    detail = prochaine ? `Prochaine plage : ${fPlage(prochaine[0], prochaine[1])}` : "Plus de plage prévue avant la fin de validité.";
  }
  html += `<div class="statut-notam ${cls}"><div class="gros">${gros}</div><div class="detail">${detail}</div>
    <div class="heure">Vérifié à ${fHeure(st.now)} (heure de Paris) · actualisé chaque minute</div></div>`;

  if (n.id) html += `<p class="titre-id">${esc(n.id)}</p>`;

  // 2. Code Q
  if (n.q) html += htmlCode(n.q);

  // 3. Validité et horaires
  if (st.debut != null) {
    html += `<div class="carte details"><h3>Validité (heure de Paris)</h3><dl>
      <dt>Du</dt><dd>${fDateLongue(st.debut)} <small>(${fUTC(st.debut)} UTC)</small></dd>
      <dt>Au</dt><dd>${st.fin === Infinity ? "Permanent" : fDateLongue(st.fin) + ` <small>(${fUTC(st.fin)} UTC)</small>`}${n.estime ? " — date estimée, peut être prolongée" : ""}</dd>`;
    if (n.horaires) {
      const brut = n.sourceHoraires === "D" ? n.champs.D : "";
      html += `<dt>Horaires ${n.sourceHoraires === "D" ? "(champ D, en UTC)" : "(lus dans le texte E)"}</dt>
        <dd>${brut ? `<span class="texte-e">${esc(brut)}</span>` : "voir le texte ci-dessous"}</dd>`;
      if (st.prochaines && (st.prochaines.length || st.courante)) {
        const liste = [];
        if (st.courante && st.courante[1] !== Infinity) liste.push(`<li>En cours → ${fDate(st.courante[1])}</li>`);
        st.prochaines.forEach(([a, b]) => liste.push(`<li>${fPlage(a, b)}</li>`));
        html += `<dt>Prochaines plages</dt><dd><ul class="plages">${liste.join("")}</ul></dd>`;
      }
    } else if (n.champs.D) {
      html += `<dt>Horaires (champ D)</dt><dd><span class="texte-e">${esc(n.champs.D)}</span></dd>`;
    } else {
      html += `<dt>Horaires</dt><dd>Pas de champ D : en vigueur en continu sur toute la période.</dd>`;
    }
    html += `</dl>`;
    if (n.horaires && n.horaires.partiel) html += `<p class="note">⚠ Une partie de l'horaire n'a pas été comprise : lisez le champ D.</p>`;
    if (n.sourceHoraires === "E") html += `<p class="note">⚠ Horaires repérés automatiquement dans le texte : vérifiez-les.</p>`;
    if (n.champs.D && !n.horaires) html += `<p class="note">⚠ Horaire non interprété : statut calculé sur les seules dates de validité. Lisez le champ D.</p>`;
    if (st.soleilApprox) html += `<p class="note">Lever / coucher du soleil calculés pour le centre de la France (position non trouvée).</p>`;
    html += `</div>`;
  }

  // 4. Limites
  if (n.champs.F || n.champs.G) {
    html += `<div class="carte details"><h3>Limites verticales</h3><dl>
      ${n.champs.G ? `<dt>Plafond (G)</dt><dd>${esc(lireLimite(n.champs.G))}</dd>` : ""}
      ${n.champs.F ? `<dt>Plancher (F)</dt><dd>${esc(lireLimite(n.champs.F))}</dd>` : ""}
    </dl></div>`;
  }

  // 5. Texte E avec abréviations
  if (n.champs.E) {
    const { html: eh, trouvees } = surligner(n.champs.E);
    html += `<div class="carte"><h3 class="liste-titre">Texte du NOTAM (E)</h3><div class="texte-e">${eh}</div>
      <p class="note">Touchez un mot souligné pour sa signification.</p></div>`;
    if (trouvees.length) {
      html += `<div class="carte"><h3 class="liste-titre">Abréviations de ce NOTAM</h3>${trouvees.map((k) =>
        `<div class="item"><b>${esc(k)}</b><span>${esc(LEXIQUE[k])}</span></div>`).join("")}</div>`;
    }
  }

  // 6. Reste de la ligne Q
  html += htmlLigneQ(n.q);
  return html;
}

/* ---------- Surlignage des abréviations ---------- */
const CLES_SURLIGNAGE = Object.keys(LEXIQUE)
  .filter((k) => k.length >= 2 && !LEX_SANS_SURLIGNAGE.has(k))
  .sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"));
const RE_ABR = new RegExp("(^|[^A-Z])(" + CLES_SURLIGNAGE.join("|") + ")(?=[^A-Z]|$)", "g");

function surligner(texte) {
  let out = "", pos = 0;
  const trouvees = [];
  texte.replace(RE_ABR, (tout, avant, cle, idx) => {
    const debut = idx + avant.length;
    out += esc(texte.slice(pos, debut)) + `<span class="abr" data-k="${esc(cle)}">${esc(cle)}</span>`;
    pos = debut + cle.length;
    if (!trouvees.includes(cle)) trouvees.push(cle);
    return tout;
  });
  out += esc(texte.slice(pos));
  return { html: out, trouvees };
}
$("#resultat").addEventListener("click", (e) => {
  const a = e.target.closest(".abr");
  if (a) toast(`${a.dataset.k} : ${LEXIQUE[a.dataset.k]}`, 3500);
});

/* ---------- Trier un briefing ---------- */
const tDep = $("#tDep"), tDur = $("#tDur"), tAlt = $("#tAlt"), tTexte = $("#tTexte");
const pad = (x) => String(x).padStart(2, "0");
function valeurLocale(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function departMaintenant() { tDep.value = valeurLocale(Math.floor(Date.now() / 300000) * 300000); trier(); }

const RAISONS = {
  creneau: "Pas en vigueur pendant votre vol",
  altitude: "Au-dessus de votre altitude",
  tt: "Simples renvois vers un SUP AIP (trigger)",
  ifr: "Concernent seulement l'IFR",
  admin: "Administratif (téléphones, gestionnaires…)",
  checklist: "Listes récapitulatives"
};

function htmlNotamCourt(n, idx, raison) {
  try { return htmlNotamCourtInterne(n, idx, raison); }
  catch (e) {
    return `<div class="notam${estCoche(n) ? "" : " decoche"}" data-i="${idx}"><div class="haut"><label class="coche"><input type="checkbox" data-coche ${estCoche(n) ? "checked" : ""}></label></div><div class="titre">${esc(n.id || "NOTAM")} — non interprété, à lire vous-même</div>
      <div class="extrait">${esc((n.texte || "").slice(0, 200))}</div><div class="plus">▾ Touchez pour lire le NOTAM en entier</div></div>`;
  }
}
function htmlNotamCourtInterne(n, idx, raison) {
  const q = n.q && !n.q.erreur ? n.q : null;
  const f = q ? q.sujet[0] : "";
  const titre = q ? `${q.sujetTxt}${q.etatTxt ? " — " + q.etatTxt.charAt(0).toLowerCase() + q.etatTxt.slice(1) : ""}` : "Code non lu";
  let quand = "";
  if (n.pendantVol === null) quand = "⚠ Dates non trouvées : à vérifier";
  else if (n.pendantVol && n.pendantVol.length) {
    const [a, b] = [n.pendantVol[0][0], n.pendantVol[n.pendantVol.length - 1][1]];
    const toutLeVol = n.pendantVol.length === 1 && a <= trier.t1 && b >= trier.t2;
    quand = toutLeVol ? "En vigueur pendant tout le vol"
      : "En vigueur " + n.pendantVol.map(([x, y]) => `${fHeure(x)} → ${fHeure(y)}`).join(", ");
  }
  const lim = n.champs.F || n.champs.G ? `${n.champs.F || "?"} → ${n.champs.G || "?"}` : "";
  const extrait = (n.champs.E || "").replace(/\s+/g, " ").slice(0, 160);
  return `<div class="notam f-${f}${estCoche(n) ? "" : " decoche"}" data-i="${idx}">
    <div class="haut"><label class="coche" aria-label="Inclure dans le PDF"><input type="checkbox" data-coche ${estCoche(n) ? "checked" : ""}></label><span class="qc">${q ? `Q<span class="s">${q.sujet}</span><span class="e">${q.etat}</span>` : "—"}</span>
      <span class="ou">${esc(n.id || "")}${n.champs.A ? " · " + esc(n.champs.A.split(/\s+/)[0]) : ""}</span></div>
    <div class="titre">${esc(titre)}</div>
    ${quand ? `<div class="quand">${quand}</div>` : ""}
    ${lim ? `<div class="raison">Limites : ${esc(lim)}</div>` : ""}
    ${raison ? `<div class="raison">${esc(raison)}</div>` : ""}
    <div class="extrait">${esc(extrait)}</div>
    <div class="plus">▾ Touchez pour lire le NOTAM en entier</div>
  </div>`;
}

/* Détail déplié sur place, sans quitter la liste */
function htmlDeplie(n) {
  if (n.illisible) return `<div class="deplie"><div class="texte-e">${esc(n.texte)}</div><div class="liens"><button data-act="fermer">▴ Replier</button></div></div>`;
  const fin = n.perm || n.fin == null ? Infinity : n.fin;
  let h = `<div class="deplie"><dl>`;
  if (n.debut != null) h += `<dt>Validité (heure de Paris)</dt><dd>Du ${fDate(n.debut)} au ${fin === Infinity ? "permanent" : fDate(fin)}${n.estime ? " (estimée)" : ""}</dd>`;
  if (n.champs.D) h += `<dt>Horaires (champ D, en UTC)</dt><dd class="texte-e">${esc(n.champs.D)}</dd>`;
  if (n.champs.F || n.champs.G) h += `<dt>Limites</dt><dd>${esc(lireLimite(n.champs.F) || "?")}<br>→ ${esc(lireLimite(n.champs.G) || "?")}</dd>`;
  h += `</dl>`;
  if (n.champs.E) h += `<div class="texte-e">${surligner(n.champs.E).html}</div>`;
  h += `<div class="liens"><button data-act="fermer">▴ Replier</button><button data-act="analyse">Analyse complète →</button></div></div>`;
  return h;
}

/* Reprend automatiquement les réglages de l'en-tête du PIB SOFIA (une fois par briefing collé). */
function choisirDuree(min) {
  if (![...tDur.options].some((o) => +o.value === min)) {
    const o = document.createElement("option");
    o.value = min;
    o.textContent = Math.floor(min / 60) + " h" + (min % 60 ? " " + pad(min % 60) : "");
    tDur.appendChild(o);
  }
  tDur.value = String(min);
}
let entete = null;
function appliquerEntete(texte) {
  entete = lireEntetePIB(texte);
  if (!entete) return;
  const sig = [entete.depart, entete.dureeMin, entete.plafondFt].join("|");
  let deja = null;
  try { deja = localStorage.getItem("tEntete"); } catch (e) {}
  if (deja === sig) return;
  tDep.value = valeurLocale(entete.depart);
  if (entete.dureeMin) choisirDuree(entete.dureeMin);
  if (entete.plafondFt) tAlt.value = entete.plafondFt;
  try { localStorage.setItem("tEntete", sig); } catch (e) {}
  toast("Réglages repris du briefing SOFIA", 3000);
}

let listeTriee = [];
let dernierTri = null;

/* Cases à cocher : par défaut « À lire » = coché, écartés = décoché ; l'utilisateur peut changer. */
let choix = {};          // id du NOTAM → true / false (choix manuel)
let choixSig = "";       // briefing auquel ces choix se rapportent
const cleNotam = (n) => n.id || (n.texte || "").slice(0, 80);
const estCoche = (n) => (cleNotam(n) in choix ? choix[cleNotam(n)] : n.groupe === "garder");
function chargerChoix(texte) {
  const sig = texte.length + ":" + texte.slice(0, 200);
  if (sig === choixSig) return;
  choixSig = sig; choix = {};
  try {
    const c = JSON.parse(localStorage.getItem("tChoix") || "null");
    if (c && c.sig === sig) choix = c.choix || {};
  } catch (e) {}
}
function sauverChoix() { try { localStorage.setItem("tChoix", JSON.stringify({ sig: choixSig, choix })); } catch (e) {} }
function majCompteur() {
  const nb = listeTriee.filter(estCoche).length;
  const b = $("#btnPdf");
  if (b && !b.disabled) b.textContent = `📄 PDF des NOTAM cochés (${nb})`;
  const c = $("#nbCoches");
  if (c) c.textContent = nb;
  const l = $("#btnLire");
  if (l) l.textContent = `📖 Lire à l'écran (${nb})`;
}
function trier() {
  try { trierInterne(); }
  catch (err) {
    $("#tResultat").innerHTML = `<div class="erreur">Le tri n'a pas pu se faire (${esc(err && err.message || err)}).<br>Vérifiez en bas de l'écran que la version est bien ${APP_VERSION}, puis fermez et rouvrez l'appli.</div>`;
  }
}
function trierInterne() {
  const zone = $("#tResultat");
  const texte = tTexte.value;
  if (texte.trim()) appliquerEntete(texte);
  try {
    localStorage.setItem("tDur", tDur.value);
    localStorage.setItem("tAlt", tAlt.value);
    localStorage.setItem("tTexte", texte);
    localStorage.setItem("tDep", tDep.value);
  } catch (e) {}
  if (!texte.trim()) { zone.innerHTML = ""; return; }
  const dep = new Date(tDep.value).getTime();
  const dur = +tDur.value, alt = +tAlt.value || 99999;
  if (isNaN(dep)) { zone.innerHTML = `<div class="erreur">Indiquez l'heure de départ.</div>`; return; }

  const r = trierBriefing(texte, dep, dur, alt);
  if (!r.total) {
    zone.innerHTML = `<div class="erreur">Aucun NOTAM reconnu. Copiez la page SOFIA en entier (les numéros du type LFFA-R1234/26 doivent apparaître).</div>`;
    return;
  }
  trier.t1 = dep; trier.t2 = dep + dur * 60000;
  chargerChoix(texte);
  r.garder.forEach((n) => { n.groupe = "garder"; });
  for (const [cle, arr] of Object.entries(r.ecarter)) arr.forEach((n) => { n.groupe = cle; });
  listeTriee = [];
  const ajouter = (n, raison) => { listeTriee.push(n); return htmlNotamCourt(n, listeTriee.length - 1, raison); };
  const nbEcartes = r.total - r.garder.length;

  let html = `<div class="bilan">
    <div class="chiffres"><b>${r.garder.length}</b> à lire · ${nbEcartes} écarté${nbEcartes > 1 ? "s" : ""} <small>/ ${r.total}</small></div>
    ${entete && (entete.de || entete.vers) ? `<div class="creneau">Briefing SOFIA ${esc(entete.de || "")} → ${esc(entete.vers || "")}</div>` : ""}
    <div class="creneau">Vol du ${fJour(trier.t1)} · ${fHeure(trier.t1)} → ${fHeure(trier.t2)} (heure de Paris), jusqu'à ${alt.toLocaleString("fr-FR")} ft</div>
    <div class="creneau">Cochez / décochez les NOTAM : <b id="nbCoches">0</b> iront dans le PDF.</div>
    <button id="btnLire" class="btn-lire">📖 Lire à l'écran</button>
    <button id="btnPdf" class="btn-pdf">📄 PDF des NOTAM cochés</button>
  </div>`;
  dernierTri = { r, t1: trier.t1, t2: trier.t2, alt, entete };
  chargerJsPDF();

  html += `<h2 class="section">À LIRE</h2>`;
  html += r.garder.length ? r.garder.map((n) => ajouter(n)).join("") : `<p class="note">Rien ne vous concerne sur ce créneau.</p>`;

  html += `<h2 class="section">ÉCARTÉS</h2>`;
  for (const [cle, arr] of Object.entries(r.ecarter)) {
    if (!arr.length) continue;
    html += `<details class="ecartes"><summary>${esc(RAISONS[cle])} (${arr.length})</summary>${arr.map((n) => {
      let raison = "";
      if (cle === "altitude" && n.basFt) raison = `Commence à ${n.basFt.toLocaleString("fr-FR")} ft environ`;
      if (cle === "creneau") {
        const st = evaluerNotam(n, trier.t1);
        const p = st.prochaines && st.prochaines[0];
        raison = p ? `Plage suivante : ${fPlage(p[0], p[1])}` : st.etat === "expire" ? "Expiré" : "";
      }
      return ajouter(n, raison);
    }).join("")}</details>`;
  }
  html += `<p class="note">Le tri est une aide : en cas de doute, un NOTAM reste dans « À lire ». Les limites d'altitude du tri viennent de la ligne Q) et sont approximatives. Touchez un NOTAM pour le détail.</p>`;
  zone.innerHTML = html;
  majCompteur();
  if (window.majCarte && !document.getElementById("tab-carte").hidden && document.getElementById("tab-carte").classList.contains("actif")) window.majCarte();
}

[tDep, tDur, tAlt].forEach((el) => el.addEventListener("change", trier));
tAlt.addEventListener("input", trier);
tTexte.addEventListener("input", trier);
$("#tMaintenant").addEventListener("click", departMaintenant);
$("#tEffacer").addEventListener("click", () => { tTexte.value = ""; trier(); tTexte.focus(); });
$("#tColler").addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) { tTexte.value = t; trier(); }
  } catch (e) { toast("Touchez la bulle « Coller » qui apparaît, ou appui long dans le champ → Coller", 4500); tTexte.focus(); }
});
let positionTri = 0;
$("#tResultat").addEventListener("click", (e) => {
  if (e.target.closest("#btnPdf") || e.target.closest(".coche")) return;
  if (e.target.closest("#btnLire")) { ouvrirLecture(); return; }
  const abr = e.target.closest(".abr");
  if (abr) { toast(`${abr.dataset.k} : ${LEXIQUE[abr.dataset.k]}`, 3500); return; }
  const c = e.target.closest(".notam");
  if (!c) return;
  const n = listeTriee[+c.dataset.i];
  if (!n) return;
  const act = e.target.closest("button") && e.target.closest("button").dataset.act;
  if (act === "analyse") {
    positionTri = window.scrollY;
    saisie.value = n.texte;
    ouvrirOnglet("decoder");
    afficher();
    $("#retour").hidden = false;
    window.scrollTo(0, 0);
    return;
  }
  if (act === "fermer" || (c.classList.contains("ouvert") && !e.target.closest(".deplie"))) {
    c.classList.remove("ouvert");
    const d = c.querySelector(".deplie"); if (d) d.remove();
    return;
  }
  if (c.classList.contains("ouvert")) return; // clic dans le texte déplié : on ne replie pas
  c.classList.add("ouvert");
  c.insertAdjacentHTML("beforeend", htmlDeplie(n));
});

$("#tResultat").addEventListener("change", (e) => {
  const cb = e.target.closest("[data-coche]");
  if (!cb) return;
  const c = cb.closest(".notam");
  const n = listeTriee[+c.dataset.i];
  if (!n) return;
  choix[cleNotam(n)] = cb.checked;
  c.classList.toggle("decoche", !cb.checked);
  sauverChoix();
  majCompteur();
  if (window.majCarte) window.majCarte();
});

/* ---------- Lecture à l'écran des NOTAM cochés ---------- */
function htmlLecture() {
  const { t1, t2, alt, entete: en } = dernierTri;
  const retenus = listeTriee.filter(estCoche);
  let h = `<h2>NOTAM retenus (${retenus.length})</h2>
    <div class="entete">${en && (en.de || en.vers) ? esc((en.de || "") + " → " + (en.vers || "")) + " · " : ""}vol du ${fJour(t1)} · ${fHeure(t1)} → ${fHeure(t2)} (heure de Paris) · jusqu'à ${alt.toLocaleString("fr-FR")} ft</div>`;
  if (!retenus.length) return h + `<p class="note">Aucun NOTAM coché.</p>`;
  retenus.forEach((n, i) => {
    const q = n.q && !n.q.erreur ? n.q : null;
    const f = q ? q.sujet[0] : "";
    let quand = "";
    if (n.pendantVol === null) quand = "⚠ Dates non trouvées : à vérifier";
    else if (n.pendantVol && n.pendantVol.length) {
      const tout = n.pendantVol.length === 1 && n.pendantVol[0][0] <= t1 && n.pendantVol[0][1] >= t2;
      quand = tout ? "En vigueur pendant tout le vol" : "En vigueur " + n.pendantVol.map(([a, b]) => `${fHeure(a)} → ${fHeure(b)}`).join(", ");
    }
    const fin = n.perm || n.fin == null ? Infinity : n.fin;
    h += `<div class="lect f-${f}">
      <div class="n">${i + 1}. ${esc(n.id || "NOTAM")}${n.champs && n.champs.A ? " · " + esc(n.champs.A) : ""}${q ? " · " + q.code : ""}</div>
      ${q ? `<div class="t">${esc(q.sujetTxt)}${q.etatTxt ? " — " + esc(q.etatTxt.charAt(0).toLowerCase() + q.etatTxt.slice(1)) : ""}</div>` : ""}
      ${n.groupe && n.groupe !== "garder" ? `<div class="info"><span>Ajouté manuellement</span></div>` : ""}
      ${quand ? `<div class="quand">${quand}</div>` : ""}
      ${!n.illisible && n.debut != null ? `<div class="info"><span>Validité :</span> du ${fDate(n.debut)} au ${fin === Infinity ? "permanent" : fDate(fin)}</div>` : ""}
      ${!n.illisible && n.champs.D ? `<div class="info"><span>Horaires (UTC) :</span> ${esc(n.champs.D)}</div>` : ""}
      ${!n.illisible && (n.champs.F || n.champs.G) ? `<div class="info"><span>Limites :</span> ${esc(n.champs.F || "?")} → ${esc(n.champs.G || "?")}</div>` : ""}
      <div class="texte-e">${n.illisible ? esc(n.texte) : surligner(n.champs.E || "").html}</div>
    </div>`;
  });
  return h;
}
let positionAvantLecture = 0;
function ouvrirLecture() {
  if (!dernierTri) return;
  positionAvantLecture = window.scrollY;
  $("#lectureContenu").innerHTML = htmlLecture();
  $("#lecture").hidden = false;
  $("#lecture").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function fermerLecture() {
  $("#lecture").hidden = true;
  document.body.style.overflow = "";
  window.scrollTo(0, positionAvantLecture);
}
$("#lectureRetour").addEventListener("click", fermerLecture);
$("#lecturePdf").addEventListener("click", () => { const b = $("#btnPdf"); if (b) b.click(); });
$("#lectureContenu").addEventListener("click", (e) => {
  const abr = e.target.closest(".abr");
  if (abr) toast(`${abr.dataset.k} : ${LEXIQUE[abr.dataset.k]}`, 3500);
});

/* Retour au tri depuis l'analyse complète */
$("#btnRetour").addEventListener("click", () => {
  $("#retour").hidden = true;
  ouvrirOnglet("trier");
  requestAnimationFrame(() => window.scrollTo(0, positionTri));
});
saisie.addEventListener("input", () => { $("#retour").hidden = true; });

/* Restauration des réglages du tri */
try {
  if (localStorage.getItem("tDur")) choisirDuree(+localStorage.getItem("tDur"));
  if (localStorage.getItem("tAlt")) tAlt.value = localStorage.getItem("tAlt");
  if (localStorage.getItem("tTexte")) tTexte.value = localStorage.getItem("tTexte");
  const d = localStorage.getItem("tDep");
  if (d && new Date(d).getTime() > Date.now() - 12 * 3600000) tDep.value = d;
} catch (e) {}
if (!tDep.value) tDep.value = valeurLocale(Math.floor(Date.now() / 300000) * 300000);
trier();

/* ---------- PDF des NOTAM à lire (hors connexion, via jsPDF) ---------- */
function chargerJsPDF() {
  if (jsPDFpret) return jsPDFpret;
  jsPDFpret = new Promise((ok, ko) => {
    if (window.jspdf) return ok();
    const sc = document.createElement("script");
    sc.src = "./jspdf.min.js";
    sc.onload = () => ok();
    sc.onerror = () => { jsPDFpret = null; ko(); };
    document.head.appendChild(sc);
  });
  return jsPDFpret;
}

/* Les polices standard du PDF ne connaissent pas certains signes : on les remplace. */
const pdfTxt = (t) => String(t || "")
  .replace(/[  ]/g, " ").replace(/→/g, "->").replace(/≈/g, "~").replace(/[‘’]/g, "'")
  .replace(/[“”«»]/g, '"').replace(/[^\x00-\xFF€…–—·•Œœ'"]/g, "");

function construirePDF() {
  const { r, t1, t2, alt, entete: en } = dernierTri;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 15, L = 180, BAS = 282;
  let y = M;

  const place = (h) => { if (y + h > BAS) { doc.addPage(); y = M; } };
  const ecrire = (texte, { taille = 10, gras = false, police = "helvetica", couleur = [20, 20, 20], retrait = 0, interligne = 1.25 } = {}) => {
    doc.setFont(police, gras ? "bold" : "normal");
    doc.setFontSize(taille);
    doc.setTextColor(...couleur);
    const lignes = doc.splitTextToSize(pdfTxt(texte), L - retrait);
    const h = taille * 0.3528 * interligne;
    for (const l of lignes) { place(h); doc.text(l, M + retrait, y + h * 0.8); y += h; }
  };
  const trait = (couleur = [190, 190, 190]) => { place(4); doc.setDrawColor(...couleur); doc.setLineWidth(0.3); doc.line(M, y + 1.5, M + L, y + 1.5); y += 4; };
  const DATEH = (ms) => `${fDate(ms)} (${fUTC(ms)} UTC)`;

  // En-tête
  ecrire("Briefing NOTAM" + (en && (en.de || en.vers) ? ` — ${en.de || ""} -> ${en.vers || ""}` : ""), { taille: 18, gras: true });
  y += 1;
  ecrire(`Vol : ${DATEH(t1)} -> ${DATEH(t2)}`, { taille: 10 });
  ecrire(`Altitude maximale : ${alt.toLocaleString("fr-FR")} ft   ·   Heures en heure de Paris`, { taille: 10 });
  const retenus = listeTriee.filter(estCoche);
  const nonRetenus = listeTriee.filter((n) => !estCoche(n));
  ecrire(`${retenus.length} NOTAM retenus · ${nonRetenus.length} non retenus sur ${r.total}   ·   Édité le ${fDate(Date.now())}`, { taille: 10, couleur: [90, 90, 90] });
  trait([245, 166, 35]);

  // NOTAM retenus (cochés)
  ecrire("NOTAM RETENUS", { taille: 13, gras: true, couleur: [200, 120, 0] });
  y += 1;
  if (!retenus.length) ecrire("Aucun NOTAM coché.", { taille: 10 });
  retenus.forEach((n, i) => {
    if (n.illisible) {
      ecrire(`${i + 1}. ${n.id || "NOTAM"} — non interprété, texte brut :`, { taille: 11, gras: true });
      ecrire(n.texte, { taille: 9, police: "courier", retrait: 3, interligne: 1.3 });
      trait(); return;
    }
    const q = n.q && !n.q.erreur ? n.q : null;
    place(18);
    ecrire(`${i + 1}. ${n.id || "NOTAM"}   ·   ${n.champs.A || ""}   ·   ${q ? q.code : ""}`, { taille: 11, gras: true });
    if (q) ecrire(`${q.sujetTxt}${q.etatTxt ? " — " + q.etatTxt : ""}`, { taille: 10, gras: true, couleur: [60, 60, 60] });
    if (n.groupe !== "garder") ecrire(`Ajouté manuellement (tri : ${RAISONS[n.groupe] || "écarté"})`, { taille: 9, couleur: [90, 90, 90] });
    if (n.pendantVol === null) ecrire("Dates non trouvées : à vérifier", { taille: 9.5, couleur: [180, 0, 0] });
    else if (n.pendantVol && n.pendantVol.length) {
      const tout = n.pendantVol.length === 1 && n.pendantVol[0][0] <= t1 && n.pendantVol[0][1] >= t2;
      ecrire(tout ? "En vigueur pendant tout le vol" : "En vigueur pendant le vol : " + n.pendantVol.map(([a, b]) => `${fHeure(a)} -> ${fHeure(b)}`).join(", "), { taille: 9.5, gras: true, couleur: [200, 90, 0] });
    }
    const fin = n.perm || n.fin == null ? Infinity : n.fin;
    if (n.debut != null) ecrire(`Validité : du ${fDate(n.debut)} au ${fin === Infinity ? "permanent" : fDate(fin)}${n.estime ? " (estimée)" : ""}`, { taille: 9.5 });
    if (n.champs.D) ecrire(`Horaires (D, UTC) : ${n.champs.D}`, { taille: 9.5 });
    if (n.champs.F || n.champs.G) ecrire(`Limites : ${lireLimite(n.champs.F) || "?"} -> ${lireLimite(n.champs.G) || "?"}`, { taille: 9.5 });
    if (n.champs.E) { y += 1; ecrire(n.champs.E, { taille: 9, police: "courier", couleur: [30, 30, 30], retrait: 3, interligne: 1.3 }); }
    trait();
  });

  // Non retenus (liste courte, pour mémoire)
  const parGroupe = {};
  nonRetenus.forEach((n) => { (parGroupe[n.groupe] = parGroupe[n.groupe] || []).push(n); });
  const groupes = Object.entries(parGroupe);
  if (groupes.length) {
    y += 2;
    ecrire("NOTAM NON RETENUS (pour mémoire)", { taille: 12, gras: true, couleur: [90, 90, 90] });
    for (const [cle, arr] of groupes) {
      y += 1;
      ecrire(`${cle === "garder" ? "Décochés manuellement" : RAISONS[cle]} (${arr.length})`, { taille: 10, gras: true, couleur: [90, 90, 90] });
      arr.forEach((n) => {
        const q = n.q && !n.q.erreur ? n.q : null;
        ecrire(`• ${n.id || ""} · ${n.champs.A || ""} · ${q ? q.code + " " + q.sujetTxt : ""}`, { taille: 9, couleur: [90, 90, 90], retrait: 3 });
      });
    }
  }

  // Pied de page
  const nb = doc.getNumberOfPages();
  for (let i = 1; i <= nb; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(130, 130, 130);
    doc.text(pdfTxt("Q-code NOTAM v" + APP_VERSION + " — aide au tri, ne remplace pas le briefing officiel"), M, 292);
    doc.text(`page ${i}/${nb}`, M + L, 292, { align: "right" });
  }
  return doc;
}

$("#tResultat").addEventListener("click", async (e) => {
  const b = e.target.closest("#btnPdf");
  if (!b || !dernierTri) return;
  b.disabled = true;
  try {
    if (!window.jspdf) { b.textContent = "Préparation…"; await chargerJsPDF(); }
    const doc = construirePDF();
    const d = new Date(dernierTri.t1);
    const en = dernierTri.entete || {};
    const nom = `NOTAM_${en.de ? en.de + "-" + (en.vers || "") + "_" : ""}${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
    const blob = doc.output("blob");
    const fichier = new File([blob], nom, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try { await navigator.share({ files: [fichier], title: "Briefing NOTAM" }); }
      catch (err) { if (err && err.name !== "AbortError") throw err; }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  } catch (err) {
    toast("Impossible de créer le PDF", 3500);
  } finally {
    b.disabled = false; majCompteur();
  }
});

/* ---------- Chercher un code ---------- */
$("#mot").addEventListener("input", () => {
  const { sujets, etats } = rechercher($("#mot").value);
  const zone = $("#resultatsMot");
  if ($("#mot").value.trim().length < 3) { zone.innerHTML = ""; return; }
  if (!sujets.length && !etats.length) { zone.innerHTML = `<div class="erreur">Aucun code trouvé. Essayez aussi l'onglet Lexique.</div>`; return; }
  const bloc = (titre, arr, type) => arr.length ? `<div class="groupe"><h2>${titre}</h2>${arr.map(([k, v]) =>
    `<div class="item cliquable" data-${type}="${k}"><b>${k}</b><span>${esc(v)}</span></div>`).join("")}</div>` : "";
  zone.innerHTML = bloc("Sujets (2e-3e lettres)", sujets, "s") + bloc("États (4e-5e lettres)", etats, "e");
});
$("#resultatsMot").addEventListener("click", (ev) => {
  const it = ev.target.closest(".item");
  if (it && it.dataset.s) { saisie.value = "Q" + it.dataset.s; ouvrirOnglet("decoder"); afficher(); }
});

/* ---------- Lexique ---------- */
function afficherLexique() {
  const res = chercherLexique($("#abrev").value);
  $("#resultatsLex").innerHTML = res.length
    ? res.map(([k, v]) => `<div class="item"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")
    : `<div class="erreur">Abréviation inconnue du lexique.</div>`;
}
$("#abrev").addEventListener("input", afficherLexique);
afficherLexique();

/* ---------- Liste complète des codes ---------- */
(function construireListe() {
  const parFamille = {};
  for (const [k, v] of Object.entries(SUJETS)) (parFamille[k[0]] = parFamille[k[0]] || []).push([k, v]);
  let html = `<p class="aide">Sujets (2e et 3e lettres), par famille</p>`;
  for (const [f, arr] of Object.entries(parFamille)) {
    html += `<details class="groupe"><summary>${f} — ${esc(FAMILLES[f] || "")}</summary>${arr.map(([k, v]) =>
      `<div class="item"><b>${k}</b><span>${esc(v)}</span></div>`).join("")}</details>`;
  }
  const familleEtat = { A: "Disponibilité", C: "Changements", H: "Dangers / conditions", L: "Limitations", T: "Trigger", X: "Autre" };
  const parEtat = {};
  for (const [k, v] of Object.entries(ETATS)) (parEtat[k[0]] = parEtat[k[0]] || []).push([k, v]);
  html += `<p class="aide" style="margin-top:18px">États (4e et 5e lettres)</p>`;
  for (const [f, arr] of Object.entries(parEtat)) {
    html += `<details class="groupe"><summary>${f}· — ${esc(familleEtat[f] || "")}</summary>${arr.map(([k, v]) =>
      `<div class="item"><b>${k}</b><span>${esc(v)}</span></div>`).join("")}</details>`;
  }
  $("#liste").innerHTML = html;
})();

/* ---------- Indicateur de version et de connexion ---------- */
$("#version").textContent = "Version " + APP_VERSION;
function majStatut() {
  const st = $("#statut");
  st.classList.toggle("horsligne", !navigator.onLine);
  st.textContent = "●";
  st.title = navigator.onLine ? "En ligne" : "Hors ligne";
}
window.addEventListener("online", majStatut);
window.addEventListener("offline", majStatut);
majStatut();

let toastTimer = null;
function toast(msg, duree) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("visible"), duree || 3500);
}

/* Après un rechargement dû à une mise à jour, on l'annonce. */
try {
  const avant = localStorage.getItem("version");
  if (avant && avant !== APP_VERSION) toast("✓ Mise à jour installée : v" + APP_VERSION);
  localStorage.setItem("version", APP_VERSION);
} catch (e) {}

/* ---------- Restauration ---------- */
try {
  const o = localStorage.getItem("onglet");
  if (o) ouvrirOnglet(o);
  const d = localStorage.getItem("derniere");
  if (d) { saisie.value = d; afficher(); }
} catch (e) {}

/* ---------- Service worker : hors connexion + mise à jour automatique ----------
   Après un déploiement Vercel, l'appli se met à jour seule à la prochaine
   ouverture (ou au retour au premier plan), puis se recharge. */
if ("serviceWorker" in navigator) {
  let rechargement = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (rechargement) return;
    rechargement = true;
    location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.update();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update(); });
      setInterval(() => reg.update(), 30 * 60 * 1000);
    }).catch(() => {});
  });
}
