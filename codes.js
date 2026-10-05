/* Décodeur NOTAM Q-code — données et logique de décodage.
   Source : OACI Doc 8126 (codes NOTAM), libellés traduits en français. */

const FAMILLES = {
  A: "Organisation de l'espace aérien (ATM)",
  C: "Communications et surveillance (radar)",
  F: "Installations et services d'aérodrome",
  G: "Services GNSS",
  I: "ILS / MLS",
  L: "Balisage lumineux",
  M: "Aire de mouvement et d'atterrissage",
  N: "Aides radio à la navigation",
  O: "Autres informations",
  P: "Procédures ATM",
  R: "Restrictions d'espace aérien",
  S: "Services de la circulation aérienne (ATS)",
  W: "Avertissements à la navigation",
  X: "Autre (texte en clair)"
};

const SUJETS = {
  // A — Organisation de l'espace aérien
  AA: "Altitude minimale",
  AC: "Zone de contrôle (CTR)",
  AD: "Zone d'identification de défense aérienne (ADIZ)",
  AE: "Région de contrôle (CTA)",
  AF: "Région d'information de vol (FIR)",
  AH: "Région supérieure de contrôle (UTA)",
  AL: "Niveau de vol minimal utilisable",
  AN: "Route de navigation de surface (RNAV)",
  AO: "Région de contrôle océanique (OCA)",
  AP: "Point de compte rendu",
  AR: "Route ATS",
  AT: "Région de contrôle terminale (TMA)",
  AU: "Région supérieure d'information de vol (UIR)",
  AV: "Région supérieure à service consultatif",
  AX: "Intersection",
  AZ: "Zone de circulation d'aérodrome (ATZ)",
  // C — Communications et surveillance
  CA: "Fréquence air-sol",
  CB: "ADS-B (surveillance dépendante automatique en diffusion)",
  CC: "ADS-C (surveillance dépendante automatique en contrat)",
  CD: "CPDLC (liaison de données contrôleur-pilote)",
  CE: "Radar de surveillance en route",
  CG: "Système d'approche contrôlée du sol (GCA)",
  CL: "Système d'appel sélectif (SELCAL)",
  CM: "Radar de surface (SMR)",
  CP: "Radar d'approche de précision (PAR)",
  CR: "Élément radar de surveillance du PAR",
  CS: "Radar secondaire (SSR)",
  CT: "Radar de surveillance de région terminale (TAR)",
  // F — Installations et services
  FA: "Aérodrome",
  FB: "Appareil de mesure du frottement",
  FC: "Équipement de mesure du plafond",
  FD: "Système de guidage d'accostage",
  FE: "Oxygène",
  FF: "Sauvetage et lutte contre l'incendie (SSLIA)",
  FG: "Contrôle des mouvements au sol",
  FH: "Hélistation / plateforme d'hélicoptères",
  FI: "Dégivrage des aéronefs",
  FJ: "Huiles",
  FL: "Indicateur de direction d'atterrissage",
  FM: "Service météorologique",
  FO: "Système de dissipation du brouillard",
  FP: "Héliport",
  FS: "Équipement de déneigement",
  FT: "Transmissomètre (mesure de la RVR)",
  FU: "Disponibilité du carburant",
  FW: "Indicateur de direction du vent (manche à air)",
  FZ: "Douane / immigration",
  // G — GNSS
  GA: "Opérations GNSS propres à l'aérodrome",
  GW: "Opérations GNSS de zone",
  // I — ILS / MLS
  IC: "ILS",
  ID: "DME associé à l'ILS",
  IG: "Alignement de descente (glide) ILS",
  II: "Radioborne intérieure (ILS)",
  IL: "Radiophare d'alignement de piste (localizer) ILS",
  IM: "Radioborne intermédiaire (ILS)",
  IN: "Localizer non associé à un ILS",
  IO: "Radioborne extérieure (ILS)",
  IS: "ILS catégorie I",
  IT: "ILS catégorie II",
  IU: "ILS catégorie III",
  IW: "MLS",
  IX: "Locator extérieur (ILS)",
  IY: "Locator intermédiaire (ILS)",
  // L — Balisage lumineux
  LA: "Rampe d'approche (ALS)",
  LB: "Phare d'aérodrome",
  LC: "Feux d'axe de piste",
  LD: "Feux indicateurs de direction d'atterrissage",
  LE: "Feux de bord de piste",
  LF: "Feux à éclats séquentiels",
  LG: "Balisage commandé par le pilote (PCL)",
  LH: "Feux de piste haute intensité",
  LI: "Feux d'identification de fin de piste",
  LJ: "Feux d'alignement de piste",
  LK: "Éléments CAT II de la rampe d'approche",
  LL: "Feux de piste basse intensité",
  LM: "Feux de piste moyenne intensité",
  LP: "PAPI",
  LR: "Ensemble du balisage de l'aire d'atterrissage",
  LS: "Feux de prolongement d'arrêt",
  LT: "Feux de seuil",
  LU: "Indicateur de trajectoire d'approche hélicoptère",
  LV: "VASIS",
  LW: "Balisage d'héliport",
  LX: "Feux d'axe de voie de circulation",
  LY: "Feux de bord de voie de circulation",
  LZ: "Feux de zone de toucher des roues",
  // M — Aire de mouvement
  MA: "Aire de mouvement",
  MB: "Résistance de la chaussée",
  MC: "Prolongement dégagé (clearway)",
  MD: "Distances déclarées",
  MG: "Système de guidage au sol",
  MH: "Dispositif d'arrêt de piste",
  MK: "Aire de stationnement",
  MM: "Marques de jour",
  MN: "Aire de trafic (parking avions)",
  MO: "Barre d'arrêt",
  MP: "Postes de stationnement",
  MR: "Piste",
  MS: "Prolongement d'arrêt (stopway)",
  MT: "Seuil",
  MU: "Raquette de retournement",
  MW: "Bande de piste / accotement",
  MX: "Voie de circulation (taxiway)",
  MY: "Voie de sortie rapide",
  // N — Aides radio
  NA: "Toutes les aides radio à la navigation",
  NB: "NDB",
  NC: "DECCA",
  ND: "DME",
  NF: "Radioborne en éventail",
  NL: "Locator",
  NM: "VOR/DME",
  NN: "TACAN",
  NO: "OMEGA",
  NT: "VORTAC",
  NV: "VOR",
  NX: "Station radiogoniométrique (VDF)",
  // O — Autres informations
  OA: "Service d'information aéronautique (SIA)",
  OB: "Obstacle",
  OE: "Conditions d'entrée des aéronefs",
  OL: "Balisage lumineux d'obstacle",
  OR: "Centre de coordination de sauvetage (RCC)",
  // P — Procédures
  PA: "Arrivée normalisée aux instruments (STAR)",
  PB: "Arrivée VFR normalisée",
  PC: "Procédures d'urgence",
  PD: "Départ normalisé aux instruments (SID)",
  PE: "Départ VFR normalisé",
  PF: "Procédure de régulation des flux",
  PH: "Procédure d'attente",
  PI: "Procédure d'approche aux instruments",
  PK: "Procédure d'approche VFR",
  PL: "Traitement des plans de vol",
  PM: "Minimums opérationnels d'aérodrome",
  PN: "Restriction d'exploitation liée au bruit",
  PO: "Altitude / hauteur de franchissement d'obstacles (OCA/OCH)",
  PR: "Procédures en cas de panne radio",
  PT: "Altitude ou niveau de transition",
  PU: "Procédure d'approche interrompue",
  PX: "Altitude minimale d'attente",
  PZ: "Procédure ADIZ",
  // R — Restrictions d'espace aérien
  RA: "Réservation d'espace aérien",
  RD: "Zone dangereuse (D)",
  RM: "Zone d'opérations militaires",
  RO: "Survol de…",
  RP: "Zone interdite (P)",
  RR: "Zone réglementée (R)",
  RT: "Zone réglementée temporaire (ZRT)",
  // S — Services ATS
  SA: "ATIS",
  SB: "Bureau de piste ATS (BRIA)",
  SC: "Centre de contrôle régional (ACC)",
  SE: "Service d'information de vol (FIS)",
  SF: "Service d'information de vol d'aérodrome (AFIS)",
  SL: "Centre de régulation des flux",
  SO: "Centre de contrôle océanique",
  SP: "Contrôle d'approche (APP)",
  SS: "Station de service de vol",
  ST: "Tour de contrôle (TWR)",
  SU: "Centre de contrôle supérieur",
  SV: "Diffusion VOLMET",
  SY: "Service consultatif supérieur",
  // W — Avertissements à la navigation
  WA: "Meeting / démonstration aérienne",
  WB: "Voltige",
  WC: "Ballon captif ou cerf-volant",
  WD: "Destruction d'explosifs",
  WE: "Exercices (militaires)",
  WF: "Ravitaillement en vol",
  WG: "Vol à voile",
  WH: "Tirs de mine (explosions)",
  WJ: "Remorquage de banderole / cible",
  WL: "Lâcher de ballon libre",
  WM: "Tirs de missiles, canons ou roquettes",
  WP: "Parachutage / parapente / deltaplane",
  WR: "Matières radioactives ou produits chimiques toxiques",
  WS: "Combustion ou échappement de gaz",
  WT: "Mouvement massif d'aéronefs",
  WU: "Drones (aéronefs sans équipage)",
  WV: "Vol en formation",
  WW: "Activité volcanique importante",
  WY: "Levé aérien (photo, relevé)",
  WZ: "Aéromodélisme",
  // Spéciaux
  XX: "Sujet non codé (voir le texte en clair)"
};

