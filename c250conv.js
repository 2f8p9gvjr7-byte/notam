/* Conversion, dans l'appareil, du PDF gratuit du SIA « Carte Strasbourg Alsace Lorraine 1/250 000 »
   en tuiles pour le fond 250k. Rien n'est envoyé sur Internet.
   Le calage (quadrillage 15', écart ≈ 1 m) a été mesuré sur l'édition 2026 ; à chaque nouveau PDF,
   l'appli vérifie que le quadrillage tombe au même endroit avant de convertir. */
const Conv250 = (() => {
  // page 3 du PDF (après rotation) en points → lon/lat, polynôme de degré 3 en (lon − 7, lat − 48,25)
  const CX = [863.7746641818724, -63.809737458250304, -0.021326885662934638, -0.003664171580516969, 840.5661909739368, -15.937899762057835, -0.0061314886931052495, -0.2692467430929977, 0.006181277962985517, -0.023230274336963386];
  const CY = [1360.2054074548284, -1258.5734138986713, -0.44663973734724677, -0.06436748428784225, -42.618921186166375, 0.8088758236432255, 0.0012004835706322004, -5.321465984069516, 0.10136822587389809, 0.0018964638669498395];
  const PAGE_W = 1871, PAGE_H = 2863, NO_PAGE = 2;
  const K = 260 / 72, TS = 512, ZMAX = 11, ZMIN = 7, CORE = 1600, MARGE = 320;
  function proj(lon, lat) {
    const a = lon - 7, b = lat - 48.25;
    const f = [1, b, b * b, b * b * b, a, a * b, a * b * b, a * a, a * a * b, a * a * a];
    let x = 0, y = 0;
    for (let i = 0; i < 10; i++) { x += CX[i] * f[i]; y += CY[i] * f[i]; }
    return [x, y];
  }
  const x2lon = (x, z) => (x / 2 ** z) * 360 - 180;
  const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z)) * 180) / Math.PI;
  const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
  const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };
  // pixel (u, v) d'une tuile z11 → pixel de la page rendue
  const src = (tx, ty, u, v) => { const [x, y] = proj(x2lon(tx + u / TS, ZMAX), y2lat(ty + v / TS, ZMAX)); return [x * K, y * K]; };

  let pdfjs = null;
  async function bibliotheque() {
    if (pdfjs) return pdfjs;
    pdfjs = await import("./pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.mjs";
    return pdfjs;
  }
  const toile = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const libere = (c) => { c.width = c.height = 1; };
  const versBlob = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));

  // Contrôle : aux croisements du quadrillage, les deux traits fins doivent passer exactement là où le calage les attend
  async function verifier(page) {
    const pts = [[6.5, 48.0], [7.0, 48.5], [7.5, 48.0], [6.5, 47.5], [7.0, 47.5], [7.5, 48.5], [6.0, 48.5], [7.5, 47.5]];
    const S = 6, R = 14; // fenêtre de ±14 pt rendue à 6 px/pt
    let bons = 0;
    for (const [lon, lat] of pts) {
      const [x, y] = proj(lon, lat);
      const c = toile(2 * R * S, 2 * R * S), ctx = c.getContext("2d", { willReadFrequently: true });
      const vp = page.getViewport({ scale: S });
      await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, -(x - R) * S, -(y - R) * S] }).promise;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const sombre = (px, py) => { const i = (Math.round(py) * c.width + Math.round(px)) * 4; return 255 - Math.min(d[i], d[i + 1], d[i + 2]); };
      // direction du méridien et du parallèle au croisement
      const [xm, ym] = proj(lon, lat + 0.05), [xp, yp] = proj(lon + 0.05, lat);
      const trait = (dx, dy, decal) => {
        const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        let s = 0, n = 0;
        for (let t = -R + 2; t <= R - 2; t += 0.5) {
          if (Math.abs(t) < 2) continue; // on évite le point de croisement lui-même
          const px = R * S + (ux * t + nx * decal) * S, py = R * S + (uy * t + ny * decal) * S;
          s += sombre(px, py); n++;
        }
        return s / n;
      };
      const sur = Math.min(trait(xm - x, ym - y, 0), trait(xp - x, yp - y, 0));
      const autour = Math.max(...[-3, -1.5, 1.5, 3].map((o) => Math.max(trait(xm - x, ym - y, o), trait(xp - x, yp - y, o))));
      if (sur >= 140 && sur > autour + 15) bons++;
      libere(c);
    }
    return { bons, total: pts.length };
  }

  async function convertir(fichier, progres) {
    const lib = await bibliotheque().catch(() => { throw new Error("outil de lecture des PDF introuvable (rouvrez l’appli connectée pour finir sa mise à jour)"); });
    progres(null, "ouverture du PDF");
    const doc = await lib.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()), isEvalSupported: false }).promise;
    if (doc.numPages < NO_PAGE + 1) throw new Error("ce PDF n'est pas la carte SIA 1/250 000 Strasbourg Alsace Lorraine");
    const page = await doc.getPage(NO_PAGE + 1);
    const v1 = page.getViewport({ scale: 1 });
    if (Math.abs(v1.width - PAGE_W) > 3 || Math.abs(v1.height - PAGE_H) > 3) throw new Error("format de page inattendu : ce n'est pas la carte Strasbourg Alsace Lorraine, ou le SIA a changé sa mise en page");
    progres(null, "vérification du quadrillage");
    const v = await verifier(page);
    if (v.bons < 6) throw new Error(`le quadrillage ne tombe pas au bon endroit (${v.bons}/${v.total}) : le SIA a peut-être changé la mise en page, il faut refaire le calage`);

    // tuiles z11 qui touchent la page, rangées par bloc de rendu
    const W = Math.round(PAGE_W * K), H = Math.round(PAGE_H * K);
    const dedans = (p) => p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H;
    const x0 = Math.floor(lon2x(5.5, ZMAX)), x1 = Math.ceil(lon2x(8.6, ZMAX)), y0 = Math.floor(lat2y(49.6, ZMAX)), y1 = Math.ceil(lat2y(46.9, ZMAX));
    const blocs = new Map();
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
      let touche = false;
      for (let i = 0; i <= 8 && !touche; i++) for (let j = 0; j <= 8 && !touche; j++) touche = dedans(src(tx, ty, (i * TS) / 8, (j * TS) / 8));
      if (!touche) continue;
      const [cx, cy] = src(tx, ty, TS / 2, TS / 2);
      const cle = Math.max(0, Math.floor(cx / CORE)) + "," + Math.max(0, Math.floor(cy / CORE));
      if (!blocs.has(cle)) blocs.set(cle, []);
      blocs.get(cle).push([tx, ty]);
    }
    const nbTuiles = [...blocs.values()].reduce((s, l) => s + l.length, 0);
    const vp = page.getViewport({ scale: K });
    const tuiles = new Map(); // "z/x/y" → { blob, ext }
    const t = toile(TS, TS), tc = t.getContext("2d", { willReadFrequently: true });
    tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = "high";
    let faites = 0;
    for (const [cle, liste] of blocs) {
      const [bx, by] = cle.split(",").map(Number);
      const ox = bx * CORE - MARGE, oy = by * CORE - MARGE, cw = CORE + 2 * MARGE;
      const b = toile(cw, cw), bc = b.getContext("2d");
      await page.render({ canvasContext: bc, viewport: vp, transform: [1, 0, 0, 1, -ox, -oy] }).promise;
      // hors de la page : transparent
      if (ox < 0) bc.clearRect(0, 0, -ox, cw);
      if (oy < 0) bc.clearRect(0, 0, cw, -oy);
      if (ox + cw > W) bc.clearRect(W - ox, 0, cw, cw);
      if (oy + cw > H) bc.clearRect(0, H - oy, cw, cw);
      for (const [tx, ty] of liste) {
        tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, TS, TS);
        // 4 quarts de tuile, chacun avec sa transformation affine (écart < 0,1 px)
        for (const [qu, qv] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const u0 = qu * TS / 2, v0 = qv * TS / 2, h = TS / 2;
          const [ax, ay] = src(tx, ty, u0, v0), [bx2, by2] = src(tx, ty, u0 + h, v0), [cx2, cy2] = src(tx, ty, u0, v0 + h);
          // tuile → source : P = A + (B−A)·s + (C−A)·t ; on inverse pour dessiner la source dans la tuile
          const a = (bx2 - ax) / h, bb = (by2 - ay) / h, c = (cx2 - ax) / h, d = (cy2 - ay) / h;
          const det = a * d - bb * c;
          const ia = d / det, ib = -bb / det, ic = -c / det, id = a / det;
          const sx = ax - ox, sy = ay - oy;
          tc.save();
          tc.setTransform(1, 0, 0, 1, 0, 0);
          tc.beginPath(); tc.rect(u0 - 0.5, v0 - 0.5, h + 1, h + 1); tc.clip();
          tc.setTransform(ia, ib, ic, id, u0 - (ia * sx + ic * sy), v0 - (ib * sx + id * sy));
          tc.drawImage(b, 0, 0);
          tc.restore();
        }
        const al = tc.getImageData(0, 0, TS, TS).data;
        let min = 255, max = 0;
        for (let i = 3; i < al.length; i += 4) { if (al[i] < min) min = al[i]; if (al[i] > max) max = al[i]; }
        if (max > 8) {
          const plein = min > 247;
          tuiles.set(`${ZMAX}/${tx}/${ty}`, { blob: await versBlob(t, plein ? "image/jpeg" : "image/png", 0.72), ext: plein ? "jpg" : "png" });
        }
        faites++;
        progres(faites / nbTuiles * 0.85, "découpage de la carte");
      }
      libere(b);
    }
    // niveaux moins détaillés : chaque tuile = ses 4 « enfants » réduits
    for (let z = ZMAX - 1; z >= ZMIN; z--) {
      const parents = new Set();
      for (const k of tuiles.keys()) { const [zz, x, y] = k.split("/").map(Number); if (zz === z + 1) parents.add(`${x >> 1}/${y >> 1}`); }
      for (const p of parents) {
        const [px, py] = p.split("/").map(Number);
        tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, TS, TS);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const e = tuiles.get(`${z + 1}/${2 * px + dx}/${2 * py + dy}`);
          if (!e) continue;
          const im = await createImageBitmap(e.blob);
          tc.drawImage(im, dx * TS / 2, dy * TS / 2, TS / 2, TS / 2);
          im.close && im.close();
        }
        const al = tc.getImageData(0, 0, TS, TS).data;
        let min = 255; for (let i = 3; i < al.length; i += 4) if (al[i] < min) min = al[i];
        const plein = min > 247;
        tuiles.set(`${z}/${px}/${py}`, { blob: await versBlob(t, plein ? "image/jpeg" : "image/png", 0.72), ext: plein ? "jpg" : "png" });
      }
      progres(0.85 + (ZMAX - z) / (ZMAX - ZMIN) * 0.1, "vues d'ensemble");
    }
    libere(t);
    try { doc.destroy(); } catch (e) {}
    return [...tuiles].map(([k, e]) => {
      const [z, x, y] = k.split("/").map(Number);
      return { nom: `c250_L${z}_${x}_${y}.${e.ext}`, blob: e.blob, n: y2lat(y, z), s: y2lat(y + 1, z), w: x2lon(x, z), e: x2lon(x + 1, z) };
    });
  }
  return { convertir };
})();
