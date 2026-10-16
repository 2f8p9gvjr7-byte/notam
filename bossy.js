/* Fond « Bossy » : carte CartaBossy (KMZ acheté par l'utilisateur) affichée sous les NOTAM.
   Le KMZ est lu une seule fois, ses images sont rangées dans le téléphone (IndexedDB) :
   rien n'est envoyé sur Internet. */
const FondBossy = (() => {
  let db = null, index = null, carte = null, couche = null, actif = false;
  const affichees = new Map(); // nom -> { ov, url }

  function base() {
    if (db) return Promise.resolve(db);
    return new Promise((ok, ko) => {
      const r = indexedDB.open("qcode-bossy", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("t"); r.result.createObjectStore("m"); };
      r.onsuccess = () => { db = r.result; ok(db); };
      r.onerror = () => ko(r.error);
    });
  }
  const lireObj = (st, k) => base().then((d) => new Promise((ok) => {
    const q = d.transaction(st).objectStore(st).get(k);
    q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null);
  }));
  const ecrire = (st, paires) => base().then((d) => new Promise((ok, ko) => {
    const tx = d.transaction(st, "readwrite"), s = tx.objectStore(st);
    paires.forEach(([k, v]) => s.put(v, k));
    tx.oncomplete = ok; tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error || new Error("stockage plein"));
  }));
  const vider = () => base().then((d) => new Promise((ok) => {
    const tx = d.transaction(["t", "m"], "readwrite");
    tx.objectStore("t").clear(); tx.objectStore("m").clear(); tx.oncomplete = ok; tx.onerror = ok;
  }));

  async function charger() {
    if (index) return index;
    try { index = await lireObj("m", "index"); } catch (e) { index = null; }
    return index;
  }
  async function present() { return !!(await charger()); }

  /* ---------- Lecture du KMZ (zip) ---------- */
  async function octets(f, a, n) { return new DataView(await f.slice(a, a + n).arrayBuffer()); }
  async function entrees(f) {
    const fin = Math.max(0, f.size - 66000);
    const v = await octets(f, fin, f.size - fin);
    let p = -1;
    for (let i = v.byteLength - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { p = i; break; }
    if (p < 0) throw new Error("ce fichier n'est pas un KMZ");
    let nb = v.getUint16(p + 10, true), taille = v.getUint32(p + 12, true), debut = v.getUint32(p + 16, true);
    const cd = await octets(f, debut, taille);
    const dec = new TextDecoder();
    const liste = [];
    for (let i = 0, k = 0; k < nb; k++) {
      if (cd.getUint32(i, true) !== 0x02014b50) break;
      const methode = cd.getUint16(i + 10, true), comp = cd.getUint32(i + 20, true);
      const ln = cd.getUint16(i + 28, true), le = cd.getUint16(i + 30, true), lc = cd.getUint16(i + 32, true);
      const loc = cd.getUint32(i + 42, true);
      const nom = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + i + 46, ln));
      liste.push({ nom, methode, comp, loc });
      i += 46 + ln + le + lc;
    }
    return liste;
  }
  async function donnees(f, e) {
    const h = await octets(f, e.loc, 30);
    const a = e.loc + 30 + h.getUint16(26, true) + h.getUint16(28, true);
    return f.slice(a, a + e.comp);
  }
  async function texte(f, e) {
    const b = await donnees(f, e);
    if (e.methode === 0) return await b.text();
    if (e.methode !== 8 || typeof DecompressionStream === "undefined") throw new Error("mettez l'iPhone à jour (iOS 16.4 minimum)");
    return await new Response(b.stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }

  async function importer(f, progres, zone) {
    const liste = await entrees(f);
    const kml = liste.find((e) => /\.kml$/i.test(e.nom));
    if (!kml) throw new Error("pas de carte dans ce fichier");
    const k = await texte(f, kml);
    const re = /<GroundOverlay>[\s\S]*?<href>\s*([^<]+?)\s*<\/href>[\s\S]*?<LatLonBox>([\s\S]*?)<\/LatLonBox>/g;
    const val = (s, t) => { const m = s.match(new RegExp("<" + t + ">\\s*([-\\d.]+)")); return m ? +m[1] : NaN; };
    let tuiles = [];
    let m;
    while ((m = re.exec(k))) {
      const b = m[2];
      if (/<rotation>\s*[-\d.]*[1-9]/.test(b)) continue;
      const t = { nom: m[1], n: val(b, "north"), s: val(b, "south"), e: val(b, "east"), w: val(b, "west") };
      if ([t.n, t.s, t.e, t.w].some(isNaN)) continue;
      tuiles.push(t);
    }
    if (!tuiles.length) throw new Error("format de carte non reconnu");
    const parNom = new Map(liste.map((e) => [e.nom, e]));
    tuiles.forEach((t) => { t.deg = t.e - t.w; });
    // niveaux : du plus grossier (grandes tuiles) au plus fin
    const parFichier = tuiles.every((t) => /_L\d+_/.test(t.nom));
    const maxDeg = Math.max(...tuiles.map((t) => t.deg));
    tuiles.forEach((t) => { t.niv = parFichier ? +t.nom.match(/_L(\d+)_/)[1] : Math.round(Math.log2(maxDeg / t.deg)); });
    const n0 = Math.min(...tuiles.map((t) => t.niv));
    tuiles.forEach((t) => { t.niv -= n0; });
    const nbNiv = Math.max(...tuiles.map((t) => t.niv)) + 1;
    const pas = [...Array(nbNiv).keys()].map((n) => Math.max(...tuiles.filter((t) => t.niv === n).map((t) => t.deg), 0));
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    // zone = { n, s, e, w } : au-delà des vues d'ensemble, on ne garde que les morceaux de cette région
    const detail = Math.max(0, nbNiv - 2);
    if (zone) tuiles = tuiles.filter((t) => t.niv < detail || (t.s < zone.n && t.n > zone.s && t.w < zone.e && t.e > zone.w));
    await vider(); index = null;
    const garde = [];
    for (let i = 0; i < tuiles.length; i += 20) {
      const lot = [];
      for (const t of tuiles.slice(i, i + 20)) {
        const e = parNom.get(t.nom);
        if (!e || e.methode !== 0) continue;
        lot.push([t.nom, await donnees(f, e)]);
        garde.push(t);
      }
      await ecrire("t", lot);
      progres && progres(Math.min(1, (i + 20) / tuiles.length));
    }
    if (!garde.length) throw new Error("images illisibles dans ce fichier");
    const idx = { zone: zone || null, nom: f.name, date: Date.now(), niveaux: nbNiv, pas, tuiles: garde.map(({ nom, n, s, e, w, niv }) => ({ nom, n, s, e, w, niv })) };
    await ecrire("m", [["index", idx]]);
    index = idx;
    return idx;
  }

  /* ---------- Affichage ---------- */
  function niveauPour() {
    const z = carte.getZoom();
    const pxDegCarte = 256 * Math.pow(2, z) / 360;
    let choix = 0;
    for (let n = 0; n < index.niveaux; n++) {
      const d = index.pas && index.pas[n];
      if (!d) continue;
      choix = n;
      if (1024 / d >= pxDegCarte * 0.8) break;
    }
    return choix;
  }
  async function rafraichir() {
    if (!actif || !index || !carte) return;
    const b = carte.getBounds().pad(0.3);
    const dans = (t) => t.s < b.getNorth() && t.n > b.getSouth() && t.w < b.getEast() && t.e > b.getWest();
    let niv = niveauPour(), voulues = [];
    // hors de la zone détaillée : on prend le niveau le plus fin disponible
    for (; niv >= 0; niv--) { voulues = index.tuiles.filter((t) => t.niv === niv && dans(t)); if (voulues.length) break; }
    const noms = new Set(voulues.map((t) => t.nom));
    for (const [nom, o] of affichees) if (!noms.has(nom)) { couche.removeLayer(o.ov); URL.revokeObjectURL(o.url); affichees.delete(nom); }
    for (const t of voulues) {
      if (affichees.has(t.nom)) continue;
      affichees.set(t.nom, { ov: null, url: null });
      const blob = await lireObj("t", t.nom);
      if (!blob || !affichees.has(t.nom) || !actif) { affichees.delete(t.nom); continue; }
      const url = URL.createObjectURL(blob);
      const ov = L.imageOverlay(url, [[t.s, t.w], [t.n, t.e]], { pane: "bossy", interactive: false });
      couche.addLayer(ov);
      affichees.set(t.nom, { ov, url });
    }
  }
  function brancher(map) {
    carte = map;
    if (!map.getPane("bossy")) { const p = map.createPane("bossy"); p.style.zIndex = 250; p.style.pointerEvents = "none"; }
    couche = L.layerGroup().addTo(map);
    map.on("moveend zoomend", rafraichir);
  }
  function activer(oui) {
    actif = oui;
    if (!oui) { for (const [, o] of affichees) { if (o.ov) couche.removeLayer(o.ov); if (o.url) URL.revokeObjectURL(o.url); } affichees.clear(); }
    else rafraichir();
  }
  return { present, importer, brancher, activer, charger };
})();