const ETATS = {
  // A — Disponibilité
  AC: "Retiré pour maintenance",
  AD: "Disponible de jour",
  AF: "Contrôlé en vol et jugé fiable",
  AG: "En service, vérifié au sol seulement (contrôle en vol attendu)",
  AH: "Horaires de service modifiés",
  AK: "Reprise du fonctionnement normal",
  AL: "En service sous réserve des limitations publiées",
  AM: "Opérations militaires uniquement",
  AN: "Disponible de nuit",
  AO: "Opérationnel",
  AP: "Disponible sur autorisation préalable (PPR)",
  AR: "Disponible sur demande",
  AS: "Hors service",
  AU: "Non disponible",
  AW: "Retiré définitivement",
  AX: "Arrêt annoncé annulé",
  // C — Changements
  CA: "Activé",
  CC: "Terminé",
  CD: "Désactivé",
  CE: "Érigé (nouvel obstacle)",
  CF: "Fréquence modifiée",
  CG: "Déclassé",
  CH: "Modifié",
  CI: "Indicatif ou identification modifié",
  CL: "Réaligné",
  CM: "Déplacé",
  CN: "Annulé",
  CO: "En fonctionnement",
  CP: "Fonctionne à puissance réduite",
  CR: "Remplacé temporairement",
  CS: "Installé",
  CT: "En essai, ne pas utiliser",
  // H — Dangers
  HA: "Efficacité de freinage",
  HB: "Coefficient de frottement",
  HC: "Couvert de neige compactée",
  HD: "Couvert de neige sèche",
  HE: "Couvert d'eau",
  HF: "Totalement dégagé de neige et de glace",
  HG: "Tonte de l'herbe en cours",
  HH: "Danger dû à…",
  HI: "Couvert de glace",
  HJ: "Lancement prévu",
  HK: "Migration d'oiseaux en cours",
  HL: "Déneigement terminé",
  HM: "Balisé par…",
  HN: "Couvert de neige mouillée ou de neige fondante",
  HO: "Masqué par la neige",
  HP: "Déneigement en cours",
  HQ: "Opération annulée",
  HR: "Eau stagnante",
  HS: "Sablage en cours",
  HT: "Approche selon l'aire à signaux uniquement",
  HU: "Lancement en cours",
  HV: "Travaux terminés",
  HW: "Travaux en cours",
  HX: "Concentration d'oiseaux",
  HY: "Présence de congères",
  HZ: "Couvert d'ornières gelées",
  // L — Limitations
  LA: "Fonctionne sur alimentation de secours",
  LB: "Réservé aux aéronefs basés",
  LC: "Fermé",
  LD: "Dangereux",
  LE: "Fonctionne sans alimentation de secours",
  LF: "Brouillage par…",
  LG: "Fonctionne sans identification",
  LH: "Inutilisable pour les aéronefs plus lourds que…",
  LI: "Fermé aux vols IFR",
  LK: "Fonctionne en feu fixe",
  LL: "Utilisable sur une longueur et une largeur de…",
  LN: "Fermé à toute exploitation de nuit",
  LP: "Interdit à…",
  LR: "Aéronefs limités aux pistes et voies de circulation",
  LS: "Sujet à interruption",
  LT: "Limité à…",
  LV: "Fermé aux vols VFR",
  LW: "Aura lieu (activité prévue)",
  LX: "En service, prudence recommandée en raison de…",
  // Spéciaux
  TT: "Trigger : renvoi vers un SUP AIP / AIRAC",
  XX: "Voir le texte en clair (champ E)"
};

