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

  /* Deux captures possibles : carte Bossy (calage sur le quadrillage) et carte AZBA (calage sur des lieux connus) */
  let slot = "bossy";
  try { slot = localStorage.getItem("cSlot") === "azba" ? "azba" : "bossy"; } catch (e) {}
  const cleImage = () => (slot === "azba" ? "image_azba" : "image");
  const cleCal = () => (slot === "azba" ? "cCal_azba" : "cCal");

  /* Lieux connus pour caler une carte sans quadrillage (centre-ville, ±1 km) */
  const LIEUX = {
    "Nancy": [48.6921, 6.1844], "Metz": [49.1193, 6.1757], "Strasbourg": [48.5734, 7.7521], "Épinal": [48.1724, 6.4496],
    "Colmar": [48.0794, 7.3585], "Mulhouse": [47.7508, 7.3359], "Belfort": [47.6380, 6.8628], "Besançon": [47.2378, 6.0241],
    "Dijon": [47.3220, 5.0415], "Saint-Dié-des-Vosges": [48.2844, 6.9492], "Lunéville": [48.5894, 6.4964], "Toul": [48.6750, 5.8917],
    "Vesoul": [47.6197, 6.1544], "Troyes": [48.2973, 4.0744], "Reims": [49.2583, 4.0317], "Chaumont": [48.1113, 5.1392],
    "Neufchâteau": [48.3558, 5.6964], "Mirecourt": [48.2989, 6.1336], "Sarrebourg": [48.7356, 7.0539], "Saverne": [48.7414, 7.3625],
    "Verdun": [49.1598, 5.3844], "Bar-le-Duc": [48.7727, 5.1600], "Gérardmer": [48.0731, 6.8778], "Remiremont": [48.0167, 6.5917],
    "Sarrebruck": [49.2402, 6.9969], "Luxembourg": [49.6116, 6.1319], "Genève": [46.2044, 6.1432], "Lausanne": [46.5197, 6.6323],
    "Bâle": [47.5596, 7.5886], "Fribourg-en-Brisgau": [47.9990, 7.8421], "Montbéliard": [47.5100, 6.7983], "Pontarlier": [46.9036, 6.3550],
    "Lons-le-Saunier": [46.6744, 5.5547], "Chalon-sur-Saône": [46.7806, 4.8539], "Mâcon": [46.3069, 4.8287], "Langres": [47.8625, 5.3331],
    "Châlons-en-Champagne": [48.9566, 4.3631], "Sedan": [49.7019, 4.9403], "Thionville": [49.3579, 6.1683], "Sarreguemines": [49.1100, 7.0683],
    "Haguenau": [48.8156, 7.7906], "Pont-à-Mousson": [48.9053, 6.0547], "Commercy": [48.7631, 5.5917], "Lure": [47.6833, 6.4967],
    "Thann": [47.8078, 7.1033], "Munster": [48.0408, 7.1347], "La Bresse": [48.0050, 6.8750], "Neuchâtel": [46.9900, 6.9293],
    "Annecy": [45.8992, 6.1294], "Bourg-en-Bresse": [46.2052, 5.2255], "Beaune": [47.0260, 4.8400], "Dole": [47.0920, 5.4900],
    "Vitry-le-François": [48.7248, 4.5847], "Saint-Avold": [49.1044, 6.7069], "Forbach": [49.1883, 6.8956], "Sélestat": [48.2594, 7.4542],
    "Molsheim": [48.5422, 7.4922], "Obernai": [48.4622, 7.4819], "Rambervillers": [48.3450, 6.6347], "Baccarat": [48.4500, 6.7400],
    "Vittel": [48.2017, 5.9461], "Contrexéville": [48.1833, 5.8961], "Raon-l'Étape": [48.4058, 6.8400], "Saint-Nicolas-de-Port": [48.6347, 6.3008]
  };
  const sansAccent = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function trouverLieu(txt) {
    const t = (txt || "").trim();
    if (!t) return null;
    const oaci = t.toUpperCase();
    if (typeof AERODROMES !== "undefined" && AERODROMES[oaci]) return { lat: AERODROMES[oaci][0], lon: AERODROMES[oaci][1], nom: oaci };
    const k = sansAccent(t);
    for (const n in LIEUX) if (sansAccent(n) === k) return { lat: LIEUX[n][0], lon: LIEUX[n][1], nom: n };
    for (const n in LIEUX) if (sansAccent(n).startsWith(k) && k.length >= 3) return { lat: LIEUX[n][0], lon: LIEUX[n][1], nom: n };
    return null;
  }

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
    try { const db = await ouvrirBase(); db.transaction("f", "readwrite").objectStore("f").put(blob, cleImage()); } catch (e) {}
  }
  async function lireImage() {
    try {
      const db = await ouvrirBase();
      return await new Promise((ok) => {
        const q = db.transaction("f").objectStore("f").get(cleImage());
        q.onsuccess = () => ok(q.result || null);
        q.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  }
  let rayonLocal = 20;
  try { rayonLocal = +localStorage.getItem("cRayonLocal") || 20; } catch (e) {}
  function sauverCal() { try { localStorage.setItem(cleCal(), JSON.stringify(cal)); } catch (e) {} }
  function lireCal() { try { return JSON.parse(localStorage.getItem(cleCal()) || "null"); } catch (e) { return null; } }

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

  /* ---------- Étiquettes : écartées pour ne pas se chevaucher ---------- */
  function placerEtiquettes() {
    const T = tailles();
    const pris = [];
    const minD = T.etiq * 2.3;
    const libre = (x, y) => pris.every((q) => Math.hypot(q.x - x, q.y - y) >= minD) &&
      x > T.etiq && x < nat.w - T.etiq && y > T.etiq && y < nat.h - T.etiq;
    // les repères eux-mêmes (points, croix) sont aussi des obstacles pour les étiquettes
    const marques = [];
    items.forEach((it) => { if (it.px && it.px.dedans && (it.px.type === "point" || it.px.type === "croix")) it.px.p.forEach((q) => marques.push(q)); });
    const loinDesMarques = (x, y) => marques.every((q) => Math.hypot(q.x - x, q.y - y) >= T.etiq * 1.6);
    items.forEach((it) => {
      const px = it.px;
      if (!px || !px.dedans) return;
      const a = px.ancre;
      const d0 = T.etiq * 1.7;
      let choix = null;
      for (let anneau = 1; anneau <= 6 && !choix; anneau++) {
        const d = d0 * anneau;
        for (let k = 0; k < 12 && !choix; k++) {
          const ang = -Math.PI / 4 + (k * Math.PI) / 6; // on commence en haut à droite
          const x = a.x + d * Math.cos(ang), y = a.y - d * Math.sin(ang);
          if (libre(x, y) && loinDesMarques(x, y)) choix = { x, y };
        }
      }
      if (!choix) choix = { x: a.x + d0 * 0.7, y: a.y - d0 * 0.7 };
      choix.trait = Math.hypot(choix.x - a.x, choix.y - a.y) > d0 * 1.2;
      it.etiq = choix;
      pris.push(choix);
    });
  }


  /* ---------- Route tapée dans l'onglet Carte, reportée sur la capture ---------- */
  function routeCapture() {
    if (!cal) return null;
    const { pts } = routePoints();
    if (!pts.length) return null;
    const surPlace = pts.every((p) => distCap(pts[0], p).nm < 0.5);
    const boucle = surPlace || (pts.length > 2 && distCap(pts[0], pts[pts.length - 1]).nm < 0.5);
    const px = (surPlace ? [pts[0]] : pts).map((p) => Object.assign(proj(p.lat, p.lon), { nom: p.nom }));
    const cercle = boucle ? { x: px[0].x, y: px[0].y, r: rayonLocal * pxParNM(pts[0].lat) } : null;
    let txt = "";
    if (surPlace) txt = `Vol local ${pts[0].nom} — rayon ${rayonLocal} NM`;
    else {
      const br = [];
      let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = distCap(pts[i - 1], pts[i]); tot += d.nm; br.push(`${pts[i - 1].nom}→${pts[i].nom} ${String(Math.round(d.cap)).padStart(3, "0")}° ${Math.round(d.nm)} NM`); }
      txt = "Route : " + br.join(" · ") + (br.length > 1 ? ` · total ${Math.round(tot)} NM` : "") + (boucle ? ` — rayon local ${rayonLocal} NM` : "");
    }
    return { px, cercle, txt };
  }
  const ROSE = "#d81b60";
  function routeSVG(svg, T) {
    const r = routeCapture();
    if (!r) return;
    const g = el("g", { "pointer-events": "none" }, svg);
    if (r.cercle) el("circle", { cx: r.cercle.x, cy: r.cercle.y, r: r.cercle.r, fill: ROSE, "fill-opacity": 0.05, stroke: ROSE, "stroke-width": T.trait, "stroke-dasharray": `${T.trait * 4} ${T.trait * 3}` }, g);
    if (r.px.length > 1) el("polyline", { points: r.px.map((q) => `${q.x},${q.y}`).join(" "), fill: "none", stroke: ROSE, "stroke-width": T.trait * 1.3, "stroke-linejoin": "round", opacity: 0.9 }, g);
    r.px.forEach((q) => {
      el("circle", { cx: q.x, cy: q.y, r: T.croix * 0.55, fill: ROSE, stroke: "#fff", "stroke-width": T.trait * 0.6 }, g);
      const t = el("text", { x: q.x + T.croix * 0.9, y: q.y - T.croix * 0.6, "font-size": T.police * 0.9, "font-weight": "700", "font-family": "Helvetica, Arial, sans-serif", fill: ROSE, stroke: "#fff", "stroke-width": T.trait * 0.8, "paint-order": "stroke" }, g);
      t.textContent = q.nom;
    });
  }
  function routeCanvas(ctx, T) {
    const r = routeCapture();
    if (!r) return null;
    ctx.save();
    ctx.strokeStyle = ROSE; ctx.fillStyle = ROSE;
    if (r.cercle) {
      ctx.lineWidth = T.trait; ctx.setLineDash([T.trait * 4, T.trait * 3]);
      ctx.beginPath(); ctx.arc(r.cercle.x, r.cercle.y, r.cercle.r, 0, 2 * Math.PI); ctx.stroke();
      ctx.globalAlpha = 0.05; ctx.fill(); ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    if (r.px.length > 1) { ctx.lineWidth = T.trait * 1.3; ctx.lineJoin = "round"; ctx.globalAlpha = 0.9; ctx.beginPath(); r.px.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.font = `bold ${T.police * 0.9}px Helvetica, Arial, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    r.px.forEach((q) => {
      ctx.beginPath(); ctx.arc(q.x, q.y, T.croix * 0.55, 0, 2 * Math.PI); ctx.fillStyle = ROSE; ctx.fill(); ctx.lineWidth = T.trait * 0.6; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.lineWidth = T.trait * 0.8; ctx.strokeText(q.nom, q.x + T.croix * 0.9, q.y - T.croix * 0.6); ctx.fillStyle = ROSE; ctx.fillText(q.nom, q.x + T.croix * 0.9, q.y - T.croix * 0.6);
    });
    ctx.restore();
    return r.txt;
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
    routeSVG(svg, T);
    // NOTAM
    items.forEach((it) => { it.px = enPixels(it); });
    placerEtiquettes();
    items.forEach((it) => {
      const px = it.px;
      if (!px || !px.dedans) return;
      const g = el("g", { "data-num": it.num, style: "cursor:pointer" }, svg);
      const c = it.couleur;
      if (px.type === "cercle") {
        el("circle", { cx: px.p[0].x, cy: px.p[0].y, r: px.r, fill: "none", stroke: c, "stroke-width": T.trait * 0.7, "stroke-dasharray": `${T.trait * 3} ${T.trait * 2.5}`, opacity: 0.85 }, g);
        el("circle", { cx: px.p[0].x, cy: px.p[0].y, r: T.trait * 1.3, fill: c }, g);
      }
      if (px.type === "poly") el("polygon", { points: px.p.map((q) => `${q.x},${q.y}`).join(" "), fill: c, "fill-opacity": 0.15, stroke: c, "stroke-width": T.trait }, g);
      if (px.type === "point") px.p.forEach((q) => el("circle", { cx: q.x, cy: q.y, r: T.croix * 0.6, fill: c, stroke: "#fff", "stroke-width": T.trait * 0.6 }, g));
      if (px.type === "croix") px.p.forEach((q) => {
        el("line", { x1: q.x - T.croix, y1: q.y - T.croix, x2: q.x + T.croix, y2: q.y + T.croix, stroke: c, "stroke-width": T.trait * 1.6 }, g);
        el("line", { x1: q.x - T.croix, y1: q.y + T.croix, x2: q.x + T.croix, y2: q.y - T.croix, stroke: c, "stroke-width": T.trait * 1.6 }, g);
      });
      // étiquette numérotée (position écartée des autres), avec trait de rappel si éloignée
      const ex = it.etiq.x, ey = it.etiq.y;
      if (it.etiq.trait) el("line", { x1: px.ancre.x, y1: px.ancre.y, x2: ex, y2: ey, stroke: c, "stroke-width": T.trait * 0.6 }, g);
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
    if (!image) {
      z.innerHTML = slot === "azba"
        ? `<p class="aide">1. Sur le site <b>🗺 AZBA</b>, réglez la période (📅) sur <b>votre vol</b>, cadrez la région, et faites une <b>capture d'écran</b>.<br>2. Touchez <b>« 🖼 Capture »</b> et choisissez-la.<br>3. Calez-la sur <b>deux lieux connus éloignés</b> (ex. le point de Nancy puis celui de Besançon) : touchez le point de la ville, puis tapez son nom.</p>`
        : `<p class="aide">1. Dans CartaBossy, faites une <b>capture d'écran</b> de la zone du vol (nord en haut).<br>2. Touchez <b>« 🖼 Capture »</b> et choisissez-la.<br>3. Calez-la sur deux croisements du quadrillage (ou deux lieux connus).</p>`;
      return;
    }
    if (!etape) {
      z.innerHTML = cal ? `<p class="note">Carte calée. Touchez un repère ou une ligne de la liste pour le détail.</p>` : "";
      return;
    }
    const def = etape === 1 ? { lat: 49, lon: 6 } : { lat: 48, lon: 7 };
    z.innerHTML = `<div class="etape">
      <div class="etape-msg"><b>Calage ${etape}/2</b> — Touchez précisément ${slot === "azba" ? "le <b>point d'une ville</b> (ou d'un terrain)" : "un <b>croisement du quadrillage</b> (ou une ville / un terrain)"}${etape === 2 ? ", <b>loin et en diagonale</b> du premier" : ""}. Zoomez avec deux doigts si besoin ; touchez à nouveau pour corriger.</div>
      <div class="etape-form"${tmp ? "" : " hidden"}>
        <label>Lieu <input id="cLieu" list="cLieux" autocomplete="off" spellcheck="false" placeholder="Nancy, Besançon, LFSN…"></label>
        <datalist id="cLieux">${Object.keys(LIEUX).sort((a, b) => a.localeCompare(b, "fr")).map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="ou"${slot === "azba" ? " hidden" : ""}>— ou coordonnées du croisement —</div>
        <div${slot === "azba" ? " hidden" : ""}>
        <label>Latitude <select id="cLatD">${options(41, 52, 1, def.lat, (v) => v + "°")}</select>
          <select id="cLatM">${options(0, 50, 10, 0, (v) => String(v).padStart(2, "0") + "'")}</select> N</label>
        <label>Longitude <select id="cLonD">${options(0, 10, 1, def.lon, (v) => v + "°")}</select>
          <select id="cLonM">${options(0, 50, 10, 0, (v) => String(v).padStart(2, "0") + "'")}</select>
          <select id="cLonS"><option value="1">E</option><option value="-1">W</option></select></label>
        </div>
        <button id="cValider">Valider ce point</button>
      </div>
    </div>`;
    const v = $("#cValider");
    if (v) v.addEventListener("click", validerPoint);
  }
  function validerPoint() {
    if (!tmp) return;
    let lat, lon;
    const saisie = $("#cLieu") ? $("#cLieu").value : "";
    if (saisie.trim()) {
      const l = trouverLieu(saisie);
      if (!l) { toast(`Lieu « ${saisie} » inconnu : choisissez une ville de la liste ou un code OACI.`, 4000); return; }
      lat = l.lat; lon = l.lon;
    } else if (slot === "azba") { toast("Tapez le nom de la ville touchée (ou un code OACI).", 3000); return; }
    else {
      lat = +$("#cLatD").value + +$("#cLatM").value / 60;
      lon = (+$("#cLonD").value + +$("#cLonM").value / 60) * +$("#cLonS").value;
    }
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
  function demarrerCalage() { cal = null; etape = 1; ptsCal = []; tmp = null; try { localStorage.removeItem(cleCal()); } catch (e) {} rafraichir(); }

  /* ---------- Rafraîchissement général ---------- */
  function rafraichir() {
    construire();
    if (mode === "ofm") {
      if (!document.getElementById("tab-carte").classList.contains("actif")) return; // carte dessinée à l'ouverture de l'onglet
      dessinerOFM(); afficherListe(); infoOFM(); return;
    }
    const zone = $("#cZone");
    zone.hidden = !image;
    if (image) dessinerSVG();
    afficherEtape();
    afficherListe();
    const info = $("#cInfo");
    if (!items.length) info.innerHTML = `<p class="note">Aucun NOTAM coché pour l'instant : collez d'abord votre briefing dans l'onglet <b>Trier</b>.</p>`;
    else info.innerHTML = `<p class="note">${items.length} NOTAM cochés dans le tri${cal ? " · " + items.filter((i) => i.px && i.px.dedans).length + " placés sur cette capture" : ""}.${cal && routeCapture() ? " Route de l'onglet Carte OFM tracée en rose." : ""}</p>`;
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
  function choisirSlot(sl) {
    slot = sl;
    try { localStorage.setItem("cSlot", sl); } catch (e) {}
    $("#slotBossy").classList.toggle("actif", sl === "bossy");
    $("#slotAzba").classList.toggle("actif", sl === "azba");
    image = null; cal = null; etape = 0; tmp = null; ptsCal = []; nat = { w: 0, h: 0 };
    $("#cImg").removeAttribute("src"); $("#cSvg").innerHTML = "";
    lireImage().then((b) => { if (b) chargerBlob(b, false); else rafraichir(); });
  }
  $("#slotBossy").addEventListener("click", () => choisirSlot("bossy"));
  $("#slotAzba").addEventListener("click", () => choisirSlot("azba"));
  $("#slotBossy").classList.toggle("actif", slot === "bossy");
  $("#slotAzba").classList.toggle("actif", slot === "azba");

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
    if (mode === "ofm") {
      const m = marqueursOFM[num];
      if (m && ofm) { ofm.setView(m.getLatLng(), Math.max(ofm.getZoom(), 9)); m.openPopup(); window.scrollTo(0, $("#ofmMap").getBoundingClientRect().top + window.scrollY - 70); }
      else toast("Ce NOTAM n'a pas de position utilisable", 3000);
      document.querySelectorAll(".c-item").forEach((x) => x.classList.toggle("actif", +x.dataset.num === num));
      return;
    }
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
    const hLeg = Math.round(police * 1.2 + ligneH * (nbLignes + 3.2));
    cv.width = nat.w; cv.height = nat.h + hLeg;
    ctx.drawImage(image, 0, 0);
    const txtRoute = routeCanvas(ctx, T);
    // repères
    items.forEach((it) => {
      const px = it.px;
      if (!px || !px.dedans) return;
      ctx.strokeStyle = it.couleur; ctx.fillStyle = it.couleur; ctx.lineWidth = T.trait;
      if (px.type === "cercle") {
        ctx.save(); ctx.lineWidth = T.trait * 0.7; ctx.setLineDash([T.trait * 3, T.trait * 2.5]); ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(px.p[0].x, px.p[0].y, px.r, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
        ctx.beginPath(); ctx.arc(px.p[0].x, px.p[0].y, T.trait * 1.3, 0, 2 * Math.PI); ctx.fill();
      }
      if (px.type === "poly") { ctx.beginPath(); px.p.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
      if (px.type === "point") px.p.forEach((q) => { ctx.beginPath(); ctx.arc(q.x, q.y, T.croix * 0.6, 0, 2 * Math.PI); ctx.fill(); });
      if (px.type === "croix") px.p.forEach((q) => { ctx.lineWidth = T.trait * 1.6; ctx.beginPath(); ctx.moveTo(q.x - T.croix, q.y - T.croix); ctx.lineTo(q.x + T.croix, q.y + T.croix); ctx.moveTo(q.x - T.croix, q.y + T.croix); ctx.lineTo(q.x + T.croix, q.y - T.croix); ctx.stroke(); });
      const ex = it.etiq.x, ey = it.etiq.y;
      if (it.etiq.trait) { ctx.lineWidth = T.trait * 0.6; ctx.beginPath(); ctx.moveTo(px.ancre.x, px.ancre.y); ctx.lineTo(ex, ey); ctx.stroke(); }
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
    if (txtRoute) { ctx.fillStyle = ROSE; ctx.fillText(txtRoute, police, y); y += ligneH * 1.2; ctx.fillStyle = "#111"; }
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

  /* ---------- Carte en ligne open flightmaps (Leaflet) ---------- */
  let mode = "ofm";
  try { mode = localStorage.getItem("cMode") || "ofm"; } catch (e) {}
  let ofm = null, ofmCouche = null, dejaCadre = false;
  let masquerCercles = false;
  try { masquerCercles = localStorage.getItem("cSansCercles") === "1"; } catch (e) {}
  const marqueursOFM = {};

  function initOFM() {
    if (ofm || typeof L === "undefined") return;
    ofm = L.map("ofmMap", { zoomControl: true, attributionControl: true, minZoom: 5, maxZoom: 14 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 14, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(ofm);
    L.tileLayer("https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest", {
      minZoom: 6, maxZoom: 14, minNativeZoom: 7, maxNativeZoom: 12,
      attribution: '© <a href="https://www.openflightmaps.org" target="_blank" rel="noopener">open flightmaps</a> (OFMA General Users\' License)'
    }).addTo(ofm);
    let vue = null;
    try { vue = JSON.parse(localStorage.getItem("cVue") || "null"); } catch (e) {}
    if (vue) { ofm.setView([vue.lat, vue.lon], vue.z); dejaCadre = true; }
    else ofm.setView([48.5, 6.3], 8);
    ofm.on("moveend", () => {
      const c = ofm.getCenter();
      try { localStorage.setItem("cVue", JSON.stringify({ lat: c.lat, lon: c.lng, z: ofm.getZoom() })); } catch (e) {}
    });
    ofmCouche = L.layerGroup().addTo(ofm);

    const Boutons = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const div = L.DomUtil.create("div", "leaflet-bar ofm-boutons");
        div.innerHTML = `<a href="#" id="ofmPlein" title="Plein écran">⛶</a><a href="#" id="ofmCercles" title="Cercles indicatifs">◯</a><a href="#" id="ofmEditer" title="Modifier la route">✎</a>`;
        L.DomEvent.disableClickPropagation(div);
        return div;
      }
    });
    ofm.addControl(new Boutons());
    $("#ofmPlein").addEventListener("click", (e) => { e.preventDefault(); basculerPlein(); });
    $("#ofmEditer").addEventListener("click", (e) => { e.preventDefault(); basculerEdition(); });
    ofm.on("click", (e) => { if (editionRoute) ajouterPointCarte(e.latlng); });
    $("#ofmCercles").addEventListener("click", (e) => {
      e.preventDefault();
      masquerCercles = !masquerCercles;
      try { localStorage.setItem("cSansCercles", masquerCercles ? "1" : "0"); } catch (err) {}
      majBoutons(); dessinerOFM();
      toast(masquerCercles ? "Cercles indicatifs masqués" : "Cercles indicatifs affichés", 2000);
    });
    majBoutons();
  }

  function majBoutons() {
    const c = $("#ofmCercles");
    if (c) c.classList.toggle("off", masquerCercles);
    const p = $("#ofmPlein");
    if (p) p.textContent = $("#ofmBloc").classList.contains("plein") ? "✕" : "⛶";
  }
  function basculerPlein() {
    const b = $("#ofmBloc");
    b.classList.toggle("plein");
    document.body.style.overflow = b.classList.contains("plein") ? "hidden" : "";
    majBoutons();
    setTimeout(() => ofm.invalidateSize(), 60);
  }

  /* ---------- Route ---------- */
  function lirePoint(tok) {
    if (typeof AERODROMES !== "undefined" && AERODROMES[tok]) { const a = AERODROMES[tok]; return { lat: a[0], lon: a[1], nom: tok, info: a[2] }; }
    let m = tok.match(/^(\d{2})(\d{2})(\d{2})?([NS])(\d{3})(\d{2})(\d{2})?([EW])$/);
    if (m) {
      const lat = (+m[1] + +m[2] / 60 + (+m[3] || 0) / 3600) * (m[4] === "S" ? -1 : 1);
      const lon = (+m[5] + +m[6] / 60 + (+m[7] || 0) / 3600) * (m[8] === "W" ? -1 : 1);
      return { lat, lon, nom: tok };
    }
    return null;
  }
  function distCap(a, b) {
    const R = Math.PI / 180, f1 = a.lat * R, f2 = b.lat * R, dl = (b.lon - a.lon) * R;
    const d = 2 * Math.asin(Math.sqrt(Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2));
    const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return { nm: (d * 6371) / 1.852, cap: (Math.atan2(y, x) / R + 360) % 360 };
  }
  function routeTexte() {
    const champ = $("#ofmRoute");
    const en = typeof dernierTri !== "undefined" && dernierTri ? dernierTri.entete : null;
    const sig = en && (en.de || en.vers) ? (en.de || "") + "-" + (en.vers || "") : "";
    let dernierSig = "";
    try { dernierSig = localStorage.getItem("cRouteSig") || ""; } catch (e) {}
    if (sig && sig !== dernierSig) {          // nouveau briefing SOFIA : route reprise de l'en-tête
      champ.value = [en.de, en.vers].filter(Boolean).join(" ");
      try { localStorage.setItem("cRouteSig", sig); localStorage.setItem("cRoute", champ.value); } catch (e) {}
    } else if (!champ.value) {
      try { champ.value = localStorage.getItem("cRoute") || ""; } catch (e) {}
    }
    return champ.value;
  }
  /* Jetons de la route (le champ texte est la référence) */
  function routeJetons() { return routeTexte().toUpperCase().split(/[\s,;>\-–→]+/).filter(Boolean); }
  function ecrireJetons(j) {
    const v = j.join(" ");
    $("#ofmRoute").value = v;
    try { localStorage.setItem("cRoute", v); } catch (e) {}
  }
  function routePoints() {
    const toks = routeJetons();
    const pts = [], inconnus = [];
    let n = 0;
    toks.forEach((t, k) => {
      const p = lirePoint(t);
      if (!p) { inconnus.push(t); return; }
      p.jeton = k;
      p.coord = !(typeof AERODROMES !== "undefined" && AERODROMES[t]);
      if (p.coord) p.nom = "P" + (++n);
      pts.push(p);
    });
    return { pts, inconnus };
  }
  const deg2 = (v, w) => { const a = Math.abs(v); const d = Math.floor(a); const mf = (a - d) * 60; let m = Math.floor(mf); let sec = Math.round((mf - m) * 60); if (sec === 60) { sec = 0; m++; } return String(d).padStart(w, "0") + String(m).padStart(2, "0") + String(sec).padStart(2, "0"); };
  const fmtCoord = (lat, lon) => deg2(lat, 2) + (lat >= 0 ? "N" : "S") + deg2(lon, 3) + (lon >= 0 ? "E" : "W");

  /* Mode « modifier la route » : toucher la carte ajoute un point, glisser déplace, toucher un point le supprime */
  let editionRoute = false;
  function basculerEdition() {
    editionRoute = !editionRoute;
    const b = $("#ofmEditer");
    if (b) b.classList.toggle("on", editionRoute);
    $("#ofmMap").classList.toggle("edition", editionRoute);
    if (editionRoute) toast("Touchez la carte pour ajouter un point · glissez un point pour le déplacer · touchez-le pour le supprimer", 5000);
    dessinerOFM();
  }
  function ajouterPointCarte(latlng) {
    const { pts } = routePoints();
    const toks = routeJetons();
    const tok = fmtCoord(latlng.lat, latlng.lng);
    if (pts.length === 1) { toks.push(tok, toks[pts[0].jeton]); ecrireJetons(toks); dessinerOFM(); return; } // vol local : circuit qui revient au terrain
    if (pts.length < 2) { toks.push(tok); ecrireJetons(toks); dessinerOFM(); return; }
    // insertion dans la branche la plus proche du point touché
    const P = ofm.latLngToLayerPoint(latlng);
    let best = 0, dmin = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = ofm.latLngToLayerPoint([pts[i].lat, pts[i].lon]), b = ofm.latLngToLayerPoint([pts[i + 1].lat, pts[i + 1].lon]);
      const d = L.LineUtil.pointToSegmentDistance(P, a, b);
      if (d < dmin) { dmin = d; best = i; }
    }
    toks.splice(pts[best + 1].jeton, 0, tok);
    ecrireJetons(toks);
    dessinerOFM();
  }

  function dessinerRoute(bornes) {
    const { pts, inconnus } = routePoints();
    const info = $("#ofmRouteInfo");
    if (!pts.length) { info.innerHTML = inconnus.length ? `⚠ Inconnu : ${esc(inconnus.join(", "))}` : (editionRoute ? "Touchez la carte pour poser le premier point." : ""); return; }
    if (pts.length > 1) {
      L.polyline(pts.map((p) => [p.lat, p.lon]), { color: "#d81b60", weight: 4, opacity: 0.9, interactive: false, dashArray: editionRoute ? "10 6" : null }).addTo(ofmCouche);
    }
    pts.forEach((p, i) => {
      L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", html: `<span class="ofm-wpt">${esc(p.nom)}</span>`, iconSize: null, iconAnchor: [-8, 10] }), interactive: false }).addTo(ofmCouche);
      const extremite = i === 0 || i === pts.length - 1;
      if (editionRoute) {
        const m = L.marker([p.lat, p.lon], {
          draggable: true, zIndexOffset: 2000,
          icon: L.divIcon({ className: "", html: `<span class="ofm-poignee${extremite ? " ext" : ""}"></span>`, iconSize: [26, 26], iconAnchor: [13, 13] })
        }).addTo(ofmCouche);
        m.on("dragend", () => {
          const ll = m.getLatLng();
          const toks = routeJetons();
          toks[p.jeton] = fmtCoord(ll.lat, ll.lng);
          ecrireJetons(toks); dessinerOFM();
        });
        m.on("click", () => {
          if (!confirm(`Supprimer le point ${p.nom} de la route ?`)) return;
          const toks = routeJetons();
          toks.splice(p.jeton, 1);
          ecrireJetons(toks); dessinerOFM();
        });
      } else {
        L.circleMarker([p.lat, p.lon], { radius: 5, color: "#fff", weight: 2, fillColor: "#d81b60", fillOpacity: 1, interactive: false }).addTo(ofmCouche);
      }
      bornes.push([p.lat, p.lon]);
    });
    // Vol local : un seul terrain (« LFGY », « LFGY LFGY ») ou circuit qui revient au terrain de départ
    const surPlace = pts.every((p) => distCap(pts[0], p).nm < 0.5);
    const circuit = !surPlace && pts.length > 2 && distCap(pts[0], pts[pts.length - 1]).nm < 0.5;
    let ligneLocal = "";
    if (surPlace || circuit) {
      const c0 = pts[0], rm = rayonLocal * 1852;
      const cercle = L.circle([c0.lat, c0.lon], { radius: rm, color: "#d81b60", weight: 3, dashArray: "10 8", fill: true, fillOpacity: 0.04, interactive: false }).addTo(ofmCouche);
      const b = cercle.getBounds();
      bornes.push([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]);
      const dedans = items.filter((it) => it.forme && it.forme.geo && it.forme.geo.some((g) => distCap(c0, g).nm <= rayonLocal + (it.forme.type === "cercle" ? it.forme.r : 0)));
      const opts = [5, 10, 15, 20, 25, 30, 40, 50].map((v) => `<option value="${v}"${v === rayonLocal ? " selected" : ""}>${v} NM</option>`).join("");
      ligneLocal = `<b>Vol local ${esc(c0.nom)}</b> · rayon <select id="ofmRayon" class="ofm-rayon">${opts}</select> · `
        + (dedans.length ? `<b>${dedans.length}</b> NOTAM dans la zone : n° ${dedans.map((i) => i.num).join(", ")}` : "aucun NOTAM coché dans la zone");
    }
    const brancherRayon = () => {
      const sel = $("#ofmRayon");
      if (sel) sel.addEventListener("change", (e) => {
        rayonLocal = +e.target.value;
        try { localStorage.setItem("cRayonLocal", String(rayonLocal)); } catch (err) {}
        dejaCadre = false; dessinerOFM();
      });
    };
    if (surPlace) {
      info.innerHTML = ligneLocal + ` <small>· pour un circuit, ✎ puis touchez la carte</small>`
        + (inconnus.length ? ` <span class="warn">⚠ Inconnu : ${esc(inconnus.join(", "))}</span>` : "");
      brancherRayon();
      return;
    }
    let total = 0;
    const branches = [];
    for (let i = 1; i < pts.length; i++) {
      const dc = distCap(pts[i - 1], pts[i]);
      total += dc.nm;
      branches.push(`${esc(pts[i - 1].nom)}→${esc(pts[i].nom)} ${String(Math.round(dc.cap)).padStart(3, "0")}° ${Math.round(dc.nm)} NM`);
    }
    info.innerHTML = (branches.length ? branches.join(" · ") + (branches.length > 1 ? ` · total ${Math.round(total)} NM` : "") + " <small>(routes vraies, sans déclinaison)</small>" : "")
      + (inconnus.length ? ` <span class="warn">⚠ Inconnu : ${esc(inconnus.join(", "))}</span>` : "")
      + (ligneLocal ? `<div class="ligne-local">${ligneLocal}</div>` : "");
    brancherRayon();
  }

  function popupHTML(it) {
    const n = it.n, q = n.q && !n.q.erreur ? n.q : null;
    const E = ((n.champs && n.champs.E) || "").replace(/\s+/g, " ");
    const lim = n.champs && (n.champs.F || n.champs.G) ? `${esc(n.champs.F || "?")} → ${esc(n.champs.G || "?")}` : "";
    return `<div class="ofm-pop"><b>${it.num}. ${esc(q ? q.code : "")}</b> ${esc(titre(n))}<br>
      <small>${esc(n.id || "")}${quand(n) ? " · " + esc(quand(n)) : ""}${lim ? " · " + lim : ""}</small>
      <div class="ofm-e">${esc(E.slice(0, 280))}${E.length > 280 ? "…" : ""}</div>
      ${it.forme && it.forme.type === "cercle" ? '<small class="ofm-approx">Cercle indicatif (centre et rayon de la ligne Q), pas la forme réelle de la zone.</small>' : ""}</div>`;
  }

  function dessinerOFM() {
    initOFM();
    if (!ofm) return;
    ofmCouche.clearLayers();
    for (const k in marqueursOFM) delete marqueursOFM[k];
    const bornes = [];
    dessinerRoute(bornes);
    const groupes = {};
    items.forEach((it) => {
      const f = it.forme;
      if (!f) return;
      const c = it.couleur;
      let ancre;
      if (f.type === "cercle") {
        const g = f.geo[0];
        if (!masquerCercles) L.circle([g.lat, g.lon], { radius: f.r * 1852, color: c, weight: 2, dashArray: "6 6", fill: false, interactive: false }).addTo(ofmCouche);
        L.circleMarker([g.lat, g.lon], { radius: 3, color: c, fillColor: c, fillOpacity: 1, weight: 1, interactive: false }).addTo(ofmCouche);
        ancre = g;
      } else if (f.type === "poly") {
        L.polygon(f.geo.map((g) => [g.lat, g.lon]), { color: c, weight: 2, fillOpacity: 0.15, interactive: false }).addTo(ofmCouche);
        ancre = { lat: f.geo.reduce((a, g) => a + g.lat, 0) / f.geo.length, lon: f.geo.reduce((a, g) => a + g.lon, 0) / f.geo.length };
      } else {
        f.geo.forEach((g) => {
          const html = f.type === "croix" ? `<span class="ofm-croix" style="color:${c}">✕</span>` : `<span class="ofm-point" style="background:${c}"></span>`;
          L.marker([g.lat, g.lon], { icon: L.divIcon({ className: "", html, iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(ofmCouche);
        });
        ancre = f.geo[0];
      }
      bornes.push([ancre.lat, ancre.lon]);
      const cle = ancre.lat.toFixed(3) + "," + ancre.lon.toFixed(3);
      (groupes[cle] = groupes[cle] || []).push({ it, ancre });
    });
    // numéros : écartés en couronne quand plusieurs NOTAM partagent le même point
    Object.values(groupes).forEach((g) => {
      g.forEach(({ it, ancre }, k) => {
        let dx = 14, dy = -14;
        if (g.length > 1) { const a = -Math.PI / 4 + (k * 2 * Math.PI) / g.length; dx = Math.round(26 * Math.cos(a)); dy = Math.round(-26 * Math.sin(a)); }
        const html = `<span class="ofm-num" style="background:${it.couleur}">${it.num}</span>`;
        const m = L.marker([ancre.lat, ancre.lon], {
          icon: L.divIcon({ className: "", html, iconSize: [26, 26], iconAnchor: [13 - dx, 13 - dy], popupAnchor: [dx, dy - 12] }),
          zIndexOffset: 1000
        }).bindPopup(popupHTML(it), { maxWidth: 280 }).addTo(ofmCouche);
        marqueursOFM[it.num] = m;
      });
    });
    if (!dejaCadre && bornes.length && !editionRoute) { ofm.fitBounds(bornes, { padding: [30, 30], maxZoom: 10 }); dejaCadre = true; }
    setTimeout(() => ofm.invalidateSize(), 50);
  }

  function infoOFM() {
    const info = $("#cInfo");
    if (!items.length) { info.innerHTML = `<p class="note">Aucun NOTAM coché pour l'instant : collez d'abord votre briefing dans l'onglet <b>Trier</b>.</p>`; return; }
    const places = items.filter((i) => i.forme).length;
    info.innerHTML = `<p class="note">${items.length} NOTAM cochés · ${places} placés sur la carte. <a href="#" id="ofmCadrer">Recadrer sur les NOTAM</a></p>`;
    const a = $("#ofmCadrer");
    if (a) a.addEventListener("click", (e) => { e.preventDefault(); dejaCadre = false; dessinerOFM(); });
  }

  function choisirMode(m) {
    mode = m;
    try { localStorage.setItem("cMode", m); } catch (e) {}
    $("#modeOfm").classList.toggle("actif", m === "ofm");
    $("#modeCapture").classList.toggle("actif", m === "capture");
    $("#ofmBloc").hidden = m !== "ofm";
    $("#captureBloc").hidden = m !== "capture";
    rafraichir();
  }
  $("#ofmRouteOk").addEventListener("click", () => {
    try { localStorage.setItem("cRoute", $("#ofmRoute").value); } catch (e) {}
    dejaCadre = false; dessinerOFM(); $("#ofmRoute").blur();
  });
  $("#ofmRoute").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#ofmRouteOk").click(); });
  $("#ofmQuitter").addEventListener("click", () => { if ($("#ofmBloc").classList.contains("plein")) basculerPlein(); });
  $("#modeOfm").addEventListener("click", () => choisirMode("ofm"));
  $("#modeCapture").addEventListener("click", () => choisirMode("capture"));
  window.addEventListener("resize", () => { if (ofm) ofm.invalidateSize(); });

  /* ---------- Au démarrage : capture mémorisée ---------- */
  $("#ofmBloc").hidden = mode !== "ofm";
  $("#captureBloc").hidden = mode !== "capture";
  $("#modeOfm").classList.toggle("actif", mode === "ofm");
  $("#modeCapture").classList.toggle("actif", mode === "capture");
  lireImage().then((b) => { if (b) chargerBlob(b, false); else rafraichir(); });
})();
