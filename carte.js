/* Onglet Carte : les NOTAM cochés du tri, posés sur une capture d'écran de carte
   (CartaBossy ou autre carte « nord en haut » de type Google / Web Mercator).
   Calage : l'utilisateur touche deux croisements du quadrillage (en diagonale)
   et indique leurs coordonnées. Tout reste sur le téléphone (hors connexion). */
(function () {
  const $ = (s) => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let image = null;            // élément <img> chargé
  let nat = { w: 0, h: 0 };    // taille réelle de la capture
  let cal = null;              // { pts: [p1, p2], ax, bx, ay, by }
  let etape = 0;               // 0 = calée ou rien, 1 / 2 = point de calage en cours
  let tmp = null;              // point touché en attente de validation {x, y}
  let ptsCal = [];             // points validés pendant le calage
  let items = [];              // NOTAM affichés (avec formes calculées)

  /* ---------- Stockage de la capture (IndexedDB) ---------- */
  function ouvrirBase() {
    return new Promise((ok, ko) => {
      const r = indexedDB.open("qcode-carte", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("f");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  }
  async function sauverImage(blob) {
    try { const db = await ouvrirBase(); db.transaction("f", "readwrite").objectStore("f").put(blob, "image"); } catch (e) {}
  }
  async function lireImage() {
    try {
      const db = await ouvrirBase();
      return await new Promise((ok) => {
        const q = db.transaction("f").objectStore("f").get("image");
        q.onsuccess = () => ok(q.result || null);
        q.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  }
  function sauverCal() { try { localStorage.setItem("cCal", JSON.stringify(cal)); } catch (e) {} }
  function lireCal() { try { return JSON.parse(localStorage.getItem("cCal") || "null"); } catch (e) { return null; } }

  /* ---------- Projection (Web Mercator, nord en haut) ---------- */
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  function calculerCal(p1, p2) {
    if (p1.lat === p2.lat || p1.lon === p2.lon) return { erreur: "Les deux croisements doivent être en diagonale (latitude ET longitude différentes)." };
    const ax = (p2.x - p1.x) / (p2.lon - p1.lon);
    const ay = (p2.y - p1.y) / (merc(p2.lat) - merc(p1.lat));
    if (ax <= 0 || ay >= 0) return { erreur: "Les valeurs ne collent pas avec les points touchés (inversion nord/sud ou est/ouest ?). Recommencez le calage." };
    return { pts: [p1, p2], ax, bx: p1.x - ax * p1.lon, ay, by: p1.y - ay * merc(p1.lat) };
  }
  const proj = (lat, lon) => ({ x: cal.ax * lon + cal.bx, y: cal.ay * merc(lat) + cal.by });
  const pxParNM = (lat) => (Math.abs(cal.ay) * (Math.PI / 180 / 60)) / Math.cos((lat * Math.PI) / 180);

  /* ---------- Positions des NOTAM ---------- */
  function coordsTexte(E) {
    const re = /(\d{2})(\d{2})(\d{2}(?:[.,]\d+)?)\s*([NS])\s*[-/,]?\s*(\d{3})(\d{2})(\d{2}(?:[.,]\d+)?)\s*([EW])/g;
    const res = [];
    let m;
    while ((m = re.exec(E || ""))) {
      const lat = (+m[1] + +m[2] / 60 + parseFloat(m[3].replace(",", ".")) / 3600) * (m[4] === "S" ? -1 : 1);
      const lon = (+m[5] + +m[6] / 60 + parseFloat(m[7].replace(",", ".")) / 3600) * (m[8] === "W" ? -1 : 1);
      res.push({ lat, lon });
    }
    return res;
  }
  function rayonQ(n) {
    const m = ((n.champs && n.champs.Q) || "").match(/\d{4}[NS]\d{5}[EW](\d{3})/);
    return m ? +m[1] : null;
  }
  function couleur(n) {
    const q = n.q && !n.q.erreur ? n.q : null;
    const f = q ? q.sujet[0] : "";
    if (q && (q.sujet === "OB" || q.sujet === "OL")) return "#c2185b";
    return { R: "#e53935", W: "#f57c00", A: "#1e63c8", M: "#2e7d32", F: "#2e7d32", L: "#2e7d32", C: "#00838f", N: "#00838f", S: "#00838f" }[f] || "#546e7a";
  }

  function construire() {
    items = [];
    const liste = typeof listeTriee !== "undefined" ? listeTriee : [];
    const retenus = typeof estCoche === "function" ? liste.filter(estCoche) : [];
    retenus.forEach((n, i) => {
      const it = { n, num: i + 1, couleur: couleur(n), forme: null, statut: "" };
      const pts = coordsTexte(n.champs && n.champs.E);
      const q = n.q && !n.q.erreur ? n.q : null;
      const obstacle = q && (q.sujet === "OB" || q.sujet === "OL");
      if (pts.length >= 3) it.forme = { type: "poly", geo: pts };
      else if (pts.length >= 1) it.forme = { type: obstacle ? "croix" : "point", geo: pts };
      else if (n.lat != null) {
        const r = rayonQ(n);
        if (r != null && r <= 30) it.forme = { type: obstacle ? "croix" : "cercle", geo: [{ lat: n.lat, lon: n.lon }], r: Math.max(r, 1) };
        else it.statut = r != null ? `zone étendue (rayon ${r} NM) : pas de repère` : "pas de position";
      } else it.statut = "pas de position";
      items.push(it);
    });
  }

  /* Formes en pixels de la capture ; marque celles qui sortent de l'image */
  function enPixels(it) {
    const f = it.forme;
    if (!f || !cal) return null;
    const p = f.geo.map((g) => proj(g.lat, g.lon));
    const out = { type: f.type, p };
    if (f.type === "cercle") out.r = f.r * pxParNM(f.geo[0].lat);
    const marge = 0.02 * Math.max(nat.w, nat.h);
    const dedans = p.some((q) => q.x > -marge - (out.r || 0) && q.x < nat.w + marge + (out.r || 0) && q.y > -marge - (out.r || 0) && q.y < nat.h + marge + (out.r || 0));
    out.dedans = dedans;
    // ancre de l'étiquette
    const cx = p.reduce((s, q) => s + q.x, 0) / p.length, cy = p.reduce((s, q) => s + q.y, 0) / p.length;
    out.ancre = { x: cx, y: cy };
    return out;
  }

  /* ---------- Dessin à l'écran (SVG) ---------- */
  function tailles() {
    const base = Math.max(nat.w, nat.h) / 100;
    return { trait: base * 0.35, etiq: base * 1.5, police: base * 1.7, croix: base * 1.4 };
  }
  function el(nom, attrs, parent) {
    const e = document.createElementNS(NS, nom);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function dessinerSVG() {
    const svg = $("#cSvg");
    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${nat.w} ${nat.h}`);
    const T = tailles();
    // Points de calage
    const croixCal = (x, y, coul) => {
      el("line", { x1: x - T.croix * 1.5, y1: y, x2: x + T.croix * 1.5, y2: y, stroke: coul, "stroke-width": T.trait }, svg);
      el("line", { x1: x, y1: y - T.croix * 1.5, x2: x, y2: y + T.croix * 1.5, stroke: coul, "stroke-width": T.trait }, svg);
      el("circle", { cx: x, cy: y, r: T.croix, fill: "none", stroke: coul, "stroke-width": T.trait }, svg);
    };
    (cal ? cal.pts : ptsCal).forEach((p) => croixCal(p.x, p.y, "#111"));
    if (tmp) croixCal(tmp.x, tmp.y, "#e53935");
    if (!cal) return;
    // NOTAM
    items.forEach((it) => {
      const px = enPixels(it);
      it.px = px;
      if (!px || !px.dedans) return;
      const g = el("g", { "data-num": it.num, style: "cursor:pointer" }, svg);
      const c = it.couleur;
      if (px.type === "cercle") el("circle", { cx: px.p[0].x, cy: px.p[0].y, r: px.r, fill: c, "fill-opacity": 0.12, stroke: c, "stroke-width": T.trait }, g);
      if (px.type === "poly") el("polygon", { points: px.p.map((q) => `${q.x},${q.y}`).join(" "), fill: c, "fill-opacity": 0.15, stroke: c, "stroke-width": T.trait }, g);
      if (px.type === "point") px.p.forEach((q) => el("circle", { cx: q.x, cy: q.y, r: T.croix * 0.6, fill: c, stroke: "#fff", "stroke-width": T.trait * 0.6 }, g));
      if (px.type === "croix") px.p.forEach((q) => {
        el("line", { x1: q.x - T.croix, y1: q.y - T.croix, x2: q.x + T.croix, y2: q.y + T.croix, stroke: c, "stroke-width": T.trait * 1.6 }, g);
        el("line", { x1: q.x - T.croix, y1: q.y + T.croix, x2: q.x + T.croix, y2: q.y - T.croix, stroke: c, "stroke-width": T.trait * 1.6 }, g);
      });
      // étiquette numérotée, décalée en haut à droite du repère
      const ex = px.ancre.x + T.etiq * 1.2, ey = px.ancre.y - T.etiq * 1.2;
      el("circle", { cx: ex, cy: ey, r: T.etiq, fill: c, stroke: "#fff", "stroke-width": T.trait * 0.7 }, g);
      const t = el("text", { x: ex, y: ey + T.police * 0.35, "text-anchor": "middle", "font-size": T.police, "font-weight": "700", "font-family": "Helvetica, Arial, sans-serif", fill: "#fff" }, g);
      t.textContent = it.num;
    });
  }

  /* ---------- Liste sous la carte ---------- */
  function quand(n) {
    if (n.pendantVol === null) return "dates à vérifier";
    if (!n.pendantVol || !n.pendantVol.length) return "";
    const t1 = typeof trier !== "undefined" ? trier.t1 : 0, t2 = typeof trier !== "undefined" ? trier.t2 : 0;
    const [a, b] = [n.pendantVol[0][0], n.pendantVol[n.pendantVol.length - 1][1]];
    if (n.pendantVol.length === 1 && a <= t1 && b >= t2) return "tout le vol";
    return n.pendantVol.map(([x, y]) => `${fHeure(x)}→${fHeure(y)}`).join(", ");
  }
  function titre(n) {
    const q = n.q && !n.q.erreur ? n.q : null;
    if (!q) return "NOTAM";
    return q.sujetTxt + (q.etatTxt ? " — " + q.etatTxt.charAt(0).toLowerCase() + q.etatTxt.slice(1) : "");
  }
  function afficherListe() {
    const z = $("#cListe");
    if (!items.length) { z.innerHTML = ""; return; }
    z.innerHTML = items.map((it) => {
      const q = it.n.q && !it.n.q.erreur ? it.n.q : null;
      let st = it.statut;
      if (!st && cal && it.px && !it.px.dedans) st = "hors de la capture";
      return `<div class="c-item" data-num="${it.num}">
        <span class="c-num" style="background:${it.couleur}">${it.num}</span>
        <div><b>${esc(q ? q.code : "")}</b> ${esc(titre(it.n))}
          <small>${esc(it.n.id || "")}${quand(it.n) ? " · " + esc(quand(it.n)) : ""}${st ? " · ⚠ " + esc(st) : ""}</small></div>
      </div>`;
    }).join("");
  }

  /* ---------- Étapes de calage ---------- */
  function options(de, a, pas, choisi, fmt) {
    let h = "";
    for (let v = de; v <= a; v += pas) h += `<option value="${v}"${v === choisi ? " selected" : ""}>${fmt(v)}</option>`;
    return h;
  }
  function afficherEtape() {
    const z = $("#cEtape");
    if (!image) { z.innerHTML = `<p class="aide">1. Dans CartaBossy, faites une <b>capture d'écran</b> de la zone du vol (nord en haut).<br>2. Touchez <b>« 🖼 Capture »</b> et choisissez-la.<br>3. Calez-la sur deux croisements du quadrillage.</p>`; return; }
    if (!etape) {
      z.innerHTML = cal ? `<p class="note">Carte calée. Touchez un repère ou une ligne de la liste pour le détail.</p>` : "";
      return;
    }
    const def = etape === 1 ? { lat: 49, lon: 6 } : { lat: 48, lon: 7 };
    z.innerHTML = `<div class="etape">
      <div class="etape-msg"><b>Calage ${etape}/2</b> — Touchez précisément un <b>croisement du quadrillage</b>${etape === 2 ? " <b>en diagonale</b> du premier" : ""}. Zoomez avec deux doigts si besoin ; touchez à nouveau pour corriger.</div>
      <div class="etape-form"${tmp ? "" : " hidden"}>
        <label>Latitude <select id="cLatD">${options(41, 52, 1, def.lat, (v) => v + "°")}</select>
          <select id="cLatM">${options(0, 50, 10, 0, (v) => String(v).padStart(2, "0") + "'")}</select> N</label>
        <label>Longitude <select id="cLonD">${options(0, 10, 1, def.lon, (v) => v + "°")}</select>
          <select id="cLonM">${options(0, 50, 10, 0, (v) => String(v).padStart(2, "0") + "'")}</select>
          <select id="cLonS"><option value="1">E</option><option value="-1">W</option></select></label>
        <button id="cValider">Valider ce point</button>
      </div>
    </div>`;
    const v = $("#cValider");
    if (v) v.addEventListener("click", validerPoint);
  }
  function validerPoint() {
    if (!tmp) return;
    const lat = +$("#cLatD").value + +$("#cLatM").value / 60;
    const lon = (+$("#cLonD").value + +$("#cLonM").value / 60) * +$("#cLonS").value;
    ptsCal.push({ x: tmp.x, y: tmp.y, lat, lon });
    tmp = null;
    if (etape === 1) { etape = 2; }
    else {
      const c = calculerCal(ptsCal[0], ptsCal[1]);
      if (c.erreur) { toast(c.erreur, 5000); ptsCal = [ptsCal[0]]; etape = 2; }
      else { cal = c; etape = 0; ptsCal = []; sauverCal(); toast("Carte calée ✓", 2500); }
    }
    rafraichir();
  }
  function demarrerCalage() { cal = null; etape = 1; ptsCal = []; tmp = null; try { localStorage.removeItem("cCal"); } catch (e) {} rafraichir(); }

  /* ---------- Rafraîchissement général ---------- */
  function rafraichir() {
    construire();
    const zone = $("#cZone");
    zone.hidden = !image;
    if (image) dessinerSVG();
    afficherEtape();
    afficherListe();
    const info = $("#cInfo");
    if (!items.length) info.innerHTML = `<p class="note">Aucun NOTAM coché pour l'instant : collez d'abord votre briefing dans l'onglet <b>Trier</b>.</p>`;
    else info.innerHTML = `<p class="note">${items.length} NOTAM cochés dans le tri${cal ? " · " + items.filter((i) => i.px && i.px.dedans).length + " placés sur cette capture" : ""}.</p>`;
    $("#cRecaler").hidden = !image;
    $("#cPartager").hidden = !(image && cal);
  }
  window.majCarte = rafraichir;

  function chargerBlob(blob, nouveau) {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => {
      image = im;
      nat = { w: im.naturalWidth, h: im.naturalHeight };
      const zImg = $("#cImg");
      zImg.src = url;
      if (nouveau) { demarrerCalage(); }
      else {
        const c = lireCal();
        if (c && c.pts && c.pts.length === 2) { cal = c; etape = 0; } else { etape = 1; }
        rafraichir();
      }
    };
    im.src = url;
  }

  /* ---------- Événements ---------- */
  $("#cImage").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    sauverImage(f);
    chargerBlob(f, true);
    e.target.value = "";
  });
  $("#cRecaler").addEventListener("click", demarrerCalage);

  $("#cSvg").addEventListener("click", (e) => {
    const svg = $("#cSvg");
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) * nat.w) / r.width;
    const y = ((e.clientY - r.top) * nat.h) / r.height;
    if (etape) { tmp = { x, y }; dessinerSVG(); afficherEtape(); return; }
    const g = e.target.closest && e.target.closest("[data-num]");
    if (g) montrer(+g.getAttribute("data-num"));
  });
  $("#cListe").addEventListener("click", (e) => {
    const l = e.target.closest(".c-item");
    if (l) montrer(+l.dataset.num);
  });
  function montrer(num) {
    const it = items.find((i) => i.num === num);
    if (!it) return;
    const q = it.n.q && !it.n.q.erreur ? it.n.q : null;
    toast(`${num}. ${q ? q.code + " " : ""}${titre(it.n)}${quand(it.n) ? " · " + quand(it.n) : ""}`, 4000);
    document.querySelectorAll(".c-item").forEach((x) => x.classList.toggle("actif", +x.dataset.num === num));
  }

  /* ---------- Export image (capture + repères + légende) ---------- */
  $("#cPartager").addEventListener("click", async () => {
    if (!image || !cal) return;
    const T = tailles();
    const police = Math.max(16, Math.round(nat.w / 38));
    const ligneH = police * 1.45;
    const lignes = items.map((it) => {
      const q = it.n.q && !it.n.q.erreur ? it.n.q : null;
      let st = it.statut || (it.px && !it.px.dedans ? "hors capture" : "");
      return { it, txt: `${it.num}. ${q ? q.code + " " : ""}${titre(it.n)}${quand(it.n) ? " — " + quand(it.n) : ""}${st ? " (" + st + ")" : ""}  ${it.n.id || ""}` };
    });
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    ctx.font = `${police}px Helvetica, Arial, sans-serif`;
    // découpe des lignes trop longues
    const largeurTexte = nat.w - police * 3;
    const blocs = [];
    lignes.forEach((l) => {
      const mots = l.txt.split(" ");
      let cur = "";
      const sous = [];
      mots.forEach((m) => { const essai = cur ? cur + " " + m : m; if (ctx.measureText(essai).width > largeurTexte && cur) { sous.push(cur); cur = m; } else cur = essai; });
      if (cur) sous.push(cur);
      blocs.push({ it: l.it, sous });
    });
    const nbLignes = blocs.reduce((s, b) => s + b.sous.length, 0);
    const entete = typeof dernierTri !== "undefined" && dernierTri ? `NOTAM retenus — vol du ${fJour(dernierTri.t1)} ${fHeure(dernierTri.t1)}→${fHeure(dernierTri.t2)} (heure de Paris)` : "NOTAM retenus";
    const hLeg = Math.round(police * 1.2 + ligneH * (nbLignes + 2));
    cv.width = nat.w; cv.height = nat.h + hLeg;
    ctx.drawImage(image, 0, 0);
    // repères
    items.forEach((it) => {
      const px = it.px;
      if (!px || !px.dedans) return;
      ctx.strokeStyle = it.couleur; ctx.fillStyle = it.couleur; ctx.lineWidth = T.trait;
      if (px.type === "cercle") { ctx.beginPath(); ctx.arc(px.p[0].x, px.p[0].y, px.r, 0, 2 * Math.PI); ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
      if (px.type === "poly") { ctx.beginPath(); px.p.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
      if (px.type === "point") px.p.forEach((q) => { ctx.beginPath(); ctx.arc(q.x, q.y, T.croix * 0.6, 0, 2 * Math.PI); ctx.fill(); });
      if (px.type === "croix") px.p.forEach((q) => { ctx.lineWidth = T.trait * 1.6; ctx.beginPath(); ctx.moveTo(q.x - T.croix, q.y - T.croix); ctx.lineTo(q.x + T.croix, q.y + T.croix); ctx.moveTo(q.x - T.croix, q.y + T.croix); ctx.lineTo(q.x + T.croix, q.y - T.croix); ctx.stroke(); });
      const ex = px.ancre.x + T.etiq * 1.2, ey = px.ancre.y - T.etiq * 1.2;
      ctx.beginPath(); ctx.arc(ex, ey, T.etiq, 0, 2 * Math.PI); ctx.fillStyle = it.couleur; ctx.fill();
      ctx.lineWidth = T.trait * 0.7; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `bold ${T.police}px Helvetica, Arial, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(it.num), ex, ey + 1);
    });
    // légende
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff"; ctx.fillRect(0, nat.h, nat.w, hLeg);
    let y = nat.h + police * 1.6;
    ctx.fillStyle = "#111"; ctx.font = `bold ${police}px Helvetica, Arial, sans-serif`; ctx.fillText(entete, police, y); y += ligneH * 1.2;
    ctx.font = `${police}px Helvetica, Arial, sans-serif`;
    blocs.forEach((b) => {
      ctx.fillStyle = b.it.couleur; ctx.beginPath(); ctx.arc(police * 1.0, y - police * 0.35, police * 0.4, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = "#111";
      b.sous.forEach((s) => { ctx.fillText(s, police * 2, y); y += ligneH; });
    });
    ctx.fillStyle = "#777"; ctx.font = `${Math.round(police * 0.75)}px Helvetica, Arial, sans-serif`;
    ctx.fillText("Positions indicatives (±1-2 NM) — aide au briefing, ne remplace pas la carte et le briefing officiels", police, nat.h + hLeg - police * 0.5);

    const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.9));
    const nom = `Carte_NOTAM_${new Date().toISOString().slice(0, 10)}.jpg`;
    const fichier = new File([blob], nom, { type: "image/jpeg" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) await navigator.share({ files: [fichier], title: "Carte NOTAM" });
      else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (err) { if (err && err.name !== "AbortError") toast("Partage impossible", 3000); }
  });

  /* ---------- Au démarrage : capture mémorisée ---------- */
  lireImage().then((b) => { if (b) chargerBlob(b, false); else rafraichir(); });
})();