const TRAFIC = { I: "IFR", V: "VFR", K: "Liste récapitulative (checklist)" };
const OBJET = {
  N: "À porter immédiatement à l'attention des pilotes",
  B: "Inclus dans le bulletin d'information prévol (PIB)",
  O: "Important pour les opérations aériennes",
  M: "Divers (pas de briefing systématique)",
  K: "Liste récapitulative (checklist)"
};
const PORTEE = {
  A: "Aérodrome",
  E: "En route",
  W: "Avertissement à la navigation",
  K: "Liste récapitulative (checklist)"
};

/* Conseils pratiques pour un pilote VFR, selon le code complet ou l'état. */
function conseil(sujet, etat) {
  const f = sujet[0];
  if (etat === "TT") return "Ce NOTAM signale seulement l'existence d'un SUP AIP. Il ne veut PAS dire que la zone est active : cherchez un NOTAM d'activation (état CA) pour la même zone.";
  if (f === "R" && etat === "CA") return "Zone ACTIVE : vérifiez les créneaux en champ D) ou E) (heures UTC) et les limites F) et G).";
  if (f === "R" && etat === "CD") return "Zone désactivée sur la période indiquée.";
  if (f === "R" && (etat === "CH" || etat === "XX")) return "Modification de la zone (gestionnaire, limites, conditions…). Ce n'est pas forcément une activation : lisez le champ E).";
  if (f === "A" && etat === "AH") return "Horaires d'activation modifiés : en dehors des créneaux, consultez la carte VAC ou l'AIP pour le statut de l'espace.";
  if (f === "A" && etat === "CH") return "Classe ou limites d'espace modifiées : le NOTAM prime sur la carte imprimée.";
  if (f === "W" && etat === "LW") return "Activité prévue : vérifiez les horaires (champ D ou E, en UTC) et les limites verticales.";
  if (sujet === "OL" && etat === "AS") return "L'obstacle est toujours là, seul son balisage lumineux est éteint. Important surtout de nuit ou par visibilité réduite.";
  if (sujet === "OB" && etat === "CE") return "Nouvel obstacle : notez sa position et son altitude au sommet.";
  if (etat === "LC") return "Fermé sur la période indiquée.";
  if (etat === "AS" || etat === "AU") return "Indisponible : prévoyez une alternative.";
  if (etat === "CF") return "Nouvelle fréquence : mettez à jour votre log de nav.";
  if (etat === "HW") return "Travaux : vérifiez la zone concernée et les éventuelles restrictions.";
  return "";
}

/* Convertit un niveau de vol à 3 chiffres en texte lisible. */
function niveau(n) {
  const v = parseInt(n, 10);
  if (isNaN(v)) return n;
  if (v === 0) return "SFC";
  if (v === 999) return "illimité";
  return "FL" + String(v).padStart(3, "0") + " (≈ " + (v * 100).toLocaleString("fr-FR") + " ft)";
}

/* Décode une saisie : "QRRCA", "RRCA", "rrca" ou une ligne Q) complète. */
function decoder(saisie) {
  const brut = (saisie || "").toUpperCase().trim();
  if (!brut) return null;

  const res = { ligne: null };

  // Ligne Q) complète : FIR / QXXXX / trafic / objet / portée / bas/haut / coord+rayon
  const parts = brut.replace(/^Q\)\s*/, "").split("/").map(s => s.trim());
  let code = null;
  if (parts.length >= 2) {
    const q = parts.find(p => /^Q[A-Z]{4}$/.test(p));
    if (q) {
      code = q.slice(1);
      const i = parts.indexOf(q);
      const fir = parts[i - 1] || "";
      const trafic = parts[i + 1] || "";
      const objet = parts[i + 2] || "";
      const portee = parts[i + 3] || "";
      const bas = parts[i + 4] || "";
      const haut = parts[i + 5] || "";
      const pos = parts[i + 6] || "";
      const m = pos.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])(\d{3})?$/);
      res.ligne = {
        fir: fir,
        trafic: trafic.split("").map(c => TRAFIC[c] || c).join(" + "),
        objet: objet.split("").map(c => OBJET[c] || c),
        portee: portee.split("").map(c => PORTEE[c] || c).join(" + "),
        bas: bas ? niveau(bas) : "",
        haut: haut ? niveau(haut) : "",
        position: m ? `${m[1]}°${m[2]}' ${m[3]} – ${m[4]}°${m[5]}' ${m[6]}` : pos,
        rayon: m && m[7] ? parseInt(m[7], 10) + " NM" : ""
      };
    }
  }

  if (!code) {
    const m = brut.match(/^Q?([A-Z]{2,4})$/);
    if (!m) return null;
    code = m[1];
  }

  const sujet = code.slice(0, 2);
  const etat = code.slice(2, 4);

  // Refuse ce qui n'est pas un vrai code Q (ex. « LFEE », indicateur OACI)
  if (!SUJETS[sujet] || (etat.length === 2 && !ETATS[etat])) {
    const sansQ = brut.replace(/^Q(?=[A-Z]{4}$)/, "");
    return {
      erreur: /^[A-Z]{4}$/.test(sansQ) && /^(LF|EB|ED|EG|EL|LS|LE|LI|EH)/.test(sansQ)
        ? `« ${sansQ} » n'est pas un code Q : c'est un indicateur OACI (aérodrome ou FIR).`
        : `« ${brut} » n'est pas un code Q connu.` +
          (!SUJETS[sujet] ? ` Sujet « ${sujet} » inconnu.` : ` État « ${etat} » inconnu.`)
    };
  }
  res.code = "Q" + code;
  res.famille = FAMILLES[sujet[0]] || "";
  res.sujet = sujet;
  res.sujetTxt = SUJETS[sujet] || (sujet.length === 2 ? "Sujet inconnu" : "");
  res.etat = etat;
  res.etatTxt = etat.length === 2 ? (ETATS[etat] || "État inconnu") : "";
  res.conseil = etat.length === 2 ? conseil(sujet, etat) : "";
  return res;
}

/* Recherche inverse : mot-clé → codes. */
function sansAccent(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function rechercher(mot) {
  const m = sansAccent(mot.trim());
  if (m.length < 3) return { sujets: [], etats: [] };
  const f = (obj) => Object.entries(obj).filter(([k, v]) => sansAccent(v).includes(m));
  return { sujets: f(SUJETS), etats: f(ETATS) };
}


/* =====================================================================
   LEXIQUE — abréviations courantes des NOTAM (OACI Doc 8400 + usages FR)
   ===================================================================== */
const LEXIQUE = {
  "A/A": "Fréquence d'auto-information (aérodrome sans contrôle)",
  ABV: "Au-dessus de",
  ACC: "Centre de contrôle régional",
  ACFT: "Aéronef",
  ACT: "Actif, activé, activité",
  AD: "Aérodrome",
  AFIS: "Service d'information de vol d'aérodrome",
  AGL: "Au-dessus du sol (hauteur)",
  AIC: "Circulaire d'information aéronautique",
  AIP: "Publication d'information aéronautique",
  AIRAC: "Cycle réglementé de mise à jour de l'information aéronautique (28 jours)",
  ALT: "Altitude",
  ALTN: "Dégagement (aérodrome de dégagement)",
  AMSL: "Au-dessus du niveau moyen de la mer (altitude)",
  APCH: "Approche",
  APN: "Aire de trafic (parking)",
  APP: "Contrôle d'approche / approche",
  APRX: "Approximativement",
  ARP: "Point de référence de l'aérodrome",
  ARR: "Arrivée",
  ASFC: "Au-dessus de la surface (sol ou mer)",
  ATC: "Contrôle de la circulation aérienne",
  ATIS: "Service automatique d'information de région terminale",
  ATS: "Services de la circulation aérienne",
  ATZ: "Zone de circulation d'aérodrome",
  AUTH: "Autorisé, autorisation",
  AVBL: "Disponible",
  AWY: "Voie aérienne",
  AZBA: "Activité du réseau très basse altitude (zones RTBA actives)",
  BCST: "Diffusion",
  BLW: "Au-dessous de",
  BTN: "Entre",
  BVLOS: "Vol hors vue du télépilote (drone)",
  CAT: "Catégorie",
  CDC: "Centre de détection et de contrôle (défense aérienne)",
  CIV: "Civil",
  CLSD: "Fermé",
  COM: "Communications",
  COORD: "Coordonnées, coordination",
  CTA: "Région de contrôle",
  CTN: "Prudence (caution)",
  CTR: "Zone de contrôle",
  DEP: "Départ",
  DIST: "Distance",
  DLY: "Tous les jours",
  DME: "Dispositif de mesure de distance",
  DTHR: "Seuil décalé",
  ELEV: "Altitude topographique (de l'aérodrome ou du terrain)",
  ENR: "En route",
  EST: "Estimé (une date de fin « EST » peut être prolongée)",
  EXC: "Sauf",
  FIR: "Région d'information de vol",
  FIS: "Service d'information de vol",
  FL: "Niveau de vol (altimètre calé à 1013 hPa)",
  FM: "À partir de",
  FREQ: "Fréquence",
  FT: "Pieds",
  GND: "Sol",
  GNSS: "Système mondial de navigation par satellite",
  GP: "Alignement de descente (glide path)",
  GPS: "Système de positionnement par satellite",
  H24: "24 heures sur 24",
  HEL: "Hélicoptère",
  HGT: "Hauteur",
  HJ: "Du lever au coucher du soleil",
  HN: "Du coucher au lever du soleil",
  HO: "Selon les besoins opérationnels",
  HR: "Heures",
  HX: "Pas d'horaires précis",
  IFR: "Règles de vol aux instruments",
  ILS: "Système d'atterrissage aux instruments",
  INFO: "Information",
  INOP: "Hors service",
  KHZ: "Kilohertz",
  KM: "Kilomètres",
  LDG: "Atterrissage",
  LGT: "Feu, balisage lumineux",
  LGTD: "Balisé (éclairé)",
  LOC: "Radiophare d'alignement (localizer) / local",
  MAINT: "Maintenance",
  MAX: "Maximum",
  MHZ: "Mégahertz",
  MIL: "Militaire",
  MIN: "Minimum / minutes",
  MNM: "Minimum",
  NAV: "Navigation",
  NDB: "Radiobalise non directionnelle",
  NIL: "Néant",
  NM: "Milles nautiques",
  NML: "Normal",
  NOTAM: "Avis aux navigants",
  NR: "Numéro",
  "O/R": "Sur demande",
  OBST: "Obstacle",
  OPN: "Ouvert",
  OPR: "Exploitant",
  OPS: "Opérations",
  PAPI: "Indicateur de trajectoire d'approche de précision",
  PERM: "Permanent",
  PJE: "Exercice de parachutage",
  PPR: "Autorisation préalable obligatoire",
  PSN: "Position",
  RDL: "Radial (d'un VOR)",
  REF: "Référence",
  REQ: "Demande, demander",
  RMK: "Remarque",
  RMZ: "Zone où la radio est obligatoire",
  RNAV: "Navigation de surface",
  RTBA: "Réseau très basse altitude (défense)",
  RWY: "Piste",
  SFC: "Surface (sol ou mer)",
  SIA: "Service de l'information aéronautique",
  SIV: "Secteur d'information de vol",
  SR: "Lever du soleil",
  SS: "Coucher du soleil",
  SUP: "Supplément (SUP AIP)",
  SVC: "Service",
  TDZ: "Zone de toucher des roues",
  TEL: "Téléphone",
  TEMPO: "Temporaire",
  TFC: "Trafic",
  THR: "Seuil de piste",
  TIL: "Jusqu'à",
  TKOF: "Décollage",
  TLJ: "Tous les jours",
  TMA: "Région de contrôle terminale",
  TMZ: "Zone où le transpondeur est obligatoire",
  TWR: "Tour de contrôle",
  TWY: "Voie de circulation (taxiway)",
  "U/S": "Hors service",
  UAS: "Aéronef sans équipage (drone)",
  UIR: "Région supérieure d'information de vol",
  ULM: "Ultraléger motorisé",
  UNL: "Illimité",
  UTC: "Temps universel coordonné (Paris = UTC+2 en été, UTC+1 en hiver)",
  VAC: "Carte d'approche et d'atterrissage à vue",
  VFR: "Règles de vol à vue",
  VIS: "Visibilité",
  VOLMET: "Diffusion météo pour les aéronefs en vol",
  VOR: "Radiophare omnidirectionnel VHF",
  WEF: "À compter du",
  WI: "À l'intérieur de",
  WIP: "Travaux en cours",
  ZDT: "Zone dangereuse temporaire",
  ZIT: "Zone interdite temporaire",
  ZRT: "Zone réglementée temporaire",
  // Jours
  MON: "Lundi", TUE: "Mardi", WED: "Mercredi", THU: "Jeudi", FRI: "Vendredi", SAT: "Samedi", SUN: "Dimanche",
  LUN: "Lundi", MER: "Mercredi", JEU: "Jeudi", VEN: "Vendredi", SAM: "Samedi", DIM: "Dimanche",
  MAR: "Mardi (en français) ou mars (en anglais)",
  DAILY: "Tous les jours",
  // Mois (anglais)
  JAN: "Janvier", FEB: "Février", APR: "Avril", MAY: "Mai", JUN: "Juin",
  JUL: "Juillet", AUG: "Août", SEP: "Septembre", OCT: "Octobre", NOV: "Novembre", DEC: "Décembre"
};
/* Mots qu'on ne surligne pas dans le texte E (trop ambigus en français). */
const LEX_SANS_SURLIGNAGE = new Set(["EST", "MAR", "MIN", "MAY", "SUN", "CAT", "COM", "DEC"]);

function chercherLexique(mot) {
  const m = sansAccent((mot || "").trim());
  const tout = Object.entries(LEXIQUE).sort((a, b) => a[0].localeCompare(b[0]));
  if (!m) return tout;
  const up = m.toUpperCase();
  const exacts = tout.filter(([k]) => k === up);
  const debut = tout.filter(([k]) => k !== up && k.startsWith(up));
  const debutMot = new RegExp("(^|[^a-z])" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const sens = m.length >= 3 ? tout.filter(([k, v]) => !k.startsWith(up) && debutMot.test(sansAccent(v))) : [];
  return [...exacts, ...debut, ...sens];
}

/* =====================================================================
   NOTAM COMPLET — lecture des champs, horaires, statut « en vigueur »
   ===================================================================== */
const JOURS = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
                DIM: 0, LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6 };
const MOIS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

function estNotamComplet(t) {
  const T = (t || "").toUpperCase();
  return /(^|\s)[BCDEFG]\)\s/.test(T) || /\bDU\s*:\s*\d/.test(T);
}

function dateUTC(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h, mi); }

function lireChamps(texte) {
  const T = texte.toUpperCase().replace(/\r/g, "");
  const champs = {};
  const re = /(^|\s)([A-GQ])\)\s*/g;
  const marques = [];
  let m;
  while ((m = re.exec(T))) marques.push({ l: m[2], debut: m.index + m[1].length, fin: re.lastIndex });
  marques.forEach((mk, i) => {
    const suite = i + 1 < marques.length ? marques[i + 1].debut : T.length;
    if (!(mk.l in champs)) champs[mk.l] = T.slice(mk.fin, suite).trim();
  });
  const entete = marques.length ? T.slice(0, marques[0].debut) : T;
  // Limites F/G : on ne garde que la valeur (un titre SOFIA peut suivre, ex. « FL145 OBSTACLES »)
  for (const l of ["F", "G"]) {
    if (!champs[l]) continue;
    const v = champs[l].match(/^(SFC|GND|UNL\w*|FL\s*\d{2,3}|\d+\s*(?:FT|M)(?:\s*(?:AGL|AMSL|ASFC|MSL|SFC))?)/);
    champs[l] = v ? v[1] : champs[l].split("\n")[0].trim();
  }

  const n = { champs };
  const id = T.match(/\b(?:([A-Z]{4})-)?([A-Z]\d{4}\/\d{2})\b/);
  if (id) n.id = (id[1] ? id[1] + "-" : "") + id[2];

  // Validité : format brut OACI (B/C) ou format SOFIA (DU : … AU : …)
  const brut = (s) => { const x = (s || "").match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/); return x ? dateUTC(2000 + +x[1], +x[2], +x[3], +x[4], +x[5]) : null; };
  n.debut = brut(champs.B);
  n.fin = brut(champs.C);
  n.perm = /PERM/.test(champs.C || "");
  n.estime = /EST/.test(champs.C || "");
  const du = entete.match(/DU\s*:\s*(\d{2})\s+(\d{2})\s+(\d{4})\s+(\d{2}):(\d{2})/) || T.match(/DU\s*:\s*(\d{2})\s+(\d{2})\s+(\d{4})\s+(\d{2}):(\d{2})/);
  const au = entete.match(/AU\s*:\s*(PERM|(\d{2})\s+(\d{2})\s+(\d{4})\s+(\d{2}):(\d{2}))(\s*EST)?/) || T.match(/AU\s*:\s*(PERM|(\d{2})\s+(\d{2})\s+(\d{4})\s+(\d{2}):(\d{2}))(\s*EST)?/);
  if (n.debut == null && du) n.debut = dateUTC(+du[3], +du[2], +du[1], +du[4], +du[5]);
  if (n.fin == null && au) {
    if (au[1] === "PERM") n.perm = true;
    else n.fin = dateUTC(+au[4], +au[3], +au[2], +au[5], +au[6]);
    if (au[7]) n.estime = true;
  }

  // Ligne Q et position
  if (champs.Q) {
    n.q = decoder("Q) " + champs.Q);
    const p = champs.Q.match(/(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])/);
    if (p) {
      n.lat = (+p[1] + p[2] / 60) * (p[3] === "S" ? -1 : 1);
      n.lon = (+p[4] + p[5] / 60) * (p[6] === "W" ? -1 : 1);
    }
  }

  // Horaires : champ D en priorité, sinon horaires repérés dans le texte E
  n.horaires = null;
  if (champs.D) {
    n.horaires = lireHoraires(champs.D, false);
    n.sourceHoraires = "D";
  } else if (champs.E) {
    const h = horairesDansTexte(champs.E);
    if (h) { n.horaires = h; n.sourceHoraires = "E"; }
  }
  return n;
}

/* ---------- Lever / coucher du soleil (algorithme de l'Almanach nautique) ---------- */
function soleil(jourUTC, lat, lon, lever) {
  const rad = Math.PI / 180;
  const d = new Date(jourUTC);
  const N = Math.floor((jourUTC - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  const lngH = lon / 15;
  const t = N + ((lever ? 6 : 18) - lngH) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
  L = ((L % 360) + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = ((RA % 360) + 360) % 360;
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return lever ? 360 : 1080;
  const H = (lever ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = (((T - lngH) % 24) + 24) % 24;
  return Math.round(UT * 60); // minutes UTC
}

/* ---------- Lecture d'un horaire (champ D ou extrait du texte E) ---------- */
function lirePlage(tok) {
  if (tok === "H24") return [{ a: 0, b: 1440 }];
  if (tok === "HJ") return [{ a: "SR", b: "SS" }];
  if (tok === "HN") return [{ a: "SS", b: "SR" }];
  const m = tok.match(/^(\d{4}|SR|SS)-(\d{4}|SR|SS)$/);
  if (!m) return null;
  const v = (x) => {
    if (x === "SR" || x === "SS") return x;
    const h = +x.slice(0, 2), mi = +x.slice(2);
    return h <= 24 && mi < 60 ? h * 60 + mi : NaN;
  };
  const a = v(m[1]), b = v(m[2]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return [{ a, b }];
}

function lireJour(tok, mois, francais) {
  if (tok === "DAILY" || tok === "TLJ" || tok === "DLY") return { pred: () => true };
  if (!francais && MOIS[tok] !== undefined) return { mois: MOIS[tok] };
  const r = tok.match(/^([A-Z]{3})-([A-Z]{3})$/);
  if (r && JOURS[r[1]] !== undefined && JOURS[r[2]] !== undefined) {
    const a = JOURS[r[1]], b = JOURS[r[2]];
    const set = new Set(); for (let i = a; ; i = (i + 1) % 7) { set.add(i); if (i === b) break; }
    return { pred: (d) => set.has(d.getUTCDay()) };
  }
  if (JOURS[tok] !== undefined) { const j = JOURS[tok]; return { pred: (d) => d.getUTCDay() === j }; }
  const n = tok.match(/^(\d{2})(?:-(\d{2}))?$/);
  if (n) {
    const a = +n[1], b = n[2] ? +n[2] : a, mo = mois;
    if (a < 1 || a > 31 || b < 1 || b > 31) return null;
    return { pred: (d) => (mo == null || d.getUTCMonth() === mo) && d.getUTCDate() >= a && d.getUTCDate() <= b };
  }
  return null;
}

function normaliserHoraire(txt) {
  return txt.toUpperCase()
    .replace(/[,;]/g, " ")
    .replace(/(\d{4}|SR|SS)\s*-\s*(\d{4}|SR|SS)/g, "$1-$2")
    .replace(/\b([A-Z]{3})\s*(?:-|\bA\b|\bÀ\b|\bAU\b)\s*([A-Z]{3})\b/g, (t, a, b) => (JOURS[a] !== undefined && JOURS[b] !== undefined ? a + "-" + b : t))
    .replace(/\b(\d{2})\s*-\s*(\d{2})\b/g, "$1-$2");
}

function lireHoraires(txt, francais) {
  const tokens = normaliserHoraire(txt).split(/\s+/).filter(Boolean);
  const regles = [];
  let regle = null, excl = false, mois = null, partiel = false;
  const nouvelle = () => { regle = { incl: [], excl: [], plages: [] }; regles.push(regle); excl = false; };
  for (const tok of tokens) {
    const p = lirePlage(tok);
    if (p) { if (!regle) nouvelle(); regle.plages.push(...p); continue; }
    if (tok === "EXC" || tok === "SAUF") { if (!regle) nouvelle(); excl = true; continue; }
    if (tok === "ET" || tok === "AND" || tok === "-" || tok === ":") continue;
    const j = lireJour(tok, mois, francais);
    if (j) {
      if (j.mois !== undefined && !j.pred) { mois = j.mois; if (!regle || regle.plages.length) nouvelle(); continue; }
      if (!regle || (regle.plages.length && !excl)) nouvelle();
      (excl ? regle.excl : regle.incl).push(j.pred);
      continue;
    }
    partiel = true;
  }
  if (!regles.some((r) => r.plages.length)) return null;
  return { regles, partiel };
}

/* Repère dans le texte E des lignes du type « LUN-VEN : 0800-1000 1200-1500 ». */
function horairesDansTexte(E) {
  const T = normaliserHoraire(E);
  const D = "(?:LUN|MAR|MER|JEU|VEN|SAM|DIM|MON|TUE|WED|THU|FRI|SAT|SUN|TLJ|DAILY)";
  const re = new RegExp(`(^|[^A-Z])(${D}(?:(?:-|\\s+ET\\s+|\\s+)${D})*)\\s*:`, "g");
  const morceaux = [];
  let m;
  while ((m = re.exec(T))) morceaux.push({ jours: m[2], fin: re.lastIndex, debut: m.index + m[1].length });
  if (!morceaux.length) return null;
  const regles = [];
  morceaux.forEach((mk, i) => {
    const suite = T.slice(mk.fin, i + 1 < morceaux.length ? morceaux[i + 1].debut : T.length);
    const plages = [];
    for (const tok of suite.split(/\s+/).filter(Boolean)) {
      const p = lirePlage(tok);
      if (p) plages.push(tok);
      else if (tok === "-" || tok === "ET") continue;
      else break;
    }
    const h = lireHoraires(mk.jours + " " + (plages.join(" ") || ""), true);
    if (h) regles.push(...h.regles);
    else { // jour sans plage horaire (ex. « SAM : ATS NON ASSURES ») → rien ce jour-là
      const v = lireHoraires(mk.jours + " 0000-0000", true);
      if (v) v.regles.forEach((r) => { r.plages = []; regles.push(r); });
    }
  });
  if (!regles.some((r) => r.plages.length)) return null;
  return { regles, partiel: false };
}

/* ---------- Plages effectives et statut ---------- */
function plagesDuJour(jour, horaires, lat, lon) {
  const d = new Date(jour);
  const res = [];
  // Une règle ne s'applique que si aucune règle plus précise ne vise ce jour :
  // on applique toutes les règles qui correspondent (cas usuel des NOTAM).
  for (const r of horaires.regles) {
    const ok = (r.incl.length === 0 || r.incl.some((p) => p(d))) && !r.excl.some((p) => p(d));
    if (!ok) continue;
    for (const pl of r.plages) {
      const val = (x) => (x === "SR" ? soleil(jour, lat, lon, true) : x === "SS" ? soleil(jour, lat, lon, false) : x);
      let a = val(pl.a), b = val(pl.b);
      if (b <= a) b += 1440;
      res.push([jour + a * 60000, jour + b * 60000]);
    }
  }
  return res;
}

function fusionner(pl) {
  pl.sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const p of pl) {
    const der = out[out.length - 1];
    if (der && p[0] <= der[1]) der[1] = Math.max(der[1], p[1]);
    else out.push([p[0], p[1]]);
  }
  return out;
}

function evaluerNotam(n, maintenant) {
  const now = maintenant || Date.now();
  const debut = n.debut, fin = n.perm || n.fin == null ? Infinity : n.fin;
  const lat = n.lat != null ? n.lat : 46.6, lon = n.lon != null ? n.lon : 2.4;
  const st = { now, debut, fin };
  if (debut == null) { st.etat = "inconnu"; return st; }
  if (now >= fin) { st.etat = "expire"; return st; }

  let plages;
  if (n.horaires) {
    const jour0 = Math.floor(Math.max(debut, now - 86400000) / 86400000) * 86400000;
    const limite = Math.min(fin, Math.max(now, debut) + 30 * 86400000);
    plages = [];
    for (let j = jour0; j <= limite; j += 86400000) plages.push(...plagesDuJour(j, n.horaires, lat, lon));
    plages = fusionner(plages.map(([a, b]) => [Math.max(a, debut), Math.min(b, fin)]).filter(([a, b]) => b > a));
  } else {
    plages = [[debut, fin]];
  }
  const courante = plages.find(([a, b]) => now >= a && now < b);
  st.etat = courante ? "actif" : now < debut ? "futur" : "inactif";
  st.courante = courante || null;
  st.prochaines = plages.filter(([a]) => a > now).slice(0, 6);
  st.soleilApprox = n.horaires && n.lat == null;
  return st;
}

/* ---------- Limites F) / G) ---------- */
function lireLimite(s) {
  if (!s) return "";
  const t = s.trim().toUpperCase();
  if (/^(SFC|GND)$/.test(t)) return "Sol (" + t + ")";
  if (/^UNL/.test(t)) return "Illimité";
  let m = t.match(/^FL\s*(\d{2,3})/);
  if (m) return `FL${m[1]} — niveau de vol, altimètre calé à 1013 hPa (≈ ${(+m[1] * 100).toLocaleString("fr-FR")} ft)`;
  m = t.match(/^(\d+)\s*FT\s*(AGL|AMSL|ASFC|MSL)?/);
  if (m) {
    const v = (+m[1]).toLocaleString("fr-FR") + " ft";
    const ref = m[2] || "";
    const sens = ref === "AGL" ? "hauteur au-dessus du sol" : ref === "ASFC" ? "hauteur au-dessus de la surface" : ref ? "altitude (calage QNH)" : "";
    return `${v} ${ref}${sens ? " — " + sens : ""}`;
  }
  m = t.match(/^(\d+)\s*M\s*(AGL|AMSL)?/);
  if (m) return `${(+m[1]).toLocaleString("fr-FR")} m ${m[2] || ""} (≈ ${Math.round(m[1] * 3.281).toLocaleString("fr-FR")} ft)`;
  return t;
}


/* =====================================================================
   TRI D'UN BRIEFING COMPLET
   ===================================================================== */

/* Plages pendant lesquelles le NOTAM s'applique entre t1 et t2 (ms UTC).
   null si les dates sont introuvables. */
function plagesEntre(n, t1, t2) {
  const debut = n.debut, fin = n.perm || n.fin == null ? Infinity : n.fin;
  if (debut == null) return null;
  const a = Math.max(t1, debut), b = Math.min(t2, fin);
  if (b <= a) return [];
  if (!n.horaires) return [[a, b]];
  const lat = n.lat != null ? n.lat : 46.6, lon = n.lon != null ? n.lon : 2.4;
  const res = [];
  for (let j = Math.floor((a - 86400000) / 86400000) * 86400000; j <= b; j += 86400000) {
    res.push(...plagesDuJour(j, n.horaires, lat, lon));
  }
  return fusionner(res.map(([x, y]) => [Math.max(x, a), Math.min(y, b)]).filter(([x, y]) => y > x));
}

const TITRE_SOFIA = /^(?:(?:OBSTACLES|EN-ROUTE|NIL|AUTRES INFORMATIONS|RESTRICTIONS DE L.ESPACE AERIEN|ORGANISATION DE L.ESPACE AERIEN ET PROCEDURES|SERVICES DE LA CIRCULATION AERIENNE ET VOLMET|INSTALLATIONS DE COMMUNICATION ET DE SURVEILLANCE|GNSS - INSTALLATIONS DE RADIONAVIGATION|AVERTISSEMENTS A LA NAVIGATION|INSTALLATIONS ET SERVICES|AIRE DE MANOEUVRE|AIRE DE TRAFIC|BALISAGE|AIDES A L.ATTERRISSAGE.*|AERODROME (?:DE DEPART|D.ARRIVEE|DE DEGAGEMENT)|SELECTIONNER TOUS LES NOTAM.*|FAQ.*|.*©.*|.*MENTIONS LEGALES.*|SIA \| DGAC.*|VERSION \d.*)\s*:?|(?:LF|LS|ED|EB|EL)[A-Z]{2}(?: [A-Z]{4})* [A-Z' \-]+)$/;

/* Majuscules sans accents (les NOTAM sont en majuscules, les titres SOFIA non). */
function majSansAccent(t) {
  return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/Œ/g, "OE");
}

/* Titres de rubriques SOFIA à retirer du texte des NOTAM (copie sur une seule ligne). */
const RUBRIQUES_SOFIA = [
  "ORGANISATION DE L'ESPACE AERIEN ET PROCEDURES", "SERVICES DE LA CIRCULATION AERIENNE ET VOLMET",
  "INSTALLATIONS DE COMMUNICATION ET DE SURVEILLANCE", "GNSS - INSTALLATIONS DE RADIONAVIGATION",
  "INSTALLATIONS DE RADIONAVIGATION", "RESTRICTIONS DE L'ESPACE AERIEN", "AVERTISSEMENTS A LA NAVIGATION",
  "AERODROME DE DEPART :", "AERODROME DE DEPART", "AERODROME D'ARRIVEE :", "AERODROME D'ARRIVEE",
  "AERODROME DE DEGAGEMENT :", "AERODROME DE DEGAGEMENT", "INSTALLATIONS ET SERVICES", "AIRE DE MANOEUVRE",
  "AIRE DE TRAFIC", "AIDES A L'ATTERRISSAGE, INSTALLATIONS RADIONAVIGATION ET GNSS",
  "AUTRES INFORMATIONS", "EN-ROUTE", "BALISAGE"
];

const OACI_TITRE = "(?:LF|LS|ED|EB|EL)[A-Z]{2}";
const RE_TITRE_FIN = new RegExp("\\s+" + OACI_TITRE + "(?:\\s+[A-Z][A-Z'\\-]*)*(?:\\s+-\\s+" + OACI_TITRE + "(?:\\s+[A-Z][A-Z'\\-]*)*)*\\s*:?\\s*$");

function nettoyerBloc(b) {
  let t = b
    .replace(/\b\d+\s*\/\s*\d+\s+SIA FRANCE\s*-\s*SOFIA-BRIEFING\b/g, " ")   // pieds de page PDF
    .replace(/\bSELECTIONNER TOUS LES NOTAM\s*\(\d+\)/g, " ")
    .trim();
  // On retire, en fin de bloc seulement, les titres SOFIA collés (rubriques, aérodromes, FIR)
  const fins = [...RUBRIQUES_SOFIA, "NIL", "OBSTACLES"];
  let avant;
  do {
    avant = t;
    t = t.replace(RE_TITRE_FIN, "").trim();
    for (const r of fins) if (t.endsWith(" " + r) || t.endsWith("\n" + r)) t = t.slice(0, -r.length).trim();
  } while (t !== avant);
  return t.replace(/[ \t]{2,}/g, " ");
}

/* Découpe un briefing collé en NOTAM individuels. */
function decouperBriefing(texte) {
  const T = majSansAccent(texte).replace(/\r/g, "");
  const re = /(?:^|\n)[ \t]*((?:[A-Z]{4}-)?[A-Z]\d{4}\/\d{2})(?=\s)|\s([A-Z]{4}-[A-Z]\d{4}\/\d{2})(?=\s)/g;
  const debuts = [];
  let m;
  while ((m = re.exec(T))) {
    const id = m[1] || m[2];
    debuts.push(m.index + m[0].indexOf(id));
  }
  return debuts.map((d, i) => {
    const bloc = T.slice(d, i + 1 < debuts.length ? debuts[i + 1] : T.length);
    const lignes = bloc.split("\n");
    while (lignes.length > 1) {
      const l = lignes[lignes.length - 1].trim();
      if (l === "" || TITRE_SOFIA.test(l)) lignes.pop(); else break;
    }
    return nettoyerBloc(lignes.join("\n").trim());
  });
}

/* Lit l'en-tête d'un PIB SOFIA : départ (UTC), durée, plafond, plancher. */
function lireEntetePIB(texte) {
  const T = majSansAccent(texte);
  const res = {};
  // Le menu de SOFIA peut s'intercaler entre l'intitulé et la valeur : on tolère du texte sans chiffres entre les deux.
  const dep = T.match(/DATE ET HEURE DE DEPART\s*\(UTC\)[^\d]{0,120}?(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (dep) res.depart = Date.UTC(+dep[3], +dep[2] - 1, +dep[1], +dep[4], +dep[5]);
  const dur = T.match(/\bDUREE\b[^\d]{0,120}?(\d{1,2}):?(\d{2})\b/);
  if (dur) res.dureeMin = +dur[1] * 60 + +dur[2];
  const plaf = T.match(/PLAFOND\s*\(EN FL\)[^\d]{0,120}?(\d{1,3})\b/);
  if (plaf) res.plafondFt = +plaf[1] * 100;
  const OACI = "((?:LF|LS|ED|EB|EL|EG|LE|LI)[A-Z]{2})";
  const dpt = T.match(new RegExp("\\bDEPART\\b(?!\\s*\\(|\\s*:)[^\\d]{0,120}?\\b" + OACI + "\\b"));
  const dst = T.match(new RegExp("\\bDESTINATION\\b[^\\d]{0,120}?\\b" + OACI + "\\b"));
  if (dpt) res.de = dpt[1];
  if (dst) res.vers = dst[1];
  return res.depart ? res : null;
}

const IFR_SEUL_SUJETS = new Set(["PA", "PD", "PI", "PU", "PH", "PO", "PX", "PM", "IC", "ID", "IG", "II", "IL", "IM", "IN", "IO", "IS", "IT", "IU", "IW", "IX", "IY"]);
const ORDRE_FAMILLE = "RWAMFSCNLOPGIX";

/* Classe chaque NOTAM : à lire, ou écarté avec une raison. */
function trierBriefing(texte, depart, dureeMin, altMax) {
  const t1 = depart, t2 = depart + dureeMin * 60000;
  const blocs = decouperBriefing(texte);
  const res = { total: blocs.length, garder: [], ecarter: { tt: [], creneau: [], altitude: [], ifr: [], admin: [], checklist: [] } };
  for (const bloc of blocs) {
    let n;
    try { n = lireChamps(bloc); }
    catch (e) { res.garder.push({ texte: bloc, champs: { E: bloc }, id: (bloc.match(/\S+/) || [""])[0], pendantVol: null, illisible: true }); continue; }
    n.texte = bloc;
    const q = n.q && !n.q.erreur ? n.q : null;
    const E = n.champs.E || "";
    const traficBrut = ((n.champs.Q || "").split("/")[2] || "").trim();

    if (q && (q.sujet === "KK" || traficBrut === "K")) { res.ecarter.checklist.push(n); continue; }
    if (q && q.etat === "TT") {
      // Déclencheur de SUP AIP. Si le texte dit que la zone ne s'active QUE par NOTAM, il ne change rien
      // tant qu'aucun NOTAM d'activation n'existe → écarté. Sinon (ex. « activation possible tous les jours
      // SR-SS », activité donnée à la radio), la zone peut être active sans autre NOTAM → à lire.
      const Es = majSansAccent(E);
      if (/ACTIV[A-Z]*\b[^.]{0,100}?PAR\s+NOTAM|ACTIVAT[A-Z]*\b[^.]{0,100}?BY\s+NOTAM/.test(Es)) { res.ecarter.tt.push(n); continue; }
      n.alerteSup = "⚠ Déclencheur de SUP AIP sans activation par NOTAM : la zone peut être active selon les horaires du SUP AIP lui-même (activité souvent donnée à la radio). Lisez le SUP AIP.";
    }
    if (q && (traficBrut === "I" || IFR_SEUL_SUJETS.has(q.sujet))) { res.ecarter.ifr.push(n); continue; }

    const bas = parseInt(((n.champs.Q || "").split("/")[5] || "").trim(), 10);
    if (!isNaN(bas) && bas * 100 > altMax) { n.basFt = bas * 100; res.ecarter.altitude.push(n); continue; }

    if (/TEL|TELEPHONE/.test(E) && !/ACTIV|FERM|CLSD|INTERDIT|HORAIRE|ACTIVE|U\/S|HORS SERVICE/.test(E)) { res.ecarter.admin.push(n); continue; }

    const pl = plagesEntre(n, t1, t2);
    if (pl && pl.length === 0) { res.ecarter.creneau.push(n); continue; }
    n.pendantVol = pl; // null = dates inconnues → gardé par prudence
    res.garder.push(n);
  }
  const rang = (n) => {
    const f = n.q && !n.q.erreur ? ORDRE_FAMILLE.indexOf(n.q.sujet[0]) : 99;
    return f < 0 ? 50 : f;
  };
  res.garder.sort((a, b) => rang(a) - rang(b) || (a.champs.A || "").localeCompare(b.champs.A || ""));
  return res;
}

if (typeof module !== "undefined") module.exports = { decoder, rechercher, chercherLexique, estNotamComplet, lireChamps, evaluerNotam, lireLimite, soleil, trierBriefing, decouperBriefing, plagesEntre, lireEntetePIB, SUJETS, ETATS, FAMILLES, LEXIQUE };
